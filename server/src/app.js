import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import OCRService from './services/ocrService.js';
import { extractIdentityFromText } from './services/identityExtractor.js';

// Optional Redis client (used if REDIS_URL or IDENTITY_REDIS_URL env var is set)
let redisClient = null;
let useRedis = false;
(async () => {
  try {
    const redisModule = await import('redis');
    const { createClient } = redisModule;
    const redisUrl = process.env.REDIS_URL || process.env.IDENTITY_REDIS_URL || '';
    if (redisUrl) {
      redisClient = createClient({ url: redisUrl });
      redisClient.on('error', (err) => console.error('Redis client error', err));
      await redisClient.connect();
      useRedis = true;
      console.log('[identity] Connected to Redis at', redisUrl);
    }
  } catch (e) {
    console.warn('[identity] Redis not configured or not available; using in-memory sessions');
    redisClient = null;
    useRedis = false;
  }
})();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const ocrService = new OCRService();

// In-memory verification sessions store (simple; for production use persistent store)
const verifySessions = new Map();

// Storage helpers: get/set/delete session either from Redis or in-memory Map
async function getSession(id) {
  if (!id) return null;
  if (useRedis && redisClient) {
    try {
      const raw = await redisClient.get(`verify:${id}`);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('Redis getSession error', e);
      return verifySessions.get(id) || null;
    }
  }
  const s = verifySessions.get(id) || null;
  if (!s) return null;
  // in-memory TTL handling: if expired, remove and return null
  if (s.expiresAt && Number(s.expiresAt) > 0 && Date.now() > Number(s.expiresAt)) {
    try { verifySessions.delete(id); } catch (e) { /* ignore */ }
    return null;
  }
  return s;
}

async function setSession(id, sessionObj, ttlSeconds = 60 * 60) {
  if (!id) return;
  if (useRedis && redisClient) {
    try {
      await redisClient.set(`verify:${id}`, JSON.stringify(sessionObj), { EX: ttlSeconds });
      return;
    } catch (e) {
      console.error('Redis setSession error', e);
      verifySessions.set(id, sessionObj);
      return;
    }
  }
  // store with expiresAt so in-memory sessions have TTL semantics
  try {
    const copy = { ...(sessionObj || {}) };
    copy.expiresAt = Date.now() + Number(ttlSeconds) * 1000;
    verifySessions.set(id, copy);
  } catch (e) {
    verifySessions.set(id, sessionObj);
  }
}

async function deleteSession(id) {
  if (!id) return;
  if (useRedis && redisClient) {
    try { await redisClient.del(`verify:${id}`); return; } catch (e) { console.error('Redis deleteSession error', e); }
  }
  verifySessions.delete(id);
}

// Periodic cleanup for expired in-memory sessions (when Redis is not used)
if (!useRedis) {
  setInterval(() => {
    try {
      const now = Date.now();
      for (const [k, v] of verifySessions.entries()) {
        if (!v) continue;
        if (v.expiresAt && Number(v.expiresAt) > 0 && now > Number(v.expiresAt)) {
          try { verifySessions.delete(k); } catch (e) { /* ignore */ }
        }
      }
    } catch (e) {
      // no-op
    }
  }, 60 * 1000);
}

function makeSessionId() {
  try { return (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`; }
  catch(e) { return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`; }
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
  // Normalize/store requested fields: origin, idType, successUrl
  const storedPayload = { ...(payload || {}) };
  if (payload.origin) storedPayload.origin = payload.origin;
  if (payload.idType) storedPayload.idType = payload.idType;
  if (payload.successUrl) storedPayload.successUrl = payload.successUrl;

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
        html,body{height:100%;margin:0}
        .frame-wrap{height:100vh;display:flex;align-items:stretch}
        iframe{flex:1;border:0;width:100%;height:100%;}
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
                const payload = { success: false, action: 'close', reason: 'consent_declined', session: window.__IDENTITY_SESSION__ || null };
                const target = (typeof window.__IDENTITY_EXPECTED_ORIGIN__ === 'string' && window.__IDENTITY_EXPECTED_ORIGIN__) ? window.__IDENTITY_EXPECTED_ORIGIN__ : '*';
                console.log('[identity] consent declined - notifying parent', { payload, target });
                // Try multiple times to increase reliability across timing/race conditions
                const attempts = 3;
                for (let i = 0; i < attempts; i++) {
                  try {
                    window.parent.postMessage({ identityOCR: payload }, target);
                  } catch (e) {
                    try { window.parent.postMessage({ identityOCR: payload }, '*'); } catch (e2) { /* ignore */ }
                  }
                  // small delay between attempts
                  await new Promise(r => setTimeout(r, 200));
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
          <main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <!-- Left: Camera + Controls (copied from index.html for consistent design) -->
              <div class="camera-section space-y-4">
                <div class="camera-container relative overflow-hidden rounded-xl border border-gray-200 bg-black shadow-sm">
                  <video id="video" autoplay muted playsinline class="h-64 w-full object-cover sm:h-72 md:h-80 lg:h-[26rem]"></video>
                  <canvas id="canvas" style="display: none;"></canvas>

                  <!-- Rectangle guide overlay -->
                  <div class="overlay-container pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div class="guide-rectangle rounded-xl border-2 border-dashed border-white/70" style="width:80%; height:60%;"></div>
                    <div id="alignment-feedback" class="alignment-feedback absolute left-1/2 bottom-3 w-[94%] -translate-x-1/2 rounded-lg">
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
                    });
                  </script>
                </div>

                <div class="camera-controls flex flex-wrap items-center gap-3">
                  <button id="start-camera" class="btn btn-primary inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700">Start Camera</button>
                  <button id="switch-camera" class="btn btn-secondary inline-flex items-center justify-center rounded-md bg-gray-700 px-4 py-2 text-sm font-medium text-white shadow" style="display:none;" disabled>Switch Camera</button>
                  <button id="recapture-btn" class="btn btn-primary inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow" style="display:none;">Recapture</button>
                  <select id="ocr-type" style="display:none;"><option value="identity" selected>Identity Document</option></select>
                </div>
              </div>

              <!-- Right: Preview + Results (matching index.html) -->
              <div class="results-section space-y-4">
                <div class="details-section rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <h3 class="text-base font-medium">Extracted Details</h3>
                  <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label for="id-type" class="mb-1 block text-xs font-medium text-gray-600">ID Type</label>
                      <select id="id-type" class="block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500">
                        <option value="national-id" selected>National ID</option>
                        <option value="passport">Passport</option>
                        <option value="umid">Unified Multi-Purpose Identification (UMID) Card</option>
                      </select>
                    </div>
                    <div>
                      <label for="id-number" class="mb-1 block text-xs font-medium text-gray-600">ID Number</label>
                      <input id="id-number" type="text" placeholder="Auto-filled from OCR" class="block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label for="last-name" class="mb-1 block text-xs font-medium text-gray-600">Last Name</label>
                      <input id="last-name" type="text" placeholder="Apelyido / Last Name" class="block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label for="first-name" class="mb-1 block text-xs font-medium text-gray-600">First Name</label>
                      <input id="first-name" type="text" placeholder="Mga Pangalan / Given Names" class="block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label for="birth-date" class="mb-1 block text-xs font-medium text-gray-600">Birth Date</label>
                      <input id="birth-date" type="date" class="block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                    </div>
                  </div>
                </div>

                <div class="preview-section rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <h3 class="text-base font-medium">Captured Image</h3>
                  <div class="image-preview mt-3 flex min-h-[160px] items-center justify-center overflow-hidden rounded-lg bg-gray-50">
                    <img id="preview-image" class="max-h-80 w-auto max-w-full object-contain" alt="Captured image will appear here" />
                    <div class="no-image text-sm text-gray-500">No image captured yet</div>
                  </div>
                </div>

                <div class="ocr-results rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <h3 class="text-base font-medium">OCR Results</h3>
                  <div class="loading mt-3 hidden items-center gap-2 text-sm text-gray-700" id="loading">
                    <div class="spinner h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                    <span>Processing image...</span>
                  </div>
                  <div class="results-container mt-3 max-h-[22rem] overflow-auto rounded-md bg-gray-50 p-3 text-sm text-gray-800" id="results-container">
                    <div class="no-results text-gray-500">Process an image to see OCR results</div>
                  </div>
                </div>
              </div>
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

    return res.json({ success: true, session: updated });
  } catch (e) {
    console.error('POST session result error', e);
    return res.status(500).json({ success: false, error: 'Failed to update session' });
  }
}

app.post('/api/verify/session/:id/result', postSessionResultHandler);
app.post('/verify/session/:id/result', postSessionResultHandler);

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
