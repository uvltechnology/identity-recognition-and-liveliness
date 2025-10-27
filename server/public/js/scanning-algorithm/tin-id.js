(function(){
  // TIN ID scanning and extraction module (AI-first, OCR fallback)
  // Exposes a global window.TINID with helper methods
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

  // Helper: normalize and cap first name to max 2 tokens and drop suffixes
  const normalizeFirstName = (s) => {
    const cleaned = stripPunct(s);
    if (!cleaned) return '';
    let parts = cleaned.split(/\s+/).filter(Boolean);
    parts = parts.slice(0, 2);
    const joined = parts.join(' ');
    return trimNameSuffixes(joined);
  };

  // Helper: clean last name
  const normalizeLastName = (s) => stripPunct(s);

  // Name-like tokens (mispellings/variants) sourced from attached JSON
  const NAME_LIKE_LIST = [
    "'ame","'name","-ame","-name","aame","ame","aname","anme","bame","bname","came","cname","dame","dname","eame","ename","fame","fname","game","gname","hame","hname","iame","iname","jame","jname","kame","kname","lame","lname","mame","mname","n'ame","n'me","n-ame","n-me","na'e","na'me","na-e","na-me","naae","naame","nabe","nabme","nace","nacme","nade","nadme","nae","naee","naem","naeme","nafe","nafme","nage","nagme","nahe","nahme","naie","naime","naje","najme","nake","nakme","nale","nalme","nam","nam'","nam'e","nam-","nam-e","nama","namae","namb","nambe","namc","namce","namd","namde","name'","name-","namea","nameb","namec","named","namee","namef","nameg","nameh","namei","namej","namek","namel","namem","namen","nameo","namep","nameq","namer","names","namet","nameu","namev","namew","namex","namey","namez","namf","namfe","namg","namge","namh","namhe","nami","namie","namj","namje","namk","namke","naml","namle","namm","namme","namn","namne","namo","namoe","namp","nampe","namq","namqe","namr","namre","nams","namse","namt","namte","namu","namue","namv","namve","namw","namwe","namx","namxe","namy","namye","namz","namze","nane","nanme","naoe","naome","nape","napme","naqe","naqme","nare","narme","nase","nasme","nate","natme","naue","naume","nave","navme","nawe","nawme","naxe","naxme","naye","nayme","naze","nazme","nbame","nbme","ncame","ncme","ndame","ndme","neame","neme","nfame","nfme","ngame","ngme","nhame","nhme","niame","nime","njame","njme","nkame","nkme","nlame","nlme","nmae","nmame","nme","nmme","nname","nnme","noame","nome","npame","npme","nqame","nqme","nrame","nrme","nsame","nsme","ntame","ntme","nuame","nume","nvame","nvme","nwame","nwme","nxame","nxme","nyame","nyme","nzame","nzme","oame","oname","pame","pname","qame","qname","rame","rname","same","sname","tame","tname","uame","uname","vame","vname","wame","wname","xame","xname","yame","yname","zame","zname"
  ];
  const NAME_LIKE_SET = new Set(NAME_LIKE_LIST.map(s => s.toLowerCase()));
  const isPunctToken = (t) => /^[:\-–—]$/.test(t || '');
  const hasTrailingPunct = (t) => /[:\-–—]$/.test(t || '');
  const baseToken = (t) => String(t || '').replace(/[:\-–—]+$/g, '').toLowerCase();
  const isNameLike = (t) => {
    const b = baseToken(t);
    return b === 'name' || NAME_LIKE_SET.has(b);
  };

  // Blacklist to avoid capturing agency/header text as names
  const AGENCY_WORDS = new Set(['republic','philippines','department','finance','bureau','internal','revenue','of','the']);
  const isAgencyToken = (t) => AGENCY_WORDS.has(baseToken(t));
  const hasAgencyContext = (tokens, start, end) => {
    const window = tokens.slice(start, end).map(baseToken);
    const has = (x) => window.includes(x);
    return (has('bureau') && has('revenue')) || (has('republic') && has('philippines')) || (has('department') && has('finance'));
  };

  // Helper: parse TIN immediately after a 'TIN' token, skipping optional ':' or dashes
  const formatTIN = (digits) => {
    if (!digits) return null;
    if (digits.length >= 12) {
      const d = digits.slice(0,12);
      return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6,9)}-${d.slice(9,12)}`;
    } else if (digits.length >= 9) {
      const d = digits.slice(0,9);
      return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6,9)}`;
    } else if (digits.length >= 7) {
      return digits; // accept shorter TINs as-is
    }
    return null;
  };
  const parseTINAfter = (tokens, tinIndex) => {
    if (!Array.isArray(tokens) || tinIndex == null) return null;
    let j = tinIndex + 1;
    // If the TIN token had trailing punctuation, we've effectively already consumed it
    // If the next token is a punctuation like ':' or dash, skip it
    if (isPunctToken(tokens[j])) j++;
    let collected = '';
    // Collect up to 6 tokens worth of number/hyphen content
    for (let k = j; k < Math.min(tokens.length, j + 6); k++) {
      const t = String(tokens[k] || '');
      // Stop if we meet another label-like word
      if (/^(name|address|registered|date|birth|dob|tin|tax|sex|gender|place|issue|expiration)$/i.test(baseToken(t))) break;
      // Extract digits and hyphens only from this token
      const piece = t.replace(/[^0-9\-]/g, '');
      if (piece.length === 0) {
        // If there's a comma or period immediately after number, stop
        if (/[.,]/.test(t)) break;
        continue;
      }
      collected += piece;
      // If this token ends with a comma, stop after capturing
      if (/,/.test(t)) break;
      // If we already have at least 9 digits, we likely have enough; but keep small window
      const digitsOnly = collected.replace(/[^0-9]/g, '');
      if (digitsOnly.length >= 12) break;
    }
    const digitsOnly = collected.replace(/[^0-9]/g, '');
    return formatTIN(digitsOnly);
  };

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
    // Support 'DD Mon YYYY' with spaces OR hyphens like '22-Jul-2001' or '22 - Jul - 2001'
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
            window.ocrProcessor.showAIStatus('AI disabled on server. Set GEMINI_API_KEY in .env and restart. Using OCR rules.');
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
              window.ocrProcessor.showAIStatus('AI responded, but no fields were parsed (TIN). Using OCR rules.');
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

      // Proceed with OCR fallback heuristics
      if (window.ocrProcessor && typeof window.ocrProcessor.showAIStatus === 'function') {
        window.ocrProcessor.showAIStatus('Using OCR fallback heuristics for TIN.');
      }

      // OCR fallback heuristics (simple)
      const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
      let idNumber;
      // Priority: anchor to 'TIN' then skip optional ':' and read number
      if (!idNumber) {
        for (const line of lines) {
          const tokens = line.split(/\s+/).filter(Boolean);
          for (let i = 0; i < tokens.length; i++) {
            const t = tokens[i];
            if (baseToken(t) === 'tin') {
              const parsed = parseTINAfter(tokens, i);
              if (parsed) { idNumber = parsed; break; }
            }
          }
          if (idNumber) break;
        }
      }
      // Fallback: generic label-based regex if anchor is missing
      if (!idNumber) {
        for (const line of lines) {
          if (/\b(TIN|Tax\s*Identification|Taxpayer\s*Identification)\b/i.test(line)) {
            const m = line.match(/(?:TIN|Tax(?:payer)?\s*Identification(?:\s*Number)?)[:\s-]*([0-9\- ]{7,})/i);
            if (m) {
              const digits = (m[1] || '').replace(/[^0-9]/g, '');
              const formatted = formatTIN(digits);
              if (formatted) { idNumber = formatted; break; }
            }
          }
        }
      }
      // Names - try text-based extraction first
      let lastName, firstName, birthDate;
      for (const line of lines) {
        const l = line.toLowerCase();
        if (!lastName && /\b(surname|last\s*name)\b/.test(l)) {
          lastName = clean(line.split(/:|\-|–|—/).slice(1).join(':') || line.replace(/.*?(surname|last\s*name)\b[:\s-]*/i, ''));
        }
        if (!firstName && /\b(given\s*names?|first\s*name)\b/.test(l)) {
          firstName = clean(line.split(/:|\-|–|—/).slice(1).join(':') || line.replace(/.*?(given\s*names?|first\s*name)\b[:\s-]*/i, ''));
          if (firstName) firstName = normalizeFirstName(firstName);
        }
        // Handle a single 'Name' (including misspellings) line like: Name : LAST , FIRST MIDDLE
        if (!lastName || !firstName) {
          const words = line.split(/\s+/).filter(Boolean);
          for (let i = 0; i < Math.min(words.length, 6); i++) { // limit search near line start
            if (isNameLike(words[i])) {
              // Determine start after optional punctuation right after the name token
              let startIdx;
              if (hasTrailingPunct(words[i])) {
                startIdx = i + 1;
              } else if (isPunctToken(words[i+1])) {
                startIdx = i + 2;
              } else {
                startIdx = i + 1;
              }
              // If next token(s) look like agency/header, skip this line
              const ahead = words.slice(startIdx, Math.min(words.length, startIdx + 6));
              if (!ahead.length) continue;
              if (isAgencyToken(ahead[0]) || hasAgencyContext(words, startIdx, Math.min(words.length, startIdx + 10))) continue;
              // Collect tokens until comma separator for lastName, rest for firstName
              const lastNameWords = [];
              const firstNameWords = [];
              let foundComma = false;
              for (let j = startIdx; j < words.length; j++) {
                const w = words[j];
                if (!w) break;
                // Stop at other common labels
                if (/^(address|registered|date|birth|dob|tin|tax|sex|gender|place|issue|expiration)$/i.test(baseToken(w))) break;
                if (w === ',' || w.endsWith(',')) {
                  foundComma = true;
                  if (w.endsWith(',') && w.length > 1) lastNameWords.push(w.slice(0, -1));
                  continue;
                }
                if (!foundComma) lastNameWords.push(w); else firstNameWords.push(w);
              }
              // Require a comma to reduce false positives from headers
              if (!foundComma) continue;
              // Do not accept lastName that is agency/header tokens
              if (lastNameWords.length && (isAgencyToken(lastNameWords[0]) || hasAgencyContext(lastNameWords, 0, lastNameWords.length))) continue;
              if (!lastName && lastNameWords.length) lastName = normalizeLastName(lastNameWords.join(' '));
              if (!firstName && firstNameWords.length) firstName = normalizeFirstName(firstNameWords.join(' '));
              break;
            }
          }
        }
      }
      
      // Birth date extraction for TIN: look for date pattern before "Birth Date" label
      if (!birthDate && rawText) {
        const words = rawText.split(/\s+/);
        for (let i = 0; i < words.length - 1; i++) {
          const w = words[i];
          const w1 = words[i+1] || '';
          const isBirthDate = (/^birth$/i.test(w) && /^date$/i.test(w1)) ||
                              /^birthdate$/i.test(w) ||
                              (/^date$/i.test(w) && /^of$/i.test(w1) && /^birth$/i.test(words[i+2] || ''));
          if (isBirthDate) {
            // Found "Birth Date" - look backwards for date like "22 - Jul - 2001"
            for (let k = i - 1; k >= Math.max(0, i - 10); k--) {
              const segment = words.slice(k, i).join(' ');
              const iso = normalizeDate(segment);
              if (iso) { birthDate = iso; break; }
            }
            // Token-wise fallback if not found
            if (!birthDate) {
              const isSep = (x) => /^[\-\/.\u2013\u2014]$/.test(x);
              const isDay = (x) => /^([0-2]?\d|3[01])$/.test(x);
              const isMonth = (x) => /^[A-Za-z]{3,}$/.test(x) && !!monthToNumber(x);
              const isYear = (x) => /^(19|20)\d{2}$/.test(x);
              for (let k = i - 1; k >= Math.max(0, i - 9); k--) {
                const a = words[k], b = words[k+1], c = words[k+2], d = words[k+3], e = words[k+4];
                if (a === undefined || c === undefined || e === undefined) continue;
                if (isDay(a) && isSep(b || '-') && isMonth(c) && isSep(d || '-') && isYear(e)) {
                  const day = String(a).padStart(2, '0');
                  const month = monthToNumber(c);
                  if (month) { birthDate = `${e}-${month}-${day}`; break; }
                }
              }
            }
            // If still not found, try forward window after the label
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
      // As another text-based fallback: scan lines containing birth keywords for an inline date
      if (!birthDate) {
        for (const line of lines) {
          if (/\b(birth|dob|birthdate)\b/i.test(line)) {
            const iso = normalizeDate(line);
            if (iso) { birthDate = iso; break; }
          }
        }
      }
      
      // If lastName not found via text, try word-based extraction
      // Pattern: "Name" ":" <last name> "," <first name> until separator (like "Address")
      if (!lastName && rawText) {
        const words = rawText.split(/\s+/);
        for (let i = 0; i < words.length - 2; i++) {
          const t0 = words[i];
          const t1 = words[i+1] || '';
          const nameHead = (/^name[:\-–—]?$/i.test(t0)) || (/^name$/i.test(t0) && /^[:\-–—]$/.test(t1));
          if (nameHead) {
            // Found "Name :" pattern, collect words and check for comma separator
            const lastNameWords = [];
            const firstNameWords = [];
            let foundComma = false;
            
            const start = (/^name[:\-–—]?$/i.test(t0) && !/^[:\-–—]$/.test(t1)) ? i + 1 : i + 2;
            for (let j = start; j < words.length; j++) {
              const w = words[j].trim();
              // Stop at address-related words
              if (!w || /^(address|registered|date|birth|dob|tin|tax|sex|gender|place|issue|expiration)$/i.test(w)) break;
              
              // Check if this word is or contains a comma
              if (w === ',' || w.endsWith(',')) {
                foundComma = true;
                // If word ends with comma, add the word without comma to lastName
                if (w.endsWith(',') && w.length > 1) {
                  lastNameWords.push(w.slice(0, -1));
                }
                continue;
              }
              
              // Add to appropriate array based on whether we found comma
              if (!foundComma) {
                lastNameWords.push(w);
              } else {
                firstNameWords.push(w);
              }
            }
            
            // Set lastName and firstName
            if (lastNameWords.length > 0) {
              lastName = normalizeLastName(lastNameWords.join(' '));
            }
            if (firstNameWords.length > 0) {
              // Limit first name to 2 words maximum
              firstName = normalizeFirstName(firstNameWords.join(' '));
            }
            break;
          }
        }
      }

      if (window.ocrProcessor && typeof window.ocrProcessor.fillDetailsForm === 'function') {
        if (lastName || firstName || idNumber || birthDate) {
          if (window.ocrProcessor && typeof window.ocrProcessor.showAIStatus === 'function') {
            window.ocrProcessor.showAIStatus('OCR fallback extraction completed for TIN.');
          }
        }
        window.ocrProcessor.fillDetailsForm({ idType: 'tin-id', lastName: lastName || undefined, firstName: firstName || undefined, idNumber: idNumber || undefined, birthDate: birthDate || undefined });
      }
    },

    fillFromWords(words) {
      if (!this.isSelected()) return;
      if (!Array.isArray(words) || words.length === 0) return;
      
      if (window.ocrProcessor && typeof window.ocrProcessor.showAIStatus === 'function') {
        window.ocrProcessor.showAIStatus('Using OCR word-based extraction for TIN (fallback).');
      }
      
      const tokens = words.map(w => String(w?.text || ''));
      const joined = tokens.join(' ');
      let idNumber;
      // Find patterns like 123-456-789 or 123-456-789-000
      // Priority: anchor to 'TIN' token then parse number immediately after
      for (let i = 0; i < tokens.length; i++) {
        if (baseToken(tokens[i]) === 'tin') {
          const parsed = parseTINAfter(tokens, i);
          if (parsed) { idNumber = parsed; break; }
        }
      }
      // Fallbacks if no TIN-anchored number found
      if (!idNumber) {
        let m = joined.match(/\b(\d{3})-(\d{3})-(\d{3})(?:-(\d{3,}))?/);
        if (m) {
          idNumber = m[4] ? `${m[1]}-${m[2]}-${m[3]}-${m[4]}` : `${m[1]}-${m[2]}-${m[3]}`;
        }
      }
      if (!idNumber) {
        const digits = joined.replace(/[^0-9]/g, '');
        const formatted = formatTIN(digits);
        if (formatted) idNumber = formatted;
      }
      // Names and birth date extraction using word-based pattern matching
      let lastName, firstName, birthDate;
      
      // Pattern: Find "Name" (including misspellings) optionally followed by punctuation, then LastName "," FirstName until separator
      for (let i = 0; i < tokens.length - 2; i++) {
        const t = tokens[i].toLowerCase();
        
        // Look for Name-like header
        const t0 = tokens[i];
        const t1 = tokens[i+1] || '';
        const nameHead = (!lastName && (isNameLike(t0) || (isNameLike(baseToken(t0)) && isPunctToken(t1))));
        if (nameHead) {
          // Collect words after the colon, looking for comma separator
          const lastNameWords = [];
          const firstNameWords = [];
          let foundComma = false;
          
          // Start after trailing punctuation attached to t0, or skip a standalone punctuation token t1
          const start = hasTrailingPunct(t0) ? i + 1 : (isPunctToken(t1) ? i + 2 : i + 1);
          // If agency/header appears immediately after Name, skip this capture
          const ahead = tokens.slice(start, Math.min(tokens.length, start + 6));
          if (ahead.length && (isAgencyToken(ahead[0]) || hasAgencyContext(tokens, start, Math.min(tokens.length, start + 10)))) {
            // skip this nameHead occurrence
          } else {
          for (let j = start; j < tokens.length; j++) {
            const w = tokens[j].trim();
            // Stop at address-related words
            if (!w || /^(address|registered|date|birth|dob|tin|tax|sex|gender|place|issue|expiration)$/i.test(w)) break;
            
            // Check if this word is or contains a comma
            if (w === ',' || w.endsWith(',')) {
              foundComma = true;
              // If word ends with comma, add the word without comma to lastName
              if (w.endsWith(',') && w.length > 1) {
                lastNameWords.push(w.slice(0, -1));
              }
              continue;
            }
            
            // Add to appropriate array based on whether we found comma
            if (!foundComma) {
              lastNameWords.push(w);
            } else {
              firstNameWords.push(w);
            }
          }
          
          // Set lastName and firstName
          if (foundComma && lastNameWords.length > 0) {
            // Reject if lastName is agency/header text
            if (!(isAgencyToken(lastNameWords[0]) || hasAgencyContext(lastNameWords, 0, lastNameWords.length))) {
              lastName = normalizeLastName(lastNameWords.join(' '));
              if (firstNameWords.length > 0) {
                firstName = normalizeFirstName(firstNameWords.join(' '));
              }
            }
          }
          }
        }
        
        // Fallback patterns for surname/first name
        if (!lastName && /^(surname|last)$/.test(t) && tokens[i+1]) {
          lastName = normalizeLastName(tokens[i+1]);
        }
        if (!firstName && /^(first|given)$/.test(t) && tokens[i+1]) {
          firstName = normalizeFirstName(tokens[i+1]);
        }
        
        // Birth date extraction - look for "Birth" "Date" pattern
        // The date appears BEFORE "Birth Date" label in TIN IDs
        const isBirthDate = (!birthDate && ((/^birth$/i.test(t) && tokens[i+1] && /^date$/i.test(tokens[i+1])) ||
                                             /^birthdate$/i.test(tokens[i]) ||
                                             (/^date$/i.test(tokens[i]) && /^of$/i.test(tokens[i+1] || '') && /^birth$/i.test(tokens[i+2] || ''))));
        if (isBirthDate) {
          // Look backwards for date pattern like '22 - Jul - 2001'
          for (let k = i - 1; k >= Math.max(0, i - 10); k--) {
            const segment = tokens.slice(k, i).join(' ');
            const iso = normalizeDate(segment);
            if (iso) { birthDate = iso; break; }
          }
          // If still not found, try token-wise matching: DD [sep] Mon [sep] YYYY
          if (!birthDate) {
            const isSep = (x) => /^[\-\/.\u2013\u2014]$/.test(x);
            const isDay = (x) => /^([0-2]?\d|3[01])$/.test(x);
            const isMonth = (x) => /^[A-Za-z]{3,}$/.test(x) && !!monthToNumber(x);
            const isYear = (x) => /^(19|20)\d{2}$/.test(x);
            // Try windows of 5 tokens backward like [DD] [-] [Mon] [-] [YYYY]
            for (let k = i - 1; k >= Math.max(0, i - 9); k--) {
              const a = tokens[k], b = tokens[k+1], c = tokens[k+2], d = tokens[k+3], e = tokens[k+4];
              if (a === undefined || c === undefined || e === undefined) continue;
              if (isDay(a) && isSep(b || '-') && isMonth(c) && isSep(d || '-') && isYear(e)) {
                const day = String(a).padStart(2, '0');
                const month = monthToNumber(c);
                if (month) { birthDate = `${e}-${month}-${day}`; break; }
              }
            }
          }
          // If still not found, try forward window after the label
          if (!birthDate) {
            for (let k = i + 1; k <= Math.min(tokens.length - 1, i + 10); k++) {
              const segment = tokens.slice(i + 1, k + 1).join(' ');
              const iso = normalizeDate(segment);
              if (iso) { birthDate = iso; break; }
            }
          }
        }
        
        // Fallback: look for date patterns near "birth" or "dob"
        if (!birthDate && /^(birth|dob)$/i.test(t)) {
          const win = tokens.slice(i, i + 6).join(' ');
          const iso = normalizeDate(win);
          if (iso) birthDate = iso;
        }
      }
      if (window.ocrProcessor && typeof window.ocrProcessor.fillDetailsForm === 'function') {
        if (lastName || firstName || idNumber || birthDate) {
          if (window.ocrProcessor && typeof window.ocrProcessor.showAIStatus === 'function') {
            window.ocrProcessor.showAIStatus('OCR word-based extraction completed for TIN.');
          }
        }
        window.ocrProcessor.fillDetailsForm({ idType: 'tin-id', lastName: lastName || undefined, firstName: firstName || undefined, idNumber: idNumber || undefined, birthDate: birthDate || undefined });
      }
    }
  };

  window.TINID = TINID;
})();