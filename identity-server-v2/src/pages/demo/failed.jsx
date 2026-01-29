import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';

export default function VerificationFailed() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const reason = searchParams.get('reason');
  const [webhookData, setWebhookData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!sessionId) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/webhooks/status/${sessionId}`);
        const data = await res.json();
        if (data.success) {
          setWebhookData(data.data);
        }
      } catch (e) {
        console.error('Failed to fetch webhook status:', e);
      }
      setLoading(false);
    };

    fetchData();
  }, [sessionId]);

  const failureReason = reason || 
    (webhookData?.verification_data?.reason) ||
    'Your identity verification was unsuccessful.';

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-rose-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 max-w-lg w-full">
        {/* Failed Icon */}
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-3">
          Verification Failed
        </h1>
        <p className="text-gray-600 text-center mb-6">
          {failureReason}
        </p>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <>
            {/* Session Info */}
            {sessionId && (
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-500 mb-1">Session ID</p>
                <code className="text-sm text-gray-800 break-all">{sessionId}</code>
              </div>
            )}

            {/* Failure Details */}
            {webhookData?.verification_data && (
              <div className="bg-red-50 rounded-lg p-4 mb-4">
                <p className="text-sm font-medium text-red-800 mb-2">Failure Details</p>
                <p className="text-sm text-red-700">
                  {typeof webhookData.verification_data === 'string' 
                    ? JSON.parse(webhookData.verification_data)?.reason 
                    : webhookData.verification_data?.reason || 'No additional details available'}
                </p>
              </div>
            )}

            {/* Webhook Status */}
            {webhookData && (
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <p className="text-sm font-medium text-gray-700 mb-2">Webhook Status</p>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    webhookData.status === 'success' ? 'bg-green-500' :
                    webhookData.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'
                  }`}></span>
                  <span className="text-sm text-gray-600 capitalize">{webhookData.status}</span>
                  <span className="text-sm text-gray-500">• {webhookData.session_type}</span>
                </div>
              </div>
            )}

            {/* Common Failure Reasons */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-sm font-medium text-yellow-800 mb-2">Common reasons for failure:</p>
              <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
                <li>Poor image quality or lighting</li>
                <li>ID document not fully visible</li>
                <li>Expired or invalid ID document</li>
                <li>Required fields not detected</li>
              </ul>
            </div>
          </>
        )}

        <div className="space-y-3">
          <Link 
            to="/api-demo" 
            className="block w-full px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors text-center"
          >
            Try Again
          </Link>
          <Link 
            to="/" 
            className="block w-full px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors text-center"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
