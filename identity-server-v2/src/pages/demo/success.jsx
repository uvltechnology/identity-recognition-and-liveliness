import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';

export default function VerificationSuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const [webhookData, setWebhookData] = useState(null);
  const [sessionData, setSessionData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!sessionId) {
        setLoading(false);
        return;
      }

      try {
        // Fetch webhook status
        const webhookRes = await fetch(`/api/webhooks/status/${sessionId}`);
        const webhookJson = await webhookRes.json();
        if (webhookJson.success) {
          setWebhookData(webhookJson.data);
        }

        // Fetch session data
        const sessionRes = await fetch(`/api/verify/session/${sessionId}`);
        const sessionJson = await sessionRes.json();
        if (sessionJson.success) {
          setSessionData(sessionJson.session);
        }
      } catch (e) {
        console.error('Failed to fetch data:', e);
      }
      setLoading(false);
    };

    fetchData();
  }, [sessionId]);

  const fields = sessionData?.result?.fields || webhookData?.verification_data?.fields || {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 max-w-lg w-full">
        {/* Success Icon */}
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-3">
          Verification Successful!
        </h1>
        <p className="text-gray-600 text-center mb-6">
          Your identity has been verified successfully.
        </p>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full"></div>
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

            {/* Extracted Fields */}
            {Object.keys(fields).length > 0 && (
              <div className="bg-green-50 rounded-lg p-4 mb-4">
                <p className="text-sm font-medium text-green-800 mb-3">Verified Information</p>
                <div className="space-y-2">
                  {fields.firstName && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">First Name:</span>
                      <span className="font-medium text-gray-900">{fields.firstName}</span>
                    </div>
                  )}
                  {fields.lastName && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Last Name:</span>
                      <span className="font-medium text-gray-900">{fields.lastName}</span>
                    </div>
                  )}
                  {fields.birthDate && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Birth Date:</span>
                      <span className="font-medium text-gray-900">{fields.birthDate}</span>
                    </div>
                  )}
                  {fields.idNumber && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">ID Number:</span>
                      <span className="font-medium text-gray-900">{fields.idNumber}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Webhook Status */}
            {webhookData && (
              <div className="bg-blue-50 rounded-lg p-4 mb-6">
                <p className="text-sm font-medium text-blue-800 mb-2">Webhook Status</p>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    webhookData.status === 'success' ? 'bg-green-500' :
                    webhookData.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'
                  }`}></span>
                  <span className="text-sm text-blue-700 capitalize">{webhookData.status}</span>
                  <span className="text-sm text-blue-600">• {webhookData.session_type}</span>
                </div>
              </div>
            )}
          </>
        )}

        <div className="space-y-3">
          <Link 
            to="/api-demo" 
            className="block w-full px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors text-center"
          >
            Back to API Demo
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
