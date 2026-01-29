import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import * as faceapi from 'face-api.js';

// ===== CONSTANTS =====
const API_URL = '/api/ocr/base64';

// ID type options
const ID_TYPES = [
  { value: 'national-id', label: 'Philippine National ID', icon: '🇵🇭' },
  { value: 'driver-license', label: "Driver's License", icon: '🚗' },
  { value: 'passport', label: 'Passport', icon: '✈️' },
  { value: 'umid', label: 'UMID', icon: '🆔' },
  { value: 'philhealth', label: 'PhilHealth ID', icon: '🏥' },
  { value: 'tin-id', label: 'TIN ID', icon: '📋' },
  { value: 'postal-id', label: 'Postal ID', icon: '📮' },
  { value: 'pagibig', label: 'Pag-IBIG ID', icon: '🏠' },
];

// Face detection constants
const CENTER_TOLERANCE = 0.20;
const REQUIRED_CENTERED_FRAMES = 10;
const MIN_FACE_CONFIDENCE = 0.5;
const MIN_FACE_SIZE_RATIO = 0.25;
const MAX_FACE_SIZE_RATIO = 0.55;
const REQUIRED_EXPRESSIONS = ['happy', 'angry'];
const EXPRESSION_CONFIDENCE_THRESHOLD = 0.5;
const EXPRESSION_HOLD_REQUIRED = 3;
const FACE_MATCH_THRESHOLD = 0.70;

export default function CombinedVerification() {
  const { id: sessionId } = useParams();
  
  // ===== SHARED STATE =====
  const [session, setSession] = useState(null);
  const [consentGiven, setConsentGiven] = useState(false);
  const [error, setError] = useState(null);
  const [currentStep, setCurrentStep] = useState('id'); // 'id' or 'selfie'
  const expectedOrigin = typeof window !== 'undefined' ? (window.__IDENTITY_EXPECTED_ORIGIN__ || '*') : '*';

  // ===== ID VERIFICATION STATE =====
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [selectedIdType, setSelectedIdType] = useState(null);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState('Loading session...');
  const [feedbackType, setFeedbackType] = useState('info');
  const [aiResult, setAiResult] = useState(null);
  const [idVerificationComplete, setIdVerificationComplete] = useState(false);

  // ===== SELFIE LIVENESS STATE =====
  const faceVideoRef = useRef(null);
  const faceCanvasRef = useRef(null);
  const faceStreamRef = useRef(null);
  const faceDetectionIntervalRef = useRef(null);
  const centeredFrameCountRef = useRef(0);
  const modelsLoadedRef = useRef(false);
  const isRunningRef = useRef(false);
  const detectedExpressionsRef = useRef(new Set());
  const currentExpressionRef = useRef(null);
  const expressionHoldCountRef = useRef(0);
  
  const [faceDetectionStarted, setFaceDetectionStarted] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceFeedback, setFaceFeedback] = useState('Complete ID verification first');
  const [faceFeedbackType, setFaceFeedbackType] = useState('info');
  const [capturedFace, setCapturedFace] = useState(null);
  const [faceVerified, setFaceVerified] = useState(false);
  const [livenessScore, setLivenessScore] = useState(0);
  const [isCentered, setIsCentered] = useState(false);
  const [currentExpression, setCurrentExpression] = useState('');
  const [detectedExpressions, setDetectedExpressions] = useState([]);
  const [requiredExpression, setRequiredExpression] = useState(REQUIRED_EXPRESSIONS[0]);
  const [faceLandmarks, setFaceLandmarks] = useState(null);
  const [faceBox, setFaceBox] = useState(null);
  const [faceMatchResult, setFaceMatchResult] = useState(null);
  const [selfieSessionId, setSelfieSessionId] = useState(null);

  // ===== FETCH SESSION =====
  useEffect(() => {
    if (!sessionId) {
      setError('No session ID provided');
      return;
    }

    fetch(`/api/verify/session/${sessionId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.session) {
          const sessionStatus = (data.session.status || '').toLowerCase();
          if (['done', 'completed', 'success'].includes(sessionStatus)) {
            setError('This verification session has already been completed.');
            return;
          }
          if (['failed', 'cancelled', 'canceled'].includes(sessionStatus)) {
            setError('This verification session has been cancelled or failed.');
            return;
          }
          if (sessionStatus === 'expired') {
            setError('This verification session has expired.');
            return;
          }
          setSession(data.session);
          if (data.session.payload?.idType) {
            setSelectedIdType(data.session.payload.idType);
          }
          if (data.session.payload?.selfieSessionId) {
            setSelfieSessionId(data.session.payload.selfieSessionId);
          }
          setFeedback('Accept consent to continue');
        } else {
          setError('Session not found or expired');
        }
      })
      .catch(err => {
        console.error('Failed to fetch session:', err);
        setError('Failed to load session');
      });
  }, [sessionId]);

  // Load face-api models when moving to selfie step
  useEffect(() => {
    if (currentStep === 'selfie' && !modelsLoadedRef.current) {
      loadFaceModels();
    }
  }, [currentStep]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      stopFaceDetection();
    };
  }, []);

  const loadFaceModels = async () => {
    try {
      setFaceFeedback('Loading AI models...');
      const MODEL_URL = '/models';
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      modelsLoadedRef.current = true;
      setModelsLoaded(true);
      setFaceFeedback('Press Start to begin face verification');
    } catch (err) {
      console.error('Error loading models:', err);
      setFaceFeedback('Failed to load AI models');
      setFaceFeedbackType('error');
    }
  };

  // ===== PARENT NOTIFICATION =====
  const notifyParent = useCallback((message) => {
    if (typeof window !== 'undefined' && window.parent !== window) {
      try {
        window.parent.postMessage(message, expectedOrigin);
      } catch (e) {
        console.warn('[identity] postMessage failed', e);
      }
    }
  }, [expectedOrigin]);

  const notifyParentFailed = useCallback(async (reason, details = {}) => {
    notifyParent({
      identityOCR: {
        action: 'verification_failed',
        status: 'failed',
        reason: reason,
        session: sessionId,
        details: details,
        verificationType: 'combined',
        step: currentStep,
      },
    });

    try {
      await fetch(`/api/verify/session/${sessionId}/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'failed',
          reason: reason,
          result: details,
          finishedAt: new Date().toISOString(),
        }),
      });
    } catch (e) {
      console.warn('[identity] session update failed', e);
    }
  }, [sessionId, currentStep, notifyParent]);

  // ===== CONSENT HANDLERS =====
  const handleConsentAccept = () => {
    setConsentGiven(true);
    setFeedback(selectedIdType ? 'Start camera to capture ID' : 'Select ID type to continue');
  };

  const handleConsentDecline = async () => {
    setError('You declined the consent. Verification cannot proceed.');
    notifyParent({
      identityOCR: {
        action: 'verification_cancelled',
        status: 'cancelled',
        reason: 'consent_declined',
        session: sessionId,
        verificationType: 'combined',
      },
    });

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
      console.warn('[identity] session cancel failed', e);
    }
  };

  // ===== ID VERIFICATION FUNCTIONS =====
  const startCamera = async () => {
    try {
      const constraints = {
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      };
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
      setCameraStarted(true);
      setFeedback('Position your ID in the frame and capture');
      setFeedbackType('info');
    } catch (err) {
      console.error('Camera error:', err);
      setFeedback('Camera access denied: ' + err.message);
      setFeedbackType('error');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraStarted(false);
  };

  const captureId = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(imageDataUrl);
    setFeedback('ID captured. Processing...');
    processIdImage(imageDataUrl);
  };

  const processIdImage = async (imageDataUrl) => {
    setIsProcessing(true);
    setFeedback('Processing ID...');
    setFeedbackType('info');

    try {
      const base64Data = imageDataUrl.split(',')[1];
      const ocrRes = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Image: base64Data, idType: selectedIdType }),
      });

      if (!ocrRes.ok) throw new Error('OCR request failed');
      const ocrData = await ocrRes.json();

      // AI field extraction
      const aiRes = await fetch(`/api/ai/${selectedIdType}/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: ocrData.text || '', ocrData: ocrData }),
      });

      if (!aiRes.ok) throw new Error('AI extraction failed');
      const data = await aiRes.json();

      setAiResult({ data: data.fields || {} });
      setFeedback('ID verification complete!');
      setFeedbackType('success');
      setIsProcessing(false);
      setIdVerificationComplete(true);

      // Save ID result to session
      const idResult = {
        action: 'id_complete',
        fields: data.fields || {},
        rawText: ocrData.text || '',
        capturedImageBase64: imageDataUrl,
        idType: selectedIdType,
        timestamp: new Date().toISOString(),
        sessionId: sessionId,
      };

      await fetch(`/api/verify/session/${sessionId}/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'id_complete',
          result: idResult,
        }),
      });

      // No postMessage here - verification_success will be sent after selfie
      // Stop ID camera and prepare for selfie
      stopCamera();

    } catch (err) {
      console.error('Processing error:', err);
      setFeedback('Failed: ' + err.message);
      setFeedbackType('error');
      setIsProcessing(false);
      notifyParentFailed('id_processing_error', { error: err.message });
    }
  };

  const proceedToSelfie = () => {
    setCurrentStep('selfie');
    setFaceFeedback('Loading AI models...');
  };

  // ===== SELFIE LIVENESS FUNCTIONS =====
  const startFaceCamera = async () => {
    try {
      const constraints = {
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      };
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      faceStreamRef.current = mediaStream;
      if (faceVideoRef.current) {
        faceVideoRef.current.srcObject = mediaStream;
        await faceVideoRef.current.play();
      }
      setFaceDetectionStarted(true);
      isRunningRef.current = true;
      setFaceFeedback('Position your face in the circle');
      setFaceFeedbackType('info');
      startFaceDetectionLoop();
    } catch (err) {
      console.error('Face camera error:', err);
      setFaceFeedback('Camera access denied: ' + err.message);
      setFaceFeedbackType('error');
    }
  };

  const stopFaceDetection = () => {
    isRunningRef.current = false;
    if (faceDetectionIntervalRef.current) {
      clearInterval(faceDetectionIntervalRef.current);
      faceDetectionIntervalRef.current = null;
    }
    if (faceStreamRef.current) {
      faceStreamRef.current.getTracks().forEach(track => track.stop());
      faceStreamRef.current = null;
    }
    setFaceDetectionStarted(false);
  };

  const startFaceDetectionLoop = () => {
    if (faceDetectionIntervalRef.current) {
      clearInterval(faceDetectionIntervalRef.current);
    }
    faceDetectionIntervalRef.current = setInterval(detectFace, 150);
  };

  const detectFace = async () => {
    if (!faceVideoRef.current || !modelsLoadedRef.current || !isRunningRef.current) return;
    const video = faceVideoRef.current;
    if (video.readyState !== 4) return;

    try {
      const detection = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: MIN_FACE_CONFIDENCE }))
        .withFaceLandmarks()
        .withFaceExpressions();

      if (!detection) {
        setFaceFeedback('No face detected - look at the camera');
        setFaceFeedbackType('warning');
        setIsCentered(false);
        setFaceBox(null);
        setFaceLandmarks(null);
        centeredFrameCountRef.current = 0;
        return;
      }

      const { box } = detection.detection;
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;

      // Check face size
      const faceWidthRatio = box.width / videoWidth;
      if (faceWidthRatio < MIN_FACE_SIZE_RATIO) {
        setFaceFeedback('Move closer to the camera');
        setFaceFeedbackType('warning');
        setIsCentered(false);
        return;
      }
      if (faceWidthRatio > MAX_FACE_SIZE_RATIO) {
        setFaceFeedback('Move back from the camera');
        setFaceFeedbackType('warning');
        setIsCentered(false);
        return;
      }

      // Check centering
      const faceCenterX = box.x + box.width / 2;
      const faceCenterY = box.y + box.height / 2;
      const offsetX = Math.abs(faceCenterX - videoWidth / 2) / videoWidth;
      const offsetY = Math.abs(faceCenterY - videoHeight / 2) / videoHeight;
      const centered = offsetX < CENTER_TOLERANCE && offsetY < CENTER_TOLERANCE;

      setIsCentered(centered);
      setFaceBox(box);
      setFaceLandmarks(detection.landmarks);

      if (!centered) {
        setFaceFeedback('Center your face in the circle');
        setFaceFeedbackType('warning');
        centeredFrameCountRef.current = 0;
        return;
      }

      // Process expressions for liveness
      const expressions = detection.expressions;
      const sortedExpressions = Object.entries(expressions).sort((a, b) => b[1] - a[1]);
      const [dominantExpression, confidence] = sortedExpressions[0];
      setCurrentExpression(dominantExpression);

      // Check if required expression is shown
      if (REQUIRED_EXPRESSIONS.includes(dominantExpression) && confidence >= EXPRESSION_CONFIDENCE_THRESHOLD) {
        if (currentExpressionRef.current === dominantExpression) {
          expressionHoldCountRef.current++;
        } else {
          currentExpressionRef.current = dominantExpression;
          expressionHoldCountRef.current = 1;
        }

        if (expressionHoldCountRef.current >= EXPRESSION_HOLD_REQUIRED) {
          if (!detectedExpressionsRef.current.has(dominantExpression)) {
            detectedExpressionsRef.current.add(dominantExpression);
            setDetectedExpressions([...detectedExpressionsRef.current]);
            
            // Move to next required expression
            const nextRequired = REQUIRED_EXPRESSIONS.find(exp => !detectedExpressionsRef.current.has(exp));
            if (nextRequired) {
              setRequiredExpression(nextRequired);
              setFaceFeedback(`Good! Now show: ${nextRequired === 'happy' ? '😊 Smile' : '😠 Angry'}`);
            }
          }
        }
      }

      // Check if all expressions completed
      const allExpressionsComplete = REQUIRED_EXPRESSIONS.every(exp => detectedExpressionsRef.current.has(exp));

      if (allExpressionsComplete && centered) {
        centeredFrameCountRef.current++;
        const progress = Math.min(100, (centeredFrameCountRef.current / REQUIRED_CENTERED_FRAMES) * 100);
        setLivenessScore(progress);

        if (centeredFrameCountRef.current >= REQUIRED_CENTERED_FRAMES) {
          captureFace();
        } else {
          setFaceFeedback('Hold still...');
          setFaceFeedbackType('info');
        }
      } else if (!allExpressionsComplete) {
        const expressionInstruction = requiredExpression === 'happy' ? '😊 Smile' : '😠 Show angry face';
        setFaceFeedback(`Show expression: ${expressionInstruction}`);
        setFaceFeedbackType('info');
      }

    } catch (err) {
      console.error('Face detection error:', err);
    }
  };

  const captureFace = async () => {
    if (!faceVideoRef.current || !faceCanvasRef.current) return;
    
    isRunningRef.current = false;
    if (faceDetectionIntervalRef.current) {
      clearInterval(faceDetectionIntervalRef.current);
      faceDetectionIntervalRef.current = null;
    }

    const video = faceVideoRef.current;
    const canvas = faceCanvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -canvas.width, 0);
    ctx.restore();
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);

    setFaceFeedback('Verifying...');
    setFaceFeedbackType('info');

    try {
      // Face matching with ID photo if available
      let faceMatched = null;
      if (capturedImage) {
        faceMatched = await compareFaces(capturedImage, imageDataUrl);
        setFaceMatchResult(faceMatched);

        if (!faceMatched.matched) {
          setFaceFeedback('⚠️ Face does not match ID photo');
          setFaceFeedbackType('error');
          notifyParentFailed('face_mismatch', { 
            similarity: faceMatched.similarity,
            threshold: FACE_MATCH_THRESHOLD 
          });
          
          // Reset for retry
          centeredFrameCountRef.current = 0;
          detectedExpressionsRef.current.clear();
          setDetectedExpressions([]);
          setRequiredExpression(REQUIRED_EXPRESSIONS[0]);
          setTimeout(() => {
            isRunningRef.current = true;
            startFaceDetectionLoop();
          }, 2000);
          return;
        }
      }

      setCapturedFace(imageDataUrl);
      setFaceVerified(true);
      setFaceFeedback('✅ Verified! Real human confirmed');
      setFaceFeedbackType('success');
      setLivenessScore(100);
      stopFaceDetection();

      // Save final result
      const result = {
        action: 'success',
        idData: aiResult?.data || {},
        idImage: capturedImage,
        selfieImage: imageDataUrl,
        livenessScore: 100,
        faceMatched: faceMatched?.matched ?? null,
        faceSimilarity: faceMatched?.similarity ?? null,
        timestamp: new Date().toISOString(),
        sessionId: sessionId,
      };

      // Update selfie session if exists
      if (selfieSessionId) {
        await fetch(`/api/verify/session/${selfieSessionId}/result`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'done',
            result: {
              capturedImageBase64: imageDataUrl,
              livenessScore: 100,
              faceMatched: faceMatched?.matched ?? null,
              faceSimilarity: faceMatched?.similarity ?? null,
            },
            finishedAt: new Date().toISOString(),
          }),
        });
      }

      // Update main session with final result
      await fetch(`/api/verify/session/${sessionId}/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'done',
          result: result,
          finishedAt: new Date().toISOString(),
        }),
      });

      // NOW send verification_success - only after selfie is complete
      notifyParent({
        identityOCR: {
          action: 'verification_success',
          status: 'success',
          result: result,
          session: sessionId,
          images: {
            idImage: capturedImage,
            selfieImage: imageDataUrl,
          },
          verificationType: 'combined',
        },
      });

    } catch (err) {
      console.error('Face verification error:', err);
      setFaceFeedback('⚠️ Verification failed, try again');
      setFaceFeedbackType('error');
      notifyParentFailed('selfie_error', { error: err.message });
    }
  };

  const compareFaces = async (idImageDataUrl, selfieImageDataUrl) => {
    try {
      const idImg = await faceapi.fetchImage(idImageDataUrl);
      const selfieImg = await faceapi.fetchImage(selfieImageDataUrl);

      const idDetection = await faceapi
        .detectSingleFace(idImg, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      const selfieDetection = await faceapi
        .detectSingleFace(selfieImg, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!idDetection || !selfieDetection) {
        return { matched: false, similarity: 0, error: 'Could not detect face in one or both images' };
      }

      const distance = faceapi.euclideanDistance(idDetection.descriptor, selfieDetection.descriptor);
      const similarity = Math.max(0, 1 - distance);
      const matched = distance < FACE_MATCH_THRESHOLD;

      return { matched, similarity: Math.round(similarity * 100), distance };
    } catch (err) {
      console.error('Face comparison error:', err);
      return { matched: false, similarity: 0, error: err.message };
    }
  };

  const resetSelfie = () => {
    setCapturedFace(null);
    setFaceVerified(false);
    setFaceFeedback('Press Start to begin');
    setFaceFeedbackType('info');
    setLivenessScore(0);
    setIsCentered(false);
    setCurrentExpression('');
    setDetectedExpressions([]);
    setRequiredExpression(REQUIRED_EXPRESSIONS[0]);
    setFaceLandmarks(null);
    setFaceBox(null);
    setFaceMatchResult(null);
    detectedExpressionsRef.current.clear();
    centeredFrameCountRef.current = 0;
    currentExpressionRef.current = null;
    expressionHoldCountRef.current = 0;
  };

  // ===== RENDER =====
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-6 max-w-md text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Verification Error</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  // Consent screen
  if (!consentGiven) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-6 max-w-md">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 text-center">Identity Verification</h2>
          <p className="text-gray-600 mb-4 text-sm">
            This verification process requires access to your camera to:
          </p>
          <ul className="text-gray-600 text-sm mb-6 space-y-2">
            <li className="flex items-center gap-2"><span className="text-blue-500">📷</span> Capture your ID document</li>
            <li className="flex items-center gap-2"><span className="text-blue-500">🤳</span> Verify your face for liveness</li>
            <li className="flex items-center gap-2"><span className="text-blue-500">🔒</span> Match your face with ID photo</li>
          </ul>
          <p className="text-xs text-gray-500 mb-6">
            By proceeding, you consent to the collection and processing of your biometric data for identity verification purposes.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleConsentDecline}
              className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
            >
              Decline
            </button>
            <button
              onClick={handleConsentAccept}
              className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
            >
              Accept & Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Progress indicator */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-center gap-4">
            <div className={`flex items-center gap-2 ${currentStep === 'id' ? 'text-blue-600' : idVerificationComplete ? 'text-green-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep === 'id' ? 'bg-blue-100' : idVerificationComplete ? 'bg-green-100' : 'bg-gray-100'
              }`}>
                {idVerificationComplete ? '✓' : '1'}
              </div>
              <span className="font-medium text-sm">ID Verification</span>
            </div>
            <div className="w-12 h-0.5 bg-gray-200" />
            <div className={`flex items-center gap-2 ${currentStep === 'selfie' ? 'text-blue-600' : faceVerified ? 'text-green-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep === 'selfie' ? 'bg-blue-100' : faceVerified ? 'bg-green-100' : 'bg-gray-100'
              }`}>
                {faceVerified ? '✓' : '2'}
              </div>
              <span className="font-medium text-sm">Face Verification</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Step 1: ID Verification */}
        {currentStep === 'id' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Step 1: Scan Your ID</h2>
              
              {/* ID Type Selection */}
              {!selectedIdType && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  {ID_TYPES.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setSelectedIdType(type.value)}
                      className="p-3 rounded-lg border-2 border-gray-200 hover:border-blue-300 transition text-center"
                    >
                      <span className="text-2xl block mb-1">{type.icon}</span>
                      <span className="text-xs text-gray-700">{type.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Camera View */}
              {selectedIdType && (
                <>
                  <div className="relative bg-black rounded-lg overflow-hidden aspect-video mb-4">
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className={`w-full h-full object-cover ${!cameraStarted ? 'hidden' : ''}`}
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    
                    {capturedImage && (
                      <img src={capturedImage} alt="Captured ID" className="w-full h-full object-contain" />
                    )}
                    
                    {!cameraStarted && !capturedImage && (
                      <div className="absolute inset-0 flex items-center justify-center text-white">
                        <span className="text-lg">Camera not started</span>
                      </div>
                    )}

                    {/* Guide overlay */}
                    {cameraStarted && !capturedImage && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="border-2 border-white border-dashed rounded-lg w-[80%] h-[60%] opacity-50" />
                      </div>
                    )}
                  </div>

                  {/* Feedback */}
                  <div className={`text-center mb-4 p-3 rounded-lg ${
                    feedbackType === 'success' ? 'bg-green-50 text-green-700' :
                    feedbackType === 'error' ? 'bg-red-50 text-red-700' :
                    feedbackType === 'warning' ? 'bg-yellow-50 text-yellow-700' :
                    'bg-blue-50 text-blue-700'
                  }`}>
                    {feedback}
                  </div>

                  {/* Controls */}
                  <div className="flex gap-3 justify-center">
                    {!cameraStarted && !capturedImage && (
                      <button
                        onClick={startCamera}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                      >
                        Start Camera
                      </button>
                    )}
                    {cameraStarted && !capturedImage && !isProcessing && (
                      <button
                        onClick={captureId}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                      >
                        Capture ID
                      </button>
                    )}
                    {isProcessing && (
                      <div className="flex items-center gap-2 text-blue-600">
                        <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full" />
                        <span>Processing...</span>
                      </div>
                    )}
                    {idVerificationComplete && (
                      <button
                        onClick={proceedToSelfie}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                      >
                        Continue to Face Verification →
                      </button>
                    )}
                  </div>

                  {/* ID Result Preview */}
                  {aiResult?.data && Object.keys(aiResult.data).length > 0 && (
                    <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                      <h3 className="font-medium text-gray-900 mb-3">Extracted Information</h3>
                      <dl className="grid grid-cols-2 gap-2 text-sm">
                        {Object.entries(aiResult.data).map(([key, value]) => (
                          <div key={key}>
                            <dt className="text-gray-500 capitalize">{key.replace(/_/g, ' ')}</dt>
                            <dd className="text-gray-900 font-medium">{value || '-'}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Selfie Liveness */}
        {currentStep === 'selfie' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Step 2: Face Verification</h2>

              {/* Face Camera View */}
              <div className="relative bg-black rounded-lg overflow-hidden aspect-video mb-4">
                <video
                  ref={faceVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className={`w-full h-full object-cover ${!faceDetectionStarted ? 'hidden' : ''}`}
                  style={{ transform: 'scaleX(-1)' }}
                />
                <canvas ref={faceCanvasRef} className="hidden" />

                {capturedFace && (
                  <img src={capturedFace} alt="Captured Face" className="w-full h-full object-contain" />
                )}

                {!faceDetectionStarted && !capturedFace && (
                  <div className="absolute inset-0 flex items-center justify-center text-white">
                    <span className="text-lg">{modelsLoaded ? 'Ready to start' : 'Loading models...'}</span>
                  </div>
                )}

                {/* Face guide circle */}
                {faceDetectionStarted && !capturedFace && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className={`w-48 h-48 rounded-full border-4 ${isCentered ? 'border-green-500' : 'border-white'} opacity-70`} />
                  </div>
                )}

                {/* Liveness progress */}
                {faceDetectionStarted && !capturedFace && livenessScore > 0 && (
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 transition-all duration-200"
                        style={{ width: `${livenessScore}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Expression indicators */}
              {faceDetectionStarted && !capturedFace && (
                <div className="flex justify-center gap-4 mb-4">
                  {REQUIRED_EXPRESSIONS.map((exp) => (
                    <div
                      key={exp}
                      className={`px-4 py-2 rounded-lg text-sm font-medium ${
                        detectedExpressions.includes(exp)
                          ? 'bg-green-100 text-green-700'
                          : requiredExpression === exp
                          ? 'bg-blue-100 text-blue-700 animate-pulse'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {exp === 'happy' ? '😊 Smile' : '😠 Angry'}
                      {detectedExpressions.includes(exp) && ' ✓'}
                    </div>
                  ))}
                </div>
              )}

              {/* Feedback */}
              <div className={`text-center mb-4 p-3 rounded-lg ${
                faceFeedbackType === 'success' ? 'bg-green-50 text-green-700' :
                faceFeedbackType === 'error' ? 'bg-red-50 text-red-700' :
                faceFeedbackType === 'warning' ? 'bg-yellow-50 text-yellow-700' :
                'bg-blue-50 text-blue-700'
              }`}>
                {faceFeedback}
              </div>

              {/* Face match result */}
              {faceMatchResult && (
                <div className={`text-center mb-4 p-3 rounded-lg ${faceMatchResult.matched ? 'bg-green-50' : 'bg-red-50'}`}>
                  <span className={faceMatchResult.matched ? 'text-green-700' : 'text-red-700'}>
                    Face Match: {faceMatchResult.similarity}% {faceMatchResult.matched ? '✓' : '✗'}
                  </span>
                </div>
              )}

              {/* Controls */}
              <div className="flex gap-3 justify-center">
                {!faceDetectionStarted && !capturedFace && modelsLoaded && (
                  <button
                    onClick={startFaceCamera}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    Start Face Verification
                  </button>
                )}
                {faceVerified && (
                  <div className="text-center">
                    <p className="text-green-600 font-medium text-lg mb-2">✅ Verification Complete!</p>
                    <p className="text-gray-500 text-sm">You may close this window.</p>
                  </div>
                )}
              </div>

              {/* ID preview for reference */}
              {capturedImage && !faceVerified && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-2 text-sm">Your ID Photo (for reference)</h3>
                  <img src={capturedImage} alt="ID" className="w-24 h-auto rounded border" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
