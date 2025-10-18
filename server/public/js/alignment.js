class AlignmentChecker {
    constructor() {
        this.isChecking = false;
        this.checkInterval = null;
        this.lastFrameTime = 0;
        this.frameRate = 10; // Check 10 times per second
        
        // Auto-capture countdown
        this.autoCaptureEnabled = true;
        this.autoCaptureCountdown = 0;
        this.autoCaptureTarget = 3; // 3 seconds
        this.lastStatus = null;
        this.countdownInterval = null;
        
        this.initializeElements();
        this.setupThresholds();
    }

    initializeElements() {
        this.guideRectangle = document.querySelector('.guide-rectangle');
        this.feedbackContainer = document.getElementById('alignment-feedback');
        this.feedbackMessage = this.feedbackContainer?.querySelector('.feedback-message');
    }

    setupThresholds() {
        this.thresholds = {
            brightness: {
                min: 50,
                max: 200,
                optimal: { min: 80, max: 180 }
            },
            focus: {
                minVariance: 100, // Minimum variance for good focus
                optimalVariance: 300
            },
            position: {
                centerTolerance: 0.15, // 15% tolerance from center
                sizeTolerance: 0.2 // 20% size tolerance
            }
        };
    }

    startChecking() {
        if (this.isChecking) return;
        
        this.isChecking = true;
        this.checkInterval = setInterval(() => {
            this.performAlignmentCheck();
        }, 1000 / this.frameRate);
        
        // Reset countdown when starting
        this.resetCountdown();
        
        console.log('Alignment checking started');
    }

    stopChecking() {
        if (!this.isChecking) return;
        
        this.isChecking = false;
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        
        this.resetCountdown();
        this.resetFeedback();
        console.log('Alignment checking stopped');
    }
    
    resetCountdown() {
        this.autoCaptureCountdown = 0;
        this.lastStatus = null;
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
    }
    
    startCountdown() {
        if (this.countdownInterval) return; // Already counting
        
        this.autoCaptureCountdown = this.autoCaptureTarget;
        
        this.countdownInterval = setInterval(() => {
            this.autoCaptureCountdown--;
            
            if (this.autoCaptureCountdown <= 0) {
                this.performAutoCapture();
                this.resetCountdown();
            } else {
                // Update UI with countdown
                this.updateCountdownUI();
            }
        }, 1000);
        
        this.updateCountdownUI();
    }
    
    performAutoCapture() {
        console.log('Auto-capturing image...');
        
        // Trigger capture through camera manager
        if (window.cameraManager && window.cameraManager.isActive()) {
            window.cameraManager.captureImage();
            
            // Visual feedback
            if (this.feedbackMessage) {
                const originalMessage = this.feedbackMessage.textContent;
                this.feedbackMessage.textContent = '✓ Image captured!';
                
                setTimeout(() => {
                    this.feedbackMessage.textContent = originalMessage;
                }, 2000);
            }
        }
    }
    
    updateCountdownUI() {
        if (this.feedbackMessage) {
            this.feedbackMessage.textContent = `Auto-capturing in ${this.autoCaptureCountdown}...`;
            this.feedbackMessage.style.color = '#4CAF50';
        }
        
        // Update guide text
        const guideText = this.guideRectangle?.querySelector('.guide-text');
        if (guideText) {
            guideText.textContent = `${this.autoCaptureCountdown}...`;
            guideText.style.color = '#4CAF50';
            guideText.style.fontSize = '1.5rem';
            guideText.style.fontWeight = '700';
        }
    }

    performAlignmentCheck() {
        if (!window.cameraManager || !window.cameraManager.isActive()) {
            return;
        }

        const frame = window.cameraManager.getCurrentFrame();
        if (!frame) return;

        const checks = {
            brightness: this.checkBrightness(frame),
            focus: this.checkFocus(frame),
            position: this.checkPosition(frame)
        };

        this.updateFeedback(checks);
    }

    checkBrightness(canvas) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        let totalBrightness = 0;
        const pixelCount = data.length / 4;
        
        for (let i = 0; i < data.length; i += 4) {
            // Calculate luminance using standard formula
            const luminance = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            totalBrightness += luminance;
        }
        
        const averageBrightness = totalBrightness / pixelCount;
        
        let status = 'good';
        let message = 'Good lighting';
        
        if (averageBrightness < this.thresholds.brightness.min) {
            status = 'error';
            message = 'Too dark';
        } else if (averageBrightness > this.thresholds.brightness.max) {
            status = 'error';
            message = 'Too bright';
        } else if (averageBrightness < this.thresholds.brightness.optimal.min || 
                   averageBrightness > this.thresholds.brightness.optimal.max) {
            status = 'warning';
            message = 'Adjust lighting';
        }
        
        return { status, message, value: averageBrightness };
    }

    checkFocus(canvas) {
        const ctx = canvas.getContext('2d');
        
        // Sample a region from the center of the frame
        const centerX = canvas.width * 0.3;
        const centerY = canvas.height * 0.3;
        const sampleWidth = canvas.width * 0.4;
        const sampleHeight = canvas.height * 0.4;
        
        const imageData = ctx.getImageData(centerX, centerY, sampleWidth, sampleHeight);
        const data = imageData.data;
        
        // Convert to grayscale and calculate variance (measure of focus)
        const grayscale = [];
        for (let i = 0; i < data.length; i += 4) {
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            grayscale.push(gray);
        }
        
        // Calculate variance using Laplacian operator
        const variance = this.calculateLaplacianVariance(grayscale, sampleWidth, sampleHeight);
        
        let status = 'good';
        let message = 'Good focus';
        
        if (variance < this.thresholds.focus.minVariance) {
            status = 'error';
            message = 'Out of focus';
        } else if (variance < this.thresholds.focus.optimalVariance) {
            status = 'warning';
            message = 'Adjust focus';
        }
        
        return { status, message, value: variance };
    }

    calculateLaplacianVariance(grayscale, width, height) {
        let variance = 0;
        const kernel = [0, -1, 0, -1, 4, -1, 0, -1, 0];
        
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                let sum = 0;
                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const pixelIndex = (y + ky) * width + (x + kx);
                        const kernelIndex = (ky + 1) * 3 + (kx + 1);
                        sum += grayscale[pixelIndex] * kernel[kernelIndex];
                    }
                }
                variance += sum * sum;
            }
        }
        
        return variance / ((width - 2) * (height - 2));
    }

    checkPosition(canvas) {
        // For position checking, we'll analyze if there's content in the guide rectangle area
        // This is a simplified version - in production, you might use edge detection
        
        const ctx = canvas.getContext('2d');
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const guideWidth = canvas.width * 0.7;
        const guideHeight = canvas.height * 0.6;
        
        // Sample the guide rectangle area
        const sampleX = centerX - guideWidth / 2;
        const sampleY = centerY - guideHeight / 2;
        
        const imageData = ctx.getImageData(sampleX, sampleY, guideWidth, guideHeight);
        const data = imageData.data;
        
        // Calculate edge density as a proxy for document presence
        let edgePixels = 0;
        const totalPixels = imageData.width * imageData.height;
        
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            // Simple edge detection: look for high contrast changes
            if (i > 4 * imageData.width && i < data.length - 4 * imageData.width) {
                const prevR = data[i - 4 * imageData.width];
                const nextR = data[i + 4 * imageData.width];
                
                if (Math.abs(r - prevR) > 30 || Math.abs(r - nextR) > 30) {
                    edgePixels++;
                }
            }
        }
        
        const edgeDensity = edgePixels / totalPixels;
        
        let status = 'good';
        let message = 'Well positioned';
        
        if (edgeDensity < 0.02) {
            status = 'error';
            message = 'No document detected';
        } else if (edgeDensity < 0.05) {
            status = 'warning';
            message = 'Center document';
        }
        
        return { status, message, value: edgeDensity };
    }

    updateFeedback(checks) {
        // Update overall feedback message and guide rectangle
        const overallStatus = this.calculateOverallStatus(checks);
        
        // Check if status changed - if so, reset countdown
        if (this.lastStatus !== overallStatus) {
            this.resetCountdown();
            this.lastStatus = overallStatus;
            
            // Start countdown if status is good
            if (overallStatus === 'good' && this.autoCaptureEnabled) {
                this.startCountdown();
            }
        }
        
        // Only update UI if not in countdown mode
        if (this.autoCaptureCountdown === 0 || overallStatus !== 'good') {
            this.updateOverallFeedback(overallStatus, checks);
        }
    }

    calculateOverallStatus(checks) {
        const statuses = [checks.brightness.status, checks.focus.status, checks.position.status];
        
        if (statuses.includes('error')) {
            return 'error';
        } else if (statuses.includes('warning')) {
            return 'warning';
        } else {
            return 'good';
        }
    }

    updateOverallFeedback(status, checks) {
        // Update guide rectangle appearance with new status classes
        this.guideRectangle.classList.remove('status-good', 'status-warning', 'status-error');
        
        if (status === 'good') {
            this.guideRectangle.classList.add('status-good');
        } else if (status === 'warning') {
            this.guideRectangle.classList.add('status-warning');
        } else if (status === 'error') {
            this.guideRectangle.classList.add('status-error');
        }
        
        // Update feedback message with color coding
        let message = '';
        const errorChecks = Object.values(checks).filter(check => check.status === 'error');
        const warningChecks = Object.values(checks).filter(check => check.status === 'warning');
        
        if (errorChecks.length > 0) {
            message = errorChecks[0].message;
        } else if (warningChecks.length > 0) {
            message = warningChecks[0].message;
        } else {
            message = 'Perfect! Ready to capture';
        }
        
        if (this.feedbackMessage) {
            this.feedbackMessage.textContent = message;
            
            // Color code the message based on status
            if (status === 'good') {
                this.feedbackMessage.style.color = '#4CAF50';
            } else if (status === 'error') {
                this.feedbackMessage.style.color = '#F44336';
            } else {
                this.feedbackMessage.style.color = '#FFC107';
            }
        }
        
        // Update guide text
        const guideText = this.guideRectangle.querySelector('.guide-text');
        if (guideText) {
            if (status === 'good') {
                guideText.textContent = 'Ready to capture!';
                guideText.style.color = '#4CAF50';
                guideText.style.fontSize = '';
                guideText.style.fontWeight = '';
            } else if (status === 'error') {
                guideText.textContent = 'Adjust camera';
                guideText.style.color = '#F44336';
                guideText.style.fontSize = '';
                guideText.style.fontWeight = '';
            } else {
                guideText.textContent = 'Position document here';
                guideText.style.color = '#FFC107';
                guideText.style.fontSize = '';
                guideText.style.fontWeight = '';
            }
        }
    }

    resetFeedback() {
        // Reset guide rectangle to default (white border)
        this.guideRectangle.classList.remove('status-good', 'status-warning', 'status-error');
        
        // Reset feedback message
        if (this.feedbackMessage) {
            this.feedbackMessage.textContent = 'Center your document';
        }
        
        // Reset guide text
        const guideText = this.guideRectangle.querySelector('.guide-text');
        if (guideText) {
            guideText.textContent = 'Position document here';
            guideText.style.color = 'white';
        }
    }
}

// Initialize alignment checker when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.alignmentChecker = new AlignmentChecker();
    });
} else {
    window.alignmentChecker = new AlignmentChecker();
}