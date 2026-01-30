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
const EYE_BLINK_THRESHOLD = 0.22; // EAR below this = blink detected
const REQUIRED_BLINKS = 1; // Must blink once for liveness
const BLINK_COOLDOWN_FRAMES = 5; // Frames to wait between blink detections
const FACE_MATCH_THRESHOLD = 0.70;

const getIdTypeLabel = (value) => {
  const found = ID_TYPES.find(t => t.value === value);
  return found ? found.label : value;
};

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
  const blinkCountRef = useRef(0); // Number of blinks detected
  const eyesClosedRef = useRef(false); // Track if eyes are currently closed
  const blinkCooldownRef = useRef(0); // Cooldown counter between blinks
  const overlayCanvasRef = useRef(null);
  const lastFacePositionRef = useRef(null);
  
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
  const [faceLandmarks, setFaceLandmarks] = useState(null);
  const [faceBox, setFaceBox] = useState(null);
  const [faceMatchResult, setFaceMatchResult] = useState(null);
  const [selfieSessionId, setSelfieSessionId] = useState(null);
  const [faceMismatch, setFaceMismatch] = useState(false);
  const [faceMismatchDetails, setFaceMismatchDetails] = useState(null);

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
      setFeedback('Starting camera...');
      const constraints = {
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      };
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await new Promise(resolve => {
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play();
            resolve();
          };
        });
        if (canvasRef.current) {
          canvasRef.current.width = videoRef.current.videoWidth;
          canvasRef.current.height = videoRef.current.videoHeight;
        }
      }
      setCameraStarted(true);
      setFeedback('Position your ID within the frame');
      setFeedbackType('info');
    } catch (err) {
      console.error('Camera error:', err);
      setFeedback('Camera access denied: ' + err.message);
      setFeedbackType('error');
    }
  };

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraStarted(false);
  }, []);

  const captureId = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(imageDataUrl);
    setFeedback('ID captured. Processing...');
    processIdImage(imageDataUrl);
  };

  const fetchWithTimeout = (url, options, timeout = 15000) => {
    return Promise.race([
      fetch(url, options),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout')), timeout))
    ]);
  };

  const processIdImage = async (imageDataUrl) => {
    setIsProcessing(true);
    setFeedback('Processing ID...');
    setFeedbackType('info');

    try {
      const base64Data = imageDataUrl.split(',')[1];
      const res = await fetchWithTimeout(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          image: base64Data, 
          type: 'identity',
          idType: selectedIdType || 'unknown'
        }),
      }, 30000);

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'OCR processing failed');

      // The OCR endpoint already returns extracted fields
      const fields = data.fields || {};

      setAiResult({ data: fields });
      setFeedback('ID verification complete!');
      setFeedbackType('success');
      setIsProcessing(false);
      setIdVerificationComplete(true);

      // Save ID result to session
      const idResult = {
        action: 'id_complete',
        fields: fields,
        rawText: data.text || '',
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

      stopCamera();
    } catch (err) {
      console.error('Processing error:', err);
      setFeedback('Failed: ' + err.message);
      setFeedbackType('error');
      setIsProcessing(false);
      notifyParentFailed('id_processing_error', { error: err.message });
    }
  };

  const handleRecaptureId = () => {
    setCapturedImage(null);
    setAiResult(null);
    setIdVerificationComplete(false);
    setFeedback('Position your ID within the frame');
    setFeedbackType('info');
    startCamera();
  };

  const proceedToSelfie = () => {
    setCurrentStep('selfie');
    setFaceFeedback('Loading AI models...');
  };

  // ===== SELFIE LIVENESS FUNCTIONS =====
  const startFaceCamera = async () => {
    if (!modelsLoadedRef.current) {
      setFaceFeedback('AI models loading...');
      setFaceFeedbackType('warning');
      return;
    }

    try {
      setFaceFeedback('Starting camera...');
      const cameraConfigs = [
        { video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 } } },
        { video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 360 } } },
        { video: { facingMode: 'user' } },
        { video: true }
      ];

      let mediaStream = null;
      let lastError = null;

      for (const config of cameraConfigs) {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia(config);
          break;
        } catch (err) {
          lastError = err;
        }
      }

      if (!mediaStream) {
        throw lastError || new Error('Could not access camera');
      }

      faceStreamRef.current = mediaStream;
      if (faceVideoRef.current) {
        faceVideoRef.current.srcObject = mediaStream;
        await new Promise(resolve => {
          faceVideoRef.current.onloadedmetadata = () => {
            faceVideoRef.current.play();
            resolve();
          };
        });
        if (faceCanvasRef.current) {
          faceCanvasRef.current.width = faceVideoRef.current.videoWidth;
          faceCanvasRef.current.height = faceVideoRef.current.videoHeight;
        }
        if (overlayCanvasRef.current) {
          overlayCanvasRef.current.width = faceVideoRef.current.videoWidth;
          overlayCanvasRef.current.height = faceVideoRef.current.videoHeight;
        }
      }
      
      // Reset state
      centeredFrameCountRef.current = 0;
      blinkCountRef.current = 0;
      eyesClosedRef.current = false;
      blinkCooldownRef.current = 0;
      
      setFaceDetectionStarted(true);
      isRunningRef.current = true;
      setLivenessScore(0);
      setDetectedExpressions([]);
      setFaceFeedback('👁️ Please blink once');
      setFaceFeedbackType('info');
      startFaceDetectionLoop();
    } catch (err) {
      console.error('Face camera error:', err);
      setFaceFeedback('Camera access failed: ' + err.message);
      setFaceFeedbackType('error');
    }
  };

  const stopFaceDetection = useCallback(() => {
    isRunningRef.current = false;
    if (faceDetectionIntervalRef.current) {
      clearInterval(faceDetectionIntervalRef.current);
      faceDetectionIntervalRef.current = null;
    }
    if (faceStreamRef.current) {
      faceStreamRef.current.getTracks().forEach(track => track.stop());
      faceStreamRef.current = null;
    }
    if (faceVideoRef.current) faceVideoRef.current.srcObject = null;
    setFaceDetectionStarted(false);
  }, []);

  const startFaceDetectionLoop = () => {
    if (faceDetectionIntervalRef.current) {
      clearInterval(faceDetectionIntervalRef.current);
    }
    faceDetectionIntervalRef.current = setInterval(detectFace, 200);
  };

  const clearOverlayCanvas = () => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const drawFaceLandmarks = (landmarks, box) => {
    const canvas = overlayCanvasRef.current;
    const video = faceVideoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scaleX = canvas.width / video.videoWidth;
    const scaleY = canvas.height / video.videoHeight;

    const points = landmarks.positions;
    const scaledPoints = points.map(p => ({ x: p.x * scaleX, y: p.y * scaleY }));

    const meshConnections = [
      [17, 18], [18, 19], [19, 20], [20, 21], [22, 23], [23, 24], [24, 25], [25, 26],
      [36, 37], [37, 38], [38, 39], [39, 40], [40, 41], [41, 36],
      [42, 43], [43, 44], [44, 45], [45, 46], [46, 47], [47, 42],
      [27, 28], [28, 29], [29, 30], [30, 31], [30, 35], [31, 32], [32, 33], [33, 34], [34, 35],
      [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8],
      [8, 9], [9, 10], [10, 11], [11, 12], [12, 13], [13, 14], [14, 15], [15, 16],
      [48, 49], [49, 50], [50, 51], [51, 52], [52, 53], [53, 54],
      [54, 55], [55, 56], [56, 57], [57, 58], [58, 59], [59, 48],
      [60, 61], [61, 62], [62, 63], [63, 64], [64, 65], [65, 66], [66, 67], [67, 60],
    ];

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    meshConnections.forEach(([i, j]) => {
      if (scaledPoints[i] && scaledPoints[j]) {
        ctx.moveTo(scaledPoints[i].x, scaledPoints[i].y);
        ctx.lineTo(scaledPoints[j].x, scaledPoints[j].y);
      }
    });
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    scaledPoints.forEach((point) => {
      if (!point) return;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
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
        setFaceFeedback('👤 Position your face in the oval');
        setFaceFeedbackType('warning');
        setIsCentered(false);
        setFaceBox(null);
        setFaceLandmarks(null);
        centeredFrameCountRef.current = 0;
        clearOverlayCanvas();
        return;
      }

      const { box } = detection.detection;
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;

      setFaceBox(box);
      setFaceLandmarks(detection.landmarks);
      
      if (livenessScore > 0) {
        drawFaceLandmarks(detection.landmarks, box);
      } else {
        clearOverlayCanvas();
      }

      // Check face size
      const faceHeightRatio = box.height / videoHeight;
      if (faceHeightRatio < MIN_FACE_SIZE_RATIO) {
        setFaceFeedback('📏 Move closer to camera');
        setFaceFeedbackType('warning');
        setIsCentered(false);
        return;
      }
      if (faceHeightRatio > MAX_FACE_SIZE_RATIO) {
        setFaceFeedback('📏 Move back, too close');
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

      if (!centered) {
        const moveHorizontal = offsetX >= CENTER_TOLERANCE;
        const moveVertical = offsetY >= CENTER_TOLERANCE;
        
        if (moveHorizontal && moveVertical) {
          const hDir = faceCenterX < videoWidth / 2 ? '← Move left' : '→ Move right';
          const vDir = faceCenterY < videoHeight / 2 ? '↓ Move down' : '↑ Move up';
          setFaceFeedback(`${hDir} and ${vDir}`);
        } else if (moveHorizontal) {
          setFaceFeedback(faceCenterX < videoWidth / 2 ? '← Move left' : '→ Move right');
        } else if (moveVertical) {
          setFaceFeedback(faceCenterY < videoHeight / 2 ? '↓ Move face down' : '↑ Move face up');
        }
        setFaceFeedbackType('warning');
        centeredFrameCountRef.current = 0;
        return;
      }

      // Process eye blink for liveness
      const landmarks = detection.landmarks;
      const leftEye = landmarks.getLeftEye();
      const rightEye = landmarks.getRightEye();
      
      const getEyeAspectRatio = (eye) => {
        const v1 = Math.sqrt(Math.pow(eye[1].x - eye[5].x, 2) + Math.pow(eye[1].y - eye[5].y, 2));
        const v2 = Math.sqrt(Math.pow(eye[2].x - eye[4].x, 2) + Math.pow(eye[2].y - eye[4].y, 2));
        const h = Math.sqrt(Math.pow(eye[0].x - eye[3].x, 2) + Math.pow(eye[0].y - eye[3].y, 2));
        return (v1 + v2) / (2 * h);
      };

      const leftEAR = getEyeAspectRatio(leftEye);
      const rightEAR = getEyeAspectRatio(rightEye);
      const avgEyeRatio = (leftEAR + rightEAR) / 2;

      // Decrement blink cooldown
      if (blinkCooldownRef.current > 0) {
        blinkCooldownRef.current--;
      }

      // Check if eyes are currently closed (EAR below threshold)
      const eyesClosed = avgEyeRatio < EYE_BLINK_THRESHOLD;
      
      // Detect blink: eyes were open, now closed, then will open again
      if (eyesClosed && !eyesClosedRef.current && blinkCooldownRef.current === 0) {
        // Eyes just closed
        eyesClosedRef.current = true;
      } else if (!eyesClosed && eyesClosedRef.current) {
        // Eyes just opened after being closed = blink completed
        blinkCountRef.current++;
        eyesClosedRef.current = false;
        blinkCooldownRef.current = BLINK_COOLDOWN_FRAMES;
        console.log(`Blink detected! Count: ${blinkCountRef.current}/${REQUIRED_BLINKS}`);
      }

      // Check if required blinks completed
      const blinkComplete = blinkCountRef.current >= REQUIRED_BLINKS;

      if (!blinkComplete) {
        const blinks = blinkCountRef.current;
        setFaceFeedback(`👁️ Please blink once (${blinks}/${REQUIRED_BLINKS})`);
        setFaceFeedbackType('info');
        
        // Update liveness score based on blink progress
        const blinkProgress = (blinkCountRef.current / REQUIRED_BLINKS) * 50;
        setLivenessScore(Math.round(blinkProgress));
      } else if (centered) {
        centeredFrameCountRef.current++;
        const progress = 50 + Math.min(50, (centeredFrameCountRef.current / REQUIRED_CENTERED_FRAMES) * 50);
        setLivenessScore(Math.round(progress));

        if (centeredFrameCountRef.current >= REQUIRED_CENTERED_FRAMES) {
          setFaceFeedback('📸 Perfect! Capturing...');
          setFaceFeedbackType('success');
          captureFace();
        } else {
          const remaining = Math.max(0, Math.ceil((REQUIRED_CENTERED_FRAMES - centeredFrameCountRef.current) * 0.2));
          setFaceFeedback(`✓ Hold still for ${remaining}s`);
          setFaceFeedbackType('success');
        }
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

    setFaceFeedback('🔍 Verifying...');
    setFaceFeedbackType('info');

    try {
      // Face matching with ID photo - only if compareFaces is not explicitly false
      const shouldCompareFaces = session?.payload?.compareFaces !== false;
      let faceMatched = null;
      
      if (capturedImage && shouldCompareFaces) {
        setFaceFeedback('🔍 Comparing face with ID photo...');
        faceMatched = await compareFaces(capturedImage, imageDataUrl);
        setFaceMatchResult(faceMatched);

        if (!faceMatched.matched) {
          setFaceMismatch(true);
          setFaceMismatchDetails({
            confidence: faceMatched.similarity,
            reason: `Face verification failed: ${faceMatched.similarity}% similarity`,
            details: { distance: faceMatched.distance }
          });
          setCapturedFace(imageDataUrl);
          setFaceFeedback(`❌ Face does not match ID photo`);
          setFaceFeedbackType('error');
          notifyParentFailed('face_mismatch', { 
            similarity: faceMatched.similarity,
            threshold: FACE_MATCH_THRESHOLD 
          });
          return;
        }
      } else if (!shouldCompareFaces) {
        console.log('Face comparison skipped (compareFaces=false)');
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
        faceComparisonPerformed: shouldCompareFaces,
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
              faceComparisonPerformed: shouldCompareFaces,
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

      // Send verification_success
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
      const similarity = Math.max(0, Math.round((1 - distance) * 100));
      const matched = distance < FACE_MATCH_THRESHOLD;

      return { matched, similarity, distance };
    } catch (err) {
      console.error('Face comparison error:', err);
      return { matched: false, similarity: 0, error: err.message };
    }
  };

  const handleRetryFace = () => {
    setFaceMismatch(false);
    setFaceMismatchDetails(null);
    setCapturedFace(null);
    setFaceVerified(false);
    setFaceFeedback('Press Start to try again');
    setFaceFeedbackType('info');
    setLivenessScore(0);
    setDetectedExpressions([]);
    setFaceMatchResult(null);
    centeredFrameCountRef.current = 0;
    blinkCountRef.current = 0;
    eyesClosedRef.current = false;
    blinkCooldownRef.current = 0;
  };

  const handleDone = () => {
    // Send complete verification data including images and extracted fields
    notifyParent({
      identityOCR: {
        action: 'verification_complete',
        status: 'success',
        session: sessionId,
        result: {
          success: true,
          fields: {
            firstName: aiResult?.data?.firstName || aiResult?.data?.first_name || '',
            lastName: aiResult?.data?.lastName || aiResult?.data?.last_name || '',
            birthDate: aiResult?.data?.birthDate || aiResult?.data?.birth_date || aiResult?.data?.dateOfBirth || '',
            idType: selectedIdType || aiResult?.data?.idType || '',
            idNumber: aiResult?.data?.idNumber || aiResult?.data?.id_number || '',
          },
          idData: aiResult?.data || {},
          livenessScore: livenessScore,
          faceMatched: faceMatchResult?.matched ?? null,
          faceSimilarity: faceMatchResult?.similarity ?? null,
        },
        images: {
          idImage: capturedImage,
          selfieImage: capturedFace,
        },
        verificationType: 'combined',
      },
    });
  };

  const renderField = (label, value) => {
    if (!value) return null;
    return (
      <div className="py-2 border-b border-gray-100 last:border-0">
        <span className="text-gray-500 text-sm">{label}</span>
        <div className="text-gray-900 font-medium">{value}</div>
      </div>
    );
  };

  // ===== RENDER =====
  
  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-6 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Verification Error</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading session...</p>
        </div>
      </div>
    );
  }

  // Consent screen
  if (!consentGiven) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Identity Verification</h2>
          <p className="text-gray-600 mb-4">
            This verification process requires access to your camera to:
          </p>
          <ul className="text-gray-600 text-sm mb-6 space-y-2">
            <li className="flex items-center gap-2"><span className="text-blue-500">📷</span> Capture your ID document</li>
            <li className="flex items-center gap-2"><span className="text-blue-500">🤳</span> Verify your face for liveness</li>
            <li className="flex items-center gap-2"><span className="text-blue-500">🔒</span> Match your face with ID photo</li>
          </ul>
          <p className="text-gray-700 font-medium mb-2">For best results:</p>
          <ul className="list-disc pl-5 mb-4 text-gray-600 text-sm space-y-1">
            <li>Ensure good, even lighting.</li>
            <li>Keep your ID flat and fully visible.</li>
            <li>Look directly at the camera during selfie.</li>
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
              I Consent & Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===== ID TYPE SELECTION =====
  if (currentStep === 'id' && !selectedIdType) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex flex-col">
        <div className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-center">
            <h1 className="font-semibold text-gray-900">Select ID Type</h1>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-md">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto bg-blue-500 rounded-full flex items-center justify-center mb-3 shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-gray-900">Choose Your ID</h1>
              <p className="text-gray-600 mt-1 text-sm">Select the type of ID you will be scanning</p>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-4 mb-4">
              <div className="grid grid-cols-2 gap-3">
                {ID_TYPES.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => {
                      setSelectedIdType(type.value);
                      setFeedback('Start camera to capture ID');
                    }}
                    className="p-4 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition text-center group"
                  >
                    <span className="text-3xl block mb-2">{type.icon}</span>
                    <span className="text-sm text-gray-700 group-hover:text-blue-700 font-medium">{type.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex gap-3">
                <div className="text-amber-500 flex-shrink-0">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <div className="font-semibold text-amber-800 text-sm">Why select ID type?</div>
                  <div className="text-amber-700 text-xs mt-1">
                    Each ID has different formats and fields. Selecting the correct type helps our AI extract information more accurately.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===== ID VERIFICATION COMPLETE - SHOW RESULTS =====
  if (currentStep === 'id' && idVerificationComplete && capturedImage) {
    const data = aiResult?.data || {};
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50">
        <div className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-center">
            <h1 className="font-semibold text-gray-900">ID Verification Result</h1>
          </div>
        </div>

        <div className="max-w-lg mx-auto p-4 space-y-4">
          <div className="bg-green-500 text-white rounded-2xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <div className="font-bold text-lg">ID Captured Successfully</div>
              <div className="text-white/80 text-sm">Step 1 of 2 complete</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-4">
            <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Extracted Information
            </h2>
            <div className="divide-y divide-gray-100">
              {renderField('Full Name', data.fullName || data.name)}
              {renderField('First Name', data.firstName)}
              {renderField('Middle Name', data.middleName)}
              {renderField('Last Name', data.lastName)}
              {renderField('ID Number', data.idNumber)}
              {renderField('Date of Birth', data.dateOfBirth || data.birthDate)}
              {renderField('Sex', data.sex)}
              {renderField('Address', data.address)}
              {renderField('Nationality', data.nationality)}
              {renderField('Expiry Date', data.expiryDate)}
              {renderField('Issue Date', data.issueDate)}
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <button
              onClick={proceedToSelfie}
              className="w-full py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition flex items-center justify-center gap-2"
            >
              Continue to Face Verification
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
            <button
              onClick={handleRecaptureId}
              className="w-full py-3 bg-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-300 transition"
            >
              Recapture ID
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===== ID CAMERA VIEW =====
  if (currentStep === 'id' && selectedIdType) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col">
        <div className="flex-1 relative">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />

          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/60 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black/80 to-transparent" />

            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative">
                <div
                  className={`w-80 h-52 sm:w-96 sm:h-60 border-4 rounded-2xl transition-all duration-300 ${
                    capturedImage
                      ? 'border-green-500 shadow-[0_0_40px_rgba(34,197,94,0.5)]'
                      : 'border-white/70 border-dashed'
                  }`}
                />
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-white rounded-br-lg" />
              </div>
            </div>

            <div className="absolute top-4 left-4 right-4 pointer-events-auto">
              <div className="flex items-center justify-between">
                <button onClick={() => setSelectedIdType(null)} className="p-2 bg-white/20 backdrop-blur rounded-full">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="px-3 py-1 bg-blue-500/80 backdrop-blur rounded-full text-white text-xs font-medium flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                  </svg>
                  {getIdTypeLabel(selectedIdType)}
                </div>
              </div>
            </div>

            {cameraStarted && !capturedImage && (
              <div className="absolute top-20 left-6 right-6 text-center">
                <div className="text-white/80 text-sm">
                  Align your ID card within the frame
                </div>
              </div>
            )}
          </div>

          {isProcessing && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-20">
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
                <div className="text-white font-medium">{feedback}</div>
              </div>
            </div>
          )}
        </div>

        <div className="relative z-10 px-6 pb-8 pt-4">
          <div
            className={`mb-4 py-3 px-4 rounded-xl text-center font-medium ${
              feedbackType === 'success' ? 'bg-green-500 text-white'
              : feedbackType === 'error' ? 'bg-red-500 text-white'
              : feedbackType === 'warning' ? 'bg-yellow-500 text-black'
              : 'bg-white/20 backdrop-blur text-white'
            }`}
          >
            {feedback}
          </div>

          {!cameraStarted ? (
            <button
              onClick={startCamera}
              className="w-full py-4 bg-white text-black font-bold text-lg rounded-2xl hover:bg-gray-100 transition"
            >
              Start Camera
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => { stopCamera(); setSelectedIdType(null); }}
                className="flex-1 py-4 bg-red-500/80 text-white font-bold rounded-2xl hover:bg-red-600 transition"
              >
                Cancel
              </button>
              <button
                onClick={captureId}
                disabled={isProcessing}
                className="flex-[2] py-4 bg-white text-black font-bold text-lg rounded-2xl hover:bg-gray-100 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Capture
              </button>
            </div>
          )}

          {cameraStarted && (
            <div className="flex justify-center gap-4 mt-4 text-white/60 text-xs">
              <span>• Good lighting</span>
              <span>• Keep steady</span>
              <span>• Fill frame</span>
            </div>
          )}

          {!cameraStarted && (
            <button
              onClick={() => setSelectedIdType(null)}
              className="w-full mt-3 py-3 bg-white/10 backdrop-blur text-white/80 font-medium rounded-xl hover:bg-white/20 transition text-sm"
            >
              ← Change ID Type
            </button>
          )}
        </div>
      </div>
    );
  }

  // ===== FACE MISMATCH VIEW =====
  if (currentStep === 'selfie' && faceMismatch && capturedFace) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex flex-col">
        <div className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-center">
            <h1 className="font-semibold text-gray-900">Face Verification Failed</h1>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-md">
            <div className="text-center mb-6">
              <div className="w-20 h-20 mx-auto bg-red-500 rounded-full flex items-center justify-center mb-4 shadow-lg">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Face Mismatch Detected</h1>
              <p className="text-gray-600 mt-2">The selfie does not match the ID photo</p>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-4 mb-6">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-xs text-gray-500 mb-2">ID Photo</div>
                  {capturedImage && (
                    <img
                      src={capturedImage}
                      alt="ID Photo"
                      className="w-full h-32 object-cover rounded-lg border-2 border-gray-200"
                    />
                  )}
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-500 mb-2">Your Selfie</div>
                  <img
                    src={capturedFace}
                    alt="Selfie"
                    className="w-full h-32 object-cover rounded-lg border-2 border-red-300"
                  />
                </div>
              </div>
              
              {faceMismatchDetails && (
                <div className="border-t border-gray-100 pt-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Face Similarity</span>
                    <span className={`font-semibold ${faceMismatchDetails.confidence < 50 ? 'text-red-600' : 'text-orange-500'}`}>
                      {faceMismatchDetails.confidence || 0}%
                    </span>
                  </div>
                  {faceMismatchDetails.reason && (
                    <div className="mt-2 text-xs text-gray-600">
                      {faceMismatchDetails.reason}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
              <div className="flex gap-3">
                <div className="text-amber-500 flex-shrink-0">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <div className="font-semibold text-amber-800 text-sm">What to do?</div>
                  <div className="text-amber-700 text-xs mt-1">
                    • Ensure you are the person on the ID<br/>
                    • Use better lighting for the selfie<br/>
                    • Position your face similar to the ID photo<br/>
                    • Remove glasses or accessories if different from ID
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleRetryFace}
              className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===== FACE VERIFICATION COMPLETE =====
  if (currentStep === 'selfie' && faceVerified && capturedFace) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-md">
            <div className="text-center mb-6">
              <div className="w-20 h-20 mx-auto bg-green-500 rounded-full flex items-center justify-center mb-4 shadow-lg">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Verification Complete</h1>
              <p className="text-gray-600 mt-1">Identity verified successfully</p>
            </div>

            <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
              <div className="p-4">
                <div className="flex items-center gap-2 text-green-600 mb-3">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="font-semibold">100% Confidence</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-green-50 rounded-lg p-2 text-center">
                    <span className="text-green-700">✓ ID Verified</span>
                  </div>
                  <div className="bg-green-50 rounded-lg p-2 text-center">
                    <span className="text-green-700">✓ Face Matched</span>
                  </div>
                  <div className="bg-green-50 rounded-lg p-2 text-center">
                    <span className="text-green-700">✓ Liveness Passed</span>
                  </div>
                  <div className="bg-green-50 rounded-lg p-2 text-center">
                    <span className="text-green-700">✓ Real Human</span>
                  </div>
                </div>
                
                {faceMatchResult && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">Face Similarity</span>
                      <span className="font-semibold text-green-600">{faceMatchResult.similarity}%</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleDone}
                className="w-full py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===== SELFIE CAMERA VIEW =====
  if (currentStep === 'selfie') {
    return (
      <div className="fixed inset-0 bg-black flex flex-col">
        {!faceDetectionStarted && (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900" />
        )}
        
        <div className="relative z-20 px-4 pt-4 pb-2">
          <div className="flex items-center justify-between">
            <div className="w-10" />
            {modelsLoaded && (
              <div className="px-3 py-1 bg-green-500/80 backdrop-blur rounded-full text-white text-xs font-medium">
                AI Ready
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 relative flex flex-col">
          <video
            ref={faceVideoRef}
            autoPlay
            muted
            playsInline
            className={`absolute inset-0 w-full h-full object-cover ${!faceDetectionStarted ? 'hidden' : ''}`}
            style={{ transform: 'scaleX(-1)' }}
          />
          <canvas ref={faceCanvasRef} className="hidden" />
          <canvas 
            ref={overlayCanvasRef} 
            className={`absolute inset-0 w-full h-full object-cover pointer-events-none ${!faceDetectionStarted ? 'hidden' : ''}`}
            style={{ transform: 'scaleX(-1)' }}
          />

          {faceDetectionStarted && livenessScore > 0 && (
            <div 
              className="absolute inset-0 backdrop-blur-md bg-black/40 pointer-events-none"
              style={{
                WebkitMaskImage: 'radial-gradient(ellipse 104px 144px at center, transparent 100%, black 100%)',
                maskImage: 'radial-gradient(ellipse 104px 144px at center, transparent 100%, black 100%)',
              }}
            />
          )}

          {faceDetectionStarted && (
            <>
              <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
              <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
            </>
          )}

          {!faceDetectionStarted && (
            <div className="relative z-10 text-center pt-2 pb-4">
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Face Verification</h1>
              <p className="text-white/60 text-sm sm:text-base px-8">Position your face in the oval and follow the instructions</p>
            </div>
          )}

          <div className="flex-1 flex items-center justify-center relative">
            <div className="relative">
              <div
                className={`w-52 h-72 sm:w-60 sm:h-80 rounded-[50%] border-4 transition-all duration-300 ${
                  faceVerified
                    ? 'border-transparent'
                    : faceDetectionStarted
                    ? 'border-dashed border-white/30'
                    : 'border-solid border-white/20'
                }`}
              />
              
              {!faceDetectionStarted && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg 
                    viewBox="0 0 200 280" 
                    className="w-44 h-60 sm:w-52 sm:h-72"
                  >
                    <g stroke="rgba(255, 255, 255, 0.5)" strokeWidth="1" fill="none">
                      <path d="M30 120 Q25 160 35 195 Q50 220 100 235 Q150 220 165 195 Q175 160 170 120" />
                      <path d="M42 100 L55 95 L70 97 L82 102" />
                      <path d="M118 102 L130 97 L145 95 L158 100" />
                      <path d="M48 118 L58 115 L72 115 L82 118 L72 125 L58 125 Z" />
                      <path d="M118 118 L128 115 L142 115 L152 118 L142 125 L128 125 Z" />
                      <path d="M100 105 L100 150" />
                      <path d="M85 155 L95 162 L100 165 L105 162 L115 155" />
                      <path d="M70 185 Q85 178 100 178 Q115 178 130 185" />
                      <path d="M70 185 Q85 198 100 200 Q115 198 130 185" />
                    </g>
                  </svg>
                </div>
              )}
              
              {!faceDetectionStarted && (
                <div 
                  className="absolute inset-0 w-52 h-72 sm:w-60 sm:h-80 rounded-[50%] animate-pulse"
                  style={{
                    boxShadow: '0 0 40px rgba(59, 130, 246, 0.3), inset 0 0 40px rgba(59, 130, 246, 0.1)',
                  }}
                />
              )}
              
              {faceDetectionStarted && (
                <div
                  className="absolute inset-0 w-52 h-72 sm:w-60 sm:h-80 rounded-[50%] transition-all duration-300"
                  style={{
                    background: faceVerified
                      ? 'transparent'
                      : `conic-gradient(${
                          livenessScore >= 60 ? '#22c55e' : livenessScore >= 30 ? '#eab308' : '#ef4444'
                        } ${livenessScore * 3.6}deg, transparent ${livenessScore * 3.6}deg)`,
                    WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #fff calc(100% - 4px))',
                    mask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #fff calc(100% - 4px))',
                  }}
                />
              )}
              
              {faceVerified && (
                <div className="absolute inset-0 w-52 h-72 sm:w-60 sm:h-80 rounded-[50%] border-4 border-green-500 shadow-[0_0_40px_rgba(34,197,94,0.5)]" />
              )}
              
              {faceDetectionStarted && currentExpression && (
                <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <span className="px-4 py-1.5 bg-black/50 backdrop-blur rounded-full text-white text-sm font-medium capitalize">
                    {currentExpression}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="relative z-10 px-6 pb-6 pt-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
          {!faceDetectionStarted && (
            <div className="mb-5 space-y-2.5">
              <div className="flex items-center gap-3 text-white/80">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-400 text-sm">👁️</span>
                </div>
                <span className="text-sm">Look directly at the camera</span>
              </div>
              <div className="flex items-center gap-3 text-white/80">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-400 text-sm">😊</span>
                </div>
                <span className="text-sm">Show expressions when prompted</span>
              </div>
              <div className="flex items-center gap-3 text-white/80">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-400 text-sm">💡</span>
                </div>
                <span className="text-sm">Ensure good lighting on your face</span>
              </div>
            </div>
          )}
          
          {faceDetectionStarted && (
            <div
              className={`mb-4 py-3 px-4 rounded-xl text-center font-medium ${
                faceFeedbackType === 'success' ? 'bg-green-500 text-white'
                : faceFeedbackType === 'error' ? 'bg-red-500 text-white'
                : faceFeedbackType === 'warning' ? 'bg-yellow-500 text-black'
                : 'bg-white/20 backdrop-blur text-white'
              }`}
            >
              {faceFeedback}
            </div>
          )}

          {!faceDetectionStarted && (
            <button
              onClick={startFaceCamera}
              disabled={!modelsLoaded}
              className="w-full py-4 bg-gradient-to-r from-green-500 to-green-600 text-white font-bold text-lg rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed hover:from-green-600 hover:to-green-700 transition shadow-lg shadow-green-500/30"
            >
              {!modelsLoaded ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Loading AI Models...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Start Face Scan
                </span>
              )}
            </button>
          )}

          {faceDetectionStarted && (
            <div className="flex justify-center gap-3 mt-4">
              <div className={`w-3 h-3 rounded-full ${isCentered ? 'bg-green-500' : 'bg-white/30'}`} title="Centered" />
              <div className={`w-3 h-3 rounded-full ${detectedExpressions.includes('happy') ? 'bg-green-500' : 'bg-white/30'}`} title="Smile 😊" />
              <div className={`w-3 h-3 rounded-full ${detectedExpressions.includes('angry') ? 'bg-green-500' : 'bg-white/30'}`} title="Angry 😠" />
              <div className={`w-3 h-3 rounded-full ${livenessScore >= 80 ? 'bg-green-500' : 'bg-white/30'}`} title="Liveness" />
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
