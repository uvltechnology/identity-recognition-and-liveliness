import { useState, useEffect, useRef, useCallback } from 'react';
import * as faceapi from 'face-api.js';

const MOVEMENT_THRESHOLD = 8;
const LIVENESS_REQUIRED_SCORE = 70;
const CENTER_TOLERANCE = 0.20;
const REQUIRED_CENTERED_FRAMES = 10;
const MAX_FRAME_HISTORY = 30;
const MIN_FACE_CONFIDENCE = 0.5;

// Face size thresholds (relative to video dimensions)
const MIN_FACE_SIZE_RATIO = 0.25;  // Face should be at least 25% of video height
const MAX_FACE_SIZE_RATIO = 0.55;  // Face should be at most 55% of video height

// Anti-spoofing thresholds
const MIN_MICRO_MOVEMENT = 0.3;       // Lowered - real faces have subtle micro-movements
const MAX_STATIC_FRAMES = 15;         // Increased - allow more still frames before flagging
const HEAD_POSE_VARIANCE_MIN = 0.5;   // Lowered - natural head sway is subtle

// Expression-based liveness detection
const REQUIRED_EXPRESSIONS = ['happy', 'angry']; // Must show both expressions
const EXPRESSION_CONFIDENCE_THRESHOLD = 0.5; // Minimum confidence to count expression

export default function SelfieLivenessTest() {
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

  const [faceDetectionStarted, setFaceDetectionStarted] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [livenessScore, setLivenessScore] = useState(0);
  const [faceFeedback, setFaceFeedback] = useState('Press Start to begin');
  const [faceFeedbackType, setFaceFeedbackType] = useState('info');
  const [capturedFace, setCapturedFace] = useState(null);
  const [faceVerified, setFaceVerified] = useState(false);
  const [steadySeconds, setSteadySeconds] = useState(0);
  const [isCentered, setIsCentered] = useState(false);
  const [currentExpression, setCurrentExpression] = useState('');
  const [detectedExpressions, setDetectedExpressions] = useState([]);
  const [requiredExpression, setRequiredExpression] = useState(null);
  const [faceLandmarks, setFaceLandmarks] = useState(null);
  const [faceBox, setFaceBox] = useState(null);
  const overlayCanvasRef = useRef(null);
  
  // Consent & guide states
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

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

      // Try different camera configurations with fallbacks - lower resolution for performance
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
      
      // Reset anti-spoofing refs
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
      setRequiredExpression(REQUIRED_EXPRESSIONS[0]);
      setFaceFeedback('😊 Please SMILE at the camera');

      startLivenessDetection();
    } catch (err) {
      console.error('Camera error:', err);
      let errorMsg = err.message || 'Camera access failed';
      
      // Check if it's a permission or security issue
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

  // Handle start button flow: show consent -> guide -> start
  const handleStartClick = () => {
    if (!consentGiven) {
      setShowConsentModal(true);
      setFaceFeedback('Please provide consent to begin');
      setFaceFeedbackType('warning');
      return;
    }

    if (!showGuide) {
      setShowGuide(true);
      return;
    }

    // If consent already given and guide shown (or dismissed), start
    startFaceDetection();
  };

  const acceptConsent = () => {
    setConsentGiven(true);
    setShowConsentModal(false);
    // show guide right after consent
    setShowGuide(true);
    setFaceFeedback('Consent accepted — showing quick guide');
    setFaceFeedbackType('info');
  };

  const declineConsent = () => {
    setConsentGiven(false);
    setShowConsentModal(false);
    setFaceFeedback('Consent is required to perform face verification');
    setFaceFeedbackType('error');
  };

  const proceedFromGuide = () => {
    setShowGuide(false);
    // start detection after the guide
    startFaceDetection();
  };

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
    }, 250); // Reduced frequency for better performance
  };

  const analyzeLiveness = async () => {
    const video = faceVideoRef.current;
    if (!video || video.readyState < 2) return;

    try {
      const detections = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ 
          scoreThreshold: MIN_FACE_CONFIDENCE,
          inputSize: 224  // Smaller input size for faster processing
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
      
      // Store landmarks and box for drawing
      setFaceBox(box);
      setFaceLandmarks(landmarks);
      // Only draw landmarks when progress has started
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

      // Check face size (distance from camera)
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

      // === ANTI-SPOOFING: Micro-movement detection ===
      // Real faces have natural micro-movements; photos are unnaturally still
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

      // Track static frames (no micro-movement = likely photo)
      if (microMovement < MIN_MICRO_MOVEMENT && microMovement > 0) {
        staticFrameCountRef.current++;
      } else {
        staticFrameCountRef.current = Math.max(0, staticFrameCountRef.current - 1);
      }

      // === ANTI-SPOOFING: Head pose variation ===
      // Calculate head pose from landmarks (nose tip vs face center)
      const noseTip = landmarks.getNose()[3];
      const leftEye = landmarks.getLeftEye();
      const rightEye = landmarks.getRightEye();
      const eyeCenterX = (leftEye[0].x + rightEye[3].x) / 2;
      const eyeCenterY = (leftEye[0].y + rightEye[3].y) / 2;
      const headPoseX = noseTip.x - eyeCenterX;
      const headPoseY = noseTip.y - eyeCenterY;
      
      headPoseHistoryRef.current.push({ x: headPoseX, y: headPoseY });
      if (headPoseHistoryRef.current.length > 15) headPoseHistoryRef.current.shift();

      // Calculate head pose variance (photos have very low variance)
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

      // === ANTI-SPOOFING: Check for photo/spoof indicators ===
      const isTooStatic = staticFrameCountRef.current > MAX_STATIC_FRAMES;
      const hasNoHeadMovement = headPoseHistoryRef.current.length >= 10 && headPoseVariance < HEAD_POSE_VARIANCE_MIN;
      
      // Only flag as spoof if BOTH conditions are met AND expressions not completed
      const potentialSpoof = (isTooStatic && hasNoHeadMovement) && !allExpressionsCompleted;
      
      // Penalize score for spoof indicators
      if (potentialSpoof && !allExpressionsCompleted) {
        indicators = Math.max(0, indicators - 1);
        spoofDetectedRef.current = true;
      } else if (allExpressionsCompleted || microMovement > MIN_MICRO_MOVEMENT) {
        spoofDetectedRef.current = false;
      }

      if (faceIsCentered) centeredFrameCountRef.current++;
      else centeredFrameCountRef.current = 0;

      const frameScore = (indicators / 6) * 100; // Updated divisor
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

    // Scale factors for canvas
    const scaleX = canvas.width / video.videoWidth;
    const scaleY = canvas.height / video.videoHeight;

    // Get all 68 landmark points
    const points = landmarks.positions;
    
    // Scale all points
    const scaledPoints = points.map(p => ({
      x: p.x * scaleX,
      y: p.y * scaleY
    }));

    // Define mesh connections (triangulation for face mesh effect)
    const meshConnections = [
      // Forehead/eyebrow connections
      [17, 18], [18, 19], [19, 20], [20, 21],
      [22, 23], [23, 24], [24, 25], [25, 26],
      // Eyebrow to eye connections
      [17, 36], [18, 36], [18, 37], [19, 37], [19, 38], [20, 38], [20, 39], [21, 39],
      [22, 42], [23, 42], [23, 43], [24, 43], [24, 44], [25, 44], [25, 45], [26, 45],
      // Cross eyebrow connections
      [17, 21], [22, 26],
      [19, 21], [22, 24],
      // Left eye
      [36, 37], [37, 38], [38, 39], [39, 40], [40, 41], [41, 36],
      [36, 39], [37, 40], [38, 41],
      // Right eye
      [42, 43], [43, 44], [44, 45], [45, 46], [46, 47], [47, 42],
      [42, 45], [43, 46], [44, 47],
      // Nose bridge
      [27, 28], [28, 29], [29, 30],
      // Nose bottom
      [30, 31], [30, 35], [31, 32], [32, 33], [33, 34], [34, 35],
      [31, 33], [33, 35],
      // Nose to eye connections
      [27, 21], [27, 22], [27, 39], [27, 42],
      [28, 39], [28, 42],
      [29, 31], [29, 35],
      // Eye to nose connections
      [39, 27], [42, 27],
      [40, 29], [47, 29],
      [41, 31], [46, 35],
      // Jaw outline
      [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8],
      [8, 9], [9, 10], [10, 11], [11, 12], [12, 13], [13, 14], [14, 15], [15, 16],
      // Jaw to face connections
      [0, 17], [1, 36], [2, 41], [3, 31],
      [16, 26], [15, 45], [14, 46], [13, 35],
      [4, 48], [5, 48], [6, 59],
      [12, 54], [11, 54], [10, 55],
      [7, 58], [8, 57], [9, 56],
      // Outer mouth
      [48, 49], [49, 50], [50, 51], [51, 52], [52, 53], [53, 54],
      [54, 55], [55, 56], [56, 57], [57, 58], [58, 59], [59, 48],
      // Inner mouth
      [60, 61], [61, 62], [62, 63], [63, 64], [64, 65], [65, 66], [66, 67], [67, 60],
      // Mouth connections
      [48, 60], [51, 62], [54, 64], [57, 66],
      [49, 61], [50, 62], [52, 63], [53, 64],
      [55, 65], [56, 66], [58, 67], [59, 60],
      // Nose to mouth
      [31, 48], [32, 49], [33, 51], [34, 53], [35, 54],
      // Cross face connections for mesh effect
      [36, 41], [42, 47],
      [31, 41], [35, 46],
      [30, 33], [27, 30],
      // Forehead mesh
      [17, 19], [19, 21], [22, 24], [24, 26],
      [18, 20], [23, 25],
      // Upper face cross connections
      [21, 27], [22, 27],
      [17, 0], [26, 16],
    ];

    // Single color theme - white
    const lineColor = 'rgba(255, 255, 255, 0.5)';
    const dotColor = 'rgba(255, 255, 255, 0.9)';

    // Draw mesh lines - single color
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

    // Draw all landmark dots
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

    // Final face verification before capture
    setFaceFeedback('🔍 Final checking, hold on...');
    setFaceFeedbackType('info');
    
    try {
      const finalDetection = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: MIN_FACE_CONFIDENCE }))
        .withFaceLandmarks();

      if (!finalDetection) {
        setFaceFeedback('⚠️ Face lost! Look at the camera');
        setFaceFeedbackType('warning');
        // Reset centered frames to require re-centering
        centeredFrameCountRef.current = 0;
        return;
      }

      // Verify face is still centered
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

      // All checks passed - capture!
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
    } catch (err) {
      console.error('Final capture check error:', err);
      setFaceFeedback('⚠️ Verification failed, try again');
      setFaceFeedbackType('error');
      centeredFrameCountRef.current = 0;
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

  // Results View
  if (faceVerified && capturedFace) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-md">
            {/* Success Icon */}
            <div className="text-center mb-6">
              <div className="w-20 h-20 mx-auto bg-green-500 rounded-full flex items-center justify-center mb-4 shadow-lg">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Verification Complete</h1>
              <p className="text-gray-600 mt-1">Live person verified successfully</p>
            </div>

            {/* Captured Image */}
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
              <img src={capturedFace} alt="Verified selfie" className="w-full aspect-[4/3] object-cover" />
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

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={downloadFace}
                className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Selfie
              </button>
              <a
                href="/id-verification-test"
                className="block w-full py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition text-center"
              >
                Continue to ID Verification →
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Camera View (Full Page)
  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      {/* Show gradient background when camera not started */}
      {!faceDetectionStarted && (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900" />
      )}
      
      {/* Top Header */}
      <div className="relative z-20 px-4 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <a href="/" className="p-2 bg-white/20 backdrop-blur rounded-full">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </a>
          {modelsLoaded && (
            <div className="px-3 py-1 bg-green-500/80 backdrop-blur rounded-full text-white text-xs font-medium">
              AI Ready
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative flex flex-col">
        {/* Camera Video (hidden when not started) */}
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

        {/* Blur overlay outside oval - only show when progress starts */}
        {faceDetectionStarted && livenessScore > 0 && (
          <div 
            className="absolute inset-0 backdrop-blur-md bg-black/40 pointer-events-none"
            style={{
              WebkitMaskImage: 'radial-gradient(ellipse 104px 144px at center, transparent 100%, black 100%)',
              maskImage: 'radial-gradient(ellipse 104px 144px at center, transparent 100%, black 100%)',
            }}
          />
        )}

        {/* Top/Bottom gradients when camera is active */}
        {faceDetectionStarted && (
          <>
            <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
          </>
        )}

        {/* Title (onboarding only) */}
        {!faceDetectionStarted && (
          <div className="relative z-10 text-center pt-2 pb-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Face Verification</h1>
            <p className="text-white/60 text-sm sm:text-base px-8">Position your face in the oval and follow the instructions</p>
          </div>
        )}

        {/* Centered Oval Area */}
        <div className="flex-1 flex items-center justify-center relative">
          <div className="relative">
            {/* Background oval */}
            <div
              className={`w-52 h-72 sm:w-60 sm:h-80 rounded-[50%] border-4 transition-all duration-300 ${
                faceVerified
                  ? 'border-transparent'
                  : faceDetectionStarted
                  ? 'border-dashed border-white/30'
                  : 'border-solid border-white/20'
              }`}
            />
            
            {/* Sample face mesh for onboarding (show when not started) */}
            {!faceDetectionStarted && (
              <div className="absolute inset-0 flex items-center justify-center">
                <svg 
                  viewBox="0 0 200 280" 
                  className="w-44 h-60 sm:w-52 sm:h-72"
                >
                  {/* Mesh lines - white color */}
                  <g stroke="rgba(255, 255, 255, 0.5)" strokeWidth="1" fill="none">
                    {/* Jaw outline */}
                    <path d="M30 120 Q25 160 35 195 Q50 220 100 235 Q150 220 165 195 Q175 160 170 120" />
                    {/* Left eyebrow */}
                    <path d="M42 100 L55 95 L70 97 L82 102" />
                    {/* Right eyebrow */}
                    <path d="M118 102 L130 97 L145 95 L158 100" />
                    {/* Left eye */}
                    <path d="M48 118 L58 115 L72 115 L82 118 L72 125 L58 125 Z" />
                    {/* Right eye */}
                    <path d="M118 118 L128 115 L142 115 L152 118 L142 125 L128 125 Z" />
                    {/* Nose */}
                    <path d="M100 105 L100 150" />
                    <path d="M85 155 L95 162 L100 165 L105 162 L115 155" />
                    {/* Mouth */}
                    <path d="M70 185 Q85 178 100 178 Q115 178 130 185" />
                    <path d="M70 185 Q85 198 100 200 Q115 198 130 185" />
                    {/* Cross mesh lines */}
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
                  
                  {/* Landmark dots - white color */}
                  <g>
                    {[
                      // Jaw
                      [30, 120], [28, 140], [32, 165], [40, 190], [55, 210], [75, 225], [100, 235], [125, 225], [145, 210], [160, 190], [168, 165], [172, 140], [170, 120],
                      // Left eyebrow
                      [42, 100], [55, 95], [70, 97], [82, 102],
                      // Right eyebrow  
                      [118, 102], [130, 97], [145, 95], [158, 100],
                      // Left eye
                      [48, 118], [58, 115], [72, 115], [82, 118], [72, 125], [58, 125], [65, 120],
                      // Right eye
                      [118, 118], [128, 115], [142, 115], [152, 118], [142, 125], [128, 125], [135, 120],
                      // Nose
                      [100, 105], [100, 120], [100, 135], [100, 150], [85, 155], [95, 162], [100, 165], [105, 162], [115, 155],
                      // Mouth
                      [70, 185], [80, 180], [90, 178], [100, 178], [110, 178], [120, 180], [130, 185],
                      [80, 192], [90, 196], [100, 200], [110, 196], [120, 192],
                    ].map(([x, y], i) => (
                      <circle key={i} cx={x} cy={y} r="3" fill="rgba(255, 255, 255, 0.9)"/>
                    ))}
                  </g>
                </svg>
              </div>
            )}
            
            {/* Pulsing glow effect for onboarding */}
            {!faceDetectionStarted && (
              <div 
                className="absolute inset-0 w-52 h-72 sm:w-60 sm:h-80 rounded-[50%] animate-pulse"
                style={{
                  boxShadow: '0 0 40px rgba(59, 130, 246, 0.3), inset 0 0 40px rgba(59, 130, 246, 0.1)',
                }}
              />
            )}
            
            {/* Progress overlay oval using conic gradient */}
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
            
            {/* Success glow overlay */}
            {faceVerified && (
              <div className="absolute inset-0 w-52 h-72 sm:w-60 sm:h-80 rounded-[50%] border-4 border-green-500 shadow-[0_0_40px_rgba(34,197,94,0.5)]" />
            )}
            
            {/* Expression label below oval */}
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

      {/* Bottom Controls */}
      <div className="relative z-10 px-6 pb-6 pt-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
        {/* Onboarding instructions (show when not started) */}
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
        
        {/* Feedback (show when started) */}
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

        {/* Button */}
        {!faceDetectionStarted && (
          <button
            onClick={handleStartClick}
            disabled={!modelsLoaded}
            className="w-full py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold text-lg rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed hover:from-blue-600 hover:to-blue-700 transition shadow-lg shadow-blue-500/30"
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

        {/* Indicators (show when started) */}
        {faceDetectionStarted && (
          <div className="flex justify-center gap-3 mt-4">
            <div className={`w-3 h-3 rounded-full ${isCentered ? 'bg-green-500' : 'bg-white/30'}`} title="Centered" />
            <div className={`w-3 h-3 rounded-full ${detectedExpressions.includes('happy') ? 'bg-green-500' : 'bg-white/30'}`} title="Smile 😊" />
            <div className={`w-3 h-3 rounded-full ${detectedExpressions.includes('angry') ? 'bg-green-500' : 'bg-white/30'}`} title="Angry 😠" />
            <div className={`w-3 h-3 rounded-full ${livenessScore >= 60 ? 'bg-green-500' : 'bg-white/30'}`} title="Liveness" />
          </div>
        )}
      </div>
      
      {/* Consent Modal */}
      {showConsentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-w-md w-full bg-white rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-2">Consent to Face Scan</h2>
            <p className="text-sm text-gray-700 mb-4">We will use your camera to capture a short live selfie to verify liveness. By accepting, you consent to temporary capture of an image for verification.</p>
            <div className="flex gap-3 mt-4">
              <button onClick={acceptConsent} className="flex-1 py-3 bg-blue-600 text-white rounded-xl">I Consent</button>
              <button onClick={declineConsent} className="flex-1 py-3 bg-gray-200 rounded-xl">Decline</button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Guide Overlay (shown after consent) */}
      {showGuide && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6">
          <div role="dialog" aria-modal="true" className="max-w-lg w-full bg-white rounded-2xl p-6 shadow-2xl pointer-events-auto">
            <h3 className="text-xl font-semibold mb-2">Quick Guide</h3>
            <ul className="text-sm text-gray-700 space-y-2 mb-4">
              <li>• Position your face in the center oval.</li>
              <li>• Ensure good lighting and remove glasses if possible.</li>
              <li>• Blink naturally when prompted; avoid sudden movements.</li>
              <li>• Hold steady for a few seconds while we check liveness.</li>
            </ul>
            <div className="flex gap-3">
              <button onClick={proceedFromGuide} className="flex-1 py-3 bg-green-600 text-white rounded-xl">Proceed to Scan</button>
              <button onClick={() => setShowGuide(false)} className="flex-1 py-3 bg-gray-200 rounded-xl">Skip</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
