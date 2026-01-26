import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * GeminiService: uses Google Generative AI (Gemini) to parse OCR text into structured fields
 */
class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    this.enabled = !!this.apiKey;
    this.client = this.enabled ? new GoogleGenerativeAI(this.apiKey) : null;
    this.modelId = (process.env.GEMINI_MODEL || 'gemini-2.0-flash').trim();
    this.debug = process.env.GEMINI_DEBUG === 'true';

    if (this.enabled) {
      console.log(`[GeminiService] Initialized with model: ${this.modelId}`);
    } else {
      console.warn('[GeminiService] No API key configured - AI extraction disabled');
    }
  }

  // Helper functions
  monthToNumber(name) {
    const map = {
      jan: '01', january: '01', feb: '02', february: '02', mar: '03', march: '03',
      apr: '04', april: '04', may: '05', jun: '06', june: '06', jul: '07', july: '07',
      aug: '08', august: '08', sep: '09', sept: '09', september: '09',
      oct: '10', october: '10', nov: '11', november: '11', dec: '12', december: '12'
    };
    const key = String(name || '').toLowerCase().slice(0, 9);
    return map[key] || map[key.slice(0, 3)] || null;
  }

  normalizeDate(s) {
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
      const month = this.monthToNumber(m[2]);
      if (month) return `${m[3]}-${month}-${day}`;
    }
    m = str.match(/\b([A-Za-z]{3,})\s+(0?[1-9]|[12]\d|3[01]),?\s+((?:19|20)\d{2})\b/);
    if (m) {
      const day = String(m[2]).padStart(2, '0');
      const month = this.monthToNumber(m[1]);
      if (month) return `${m[3]}-${month}-${day}`;
    }
    return undefined;
  }

  async callGemini(system, rawText) {
    const user = `OCR TEXT START\n${rawText}\nOCR TEXT END`;
    
    if (this.debug) {
      console.log(`[GeminiService] Using model: ${this.modelId}`);
      console.log(`[GeminiService] OCR preview: ${rawText.slice(0, 200)}...`);
    }

    const model = this.client.getGenerativeModel({
      model: this.modelId,
      systemInstruction: system
    });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
    });

    const text = result?.response?.text?.() || '';
    if (this.debug) console.log(`[GeminiService] Raw response: ${text}`);

    const trimmed = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch (e) {
      const match = trimmed.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else throw e;
    }
    return { parsed, rawText: text };
  }

  // National ID extraction
  async extractNationalID(rawText) {
    if (!this.enabled) return { error: 'Gemini API key not configured', disabled: true };
    if (!rawText?.trim()) return { firstName: undefined, lastName: undefined, birthDate: undefined, idNumber: undefined, confidence: 0 };

    const system = [
      'You are an extraction engine for Philippine National ID (PhilSys).',
      'Return JSON: {"firstName": string|null, "lastName": string|null, "birthDate": string|null, "idNumber": string|null, "confidence": number}',
      'Rules:',
      '- birthDate: YYYY-MM-DD format',
      '- idNumber: 16 digits as XXXX-XXXX-XXXX-XXXX',
      '- confidence: 0-100',
      '- Return ONLY JSON, no prose.'
    ].join('\n');

    try {
      const { parsed, rawText: responseText } = await this.callGemini(system, rawText);
      const normalizeNatId = (s) => {
        if (!s) return undefined;
        const digits = String(s).replace(/[^0-9]/g, '');
        if (digits.length >= 16) {
          const d = digits.slice(0, 16);
          return `${d.slice(0,4)}-${d.slice(4,8)}-${d.slice(8,12)}-${d.slice(12,16)}`;
        }
        return undefined;
      };

      return {
        firstName: parsed.firstName?.trim() || undefined,
        lastName: parsed.lastName?.trim() || undefined,
        birthDate: this.normalizeDate(parsed.birthDate) || undefined,
        idNumber: normalizeNatId(parsed.idNumber) || undefined,
        confidence: parsed.confidence || 0,
        rawText: responseText,
        modelUsed: this.modelId
      };
    } catch (err) {
      console.error('[GeminiService] extractNationalID error:', err.message);
      return { error: 'Gemini parsing failed', details: err.message };
    }
  }

  // Passport extraction
  async extractPassport(rawText) {
    if (!this.enabled) return { error: 'Gemini API key not configured', disabled: true };
    if (!rawText?.trim()) return { firstName: undefined, lastName: undefined, birthDate: undefined, idNumber: undefined, confidence: 0 };

    const system = [
      'You are an extraction engine for Philippine Passports.',
      'Return JSON: {"firstName": string|null, "lastName": string|null, "birthDate": string|null, "idNumber": string|null, "confidence": number}',
      'Rules:',
      '- birthDate: YYYY-MM-DD format',
      '- idNumber: Passport number (usually alphanumeric)',
      '- confidence: 0-100',
      '- Return ONLY JSON, no prose.'
    ].join('\n');

    try {
      const { parsed, rawText: responseText } = await this.callGemini(system, rawText);
      return {
        firstName: parsed.firstName?.trim() || undefined,
        lastName: parsed.lastName?.trim() || undefined,
        birthDate: this.normalizeDate(parsed.birthDate) || undefined,
        idNumber: parsed.idNumber?.trim() || undefined,
        confidence: parsed.confidence || 0,
        rawText: responseText,
        modelUsed: this.modelId
      };
    } catch (err) {
      console.error('[GeminiService] extractPassport error:', err.message);
      return { error: 'Gemini parsing failed', details: err.message };
    }
  }

  // Driver's License extraction
  async extractDriverLicense(rawText) {
    if (!this.enabled) return { error: 'Gemini API key not configured', disabled: true };
    if (!rawText?.trim()) return { firstName: undefined, lastName: undefined, birthDate: undefined, idNumber: undefined, confidence: 0 };

    const system = [
      'You are an extraction engine for Philippine Driver\'s Licenses.',
      'Return JSON: {"firstName": string|null, "lastName": string|null, "birthDate": string|null, "idNumber": string|null, "confidence": number}',
      'Rules:',
      '- Names: LASTNAME, FIRSTNAME format',
      '- birthDate: YYYY-MM-DD format',
      '- idNumber: XXX-XX-XXXXXX pattern',
      '- confidence: 0-100',
      '- Return ONLY JSON, no prose.'
    ].join('\n');

    try {
      const { parsed, rawText: responseText } = await this.callGemini(system, rawText);
      const normalizeDLId = (s) => {
        if (!s) return undefined;
        const str = String(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (str.length >= 11) {
          return `${str.slice(0,3)}-${str.slice(3,5)}-${str.slice(5,11)}`;
        }
        return undefined;
      };

      return {
        firstName: parsed.firstName?.trim() || undefined,
        lastName: parsed.lastName?.trim() || undefined,
        birthDate: this.normalizeDate(parsed.birthDate) || undefined,
        idNumber: normalizeDLId(parsed.idNumber) || parsed.idNumber?.trim() || undefined,
        confidence: parsed.confidence || 0,
        rawText: responseText,
        modelUsed: this.modelId
      };
    } catch (err) {
      console.error('[GeminiService] extractDriverLicense error:', err.message);
      return { error: 'Gemini parsing failed', details: err.message };
    }
  }

  // UMID extraction
  async extractUMID(rawText) {
    if (!this.enabled) return { error: 'Gemini API key not configured', disabled: true };
    if (!rawText?.trim()) return { firstName: undefined, lastName: undefined, birthDate: undefined, idNumber: undefined, confidence: 0 };

    const system = [
      'You are an extraction engine for Philippine UMID (Unified Multi-Purpose ID).',
      'Return JSON: {"firstName": string|null, "lastName": string|null, "birthDate": string|null, "idNumber": string|null, "confidence": number}',
      'Rules:',
      '- birthDate: YYYY-MM-DD format',
      '- idNumber: CRN number (12 digits: XXXX-XXXXXXX-X)',
      '- confidence: 0-100',
      '- Return ONLY JSON, no prose.'
    ].join('\n');

    try {
      const { parsed, rawText: responseText } = await this.callGemini(system, rawText);
      return {
        firstName: parsed.firstName?.trim() || undefined,
        lastName: parsed.lastName?.trim() || undefined,
        birthDate: this.normalizeDate(parsed.birthDate) || undefined,
        idNumber: parsed.idNumber?.trim() || undefined,
        confidence: parsed.confidence || 0,
        rawText: responseText,
        modelUsed: this.modelId
      };
    } catch (err) {
      console.error('[GeminiService] extractUMID error:', err.message);
      return { error: 'Gemini parsing failed', details: err.message };
    }
  }

  // PhilHealth extraction
  async extractPhilHealth(rawText) {
    if (!this.enabled) return { error: 'Gemini API key not configured', disabled: true };
    if (!rawText?.trim()) return { firstName: undefined, lastName: undefined, birthDate: undefined, idNumber: undefined, confidence: 0 };

    const system = [
      'You are an extraction engine for Philippine PhilHealth ID.',
      'Return JSON: {"firstName": string|null, "lastName": string|null, "birthDate": string|null, "idNumber": string|null, "confidence": number}',
      'Rules:',
      '- birthDate: YYYY-MM-DD format',
      '- idNumber: XX-XXXXXXXXX-X format (2-9-1 digits)',
      '- confidence: 0-100',
      '- Return ONLY JSON, no prose.'
    ].join('\n');

    try {
      const { parsed, rawText: responseText } = await this.callGemini(system, rawText);
      const normalizePHId = (s) => {
        if (!s) return undefined;
        const digits = String(s).replace(/[^0-9]/g, '');
        if (digits.length >= 12) {
          return `${digits.slice(0,2)}-${digits.slice(2,11)}-${digits.slice(11,12)}`;
        }
        return undefined;
      };

      return {
        firstName: parsed.firstName?.trim() || undefined,
        lastName: parsed.lastName?.trim() || undefined,
        birthDate: this.normalizeDate(parsed.birthDate) || undefined,
        idNumber: normalizePHId(parsed.idNumber) || parsed.idNumber?.trim() || undefined,
        confidence: parsed.confidence || 0,
        rawText: responseText,
        modelUsed: this.modelId
      };
    } catch (err) {
      console.error('[GeminiService] extractPhilHealth error:', err.message);
      return { error: 'Gemini parsing failed', details: err.message };
    }
  }

  // TIN ID extraction
  async extractTINID(rawText) {
    if (!this.enabled) return { error: 'Gemini API key not configured', disabled: true };
    if (!rawText?.trim()) return { firstName: undefined, lastName: undefined, birthDate: undefined, idNumber: undefined, confidence: 0 };

    const system = [
      'You are an extraction engine for Philippine TIN ID.',
      'Return JSON: {"firstName": string|null, "lastName": string|null, "birthDate": string|null, "idNumber": string|null, "confidence": number}',
      'Rules:',
      '- birthDate: YYYY-MM-DD format',
      '- idNumber: TIN number (XXX-XXX-XXX-XXX format)',
      '- confidence: 0-100',
      '- Return ONLY JSON, no prose.'
    ].join('\n');

    try {
      const { parsed, rawText: responseText } = await this.callGemini(system, rawText);
      const normalizeTIN = (s) => {
        if (!s) return undefined;
        const digits = String(s).replace(/[^0-9]/g, '');
        if (digits.length >= 12) {
          return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6,9)}-${digits.slice(9,12)}`;
        }
        return undefined;
      };

      return {
        firstName: parsed.firstName?.trim() || undefined,
        lastName: parsed.lastName?.trim() || undefined,
        birthDate: this.normalizeDate(parsed.birthDate) || undefined,
        idNumber: normalizeTIN(parsed.idNumber) || parsed.idNumber?.trim() || undefined,
        confidence: parsed.confidence || 0,
        rawText: responseText,
        modelUsed: this.modelId
      };
    } catch (err) {
      console.error('[GeminiService] extractTINID error:', err.message);
      return { error: 'Gemini parsing failed', details: err.message };
    }
  }

  // Postal ID extraction
  async extractPostalID(rawText) {
    if (!this.enabled) return { error: 'Gemini API key not configured', disabled: true };
    if (!rawText?.trim()) return { firstName: undefined, lastName: undefined, birthDate: undefined, idNumber: undefined, confidence: 0 };

    const system = [
      'You are an extraction engine for Philippine Postal ID.',
      'Return JSON: {"firstName": string|null, "lastName": string|null, "birthDate": string|null, "idNumber": string|null, "confidence": number}',
      'Rules:',
      '- birthDate: YYYY-MM-DD format',
      '- idNumber: Postal ID number',
      '- confidence: 0-100',
      '- Return ONLY JSON, no prose.'
    ].join('\n');

    try {
      const { parsed, rawText: responseText } = await this.callGemini(system, rawText);
      return {
        firstName: parsed.firstName?.trim() || undefined,
        lastName: parsed.lastName?.trim() || undefined,
        birthDate: this.normalizeDate(parsed.birthDate) || undefined,
        idNumber: parsed.idNumber?.trim() || undefined,
        confidence: parsed.confidence || 0,
        rawText: responseText,
        modelUsed: this.modelId
      };
    } catch (err) {
      console.error('[GeminiService] extractPostalID error:', err.message);
      return { error: 'Gemini parsing failed', details: err.message };
    }
  }

  // Pag-IBIG extraction
  async extractPagibigID(rawText) {
    if (!this.enabled) return { error: 'Gemini API key not configured', disabled: true };
    if (!rawText?.trim()) return { firstName: undefined, lastName: undefined, birthDate: undefined, idNumber: undefined, confidence: 0 };

    const system = [
      'You are an extraction engine for Philippine Pag-IBIG (HDMF) ID.',
      'Return JSON: {"firstName": string|null, "lastName": string|null, "birthDate": string|null, "idNumber": string|null, "confidence": number}',
      'Rules:',
      '- birthDate: YYYY-MM-DD format',
      '- idNumber: Pag-IBIG MID number (12 digits: XXXX-XXXX-XXXX)',
      '- confidence: 0-100',
      '- Return ONLY JSON, no prose.'
    ].join('\n');

    try {
      const { parsed, rawText: responseText } = await this.callGemini(system, rawText);
      const normalizePagibig = (s) => {
        if (!s) return undefined;
        const digits = String(s).replace(/[^0-9]/g, '');
        if (digits.length >= 12) {
          return `${digits.slice(0,4)}-${digits.slice(4,8)}-${digits.slice(8,12)}`;
        }
        return undefined;
      };

      return {
        firstName: parsed.firstName?.trim() || undefined,
        lastName: parsed.lastName?.trim() || undefined,
        birthDate: this.normalizeDate(parsed.birthDate) || undefined,
        idNumber: normalizePagibig(parsed.idNumber) || parsed.idNumber?.trim() || undefined,
        confidence: parsed.confidence || 0,
        rawText: responseText,
        modelUsed: this.modelId
      };
    } catch (err) {
      console.error('[GeminiService] extractPagibigID error:', err.message);
      return { error: 'Gemini parsing failed', details: err.message };
    }
  }

  // Face Liveness verification
  async verifyFaceLiveness(imageBase64, localMetrics = {}) {
    if (!this.enabled) {
      return { error: 'Gemini API key not configured', disabled: true };
    }

    const system = [
      'You are a face liveness detection AI. Analyze the provided image to determine if it shows a LIVE person or a SPOOFING ATTEMPT.',
      '',
      'Return JSON: {"isLive": boolean, "confidence": number, "reason": string, "details": string}',
      '',
      'Analyze for liveness indicators:',
      '1. Natural skin texture and lighting gradients',
      '2. Screen/paper edges, reflections, or moiré patterns',
      '3. Natural depth and 3D facial features',
      '4. Natural eye reflections vs printed eyes',
      '5. Background consistency',
      '',
      'confidence: 0-100',
      'Return ONLY JSON, no prose.'
    ].join('\n');

    try {
      let mimeType = 'image/jpeg';
      let base64Data = imageBase64;
      
      if (imageBase64.startsWith('data:')) {
        const match = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          mimeType = match[1];
          base64Data = match[2];
        }
      }

      if (this.debug) {
        console.log(`[GeminiService][Face Liveness] Using model: ${this.modelId}`);
      }

      const model = this.client.getGenerativeModel({
        model: this.modelId,
        systemInstruction: system
      });

      const result = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: base64Data } },
            { text: `Analyze this face for liveness. Local metrics: livenessScore=${localMetrics.livenessScore || 'N/A'}, movementDetected=${localMetrics.movementDetected || 'N/A'}` }
          ]
        }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1 }
      });

      const text = result?.response?.text?.() || '';
      const trimmed = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
      
      let parsed;
      try {
        parsed = JSON.parse(trimmed);
      } catch (e) {
        const match = trimmed.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]);
        else throw e;
      }

      return {
        isLive: parsed.isLive === true,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 50,
        reason: parsed.reason || (parsed.isLive ? 'Live person detected' : 'Spoofing suspected'),
        details: parsed.details
      };
    } catch (err) {
      console.error('[GeminiService] verifyFaceLiveness error:', err.message);
      return { error: 'Face liveness verification failed', details: err.message };
    }
  }

  /**
   * Verify and polish extracted fields using both image and raw text
   * @param {string} imageBase64 - Base64 encoded image data
   * @param {string} rawText - OCR raw text
   * @param {object} scanningResult - Initial extraction from scanning algorithm
   * @param {string} idType - Type of ID being processed
   */
  async verifyAndPolishFields(imageBase64, rawText, scanningResult, idType = 'unknown') {
    if (!this.enabled) {
      return { ...scanningResult, verified: false, note: 'AI not available' };
    }

    try {
      const base64Data = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
      const mimeType = 'image/jpeg';

      const system = [
        'You are an ID verification AI that verifies and corrects extracted data.',
        'You will receive:',
        '1. An image of an ID document',
        '2. OCR raw text from the ID',
        '3. Pre-extracted fields from scanning algorithm',
        '',
        'Your task:',
        '- Look at the actual ID image to verify the pre-extracted data',
        '- Correct any errors in the extracted fields',
        '- Fill in any missing fields you can see in the image',
        '- Return the verified/corrected data',
        '',
        'Return JSON only:',
        '{',
        '  "firstName": string|null,',
        '  "lastName": string|null,',
        '  "middleName": string|null,',
        '  "birthDate": string|null (YYYY-MM-DD format),',
        '  "idNumber": string|null,',
        '  "idType": string,',
        '  "confidence": number (0-100),',
        '  "corrections": string[] (list what you corrected)',
        '}',
      ].join('\n');

      const userPrompt = [
        'Pre-extracted fields from scanning:',
        JSON.stringify(scanningResult, null, 2),
        '',
        'OCR Raw Text:',
        rawText,
        '',
        'Please verify these fields against the ID image and correct any errors.',
      ].join('\n');

      const model = this.client.getGenerativeModel({
        model: this.modelId,
        systemInstruction: system
      });

      const result = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: base64Data } },
            { text: userPrompt }
          ]
        }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
      });

      const text = result?.response?.text?.() || '';
      const trimmed = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
      
      let parsed;
      try {
        parsed = JSON.parse(trimmed);
      } catch (e) {
        const match = trimmed.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]);
        else throw e;
      }

      return {
        firstName: parsed.firstName?.trim() || scanningResult.firstName,
        lastName: parsed.lastName?.trim() || scanningResult.lastName,
        middleName: parsed.middleName?.trim() || scanningResult.middleName,
        birthDate: this.normalizeDate(parsed.birthDate) || scanningResult.birthDate,
        idNumber: parsed.idNumber?.trim() || scanningResult.idNumber,
        idType: parsed.idType || idType,
        confidence: parsed.confidence || 80,
        verified: true,
        corrections: parsed.corrections || [],
        modelUsed: this.modelId
      };
    } catch (err) {
      console.error('[GeminiService] verifyAndPolishFields error:', err.message);
      return { ...scanningResult, verified: false, error: err.message };
    }
  }
}

export default GeminiService;
