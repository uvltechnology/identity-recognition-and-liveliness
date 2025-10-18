import OpenAI from 'openai';

function parseMrz(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const mrz = lines.filter(l => /^[A-Z0-9<]{25,}$/.test(l));
  if (mrz.length < 2) return null;

  const joined = mrz.join('\n');
  const birth = joined.match(/\D(\d{6})\D/);
  const birthYYMMDD = birth ? birth[1] : null;

  // Try name from MRZ line with << separators
  const nameLine = mrz.find(l => l.includes('<<'));
  let lastName, firstName;
  if (nameLine) {
    const parts = nameLine.replace(/<+/g, ' ').trim().split(' ').filter(Boolean);
    if (parts.length >= 2) {
      lastName = parts[0];
      firstName = parts.slice(1).join(' ');
    }
  }

  let birthDate;
  if (birthYYMMDD) {
    const yy = parseInt(birthYYMMDD.slice(0, 2), 10);
    const mm = birthYYMMDD.slice(2, 4);
    const dd = birthYYMMDD.slice(4, 6);
    const year = yy >= 0 && yy <= 30 ? 2000 + yy : 1900 + yy;
    birthDate = `${year}-${mm}-${dd}`;
  }

  return {
    firstName: firstName ? titleCase(firstName) : undefined,
    lastName: lastName ? titleCase(lastName) : undefined,
    birthDate
  };
}

function titleCase(s) {
  return s.replace(/\b([A-Za-z])([A-Za-z]*)\b/g, (_, a, b) => a.toUpperCase() + b.toLowerCase());
}

function pickIdNumber(text, idType = 'generic') {
  const lines = text.split(/\r?\n/);
  const candidates = [];
  // Broader label capture; prefer matches with the correct label first
  const rx = /\b(?:PCN|CRN|ID(?:\s*No)?|Identity|National|Citizen|Document|Doc|No|Number|NIN|NIC)[\s:\-]*([A-Z0-9\-]{5,})\b/i;
  for (const line of lines) {
    const m = line.replace(/\s+/g, ' ').match(rx);
    if (m) candidates.push(m[1]);
  }
  // If National ID, prioritize PCN then CRN
  if (idType === 'national-id') {
    const pcn = lines.map(l => l.trim()).find(l => /\bPCN\b/i.test(l));
    if (pcn) {
      const m = pcn.match(/PCN[\s:\-]*([A-Z0-9\-]{5,})/i);
      if (m) return m[1].replace(/\s+/g, '').replace(/-/g, '');
    }
    const crn = lines.map(l => l.trim()).find(l => /\bCRN\b/i.test(l));
    if (crn) {
      const m = crn.match(/CRN[\s:\-]*([A-Z0-9\-]{5,})/i);
      if (m) return m[1].replace(/\s+/g, '').replace(/-/g, '');
    }
  }
  // Fallback: longest alnum token with digits
  if (candidates.length === 0) {
    const tokens = text.match(/[A-Z0-9\-]{6,}/gi) || [];
    const withDigits = tokens.filter(t => /\d/.test(t));
    withDigits.sort((a, b) => b.length - a.length);
    if (withDigits[0]) candidates.push(withDigits[0]);
  }
  // Normalize by removing spaces and hyphens
  return candidates[0] ? candidates[0].replace(/\s+/g, '').replace(/-/g, '') : undefined;
}

function pickBirthDate(text) {
  // Support: YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, DD MMM YYYY
  const patterns = [
    /\b(20\d{2}|19\d{2})[-/.](0[1-9]|1[0-2])[-/.](0[1-9]|[12]\d|3[01])\b/,     // YYYY-MM-DD
    /\b(0[1-9]|[12]\d|3[01])[\/.](0[1-9]|1[0-2])[\/.](19|20)\d{2}\b/,         // DD/MM/YYYY
    /\b(0[1-9]|1[0-2])[\/.](0[1-9]|[12]\d|3[01])[\/.](19|20)\d{2}\b/,         // MM/DD/YYYY
    /\b(0[1-9]|[12]\d|3[01])\s+([A-Za-z]{3,})\s+(19|20)\d{2}\b/               // DD Mon YYYY
  ];
  for (const rx of patterns) {
    const m = text.match(rx);
    if (m) return m[0].replace(/\s+/g, ' ');
  }
  return undefined;
}

function pickNames(text) {
  // Prefer labeled lines
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let firstName, lastName;

  for (const line of lines) {
    const l = line.toLowerCase();
    if (!firstName && /(given|first)\s*name/.test(l)) {
      firstName = titleCase(line.replace(/.*?:/, '').trim());
    }
    if (!lastName && /(surname|last)\s*name/.test(l)) {
      lastName = titleCase(line.replace(/.*?:/, '').trim());
    }
    if (firstName && lastName) break;
  }

  // Fallback from "Name: LAST, FIRST MIDDLE"
  if (!(firstName && lastName)) {
    const m = text.match(/\bname\b[:\s\-]*([A-Z ,.'\-]{4,})/i);
    if (m) {
      const raw = m[1].trim();
      if (raw.includes(',')) {
        const [last, rest] = raw.split(',', 2);
        lastName = lastName || titleCase(last.trim());
        firstName = firstName || titleCase(rest.trim().split(/\s+/)[0]);
      } else {
        const parts = raw.split(/\s+/);
        if (parts.length >= 2) {
          firstName = firstName || titleCase(parts[0]);
          lastName = lastName || titleCase(parts.slice(1).join(' '));
        }
      }
    }
  }

  return { firstName, lastName };
}

export async function extractIdentityFromText(text, { useAI = false, model = 'gpt-4o-mini', idType = 'national-id' } = {}) {
  text = (text || '').replace(/\u0000/g, ' ').trim();

  // MRZ first
  const mrz = parseMrz(text);
  let firstName = mrz?.firstName;
  let lastName = mrz?.lastName;
  let birthDate = mrz?.birthDate;

  // Heuristic enrichment
  const names = pickNames(text);
  firstName = firstName || names.firstName;
  lastName = lastName || names.lastName;
  birthDate = birthDate || pickBirthDate(text);
  const idNumber = pickIdNumber(text, idType);

  let result = { firstName, lastName, birthDate, idNumber, source: 'heuristic' };

  // Optional AI refinement with OpenAI (TEXT-ONLY; image is NOT used)
  if (useAI && process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      const messages = [
        {
          role: 'system',
          content: `You are an expert at extracting information from Philippine identity documents (National ID, Driver's License, Passport, etc.).

IMPORTANT: You will only be given OCR TEXT. Do not assume anything not present in the OCR text. Do not analyze or refer to any image.

Extract these fields with high accuracy:
- firstName: Given name(s) only
- lastName: Family name/Surname only
- birthDate: Convert to YYYY-MM-DD format (e.g., "APRIL 05, 1989" → "1989-04-05")
- idNumber: The document's ID number. For National ID, prioritize PCN (Personal Common Reference Number); if missing, use CRN.

Rules:
1. Use only the OCR text; do not infer from missing context
2. Handle OCR errors (O→0, I→1, S→5, etc.) when it clearly improves validity
3. Ignore middle names unless combined with first name in a labeled field
4. Dates: handle formats like "05 APR 1989", "APRIL 05, 1989", "04/05/1989"; output YYYY-MM-DD when possible
5. ID numbers: normalize by removing spaces and hyphens; prefer lines labeled like PCN, CRN (for National ID), License No, ID No, Passport No
6. Return null for any field you cannot find with reasonable confidence
7. Provide a confidence level: high, medium, or low
8. Return only JSON, no explanations`
        },
        {
          role: 'user',
          content: `ID Type: ${idType}\n\nOCR Text from identity document:\n\n${text}\n\nExtract: firstName, lastName, birthDate (YYYY-MM-DD), idNumber`
        }
      ];

      console.log('[AI extraction] Using text-only mode');

      const completion = await openai.chat.completions.create({
        model: model,
        messages: messages,
        response_format: { type: 'json_object' },
        temperature: 0,
        max_tokens: 500,
      });

      const content = completion.choices[0]?.message?.content || '{}';
      const json = JSON.parse(content);
      
      console.log('[AI extraction] Result:', json);
      
      // Prefer AI values if present; text-only source, no image verification
      result = {
        firstName: json.firstName || result.firstName || null,
        lastName: json.lastName || result.lastName || null,
        birthDate: json.birthDate || result.birthDate || null,
        idNumber: json.idNumber || result.idNumber || null,
        source: 'ai-text',
        confidence: json.confidence || 'medium',
        verified: false
      };
    } catch (err) {
      console.error('[identityExtractor] OpenAI extraction failed:', err.message);
      // keep heuristic result
    }
  }

  return result;
}
