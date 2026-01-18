(function(){
  // PhilHealth ID scanning and extraction module
  // Exposes window.PhilHealth with isSelected, fillFromText, fillFromWords

  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

  // Common PhilHealth format: 2-9-1 digits (e.g., 12-345678901-2) but OCR may drop hyphens
  const normalizePhilHealthId = (s) => {
    if (!s) return null;
    const digits = String(s).replace(/[^0-9]/g, '');
    if (digits.length >= 12) {
      const core = digits.slice(0, 12); // 2 + 9 + 1 = 12 digits total
      const a = core.slice(0, 2);
      const b = core.slice(2, 11);
      const c = core.slice(11, 12);
      if (/^\d{2}$/.test(a) && /^\d{9}$/.test(b) && /^\d{1}$/.test(c)) {
        return `${a}-${b}-${c}`;
      }
    }
    // Also accept variants already hyphenated correctly
    const m = String(s).match(/\b(\d{2})-(\d{9})-(\d)\b/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    return null;
  };

  const PhilHealth = {
    isSelected() {
      const sel = document.getElementById('id-type');
      if (!sel) return false;
      return String(sel.value).toLowerCase() === 'philhealth';
    },

    async fillFromText(text) {
      if (!this.isSelected()) return; // only when PhilHealth is selected
      if (!text) return;
      const raw = text.replace(/\u0000/g, ' ').trim();
      const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

      // AI-first: call server Gemini endpoint
      let aiFirstName, aiLastName, aiBirthDate, aiIdNumber, aiConfidence;
      try {
        if (window.ocrProcessor && typeof window.ocrProcessor.showAIStatus === 'function') {
          window.ocrProcessor.showAIStatus('Requesting AI extraction (PhilHealth)…');
        }
        const resp = await fetch('/api/ai/philhealth/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rawText: raw })
        });
        if (resp.status === 501) {
          if (window.ocrProcessor && typeof window.ocrProcessor.showAIStatus === 'function') {
            window.ocrProcessor.showAIStatus('AI disabled on server. Set GEMINI_API_KEY in .env and restart.');
          }
        } else if (!resp.ok) {
          let errPayload = null; try { errPayload = await resp.json(); } catch {}
          const extra = errPayload?.details ? ` Details: ${errPayload.details}` : '';
          if (window.ocrProcessor && typeof window.ocrProcessor.showAIStatus === 'function') {
            window.ocrProcessor.showAIStatus(`AI request failed (HTTP ${resp.status}).${extra} Using OCR rules.`);
          }
        } else {
          const data = await resp.json();
          if (data && data.success && data.fields) {
            aiFirstName = data.fields.firstName || undefined;
            aiLastName = data.fields.lastName || undefined;
            aiBirthDate = data.fields.birthDate || undefined;
            aiIdNumber = data.fields.idNumber || undefined;
            aiConfidence = data.confidence;
            if (window.ocrProcessor && typeof window.ocrProcessor.showAIResultsDL === 'function') {
              // Re-use DL renderer to display fields in the AI Results panel
              window.ocrProcessor.showAIResultsDL({
                firstName: aiFirstName,
                lastName: aiLastName,
                birthDate: aiBirthDate,
                idNumber: aiIdNumber,
                confidence: aiConfidence
              });
            }
            if (window.ocrProcessor && typeof window.ocrProcessor.showAIStatus === 'function') {
              window.ocrProcessor.showAIStatus('AI extraction complete (PhilHealth).');
            }
          } else if (data && data.raw) {
            if (window.ocrProcessor && typeof window.ocrProcessor.showAIStatus === 'function') {
              window.ocrProcessor.showAIStatus('AI responded, but no fields were parsed (PhilHealth).');
            }
            const aiPanel = document.getElementById('ai-results-container');
            if (aiPanel) {
              const pre = document.createElement('pre');
              pre.style.cssText = 'white-space: pre-wrap; background: #f8fafc; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0;';
              pre.textContent = data.raw;
              aiPanel.innerHTML = '';
              aiPanel.appendChild(pre);
            }
          }
        }
      } catch (e) {
        if (window.ocrProcessor && typeof window.ocrProcessor.showAIStatus === 'function') {
          window.ocrProcessor.showAIStatus('AI network error (PhilHealth). Using OCR rules.');
        }
      }

      // Fallback heuristics for any missing fields
      let idNumber = aiIdNumber;
      if (!idNumber) {
        // 1) Direct hyphenated match
        for (const line of lines) {
          const m = line.match(/\b(\d{2})-(\d{9})-(\d)\b/);
          if (m) { idNumber = `${m[1]}-${m[2]}-${m[3]}`; break; }
        }
        // 2) Plain digits fallback (12+ contiguous digits)
        if (!idNumber) {
          const m = raw.match(/\b\d{12,}\b/);
          if (m) idNumber = normalizePhilHealthId(m[0]);
        }
        // 3) Label-based capture: HPN, PHILHEALTH NUMBER, PHIC NO
        if (!idNumber) {
          const labelRe = /(?:PHILHEALTH|PHIC|HPN|NO\.?|NUMBER)/i;
          for (const line of lines) {
            if (labelRe.test(line)) {
              const m = line.match(/(?:PHILHEALTH|PHIC|HPN|NO\.?|NUMBER)[:\s-]*([0-9\- ]{6,})/i);
              if (m) { idNumber = normalizePhilHealthId(m[1]); if (idNumber) break; }
            }
          }
        }
      }

      // Names and birth date heuristics (very simple, as PhilHealth layouts vary)
      let lastName = aiLastName;
      let firstName = aiFirstName;
      let birthDate = aiBirthDate;
      if (!lastName || !firstName) {
        // Try common "LASTNAME, FIRSTNAME ..." line
        const nameLine = lines.find(l => /,/.test(l) && /[A-Za-z]/.test(l));
        if (nameLine) {
          const parts = nameLine.split(',');
          if (!lastName && parts[0]) lastName = clean(parts[0]);
          if (!firstName && parts[1]) firstName = clean(parts[1]).split(/\s+/).slice(0,2).join(' ');
        }
      }
      if (!birthDate) {
        // Look for YYYY/MM/DD or Month DD, YYYY around lines
        const dobMatch = raw.match(/\b(\d{4})[\/-](0[1-9]|1[0-2])[\/-]([0-2]?\d|3[01])\b/);
        if (dobMatch) birthDate = `${dobMatch[1]}-${dobMatch[2]}-${String(dobMatch[3]).padStart(2,'0')}`;
      }

      if ((idNumber || lastName || firstName || birthDate) && window.ocrProcessor && typeof window.ocrProcessor.fillDetailsForm === 'function') {
        window.ocrProcessor.fillDetailsForm({ idType: 'philhealth', idNumber: idNumber || undefined, lastName: lastName || undefined, firstName: firstName || undefined, birthDate: birthDate || undefined });
      }
    },

    fillFromWords(words) {
      if (!this.isSelected()) return; // only when PhilHealth is selected
      if (!Array.isArray(words) || words.length === 0) return;
      const tokens = words.map(w => String(w?.text || ''));

      const maxWin = 5;
      const tryNormalize = (arr) => normalizePhilHealthId(arr.join('')) || normalizePhilHealthId(arr.join('-')) || normalizePhilHealthId(arr.join(' '));
      const isHyphenPattern = (t) => /^\d{2}-\d{9}-\d$/.test(String(t || ''));

      let idNumber = null;
      let idEndIndex = -1;

      // A) Direct token that already matches 2-9-1 with hyphens
      for (let i = 0; i < tokens.length; i++) {
        if (isHyphenPattern(tokens[i])) {
          idNumber = tokens[i];
          idEndIndex = i;
          break;
        }
      }

      // B) Small-window join to recover ID and capture the end index
      if (!idNumber) {
        for (let i = 0; i < tokens.length && !idNumber; i++) {
          for (let w = 1; w <= maxWin && i + w <= tokens.length; w++) {
            const seg = tokens.slice(i, i + w);
            const norm = tryNormalize(seg);
            if (norm) { idNumber = norm; idEndIndex = i + w - 1; break; }
          }
        }
      }

      // C) Search near labels: PHILHEALTH, PHIC, HPN, NUMBER, NO.
      if (!idNumber) {
        const labelSet = new Set(['PHILHEALTH','PHIC','HPN','NUMBER','NO']);
        const normL = (s) => String(s || '').toUpperCase().replace(/[^A-Z]/g, '');
        for (let i = 0; i < tokens.length && !idNumber; i++) {
          if (labelSet.has(normL(tokens[i]))) {
            const start = Math.max(0, i - 2);
            const end = Math.min(tokens.length, i + 8);
            for (let s = start; s < end && !idNumber; s++) {
              for (let e = s + 1; e <= Math.min(end, s + maxWin); e++) {
                const seg = tokens.slice(s, e);
                const normed = tryNormalize(seg);
                if (normed) { idNumber = normed; idEndIndex = e - 1; break; }
              }
            }
          }
        }
      }

      // D) Extract Last Name immediately after the ID
      let lastName = undefined;
      let lastNameIndex = -1;
      if (idEndIndex >= 0) {
        let j = idEndIndex + 1;
        while (j < tokens.length) {
          let t = String(tokens[j] || '').trim();
          if (!t) { j++; continue; }
          // skip pure punctuation
          if (/^[,;:]+$/.test(t)) { j++; continue; }
          // remove trailing comma on name token
          t = t.replace(/[,;:]+$/, '');
          if (t) { lastName = t; lastNameIndex = j; break; }
          j++;
        }
      }

      // E) Extract First Name: it comes after a comma following the last name
      let firstName = undefined;
      let firstNameEndIndex = -1;
      if (lastNameIndex >= 0) {
        let k = lastNameIndex + 1;
        // find the comma right after last name
        while (k < tokens.length && !/^,$/.test(String(tokens[k] || '').trim())) {
          // if there's any non-comma token first, skip until we encounter a comma
          k++;
        }
        if (k < tokens.length && /^,$/.test(String(tokens[k] || '').trim())) {
          // tokens after comma: take up to 2 name-like tokens
          const nameParts = [];
          let p = k + 1;
          while (p < tokens.length && nameParts.length < 2) {
            let t = String(tokens[p] || '').trim();
            if (!t) { p++; continue; }
            // stop on punctuation-only
            if (/^[,;:]+$/.test(t)) { p++; continue; }
            t = t.replace(/^[,;:\-]+|[,;:\-]+$/g, '');
            if (!t) { p++; continue; }
            // simple name token heuristic: letters with optional hyphen/apostrophe/dot
            if (/^[A-Za-z][A-Za-z'\-\.]*$/.test(t)) {
              nameParts.push(t);
            } else {
              break;
            }
            p++;
          }
          if (nameParts.length > 0) {
            firstName = nameParts.join(' ');
            firstNameEndIndex = (k + nameParts.length);
          }
        }
      }

      // F) Extract Birth Date after the first name, using flexible month matching
      const monthToNumFlex = (tok) => {
        const s = String(tok || '').toUpperCase().replace(/[^A-Z]/g, '');
        if (!s) return null;
        const months = [
          { names: ['JANUARY','JAN'], num: '01' },
          { names: ['FEBRUARY','FEB'], num: '02' },
          { names: ['MARCH','MAR'], num: '03' },
          { names: ['APRIL','APR'], num: '04' },
          { names: ['MAY'], num: '05' },
          { names: ['JUNE','JUN'], num: '06' },
          { names: ['JULY','JUL'], num: '07' },
          { names: ['AUGUST','AUG'], num: '08' },
          { names: ['SEPTEMBER','SEPT','SEP'], num: '09' },
          { names: ['OCTOBER','OCT'], num: '10' },
          { names: ['NOVEMBER','NOV'], num: '11' },
          { names: ['DECEMBER','DEC'], num: '12' },
        ];
        for (const m of months) {
          for (const n of m.names) {
            if (s === n) return m.num;
            // flexible contains logic to tolerate missing first letters (e.g., ARCH -> MARCH)
            if (s.length >= 3 && (n.includes(s) || s.includes(n))) return m.num;
          }
        }
        return null;
      };

      let birthDate = undefined;
      // define a scanning start index: after firstName if available, else after lastName
      let scanStart = (firstNameEndIndex >= 0) ? firstNameEndIndex + 1 : ((lastNameIndex >= 0) ? lastNameIndex + 1 : -1);
      if (scanStart >= 0) {
        for (let i = scanStart; i < tokens.length; i++) {
          const mon = monthToNumFlex(tokens[i]);
          if (mon) {
            // look for day and year after month
            let day = null, year = null;
            // search next few tokens for day and year
            for (let j = i + 1; j < Math.min(tokens.length, i + 5); j++) {
              const t = String(tokens[j] || '').replace(/[^A-Za-z0-9]/g, '');
              if (!day && /^([0-2]?\d|3[01])$/.test(t)) day = t.padStart(2, '0');
              if (!year && /^(19|20)\d{2}$/.test(t)) year = t;
              if (day && year) break;
            }
            if (day && year) {
              birthDate = `${year}-${mon}-${day}`;
              break;
            }
          }
        }
      }

      if ((idNumber || lastName || firstName || birthDate) && window.ocrProcessor && typeof window.ocrProcessor.fillDetailsForm === 'function') {
        window.ocrProcessor.fillDetailsForm({ idType: 'philhealth', idNumber: idNumber || undefined, lastName: lastName || undefined, firstName: firstName || undefined, birthDate: birthDate || undefined });
      }
    }
  };

  window.PhilHealth = PhilHealth;
})();
