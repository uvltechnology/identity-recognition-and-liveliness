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
    // Debug logging enabled by GEMINI_DEBUG=true or any non-production NODE_ENV
    this.debug = String(process.env.GEMINI_DEBUG || '').toLowerCase() === 'true' || (process.env.NODE_ENV !== 'production');
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
      // Helpers
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
      // Single-call runner to a specific model id
      const runOnce = async (modelId) => {
        const model = this.client.getGenerativeModel({
          model: modelId,
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
        const any = firstName || lastName || birthDate || idNumber;
        return { firstName, lastName, birthDate, idNumber, confidence, rawText: text, any, modelId };
      };

      // Try primary model then safe fallbacks
      const tried = new Set();
      const candidates = [this.modelId, 'gemini-1.5-flash', 'gemini-1.5-flash-001', 'gemini-1.0-pro'];
      const errors = [];
      for (const m of candidates) {
        if (!m || tried.has(m)) continue;
        tried.add(m);
        try {
          const out = await runOnce(m);
          if (out.any) {
            return { firstName: out.firstName, lastName: out.lastName, birthDate: out.birthDate, idNumber: out.idNumber, confidence: out.confidence, rawText: out.rawText, modelUsed: m };
          }
          // If empty result, keep last one but continue trying
          var lastEmpty = out;
        } catch (e) {
          errors.push(`${m}: ${e?.message || String(e)}`);
          continue;
        }
      }
      // Return the last empty (if any) or a structured error
      if (typeof lastEmpty !== 'undefined') {
        return { firstName: lastEmpty.firstName, lastName: lastEmpty.lastName, birthDate: lastEmpty.birthDate, idNumber: lastEmpty.idNumber, confidence: lastEmpty.confidence, rawText: lastEmpty.rawText, modelUsed: lastEmpty.modelId };
      }
      return { error: 'Gemini parsing failed', details: errors.join(' | ') || 'No models produced output' };
    } catch (err) {
      const msg = err?.message || String(err);
      console.error('[GeminiService] extractTINID error:', msg);
      return { error: 'Gemini parsing failed', details: msg };
    }
  }

  /**
   * Ask Gemini to extract Postal ID fields from raw OCR.
   * @param {string} rawText
   * @returns {Promise<{firstName?:string,lastName?:string,birthDate?:string,idNumber?:string, confidence?: number}>}
   */
  async extractPostalID(rawText) {
    if (!this.enabled) {
      return { error: 'Gemini API key not configured', disabled: true };
    }
    if (!rawText || !rawText.trim()) return { firstName: undefined, lastName: undefined, birthDate: undefined, idNumber: undefined, confidence: 0 };
    if (this.debug) {
      const preview = String(rawText).slice(0, 120).replace(/\s+/g, ' ');
      console.log(`[GeminiService][Postal] Start parse. modelId=${this.modelId} textLen=${rawText.length} preview="${preview}"`);
    }

    const system = [
      'You are an information extraction engine for Philippine Postal ID cards.',
      'Given noisy OCR text, return a single JSON object with these keys:',
      '{"firstName": string | null, "lastName": string | null, "birthDate": string | null, "idNumber": string | null, "confidence": number}',
      'Rules:',
      '- birthDate must be ISO date: YYYY-MM-DD if month/day are known; otherwise null.',
      "- idNumber should prefer a standalone 12-character uppercase alphanumeric token if present (letters+digits, no spaces); otherwise the best available Postal/Card/ID No.",
      "- Prefer labels like 'Surname', 'First Name'/'Given Names', 'Birth'/'Birth Date'/'DOB', 'Postal ID', 'ID No', 'Card No'.",
      "- If you see a 'Name:' line formatted as 'LAST, FIRST ...', return lastName and firstName accordingly.",
      "- When ambiguous, cap firstName to the first word only (drop suffixes like Jr., Sr., II, III).",
      '- Respond with ONLY the compact JSON object. No code blocks, no prose.'
    ].join('\n');

    // A slightly more prescriptive variant that nudges the model with patterns
    const systemAlt = [
      'You extract fields from Philippine Postal ID OCR text into JSON.',
      'Return exactly one JSON object with keys: {"firstName","lastName","birthDate","idNumber","confidence"}.',
      'Guidance:',
      '- Name cues: Surname|Last Name -> lastName; Given Names|First Name -> firstName; Name: LAST, FIRST -> split by comma.',
      '- Birth date cues: Birth|Birth Date|DOB|Date of Birth -> parse to YYYY-MM-DD (supports 12 Mar 1990, 12/03/1990, 03/12/1990, 1990-03-12).',
      '- idNumber cues: Postal ID|ID No|Card No|ID Number. Prefer a 12-char A-Z0-9 token with no spaces. If multiple, pick the most plausible.',
      '- firstName should be a single word (drop suffixes like Jr., Sr., II, III).',
      'Output only compact JSON. No extra text.'
    ].join('\n');

    const user = `OCR TEXT START\n${rawText}\nOCR TEXT END`;

    try {
      const monthToNumber = (name) => {
        const map = { jan:'01', january:'01', feb:'02', february:'02', mar:'03', march:'03', apr:'04', april:'04', may:'05', jun:'06', june:'06', jul:'07', july:'07', aug:'08', august:'08', sep:'09', sept:'09', september:'09', oct:'10', october:'10', nov:'11', november:'11', dec:'12', december:'12' };
        const key = String(name || '').toLowerCase().slice(0, 9);
        return map[key] || map[key.slice(0, 3)] || null;
      };
      const expandYear2 = (yy) => {
        const n = parseInt(String(yy || ''), 10);
        if (Number.isNaN(n)) return undefined;
        const pivot = 30; // 00-29 -> 2000s, 30-99 -> 1900s
        return String(n >= pivot ? 1900 + n : 2000 + n);
      };
      const normalizeDate = (s) => {
        if (!s) return undefined;
        const str = String(s).trim();
        let m = str.match(/\b(20\d{2}|19\d{2})[-\/.](0[1-9]|1[0-2])[-\/.](0[1-9]|[12]\d|3[01])\b/);
        if (m) return `${m[1]}-${m[2]}-${m[3]}`;
        m = str.match(/\b(0[1-9]|[12]\d|3[01])[\/-](0[1-9]|1[0-2])[\/-]((?:19|20)\d{2})\b/);
        if (m) return `${m[3]}-${m[2]}-${m[1]}`;
        m = str.match(/\b(0[1-9]|1[0-2])[\/-](0[1-9]|[12]\d|3[01])[\/-]((?:19|20)\d{2})\b/);
        if (m) return `${m[3]}-${m[1]}-${m[2]}`;
        m = str.match(/\b(0?[1-9]|[12]\d|3[01])\s*(?:[-\/.\u2013\u2014]?|\s)\s*([A-Za-z]{3,})\s*(?:[-\/.\u2013\u2014]?|\s)\s*((?:19|20)\d{2})\b/);
        if (m) {
          const day = String(m[1]).padStart(2, '0');
          const month = monthToNumber(m[2]);
          if (month) return `${m[3]}-${month}-${day}`;
        }
        m = str.match(/\b([A-Za-z]{3,})\s+(0?[1-9]|[12]\d|3[01]),?\s+((?:19|20)\d{2})\b/);
        if (m) {
          const day = String(m[2]).padStart(2, '0');
          const month = monthToNumber(m[1]);
          if (month) return `${m[3]}-${month}-${day}`;
        }
        // two-digit years
        m = str.match(/\b(0?[1-9]|[12]\d|3[01])[\/-](0[1-9]|1[0-2])[\/-](\d{2})\b/);
        if (m) {
          const y = expandYear2(m[3]);
          if (y) return `${y}-${m[2]}-${String(m[1]).padStart(2, '0')}`;
        }
        m = str.match(/\b(0[1-9]|1[0-2])[\/-](0?[1-9]|[12]\d|3[01])[\/-](\d{2})\b/);
        if (m) {
          const y = expandYear2(m[3]);
          if (y) return `${y}-${m[1]}-${String(m[2]).padStart(2, '0')}`;
        }
        m = str.match(/\b(0?[1-9]|[12]\d|3[01])\s*(?:[-\/.\u2013\u2014]?|\s)\s*([A-Za-z]{3,})\s*(?:[-\/.\u2013\u2014]?|\s)\s*(\d{2})\b/);
        if (m) {
          const day = String(m[1]).padStart(2, '0');
          const month = monthToNumber(m[2]);
          const y = expandYear2(m[3]);
          if (month && y) return `${y}-${month}-${day}`;
        }
        m = str.match(/\b([A-Za-z]{3,})\s+(0?[1-9]|[12]\d|3[01]),?\s+(\d{2})\b/);
        if (m) {
          const day = String(m[2]).padStart(2, '0');
          const month = monthToNumber(m[1]);
          const y = expandYear2(m[3]);
          if (month && y) return `${y}-${month}-${day}`;
        }
        return undefined;
      };
      const normalizePostalId = (s) => {
        if (!s) return undefined;
        const upper = String(s).toUpperCase();
        // If there is a 12-char alnum token, prefer it
        const twelve = upper.match(/\b([A-Z0-9]{12})\b/);
        if (twelve) return twelve[1];
        // Else clean to alnum/hyphen and accept if length >= 6
        const cleaned = upper.replace(/[^A-Z0-9\-]/g, '');
        if (cleaned.length >= 6) return cleaned;
        return undefined;
      };

      // Helper to coerce alternative keys if model uses synonyms
      const coerceKeys = (obj) => {
        const get = (o, candidates) => {
          for (const k of candidates) {
            if (o && typeof o[k] === 'string' && o[k].trim()) return o[k];
          }
          return undefined;
        };
        const out = { ...obj };
        if (!out.firstName) out.firstName = get(obj, ['first_name','givenName','given_name','givenNames','given_names','names','name_first','fname']);
        if (!out.lastName) out.lastName = get(obj, ['last_name','surname','familyName','family_name','name_last','lname']);
        if (!out.birthDate) out.birthDate = get(obj, ['dob','dateOfBirth','date_of_birth','birth','birth_date']);
        if (!out.idNumber) out.idNumber = get(obj, ['postalId','postal_id','id','id_no','idNo','cardNo','card_no','number','idNumber']);
        return out;
      };

      // Single-call runner to a specific model id
      const runOnce = async (modelId, variantLabel = 'v1') => {
        if (this.debug) console.log(`[GeminiService][Postal] Trying model=${modelId} variant=${variantLabel}`);
        const model = this.client.getGenerativeModel({
          model: modelId,
          systemInstruction: variantLabel === 'v1' ? system : systemAlt
        });
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: user }]}],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
        });
        const text = result?.response?.text?.() || '';
        if (this.debug) console.log(`[GeminiService][Postal] Raw response length=${text.length}`);
        const trimmed = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/,'').trim();
        let parsed;
        try {
          parsed = JSON.parse(trimmed);
        } catch (e) {
          const match = trimmed.match(/\{[\s\S]*\}/);
          if (match) parsed = JSON.parse(match[0]); else throw e;
        }

        // Tolerant key mapping
        parsed = coerceKeys(parsed || {});
        const firstNameRaw = typeof parsed.firstName === 'string' ? parsed.firstName.trim() : undefined;
        const lastNameRaw = typeof parsed.lastName === 'string' ? parsed.lastName.trim() : undefined;
        // Cap first name to first token and drop common suffixes
        const trimSuffix = (name) => {
          if (!name) return undefined;
          let t = name.split(/\s+/).filter(Boolean);
          if (t.length > 0) t = [t[0]]; // cap to 1 word
          let joined = t.join(' ');
          joined = joined.replace(/\b(jr\.?|sr\.?|ii|iii|iv|v)\b$/i, '').trim();
          return joined || undefined;
        };
        const firstName = trimSuffix(firstNameRaw);
        const lastName = lastNameRaw || undefined;
        const birthDate = typeof parsed.birthDate === 'string' ? (normalizeDate(parsed.birthDate) || undefined) : undefined;
        const idNumber = typeof parsed.idNumber === 'string' ? (normalizePostalId(parsed.idNumber) || undefined) : undefined;
        const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : undefined;
        const any = firstName || lastName || birthDate || idNumber;
        if (this.debug) console.log('[GeminiService][Postal] Parsed attempt:', { firstName, lastName, birthDate, idNumber, confidence, any, modelId: `${modelId}#${variantLabel}` });
        return { firstName, lastName, birthDate, idNumber, confidence, rawText: text, any, modelId: `${modelId}#${variantLabel}` };
      };

      // Try primary model then safe fallbacks
      const tried = new Set();
      // Try each model with two prompt variants (v1, v2)
      const baseModels = [this.modelId, 'gemini-1.5-flash', 'gemini-1.5-flash-001', 'gemini-1.0-pro'];
      const candidates = [];
      for (const m of baseModels) {
        if (!m) continue;
        candidates.push([m, 'v1']);
        candidates.push([m, 'v2']);
      }
      const errors = [];
      for (const [m, variant] of candidates) {
        if (!m) continue;
        const key = `${m}#${variant}`;
        if (tried.has(key)) continue;
        tried.add(key);
        try {
          const out = await runOnce(m, variant);
          if (out.any) {
            if (this.debug) console.log(`[GeminiService][Postal] Success via ${out.modelId}`);
            return { firstName: out.firstName, lastName: out.lastName, birthDate: out.birthDate, idNumber: out.idNumber, confidence: out.confidence, rawText: out.rawText, modelUsed: out.modelId };
          }
          // If empty result, keep last one but continue trying
          var lastEmpty = out;
        } catch (e) {
          errors.push(`${key}: ${e?.message || String(e)}`);
          if (this.debug) console.warn(`[GeminiService][Postal] Error with ${key}:`, e?.message || e);
          continue;
        }
      }
      // Return the last empty (if any) or a structured error
      if (typeof lastEmpty !== 'undefined') {
        if (this.debug) console.warn('[GeminiService][Postal] All attempts produced empty results. Returning last empty.');
        return { firstName: lastEmpty.firstName, lastName: lastEmpty.lastName, birthDate: lastEmpty.birthDate, idNumber: lastEmpty.idNumber, confidence: lastEmpty.confidence, rawText: lastEmpty.rawText, modelUsed: lastEmpty.modelId };
      }
      return { error: 'Gemini parsing failed', details: errors.join(' | ') || 'No models produced output' };
    } catch (err) {
      const msg = err?.message || String(err);
      console.error('[GeminiService] extractPostalID error:', msg);
      return { error: 'Gemini parsing failed', details: msg };
    }
  }

  /**
   * Ask Gemini to extract Pag-IBIG (HDMF) ID fields from raw OCR.
   * ID number (MID) preferred format: 0000-0000-0000 (4-4-4 digits).
   * @param {string} rawText
   * @returns {Promise<{firstName?:string,lastName?:string,birthDate?:string,idNumber?:string, confidence?: number, modelUsed?: string, rawText?: string, error?: string, details?: string, disabled?: boolean}>}
   */
  async extractPagibigID(rawText) {
    if (!this.enabled) {
      return { error: 'Gemini API key not configured', disabled: true };
    }
    if (!rawText || !rawText.trim()) return { firstName: undefined, lastName: undefined, birthDate: undefined, idNumber: undefined, confidence: 0 };

    // Two prompt variants to increase reliability
    const system = [
      'You are an information extraction engine for the Philippine Pag-IBIG (HDMF) ID card.',
      'Given noisy OCR text, return a single JSON object with these keys:',
      '{"firstName": string | null, "lastName": string | null, "birthDate": string | null, "idNumber": string | null, "confidence": number}',
      'Rules:',
      "- idNumber should be the member ID (MID) in '0000-0000-0000' format when possible (accept variants with spaces/hyphens or inline 12 digits).",
      "- Prefer labels like 'Pag-IBIG', 'HDMF', 'Member ID', 'MID', 'ID No', 'ID Number', 'Loyalty Card'.",
      "- Use name cues like 'Surname'/'Last Name' and 'Given Names'/'First Name'. If you see 'Name: LAST, FIRST', split accordingly.",
      '- birthDate must be ISO date: YYYY-MM-DD if month/day are known; otherwise null.',
      '- Respond with ONLY the compact JSON object. No code blocks, no prose.'
    ].join('\n');

    const systemAlt = [
      'Extract fields from Pag-IBIG (HDMF) ID OCR text to JSON with keys: {"firstName","lastName","birthDate","idNumber","confidence"}.',
      'Guidance:',
      "- idNumber: prefer a 4-4-4 digit MID '0000-0000-0000'. Accept '0000 0000 0000' or 12 inline digits, then format to 4-4-4.",
      "- Names: Surname -> lastName; Given Names/First Name -> firstName; 'Name: LAST, FIRST' -> parse by comma.",
      '- birthDate: convert to YYYY-MM-DD (supports 12 Mar 1990, 12/03/1990, 03/12/1990, 1990-03-12).',
      'Return only compact JSON.'
    ].join('\n');

    const user = `OCR TEXT START\n${rawText}\nOCR TEXT END`;

    try {
      // Helpers
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
        m = str.match(/\b(0?[1-9]|[12]\d|3[01])\s+([A-Za-z]{3,})\s+((?:19|20)\d{2})\b/);
        if (m) { const d = m[1].padStart(2,'0'); const mo = monthToNumber(m[2]); if (mo) return `${m[3]}-${mo}-${d}`; }
        m = str.match(/\b([A-Za-z]{3,})\s+(0?[1-9]|[12]\d|3[01]),?\s+((?:19|20)\d{2})\b/);
        if (m) { const d = String(m[2]).padStart(2,'0'); const mo = monthToNumber(m[1]); if (mo) return `${m[3]}-${mo}-${d}`; }
        return undefined;
      };
      const normalizeMID = (s) => {
        if (!s) return undefined;
        const str = String(s);
        let m = str.match(/\b(\d{4})[-\s](\d{4})[-\s](\d{4})\b/);
        if (m) return `${m[1]}-${m[2]}-${m[3]}`;
        const digits = str.replace(/[^0-9]/g, '');
        if (digits.length >= 12) {
          const d = digits.slice(0, 12);
          return `${d.slice(0,4)}-${d.slice(4,8)}-${d.slice(8,12)}`;
        }
        return undefined;
      };

      // coerce common synonym keys
      const coerceKeys = (obj) => {
        const out = { ...obj };
        if (out.surname && !out.lastName) out.lastName = out.surname;
        if (out.family_name && !out.lastName) out.lastName = out.family_name;
        if ((out.first_name || out.given_name || out.given_names) && !out.firstName) out.firstName = out.first_name || out.given_name || out.given_names;
        if ((out.dob || out.birth || out.birth_date) && !out.birthDate) out.birthDate = out.dob || out.birth || out.birth_date;
        if ((out.mid || out.member_id || out.memberId || out.id_no || out.id_number) && !out.idNumber) out.idNumber = out.mid || out.member_id || out.memberId || out.id_no || out.id_number;
        return out;
      };

      const runOnce = async (modelId, variant = 'v1') => {
        const model = this.client.getGenerativeModel({ model: modelId, systemInstruction: variant === 'v1' ? system : systemAlt });
        const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: user }]}], generationConfig: { responseMimeType: 'application/json', temperature: 0.2 } });
        const text = result?.response?.text?.() || '';
        const trimmed = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/,'').trim();
        let parsed;
        try { parsed = JSON.parse(trimmed); } catch (e) {
          const match = trimmed.match(/\{[\s\S]*\}/); parsed = match ? JSON.parse(match[0]) : {};
        }
        parsed = coerceKeys(parsed || {});
        const firstName = typeof parsed.firstName === 'string' ? (parsed.firstName.trim() || undefined) : undefined;
        const lastName = typeof parsed.lastName === 'string' ? (parsed.lastName.trim() || undefined) : undefined;
        const birthDate = typeof parsed.birthDate === 'string' ? (normalizeDate(parsed.birthDate) || undefined) : undefined;
        const idNumber = typeof parsed.idNumber === 'string' ? (normalizeMID(parsed.idNumber) || undefined) : undefined;
        const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : undefined;
        const hasAny = !!(firstName || lastName || birthDate || idNumber);
        return { ok: hasAny, firstName, lastName, birthDate, idNumber, confidence, modelUsed: `${modelId}:${variant}`, rawText: text };
      };

      const tried = new Set();
      const baseModels = [this.modelId, 'gemini-1.5-flash', 'gemini-1.5-flash-001', 'gemini-1.0-pro'];
      const candidates = [];
      for (const m of baseModels) { if (!tried.has(m)) { candidates.push([m,'v1']); candidates.push([m,'v2']); tried.add(m); } }
      let lastEmpty;
      const errors = [];
      for (const [m, variant] of candidates) {
        try {
          if (this.debug) console.log(`[GeminiService][PagIBIG] Try ${m} (${variant})`);
          const r = await runOnce(m, variant);
          if (r.ok) return r;
          lastEmpty = r;
        } catch (e) {
          const msg = e?.message || String(e);
          errors.push(`${m}(${variant}): ${msg}`);
        }
      }
      if (typeof lastEmpty !== 'undefined') return lastEmpty;
      return { error: 'Gemini parsing failed', details: errors.join(' | ') || 'No models produced output' };
    } catch (err) {
      const msg = err?.message || String(err);
      console.error('[GeminiService] extractPagibigID error:', msg);
      return { error: 'Gemini parsing failed', details: msg };
    }
  }
}

export default GeminiService;
