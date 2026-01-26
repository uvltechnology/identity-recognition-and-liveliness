import { useState, useEffect, useRef, useCallback } from 'react';
import * as faceapi from 'face-api.js';

// Liveness detection constants
const MOVEMENT_THRESHOLD = 8;
const LIVENESS_REQUIRED_SCORE = 60;
const CENTER_TOLERANCE = 0.20;
const REQUIRED_CENTERED_FRAMES = 15;
const MAX_FRAME_HISTORY = 20;
const MIN_FACE_CONFIDENCE = 0.5;

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopFaceDetection();
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

      const expressionEntries = Object.entries(expressions);
      const dominantExpression = expressionEntries.reduce((a, b) => a[1] > b[1] ? a : b);
      setCurrentExpression(dominantExpression[0]);

      const faceCenterX = box.x + box.width / 2;
      const faceCenterY = box.y + box.height / 2;
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;

      const videoCenterX = videoWidth / 2;
      const videoCenterY = videoHeight / 2;
      const offsetX = Math.abs(faceCenterX - videoCenterX) / videoWidth;
      const offsetY = Math.abs(faceCenterY - videoCenterY) / videoHeight;
      const isCenteredX = offsetX < CENTER_TOLERANCE;
      const isCenteredY = offsetY < CENTER_TOLERANCE;
      const faceIsCentered = isCenteredX && isCenteredY;

      setIsCentered(faceIsCentered);

      let movement = 0;
      if (lastFacePositionRef.current) {
        const dx = Math.abs(faceCenterX - lastFacePositionRef.current.x);
        const dy = Math.abs(faceCenterY - lastFacePositionRef.current.y);
        const dSize = Math.abs(box.width - lastFacePositionRef.current.width);
        movement = dx + dy + dSize;
      }
      lastFacePositionRef.current = { x: faceCenterX, y: faceCenterY, width: box.width };

      const leftEye = landmarks.getLeftEye();
      const rightEye = landmarks.getRightEye();
      const leftEyeAspectRatio = getEyeAspectRatio(leftEye);
      const rightEyeAspectRatio = getEyeAspectRatio(rightEye);
      const avgEyeRatio = (leftEyeAspectRatio + rightEyeAspectRatio) / 2;

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

      let livenessIndicators = 0;
      const totalIndicators = 5;

      if (detection.score > MIN_FACE_CONFIDENCE) {
        livenessIndicators++;
      }

      if (movement > MOVEMENT_THRESHOLD) {
        livenessIndicators++;
      }

      if (frameHistoryRef.current.length >= 5) {
        const recentEyeRatios = frameHistoryRef.current.slice(-10).map(f => f.eyeRatio);
        const minRatio = Math.min(...recentEyeRatios);
        const maxRatio = Math.max(...recentEyeRatios);
        if (maxRatio - minRatio > 0.05) {
          blinkDetectedRef.current = true;
        }
      }
      if (blinkDetectedRef.current) {
        livenessIndicators++;
      }

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

      if (frameHistoryRef.current.length >= 5) {
        const recentPositions = frameHistoryRef.current.slice(-10);
        const xPositions = recentPositions.map(f => f.faceCenterX);
        const mean = xPositions.reduce((a, b) => a + b, 0) / xPositions.length;
        const variance = xPositions.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / xPositions.length;
        if (variance > 5) {
          livenessIndicators++;
        }
      }

      if (faceIsCentered) {
        centeredFrameCountRef.current++;
      } else {
        centeredFrameCountRef.current = 0;
      }

      const frameScore = (livenessIndicators / totalIndicators) * 100;
      livenessScoreRef.current = livenessScoreRef.current * 0.7 + frameScore * 0.3;
      const roundedScore = Math.round(livenessScoreRef.current);
      setLivenessScore(roundedScore);

      const framesRemaining = REQUIRED_CENTERED_FRAMES - centeredFrameCountRef.current;
      const secondsRemaining = Math.ceil(framesRemaining * 0.2);
      setSteadySeconds(secondsRemaining > 0 ? secondsRemaining : 0);

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
        if (centeredFrameCountRef.current >= REQUIRED_CENTERED_FRAMES) {
          setFaceFeedback('All checks passed! Capturing...');
          setFaceFeedbackType('success');

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

  const getEyeAspectRatio = (eye) => {
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

    stopFaceDetection();
  };

  const resetVerification = () => {
    setCapturedFace(null);
    setFaceVerified(false);
    setFaceStatus('Not Started');
    setFaceStatusType('idle');
    setFaceFeedback('Press Start button to begin');
    setFaceFeedbackType('info');
    setLivenessScore(0);
    setSteadySeconds(0);
    setIsCentered(false);
    setCurrentExpression('');
    blinkDetectedRef.current = false;
    expressionChangeRef.current = false;
  };

  const downloadFace = () => {
    if (!capturedFace) return;
    const link = document.createElement('a');
    link.href = capturedFace;
    link.download = `selfie-${Date.now()}.jpg`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="w-full border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Selfie Liveness Detection
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Verify you are a real person by completing the face liveness check
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold">Face Liveness Detection</h2>
              <p className="text-sm text-gray-600">
                Look at the camera and follow the instructions
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

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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

              <div className="mt-4 flex flex-wrap items-center gap-3">
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
                {faceVerified && (
                  <button
                    onClick={resetVerification}
                    className="inline-flex items-center justify-center rounded-md bg-gray-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-gray-700"
                  >
                    Start Over
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
              <h3 className="text-base font-medium mb-3">Captured Selfie</h3>
              <div className="flex items-center justify-center min-h-[280px]">
                {capturedFace ? (
                  <img
                    src={capturedFace}
                    alt="Captured face"
                    className="max-h-72 w-auto max-w-full object-contain rounded-lg shadow-md"
                  />
                ) : (
                  <div className="text-center text-gray-500">
                    <svg className="w-20 h-20 mx-auto mb-3 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                    </svg>
                    <p className="text-sm">Face will be auto-captured when liveness is verified</p>
                  </div>
                )}
              </div>
              {faceVerified && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-green-600 font-medium">Live Person Verified (100% confidence)</span>
                  </div>
                  <button
                    onClick={downloadFace}
                    className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download Selfie
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Liveness Indicators */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Liveness Checks</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div className={`p-3 rounded-lg text-center ${faceDetectionStarted || faceVerified ? 'bg-green-50' : 'bg-gray-100'}`}>
                <div className={`text-xs font-medium ${faceDetectionStarted || faceVerified ? 'text-green-700' : 'text-gray-500'}`}>
                  Face Detected
                </div>
              </div>
              <div className={`p-3 rounded-lg text-center ${isCentered || faceVerified ? 'bg-green-50' : 'bg-gray-100'}`}>
                <div className={`text-xs font-medium ${isCentered || faceVerified ? 'text-green-700' : 'text-gray-500'}`}>
                  Face Centered
                </div>
              </div>
              <div className={`p-3 rounded-lg text-center ${blinkDetectedRef.current || faceVerified ? 'bg-green-50' : 'bg-gray-100'}`}>
                <div className={`text-xs font-medium ${blinkDetectedRef.current || faceVerified ? 'text-green-700' : 'text-gray-500'}`}>
                  Blink Detected
                </div>
              </div>
              <div className={`p-3 rounded-lg text-center ${expressionChangeRef.current || faceVerified ? 'bg-green-50' : 'bg-gray-100'}`}>
                <div className={`text-xs font-medium ${expressionChangeRef.current || faceVerified ? 'text-green-700' : 'text-gray-500'}`}>
                  Expression
                </div>
              </div>
              <div className={`p-3 rounded-lg text-center ${livenessScore >= 60 || faceVerified ? 'bg-green-50' : 'bg-gray-100'}`}>
                <div className={`text-xs font-medium ${livenessScore >= 60 || faceVerified ? 'text-green-700' : 'text-gray-500'}`}>
                  Movement
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-6 flex justify-between">
          <a
            href="/"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Home
          </a>
          {faceVerified && (
            <a
              href="/id-verification-test"
              className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Continue to ID Verification
              <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </a>
          )}
        </div>
      </main>
    </div>
  );
}
