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

function pickIdNumber(text) {
  const lines = text.split(/\r?\n/);
  const candidates = [];
  const rx = /\b(?:ID|Identity|National|Citizen|Document|Doc|No|Number|NIN|NIC|CRN|PCN)[\s:\-]*([A-Z0-9\-]{5,})\b/i;
  for (const line of lines) {
    const m = line.replace(/\s+/g, ' ').match(rx);
    if (m) candidates.push(m[1]);
  }
  // Fallback: longest alnum token with digits
  if (candidates.length === 0) {
    const tokens = text.match(/[A-Z0-9\-]{6,}/gi) || [];
    const withDigits = tokens.filter(t => /\d/.test(t));
    withDigits.sort((a, b) => b.length - a.length);
    if (withDigits[0]) candidates.push(withDigits[0]);
  }
  return candidates[0];
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

export async function extractIdentityFromText(text, { useAI = false, model = 'gpt-4o-mini', imageBase64 = null } = {}) {
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
  const idNumber = pickIdNumber(text);

  let result = { firstName, lastName, birthDate, idNumber, source: 'heuristic' };

  // Optional AI refinement with OpenAI (with image analysis)
  if (useAI && process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      const messages = [
        {
          role: 'system',
          content: `You are an expert at extracting information from Philippine identity documents (National ID, Driver's License, Passport, etc.).

Extract these fields with high accuracy:
- firstName: Given name(s) only
- lastName: Family name/Surname only  
- birthDate: Convert to YYYY-MM-DD format (e.g., "APRIL 05, 1989" → "1989-04-05")
- idNumber: The document's ID number (CRN, License No, Passport No, etc.)

Rules:
1. Analyze BOTH the image and OCR text
2. If image text differs from OCR text, prefer the image
3. Handle OCR errors (O→0, I→1, S→5, etc.)
4. Ignore middle names unless combined with first name
5. For dates: Handle formats like "05 APR 1989", "APRIL 05, 1989", "04/05/1989"
6. For ID numbers: Remove spaces and special chars
7. Return null if field not found with confidence
8. Provide confidence level: high, medium, or low
9. Return only JSON, no explanations`
        }
      ];

      // If image is provided, use vision model
      if (imageBase64 && (model === 'gpt-4o' || model === 'gpt-4o-mini')) {
        messages.push({
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this identity document image and the OCR text below. Extract firstName, lastName, birthDate (YYYY-MM-DD), and idNumber. Cross-check the image against the OCR text to ensure accuracy.\n\nOCR Text:\n${text}`
            },
            {
              type: 'image_url',
              image_url: {
                url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`,
                detail: 'high'
              }
            }
          ]
        });

        console.log('[AI extraction] Using vision model with image analysis');
      } else {
        // Text-only mode
        messages.push({
          role: 'user',
          content: `OCR Text from identity document:\n\n${text}\n\nExtract: firstName, lastName, birthDate (YYYY-MM-DD), idNumber`
        });

        console.log('[AI extraction] Using text-only mode');
      }

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
      
      // Prefer AI values if present and mark as verified by image
      result = {
        firstName: json.firstName || result.firstName || null,
        lastName: json.lastName || result.lastName || null,
        birthDate: json.birthDate || result.birthDate || null,
        idNumber: json.idNumber || result.idNumber || null,
        source: imageBase64 ? 'ai-vision' : 'ai-text',
        confidence: json.confidence || 'medium',
        verified: imageBase64 ? true : false
      };
    } catch (err) {
      console.error('[identityExtractor] OpenAI extraction failed:', err.message);
      // keep heuristic result
    }
  }

  return result;
}
