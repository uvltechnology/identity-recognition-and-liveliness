import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';
import express from 'express';
import GeminiService from './src/services/geminiService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';
const host = process.env.HOST || 'localhost';
const port = parseInt(process.env.PORT, 10) || 3000;
const sslPort = parseInt(process.env.SSL_PORT, 10) || port + 1;

// SSL Configuration
const sslEnabled = process.env.SSL_ENABLED === 'true';
const sslCertPath = process.env.SSL_CERT || '../server/certs/dev-cert.pem';
const sslKeyPath = process.env.SSL_KEY || '../server/certs/dev-key.pem';

// Main identity server URL (for OCR proxying)
const IDENTITY_API_URL = process.env.IDENTITY_API_URL || 'http://localhost:4000';

// Initialize Gemini service for AI extraction
const geminiService = new GeminiService();

async function createServer() {
  const app = express();
  
  // Parse JSON bodies
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  let vite;
  if (!isProduction) {
    // Development: use Vite's dev server as middleware
    const { createServer: createViteServer } = await import('vite');
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve static files
    const compression = (await import('compression')).default;
    const sirv = (await import('sirv')).default;
    app.use(compression());
    app.use(sirv(path.join(__dirname, 'dist/client'), { extensions: [] }));
  }

  // API routes
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      geminiEnabled: geminiService.enabled,
      geminiModel: geminiService.modelId
    });
  });

  // Proxy OCR requests to main identity server
  app.post('/api/ocr/:endpoint', async (req, res) => {
    try {
      const endpoint = req.params.endpoint;
      const response = await fetch(`${IDENTITY_API_URL}/api/ocr/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
      });
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (err) {
      console.error('OCR proxy error:', err);
      res.status(502).json({ success: false, error: 'Failed to connect to OCR service' });
    }
  });

  // AI extraction using local Gemini service
  app.post('/api/ai/:idType/parse', async (req, res) => {
    try {
      const idType = req.params.idType;
      const { rawText } = req.body || {};

      if (!rawText?.trim()) {
        return res.status(400).json({ success: false, error: 'rawText is required' });
      }

      if (!geminiService.enabled) {
        return res.status(501).json({ success: false, error: 'Gemini not configured', disabled: true });
      }

      // Map ID type to extraction method
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
      const result = await extractor();

      if (result.error && !result.disabled) {
        return res.status(502).json({ success: false, error: result.error, details: result.details });
      }

      return res.json({
        success: true,
        fields: {
          firstName: result.firstName,
          lastName: result.lastName,
          birthDate: result.birthDate,
          idNumber: result.idNumber,
        },
        confidence: result.confidence,
        modelUsed: result.modelUsed,
      });
    } catch (err) {
      console.error('AI extraction error:', err);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

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

  // Session data endpoint for embed verification
  app.get('/api/session/:id', (req, res) => {
    // Mock session data - replace with actual session store
    const sessionId = req.params.id;
    res.json({
      id: sessionId,
      status: 'pending',
      payload: {
        idType: 'national-id',
        testMode: false,
        authRequired: false,
        successUrl: null,
      },
      createdAt: new Date().toISOString(),
    });
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
  http.createServer(app).listen(port, host, () => {
    console.log(`HTTP server running at http://${host}:${port}`);
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
