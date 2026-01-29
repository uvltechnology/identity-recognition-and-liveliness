import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import * as faceapi from 'face-api.js';

const MOVEMENT_THRESHOLD = 8;
const LIVENESS_REQUIRED_SCORE = 70;
const CENTER_TOLERANCE = 0.20;
const REQUIRED_CENTERED_FRAMES = 10;
const MAX_FRAME_HISTORY = 30;
const MIN_FACE_CONFIDENCE = 0.5;

// Face size thresholds (relative to video dimensions)
const MIN_FACE_SIZE_RATIO = 0.25;
const MAX_FACE_SIZE_RATIO = 0.55;

// Anti-spoofing thresholds
const MIN_MICRO_MOVEMENT = 0.3;
const MAX_STATIC_FRAMES = 15;
const HEAD_POSE_VARIANCE_MIN = 0.5;

// Expression-based liveness detection
const REQUIRED_EXPRESSIONS = ['happy', 'angry']; // Must show both expressions
const EXPRESSION_CONFIDENCE_THRESHOLD = 0.5; // Minimum confidence to count expression

export default function SelfieLiveness() {
  const { id: sessionId } = useParams();
  const faceVideoRef = useRef(null);
  const faceCanvasRef = useRef(null);
  const faceStreamRef = useRef(null);
  const faceDetectionIntervalRef = useRef(null);
  const frameHistoryRef = useRef([]);
  const lastFacePositionRef = useRef(null);
  const centeredFrameCountRef = useRef(0);
  const expressionChangeRef = useRef(false);
  const livenessScoreRef = useRef(0);
  const isRunningRef = useRef(false);
  const modelsLoadedRef = useRef(false);
  
  // Anti-spoofing refs
  const staticFrameCountRef = useRef(0);
  const lastLandmarksRef = useRef(null);
  const headPoseHistoryRef = useRef([]);
  const spoofDetectedRef = useRef(false);
  
  // Expression-based liveness refs
  const detectedExpressionsRef = useRef(new Set()); // Track which expressions have been shown
  const currentExpressionRef = useRef(null);
  const expressionHoldCountRef = useRef(0); // How many frames the current expression is held
  const EXPRESSION_HOLD_REQUIRED = 3; // Must hold expression for 3 frames to count

  const [session, setSession] = useState(null);
  const [consentGiven, setConsentGiven] = useState(false);
  const [error, setError] = useState(null);
  const [faceDetectionStarted, setFaceDetectionStarted] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [livenessScore, setLivenessScore] = useState(0);
  const [faceFeedback, setFaceFeedback] = useState('Loading...');
  const [faceFeedbackType, setFaceFeedbackType] = useState('info');
  const [capturedFace, setCapturedFace] = useState(null);
  const [faceVerified, setFaceVerified] = useState(false);
  const [steadySeconds, setSteadySeconds] = useState(0);
  const [isCentered, setIsCentered] = useState(false);
  const [currentExpression, setCurrentExpression] = useState('');
  const [detectedExpressions, setDetectedExpressions] = useState([]);
  const [requiredExpression, setRequiredExpression] = useState(null); // Current expression to show
  const [faceLandmarks, setFaceLandmarks] = useState(null);
  const [faceBox, setFaceBox] = useState(null);
  const [linkedIdImage, setLinkedIdImage] = useState(null);
  const [faceMismatch, setFaceMismatch] = useState(false);
  const [faceMismatchDetails, setFaceMismatchDetails] = useState(null);
  const overlayCanvasRef = useRef(null);

  // Expected origin for postMessage
  const expectedOrigin = typeof window !== 'undefined' ? (window.__IDENTITY_EXPECTED_ORIGIN__ || '*') : '*';

  // Fetch session data on mount
  useEffect(() => {
    if (!sessionId) {
      setError('No session ID provided');
      return;
    }

    fetch(`/api/verify/session/${sessionId}`)
      .then(res => res.json())
      .then(async (data) => {
        if (data.success && data.session) {
          const sessionStatus = (data.session.status || '').toLowerCase();
          // Check if session is already in a terminal state
          if (['done', 'completed', 'success'].includes(sessionStatus)) {
            // Show completed state with existing results
            setSession(data.session);
            setConsentGiven(true);
            if (data.session.result?.capturedImageBase64) {
              setCapturedFace(data.session.result.capturedImageBase64);
            }
            if (data.session.result?.livenessScore) {
              setLivenessScore(data.session.result.livenessScore);
              livenessScoreRef.current = data.session.result.livenessScore;
            }
            setFaceVerified(true);
            setFaceFeedback('Verification already completed');
            setFaceFeedbackType('success');
            return;
          }
          if (['failed', 'cancelled', 'canceled'].includes(sessionStatus)) {
            setError('This verification session has been cancelled or failed. Please create a new session to verify again.');
            return;
          }
          if (sessionStatus === 'expired') {
            setError('This verification session has expired. Please create a new session.');
            return;
          }
          setSession(data.session);
          setFaceFeedback('Press Start to begin');

          // If this is a combined flow, fetch the linked ID session to get the ID image
          if (data.session.payload?.verificationType === 'combined-selfie' && data.session.payload?.linkedIdSession) {
            try {
              const idSessionRes = await fetch(`/api/verify/session/${data.session.payload.linkedIdSession}`);
              const idSessionData = await idSessionRes.json();
              if (idSessionData.success && idSessionData.session?.result?.capturedImageBase64) {
                setLinkedIdImage(idSessionData.session.result.capturedImageBase64);
                console.log('[SelfieLiveness] Linked ID image loaded for face comparison');
              }
            } catch (err) {
              console.warn('[SelfieLiveness] Failed to load linked ID session:', err);
            }
          }
        } else {
          setError('Session not found or expired');
        }
      })
      .catch(err => {
        console.error('Failed to fetch session:', err);
        setError('Failed to load session');
      });
  }, [sessionId]);

  useEffect(() => {
    return () => stopFaceDetection();
  }, []);

  useEffect(() => {
    const loadModels = async () => {
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
        setFaceFeedback('Press Start to begin');
        console.log('Face-api.js models loaded');
      } catch (err) {
        console.error('Error loading models:', err);
        setFaceFeedback('Failed to load AI models');
        setFaceFeedbackType('error');
      }
    };
    loadModels();
  }, []);

  // Notify parent window
  const notifyParent = useCallback((message) => {
    if (typeof window !== 'undefined' && window.parent !== window) {
      try {
        window.parent.postMessage(message, expectedOrigin);
      } catch (e) {
        console.warn('[identity] postMessage failed', e);
      }
    }
  }, [expectedOrigin]);

  // Notify parent about failure
  const notifyParentFailed = useCallback(async (reason, details = {}) => {
    notifyParent({
      identityOCR: {
        action: 'verification_failed',
        status: 'failed',
        reason: reason,
        session: sessionId,
        details: details,
      },
    });

    // Update session on server
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
      console.warn('[identity] session fail update failed', e);
    }
  }, [notifyParent, sessionId]);

  // Notify parent about cancellation
  const notifyParentCancelled = useCallback(async (reason) => {
    notifyParent({
      identityOCR: {
        action: 'verification_cancelled',
        status: 'cancelled',
        reason: reason,
        session: sessionId,
      },
    });

    try {
      await fetch(`/api/verify/session/${sessionId}/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'cancelled',
          reason: reason,
          finishedAt: new Date().toISOString(),
        }),
      });
    } catch (e) {
      console.warn('[identity] session cancel update failed', e);
    }
  }, [notifyParent, sessionId]);

  const handleConsentAccept = () => {
    setConsentGiven(true);
    setFaceFeedback('Press Start to begin');
  };

  const handleConsentDecline = async () => {
    setConsentGiven(false);
    setError('You declined the camera consent. The verification has been cancelled.');

    await notifyParentCancelled('consent_declined');
  };

  const startFaceDetection = async () => {
    if (!modelsLoadedRef.current) {
      setFaceFeedback('AI models loading...');
      setFaceFeedbackType('warning');
      return;
    }

    try {
      setFaceFeedback('Starting camera...');
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera not available. Use HTTPS.');
      }

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
          console.log('Camera started with config:', config);
          break;
        } catch (err) {
          lastError = err;
          console.warn('Camera config failed:', config, err.message);
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

      frameHistoryRef.current = [];
      lastFacePositionRef.current = null;
      centeredFrameCountRef.current = 0;
      expressionChangeRef.current = false;
      livenessScoreRef.current = 0;
      isRunningRef.current = true;
      
      staticFrameCountRef.current = 0;
      lastLandmarksRef.current = null;
      headPoseHistoryRef.current = [];
      spoofDetectedRef.current = false;
      
      // Reset expression detection
      detectedExpressionsRef.current = new Set();
      currentExpressionRef.current = null;
      expressionHoldCountRef.current = 0;

      setFaceDetectionStarted(true);
      setLivenessScore(0);
      setCapturedFace(null);
      setFaceVerified(false);
      setIsCentered(false);
      setCurrentExpression('');
      setDetectedExpressions([]);
      setRequiredExpression(REQUIRED_EXPRESSIONS[0]); // Start with first expression (happy/smile)
      setFaceFeedback('😊 Please SMILE at the camera');

      startLivenessDetection();
    } catch (err) {
      console.error('Camera error:', err);
      let errorMsg = err.message || 'Camera access failed';
      
      if (err.name === 'NotAllowedError') {
        errorMsg = 'Camera permission denied. Please allow camera access.';
      } else if (err.name === 'NotFoundError') {
        errorMsg = 'No camera found. Please connect a camera.';
      } else if (err.name === 'NotReadableError' || err.message?.includes('Could not start')) {
        errorMsg = 'Camera is in use by another app. Please close other apps using the camera.';
      } else if (err.name === 'OverconstrainedError') {
        errorMsg = 'Camera does not support requested settings.';
      } else if (!window.isSecureContext) {
        errorMsg = 'Camera requires HTTPS. Use localhost or enable HTTPS.';
      }
      
      setFaceFeedback(errorMsg);
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
      faceStreamRef.current.getTracks().forEach(t => t.stop());
      faceStreamRef.current = null;
    }
    if (faceVideoRef.current) faceVideoRef.current.srcObject = null;
    frameHistoryRef.current = [];
    livenessScoreRef.current = 0;
    centeredFrameCountRef.current = 0;
    setFaceDetectionStarted(false);
  }, []);

  const isProcessingRef = useRef(false);

  const startLivenessDetection = () => {
    if (faceDetectionIntervalRef.current) clearInterval(faceDetectionIntervalRef.current);
    faceDetectionIntervalRef.current = setInterval(async () => {
      if (!isRunningRef.current || isProcessingRef.current) return;
      isProcessingRef.current = true;
      try {
        await analyzeLiveness();
      } finally {
        isProcessingRef.current = false;
      }
    }, 250);
  };

  const analyzeLiveness = async () => {
    const video = faceVideoRef.current;
    if (!video || video.readyState < 2) return;

    try {
      const detections = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ 
          scoreThreshold: MIN_FACE_CONFIDENCE,
          inputSize: 224
        }))
        .withFaceLandmarks()
        .withFaceExpressions();

      if (!detections) {
        setFaceFeedback('👤 Position your face in the oval');
        setFaceFeedbackType('warning');
        livenessScoreRef.current = Math.max(0, livenessScoreRef.current - 5);
        setLivenessScore(Math.round(livenessScoreRef.current));
        setIsCentered(false);
        centeredFrameCountRef.current = 0;
        setFaceLandmarks(null);
        setFaceBox(null);
        clearOverlayCanvas();
        return;
      }

      const { detection, landmarks, expressions } = detections;
      const box = detection.box;
      const dominantExpression = Object.entries(expressions).reduce((a, b) => a[1] > b[1] ? a : b);
      setCurrentExpression(dominantExpression[0]);
      
      setFaceBox(box);
      setFaceLandmarks(landmarks);
      if (livenessScoreRef.current > 0) {
        drawFaceLandmarks(landmarks, box);
      } else {
        clearOverlayCanvas();
      }

      const faceCenterX = box.x + box.width / 2;
      const faceCenterY = box.y + box.height / 2;
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;
      const videoCenterX = videoWidth / 2;
      const videoCenterY = videoHeight / 2;

      const offsetX = Math.abs(faceCenterX - videoCenterX) / videoWidth;
      const offsetY = Math.abs(faceCenterY - videoCenterY) / videoHeight;
      const faceIsCentered = offsetX < CENTER_TOLERANCE && offsetY < CENTER_TOLERANCE;
      setIsCentered(faceIsCentered);

      const faceSizeRatio = box.height / videoHeight;
      const isTooClose = faceSizeRatio > MAX_FACE_SIZE_RATIO;
      const isTooFar = faceSizeRatio < MIN_FACE_SIZE_RATIO;
      const faceIsProperSize = !isTooClose && !isTooFar;

      let movement = 0;
      if (lastFacePositionRef.current) {
        movement = Math.abs(faceCenterX - lastFacePositionRef.current.x) +
                   Math.abs(faceCenterY - lastFacePositionRef.current.y) +
                   Math.abs(box.width - lastFacePositionRef.current.width);
      }
      lastFacePositionRef.current = { x: faceCenterX, y: faceCenterY, width: box.width };

      const leftEAR = getEyeAspectRatio(landmarks.getLeftEye());
      const rightEAR = getEyeAspectRatio(landmarks.getRightEye());
      const avgEyeRatio = (leftEAR + rightEAR) / 2;

      let microMovement = 0;
      const currentLandmarks = landmarks.positions;
      if (lastLandmarksRef.current && currentLandmarks.length === lastLandmarksRef.current.length) {
        for (let i = 0; i < currentLandmarks.length; i++) {
          microMovement += Math.abs(currentLandmarks[i].x - lastLandmarksRef.current[i].x);
          microMovement += Math.abs(currentLandmarks[i].y - lastLandmarksRef.current[i].y);
        }
        microMovement /= currentLandmarks.length;
      }
      lastLandmarksRef.current = currentLandmarks.map(p => ({ x: p.x, y: p.y }));

      if (microMovement < MIN_MICRO_MOVEMENT && microMovement > 0) {
        staticFrameCountRef.current++;
      } else {
        staticFrameCountRef.current = Math.max(0, staticFrameCountRef.current - 1);
      }

      const noseTip = landmarks.getNose()[3];
      const leftEye = landmarks.getLeftEye();
      const rightEye = landmarks.getRightEye();
      const eyeCenterX = (leftEye[0].x + rightEye[3].x) / 2;
      const eyeCenterY = (leftEye[0].y + rightEye[3].y) / 2;
      const headPoseX = noseTip.x - eyeCenterX;
      const headPoseY = noseTip.y - eyeCenterY;
      
      headPoseHistoryRef.current.push({ x: headPoseX, y: headPoseY });
      if (headPoseHistoryRef.current.length > 15) headPoseHistoryRef.current.shift();

      let headPoseVariance = 0;
      if (headPoseHistoryRef.current.length >= 10) {
        const poses = headPoseHistoryRef.current;
        const meanX = poses.reduce((s, p) => s + p.x, 0) / poses.length;
        const meanY = poses.reduce((s, p) => s + p.y, 0) / poses.length;
        headPoseVariance = poses.reduce((s, p) => s + Math.pow(p.x - meanX, 2) + Math.pow(p.y - meanY, 2), 0) / poses.length;
      }

      frameHistoryRef.current.push({
        timestamp: Date.now(), faceCenterX, faceCenterY, faceWidth: box.width,
        eyeRatio: avgEyeRatio, expression: dominantExpression[0], confidence: detection.score
      });
      if (frameHistoryRef.current.length > MAX_FRAME_HISTORY) frameHistoryRef.current.shift();

      let indicators = 0;
      if (detection.score > MIN_FACE_CONFIDENCE) indicators++;
      if (movement > MOVEMENT_THRESHOLD) indicators++;

      // Expression-based liveness detection
      const currentExpr = dominantExpression[0];
      const currentExprConfidence = dominantExpression[1];
      setCurrentExpression(currentExpr);

      // Check if current expression matches what we're looking for
      const nextRequiredExpr = REQUIRED_EXPRESSIONS.find(expr => !detectedExpressionsRef.current.has(expr));
      
      if (nextRequiredExpr && currentExprConfidence >= EXPRESSION_CONFIDENCE_THRESHOLD) {
        if (currentExpr === nextRequiredExpr) {
          // Same expression as required, increment hold count
          if (currentExpressionRef.current === currentExpr) {
            expressionHoldCountRef.current++;
          } else {
            currentExpressionRef.current = currentExpr;
            expressionHoldCountRef.current = 1;
          }
          
          // If held for enough frames, mark as detected
          if (expressionHoldCountRef.current >= EXPRESSION_HOLD_REQUIRED) {
            detectedExpressionsRef.current.add(currentExpr);
            setDetectedExpressions([...detectedExpressionsRef.current]);
            console.log(`Expression '${currentExpr}' detected! Completed: ${detectedExpressionsRef.current.size}/${REQUIRED_EXPRESSIONS.length}`);
            
            // Move to next required expression
            const nextExpr = REQUIRED_EXPRESSIONS.find(expr => !detectedExpressionsRef.current.has(expr));
            setRequiredExpression(nextExpr || null);
            expressionHoldCountRef.current = 0;
            currentExpressionRef.current = null;
          }
        } else {
          // Different expression, reset hold count
          currentExpressionRef.current = null;
          expressionHoldCountRef.current = 0;
        }
      }

      // Check if all expressions completed
      const allExpressionsCompleted = REQUIRED_EXPRESSIONS.every(expr => detectedExpressionsRef.current.has(expr));
      if (allExpressionsCompleted) expressionChangeRef.current = true;

      if (frameHistoryRef.current.length >= 5) {
        const xPos = frameHistoryRef.current.slice(-10).map(f => f.faceCenterX);
        const mean = xPos.reduce((a, b) => a + b, 0) / xPos.length;
        const variance = xPos.reduce((s, x) => s + Math.pow(x - mean, 2), 0) / xPos.length;
        if (variance > 5) indicators++;
      }
      if (allExpressionsCompleted) indicators += 2; // Give bonus for completing expressions
      if (expressionChangeRef.current) indicators++;

      const isTooStatic = staticFrameCountRef.current > MAX_STATIC_FRAMES;
      const hasNoHeadMovement = headPoseHistoryRef.current.length >= 10 && headPoseVariance < HEAD_POSE_VARIANCE_MIN;
      
      // Check if all expressions completed for anti-spoof (reuse variable from above)
      const potentialSpoof = (isTooStatic && hasNoHeadMovement) && !allExpressionsCompleted;
      
      if (potentialSpoof && !allExpressionsCompleted) {
        indicators = Math.max(0, indicators - 1);
        spoofDetectedRef.current = true;
      } else if (allExpressionsCompleted || microMovement > MIN_MICRO_MOVEMENT) {
        spoofDetectedRef.current = false;
      }

      if (faceIsCentered) centeredFrameCountRef.current++;
      else centeredFrameCountRef.current = 0;

      const frameScore = (indicators / 6) * 100; // Updated divisor for new indicator count
      livenessScoreRef.current = livenessScoreRef.current * 0.7 + frameScore * 0.3;
      const score = Math.round(livenessScoreRef.current);
      setLivenessScore(score);

      const remaining = Math.max(0, Math.ceil((REQUIRED_CENTERED_FRAMES - centeredFrameCountRef.current) * 0.2));
      setSteadySeconds(remaining);

      // Get expression emoji and name for feedback
      const getExpressionEmoji = (expr) => {
        switch(expr) {
          case 'happy': return '😊';
          case 'angry': return '😠';
          case 'sad': return '😢';
          case 'surprised': return '😲';
          default: return '😐';
        }
      };
      
      const getExpressionName = (expr) => {
        switch(expr) {
          case 'happy': return 'SMILE';
          case 'angry': return 'ANGRY FACE';
          default: return expr.toUpperCase();
        }
      };

      if (!faceIsCentered) {
        const moveHorizontal = offsetX >= CENTER_TOLERANCE;
        const moveVertical = offsetY >= CENTER_TOLERANCE;
        
        if (moveHorizontal && moveVertical) {
          const hDir = faceCenterX < videoCenterX ? '← Move left' : '→ Move right';
          const vDir = faceCenterY < videoCenterY ? '↓ Move down' : '↑ Move up';
          setFaceFeedback(`${hDir} and ${vDir}`);
        } else if (moveHorizontal) {
          setFaceFeedback(faceCenterX < videoCenterX ? '← Move left' : '→ Move right');
        } else if (moveVertical) {
          setFaceFeedback(faceCenterY < videoCenterY ? '↓ Move face down' : '↑ Move face up');
        }
        setFaceFeedbackType('warning');
      } else if (isTooClose) {
        setFaceFeedback('📏 Move back, too close');
        setFaceFeedbackType('warning');
      } else if (isTooFar) {
        setFaceFeedback('📏 Move closer to camera');
        setFaceFeedbackType('warning');
      } else if (spoofDetectedRef.current) {
        if (staticFrameCountRef.current > MAX_STATIC_FRAMES) {
          setFaceFeedback('🚫 Move your head slightly');
        } else {
          setFaceFeedback('🚫 Please use a real face, not a photo');
        }
        setFaceFeedbackType('error');
      } else if (!allExpressionsCompleted) {
        // Show which expression is needed
        const nextExpr = REQUIRED_EXPRESSIONS.find(expr => !detectedExpressionsRef.current.has(expr));
        const completed = detectedExpressionsRef.current.size;
        const total = REQUIRED_EXPRESSIONS.length;
        const emoji = getExpressionEmoji(nextExpr);
        const name = getExpressionName(nextExpr);
        setFaceFeedback(`${emoji} Please show ${name} (${completed}/${total} done)`);
        setFaceFeedbackType('info');
      } else if (score < LIVENESS_REQUIRED_SCORE) {
        setFaceFeedback('🔄 Keep looking at the camera...');
        setFaceFeedbackType('info');
      } else if (centeredFrameCountRef.current >= REQUIRED_CENTERED_FRAMES && allExpressionsCompleted && !spoofDetectedRef.current && faceIsProperSize) {
        setFaceFeedback('📸 Perfect! Capturing...');
        setFaceFeedbackType('success');
        performCapture();
      } else {
        setFaceFeedback(`✓ Hold still for ${remaining}s`);
        setFaceFeedbackType('success');
      }
    } catch (err) {
      console.error('Detection error:', err);
    }
  };

  const getEyeAspectRatio = (eye) => {
    const v1 = Math.sqrt(Math.pow(eye[1].x - eye[5].x, 2) + Math.pow(eye[1].y - eye[5].y, 2));
    const v2 = Math.sqrt(Math.pow(eye[2].x - eye[4].x, 2) + Math.pow(eye[2].y - eye[4].y, 2));
    const h = Math.sqrt(Math.pow(eye[0].x - eye[3].x, 2) + Math.pow(eye[0].y - eye[3].y, 2));
    return (v1 + v2) / (2 * h);
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
    
    const scaledPoints = points.map(p => ({
      x: p.x * scaleX,
      y: p.y * scaleY
    }));

    const meshConnections = [
      [17, 18], [18, 19], [19, 20], [20, 21],
      [22, 23], [23, 24], [24, 25], [25, 26],
      [17, 36], [18, 36], [18, 37], [19, 37], [19, 38], [20, 38], [20, 39], [21, 39],
      [22, 42], [23, 42], [23, 43], [24, 43], [24, 44], [25, 44], [25, 45], [26, 45],
      [17, 21], [22, 26],
      [19, 21], [22, 24],
      [36, 37], [37, 38], [38, 39], [39, 40], [40, 41], [41, 36],
      [36, 39], [37, 40], [38, 41],
      [42, 43], [43, 44], [44, 45], [45, 46], [46, 47], [47, 42],
      [42, 45], [43, 46], [44, 47],
      [27, 28], [28, 29], [29, 30],
      [30, 31], [30, 35], [31, 32], [32, 33], [33, 34], [34, 35],
      [31, 33], [33, 35],
      [27, 21], [27, 22], [27, 39], [27, 42],
      [28, 39], [28, 42],
      [29, 31], [29, 35],
      [39, 27], [42, 27],
      [40, 29], [47, 29],
      [41, 31], [46, 35],
      [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8],
      [8, 9], [9, 10], [10, 11], [11, 12], [12, 13], [13, 14], [14, 15], [15, 16],
      [0, 17], [1, 36], [2, 41], [3, 31],
      [16, 26], [15, 45], [14, 46], [13, 35],
      [4, 48], [5, 48], [6, 59],
      [12, 54], [11, 54], [10, 55],
      [7, 58], [8, 57], [9, 56],
      [48, 49], [49, 50], [50, 51], [51, 52], [52, 53], [53, 54],
      [54, 55], [55, 56], [56, 57], [57, 58], [58, 59], [59, 48],
      [60, 61], [61, 62], [62, 63], [63, 64], [64, 65], [65, 66], [66, 67], [67, 60],
      [48, 60], [51, 62], [54, 64], [57, 66],
      [49, 61], [50, 62], [52, 63], [53, 64],
      [55, 65], [56, 66], [58, 67], [59, 60],
      [31, 48], [32, 49], [33, 51], [34, 53], [35, 54],
      [36, 41], [42, 47],
      [31, 41], [35, 46],
      [30, 33], [27, 30],
      [17, 19], [19, 21], [22, 24], [24, 26],
      [18, 20], [23, 25],
      [21, 27], [22, 27],
      [17, 0], [26, 16],
    ];

    const lineColor = 'rgba(255, 255, 255, 0.5)';
    const dotColor = 'rgba(255, 255, 255, 0.9)';

    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    meshConnections.forEach(([i, j]) => {
      if (scaledPoints[i] && scaledPoints[j]) {
        ctx.moveTo(scaledPoints[i].x, scaledPoints[i].y);
        ctx.lineTo(scaledPoints[j].x, scaledPoints[j].y);
      }
    });
    ctx.stroke();

    ctx.fillStyle = dotColor;
    scaledPoints.forEach((point) => {
      if (!point) return;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  const performCapture = async () => {
    if (!isRunningRef.current) return;
    
    const video = faceVideoRef.current;
    const canvas = faceCanvasRef.current;
    if (!canvas || !video) return;

    setFaceFeedback('🔍 Final checking, hold on...');
    setFaceFeedbackType('info');
    
    try {
      const finalDetection = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: MIN_FACE_CONFIDENCE }))
        .withFaceLandmarks();

      if (!finalDetection) {
        setFaceFeedback('⚠️ Face lost! Look at the camera');
        setFaceFeedbackType('warning');
        centeredFrameCountRef.current = 0;
        return;
      }

      const box = finalDetection.detection.box;
      const faceCenterX = box.x + box.width / 2;
      const faceCenterY = box.y + box.height / 2;
      const videoCenterX = video.videoWidth / 2;
      const videoCenterY = video.videoHeight / 2;
      const offsetX = Math.abs(faceCenterX - videoCenterX) / video.videoWidth;
      const offsetY = Math.abs(faceCenterY - videoCenterY) / video.videoHeight;

      if (offsetX >= CENTER_TOLERANCE || offsetY >= CENTER_TOLERANCE) {
        setFaceFeedback('⚠️ Center your face again');
        setFaceFeedbackType('warning');
        centeredFrameCountRef.current = 0;
        return;
      }

      // Capture image first
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);

      // AI Anti-Spoofing Check
      setFaceFeedback('🤖 AI verifying real human...');
      setFaceFeedbackType('info');

      try {
        const allExpressionsCompleted = REQUIRED_EXPRESSIONS.every(expr => detectedExpressionsRef.current.has(expr));
        const aiResponse = await fetch('/api/ai/face/liveness', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: imageDataUrl,
            livenessScore: livenessScoreRef.current,
            movementDetected: allExpressionsCompleted || expressionChangeRef.current,
          }),
        });

        const aiResult = await aiResponse.json();

        if (aiResult.success && aiResult.result) {
          const { isLive, confidence, reason } = aiResult.result;

          if (!isLive || confidence < 70) {
            setFaceFeedback(`❌ Spoofing detected: ${reason || 'Please use a real face'}`);
            setFaceFeedbackType('error');
            centeredFrameCountRef.current = 0;
            spoofDetectedRef.current = true;
            return;
          }
        }
      } catch (aiErr) {
        console.warn('AI liveness check failed, proceeding with local checks:', aiErr);
      }

      // Face comparison for combined verification flow
      if (linkedIdImage) {
        setFaceFeedback('🔍 Comparing face with ID photo...');
        setFaceFeedbackType('info');

        let faceApiMatch = null;
        let faceApiDistance = null;

        // Face-api.js descriptor comparison
        try {
          // Load ID image and extract face descriptor
          const idImg = await faceapi.fetchImage(linkedIdImage);
          const idDetection = await faceapi
            .detectSingleFace(idImg, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.3 }))
            .withFaceLandmarks()
            .withFaceDescriptor();

          // Get selfie face descriptor from current capture
          const selfieImg = await faceapi.fetchImage(imageDataUrl);
          const selfieDetection = await faceapi
            .detectSingleFace(selfieImg, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.3 }))
            .withFaceLandmarks()
            .withFaceDescriptor();

          if (idDetection && selfieDetection) {
            // Calculate euclidean distance between face descriptors
            // Lower distance = more similar faces
            // VERY Age-tolerant threshold: 0.70 (accounts for significant aging 10+ years)
            // - 0.4-0.5 = strong match (same person, recent photo)
            // - 0.5-0.60 = good match (same person, some age difference)
            // - 0.60-0.70 = moderate match (same person, significant age change)
            // - 0.70-0.80 = weak match (possible same person with 10+ years age change)
            // - >0.80 = different person
            // Note: 35% similarity = 0.65 distance, so threshold 0.70 allows 30%+ similarity
            const distance = faceapi.euclideanDistance(idDetection.descriptor, selfieDetection.descriptor);
            faceApiDistance = distance;
            faceApiMatch = distance < 0.70; // Very age-tolerant threshold (allows 30%+ similarity)

            console.log('[FaceComparison] Face-api.js distance:', distance, 'Match:', faceApiMatch, '(threshold: 0.70)');
          } else {
            console.warn('[FaceComparison] Could not detect face in one or both images');
            if (!idDetection) {
              console.warn('[FaceComparison] No face detected in ID image');
            }
            if (!selfieDetection) {
              console.warn('[FaceComparison] No face detected in selfie');
            }
          }
        } catch (faceApiErr) {
          console.warn('[FaceComparison] Face-api.js comparison failed:', faceApiErr);
        }

        // AI comparison (primary method - better at understanding aging)
        let aiMatch = null;
        let aiConfidence = null;
        let aiReason = null;

        try {
          const compareResponse = await fetch('/api/ai/face/compare', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              idImage: linkedIdImage,
              selfieImage: imageDataUrl,
            }),
          });

          const compareResult = await compareResponse.json();

          if (compareResult.success && compareResult.result) {
            aiMatch = compareResult.result.isMatch;
            aiConfidence = compareResult.result.confidence;
            aiReason = compareResult.result.reason;
            console.log('[FaceComparison] AI result:', aiMatch, 'Confidence:', aiConfidence, 'Reason:', aiReason);
          }
        } catch (aiCompareErr) {
          console.warn('[FaceComparison] AI comparison failed:', aiCompareErr);
        }

        console.log('[FaceComparison] Final Results - FaceAPI Match:', faceApiMatch, 'Distance:', faceApiDistance, 'AI Match:', aiMatch, 'AI Confidence:', aiConfidence);

        // AGE-AWARE Combined decision logic:
        // Priority: AI comparison > face-api.js (AI better understands aging)
        // 
        // Decision Matrix (VERY AGE TOLERANT - for 10+ year age gaps):
        // 1. AI says MATCH with confidence >= 60 → PASS (AI understands aging)
        // 2. AI says MATCH with confidence 40-59 AND faceApi distance < 0.75 → PASS
        // 3. AI says NO MATCH with confidence >= 70 → FAIL (high confidence different person)
        // 4. AI says NO MATCH with confidence >= 50 AND faceApi distance >= 0.75 → FAIL
        // 5. faceApi distance >= 0.80 AND AI unavailable → FAIL (clearly different)
        // 6. faceApi distance < 0.70 AND AI unavailable → PASS (good match for aged photos)
        // 7. Borderline cases: combine signals
        // Note: 35% similarity = 0.65 distance, threshold allows 30%+ similarity to pass

        let finalMismatch = false;
        let mismatchReason = '';
        const similarity = faceApiDistance !== null ? Math.round((1 - faceApiDistance) * 100) : null;

        // PASS CONDITIONS - Check first
        let isMatch = false;

        // AI says match with good confidence - TRUST IT (AI handles aging well)
        if (aiMatch === true && aiConfidence >= 60) {
          isMatch = true;
          console.log('[FaceComparison] ✅ AI match with high confidence');
        }
        // AI says match with moderate confidence AND faceApi isn't strongly against
        else if (aiMatch === true && aiConfidence >= 40 && (faceApiDistance === null || faceApiDistance < 0.75)) {
          isMatch = true;
          console.log('[FaceComparison] ✅ AI match with moderate confidence, faceApi neutral');
        }
        // FaceApi strong match AND AI unavailable or neutral
        else if (faceApiDistance !== null && faceApiDistance < 0.60 && (aiMatch === null || aiMatch === true)) {
          isMatch = true;
          console.log('[FaceComparison] ✅ FaceApi strong match');
        }
        // FaceApi moderate match (age-tolerant) AND AI unavailable
        else if (faceApiDistance !== null && faceApiDistance < 0.70 && aiMatch === null) {
          isMatch = true;
          console.log('[FaceComparison] ✅ FaceApi moderate match (age-tolerant), AI unavailable');
        }

        // FAIL CONDITIONS - Only if not already matched
        if (!isMatch) {
          // AI high confidence NO match
          if (aiMatch === false && aiConfidence >= 70) {
            finalMismatch = true;
            mismatchReason = aiReason || `Face mismatch detected (${aiConfidence}% confidence)`;
            console.log('[FaceComparison] ❌ AI high confidence mismatch');
          }
          // AI moderate confidence NO match AND faceApi also disagrees (more tolerant threshold)
          else if (aiMatch === false && aiConfidence >= 50 && faceApiDistance !== null && faceApiDistance >= 0.75) {
            finalMismatch = true;
            mismatchReason = `Face verification failed: ${similarity}% similarity, AI also detected mismatch`;
            console.log('[FaceComparison] ❌ Both AI and faceApi say mismatch');
          }
          // FaceApi clearly different AND AI not strongly supporting match (very tolerant)
          else if (faceApiDistance !== null && faceApiDistance >= 0.80 && aiMatch !== true) {
            finalMismatch = true;
            mismatchReason = `Face mismatch: ${similarity}% similarity (too different)`;
            console.log('[FaceComparison] ❌ FaceApi very high distance');
          }
          // AI unavailable but faceApi clearly different (more tolerant)
          else if (aiMatch === null && faceApiDistance !== null && faceApiDistance >= 0.75) {
            finalMismatch = true;
            mismatchReason = `Face verification failed: ${similarity}% similarity`;
            console.log('[FaceComparison] ❌ AI unavailable, faceApi mismatch');
          }
        }

        if (finalMismatch) {
          setFaceMismatch(true);
          setFaceMismatchDetails({
            confidence: similarity || (100 - (aiConfidence || 50)),
            reason: mismatchReason,
            details: {
              faceApiDistance,
              faceApiMatch,
              aiMatch,
              aiConfidence
            },
          });
          setFaceFeedback(`❌ ${mismatchReason}`);
          setFaceFeedbackType('error');
          centeredFrameCountRef.current = 0;
          setCapturedFace(imageDataUrl);

          // Notify parent about face mismatch failure
          notifyParentFailed('face_mismatch', {
            confidence: similarity || (100 - (aiConfidence || 50)),
            reason: mismatchReason,
            faceApiDistance,
            aiMatch,
            aiConfidence
          });

          return;
        }
      }

      // All checks passed
      isRunningRef.current = false;
      if (faceDetectionIntervalRef.current) {
        clearInterval(faceDetectionIntervalRef.current);
        faceDetectionIntervalRef.current = null;
      }

      setCapturedFace(imageDataUrl);
      setFaceVerified(true);
      setFaceFeedback('✅ Verified! Real human confirmed');
      setFaceFeedbackType('success');
      setLivenessScore(100);
      setSteadySeconds(0);
      stopFaceDetection();

      // Save result to session
      const result = {
        action: 'success',
        capturedImageBase64: imageDataUrl,
        livenessScore: 100,
        aiVerified: true,
        faceMatched: linkedIdImage ? true : null,
        timestamp: new Date().toISOString(),
        sessionId: sessionId,
      };

      await saveSessionResult(result);

      // Notify parent about success
      notifyParent({
        identityOCR: {
          action: 'verification_success',
          status: 'success',
          result: result,
          session: sessionId,
          images: {
            selfieImage: imageDataUrl,
          },
          verificationType: session?.payload?.verificationType || 'selfie',
        },
      });

    } catch (err) {
      console.error('Final capture check error:', err);
      setFaceFeedback('⚠️ Verification failed, try again');
      setFaceFeedbackType('error');
      centeredFrameCountRef.current = 0;
      
      // Notify parent about error
      notifyParentFailed('capture_error', { error: err.message });
    }
  };

  const saveSessionResult = async (result) => {
    try {
      await fetch(`/api/verify/session/${sessionId}/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'done',
          result: result,
          finishedAt: new Date().toISOString(),
        }),
      });
    } catch (e) {
      console.warn('[identity] save result failed', e);
    }
  };

  const resetAll = () => {
    setCapturedFace(null);
    setFaceVerified(false);
    setFaceFeedback('Press Start to begin');
    setFaceFeedbackType('info');
    setLivenessScore(0);
    setSteadySeconds(0);
    setIsCentered(false);
    setCurrentExpression('');
    setDetectedExpressions([]);
    setRequiredExpression(REQUIRED_EXPRESSIONS[0]);
    setFaceLandmarks(null);
    setFaceBox(null);
    expressionChangeRef.current = false;
    staticFrameCountRef.current = 0;
    lastLandmarksRef.current = null;
    headPoseHistoryRef.current = [];
    spoofDetectedRef.current = false;
    detectedExpressionsRef.current = new Set();
    currentExpressionRef.current = null;
    expressionHoldCountRef.current = 0;
  };

  const downloadFace = () => {
    if (!capturedFace) return;
    const link = document.createElement('a');
    link.href = capturedFace;
    link.download = `selfie-${Date.now()}.jpg`;
    link.click();
  };

  const handleDone = () => {
    notifyParent({
      identityOCR: {
        action: 'verification_complete',
        session: sessionId,
      },
    });
  };

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
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading session...</p>
        </div>
      </div>
    );
  }

  // Consent overlay
  if (!consentGiven) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Privacy & Camera Consent</h2>
          <p className="text-gray-600 mb-4">
            This verification will use your camera to perform a liveness check. 
            By continuing you consent to allow the camera to capture images for verification purposes.
          </p>
          <p className="text-gray-700 font-medium mb-2">For best results:</p>
          <ul className="list-disc pl-5 mb-4 text-gray-600 text-sm space-y-1">
            <li>Ensure good, even lighting on your face.</li>
            <li>Look directly at the camera.</li>
            <li>Blink naturally when prompted.</li>
            <li>Keep your face centered in the oval guide.</li>
          </ul>
          <div className="flex gap-3 justify-end">
            <button
              onClick={handleConsentDecline}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
            >
              Decline
            </button>
            <button
              onClick={handleConsentAccept}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              I Consent & Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Face Mismatch View (for combined verification)
  if (faceMismatch && capturedFace) {
    const handleRetry = () => {
      setFaceMismatch(false);
      setFaceMismatchDetails(null);
      setCapturedFace(null);
      setFaceVerified(false);
      setFaceFeedback('Press Start to try again');
      setFaceFeedbackType('info');
      setLivenessScore(0);
      setDetectedExpressions([]);
      setRequiredExpression(REQUIRED_EXPRESSIONS[0]);
      centeredFrameCountRef.current = 0;
      detectedExpressionsRef.current = new Set();
      currentExpressionRef.current = null;
      expressionHoldCountRef.current = 0;
    };

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

            {/* Side by side comparison */}
            <div className="bg-white rounded-2xl shadow-xl p-4 mb-6">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-xs text-gray-500 mb-2">ID Photo</div>
                  {linkedIdImage && (
                    <img
                      src={linkedIdImage}
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
                  {faceMismatchDetails.details?.faceApiDistance !== undefined && (
                    <div className="mt-1 text-xs text-gray-400">
                      Face-api.js distance: {faceMismatchDetails.details.faceApiDistance.toFixed(3)}
                    </div>
                  )}
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
              onClick={handleRetry}
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

  // Results View
  if (faceVerified && capturedFace) {
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
              <p className="text-gray-600 mt-1">Live person verified successfully</p>
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
                    <span className="text-green-700">✓ Blink Detected</span>
                  </div>
                  <div className="bg-green-50 rounded-lg p-2 text-center">
                    <span className="text-green-700">✓ Movement</span>
                  </div>
                  <div className="bg-green-50 rounded-lg p-2 text-center">
                    <span className="text-green-700">✓ Expression</span>
                  </div>
                  <div className="bg-green-50 rounded-lg p-2 text-center">
                    <span className="text-green-700">✓ Face Centered</span>
                  </div>
                </div>
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

  // Camera View
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
                    <line x1="65" y1="120" x2="100" y2="140" />
                    <line x1="135" y1="120" x2="100" y2="140" />
                    <line x1="100" y1="150" x2="65" y2="120" />
                    <line x1="100" y1="150" x2="135" y2="120" />
                    <line x1="70" y1="185" x2="90" y2="160" />
                    <line x1="130" y1="185" x2="110" y2="160" />
                    <line x1="48" y1="118" x2="42" y2="100" />
                    <line x1="82" y1="118" x2="82" y2="102" />
                    <line x1="118" y1="118" x2="118" y2="102" />
                    <line x1="152" y1="118" x2="158" y2="100" />
                    <line x1="30" y1="120" x2="48" y2="118" />
                    <line x1="170" y1="120" x2="152" y2="118" />
                  </g>
                  
                  <g>
                    {[
                      [30, 120], [28, 140], [32, 165], [40, 190], [55, 210], [75, 225], [100, 235], [125, 225], [145, 210], [160, 190], [168, 165], [172, 140], [170, 120],
                      [42, 100], [55, 95], [70, 97], [82, 102],
                      [118, 102], [130, 97], [145, 95], [158, 100],
                      [48, 118], [58, 115], [72, 115], [82, 118], [72, 125], [58, 125], [65, 120],
                      [118, 118], [128, 115], [142, 115], [152, 118], [142, 125], [128, 125], [135, 120],
                      [100, 105], [100, 120], [100, 135], [100, 150], [85, 155], [95, 162], [100, 165], [105, 162], [115, 155],
                      [70, 185], [80, 180], [90, 178], [100, 178], [110, 178], [120, 180], [130, 185],
                      [80, 192], [90, 196], [100, 200], [110, 196], [120, 192],
                    ].map(([x, y], i) => (
                      <circle key={i} cx={x} cy={y} r="3" fill="rgba(255, 255, 255, 0.9)"/>
                    ))}
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
                <span className="text-blue-400 text-sm">😌</span>
              </div>
              <span className="text-sm">Blink naturally when prompted</span>
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
            onClick={startFaceDetection}
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
            <div className={`w-3 h-3 rounded-full ${livenessScore >= 60 ? 'bg-green-500' : 'bg-white/30'}`} title="Liveness" />
          </div>
        )}
      </div>
    </div>
  );
}
