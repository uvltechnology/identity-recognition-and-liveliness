// Main application coordinator
class IdentityOCRApp {
    constructor() {
        this.initialized = false;
        this.init();
    }

    async init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve);
            });
        }

        // Wait for all modules to be initialized
        await this.waitForModules();

        this.setupGlobalEventHandlers();
        this.checkCameraSupport();
        this.initialized = true;

        console.log('Identity OCR App initialized successfully');
    }

    async waitForModules() {
        // Wait for all required modules to be available
        const maxWaitTime = 5000; // 5 seconds
        const checkInterval = 100; // 100ms
        let elapsed = 0;

        while (elapsed < maxWaitTime) {
            if (window.cameraManager && window.alignmentChecker && window.ocrProcessor) {
                break;
            }
            await new Promise(resolve => setTimeout(resolve, checkInterval));
            elapsed += checkInterval;
        }

        if (!window.cameraManager || !window.alignmentChecker || !window.ocrProcessor) {
            console.error('Failed to initialize all required modules');
            this.showInitializationError();
        }
    }

    setupGlobalEventHandlers() {
        // Handle keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Space bar to capture image (when camera is active)
            if (e.code === 'Space' && window.cameraManager && window.cameraManager.isActive()) {
                e.preventDefault();
                window.cameraManager.captureImage();
            }
            
            // Escape to stop camera
            if (e.code === 'Escape' && window.cameraManager && window.cameraManager.isActive()) {
                window.cameraManager.stopCamera();
            }
        });

        // Handle window resize
        window.addEventListener('resize', this.debounce(() => {
            this.handleResize();
        }, 250));

        // Handle page visibility changes (pause/resume alignment checking)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                if (window.alignmentChecker && window.alignmentChecker.isChecking) {
                    window.alignmentChecker.stopChecking();
                    this.wasCheckingBeforeHidden = true;
                }
            } else {
                if (this.wasCheckingBeforeHidden && window.cameraManager && window.cameraManager.isActive()) {
                    window.alignmentChecker.startChecking();
                }
                this.wasCheckingBeforeHidden = false;
            }
        });

        // Handle before unload (cleanup)
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
    }

    checkCameraSupport() {
        // Camera requires a secure context (HTTPS) on mobile and most browsers
        const isLocalhost = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
        if (!window.isSecureContext && !isLocalhost) {
            this.showInsecureContextMessage();
            return false;
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            this.showCameraUnsupportedMessage();
            return false;
        }
        return true;
    }

    showCameraUnsupportedMessage() {
        const cameraSection = document.querySelector('.camera-section');
        if (cameraSection) {
            const warningDiv = document.createElement('div');
            warningDiv.className = 'camera-warning';
            warningDiv.style.cssText = `
                background: #fff3cd;
                border: 1px solid #ffeaa7;
                color: #856404;
                padding: 15px;
                border-radius: 8px;
                margin-bottom: 20px;
                text-align: center;
            `;
            warningDiv.innerHTML = `
                <strong>Camera Not Supported</strong><br>
                Your browser doesn't support camera access. Please use the file upload feature instead.
            `;
            cameraSection.insertBefore(warningDiv, cameraSection.firstChild);

            // Disable camera controls
            const startBtn = document.getElementById('start-camera');
            const switchBtn = document.getElementById('switch-camera');
            if (startBtn) startBtn.disabled = true;
            if (switchBtn) switchBtn.disabled = true;
        }
    }

    showInsecureContextMessage() {
        const cameraSection = document.querySelector('.camera-section');
        if (!cameraSection) return;

        const httpsSamePort = `https://${window.location.host}${window.location.pathname}`;
        const https4000 = `https://${window.location.hostname}:4000${window.location.pathname}`;

        const warningDiv = document.createElement('div');
        warningDiv.className = 'camera-warning';
        warningDiv.style.cssText = `
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            text-align: center;
        `;
        warningDiv.innerHTML = `
            <strong>Secure Context Required</strong><br>
            Camera access requires HTTPS (or localhost). You're currently on http://${window.location.host}.<br>
            Try opening: <a href="${httpsSamePort}">${httpsSamePort}</a><br>
            ${window.location.port !== '4000' ? `Or: <a href="${https4000}">${https4000}</a><br>` : ''}
            If you see a certificate warning, accept it for local development.
        `;
        cameraSection.insertBefore(warningDiv, cameraSection.firstChild);

        // Disable camera controls
        const startBtn = document.getElementById('start-camera');
        const switchBtn = document.getElementById('switch-camera');
        if (startBtn) startBtn.disabled = true;
        if (switchBtn) switchBtn.disabled = true;
    }

    showInitializationError() {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #f8d7da;
            color: #721c24;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #f5c6cb;
            z-index: 10000;
            max-width: 400px;
            text-align: center;
        `;
        errorDiv.innerHTML = `
            <h3>Initialization Error</h3>
            <p>Some application modules failed to load properly. Please refresh the page to try again.</p>
            <button onclick="location.reload()" style="
                margin-top: 10px;
                padding: 8px 16px;
                background: #dc3545;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
            ">Refresh Page</button>
        `;
        document.body.appendChild(errorDiv);
    }

    handleResize() {
        // Handle responsive adjustments if needed
        console.log('Window resized');
    }

    cleanup() {
        // Clean up resources before page unload
        if (window.cameraManager && window.cameraManager.isActive()) {
            window.cameraManager.stopCamera();
        }
        
        if (window.alignmentChecker && window.alignmentChecker.isChecking) {
            window.alignmentChecker.stopChecking();
        }

        if (window.ocrProcessor && window.ocrProcessor.currentRequest) {
            window.ocrProcessor.currentRequest.abort();
        }
    }

    // Utility functions
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Public API methods
    startCamera() {
        if (window.cameraManager) {
            return window.cameraManager.startCamera();
        }
    }

    stopCamera() {
        if (window.cameraManager) {
            window.cameraManager.stopCamera();
        }
    }

    captureImage() {
        if (window.cameraManager && window.cameraManager.isActive()) {
            return window.cameraManager.captureImage();
        }
    }

    processImage(imageData, type = 'identity') {
        if (window.ocrProcessor) {
            return window.ocrProcessor.processImageData(imageData, type);
        }
    }
}

// Application state and utilities
const AppUtils = {
    // Format file size for display
    formatFileSize(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    },

    // Validate image file
    isValidImageFile(file) {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        const maxSize = 10 * 1024 * 1024; // 10MB
        
        if (!allowedTypes.includes(file.type)) {
            return { valid: false, error: 'Invalid file type. Please select JPEG, PNG, or WebP.' };
        }
        
        if (file.size > maxSize) {
            return { valid: false, error: 'File too large. Maximum size is 10MB.' };
        }
        
        return { valid: true };
    },

    // Show notification
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: bold;
            z-index: 10000;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            animation: slideIn 0.3s ease-out;
        `;

        // Set background color based on type
        const colors = {
            info: '#17a2b8',
            success: '#28a745',
            warning: '#ffc107',
            error: '#dc3545'
        };
        notification.style.background = colors[type] || colors.info;

        notification.textContent = message;
        document.body.appendChild(notification);

        // Auto remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
};

// Add CSS animations for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Initialize the application
window.identityOCRApp = new IdentityOCRApp();

// Expose utilities globally
window.AppUtils = AppUtils;

// Help function for users
window.showHelp = function() {
    const helpText = `
Identity OCR App - Keyboard Shortcuts:
• Space Bar: Capture image (when camera is active)
• Escape: Stop camera
• Click on extracted text to copy to clipboard

Features:
• Visual alignment guide with real-time feedback
• Multiple OCR types: Basic Text, Document Structure, Identity Document
• Camera switching support
• File upload support
• Real-time brightness, focus, and position feedback
`;
    alert(helpText);
};

console.log('Main application script loaded. Type showHelp() for keyboard shortcuts.');
console.log('Use window.identityOCRApp to access the main application instance.');