(function(){
  // UMID scanning and extraction module
  // Exposes a global window.UMID with helper methods
  const raw = (t) => (t || '').toString().trim();
  const upAlpha = (t) => raw(t).toUpperCase().replace(/[^A-Z]/g, '');
  const isDash = (t) => /^[-–—]+$/.test(raw(t));
  const isStarToken = (t) => raw(t) === '*';

  const lev = (a, b) => {
    a = String(a || '');
    b = String(b || '');
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }
    return dp[m][n];
  };

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

  const getVariantSets = () => {
    const p = (typeof window !== 'undefined' && window.ocrProcessor) ? window.ocrProcessor : null;
    return {
      surname: p && p.surnameVariants ? p.surnameVariants : null,
      name: p && p.nameVariants ? p.nameVariants : null,
      middle: p && p.middleVariants ? p.middleVariants : null,
    };
  };

  const isLikelyLabelFactory = () => {
    const { surname } = getVariantSets();
    return (t) => {
      const u = upAlpha(t);
      if (!u) return false;
      if (
        u === 'SURNAME' || u === 'LASTNAME' || u === 'LAST' || u === 'NAME' ||
        u === 'FAMILY' || u === 'FAMILYNAME' || u === 'APELYIDO' || u === 'APELLIDO'
      ) return true;
      const known = new Set(['SURNME','SURMAME','SURMANE','SURNM','SRNAME','SURNAMES','SURNAUS','SURANME','SURNEM','SURNASSE']);
      if (known.has(u)) return true;
      if (surname && surname.has(u)) return true;
      const vowelless = u.replace(/[AEIOU]/g, '');
      if (vowelless === 'SRNM' || vowelless === 'SRNME' || vowelless === 'SRNAM') return true;
      if (/^SURN[A-Z]*M?E?$/.test(u)) return true;
      const base = 'SURNAME';
      const distance = lev(u, base);
      const relative = distance / base.length;
      if (distance <= 2 || relative <= 0.34) return true;
      return false;
    };
  };

  const isLabelTokenFactory = () => {
    const { surname, name, middle } = getVariantSets();
    const base = new Set(['SURNAME','LASTNAME','LAST','FAMILY','FAMILYNAME','APELYIDO','APELLIDO','NAME','NAMES','GIVEN','GIVENAME','GIVENNAMES','MIDDLE','MIDDLENAME','GITNANG']);
    return (t) => {
      const u = upAlpha(t);
      if (!u) return false;
      if (base.has(u)) return true;
      if (surname && surname.has(u)) return true;
      if (name && name.has(u)) return true;
      if (middle && middle.has(u)) return true;
      return false;
    };
  };

  const UMID = {
    isSelected() {
      const sel = document.getElementById('id-type');
      if (!sel) return false;
      return String(sel.value).toLowerCase() === 'umid';
    },

    fillFromWords(words) {
      if (!this.isSelected()) return;
      if (!Array.isArray(words) || words.length === 0) return;
      const lastName = this.extractLastName(words);
      const firstName = this.extractFirstName(words);
      const idNumber = this.extractIdNumber(words);
      const birthDate = this.extractBirthDate(words);
      if (window.ocrProcessor && (lastName || firstName || idNumber || birthDate)) {
        window.ocrProcessor.fillDetailsForm({ idType: 'umid', lastName: lastName || undefined, firstName: firstName || undefined, idNumber: idNumber || undefined, birthDate: birthDate || undefined });
      }
      try { console.log('[UMID] Detected words:', words.length, 'LastName:', lastName || '(none)', 'FirstName:', firstName || '(none)', 'ID:', idNumber || '(none)', 'Birth:', birthDate || '(none)'); } catch {}
    },

    extractLastName(words) {
      if (!Array.isArray(words) || words.length === 0) return null;
      const isRepublicish = (t) => {
        const u = upAlpha(t);
        return ['REPUBLIC','REPUBLICA','REPUBLIKA','PUBLIKA','REPUB','REPUBLlC','REPUBL1C','FIL','PIL'].includes(u);
      };
      const isIdLabel = (t) => upAlpha(t) === 'ID';
      const isGivenLabel = (t) => upAlpha(t) === 'GIVEN';
      const cleanName = (s) => raw(s).replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '').replace(/\s+/g, ' ').trim();
      const stopWords = new Set(['OMEN','GIVEN','GIVENAME','GIVENNAMES','NAME','NAMES','SURNAME','LAST','LASTNAME','APELYIDO','FAMILY','FAMILYNAME','MIDDLE','MIDDLENAME','GITNANG','BIRTH','DATE','OF','CRN','CARD']);
      const isLabelToken = isLabelTokenFactory();
      const isLikelyLabel = isLikelyLabelFactory();
      const isPlausibleName = (t) => {
        const u = upAlpha(t);
        if (stopWords.has(u)) return false;
        if (isLabelToken(t)) return false;
        if (u.length < 2) return false;
        if (/\d/.test(raw(t))) return false;
        return true;
      };

      for (let i = 0; i < words.length; i++) {
        if (!isLikelyLabel(words[i]?.text)) continue;
        let j = i + 1;
        let republicWindow = 0;
        let sawRepublic = false;
        while (j < words.length && republicWindow < 6) {
          const tk = words[j]?.text;
          if (!tk) { j++; republicWindow++; continue; }
          const u = upAlpha(tk);
          if (isRepublicish(tk) || u === 'OF' || u === 'THE' || u === 'PHILIPPINES' || u === 'NG' || u === 'PILIPINAS' || u === 'NO' || u === 'PIL') {
            sawRepublic = true;
            j++; republicWindow++;
            continue;
          }
          break;
        }

        if (sawRepublic) {
          let k = j;
          let idIdx = -1;
          for (; k < Math.min(words.length, j + 20); k++) {
            if (isIdLabel(words[k]?.text)) { idIdx = k; break; }
          }
          if (idIdx !== -1) {
            let p = idIdx + 1;
            if (p < words.length && isStarToken(words[p]?.text)) p++;
            const parts = [];
            while (p < words.length && parts.length < 5) {
              const tk2 = words[p]?.text || '';
              if (!tk2) { p++; continue; }
              if (isDash(tk2) || isLikelyLabel(tk2) || isLabelToken(tk2) || isGivenLabel(tk2)) break;
              const up2 = upAlpha(tk2);
              if (up2 === 'CRN') break;
              if (isStarToken(tk2)) { p++; continue; }
              if (isPlausibleName(tk2)) {
                parts.push(cleanName(tk2));
              } else {
                break;
              }
              p++;
            }
            if (parts.length) return parts.join(' ');
          }
        }

        const nextTok = words[i + 1]?.text;
        if (nextTok && upAlpha(nextTok) === 'FIL') {
          let s = i + 1;
          let starIdx = -1;
          for (; s < Math.min(words.length, i + 20); s++) {
            if (isStarToken(words[s]?.text)) { starIdx = s; break; }
          }
          if (starIdx !== -1) {
            let p = starIdx + 1;
            const parts = [];
            while (p < words.length && parts.length < 5) {
              const tk2 = words[p]?.text || '';
              if (!tk2) { p++; continue; }
              const up2 = upAlpha(tk2);
              if (up2 === 'CRN') break;
              if (isDash(tk2) || isStarToken(tk2) || isLikelyLabel(tk2) || isLabelToken(tk2)) { p++; continue; }
              if (!isPlausibleName(tk2)) break;
              parts.push(cleanName(tk2));
              p++;
            }
            if (parts.length) return parts.join(' ');
          }
        }

        j = i + 1;
        const parts = [];
        let hops = 0;
        while (j < words.length && hops < 20 && parts.length < 5) {
          const tk = words[j]?.text;
          if (!tk) { j++; hops++; continue; }
          if (isGivenLabel(tk)) break;
          const up = upAlpha(tk);
          if (up === 'CRN') break;
          if (isDash(tk) || isStarToken(tk) || isLikelyLabel(tk) || isLabelToken(tk)) { j++; hops++; continue; }
          if (!isPlausibleName(tk)) break;
          parts.push(cleanName(tk));
          j++; hops++;
        }
        if (parts.length) return parts.join(' ');
      }

      for (let i = 0; i < words.length; i++) {
        if (upAlpha(words[i]?.text) !== 'ID') continue;
        let p = i + 1;
        if (p < words.length && isStarToken(words[p]?.text)) p++;
        const parts = [];
        while (p < words.length && parts.length < 5) {
          const tk = words[p]?.text || '';
          if (!tk) { p++; continue; }
          const up = upAlpha(tk);
          if (up === 'CRN') break;
          if (isDash(tk) || isStarToken(tk) || isLikelyLabel(tk) || isLabelToken(tk) || up === 'GIVEN') break;
          if (!/^[A-Z]{2,}$/.test(up)) break;
          parts.push(cleanName(tk));
          p++;
        }
        if (parts.length) return parts.join(' ');
      }

      const isHyphenatedCrn = (t) => /^(\d{4})-(\d{7})-(\d)$/.test(raw(t).replace(/[^0-9\-]/g, ''));
      for (let i = 0; i < words.length; i++) {
        const up = upAlpha(words[i]?.text);
        if (up === 'CRN') {
          for (let j = i + 1; j < Math.min(words.length, i + 6); j++) {
            const token = words[j]?.text || '';
            const cleaned = String(token).trim();
            const digitsHyph = cleaned.replace(/[^0-9\-]/g, '');
            if (/^(\d{4})-(\d{7})-(\d)$/.test(digitsHyph)) {
              if (j + 1 < words.length) {
                const nextTok = words[j + 1]?.text;
                if (nextTok && /^[A-Za-z]{2,}$/.test(raw(nextTok))) {
                  const cand = raw(nextTok).replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '').replace(/\s+/g, ' ').trim();
                  if (cand) return cand;
                }
              }
              break;
            }
          }
        }
      }
      return null;
    },

    extractFirstName(words) {
      if (!Array.isArray(words) || words.length === 0) return null;
      const { name, middle } = getVariantSets();
      const isLikelyNameLabel = (t) => {
        const up = upAlpha(t);
        if (!up) return false;
        if (name && name.has(up)) return true;
        if (up === 'NAME' || up === 'NAMES') return true;
        const vowless = up.replace(/[AEIOU]/g, '');
        if (vowless === 'NM' || vowless === 'NMS') return true;
        if (lev(up, 'NAME') <= 1 || lev(up, 'NAMES') <= 1) return true;
        return false;
      };
      const isLikelyMiddleLabel = (t) => {
        const up = upAlpha(t);
        if (!up) return false;
        if (middle && middle.has(up)) return true;
        if (up === 'MIDDLE' || up === 'MIDDLE NAME' || up === 'MIDDLENAME') return true;
        const vowless = up.replace(/[AEIOU]/g, '');
        if (vowless === 'MDDL' || vowless === 'MDDLNME') return true;
        if (lev(up, 'MIDDLE') <= 1 || lev(up, 'MIDDLENAME') <= 2) return true;
        return false;
      };
      const isStop = (t) => {
        const up = upAlpha(t);
        if (!up) return true;
        if (['CRN','ID','CARD','BIRTH','DATE','OF','SURNAME','APELYIDO','LAST','FAMILY','MIDDLE','GITNANG','GIVEN','GIVENAME','GIVENNAMES','PASAPORTE','PHL','FIRSTNAME','FIRST'].includes(up)) return true;
        const { surname, name, middle } = getVariantSets();
        if (surname && surname.has(up)) return true;
        if (name && name.has(up)) return true;
        if (middle && middle.has(up)) return true;
        return false;
      };
      const isPlausible = (t) => {
        const up = upAlpha(t);
        if (!up) return false;
        if (isStop(up)) return false;
        return /^[A-Z]{2,30}$/.test(up);
      };

      for (let i = 0; i < words.length; i++) {
        if (!isLikelyNameLabel(words[i]?.text)) continue;
        let j = i + 1, hops = 0;
        const parts = [];
        while (j < words.length && hops < 12) {
          const cand = words[j]?.text || '';
          if (isLikelyMiddleLabel(cand)) break;
          if (!cand || isDash(cand) || isLikelyNameLabel(cand) || isStop(cand)) { j++; hops++; continue; }
          if (parts.length >= 1) {
            const up = upAlpha(cand);
            const nextUp = upAlpha(words[j + 1]?.text || '');
            if ((up === 'HODLE' || up === 'ADDLE' || /DLE$/.test(up) || /OLE$/.test(up)) && nextUp === 'NAME') {
              break;
            }
          }
          if (isPlausible(cand)) {
            parts.push(raw(cand).replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, ''));
            if (parts.length >= 3) break;
          }
          j++; hops++;
        }
        if (parts.length) return parts.join(' ').replace(/\s+/g, ' ').trim();
      }
      return null;
    },

    extractIdNumber(words) {
      if (!Array.isArray(words) || words.length === 0) return null;
      const formatDigitsToCRN = (digitsOnly) => {
        const d = String(digitsOnly || '').replace(/\D/g, '');
        if (d.length < 12) return null;
        const slice = d.slice(0, 12);
        return `${slice.slice(0,4)}-${slice.slice(4,11)}-${slice.slice(11)}`;
      };
      const normalizeCandidate = (s) => {
        if (!s) return null;
        const cleaned = String(s).replace(/[^0-9\-]/g, '');
        const m = cleaned.match(/^(\d{4})-(\d{7})-(\d{1})$/);
        if (m) return `${m[1]}-${m[2]}-${m[3]}`;
        return formatDigitsToCRN(cleaned);
      };
      for (let i = 0; i < words.length; i++) {
        const t = upAlpha(words[i]?.text);
        if (!t) continue;
        const m = (words[i]?.text || '').toString().trim().match(/^CRN\W*([0-9\-]{5,})/i);
        if (m) {
          const formatted = normalizeCandidate(m[1]);
          if (formatted) return `CRN-${formatted}`;
        }
      }
      for (let i = 0; i < words.length; i++) {
        const t = upAlpha(words[i]?.text);
        if (t === 'CRN') {
          let buffer = '';
          for (let j = i + 1; j < Math.min(words.length, i + 6); j++) {
            const seg = (words[j]?.text || '').toString().trim();
            if (!seg) continue;
            buffer += (buffer ? '' : '') + seg;
            const try1 = normalizeCandidate(buffer);
            if (try1) return `CRN-${try1}`;
            const try2 = normalizeCandidate(seg);
            if (try2) return `CRN-${try2}`;
          }
        }
      }
      return null;
    },

    extractBirthDate(words) {
      if (!Array.isArray(words) || words.length === 0) return null;
      const isBirth = (t) => /\bbirth\b/i.test(raw(t));
      let birthIdx = -1;
      for (let i = 0; i < words.length; i++) {
        if (isBirth(words[i]?.text)) { birthIdx = i; break; }
      }
      if (birthIdx !== -1) {
        const tail = words.slice(birthIdx + 1, Math.min(words.length, birthIdx + 1 + 5))
          .map(w => raw(w?.text))
          .filter(Boolean);
        for (const tok of tail) {
          const iso = normalizeDate(tok);
          if (iso) return iso;
        }
        for (let win = 2; win <= Math.min(3, tail.length); win++) {
          for (let s = 0; s + win <= tail.length; s++) {
            const joined = tail.slice(s, s + win).join(' ');
            const iso = normalizeDate(joined);
            if (iso) return iso;
          }
        }
      }
      for (let i = 0; i < words.length; i++) {
        const t = raw(words[i]?.text);
        if (!t) continue;
        const iso = normalizeDate(t);
        if (iso) return iso;
      }
      return null;
    }
  };

  window.UMID = UMID;
})();
