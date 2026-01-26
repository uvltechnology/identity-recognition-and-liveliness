import { useState, useEffect, useRef, useCallback } from 'react';
import * as faceapi from 'face-api.js';

const MOVEMENT_THRESHOLD = 8;
const LIVENESS_REQUIRED_SCORE = 70;
const CENTER_TOLERANCE = 0.20;
const REQUIRED_CENTERED_FRAMES = 20;
const MAX_FRAME_HISTORY = 30;
const MIN_FACE_CONFIDENCE = 0.5;

// Face size thresholds (relative to video dimensions)
const MIN_FACE_SIZE_RATIO = 0.25;  // Face should be at least 25% of video height
const MAX_FACE_SIZE_RATIO = 0.55;  // Face should be at most 55% of video height

// Anti-spoofing thresholds
const MIN_MICRO_MOVEMENT = 0.5;       // Minimum natural micro-movements (real faces are never perfectly still)
const MAX_STATIC_FRAMES = 8;          // Max frames without micro-movement before flagging as photo
const REQUIRED_BLINKS = 1;            // Require 1 blink
const HEAD_POSE_VARIANCE_MIN = 2;     // Minimum head pose variance (photos are too stable)

export default function SelfieLivenessTest() {
  const faceVideoRef = useRef(null);
  const faceCanvasRef = useRef(null);
  const faceStreamRef = useRef(null);
  const faceDetectionIntervalRef = useRef(null);
  const frameHistoryRef = useRef([]);
  const lastFacePositionRef = useRef(null);
  const centeredFrameCountRef = useRef(0);
  const blinkDetectedRef = useRef(false);
  const expressionChangeRef = useRef(false);
  const livenessScoreRef = useRef(0);
  const isRunningRef = useRef(false);
  const modelsLoadedRef = useRef(false);
  
  // Anti-spoofing refs
  const blinkCountRef = useRef(0);
  const staticFrameCountRef = useRef(0);
  const lastLandmarksRef = useRef(null);
  const headPoseHistoryRef = useRef([]);
  const spoofDetectedRef = useRef(false);
  const eyesClosedRef = useRef(false);  // Track if eyes are currently closed

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
  const [faceLandmarks, setFaceLandmarks] = useState(null);
  const [faceBox, setFaceBox] = useState(null);
  const overlayCanvasRef = useRef(null);

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
      blinkDetectedRef.current = false;
      expressionChangeRef.current = false;
      livenessScoreRef.current = 0;
      isRunningRef.current = true;
      
      // Reset anti-spoofing refs
      blinkCountRef.current = 0;
      staticFrameCountRef.current = 0;
      lastLandmarksRef.current = null;
      headPoseHistoryRef.current = [];
      spoofDetectedRef.current = false;
      eyesClosedRef.current = false;

      setFaceDetectionStarted(true);
      setLivenessScore(0);
      setCapturedFace(null);
      setFaceVerified(false);
      setIsCentered(false);
      setCurrentExpression('');
      setFaceFeedback('👀 Look at the camera and blink');

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

      if (frameHistoryRef.current.length >= 5) {
        const eyeRatios = frameHistoryRef.current.slice(-10).map(f => f.eyeRatio);
        const eyeVariance = Math.max(...eyeRatios) - Math.min(...eyeRatios);
        
        // === ANTI-SPOOFING: Improved blink detection with counting ===
        // More lenient thresholds for easier blink detection
        const EYE_CLOSED_THRESHOLD = 0.24;  // Higher = easier to detect as closed
        const EYE_OPEN_THRESHOLD = 0.26;    // Lower gap = easier transition
        
        // Also detect blink from eye ratio variance (backup method)
        if (eyeVariance > 0.04 && !blinkDetectedRef.current) {
          // Significant eye ratio change detected - count as blink
          blinkCountRef.current++;
          console.log('Blink detected via variance! Count:', blinkCountRef.current, 'Variance:', eyeVariance);
          if (blinkCountRef.current >= REQUIRED_BLINKS) {
            blinkDetectedRef.current = true;
          }
        }
        
        // State machine method (primary)
        if (avgEyeRatio < EYE_CLOSED_THRESHOLD && !eyesClosedRef.current) {
          // Eyes just closed
          eyesClosedRef.current = true;
          console.log('Eyes closed detected, ratio:', avgEyeRatio);
        } else if (avgEyeRatio > EYE_OPEN_THRESHOLD && eyesClosedRef.current) {
          // Eyes just opened after being closed = blink complete
          eyesClosedRef.current = false;
          blinkCountRef.current++;
          console.log('Blink detected via state! Count:', blinkCountRef.current, 'Ratio:', avgEyeRatio);
          if (blinkCountRef.current >= REQUIRED_BLINKS) {
            blinkDetectedRef.current = true;
          }
        }
        
        const exprs = new Set(frameHistoryRef.current.slice(-10).map(f => f.expression));
        if (exprs.size >= 2) expressionChangeRef.current = true;
        const xPos = frameHistoryRef.current.slice(-10).map(f => f.faceCenterX);
        const mean = xPos.reduce((a, b) => a + b, 0) / xPos.length;
        const variance = xPos.reduce((s, x) => s + Math.pow(x - mean, 2), 0) / xPos.length;
        if (variance > 5) indicators++;
      }
      if (blinkDetectedRef.current) indicators++;
      if (expressionChangeRef.current) indicators++;

      // === ANTI-SPOOFING: Check for photo/spoof indicators ===
      const isTooStatic = staticFrameCountRef.current > MAX_STATIC_FRAMES;
      const hasNoHeadMovement = headPoseHistoryRef.current.length >= 10 && headPoseVariance < HEAD_POSE_VARIANCE_MIN;
      const potentialSpoof = isTooStatic || hasNoHeadMovement;
      
      // Penalize score for spoof indicators
      if (potentialSpoof) {
        indicators = Math.max(0, indicators - 2);
        spoofDetectedRef.current = true;
      } else if (microMovement > MIN_MICRO_MOVEMENT) {
        spoofDetectedRef.current = false;
      }

      if (faceIsCentered) centeredFrameCountRef.current++;
      else centeredFrameCountRef.current = 0;

      const frameScore = (indicators / 5) * 100;
      livenessScoreRef.current = livenessScoreRef.current * 0.7 + frameScore * 0.3;
      const score = Math.round(livenessScoreRef.current);
      setLivenessScore(score);

      const remaining = Math.max(0, Math.ceil((REQUIRED_CENTERED_FRAMES - centeredFrameCountRef.current) * 0.2));
      setSteadySeconds(remaining);

      if (!faceIsCentered) {
        // Mirror-corrected directions (camera is mirrored, so left/right are flipped)
        const moveHorizontal = offsetX >= CENTER_TOLERANCE;
        const moveVertical = offsetY >= CENTER_TOLERANCE;
        
        if (moveHorizontal && moveVertical) {
          // Need to move both directions
          const hDir = faceCenterX < videoCenterX ? '→ Move right' : '← Move left';
          const vDir = faceCenterY < videoCenterY ? '↓ Move down' : '↑ Move up';
          setFaceFeedback(`${hDir} and ${vDir}`);
        } else if (moveHorizontal) {
          // Inverted for mirror view: if face is on left of video, user needs to move right
          setFaceFeedback(faceCenterX < videoCenterX ? '→ Move right' : '← Move left');
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
        // Anti-spoofing feedback
        if (staticFrameCountRef.current > MAX_STATIC_FRAMES) {
          setFaceFeedback('🚫 Move your head slightly');
        } else {
          setFaceFeedback('🚫 Please use a real face, not a photo');
        }
        setFaceFeedbackType('error');
      } else if (blinkCountRef.current < REQUIRED_BLINKS) {
        setFaceFeedback(`👁️ Blink ${REQUIRED_BLINKS - blinkCountRef.current} more time${REQUIRED_BLINKS - blinkCountRef.current > 1 ? 's' : ''}`);
        setFaceFeedbackType('info');
      } else if (score < LIVENESS_REQUIRED_SCORE) {
        setFaceFeedback('🔄 Keep looking at the camera...');
        setFaceFeedbackType('info');
      } else if (centeredFrameCountRef.current >= REQUIRED_CENTERED_FRAMES && blinkDetectedRef.current && !spoofDetectedRef.current && faceIsProperSize) {
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

    // Draw mesh lines - batch all lines in single path for performance
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    meshConnections.forEach(([i, j]) => {
      if (scaledPoints[i] && scaledPoints[j]) {
        ctx.moveTo(scaledPoints[i].x, scaledPoints[i].y);
        ctx.lineTo(scaledPoints[j].x, scaledPoints[j].y);
      }
    });
    ctx.stroke();

    // Draw all landmark points as dots - grouped by color for performance
    const drawPointGroup = (indices, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      indices.forEach(i => {
        if (scaledPoints[i]) {
          ctx.moveTo(scaledPoints[i].x + 2.5, scaledPoints[i].y);
          ctx.arc(scaledPoints[i].x, scaledPoints[i].y, 2.5, 0, 2 * Math.PI);
        }
      });
      ctx.fill();
    };

    // Eyes - cyan
    drawPointGroup([36,37,38,39,40,41,42,43,44,45,46,47], 'rgba(0, 255, 255, 0.9)');
    // Nose - light green  
    drawPointGroup([27,28,29,30,31,32,33,34,35], 'rgba(150, 255, 200, 0.9)');
    // Mouth - light pink
    drawPointGroup([48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67], 'rgba(255, 200, 220, 0.9)');
    // Eyebrows - yellow
    drawPointGroup([17,18,19,20,21,22,23,24,25,26], 'rgba(255, 255, 150, 0.9)');
    // Jaw and other - white
    drawPointGroup([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16], 'rgba(255, 255, 255, 0.8)');

    // Draw horizontal scan line effect (like in the image)
    const scanLineY = scaledPoints[27] ? scaledPoints[27].y : canvas.height / 2;
    const gradient = ctx.createLinearGradient(0, scanLineY, canvas.width, scanLineY);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.3)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
    gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.3)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(scaledPoints[0] ? scaledPoints[0].x - 20 : 0, scanLineY);
    ctx.lineTo(scaledPoints[16] ? scaledPoints[16].x + 20 : canvas.width, scanLineY);
    ctx.stroke();
  };

  const performCapture = async () => {
    if (!isRunningRef.current) return;
    
    const video = faceVideoRef.current;
    const canvas = faceCanvasRef.current;
    if (!canvas || !video) return;

    // Final face verification before capture
    setFaceFeedback('� Final checking, hold on...');
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

      // All checks passed - capture!
      isRunningRef.current = false;
      if (faceDetectionIntervalRef.current) {
        clearInterval(faceDetectionIntervalRef.current);
        faceDetectionIntervalRef.current = null;
      }

      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);

      setCapturedFace(imageDataUrl);
      setFaceVerified(true);
      setFaceFeedback('✅ Verified!');
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
    setFaceLandmarks(null);
    setFaceBox(null);
    blinkDetectedRef.current = false;
    expressionChangeRef.current = false;
    blinkCountRef.current = 0;
    staticFrameCountRef.current = 0;
    lastLandmarksRef.current = null;
    headPoseHistoryRef.current = [];
    spoofDetectedRef.current = false;
    eyesClosedRef.current = false;
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
              <button
                onClick={resetAll}
                className="w-full py-3 bg-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-300 transition"
              >
                Start Over
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Camera View (Full Page)
  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      {/* Camera */}
      <div className="flex-1 relative">
        <video
          ref={faceVideoRef}
          autoPlay
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
        <canvas ref={faceCanvasRef} className="hidden" />
        <canvas 
          ref={overlayCanvasRef} 
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        />

        {/* Overlay */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Blur overlay outside oval - only show when progress starts */}
          {faceDetectionStarted && livenessScore > 0 && (
            <div 
              className="absolute inset-0 backdrop-blur-md bg-black/40"
              style={{
                WebkitMaskImage: 'radial-gradient(ellipse 104px 144px at center, transparent 100%, black 100%)',
                maskImage: 'radial-gradient(ellipse 104px 144px at center, transparent 100%, black 100%)',
              }}
            />
          )}

          {/* Top gradient */}
          <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/60 to-transparent" />
          
          {/* Bottom gradient */}
          <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black/80 to-transparent" />

          {/* Face guide oval with progress border */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              {/* Background dashed oval */}
              <div
                className={`w-52 h-72 sm:w-60 sm:h-80 rounded-[50%] border-4 border-dashed transition-all duration-300 ${
                  faceVerified
                    ? 'border-transparent'
                    : 'border-white/30'
                }`}
              />
              {/* Progress overlay oval using conic gradient */}
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

          {/* Top info */}
          <div className="absolute top-4 left-4 right-4 pointer-events-auto">
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
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="relative z-10 px-6 pb-8 pt-4">
        {/* Feedback */}
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

        {/* Button */}
        {!faceDetectionStarted && (
          <button
            onClick={startFaceDetection}
            disabled={!modelsLoaded}
            className="w-full py-4 bg-white text-black font-bold text-lg rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition"
          >
            {!modelsLoaded ? 'Loading AI...' : 'Start Verification'}
          </button>
        )}

        {/* Indicators */}
        {faceDetectionStarted && (
          <div className="flex justify-center gap-3 mt-4">
            <div className={`w-3 h-3 rounded-full ${isCentered ? 'bg-green-500' : 'bg-white/30'}`} title="Centered" />
            <div className={`w-3 h-3 rounded-full ${blinkDetectedRef.current ? 'bg-green-500' : 'bg-white/30'}`} title="Blink" />
            <div className={`w-3 h-3 rounded-full ${expressionChangeRef.current ? 'bg-green-500' : 'bg-white/30'}`} title="Expression" />
            <div className={`w-3 h-3 rounded-full ${livenessScore >= 60 ? 'bg-green-500' : 'bg-white/30'}`} title="Liveness" />
          </div>
        )}
      </div>
    </div>
  );
}
