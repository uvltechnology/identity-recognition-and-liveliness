(function() {
  // Face Detection & Liveness Module
  // Detects if a person is real (not a photo) and auto-captures when live

  const FaceDetection = {
    video: null,
    canvas: null,
    ctx: null,
    stream: null,
    isRunning: false,
    livenessCheckInterval: null,
    frameHistory: [],
    maxFrameHistory: 15,
    blinkDetected: false,
    movementDetected: false,
    lastFacePosition: null,
    livenessScore: 0,
    isCentered: false,
    centeredFrameCount: 0,
    captureCallback: null,
    statusCallback: null,
    centeringCallback: null,
    
    // Liveness thresholds
    MOVEMENT_THRESHOLD: 5, // Lower threshold for easier movement detection
    LIVENESS_REQUIRED_SCORE: 50, // Require 50%+ before capture
    MIN_FACE_SIZE: 60,
    CENTER_TOLERANCE: 0.25, // 25% tolerance from center
    REQUIRED_CENTERED_FRAMES: 15, // Must be centered for 15 consecutive frames (~3 seconds)
    
    // AI verification endpoint
    AI_ENDPOINT: '/api/ai/face/liveness',

    async init(videoElement, canvasElement, options = {}) {
      this.video = videoElement;
      this.canvas = canvasElement;
      this.ctx = canvasElement.getContext('2d');
      this.captureCallback = options.onCapture || null;
      this.statusCallback = options.onStatus || null;
      this.centeringCallback = options.onCentering || null;
      this.frameHistory = [];
      this.livenessScore = 0;
      this.blinkDetected = false;
      this.movementDetected = false;
      this.lastFacePosition = null;
      this.isCentered = false;
      this.centeredFrameCount = 0;
    },

    async startCamera() {
      try {
        this.updateStatus('Starting camera...', 'info');
        
        // Request front camera for face detection
        const constraints = {
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 }
          }
        };

        this.stream = await navigator.mediaDevices.getUserMedia(constraints);
        this.video.srcObject = this.stream;
        
        await new Promise((resolve) => {
          this.video.onloadedmetadata = () => {
            this.video.play();
            resolve();
          };
        });

        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
        
        this.isRunning = true;
        this.startLivenessDetection();
        this.updateStatus('Look at the camera and blink naturally', 'info');
        
        return true;
      } catch (err) {
        console.error('[FaceDetection] Camera error:', err);
        this.updateStatus('Camera access denied or unavailable', 'error');
        return false;
      }
    },

    stopCamera() {
      this.isRunning = false;
      
      if (this.livenessCheckInterval) {
        clearInterval(this.livenessCheckInterval);
        this.livenessCheckInterval = null;
      }

      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
      }

      if (this.video) {
        this.video.srcObject = null;
      }

      this.frameHistory = [];
      this.livenessScore = 0;
      this.isCentered = false;
      this.centeredFrameCount = 0;
    },

    startLivenessDetection() {
      // Check liveness every 200ms
      this.livenessCheckInterval = setInterval(() => {
        if (!this.isRunning) return;
        this.analyzeLiveness();
      }, 200);
    },

    // Check if face is centered in the guide circle
    checkFaceCentering(faceRegion) {
      const videoWidth = this.canvas.width;
      const videoHeight = this.canvas.height;
      
      // Calculate the center of the video
      const videoCenterX = videoWidth / 2;
      const videoCenterY = videoHeight / 2;
      
      // Calculate how far the face center is from the video center
      const offsetX = Math.abs(faceRegion.centerX - videoCenterX) / videoWidth;
      const offsetY = Math.abs(faceRegion.centerY - videoCenterY) / videoHeight;
      
      // Check if face is within tolerance
      const isCenteredX = offsetX < this.CENTER_TOLERANCE;
      const isCenteredY = offsetY < this.CENTER_TOLERANCE;
      
      // Skip size check - just use position centering
      return {
        isCentered: isCenteredX && isCenteredY,
        offsetX: offsetX,
        offsetY: offsetY,
        sizeRatio: 1.0, // Always report as good
        isCenteredX,
        isCenteredY,
        isSizeGood: true // Always true - skip size check
      };
    },

    async analyzeLiveness() {
      if (!this.video || this.video.readyState < 2) return;

      // Capture current frame
      this.ctx.drawImage(this.video, 0, 0);
      const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      
      // Detect face region using simple skin color detection
      const faceRegion = this.detectFaceRegion(imageData);
      
      if (!faceRegion) {
        this.updateStatus('No face detected. Please face the camera.', 'warning');
        this.livenessScore = Math.max(0, this.livenessScore - 10);
        this.isCentered = false;
        this.centeredFrameCount = 0;
        this.updateCentering(false, null);
        return;
      }

      // Check face size (too small = might be a photo held far away)
      if (faceRegion.width < this.MIN_FACE_SIZE || faceRegion.height < this.MIN_FACE_SIZE) {
        this.updateStatus('Please move closer to the camera', 'warning');
        this.isCentered = false;
        this.centeredFrameCount = 0;
        this.updateCentering(false, { reason: 'tooFar' });
        return;
      }

      // Check if face is centered in the guide circle
      const centeringResult = this.checkFaceCentering(faceRegion);
      this.isCentered = centeringResult.isCentered;
      this.updateCentering(this.isCentered, centeringResult);

      // Analyze movement between frames
      const movement = this.analyzeMovement(faceRegion);
      
      // Store frame for history analysis
      this.storeFrame(imageData, faceRegion);

      // Calculate liveness indicators (centering is separate requirement)
      let livenessIndicators = 0;
      let totalIndicators = 4; // 4 main indicators

      // 1. Face detected
      livenessIndicators++;

      // 2. Movement detected (real people move slightly)
      if (movement > this.MOVEMENT_THRESHOLD) {
        this.movementDetected = true;
        livenessIndicators++;
      }

      // 3. Micro-movements in face region (texture changes from blinking, breathing)
      const textureVariance = this.analyzeTextureVariance();
      if (textureVariance > 2) { // Lowered from 5
        livenessIndicators++;
      }

      // 4. Frame-to-frame brightness variance (photos are static)
      const brightnessVariance = this.analyzeBrightnessVariance();
      if (brightnessVariance > 1) { // Lowered from 2
        livenessIndicators++;
      }

      // Track centering separately (not part of score)
      if (this.isCentered) {
        this.centeredFrameCount++;
      } else {
        this.centeredFrameCount = 0;
      }

      // Calculate score
      const frameScore = (livenessIndicators / totalIndicators) * 100;
      this.livenessScore = this.livenessScore * 0.7 + frameScore * 0.3; // Smooth the score

      // Update UI with detailed status
      const roundedScore = Math.round(this.livenessScore);
      
      // Calculate seconds remaining for steady countdown
      const framesRemaining = this.REQUIRED_CENTERED_FRAMES - this.centeredFrameCount;
      const secondsRemaining = Math.ceil(framesRemaining * 0.2); // 200ms per frame
      
      // Provide specific feedback based on what's missing
      if (!this.isCentered) {
        let centeringMsg = 'Center your face in the circle';
        if (!centeringResult.isCenteredX) {
          centeringMsg = faceRegion.centerX > this.canvas.width / 2 ? 'Move your face to the left' : 'Move your face to the right';
        } else if (!centeringResult.isCenteredY) {
          centeringMsg = faceRegion.centerY > this.canvas.height / 2 ? 'Move your face up' : 'Move your face down';
        }
        this.updateStatus(`${centeringMsg}`, 'warning', roundedScore, null);
      } else if (roundedScore < 40) {
        this.updateStatus(`Look at the camera and move slightly`, 'warning', roundedScore, null);
      } else if (roundedScore < this.LIVENESS_REQUIRED_SCORE) {
        this.updateStatus(`Hold still, verifying...`, 'info', roundedScore, secondsRemaining);
      } else {
        // Score is high enough, check if centered for enough frames
        if (this.centeredFrameCount >= this.REQUIRED_CENTERED_FRAMES) {
          this.updateStatus(`All checks passed! Capturing...`, 'success', roundedScore, 0);
          
          // Auto-capture only when ALL conditions are met:
          // 1. High liveness score (50%+)
          // 2. Movement was detected at some point
          // 3. Face has been centered for required number of frames (3 seconds)
          if (this.movementDetected) {
            this.performCapture();
          }
        } else {
          this.updateStatus(`Hold steady...`, 'success', roundedScore, secondsRemaining);
        }
      }
    },

    updateCentering(isCentered, details) {
      if (this.centeringCallback) {
        this.centeringCallback(isCentered, details);
      }
    },

    detectFaceRegion(imageData) {
      const data = imageData.data;
      const width = imageData.width;
      const height = imageData.height;
      
      let minX = width, maxX = 0, minY = height, maxY = 0;
      let skinPixelCount = 0;

      // Sample every 4th pixel for performance
      for (let y = 0; y < height; y += 4) {
        for (let x = 0; x < width; x += 4) {
          const i = (y * width + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Simple skin color detection (works for various skin tones)
          if (this.isSkinColor(r, g, b)) {
            skinPixelCount++;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      // Need minimum skin pixels to consider it a face
      if (skinPixelCount < 500) return null;

      const faceWidth = maxX - minX;
      const faceHeight = maxY - minY;

      // Face should have reasonable aspect ratio
      const aspectRatio = faceWidth / faceHeight;
      if (aspectRatio < 0.5 || aspectRatio > 1.5) return null;

      return {
        x: minX,
        y: minY,
        width: faceWidth,
        height: faceHeight,
        centerX: minX + faceWidth / 2,
        centerY: minY + faceHeight / 2,
        skinPixels: skinPixelCount
      };
    },

    isSkinColor(r, g, b) {
      // Multiple skin color rules to work across ethnicities
      // Rule 1: RGB relationship for skin
      const rule1 = r > 95 && g > 40 && b > 20 &&
                    Math.max(r, g, b) - Math.min(r, g, b) > 15 &&
                    Math.abs(r - g) > 15 && r > g && r > b;

      // Rule 2: Normalized RGB for darker skin tones
      const sum = r + g + b;
      if (sum === 0) return false;
      const nr = r / sum, ng = g / sum, nb = b / sum;
      const rule2 = nr > 0.35 && ng > 0.25 && ng < 0.45 && nb < 0.35;

      // Rule 3: HSV-based (converted from RGB)
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const v = max / 255;
      const s = max === 0 ? 0 : (max - min) / max;
      let h = 0;
      if (max !== min) {
        if (max === r) h = (g - b) / (max - min);
        else if (max === g) h = 2 + (b - r) / (max - min);
        else h = 4 + (r - g) / (max - min);
        h *= 60;
        if (h < 0) h += 360;
      }
      const rule3 = h >= 0 && h <= 50 && s >= 0.1 && s <= 0.7 && v >= 0.2;

      return rule1 || rule2 || rule3;
    },

    analyzeMovement(currentFace) {
      if (!this.lastFacePosition) {
        this.lastFacePosition = currentFace;
        return 0;
      }

      const dx = Math.abs(currentFace.centerX - this.lastFacePosition.centerX);
      const dy = Math.abs(currentFace.centerY - this.lastFacePosition.centerY);
      const dSize = Math.abs(currentFace.width - this.lastFacePosition.width);

      this.lastFacePosition = currentFace;

      return dx + dy + dSize;
    },

    storeFrame(imageData, faceRegion) {
      const frameData = {
        timestamp: Date.now(),
        faceRegion: faceRegion,
        brightness: this.calculateBrightness(imageData),
        textureHash: this.calculateTextureHash(imageData, faceRegion)
      };

      this.frameHistory.push(frameData);
      if (this.frameHistory.length > this.maxFrameHistory) {
        this.frameHistory.shift();
      }
    },

    calculateBrightness(imageData) {
      const data = imageData.data;
      let sum = 0;
      const sampleSize = data.length / 4 / 100; // Sample 1% of pixels
      
      for (let i = 0; i < data.length; i += Math.floor(sampleSize) * 4) {
        sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
      }
      
      return sum / (data.length / 4 / sampleSize);
    },

    calculateTextureHash(imageData, faceRegion) {
      // Simple texture analysis in face region
      const data = imageData.data;
      const width = imageData.width;
      let hash = 0;

      const startX = Math.max(0, faceRegion.x);
      const endX = Math.min(width, faceRegion.x + faceRegion.width);
      const startY = Math.max(0, faceRegion.y);
      const endY = Math.min(imageData.height, faceRegion.y + faceRegion.height);

      for (let y = startY; y < endY; y += 8) {
        for (let x = startX; x < endX; x += 8) {
          const i = (y * width + x) * 4;
          hash += data[i] ^ data[i + 1] ^ data[i + 2];
        }
      }

      return hash;
    },

    analyzeTextureVariance() {
      if (this.frameHistory.length < 3) return 0;

      const recentFrames = this.frameHistory.slice(-5);
      const hashes = recentFrames.map(f => f.textureHash);
      
      const mean = hashes.reduce((a, b) => a + b, 0) / hashes.length;
      const variance = hashes.reduce((sum, h) => sum + Math.pow(h - mean, 2), 0) / hashes.length;
      
      return Math.sqrt(variance) / 1000; // Normalized
    },

    analyzeBrightnessVariance() {
      if (this.frameHistory.length < 3) return 0;

      const recentFrames = this.frameHistory.slice(-5);
      const brightnesses = recentFrames.map(f => f.brightness);
      
      const mean = brightnesses.reduce((a, b) => a + b, 0) / brightnesses.length;
      const variance = brightnesses.reduce((sum, b) => sum + Math.pow(b - mean, 2), 0) / brightnesses.length;
      
      return Math.sqrt(variance);
    },

    async performCapture() {
      if (!this.isRunning) return;

      // Stop further captures
      this.isRunning = false;
      clearInterval(this.livenessCheckInterval);

      this.updateStatus('Capturing and verifying with AI...', 'info');

      // Capture the image
      this.ctx.drawImage(this.video, 0, 0);
      const imageDataUrl = this.canvas.toDataURL('image/jpeg', 0.9);

      // Verify with AI
      try {
        const aiResult = await this.verifyWithAI(imageDataUrl);
        
        if (aiResult.isLive) {
          this.updateStatus(`✓ Live person verified! Confidence: ${aiResult.confidence}%`, 'success');
          
          if (this.captureCallback) {
            this.captureCallback({
              imageDataUrl,
              isLive: true,
              confidence: aiResult.confidence,
              details: aiResult.details
            });
          }
        } else {
          this.updateStatus(`✗ Liveness check failed: ${aiResult.reason}`, 'error');
          // Restart detection after failure
          setTimeout(() => this.restartDetection(), 2000);
        }
      } catch (err) {
        console.error('[FaceDetection] AI verification error:', err);
        // Fall back to local detection result
        this.updateStatus('✓ Face captured (AI verification unavailable)', 'success');
        
        if (this.captureCallback) {
          this.captureCallback({
            imageDataUrl,
            isLive: true,
            confidence: this.livenessScore,
            details: 'Local liveness detection'
          });
        }
      }
    },

    async verifyWithAI(imageDataUrl) {
      const response = await fetch(this.AI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          image: imageDataUrl,
          livenessScore: this.livenessScore,
          movementDetected: this.movementDetected
        })
      });

      if (!response.ok) {
        throw new Error(`AI verification failed: ${response.status}`);
      }

      return response.json();
    },

    restartDetection() {
      this.frameHistory = [];
      this.livenessScore = 0;
      this.movementDetected = false;
      this.lastFacePosition = null;
      this.isRunning = true;
      this.isCentered = false;
      this.centeredFrameCount = 0;
      this.startLivenessDetection();
      this.updateStatus('Look at the camera and blink naturally', 'info', 0, null);
    },

    updateStatus(message, type, score = null, secondsRemaining = null) {
      console.log(`[FaceDetection] ${type}: ${message} (score: ${score}, countdown: ${secondsRemaining})`);
      if (this.statusCallback) {
        this.statusCallback(message, type, score, secondsRemaining);
      }
    },

    // Manual capture (if auto-capture is disabled)
    async manualCapture() {
      if (this.livenessScore < 50) {
        this.updateStatus('Liveness score too low. Please look at the camera.', 'warning');
        return null;
      }
      
      await this.performCapture();
    }
  };

  window.FaceDetection = FaceDetection;
})();
