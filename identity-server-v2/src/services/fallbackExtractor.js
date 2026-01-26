/**
 * Scanning Algorithm - Heuristic extraction for Philippine IDs
 * Ported from browser-side scanning algorithms
 * This runs BEFORE AI as primary extraction method
 */

// ========== Shared Utilities ==========
const raw = (t) => (t || '').toString().trim();
const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

// Common label words that should NOT be treated as actual values
const LABEL_WORDS = new Set([
  'first', 'last', 'surname', 'name', 'names', 'given', 'middle', 'gitnang',
  'apelyido', 'pangalan', 'mga', 'date', 'of', 'birth', 'dob', 'birthdate',
  'address', 'sex', 'gender', 'nationality', 'citizenship', 'place',
  'id', 'number', 'no', 'card', 'holder', 'type', 'expiry', 'issue',
  'valid', 'until', 'from', 'tin', 'crn', 'psn', 'prn', 'mid',
  'philippine', 'identification', 'republic', 'philippines',
  'kapanganakan', 'petsa', 'ng'
]);

// Label line patterns - entire line is just labels (like "Apelyido/Last Name")
const LABEL_LINE_PATTERNS = [
  /^(apelyido|surname|last\s*name)[\/\s]*(last\s*name|surname|apelyido)?$/i,
  /^(mga\s*pangalan|given\s*names?|first\s*name)[\/\s]*(given\s*names?|first\s*name|mga\s*pangalan)?$/i,
  /^(gitnang\s*pangalan|middle\s*name)[\/\s]*(middle\s*name|gitnang\s*pangalan)?$/i,
  /^(petsa\s*ng\s*kapanganakan|date\s*of\s*birth|birth\s*date|dob)[\/\s]*(date\s*of\s*birth|birth\s*date|dob)?$/i,
  /^(kasarian|sex|gender)[\/\s]*(sex|gender|kasarian)?$/i,
];

// Check if entire line is just a label line
const isLabelLine = (line) => {
  if (!line) return false;
  const trimmed = line.trim();
  return LABEL_LINE_PATTERNS.some(rx => rx.test(trimmed));
};

// Check if a word is just a label
const isLabelWord = (word) => {
  if (!word) return true;
  const w = word.toLowerCase().replace(/[^a-z]/gi, '');
  if (w.length < 2) return true;
  if (LABEL_WORDS.has(w)) return true;
  return false;
};

// Check if entire text is just labels
const isOnlyLabels = (text) => {
  if (!text) return true;
  // Check if it matches any label line pattern
  if (isLabelLine(text)) return true;
  // Check individual words
  const words = text.split(/[\s\/,\-]+/).filter(Boolean);
  return words.every(w => isLabelWord(w));
};

// Extract value after label, checking next line if current line is just labels
const extractValueAfterLabel = (lines, lineIndex, labelPattern) => {
  const line = lines[lineIndex];
  if (!labelPattern.test(line)) return null;
  
  // Check if this ENTIRE line is just a label (like "Apelyido/Last Name")
  // If so, skip directly to next line
  if (isLabelLine(line) || isOnlyLabels(line)) {
    // The value should be on the next line
    if (lineIndex + 1 < lines.length) {
      const nextLine = lines[lineIndex + 1].trim();
      // Make sure next line is not another label
      if (nextLine && !isLabelLine(nextLine) && !isOnlyLabels(nextLine)) {
        return nextLine.split(/[,\/]+/)[0].trim(); // Return first part before comma/slash
      }
    }
    return null;
  }
  
  // Try to get value from same line (after colon/dash)
  let after = line.split(/[:\-–—]/).slice(1).join(':').trim();
  if (!after) {
    after = line.replace(labelPattern, '').trim();
  }
  
  // Clean up leading slashes and whitespace
  after = after.replace(/^[\s\/\-:]+/, '').trim();
  
  // If we got a value and it's not just another label, use it
  if (after && !isOnlyLabels(after)) {
    const words = after.split(/[\s,\/]+/).filter(w => !isLabelWord(w));
    if (words.length > 0) {
      return words.slice(0, 3).join(' ');
    }
  }
  
  // Check the next line for the actual value
  if (lineIndex + 1 < lines.length) {
    const nextLine = lines[lineIndex + 1].trim();
    if (nextLine && !isLabelLine(nextLine) && !isOnlyLabels(nextLine)) {
      return nextLine.split(/[,\/]+/)[0].trim();
    }
  }
  
  return null;
};

const monthMap = {
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
  dec: '12', december: '12',
};

const monthToNumber = (name) => {
  const key = String(name || '').toLowerCase().slice(0, 9);
  return monthMap[key] || monthMap[key.slice(0, 3)] || null;
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
  m = str.match(/\b(0?[1-9]|[12]\d|3[01])\s+([A-Za-z]{3,})\s+((?:19|20)\d{2})\b/);
  if (m) {
    const day = m[1].padStart(2, '0');
    const month = monthToNumber(m[2]);
    if (month) return `${m[3]}-${month}-${day}`;
  }
  // Mon DD, YYYY
  m = str.match(/\b([A-Za-z]{3,})\s+(0?[1-9]|[12]\d|3[01]),?\s+((?:19|20)\d{2})\b/);
  if (m) {
    const day = String(m[2]).padStart(2, '0');
    const month = monthToNumber(m[1]);
    if (month) return `${m[3]}-${month}-${day}`;
  }
  return null;
};

// ========== National ID Extractor ==========
function extractNationalID(rawText) {
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const result = { idType: 'national-id' };

  // Last Name (Apelyido/Last Name)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Check if this line contains last name label
    if (/\b(apelyido|last\s*name|surname)\b/i.test(line)) {
      // If the line is ONLY labels (like "Apelyido/Last Name"), get next line
      if (isLabelLine(line) || isOnlyLabels(line)) {
        if (i + 1 < lines.length && !isOnlyLabels(lines[i + 1])) {
          result.lastName = lines[i + 1].trim();
          break;
        }
      } else {
        // Value might be on same line after colon
        const value = extractValueAfterLabel(lines, i, /.*?(apelyido|last\s*name|surname)\b[:\s\/\-]*/i);
        if (value) { result.lastName = value; break; }
      }
    }
  }

  // First Name (Mga Pangalan/Given Names)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/\b(mga\s*pangalan|given\s*names?|first\s*name)\b/i.test(line)) {
      if (isLabelLine(line) || isOnlyLabels(line)) {
        if (i + 1 < lines.length && !isOnlyLabels(lines[i + 1])) {
          result.firstName = lines[i + 1].trim();
          break;
        }
      } else {
        const value = extractValueAfterLabel(lines, i, /.*?(mga\s*pangalan|given\s*names?|first\s*name)\b[:\s\/\-]*/i);
        if (value) { result.firstName = value; break; }
      }
    }
  }

  // Birth Date (Petsa ng Kapanganakan/Date of Birth)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/\b(petsa\s*ng\s*kapanganakan|date\s*of\s*birth|dob|birth\s*date|kapanganakan)\b/i.test(line)) {
      // If label-only line, check next line
      if (isLabelLine(line) || isOnlyLabels(line)) {
        if (i + 1 < lines.length) {
          const parsed = normalizeDate(lines[i + 1]);
          if (parsed) { result.birthDate = parsed; break; }
        }
      } else {
        // Try to extract from same line
        const bdMatch = line.match(/(petsa\s*ng\s*kapanganakan|date\s*of\s*birth|dob|birth\s*date)[:\s\/\-]*([A-Za-z0-9 ,\/.\-]+)/i);
        if (bdMatch && bdMatch[2]) {
          const dateStr = clean(bdMatch[2]);
          if (!isOnlyLabels(dateStr)) {
            result.birthDate = normalizeDate(dateStr) || dateStr;
            break;
          }
        }
        // Check next line
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1];
          const parsed = normalizeDate(nextLine);
          if (parsed) { result.birthDate = parsed; break; }
        }
      }
    }
  }

  // ID Number (PSN/CRN) - search entire raw text
  const idMatch = rawText.match(/\b(\d{4}[\-\s]\d{4}[\-\s]\d{4}[\-\s]\d{4})\b/);
  if (idMatch) {
    result.idNumber = idMatch[1].replace(/\s/g, '');
  }
  if (!result.idNumber) {
    const crn = rawText.match(/\bCRN[:\s\-]*([0-9\- ]{8,})/i);
    if (crn) result.idNumber = clean(crn[1]).replace(/\s+/g, '');
  }
  // PSN pattern: 4-4-4 digits
  if (!result.idNumber) {
    const psn = rawText.match(/\b(\d{4}[\-\s]?\d{4}[\-\s]?\d{4})\b/);
    if (psn) result.idNumber = psn[1].replace(/[\s\-]/g, '');
  }

  return result;
}

// ========== Driver's License Extractor ==========
function extractDriverLicense(rawText) {
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const result = { idType: 'driver-license' };

  // License Number: Letter + 11 digits (e.g., N01-12-123456)
  const licMatch = rawText.match(/\b([A-Z]\d{2}[\-\s]?\d{2}[\-\s]?\d{6})\b/i);
  if (licMatch) result.idNumber = licMatch[1].replace(/[\s]/g, '');

  // Names - look for labeled fields
  for (let i = 0; i < lines.length; i++) {
    if (/\b(last\s*name|surname|apelyido)\b/i.test(lines[i]) && !result.lastName) {
      const value = extractValueAfterLabel(lines, i, /.*?(last\s*name|surname|apelyido)\b[:\s\/\-]*/i);
      if (value) result.lastName = value;
    }
    if (/\b(first\s*name|given\s*name)\b/i.test(lines[i]) && !result.firstName) {
      const value = extractValueAfterLabel(lines, i, /.*?(first\s*name|given\s*name)\b[:\s\/\-]*/i);
      if (value) result.firstName = value;
    }
  }

  // Birth Date
  for (let i = 0; i < lines.length; i++) {
    if (/\b(date\s+of\s+birth|dob|birth\s*date)\b/i.test(lines[i])) {
      const bdMatch = lines[i].match(/(date\s+of\s+birth|dob|birth\s*date)[:\s\/\-]*([A-Za-z0-9 ,\/.\-]+)/i);
      if (bdMatch && bdMatch[2] && !isOnlyLabels(bdMatch[2])) {
        result.birthDate = normalizeDate(clean(bdMatch[2]));
        break;
      }
      if (i + 1 < lines.length) {
        const parsed = normalizeDate(lines[i + 1]);
        if (parsed) { result.birthDate = parsed; break; }
      }
    }
  }

  return result;
}

// ========== Passport Extractor ==========
function extractPassport(rawText) {
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const result = { idType: 'passport' };

  // Passport Number: 1-2 letters + 7-8 digits
  const passMatch = rawText.match(/\b([A-Z]{1,2}\d{7,8})\b/i);
  if (passMatch) result.idNumber = passMatch[1].toUpperCase();

  // MRZ parsing (if present)
  const mrzLines = lines.filter(l => /^P[<A-Z]/.test(l) && l.length >= 30);
  if (mrzLines.length >= 2) {
    // Line 1: P<PHLSURNAME<<GIVENNAME<...
    const line1 = mrzLines[0];
    const namePart = line1.slice(5).replace(/<+/g, ' ').trim();
    const nameParts = namePart.split(/\s+/);
    if (nameParts.length >= 1) result.lastName = nameParts[0];
    if (nameParts.length >= 2) result.firstName = nameParts.slice(1).join(' ');
    
    // Line 2: Passport number in first 9 chars
    const line2 = mrzLines[1];
    const passNum = line2.slice(0, 9).replace(/</g, '');
    if (/^[A-Z0-9]+$/.test(passNum)) result.idNumber = passNum;
    
    // Birth date at position 13-19 (YYMMDD format)
    const bdPart = line2.slice(13, 19);
    if (/^\d{6}$/.test(bdPart)) {
      const yy = parseInt(bdPart.slice(0, 2), 10);
      const year = yy > 30 ? 1900 + yy : 2000 + yy;
      result.birthDate = `${year}-${bdPart.slice(2, 4)}-${bdPart.slice(4, 6)}`;
    }
  }

  // Fallback: labeled fields
  for (let i = 0; i < lines.length; i++) {
    if (/\b(surname|last\s*name)\b/i.test(lines[i]) && !result.lastName) {
      const value = extractValueAfterLabel(lines, i, /.*?(surname|last\s*name)\b[:\s\/\-]*/i);
      if (value) result.lastName = value;
    }
    if (/\b(given\s*name|first\s*name)\b/i.test(lines[i]) && !result.firstName) {
      const value = extractValueAfterLabel(lines, i, /.*?(given\s*name|first\s*name)\b[:\s\/\-]*/i);
      if (value) result.firstName = value;
    }
  }

  // Birth Date
  for (let i = 0; i < lines.length; i++) {
    if (/\b(date\s+of\s+birth|dob|birth\s*date)\b/i.test(lines[i]) && !result.birthDate) {
      const bdMatch = lines[i].match(/(date\s+of\s+birth|dob|birth\s*date)[:\s\/\-]*([A-Za-z0-9 ,\/.\-]+)/i);
      if (bdMatch && bdMatch[2] && !isOnlyLabels(bdMatch[2])) {
        result.birthDate = normalizeDate(clean(bdMatch[2]));
        break;
      }
      if (i + 1 < lines.length) {
        const parsed = normalizeDate(lines[i + 1]);
        if (parsed) { result.birthDate = parsed; break; }
      }
    }
  }

  return result;
}

// ========== UMID Extractor ==========
function extractUMID(rawText) {
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const result = { idType: 'umid' };

  // CRN: 12 digits (4-7-1 format)
  const crnMatch = rawText.match(/\bCRN[:\s\-]*(\d{4}[\-\s]?\d{7}[\-\s]?\d{1})/i) ||
                   rawText.match(/\b(\d{4}[\-\s]?\d{7}[\-\s]?\d{1})\b/);
  if (crnMatch) result.idNumber = crnMatch[1].replace(/[\s\-]/g, '');

  // Names
  for (let i = 0; i < lines.length; i++) {
    if (/\b(surname|last\s*name|apelyido)\b/i.test(lines[i]) && !result.lastName) {
      const value = extractValueAfterLabel(lines, i, /.*?(surname|last\s*name|apelyido)\b[:\s\/\-]*/i);
      if (value) result.lastName = value;
    }
    if (/\b(given\s*name|first\s*name|mga\s*pangalan)\b/i.test(lines[i]) && !result.firstName) {
      const value = extractValueAfterLabel(lines, i, /.*?(given\s*name|first\s*name|mga\s*pangalan)\b[:\s\/\-]*/i);
      if (value) result.firstName = value;
    }
  }

  // Birth Date
  for (let i = 0; i < lines.length; i++) {
    if (/\b(date\s+of\s+birth|dob|birth\s*date|kapanganakan)\b/i.test(lines[i])) {
      const bdMatch = lines[i].match(/(date\s+of\s+birth|dob|birth\s*date|kapanganakan)[:\s\/\-]*([A-Za-z0-9 ,\/.\-]+)/i);
      if (bdMatch && bdMatch[2] && !isOnlyLabels(bdMatch[2])) {
        result.birthDate = normalizeDate(clean(bdMatch[2]));
        break;
      }
      if (i + 1 < lines.length) {
        const parsed = normalizeDate(lines[i + 1]);
        if (parsed) { result.birthDate = parsed; break; }
      }
    }
  }

  return result;
}

// ========== PhilHealth Extractor ==========
function extractPhilHealth(rawText) {
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const result = { idType: 'philhealth' };

  // PhilHealth ID: 2-9-1 format (12 digits)
  const phMatch = rawText.match(/\b(\d{2})[\-\s]?(\d{9})[\-\s]?(\d{1})\b/);
  if (phMatch) {
    result.idNumber = `${phMatch[1]}-${phMatch[2]}-${phMatch[3]}`;
  } else {
    // Try to find 12 consecutive digits
    const digits = rawText.match(/\b(\d{12})\b/);
    if (digits) {
      const d = digits[1];
      result.idNumber = `${d.slice(0,2)}-${d.slice(2,11)}-${d.slice(11)}`;
    }
  }

  // Names
  for (let i = 0; i < lines.length; i++) {
    if (/\b(last\s*name|surname)\b/i.test(lines[i]) && !result.lastName) {
      const value = extractValueAfterLabel(lines, i, /.*?(last\s*name|surname)\b[:\s\/\-]*/i);
      if (value) result.lastName = value;
    }
    if (/\b(first\s*name|given\s*name)\b/i.test(lines[i]) && !result.firstName) {
      const value = extractValueAfterLabel(lines, i, /.*?(first\s*name|given\s*name)\b[:\s\/\-]*/i);
      if (value) result.firstName = value;
    }
  }

  // Birth Date
  for (let i = 0; i < lines.length; i++) {
    if (/\b(date\s+of\s+birth|dob|birth\s*date)\b/i.test(lines[i])) {
      const bdMatch = lines[i].match(/(date\s+of\s+birth|dob|birth\s*date)[:\s\/\-]*([A-Za-z0-9 ,\/.\-]+)/i);
      if (bdMatch && bdMatch[2] && !isOnlyLabels(bdMatch[2])) {
        result.birthDate = normalizeDate(clean(bdMatch[2]));
        break;
      }
      if (i + 1 < lines.length) {
        const parsed = normalizeDate(lines[i + 1]);
        if (parsed) { result.birthDate = parsed; break; }
      }
    }
  }

  return result;
}

// ========== TIN ID Extractor ==========
function extractTINID(rawText) {
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const result = { idType: 'tin-id' };

  // TIN: 9-12 digits, often formatted as 3-3-3 or 3-3-3-3
  const tinPatterns = [
    /\bTIN[:\s\-]*(\d{3})[\-\s]?(\d{3})[\-\s]?(\d{3})[\-\s]?(\d{3})\b/i,
    /\bTIN[:\s\-]*(\d{3})[\-\s]?(\d{3})[\-\s]?(\d{3})\b/i,
    /\b(\d{3})[\-](\d{3})[\-](\d{3})[\-]?(\d{3})?\b/,
  ];
  
  for (const rx of tinPatterns) {
    const m = rawText.match(rx);
    if (m) {
      const parts = m.slice(1).filter(Boolean);
      result.idNumber = parts.join('-');
      break;
    }
  }

  // Names - be careful to avoid agency headers
  const agencyWords = new Set(['republic','philippines','department','finance','bureau','internal','revenue']);
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    const hasAgency = [...agencyWords].some(w => lower.includes(w));
    if (hasAgency) continue;

    if (/\b(last\s*name|surname)\b/i.test(lines[i]) && !result.lastName) {
      const value = extractValueAfterLabel(lines, i, /.*?(last\s*name|surname)\b[:\s\/\-]*/i);
      if (value) result.lastName = value;
    }
    if (/\b(first\s*name|given\s*name)\b/i.test(lines[i]) && !result.firstName) {
      const value = extractValueAfterLabel(lines, i, /.*?(first\s*name|given\s*name)\b[:\s\/\-]*/i);
      if (value) result.firstName = value;
    }
  }

  // Birth Date
  for (let i = 0; i < lines.length; i++) {
    if (/\b(date\s+of\s+birth|dob|birth\s*date)\b/i.test(lines[i])) {
      const bdMatch = lines[i].match(/(date\s+of\s+birth|dob|birth\s*date)[:\s\/\-]*([A-Za-z0-9 ,\/.\-]+)/i);
      if (bdMatch && bdMatch[2] && !isOnlyLabels(bdMatch[2])) {
        result.birthDate = normalizeDate(clean(bdMatch[2]));
        break;
      }
      if (i + 1 < lines.length) {
        const parsed = normalizeDate(lines[i + 1]);
        if (parsed) { result.birthDate = parsed; break; }
      }
    }
  }

  return result;
}

// ========== Postal ID Extractor ==========
function extractPostalID(rawText) {
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const result = { idType: 'postal-id' };

  // Postal ID: PRN format (letters + digits)
  const prnMatch = rawText.match(/\b(PRN|PID)[:\s\-]*([A-Z0-9\-]{6,})/i) ||
                   rawText.match(/\b([A-Z]{2,3}[\-]?\d{6,10})\b/i);
  if (prnMatch) result.idNumber = (prnMatch[2] || prnMatch[1]).replace(/[\s]/g, '');

  // Names
  for (let i = 0; i < lines.length; i++) {
    if (/\b(last\s*name|surname)\b/i.test(lines[i]) && !result.lastName) {
      const value = extractValueAfterLabel(lines, i, /.*?(last\s*name|surname)\b[:\s\/\-]*/i);
      if (value) result.lastName = value;
    }
    if (/\b(first\s*name|given\s*name)\b/i.test(lines[i]) && !result.firstName) {
      const value = extractValueAfterLabel(lines, i, /.*?(first\s*name|given\s*name)\b[:\s\/\-]*/i);
      if (value) result.firstName = value;
    }
  }

  // Birth Date
  for (let i = 0; i < lines.length; i++) {
    if (/\b(date\s+of\s+birth|dob|birth\s*date)\b/i.test(lines[i])) {
      const bdMatch = lines[i].match(/(date\s+of\s+birth|dob|birth\s*date)[:\s\/\-]*([A-Za-z0-9 ,\/.\-]+)/i);
      if (bdMatch && bdMatch[2] && !isOnlyLabels(bdMatch[2])) {
        result.birthDate = normalizeDate(clean(bdMatch[2]));
        break;
      }
      if (i + 1 < lines.length) {
        const parsed = normalizeDate(lines[i + 1]);
        if (parsed) { result.birthDate = parsed; break; }
      }
    }
  }

  return result;
}

// ========== Pag-IBIG Extractor ==========
function extractPagibigID(rawText) {
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const result = { idType: 'pagibig' };

  // Pag-IBIG: 12 digits (4-4-4 format)
  const pidMatch = rawText.match(/\b(\d{4})[\-\s]?(\d{4})[\-\s]?(\d{4})\b/);
  if (pidMatch) {
    result.idNumber = `${pidMatch[1]}-${pidMatch[2]}-${pidMatch[3]}`;
  }

  // Names
  for (let i = 0; i < lines.length; i++) {
    if (/\b(last\s*name|surname)\b/i.test(lines[i]) && !result.lastName) {
      const value = extractValueAfterLabel(lines, i, /.*?(last\s*name|surname)\b[:\s\/\-]*/i);
      if (value) result.lastName = value;
    }
    if (/\b(first\s*name|given\s*name)\b/i.test(lines[i]) && !result.firstName) {
      const value = extractValueAfterLabel(lines, i, /.*?(first\s*name|given\s*name)\b[:\s\/\-]*/i);
      if (value) result.firstName = value;
    }
  }

  // Birth Date
  for (let i = 0; i < lines.length; i++) {
    if (/\b(date\s+of\s+birth|dob|birth\s*date)\b/i.test(lines[i])) {
      const bdMatch = lines[i].match(/(date\s+of\s+birth|dob|birth\s*date)[:\s\/\-]*([A-Za-z0-9 ,\/.\-]+)/i);
      if (bdMatch && bdMatch[2] && !isOnlyLabels(bdMatch[2])) {
        result.birthDate = normalizeDate(clean(bdMatch[2]));
        break;
      }
      if (i + 1 < lines.length) {
        const parsed = normalizeDate(lines[i + 1]);
        if (parsed) { result.birthDate = parsed; break; }
      }
    }
  }

  return result;
}

// ========== Generic Fallback (unknown ID type) ==========
function extractGeneric(rawText) {
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const result = {};

  // Try to find any names
  for (let i = 0; i < lines.length; i++) {
    if (/\b(last\s*name|surname|apelyido)\b/i.test(lines[i]) && !result.lastName) {
      const value = extractValueAfterLabel(lines, i, /.*?(last\s*name|surname|apelyido)\b[:\s\/\-]*/i);
      if (value) result.lastName = value;
    }
    if (/\b(first\s*name|given\s*name|mga\s*pangalan)\b/i.test(lines[i]) && !result.firstName) {
      const value = extractValueAfterLabel(lines, i, /.*?(first\s*name|given\s*name|mga\s*pangalan)\b[:\s\/\-]*/i);
      if (value) result.firstName = value;
    }
  }

  // Try to find any ID number pattern
  const idPatterns = [
    /\b(\d{4}[\-\s]?\d{4}[\-\s]?\d{4})\b/,  // 12 digits
    /\b([A-Z]\d{2}[\-\s]?\d{2}[\-\s]?\d{6})\b/i,  // License
    /\b([A-Z]{1,2}\d{7,8})\b/i,  // Passport
    /\bCRN[:\s\-]*([0-9\-\s]{8,})/i,  // CRN
  ];
  for (const rx of idPatterns) {
    const m = rawText.match(rx);
    if (m && !result.idNumber) {
      result.idNumber = (m[1] || m[0]).replace(/[\s]/g, '');
      break;
    }
  }

  // Birth Date
  for (let i = 0; i < lines.length; i++) {
    if (/\b(date\s+of\s+birth|dob|birth\s*date|kapanganakan)\b/i.test(lines[i])) {
      const bdMatch = lines[i].match(/(date\s+of\s+birth|dob|birth\s*date|kapanganakan)[:\s\/\-]*([A-Za-z0-9 ,\/.\-]+)/i);
      if (bdMatch && bdMatch[2] && !isOnlyLabels(bdMatch[2])) {
        result.birthDate = normalizeDate(clean(bdMatch[2]));
        break;
      }
      if (i + 1 < lines.length) {
        const parsed = normalizeDate(lines[i + 1]);
        if (parsed) { result.birthDate = parsed; break; }
      }
    }
  }

  return result;
}

// ========== Main Export ==========
const extractors = {
  'national-id': extractNationalID,
  'driver-license': extractDriverLicense,
  'passport': extractPassport,
  'umid': extractUMID,
  'philhealth': extractPhilHealth,
  'tin-id': extractTINID,
  'postal-id': extractPostalID,
  'pagibig': extractPagibigID,
};

/**
 * Main scanning algorithm extraction function
 * This should be called BEFORE AI extraction
 */
export function scanningExtract(rawText, idType = 'unknown') {
  if (!rawText || typeof rawText !== 'string') {
    return { firstName: null, lastName: null, birthDate: null, idNumber: null };
  }
  
  const extractor = extractors[idType] || extractGeneric;
  const result = extractor(rawText);
  
  return {
    firstName: result.firstName || null,
    lastName: result.lastName || null,
    middleName: result.middleName || null,
    birthDate: result.birthDate || null,
    idNumber: result.idNumber || null,
    idType: result.idType || idType,
    extractionMethod: 'scanning-algorithm',
  };
}

// Alias for backward compatibility
export const fallbackExtract = scanningExtract;

/**
 * Merge primary results with secondary results
 * Only use secondary values for missing fields
 */
export function mergeWithFallback(primary, secondary) {
  if (!primary) return secondary || {};
  if (!secondary) return primary;
  
  const merged = { ...primary };
  const fields = ['firstName', 'lastName', 'middleName', 'birthDate', 'idNumber'];
  
  for (const field of fields) {
    if (!merged[field] && secondary[field]) {
      merged[field] = secondary[field];
      merged[`${field}Source`] = secondary.extractionMethod || 'ai';
    }
  }
  
  return merged;
}

export default { scanningExtract, fallbackExtract, mergeWithFallback };
