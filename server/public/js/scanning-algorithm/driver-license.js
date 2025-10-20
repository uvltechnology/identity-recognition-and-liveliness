(function(){
  // Driver's License scanning and extraction module
  // Exposes window.DriverLicense with isSelected, fillFromText, fillFromWords

  // Simple in-memory cache to avoid duplicate AI calls on the same OCR text
  const aiCache = { lastRaw: null, lastResult: null };

  // Aggregate OCR texts (basic + structured) and call AI once with the richest input
  const aiAggregate = {
    texts: [],
    timer: null,
    inFlight: null,
    combined: null,
    result: null
  };

  const debounce = (fn, ms) => {
    return (...args) => new Promise(resolve => {
      if (aiAggregate.timer) clearTimeout(aiAggregate.timer);
      aiAggregate.timer = setTimeout(async () => {
        const out = await fn(...args);
        resolve(out);
      }, ms);
    });
  };

  const combineTexts = (arr) => {
    // Prefer the longest text; if similar length, join unique lines
    const sorted = [...arr].sort((a, b) => (b?.length || 0) - (a?.length || 0));
    const longest = sorted[0] || '';
    const second = sorted[1] || '';
    if (second && Math.abs(longest.length - second.length) < 50) {
      const lines = new Set((longest + '\n' + second).split(/\r?\n/).map(s => s.trim()).filter(Boolean));
      return Array.from(lines).join('\n');
    }
    return longest;
  };

  const requestAIOnce = async (rawCombined) => {
    // cache by combined content
    if (aiCache.lastRaw && aiCache.lastRaw === rawCombined && aiCache.lastResult) {
      return aiCache.lastResult;
    }
    try {
      if (window.ocrProcessor && typeof window.ocrProcessor.showAIStatus === 'function') {
        window.ocrProcessor.showAIStatus('Requesting AI extraction…');
      }
      const resp = await fetch('/api/ai/driver-license/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: rawCombined })
      });
      if (resp.status === 501) {
        if (window.ocrProcessor && typeof window.ocrProcessor.showAIStatus === 'function') {
          window.ocrProcessor.showAIStatus('AI disabled on server. Set GEMINI_API_KEY in .env and restart.');
        }
        return null;
      }
      if (!resp.ok) {
        let errPayload = null;
        try { errPayload = await resp.json(); } catch {}
        if (window.ocrProcessor && typeof window.ocrProcessor.showAIStatus === 'function') {
          const extra = errPayload?.details ? ` Details: ${errPayload.details}` : '';
          window.ocrProcessor.showAIStatus(`AI request failed (HTTP ${resp.status}).${extra} Using OCR rules.`);
        }
        return errPayload || { success: false, error: `HTTP ${resp.status}` };
      }
      const data = await resp.json();
      aiCache.lastRaw = rawCombined;
      aiCache.lastResult = data;
      return data;
    } catch (e) {
      if (window.ocrProcessor && typeof window.ocrProcessor.showAIStatus === 'function') {
        window.ocrProcessor.showAIStatus('AI network error. Using OCR rules.');
      }
      return null;
    }
  };

  const scheduleAI = debounce(async () => {
    aiAggregate.inFlight = true;
    aiAggregate.combined = combineTexts(aiAggregate.texts);
    const data = await requestAIOnce(aiAggregate.combined);
    aiAggregate.result = data;
    aiAggregate.inFlight = false;
    return data;
  }, 120);

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

  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

  const DriverLicense = {
    isSelected() {
      const sel = document.getElementById('id-type');
      if (!sel) return false;
      return String(sel.value).toLowerCase() === 'driver-license';
    },

    async fillFromText(text) {
      // Only run when Driver's License is selected
      if (!this.isSelected()) {
        // If another ID type is selected (e.g., UMID), do not emit any AI status.
        // Just exit quietly so other modules can render their own AI messages.
        return;
      }
      if (!text) return;
      const raw = text.replace(/\u0000/g, ' ').trim();
      // Keep at most 2 unique text variants (e.g., basic + structured)
      if (!aiAggregate.texts.includes(raw)) {
        aiAggregate.texts.push(raw);
        if (aiAggregate.texts.length > 2) aiAggregate.texts.shift();
      }
      // Debounce to wait for both Basic and Structured texts
  const aiData = await scheduleAI();

      let aiFirstName, aiLastName, aiBirthDate, aiIdNumber;
      if (aiData && aiData.success && aiData.fields) {
        aiFirstName = aiData.fields.firstName || undefined;
        aiLastName = aiData.fields.lastName || undefined;
        aiBirthDate = aiData.fields.birthDate || undefined;
        aiIdNumber = aiData.fields.idNumber || undefined;
        if (window.ocrProcessor && typeof window.ocrProcessor.showAIResultsDL === 'function') {
          window.ocrProcessor.showAIResultsDL({
            firstName: aiFirstName,
            lastName: aiLastName,
            birthDate: aiBirthDate,
            idNumber: aiIdNumber,
            confidence: aiData.confidence
          });
          if (window.ocrProcessor && typeof window.ocrProcessor.showAIStatus === 'function') {
            window.ocrProcessor.showAIStatus('AI extraction complete.');
          }
        }
      } else if (aiData && aiData.raw) {
        if (window.ocrProcessor && typeof window.ocrProcessor.showAIStatus === 'function') {
          window.ocrProcessor.showAIStatus('AI responded, but no fields were parsed. Showing raw AI output below.');
        }
        if (window.ocrProcessor && typeof window.ocrProcessor.showAIResultsDL === 'function') {
          window.ocrProcessor.showAIResultsDL({
            firstName: undefined,
            lastName: undefined,
            birthDate: undefined,
            idNumber: undefined,
            confidence: aiData.confidence
          });
        }
        const aiPanel = document.getElementById('ai-results-container');
        if (aiPanel) {
          const pre = document.createElement('pre');
          pre.style.cssText = 'white-space: pre-wrap; background: #f8fafc; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0;';
          pre.textContent = aiData.raw;
          aiPanel.innerHTML = '';
          aiPanel.appendChild(pre);
        }
  }

  // Only compute heuristics as fallback for missing fields
      const needFirst = !aiFirstName;
      const needLast = !aiLastName;
      const needDob = !aiBirthDate;
      const needId = !aiIdNumber;

      let idNumber, birthDate, lastName, firstName;
      const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const lower = raw.toLowerCase();

      if (needId) {
        const idPattern = /\b([A-Z0-9]{3})-([A-Z0-9]{2})-([A-Z0-9]{6})\b/i;
        let mPat = raw.match(idPattern);
        if (mPat) {
          idNumber = `${mPat[1].toUpperCase()}-${mPat[2].toUpperCase()}-${mPat[3].toUpperCase()}`;
        }
        if (!idNumber) {
          const labelRe = /(?:DLN|DRIVER'?S?\s*LICENSE(?:\s*NO\.?)?|LICENSE\s*NO\.?.?|LIC\.?\s*NO\.?.?|ID\s*NO\.?.?|ID\s*NUMBER|NO\.)/i;
          for (const line of lines) {
            if (labelRe.test(line)) {
              const m = line.match(/(?:DLN|DRIVER'?S?\s*LICENSE(?:\s*NO\.?)?|LICENSE\s*NO\.?.?|LIC\.?\s*NO\.?.?|ID\s*NO\.?.?|ID\s*NUMBER|NO\.)[:\s-]*([A-Z0-9\- ]{5,})/i);
              if (m) {
                const captured = clean(m[1]).replace(/\s+/g, '').toUpperCase();
                const direct = captured.match(/^([A-Z0-9]{3})-([A-Z0-9]{2})-([A-Z0-9]{6})$/);
                if (direct) {
                  idNumber = `${direct[1]}-${direct[2]}-${direct[3]}`;
                } else {
                  const plain = captured.replace(/[^A-Z0-9]/g, '');
                  if (plain.length >= 11) {
                    const core = plain.slice(0, 11);
                    const a = core.slice(0, 3), b = core.slice(3, 5), c = core.slice(5, 11);
                    if (/^[A-Z0-9]{3}$/.test(a) && /^[A-Z0-9]{2}$/.test(b) && /^[A-Z0-9]{6}$/.test(c)) {
                      idNumber = `${a}-${b}-${c}`;
                    }
                  }
                }
                if (idNumber) break;
              }
            }
          }
        }
        if (!idNumber) {
          const plain = (raw.match(/[A-Z0-9]{11,}/ig) || []).map(s => s.toUpperCase());
          for (const s of plain) {
            const a = s.slice(0, 3), b = s.slice(3, 5), c = s.slice(5, 11);
            if (s.length >= 11 && /^[A-Z0-9]{3}$/.test(a) && /^[A-Z0-9]{2}$/.test(b) && /^[A-Z0-9]{6}$/.test(c)) {
              idNumber = `${a}-${b}-${c}`; break;
            }
          }
        }
      } else if (aiData && aiData.success === false && aiData.error) {
        const extra = aiData.details ? ` Details: ${aiData.details}` : '';
        if (window.ocrProcessor && typeof window.ocrProcessor.showAIStatus === 'function') {
          window.ocrProcessor.showAIStatus(`AI error: ${aiData.error}.${extra} Falling back to OCR rules.`);
        }
      }

      if (needDob) {
        const dobMatch = raw.match(/\b(?:birth\s*date|date\s*of\s*birth|dob)[:\s-]*([A-Za-z0-9 ,\/.\-]+)/i);
        if (dobMatch) {
          const tail = clean(dobMatch[1]);
          birthDate = normalizeDate(tail) || tail;
        }
      }

      if (needLast || needFirst) {
        for (const line of lines) {
          const l = line.toLowerCase();
          if (needLast && /\b(surname|last\s*name)\b/.test(l)) {
            lastName = clean(line.split(/:|\-|–|—/).slice(1).join(':') || line.replace(/.*?(surname|last\s*name)\b[:\s-]*/i, ''));
          }
          if (needFirst && /\b(given\s*name|first\s*name)\b/.test(l)) {
            firstName = clean(line.split(/:|\-|–|—/).slice(1).join(':') || line.replace(/.*?(given\s*name|first\s*name)\b[:\s-]*/i, ''));
          }
        }
      }

  if (window.ocrProcessor && typeof window.ocrProcessor.fillDetailsForm === 'function') {
        const payload = {};
        const mergedFirst = aiFirstName || firstName;
        const mergedLast = aiLastName || lastName;
        const mergedDob = aiBirthDate || birthDate;
        const mergedId = aiIdNumber || idNumber;
        if (mergedFirst) payload.firstName = mergedFirst;
        if (mergedLast) payload.lastName = mergedLast;
        if (mergedDob) payload.birthDate = mergedDob;
        if (mergedId) payload.idNumber = mergedId;
        if (Object.keys(payload).length > 0) {
          window.ocrProcessor.fillDetailsForm(payload);
        }
      }
    },

    fillFromWords(words) {
      // Only run when Driver's License is selected
      if (!this.isSelected()) return;
      if (!Array.isArray(words) || words.length === 0) return;

      const tokens = words.map(w => String(w?.text || ''));
      const joined = tokens.join(' ');

      // Special rule for PH LTO layout using JSON variants:
      // Find the label sequence matching variants of "Middle" then variants of "Name",
      // then the next tokens until the first comma are the Last Name.
      // Also return the index immediately after the comma to help capture the first name tokens.
      const extractLastNameAfterMiddleName = (arr) => {
        const norm = (s) => String(s || '').trim();
        const toKey = (s) => norm(s).toUpperCase();
        const middleSet = (window.ocrProcessor && window.ocrProcessor.middleVariants) || null;
        const nameSet = (window.ocrProcessor && window.ocrProcessor.nameVariants) || null;
        const isVariant = (tok, set, bases) => {
          const key = toKey(tok);
          if (!key) return false;
          if (set && set.has(key)) return true;
          return Array.isArray(bases) && bases.includes(key);
        };
        const matchesMiddle = (tok) => isVariant(tok, middleSet, ['MIDDLE', 'MIDDLENAME']);
  const matchesName = (tok) => isVariant(tok, nameSet, ['NAME', 'NAMES', 'HAME']);

        for (let i = 0; i < arr.length; i++) {
          // allow one punctuation token between label words
          const a = arr[i];
          const b = arr[i + 1];
          const c = arr[i + 2];
          const punct = (t) => /^[\.:;\-]$/.test(norm(t));

          let labelEnd = -1;
          if (matchesMiddle(a) && matchesName(b)) {
            labelEnd = i + 1;
          } else if (matchesMiddle(a) && punct(b) && matchesName(c)) {
            labelEnd = i + 2;
          }

          if (labelEnd !== -1) {
            let j = labelEnd + 1;
            // skip punctuation right after label if any
            while (j < arr.length && punct(arr[j])) j++;
            const buf = [];
            let afterCommaIndex = j;
            for (; j < arr.length; j++) {
              let t = norm(arr[j]);
              if (!t) continue;
              if (t === ',') { afterCommaIndex = j + 1; break; }
              if (/[,，]\s*$/.test(t)) { // ends with comma
                t = t.replace(/[,，]\s*$/, '');
                if (t) buf.push(t);
                afterCommaIndex = j + 1;
                break;
              }
              // stop if we reach another label unexpectedly and we already captured something
              if (buf.length > 0 && (matchesMiddle(t) || matchesName(t) || /^(first|last)$/i.test(t))) break;
              buf.push(t);
            }
            const val = buf.join(' ').replace(/\s+/g, ' ').trim();
            if (val) return { lastName: val, afterCommaIndex };
          }
        }
        return null;
      };

      // Parse date from words using DL-specific rules
      let birthDate;
      const isGenderToken = (t) => {
        const s = String(t || '').toUpperCase().replace(/[^A-Z]/g, '');
        return s === 'M' || s === 'F' || s === 'MALE' || s === 'FEMALE';
      };
      const matchYMD = (t) => {
        const s = String(t || '').replace(/[),.;:]+$/g, '');
        const m = s.match(/^((?:19|20)\d{2})[\/\-.](0[1-9]|1[0-2])[\/\-.](0[1-9]|[12]\d|3[01])$/);
        return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
      };
      // Rule A: If we see a gender token (M/F), check the next few tokens for a YYYY/MM/DD date
      if (!birthDate) {
        for (let i = 0; i < tokens.length; i++) {
          if (isGenderToken(tokens[i])) {
            for (let j = i + 1; j <= i + 4 && j < tokens.length; j++) {
              const iso = matchYMD(tokens[j]);
              if (iso) { birthDate = iso; break; }
            }
          }
          if (birthDate) break;
        }
      }
      // Rule B: If a token equals 'Birth', look shortly after for the date
      if (!birthDate) {
        const birthIdx = tokens.findIndex(t => /^birth$/i.test(String(t)));
        if (birthIdx !== -1) {
          for (let j = birthIdx + 1; j <= birthIdx + 5 && j < tokens.length; j++) {
            const iso = matchYMD(tokens[j]);
            if (iso) { birthDate = iso; break; }
          }
        }
      }
      // Rule C: Generic fallback near 'DOB' or 'Date'
      if (!birthDate) {
        const dobIdx = tokens.findIndex(t => /^(dob|date)$/i.test(t));
        if (dobIdx !== -1) {
          for (let j = dobIdx + 1; j <= dobIdx + 6 && j < tokens.length; j++) {
            const iso = matchYMD(tokens[j]);
            if (iso) { birthDate = iso; break; }
          }
          if (!birthDate) {
            const win = tokens.slice(dobIdx, dobIdx + 8).join(' ');
            const iso = normalizeDate(win);
            if (iso) birthDate = iso;
          }
        }
      }

      // ID number extraction with strict XXX-XX-XXXXXX pattern and token joining
      const extractIdNumberFromWords = (arr) => {
        const normTok = (t) => String(t || '').toUpperCase().trim();
        const keepHyphen = (s) => s.replace(/[^A-Z0-9-]/g, '');
        const onlyAlnum = (s) => s.replace(/[^A-Z0-9]/g, '');
        const isPattern = (s) => /^[A-Z0-9]{3}-[A-Z0-9]{2}-[A-Z0-9]{6}$/.test(s);
        const fmt326 = (s) => `${s.slice(0,3)}-${s.slice(3,5)}-${s.slice(5,11)}`;
        const tryCombine3_2dash6 = (a3, b26) => {
          const A = onlyAlnum(normTok(a3));
          const B = keepHyphen(normTok(b26));
          if (/^[A-Z0-9]{3}$/.test(A)) {
            let m = B.match(/^([A-Z0-9]{2})-([A-Z0-9]{6})$/);
            if (m) return `${A}-${m[1]}-${m[2]}`;
            const p = onlyAlnum(B);
            if (p.length >= 8) {
              const b = p.slice(0,2), c = p.slice(2,8);
              if (/^[A-Z0-9]{2}$/.test(b) && /^[A-Z0-9]{6}$/.test(c)) return `${A}-${b}-${c}`;
            }
          }
          return null;
        };

        // 0) Look immediately before an expiration date token (YYYY/MM/DD)
        for (let i = 0; i < arr.length; i++) {
          if (matchYMD && matchYMD(arr[i])) {
            const prev1 = i - 1, prev2 = i - 2;
            if (prev1 >= 0) {
              const t1 = keepHyphen(normTok(arr[prev1]));
              if (isPattern(t1)) return t1;
            }
            if (prev2 >= 0 && prev1 >= 0) {
              const combined = tryCombine3_2dash6(arr[prev2], arr[prev1]);
              if (combined) return combined;
            }
          }
        }

        // A) Direct token match or simple joins within a small window
        const maxWin = 6;
        for (let i = 0; i < arr.length; i++) {
          for (let w = 1; w <= maxWin && i + w <= arr.length; w++) {
            const seg = arr.slice(i, i + w).map(normTok);
            let joined = keepHyphen(seg.join(''));
            if (isPattern(joined)) return joined;
            // Try if hyphens missing but we have 11 alnum characters
            const plain = onlyAlnum(joined);
            if (plain.length >= 11) {
              const core = plain.slice(0, 11);
              if (/^[A-Z0-9]{11}$/.test(core)) return fmt326(core);
            }
          }
        }

        // B) Prefer proximity to ID labels
        const labelTokens = new Set(['DLN','DRIVER','DRIVERS','LICENSE','NO','ID','NUMBER','AGENCY','CODE']);
        for (let i = 0; i < arr.length; i++) {
          const tk = normTok(arr[i]).replace(/[^A-Z]/g, '');
          if (labelTokens.has(tk)) {
            const start = Math.max(0, i - 2);
            const end = Math.min(arr.length, i + 8);
            for (let s = start; s < end; s++) {
              for (let e = s + 1; e <= Math.min(end, s + maxWin); e++) {
                const seg = arr.slice(s, e).map(normTok);
                let joined = keepHyphen(seg.join(''));
                if (isPattern(joined)) return joined;
                const plain = onlyAlnum(joined);
                if (plain.length >= 11) {
                  const core = plain.slice(0, 11);
                  if (/^[A-Z0-9]{11}$/.test(core)) return fmt326(core);
                }
                // Try specific 3 + (2-6) pair within the window
                for (let k = s; k < e - 1; k++) {
                  const comb = tryCombine3_2dash6(arr[k], arr[k+1]);
                  if (comb) return comb;
                }
              }
            }
          }
        }
        return null;
      };

      let idNumber = extractIdNumberFromWords(tokens);

      // Very basic heuristics for names: take early-capitalized words if labeled present
      let lastName, firstName;
      // New rule takes precedence for Last Name and helps locate First Name
      const lastFromMiddleRule = extractLastNameAfterMiddleName(tokens);
      if (lastFromMiddleRule && lastFromMiddleRule.lastName) {
        lastName = lastFromMiddleRule.lastName;
        // First Name rule: take next two tokens after the comma following the last name
        const start = lastFromMiddleRule.afterCommaIndex ?? -1;
        if (start >= 0) {
          const firstTokens = tokens.slice(start, start + 2)
            .map(t => String(t || '').replace(/^[,;:\-]+|[,;:\-]+$/g, ''))
            .filter(Boolean);
          if (firstTokens.length > 0) {
            firstName = firstTokens.join(' ');
          }
        }
      }
      const lastIdx = tokens.findIndex(t => /^(surname|last)$/i.test(t));
      const firstIdx = tokens.findIndex(t => /^(first|given)$/i.test(t));
      if (!lastName && lastIdx !== -1 && tokens[lastIdx + 1]) {
        lastName = tokens.slice(lastIdx + 1, lastIdx + 4).join(' ').replace(/[,:;]+$/g, '').trim();
      }
      if (!firstName && firstIdx !== -1 && tokens[firstIdx + 1]) firstName = tokens.slice(firstIdx + 1, firstIdx + 3).join(' ').replace(/[,:;]+$/g, '').trim();

      if (window.ocrProcessor && typeof window.ocrProcessor.fillDetailsForm === 'function') {
        const payload = {};
        if (firstName) payload.firstName = firstName;
        if (lastName) payload.lastName = lastName;
        if (birthDate) payload.birthDate = birthDate;
        if (idNumber) payload.idNumber = idNumber;
        if (Object.keys(payload).length > 0) {
          window.ocrProcessor.fillDetailsForm(payload);
        }
      }
    }
  };

  window.DriverLicense = DriverLicense;
})();
