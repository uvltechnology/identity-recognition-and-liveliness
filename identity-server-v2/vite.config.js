import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import fs from 'fs';

export default defineConfig(({ mode = process.env.NODE_ENV || 'development' }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  const host = env.HOST || 'localhost';
  const port = parseInt(env.PORT, 10) || 3000;
  const sslEnabled = env.SSL_ENABLED === 'true';
  const sslCert = env.SSL_CERT || '../server/certs/dev-cert.pem';
  const sslKey = env.SSL_KEY || '../server/certs/dev-key.pem';

  // Load SSL certs if enabled
  let https = false;
  if (sslEnabled) {
    try {
      const certPath = resolve(__dirname, sslCert);
      const keyPath = resolve(__dirname, sslKey);
      if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
        https = {
          cert: fs.readFileSync(certPath),
          key: fs.readFileSync(keyPath),
        };
      }
    } catch (e) {
      console.warn('Failed to load SSL certs for Vite:', e.message);
    }
  }

  return {
    plugins: [react()],
    define: {
      // Expose the expected origin to the client via import.meta.env.VITE_EXPECTED_ORIGIN
      __VITE_EXPECTED_ORIGIN__: JSON.stringify(env.VITE_EXPECTED_ORIGIN || env.IDENTITY_EXPECTED_ORIGIN || ''),
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
    server: {
      host,
      port,
      https,
    },
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
        },
      },
    },
    ssr: {
      noExternal: ['react-router-dom', 'react-icons'],
    },
  };
});
