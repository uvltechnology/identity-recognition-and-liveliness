import { useState, useEffect, useRef, useCallback } from 'react';
import * as faceapi from 'face-api.js';

const ID_TYPES = [
  { id: 'national-id', name: 'Philippine National ID' },
  { id: 'passport', name: 'Passport' },
  { id: 'driver-license', name: "Driver's License" },
  { id: 'umid', name: 'UMID' },
  { id: 'philhealth', name: 'PhilHealth' },
  { id: 'tin-id', name: 'TIN ID' },
  { id: 'postal-id', name: 'Postal ID' },
  { id: 'pagibig', name: 'Pag-IBIG' },
];

// Liveness detection constants
const MOVEMENT_THRESHOLD = 8;
const LIVENESS_REQUIRED_SCORE = 60;
const CENTER_TOLERANCE = 0.20;
const REQUIRED_CENTERED_FRAMES = 15; // 3 seconds at 200ms interval
const MAX_FRAME_HISTORY = 20;
const MIN_FACE_CONFIDENCE = 0.5;

export default function IDVerificationTest() {
  // ==================== FACE DETECTION STATE ====================
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

  const [faceDetectionStarted, setFaceDetectionStarted] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [livenessScore, setLivenessScore] = useState(0);
  const [faceStatus, setFaceStatus] = useState('Not Started');
  const [faceStatusType, setFaceStatusType] = useState('idle');
  const [faceFeedback, setFaceFeedback] = useState('Press Start button to begin');
  const [faceFeedbackType, setFaceFeedbackType] = useState('info');
  const [capturedFace, setCapturedFace] = useState(null);
  const [faceVerified, setFaceVerified] = useState(false);
  const [steadySeconds, setSteadySeconds] = useState(0);
  const [isCentered, setIsCentered] = useState(false);
  const [currentExpression, setCurrentExpression] = useState('');

  // ==================== ID SCANNING STATE ====================
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const alignmentCheckRef = useRef(null);
  const captureTimeoutRef = useRef(null);
  const cameraStartedRef = useRef(false);

  const [cameraStarted, setCameraStarted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [idType, setIdType] = useState('national-id');
  const [feedbackMessage, setFeedbackMessage] = useState('Complete face verification first');
  const [feedbackType, setFeedbackType] = useState('info');
  const [ocrRawText, setOcrRawText] = useState('');
  const [aiResults, setAiResults] = useState(null);
  const [autoCapture, setAutoCapture] = useState(true);

  // Editable form fields
  const [formData, setFormData] = useState({
    idNumber: '',
    lastName: '',
    firstName: '',
    middleName: '',
    birthDate: '',
    address: '',
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopFaceDetection();
      stopCamera();
    };
  }, []);

  // Load face-api.js models on mount
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
        setFaceFeedback('Press Start button to begin');
        console.log('Face-api.js models loaded successfully');
      } catch (err) {
        console.error('Error loading face-api models:', err);
        setFaceFeedback('Failed to load AI models');
        setFaceFeedbackType('error');
      }
    };
    
    loadModels();
  }, []);

  // ==================== FACE DETECTION ====================
  const startFaceDetection = async () => {
    if (!modelsLoadedRef.current) {
      setFaceFeedback('AI models not loaded yet. Please wait...');
      setFaceFeedbackType('warning');
      return;
    }

    try {
      setFaceFeedback('Starting camera...');
      setFaceFeedbackType('info');
      setFaceStatus('Starting...');
      setFaceStatusType('detecting');

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not available. Please use HTTPS or localhost.');
      }

      const constraints = {
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      faceStreamRef.current = mediaStream;

      if (faceVideoRef.current) {
        faceVideoRef.current.srcObject = mediaStream;
        await new Promise((resolve) => {
          faceVideoRef.current.onloadedmetadata = () => {
            faceVideoRef.current.play();
            resolve();
          };
        });

        // Set canvas size to match video
        if (faceCanvasRef.current) {
          faceCanvasRef.current.width = faceVideoRef.current.videoWidth;
          faceCanvasRef.current.height = faceVideoRef.current.videoHeight;
        }
      }

      // Reset all state
      frameHistoryRef.current = [];
      lastFacePositionRef.current = null;
      centeredFrameCountRef.current = 0;
      blinkDetectedRef.current = false;
      expressionChangeRef.current = false;
      livenessScoreRef.current = 0;
      isRunningRef.current = true;

      setFaceDetectionStarted(true);
      setLivenessScore(0);
      setCapturedFace(null);
      setFaceVerified(false);
      setIsCentered(false);
      setCurrentExpression('');
      setFaceFeedback('Look at the camera and blink naturally');
      setFaceStatus('Detecting...');

      // Start face-api.js detection loop
      startLivenessDetection();
    } catch (err) {
      console.error('Face camera error:', err);
      setFaceFeedback('Failed to access camera: ' + err.message);
      setFaceFeedbackType('error');
      setFaceStatus('Error');
      setFaceStatusType('failed');
    }
  };

  const stopFaceDetection = useCallback(() => {
    isRunningRef.current = false;

    if (faceDetectionIntervalRef.current) {
      clearInterval(faceDetectionIntervalRef.current);
      faceDetectionIntervalRef.current = null;
    }

    const streamToStop = faceStreamRef.current;
    if (streamToStop) {
      streamToStop.getTracks().forEach((track) => {
        track.stop();
      });
      faceStreamRef.current = null;
    }

    if (faceVideoRef.current) {
      faceVideoRef.current.srcObject = null;
    }

    frameHistoryRef.current = [];
    livenessScoreRef.current = 0;
    centeredFrameCountRef.current = 0;
    setFaceDetectionStarted(false);
  }, []);

  const startLivenessDetection = () => {
    if (faceDetectionIntervalRef.current) {
      clearInterval(faceDetectionIntervalRef.current);
    }

    // Use face-api.js detection every 200ms
    faceDetectionIntervalRef.current = setInterval(async () => {
      if (!isRunningRef.current) return;
      await analyzeLivenessWithFaceAPI();
    }, 200);
  };

  const analyzeLivenessWithFaceAPI = async () => {
    const video = faceVideoRef.current;
    const canvas = faceCanvasRef.current;

    if (!video || !canvas || video.readyState < 2) return;

    try {
      // Detect face with landmarks and expressions
      const detections = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: MIN_FACE_CONFIDENCE }))
        .withFaceLandmarks()
        .withFaceExpressions();

      if (!detections) {
        setFaceFeedback('No face detected. Please face the camera.');
        setFaceFeedbackType('warning');
        livenessScoreRef.current = Math.max(0, livenessScoreRef.current - 5);
        setLivenessScore(Math.round(livenessScoreRef.current));
        setIsCentered(false);
        centeredFrameCountRef.current = 0;
        return;
      }

      const { detection, landmarks, expressions } = detections;
      const box = detection.box;

      // Get dominant expression
      const expressionEntries = Object.entries(expressions);
      const dominantExpression = expressionEntries.reduce((a, b) => a[1] > b[1] ? a : b);
      setCurrentExpression(dominantExpression[0]);

      // Calculate face center
      const faceCenterX = box.x + box.width / 2;
      const faceCenterY = box.y + box.height / 2;
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;

      // Check centering
      const videoCenterX = videoWidth / 2;
      const videoCenterY = videoHeight / 2;
      const offsetX = Math.abs(faceCenterX - videoCenterX) / videoWidth;
      const offsetY = Math.abs(faceCenterY - videoCenterY) / videoHeight;
      const isCenteredX = offsetX < CENTER_TOLERANCE;
      const isCenteredY = offsetY < CENTER_TOLERANCE;
      const faceIsCentered = isCenteredX && isCenteredY;

      setIsCentered(faceIsCentered);

      // Analyze movement
      let movement = 0;
      if (lastFacePositionRef.current) {
        const dx = Math.abs(faceCenterX - lastFacePositionRef.current.x);
        const dy = Math.abs(faceCenterY - lastFacePositionRef.current.y);
        const dSize = Math.abs(box.width - lastFacePositionRef.current.width);
        movement = dx + dy + dSize;
      }
      lastFacePositionRef.current = { x: faceCenterX, y: faceCenterY, width: box.width };

      // Detect blink using eye landmarks
      const leftEye = landmarks.getLeftEye();
      const rightEye = landmarks.getRightEye();
      const leftEyeAspectRatio = getEyeAspectRatio(leftEye);
      const rightEyeAspectRatio = getEyeAspectRatio(rightEye);
      const avgEyeRatio = (leftEyeAspectRatio + rightEyeAspectRatio) / 2;

      // Store frame data
      const frameData = {
        timestamp: Date.now(),
        faceCenterX,
        faceCenterY,
        faceWidth: box.width,
        eyeRatio: avgEyeRatio,
        expression: dominantExpression[0],
        confidence: detection.score
      };
      frameHistoryRef.current.push(frameData);
      if (frameHistoryRef.current.length > MAX_FRAME_HISTORY) {
        frameHistoryRef.current.shift();
      }

      // Calculate liveness indicators
      let livenessIndicators = 0;
      const totalIndicators = 5;

      // 1. Face detected with good confidence
      if (detection.score > MIN_FACE_CONFIDENCE) {
        livenessIndicators++;
      }

      // 2. Movement detected (natural micro-movements)
      if (movement > MOVEMENT_THRESHOLD) {
        livenessIndicators++;
      }

      // 3. Blink detection - check for eye closure
      if (frameHistoryRef.current.length >= 5) {
        const recentEyeRatios = frameHistoryRef.current.slice(-10).map(f => f.eyeRatio);
        const minRatio = Math.min(...recentEyeRatios);
        const maxRatio = Math.max(...recentEyeRatios);
        // Blink detected if there's significant variance (eyes open vs closed)
        if (maxRatio - minRatio > 0.05) {
          blinkDetectedRef.current = true;
        }
      }
      if (blinkDetectedRef.current) {
        livenessIndicators++;
      }

      // 4. Expression change detection
      if (frameHistoryRef.current.length >= 5) {
        const recentExpressions = frameHistoryRef.current.slice(-10).map(f => f.expression);
        const uniqueExpressions = new Set(recentExpressions);
        if (uniqueExpressions.size >= 2) {
          expressionChangeRef.current = true;
        }
      }
      if (expressionChangeRef.current) {
        livenessIndicators++;
      }

      // 5. Face is real (not too static - check position variance)
      if (frameHistoryRef.current.length >= 5) {
        const recentPositions = frameHistoryRef.current.slice(-10);
        const xPositions = recentPositions.map(f => f.faceCenterX);
        const mean = xPositions.reduce((a, b) => a + b, 0) / xPositions.length;
        const variance = xPositions.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / xPositions.length;
        // Real faces have micro-movements
        if (variance > 5) {
          livenessIndicators++;
        }
      }

      // Track centering
      if (faceIsCentered) {
        centeredFrameCountRef.current++;
      } else {
        centeredFrameCountRef.current = 0;
      }

      // Calculate score with smoothing
      const frameScore = (livenessIndicators / totalIndicators) * 100;
      livenessScoreRef.current = livenessScoreRef.current * 0.7 + frameScore * 0.3;
      const roundedScore = Math.round(livenessScoreRef.current);
      setLivenessScore(roundedScore);

      // Calculate seconds remaining
      const framesRemaining = REQUIRED_CENTERED_FRAMES - centeredFrameCountRef.current;
      const secondsRemaining = Math.ceil(framesRemaining * 0.2);
      setSteadySeconds(secondsRemaining > 0 ? secondsRemaining : 0);

      // Provide feedback
      if (!faceIsCentered) {
        let centeringMsg = 'Center your face in the circle';
        if (!isCenteredX) {
          centeringMsg = faceCenterX > videoCenterX ? 'Move your face to the left' : 'Move your face to the right';
        } else if (!isCenteredY) {
          centeringMsg = faceCenterY > videoCenterY ? 'Move your face up' : 'Move your face down';
        }
        setFaceFeedback(centeringMsg);
        setFaceFeedbackType('warning');
      } else if (!blinkDetectedRef.current) {
        setFaceFeedback('Please blink your eyes');
        setFaceFeedbackType('info');
      } else if (roundedScore < 40) {
        setFaceFeedback('Look at the camera and move slightly');
        setFaceFeedbackType('warning');
      } else if (roundedScore < LIVENESS_REQUIRED_SCORE) {
        setFaceFeedback('Hold still, verifying...');
        setFaceFeedbackType('info');
      } else {
        // Score is high enough
        if (centeredFrameCountRef.current >= REQUIRED_CENTERED_FRAMES) {
          setFaceFeedback('All checks passed! Capturing...');
          setFaceFeedbackType('success');

          // Auto-capture when all conditions met
          if (blinkDetectedRef.current) {
            performFaceCapture();
          }
        } else {
          setFaceFeedback(`Hold steady... ${secondsRemaining}s`);
          setFaceFeedbackType('success');
        }
      }
    } catch (err) {
      console.error('Face detection error:', err);
    }
  };

  // Calculate Eye Aspect Ratio for blink detection
  const getEyeAspectRatio = (eye) => {
    // eye is array of 6 points
    // EAR = (||p2-p6|| + ||p3-p5||) / (2 * ||p1-p4||)
    const p1 = eye[0];
    const p2 = eye[1];
    const p3 = eye[2];
    const p4 = eye[3];
    const p5 = eye[4];
    const p6 = eye[5];

    const vertical1 = Math.sqrt(Math.pow(p2.x - p6.x, 2) + Math.pow(p2.y - p6.y, 2));
    const vertical2 = Math.sqrt(Math.pow(p3.x - p5.x, 2) + Math.pow(p3.y - p5.y, 2));
    const horizontal = Math.sqrt(Math.pow(p1.x - p4.x, 2) + Math.pow(p1.y - p4.y, 2));

    return (vertical1 + vertical2) / (2 * horizontal);
  };

  const performFaceCapture = () => {
    if (!isRunningRef.current) return;

    isRunningRef.current = false;
    if (faceDetectionIntervalRef.current) {
      clearInterval(faceDetectionIntervalRef.current);
      faceDetectionIntervalRef.current = null;
    }

    const canvas = faceCanvasRef.current;
    const video = faceVideoRef.current;

    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);

    setCapturedFace(imageDataUrl);
    setFaceVerified(true);
    setFaceStatus('Verified');
    setFaceStatusType('verified');
    setFaceFeedback('✓ Face verified successfully!');
    setFaceFeedbackType('success');
    setLivenessScore(100);
    setSteadySeconds(0);

    // Stop face camera
    stopFaceDetection();

    // Enable ID scanning after delay
    setTimeout(() => {
      setFeedbackMessage('Press "Start Camera" to scan your ID');
    }, 500);
  };

  // ==================== ID SCANNING ====================
  const startCamera = async () => {
    try {
      setFeedbackMessage('Starting camera...');
      setFeedbackType('info');

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not available. Please use HTTPS or localhost.');
      }

      // Make sure face camera is fully stopped
      if (faceStreamRef.current) {
        faceStreamRef.current.getTracks().forEach(track => track.stop());
        faceStreamRef.current = null;
      }

      const constraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = mediaStream;

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }

      cameraStartedRef.current = true;
      setCameraStarted(true);
      setCapturedImage(null);
      setAiResults(null);
      setOcrRawText('');
      setFeedbackMessage('Position your ID within the guide rectangle');
      setFeedbackType('info');

      if (autoCapture) {
        startAlignmentCheck();
      }
    } catch (err) {
      console.error('Camera error:', err);
      setFeedbackMessage('Failed to access camera: ' + err.message);
      setFeedbackType('error');
    }
  };

  const stopCamera = useCallback(() => {
    cameraStartedRef.current = false;

    if (alignmentCheckRef.current) {
      clearInterval(alignmentCheckRef.current);
      alignmentCheckRef.current = null;
    }

    if (captureTimeoutRef.current) {
      clearTimeout(captureTimeoutRef.current);
      captureTimeoutRef.current = null;
    }

    const streamToStop = streamRef.current;
    if (streamToStop) {
      streamToStop.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraStarted(false);
  }, []);

  const switchCamera = async () => {
    const currentStream = streamRef.current;
    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop());
    }

    try {
      const currentFacingMode = currentStream?.getVideoTracks()[0]?.getSettings()?.facingMode;
      const newFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';

      const constraints = {
        video: {
          facingMode: { exact: newFacingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = mediaStream;

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
    } catch (err) {
      console.error('Switch camera error:', err);
      setFeedbackMessage('Failed to switch camera');
      setFeedbackType('warn');
    }
  };

  const startAlignmentCheck = () => {
    if (alignmentCheckRef.current) {
      clearInterval(alignmentCheckRef.current);
    }

    let stableCount = 0;
    const requiredStableFrames = 15;

    alignmentCheckRef.current = setInterval(() => {
      if (!cameraStartedRef.current || isProcessing) return;

      const video = videoRef.current;
      if (video && video.readyState >= 2) {
        stableCount++;

        if (stableCount >= requiredStableFrames) {
          setFeedbackMessage('Document detected! Capturing...');
          setFeedbackType('success');

          if (captureTimeoutRef.current) {
            clearTimeout(captureTimeoutRef.current);
          }
          captureTimeoutRef.current = setTimeout(() => {
            captureImage();
          }, 500);

          clearInterval(alignmentCheckRef.current);
          alignmentCheckRef.current = null;
          stableCount = 0;
        } else if (stableCount > 5) {
          setFeedbackMessage(`Hold steady... ${Math.ceil((requiredStableFrames - stableCount) / 10)}s`);
          setFeedbackType('info');
        }
      } else {
        stableCount = 0;
      }
    }, 100);
  };

  const captureImage = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || isProcessing) return;

    setIsProcessing(true);
    setFeedbackMessage('Processing...');
    setFeedbackType('info');

    try {
      const ctx = canvas.getContext('2d');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setCapturedImage(imageDataUrl);

      stopCamera();
      await processOCR(imageDataUrl);
    } catch (err) {
      console.error('Capture error:', err);
      setFeedbackMessage('Failed to capture image');
      setFeedbackType('error');
      setIsProcessing(false);
    }
  }, [isProcessing, stopCamera]);

  const processOCR = async (imageDataUrl) => {
    try {
      setFeedbackMessage('Sending to OCR service...');

      const response = await fetch('http://192.168.137.1:3000/api/ocr/base64', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: imageDataUrl,
          type: 'identity',
        }),
      });

      if (!response.ok) {
        throw new Error(`OCR API error: ${response.status}`);
      }

      const ocrResult = await response.json();
      console.log('OCR Result:', ocrResult);

      const extractedText = ocrResult.rawText ||
        ocrResult.text ||
        ocrResult.basicText?.text ||
        ocrResult.structuredText?.text;

      if (ocrResult.success && extractedText) {
        setOcrRawText(extractedText);
        setFeedbackMessage('OCR complete. Extracting fields...');

        // Also store heuristic fields if available
        if (ocrResult.fields) {
          setFormData((prev) => ({
            ...prev,
            firstName: ocrResult.fields.firstName || prev.firstName,
            lastName: ocrResult.fields.lastName || prev.lastName,
            idNumber: ocrResult.fields.idNumber || prev.idNumber,
          }));
        }

        await extractFields(extractedText);
      } else {
        setFeedbackMessage('OCR failed: ' + (ocrResult.error || 'No text extracted'));
        setFeedbackType('error');
        setIsProcessing(false);
      }
    } catch (err) {
      console.error('OCR error:', err);
      setFeedbackMessage('OCR processing failed: ' + err.message);
      setFeedbackType('error');
      setIsProcessing(false);
    }
  };

  const extractFields = async (rawText) => {
    try {
      const endpointMap = {
        'national-id': '/api/ai/national-id/parse',
        passport: '/api/ai/passport/parse',
        'driver-license': '/api/ai/driver-license/parse',
        umid: '/api/ai/umid/parse',
        philhealth: '/api/ai/philhealth/parse',
        'tin-id': '/api/ai/tin-id/parse',
        'postal-id': '/api/ai/postal-id/parse',
        pagibig: '/api/ai/pagibig/parse',
      };

      const endpoint = endpointMap[idType];
      if (!endpoint) {
        setExtractedData({ rawText });
        setFeedbackMessage('Extraction complete (no AI endpoint for this ID type)');
        setFeedbackType('warn');
        setIsProcessing(false);
        return;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText }),
      });

      const result = await response.json();
      console.log('AI Extraction Result:', result);

      if (result.success && result.fields) {
        setExtractedData({
          ...result.fields,
          confidence: result.confidence,
          modelUsed: result.modelUsed,
        });
        setAiResults(result);

        // Update form with AI results
        setFormData((prev) => ({
          ...prev,
          firstName: result.fields.firstName || prev.firstName,
          lastName: result.fields.lastName || prev.lastName,
          middleName: result.fields.middleName || prev.middleName,
          idNumber: result.fields.idNumber || prev.idNumber,
          birthDate: result.fields.birthDate || prev.birthDate,
          address: result.fields.address || prev.address,
        }));

        setFeedbackMessage('✓ ID verification complete');
        setFeedbackType('success');
      } else {
        setExtractedData({ rawText, error: result.error });
        setAiResults({ error: result.error });
        setFeedbackMessage('AI extraction failed: ' + (result.error || 'Unknown error'));
        setFeedbackType('warn');
      }
    } catch (err) {
      console.error('AI extraction error:', err);
      setExtractedData({ rawText, error: err.message });
      setAiResults({ error: err.message });
      setFeedbackMessage('AI extraction failed');
      setFeedbackType('warn');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetCapture = () => {
    setCapturedImage(null);
    setExtractedData(null);
    setAiResults(null);
    setOcrRawText('');
    setFormData({
      idNumber: '',
      lastName: '',
      firstName: '',
      middleName: '',
      birthDate: '',
      address: '',
    });
    setFeedbackMessage('Press "Start Camera" to scan your ID');
    setFeedbackType('info');
  };

  const manualCapture = () => {
    if (alignmentCheckRef.current) {
      clearInterval(alignmentCheckRef.current);
      alignmentCheckRef.current = null;
    }
    captureImage();
  };

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="w-full border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Identity Recognition & OCR Demo
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Position your identity document within the guide rectangle for optimal OCR results
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Face Recognition Section */}
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Face Liveness Detection</h2>
              <p className="text-sm text-gray-600">
                Verify you are a real person before capturing your ID
              </p>
            </div>
            <div
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                faceStatusType === 'verified'
                  ? 'bg-green-100 text-green-700'
                  : faceStatusType === 'failed'
                  ? 'bg-red-100 text-red-700'
                  : faceStatusType === 'detecting'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {faceStatus}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Face Camera */}
            <div>
              <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-black shadow-sm">
                <video
                  ref={faceVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="h-80 w-full object-cover"
                />
                <canvas ref={faceCanvasRef} className="hidden" />

                {/* Face guide circle */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div
                    className={`w-48 h-48 rounded-full border-4 transition-all duration-300 ${
                      faceVerified
                        ? 'border-solid border-green-500 shadow-lg shadow-green-500/50'
                        : isCentered && livenessScore >= 50
                        ? 'border-solid border-green-500'
                        : isCentered
                        ? 'border-dashed border-yellow-500'
                        : 'border-dashed border-white/70'
                    }`}
                  />
                </div>

                {/* Liveness progress bar */}
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-[85%]">
                  <div className="flex items-center justify-between text-white text-xs mb-1">
                    <span>Liveness {currentExpression && `(${currentExpression})`}</span>
                    <span className="font-bold">{livenessScore}%</span>
                  </div>
                  <div className="bg-black/50 rounded-full h-3 overflow-hidden border border-white/30">
                    <div
                      className={`h-full transition-all duration-300 ${
                        livenessScore >= 60
                          ? 'bg-green-500'
                          : livenessScore >= 30
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${livenessScore}%` }}
                    />
                  </div>
                  {steadySeconds > 0 && faceDetectionStarted && (
                    <div className="text-center text-xs text-white/80 mt-1">
                      Hold steady: {steadySeconds}s
                    </div>
                  )}
                </div>

                {/* Face feedback */}
                <div
                  className={`absolute left-1/2 bottom-2 -translate-x-1/2 rounded-lg px-3 py-1.5 max-w-[90%] ${
                    faceFeedbackType === 'success'
                      ? 'bg-green-600/80'
                      : faceFeedbackType === 'error'
                      ? 'bg-red-600/80'
                      : faceFeedbackType === 'warning'
                      ? 'bg-yellow-600/80'
                      : 'bg-black/70'
                  }`}
                >
                  <div className="text-center text-xs font-semibold text-white">
                    {faceFeedback}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                {!faceDetectionStarted ? (
                  <button
                    onClick={startFaceDetection}
                    disabled={!modelsLoaded || faceVerified}
                    className="inline-flex items-center justify-center rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {!modelsLoaded ? (
                      <>
                        <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Loading AI Models...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        Start Face Detection
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={stopFaceDetection}
                    className="inline-flex items-center justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-red-700"
                  >
                    Stop Detection
                  </button>
                )}
                {modelsLoaded && (
                  <span className="text-xs text-green-600 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    AI Ready
                  </span>
                )}
              </div>
            </div>

            {/* Captured Face Preview */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 h-full">
              <h3 className="text-base font-medium mb-3">Captured Face</h3>
              <div className="flex items-center justify-center min-h-[200px]">
                {capturedFace ? (
                  <img
                    src={capturedFace}
                    alt="Captured face"
                    className="max-h-64 w-auto max-w-full object-contain rounded-lg"
                  />
                ) : (
                  <div className="text-center text-gray-500">
                    <svg className="w-16 h-16 mx-auto mb-2 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                    </svg>
                    <p className="text-sm">Face will be auto-captured when liveness is verified</p>
                  </div>
                )}
              </div>
              {faceVerified && (
                <div className="mt-3 flex items-center gap-2 text-sm">
                  <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-green-600 font-medium">Live Person Verified (100% confidence)</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ID Scanning Section */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left: Camera + Controls */}
          <div className="space-y-4">
            {/* Camera Container */}
            <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-black shadow-sm">
              {!capturedImage ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="h-64 w-full object-cover sm:h-72 md:h-80 lg:h-96"
                  />
                  <canvas ref={canvasRef} className="hidden" />

                  {/* Guide rectangle overlay */}
                  {cameraStarted && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="relative w-[85%] h-[60%] rounded-xl border-2 border-dashed border-white/70">
                        {/* Corner markers */}
                        <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-lg" />
                        <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-lg" />
                        <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-lg" />
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-white rounded-br-lg" />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <img
                  src={capturedImage}
                  alt="Captured ID"
                  className="h-64 w-full object-contain sm:h-72 md:h-80 lg:h-96"
                />
              )}

              {/* Feedback message */}
              <div
                className={`absolute bottom-3 left-1/2 -translate-x-1/2 rounded-lg px-4 py-2 text-sm font-medium w-[94%] text-center ${
                  feedbackType === 'success'
                    ? 'bg-green-600 text-white'
                    : feedbackType === 'error'
                    ? 'bg-red-600 text-white'
                    : feedbackType === 'warn'
                    ? 'bg-yellow-500 text-black'
                    : 'bg-black/70 text-white'
                }`}
              >
                {feedbackMessage}
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {!cameraStarted && !capturedImage && (
                <button
                  onClick={startCamera}
                  disabled={!faceVerified}
                  className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Start Camera
                </button>
              )}

              {cameraStarted && (
                <>
                  <button
                    onClick={switchCamera}
                    className="inline-flex items-center justify-center rounded-md bg-gray-700 px-4 py-2 text-sm font-medium text-white shadow hover:bg-gray-800"
                  >
                    Switch Camera
                  </button>
                  <button
                    onClick={manualCapture}
                    disabled={isProcessing}
                    className="inline-flex items-center justify-center rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-green-700 disabled:opacity-50"
                  >
                    Capture Now
                  </button>
                  <button
                    onClick={stopCamera}
                    className="inline-flex items-center justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-red-700"
                  >
                    Stop
                  </button>
                </>
              )}

              {capturedImage && !isProcessing && (
                <button
                  onClick={resetCapture}
                  className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700"
                >
                  Recapture
                </button>
              )}

              {isProcessing && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                  Processing image...
                </div>
              )}
            </div>

            {/* Settings */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">ID Type</label>
                  <select
                    value={idType}
                    onChange={(e) => setIdType(e.target.value)}
                    className="block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    {ID_TYPES.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={autoCapture}
                      onChange={(e) => setAutoCapture(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    Auto-capture when stable
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Results Section */}
          <div className="space-y-4">
            {/* Extracted Details Form */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="text-base font-medium">Extracted Details</h3>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">ID Type</label>
                  <select
                    value={idType}
                    onChange={(e) => setIdType(e.target.value)}
                    className="block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    {ID_TYPES.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">ID Number</label>
                  <input
                    type="text"
                    value={formData.idNumber}
                    onChange={(e) => handleFormChange('idNumber', e.target.value)}
                    placeholder="Auto-filled from OCR"
                    className="block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Last Name</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => handleFormChange('lastName', e.target.value)}
                    placeholder="Apelyido / Last Name"
                    className="block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">First Name</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => handleFormChange('firstName', e.target.value)}
                    placeholder="Mga Pangalan / Given Names"
                    className="block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Middle Name</label>
                  <input
                    type="text"
                    value={formData.middleName}
                    onChange={(e) => handleFormChange('middleName', e.target.value)}
                    placeholder="Gitnang Apelyido / Middle Name"
                    className="block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Birth Date</label>
                  <input
                    type="text"
                    value={formData.birthDate}
                    onChange={(e) => handleFormChange('birthDate', e.target.value)}
                    placeholder="Petsa ng Kapanganakan"
                    className="block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Captured Image Preview */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="text-base font-medium">Captured Image</h3>
              <div className="mt-3 flex min-h-[160px] items-center justify-center overflow-hidden rounded-lg bg-gray-50">
                {capturedImage ? (
                  <img
                    src={capturedImage}
                    alt="Captured ID"
                    className="max-h-80 w-auto max-w-full object-contain"
                  />
                ) : (
                  <div className="text-sm text-gray-500">No image captured yet</div>
                )}
              </div>
            </div>

            {/* OCR Results */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="text-base font-medium">OCR Results</h3>
              <div className="mt-3 max-h-[22rem] overflow-auto rounded-md bg-gray-50 p-3 text-sm text-gray-800">
                {ocrRawText ? (
                  <pre className="whitespace-pre-wrap text-xs">{ocrRawText}</pre>
                ) : (
                  <div className="text-gray-500">Process an image to see OCR results</div>
                )}
              </div>
            </div>

            {/* AI Results */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="text-base font-medium">AI Results</h3>
              <div className="mt-3 rounded-md bg-gray-50 p-3 text-sm text-gray-800">
                {aiResults ? (
                  <div className="space-y-2">
                    {aiResults.success ? (
                      <>
                        <div className="flex items-center gap-2 text-green-600">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="font-medium">AI Extraction Successful</span>
                        </div>
                        <pre className="text-xs whitespace-pre-wrap bg-white p-2 rounded border">
                          {JSON.stringify(aiResults.fields, null, 2)}
                        </pre>
                        {aiResults.confidence && (
                          <div className="text-xs text-gray-600">
                            Confidence: {Math.round(aiResults.confidence * 100)}%
                            {aiResults.modelUsed && ` • Model: ${aiResults.modelUsed}`}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-red-600">
                        Error: {aiResults.error || 'Unknown error'}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-gray-500">
                    AI will display extracted fields here when available.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
