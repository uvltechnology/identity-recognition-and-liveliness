import { useState, useEffect } from 'react';
import Header from '../components/Header';

const CodeBlock = ({ code, language = 'json' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group w-full max-w-full overflow-hidden">
      <pre className="bg-gray-900 text-gray-100 p-3 sm:p-4 rounded-lg overflow-x-auto text-sm max-h-60 sm:max-h-80 overflow-y-auto w-full">
        <code className="break-all sm:break-normal whitespace-pre-wrap">{code}</code>
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

const EndpointTester = ({ 
  title, 
  description, 
  method, 
  endpoint, 
  defaultBody,
  onSessionCreated 
}) => {
  const [requestBody, setRequestBody] = useState(JSON.stringify(defaultBody, null, 2));
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const body = JSON.parse(requestBody);
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      setResponse(data);

      if (data.success && data.sessionId && onSessionCreated) {
        onSessionCreated(data);
      }
    } catch (err) {
      setError(err.message || 'Failed to execute request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="px-2 py-1 bg-white/20 text-white text-sm font-bold rounded">
            {method}
          </span>
          <code className="text-white/90 text-sm break-all">{endpoint}</code>
        </div>
        <h3 className="text-white font-semibold mt-2 text-base sm:text-lg">{title}</h3>
        <p className="text-white/80 text-sm mt-1">{description}</p>
      </div>

      <div className="p-4 sm:p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Request Body
          </label>
          <textarea
            value={requestBody}
            onChange={(e) => setRequestBody(e.target.value)}
            className="w-full h-36 sm:h-40 px-3 py-2 text-sm font-mono bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            spellCheck={false}
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Sending...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Send Request
            </>
          )}
        </button>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">Error</span>
            </div>
            <p className="text-red-600 text-sm mt-1">{error}</p>
          </div>
        )}

        {response && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Response
              <span className={`ml-2 px-2 py-0.5 text-xs rounded ${response.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {response.success ? 'Success' : 'Failed'}
              </span>
            </label>
            <CodeBlock code={JSON.stringify(response, null, 2)} />
          </div>
        )}
      </div>
    </div>
  );
};

const SessionCard = ({ session, type }) => {
  const [showIframe, setShowIframe] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const getSessionUrl = () => {
    if (type === 'id') {
      return `/session/idverification/${session.sessionId}`;
    } else if (type === 'selfie') {
      return `/session/selfieliveness/${session.sessionId}`;
    } else if (type === 'combined') {
      return `/session/combined/${session.sessionId}`;
    }
    return session.sessionUrl || session.embedUrl;
  };

  const checkWebhookStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/webhooks/status/${session.sessionId}`);
      const data = await res.json();
      setWebhookStatus(data.success ? data.data : null);
    } catch (e) {
      console.error('Failed to check webhook status:', e);
    }
    setLoading(false);
  };

  const triggerWebhook = async (type) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/webhooks/trigger/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionId: session.sessionId,
          reason: type === 'failed' ? 'Manual test trigger' : undefined
        })
      });
      const data = await res.json();
      if (data.success && data.redirectUrl) {
        window.open(data.redirectUrl, '_blank');
      }
      await checkWebhookStatus();
    } catch (e) {
      console.error('Failed to trigger webhook:', e);
    }
    setLoading(false);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 text-sm font-medium rounded ${
            type === 'id' ? 'bg-blue-100 text-blue-700' :
            type === 'selfie' ? 'bg-purple-100 text-purple-700' :
            'bg-green-100 text-green-700'
          }`}>
            {type === 'id' ? 'ID Verification' : type === 'selfie' ? 'Selfie Liveness' : 'Combined Flow'}
          </span>
          {session.webhookRegistered && (
            <span className="px-2 py-1 text-xs font-medium rounded bg-yellow-100 text-yellow-700">
              Webhook
            </span>
          )}
          {webhookStatus && (
            <span className={`px-2 py-1 text-xs font-medium rounded ${
              webhookStatus.status === 'success' ? 'bg-green-100 text-green-700' :
              webhookStatus.status === 'failed' ? 'bg-red-100 text-red-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {webhookStatus.status}
            </span>
          )}
        </div>
        <span className="text-sm text-gray-500">
          {new Date().toLocaleTimeString()}
        </span>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
          <span className="text-gray-500">Session ID:</span>
          <code className="px-2 py-0.5 bg-gray-100 rounded text-gray-700 text-sm break-all">{session.sessionId}</code>
        </div>
        {session.selfieSessionId && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <span className="text-gray-500">Selfie Session:</span>
            <code className="px-2 py-0.5 bg-gray-100 rounded text-gray-700 text-sm break-all">{session.selfieSessionId}</code>
          </div>
        )}
      </div>

      {/* Webhook Actions */}
      <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
        <button
          onClick={() => triggerWebhook('success')}
          disabled={loading}
          className="px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 text-xs font-medium rounded transition-colors disabled:opacity-50"
        >
          ✓ Success
        </button>
        <button
          onClick={() => triggerWebhook('failed')}
          disabled={loading}
          className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-medium rounded transition-colors disabled:opacity-50"
        >
          ✕ Failed
        </button>
        <button
          onClick={checkWebhookStatus}
          disabled={loading}
          className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded transition-colors disabled:opacity-50"
        >
          🔄 Status
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mt-4">
        <a
          href={getSessionUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 px-3 py-2.5 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg text-center transition-colors"
        >
          Open in New Tab
        </a>
        <button
          onClick={() => setShowIframe(!showIframe)}
          className="flex-1 px-3 py-2.5 sm:py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors hidden sm:block"
        >
          {showIframe ? 'Hide Preview' : 'Show Preview'}
        </button>
      </div>

      {showIframe && (
        <div className="mt-4 border border-gray-300 rounded-lg overflow-hidden hidden sm:block">
          <div className="bg-gray-100 px-3 py-2 text-xs text-gray-600 border-b border-gray-300 truncate">
            Preview: {getSessionUrl()}
          </div>
          <iframe
            src={getSessionUrl()}
            className="w-full h-[400px] lg:h-[500px]"
            allow="camera"
            title="Verification Preview"
          />
        </div>
      )}
    </div>
  );
};

export default function ApiDemo() {
  const [createdSessions, setCreatedSessions] = useState([]);
  const [baseUrl, setBaseUrl] = useState('');

  useEffect(() => {
    // Set baseUrl only on client-side
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin);
    }
  }, []);

  const handleSessionCreated = (data, type) => {
    setCreatedSessions(prev => [{ ...data, type, createdAt: new Date() }, ...prev]);
  };

  // Default request bodies with webhook URLs
  const getIdVerificationBody = () => ({
    idType: "national-id",
    successUrl: baseUrl ? `${baseUrl}/demo/success` : "/demo/success",
    failureUrl: baseUrl ? `${baseUrl}/demo/failed` : "/demo/failed",
    webhookUrl: baseUrl ? `${baseUrl}/api/webhooks/receive` : "/api/webhooks/receive",
    testMode: false,
    authRequired: false
  });

  const getSelfieBody = () => ({
    successUrl: baseUrl ? `${baseUrl}/demo/success` : "/demo/success",
    failureUrl: baseUrl ? `${baseUrl}/demo/failed` : "/demo/failed",
    webhookUrl: baseUrl ? `${baseUrl}/api/webhooks/receive` : "/api/webhooks/receive",
    testMode: false
  });

  const getCombinedBody = () => ({
    idType: "national-id",
    successUrl: baseUrl ? `${baseUrl}/demo/success` : "/demo/success",
    failureUrl: baseUrl ? `${baseUrl}/demo/failed` : "/demo/failed",
    webhookUrl: baseUrl ? `${baseUrl}/api/webhooks/receive` : "/api/webhooks/receive",
    testMode: false,
    authRequired: false
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Introduction */}
        <div className="mb-6 sm:mb-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-4 sm:p-6 text-white">
          <h2 className="text-xl sm:text-2xl font-bold mb-2">Interactive API Tester</h2>
          <p className="text-white/90 text-sm sm:text-base">
            Test the three session creation endpoints below. Each endpoint creates a verification session
            that you can then open and interact with.
          </p>
          <div className="flex flex-wrap gap-3 sm:gap-4 mt-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="w-2 h-2 bg-blue-300 rounded-full"></span>
              ID Verification
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="w-2 h-2 bg-purple-300 rounded-full"></span>
              Selfie Liveness
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="w-2 h-2 bg-green-300 rounded-full"></span>
              Combined Flow
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-4 sm:gap-8">
          {/* Left: Endpoint Testers */}
          <div className="space-y-4 sm:space-y-6">
            <EndpointTester
              title="Create ID Verification Session"
              description="Creates a session for ID document verification only"
              method="POST"
              endpoint="/api/verify/id/create"
              defaultBody={getIdVerificationBody()}
              onSessionCreated={(data) => handleSessionCreated(data, 'id')}
            />

            <EndpointTester
              title="Create Selfie Liveness Session"
              description="Creates a session for selfie liveness verification only"
              method="POST"
              endpoint="/api/verify/selfie/create"
              defaultBody={getSelfieBody()}
              onSessionCreated={(data) => handleSessionCreated(data, 'selfie')}
            />

            <EndpointTester
              title="Create Combined Verification Session"
              description="Creates a combined flow: ID verification first, then selfie liveness"
              method="POST"
              endpoint="/api/verify/combined/create"
              defaultBody={getCombinedBody()}
              onSessionCreated={(data) => handleSessionCreated(data, 'combined')}
            />
          </div>

          {/* Right: Created Sessions */}
          <div>
            <div className="lg:sticky lg:top-24">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 text-base">Created Sessions</h3>
                    {createdSessions.length > 0 && (
                      <button
                        onClick={() => setCreatedSessions([])}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Sessions created during this demo
                  </p>
                </div>

                <div className="p-3 sm:p-4 max-h-[300px] sm:max-h-[calc(100vh-200px)] overflow-y-auto">
                  {createdSessions.length === 0 ? (
                    <div className="text-center py-8 sm:py-12">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                        <svg className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                      <p className="text-gray-500 text-sm">No sessions created yet</p>
                      <p className="text-sm text-gray-400 mt-1">
                        Use the endpoints above to create sessions
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 sm:space-y-4">
                      {createdSessions.map((session, index) => (
                        <SessionCard key={index} session={session} type={session.type} />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Links */}
              <div className="mt-4 sm:mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4">
                <h4 className="font-medium text-gray-900 mb-2 sm:mb-3 text-base">Quick Links</h4>
                <div className="grid grid-cols-1 sm:grid-cols-1 gap-1 sm:gap-2">
                  <a
                    href="/id-verification-test"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2.5 sm:py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                    </svg>
                    ID Verification Test
                  </a>
                  <a
                    href="/selfie-liveness-test"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2.5 sm:py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Selfie Liveness Test
                  </a>
                  <a
                    href="/docs#sessions"
                    className="flex items-center gap-2 px-3 py-2.5 sm:py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Sessions Docs
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ID Types Reference */}
        <div className="mt-8 sm:mt-12 bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <h3 className="font-semibold text-gray-900 mb-3 sm:mb-4 text-base">Supported ID Types</h3>
          <p className="text-sm text-gray-500 mb-3 sm:hidden">Tap to copy ID type</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
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
              <div
                key={idType.id}
                className="px-2 sm:px-3 py-2 bg-gray-50 rounded-lg text-sm cursor-pointer hover:bg-blue-50 hover:text-blue-700 active:bg-blue-100 transition-colors"
                onClick={() => navigator.clipboard.writeText(idType.id)}
                title="Click to copy"
              >
                <code className="text-xs text-gray-500 break-all">{idType.id}</code>
                <div className="font-medium mt-0.5 text-sm">{idType.name}</div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-8 sm:mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <p className="text-sm text-gray-500 text-center">
            Identity Verification API Demo • <a href="/docs" className="text-blue-600 hover:underline">View Full Documentation</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
