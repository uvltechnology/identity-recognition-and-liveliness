(function(){
  // Passport scanning and extraction module
  // Exposes a global window.Passport with helper methods
  const raw = (t) => (t || '').toString().trim();
  const clean = (s) => (s || '').toString().trim().replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');

  const monthToNumber = (name) => {
    const map = {
      jan: '01', january: '01',
      feb: '02', february: '02',
      mar: '03', march: '03',
      apr: '04', april: '04',
      may: '05',
      jun: '06', june: '06',
      jul: '07', july: '07',
      aug: '08', august: '08',
      sep: '09', sept: '09', september: '09',
      oct: '10', october: '10',
      nov: '11', november: '11',
      dec: '12', december: '12'
    };
    const key = String(name || '').toLowerCase().slice(0, 9);
    return map[key] || map[key.slice(0, 3)] || null;
  };

  const normalizeDate = (s) => {
    if (!s) return null;
    const str = s.trim();
    let m = str.match(/\b(20\d{2}|19\d{2})[-\/.](0[1-9]|1[0-2])[-\/.](0[1-9]|[12]\d|3[01])\b/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = str.match(/\b(0[1-9]|[12]\d|3[01])[\/\-](0[1-9]|1[0-2])[\/\-]((?:19|20)\d{2})\b/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    m = str.match(/\b(0[1-9]|1[0-2])[\/\-](0[1-9]|[12]\d|3[01])[\/\-]((?:19|20)\d{2})\b/);
    if (m) return `${m[3]}-${m[1]}-${m[2]}`;
    m = str.match(/\b(0[1-9]|[12]\d|3[01])\s+([A-Za-z]{3,})\s+((?:19|20)\d{2})\b/);
    if (m) {
      const day = m[1].padStart(2, '0');
      const month = monthToNumber(m[2]);
      if (month) return `${m[3]}-${month}-${day}`;
    }
    m = str.match(/\b([A-Za-z]{3,})\s+(0?[1-9]|[12]\d|3[01]),?\s+((?:19|20)\d{2})\b/);
    if (m) {
      const day = String(m[2]).padStart(2, '0');
      const month = monthToNumber(m[1]);
      if (month) return `${m[3]}-${month}-${day}`;
    }
    return null;
  };

  const Passport = {
    isSelected() {
      const sel = document.getElementById('id-type');
      if (!sel) return false;
      return String(sel.value).toLowerCase() === 'passport';
    },

    async fillFromText(text) {
      if (!this.isSelected()) return;
      if (!text) return;
      const rawText = (text || '').replace(/\u0000/g, ' ').trim();

      // AI-first: request Passport fields
      let aiFirstName, aiLastName, aiBirthDate, aiIdNumber, aiConfidence;
      try {
        if (window.ocrProcessor && typeof window.ocrProcessor.showAIStatus === 'function') {
          window.ocrProcessor.showAIStatus('Requesting AI extraction (Passport)…');
        }
        const resp = await fetch('/api/ai/passport/parse', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rawText })
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
              window.ocrProcessor.showAIResultsDL({ firstName: aiFirstName, lastName: aiLastName, birthDate: aiBirthDate, idNumber: aiIdNumber, confidence: aiConfidence });
            }
            if (window.ocrProcessor && typeof window.ocrProcessor.showAIStatus === 'function') {
              window.ocrProcessor.showAIStatus('AI extraction complete (Passport).');
            }
          } else if (data && data.raw) {
            if (window.ocrProcessor && typeof window.ocrProcessor.showAIStatus === 'function') {
              window.ocrProcessor.showAIStatus('AI responded, but no fields were parsed (Passport).');
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
          window.ocrProcessor.showAIStatus('AI network error (Passport). Using OCR rules.');
        }
      }

      // If AI provided fields, fill the form now
      if (window.ocrProcessor && (aiLastName || aiFirstName || aiIdNumber || aiBirthDate)) {
        window.ocrProcessor.fillDetailsForm({ idType: 'passport', lastName: aiLastName, firstName: aiFirstName, idNumber: aiIdNumber, birthDate: aiBirthDate });
        return;
      }
    },

    fillFromWords(words) {
      if (!this.isSelected()) return;
      if (!Array.isArray(words) || words.length === 0) return;
      const ln = this.extractLastName(words);
      const fn = this.extractFirstName(words);
      const pid = this.extractIdNumber(words);
      const bdate = this.extractBirthDate(words);
      const payload = { idType: 'passport' };
      if (ln) payload.lastName = ln;
      if (fn) payload.firstName = fn;
      if (pid) payload.idNumber = pid;
      if (bdate) payload.birthDate = bdate;
      if ((window.ocrProcessor && typeof window.ocrProcessor.fillDetailsForm === 'function') && (ln || fn || pid || bdate)) {
        window.ocrProcessor.fillDetailsForm(payload);
      }
    },

    // Derive last name between 'PHL' and 'Pangalan'; if token after PHL is 'Apelyido', use the name after 'Surname'
    extractLastName(words) {
      const norm = (t) => (t || '').toString().trim();
      const isPHL = (t) => /^phl$/i.test(norm(t));
      const isPangalan = (t) => /pangalan/i.test(norm(t));
      const isApelyido = (t) => /apelyido/i.test(norm(t));
      const isSurname = (t) => /surname/i.test(norm(t));

      // MRZ-like rule: 'P', '<', token starting with 'PHL...'
      for (let i = 0; i <= words.length - 3; i++) {
        const t0 = norm(words[i]?.text);
        const t1 = norm(words[i + 1]?.text);
        const t2 = (words[i + 2]?.text || '').toString().trim();
        if (/^p$/i.test(t0) && t1 === '<' && t2) {
          let candidate = t2.replace(/^PHL/i, '');
          candidate = candidate.split('<')[0];
          candidate = candidate.replace(/^[^A-Za-z]+|[^A-Za-z'\-\s]+$/g, '');
          candidate = candidate.replace(/\s+/g, ' ').trim();
          if (candidate) {
            return candidate;
          }
        }
      }

      let phlIdx = -1;
      for (let i = 0; i < words.length; i++) {
        if (isPHL(words[i]?.text)) { phlIdx = i; break; }
      }
      if (phlIdx === -1) return null;

      // Find Pangalan boundary after PHL
      let pangalanIdx = -1;
      for (let i = phlIdx + 1; i < words.length; i++) {
        if (isPangalan(words[i]?.text)) { pangalanIdx = i; break; }
      }

      // If immediate token after PHL is 'Apelyido', search after 'Surname'
      const immediate = words[phlIdx + 1]?.text || '';
      if (isApelyido(immediate)) {
        let surnameIdx = -1;
        for (let i = phlIdx + 1; i < (pangalanIdx !== -1 ? pangalanIdx : words.length); i++) {
          if (isSurname(words[i]?.text)) { surnameIdx = i; break; }
        }
        if (surnameIdx !== -1) {
          const end = (pangalanIdx !== -1 ? pangalanIdx : words.length);
          const tail = words.slice(surnameIdx + 1, end)
            .map(w => norm(w?.text))
            .filter(Boolean)
            .filter(s => !isSurname(s) && !isApelyido(s) && !/^last$/i.test(s) && !/^name$/i.test(s));
          const joined = tail.join(' ').replace(/\s+/g, ' ').trim();
          return joined || null;
        }
      }

      // Default: take tokens between PHL and Pangalan as last name (skipping labels)
      if (pangalanIdx !== -1 && pangalanIdx > phlIdx + 1) {
        const between = words.slice(phlIdx + 1, pangalanIdx)
          .map(w => norm(w?.text))
          .filter(Boolean)
          .filter(s => !isApelyido(s) && !/^last$/i.test(s) && !/^name$/i.test(s) && !isSurname(s));
        const result = between.join(' ').replace(/\s+/g, ' ').trim();
        return result || null;
      }
      return null;
    },

    // First Name using sequence P, <, PHLxxxx, << then 2-5 tokens separated by '<'; fallback to boundary rule
    extractFirstName(words) {
      // MRZ-like rule
      for (let i = 0; i <= words.length - 4; i++) {
        const t0 = raw(words[i]?.text);
        const t1 = raw(words[i + 1]?.text);
        const t2 = raw(words[i + 2]?.text);
        const t3 = raw(words[i + 3]?.text);
        if (/^p$/i.test(t0) && t1 === '<' && /^PHL/i.test(t2) && /^<+$/.test(t3)) {
          const parts = [];
          let k = i + 4;
          const firstTok = raw(words[k]?.text || '');
          if (/^<{3,}$/.test(firstTok)) {
            return null;
          }
          while (k < words.length && parts.length < 5) {
            let token = raw(words[k]?.text);
            if (!token) { k++; continue; }
            if (/^<{3,}$/.test(token)) {
              break;
            }
            if (/^<+$/.test(token)) { k++; continue; }
            const segs = token.split('<').map(clean).filter(Boolean);
            for (const seg of segs) {
              if (seg) parts.push(seg);
              if (parts.length >= 5) break;
            }
            if (parts.length >= 2 && parts.length <= 5) {
              // acceptable range – continue until next hard separator or limit
            }
            k++;
            if (k < words.length && /^<{3,}$/.test(raw(words[k]?.text || ''))) {
              break;
            }
          }
          if (parts.length >= 1) {
            return parts.join(' ').replace(/\s+/g, ' ').trim();
          }
        }
      }

      // Fallback: between 'Names' and boundary tokens
      const norm = (t) => (t || '').toString().trim().replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
      const isNames = (t) => /\bnames\b/i.test(norm(t));
      const isBoundary = (t) => /(pasaporte|pasaportab|panggitnang)/i.test(norm(t));

      let namesIdx = -1;
      for (let i = 0; i < words.length; i++) {
        if (isNames(words[i]?.text)) { namesIdx = i; break; }
      }
      if (namesIdx === -1) return null;

      let boundaryIdx = -1;
      for (let i = namesIdx + 1; i < words.length; i++) {
        if (isBoundary(words[i]?.text)) { boundaryIdx = i; break; }
      }

      if (boundaryIdx !== -1 && boundaryIdx > namesIdx + 1) {
        const between = words.slice(namesIdx + 1, boundaryIdx)
          .map(w => norm(w?.text))
          .filter(Boolean)
          .filter(s => !/^given$/i.test(s) && !/^mga$/i.test(s) && !/^pangalan$/i.test(s) && !/^names?$/i.test(s) && !/^gitnang$/i.test(s) && !/^panggitnang$/i.test(s));
        const result = between.join(' ').replace(/\s+/g, ' ').trim();
        return result || null;
      }
      return null;
    },

    // Extract passport ID number from a token that contains 'PHL' followed by digits; take substring before 'PHL'
    extractIdNumber(words) {
      if (!Array.isArray(words) || words.length === 0) return null;
      for (let i = 0; i < words.length; i++) {
        const t = (words[i]?.text || '').toString().trim();
        if (!t) continue;
        const up = t.toUpperCase();
        const idx = up.indexOf('PHL');
        if (idx > 0) {
          const tail = up.slice(idx + 3);
          const digitCount = (tail.match(/\d/g) || []).length;
          if (digitCount >= 8) {
            let beforeRaw = t.slice(0, idx);
            const charBefore = up[idx - 1];
            if (/[0-9]/.test(charBefore)) {
              beforeRaw = beforeRaw.replace(/\d\s*$/, '');
            }
            let before = beforeRaw.replace(/[^A-Za-z0-9]/g, '');
            if (before.length >= 8) return before;
            if (before.length >= 6) return before;
          }
        }
      }
      return null;
    },

    // Extract birth date from tokens after 'birth' as DD MON YYYY or search globally for that pattern
  extractBirthDate(words) {
      if (!Array.isArray(words) || words.length === 0) return null;

      const isBirth = (t) => /\bbirth\b/i.test(raw(t));
      const isDay = (t) => /^\d{1,2}$/.test(clean(t));
      const isYear = (t) => /^(19|20)\d{2}$/.test(clean(t));
      const isMonth = (t) => {
        const u = clean(t).toUpperCase();
        return ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','SEPT','OCT','NOV','DEC'].includes(u);
      };
      const toISO = (d, m, y) => {
        const dd = String(parseInt(clean(d), 10)).padStart(2, '0');
        const mm = monthToNumber(clean(m));
        const yy = clean(y);
        if (!mm) return null;
        return `${yy}-${mm}-${dd}`;
      };

      let birthIdx = -1;
      for (let i = 0; i < words.length; i++) {
        if (isBirth(words[i]?.text)) { birthIdx = i; break; }
      }
      if (birthIdx !== -1) {
        for (let j = birthIdx + 1; j + 2 < words.length && j <= birthIdx + 4; j++) {
          const d = raw(words[j]?.text);
          const m = raw(words[j + 1]?.text);
          const y = raw(words[j + 2]?.text);
          if (isDay(d) && isMonth(m) && isYear(y)) {
            const iso = toISO(d, m, y);
            if (iso) return iso;
          }
        }
      }

      for (let i = 0; i + 2 < words.length; i++) {
        const d = raw(words[i]?.text);
        const m = raw(words[i + 1]?.text);
        const y = raw(words[i + 2]?.text);
        if (isDay(d) && isMonth(m) && isYear(y)) {
          const iso = toISO(d, m, y);
          if (iso) return iso;
        }
      }

      return null;
    }
  };

  window.Passport = Passport;
})();
