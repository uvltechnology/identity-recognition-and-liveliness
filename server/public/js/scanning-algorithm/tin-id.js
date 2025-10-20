(function(){
  // TIN ID scanning and extraction module (AI-first, OCR fallback)
  // Exposes a global window.TINID with helper methods
  const raw = (t) => (t || '').toString().trim();

  const monthToNumber = (name) => {
    const map = { jan:'01', january:'01', feb:'02', february:'02', mar:'03', march:'03', apr:'04', april:'04', may:'05', jun:'06', june:'06', jul:'07', july:'07', aug:'08', august:'08', sep:'09', sept:'09', september:'09', oct:'10', october:'10', nov:'11', november:'11', dec:'12', december:'12' };
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

  const TINID = {
    isSelected() {
      const sel = document.getElementById('id-type');
      if (!sel) return false;
      return String(sel.value).toLowerCase() === 'tin-id';
    },

    async fillFromText(text) {
      if (!this.isSelected()) return;
      if (!text) return;
      const rawText = (text || '').replace(/\u0000/g, ' ').trim();

      // AI-first: request TIN ID fields
      let aiFirstName, aiLastName, aiBirthDate, aiIdNumber, aiConfidence;
      try {
        if (window.ocrProcessor && typeof window.ocrProcessor.showAIStatus === 'function') {
          window.ocrProcessor.showAIStatus('Requesting AI extraction (TIN)…');
        }
        const resp = await fetch('/api/ai/tin-id/parse', {
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
              window.ocrProcessor.showAIStatus('AI extraction complete (TIN).');
            }
          } else if (data && data.raw) {
            if (window.ocrProcessor && typeof window.ocrProcessor.showAIStatus === 'function') {
              window.ocrProcessor.showAIStatus('AI responded, but no fields were parsed (TIN).');
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
          window.ocrProcessor.showAIStatus('AI network error (TIN). Using OCR rules.');
        }
      }

      if (window.ocrProcessor && (aiLastName || aiFirstName || aiIdNumber || aiBirthDate)) {
        window.ocrProcessor.fillDetailsForm({ idType: 'tin-id', lastName: aiLastName, firstName: aiFirstName, idNumber: aiIdNumber, birthDate: aiBirthDate });
        return;
      }

      // OCR fallback heuristics (simple)
      const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
      let idNumber;
      for (const line of lines) {
        if (/\b(TIN|Tax\s*Identification|Taxpayer\s*Identification)\b/i.test(line)) {
          const m = line.match(/(?:TIN|Tax(?:payer)?\s*Identification(?:\s*Number)?)[:\s-]*([0-9\- ]{9,})/i);
          if (m) {
            const digits = (m[1] || '').replace(/[^0-9]/g, '');
            if (digits.length >= 12) {
              const d = digits.slice(0,12); idNumber = `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6,9)}-${d.slice(9,12)}`; break;
            } else if (digits.length >= 9) {
              const d = digits.slice(0,9); idNumber = `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6,9)}`; break;
            }
          }
        }
      }
      // Names
      let lastName, firstName, birthDate;
      for (const line of lines) {
        const l = line.toLowerCase();
        if (!lastName && /\b(surname|last\s*name)\b/.test(l)) {
          lastName = clean(line.split(/:|\-|–|—/).slice(1).join(':') || line.replace(/.*?(surname|last\s*name)\b[:\s-]*/i, ''));
        }
        if (!firstName && /\b(given\s*names?|first\s*name)\b/.test(l)) {
          firstName = clean(line.split(/:|\-|–|—/).slice(1).join(':') || line.replace(/.*?(given\s*names?|first\s*name)\b[:\s-]*/i, ''));
        }
        if (!birthDate && /\bbirth\b|date\s*of\s*birth|dob/i.test(l)) {
          const tail = clean(line.split(/:|\-|–|—/).slice(1).join(':'));
          birthDate = normalizeDate(tail) || tail;
        }
      }

      if (window.ocrProcessor && typeof window.ocrProcessor.fillDetailsForm === 'function') {
        window.ocrProcessor.fillDetailsForm({ idType: 'tin-id', lastName: lastName || undefined, firstName: firstName || undefined, idNumber: idNumber || undefined, birthDate: birthDate || undefined });
      }
    },

    fillFromWords(words) {
      if (!this.isSelected()) return;
      if (!Array.isArray(words) || words.length === 0) return;
      const tokens = words.map(w => String(w?.text || ''));
      const joined = tokens.join(' ');
      let idNumber;
      // Find patterns like 123-456-789 or 123-456-789-000
      let m = joined.match(/\b(\d{3})-(\d{3})-(\d{3})(?:-(\d{3}))?\b/);
      if (m) idNumber = m[4] ? `${m[1]}-${m[2]}-${m[3]}-${m[4]}` : `${m[1]}-${m[2]}-${m[3]}`;
      if (!idNumber) {
        const digits = joined.replace(/[^0-9]/g, '');
        if (digits.length >= 12) {
          const d = digits.slice(0,12); idNumber = `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6,9)}-${d.slice(9,12)}`;
        } else if (digits.length >= 9) {
          const d = digits.slice(0,9); idNumber = `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6,9)}`;
        }
      }
      // Names and birth date are harder per layout; rely on AI or simple cues if present
      let lastName, firstName, birthDate;
      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i].toLowerCase();
        if (!lastName && /^(surname|last)$/.test(t) && tokens[i+1]) lastName = tokens[i+1];
        if (!firstName && /^(first|given)$/.test(t) && tokens[i+1]) firstName = tokens[i+1];
        if (!birthDate && /^(birth|dob|date)$/i.test(t)) {
          const win = tokens.slice(i, i + 6).join(' ');
          const iso = normalizeDate(win);
          if (iso) birthDate = iso;
        }
      }
      if (window.ocrProcessor && typeof window.ocrProcessor.fillDetailsForm === 'function') {
        window.ocrProcessor.fillDetailsForm({ idType: 'tin-id', lastName: lastName || undefined, firstName: firstName || undefined, idNumber: idNumber || undefined, birthDate: birthDate || undefined });
      }
    }
  };

  window.TINID = TINID;
})();