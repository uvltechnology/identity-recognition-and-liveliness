class OCRProcessor {
    constructor() {
        this.apiBaseUrl = window.location.origin + '/api/ocr';
        this.currentRequest = null;
        this.surnameVariants = null; // cached list from server JSON
        this.nameVariants = null; // cached NAME label variants JSON
        this.middleVariants = null; // cached MIDDLE label variants JSON
        
        this.initializeElements();
        this.setupEventListeners();
        // Lazy-load surname variants
        this.loadSurnameVariants();
        // Lazy-load name variants
        this.loadNameVariants();
        // Lazy-load middle variants
        this.loadMiddleVariants();
        // Debug mode: when enabled, show raw OCR blocks and preview image for troubleshooting
        this.debugMode = this.detectDebugMode();
    }

    initializeElements() {
        this.loadingElement = document.getElementById('loading');
        this.resultsContainer = document.getElementById('results-container');
        this.ocrTypeSelect = document.getElementById('ocr-type');
        this.previewImage = document.getElementById('preview-image');
        // Hide preview image by default in embed unless debugMode is enabled
        try { if (this.previewImage && typeof this.debugMode !== 'undefined' && !this.debugMode) this.previewImage.style.display = 'none'; } catch (e) {}
    }

    setupEventListeners() {
        // No file upload listeners needed
    }

    async loadSurnameVariants() {
        try {
            const url = `${window.location.origin}/json/surname_one_edit_28chars.array.json`;
            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) return;
            const arr = await res.json();
            if (Array.isArray(arr)) {
                // Normalize: uppercase and trim
                this.surnameVariants = new Set(arr.map(s => String(s || '').toUpperCase().trim()));
                this.surnameVariants.add('SURNAME');
            }
        } catch (e) {
            console.warn('Failed to load surname variants JSON:', e);
        }
    }

    async loadNameVariants() {
        try {
            const url = `${window.location.origin}/json/name_one_edit_28chars.array.json`;
            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) return;
            const arr = await res.json();
            if (Array.isArray(arr)) {
                this.nameVariants = new Set(arr.map(s => String(s || '').toUpperCase().trim()));
                this.nameVariants.add('NAME');
                this.nameVariants.add('NAMES');
            }
        } catch (e) {
            console.warn('Failed to load name variants JSON:', e);
        }
    }

    async loadMiddleVariants() {
        try {
            const url = `${window.location.origin}/json/middle_one_edit_28chars.array.json`;
            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) return;
            const arr = await res.json();
            if (Array.isArray(arr)) {
                this.middleVariants = new Set(arr.map(s => String(s || '').toUpperCase().trim()));
                this.middleVariants.add('MIDDLE');
                this.middleVariants.add('MIDDLENAME');
            }
        } catch (e) {
            console.warn('Failed to load middle variants JSON:', e);
        }
    }

    detectDebugMode() {
        try {
            const params = new URLSearchParams(window.location.search || '');
            if (params.get('debug') === 'true') return true;
            if (typeof window.__IDENTITY_DEBUG__ !== 'undefined') return !!window.__IDENTITY_DEBUG__;
        } catch (e) {
            // ignore
        }
        return false;
    }

    async processImageData(imageDataUrl) {
        const ocrType = this.ocrTypeSelect.value;
        // keep the last processed data URL so embed/camera flows can include the inline image without requiring server storage
        try { this.lastImageDataUrl = imageDataUrl; } catch (e) { /* ignore */ }

        const requestData = {
            image: imageDataUrl,
            type: ocrType
        };

        await this.processWithAPI(requestData, ocrType);
    }

    async processWithAPI(data, ocrType) {
        // Cancel previous request if still pending
        if (this.currentRequest) {
            this.currentRequest.abort();
        }

        this.showLoading();

        try {
            const endpoint = `${this.apiBaseUrl}/base64`;
            
            // Include session id if present so server can associate/store the image and OCR
            try { if (window.__IDENTITY_SESSION__) data.sessionId = window.__IDENTITY_SESSION__; } catch (e) {}
            const requestOptions = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            };

            // Create AbortController for request cancellation
            const controller = new AbortController();
            requestOptions.signal = controller.signal;
            this.currentRequest = controller;

            console.log(`Making OCR request to: ${endpoint}`);
            const response = await fetch(endpoint, requestOptions);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            this.displayResults(result, ocrType);

        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Request aborted');
                return;
            }
            
            console.error('OCR processing error:', error);
            this.displayError(error.message);
        } finally {
            this.hideLoading();
            this.currentRequest = null;
        }
    }

    showLoading() {
        this.loadingElement.style.display = 'flex';
        this.resultsContainer.innerHTML = '<div class="no-results">Processing...</div>';
    }

    hideLoading() {
        this.loadingElement.style.display = 'none';
    }

    displayResults(result, ocrType) {
        this.resultsContainer.innerHTML = '';

        if (!result.success) {
            this.displayError(result.error || 'OCR processing failed');
            return;
        }

        const container = document.createElement('div');

        if (ocrType === 'identity') {
            this.displayIdentityResults(container, result);
        } else if (ocrType === 'document') {
            this.displayDocumentResults(container, result);
        } else {
            this.displayTextResults(container, result);
        }

        this.resultsContainer.appendChild(container);
    }

    displayTextResults(container, result) {
        // Basic text results
        const textSection = this.createResultSection('Extracted Text', result.text || 'No text detected');
        container.appendChild(textSection);

        if (result.words && result.words.length > 0) {
            const wordsSection = this.createResultSection(
                `Word Analysis (${result.words.length} words found)`,
                this.formatWordsList(result.words)
            );
            container.appendChild(wordsSection);
        }
    }

    displayDocumentResults(container, result) {
        // Structured document results
        const textSection = this.createResultSection('Full Document Text', result.text || 'No text detected');
        container.appendChild(textSection);

        if (result.pages && result.pages.length > 0) {
            result.pages.forEach((page, pageIndex) => {
                const pageSection = this.createResultSection(
                    `Page ${pageIndex + 1} Structure`,
                    this.formatPageStructure(page)
                );
                container.appendChild(pageSection);
            });
        }
    }

    async displayIdentityResults(container, result) {
        const applyNationalIdRules = this.isNationalIdSelected();
        const applyPassportRules = this.isPassportSelected();
        // UMID condition: flips true only when the "ID Type" dropdown (#id-type) value is 'umid'
        // This toggles all UMID-specific extraction in fillUmidFromWords()
        const applyUmidRules = this.isUmidSelected();
        // Display extracted identity fields first
        if (result.fields) {
            // Populate the details form from server-side extracted fields
            if (applyNationalIdRules) {
                this.fillDetailsForm({
                    idType: 'national-id',
                    firstName: result?.fields?.firstName,
                    lastName: result?.fields?.lastName,
                    birthDate: result?.fields?.birthDate,
                    idNumber: result?.fields?.idNumber,
                });

                // Evaluate whether required fields exist; if missing, prompt recapture
                const required = ['firstName', 'lastName', 'idNumber'];
                const missing = required.filter(k => !result.fields || !result.fields[k]);

                if (missing.length > 0) {
                    // Show recapture flow: prompt user to try again
                    this.showRecapturePrompt(missing);
                } else {
                    // All required fields present — show final details-only view
                    this.showFinalDetailsOnly(result.fields);

                    // Also show a modal with the results inside the iframe for immediate feedback
                    try {
                        this.showResultModal(result.fields || {});
                    } catch (e) { console.warn('showResultModal failed', e); }

                    // If success webhook configured, POST the result
                    try {
                        const successUrl = window.__IDENTITY_SUCCESS_URL__ || null;
                        if (successUrl) {
                            fetch(successUrl, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ session: window.__IDENTITY_SESSION__ || null, fields: result.fields })
                            }).catch(err => console.warn('Failed to POST success webhook', err));
                        }
                    } catch (e) { console.warn('webhook post failed', e); }

                    // Also notify the identity server about the completed session so it can persist and dispatch any configured webhooks
                    try {
                        const sid = window.__IDENTITY_SESSION__ || null;
                        if (sid) {
                            const url = `/api/verify/session/${encodeURIComponent(sid)}/result`;
                            fetch(url, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ status: 'done', result: { fields: result.fields }, finishedAt: new Date().toISOString() })
                            }).catch(err => console.warn('Failed to notify server of session completion', err));
                        }
                    } catch (e) { console.warn('session completion notify failed', e); }

                    // Notify parent window (if embed) with a close action
                    try {
                        if (window.parent && window.parent !== window) {
                            // Fetch the captured image info (including data URL when available) from session temp endpoint
                            const sid = window.__IDENTITY_SESSION__ || null;
                            let capturedImageUrl = null;
                            let capturedImageData = null;

                            if (sid) {
                                try {
                                    const tempResponse = await fetch(`/api/verify/session/${encodeURIComponent(sid)}/temp`);
                                    if (tempResponse.ok) {
                                        const tempData = await tempResponse.json();
                                        capturedImageUrl = tempData.imageUrl || null;
                                        capturedImageData = tempData.imageData || null; // data URL (base64) when available
                                    }
                                } catch (e) {
                                    console.warn('Failed to fetch captured image info', e);
                                }
                            }

                            // If we have a local last processed image (camera flow), prefer that inline data URL
                            try {
                                if (!capturedImageData && this.lastImageDataUrl) {
                                    capturedImageData = this.lastImageDataUrl;
                                }
                            } catch (e) { /* ignore */ }

                            // Ensure the captured image data (when available) is present in the result fields
                            try {
                                if (capturedImageData) {
                                    result.fields = result.fields || {};
                                    // canonical field name: captureidimagebase64 (base64 data URL)
                                    result.fields.captureidimagebase64 = capturedImageData;
                                }
                            } catch (e) { /* ignore */ }

                            const payload = {
                                success: true,
                                type: 'identity',
                                session: window.__IDENTITY_SESSION__ || null,
                                fields: result.fields,
                                action: 'close',
                                capturedImageUrl: capturedImageUrl,
                                capturedImageData: capturedImageData, // inline file as data URL (if available)
                                data: result.fields,
                                rawText: result.rawText || null
                            };
                            const target = (typeof window.__IDENTITY_EXPECTED_ORIGIN__ === 'string' && window.__IDENTITY_EXPECTED_ORIGIN__) ? window.__IDENTITY_EXPECTED_ORIGIN__ : '*';
                            try { window.parent.postMessage({ identityOCR: payload }, target); }
                            catch (e) { try { window.parent.postMessage({ identityOCR: payload }, '*'); } catch (e2) { console.warn('postMessage failed', e2); } }
                        }
                    } catch (e) { console.warn('postMessage failed', e); }
                }
            }
        }

        // Identity document results (combines basic and structured)
        // Only render raw OCR/structured text sections when debugMode is enabled
        if (this.debugMode) {
            if (result.basicText && result.basicText.text) {
                const basicSection = this.createResultSection('Basic Text Extraction', result.basicText.text);
                container.appendChild(basicSection);

                // National ID parsing delegated to separate module
                if (applyNationalIdRules && window.NationalID && typeof window.NationalID.fillFromText === 'function') {
                    window.NationalID.fillFromText(result.basicText.text);
                }
            }

            if (result.structuredText && result.structuredText.text) {
                const structuredSection = this.createResultSection('Structured Text', result.structuredText.text);
                container.appendChild(structuredSection);

                // Attempt parsing from structured text as well (fallback/merge)
                if (applyNationalIdRules && window.NationalID && typeof window.NationalID.fillFromText === 'function') {
                    window.NationalID.fillFromText(result.structuredText.text);
                }
            }
        }

        if (this.debugMode && result.basicText && result.basicText.words && result.basicText.words.length > 0) {
            const wordsSection = this.createResultSection(
                `Detected Words (${result.basicText.words.length} total)`,
                this.formatWordsList(result.basicText.words)
            );
            container.appendChild(wordsSection);

            // Priority fill: Use specific word indices per request (delegated)
            if (applyNationalIdRules && window.NationalID && typeof window.NationalID.fillFromWords === 'function') {
                window.NationalID.fillFromWords(result.basicText.words);
            }

            // Passport-specific extraction handled by separate module (window.Passport)
            if (applyPassportRules && window.Passport && typeof window.Passport.fillFromWords === 'function') {
                window.Passport.fillFromWords(result.basicText.words);
            }
            // UMID-specific extraction handled by separate module (window.UMID)
            if (applyUmidRules && window.UMID && typeof window.UMID.fillFromWords === 'function') {
                window.UMID.fillFromWords(result.basicText.words);
            }
        }

        // Processing info
        if (result.processedAt) {
            const infoSection = this.createResultSection(
                'Processing Information',
                `Processed at: ${new Date(result.processedAt).toLocaleString()}`
            );
            container.appendChild(infoSection);
        }
    }

    // Passport extraction moved to js/scanning-algorithm/passport.js

    // extractPassportLastName moved to js/scanning-algorithm/passport.js

    // extractPassportFirstName moved to js/scanning-algorithm/passport.js

    // extractPassportIdNumber moved to js/scanning-algorithm/passport.js

    // extractPassportBirthDateFromWords moved to js/scanning-algorithm/passport.js

    // fillFromWordIndices moved to js/scanning-algorithm/national-id.js

    // extractLastNameBetweenNameAndMga moved to js/scanning-algorithm/national-id.js

    // extractFirstNameBetweenNamesAndGitnang moved to js/scanning-algorithm/national-id.js

    // extractIdNumberBetweenCardAndTirahan moved to js/scanning-algorithm/national-id.js

    // extractBirthDateAfterBirthToken moved to js/scanning-algorithm/national-id.js

    // parseAndFillFromRawText moved to js/scanning-algorithm/national-id.js

    normalizeDate(s) {
        if (!s) return null;
        const str = s.trim();
        // Try YYYY-MM-DD
        let m = str.match(/\b(20\d{2}|19\d{2})[-/.](0[1-9]|1[0-2])[-/.](0[1-9]|[12]\d|3[01])\b/);
        if (m) return `${m[1]}-${m[2]}-${m[3]}`;
        // Try DD/MM/YYYY or DD-MM-YYYY
        m = str.match(/\b(0[1-9]|[12]\d|3[01])[\/\-](0[1-9]|1[0-2])[\/\-]((?:19|20)\d{2})\b/);
        if (m) return `${m[3]}-${m[2]}-${m[1]}`;
        // Try MM/DD/YYYY
        m = str.match(/\b(0[1-9]|1[0-2])[\/\-](0[1-9]|[12]\d|3[01])[\/\-]((?:19|20)\d{2})\b/);
        if (m) return `${m[3]}-${m[1]}-${m[2]}`;
        // Try DD Mon YYYY
        m = str.match(/\b(0[1-9]|[12]\d|3[01])\s+([A-Za-z]{3,})\s+((?:19|20)\d{2})\b/);
        if (m) {
            const day = m[1].padStart(2, '0');
            const month = this.monthToNumber(m[2]);
            if (month) return `${m[3]}-${month}-${day}`;
        }
        // Try Mon DD, YYYY or Month DD, YYYY
        m = str.match(/\b([A-Za-z]{3,})\s+(0?[1-9]|[12]\d|3[01]),?\s+((?:19|20)\d{2})\b/);
        if (m) {
            const day = String(m[2]).padStart(2, '0');
            const month = this.monthToNumber(m[1]);
            if (month) return `${m[3]}-${month}-${day}`;
        }
        return null;
    }

    monthToNumber(name) {
        const map = {
            jan: '01', january: '01',
            feb: '02', february: '02',
            mar: '03', march: '03',
            apr: '04', april: '04',
            may: '05',
            jun: '06', june: '06',
            jul: '07', july: '07',
            aug: '08', august: '08',
            sep: '09', sept: '09', september: '09',
            oct: '10', october: '10',
            nov: '11', november: '11',
            dec: '12', december: '12'
        };
        const key = String(name || '').toLowerCase().slice(0, 9);
        return map[key] || map[key.slice(0, 3)] || null;
    }

    fillDetailsForm({ idType, firstName, lastName, birthDate, idNumber }) {
        const idTypeEl = document.getElementById('id-type');
        const idNumEl = document.getElementById('id-number');
        const fnEl = document.getElementById('first-name');
        const lnEl = document.getElementById('last-name');
        const bdEl = document.getElementById('birth-date');

        if (idTypeEl && idType) idTypeEl.value = idType;
        if (fnEl && firstName) fnEl.value = firstName;
        if (lnEl && lastName) lnEl.value = lastName;
        if (idNumEl && idNumber) idNumEl.value = idNumber;
        if (bdEl && birthDate) {
            const iso = this.normalizeDate(birthDate) || birthDate;
            // only set if it's valid for input[type=date]
            if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) bdEl.value = iso;
        }
    }

    // Helper: Only apply extraction rules when ID Type is National ID
    isNationalIdSelected() {
        const sel = document.getElementById('id-type');
        if (!sel) return true; // default to applying when selector absent
        return String(sel.value).toLowerCase() === 'national-id';
    }

    // Helper: Only apply passport rules when ID Type is Passport
    isPassportSelected() {
        const sel = document.getElementById('id-type');
        if (!sel) return false;
        return String(sel.value).toLowerCase() === 'passport';
    }

    // Helper: Only apply UMID rules when ID Type is UMID
    // Returns true iff the "ID Type" selector (#id-type) is set to 'umid'.
    // Edit here if you need to globally disable or change the UMID condition.
    isUmidSelected() {
        const sel = document.getElementById('id-type');
        if (!sel) return false;
        return String(sel.value).toLowerCase() === 'umid';
    }

    // UMID extraction moved to js/scanning-algorithm/umid.js

    // extractUmidLastName moved to js/scanning-algorithm/umid.js

    // extractUmidFirstName moved to js/scanning-algorithm/umid.js

    // extractUmidIdNumber moved to js/scanning-algorithm/umid.js

    // extractUmidBirthDateFromWords moved to js/scanning-algorithm/umid.js

    createFieldsSection(fields) {
        const section = document.createElement('div');
        section.className = 'result-section fields-highlight';
        section.style.cssText = 'background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 15px; border-radius: 8px; margin-bottom: 20px;';

        const titleElement = document.createElement('div');
        titleElement.className = 'result-title';
        titleElement.style.cssText = 'color: #0369a1; font-size: 1.1rem; font-weight: bold; margin-bottom: 12px;';
        
        let titleText = '📋 Extracted Identity Fields';
        titleElement.innerHTML = titleText;

        const fieldsGrid = document.createElement('div');
        fieldsGrid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;';

        const fieldLabels = {
            firstName: '👤 First Name',
            lastName: '👤 Last Name',
            birthDate: '📅 Birth Date',
            idNumber: '🆔 ID Number'
        };

        for (const [key, label] of Object.entries(fieldLabels)) {
            const value = fields[key];
            const fieldDiv = document.createElement('div');
            fieldDiv.style.cssText = 'background: white; padding: 10px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);';
            
            fieldDiv.innerHTML = `
                <div style="font-size: 0.75rem; color: #64748b; margin-bottom: 4px;">${label}</div>
                <div style="font-size: 1rem; font-weight: 600; color: ${value ? '#0f172a' : '#94a3b8'};">
                    ${value || 'Not found'}
                </div>
            `;
            
            fieldsGrid.appendChild(fieldDiv);
        }

        // Add confidence and verification status
        const statusDiv = document.createElement('div');
        statusDiv.style.cssText = 'background: white; padding: 10px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);';
        
        let statusIcon = '⚡';
        let statusColor = '#0f172a';
        let statusLabel = 'Confidence';
        
        if (fields.verified) {
            statusIcon = '✅';
            statusColor = '#16a34a';
            statusLabel = 'Image Verified';
        }
        
        statusDiv.innerHTML = `
            <div style="font-size: 0.75rem; color: #64748b; margin-bottom: 4px;">${statusIcon} ${statusLabel}</div>
            <div style="font-size: 1rem; font-weight: 600; color: ${statusColor}; text-transform: capitalize;">
                ${fields.confidence || 'medium'}
            </div>
        `;
        fieldsGrid.appendChild(statusDiv);

        section.appendChild(titleElement);
        section.appendChild(fieldsGrid);

        return section;
    }

    createResultSection(title, content) {
        const section = document.createElement('div');
        section.className = 'result-section';

        const titleElement = document.createElement('div');
        titleElement.className = 'result-title';
        titleElement.textContent = title;

        const contentElement = document.createElement('div');
        
        if (typeof content === 'string') {
            if (content.trim() === '') {
                contentElement.className = 'no-results';
                contentElement.textContent = 'No content available';
            } else {
                contentElement.className = 'extracted-text';
                contentElement.textContent = content;
            }
        } else {
            contentElement.appendChild(content);
        }

        section.appendChild(titleElement);
        section.appendChild(contentElement);

        return section;
    }

    formatWordsList(words) {
        const wordsContainer = document.createElement('div');
        
        // List all detected words
        words.forEach((word, index) => {
            const wordElement = document.createElement('div');
            wordElement.style.marginBottom = '5px';
            wordElement.innerHTML = `
                <strong>Word ${index + 1}:</strong> "${word.text}"
                ${word.confidence ? ` (Confidence: ${(word.confidence * 100).toFixed(1)}%)` : ''}
            `;
            wordsContainer.appendChild(wordElement);
        });

        return wordsContainer;
    }

    formatPageStructure(page) {
        const pageContainer = document.createElement('div');
        
        const dimensionsElement = document.createElement('div');
        dimensionsElement.innerHTML = `<strong>Page Dimensions:</strong> ${page.width} x ${page.height}`;
        pageContainer.appendChild(dimensionsElement);

        if (page.blocks && page.blocks.length > 0) {
            const blocksElement = document.createElement('div');
            blocksElement.innerHTML = `<strong>Text Blocks:</strong> ${page.blocks.length}`;
            
            page.blocks.forEach((block, blockIndex) => {
                const blockElement = document.createElement('div');
                blockElement.style.marginLeft = '20px';
                blockElement.style.marginTop = '10px';
                
                const paragraphCount = block.paragraphs ? block.paragraphs.length : 0;
                const wordCount = block.paragraphs ? 
                    block.paragraphs.reduce((total, p) => total + (p.words ? p.words.length : 0), 0) : 0;
                
                blockElement.innerHTML = `
                    <strong>Block ${blockIndex + 1}:</strong> 
                    ${paragraphCount} paragraphs, ${wordCount} words
                    ${block.blockType ? `(Type: ${block.blockType})` : ''}
                `;
                
                blocksElement.appendChild(blockElement);
            });
            
            pageContainer.appendChild(blocksElement);
        }

        return pageContainer;
    }

    displayError(errorMessage) {
        this.resultsContainer.innerHTML = `
            <div class="error-message">
                <strong>Error:</strong> ${errorMessage}
            </div>
        `;
    }

    // Utility method to copy text to clipboard
    copyToClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(() => {
                this.showToast('Text copied to clipboard!');
            }).catch(err => {
                console.error('Failed to copy text:', err);
            });
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                this.showToast('Text copied to clipboard!');
            } catch (err) {
                console.error('Failed to copy text:', err);
            }
            document.body.removeChild(textArea);
        }
    }

    showToast(message) {
        // Simple toast notification
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 12px 20px;
            border-radius: 5px;
            z-index: 10000;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        `;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 3000);
    }

    // Clear the Extracted Details form inputs (called on recapture)
    clearExtractedDetails() {
        const idTypeEl = document.getElementById('id-type');
        const idNumEl = document.getElementById('id-number');
        const fnEl = document.getElementById('first-name');
        const lnEl = document.getElementById('last-name');
        const bdEl = document.getElementById('birth-date');

        if (idTypeEl) idTypeEl.value = 'national-id';
        if (idNumEl) idNumEl.value = '';
        if (fnEl) fnEl.value = '';
        if (lnEl) lnEl.value = '';
        if (bdEl) bdEl.value = '';
    }

    showRecapturePrompt(missingFields = []) {
        // Inform user which fields were missing and enable recapture
        const message = missingFields.length > 0 ? `Missing fields: ${missingFields.join(', ')}. Please try again.` : 'Some required details are missing. Please recapture.';
        AppUtils.showNotification(message, 'warning');

        // Show recapture button and enable it
        const recaptureBtn = document.getElementById('recapture-btn');
        if (recaptureBtn) {
            recaptureBtn.style.display = 'inline-flex';
            recaptureBtn.disabled = false;
            recaptureBtn.addEventListener('click', () => {
                // Clear existing details and restart camera for another capture
                this.clearExtractedDetails();
                try {
                    if (window.cameraManager) {
                        recaptureBtn.style.display = 'none';
                        window.cameraManager.startCamera();
                        // Hide results container until new capture
                        const results = document.getElementById('results-container');
                        if (results) results.innerHTML = '<div class="no-results">Waiting for new capture...</div>';
                    }
                } catch (e) { console.warn('recapture click failed', e); }
            }, { once: true });
        }
    }

    showFinalDetailsOnly(fields) {
        // Hide raw OCR sections and captured image; show only the details form values
        try {
            const preview = document.getElementById('preview-image');
            // Only hide preview if debug is not enabled
            if (preview && !this.debugMode) preview.style.display = 'none';

            const resultsSection = document.querySelector('.results-section');
            if (resultsSection) resultsSection.style.display = 'none';

            // Ensure details section is visible (it lives in .details-section)
            const details = document.querySelector('.details-section');
            if (details) details.style.display = 'block';

            // Optionally autofocus Save on parent admin page when embedded (postMessage handled elsewhere)
        } catch (e) { console.warn('showFinalDetailsOnly failed', e); }
    }

    // Show modal with extracted results inside the embed iframe
    showResultModal(fields) {
        try {
            // Remove existing modal if present
            const existing = document.getElementById('identity-result-modal');
            if (existing) existing.remove();

            const modal = document.createElement('div');
            modal.id = 'identity-result-modal';
            modal.style.cssText = `position:fixed; inset:0; display:flex; align-items:center; justify-content:center; z-index:100000;`;

            const backdrop = document.createElement('div');
            backdrop.style.cssText = 'position:absolute; inset:0; background:rgba(2,6,23,0.6);';

            const box = document.createElement('div');
            box.style.cssText = 'position:relative; z-index:100001; width:min(720px,94%); background:white; border-radius:10px; padding:18px; box-shadow:0 10px 40px rgba(2,6,23,0.6);';

            const title = document.createElement('div');
            title.style.cssText = 'font-size:1.1rem; font-weight:700; margin-bottom:8px;';
            title.textContent = 'Results:';

            const list = document.createElement('div');
            list.style.cssText = 'display:grid; gap:8px; margin-top:6px;';

            const entries = [
                ['First Name', fields.firstName || fields.givenName || ''],
                ['Last Name', fields.lastName || fields.familyName || ''],
                ['Birth Date', fields.birthDate || ''],
                ['ID Number', fields.idNumber || fields.id || '']
            ];

            entries.forEach(([label, val]) => {
                const row = document.createElement('div');
                row.style.cssText = 'display:flex; justify-content:space-between; gap:12px;';
                const l = document.createElement('div'); l.style.cssText = 'color:#374151; font-weight:600;'; l.textContent = label;
                const v = document.createElement('div'); v.style.cssText = 'color:#111827;'; v.textContent = val || 'Not found';
                row.appendChild(l); row.appendChild(v);
                list.appendChild(row);
            });

            const closeRow = document.createElement('div');
            closeRow.style.cssText = 'display:flex; justify-content:flex-end; margin-top:12px;';
            const closeBtn = document.createElement('button');
            closeBtn.textContent = 'Close';
            closeBtn.style.cssText = 'padding:8px 12px; border-radius:6px; background:#0ea5e9; color:white; border:0; cursor:pointer;';
            closeBtn.addEventListener('click', () => modal.remove());
            closeRow.appendChild(closeBtn);

            box.appendChild(title);
            box.appendChild(list);
            box.appendChild(closeRow);

            modal.appendChild(backdrop);
            modal.appendChild(box);

            document.body.appendChild(modal);
        } catch (e) { console.warn('showResultModal error', e); }
    }
}

// Initialize OCR processor when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.ocrProcessor = new OCRProcessor();
    });
} else {
    window.ocrProcessor = new OCRProcessor();
}