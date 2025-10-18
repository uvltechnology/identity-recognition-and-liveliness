class CameraManager {
    constructor() {
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.stream = null;
        this.currentDeviceId = null;
        this.devices = [];
        
        this.initializeElements();
        this.setupEventListeners();
    }

    initializeElements() {
        this.startBtn = document.getElementById('start-camera');
        this.captureBtn = document.getElementById('capture-btn');
        this.switchBtn = document.getElementById('switch-camera');
    }

    setupEventListeners() {
        this.startBtn.addEventListener('click', () => this.startCamera());
        this.captureBtn.addEventListener('click', () => this.captureImage());
        this.switchBtn.addEventListener('click', () => this.switchCamera());
        
        // Handle video metadata loaded
        this.video.addEventListener('loadedmetadata', () => {
            this.setupCanvas();
        });
    }

    async getAvailableCameras() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            this.devices = devices.filter(device => device.kind === 'videoinput');
            return this.devices;
        } catch (error) {
            console.error('Error enumerating devices:', error);
            return [];
        }
    }

    async startCamera(deviceId = null) {
        try {
            // Stop existing stream
            if (this.stream) {
                this.stopCamera();
            }

            // Get available cameras first
            await this.getAvailableCameras();

            // Set constraints
            const constraints = {
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'environment' // Prefer back camera for document scanning
                }
            };

            // Use specific device if provided
            if (deviceId) {
                constraints.video.deviceId = { exact: deviceId };
                delete constraints.video.facingMode;
            } else if (this.currentDeviceId) {
                constraints.video.deviceId = { exact: this.currentDeviceId };
                delete constraints.video.facingMode;
            }

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;

            // Update current device ID
            const videoTrack = this.stream.getVideoTracks()[0];
            this.currentDeviceId = videoTrack.getSettings().deviceId;

            // Update UI
            this.startBtn.textContent = 'Stop Camera';
            this.startBtn.classList.remove('btn-primary');
            this.startBtn.classList.add('btn-secondary');
            this.captureBtn.disabled = false;
            this.switchBtn.disabled = this.devices.length <= 1;

            console.log('Camera started successfully');
            
            // Start alignment checking
            if (window.alignmentChecker) {
                window.alignmentChecker.startChecking();
            }

        } catch (error) {
            console.error('Error accessing camera:', error);
            this.handleCameraError(error);
        }
    }

    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
            this.video.srcObject = null;
        }

        // Stop alignment checking
        if (window.alignmentChecker) {
            window.alignmentChecker.stopChecking();
        }

        // Update UI
        this.startBtn.textContent = 'Start Camera';
        this.startBtn.classList.remove('btn-secondary');
        this.startBtn.classList.add('btn-primary');
        this.captureBtn.disabled = true;
        this.switchBtn.disabled = true;
    }

    async switchCamera() {
        if (this.devices.length <= 1) return;

        const currentIndex = this.devices.findIndex(device => device.deviceId === this.currentDeviceId);
        const nextIndex = (currentIndex + 1) % this.devices.length;
        const nextDevice = this.devices[nextIndex];

        await this.startCamera(nextDevice.deviceId);
    }

    setupCanvas() {
        // Set canvas dimensions to match video
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
    }

    captureImage() {
        if (!this.stream || this.video.videoWidth === 0) {
            console.error('Camera not ready');
            return null;
        }

        // Ensure canvas is properly sized
        this.setupCanvas();

        // Draw video frame to canvas
        this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);

        // Get image data
        const imageDataUrl = this.canvas.toDataURL('image/jpeg', 0.9);
        
        // Display preview
        this.displayPreview(imageDataUrl);

        // Trigger OCR processing
        if (window.ocrProcessor) {
            window.ocrProcessor.processImageData(imageDataUrl);
        }

        return imageDataUrl;
    }

    displayPreview(imageDataUrl) {
        const previewImg = document.getElementById('preview-image');
        const noImageDiv = previewImg.parentElement.querySelector('.no-image');
        
        previewImg.src = imageDataUrl;
        previewImg.style.display = 'block';
        if (noImageDiv) {
            noImageDiv.style.display = 'none';
        }
    }

    handleCameraError(error) {
        let message = 'Failed to access camera. ';
        
        if (error.name === 'NotAllowedError') {
            message += 'Please allow camera access and try again.';
        } else if (error.name === 'NotFoundError') {
            message += 'No camera found on this device.';
        } else if (error.name === 'NotReadableError') {
            message += 'Camera is already in use by another application.';
        } else {
            message += error.message || 'Unknown error occurred.';
        }

        alert(message);
        console.error('Camera error:', error);
    }

    // Get current video frame as canvas for analysis
    getCurrentFrame() {
        if (!this.stream || this.video.videoWidth === 0) {
            return null;
        }

        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        tempCanvas.width = this.video.videoWidth;
        tempCanvas.height = this.video.videoHeight;
        
        tempCtx.drawImage(this.video, 0, 0, tempCanvas.width, tempCanvas.height);
        
        return tempCanvas;
    }

    // Check if camera is active
    isActive() {
        return this.stream !== null && this.video.srcObject !== null;
    }
}

// Initialize camera manager when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.cameraManager = new CameraManager();
    });
} else {
    window.cameraManager = new CameraManager();
}