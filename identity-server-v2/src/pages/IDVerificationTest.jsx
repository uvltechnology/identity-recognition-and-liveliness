import { useState, useRef, useCallback, useEffect } from 'react';

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

export default function IDVerificationTest() {
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
  const [feedbackMessage, setFeedbackMessage] = useState('Press "Start Camera" to scan your ID');
  const [feedbackType, setFeedbackType] = useState('info');
  const [ocrRawText, setOcrRawText] = useState('');
  const [aiResults, setAiResults] = useState(null);
  const [autoCapture, setAutoCapture] = useState(true);

  const [formData, setFormData] = useState({
    idNumber: '',
    lastName: '',
    firstName: '',
    middleName: '',
    birthDate: '',
    address: '',
  });

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      setFeedbackMessage('Starting camera...');
      setFeedbackType('info');

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not available. Please use HTTPS or localhost.');
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
        setAiResults(result);

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
        setAiResults({ error: result.error });
        setFeedbackMessage('AI extraction failed: ' + (result.error || 'Unknown error'));
        setFeedbackType('warn');
      }
    } catch (err) {
      console.error('AI extraction error:', err);
      setAiResults({ error: err.message });
      setFeedbackMessage('AI extraction failed');
      setFeedbackType('warn');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetCapture = () => {
    setCapturedImage(null);
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
            ID Document Verification
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Scan your identity document to extract information using OCR and AI
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
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
                  className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Start Camera
                </button>
              )}

              {cameraStarted && (
                <>
                  <button
                    onClick={switchCamera}
                    className="inline-flex items-center justify-center rounded-md bg-gray-700 px-4 py-2 text-sm font-medium text-white shadow hover:bg-gray-800"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Switch Camera
                  </button>
                  <button
                    onClick={manualCapture}
                    disabled={isProcessing}
                    className="inline-flex items-center justify-center rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-green-700 disabled:opacity-50"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
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
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
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
          <a
            href="/selfie-liveness-test"
            className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Go to Face Verification
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </a>
        </div>
      </main>
    </div>
  );
}
