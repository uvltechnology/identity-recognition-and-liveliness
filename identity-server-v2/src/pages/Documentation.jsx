import { useState } from 'react';
import Header from '../components/Header';

const CodeBlock = ({ code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <pre className="bg-gray-900 text-gray-100 p-3 sm:p-4 rounded-lg overflow-x-auto text-sm">
        <code>{code}</code>
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 px-2 py-1 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
};

const EndpointCard = ({ method, path, description, requestBody, responseBody }) => {
  const methodColors = {
    GET: 'bg-green-100 text-green-700',
    POST: 'bg-blue-100 text-blue-700',
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
      <div className="bg-gray-50 px-3 sm:px-4 py-3 flex flex-wrap items-center gap-2 border-b border-gray-200">
        <span className={`px-2 py-1 rounded text-sm font-bold ${methodColors[method]}`}>{method}</span>
        <code className="text-sm font-mono text-gray-800 break-all">{path}</code>
      </div>
      <div className="p-3 sm:p-4">
        <p className="text-gray-600 mb-3 text-sm">{description}</p>
        {requestBody && (
          <div className="mb-3">
            <h4 className="text-xs font-semibold text-gray-500 mb-1">Request</h4>
            <CodeBlock code={requestBody} />
          </div>
        )}
        {responseBody && (
          <div>
            <h4 className="text-xs font-semibold text-gray-500 mb-1">Response</h4>
            <CodeBlock code={responseBody} />
          </div>
        )}
      </div>
    </div>
  );
};

export default function Documentation() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">API Documentation</h1>
          <p className="text-gray-600 text-sm sm:text-base">
            Integrate identity verification into your application with our simple API.
          </p>
          <div className="mt-3 inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm">
            Base URL: <code className="font-mono">https://identity.logica.dev/api</code>
          </div>
        </header>

        {/* Quick Start */}
        <section id="quick-start" className="mb-10 scroll-mt-20">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">Quick Start</h2>
          <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-5">
            <ol className="space-y-4 text-sm sm:text-base">
              <li className="flex gap-3">
                <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">1</span>
                <span className="text-gray-700">Create a verification session using one of the create endpoints</span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">2</span>
                <span className="text-gray-700">Embed the returned URL in an iframe or redirect user to it</span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">3</span>
                <span className="text-gray-700">Listen for postMessage events or use webhook for results</span>
              </li>
            </ol>
          </div>
        </section>

        {/* Session Endpoints */}
        <section id="sessions" className="mb-10 scroll-mt-20">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">Create Verification Sessions</h2>

          {/* Node.js Example */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-green-100 rounded flex items-center justify-center">
                <span className="text-green-700 font-bold text-xs">JS</span>
              </div>
              <h3 className="font-semibold text-gray-900">Node.js Example</h3>
            </div>
            <CodeBlock code={`const axios = require('axios');

// Create a combined verification session
async function createVerificationSession() {
  const response = await axios.post(
    'https://identity.logica.dev/api/verify/combined/create',
    {
      idType: 'national-id',
      successUrl: 'https://yourapp.com/success',
      webhookUrl: 'https://yourapp.com/webhook'
    },
    {
      headers: { 'Content-Type': 'application/json' }
    }
  );
  
  // Return the embed URL to display in iframe
  return response.data.embedUrl;
}

// Usage
const embedUrl = await createVerificationSession();
// Send embedUrl to your frontend to display in iframe`} />
          </div>

          <EndpointCard
            method="POST"
            path="/api/verify/id/create"
            description="Create an ID-only verification session."
            requestBody={`{
  "idType": "national-id",
  "successUrl": "https://yourapp.com/callback",
  "webhookUrl": "https://yourapp.com/webhook"
}`}
            responseBody={`{
  "success": true,
  "sessionId": "sess_id_abc123",
  "embedUrl": "https://identity.logica.dev/embed/session/sess_id_abc123"
}`}
          />

          <EndpointCard
            method="POST"
            path="/api/verify/selfie/create"
            description="Create a selfie liveness verification session."
            requestBody={`{
  "successUrl": "https://yourapp.com/callback",
  "webhookUrl": "https://yourapp.com/webhook"
}`}
            responseBody={`{
  "success": true,
  "sessionId": "sess_selfie_xyz789",
  "sessionUrl": "https://identity.logica.dev/session/selfieliveness/sess_selfie_xyz789"
}`}
          />

          <EndpointCard
            method="POST"
            path="/api/verify/combined/create"
            description="Create a combined flow: ID verification → selfie liveness with face matching."
            requestBody={`{
  "idType": "national-id",
  "successUrl": "https://yourapp.com/callback",
  "webhookUrl": "https://yourapp.com/webhook"
}`}
            responseBody={`{
  "success": true,
  "sessionId": "sess_combined_abc123",
  "selfieSessionId": "sess_selfie_def456",
  "embedUrl": "https://identity.logica.dev/embed/session/sess_combined_abc123"
}`}
          />

          <EndpointCard
            method="GET"
            path="/api/session/:id"
            description="Get the current state of a verification session."
            responseBody={`{
  "id": "sess_abc123",
  "status": "completed",
  "payload": { ... },
  "extractedData": { ... }
}`}
          />

          <EndpointCard
            method="GET"
            path="/api/ids"
            description="Get the list of all supported ID types for verification."
            responseBody={`{
  "success": true,
  "idTypes": [
    { "id": "national-id", "name": "National ID" },
    { "id": "passport", "name": "Passport" },
    { "id": "umid", "name": "UMID" },
    { "id": "driver-license", "name": "Driver's License" },
    { "id": "tin-id", "name": "TIN ID" },
    { "id": "philhealth", "name": "PhilHealth" },
    { "id": "pagibig", "name": "Pag-IBIG" },
    { "id": "postal-id", "name": "Postal ID" }
  ]
}`}
          />
        </section>

        {/* Supported ID Types */}
        <section id="id-types" className="mb-10 scroll-mt-20">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">Supported ID Types</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            {[
              { id: 'national-id', name: 'National ID' },
              { id: 'passport', name: 'Passport' },
              { id: 'umid', name: 'UMID' },
              { id: 'driver-license', name: "Driver's License" },
              { id: 'tin-id', name: 'TIN ID' },
              { id: 'philhealth', name: 'PhilHealth' },
              { id: 'pagibig', name: 'Pag-IBIG' },
              { id: 'postal-id', name: 'Postal ID' },
            ].map((idType) => (
              <div key={idType.id} className="bg-white p-3 rounded-lg border border-gray-200 text-center">
                <p className="font-medium text-gray-900 text-sm">{idType.name}</p>
                <code className="text-xs text-gray-500">{idType.id}</code>
              </div>
            ))}
          </div>
        </section>

        {/* Embed Integration */}
        <section id="embed" className="mb-10 scroll-mt-20">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">Embed Integration</h2>

          <div className="space-y-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Add iframe to your page</h3>
              <CodeBlock code={`<iframe
  src="YOUR_EMBED_URL"
  width="100%"
  height="600"
  allow="camera"
  style="border: none;"
></iframe>`} />
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Listen for results</h3>
              <CodeBlock code={`window.addEventListener('message', (event) => {
  if (event.origin !== 'https://identity.logica.dev') return;
  
  const { identityOCR } = event.data;
  if (!identityOCR) return;
  
  if (identityOCR.action === 'completed') {
    console.log('Result:', identityOCR.result);
  }
  if (identityOCR.action === 'failed') {
    console.log('Failed:', identityOCR.reason);
  }
});`} />
            </div>
          </div>
        </section>

        {/* Session Status */}
        <section id="status" className="mb-10 scroll-mt-20">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">Session Status Values</h2>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-200">
                <tr><td className="px-4 py-2"><code className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">pending</code></td><td className="px-4 py-2 text-gray-600">Awaiting user</td></tr>
                <tr><td className="px-4 py-2"><code className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">in_progress</code></td><td className="px-4 py-2 text-gray-600">In progress</td></tr>
                <tr><td className="px-4 py-2"><code className="bg-green-100 text-green-700 px-2 py-0.5 rounded">completed</code></td><td className="px-4 py-2 text-gray-600">Success</td></tr>
                <tr><td className="px-4 py-2"><code className="bg-red-100 text-red-700 px-2 py-0.5 rounded">failed</code></td><td className="px-4 py-2 text-gray-600">Failed</td></tr>
                <tr><td className="px-4 py-2"><code className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded">cancelled</code></td><td className="px-4 py-2 text-gray-600">Cancelled</td></tr>
                <tr><td className="px-4 py-2"><code className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded">expired</code></td><td className="px-4 py-2 text-gray-600">Timed out</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Webhooks Section */}
        <section id="webhooks" className="mb-10 scroll-mt-20">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">Webhooks</h2>
          <p className="text-gray-600 mb-4 text-sm">
            Webhooks allow you to receive real-time notifications when verification events occur. 
            Set up a webhook handler on your server to receive POST requests with verification results.
          </p>

          {/* Webhook Setup */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
            <h3 className="font-semibold text-gray-900 mb-3">1. Include webhook URL when creating session</h3>
            <CodeBlock code={`// When creating a verification session, include webhookUrl
{
  "idType": "national-id",
  "successUrl": "https://yourapp.com/verification/success",
  "failureUrl": "https://yourapp.com/verification/failed",
  "webhookUrl": "https://yourapp.com/api/identity-webhook"
}`} />
          </div>

          {/* Webhook Payload */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
            <h3 className="font-semibold text-gray-900 mb-3">2. Webhook payload structure</h3>
            <p className="text-gray-600 text-sm mb-3">Your webhook endpoint will receive a POST request with the following JSON payload:</p>
            <CodeBlock code={`{
  "event": "verification.success",  // or "verification.failed", "verification.expired"
  "sessionId": "sess_abc123xyz",
  "sessionType": "id",              // "id", "selfie", or "combined"
  "status": "success",              // "success", "failed", "expired"
  "data": {
    "fields": {
      "firstName": "Juan",
      "lastName": "Dela Cruz",
      "birthDate": "1990-01-15",
      "idNumber": "1234-5678-9012"
    },
    "status": "done",
    "finishedAt": "2026-01-30T10:30:00.000Z"
  },
  "timestamp": "2026-01-30T10:30:01.000Z"
}`} />
          </div>

          {/* Webhook Handler Examples */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
            <h3 className="font-semibold text-gray-900 mb-3">3. Set up your webhook handler</h3>
            
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 bg-green-100 rounded flex items-center justify-center">
                  <span className="text-green-700 font-bold text-xs">JS</span>
                </div>
                <span className="text-sm font-medium text-gray-700">Node.js / Express</span>
              </div>
              <CodeBlock code={`// Express webhook handler
app.post('/api/identity-webhook', express.json(), (req, res) => {
  const { event, sessionId, status, data } = req.body;
  
  // Verify the webhook (optional: add signature verification)
  console.log('Webhook received:', event, sessionId);
  
  switch (event) {
    case 'verification.success':
      // Handle successful verification
      const { firstName, lastName, idNumber } = data.fields;
      // Update your database, send confirmation email, etc.
      await db.users.update({ 
        where: { sessionId },
        data: { verified: true, firstName, lastName, idNumber }
      });
      break;
      
    case 'verification.failed':
      // Handle failed verification
      console.log('Verification failed:', data.reason);
      // Notify user, log for review, etc.
      break;
      
    case 'verification.expired':
      // Handle expired session
      // Clean up, notify user to retry
      break;
  }
  
  // Always respond with 200 to acknowledge receipt
  res.status(200).json({ received: true });
});`} />
            </div>

            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center">
                  <span className="text-blue-700 font-bold text-xs">PHP</span>
                </div>
                <span className="text-sm font-medium text-gray-700">PHP / Laravel</span>
              </div>
              <CodeBlock code={`// Laravel webhook handler
Route::post('/api/identity-webhook', function (Request $request) {
    $payload = $request->all();
    $event = $payload['event'];
    $sessionId = $payload['sessionId'];
    $data = $payload['data'];
    
    switch ($event) {
        case 'verification.success':
            $fields = $data['fields'];
            // Update user record
            User::where('verification_session', $sessionId)
                ->update([
                    'verified' => true,
                    'first_name' => $fields['firstName'],
                    'last_name' => $fields['lastName'],
                ]);
            break;
            
        case 'verification.failed':
            Log::warning('Verification failed', ['sessionId' => $sessionId]);
            break;
    }
    
    return response()->json(['received' => true]);
});`} />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 bg-yellow-100 rounded flex items-center justify-center">
                  <span className="text-yellow-700 font-bold text-xs">PY</span>
                </div>
                <span className="text-sm font-medium text-gray-700">Python / Flask</span>
              </div>
              <CodeBlock code={`# Flask webhook handler
@app.route('/api/identity-webhook', methods=['POST'])
def identity_webhook():
    payload = request.get_json()
    event = payload.get('event')
    session_id = payload.get('sessionId')
    data = payload.get('data', {})
    
    if event == 'verification.success':
        fields = data.get('fields', {})
        # Update database
        user = User.query.filter_by(session_id=session_id).first()
        if user:
            user.verified = True
            user.first_name = fields.get('firstName')
            user.last_name = fields.get('lastName')
            db.session.commit()
            
    elif event == 'verification.failed':
        app.logger.warning(f'Verification failed: {session_id}')
    
    return jsonify({'received': True}), 200`} />
            </div>
          </div>

          {/* Webhook Events */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
            <h3 className="font-semibold text-gray-900 mb-3">Webhook Events</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left px-3 py-2 font-medium text-gray-700">Event</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-700">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="px-3 py-2"><code className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs">verification.success</code></td>
                    <td className="px-3 py-2 text-gray-600">User successfully completed verification</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2"><code className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs">verification.failed</code></td>
                    <td className="px-3 py-2 text-gray-600">Verification failed (invalid ID, face mismatch, etc.)</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2"><code className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs">verification.expired</code></td>
                    <td className="px-3 py-2 text-gray-600">Session expired before completion</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Webhook Headers */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
            <h3 className="font-semibold text-gray-900 mb-3">Request Headers</h3>
            <p className="text-gray-600 text-sm mb-3">Each webhook request includes these headers:</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left px-3 py-2 font-medium text-gray-700">Header</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-700">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="px-3 py-2"><code className="text-xs">Content-Type</code></td>
                    <td className="px-3 py-2 text-gray-600">application/json</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2"><code className="text-xs">X-Webhook-Event</code></td>
                    <td className="px-3 py-2 text-gray-600">The event type (e.g., verification.success)</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2"><code className="text-xs">X-Session-Id</code></td>
                    <td className="px-3 py-2 text-gray-600">The session ID</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2"><code className="text-xs">X-Attempt</code></td>
                    <td className="px-3 py-2 text-gray-600">Retry attempt number (1, 2, or 3)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Best Practices */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">💡 Best Practices</h3>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Always respond with HTTP 200 quickly to prevent timeouts</li>
              <li>Process webhook data asynchronously if needed</li>
              <li>Store the sessionId to prevent duplicate processing</li>
              <li>Webhooks are retried up to 3 times with exponential backoff</li>
              <li>Use HTTPS endpoints for production</li>
            </ul>
          </div>
        </section>

        {/* Webhook API Endpoints */}
        <section id="webhook-api" className="mb-10 scroll-mt-20">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">Webhook API Endpoints</h2>
          <p className="text-gray-600 mb-4 text-sm">
            Use these endpoints to manually manage webhooks or check their status.
          </p>

          <EndpointCard
            method="GET"
            path="/api/webhooks/status/:sessionId"
            description="Get the webhook status and event history for a session."
            responseBody={`{
  "success": true,
  "data": {
    "session_id": "sess_abc123",
    "status": "success",
    "webhook_url": "https://yourapp.com/webhook",
    "attempts": 1,
    "events": [
      { "event_type": "verification.success", "created_at": "..." },
      { "event_type": "webhook.sent", "response_status": 200, "created_at": "..." }
    ]
  }
}`}
          />

          <EndpointCard
            method="GET"
            path="/api/webhooks/list"
            description="List all webhooks (paginated)."
            responseBody={`{
  "success": true,
  "data": [...],
  "total": 42,
  "page": 1,
  "limit": 20
}`}
          />

          <EndpointCard
            method="POST"
            path="/api/webhooks/trigger/success"
            description="Manually trigger a success webhook (for testing)."
            requestBody={`{
  "sessionId": "sess_abc123",
  "data": { "fields": { ... } }
}`}
            responseBody={`{
  "success": true,
  "redirectUrl": "https://yourapp.com/success?sessionId=sess_abc123",
  "sessionId": "sess_abc123"
}`}
          />

          <EndpointCard
            method="POST"
            path="/api/webhooks/trigger/failed"
            description="Manually trigger a failed webhook (for testing)."
            requestBody={`{
  "sessionId": "sess_abc123",
  "reason": "ID document expired"
}`}
            responseBody={`{
  "success": true,
  "redirectUrl": "https://yourapp.com/failed?sessionId=sess_abc123&reason=...",
  "sessionId": "sess_abc123",
  "reason": "ID document expired"
}`}
          />
        </section>

        {/* Test the API */}
        <section className="mb-10">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-5 text-center">
            <h2 className="text-lg font-semibold text-white mb-2">Ready to test?</h2>
            <p className="text-white/80 text-sm mb-4">Try our interactive API demo to create sessions and see responses.</p>
            <a
              href="/api-demo"
              className="inline-block px-5 py-2 bg-white hover:bg-gray-100 text-blue-600 font-medium rounded-lg transition-colors text-sm"
            >
              Open API Demo →
            </a>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-gray-200 pt-6 text-center text-sm text-gray-500">
          Identity Verification API v2.0 • Logica
        </footer>
      </main>
    </div>
  );
}
