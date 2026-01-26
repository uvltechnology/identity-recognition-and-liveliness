import { useState, useEffect, useRef, useCallback } from 'react';

// Use local server endpoint (relative URL)
const API_URL = '/api/ocr/base64';

// ID type options with display names and icons
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

export default function IDVerificationTest() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [selectedIdType, setSelectedIdType] = useState(null);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState('Press Start to scan your ID');
  const [feedbackType, setFeedbackType] = useState('info');
  const [ocrResult, setOcrResult] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [openaiResult, setOpenaiResult] = useState(null);
  const [verificationComplete, setVerificationComplete] = useState(false);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      setFeedback('Starting camera...');
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
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
      setFeedback('Camera access failed: ' + err.message);
      setFeedbackType('error');
    }
  };

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraStarted(false);
  }, []);

  const fetchWithTimeout = (url, options, timeout = 15000) => {
    return Promise.race([
      fetch(url, options),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout))
    ]);
  };

  const captureID = async () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    setIsProcessing(true);
    setFeedback('Capturing...');

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    // Lower quality for faster processing
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.7);

    setCapturedImage(imageDataUrl);
    stopCamera();

    await processImage(imageDataUrl);
  };

  const processImage = async (imageDataUrl) => {
    const base64Data = imageDataUrl.split(',')[1];

    try {
      setFeedback('Processing ID...');
      setFeedbackType('info');

      // Single API call - server handles OCR + Gemini + OpenAI extraction
      const res = await fetchWithTimeout(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          image: base64Data, 
          type: 'identity',
          idType: selectedIdType || 'unknown'
        })
      }, 30000);
      
      const data = await res.json();
      
      if (!data.success) throw new Error(data.error || 'Processing failed');

      // Store results
      setOcrResult({ text: data.rawText || data.basicText?.text || '' });
      setAiResult({ data: data.fields || {} });
      if (data.openai?.parsed) {
        setOpenaiResult(data.openai.parsed);
      }

      setFeedback('Done!');
      setFeedbackType('success');
      setVerificationComplete(true);
    } catch (err) {
      console.error('Processing error:', err);
      setFeedback('Failed: ' + err.message);
      setFeedbackType('error');
      setIsProcessing(false);
    }
  };

  const downloadImage = () => {
    if (!capturedImage) return;
    const link = document.createElement('a');
    link.href = capturedImage;
    link.download = `id-scan-${Date.now()}.jpg`;
    link.click();
  };

  const resetAll = () => {
    setCapturedImage(null);
    setOcrResult(null);
    setAiResult(null);
    setOpenaiResult(null);
    setVerificationComplete(false);
    setSelectedIdType(null);
    setFeedback('Press Start to scan your ID');
    setFeedbackType('info');
    setIsProcessing(false);
  };

  const renderField = (label, value) => {
    if (!value) return null;
    return (
      <div className="flex justify-between py-2 border-b border-gray-100 last:border-0">
        <span className="text-gray-500 text-sm">{label}</span>
        <span className="text-gray-900 font-medium text-sm text-right max-w-[60%]">{value}</span>
      </div>
    );
  };

  // Get label for selected ID type
  const getIdTypeLabel = (value) => {
    const found = ID_TYPES.find(t => t.value === value);
    return found ? found.label : value;
  };

  // ID Type Selection View
  if (!selectedIdType) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        {/* Header */}
        <div className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
            <a href="/" className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full transition">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </a>
            <h1 className="font-semibold text-gray-900">ID Verification</h1>
            <div className="w-10" />
          </div>
        </div>

        <div className="max-w-lg mx-auto p-4 space-y-6">
          {/* Title */}
          <div className="text-center pt-4 pb-2">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Select ID Type</h2>
            <p className="text-gray-600">Choose the type of ID you want to scan for accurate extraction</p>
          </div>

          {/* ID Type Grid */}
          <div className="grid grid-cols-2 gap-3">
            {ID_TYPES.map((idType) => (
              <button
                key={idType.value}
                onClick={() => setSelectedIdType(idType.value)}
                className="bg-white rounded-2xl p-4 shadow-md hover:shadow-lg hover:scale-[1.02] transition-all duration-200 text-left border-2 border-transparent hover:border-blue-500 group"
              >
                <div className="text-3xl mb-2">{idType.icon}</div>
                <div className="font-semibold text-gray-900 text-sm leading-tight group-hover:text-blue-600 transition-colors">
                  {idType.label}
                </div>
              </button>
            ))}
          </div>

          {/* Tip */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
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

          {/* Back Button */}
          <a
            href="/"
            className="block w-full py-3 bg-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-300 transition text-center"
          >
            Back to Home
          </a>
        </div>
      </div>
    );
  }

  // Results View
  if (verificationComplete && capturedImage) {
    const data = aiResult?.data || aiResult || {};
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50">
        {/* Header */}
        <div className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
            <a href="/" className="p-2 -ml-2 text-gray-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </a>
            <h1 className="font-semibold text-gray-900">ID Verification Result</h1>
            <div className="w-10" />
          </div>
        </div>

        <div className="max-w-lg mx-auto p-4 space-y-4">
          {/* Success Badge */}
          <div className="bg-green-500 text-white rounded-2xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <div className="font-bold text-lg">Verification Complete</div>
              <div className="text-white/80 text-sm">ID document processed successfully</div>
            </div>
          </div>

          {/* Captured ID Image */}
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <img src={capturedImage} alt="Scanned ID" className="w-full aspect-video object-contain bg-gray-100" />
          </div>

          {/* Extracted Info */}
          <div className="bg-white rounded-2xl shadow-lg p-4">
            <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Extracted Information
            </h2>
            <div className="divide-y divide-gray-100">
              {renderField('ID Type', data.idType)}
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

          {/* OCR Raw Text */}
          {ocrResult?.text && (
            <details className="bg-white rounded-2xl shadow-lg">
              <summary className="p-4 cursor-pointer font-bold text-gray-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Raw OCR Text
              </summary>
              <div className="px-4 pb-4">
                <pre className="bg-gray-50 rounded-lg p-3 text-xs text-gray-700 whitespace-pre-wrap overflow-x-auto max-h-40">
                  {ocrResult.text}
                </pre>
              </div>
            </details>
          )}

          {/* OpenAI Result */}
          {openaiResult && (
            <details className="bg-white rounded-2xl shadow-lg">
              <summary className="p-4 cursor-pointer font-bold text-gray-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                OpenAI Extraction
              </summary>
              <div className="px-4 pb-4">
                <pre className="bg-gray-50 rounded-lg p-3 text-xs text-gray-700 whitespace-pre-wrap overflow-x-auto max-h-40">
                  {JSON.stringify(openaiResult, null, 2)}
                </pre>
              </div>
            </details>
          )}

          {/* Actions */}
          <div className="space-y-3 pt-2">
            <button
              onClick={downloadImage}
              className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download ID Image
            </button>
            <button
              onClick={resetAll}
              className="w-full py-3 bg-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-300 transition"
            >
              Scan Another ID
            </button>
            <a
              href="/"
              className="block w-full py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition text-center"
            >
              Done
            </a>
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
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Overlay */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Top gradient */}
          <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/60 to-transparent" />
          
          {/* Bottom gradient */}
          <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black/80 to-transparent" />

          {/* ID guide rectangle */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              <div
                className={`w-80 h-52 sm:w-96 sm:h-60 border-4 rounded-2xl transition-all duration-300 ${
                  capturedImage
                    ? 'border-green-500 shadow-[0_0_40px_rgba(34,197,94,0.5)]'
                    : 'border-white/70 border-dashed'
                }`}
              />
              {/* Corner markers */}
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-lg" />
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-lg" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-lg" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-white rounded-br-lg" />
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
              <div className="px-3 py-1 bg-blue-500/80 backdrop-blur rounded-full text-white text-xs font-medium flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                </svg>
                {getIdTypeLabel(selectedIdType)}
              </div>
            </div>
          </div>

          {/* Instructions */}
          {cameraStarted && !capturedImage && (
            <div className="absolute top-20 left-6 right-6 text-center">
              <div className="text-white/80 text-sm">
                Align your ID card within the frame
              </div>
            </div>
          )}
        </div>

        {/* Processing overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-20">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
              <div className="text-white font-medium">{feedback}</div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="relative z-10 px-6 pb-8 pt-4">
        {/* Feedback */}
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

        {/* Buttons */}
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
              onClick={stopCamera}
              className="flex-1 py-4 bg-red-500/80 text-white font-bold rounded-2xl hover:bg-red-600 transition"
            >
              Cancel
            </button>
            <button
              onClick={captureID}
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

        {/* Tips */}
        {cameraStarted && (
          <div className="flex justify-center gap-4 mt-4 text-white/60 text-xs">
            <span>• Good lighting</span>
            <span>• Keep steady</span>
            <span>• Fill frame</span>
          </div>
        )}

        {/* Change ID Type button */}
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
