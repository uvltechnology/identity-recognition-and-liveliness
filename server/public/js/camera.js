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
        this.captureBtn.addEventListener('click', () => {
            this.showCaptureFlash();
            this.captureImage();
        });
        this.switchBtn.addEventListener('click', () => this.switchCamera());
        
        // Handle video metadata loaded
        this.video.addEventListener('loadedmetadata', () => {
            this.setupCanvas();
        });
    }
    
    showCaptureFlash() {
        // Visual feedback when capturing
        const guideRect = document.querySelector('.guide-rectangle');
        if (guideRect) {
            guideRect.style.transition = 'none';
            guideRect.style.backgroundColor = 'rgba(255, 255, 255, 0.6)';
            setTimeout(() => {
                guideRect.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
                guideRect.style.backgroundColor = 'transparent';
            }, 150);
        }
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

        // Draw full video frame to canvas first
        this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);

        // Get the cropped rectangle area
        const croppedImageDataUrl = this.getCroppedRectangleArea();
        
        // Display preview
        this.displayPreview(croppedImageDataUrl);

        // Trigger OCR processing
        if (window.ocrProcessor) {
            window.ocrProcessor.processImageData(croppedImageDataUrl);
        }

        return croppedImageDataUrl;
    }

    getCroppedRectangleArea() {
        // Get guide rectangle element and video element
        const guideRect = document.querySelector('.guide-rectangle');
        const videoElement = this.video;
        const videoContainer = videoElement.parentElement;
        
        // Get the actual bounding rectangles
        const containerRect = videoContainer.getBoundingClientRect();
        const guideRectBounds = guideRect.getBoundingClientRect();
        
        // Get actual video dimensions (source resolution)
        const videoWidth = this.canvas.width;
        const videoHeight = this.canvas.height;
        
        // Get displayed video dimensions
        const displayWidth = containerRect.width;
        const displayHeight = containerRect.height;
        
        // Calculate how the video is being displayed (object-fit: cover)
        // The video might be cropped to fill the container
        let sourceX = 0, sourceY = 0, sourceWidth = videoWidth, sourceHeight = videoHeight;
        
        const videoAspect = videoWidth / videoHeight;
        const containerAspect = displayWidth / displayHeight;
        
        if (videoAspect > containerAspect) {
            // Video is wider - sides are cropped
            sourceWidth = videoHeight * containerAspect;
            sourceX = (videoWidth - sourceWidth) / 2;
        } else {
            // Video is taller - top/bottom are cropped
            sourceHeight = videoWidth / containerAspect;
            sourceY = (videoHeight - sourceHeight) / 2;
        }
        
        // Calculate rectangle position relative to container
        const rectLeft = guideRectBounds.left - containerRect.left;
        const rectTop = guideRectBounds.top - containerRect.top;
        const rectWidth = guideRectBounds.width;
        const rectHeight = guideRectBounds.height;
        
        // Calculate scale from display to source
        const scaleX = sourceWidth / displayWidth;
        const scaleY = sourceHeight / displayHeight;
        
        // Calculate crop coordinates in source video
        const cropX = Math.floor(sourceX + (rectLeft * scaleX));
        const cropY = Math.floor(sourceY + (rectTop * scaleY));
        const cropWidth = Math.floor(rectWidth * scaleX);
        const cropHeight = Math.floor(rectHeight * scaleY);
        
        // Ensure crop is within bounds
        const finalCropX = Math.max(0, Math.min(cropX, videoWidth - 1));
        const finalCropY = Math.max(0, Math.min(cropY, videoHeight - 1));
        const finalCropWidth = Math.min(cropWidth, videoWidth - finalCropX);
        const finalCropHeight = Math.min(cropHeight, videoHeight - finalCropY);
        
        console.log('Crop Info:', {
            video: { width: videoWidth, height: videoHeight },
            display: { width: displayWidth, height: displayHeight },
            source: { x: sourceX, y: sourceY, width: sourceWidth, height: sourceHeight },
            crop: { x: finalCropX, y: finalCropY, width: finalCropWidth, height: finalCropHeight },
            rectangle: { left: rectLeft, top: rectTop, width: rectWidth, height: rectHeight }
        });
        
        // Get the cropped image data
        const croppedImageData = this.ctx.getImageData(
            finalCropX, 
            finalCropY, 
            finalCropWidth, 
            finalCropHeight
        );
        
        // Create a new canvas for the cropped image
        const croppedCanvas = document.createElement('canvas');
        croppedCanvas.width = finalCropWidth;
        croppedCanvas.height = finalCropHeight;
        const croppedCtx = croppedCanvas.getContext('2d', { 
            alpha: false,
            desynchronized: true 
        });
        
        // Put the cropped image data onto the new canvas
        croppedCtx.putImageData(croppedImageData, 0, 0);
        
        // Apply sharpening filter for better readability
        this.sharpenImage(croppedCtx, finalCropWidth, finalCropHeight);
        
        // Convert to data URL with maximum quality for OCR readability
        return croppedCanvas.toDataURL('image/jpeg', 1.0);
    }
    
    sharpenImage(ctx, width, height) {
        // Get image data
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        // Create a copy for processing
        const copy = new Uint8ClampedArray(data);
        
        // Sharpening kernel
        const kernel = [
            0, -1, 0,
            -1, 5, -1,
            0, -1, 0
        ];
        
        // Apply sharpening (simple convolution)
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                for (let c = 0; c < 3; c++) { // RGB channels only
                    let sum = 0;
                    for (let ky = -1; ky <= 1; ky++) {
                        for (let kx = -1; kx <= 1; kx++) {
                            const idx = ((y + ky) * width + (x + kx)) * 4 + c;
                            const kernelIdx = (ky + 1) * 3 + (kx + 1);
                            sum += copy[idx] * kernel[kernelIdx];
                        }
                    }
                    const idx = (y * width + x) * 4 + c;
                    data[idx] = Math.max(0, Math.min(255, sum));
                }
            }
        }
        
        // Put sharpened image back
        ctx.putImageData(imageData, 0, 0);
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