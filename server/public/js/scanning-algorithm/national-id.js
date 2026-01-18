(function(){
  // National ID scanning and extraction module
  // Exposes a global window.NationalID with helper methods
  const raw = (t) => (t || '').toString().trim();

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
    // YYYY-MM-DD
    let m = str.match(/\b(20\d{2}|19\d{2})[-\/.](0[1-9]|1[0-2])[-\/.](0[1-9]|[12]\d|3[01])\b/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    // DD/MM/YYYY or DD-MM-YYYY
    m = str.match(/\b(0[1-9]|[12]\d|3[01])[\/\-](0[1-9]|1[0-2])[\/\-]((?:19|20)\d{2})\b/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    // MM/DD/YYYY
    m = str.match(/\b(0[1-9]|1[0-2])[\/\-](0[1-9]|[12]\d|3[01])[\/\-]((?:19|20)\d{2})\b/);
    if (m) return `${m[3]}-${m[1]}-${m[2]}`;
    // DD Mon YYYY
    m = str.match(/\b(0[1-9]|[12]\d|3[01])\s+([A-Za-z]{3,})\s+((?:19|20)\d{2})\b/);
    if (m) {
      const day = m[1].padStart(2, '0');
      const month = monthToNumber(m[2]);
      if (month) return `${m[3]}-${month}-${day}`;
    }
    // Mon DD, YYYY or Month DD, YYYY
    m = str.match(/\b([A-Za-z]{3,})\s+(0?[1-9]|[12]\d|3[01]),?\s+((?:19|20)\d{2})\b/);
    if (m) {
      const day = String(m[2]).padStart(2, '0');
      const month = monthToNumber(m[1]);
      if (month) return `${m[3]}-${month}-${day}`;
    }
    return null;
  };

  const NationalID = {
    isSelected() {
      const sel = document.getElementById('id-type');
      if (!sel) return true; // default apply when selector absent
      return String(sel.value).toLowerCase() === 'national-id';
    },

    // From raw text block (basic/structured)
    async fillFromText(text) {
      if (!this.isSelected()) return;
      if (!text) return;

      const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
      const rawText = text.replace(/\u0000/g, ' ').trim();

      // AI-first: request National ID fields
      let aiFirstName, aiLastName, aiBirthDate, aiIdNumber, aiConfidence;
      try {
        if (window.ocrProcessor && typeof window.ocrProcessor.showAIStatus === 'function') {
          window.ocrProcessor.showAIStatus('Requesting AI extraction (National ID)…');
        }
        const resp = await fetch('/api/ai/national-id/parse', {
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
              window.ocrProcessor.showAIStatus('AI extraction complete (National ID).');
            }
          } else if (data && data.raw) {
            if (window.ocrProcessor && typeof window.ocrProcessor.showAIStatus === 'function') {
              window.ocrProcessor.showAIStatus('AI responded, but no fields were parsed (National ID).');
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
          window.ocrProcessor.showAIStatus('AI network error (National ID). Using OCR rules.');
        }
      }

      // If AI filled some fields already, set them now
      if (window.ocrProcessor && (aiLastName || aiFirstName || aiIdNumber || aiBirthDate)) {
        window.ocrProcessor.fillDetailsForm({ idType: 'national-id', lastName: aiLastName, firstName: aiFirstName, idNumber: aiIdNumber, birthDate: aiBirthDate });
        return; // AI-first succeeded; no need to parse heuristics unless you want to merge
      }

      // Heuristic fallback (existing logic)
      const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const lowerJoined = rawText.toLowerCase();

      let lastName; for (const line of lines) { const l = line.toLowerCase(); if (/\b(apelyido|last\s*name)\b/.test(l)) { const after = line.split(/:|\-|–|—/).slice(1).join(':') || line.replace(/.*?(apelyido|last\s*name)\b[:\s-]*/i, ''); lastName = clean(after) || undefined; if (lastName && /\b(mga\s+pangalan|given\s+names?)\b/i.test(lastName)) { lastName = lastName.replace(/\b(mga\s+pangalan|given\s+names?)\b.*$/i, '').trim(); } break; } }
      let firstName; for (const line of lines) { const l = line.toLowerCase(); if (/\b(mga\s+pangalan|given\s+names?)\b/.test(l)) { const after = line.split(/:|\-|–|—/).slice(1).join(':') || line.replace(/.*?(mga\s+pangalan|given\s+names?)\b[:\s-]*/i, ''); firstName = clean(after) || undefined; break; } }

      let birthDate; { const rx = /(petsa\s+ng\s+kapanganakan\s*\/\s*date\s+of\s+birth)[:\s-]*([A-Za-z0-9 ,\/.\-]+)/i; const m = rawText.match(rx); if (m) { const tail = clean(m[2]); const parsed = normalizeDate(tail); birthDate = parsed || tail; } else { const rx2 = /(petsa\s+ng\s+kapanganakan|date\s+of\s+birth)[:\s-]*([A-Za-z0-9 ,\/.\-]+)/i; const m2 = rawText.match(rx2); if (m2) { const tail2 = clean(m2[2]); birthDate = normalizeDate(tail2) || tail2; } } }

      let idNumber; { const idx = lowerJoined.indexOf('philippine identification card'); if (idx !== -1) { const after = rawText.slice(idx + 'philippine identification card'.length); const num = after.match(/([A-Z0-9][A-Z0-9\- ]{4,})/i); if (num) { idNumber = clean(num[1]).replace(/\s+/g, ''); } } if (!idNumber) { const crn = rawText.match(/\bCRN[:\s-]*([0-9\- ]{8,})/i); if (crn) idNumber = clean(crn[1]).replace(/\s+/g, ''); } }

      // Respect original behavior: only set if empty
      const idNumEl = document.getElementById('id-number');
      const fnEl = document.getElementById('first-name');
      const lnEl = document.getElementById('last-name');
      const bdEl = document.getElementById('birth-date');
      const idTypeEl = document.getElementById('id-type');
      if (idTypeEl) idTypeEl.value = 'national-id';
      if (lnEl && !lnEl.value && lastName) lnEl.value = lastName;
      if (fnEl && !fnEl.value && firstName) fnEl.value = firstName;
      if (bdEl && !bdEl.value && birthDate) {
        const iso = normalizeDate(birthDate);
        bdEl.value = iso || '';
      }
      if (idNumEl && !idNumEl.value && idNumber) idNumEl.value = idNumber;
    },

    // From word tokens (indices + dynamic extraction)
    fillFromWords(words) {
      if (!this.isSelected()) return;
      if (!Array.isArray(words) || words.length === 0) return;

      const getWord = (idx1Based) => {
        const i = idx1Based - 1;
        if (i < 0 || i >= words.length) return '';
        const t = (words[i]?.text || '').toString().trim();
        return t;
      };

      const idNumberRaw = getWord(13);
      const lastNameRaw = getWord(22);
      const firstNameRaw = getWord(28);
      const birthMonthRaw = getWord(42);
      const birthDayRaw = getWord(43);
      const birthYearRaw = getWord(45);

      const cleanAlnum = (s) => (s || '').replace(/[^A-Za-z0-9\-]/g, '').trim();
      const cleanWord = (s) => (s || '').replace(/[,:;]+$/g, '').trim();

      const dynamicIdNumber = this.extractIdNumberBetweenCardAndTirahan(words);
      const idNumber = dynamicIdNumber || cleanAlnum(idNumberRaw);
      const dynamicLastName = this.extractLastNameBetweenNameAndMga(words);
      const lastName = cleanWord(dynamicLastName || lastNameRaw);
      const dynamicFirstName = this.extractFirstNameBetweenNamesAndGitnang(words);
      const firstName = cleanWord(dynamicFirstName || firstNameRaw);

      const monthNum = monthToNumber(birthMonthRaw) || (/^\d{1,2}$/.test(birthMonthRaw) ? String(birthMonthRaw).padStart(2, '0') : null);
      const dayNum = (/^\d{1,2}$/.test(birthDayRaw) ? String(birthDayRaw).padStart(2, '0') : birthDayRaw.match(/\d{1,2}/)?.[0]?.padStart(2, '0')) || null;
      let yearNum = null;
      if (/^\d{4}$/.test(birthYearRaw)) {
        yearNum = birthYearRaw;
      } else if (/^\d{2}$/.test(birthYearRaw)) {
        const yy = parseInt(birthYearRaw, 10);
        yearNum = (yy <= 30 ? 2000 + yy : 1900 + yy).toString();
      } else {
        const y = birthYearRaw.match(/(19|20)\d{2}/)?.[0];
        if (y) yearNum = y;
      }

      let birthDateISO = null;
      if (yearNum && monthNum && dayNum) {
        birthDateISO = `${yearNum}-${monthNum}-${dayNum}`;
      }
      const dynamicBirthDateISO = this.extractBirthDateAfterBirthToken(words) || null;

      if (window.ocrProcessor && typeof window.ocrProcessor.fillDetailsForm === 'function') {
        window.ocrProcessor.fillDetailsForm({
          idType: 'national-id',
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          birthDate: dynamicBirthDateISO || birthDateISO || undefined,
          idNumber: idNumber || undefined,
        });
      }

      try { console.log('[NationalID][Words]', { idNumberRaw, lastNameRaw, firstNameRaw, birthMonthRaw, birthDayRaw, birthYearRaw, idNumber, lastName, firstName, birthDateISO, dynamicBirthDateISO, dynamicLastName, dynamicFirstName, dynamicIdNumber }); } catch {}
    },

    extractLastNameBetweenNameAndMga(words) {
      if (!Array.isArray(words) || words.length === 0) return null;
      const isNameToken = (t) => /\bname\b/i.test(t);
      const isMgaToken = (t) => /^mga\b/i.test(t);
      let nameIdx = -1, mgaIdx = -1;
      for (let i = 0; i < words.length; i++) {
        const t = (words[i]?.text || '').toString().trim();
        if (nameIdx === -1 && isNameToken(t)) { nameIdx = i; continue; }
        if (nameIdx !== -1 && isMgaToken(t)) { mgaIdx = i; break; }
      }
      if (nameIdx !== -1 && mgaIdx !== -1 && mgaIdx > nameIdx + 1) {
        const between = words.slice(nameIdx + 1, mgaIdx)
          .map(w => (w?.text || '').toString().trim())
          .filter(Boolean)
          .map(s => s.replace(/^[,:;\-]+|[,:;\-]+$/g, ''))
          .filter(s => !/^last$/i.test(s) && !/^apelyido$/i.test(s) && !/^surname$/i.test(s) && !/^family$/i.test(s) && !/^name$/i.test(s));
        const result = between.join(' ').replace(/\s+/g, ' ').trim();
        return result || null;
      }
      return null;
    },

    extractFirstNameBetweenNamesAndGitnang(words) {
      if (!Array.isArray(words) || words.length === 0) return null;
      const normalize = (t) => (t || '').toString().trim().replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
      const isNamesToken = (t) => /\bnames\b/i.test(normalize(t));
      const isGitnangToken = (t) => /\bgitnang\b/i.test(normalize(t));
      let namesIdx = -1, gitnangIdx = -1;
      for (let i = 0; i < words.length; i++) {
        const t = (words[i]?.text || '');
        if (namesIdx === -1 && isNamesToken(t)) { namesIdx = i; continue; }
        if (namesIdx !== -1 && isGitnangToken(t)) { gitnangIdx = i; break; }
      }
      if (namesIdx !== -1 && gitnangIdx !== -1 && gitnangIdx > namesIdx + 1) {
        const between = words.slice(namesIdx + 1, gitnangIdx)
          .map(w => normalize(w?.text))
          .filter(Boolean)
          .filter(s => !/^given$/i.test(s) && !/^mga$/i.test(s) && !/^pangalan$/i.test(s) && !/^names?$/i.test(s) && !/^gitnang$/i.test(s));
        const result = between.join(' ').replace(/\s+/g, ' ').trim();
        return result || null;
      }
      return null;
    },

    extractIdNumberBetweenCardAndTirahan(words) {
      if (!Array.isArray(words) || words.length === 0) return null;
      const normalize = (t) => (t || '').toString().trim();
      const isCardToken = (t) => /\bcard\b/i.test(normalize(t));
      const isTirahanToken = (t) => /\btirahan\b/i.test(normalize(t));
      let cardIdx = -1, tirahanIdx = -1;
      for (let i = 0; i < words.length; i++) {
        const t = (words[i]?.text || '');
        if (cardIdx === -1 && isCardToken(t)) { cardIdx = i; continue; }
        if (cardIdx !== -1 && isTirahanToken(t)) { tirahanIdx = i; break; }
      }
      if (cardIdx !== -1 && tirahanIdx !== -1 && tirahanIdx > cardIdx + 1) {
        const between = words.slice(cardIdx + 1, tirahanIdx)
          .map(w => (w?.text || '').toString().trim())
          .filter(Boolean)
          .join(' ');
        const m = between.match(/(\d{4})\D*(\d{4})\D*(\d{4})\D*(\d{4})/);
        if (m) return `${m[1]}-${m[2]}-${m[3]}-${m[4]}`;
        const digits = between.replace(/\D/g, '');
        if (digits.length >= 16) {
          const d = digits.slice(0, 16);
          return `${d.slice(0,4)}-${d.slice(4,8)}-${d.slice(8,12)}-${d.slice(12,16)}`;
        }
      }
      return null;
    },

    extractBirthDateAfterBirthToken(words) {
      if (!Array.isArray(words) || words.length === 0) return null;
      const normalize = (t) => (t || '').toString().trim();
      const isBirthToken = (t) => /\bbirth\b/i.test(normalize(t));
      let birthIdx = -1;
      for (let i = 0; i < words.length; i++) {
        const t = (words[i]?.text || '');
        if (isBirthToken(t)) { birthIdx = i; break; }
      }
      if (birthIdx === -1 || birthIdx >= words.length - 1) return null;
      const tailTokens = words.slice(birthIdx + 1, Math.min(words.length, birthIdx + 1 + 8))
        .map(w => (w?.text || '').toString().trim())
        .filter(Boolean);
      if (tailTokens.length === 0) return null;
      const tryNormalize = (s) => normalizeDate(s) || null;
      let candidate = tryNormalize(tailTokens.join(' '));
      if (candidate) return candidate;
      for (let win = 1; win <= Math.min(5, tailTokens.length); win++) {
        for (let start = 0; start + win <= tailTokens.length; start++) {
          const part = tailTokens.slice(start, start + win).join(' ');
          const iso = tryNormalize(part);
          if (iso) return iso;
        }
      }
      const digits = tailTokens.join(' ').replace(/\D/g, '');
      if (digits.length >= 8) {
        const ymd = digits.slice(0, 8);
        const y = ymd.slice(0, 4);
        const m = ymd.slice(4, 6);
        const d = ymd.slice(6, 8);
        if (/^(19|20)\d{2}$/.test(y) && /^(0[1-9]|1[0-2])$/.test(m) && /^(0[1-9]|[12]\d|3[01])$/.test(d)) {
          return `${y}-${m}-${d}`;
        }
        const dmy = digits.slice(0, 8);
        const d2 = dmy.slice(0, 2);
        const m2 = dmy.slice(2, 4);
        const y2 = dmy.slice(4, 8);
        if (/^(0[1-9]|[12]\d|3[01])$/.test(d2) && /^(0[1-9]|1[0-2])$/.test(m2) && /^(19|20)\d{2}$/.test(y2)) {
          return `${y2}-${m2}-${d2}`;
        }
      }
      return null;
    }
  };

  window.NationalID = NationalID;
})();
