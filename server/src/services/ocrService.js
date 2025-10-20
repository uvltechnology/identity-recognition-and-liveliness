import vision from '@google-cloud/vision';

class OCRService {
  constructor() {
    // Initialize the Google Vision client
    // The client will automatically use the GOOGLE_APPLICATION_CREDENTIALS env var
    // or default to Application Default Credentials
    try {
      this.client = new vision.ImageAnnotatorClient();
      this._googleClientInitError = null;
    } catch (e) {
      // In some environments client construction may throw synchronously
      // (though most auth errors surface later during calls). Capture it
      // and keep the service running in a degraded mode.
      console.warn('[OCRService] Failed to initialize Google Vision client:', e && e.message ? e.message : e);
      this.client = null;
      this._googleClientInitError = e && e.message ? e.message : String(e);
    }
  }

  /**
   * Extract text from an image buffer using Google Vision API
   * @param {Buffer} imageBuffer - The image data as a buffer
   * @returns {Promise<Object>} - OCR results with text and bounding boxes
   */
  async extractText(imageBuffer) {
    try {
      if (!this.client) {
        const msg = this._googleClientInitError || 'Google Vision client not initialized';
        console.error('[OCRService] extractText: no Google client:', msg);
        return { success: false, error: `Google Vision not available: ${msg}` };
      }

      const [result] = await this.client.textDetection({ image: { content: imageBuffer } });

      const detections = result.textAnnotations;
      
      if (!detections || detections.length === 0) {
        return {
          success: true,
          text: '',
          words: [],
          fullTextAnnotation: null
        };
      }

      // First annotation contains the full detected text
      const fullText = detections[0].description;

      // Extract individual words with bounding boxes
      const words = detections.slice(1).map(detection => ({
        text: detection.description,
        boundingBox: detection.boundingPoly.vertices,
        confidence: detection.confidence || null
      }));

      // Get detailed text annotation for more structured data
      const fullTextAnnotation = result.fullTextAnnotation;

      return {
        success: true,
        text: fullText,
        words: words,
        fullTextAnnotation: fullTextAnnotation,
        totalWords: words.length
      };

    } catch (error) {
      // Detect common Google auth/config errors and return a friendly message
      console.error('OCR Error:', error && error.message ? error.message : error);
      if (this._isGoogleAuthError(error)) {
        const guidance = 'Google Cloud credentials not found. Set GOOGLE_APPLICATION_CREDENTIALS or configure Application Default Credentials. See https://cloud.google.com/docs/authentication/getting-started';
        return { success: false, error: guidance, text: '', words: [] };
      }

      return { success: false, error: (error && error.message) ? error.message : String(error), text: '', words: [] };
    }
  }

  /**
   * Extract text with document structure (pages, blocks, paragraphs, words)
   * @param {Buffer} imageBuffer - The image data as a buffer
   * @returns {Promise<Object>} - Structured OCR results
   */
  async extractStructuredText(imageBuffer) {
    try {
      if (!this.client) {
        const msg = this._googleClientInitError || 'Google Vision client not initialized';
        console.error('[OCRService] extractStructuredText: no Google client:', msg);
        return { success: false, error: `Google Vision not available: ${msg}`, text: '', pages: [] };
      }

      const [result] = await this.client.documentTextDetection({ image: { content: imageBuffer } });

      const fullTextAnnotation = result.fullTextAnnotation;
      
      if (!fullTextAnnotation) {
        return {
          success: true,
          text: '',
          pages: []
        };
      }

      const pages = fullTextAnnotation.pages.map(page => ({
        width: page.width,
        height: page.height,
        blocks: page.blocks.map(block => ({
          paragraphs: block.paragraphs.map(paragraph => ({
            words: paragraph.words.map(word => ({
              text: word.symbols.map(symbol => symbol.text).join(''),
              boundingBox: word.boundingBox.vertices,
              confidence: word.confidence
            })),
            boundingBox: paragraph.boundingBox.vertices,
            confidence: paragraph.confidence
          })),
          boundingBox: block.boundingBox.vertices,
          blockType: block.blockType
        }))
      }));

      return {
        success: true,
        text: fullTextAnnotation.text,
        pages: pages
      };

    } catch (error) {
      console.error('Structured OCR Error:', error && error.message ? error.message : error);
      if (this._isGoogleAuthError(error)) {
        const guidance = 'Google Cloud credentials not found. Set GOOGLE_APPLICATION_CREDENTIALS or configure Application Default Credentials. See https://cloud.google.com/docs/authentication/getting-started';
        return { success: false, error: guidance, text: '', pages: [] };
      }

      return { success: false, error: (error && error.message) ? error.message : String(error), text: '', pages: [] };
    }
  }

  /**
   * Detect and extract text from identity documents
   * @param {Buffer} imageBuffer - The image data as a buffer
   * @returns {Promise<Object>} - Identity document OCR results
   */
  async extractIdentityText(imageBuffer) {
    try {
      // Use both text detection and document text detection for better results
      const [textResult, docResult] = await Promise.all([
        this.extractText(imageBuffer),
        this.extractStructuredText(imageBuffer)
      ]);

      // Combine results for comprehensive identity document analysis
      return {
        success: true,
        basicText: textResult,
        structuredText: docResult,
        processedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('Identity OCR Error:', error && error.message ? error.message : error);
      if (this._isGoogleAuthError(error)) {
        const guidance = 'Google Cloud credentials not found. Set GOOGLE_APPLICATION_CREDENTIALS or configure Application Default Credentials. See https://cloud.google.com/docs/authentication/getting-started';
        return { success: false, error: guidance, basicText: { text: '', words: [] }, structuredText: { text: '', pages: [] } };
      }

      return { success: false, error: (error && error.message) ? error.message : String(error), basicText: { text: '', words: [] }, structuredText: { text: '', pages: [] } };
    }
  }

  // Helper to identify common Google auth-related errors
  _isGoogleAuthError(err) {
    if (!err) return false;
    const msg = (err.message || '').toString().toLowerCase();
    if (msg.includes('could not load the default credentials') || msg.includes('default credentials') || msg.includes('unauthenticated')) return true;
    // google-auth-library wraps errors - inspect nested properties
    if (err.code === 16 || err.code === 'UNAUTHENTICATED') return true;
    return false;
  }
}

export default OCRService;