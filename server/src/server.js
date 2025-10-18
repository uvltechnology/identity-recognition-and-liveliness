import 'dotenv/config.js';
import app from './app.js';
import os from 'os';
import fs from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000; // HTTP port
const SSL_PORT = Number(process.env.SSL_PORT) || 4000; // HTTPS port (needed for camera on mobile)
const HOST = process.env.HOST || '0.0.0.0';

function getLocalIPs() {
  const nets = os.networkInterfaces();
  const results = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) {
        results.push(net.address);
      }
    }
  }
  return results;
}

// Always start HTTP (useful for redirects and local testing)
http.createServer(app).listen(PORT, HOST, () => {
  const localURL = `http://localhost:${PORT}`;
  const ips = getLocalIPs();
  console.log(`[server] http listening on ${localURL}`);
  if (ips.length > 0) {
    ips.forEach(ip => {
      console.log(`[server] http on your network: http://${ip}:${PORT}`);
    });
  } else {
    console.log('[server] no LAN IPv4 found; ensure you are connected to a network');
  }
});

// Optionally start HTTPS if certs are present (required for camera on mobile/non-localhost)
const keyPath = process.env.SSL_KEY_PATH || path.join(__dirname, '../certs/dev-key.pem');
const certPath = process.env.SSL_CERT_PATH || path.join(__dirname, '../certs/dev-cert.pem');

try {
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    const creds = { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
    https.createServer(creds, app).listen(SSL_PORT, HOST, () => {
      const localURL = `https://localhost:${SSL_PORT}`;
      const ips = getLocalIPs();
      console.log(`[server] https listening on ${localURL}`);
      if (ips.length > 0) {
        ips.forEach(ip => {
          console.log(`[server] https on your network: https://${ip}:${SSL_PORT}`);
        });
      }
      console.log('[server] Tip: Mobile browsers require HTTPS (or localhost) for camera access.');
    });
  } else {
    console.warn('[server] SSL certs not found. Camera access on mobile will be blocked over HTTP.');
    console.warn('[server] Provide SSL_KEY_PATH and SSL_CERT_PATH env vars or place dev-key.pem/dev-cert.pem under ./certs');
  }
} catch (e) {
  console.warn('[server] Failed to start HTTPS server:', e?.message || e);
}
