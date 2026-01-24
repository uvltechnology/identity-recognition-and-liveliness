(function(){
  // Postal ID Card scanning and extraction module (AI-only)
  // Exposes a global window.POSTALID with helper methods
  const raw = (t) => (t || '').toString().trim();

  // Helper: strip surrounding punctuation and normalize inner spacing
  const stripPunct = (s) => (s || '')
    .replace(/^[\s,.;:()\[\]{}"'`]+|[\s,.;:()\[\]{}"'`]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Helper: remove common suffixes like Jr., Sr., II, III at the end of a name
  const trimNameSuffixes = (name) => {
    let tokens = String(name || '').split(/\s+/).filter(Boolean);
    while (tokens.length && /^(jr\.?|sr\.?|ii|iii|iv|v)$/i.test(tokens[tokens.length - 1])) {
      tokens.pop();
    }
    return tokens.join(' ');
  };

  // Helper: normalize and cap first name to max 1 token and drop suffixes
  const normalizeFirstName = (s) => {
    const cleaned = stripPunct(s);
    if (!cleaned) return '';
    let parts = cleaned.split(/\s+/).filter(Boolean);
    parts = parts.slice(0, 1);
    const joined = parts.join(' ');
    return trimNameSuffixes(joined);
  };

  // Helper: clean last name
  const normalizeLastName = (s) => stripPunct(s);

  // Helper: token utilities
  const baseToken = (t) => String(t || '').replace(/[:,;\-–—.]+$/g, '').toLowerCase();
  const isPunctToken = (t) => /^[:,;\-–—.]$/.test(String(t || ''));

  // Words to skip immediately after 'CARD' when hunting for first name
  const SKIP_AFTER_CARD = new Set([
    'card','holder','holders','cardholder','cardholders','cardholder’s','cardholder\'s','no','number','id','postal','philpost','philippine','philippines','gov','government',
    // Also skip account-related tokens that can follow CARD
    'acc','acct','account','accnt'
  ]);

  // Helper: format Postal ID number (usually alphanumeric, no standard format)
  const formatPostalID = (id) => {
    if (!id) return null;
    // Postal ID format varies; keep alphanumeric and hyphens
    const cleaned = String(id).replace(/[^A-Z0-9\-]/gi, '').toUpperCase();
    return cleaned.length >= 6 ? cleaned : null;
  };

  const monthToNumber = (name) => {
    const map = { 
      jan:'01', january:'01', feb:'02', february:'02', mar:'03', march:'03', 
      apr:'04', april:'04', may:'05', jun:'06', june:'06', jul:'07', july:'07', 
      aug:'08', august:'08', sep:'09', sept:'09', september:'09', oct:'10', 
      october:'10', nov:'11', november:'11', dec:'12', december:'12' 
    };
    const key = String(name || '').toLowerCase().slice(0, 9);
    return map[key] || map[key.slice(0, 3)] || null;
  };

  // Expand two-digit years to four digits using a pivot (>=30 => 19xx, else 20xx)
  const expandYear2 = (yy) => {
    const n = parseInt(String(yy || ''), 10);
    if (Number.isNaN(n)) return null;
    const pivot = 30;
    const year = n >= pivot ? 1900 + n : 2000 + n;
    return String(year);
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

  const POSTALID = {
    isSelected() {
      const sel = document.getElementById('id-type');
      if (!sel) return false;
      return String(sel.value).toLowerCase() === 'postal-id';
    },

    async fillFromText(text) {
      if (!this.isSelected()) return;
      if (!text) return;
      const rawText = (text || '').replace(/\u0000/g, ' ').trim();
      // AI-first: request Postal ID fields
      let aiFirstName, aiLastName, aiBirthDate, aiIdNumber, aiConfidence;
      try {
        if (window.ocrProcessor && typeof window.ocrProcessor.showAIStatus === 'function') {
          window.ocrProcessor.showAIStatus('Requesting AI extraction (Postal ID)…');
        }
        console.debug('[PostalID] Sending AI parse request…');
        const resp = await fetch('/api/ai/postal-id/parse', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rawText })
        });
        console.debug('[PostalID] AI parse response status:', resp.status);
        if (resp.status === 501) {
          if (window.ocrProcessor && typeof window.ocrProcessor.showAIStatus === 'function') {
            window.ocrProcessor.showAIStatus('AI disabled on server. Set GEMINI_API_KEY in .env and restart. Using OCR rules.');
          }
        } else if (!resp.ok) {
          let errPayload = null; try { errPayload = await resp.json(); } catch {}
          const extra = errPayload?.details ? ` Details: ${errPayload.details}` : '';
          if (window.ocrProcessor && typeof window.ocrProcessor.showAIStatus === 'function') {
            window.ocrProcessor.showAIStatus(`AI request failed (HTTP ${resp.status}).${extra} Using OCR rules.`);
          }
          console.warn('[PostalID] AI request failed:', { status: resp.status, details: errPayload?.details || null });
        } else {
          const data = await resp.json();
          console.debug('[PostalID] AI parse data:', { success: data?.success, modelUsed: data?.modelUsed, fields: data?.fields, confidence: data?.confidence });
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
              window.ocrProcessor.showAIStatus('AI extraction complete (Postal ID).');
            }
          } else if (data && data.raw) {
            if (window.ocrProcessor && typeof window.ocrProcessor.showAIStatus === 'function') {
              window.ocrProcessor.showAIStatus('AI responded, but no fields were parsed (Postal ID). Using OCR rules.');
            }
            console.warn('[PostalID] AI responded without fields. Raw length:', (data.raw || '').length);
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
          window.ocrProcessor.showAIStatus('AI network error (Postal ID). Using OCR rules.');
        }
        console.error('[PostalID] AI network error:', e);
      }

      // If AI provided fields, fill the form now
      if (window.ocrProcessor && (aiLastName || aiFirstName || aiIdNumber || aiBirthDate)) {
        console.debug('[PostalID] Filling form with AI fields');
        window.ocrProcessor.fillDetailsForm({ idType: 'postal-id', lastName: aiLastName, firstName: aiFirstName, idNumber: aiIdNumber, birthDate: aiBirthDate });
        return;
      }

      // AI fallback enabled: continue with OCR heuristics
      if (window.ocrProcessor && typeof window.ocrProcessor.showAIStatus === 'function') {
        window.ocrProcessor.showAIStatus('AI did not return fields for Postal ID. Falling back to OCR rules…');
      }
      console.warn('[PostalID] AI returned no fields. Falling back to OCR heuristics…');

      const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
      
      let idNumber, lastName, firstName, birthDate;

      // Preferred: any standalone 12-character alphanumeric word anywhere
      // Example: ABC123DEF456 -> ID number
      if (!idNumber) {
        const m12 = rawText.match(/\b([A-Za-z0-9]{12})\b/);
        if (m12) {
          idNumber = m12[1].toUpperCase();
        }
      }

      // ID Number extraction fallback - look for "Postal ID" or "ID No" patterns
      if (!idNumber) {
        for (const line of lines) {
          if (/\b(postal\s*id|id\s*no|id\s*number|card\s*no)/i.test(line)) {
            // Try to extract alphanumeric ID after label
            const m = line.match(/(?:postal\s*id|id\s*no|id\s*number|card\s*no)[:\s-]*([A-Z0-9\-]{6,})/i);
            if (m) {
              idNumber = formatPostalID(m[1]);
              if (idNumber) break;
            }
          }
        }
      }

      // Name extraction
      for (const line of lines) {
        const l = line.toLowerCase();
        if (!lastName && /\b(surname|last\s*name|family\s*name)\b/.test(l)) {
          lastName = clean(line.split(/:|\-|–|—/).slice(1).join(':') || line.replace(/.*?(surname|last\s*name|family\s*name)\b[:\s-]*/i, ''));
          if (lastName) lastName = normalizeLastName(lastName);
        }
        if (!firstName && /\b(given\s*names?|first\s*name)\b/.test(l)) {
          firstName = clean(line.split(/:|\-|–|—/).slice(1).join(':') || line.replace(/.*?(given\s*names?|first\s*name)\b[:\s-]*/i, ''));
          if (firstName) firstName = normalizeFirstName(firstName);
        }
        // Handle "Name" line with comma separator
        if ((!lastName || !firstName) && /\bname\b/i.test(l)) {
          const words = line.split(/\s+/).filter(Boolean);
          for (let i = 0; i < Math.min(words.length, 6); i++) {
            if (/^name[:\-–—]?$/i.test(words[i]) || (i + 1 < words.length && /^name$/i.test(words[i]) && /^[:\-–—]$/.test(words[i+1]))) {
              const startIdx = /^name[:\-–—]?$/i.test(words[i]) ? i + 1 : i + 2;
              const lastNameWords = [];
              const firstNameWords = [];
              let foundComma = false;
              
              for (let j = startIdx; j < words.length; j++) {
                const w = words[j];
                if (!w || /^(address|date|birth|dob|postal|id|card)$/i.test(w)) break;
                if (w === ',' || w.endsWith(',')) {
                  foundComma = true;
                  if (w.endsWith(',') && w.length > 1) lastNameWords.push(w.slice(0, -1));
                  continue;
                }
                if (!foundComma) lastNameWords.push(w); else firstNameWords.push(w);
              }
              
              if (foundComma && lastNameWords.length) {
                if (!lastName) lastName = normalizeLastName(lastNameWords.join(' '));
                if (!firstName && firstNameWords.length) firstName = normalizeFirstName(firstNameWords.join(' '));
              }
              break;
            }
          }
        }
      }

      // Rule 1: after the word 'SUFFIX' (or truncated 'SUF'), next word is first name
      if (!firstName && rawText) {
        const words = rawText.split(/\s+/).filter(Boolean);
        for (let i = 0; i < words.length - 1; i++) {
          const b = baseToken(words[i]);
          if (b === 'suffix' || b.startsWith('suf')) {
            const next = words[i+1];
            if (next) { firstName = normalizeFirstName(next); }
            if (firstName) break;
          }
        }
      }

      // Rule 2: after the word 'CARD', take the first non-label word as first name and the 3rd valid word as last name (only if SUFFIX rule didn't yield)
      if (!firstName && rawText) {
        const words = rawText.split(/\s+/).filter(Boolean);
        for (let i = 0; i < words.length; i++) {
          if (baseToken(words[i]) === 'card') {
            // If the immediate next non-punctuation token starts with 'acc', skip this CARD branch
            let peekIdx = i + 1;
            while (peekIdx < words.length && (isPunctToken(words[peekIdx]) || !baseToken(words[peekIdx]))) peekIdx++;
            const peekBase = baseToken(words[peekIdx]);
            if (peekBase && peekBase.startsWith('acc')) {
              continue;
            }
            const collected = [];
            for (let j = i + 1; j < Math.min(words.length, i + 12); j++) {
              const w = words[j];
              const b = baseToken(w);
              if (!b) break;
              if (isPunctToken(w)) continue;
              if (/^(address|date|birth|dob|postal|id|card|number|no)$/i.test(b)) break;
              if (SKIP_AFTER_CARD.has(b)) continue;
              if (b && b.startsWith('acc')) continue; // skip tokens like ACC, ACCT, ACCOUNT
              collected.push(w);
              if (collected.length >= 3) break; // collect up to 3 to allow last name from 3rd
            }
            if (collected.length >= 1) {
              // first name = first collected token
              firstName = normalizeFirstName(collected[0]);
              // last name = 3rd collected token (if available) and only if not set yet
              if (!lastName && collected.length >= 3) {
                lastName = normalizeLastName(collected[2]);
              }
            }
            if (firstName) break;
          }
        }
      }

      // Birth date extraction
      if (!birthDate && rawText) {
        const words = rawText.split(/\s+/);
        for (let i = 0; i < words.length - 1; i++) {
          const w = words[i];
          const w1 = words[i+1] || '';
          const isBirthDate = (/^birth$/i.test(w) && /^date$/i.test(w1)) ||
                              /^birthdate$/i.test(w) ||
                              /^dob$/i.test(w) ||
                              (/^date$/i.test(w) && /^of$/i.test(w1) && /^birth$/i.test(words[i+2] || ''));
          if (isBirthDate) {
            // Look backwards and forwards for date
            for (let k = i - 1; k >= Math.max(0, i - 10); k--) {
              const segment = words.slice(k, i).join(' ');
              const iso = normalizeDate(segment);
              if (iso) { birthDate = iso; break; }
            }
            if (!birthDate) {
              for (let k = i + 1; k <= Math.min(words.length - 1, i + 10); k++) {
                const segment = words.slice(i + 1, k + 1).join(' ');
                const iso = normalizeDate(segment);
                if (iso) { birthDate = iso; break; }
              }
            }
            if (birthDate) break;
          }
        }
      }
      // Additional: handle standalone 'birth' label (not only 'birth date')
      if (!birthDate && rawText) {
        const words = rawText.split(/\s+/);
        for (let i = 0; i < words.length; i++) {
          if (/^birth$/i.test(words[i])) {
            // Try forward window first
            for (let k = i + 1; k <= Math.min(words.length - 1, i + 10); k++) {
              const segment = words.slice(i + 1, k + 1).join(' ');
              const iso = normalizeDate(segment);
              if (iso) { birthDate = iso; break; }
            }
            // Then try backward window
            if (!birthDate) {
              for (let k = i - 1; k >= Math.max(0, i - 10); k--) {
                const segment = words.slice(k, i).join(' ');
                const iso = normalizeDate(segment);
                if (iso) { birthDate = iso; break; }
              }
            }
            if (birthDate) break;
          }
        }
      }
      // Fallback: scan lines with birth keywords
      if (!birthDate) {
        for (const line of lines) {
          if (/\b(birth|dob|birthdate)\b/i.test(line)) {
            const iso = normalizeDate(line);
            if (iso) { birthDate = iso; break; }
          }
        }
      }

      // If there is NO 'birth' token anywhere, try scanning forward after 'postal' tokens for a date
      if (!birthDate && rawText && !/\bbirth\b/i.test(rawText)) {
        const words = rawText.split(/\s+/);
        for (let i = 0; i < words.length; i++) {
          if (baseToken(words[i]) === 'postal') {
            for (let k = i + 1; k <= Math.min(words.length - 1, i + 12); k++) {
              const segment = words.slice(i + 1, k + 1).join(' ');
              const iso = normalizeDate(segment);
              if (iso) { birthDate = iso; break; }
            }
            if (birthDate) break;
          }
        }
      }

      if (window.ocrProcessor && typeof window.ocrProcessor.fillDetailsForm === 'function') {
        if (lastName || firstName || idNumber || birthDate) {
          if (window.ocrProcessor && typeof window.ocrProcessor.showAIStatus === 'function') {
            window.ocrProcessor.showAIStatus('OCR extraction completed for Postal ID.');
          }
        }
        window.ocrProcessor.fillDetailsForm({ 
          idType: 'postal-id', 
          lastName: lastName || undefined, 
          firstName: firstName || undefined, 
          idNumber: idNumber || undefined, 
          birthDate: birthDate || undefined 
        });
      }
    },

    fillFromWords(words) {
      if (!this.isSelected()) return;
      try {
        // Minimal word-based fallback: join words into text and reuse text pipeline
        if (Array.isArray(words) && words.length > 0) {
          const joined = words.map(w => (w && (w.text || w) || '').toString()).join(' ');
          if (joined && joined.trim()) {
            if (window.ocrProcessor && typeof window.ocrProcessor.showAIStatus === 'function') {
              window.ocrProcessor.showAIStatus('Using OCR word-based fallback for Postal ID…');
            }
            return this.fillFromText(joined);
          }
        }
        // If no words, just no-op
      } catch (e) {
        console.warn('[PostalID] fillFromWords fallback error:', e);
      }
    }
  };

  window.POSTALID = POSTALID;
})();
