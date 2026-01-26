import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-2xl mx-auto p-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Identity Verification Service
        </h1>
        <p className="text-gray-600 mb-8">
          This is the SSR-enabled identity verification server. Use the embed endpoint
          to integrate identity verification into your application.
        </p>
        
        {/* Quick Actions */}
        <div className="flex justify-center gap-4 mb-8">
          <Link
            to="/id-verification-test"
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-6 py-3 text-sm font-medium text-white shadow hover:bg-blue-700"
          >
            🪪 ID Verification Test
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-2">API Endpoints</h2>
          <ul className="text-left text-sm text-gray-600 space-y-2">
            <li><code className="bg-gray-100 px-2 py-1 rounded">/api/health</code> - Health check</li>
            <li><code className="bg-gray-100 px-2 py-1 rounded">/api/ids</code> - List supported ID types</li>
            <li><code className="bg-gray-100 px-2 py-1 rounded">/api/ocr/base64</code> - OCR processing</li>
            <li><code className="bg-gray-100 px-2 py-1 rounded">/api/ai/:idType/parse</code> - AI field extraction</li>
            <li><code className="bg-gray-100 px-2 py-1 rounded">/api/session/:id</code> - Get session info</li>
            <li><code className="bg-gray-100 px-2 py-1 rounded">/embed/session/:id</code> - Embed verification page</li>
          </ul>
        </div>

        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-2">Pages</h2>
          <ul className="text-left text-sm text-gray-600 space-y-2">
            <li>
              <Link to="/" className="text-blue-600 hover:underline">/</Link>
              {' - '}Home page (this page)
            </li>
            <li>
              <Link to="/id-verification-test" className="text-blue-600 hover:underline">/id-verification-test</Link>
              {' - '}ID scanning demo
            </li>
            <li>
              <Link to="/embed/session/demo-123" className="text-blue-600 hover:underline">/embed/session/:id</Link>
              {' - '}Embed verification (for iframe)
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
