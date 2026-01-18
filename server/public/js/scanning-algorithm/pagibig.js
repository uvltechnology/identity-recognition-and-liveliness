(function(){
  // Pag-IBIG (HDMF) ID OCR-only scanning module
  // Exposes window.PAGIBIG with fillFromText and fillFromWords

  const stripPunct = (s) => (s || '')
    .replace(/^[\s,.;:()\[\]{}"'`]+|[\s,.;:()\[\]{}"'`]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const monthToNumber = (name) => {
    const map = {
      jan:'01', january:'01', feb:'02', february:'02', mar:'03', march:'03',
      apr:'04', april:'04', may:'05', jun:'06', june:'06', jul:'07', july:'07',
      aug:'08', august:'08', sep:'09', sept:'09', september:'09', oct:'10', october:'10',
      nov:'11', november:'11', dec:'12', december:'12'
    };
    const key = String(name || '').toLowerCase().slice(0, 9);
    return map[key] || map[key.slice(0, 3)] || null;
  };

  const expandYear2 = (yy) => {
    const n = parseInt(String(yy || ''), 10);
    if (Number.isNaN(n)) return null;
    const pivot = 30;
    const year = n >= pivot ? 1900 + n : 2000 + n;
    return String(year);
  };

  const normalizeDate = (s) => {
    if (!s) return null;
    const str = String(s).trim();
    let m = str.match(/\b(20\d{2}|19\d{2})[-\/.](0[1-9]|1[0-2])[-\/.](0[1-9]|[12]\d|3[01])\b/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = str.match(/\b(0[1-9]|[12]\d|3[01])[\/\-](0[1-9]|1[0-2])[\/\-]((?:19|20)\d{2})\b/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    m = str.match(/\b(0[1-9]|1[0-2])[\/\-](0[1-9]|[12]\d|3[01])[\/\-]((?:19|20)\d{2})\b/);
    if (m) return `${m[3]}-${m[1]}-${m[2]}`;
    m = str.match(/\b(0?[1-9]|[12]\d|3[01])\s*(?:[-\/.\u2013\u2014]?|\s)\s*([A-Za-z]{3,})\s*(?:[-\/.\u2013\u2014]?|\s)\s*((?:19|20)\d{2})\b/);
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
    // Two-digit year variants
    m = str.match(/\b(0?[1-9]|[12]\d|3[01])[\/-](0[1-9]|1[0-2])[\/-](\d{2})\b/);
    if (m) {
      const year = expandYear2(m[3]);
      if (year) return `${year}-${m[2]}-${String(m[1]).padStart(2, '0')}`;
    }
    m = str.match(/\b(0[1-9]|1[0-2])[\/-](0?[1-9]|[12]\d|3[01])[\/-](\d{2})\b/);
    if (m) {
      const year = expandYear2(m[3]);
      if (year) return `${year}-${m[1]}-${String(m[2]).padStart(2, '0')}`;
    }
    m = str.match(/\b(0?[1-9]|[12]\d|3[01])\s*(?:[-\/.\u2013\u2014]?|\s)\s*([A-Za-z]{3,})\s*(?:[-\/.\u2013\u2014]?|\s)\s*(\d{2})\b/);
    if (m) {
      const day = String(m[1]).padStart(2, '0');
      const month = monthToNumber(m[2]);
      const year = expandYear2(m[3]);
      if (month && year) return `${year}-${month}-${day}`;
    }
    m = str.match(/\b([A-Za-z]{3,})\s+(0?[1-9]|[12]\d|3[01]),?\s+(\d{2})\b/);
    if (m) {
      const day = String(m[2]).padStart(2, '0');
      const month = monthToNumber(m[1]);
      const year = expandYear2(m[3]);
      if (month && year) return `${year}-${month}-${day}`;
    }
    return null;
  };

  const pick12Digits = (s) => {
    if (!s) return null;
    const m = String(s).match(/\b(\d{12})\b/);
    return m ? m[1] : null;
  };

  // Prefer explicit hyphen/space separated 4-4-4 pattern; else coerce first 12 digits to 4-4-4
  const normalizeMIDHyphen = (s) => {
    if (!s) return null;
    const str = String(s);
    const m = str.match(/\b(\d{4})[-\s](\d{4})[-\s](\d{4})\b/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    const digits = str.replace(/[^0-9]/g, '');
    if (digits.length >= 12) {
      const d = digits.slice(0, 12);
      return `${d.slice(0,4)}-${d.slice(4,8)}-${d.slice(8,12)}`;
    }
    return null;
  };

  const normalizeFirst = (s) => {
    const cleaned = stripPunct(s);
    if (!cleaned) return '';
    // For Pag-IBIG, keep single token as first name; drop suffixes
    let t = cleaned.split(/\s+/).filter(Boolean)[0] || '';
    if (/^(jr\.?|sr\.?|ii|iii|iv|v)$/i.test(t)) t = '';
    return t;
  };

  const normalizeLast = (s) => stripPunct(s);
  const baseToken = (t) => String(t || '').replace(/[:,;\-–—.]+$/g, '').toLowerCase();
  const isPunctToken = (t) => /^[:,;\-–—.]$/.test(String(t || ''));
  const isSingleLetterToken = (t) => /^[A-Za-z]\.?$/.test(String(t || '').trim());
  const LABEL_SKIP = new Set(['pag','ibig','pag-ibig','plus','loyalty','card','id','no','number','member','mid']);
  const SURNAME_JOINERS = new Set(['DE','DEL','DELA','LA','LOS','LAS','SAN','SANTA','SANTO','STA','STA.','ST.','DA','DI','VON','VAN','BIN','BINTI','AL','EL','MC','MC.','MAC','MAC.','O','O.']);

  const PAGIBIG = {
    isSelected() {
      const sel = document.getElementById('id-type');
      if (!sel) return false;
      return String(sel.value).toLowerCase() === 'pagibig';
    },

    fillFromWords(words) {
      if (!this.isSelected()) return;
      try {
        if (Array.isArray(words) && words.length > 0) {
          // 1) CARD-based first name rule: take tokens after 'CARD' until a single-letter token (e.g., 'A' or 'A.')
          let cardIdx = -1;
          for (let i = 0; i < words.length; i++) {
            const tok = baseToken(words[i] && (words[i].text || words[i]));
            if (tok === 'card') { cardIdx = i; break; }
          }

          let firstFromCard = '';
          let lastFromCard = '';
          if (cardIdx >= 0) {
            const collected = [];
            let singleIdx = -1;
            for (let j = cardIdx + 1; j < Math.min(words.length, cardIdx + 12); j++) {
              const rawTok = (words[j] && (words[j].text || words[j])) || '';
              const bt = baseToken(rawTok);
              if (!bt || isPunctToken(rawTok)) continue;
              if (LABEL_SKIP.has(bt)) continue; // skip label-ish tokens
              if (isSingleLetterToken(rawTok)) { singleIdx = j; break; } // stop before middle initial
              // stop on obvious section breakers
              if (/^(address|birth|date|dob|mid|no|id|number)$/i.test(bt)) break;
              collected.push(String(rawTok));
              if (collected.length >= 4) break; // safety cap
            }
            if (collected.length) {
              firstFromCard = stripPunct(collected.join(' '));
            }
            // Determine last name: collect multi-word surnames (e.g., 'DE LA CRUZ') after the single-letter (with or without dot)
            if (singleIdx >= 0) {
              const parts = [];
              let hadAlpha = false;
              for (let k = singleIdx + 1; k < Math.min(words.length, singleIdx + 12); k++) {
                const rawTok = (words[k] && (words[k].text || words[k])) || '';
                const bt = baseToken(rawTok);
                if (!bt || isPunctToken(rawTok)) continue;
                if (LABEL_SKIP.has(bt)) break; // stop at label-ish tokens
                if (/^(address|birth|date|dob|mid|no|id|number)$/i.test(bt)) break;
                const upper = String(rawTok).toUpperCase();
                const isJoiner = SURNAME_JOINERS.has(upper.replace(/\.$/, ''));
                const isAlpha = /^[A-Za-z][A-Za-z\-']*$/.test(String(rawTok));
                if (isJoiner || isAlpha) {
                  parts.push(stripPunct(String(rawTok)));
                  if (isAlpha && !isJoiner) hadAlpha = true;
                  if (parts.length >= 5) break; // safety cap
                  continue;
                }
                break;
              }
              if (hadAlpha && parts.length) {
                lastFromCard = parts.join(' ');
              }
            }
          }

          // Proceed with standard text pipeline for the rest
          const joined = words.map(w => (w && (w.text || w) || '').toString()).join(' ');
          if (joined && joined.trim()) {
            if (window.ocrProcessor && typeof window.ocrProcessor.showAIStatus === 'function') {
              window.ocrProcessor.showAIStatus('Pag-IBIG: Using OCR-only word-based extraction…');
            }
            this.fillFromText(joined);
            // If CARD-based names found, overwrite the First/Last Name fields afterwards
            if (firstFromCard || lastFromCard) {
              const idNumEl = document.getElementById('id-number');
              const lnEl = document.getElementById('last-name');
              const bdEl = document.getElementById('birth-date');
              const current = {
                idType: 'pagibig',
                idNumber: idNumEl ? idNumEl.value : undefined,
                lastName: lnEl ? lnEl.value : undefined,
                birthDate: bdEl ? bdEl.value : undefined
              };
              if (window.ocrProcessor && typeof window.ocrProcessor.fillDetailsForm === 'function') {
                window.ocrProcessor.fillDetailsForm({
                  idType: 'pagibig',
                  lastName: (lastFromCard || current.lastName) || undefined,
                  firstName: firstFromCard || undefined,
                  idNumber: current.idNumber || undefined,
                  birthDate: current.birthDate || undefined
                });
              }
            }
            return;
          }
        }
      } catch (e) {
        console.warn('[PagIBIG] fillFromWords error:', e);
      }
    },

    async fillFromText(text) {
      if (!this.isSelected()) return;
      if (!text) return;
      const rawText = String(text).replace(/\u0000/g, ' ').trim();
      // AI-first: request Pag-IBIG fields from server
      let aiFirstName, aiLastName, aiBirthDate, aiIdNumber, aiConfidence;
      try {
        if (window.ocrProcessor && typeof window.ocrProcessor.showAIStatus === 'function') {
          window.ocrProcessor.showAIStatus('Requesting AI extraction (Pag-IBIG)…');
        }
        const resp = await fetch('/api/ai/pagibig/parse', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rawText })
        });
        if (resp.status === 501) {
          window.ocrProcessor?.showAIStatus?.('AI disabled on server. Set GEMINI_API_KEY in .env and restart. Using OCR rules.');
        } else if (!resp.ok) {
          let errPayload = null; try { errPayload = await resp.json(); } catch {}
          const extra = errPayload?.details ? ` Details: ${errPayload.details}` : '';
          window.ocrProcessor?.showAIStatus?.(`AI request failed (HTTP ${resp.status}).${extra} Using OCR rules.`);
        } else {
          const data = await resp.json();
          if (data && data.success && data.fields) {
            aiFirstName = data.fields.firstName || undefined;
            aiLastName = data.fields.lastName || undefined;
            aiBirthDate = data.fields.birthDate || undefined;
            aiIdNumber = data.fields.idNumber || undefined;
            aiConfidence = data.confidence;
            window.ocrProcessor?.showAIResultsDL?.({ firstName: aiFirstName, lastName: aiLastName, birthDate: aiBirthDate, idNumber: aiIdNumber, confidence: aiConfidence });
            window.ocrProcessor?.showAIStatus?.('AI extraction complete (Pag-IBIG).');
          } else if (data && data.raw) {
            window.ocrProcessor?.showAIStatus?.('AI responded, but no fields were parsed (Pag-IBIG). Using OCR rules.');
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
        window.ocrProcessor?.showAIStatus?.('AI network error (Pag-IBIG). Using OCR rules.');
        console.error('[PagIBIG] AI network error:', e);
      }

      // If AI provided fields, fill the form now
      if (window.ocrProcessor && (aiLastName || aiFirstName || aiIdNumber || aiBirthDate)) {
        window.ocrProcessor.fillDetailsForm({ idType: 'pagibig', lastName: aiLastName, firstName: aiFirstName, idNumber: aiIdNumber, birthDate: aiBirthDate });
        return;
      }

      // Fallback to OCR heuristics
      window.ocrProcessor?.showAIStatus?.('AI did not return fields for Pag-IBIG. Falling back to OCR rules…');

      const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

      let idNumber, lastName, firstName, birthDate;

      // Prefer MID in 4-4-4 form (0000-0000-0000) near Pag-IBIG/MID labels
      for (const line of lines) {
        if (/\b(pag[-\s]?ibig|hdmf|mid\b|mid\s*no|member\s*id|id\s*no|id\s*number|pagibig)\b/i.test(line)) {
          // Direct hyphen/space separated 4-4-4
          const hy = line.match(/\b(\d{4})[-\s](\d{4})[-\s](\d{4})\b/);
          if (hy) { idNumber = `${hy[1]}-${hy[2]}-${hy[3]}`; break; }
          // Or digits mixed with spaces/hyphens after known labels
          const m = line.match(/(?:mid|id|number|no)[:\s-]*([0-9\s-]{12,})/i);
          if (m) {
            const formatted = normalizeMIDHyphen(m[1]);
            if (formatted) { idNumber = formatted; break; }
          }
          // Or any 12 digits in the same line
          const near12 = pick12Digits(line);
          if (near12) { idNumber = normalizeMIDHyphen(near12); break; }
        }
      }
      // Fallback: any 12-digit token anywhere
      if (!idNumber) {
        // Prefer any 4-4-4 match in the whole text
        const hyAll = rawText.match(/\b(\d{4})[-\s](\d{4})[-\s](\d{4})\b/);
        if (hyAll) {
          idNumber = `${hyAll[1]}-${hyAll[2]}-${hyAll[3]}`;
        } else {
          const any12 = pick12Digits(rawText);
          if (any12) idNumber = normalizeMIDHyphen(any12);
        }
      }

      // Name extraction heuristics
      for (const line of lines) {
        const lower = line.toLowerCase();
        if (!lastName && /\b(surname|last\s*name|family\s*name|apelyido)\b/.test(lower)) {
          const val = line.split(/:|\-|–|—/).slice(1).join(':') || line.replace(/.*?(surname|last\s*name|family\s*name|apelyido)\b[:\s-]*/i, '');
          lastName = normalizeLast(val);
        }
        if (!firstName && /\b(given\s*names?|first\s*name|mga\s*pangalan|given)\b/.test(lower)) {
          const val = line.split(/:|\-|–|—/).slice(1).join(':') || line.replace(/.*?(given\s*names?|first\s*name|mga\s*pangalan|given)\b[:\s-]*/i, '');
          firstName = normalizeFirst(val);
        }
        // Handle "Name: LAST, FIRST"
        if ((!lastName || !firstName) && /\bname\b/i.test(lower)) {
          const m = line.match(/name\s*[:\-–—]?\s*([^,\n]+),\s*([A-Za-z][^\n]*)/i);
          if (m) {
            if (!lastName) lastName = normalizeLast(m[1]);
            if (!firstName) firstName = normalizeFirst(m[2]);
          }
        }
      }

      // Birth date extraction around birth keywords
      if (!birthDate) {
        for (const line of lines) {
          if (/\b(birth|birth\s*date|date\s*of\s*birth|dob)\b/i.test(line)) {
            const iso = normalizeDate(line);
            if (iso) { birthDate = iso; break; }
          }
        }
      }
      if (!birthDate) {
        // Wide window search around keywords in the full text
        const words = rawText.split(/\s+/);
        for (let i = 0; i < words.length; i++) {
          const w = words[i].toLowerCase();
          const isBirth = w === 'birth' || w === 'dob' || (w === 'date' && (words[i+1]||'').toLowerCase() === 'of' && (words[i+2]||'').toLowerCase() === 'birth');
          if (isBirth) {
            for (let k = i - 8; k <= i + 8; k++) {
              const seg = words.slice(Math.max(0, k), Math.min(words.length, k + 5)).join(' ');
              const iso = normalizeDate(seg);
              if (iso) { birthDate = iso; break; }
            }
            if (birthDate) break;
          }
        }
      }

      if (window.ocrProcessor && typeof window.ocrProcessor.fillDetailsForm === 'function') {
        if (lastName || firstName || idNumber || birthDate) {
          try { window.ocrProcessor.showAIStatus && window.ocrProcessor.showAIStatus('Pag-IBIG: OCR extraction complete.'); } catch {}
        }
        window.ocrProcessor.fillDetailsForm({
          idType: 'pagibig',
          lastName: lastName || undefined,
          firstName: firstName || undefined,
          idNumber: idNumber || undefined,
          birthDate: birthDate || undefined
        });
      }
    }
  };

  window.PAGIBIG = PAGIBIG;
})();
