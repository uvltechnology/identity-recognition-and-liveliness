export default function DocsPage(){
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold">Identity Verification — Integration Guide for Clients</h1>
      <p className="mt-3 text-sm text-gray-600">You're integrating our hosted identity verification widget and server APIs into your application. This guide shows required server-side steps, embed flow, sample requests, and security best practices.</p>

      <section className="mt-6">
        <h2 className="text-lg font-medium">Onboarding & Setup</h2>
        <div className="mt-2 text-sm text-gray-800">
          <p>We provide a Node.js server package and a static client bundle you host or we host for you. Integration checklist:</p>
          <ol className="list-decimal ml-6 mt-2">
            <li>Obtain API credentials (API key and embed signing secret) from your provider account.</li>
            <li>Host or copy the client static files into your public asset path so the widget loads unchanged (scripts expect specific DOM IDs).</li>
            <li>Install server dependencies and set env vars (examples below).</li>
          </ol>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-medium">Environment & Secrets</h2>
        <div className="mt-2 text-sm text-gray-800">
          <p>Required env vars on your server:</p>
          <ul className="list-disc ml-6 mt-2">
            <li><strong>API_KEY</strong>: your client API key to authenticate requests to our session endpoints.</li>
            <li><strong>EMBED_SIGNING_SECRET</strong>: HMAC secret used to sign short-lived iframe tokens returned by <code>/api/session</code>.</li>
            <li><strong>GOOGLE_APPLICATION_CREDENTIALS</strong> (optional): path to service account key if you enable Google Vision OCR on your server.</li>
            <li><strong>GEMINI_API_KEY</strong> / <strong>OPENAI_API_KEY</strong> (optional): for AI-powered parsing — server will return 501 when missing and client falls back to heuristics.</li>
          </ul>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-medium">API Overview (what you call)</h2>
        <div className="mt-2 text-sm text-gray-800">
          <p>We provide these server endpoints. Your backend calls them to create sessions and to process uploads; clients never call Vision/AI directly.</p>
          <ul className="ml-6 mt-2">
            <li><strong>POST /api/session</strong> — create an embed session. Body: JSON <code>{"{ clientId, redirectUrl?, metadata? }"}</code>.
              Response: <code>{"{ sessionId, iframeUrl }"}</code> where iframeUrl contains a short-lived signed token that the iframe will validate on load.
            </li>
            <li className="mt-2"><strong>POST /api/ocr/base64</strong> — accepts <code>{"{ image, type }"}</code> where image is a data URL. Server runs OCR and returns structured text and word arrays.</li>
            <li className="mt-2"><strong>POST /api/ai/:idtype/parse</strong> — optional server-side AI parse for `passport`, `umid`, `national-id`, etc. Returns <code>{"{ success, fields, confidence }"}</code> or 501 when AI keys are not set.</li>
            <li className="mt-2"><strong>GET /api/session/:id/status</strong> — poll for session state: <code>{"{ status: 'pending'|'complete'|'failed', result?: {...} }"}</code>.</li>
          </ul>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-medium">Integration Examples</h2>
        <div className="mt-3 text-sm text-gray-800">
          <h3 className="font-semibold">Server: create session (Node)</h3>
          <pre className="bg-gray-100 p-3 rounded mt-2 overflow-auto"><code>{`// POST /api/session (server-side)
const res = await fetch('https://your-server.example.com/api/session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer YOUR_API_KEY' },
  body: JSON.stringify({ clientId: 'acme', redirectUrl: 'https://acme.app/callback' })
});
const body = await res.json();
// body: { sessionId: 'abc123', iframeUrl: 'https://your-server.example.com/embed?token=...' }`}</code></pre>

          <h3 className="font-semibold mt-3">Client: embed iframe</h3>
          <pre className="bg-gray-100 p-3 rounded mt-2 overflow-auto"><code>{`// Parent page (browser)
const iframe = document.createElement('iframe');
iframe.src = body.iframeUrl; // from server create-session response
iframe.width = '480'; iframe.height = '640';
document.getElementById('embed-root').appendChild(iframe);

// Configure widget via postMessage once iframe loads
iframe.onload = () => {
  iframe.contentWindow.postMessage({ identityOCR: { action: 'configure', idType: 'passport' } }, new URL(body.iframeUrl).origin);
};`}</code></pre>

          <h3 className="font-semibold mt-3">Client: poll session status</h3>
          <pre className="bg-gray-100 p-3 rounded mt-2 overflow-auto"><code>{`// Poll session state (example)
const poll = setInterval(async () => {
  const s = await fetch('/api/session/<SESSION_ID>/status', { headers: { 'Authorization': 'Bearer YOUR_API_KEY' } }).then(r => r.json());
  if (s.status === 'complete') {
    clearInterval(poll);
    // s.result contains verification outcome
  }
}, 2000);`}</code></pre>

          <h3 className="font-semibold mt-3">Webhook (recommended)</h3>
          <pre className="bg-gray-100 p-3 rounded mt-2 overflow-auto"><code>{`// We can POST results to your webhook when verification completes
// Example payload:
{
  "sessionId": "abc123",
  "status": "complete",
  "result": { "verified": true, "fields": { "firstName": "Juan", "lastName": "Dela Cruz" } }
}
// Validate HMAC signature header using your EMBED_SIGNING_SECRET.`}</code></pre>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-medium">Operational & Security Guidance</h2>
        <ul className="list-disc ml-6 mt-2 text-sm text-gray-800">
          <li><strong>Server-only processing:</strong> Always perform OCR and AI calls on your trusted server. Never embed provider API keys in client-side code.</li>
          <li><strong>Short-lived signed embed tokens:</strong> The `iframeUrl` returned by <code>/api/session</code> must include a signed token (HMAC or JWT). Validate signature and expiry inside the iframe before accepting configuration messages.</li>
          <li><strong>Authentication:</strong> Require an API key for server-to-server calls (create session, OCR). Use TLS everywhere.</li>
          <li><strong>Rate limits & quotas:</strong> Apply per-client rate limits to OCR/AI endpoints and restrict uploaded image size and content type.</li>
          <li><strong>Webhook delivery:</strong> Prefer webhooks for production (we deliver result to your endpoint). Validate message signature and handle idempotency.</li>
          <li><strong>Audit & privacy:</strong> Log minimal metadata and store PII only when required; encrypt at rest and delete images after processing unless retention is needed for disputes.</li>
          <li><strong>Fallback behavior:</strong> If AI parsing is unavailable the client will fall back to deterministic heuristics; servers should return HTTP 501 with a helpful message when AI keys are not set.</li>
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-medium">Repository map</h2>
        <ul className="list-disc ml-6 mt-2 text-sm text-gray-800">
          <li><strong>`app/identity`</strong> — demo and hosting page that mounts the legacy client DOM and scripts.</li>
          <li><strong>`public/js`, `public/json`</strong> — original client scripts and label-variant lists the widget expects.</li>
          <li><strong>`app/api/*`</strong> — HTTP route handlers for sessions, OCR upload, and AI parse endpoints (server-side logic).</li>
          <li><strong>`lib/services/ocrService.js`</strong> — server OCR integration (Google Vision or alternative).</li>
        </ul>
      </section>
    </div>
  )
}
