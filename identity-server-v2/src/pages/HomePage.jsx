import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="font-bold text-gray-900 text-lg hidden sm:block">Identity API</span>
          </div>
          <Link
            to="/docs"
            className="text-sm text-gray-600 hover:text-blue-600 font-medium"
          >
            Documentation →
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-16">
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-3 sm:mb-4">
            Identity Verification Service
          </h1>
          <p className="text-gray-600 text-sm sm:text-base max-w-xl mx-auto px-4">
            Secure ID verification with AI-powered OCR extraction and real-time liveness detection for Philippine government IDs.
          </p>
        </div>
        
        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-8 sm:mb-12 max-w-2xl mx-auto">
          <Link
            to="/id-verification-test"
            className="flex flex-col items-center justify-center rounded-xl bg-white border-2 border-blue-100 hover:border-blue-300 px-4 py-5 sm:py-6 text-center shadow-sm hover:shadow-md transition-all"
          >
            <span className="text-3xl sm:text-4xl mb-2">🪪</span>
            <span className="font-semibold text-gray-900 text-sm sm:text-base">ID Verification</span>
            <span className="text-xs text-gray-500 mt-1">Scan & extract ID data</span>
          </Link>
          <Link
            to="/selfie-liveness-test"
            className="flex flex-col items-center justify-center rounded-xl bg-white border-2 border-purple-100 hover:border-purple-300 px-4 py-5 sm:py-6 text-center shadow-sm hover:shadow-md transition-all"
          >
            <span className="text-3xl sm:text-4xl mb-2">🤳</span>
            <span className="font-semibold text-gray-900 text-sm sm:text-base">Selfie Liveness</span>
            <span className="text-xs text-gray-500 mt-1">Real-time face detection</span>
          </Link>
          <Link
            to="/docs"
            className="flex flex-col items-center justify-center rounded-xl bg-white border-2 border-gray-100 hover:border-gray-300 px-4 py-5 sm:py-6 text-center shadow-sm hover:shadow-md transition-all"
          >
            <span className="text-3xl sm:text-4xl mb-2">📚</span>
            <span className="font-semibold text-gray-900 text-sm sm:text-base">API Docs</span>
            <span className="text-xs text-gray-500 mt-1">Integration guide</span>
          </Link>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* API Endpoints */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 text-sm sm:text-base">API Endpoints</h2>
            </div>
            <ul className="divide-y divide-gray-100">
              {[
                { path: '/api/health', desc: 'Health check' },
                { path: '/api/ids', desc: 'List supported ID types' },
                { path: '/api/ocr/base64', desc: 'OCR processing' },
                { path: '/api/ai/:idType/parse', desc: 'AI field extraction' },
                { path: '/api/session/:id', desc: 'Get session info' },
                { path: '/embed/session/:id', desc: 'Embed verification' },
              ].map((item) => (
                <li key={item.path} className="px-4 sm:px-6 py-2.5 sm:py-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                  <code className="text-xs sm:text-sm bg-gray-100 px-2 py-0.5 rounded text-blue-600 font-mono whitespace-nowrap">{item.path}</code>
                  <span className="text-xs sm:text-sm text-gray-500">{item.desc}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Pages */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 text-sm sm:text-base">Available Pages</h2>
            </div>
            <ul className="divide-y divide-gray-100">
              {[
                { path: '/', to: '/', label: 'Home', desc: 'This page' },
                { path: '/id-verification-test', to: '/id-verification-test', label: 'ID Test', desc: 'Scan & extract ID' },
                { path: '/selfie-liveness-test', to: '/selfie-liveness-test', label: 'Liveness', desc: 'Face detection' },
                { path: '/docs', to: '/docs', label: 'Docs', desc: 'API documentation' },
                { path: '/embed/session/:id', to: '/embed/session/demo-123', label: 'Embed', desc: 'For iframe integration' },
              ].map((item) => (
                <li key={item.path} className="px-4 sm:px-6 py-2.5 sm:py-3">
                  <Link to={item.to} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 group">
                    <code className="text-xs sm:text-sm bg-blue-50 px-2 py-0.5 rounded text-blue-600 font-mono group-hover:bg-blue-100 transition whitespace-nowrap">{item.path}</code>
                    <span className="text-xs sm:text-sm text-gray-500">{item.desc}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Features */}
        <div className="mt-8 sm:mt-12 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {[
            { icon: '🇵🇭', label: '8 ID Types', desc: 'Philippine IDs' },
            { icon: '🤖', label: 'AI Powered', desc: 'Gemini extraction' },
            { icon: '👁️', label: 'Liveness', desc: 'Anti-spoofing' },
            { icon: '⚡', label: 'Real-time', desc: 'Fast processing' },
          ].map((feature) => (
            <div key={feature.label} className="bg-white rounded-lg p-3 sm:p-4 text-center border border-gray-100">
              <span className="text-xl sm:text-2xl">{feature.icon}</span>
              <p className="font-medium text-gray-900 text-xs sm:text-sm mt-1">{feature.label}</p>
              <p className="text-xs text-gray-500">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-8 sm:mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 text-center text-xs sm:text-sm text-gray-500">
          Identity Verification API v2.0 • Yamcon
        </div>
      </footer>
    </div>
  );
}
