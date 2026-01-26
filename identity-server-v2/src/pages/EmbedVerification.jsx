import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import ConsentOverlay from '../components/ConsentOverlay';
import CameraSection from '../components/CameraSection';
import ProblemAlert from '../components/ProblemAlert';

export default function EmbedVerification({ initialState = {} }) {
  const { id } = useParams();
  const [consentGiven, setConsentGiven] = useState(false);
  const [session, setSession] = useState(initialState.session || null);
  const [problem, setProblem] = useState(null);
  const [cameraStarted, setCameraStarted] = useState(false);

  const sessionId = id || (session && session.id);
  const expectedOrigin = initialState.config?.expectedOrigin || '*';

  // Fetch session data if not provided
  useEffect(() => {
    if (!session && sessionId) {
      fetch(`/api/session/${sessionId}`)
        .then((res) => res.json())
        .then((data) => setSession(data))
        .catch((err) => console.error('Failed to fetch session:', err));
    }
  }, [sessionId, session]);

  const handleConsentAccept = () => {
    setConsentGiven(true);
    setCameraStarted(true);
    // Set global flags for compatibility with existing scripts
    if (typeof window !== 'undefined') {
      window.__IDENTITY_CONSENT_GIVEN__ = true;
      window.__IDENTITY_EMBED__ = true;
    }
  };

  const handleConsentDecline = async () => {
    setConsentGiven(false);
    setProblem({
      message: 'You declined the camera consent. The verification has been cancelled.',
      level: 'error',
    });

    // Notify parent if embedded
    if (typeof window !== 'undefined' && window.parent !== window) {
      const payload = {
        identityOCR: {
          action: 'close',
          reason: 'consent_declined',
          session: sessionId,
        },
      };
      try {
        window.parent.postMessage(payload, expectedOrigin);
      } catch (e) {
        console.warn('[identity] consent decline notify failed', e);
      }
    }

    // Cancel session on server
    if (sessionId) {
      try {
        await fetch(`/api/verify/session/${sessionId}/result`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'cancelled',
            finishedAt: new Date().toISOString(),
          }),
        });
      } catch (e) {
        console.warn('[identity] session cancel notify failed', e);
      }
    }
  };

  const reportProblem = (message, level = 'warn') => {
    setProblem({ message, level });
    // Auto-clear after 6 seconds
    setTimeout(() => setProblem(null), 6000);

    // Notify parent if embedded
    if (typeof window !== 'undefined' && window.parent !== window) {
      const payload = {
        identityOCR: {
          action: 'problem',
          message,
          level,
          session: sessionId,
        },
      };
      try {
        window.parent.postMessage(payload, expectedOrigin);
      } catch (e) {
        console.warn('[identity] problem notify failed', e);
      }
    }
  };

  // Set up global functions for compatibility with existing scripts
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__IDENTITY_SESSION__ = sessionId;
      window.__IDENTITY_EXPECTED_ORIGIN__ = expectedOrigin;
      window.__IDENTITY_SUCCESS_URL__ = session?.payload?.successUrl || null;
      window.__IDENTITY_REQUESTED_ID_TYPE__ = session?.payload?.idType || null;
      window.__IDENTITY_TEST_MODE__ = session?.payload?.testMode || false;
      window.__IDENTITY_AUTH_REQUIRED__ = session?.payload?.authRequired || false;
      window.reportCaptureProblem = reportProblem;
      window.clearCaptureProblem = () => setProblem(null);
    }
  }, [sessionId, expectedOrigin, session]);

  return (
    <div className="app-container min-h-screen embed-mode">
      <main className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <CameraSection
            cameraStarted={cameraStarted}
            idType={session?.payload?.idType || 'national-id'}
            onProblem={reportProblem}
          />
        </div>
      </main>

      {!consentGiven && (
        <ConsentOverlay
          onAccept={handleConsentAccept}
          onDecline={handleConsentDecline}
        />
      )}

      {problem && (
        <ProblemAlert
          message={problem.message}
          level={problem.level}
          onClose={() => setProblem(null)}
        />
      )}
    </div>
  );
}
