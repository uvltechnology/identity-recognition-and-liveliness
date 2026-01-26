import { useState } from 'react';

const CodeBlock = ({ code, language = 'javascript' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
        <code>{code}</code>
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
};

const Sidebar = ({ sections, activeSection, onSectionClick }) => (
  <aside className="w-64 bg-white border-r border-gray-200 h-screen sticky top-0 overflow-y-auto hidden lg:block">
    <div className="p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Documentation</h2>
      <nav className="space-y-1">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => onSectionClick(section.id)}
            className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
              activeSection === section.id
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            {section.title}
          </button>
        ))}
      </nav>
    </div>
  </aside>
);

const EndpointCard = ({ method, path, description, requestBody, responseBody, children }) => {
  const methodColors = {
    GET: 'bg-green-100 text-green-700',
    POST: 'bg-blue-100 text-blue-700',
    PUT: 'bg-yellow-100 text-yellow-700',
    DELETE: 'bg-red-100 text-red-700',
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
      <div className="bg-gray-50 px-4 py-3 flex items-center gap-3 border-b border-gray-200">
        <span className={`px-2 py-1 rounded text-xs font-bold ${methodColors[method]}`}>
          {method}
        </span>
        <code className="text-sm font-mono text-gray-800">{path}</code>
      </div>
      <div className="p-4">
        <p className="text-gray-600 mb-4">{description}</p>
        {children}
        {requestBody && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Request Body</h4>
            <CodeBlock code={requestBody} />
          </div>
        )}
        {responseBody && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Response</h4>
            <CodeBlock code={responseBody} />
          </div>
        )}
      </div>
    </div>
  );
};

export default function Documentation() {
  const [activeSection, setActiveSection] = useState('overview');

  const sections = [
    { id: 'overview', title: 'Overview' },
    { id: 'authentication', title: 'Authentication' },
    { id: 'health', title: 'Health Check' },
    { id: 'id-types', title: 'Supported ID Types' },
    { id: 'ocr', title: 'OCR Extraction' },
    { id: 'ai-extraction', title: 'AI Extraction' },
    { id: 'sessions', title: 'Verification Sessions' },
    { id: 'embedding', title: 'Embed Integration' },
    { id: 'liveness', title: 'Liveness Detection' },
    { id: 'errors', title: 'Error Handling' },
    { id: 'sdks', title: 'SDKs & Libraries' },
  ];

  const scrollToSection = (id) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar sections={sections} activeSection={activeSection} onSectionClick={scrollToSection} />

      <main className="flex-1 max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <header className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Identity Verification API</h1>
              <p className="text-gray-500">v2.0</p>
            </div>
          </div>
          <p className="text-lg text-gray-600 max-w-2xl">
            A comprehensive identity verification service supporting Philippine government IDs with 
            AI-powered OCR extraction and real-time liveness detection.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
              Production Ready
            </span>
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
              AI-Powered
            </span>
            <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
              Real-time
            </span>
          </div>
        </header>

        {/* Overview Section */}
        <section id="overview" className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Overview</h2>
          <div className="prose prose-gray max-w-none">
            <p className="text-gray-600 mb-4">
              The Identity Verification API provides a complete solution for verifying Philippine government-issued IDs.
              It combines optical character recognition (OCR) with AI-powered field extraction and liveness detection
              to ensure secure and accurate identity verification.
            </p>
            <div className="grid md:grid-cols-3 gap-4 mt-6">
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">ID Scanning</h3>
                <p className="text-sm text-gray-600">Support for 8 Philippine ID types with automatic field extraction</p>
              </div>
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">AI Extraction</h3>
                <p className="text-sm text-gray-600">Gemini-powered intelligent field parsing with high accuracy</p>
              </div>
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Liveness Detection</h3>
                <p className="text-sm text-gray-600">Real-time face detection with anti-spoofing measures</p>
              </div>
            </div>
          </div>

          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">Base URL</h4>
            <code className="text-blue-700 bg-blue-100 px-2 py-1 rounded">https://identity.yamcon.dev/api</code>
          </div>
        </section>

        {/* Authentication Section */}
        <section id="authentication" className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication</h2>
          <p className="text-gray-600 mb-4">
            All API requests require authentication using an API key. Include your API key in the request headers.
          </p>
          <CodeBlock
            code={`// Include in all requests
Headers:
  Authorization: Bearer YOUR_API_KEY
  Content-Type: application/json`}
          />
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex gap-2">
              <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h4 className="font-semibold text-yellow-800">Keep your API key secure</h4>
                <p className="text-sm text-yellow-700">Never expose your API key in client-side code. Use server-side proxying for web applications.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Health Check Section */}
        <section id="health" className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Health Check</h2>
          <p className="text-gray-600 mb-4">
            Use the health endpoint to verify service availability and check AI capabilities.
          </p>
          <EndpointCard
            method="GET"
            path="/api/health"
            description="Returns the current health status of the Identity Verification service."
            responseBody={`{
  "status": "ok",
  "timestamp": "2026-01-26T10:30:00.000Z",
  "geminiEnabled": true,
  "geminiModel": "gemini-2.0-flash"
}`}
          />
        </section>

        {/* Supported ID Types Section */}
        <section id="id-types" className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Supported ID Types</h2>
          <p className="text-gray-600 mb-4">
            The API supports verification of the following Philippine government-issued identification documents.
          </p>
          <EndpointCard
            method="GET"
            path="/api/ids"
            description="Returns a list of all supported ID types."
            responseBody={`{
  "success": true,
  "ids": [
    { "id": "national-id", "name": "National ID" },
    { "id": "passport", "name": "Passport" },
    { "id": "umid", "name": "UMID" },
    { "id": "tin-id", "name": "TIN" },
    { "id": "philhealth", "name": "PhilHealth" },
    { "id": "pagibig", "name": "Pag-IBIG" },
    { "id": "postal-id", "name": "Postal ID" },
    { "id": "driver-license", "name": "Driver's License" }
  ]
}`}
          />

          <div className="mt-6 grid md:grid-cols-2 gap-4">
            {[
              { id: 'national-id', name: 'National ID (PhilSys)', fields: ['First Name', 'Last Name', 'Birth Date', 'PhilSys Number'] },
              { id: 'passport', name: 'Philippine Passport', fields: ['Full Name', 'Birth Date', 'Passport Number', 'Expiry Date'] },
              { id: 'umid', name: 'UMID', fields: ['Full Name', 'Birth Date', 'CRN Number'] },
              { id: 'driver-license', name: "Driver's License", fields: ['Full Name', 'Birth Date', 'License Number', 'Expiry Date'] },
              { id: 'tin-id', name: 'TIN ID', fields: ['Full Name', 'Birth Date', 'TIN Number'] },
              { id: 'philhealth', name: 'PhilHealth ID', fields: ['Full Name', 'Birth Date', 'PhilHealth Number'] },
              { id: 'pagibig', name: 'Pag-IBIG ID', fields: ['Full Name', 'Birth Date', 'MID Number'] },
              { id: 'postal-id', name: 'Postal ID', fields: ['Full Name', 'Birth Date', 'Postal ID Number'] },
            ].map((idType) => (
              <div key={idType.id} className="bg-white p-4 rounded-lg border border-gray-200">
                <h4 className="font-semibold text-gray-900 mb-2">{idType.name}</h4>
                <code className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">{idType.id}</code>
                <ul className="mt-3 space-y-1">
                  {idType.fields.map((field) => (
                    <li key={field} className="text-sm text-gray-600 flex items-center gap-2">
                      <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {field}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* OCR Extraction Section */}
        <section id="ocr" className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">OCR Extraction</h2>
          <p className="text-gray-600 mb-4">
            Extract raw text from ID images using optical character recognition. This endpoint processes
            the image and returns the detected text for further parsing.
          </p>
          <EndpointCard
            method="POST"
            path="/api/ocr/:endpoint"
            description="Process an ID image and extract raw OCR text. The endpoint parameter specifies the ID type for optimized processing."
            requestBody={`{
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
  "options": {
    "enhanceContrast": true,
    "deskew": true
  }
}`}
            responseBody={`{
  "success": true,
  "rawText": "REPUBLIKA NG PILIPINAS\\nPHILIPPINE IDENTIFICATION SYSTEM\\n...",
  "confidence": 0.92,
  "processingTime": 1250
}`}
          />
        </section>

        {/* AI Extraction Section */}
        <section id="ai-extraction" className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">AI Extraction</h2>
          <p className="text-gray-600 mb-4">
            Use AI-powered extraction to parse raw OCR text into structured fields. This endpoint uses
            Google's Gemini model for intelligent field detection and formatting.
          </p>
          <EndpointCard
            method="POST"
            path="/api/ai/:idType/parse"
            description="Parse raw OCR text using AI to extract structured identity fields."
            requestBody={`{
  "rawText": "REPUBLIKA NG PILIPINAS\\nPHILIPPINE IDENTIFICATION SYSTEM\\nSURNAME: DELA CRUZ\\nGIVEN NAME: JUAN\\nMIDDLE NAME: SANTOS\\nSEX: M\\nDATE OF BIRTH: 1990/05/15\\nPCN: 1234-5678-9012-3456"
}`}
            responseBody={`{
  "success": true,
  "fields": {
    "firstName": "JUAN",
    "lastName": "DELA CRUZ",
    "birthDate": "1990-05-15",
    "idNumber": "1234-5678-9012-3456"
  },
  "confidence": 0.95,
  "modelUsed": "gemini-2.0-flash"
}`}
          >
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Supported ID Types</h4>
              <div className="flex flex-wrap gap-2">
                {['national-id', 'passport', 'umid', 'tin-id', 'philhealth', 'pagibig', 'postal-id', 'driver-license'].map((type) => (
                  <code key={type} className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-700">{type}</code>
                ))}
              </div>
            </div>
          </EndpointCard>

          <div className="mt-6 bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h4 className="font-semibold text-purple-900 mb-2">AI Model</h4>
            <p className="text-sm text-purple-700">
              This endpoint uses <strong>Google Gemini 2.0 Flash</strong> for fast and accurate text extraction.
              The model is optimized for Philippine ID formats and handles various date formats, name structures,
              and ID number patterns.
            </p>
          </div>
        </section>

        {/* Sessions Section */}
        <section id="sessions" className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Verification Sessions</h2>
          <p className="text-gray-600 mb-4">
            Sessions manage the state of a verification flow, tracking progress from ID scanning
            through liveness detection to final result.
          </p>

          <EndpointCard
            method="GET"
            path="/api/session/:id"
            description="Retrieve the current state of a verification session."
            responseBody={`{
  "id": "sess_abc123xyz",
  "status": "pending",
  "payload": {
    "idType": "national-id",
    "testMode": false,
    "authRequired": false,
    "successUrl": "https://yourapp.com/callback"
  },
  "createdAt": "2026-01-26T10:00:00.000Z"
}`}
          />

          <EndpointCard
            method="POST"
            path="/api/verify/session/:id/result"
            description="Submit the final result of a verification session."
            requestBody={`{
  "status": "completed",
  "finishedAt": "2026-01-26T10:05:00.000Z",
  "extractedData": {
    "firstName": "JUAN",
    "lastName": "DELA CRUZ",
    "birthDate": "1990-05-15",
    "idNumber": "1234-5678-9012-3456"
  },
  "livenessScore": 0.98,
  "faceMatchScore": 0.95
}`}
            responseBody={`{
  "success": true,
  "sessionId": "sess_abc123xyz",
  "status": "completed"
}`}
          />

          <div className="mt-4">
            <h4 className="font-semibold text-gray-700 mb-2">Session Status Values</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-2 text-left font-semibold text-gray-700">Status</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-700">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr><td className="px-4 py-2"><code className="bg-yellow-100 text-yellow-800 px-1 rounded">pending</code></td><td className="px-4 py-2 text-gray-600">Session created, awaiting user action</td></tr>
                  <tr><td className="px-4 py-2"><code className="bg-blue-100 text-blue-800 px-1 rounded">in_progress</code></td><td className="px-4 py-2 text-gray-600">Verification in progress</td></tr>
                  <tr><td className="px-4 py-2"><code className="bg-green-100 text-green-800 px-1 rounded">completed</code></td><td className="px-4 py-2 text-gray-600">Verification successful</td></tr>
                  <tr><td className="px-4 py-2"><code className="bg-red-100 text-red-800 px-1 rounded">failed</code></td><td className="px-4 py-2 text-gray-600">Verification failed</td></tr>
                  <tr><td className="px-4 py-2"><code className="bg-gray-100 text-gray-800 px-1 rounded">cancelled</code></td><td className="px-4 py-2 text-gray-600">User cancelled verification</td></tr>
                  <tr><td className="px-4 py-2"><code className="bg-orange-100 text-orange-800 px-1 rounded">expired</code></td><td className="px-4 py-2 text-gray-600">Session timed out</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Embed Integration Section */}
        <section id="embedding" className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Embed Integration</h2>
          <p className="text-gray-600 mb-4">
            Embed the verification flow directly into your application using an iframe. This provides
            a seamless user experience while maintaining security.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 mt-8 mb-4">Quick Start</h3>
          <CodeBlock
            code={`<!-- Add iframe to your page -->
<iframe
  id="identity-frame"
  src="https://identity.yamcon.dev/embed/session/YOUR_SESSION_ID"
  width="100%"
  height="600"
  allow="camera"
  style="border: none;"
></iframe>

<script>
// Listen for verification results
window.addEventListener('message', (event) => {
  // Verify origin for security
  if (event.origin !== 'https://identity.yamcon.dev') return;

  const { identityOCR } = event.data;
  if (!identityOCR) return;

  switch (identityOCR.action) {
    case 'completed':
      console.log('Verification complete:', identityOCR.result);
      // Handle successful verification
      break;
    case 'failed':
      console.log('Verification failed:', identityOCR.reason);
      // Handle failure
      break;
    case 'close':
      console.log('User closed verification');
      // Handle close
      break;
  }
});
</script>`}
          />

          <h3 className="text-lg font-semibold text-gray-900 mt-8 mb-4">PostMessage Events</h3>
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-2">completed</h4>
              <p className="text-sm text-gray-600 mb-2">Sent when verification is successfully completed.</p>
              <CodeBlock
                code={`{
  "identityOCR": {
    "action": "completed",
    "session": "sess_abc123xyz",
    "result": {
      "firstName": "JUAN",
      "lastName": "DELA CRUZ",
      "birthDate": "1990-05-15",
      "idNumber": "1234-5678-9012-3456",
      "livenessScore": 0.98
    }
  }
}`}
              />
            </div>

            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-2">problem</h4>
              <p className="text-sm text-gray-600 mb-2">Sent when a non-fatal issue occurs during verification.</p>
              <CodeBlock
                code={`{
  "identityOCR": {
    "action": "problem",
    "session": "sess_abc123xyz",
    "message": "Please hold the ID card steady",
    "level": "warn"
  }
}`}
              />
            </div>

            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-2">close</h4>
              <p className="text-sm text-gray-600 mb-2">Sent when the user closes or cancels the verification.</p>
              <CodeBlock
                code={`{
  "identityOCR": {
    "action": "close",
    "session": "sess_abc123xyz",
    "reason": "consent_declined"
  }
}`}
              />
            </div>
          </div>
        </section>

        {/* Liveness Detection Section */}
        <section id="liveness" className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Liveness Detection</h2>
          <p className="text-gray-600 mb-4">
            The liveness detection system uses face-api.js with TinyFaceDetector to verify that a real
            person is present during verification, preventing photo or video spoofing attacks.
          </p>

          <div className="grid md:grid-cols-2 gap-4 mt-6">
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-2">Face Detection</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Real-time face tracking</li>
                <li>• 68-point facial landmarks</li>
                <li>• Expression analysis</li>
                <li>• Blink detection</li>
              </ul>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-2">Anti-Spoofing</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Motion analysis</li>
                <li>• Texture analysis</li>
                <li>• 3D depth estimation</li>
                <li>• Challenge-response tests</li>
              </ul>
            </div>
          </div>

          <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-semibold text-green-900 mb-2">Standalone Liveness Test</h4>
            <p className="text-sm text-green-700">
              You can also use the liveness detection as a standalone service at:
            </p>
            <code className="text-green-700 bg-green-100 px-2 py-1 rounded mt-2 inline-block">/selfie-liveness-test</code>
          </div>
        </section>

        {/* Error Handling Section */}
        <section id="errors" className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Error Handling</h2>
          <p className="text-gray-600 mb-4">
            The API uses standard HTTP status codes and returns consistent error responses.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2 text-left font-semibold text-gray-700">Status Code</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-700">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr><td className="px-4 py-2"><code>200</code></td><td className="px-4 py-2 text-gray-600">Success</td></tr>
                <tr><td className="px-4 py-2"><code>400</code></td><td className="px-4 py-2 text-gray-600">Bad Request - Invalid parameters</td></tr>
                <tr><td className="px-4 py-2"><code>401</code></td><td className="px-4 py-2 text-gray-600">Unauthorized - Invalid API key</td></tr>
                <tr><td className="px-4 py-2"><code>404</code></td><td className="px-4 py-2 text-gray-600">Not Found - Resource doesn't exist</td></tr>
                <tr><td className="px-4 py-2"><code>500</code></td><td className="px-4 py-2 text-gray-600">Internal Server Error</td></tr>
                <tr><td className="px-4 py-2"><code>501</code></td><td className="px-4 py-2 text-gray-600">Not Implemented - Feature disabled</td></tr>
                <tr><td className="px-4 py-2"><code>502</code></td><td className="px-4 py-2 text-gray-600">Bad Gateway - Upstream service error</td></tr>
              </tbody>
            </table>
          </div>

          <h3 className="text-lg font-semibold text-gray-900 mt-8 mb-4">Error Response Format</h3>
          <CodeBlock
            code={`{
  "success": false,
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {
    // Additional error context (optional)
  }
}`}
          />
        </section>

        {/* SDKs Section */}
        <section id="sdks" className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">SDKs & Libraries</h2>
          <p className="text-gray-600 mb-4">
            We provide client libraries to make integration easier.
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <span className="text-yellow-600 font-bold text-sm">JS</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">JavaScript SDK</h4>
                  <p className="text-xs text-gray-500">Browser & Node.js</p>
                </div>
              </div>
              <CodeBlock code="npm install @yamcon/identity-sdk" />
            </div>

            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-blue-600 font-bold text-sm">TS</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">TypeScript Support</h4>
                  <p className="text-xs text-gray-500">Full type definitions included</p>
                </div>
              </div>
              <CodeBlock code="// Types are bundled with the SDK" />
            </div>
          </div>

          <h3 className="text-lg font-semibold text-gray-900 mt-8 mb-4">Usage Example</h3>
          <CodeBlock
            code={`import { IdentityClient } from '@yamcon/identity-sdk';

const client = new IdentityClient({
  apiKey: process.env.IDENTITY_API_KEY,
  baseUrl: 'https://identity.yamcon.dev'
});

// Create a verification session
const session = await client.createSession({
  idType: 'national-id',
  successUrl: 'https://yourapp.com/success',
  webhookUrl: 'https://yourapp.com/webhook'
});

// Get the embed URL
const embedUrl = session.getEmbedUrl();

// Or use the API directly
const result = await client.extractFromText({
  idType: 'national-id',
  rawText: ocrText
});

console.log(result.fields);`}
          />
        </section>

        {/* Footer */}
        <footer className="border-t border-gray-200 pt-8 mt-16">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-gray-500">
              © 2026 Yamcon Identity Verification. All rights reserved.
            </p>
            <div className="flex gap-4">
              <a href="#" className="text-sm text-gray-500 hover:text-gray-700">Support</a>
              <a href="#" className="text-sm text-gray-500 hover:text-gray-700">Status</a>
              <a href="#" className="text-sm text-gray-500 hover:text-gray-700">Terms</a>
              <a href="#" className="text-sm text-gray-500 hover:text-gray-700">Privacy</a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
