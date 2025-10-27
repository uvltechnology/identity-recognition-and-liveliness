import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * GeminiService: uses Google Generative AI (Gemini) to parse OCR text into structured fields
 */
class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY || '';
    this.enabled = !!this.apiKey;
    this.client = this.enabled ? new GoogleGenerativeAI(this.apiKey) : null;
    // Allow overriding the model by env; default to a widely supported identifier
    this.modelId = (process.env.GEMINI_MODEL || 'gemini-1.5-flash-001').trim();
    // Realtime/live models (e.g., gemini-2.0-flash-live) are not supported via generateContent.
    // If requested, fallback to the closest non-live variant.
    if (/\-live$/i.test(this.modelId)) {
      const fallback = this.modelId.replace(/\-live$/i, '');
      console.warn(`[GeminiService] '${this.modelId}' is a realtime model not supported by generateContent. Falling back to '${fallback}'.`);
      this.modelId = fallback;
    }
  }

  /**
   * Ask Gemini to extract driver license fields from raw OCR.
   * @param {string} rawText
   * @returns {Promise<{firstName?:string,lastName?:string,birthDate?:string,idNumber?:string, confidence?: number}>}
   */
  async extractDriverLicense(rawText) {
    if (!this.enabled) {
      return { error: 'Gemini API key not configured', disabled: true };
    }
    if (!rawText || !rawText.trim()) return { firstName: undefined, lastName: undefined, birthDate: undefined, idNumber: undefined, confidence: 0 };

    // Use a JSON-only response to simplify parsing
    const system = [
      'You are an information extraction engine for Philippine Driver\'s Licenses.',
      'Given noisy OCR text, return a single JSON object with these keys:',
      '{"firstName": string | null, "lastName": string | null, "birthDate": string | null, "idNumber": string | null, "confidence": number}',
      'Rules:',
      '- birthDate must be ISO date: YYYY-MM-DD if month/day are known; otherwise null.',
      '- idNumber must follow 3-2-6 pattern XXX-XX-XXXXXX if derivable; else null.',
      "- If multiple candidates, choose the most plausible based on labels (e.g., 'Surname', 'First Name', 'DOB', 'Birth Date', 'DLN', 'License No').",
      '- Respond with ONLY the compact JSON object. No code blocks, no prose.'
    ].join('\n');

    const user = `OCR TEXT START\n${rawText}\nOCR TEXT END`;

    try {
      // Helpers to normalize AI output
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
        if (!s) return undefined;
        const str = String(s).trim();
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
        return undefined;
      };
      const normalizeDLId = (s) => {
        if (!s) return undefined;
        const str = String(s).toUpperCase().trim();
        // If already hyphenated correctly
        let m = str.match(/^([A-Z0-9]{3})-([A-Z0-9]{2})-([A-Z0-9]{6})$/);
        if (m) return `${m[1]}-${m[2]}-${m[3]}`;
        // Try plain 11 alnum
        const alnum = str.replace(/[^A-Z0-9]/g, '');
        if (alnum.length >= 11) {
          const core = alnum.slice(0, 11);
          const a = core.slice(0, 3), b = core.slice(3, 5), c = core.slice(5, 11);
          if (/^[A-Z0-9]{3}$/.test(a) && /^[A-Z0-9]{2}$/.test(b) && /^[A-Z0-9]{6}$/.test(c)) {
            return `${a}-${b}-${c}`;
          }
        }
        // Try near-hyphenated variants
        m = str.match(/^([A-Z0-9]{3})[^A-Z0-9]?([A-Z0-9]{2})[^A-Z0-9]?([A-Z0-9]{6})$/);
        if (m) return `${m[1]}-${m[2]}-${m[3]}`;
        return undefined;
      };

      const model = this.client.getGenerativeModel({
        model: this.modelId,
        systemInstruction: system
      });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: user }]}],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
      });
      const text = result?.response?.text?.() || '';
      const trimmed = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/,'').trim();
      let parsed;
      try {
        parsed = JSON.parse(trimmed);
      } catch (e) {
        // Attempt to salvage JSON within text
        const match = trimmed.match(/\{[\s\S]*\}/);
        if (match) {
          parsed = JSON.parse(match[0]);
        } else {
          throw e;
        }
      }
      // Normalize outputs
      const firstName = typeof parsed.firstName === 'string' ? parsed.firstName.trim() || undefined : undefined;
      const lastName = typeof parsed.lastName === 'string' ? parsed.lastName.trim() || undefined : undefined;
      const birthDate = typeof parsed.birthDate === 'string' ? (normalizeDate(parsed.birthDate) || undefined) : undefined;
      const idNumber = typeof parsed.idNumber === 'string' ? (normalizeDLId(parsed.idNumber) || undefined) : undefined;
      const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : undefined;
      return { firstName, lastName, birthDate, idNumber, confidence, rawText: text };
    } catch (err) {
      const msg = err?.message || String(err);
      console.error('[GeminiService] extractDriverLicense error:', msg);
      return { error: 'Gemini parsing failed', details: msg };
    }
  }

  /**
   * Ask Gemini to extract National ID fields from raw OCR.
   * @param {string} rawText
   * @returns {Promise<{firstName?:string,lastName?:string,birthDate?:string,idNumber?:string, confidence?: number}>}
   */
  async extractNationalID(rawText) {
    if (!this.enabled) {
      return { error: 'Gemini API key not configured', disabled: true };
    }
    if (!rawText || !rawText.trim()) return { firstName: undefined, lastName: undefined, birthDate: undefined, idNumber: undefined, confidence: 0 };

    const system = [
      'You are an information extraction engine for the Philippine National ID (PhilSys / Philippine Identification Card).',
      'Given noisy OCR text, return a single JSON object with these keys:',
      '{"firstName": string | null, "lastName": string | null, "birthDate": string | null, "idNumber": string | null, "confidence": number}',
      'Rules:',
      '- birthDate must be ISO date: YYYY-MM-DD if month/day are known; otherwise null.',
      "- idNumber should be 16 digits formatted as 'XXXX-XXXX-XXXX-XXXX' if derivable (accept variants with spaces/hyphens or inline digits); else null.",
      "- Prefer labels like 'Philippine Identification Card', 'PhilSys', 'PSN', 'Philippine ID', 'PIN', 'Surname', 'Given Names', 'Date of Birth'.",
      '- Respond with ONLY the compact JSON object. No code blocks, no prose.'
    ].join('\n');

    const user = `OCR TEXT START\n${rawText}\nOCR TEXT END`;

    try {
      const monthToNumber = (name) => {
        const map = { jan:'01', january:'01', feb:'02', february:'02', mar:'03', march:'03', apr:'04', april:'04', may:'05', jun:'06', june:'06', jul:'07', july:'07', aug:'08', august:'08', sep:'09', sept:'09', september:'09', oct:'10', october:'10', nov:'11', november:'11', dec:'12', december:'12' };
        const key = String(name || '').toLowerCase().slice(0, 9);
        return map[key] || map[key.slice(0, 3)] || null;
      };
      const normalizeDate = (s) => {
        if (!s) return undefined;
        const str = String(s).trim();
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
        return undefined;
      };
      const normalizeNatId = (s) => {
        if (!s) return undefined;
        const str = String(s).toUpperCase().trim();
        // If already hyphenated properly
        let m = str.match(/^(\d{4})-(\d{4})-(\d{4})-(\d{4})$/);
        if (m) return `${m[1]}-${m[2]}-${m[3]}-${m[4]}`;
        // Strip non-digits and reformat first 16 digits
        const digits = str.replace(/[^0-9]/g, '');
        if (digits.length >= 16) {
          const d = digits.slice(0, 16);
          return `${d.slice(0,4)}-${d.slice(4,8)}-${d.slice(8,12)}-${d.slice(12,16)}`;
        }
        // Accept spaced/hyphen mixed tokens
        m = str.match(/^(\d{4})[^0-9]?(\d{4})[^0-9]?(\d{4})[^0-9]?(\d{4})$/);
        if (m) return `${m[1]}-${m[2]}-${m[3]}-${m[4]}`;
        return undefined;
      };

      const model = this.client.getGenerativeModel({
        model: this.modelId,
        systemInstruction: system
      });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: user }]}],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
      });
      const text = result?.response?.text?.() || '';
      const trimmed = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/,'').trim();
      let parsed;
      try {
        parsed = JSON.parse(trimmed);
      } catch (e) {
        const match = trimmed.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]); else throw e;
      }

      const firstName = typeof parsed.firstName === 'string' ? parsed.firstName.trim() || undefined : undefined;
      const lastName = typeof parsed.lastName === 'string' ? parsed.lastName.trim() || undefined : undefined;
      const birthDate = typeof parsed.birthDate === 'string' ? (normalizeDate(parsed.birthDate) || undefined) : undefined;
      const idNumber = typeof parsed.idNumber === 'string' ? (normalizeNatId(parsed.idNumber) || undefined) : undefined;
      const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : undefined;
      return { firstName, lastName, birthDate, idNumber, confidence, rawText: text };
    } catch (err) {
      const msg = err?.message || String(err);
      console.error('[GeminiService] extractNationalID error:', msg);
      return { error: 'Gemini parsing failed', details: msg };
    }
  }

  /**
   * Ask Gemini to extract PhilHealth fields from raw OCR.
   * @param {string} rawText
   * @returns {Promise<{firstName?:string,lastName?:string,birthDate?:string,idNumber?:string, confidence?: number}>}
   */
  async extractPhilHealth(rawText) {
    if (!this.enabled) {
      return { error: 'Gemini API key not configured', disabled: true };
    }
    if (!rawText || !rawText.trim()) return { firstName: undefined, lastName: undefined, birthDate: undefined, idNumber: undefined, confidence: 0 };

    const system = [
      'You are an information extraction engine for Philippine PhilHealth ID cards.',
      'Given noisy OCR text, return a single JSON object with these keys:',
      '{"firstName": string | null, "lastName": string | null, "birthDate": string | null, "idNumber": string | null, "confidence": number}',
      'Rules:',
      '- birthDate must be ISO date: YYYY-MM-DD if month/day are known; otherwise null.',
      '- idNumber must be in 2-9-1 digit pattern with hyphens: XX-XXXXXXXXX-X if derivable; else null.',
      "- If multiple candidates, choose the most plausible based on labels (e.g., 'PhilHealth', 'PHIC', 'HPN', 'First Name', 'Last Name', 'Birth Date').",
      '- Respond with ONLY the compact JSON object. No code blocks, no prose.'
    ].join('\n');

    const user = `OCR TEXT START\n${rawText}\nOCR TEXT END`;

    try {
      const monthToNumber = (name) => {
        const map = { jan:'01', january:'01', feb:'02', february:'02', mar:'03', march:'03', apr:'04', april:'04', may:'05', jun:'06', june:'06', jul:'07', july:'07', aug:'08', august:'08', sep:'09', sept:'09', september:'09', oct:'10', october:'10', nov:'11', november:'11', dec:'12', december:'12' };
        const key = String(name || '').toLowerCase().slice(0, 9);
        return map[key] || map[key.slice(0, 3)] || null;
      };
      const normalizeDate = (s) => {
        if (!s) return undefined;
        const str = String(s).trim();
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
        return undefined;
      };
      const normalizePHId = (s) => {
        if (!s) return undefined;
        const digits = String(s).replace(/[^0-9]/g, '');
        if (digits.length >= 12) {
          const core = digits.slice(0, 12);
          const a = core.slice(0, 2), b = core.slice(2, 11), c = core.slice(11, 12);
          if (/^\d{2}$/.test(a) && /^\d{9}$/.test(b) && /^\d{1}$/.test(c)) return `${a}-${b}-${c}`;
        }
        const m = String(s).match(/\b(\d{2})-(\d{9})-(\d)\b/);
        if (m) return `${m[1]}-${m[2]}-${m[3]}`;
        return undefined;
      };

      const model = this.client.getGenerativeModel({
        model: this.modelId,
        systemInstruction: system
      });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: user }]}],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
      });
      const text = result?.response?.text?.() || '';
      const trimmed = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/,'').trim();
      let parsed;
      try {
        parsed = JSON.parse(trimmed);
      } catch (e) {
        const match = trimmed.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]); else throw e;
      }

      const firstName = typeof parsed.firstName === 'string' ? parsed.firstName.trim() || undefined : undefined;
      const lastName = typeof parsed.lastName === 'string' ? parsed.lastName.trim() || undefined : undefined;
      const birthDate = typeof parsed.birthDate === 'string' ? (normalizeDate(parsed.birthDate) || undefined) : undefined;
      const idNumber = typeof parsed.idNumber === 'string' ? (normalizePHId(parsed.idNumber) || undefined) : undefined;
      const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : undefined;
      return { firstName, lastName, birthDate, idNumber, confidence, rawText: text };
    } catch (err) {
      const msg = err?.message || String(err);
      console.error('[GeminiService] extractPhilHealth error:', msg);
      return { error: 'Gemini parsing failed', details: msg };
    }
  }

  /**
   * Ask Gemini to extract UMID fields from raw OCR.
   * @param {string} rawText
   * @returns {Promise<{firstName?:string,lastName?:string,birthDate?:string,idNumber?:string, confidence?: number}>}
   */
  async extractUMID(rawText) {
    if (!this.enabled) {
      return { error: 'Gemini API key not configured', disabled: true };
    }
    if (!rawText || !rawText.trim()) return { firstName: undefined, lastName: undefined, birthDate: undefined, idNumber: undefined, confidence: 0 };

    const system = [
      'You are an information extraction engine for Philippine UMID (Unified Multi-Purpose ID) cards.',
      'Given noisy OCR text, return a single JSON object with these keys:',
      '{"firstName": string | null, "lastName": string | null, "birthDate": string | null, "idNumber": string | null, "confidence": number}',
      'Rules:',
      '- birthDate must be ISO date: YYYY-MM-DD if month/day are known; otherwise null.',
      "- idNumber must be a CRN formatted as 'CRN-XXXX-XXXXXXX-X' (4-7-1 digits) if derivable; else null.",
      "- Prefer labels such as 'CRN', 'Surname', 'First Name', 'Birth Date'.",
      '- Respond with ONLY the compact JSON object. No code blocks, no prose.'
    ].join('\n');

    const user = `OCR TEXT START\n${rawText}\nOCR TEXT END`;

    try {
      const monthToNumber = (name) => {
        const map = { jan:'01', january:'01', feb:'02', february:'02', mar:'03', march:'03', apr:'04', april:'04', may:'05', jun:'06', june:'06', jul:'07', july:'07', aug:'08', august:'08', sep:'09', sept:'09', september:'09', oct:'10', october:'10', nov:'11', november:'11', dec:'12', december:'12' };
        const key = String(name || '').toLowerCase().slice(0, 9);
        return map[key] || map[key.slice(0, 3)] || null;
      };
      const normalizeDate = (s) => {
        if (!s) return undefined;
        const str = String(s).trim();
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
        return undefined;
      };
      const normalizeUMID = (s) => {
        if (!s) return undefined;
        const str = String(s).toUpperCase().trim();
        // Accept with or without CRN prefix and with spaces/hyphens
        let m = str.match(/^(?:CRN[\s\-]*)?(\d{4})[^0-9]?(\d{7})[^0-9]?(\d)$/);
        if (m) return `CRN-${m[1]}-${m[2]}-${m[3]}`;
        const digits = str.replace(/[^0-9]/g, '');
        if (digits.length >= 12) {
          const core = digits.slice(0, 12);
          const a = core.slice(0, 4), b = core.slice(4, 11), c = core.slice(11, 12);
          if (/^\d{4}$/.test(a) && /^\d{7}$/.test(b) && /^\d{1}$/.test(c)) return `CRN-${a}-${b}-${c}`;
        }
        return undefined;
      };

      const model = this.client.getGenerativeModel({
        model: this.modelId,
        systemInstruction: system
      });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: user }]}],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
      });
      const text = result?.response?.text?.() || '';
      const trimmed = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/,'').trim();
      let parsed;
      try {
        parsed = JSON.parse(trimmed);
      } catch (e) {
        const match = trimmed.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]); else throw e;
      }

      const firstName = typeof parsed.firstName === 'string' ? parsed.firstName.trim() || undefined : undefined;
      const lastName = typeof parsed.lastName === 'string' ? parsed.lastName.trim() || undefined : undefined;
      const birthDate = typeof parsed.birthDate === 'string' ? (normalizeDate(parsed.birthDate) || undefined) : undefined;
      const idNumber = typeof parsed.idNumber === 'string' ? (normalizeUMID(parsed.idNumber) || undefined) : undefined;
      const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : undefined;
      return { firstName, lastName, birthDate, idNumber, confidence, rawText: text };
    } catch (err) {
      const msg = err?.message || String(err);
      console.error('[GeminiService] extractUMID error:', msg);
      return { error: 'Gemini parsing failed', details: msg };
    }
  }

  /**
   * Ask Gemini to extract Passport fields from raw OCR.
   * @param {string} rawText
   * @returns {Promise<{firstName?:string,lastName?:string,birthDate?:string,idNumber?:string, confidence?: number}>}
   */
  async extractPassport(rawText) {
    if (!this.enabled) {
      return { error: 'Gemini API key not configured', disabled: true };
    }
    if (!rawText || !rawText.trim()) return { firstName: undefined, lastName: undefined, birthDate: undefined, idNumber: undefined, confidence: 0 };

    const system = [
      'You are an information extraction engine for passports (Philippines).',
      'Given noisy OCR text (may include MRZ-like lines with PHL markers), return a single JSON object with these keys:',
      '{"firstName": string | null, "lastName": string | null, "birthDate": string | null, "idNumber": string | null, "confidence": number}',
      'Rules:',
      '- birthDate must be ISO date: YYYY-MM-DD if month/day are known; otherwise null.',
      "- idNumber should be the passport number (usually 8-9 uppercase alphanumerics). If you see 'PHL' in an MRZ-like token (e.g., ABC123456PHL), take the prefix before 'PHL'. Remove separators like '<' and spaces.",
      "- Prefer labels like 'Surname', 'Names', 'Given Names', 'Birth', 'Passport', 'No.'.",
      '- Respond with ONLY the compact JSON object. No code blocks, no prose.'
    ].join('\n');

    const user = `OCR TEXT START\n${rawText}\nOCR TEXT END`;

    try {
      const monthToNumber = (name) => {
        const map = { jan:'01', january:'01', feb:'02', february:'02', mar:'03', march:'03', apr:'04', april:'04', may:'05', jun:'06', june:'06', jul:'07', july:'07', aug:'08', august:'08', sep:'09', sept:'09', september:'09', oct:'10', october:'10', nov:'11', november:'11', dec:'12', december:'12' };
        const key = String(name || '').toLowerCase().slice(0, 9);
        return map[key] || map[key.slice(0, 3)] || null;
      };
      const normalizeDate = (s) => {
        if (!s) return undefined;
        const str = String(s).trim();
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
        return undefined;
      };
      const normalizePassportId = (s) => {
        if (!s) return undefined;
        let str = String(s).toUpperCase().trim();
        // MRZ-like cleanup
        str = str.replace(/</g, '').replace(/\s+/g, '');
        if (str.includes('PHL')) str = str.split('PHL')[0];
        // Remove non-alnum and pick a plausible 8-10 alnum token (prefer 9)
        str = str.replace(/[^A-Z0-9]/g, '');
        const tokens = str.match(/[A-Z0-9]{8,10}/g) || [];
        if (tokens.length === 0) return undefined;
        // prefer length 9, else 8 or 10
        const pick = tokens.find(t => t.length === 9) || tokens.find(t => t.length === 8) || tokens[0];
        return pick || undefined;
      };

      const model = this.client.getGenerativeModel({
        model: this.modelId,
        systemInstruction: system
      });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: user }]}],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
      });
      const text = result?.response?.text?.() || '';
      const trimmed = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/,'').trim();
      let parsed;
      try {
        parsed = JSON.parse(trimmed);
      } catch (e) {
        const match = trimmed.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]); else throw e;
      }

      const firstName = typeof parsed.firstName === 'string' ? parsed.firstName.trim() || undefined : undefined;
      const lastName = typeof parsed.lastName === 'string' ? parsed.lastName.trim() || undefined : undefined;
      const birthDate = typeof parsed.birthDate === 'string' ? (normalizeDate(parsed.birthDate) || undefined) : undefined;
      const idNumber = typeof parsed.idNumber === 'string' ? (normalizePassportId(parsed.idNumber) || undefined) : undefined;
      const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : undefined;
      return { firstName, lastName, birthDate, idNumber, confidence, rawText: text };
    } catch (err) {
      const msg = err?.message || String(err);
      console.error('[GeminiService] extractPassport error:', msg);
      return { error: 'Gemini parsing failed', details: msg };
    }
  }

  /**
   * Ask Gemini to extract TIN (Tax Identification) ID fields from raw OCR.
   * Philippines TIN commonly uses 3-3-3 (9 digits) or 3-3-3-3 (with branch code) formatting.
   * @param {string} rawText
   */
  async extractTINID(rawText) {
    if (!this.enabled) {
      return { error: 'Gemini API key not configured', disabled: true };
    }
    if (!rawText || !rawText.trim()) return { firstName: undefined, lastName: undefined, birthDate: undefined, idNumber: undefined, confidence: 0 };

    const system = [
      'You are an information extraction engine for Philippine Tax Identification (TIN) cards.',
      'Given noisy OCR text, return a single JSON object with these keys:',
      '{"firstName": string | null, "lastName": string | null, "birthDate": string | null, "idNumber": string | null, "confidence": number}',
      'Rules:',
      "- idNumber should be the TIN number exactly as it appears. Common formats are 9 digits (XXX-XXX-XXX) or 12 digits (XXX-XXX-XXX-XXX), but accept any length.",
      "- Accept labels like 'TIN', 'Tax Identification Number', 'Taxpayer Identification Number'.",
      '- birthDate must be ISO date: YYYY-MM-DD if month/day are known; otherwise null.',
      "- Extract 'Surname' and 'First/Given Name(s)' when available.",
      '- Respond with ONLY the compact JSON object. No code blocks, no prose.'
    ].join('\n');

    const user = `OCR TEXT START\n${rawText}\nOCR TEXT END`;

    try {
      const monthToNumber = (name) => {
        const map = { jan:'01', january:'01', feb:'02', february:'02', mar:'03', march:'03', apr:'04', april:'04', may:'05', jun:'06', june:'06', jul:'07', july:'07', aug:'08', august:'08', sep:'09', sept:'09', september:'09', oct:'10', october:'10', nov:'11', november:'11', dec:'12', december:'12' };
        const key = String(name || '').toLowerCase().slice(0, 9);
        return map[key] || map[key.slice(0, 3)] || null;
      };
      const normalizeDate = (s) => {
        if (!s) return undefined;
        const str = String(s).trim();
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
        return undefined;
      };
      const normalizeTIN = (s) => {
        if (!s) return undefined;
        // Accept whatever format AI returns; just clean up obvious separators and spacing
        const str = String(s).trim();
        // If already formatted, keep it
        if (/^\d{3}-\d{3}-\d{3}(-\d+)?$/.test(str)) return str;
        // Otherwise, return digits as-is without forcing length limits
        const digits = str.replace(/[^0-9]/g, '');
        if (!digits) return undefined;
        // Format common patterns: 9 or 12+ digits
        if (digits.length === 12) {
          return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6,9)}-${digits.slice(9,12)}`;
        }
        if (digits.length === 9) {
          return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6,9)}`;
        }
        // For any other length, return raw digits without forcing format
        return digits;
      };

      const model = this.client.getGenerativeModel({
        model: this.modelId,
        systemInstruction: system
      });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: user }]}],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
      });
      const text = result?.response?.text?.() || '';
      const trimmed = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/,'').trim();
      let parsed;
      try {
        parsed = JSON.parse(trimmed);
      } catch (e) {
        const match = trimmed.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]); else throw e;
      }

      const firstName = typeof parsed.firstName === 'string' ? parsed.firstName.trim() || undefined : undefined;
      const lastName = typeof parsed.lastName === 'string' ? parsed.lastName.trim() || undefined : undefined;
      const birthDate = typeof parsed.birthDate === 'string' ? (normalizeDate(parsed.birthDate) || undefined) : undefined;
      const idNumber = typeof parsed.idNumber === 'string' ? (normalizeTIN(parsed.idNumber) || undefined) : undefined;
      const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : undefined;
      return { firstName, lastName, birthDate, idNumber, confidence, rawText: text };
    } catch (err) {
      const msg = err?.message || String(err);
      console.error('[GeminiService] extractTINID error:', msg);
      return { error: 'Gemini parsing failed', details: msg };
    }
  }
}

export default GeminiService;
