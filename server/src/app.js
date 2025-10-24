import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import OCRService from './services/ocrService.js';
import { extractIdentityFromText } from './services/identityExtractor.js';
import { extractFieldsUsingOpenAI } from './services/openaiExtractor.js';

import sessionStore from './sessionStore.js';
import storageModule from './storage.js';

const { getSession, setSession, deleteSession, makeSessionId, cleanupTempForSession, initRedisClient } = sessionStore;
const { uploadImageToStorage, deleteImageFromStorage, getImageUrlFromRef } = storageModule;

// Initialize redis client if configured (dynamic import inside sessionStore init)
(async () => {
  try {
    const redisModule = await import('redis');
    const { createClient } = redisModule;
    const redisUrl = process.env.REDIS_URL || process.env.IDENTITY_REDIS_URL || '';
    if (redisUrl) {
      await initRedisClient(createClient, redisUrl);
    }
  } catch (e) {
    // sessionStore will fall back to in-memory behavior; already logged there
  }
})();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const ocrService = new OCRService();

// Helper to POST JSON to a webhook URL (best-effort, non-blocking)
async function safePostWebhook(url, body) {
  if (!url) return;
  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const signal = controller ? controller.signal : undefined;
    if (controller) setTimeout(() => controller.abort(), 6000);
    await fetch(String(url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
      signal
    });
    console.info('[identity] webhook POST succeeded', url);
  } catch (e) {
    console.warn('[identity] webhook POST failed', url, e && e.message ? e.message : e);
  }
}

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

// ---------- Identity verification iframe/session endpoints ----------
// Create a verification session: returns a server-hosted iframe wrapper URL plus direct admin URL
async function createVerifySessionHandler(req, res) {
  try {
    const payload = req.body || {};
    const sessionId = makeSessionId();
    const now = Date.now();
    // store minimal payload: who requested and optional customer id / returnTo
    // Normalize/store requested fields: origin, idType, successUrl, webhooks, testMode
    const storedPayload = { ...(payload || {}) };
    if (payload.origin) storedPayload.origin = payload.origin;
    if (payload.idType) storedPayload.idType = payload.idType;
    if (payload.successUrl) storedPayload.successUrl = payload.successUrl;
    // Optional webhook URLs that caller can provide to be notified on success or cancellation
    if (payload.successWebhook) storedPayload.successWebhook = payload.successWebhook;
    if (payload.cancelWebhook) storedPayload.cancelWebhook = payload.cancelWebhook;
    // Test mode flag - when true, enables testing/debugging features
    if (typeof payload.testMode === 'boolean') storedPayload.testMode = payload.testMode;
    // Auth required flag - when true in test mode, requires authentication
    if (typeof payload.authRequired === 'boolean') storedPayload.authRequired = payload.authRequired;

    const sessionObj = { id: sessionId, createdAt: now, payload: storedPayload, status: 'pending' };
    const ttl = Number(payload.ttlSeconds || process.env.VERIFY_SESSION_TTL_SECONDS || 60 * 60);
    await setSession(sessionId, sessionObj, ttl);

    // Build wrapper URL hosted by this server which will render an iframe pointing to admin frontend
    const origin = req.protocol + '://' + req.get('host');
    const wrapperUrl = `${origin}/verify/session/${sessionId}`;

    // Build an identity-provider-hosted iframe URL which loads the camera UI in embed mode.
    // Caller can open this iframe directly to show the identity camera UI hosted by this server.
    let iframeUrl = `${origin}/embed/session/${sessionId}`;
    if (payload && payload.origin) {
      // encode origin into iframe URL so embed can parse it
      const enc = encodeURIComponent(String(payload.origin));
      iframeUrl += `?expectedOrigin=${enc}`;
    }

    // Build a direct frontend URL that admin UI can open in an iframe directly if desired.
    // Allow caller to pass `frontendBase` in payload to target a different host (e.g., dev server).
    const frontendBase = (payload.frontendBase || process.env.FRONTEND_BASE || '').replace(/\/$/, '');
    // Default to relative path if frontendBase not provided — clients may resolve it appropriately.
    const adminPath = `/admin/qrcustomer?verify_session=${encodeURIComponent(sessionId)}`;
    const directAdminUrl = frontendBase ? `${frontendBase}${adminPath}` : adminPath;

    console.log("Create a identity verification session id type:", payload.idType || 'not specified', "origin:", payload.origin || req.get('origin') || 'unknown');
    res.json({ success: true, sessionId, wrapperUrl, directAdminUrl, iframeUrl });
  } catch (e) {
    console.error('Create verify session error', e);
    res.status(500).json({ success: false, error: 'Failed to create verification session' });
  }
}

// Register handler on both API path and non-API path to support different client base URLs
app.post('/api/verify/create', createVerifySessionHandler);
app.post('/verify/create', createVerifySessionHandler);

// Return JSON info about a session
app.get('/api/verify/session/:id', async (req, res) => {
  try {
    const id = String(req.params.id || '');
    const session = await getSession(id);
    if (!session) return res.status(404).json({ success: false, error: 'Session not found' });
    return res.json({ success: true, session });
  } catch (e) {
    console.error('getSession error', e);
    return res.status(500).json({ success: false, error: 'Failed to read session' });
  }
});

// Serve an iframe wrapper HTML page for a session which embeds the admin QR customer route
app.get('/verify/session/:id', async (req, res) => {
  try {
    const id = String(req.params.id || '');
    const session = await getSession(id);
    if (!session) return res.status(404).send('Verification session not found');

    // Determine frontend base — accept query param ?frontendBase= or environment var
    const frontendBase = (req.query.frontendBase || process.env.FRONTEND_BASE || '').replace(/\/$/, '');
    const adminPath = `/admin/qrcustomer?verify_session=${encodeURIComponent(id)}`;
    const iframeSrc = frontendBase ? `${frontendBase}${adminPath}` : adminPath;

    // Return a minimal responsive HTML page containing the iframe. Clients can open this wrapper URL.
    const html = `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <title>Identity Verification</title>
      <style>
        html,body{height:100%;margin:0;padding:0;overflow:hidden}
        .frame-wrap{height:100vh;display:flex;align-items:stretch}
        iframe{flex:1;border:0;width:100%;height:100%;display:block;}
      </style>
    </head>
    <body>
      <div class="frame-wrap">
        <iframe src="${iframeSrc}" title="Identity verification" allow="camera; microphone; fullscreen"></iframe>
      </div>
    </body>
  </html>`;

    res.set('Content-Type', 'text/html; charset=utf-8').send(html);
  } catch (e) {
    console.error('getSession error', e);
    return res.status(500).send('Failed to read session');
  }
});

// Serve an embed-only page for camera (minimal chrome) for a session id
app.get('/embed/session/:id', async (req, res) => {
  try {
    const id = String(req.params.id || '');
    const session = await getSession(id);
    if (!session) return res.status(404).send('Verification session not found');

    // Serve the same index.html but with a query param ?embed=1&session=ID to trigger embed-only behavior
    const origin = req.protocol + '://' + req.get('host');
    const embedUrl = `/embed/page.html?session=${encodeURIComponent(id)}`;
    // Determine expected origin for postMessage: prefer explicit query param, then frontendBase/env, then referer header
    const expectedRaw = (req.query.expectedOrigin || req.query.frontendBase || process.env.FRONTEND_BASE || req.get('referer') || '');
    let expectedOrigin = '*';
    try {
      if (expectedRaw) {
        const u = new URL(expectedRaw, origin);
        expectedOrigin = u.origin || '*';
      }
    } catch (e) {
      expectedOrigin = '*';
    }
    // Check if this is test mode - if so, show only authorization buttons
    const isTestMode = session && session.payload && session.payload.testMode === true;

    if (isTestMode) {
      // Show only authorization buttons for test mode
      const testModeHtml = `<!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <title>Identity Verification Test Mode</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            body { margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
            .container { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
            .card { background: white; padding: 2rem; border-radius: 1rem; box-shadow: 0 20px 50px rgba(0,0,0,0.2); max-width: 400px; width: 90%; text-align: center; }
            .title { font-size: 1.5rem; font-weight: bold; margin-bottom: 0.5rem; color: #1f2937; }
            .subtitle { color: #6b7280; margin-bottom: 2rem; font-size: 0.95rem; }
            .btn { padding: 0.75rem 1.5rem; border-radius: 0.5rem; font-weight: 600; cursor: pointer; transition: all 0.2s; margin: 0.5rem; min-width: 120px; border: none; font-size: 1rem; }
            .btn-authorize { background: #10b981; color: white; }
            .btn-authorize:hover { background: #059669; transform: translateY(-1px); }
            .btn-skip { background: #6b7280; color: white; }
            .btn-skip:hover { background: #4b5563; transform: translateY(-1px); }
            .test-indicator { position: fixed; top: 1rem; right: 1rem; background: #f59e0b; color: white; padding: 0.5rem 1rem; border-radius: 0.5rem; font-size: 0.8rem; font-weight: bold; }
            .auth-info { background: #f3f4f6; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1.5rem; font-size: 0.9rem; color: #374151; }
          </style>
        </head>
        <body>
          <div class="test-indicator">🧪 TEST MODE</div>
          <div class="container">
            <div class="card">
              <div class="title">Authorization Test</div>
              <div class="subtitle">Test Mode - Choose Authorization Flow</div>
              
              <div class="auth-info">
                This is a test mode simulation. Choose how you want to proceed with the identity verification process.
              </div>
              
              <div>
                <button class="btn btn-authorize" onclick="handleAuthorize(true)">
                  🔐 Authorize & Proceed
                </button>
                <br>
                <button class="btn btn-skip" onclick="handleAuthorize(false)">
                  ❌ Cancel Authorization
                </button>
              </div>
              
              <div style="margin-top: 2rem; font-size: 0.8rem; color: #9ca3af;">
                Session: ${session.id}<br>
                Mode: Test Mode
              </div>
            </div>
          </div>

          <script>
            window.__IDENTITY_SESSION__ = ${JSON.stringify(id)};
            window.__IDENTITY_EXPECTED_ORIGIN__ = ${JSON.stringify(expectedOrigin)};
            window.__IDENTITY_TEST_MODE__ = true;

            function handleAuthorize(authorized) {
              console.log('🧪 [TEST MODE] Authorization choice:', authorized ? 'Authorized' : 'Skipped');
              
              // Create result payload with mock identity data if authorized
              const result = {
                action: authorized ? 'success' : 'cancel',
                testMode: true,
                authorized: authorized,
                timestamp: new Date().toISOString(),
                sessionId: window.__IDENTITY_SESSION__
              };

              // Add mock identity fields if authorized
              if (authorized) {
                
                result.fields = {
                  firstName: 'John',
                  lastName: 'Doe',
                  id_number: 'ID123456789', 
                  birthDate: '1990-01-15',
                  confidence: 'high',
                  phone_number: '0912 345 6789',
                  id_type: window.__IDENTITY_REQUESTED_ID_TYPE__
                };
                result.rawText = 'REPUBLIC OF THE PHILIPPINES\\nDRIVER\\'S LICENSE\\nLAST NAME: DOE\\nFIRST NAME: JOHN\\nID NO: ID123456789\\nBIRTH DATE: 01/15/1990\\nTEST MODE SAMPLE DATA';
              }

              // Notify parent window if embedded
              if (window.parent && window.parent !== window) {
                const message = {
                  identityOCR: {
                    action: 'test_auth_complete',
                    authorized: authorized,
                    result: result,
                    session: window.__IDENTITY_SESSION__
                  }
                };
                
                const targetOrigin = window.__IDENTITY_EXPECTED_ORIGIN__ || '*';
                window.parent.postMessage(message, targetOrigin);
                console.log('🧪 [TEST MODE] Sent result to parent:', message);
              }

              // Update session on server
              updateSessionResult(result, authorized);
              
              // Show confirmation
              showConfirmation(authorized);
            }

            async function updateSessionResult(result, authorized) {
              try {
                const sessionId = window.__IDENTITY_SESSION__;
                const status = authorized ? 'done' : 'cancelled';
                
                // Prepare payload similar to camera mode
                const payload = {
                  status: status,
                  result: result,
                  finishedAt: new Date().toISOString()
                };

                // If authorized, add the mock fields to match camera mode structure
                if (authorized && result.fields) {
                  payload.result.fields = result.fields;
                  payload.result.rawText = result.rawText;
                }
                
                const response = await fetch(\`/api/verify/session/\${sessionId}/result\`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload)
                });
                
                console.log('🧪 [TEST MODE] Session updated:', await response.json());
              } catch (error) {
                console.error('🧪 [TEST MODE] Failed to update session:', error);
              }
            }

            function showConfirmation(authorized) {
              const card = document.querySelector('.card');
              const status = authorized ? 'Authorized' : 'Cancelled';
              const icon = authorized ? '✅' : '❌';
              const color = authorized ? '#10b981' : '#ef4444';
              
              card.innerHTML = \`
                <div style="color: \${color}; font-size: 3rem; margin-bottom: 1rem;">\${icon}</div>
                <div class="title">\${status}</div>
                <div class="subtitle">Test mode authorization complete</div>
                <div class="auth-info">
                  The authorization choice has been recorded and sent to the parent application.
                </div>
                <button class="btn btn-skip" onclick="window.close()" style="margin-top: 1rem;">
                  Close
                </button>
              \`;
            }
          </script>
        </body>
      </html>`;

      return res.set('Content-Type', 'text/html; charset=utf-8').send(testModeHtml);
    }

    // We'll serve a simple HTML wrapper that loads the public assets but includes embed flag and expected origin
    const html = `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>Identity Verification (Embed)</title>
        <link rel="stylesheet" href="/css/style.css">
        <!-- Tailwind for matching styles like index.html -->
        <script src="https://cdn.tailwindcss.com"></script>
        <script>tailwind.config = { darkMode: 'class', theme: { extend: {} } }</script>
        <style>
          /* Embed-specific overrides: make camera fill iframe and prevent scrolling */
          *, *::before, *::after { box-sizing: border-box; }
          html, body { height: 100%; margin: 0; padding: 0; overflow: hidden; }
          .app-container, main { height: 100%; width: 100%; margin: 0; padding: 0; overflow: hidden; }
          main { display: flex; flex-direction: column; height: 100%; }
          .grid { gap: 0; height: 100%; grid-template-columns: 1fr; }
          .camera-section { flex: 1 1 auto; width: 100%; height: 100%; padding: 0; margin: 0; display:flex; align-items:stretch; }
          .camera-container { position: relative; width: 100%; height: 100%; border-radius: 0; border: 0; overflow: hidden; }
          .camera-container video { width: 100% !important; height: 100% !important; object-fit: cover !important; display:block; }
          .overlay-container { position: absolute; inset: 0; display:flex; align-items:center; justify-content:center; pointer-events: none; }
          .guide-rectangle { width: 80%; height: 60%; max-width: 100%; max-height: 100%; }
          /* Hide right column if present */
          .results-section { display: none !important; }
          /* Camera controls float over the video */
          .camera-controls { position: absolute; bottom: 12px; left: 12px; z-index: 2000; pointer-events: auto; }
        </style>
          <script>
          // Do NOT mark embed true until user gives consent. main.js will auto-start camera when embed=true.
          window.__IDENTITY_EMBED__ = false;
          window.__IDENTITY_CONSENT_GIVEN__ = false;
          window.__IDENTITY_SESSION__ = ${JSON.stringify(id)};
          window.__IDENTITY_EXPECTED_ORIGIN__ = ${JSON.stringify(expectedOrigin)};
          // Optional success webhook url provided at session creation time
          window.__IDENTITY_SUCCESS_URL__ = ${JSON.stringify((session && session.payload && session.payload.successUrl) ? session.payload.successUrl : null)};
          // Expose requested idType from session payload if provided
          window.__IDENTITY_REQUESTED_ID_TYPE__ = ${JSON.stringify((session && session.payload && session.payload.idType) ? session.payload.idType : null)};
          // Expose testMode flag from session payload if provided
          window.__IDENTITY_TEST_MODE__ = ${JSON.stringify((session && session.payload && typeof session.payload.testMode === 'boolean') ? session.payload.testMode : false)};
          // Expose authRequired flag from session payload if provided
          window.__IDENTITY_AUTH_REQUIRED__ = ${JSON.stringify((session && session.payload && typeof session.payload.authRequired === 'boolean') ? session.payload.authRequired : false)};

          // Safe helper to start camera once identityOCRApp is ready
          function safeStartCamera(timeoutMs = 5000) {
            const start = () => {
              try {
                if (window.identityOCRApp && typeof window.identityOCRApp.startCamera === 'function') {
                  window.identityOCRApp.startCamera();
                  return true;
                }
              } catch (e) { /* ignore */ }
              return false;
            };

            if (start()) return;
            const interval = 200;
            let elapsed = 0;
            const t = setInterval(() => {
              elapsed += interval;
              if (start() || elapsed >= timeoutMs) {
                clearInterval(t);
              }
            }, interval);
          }

          // Called when user accepts privacy consent
          function __IDENTITY_ON_CONSENT_ACCEPT__() {
            window.__IDENTITY_CONSENT_GIVEN__ = true;
            window.__IDENTITY_EMBED__ = true; // now it's safe to consider this an embed
            // hide consent UI (DOM element handled below)
            const el = document.getElementById('consentOverlay');
            if (el) el.style.display = 'none';
            // Start camera when available
            safeStartCamera(8000);
            // Also hide the explicit Start button (camera will be started automatically)
            try {
              setTimeout(() => {
                const startBtn = document.getElementById('start-camera');
                if (startBtn) startBtn.style.display = 'none';
                const switchBtn = document.getElementById('switch-camera');
                if (switchBtn) switchBtn.style.display = 'inline-flex';
              }, 800);
            } catch (e) { /* ignore */ }
          }

          // Called when user declines consent
          async function __IDENTITY_ON_CONSENT_DECLINE__() {
            try {
              window.__IDENTITY_CONSENT_GIVEN__ = false;
              window.__IDENTITY_EMBED__ = false;
            } catch (e) { /* ignore */ }

            // Show a clear inline message in the consent overlay
            try {
              const el = document.getElementById('consentOverlay');
              if (el) {
                el.style.display = 'flex';
                el.innerHTML = '';
                const box = document.createElement('div');
                box.style.maxWidth = '720px';
                box.style.width = '92%';
                box.style.background = 'white';
                box.style.borderRadius = '8px';
                box.style.padding = '20px';
                box.style.boxShadow = '0 10px 40px rgba(2,6,23,0.5)';
                const h = document.createElement('h3');
                h.textContent = 'Consent declined';
                h.style.margin = '0 0 8px 0';
                h.style.fontSize = '1.1rem';
                const p = document.createElement('div');
                p.style.color = '#334155';
                p.style.marginTop = '6px';
                p.textContent = 'You declined the camera consent. The camera will remain disabled and the verification has been cancelled.';
                box.appendChild(h);
                box.appendChild(p);
                el.appendChild(box);
              }
            } catch (e) { /* ignore */ }

            // If embedded, notify parent to close the iframe/modal (retry a few times)
            try {
                if (window.parent && window.parent !== window) {
                  const payload = { identityOCR: { action: 'close', reason: 'consent_declined', session: sid } };
                  const targetOrigin = window.__IDENTITY_EXPECTED_ORIGIN__ || '*';
                  for(let i=0;i<3;i++){
                    try{ window.parent.postMessage(payload, targetOrigin); }catch(e){ /* ignore */ }
                    await new Promise(r=>setTimeout(r,200));
                  }
                }
            } catch (e) { console.warn('[identity] consent decline notify failed', e); }
            // Also attempt to update session status on the server (best-effort)
            try {
              const sid = window.__IDENTITY_SESSION__;
              if (sid) {
                const url = '/api/verify/session/' + encodeURIComponent(sid) + '/result';
                fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'cancelled', finishedAt: new Date().toISOString() }) }).catch(e => console.warn('[identity] session cancel notify failed', e));
              }
            } catch (e) { /* ignore */ }
          }
        </script>
      </head>
      <body class="bg-gray-50 text-gray-900">
        <div class="app-container min-h-screen">
          <main class="mx-auto max-w-7xl">
            <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <!-- Left: Camera + Controls (copied from index.html for consistent design) -->
              <div class="camera-section space-y-4">
                <div class="camera-container relative overflow-hidden bg-black shadow-sm">
                  <video id="video" autoplay muted playsinline class="h-64 w-full object-cover sm:h-72 md:h-80 lg:h-[26rem]"></video>
                  <canvas id="canvas" style="display: none;"></canvas>
                  <!-- Hidden preview image for embed mode (off-screen) to keep capture flow robust when UI elements are removed -->
                  <img id="preview-image" alt="preview" style="display:none; width:1px; height:1px; position:absolute; left:-9999px; top:-9999px;" />

                  <!-- Rectangle guide overlay -->
                  <div class="overlay-container pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div class="guide-rectangle rounded-xl border-2 border-dashed border-white/70" style="width:80%; height:60%;"></div>
                    <div id="alignment-feedback" class="alignment-feedback absolute left-1/2 bottom-1/4 w-[94%] -translate-x-1/2 rounded-lg">
                      <div class="feedback-message text-center text-xs font-semibold tracking-wide text-white sm:text-sm">Center your document</div>
                    </div>
                  </div>
                  <!-- Privacy consent overlay - shown before any camera is activated -->
                  <div id="consentOverlay" style="position:fixed; inset:0; z-index:99999; display:flex; align-items:center; justify-content:center; background:rgba(2,6,23,0.6);">
                    <div style="max-width:720px; width:92%; background:white; border-radius:8px; padding:20px; box-shadow:0 10px 40px rgba(2,6,23,0.5);">
                      <h2 style="margin:0 0 8px 0; font-size:1.25rem;">Privacy & Camera Consent</h2>
                        <p class="mb-3 text-sm text-gray-700 dark:text-gray-300">This verification will capture images to extract identity data (name, DOB, ID number). By continuing you consent to allow the camera to capture images and to send them to the verification service. Do not proceed if you do not consent.</p>
                        <p class="mb-4 text-sm text-gray-700 dark:text-gray-300"><strong>Image quality guidance:</strong></p>
                        <ul class="list-disc pl-5 mb-4 text-sm text-gray-700 dark:text-gray-300">
                          <li>Use good, even lighting — avoid strong backlight or heavy shadows.</li>
                          <li>Ensure the image is sharp and not blurred.</li>
                          <li>Make sure the entire document or face is visible and not cropped.</li>
                          <li>The document or photo must belong to you — do not submit someone else’s ID or photo.</li>
                        </ul>
                      <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:12px;">
                        <button onclick="__IDENTITY_ON_CONSENT_DECLINE__()" style="padding:8px 12px; border-radius:6px; background:#e5e7eb; border:0;">Decline</button>
                        <button onclick="__IDENTITY_ON_CONSENT_ACCEPT__()" style="padding:8px 12px; border-radius:6px; background:#0ea5e9; color:white; border:0;">I Consent & Start Camera</button>
                      </div>
                    </div>
                  </div>
                  <script>
                    // If the embed requested a particular id type, preselect the dropdown
                    document.addEventListener('DOMContentLoaded', () => {
                      try {
                        const requested = window.__IDENTITY_REQUESTED_ID_TYPE__;
                        if (requested) {
                          const el = document.getElementById('id-type');
                          if (el) {
                            el.value = requested;
                          }
                        }
                      } catch (e) { /* ignore */ }
                      // Listen for configuration messages (e.g., from demo harness) to set id type dynamically
                      try {
                        window.addEventListener('message', (evt) => {
                          try {
                            const expected = window.__IDENTITY_EXPECTED_ORIGIN__ || '*';
                            if (expected !== '*' && evt.origin !== expected) return; // enforce expected origin when provided
                            console.log('[embed] received postMessage', evt.origin, evt.data);
                            const msg = evt.data;
                            if (!msg || !msg.identityOCR) return;
                            const payload = msg.identityOCR;
                            if (payload.action === 'configure' && payload.idType) {
                              const el = document.getElementById('id-type');
                              if (el) el.value = payload.idType;
                              // let the main app react if present (resize guides / adjust ROI)
                              try { if (window.identityOCRApp && typeof window.identityOCRApp.sizeGuideRectangle === 'function') window.identityOCRApp.sizeGuideRectangle(); } catch(e){}
                            }
                          } catch (e) { /* ignore message handler errors */ }
                        });
                      } catch (e) { /* ignore */ }
                    });
                  </script>
                </div>

                <div class="camera-controls flex flex-wrap items-center gap-3">
                  <!-- Start and Switch camera buttons removed for embed; camera will auto-start (back-facing) after consent -->
                  <button id="recapture-btn" class="btn btn-primary inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow" style="display:none;">Recapture</button>
                  <select id="ocr-type" style="display:none;"><option value="identity" selected>Identity Document</option></select>
                </div>

                <!-- Hidden debug/data area: kept in DOM so client code can update preview/results/loading without showing UI -->
                <div id="hidden-data" aria-hidden="true" style="display:none; position:absolute; left:-9999px; top:-9999px; width:1px; height:1px; overflow:hidden;">
                  <!-- off-screen preview image (also used by displayPreview) -->
                  <img id="preview-image" alt="preview" style="display:none; width:1px; height:1px;" />
                  <!-- Hidden ID type selector so scanning logic can read the chosen id type -->
                  <select id="id-type" style="display:none;">
                    <option value="national-id" selected>National ID</option>
                    <option value="passport">Passport</option>
                    <option value="umid">UMID</option>
                  </select>
                  <!-- captured image holder (unused visually but available for debug or server fetch) -->
                  <img id="captured-image" alt="captured" style="display:none; width:1px; height:1px;" />
                  <!-- results container expected by ocr.js -->
                  <div id="results-container" style="display:none;"></div>
                  <!-- loading indicator element (ocr.js will toggle) -->
                  <div id="loading" style="display:none;">Loading...</div>
                  <!-- container to hold parsed OCR JSON or raw text if client writes it -->
                  <pre id="ocr-result" style="display:none; white-space:pre-wrap;">{
                  }</pre>
                  <!-- details section placeholder referenced by showFinalDetailsOnly -->
                  <div class="details-section" style="display:none;"></div>
                </div>
              </div>

              <!-- Right column (results/preview) removed for embed: extracted details, captured image and OCR results are now hidden by default -->
            </div>
          </main>
        </div>

        <!-- include scanning algorithms and scripts in same order as index.html -->
        <script src="/js/camera.js"></script>
        <script src="/js/alignment.js"></script>
        <script src="/js/scanning-algorithm/umid.js"></script>
        <script src="/js/scanning-algorithm/passport.js"></script>
        <script src="/js/scanning-algorithm/national-id.js"></script>
        <script src="/js/ocr.js"></script>
        <script src="/js/main.js"></script>
      </body>
    </html>`;

    res.set('Content-Type', 'text/html; charset=utf-8').send(html);
  } catch (e) {
    console.error('embed route error', e);
    return res.status(500).send('Failed to serve embed page');
  }
});

// POST result/update for a session - allows identity server or external process to push verification results
async function postSessionResultHandler(req, res) {
  try {
    const id = String(req.params.id || '');
    if (!id) return res.status(400).json({ success: false, error: 'Missing session id' });
    const existing = await getSession(id);
    if (!existing) return res.status(404).json({ success: false, error: 'Session not found' });

    const payload = req.body || {};
    // Allowed fields to update: status, result, payload (merge), finishedAt
    const allowedUpdate = {};
    if (payload.status) allowedUpdate.status = String(payload.status);
    if (payload.result) allowedUpdate.result = payload.result;
    if (payload.payload && typeof payload.payload === 'object') allowedUpdate.payload = { ...(existing.payload || {}), ...payload.payload };
    if (payload.finishedAt) allowedUpdate.finishedAt = payload.finishedAt;

    const updated = { ...existing, ...allowedUpdate };
    // If caller provided ttlSeconds, refresh TTL
    const ttl = Number(payload.ttlSeconds || process.env.VERIFY_SESSION_TTL_SECONDS || 60 * 60);
    await setSession(id, updated, ttl);

    // Fire webhooks for terminal states (best-effort)
    try {
      const s = updated || {};
      const p = s.payload || {};
      const status = (s.status || '').toLowerCase();
      const result = s.result || null;
      if (['done', 'completed', 'success'].includes(status) && p.successWebhook) {
        // send minimal payload
        safePostWebhook(p.successWebhook, { sessionId: id, status: s.status, result });
      }
      if (['cancelled', 'canceled', 'failed'].includes(status) && p.cancelWebhook) {
        safePostWebhook(p.cancelWebhook, { sessionId: id, status: s.status, result });
      }
      // If terminal, cleanup temporary storage (best-effort)
      if (['done', 'completed', 'success', 'cancelled', 'canceled', 'failed'].includes(status)) {
        try { await cleanupTempForSession(id, { deleteImageFromStorage }); } catch (e) { /* ignore */ }
      }
    } catch (e) {
      console.warn('[identity] webhook dispatch error', e && e.message ? e.message : e);
    }

    return res.json({ success: true, session: updated });
  } catch (e) {
    console.error('POST session result error', e);
    return res.status(500).json({ success: false, error: 'Failed to update session' });
  }
}

app.post('/api/verify/session/:id/result', postSessionResultHandler);
app.post('/verify/session/:id/result', postSessionResultHandler);

// Retrieve temporary image and OCR stored for a session (if any)
app.get('/api/verify/session/:id/temp', async (req, res) => {
  try {
    const id = String(req.params.id || '');
    if (!id) return res.status(400).json({ success: false, error: 'Missing session id' });
    let imageRef = null;
    let ocr = null;
    if (useRedis && redisClient) {
      try {
        const rawRef = await redisClient.get(`verify:image_ref:${id}`);
        imageRef = rawRef ? JSON.parse(rawRef) : null;
        const raw = await redisClient.get(`verify:ocr:${id}`);
        ocr = raw ? JSON.parse(raw) : null;
      } catch (e) { console.warn('[identity] redis read temp failed', e); }
    }
    if (!imageRef) {
      const sess = await getSession(id);
      if (sess && sess.payload) {
        imageRef = sess.payload.tempImageRef || null;
        ocr = sess.payload.tempOcr || null;
      }
    }

    // Resolve image URL (S3 presign or local URL) via storage helper
    let imageUrl = null;
    try {
      imageUrl = await getImageUrlFromRef(imageRef);
    } catch (e) { /* ignore */ }

    return res.json({ success: true, imageRef, imageUrl, ocr });
  } catch (e) {
    console.error('get temp session data error', e);
    return res.status(500).json({ success: false, error: 'Failed to read temp session data' });
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
        // Extract raw text using Google Vision OCR on the server
        result = await ocrService.extractIdentityText(imageBuffer);

        if (result.success) {
          const rawText = result.basicText?.text || result.structuredText?.text || '';
          const fields = await extractIdentityFromText(rawText, { idType: idType || 'national-id' });

          result.fields = fields;
          result.rawText = rawText;
          // If OpenAI configured, attempt to improve or supplement extracted fields using model
          try {
            const openaiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || null;
            if (openaiKey) {
              const imageUrl = null; // we could provide a presigned URL if desired
              const oa = await extractFieldsUsingOpenAI({ rawText: rawText || '', imageUrl, idType: idType || 'national-id' });
              if (oa) {
                // Log the entire OpenAI full response for auditing (redact keys in prod if needed)
                try { console.info('[identity] openai full response for session', sid, oa.fullResponse ? oa.fullResponse : oa); } catch (e) { /* ignore logging errors */ }
                if (oa.success && oa.parsed) {
                  // Merge in parsed fields but do not overwrite existing non-null values
                  const merged = { ...(result.fields || {}) };
                  for (const k of ['firstName', 'lastName', 'idNumber', 'birthDate', 'confidence']) {
                    const v = oa.parsed[k];
                    if (v !== undefined && v !== null && (merged[k] === undefined || merged[k] === null || merged[k] === '')) {
                      merged[k] = v;
                    }
                  }
                  result.fields = merged;
                  result.openai = { raw: oa.rawAssistant || null, parsed: oa.parsed };
                } else if (!oa.success) {
                  result.openai = { error: oa.error || 'openai failed' };
                }
              }
            }
          } catch (e) { console.warn('[identity] openai field extraction failed', e); }
        }
        // If the request included a sessionId, store the captured image and OCR result in Redis (temporary)
        try {
          const sid = String(req.body.sessionId || req.query.sessionId || '');
          if (sid) {
            const ttlSeconds = Number(process.env.VERIFY_SESSION_TTL_SECONDS || 60 * 60);
            // Store base64 image and OCR JSON in Redis if available, otherwise attach to in-memory session payload
            // Upload image to storage (S3 or local) and store reference in Redis/session
            let imageRef = null;
            try {
              imageRef = await uploadImageToStorage(base64Data, sid);
            } catch (e) { console.warn('[identity] uploadImageToStorage failed', e); }

            // Log the OCR result server-side for debugging/audit
            try {
              console.info('[identity] OCR result for session', sid, {
                fields: result.fields || null,
                rawText: (result.rawText || result.basicText?.text || result.structuredText?.text) || null
              });
            } catch (e) { /* ignore logging errors */ }

            if (useRedis && redisClient) {
              try {
                if (imageRef) await redisClient.set(`verify:image_ref:${sid}`, JSON.stringify(imageRef), { EX: ttlSeconds });
                await redisClient.set(`verify:ocr:${sid}`, JSON.stringify(result || {}), { EX: ttlSeconds });
                console.info('[identity] stored imageRef+ocr for session in redis', sid);
              } catch (e) {
                console.warn('[identity] redis store failed, falling back to session payload', e && e.message ? e.message : e);
                const existing = await getSession(sid);
                if (existing) {
                  const upd = { ...(existing.payload || {}), tempImageRef: imageRef, tempOcr: result };
                  existing.payload = upd;
                  await setSession(sid, existing, ttlSeconds);
                }
              }
            } else {
              const existing = await getSession(sid);
              if (existing) {
                const upd = { ...(existing.payload || {}), tempImageRef: imageRef, tempOcr: result };
                existing.payload = upd;
                await setSession(sid, existing, ttlSeconds);
              }
            }


            // Update session status/result and notify webhooks if terminal
            try {
              const existing = await getSession(sid);
              if (existing) {
                // merge result into session.result
                const updated = { ...existing };
                updated.result = { ...(updated.result || {}), fields: result.fields, rawText: result.rawText };
                // If required fields present, mark done
                const required = ['firstName', 'lastName', 'idNumber'];
                const missing = required.filter(k => !result.fields || !result.fields[k]);
                if (missing.length === 0) {
                  updated.status = 'done';
                  updated.finishedAt = new Date().toISOString();
                } else {
                  updated.status = 'processing';
                }
                const ttl2 = Number(process.env.VERIFY_SESSION_TTL_SECONDS || 60 * 60);
                await setSession(sid, updated, ttl2);

                // Dispatch webhooks for terminal state (best-effort)
                try {
                  const p = updated.payload || {};
                  if (['done', 'completed', 'success'].includes(String(updated.status).toLowerCase()) && p.successWebhook) {
                    safePostWebhook(p.successWebhook, { sessionId: sid, status: updated.status, result: updated.result });
                  }
                  if (['cancelled', 'canceled', 'failed'].includes(String(updated.status).toLowerCase()) && p.cancelWebhook) {
                    safePostWebhook(p.cancelWebhook, { sessionId: sid, status: updated.status, result: updated.result });
                  }
                } catch (e) { console.warn('[identity] webhook dispatch after ocr failed', e); }
              }
            } catch (e) { console.warn('[identity] session update after ocr failed', e); }
          }
        } catch (e) { console.warn('[identity] failed to store temp image/ocr', e); }
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
