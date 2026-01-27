import { useEffect, useRef, useState } from 'react';

export default function CameraSection({ cameraStarted, idType, onProblem }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState('Center your document');
  const [isFrontCamera, setIsFrontCamera] = useState(false);

  useEffect(() => {
    if (cameraStarted && !stream) {
      startCamera();
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStarted]);

  const startCamera = async () => {
    try {
      const constraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      
      // Check if using front camera to apply mirror effect
      const facingMode = mediaStream.getVideoTracks()[0]?.getSettings()?.facingMode;
      setIsFrontCamera(facingMode === 'user');

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }

      setFeedbackMessage('Camera ready - position your document');
    } catch (err) {
      console.error('Camera error:', err);
      onProblem?.('Failed to access camera: ' + err.message, 'error');
    }
  };

  const switchCamera = async () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    try {
      const currentFacingMode = stream
        ?.getVideoTracks()[0]
        ?.getSettings()?.facingMode;
      const newFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';

      const constraints = {
        video: {
          facingMode: { exact: newFacingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      
      // Update mirror effect based on new camera
      setIsFrontCamera(newFacingMode === 'user');

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
    } catch (err) {
      console.error('Switch camera error:', err);
      onProblem?.('Failed to switch camera: ' + err.message, 'warn');
    }
  };

  return (
    <div className="camera-section space-y-4">
      <div className="camera-container relative overflow-hidden bg-black shadow-sm">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="h-64 w-full object-cover sm:h-72 md:h-80 lg:h-[26rem]"
          style={{ transform: isFrontCamera ? 'scaleX(-1)' : 'none' }}
        />
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Rectangle guide overlay */}
        <div className="overlay-container pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="guide-rectangle" />
          <div className="alignment-feedback absolute left-1/2 bottom-1/4 w-[94%] -translate-x-1/2 rounded-lg">
            <div className="feedback-message">{feedbackMessage}</div>
          </div>
        </div>

        {/* Camera controls */}
        {cameraStarted && (
          <div className="camera-controls flex flex-wrap items-center gap-3">
            <button
              onClick={switchCamera}
              className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700"
            >
              Switch Camera
            </button>
          </div>
        )}
      </div>

      {/* Hidden elements for compatibility with existing scripts */}
      <div id="hidden-data" aria-hidden="true" style={{ display: 'none' }}>
        <img id="preview-image" alt="preview" style={{ display: 'none' }} />
        <select id="id-type" defaultValue={idType} style={{ display: 'none' }}>
          <option value="national-id">National ID</option>
          <option value="passport">Passport</option>
          <option value="umid">UMID</option>
        </select>
        <select id="ocr-type" style={{ display: 'none' }}>
          <option value="identity">Identity Document</option>
        </select>
        <img id="captured-image" alt="captured" style={{ display: 'none' }} />
        <div id="results-container" style={{ display: 'none' }} />
        <div id="loading" style={{ display: 'none' }}>Loading...</div>
        <pre id="ocr-result" style={{ display: 'none' }}>{'{}'}</pre>
      </div>
    </div>
  );
}
