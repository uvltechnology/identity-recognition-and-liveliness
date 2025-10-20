class CameraManager {
    constructor() {
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.stream = null;
        this.currentDeviceId = null;
        this.devices = [];
        
        this.initializeElements();
        // Per-ID Region of Interest to avoid scanning noisy areas (e.g., UMID signature strip)
        this.ROI_CONFIG = {
            'umid': { enabled: true, rect: { x: 0, y: 0, w: 1, h: 0.80 } },
            'passport': { enabled: false },
            'national-id': { enabled: false }
        };
        this.setupEventListeners();
    }

    initializeElements() {
        this.startBtn = document.getElementById('start-camera');
        this.switchBtn = document.getElementById('switch-camera');
        this.recaptureBtn = document.getElementById('recapture-btn');
    }

    setupEventListeners() {
        this.startBtn.addEventListener('click', () => {
            this.startCamera();
            this.startBtn.style.display = 'none'; // Hide start button
            this.switchBtn.style.display = 'inline-flex'; // Show switch button
        });
        
        this.switchBtn.addEventListener('click', () => this.switchCamera());
        
        this.recaptureBtn.addEventListener('click', () => {
            // Clear extracted details before new capture
            if (window.ocrProcessor && typeof window.ocrProcessor.clearExtractedDetails === 'function') {
                window.ocrProcessor.clearExtractedDetails();
            }
            this.recaptureBtn.style.display = 'none'; // Hide recapture button
            this.startBtn.style.display = 'inline-flex'; // Show start button
            this.startBtn.click(); // Trigger start camera
        });
        
        // Handle video metadata loaded
        this.video.addEventListener('loadedmetadata', () => {
            this.setupCanvas();
            // Size guide rectangle after video metadata is available
            if (window.identityOCRApp && typeof window.identityOCRApp.sizeGuideRectangle === 'function') {
                window.identityOCRApp.sizeGuideRectangle();
            }
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
            this.switchBtn.disabled = this.devices.length <= 1;
            this.switchBtn.style.display = 'inline-flex'; // Show switch button

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

        // Update UI - Hide camera buttons, show recapture
        this.startBtn.style.display = 'none';
        this.switchBtn.style.display = 'none';
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

        // Stop camera after capture and show recapture button
        setTimeout(() => {
            this.stopCamera();
            this.recaptureBtn.style.display = 'inline-flex'; // Show recapture button
        }, 500); // Small delay to ensure capture completes

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

        // Apply optional Region of Interest (ROI) based on selected ID type
        const idTypeEl = document.getElementById('id-type');
        const idType = idTypeEl?.value || 'national-id';
        const roiCfg = this.ROI_CONFIG[idType];
        let workCanvas = croppedCanvas;
        if (roiCfg?.enabled && roiCfg.rect) {
            workCanvas = this.cropToROI(croppedCanvas, roiCfg.rect);
        }

        // Prepare context and dimensions after ROI
        const wctx = workCanvas.getContext('2d', { alpha: false, desynchronized: true });
        const w = workCanvas.width;
        const h = workCanvas.height;
        
        // Adaptive lighting for dark images (improves readability on dark skin/low exposure)
        this.applyAdaptiveLighting(wctx, w, h);

        // Apply sharpening filter for better readability
        this.sharpenImage(wctx, w, h);
        
        // Convert to data URL with maximum quality for OCR readability
        return workCanvas.toDataURL('image/jpeg', 1.0);
    }

    // Crop a canvas to an ROI defined with normalized coordinates (0..1)
    cropToROI(srcCanvas, roi) {
        if (!srcCanvas || !roi) return srcCanvas;
        const sw = srcCanvas.width, sh = srcCanvas.height;
        const sx = Math.max(0, Math.min(sw, Math.round((roi.x ?? 0) * sw)));
        const sy = Math.max(0, Math.min(sh, Math.round((roi.y ?? 0) * sh)));
        const swidth = Math.max(1, Math.min(sw - sx, Math.round((roi.w ?? 1) * sw)));
        const sheight = Math.max(1, Math.min(sh - sy, Math.round((roi.h ?? 1) * sh)));

        const out = document.createElement('canvas');
        out.width = swidth;
        out.height = sheight;
        const octx = out.getContext('2d', { alpha: false, desynchronized: true });
        octx.drawImage(srcCanvas, sx, sy, swidth, sheight, 0, 0, swidth, sheight);
        return out;
    }
    
    // Analyze luminance and brighten/contrast-adjust if the crop is dark
    applyAdaptiveLighting(ctx, width, height) {
        try {
            const imageData = ctx.getImageData(0, 0, width, height);
            const data = imageData.data;

            // Compute average luminance (Rec. 709)
            let sumLum = 0;
            const n = width * height;
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i], g = data[i + 1], b = data[i + 2];
                const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                sumLum += lum;
            }
            const avgLum = sumLum / n;

            // Determine adjustments based on brightness
            // avgLum ~0..255. Below 80 -> strong brighten, below 110 -> mild
            let gammaExp = 1.0; // exponent < 1 brightens
            let contrast = 1.0; // linear contrast factor
            let bias = 0;       // brightness bias
            if (avgLum < 80) {
                gammaExp = 0.7;
                contrast = 1.15;
                bias = 10;
            } else if (avgLum < 110) {
                gammaExp = 0.85;
                contrast = 1.08;
                bias = 6;
            } else {
                // No change for already bright images
                return;
            }

            // Build LUTs for gamma and linear adjustment
            const gammaLut = new Uint8ClampedArray(256);
            for (let v = 0; v < 256; v++) {
                // Gamma brighten: exponent < 1 boosts shadows
                const g = Math.pow(v / 255, gammaExp) * 255;
                gammaLut[v] = g > 255 ? 255 : (g < 0 ? 0 : g);
            }

            // Apply adjustments
            for (let i = 0; i < data.length; i += 4) {
                let r = gammaLut[data[i]];
                let g = gammaLut[data[i + 1]];
                let b = gammaLut[data[i + 2]];
                // Contrast around mid-point 128 + bias
                r = (r - 128) * contrast + 128 + bias;
                g = (g - 128) * contrast + 128 + bias;
                b = (b - 128) * contrast + 128 + bias;
                data[i]     = r < 0 ? 0 : r > 255 ? 255 : r;
                data[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
                data[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
                // Preserve alpha
            }

            ctx.putImageData(imageData, 0, 0);
        } catch (e) {
            console.warn('Adaptive lighting skipped:', e);
        }
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