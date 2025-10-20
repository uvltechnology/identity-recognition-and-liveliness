import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import OCRService from './services/ocrService.js';
import GeminiService from './services/geminiService.js';
import { extractIdentityFromText } from './services/identityExtractor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const ocrService = new OCRService();
const geminiService = new GeminiService();

// Configure multer for handling image uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
    }
  }
});

// middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));
// Serve JSON resources (e.g., SURNAME variants) to the client
app.use('/json', express.static(path.join(__dirname, 'json')));

// routes
app.get('/health', (req, res) => res.json({ ok: true }));

// AI extraction endpoint for Driver's License (Gemini first)
app.post('/api/ai/driver-license/parse', async (req, res) => {
  try {
    const { rawText } = req.body || {};
    if (!rawText || !rawText.trim()) {
      return res.status(400).json({ success: false, error: 'rawText is required' });
    }
    if (!geminiService.enabled) {
      return res.status(501).json({ success: false, error: 'Gemini not configured', disabled: true });
    }
  const result = await geminiService.extractDriverLicense(rawText);
    if (result.error && !result.disabled) {
      return res.status(502).json({ success: false, error: result.error, details: result.details });
    }
    return res.json({ success: true, fields: {
      firstName: result.firstName,
      lastName: result.lastName,
      birthDate: result.birthDate,
      idNumber: result.idNumber,
    }, confidence: result.confidence, raw: result.rawText });
  } catch (err) {
    console.error('AI parse endpoint error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error in AI parse' });
  }
});

// AI extraction endpoint for PhilHealth (Gemini first)
app.post('/api/ai/philhealth/parse', async (req, res) => {
  try {
    const { rawText } = req.body || {};
    if (!rawText || !rawText.trim()) {
      return res.status(400).json({ success: false, error: 'rawText is required' });
    }
    if (!geminiService.enabled) {
      return res.status(501).json({ success: false, error: 'Gemini not configured', disabled: true });
    }
    const result = await geminiService.extractPhilHealth(rawText);
    if (result.error && !result.disabled) {
      return res.status(502).json({ success: false, error: result.error, details: result.details });
    }
    return res.json({ success: true, fields: {
      firstName: result.firstName,
      lastName: result.lastName,
      birthDate: result.birthDate,
      idNumber: result.idNumber,
    }, confidence: result.confidence, raw: result.rawText });
  } catch (err) {
    console.error('AI PhilHealth parse endpoint error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error in AI parse' });
  }
});

// AI extraction endpoint for UMID (Gemini first)
app.post('/api/ai/umid/parse', async (req, res) => {
  try {
    const { rawText } = req.body || {};
    if (!rawText || !rawText.trim()) {
      return res.status(400).json({ success: false, error: 'rawText is required' });
    }
    if (!geminiService.enabled) {
      return res.status(501).json({ success: false, error: 'Gemini not configured', disabled: true });
    }
    const result = await geminiService.extractUMID(rawText);
    if (result.error && !result.disabled) {
      return res.status(502).json({ success: false, error: result.error, details: result.details });
    }
    return res.json({ success: true, fields: {
      firstName: result.firstName,
      lastName: result.lastName,
      birthDate: result.birthDate,
      idNumber: result.idNumber,
    }, confidence: result.confidence, raw: result.rawText });
  } catch (err) {
    console.error('AI UMID parse endpoint error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error in AI parse' });
  }
});

// AI extraction endpoint for National ID (Gemini first)
app.post('/api/ai/national-id/parse', async (req, res) => {
  try {
    const { rawText } = req.body || {};
    if (!rawText || !rawText.trim()) {
      return res.status(400).json({ success: false, error: 'rawText is required' });
    }
    if (!geminiService.enabled) {
      return res.status(501).json({ success: false, error: 'Gemini not configured', disabled: true });
    }
    const result = await geminiService.extractNationalID(rawText);
    if (result.error && !result.disabled) {
      return res.status(502).json({ success: false, error: result.error, details: result.details });
    }
    return res.json({ success: true, fields: {
      firstName: result.firstName,
      lastName: result.lastName,
      birthDate: result.birthDate,
      idNumber: result.idNumber,
    }, confidence: result.confidence, raw: result.rawText });
  } catch (err) {
    console.error('AI National ID parse endpoint error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error in AI parse' });
  }
});

// AI extraction endpoint for Passport (Gemini first)
app.post('/api/ai/passport/parse', async (req, res) => {
  try {
    const { rawText } = req.body || {};
    if (!rawText || !rawText.trim()) {
      return res.status(400).json({ success: false, error: 'rawText is required' });
    }
    if (!geminiService.enabled) {
      return res.status(501).json({ success: false, error: 'Gemini not configured', disabled: true });
    }
    const result = await geminiService.extractPassport(rawText);
    if (result.error && !result.disabled) {
      return res.status(502).json({ success: false, error: result.error, details: result.details });
    }
    return res.json({ success: true, fields: {
      firstName: result.firstName,
      lastName: result.lastName,
      birthDate: result.birthDate,
      idNumber: result.idNumber,
    }, confidence: result.confidence, raw: result.rawText });
  } catch (err) {
    console.error('AI Passport parse endpoint error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error in AI parse' });
  }
});

// OCR endpoints
app.post('/api/ocr/text', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided'
      });
    }

    const result = await ocrService.extractText(req.file.buffer);
    res.json(result);

  } catch (error) {
    console.error('OCR endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during OCR processing'
    });
  }
});

app.post('/api/ocr/document', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided'
      });
    }

    const result = await ocrService.extractStructuredText(req.file.buffer);
    res.json(result);

  } catch (error) {
    console.error('Document OCR endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during document OCR processing'
    });
  }
});

app.post('/api/ocr/identity', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided'
      });
    }

    // Extract raw text using Google Vision OCR
    const ocrResult = await ocrService.extractIdentityText(req.file.buffer);
    
    if (!ocrResult.success) {
      return res.json(ocrResult);
    }

  const rawText = ocrResult.basicText?.text || ocrResult.structuredText?.text || '';
  const idType = req.body?.idType || 'national-id';
    
  const fields = await extractIdentityFromText(rawText, { idType });

    res.json({
      success: true,
      fields,
      rawText,
      ocrResult
    });

  } catch (error) {
    console.error('Identity OCR endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during identity OCR processing'
    });
  }
});

// Handle base64 image uploads
app.post('/api/ocr/base64', async (req, res) => {
  try {
    const { image, type, idType } = req.body;

    if (!image) {
      return res.status(400).json({
        success: false,
        error: 'No image data provided'
      });
    }

    // Remove data URL prefix if present
    const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    let result;
    switch (type) {
      case 'document':
        result = await ocrService.extractStructuredText(imageBuffer);
        break;
      case 'identity':
        // Extract raw text using Google Vision OCR
        result = await ocrService.extractIdentityText(imageBuffer);
        
        if (result.success) {
          const rawText = result.basicText?.text || result.structuredText?.text || '';
          const fields = await extractIdentityFromText(rawText, { idType: idType || 'national-id' });
          
          result.fields = fields;
          result.rawText = rawText;
        }
        break;
      default:
        result = await ocrService.extractText(imageBuffer);
    }

    res.json(result);

  } catch (error) {
    console.error('Base64 OCR endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during OCR processing'
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large. Maximum size is 10MB.'
      });
    }
  }
  
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: error.message || 'Internal server error'
  });
});

export default app;
