import vision from '@google-cloud/vision';

class OCRService {
  constructor() {
    try {
      this.client = new vision.ImageAnnotatorClient();
      this._googleClientInitError = null;
    } catch (e) {
      console.warn('[OCRService] Failed to initialize Google Vision client:', e?.message || e);
      this.client = null;
      this._googleClientInitError = e?.message || String(e);
    }
  }

  async extractText(imageBuffer) {
    try {
      if (!this.client) {
        const msg = this._googleClientInitError || 'Google Vision client not initialized';
        return { success: false, error: `Google Vision not available: ${msg}` };
      }

      const [result] = await this.client.textDetection({ image: { content: imageBuffer } });
      const detections = result.textAnnotations;
      
      if (!detections || detections.length === 0) {
        return { success: true, text: '', words: [], fullTextAnnotation: null };
      }

      const fullText = detections[0].description;
      const words = detections.slice(1).map(detection => ({
        text: detection.description,
        boundingBox: detection.boundingPoly.vertices,
        confidence: detection.confidence || null
      }));

      return {
        success: true,
        text: fullText,
        words: words,
        fullTextAnnotation: result.fullTextAnnotation,
        totalWords: words.length
      };
    } catch (error) {
      console.error('OCR Error:', error?.message || error);
      if (this._isGoogleAuthError(error)) {
        return { success: false, error: 'Google Cloud credentials not found.', text: '', words: [] };
      }
      return { success: false, error: error?.message || String(error), text: '', words: [] };
    }
  }

  async extractStructuredText(imageBuffer) {
    try {
      if (!this.client) {
        const msg = this._googleClientInitError || 'Google Vision client not initialized';
        return { success: false, error: `Google Vision not available: ${msg}`, text: '', pages: [] };
      }

      const [result] = await this.client.documentTextDetection({ image: { content: imageBuffer } });
      const fullTextAnnotation = result.fullTextAnnotation;
      
      if (!fullTextAnnotation) {
        return { success: true, text: '', pages: [] };
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

      return { success: true, text: fullTextAnnotation.text, pages };
    } catch (error) {
      console.error('Structured OCR Error:', error?.message || error);
      if (this._isGoogleAuthError(error)) {
        return { success: false, error: 'Google Cloud credentials not found.', text: '', pages: [] };
      }
      return { success: false, error: error?.message || String(error), text: '', pages: [] };
    }
  }

  async extractIdentityText(imageBuffer) {
    try {
      const [textResult, docResult] = await Promise.all([
        this.extractText(imageBuffer),
        this.extractStructuredText(imageBuffer)
      ]);

      return {
        success: true,
        basicText: textResult,
        structuredText: docResult,
        processedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Identity OCR Error:', error?.message || error);
      if (this._isGoogleAuthError(error)) {
        return { success: false, error: 'Google Cloud credentials not found.', basicText: { text: '', words: [] }, structuredText: { text: '', pages: [] } };
      }
      return { success: false, error: error?.message || String(error), basicText: { text: '', words: [] }, structuredText: { text: '', pages: [] } };
    }
  }

  _isGoogleAuthError(err) {
    if (!err) return false;
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('could not load the default credentials') || msg.includes('default credentials') || msg.includes('unauthenticated')) return true;
    if (err.code === 16 || err.code === 'UNAUTHENTICATED') return true;
    return false;
  }
}

export default OCRService;
