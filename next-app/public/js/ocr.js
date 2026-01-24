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
    }

    initializeElements() {
        this.loadingElement = document.getElementById('loading');
        this.resultsContainer = document.getElementById('results-container');
        this.ocrTypeSelect = document.getElementById('ocr-type');
        this.previewImage = document.getElementById('preview-image');
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

    async processImageData(imageDataUrl) {
        const ocrType = this.ocrTypeSelect.value;
        
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

    displayIdentityResults(container, result) {
    const applyNationalIdRules = this.isNationalIdSelected();
    const applyPassportRules = this.isPassportSelected();
    // Driver's License gating moved into driver-license.js (DriverLicense.isSelected)
    const applyPhilHealthRules = this.isPhilHealthSelected ? this.isPhilHealthSelected() : (document.getElementById('id-type') && String(document.getElementById('id-type').value).toLowerCase() === 'philhealth');
        // UMID condition: flips true only when the "ID Type" dropdown (#id-type) value is 'umid'
        // This toggles all UMID-specific extraction in fillUmidFromWords()
    const applyUmidRules = this.isUmidSelected();
    const applyTinRules = this.isTinIdSelected();
    const applyPostalIdRules = this.isPostalIdSelected();
    const applyPagibigRules = this.isPagibigSelected ? this.isPagibigSelected() : (document.getElementById('id-type') && String(document.getElementById('id-type').value).toLowerCase() === 'pagibig');
        // Display extracted identity fields first
        if (result.fields) {
            // Also try to populate the details form from server-side extracted fields
            if (applyNationalIdRules) {
                this.fillDetailsForm({
                    idType: 'national-id',
                    firstName: result?.fields?.firstName,
                    lastName: result?.fields?.lastName,
                    birthDate: result?.fields?.birthDate,
                    idNumber: result?.fields?.idNumber,
                });
            }
        }

        // Identity document results (combines basic and structured)
        if (result.basicText && result.basicText.text) {
            const basicSection = this.createResultSection('Basic Text Extraction', result.basicText.text);
            container.appendChild(basicSection);

            // National ID parsing delegated to separate module
            if (applyNationalIdRules && window.NationalID && typeof window.NationalID.fillFromText === 'function') {
                window.NationalID.fillFromText(result.basicText.text);
            }
            // TIN parsing
            if (applyTinRules && window.TINID && typeof window.TINID.fillFromText === 'function') {
                window.TINID.fillFromText(result.basicText.text);
            }
            // Passport parsing
            if (applyPassportRules && window.Passport && typeof window.Passport.fillFromText === 'function') {
                window.Passport.fillFromText(result.basicText.text);
            }
            // PhilHealth parsing
            if (applyPhilHealthRules && window.PhilHealth && typeof window.PhilHealth.fillFromText === 'function') {
                window.PhilHealth.fillFromText(result.basicText.text);
            }
            // Driver's License parsing: let module self-gate via isSelected()
            if (window.DriverLicense && typeof window.DriverLicense.fillFromText === 'function') {
                window.DriverLicense.fillFromText(result.basicText.text);
            }
            // UMID parsing
            if (applyUmidRules && window.UMID && typeof window.UMID.fillFromText === 'function') {
                window.UMID.fillFromText(result.basicText.text);
            }
            // Postal ID parsing
            if (applyPostalIdRules && window.POSTALID && typeof window.POSTALID.fillFromText === 'function') {
                window.POSTALID.fillFromText(result.basicText.text);
            }
            // Pag-IBIG ID parsing (OCR-only)
            if (applyPagibigRules && window.PAGIBIG && typeof window.PAGIBIG.fillFromText === 'function') {
                window.PAGIBIG.fillFromText(result.basicText.text);
            }
        }

        if (result.structuredText && result.structuredText.text) {
            const structuredSection = this.createResultSection('Structured Text', result.structuredText.text);
            container.appendChild(structuredSection);

            // Attempt parsing from structured text as well (fallback/merge)
            if (applyNationalIdRules && window.NationalID && typeof window.NationalID.fillFromText === 'function') {
                window.NationalID.fillFromText(result.structuredText.text);
            }
            if (applyTinRules && window.TINID && typeof window.TINID.fillFromText === 'function') {
                window.TINID.fillFromText(result.structuredText.text);
            }
            if (applyPassportRules && window.Passport && typeof window.Passport.fillFromText === 'function') {
                window.Passport.fillFromText(result.structuredText.text);
            }
            if (applyPhilHealthRules && window.PhilHealth && typeof window.PhilHealth.fillFromText === 'function') {
                window.PhilHealth.fillFromText(result.structuredText.text);
            }
            if (window.DriverLicense && typeof window.DriverLicense.fillFromText === 'function') {
                window.DriverLicense.fillFromText(result.structuredText.text);
            }
            if (applyUmidRules && window.UMID && typeof window.UMID.fillFromText === 'function') {
                window.UMID.fillFromText(result.structuredText.text);
            }
            if (applyPostalIdRules && window.POSTALID && typeof window.POSTALID.fillFromText === 'function') {
                window.POSTALID.fillFromText(result.structuredText.text);
            }
            if (applyPagibigRules && window.PAGIBIG && typeof window.PAGIBIG.fillFromText === 'function') {
                window.PAGIBIG.fillFromText(result.structuredText.text);
            }
        }

        if (result.basicText && result.basicText.words && result.basicText.words.length > 0) {
            const wordsSection = this.createResultSection(
                `Detected Words (${result.basicText.words.length} total)`,
                this.formatWordsList(result.basicText.words)
            );
            container.appendChild(wordsSection);

            // Priority fill: Use specific word indices per request (delegated)
            if (applyNationalIdRules && window.NationalID && typeof window.NationalID.fillFromWords === 'function') {
                window.NationalID.fillFromWords(result.basicText.words);
            }
            if (applyPhilHealthRules && window.PhilHealth && typeof window.PhilHealth.fillFromWords === 'function') {
                window.PhilHealth.fillFromWords(result.basicText.words);
            }
            if (window.DriverLicense && typeof window.DriverLicense.fillFromWords === 'function') {
                window.DriverLicense.fillFromWords(result.basicText.words);
            }

            // Passport-specific extraction handled by separate module (window.Passport)
            if (applyPassportRules && window.Passport && typeof window.Passport.fillFromWords === 'function') {
                window.Passport.fillFromWords(result.basicText.words);
            }
            // UMID-specific extraction handled by separate module (window.UMID)
            if (applyUmidRules && window.UMID && typeof window.UMID.fillFromWords === 'function') {
                window.UMID.fillFromWords(result.basicText.words);
            }
            // TIN-specific extraction handled by separate module (window.TINID)
            if (applyTinRules && window.TINID && typeof window.TINID.fillFromWords === 'function') {
                window.TINID.fillFromWords(result.basicText.words);
            }
            // Postal ID-specific extraction handled by separate module (window.POSTALID)
            if (applyPostalIdRules && window.POSTALID && typeof window.POSTALID.fillFromWords === 'function') {
                window.POSTALID.fillFromWords(result.basicText.words);
            }
            // Pag-IBIG-specific extraction handled by separate module (window.PAGIBIG)
            if (applyPagibigRules && window.PAGIBIG && typeof window.PAGIBIG.fillFromWords === 'function') {
                window.PAGIBIG.fillFromWords(result.basicText.words);
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

    // Helper: Only apply Pag-IBIG rules when selected
    isPagibigSelected() {
        const sel = document.getElementById('id-type');
        if (!sel) return false;
        return String(sel.value).toLowerCase() === 'pagibig';
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

    // Helper: Only apply Driver's License rules when selected
    isDriverLicenseSelected() {
        const sel = document.getElementById('id-type');
        if (!sel) return false;
        return String(sel.value).toLowerCase() === 'driver-license';
    }

    // Helper: Only apply PhilHealth rules when selected
    isPhilHealthSelected() {
        const sel = document.getElementById('id-type');
        if (!sel) return false;
        return String(sel.value).toLowerCase() === 'philhealth';
    }

    // Helper: Only apply TIN rules when selected
    isTinIdSelected() {
        const sel = document.getElementById('id-type');
        if (!sel) return false;
        return String(sel.value).toLowerCase() === 'tin-id';
    }

    // Helper: Only apply Postal ID rules when selected
    isPostalIdSelected() {
        const sel = document.getElementById('id-type');
        if (!sel) return false;
        return String(sel.value).toLowerCase() === 'postal-id';
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

    // Show AI results for Driver's License below OCR results and in AI Results panel
    showAIResultsDL({ firstName, lastName, birthDate, idNumber, confidence }) {
        try {
            const container = this.resultsContainer;
            const aiPanel = document.getElementById('ai-results-container');
            if (!container && !aiPanel) return;
            // Replace existing AI section if present
            const old = document.getElementById('ai-dl-section');
            if (old && old.parentNode) old.parentNode.removeChild(old);

            // Only render if at least one field exists
            const hasAny = !!(firstName || lastName || birthDate || idNumber);
            if (!hasAny) return;

            const aiSection = document.createElement('div');
            aiSection.id = 'ai-dl-section';
            aiSection.className = 'result-section';

            const titleEl = document.createElement('div');
            titleEl.className = 'result-title';
            const typeLabel = this.isDriverLicenseSelected()
                ? "Driver's License"
                : this.isUmidSelected()
                    ? 'UMID'
                    : this.isPhilHealthSelected()
                        ? 'PhilHealth'
                        : this.isPassportSelected()
                            ? 'Passport'
                            : this.isNationalIdSelected()
                                ? 'National ID'
                                : this.isTinIdSelected()
                                    ? 'TIN'
                                    : this.isPostalIdSelected()
                                        ? 'Postal ID'
                                        : 'Identity Document';
            titleEl.textContent = `🤖 AI extraction (${typeLabel})`;
            aiSection.appendChild(titleEl);

            // Grid of fields similar to createFieldsSection
            const fieldsGrid = document.createElement('div');
            fieldsGrid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;';

            const rows = [
                ['👤 First Name', firstName],
                ['👤 Last Name', lastName],
                ['📅 Birth Date', birthDate],
                ['🆔 ID Number', idNumber]
            ];

            rows.forEach(([label, value]) => {
                const fieldDiv = document.createElement('div');
                fieldDiv.style.cssText = 'background: white; padding: 10px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);';
                fieldDiv.innerHTML = `
                    <div style="font-size: 0.75rem; color: #64748b; margin-bottom: 4px;">${label}</div>
                    <div style="font-size: 1rem; font-weight: 600; color: ${value ? '#0f172a' : '#94a3b8'};">
                        ${value || 'Not found'}
                    </div>
                `;
                fieldsGrid.appendChild(fieldDiv);
            });

            // Confidence indicator (optional)
            if (confidence !== undefined) {
                const confDiv = document.createElement('div');
                confDiv.style.cssText = 'background: white; padding: 10px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);';
                confDiv.innerHTML = `
                    <div style="font-size: 0.75rem; color: #64748b; margin-bottom: 4px;">⚡ Confidence</div>
                    <div style="font-size: 1rem; font-weight: 600; color: #0f172a;">
                        ${confidence}
                    </div>
                `;
                fieldsGrid.appendChild(confDiv);
            }

            aiSection.appendChild(fieldsGrid);
            // Append to OCR results container if available
            if (container) container.appendChild(aiSection);

            // Also render a compact version inside the AI Results panel if present
            if (aiPanel) {
                const compact = document.createElement('div');
                compact.className = 'rounded-md bg-white p-3 shadow-sm';
                const rows = [
                    ['First Name', firstName],
                    ['Last Name', lastName],
                    ['Birth Date', birthDate],
                    ['ID Number', idNumber]
                ];
                compact.innerHTML = rows.map(([k, v]) => `
                    <div class="flex items-center justify-between border-b border-gray-100 py-1 last:border-b-0">
                        <span class="text-gray-500">${k}</span>
                        <span class="font-semibold text-gray-900">${v || '—'}</span>
                    </div>
                `).join('') + (confidence !== undefined ? `
                    <div class="mt-2 text-xs text-gray-500">Confidence: ${confidence}</div>
                ` : '');

                // Also show raw AI JSON (the extracted fields) for clarity
                const rawJson = document.createElement('pre');
                rawJson.className = 'mt-3 whitespace-pre-wrap rounded-md bg-gray-50 p-2 text-xs text-gray-700 border border-gray-200';
                const jsonObj = { firstName, lastName, birthDate, idNumber, confidence };
                rawJson.textContent = JSON.stringify(jsonObj, null, 2);

                aiPanel.innerHTML = '';
                aiPanel.appendChild(compact);
                aiPanel.appendChild(rawJson);
            }
        } catch (e) {
            console.warn('Failed to render AI DL results:', e);
        }
    }

    // Show a simple status or error message in the AI results panel
    showAIStatus(message) {
        try {
            const aiPanel = document.getElementById('ai-results-container');
            if (!aiPanel) return;
            const box = document.createElement('div');
            box.className = 'rounded-md bg-yellow-50 p-3 text-sm text-yellow-800 border border-yellow-200';
            box.textContent = message;
            aiPanel.innerHTML = '';
            aiPanel.appendChild(box);
        } catch (e) {
            console.warn('Failed to render AI status:', e);
        }
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

    // Clear the Extracted Details form inputs (used by Recapture flow)
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
}

// Initialize OCR processor when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.ocrProcessor = new OCRProcessor();
    });
} else {
    window.ocrProcessor = new OCRProcessor();
}