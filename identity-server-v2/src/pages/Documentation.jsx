import { useState, useRef, useEffect } from 'react';
import Header from '../components/Header';
import { FaRocket, FaServer, FaIdBadge, FaCube, FaCommentDots, FaChartBar, FaBell, FaBolt, FaFlask } from 'react-icons/fa';
import { MdWebhook } from 'react-icons/md';

const MAX_CODE_HEIGHT = 280; // Max height in pixels before showing "View full code"

const CodeBlock = ({ code }) => {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [needsExpand, setNeedsExpand] = useState(false);
  const codeRef = useRef(null);

  useEffect(() => {
    if (codeRef.current) {
      setNeedsExpand(codeRef.current.scrollHeight > MAX_CODE_HEIGHT);
    }
  }, [code]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <div 
        className={`relative ${!isExpanded && needsExpand ? 'overflow-hidden' : ''}`}
        style={{ maxHeight: !isExpanded && needsExpand ? `${MAX_CODE_HEIGHT}px` : 'none' }}
      >
        <pre 
          ref={codeRef}
          className="bg-gray-900 text-gray-100 p-3 sm:p-4 rounded-lg overflow-x-auto text-sm"
        >
          <code>{code}</code>
        </pre>
        {/* Gradient fade overlay when collapsed */}
        {!isExpanded && needsExpand && (
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-gray-900 to-transparent rounded-b-lg pointer-events-none" />
        )}
      </div>
      {/* Copy button */}
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 px-2 py-1 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
      {/* View full code / Collapse button */}
      {needsExpand && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full mt-1 py-1.5 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors flex items-center justify-center gap-1"
        >
          {isExpanded ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
              Collapse code
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              View full code
            </>
          )}
        </button>
      )}
    </div>
  );
};

// Tabbed code block component for multiple language examples
const TabbedCodeBlock = ({ tabs }) => {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Tab buttons */}
      <div className="flex bg-gray-100 border-b border-gray-200">
        {tabs.map((tab, index) => (
          <button
            key={tab.label}
            onClick={() => setActiveTab(index)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === index
                ? 'bg-white text-gray-900 border-b-2 border-blue-500 -mb-px'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <div className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold ${tab.iconBg}`}>
              {tab.icon}
            </div>
            {tab.label}
          </button>
        ))}
      </div>
      {/* Active tab content */}
      <div className="p-0">
        <CodeBlock code={tabs[activeTab].code} />
      </div>
    </div>
  );
};

// Parameter table component
const ParamTable = ({ title, params }) => {
  if (!params || params.length === 0) return null;
  
  return (
    <div className="mb-3">
      <h4 className="text-xs font-semibold text-gray-500 mb-2">{title}</h4>
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Parameter</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Type</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Required</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {params.map((param, idx) => (
              <tr key={idx}>
                <td className="px-3 py-2"><code className="text-blue-600">{param.name}</code></td>
                <td className="px-3 py-2 text-gray-500">{param.type}</td>
                <td className="px-3 py-2">
                  {param.required ? (
                    <span className="text-red-500">Yes</span>
                  ) : (
                    <span className="text-gray-400">No</span>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-600">{param.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Accordion-style endpoint card (controlled by parent for single-open behavior)
const EndpointCard = ({ method, path, description, requestBody, responseBody, requestParams, responseParams, isOpen, onToggle }) => {
  const methodColors = {
    GET: 'bg-green-100 text-green-700',
    POST: 'bg-blue-100 text-blue-700',
    PUT: 'bg-yellow-100 text-yellow-700',
    DELETE: 'bg-red-100 text-red-700',
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden mb-3">
      {/* Accordion Header - Always visible */}
      <button
        onClick={onToggle}
        className="w-full bg-gray-50 px-3 sm:px-4 py-3 flex items-center justify-between gap-2 hover:bg-gray-100 transition-colors"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className={`px-2 py-1 rounded text-sm font-bold ${methodColors[method]}`}>{method}</span>
          <code className="text-sm font-mono text-gray-800 break-all">{path}</code>
        </div>
        <svg 
          className={`w-5 h-5 text-gray-500 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {/* Accordion Content - Collapsible */}
      {isOpen && (
        <div className="p-3 sm:p-4 border-t border-gray-200 bg-white">
          <p className="text-gray-600 mb-3 text-sm">{description}</p>
          
          {/* Request section */}
          {(requestParams || requestBody) && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                Request
              </h4>
              <ParamTable title="Parameters" params={requestParams} />
              {requestBody && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 mb-1">Example</h4>
                  <CodeBlock code={requestBody} />
                </div>
              )}
            </div>
          )}
          
          {/* Response section */}
          {(responseParams || responseBody) && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                Response
              </h4>
              <ParamTable title="Fields" params={responseParams} />
              {responseBody && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 mb-1">Example</h4>
                  <CodeBlock code={responseBody} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Accordion group to ensure only one is open at a time
const EndpointGroup = ({ endpoints }) => {
  const [openIndex, setOpenIndex] = useState(null);
  
  return (
    <>
      {endpoints.map((endpoint, index) => (
        <EndpointCard
          key={index}
          {...endpoint}
          isOpen={openIndex === index}
          onToggle={() => setOpenIndex(openIndex === index ? null : index)}
        />
      ))}
    </>
  );
};

// Sidebar navigation sections
const sidebarSections = [
  { id: 'quick-start', label: 'Quick Start', icon: FaRocket },
  { id: 'sessions', label: 'API Endpoints', icon: FaServer },
  { id: 'id-types', label: 'Supported IDs', icon: FaIdBadge },
  { id: 'embed', label: 'Embed Integration', icon: FaCube },
  { id: 'iframe-events', label: 'Iframe Events', icon: FaCommentDots },
  { id: 'status', label: 'Session Status', icon: FaChartBar },
  { id: 'webhooks', label: 'Webhooks', icon: FaBell },
  { id: 'webhook-api', label: 'Webhook API', icon: MdWebhook },
];

// Sidebar component
const Sidebar = ({ activeSection }) => {
  const handleClick = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <aside className="hidden lg:block w-56 flex-shrink-0">
      <nav className="sticky top-20 space-y-1">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-3">
          Documentation
        </div>
        {sidebarSections.map((section) => {
          const IconComponent = section.icon;
          return (
            <button
              key={section.id}
              onClick={() => handleClick(section.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                activeSection === section.id
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <IconComponent className="w-4 h-4" />
              {section.label}
            </button>
          );
        })}
        
        {/* Try API Demo link */}
        <div className="pt-4 mt-4 border-t border-gray-200">
          <a
            href="/api-demo"
            className="flex items-center gap-2 px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
          >
            <FaFlask className="w-4 h-4" />
            Try API Demo
          </a>
        </div>
      </nav>
    </aside>
  );
};

export default function Documentation() {
  const [activeSection, setActiveSection] = useState('quick-start');

  // Track active section based on scroll position
  useEffect(() => {
    const handleScroll = () => {
      const sections = sidebarSections.map(s => document.getElementById(s.id)).filter(Boolean);
      const scrollPos = window.scrollY + 100;

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        if (section.offsetTop <= scrollPos) {
          setActiveSection(section.id);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        <div className="lg:flex lg:gap-8">
          {/* Sidebar - Desktop only */}
          <Sidebar activeSection={activeSection} />

          {/* Main content */}
          <main className="flex-1 min-w-0 max-w-4xl">
            {/* Header */}
            <header className="mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">API Documentation</h1>
              <p className="text-gray-600 text-sm sm:text-base">
                Integrate identity verification into your application with our simple API.
              </p>
              <div className="mt-3 inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm">
                Base URL: <code className="font-mono">https://identity.logicatechnology.com</code>
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

          <EndpointGroup endpoints={[
            {
              method: 'POST',
              path: '/api/verify/id/create',
              description: 'Create an ID-only verification session.',
              requestParams: [
                { name: 'idType', type: 'string', required: true, description: 'Type of ID to verify (e.g., national-id, passport)' },
                { name: 'successUrl', type: 'string', required: false, description: 'URL to redirect after successful verification' },
                { name: 'failureUrl', type: 'string', required: false, description: 'URL to redirect after failed verification' },
                { name: 'webhookUrl', type: 'string', required: false, description: 'URL to receive webhook notifications' },
              ],
              responseParams: [
                { name: 'success', type: 'boolean', required: true, description: 'Whether the request was successful' },
                { name: 'sessionId', type: 'string', required: true, description: 'Unique session identifier' },
                { name: 'embedUrl', type: 'string', required: true, description: 'URL to embed in iframe' },
              ],
              requestBody: `{
  "idType": "national-id",
  "successUrl": "https://yourapp.com/callback",
  "webhookUrl": "https://yourapp.com/webhook"
}`,
              responseBody: `{
  "success": true,
  "sessionId": "sess_id_abc123",
  "embedUrl": "https://identity.logica.dev/embed/session/sess_id_abc123"
}`
            },
            {
              method: 'POST',
              path: '/api/verify/selfie/create',
              description: 'Create a selfie liveness verification session.',
              requestParams: [
                { name: 'successUrl', type: 'string', required: false, description: 'URL to redirect after successful verification' },
                { name: 'failureUrl', type: 'string', required: false, description: 'URL to redirect after failed verification' },
                { name: 'webhookUrl', type: 'string', required: false, description: 'URL to receive webhook notifications' },
              ],
              responseParams: [
                { name: 'success', type: 'boolean', required: true, description: 'Whether the request was successful' },
                { name: 'sessionId', type: 'string', required: true, description: 'Unique session identifier' },
                { name: 'sessionUrl', type: 'string', required: true, description: 'URL for selfie verification page' },
              ],
              requestBody: `{
  "successUrl": "https://yourapp.com/callback",
  "webhookUrl": "https://yourapp.com/webhook"
}`,
              responseBody: `{
  "success": true,
  "sessionId": "sess_selfie_xyz789",
  "sessionUrl": "https://identity.logica.dev/session/selfieliveness/sess_selfie_xyz789"
}`
            },
            {
              method: 'POST',
              path: '/api/verify/combined/create',
              description: 'Create a combined flow: ID verification → selfie liveness with face matching.',
              requestParams: [
                { name: 'idType', type: 'string', required: true, description: 'Type of ID to verify (e.g., national-id, passport)' },
                { name: 'successUrl', type: 'string', required: false, description: 'URL to redirect after successful verification' },
                { name: 'failureUrl', type: 'string', required: false, description: 'URL to redirect after failed verification' },
                { name: 'webhookUrl', type: 'string', required: false, description: 'URL to receive webhook notifications' },
              ],
              responseParams: [
                { name: 'success', type: 'boolean', required: true, description: 'Whether the request was successful' },
                { name: 'sessionId', type: 'string', required: true, description: 'ID verification session identifier' },
                { name: 'selfieSessionId', type: 'string', required: true, description: 'Linked selfie session identifier' },
                { name: 'embedUrl', type: 'string', required: true, description: 'URL to embed in iframe' },
              ],
              requestBody: `{
  "idType": "national-id",
  "successUrl": "https://yourapp.com/callback",
  "webhookUrl": "https://yourapp.com/webhook"
}`,
              responseBody: `{
  "success": true,
  "sessionId": "sess_combined_abc123",
  "selfieSessionId": "sess_selfie_def456",
  "embedUrl": "https://identity.logica.dev/embed/session/sess_combined_abc123"
}`
            },
            {
              method: 'GET',
              path: '/api/session/:id',
              description: 'Get the current state of a verification session including verification results.',
              requestParams: [
                { name: 'id', type: 'string', required: true, description: 'Session ID (URL parameter)' },
              ],
              responseParams: [
                { name: 'id', type: 'string', required: true, description: 'Session identifier' },
                { name: 'status', type: 'string', required: true, description: 'Current status (pending, in_progress, completed, failed, cancelled, expired)' },
                { name: 'payload', type: 'object', required: true, description: 'Session configuration data' },
                { name: 'extractedData', type: 'object', required: false, description: 'Extracted ID fields (null if not completed)' },
                { name: 'verificationResult', type: 'object', required: false, description: 'Verification result with status and data' },
                { name: 'verificationResult.status', type: 'string', required: false, description: 'Result status: success, failed, or null' },
                { name: 'verificationResult.faceMatch', type: 'object', required: false, description: 'Face matching result (selfie/combined only)' },
                { name: 'verificationResult.completedAt', type: 'string', required: false, description: 'ISO timestamp when verification completed' },
              ],
              responseBody: `// Completed session
{
  "id": "sess_abc123",
  "status": "completed",
  "payload": {
    "idType": "national-id",
    "verificationType": "combined"
  },
  "extractedData": {
    "firstName": "Juan",
    "lastName": "Dela Cruz",
    "idNumber": "1234-5678-9012",
    "dateOfBirth": "1990-01-15"
  },
  "verificationResult": {
    "status": "success",
    "faceMatch": {
      "match": true,
      "similarity": 0.85
    },
    "completedAt": "2026-01-30T10:30:00.000Z"
  }
}

// Pending/In-progress session
{
  "id": "sess_abc123",
  "status": "pending",
  "payload": {
    "idType": "national-id",
    "verificationType": "id"
  },
  "extractedData": null,
  "verificationResult": null
}`
            },
            {
              method: 'GET',
              path: '/api/ids',
              description: 'Get the list of all supported ID types for verification.',
              responseParams: [
                { name: 'success', type: 'boolean', required: true, description: 'Whether the request was successful' },
                { name: 'idTypes', type: 'array', required: true, description: 'Array of supported ID type objects' },
              ],
              responseBody: `{
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
}`
            }
          ]} />
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
  
  switch (identityOCR.action) {
    case 'verification_success':
      console.log('Success:', identityOCR.result);
      break;
    case 'verification_failed':
      console.log('Failed:', identityOCR.reason);
      break;
    case 'verification_cancelled':
      console.log('Cancelled:', identityOCR.reason);
      break;
  }
});`} />
            </div>
          </div>
        </section>

        {/* Iframe Events Section */}
        <section id="iframe-events" className="mb-10 scroll-mt-20">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">Iframe Parent Communication</h2>
          <p className="text-gray-600 mb-4 text-sm">
            When embedded in an iframe, the verification component sends postMessage events to the parent window 
            for success, failure, and cancellation states.
          </p>

          {/* Event Types */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
            <h3 className="font-semibold text-gray-900 mb-3">Event Actions</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left px-3 py-2 font-medium text-gray-700">Action</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-700">Status</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-700">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="px-3 py-2"><code className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs">verification_success</code></td>
                    <td className="px-3 py-2"><code className="text-xs">success</code></td>
                    <td className="px-3 py-2 text-gray-600">Verification completed successfully</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2"><code className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs">verification_failed</code></td>
                    <td className="px-3 py-2"><code className="text-xs">failed</code></td>
                    <td className="px-3 py-2 text-gray-600">Verification failed (face mismatch, OCR error, etc.)</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2"><code className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs">verification_cancelled</code></td>
                    <td className="px-3 py-2"><code className="text-xs">cancelled</code></td>
                    <td className="px-3 py-2 text-gray-600">User cancelled (declined consent, closed window)</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2"><code className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-xs">verification_problem</code></td>
                    <td className="px-3 py-2"><code className="text-xs">warning</code></td>
                    <td className="px-3 py-2 text-gray-600">Non-fatal issue (camera problem, lighting, etc.)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Payload Structure */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
            <h3 className="font-semibold text-gray-900 mb-3">Message Payload Structure</h3>
            <CodeBlock code={`// Success payload
{
  identityOCR: {
    action: 'verification_success',
    status: 'success',
    session: 'sess_abc123',
    verificationType: 'id' | 'selfie' | 'combined',
    result: {
      fields: { firstName, lastName, idNumber, ... },
      faceMatch: { match: true, similarity: 0.85 }  // selfie only
    },
    data: { ... }  // Extracted ID fields
  }
}

// Failure payload
{
  identityOCR: {
    action: 'verification_failed',
    status: 'failed',
    session: 'sess_abc123',
    verificationType: 'selfie',
    reason: 'face_mismatch',
    details: { similarity: 0.25, threshold: 0.30 }
  }
}

// Cancelled payload
{
  identityOCR: {
    action: 'verification_cancelled',
    status: 'cancelled',
    session: 'sess_abc123',
    verificationType: 'id',
    reason: 'consent_declined'
  }
}`} />
          </div>

          {/* Failure Reasons */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
            <h3 className="font-semibold text-gray-900 mb-3">Failure Reasons</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left px-3 py-2 font-medium text-gray-700">Reason</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-700">Verification Type</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-700">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="px-3 py-2"><code className="text-xs">face_mismatch</code></td>
                    <td className="px-3 py-2 text-gray-600">Selfie</td>
                    <td className="px-3 py-2 text-gray-600">Face doesn't match the ID photo</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2"><code className="text-xs">id_type_mismatch</code></td>
                    <td className="px-3 py-2 text-gray-600">ID</td>
                    <td className="px-3 py-2 text-gray-600">Detected ID type doesn't match expected</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2"><code className="text-xs">missing_required_fields</code></td>
                    <td className="px-3 py-2 text-gray-600">ID</td>
                    <td className="px-3 py-2 text-gray-600">Required fields not extracted from ID</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2"><code className="text-xs">processing_error</code></td>
                    <td className="px-3 py-2 text-gray-600">All</td>
                    <td className="px-3 py-2 text-gray-600">Server-side processing error</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2"><code className="text-xs">consent_declined</code></td>
                    <td className="px-3 py-2 text-gray-600">All</td>
                    <td className="px-3 py-2 text-gray-600">User declined camera consent</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Complete Example */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
            <h3 className="font-semibold text-gray-900 mb-3">Complete Event Handler Example</h3>
            <CodeBlock code={`// Complete parent window event handler
window.addEventListener('message', (event) => {
  // Security: verify origin
  if (event.origin !== 'https://identity.logica.dev') return;
  
  const { identityOCR } = event.data;
  if (!identityOCR) return;
  
  const { action, status, session, reason, result, details, verificationType } = identityOCR;
  
  switch (action) {
    case 'verification_success':
      console.log('✅ Verification successful!');
      console.log('Session:', session);
      console.log('Type:', verificationType);
      console.log('Data:', result);
      
      // Close the iframe or redirect
      document.getElementById('verification-iframe').remove();
      showSuccessMessage('Identity verified!');
      break;
      
    case 'verification_failed':
      console.log('❌ Verification failed');
      console.log('Reason:', reason);
      console.log('Details:', details);
      
      // Show error and allow retry
      showErrorMessage(getErrorMessage(reason));
      break;
      
    case 'verification_cancelled':
      console.log('⚠️ User cancelled verification');
      console.log('Reason:', reason);
      
      // Clean up and show cancellation message
      document.getElementById('verification-iframe').remove();
      showMessage('Verification was cancelled');
      break;
      
    case 'verification_problem':
      console.log('⚠️ Issue detected:', identityOCR.message);
      // Optionally show warning to user
      break;
  }
});

function getErrorMessage(reason) {
  const messages = {
    'face_mismatch': 'Face does not match the ID photo',
    'id_type_mismatch': 'Wrong ID type detected',
    'missing_required_fields': 'Could not read all required ID fields',
    'processing_error': 'An error occurred, please try again',
    'consent_declined': 'Camera access is required for verification'
  };
  return messages[reason] || 'Verification failed';
}`} />
          </div>

          {/* Best Practices */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">💡 Best Practices</h3>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Always verify the event origin matches your expected domain</li>
              <li>Handle all action types (success, failed, cancelled)</li>
              <li>Provide clear user feedback for each state</li>
              <li>Use webhooks as backup for critical verification flows</li>
              <li>Store session IDs to correlate iframe events with server data</li>
            </ul>
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
            
            <TabbedCodeBlock tabs={[
              {
                label: 'Node.js',
                icon: 'JS',
                iconBg: 'bg-green-100 text-green-700',
                code: `// Express webhook handler
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
});`
              },
              {
                label: 'PHP',
                icon: 'PHP',
                iconBg: 'bg-blue-100 text-blue-700',
                code: `// Laravel webhook handler
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
});`
              },
              {
                label: 'Python',
                icon: 'PY',
                iconBg: 'bg-yellow-100 text-yellow-700',
                code: `# Flask webhook handler
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
    
    return jsonify({'received': True}), 200`
              }
            ]} />
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

          <EndpointGroup endpoints={[
            {
              method: 'GET',
              path: '/api/webhooks/status/:sessionId',
              description: 'Get the webhook status and event history for a session.',
              requestParams: [
                { name: 'sessionId', type: 'string', required: true, description: 'Session ID (URL parameter)' },
              ],
              responseParams: [
                { name: 'success', type: 'boolean', required: true, description: 'Whether the request was successful' },
                { name: 'data.session_id', type: 'string', required: true, description: 'Session identifier' },
                { name: 'data.status', type: 'string', required: true, description: 'Webhook status (success, failed, pending)' },
                { name: 'data.webhook_url', type: 'string', required: true, description: 'Configured webhook URL' },
                { name: 'data.attempts', type: 'number', required: true, description: 'Number of delivery attempts' },
                { name: 'data.events', type: 'array', required: true, description: 'List of webhook events' },
              ],
              responseBody: `{
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
}`
            },
            {
              method: 'GET',
              path: '/api/webhooks/list',
              description: 'List all webhooks (paginated).',
              requestParams: [
                { name: 'page', type: 'number', required: false, description: 'Page number (default: 1)' },
                { name: 'limit', type: 'number', required: false, description: 'Items per page (default: 20)' },
              ],
              responseParams: [
                { name: 'success', type: 'boolean', required: true, description: 'Whether the request was successful' },
                { name: 'data', type: 'array', required: true, description: 'Array of webhook records' },
                { name: 'total', type: 'number', required: true, description: 'Total number of webhooks' },
                { name: 'page', type: 'number', required: true, description: 'Current page number' },
                { name: 'limit', type: 'number', required: true, description: 'Items per page' },
              ],
              responseBody: `{
  "success": true,
  "data": [...],
  "total": 42,
  "page": 1,
  "limit": 20
}`
            },
            {
              method: 'POST',
              path: '/api/webhooks/trigger/success',
              description: 'Manually trigger a success webhook (for testing).',
              requestParams: [
                { name: 'sessionId', type: 'string', required: true, description: 'Session ID to trigger webhook for' },
                { name: 'data', type: 'object', required: false, description: 'Custom data to include in webhook' },
              ],
              responseParams: [
                { name: 'success', type: 'boolean', required: true, description: 'Whether the request was successful' },
                { name: 'redirectUrl', type: 'string', required: false, description: 'Configured success redirect URL' },
                { name: 'sessionId', type: 'string', required: true, description: 'Session identifier' },
              ],
              requestBody: `{
  "sessionId": "sess_abc123",
  "data": { "fields": { ... } }
}`,
              responseBody: `{
  "success": true,
  "redirectUrl": "https://yourapp.com/success?sessionId=sess_abc123",
  "sessionId": "sess_abc123"
}`
            },
            {
              method: 'POST',
              path: '/api/webhooks/trigger/failed',
              description: 'Manually trigger a failed webhook (for testing).',
              requestParams: [
                { name: 'sessionId', type: 'string', required: true, description: 'Session ID to trigger webhook for' },
                { name: 'reason', type: 'string', required: false, description: 'Failure reason message' },
              ],
              responseParams: [
                { name: 'success', type: 'boolean', required: true, description: 'Whether the request was successful' },
                { name: 'redirectUrl', type: 'string', required: false, description: 'Configured failure redirect URL' },
                { name: 'sessionId', type: 'string', required: true, description: 'Session identifier' },
                { name: 'reason', type: 'string', required: false, description: 'Failure reason' },
              ],
              requestBody: `{
  "sessionId": "sess_abc123",
  "reason": "ID document expired"
}`,
              responseBody: `{
  "success": true,
  "redirectUrl": "https://yourapp.com/failed?sessionId=sess_abc123&reason=...",
  "sessionId": "sess_abc123",
  "reason": "ID document expired"
}`
            }
          ]} />
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
      </div>
    </div>
  );
}
