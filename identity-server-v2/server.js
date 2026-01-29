import 'dotenv/config';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import GeminiService from './src/services/geminiService.js';
import OCRService from './src/services/ocrService.js';
import { extractIdentityFromText } from './src/services/identityExtractor.js';
import { extractFieldsUsingOpenAI } from './src/services/openaiExtractor.js';
import { scanningExtract, fallbackExtract, mergeWithFallback } from './src/services/fallbackExtractor.js';
import sessionStore from './src/services/sessionStore.js';
import storageModule from './src/services/storage.js';
import webhookService from './src/services/webhookService.js';

const { getSession, setSession, deleteSession, makeSessionId, cleanupTempForSession, initRedisClient } = sessionStore;
const { uploadImageToStorage, deleteImageFromStorage, getImageUrlFromRef } = storageModule;
const { 
  initWebhookTables, 
  registerWebhook, 
  triggerVerificationSuccess, 
  triggerVerificationFailed,
  triggerSessionExpired,
  getWebhookStatus,
  listWebhooks,
  updateWebhookStatus
} = webhookService;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';
const host = process.env.HOST || '0.0.0.0';
const port = parseInt(process.env.PORT, 10) || 3000;
const sslPort = parseInt(process.env.SSL_PORT, 10) || 3001;

// SSL Configuration
const sslEnabled = process.env.SSL_ENABLED === 'true';
const sslCertPath = process.env.SSL_CERT || './certs/dev-cert.pem';
const sslKeyPath = process.env.SSL_KEY || './certs/dev-key.pem';

// Initialize services
const geminiService = new GeminiService();
const ocrService = new OCRService();

// Initialize Redis if configured
(async () => {
  try {
    const redisUrl = process.env.REDIS_URL || '';
    if (redisUrl) {
      const redisModule = await import('redis');
      await initRedisClient(redisModule.createClient, redisUrl);
    }
  } catch (e) { /* fallback to in-memory */ }

  // Initialize webhook tables
  try {
    await initWebhookTables();
  } catch (e) {
    console.warn('Webhook tables initialization skipped:', e.message);
  }
})();

// Multer config for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    cb(null, allowedTypes.includes(file.mimetype));
  }
});

// Helper for webhooks
async function safePostWebhook(url, body) {
  if (!url) return;
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 6000);
    await fetch(String(url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
      signal: controller.signal
    });
  } catch (e) { console.warn('[webhook] POST failed', url, e?.message); }
}

async function createServer() {
  const app = express();

  // CORS and body parsing
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Serve static files from public directory
  app.use(express.static(path.join(__dirname, 'public')));

  let vite;
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);
  } else {
    const compression = (await import('compression')).default;
    const sirv = (await import('sirv')).default;
    app.use(compression());
    app.use(sirv(path.join(__dirname, 'dist/client'), { extensions: [] }));
  }

  // ===== API Routes =====

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      geminiEnabled: geminiService.enabled,
      geminiModel: geminiService.modelId
    });
  });

  app.get('/health', (req, res) => res.json({ ok: true }));

  // ID types list
  app.get('/api/ids', (req, res) => {
    res.json({
      success: true,
      ids: [
        { id: 'national-id', name: 'National ID' },
        { id: 'passport', name: 'Passport' },
        { id: 'umid', name: 'UMID' },
        { id: 'tin-id', name: 'TIN' },
        { id: 'philhealth', name: 'PhilHealth' },
        { id: 'pagibig', name: 'Pag-IBIG' },
        { id: 'postal-id', name: 'Postal ID' },
        { id: 'driver-license', name: "Driver's License" },
      ],
    });
  });
  
  // AI extraction endpoint - unified for all ID types
  app.post('/api/ai/:idType/parse', async (req, res) => {
    try {
      const idType = req.params.idType;
      const { rawText } = req.body || {};

      if (!rawText?.trim()) {
        return res.status(400).json({ success: false, error: 'rawText is required' });
      }

      // === STEP 1: Scanning Algorithm (ALWAYS runs first) ===
      const scanningResult = scanningExtract(rawText, idType);
      console.log(`[AI/${idType}] Scanning result:`, JSON.stringify(scanningResult, null, 2));

      // If scanning got all required fields, return early
      const hasAllFields = scanningResult.firstName && scanningResult.lastName &&
        (scanningResult.idNumber || scanningResult.birthDate);

      if (hasAllFields) {
        console.log(`[AI/${idType}] Scanning extracted all fields, skipping AI`);
        return res.json({
          success: true,
          fields: {
            firstName: scanningResult.firstName,
            lastName: scanningResult.lastName,
            birthDate: scanningResult.birthDate,
            idNumber: scanningResult.idNumber,
          },
          confidence: 0.85,
          extractionMethod: 'scanning-algorithm',
        });
      }

      // === STEP 2: AI Enhancement (only if scanning incomplete) ===
      if (!geminiService.enabled) {
        return res.json({
          success: true,
          fields: {
            firstName: scanningResult.firstName,
            lastName: scanningResult.lastName,
            birthDate: scanningResult.birthDate,
            idNumber: scanningResult.idNumber,
          },
          confidence: 0.7,
          extractionMethod: 'scanning-algorithm',
          note: 'AI unavailable, using scanning only'
        });
      }

      const extractors = {
        'national-id': () => geminiService.extractNationalID(rawText),
        'passport': () => geminiService.extractPassport(rawText),
        'driver-license': () => geminiService.extractDriverLicense(rawText),
        'umid': () => geminiService.extractUMID(rawText),
        'philhealth': () => geminiService.extractPhilHealth(rawText),
        'tin-id': () => geminiService.extractTINID(rawText),
        'postal-id': () => geminiService.extractPostalID(rawText),
        'pagibig': () => geminiService.extractPagibigID(rawText),
      };

      const extractor = extractors[idType];
      if (!extractor) {
        return res.status(400).json({ success: false, error: `Unknown ID type: ${idType}` });
      }

      console.log(`[AI] Processing ${idType} extraction...`);
      const aiResult = await extractor();

      if (aiResult.error && !aiResult.disabled) {
        // Return scanning results even if AI fails
        return res.json({
          success: true,
          fields: {
            firstName: scanningResult.firstName,
            lastName: scanningResult.lastName,
            birthDate: scanningResult.birthDate,
            idNumber: scanningResult.idNumber,
          },
          confidence: 0.7,
          extractionMethod: 'scanning-algorithm',
          note: 'AI failed, using scanning only',
          aiError: aiResult.error
        });
      }

      // Merge: Scanning results first, AI fills in gaps
      const mergedFields = {
        firstName: scanningResult.firstName || aiResult.firstName,
        lastName: scanningResult.lastName || aiResult.lastName,
        birthDate: scanningResult.birthDate || aiResult.birthDate,
        idNumber: scanningResult.idNumber || aiResult.idNumber,
      };

      return res.json({
        success: true,
        fields: mergedFields,
        confidence: aiResult.confidence || 0.8,
        modelUsed: aiResult.modelUsed,
        extractionMethod: 'scanning+ai',
        scanning: scanningResult,
      });
    } catch (err) {
      console.error('AI extraction error:', err);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

  // Face Liveness endpoint
  app.post('/api/ai/face/liveness', async (req, res) => {
    try {
      const { image, livenessScore, movementDetected } = req.body || {};

      if (!image) {
        return res.status(400).json({ success: false, error: 'image is required' });
      }

      if (!geminiService.enabled) {
        return res.json({
          isLive: livenessScore >= 70 && movementDetected,
          confidence: livenessScore,
          reason: 'AI unavailable, using local detection'
        });
      }

      const result = await geminiService.verifyFaceLiveness(image, { livenessScore, movementDetected });

      if (result.error) {
        return res.json({
          isLive: livenessScore >= 70 && movementDetected,
          confidence: livenessScore,
          reason: 'AI error, using local detection',
          details: result.error
        });
      }

      return res.json(result);
    } catch (err) {
      console.error('Face liveness error:', err);
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

  // ID Image Quality Check endpoint
  app.post('/api/ai/id/quality-check', async (req, res) => {
    try {
      const { image } = req.body || {};

      if (!image) {
        return res.status(400).json({ success: false, error: 'image is required' });
      }

      if (!geminiService.enabled) {
        // If AI not available, skip quality check and allow processing
        return res.json({
          success: true,
          result: {
            isAcceptable: true,
            confidence: 100,
            issues: [],
            details: {},
            suggestion: 'AI quality check unavailable, proceeding with capture'
          }
        });
      }

      const result = await geminiService.checkIdImageQuality(image);

      if (result.error) {
        // On error, allow processing but note the issue
        return res.json({
          success: true,
          result: {
            isAcceptable: true,
            confidence: 50,
            issues: [],
            details: {},
            suggestion: 'Quality check error, proceeding with capture'
          }
        });
      }

      return res.json({ success: true, result });
    } catch (err) {
      console.error('ID quality check error:', err);
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

  // Face Comparison endpoint - Compare ID photo with selfie
  app.post('/api/ai/face/compare', async (req, res) => {
    try {
      const { idImage, selfieImage } = req.body || {};

      if (!idImage || !selfieImage) {
        return res.status(400).json({ success: false, error: 'idImage and selfieImage are required' });
      }

      if (!geminiService.enabled) {
        // If AI not available, skip comparison and allow
        return res.json({
          success: true,
          result: {
            isMatch: true,
            confidence: 0,
            reason: 'AI face comparison unavailable',
            details: { aiUnavailable: true }
          }
        });
      }

      const result = await geminiService.compareFaces(idImage, selfieImage);

      if (result.error) {
        // On error, skip comparison
        return res.json({
          success: true,
          result: {
            isMatch: true,
            confidence: 0,
            reason: 'Face comparison error, proceeding',
            details: { error: result.error }
          }
        });
      }

      return res.json({ success: true, result });
    } catch (err) {
      console.error('Face comparison error:', err);
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

  // OCR endpoints
  app.post('/api/ocr/text', upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No image file provided' });
      }
      const result = await ocrService.extractText(req.file.buffer);
      res.json(result);
    } catch (error) {
      console.error('OCR error:', error);
      res.status(500).json({ success: false, error: 'OCR processing failed' });
    }
  });

  app.post('/api/ocr/document', upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No image file provided' });
      }
      const result = await ocrService.extractStructuredText(req.file.buffer);
      res.json(result);
    } catch (error) {
      console.error('Document OCR error:', error);
      res.status(500).json({ success: false, error: 'Document OCR processing failed' });
    }
  });

  app.post('/api/ocr/identity', upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No image file provided' });
      }
      const ocrResult = await ocrService.extractIdentityText(req.file.buffer);
      if (!ocrResult.success) return res.json(ocrResult);

      const rawText = ocrResult.basicText?.text || ocrResult.structuredText?.text || '';
      const idType = req.body?.idType || 'national-id';
      const fields = await extractIdentityFromText(rawText, { idType });

      res.json({ success: true, fields, rawText, ocrResult });
    } catch (error) {
      console.error('Identity OCR error:', error);
      res.status(500).json({ success: false, error: 'Identity OCR processing failed' });
    }
  });

  // Base64 OCR endpoint (main endpoint for frontend)
  app.post('/api/ocr/base64', async (req, res) => {
    try {
      const { image, type, idType, sessionId } = req.body;

      if (!image) {
        return res.status(400).json({ success: false, error: 'No image data provided' });
      }

      const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');

      let result;
      switch (type) {
        case 'document':
          result = await ocrService.extractStructuredText(imageBuffer);
          break;
        case 'identity':
          result = await ocrService.extractIdentityText(imageBuffer);
          if (result.success) {
            const rawText = result.basicText?.text || result.structuredText?.text || '';
            const currentIdType = idType || 'unknown';

            console.log(`[OCR] Processing ${currentIdType}, raw text length: ${rawText.length}`);

            // === STEP 1: Scanning Algorithm (PRIMARY - extract from raw text) ===
            const scanningFields = scanningExtract(rawText, currentIdType);
            console.log('[Scanning] Extracted:', JSON.stringify(scanningFields, null, 2));
            result.scanning = scanningFields;

            // Start with scanning results
            let fields = { ...scanningFields };

            // === STEP 2: AI Verification (uses image + raw text to verify/polish) ===
            if (geminiService.enabled) {
              try {
                console.log('[AI] Verifying with image + raw text...');
                const aiVerified = await geminiService.verifyAndPolishFields(
                  base64Data,
                  rawText,
                  scanningFields,
                  currentIdType
                );

                if (aiVerified && !aiVerified.error) {
                  fields = aiVerified;
                  result.aiVerified = true;
                  result.corrections = aiVerified.corrections || [];
                  console.log('[AI] Verified:', JSON.stringify(aiVerified, null, 2));
                }
              } catch (e) {
                console.warn('AI verification failed:', e.message);
                result.aiVerified = false;
              }
            }

            result.fields = fields;
            result.rawText = rawText;

            // === STEP 3: OpenAI as backup (only for missing fields) ===
            try {
              const openaiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY;
              if (openaiKey && (!result.fields.firstName || !result.fields.lastName)) {
                const oa = await extractFieldsUsingOpenAI({ rawText, idType: currentIdType });
                if (oa?.success && oa.parsed) {
                  const merged = { ...result.fields };
                  for (const k of ['firstName', 'lastName', 'idNumber', 'birthDate']) {
                    if (oa.parsed[k] && !merged[k]) merged[k] = oa.parsed[k];
                  }
                  result.fields = merged;
                  result.openai = { parsed: oa.parsed };
                }
              }
            } catch (e) { console.warn('OpenAI extraction failed:', e); }

            // Store to session if provided
            if (sessionId) {
              try {
                const ttl = Number(process.env.VERIFY_SESSION_TTL_SECONDS || 3600);
                const existing = await getSession(sessionId);
                if (existing) {
                  const imageRef = await uploadImageToStorage(base64Data, sessionId);
                  existing.payload = { ...(existing.payload || {}), tempImageRef: imageRef, tempOcr: result };
                  existing.result = { fields: result.fields, rawText: result.rawText };
                  existing.status = result.fields?.firstName && result.fields?.lastName ? 'done' : 'processing';
                  if (existing.status === 'done') existing.finishedAt = new Date().toISOString();
                  await setSession(sessionId, existing, ttl);

                  if (existing.status === 'done' && existing.payload?.successWebhook) {
                    safePostWebhook(existing.payload.successWebhook, { sessionId, status: 'done', result: existing.result });
                  }
                }
              } catch (e) { console.warn('Session update failed:', e); }
            }
          }
          break;
        default:
          result = await ocrService.extractText(imageBuffer);
      }

      res.json(result);
    } catch (error) {
      console.error('Base64 OCR error:', error);
      res.status(500).json({ success: false, error: 'OCR processing failed' });
    }
  });

  // ===== Session/Verification Routes =====

  // Create verification session
  async function createVerifySessionHandler(req, res) {
    try {
      const payload = req.body || {};
      const sessionId = makeSessionId();
      const storedPayload = { ...payload };

      const sessionObj = {
        id: sessionId,
        createdAt: Date.now(),
        payload: storedPayload,
        status: 'pending'
      };
      const ttl = Number(payload.ttlSeconds || process.env.VERIFY_SESSION_TTL_SECONDS || 3600);
      await setSession(sessionId, sessionObj, ttl);

      const origin = req.protocol + '://' + req.get('host');
      const wrapperUrl = `${origin}/verify/session/${sessionId}`;
      let iframeUrl = `${origin}/embed/session/${sessionId}`;
      if (payload.origin) {
        iframeUrl += `?expectedOrigin=${encodeURIComponent(payload.origin)}`;
      }

      console.log("Created verification session:", sessionId, "idType:", payload.idType || 'not specified');
      res.json({ success: true, sessionId, wrapperUrl, iframeUrl });
    } catch (e) {
      console.error('Create session error:', e);
      res.status(500).json({ success: false, error: 'Failed to create session' });
    }
  }

  app.post('/api/verify/create', createVerifySessionHandler);
  app.post('/verify/create', createVerifySessionHandler);

  // Create ID verification session only
  async function createIDVerificationSessionHandler(req, res) {
    try {
      const payload = req.body || {};
      const sessionId = makeSessionId();

      const sessionObj = {
        id: sessionId,
        createdAt: Date.now(),
        payload: {
          ...payload,
          verificationType: 'id-only',
          idType: payload.idType || 'national-id',
        },
        status: 'pending'
      };

      const ttl = Number(payload.ttlSeconds || process.env.VERIFY_SESSION_TTL_SECONDS || 3600);
      await setSession(sessionId, sessionObj, ttl);

      const origin = req.protocol + '://' + req.get('host');
      const sessionUrl = `${origin}/session/idverification/${sessionId}`;
      const embedUrl = `${origin}/embed/session/${sessionId}`;
      const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

      // Register webhook for this session
      if (payload.webhookUrl || payload.successUrl || payload.failureUrl) {
        await registerWebhook({
          sessionId,
          sessionType: 'id',
          webhookUrl: payload.webhookUrl,
          successUrl: payload.successUrl,
          failureUrl: payload.failureUrl
        });
      }

      console.log("Created ID verification session:", sessionId, "idType:", payload.idType || 'national-id');
      res.json({
        success: true,
        sessionId,
        sessionUrl,
        embedUrl,
        expiresAt,
        webhookRegistered: !!(payload.webhookUrl || payload.successUrl || payload.failureUrl)
      });
    } catch (e) {
      console.error('Create ID verification session error:', e);
      res.status(500).json({ success: false, error: 'Failed to create session' });
    }
  }

  // Create Selfie Liveness session only
  async function createSelfieSessionHandler(req, res) {
    try {
      const payload = req.body || {};
      const sessionId = makeSessionId();

      const sessionObj = {
        id: sessionId,
        createdAt: Date.now(),
        payload: {
          ...payload,
          verificationType: 'selfie-only',
        },
        status: 'pending'
      };

      const ttl = Number(payload.ttlSeconds || process.env.VERIFY_SESSION_TTL_SECONDS || 3600);
      await setSession(sessionId, sessionObj, ttl);

      const origin = req.protocol + '://' + req.get('host');
      const sessionUrl = `${origin}/session/selfieliveness/${sessionId}`;
      const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

      // Register webhook for this session
      if (payload.webhookUrl || payload.successUrl || payload.failureUrl) {
        await registerWebhook({
          sessionId,
          sessionType: 'selfie',
          webhookUrl: payload.webhookUrl,
          successUrl: payload.successUrl,
          failureUrl: payload.failureUrl
        });
      }

      console.log("Created selfie liveness session:", sessionId);
      res.json({
        success: true,
        sessionId,
        sessionUrl,
        expiresAt,
        webhookRegistered: !!(payload.webhookUrl || payload.successUrl || payload.failureUrl)
      });
    } catch (e) {
      console.error('Create selfie session error:', e);
      res.status(500).json({ success: false, error: 'Failed to create session' });
    }
  }

  // Create Combined verification session (ID first, then selfie)
  async function createCombinedVerificationSessionHandler(req, res) {
    try {
      const payload = req.body || {};
      const idSessionId = makeSessionId();
      const selfieSessionId = makeSessionId();

      const ttl = Number(payload.ttlSeconds || process.env.VERIFY_SESSION_TTL_SECONDS || 3600);
      const origin = req.protocol + '://' + req.get('host');

      // Create ID verification session with link to selfie session
      const idSessionObj = {
        id: idSessionId,
        createdAt: Date.now(),
        payload: {
          ...payload,
          verificationType: 'combined',
          idType: payload.idType || 'national-id',
          nextStep: 'selfie',
          selfieSessionId: selfieSessionId,
        },
        status: 'pending'
      };
      await setSession(idSessionId, idSessionObj, ttl);

      // Create selfie session (pending, will be used after ID verification)
      const selfieSessionObj = {
        id: selfieSessionId,
        createdAt: Date.now(),
        payload: {
          ...payload,
          verificationType: 'combined-selfie',
          linkedIdSession: idSessionId,
        },
        status: 'pending'
      };
      await setSession(selfieSessionId, selfieSessionObj, ttl);

      // Register webhook for the combined session (using ID session as primary)
      if (payload.webhookUrl || payload.successUrl || payload.failureUrl) {
        await registerWebhook({
          sessionId: idSessionId,
          sessionType: 'combined',
          webhookUrl: payload.webhookUrl,
          successUrl: payload.successUrl,
          failureUrl: payload.failureUrl
        });
      }

      const sessionUrl = `${origin}/session/combined/${idSessionId}`;
      const selfieSessionUrl = `${origin}/session/selfieliveness/${selfieSessionId}`;
      const embedUrl = `${origin}/embed/session/${idSessionId}`;
      const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

      console.log("Created combined verification session:", idSessionId, "->", selfieSessionId);
      res.json({
        success: true,
        sessionId: idSessionId,
        selfieSessionId,
        sessionUrl,
        selfieSessionUrl,
        embedUrl,
        nextStep: 'selfie',
        expiresAt,
        webhookRegistered: !!(payload.webhookUrl || payload.successUrl || payload.failureUrl)
      });
    } catch (e) {
      console.error('Create combined session error:', e);
      res.status(500).json({ success: false, error: 'Failed to create session' });
    }
  }

  // Register the new session creation routes
  app.post('/api/verify/id/create', createIDVerificationSessionHandler);
  app.post('/api/verify/selfie/create', createSelfieSessionHandler);
  app.post('/api/verify/combined/create', createCombinedVerificationSessionHandler);

  // ===== Webhook API Routes =====

  // Register webhook for a session
  app.post('/api/webhooks/register', async (req, res) => {
    try {
      const { sessionId, sessionType, webhookUrl, successUrl, failureUrl } = req.body;
      if (!sessionId) {
        return res.status(400).json({ success: false, error: 'sessionId is required' });
      }
      const result = await registerWebhook({ sessionId, sessionType, webhookUrl, successUrl, failureUrl });
      res.json(result);
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Trigger verification success
  app.post('/api/webhooks/trigger/success', async (req, res) => {
    try {
      const { sessionId, data } = req.body;
      if (!sessionId) {
        return res.status(400).json({ success: false, error: 'sessionId is required' });
      }
      const result = await triggerVerificationSuccess(sessionId, data || {});
      res.json(result);
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Trigger verification failed
  app.post('/api/webhooks/trigger/failed', async (req, res) => {
    try {
      const { sessionId, reason, data } = req.body;
      if (!sessionId) {
        return res.status(400).json({ success: false, error: 'sessionId is required' });
      }
      const result = await triggerVerificationFailed(sessionId, reason || 'Verification failed', data || {});
      res.json(result);
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Trigger session expired
  app.post('/api/webhooks/trigger/expired', async (req, res) => {
    try {
      const { sessionId } = req.body;
      if (!sessionId) {
        return res.status(400).json({ success: false, error: 'sessionId is required' });
      }
      const result = await triggerSessionExpired(sessionId);
      res.json(result);
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Get webhook status
  app.get('/api/webhooks/status/:sessionId', async (req, res) => {
    try {
      const status = await getWebhookStatus(req.params.sessionId);
      if (!status) {
        return res.status(404).json({ success: false, error: 'Webhook not found' });
      }
      res.json({ success: true, data: status });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // List all webhooks
  app.get('/api/webhooks/list', async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const result = await listWebhooks(page, limit);
      res.json(result);
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Webhook receiver endpoint (for testing)
  app.post('/api/webhooks/receive', (req, res) => {
    console.log('[Webhook Received]:', JSON.stringify(req.body, null, 2));
    res.json({ received: true, timestamp: new Date().toISOString() });
  });

  // Get session info
  app.get('/api/verify/session/:id', async (req, res) => {
    try {
      const session = await getSession(req.params.id);
      if (!session) return res.status(404).json({ success: false, error: 'Session not found' });
      return res.json({ success: true, session });
    } catch (e) {
      res.status(500).json({ success: false, error: 'Failed to read session' });
    }
  });

  app.get('/api/session/:id', async (req, res) => {
    try {
      const session = await getSession(req.params.id);
      if (!session) {
        return res.json({
          id: req.params.id,
          status: 'pending',
          payload: { idType: 'national-id', testMode: false },
          createdAt: new Date().toISOString(),
          extractedData: null,
          verificationResult: null,
        });
      }
      
      // Build response with verification results
      const response = {
        id: session.id || req.params.id,
        status: session.status || 'pending',
        payload: session.payload || {},
        createdAt: session.createdAt,
        extractedData: null,
        verificationResult: null,
      };
      
      // Include extracted data if available
      if (session.result?.fields) {
        response.extractedData = session.result.fields;
      } else if (session.result && typeof session.result === 'object' && !session.result.fields) {
        // Handle case where result is the fields directly
        response.extractedData = session.result;
      }
      
      // Include verification result details
      const terminalStatuses = ['done', 'completed', 'success', 'failed', 'cancelled', 'canceled', 'expired'];
      if (terminalStatuses.includes((session.status || '').toLowerCase())) {
        response.verificationResult = {
          status: ['done', 'completed', 'success'].includes((session.status || '').toLowerCase()) ? 'success' : 'failed',
          completedAt: session.finishedAt || null,
        };
        
        // Include face match data if available (from selfie verification)
        if (session.result?.faceMatch) {
          response.verificationResult.faceMatch = session.result.faceMatch;
        }
        
        // Include failure reason if available
        if (session.result?.reason || session.reason) {
          response.verificationResult.reason = session.result?.reason || session.reason;
        }
      }
      
      return res.json(response);
    } catch (e) {
      res.status(500).json({ success: false, error: 'Failed to read session' });
    }
  });

  // Update session result
  async function postSessionResultHandler(req, res) {
    try {
      const id = req.params.id;
      const existing = await getSession(id);
      if (!existing) return res.status(404).json({ success: false, error: 'Session not found' });

      const payload = req.body || {};
      const updated = { ...existing };
      if (payload.status) updated.status = payload.status;
      if (payload.result) updated.result = payload.result;
      if (payload.finishedAt) updated.finishedAt = payload.finishedAt;

      const ttl = Number(payload.ttlSeconds || process.env.VERIFY_SESSION_TTL_SECONDS || 3600);
      await setSession(id, updated, ttl);

      // Fire webhooks for terminal states using new webhook service
      const status = (updated.status || '').toLowerCase();
      const p = updated.payload || {};

      if (['done', 'completed', 'success'].includes(status)) {
        // Trigger success webhook
        const webhookResult = await triggerVerificationSuccess(id, {
          fields: updated.result?.fields || updated.result,
          status: updated.status,
          finishedAt: updated.finishedAt
        });
        
        // Also fire legacy webhooks if configured
        if (p.successWebhook) {
          safePostWebhook(p.successWebhook, { sessionId: id, status: updated.status, result: updated.result });
        }

        // Include redirect URL in response
        if (webhookResult.redirectUrl) {
          updated.redirectUrl = webhookResult.redirectUrl;
        }
      }

      if (['cancelled', 'canceled', 'failed'].includes(status)) {
        // Trigger failed webhook
        const webhookResult = await triggerVerificationFailed(id, payload.reason || 'Verification failed', {
          status: updated.status,
          result: updated.result
        });
        
        // Also fire legacy webhooks if configured
        if (p.cancelWebhook) {
          safePostWebhook(p.cancelWebhook, { sessionId: id, status: updated.status, result: updated.result });
        }

        // Include redirect URL in response
        if (webhookResult.redirectUrl) {
          updated.redirectUrl = webhookResult.redirectUrl;
        }
      }

      if (['done', 'completed', 'success', 'cancelled', 'canceled', 'failed'].includes(status)) {
        cleanupTempForSession(id, { deleteImageFromStorage }).catch(() => { });
      }

      return res.json({ success: true, session: updated });
    } catch (e) {
      console.error('Session update error:', e);
      res.status(500).json({ success: false, error: 'Failed to update session' });
    }
  }

  app.post('/api/verify/session/:id/result', postSessionResultHandler);
  app.post('/verify/session/:id/result', postSessionResultHandler);

  // Get temp session data
  app.get('/api/verify/session/:id/temp', async (req, res) => {
    try {
      const sess = await getSession(req.params.id);
      if (!sess) return res.status(404).json({ success: false, error: 'Session not found' });

      const imageRef = sess.payload?.tempImageRef;
      const ocr = sess.payload?.tempOcr;
      const imageUrl = await getImageUrlFromRef(imageRef);

      let imageData = null;
      if (imageRef?.type === 'local' && imageRef?.url) {
        try {
          const publicDir = path.join(__dirname, 'public');
          const filePath = path.join(publicDir, imageRef.url.replace(/^\//, ''));
          const b = await fsPromises.readFile(filePath);
          const ext = path.extname(filePath).toLowerCase();
          const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
          imageData = `data:${mime};base64,${b.toString('base64')}`;
        } catch (e) { /* ignore */ }
      }

      return res.json({ success: true, imageRef, imageUrl, imageData, ocr });
    } catch (e) {
      res.status(500).json({ success: false, error: 'Failed to read session data' });
    }
  });

  // SSR handler for all pages
  app.use('*', async (req, res, next) => {
    const url = req.originalUrl;

    try {
      let template, render;

      if (!isProduction) {
        // Dev: read fresh template and transform with Vite
        template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        render = (await vite.ssrLoadModule('/src/entry-server.jsx')).render;
      } else {
        // Prod: use built files
        template = fs.readFileSync(
          path.resolve(__dirname, 'dist/client/index.html'),
          'utf-8'
        );
        render = (await import('./dist/server/entry-server.js')).render;
      }

      // Build initial state to pass to React
      const initialState = {
        url,
        session: null,
        config: {
          expectedOrigin: req.get('origin') || '*',
        },
      };

      // Extract session ID from embed routes
      const embedMatch = url.match(/\/embed\/session\/([^/?]+)/);
      if (embedMatch) {
        initialState.session = {
          id: embedMatch[1],
          status: 'pending',
          payload: {
            idType: 'national-id',
            testMode: false,
            authRequired: false,
          },
        };
      }

      // Render the app
      const { html: appHtml, head } = render(url, initialState);

      // Inject rendered content into template
      const html = template
        .replace('<!--app-head-->', head || '')
        .replace('<!--app-html-->', appHtml);

      res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
    } catch (e) {
      if (!isProduction) {
        vite.ssrFixStacktrace(e);
      }
      console.error(e);
      next(e);
    }
  });

  // Start HTTP server
  const httpServer = app.listen(port, host, () => {
    console.log(`HTTP server running at http://${host}:${port}`);
  });

  httpServer.on('error', (err) => {
    console.error('HTTP server error:', err.message);
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} is in use, trying ${port + 1}...`);
      httpServer.listen(port + 1, host);
    }
  });

  // Start HTTPS server if enabled
  if (sslEnabled) {
    try {
      const certPath = path.resolve(__dirname, sslCertPath);
      const keyPath = path.resolve(__dirname, sslKeyPath);

      if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
        const sslOptions = {
          cert: fs.readFileSync(certPath),
          key: fs.readFileSync(keyPath),
        };

        https.createServer(sslOptions, app).listen(sslPort, host, () => {
          console.log(`HTTPS server running at https://${host}:${sslPort}`);
        });
      } else {
        console.warn(`SSL certificates not found at ${certPath} and ${keyPath}`);
        console.warn('HTTPS server not started. Set SSL_ENABLED=false or provide valid certs.');
      }
    } catch (err) {
      console.error('Failed to start HTTPS server:', err.message);
    }
  }
}

createServer();
