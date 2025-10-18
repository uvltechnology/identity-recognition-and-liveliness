class OCRProcessor {
    constructor() {
        this.apiBaseUrl = window.location.origin + '/api/ocr';
        this.currentRequest = null;
        
        this.initializeElements();
        this.setupEventListeners();
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
        // Display extracted identity fields first
        if (result.fields) {
            const fieldsSection = this.createFieldsSection(result.fields);
            container.appendChild(fieldsSection);

            // Also try to populate the details form from server-side extracted fields
            this.fillDetailsForm({
                idType: 'national-id',
                firstName: result?.fields?.firstName,
                lastName: result?.fields?.lastName,
                birthDate: result?.fields?.birthDate,
                idNumber: result?.fields?.idNumber,
            });
        }

        // Identity document results (combines basic and structured)
        if (result.basicText && result.basicText.text) {
            const basicSection = this.createResultSection('Basic Text Extraction', result.basicText.text);
            container.appendChild(basicSection);

            // Client-side parsing based on provided label rules for PH National ID
            this.parseAndFillFromRawText(result.basicText.text);
        }

        if (result.structuredText && result.structuredText.text) {
            const structuredSection = this.createResultSection('Structured Text', result.structuredText.text);
            container.appendChild(structuredSection);

            // Attempt parsing from structured text as well (fallback/merge)
            this.parseAndFillFromRawText(result.structuredText.text);
        }

        if (result.basicText && result.basicText.words && result.basicText.words.length > 0) {
            const wordsSection = this.createResultSection(
                `Detected Words (${result.basicText.words.length} total)`,
                this.formatWordsList(result.basicText.words)
            );
            container.appendChild(wordsSection);

            // Priority fill: Use specific word indices per request
            this.fillFromWordIndices(result.basicText.words);
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

    // Fill fields using fixed 1-based word indices from OCR results
    fillFromWordIndices(words) {
        if (!Array.isArray(words) || words.length === 0) return;

        const getWord = (idx1Based) => {
            const i = idx1Based - 1;
            if (i < 0 || i >= words.length) return '';
            const t = (words[i]?.text || '').toString().trim();
            return t;
        };

        // Map indices
        const idNumberRaw = getWord(13);
        let lastNameRaw = getWord(22);
        // Special condition: If word 22 is 'Mga', use word 21 as last name
        if ((getWord(22) || '').toLowerCase() === 'mga') {
            const candidate = getWord(21);
            if (candidate) {
                lastNameRaw = candidate;
            }
        } else {
            // Optional robustness: if word 22 is part of a label and neighboring tokens look like labels
            const w21 = (getWord(21) || '').toLowerCase();
            const w23 = (getWord(23) || '').toLowerCase();
            const looksLikeLabel = (txt) => /^(last|name|mga|pangalan|given)$/.test(txt);
            if (looksLikeLabel((lastNameRaw || '').toLowerCase()) && !looksLikeLabel(w21)) {
                // Prefer a non-label neighbor as the surname
                lastNameRaw = getWord(21) || lastNameRaw;
            }
            if (looksLikeLabel((lastNameRaw || '').toLowerCase()) && !looksLikeLabel(w23)) {
                // If previous didn't work, try next
                lastNameRaw = getWord(23) || lastNameRaw;
            }
        }
        let firstNameRaw = getWord(28);
        // Special condition: If word 28 is 'Gitnang', use word 27 as first name
        if ((getWord(28) || '').toLowerCase() === 'gitnang') {
            const candidate = getWord(27);
            if (candidate) {
                firstNameRaw = candidate;
            }
        }
        const birthMonthRaw = getWord(42);
        const birthDayRaw = getWord(43);
        const birthYearRaw = getWord(45);

        // Clean and normalize
        const cleanAlnum = (s) => (s || '').replace(/[^A-Za-z0-9\-]/g, '').trim();
        const cleanWord = (s) => (s || '').replace(/[,:;]+$/g, '').trim();

        const idNumber = cleanAlnum(idNumberRaw);
        const lastName = cleanWord(lastNameRaw);
        const firstName = cleanWord(firstNameRaw);

        const monthNum = this.monthToNumber(birthMonthRaw) || (/(^\d{1,2}$)/.test(birthMonthRaw) ? String(birthMonthRaw).padStart(2, '0') : null);
        const dayNum = (/^\d{1,2}$/.test(birthDayRaw) ? String(birthDayRaw).padStart(2, '0') : birthDayRaw.match(/\d{1,2}/)?.[0]?.padStart(2, '0')) || null;
        let yearNum = null;
        if (/^\d{4}$/.test(birthYearRaw)) {
            yearNum = birthYearRaw;
        } else if (/^\d{2}$/.test(birthYearRaw)) {
            // Assume 19xx for >30 and 20xx for <=30
            const yy = parseInt(birthYearRaw, 10);
            yearNum = (yy <= 30 ? 2000 + yy : 1900 + yy).toString();
        } else {
            const y = birthYearRaw.match(/(19|20)\d{2}/)?.[0];
            if (y) yearNum = y;
        }

        // Compose birth date if possible
        let birthDateISO = null;
        if (yearNum && monthNum && dayNum) {
            birthDateISO = `${yearNum}-${monthNum}-${dayNum}`;
        }

        // Apply to form (overwrite if values exist; per requirement, use these indices to determine data)
        this.fillDetailsForm({
            idType: 'national-id',
            firstName: firstName || undefined,
            lastName: lastName || undefined,
            birthDate: birthDateISO || undefined,
            idNumber: idNumber || undefined,
        });

        // Log for debugging
        console.log('[WordIndex Extraction]', {
            idNumberRaw, lastNameRaw, firstNameRaw, birthMonthRaw, birthDayRaw, birthYearRaw,
            idNumber, lastName, firstName, birthDateISO
        });
    }

    // Parse OCR text to extract specific PH National ID fields
    parseAndFillFromRawText(text) {
        if (!text) return;

        const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
        const setIfEmpty = (el, val) => {
            if (!el) return;
            if (!el.value && val) el.value = val;
        };

        // Normalize
        const raw = text.replace(/\u0000/g, ' ').trim();
        const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const lowerJoined = raw.toLowerCase();

        // Last Name: from "Apelyido" or "Last Name"
        let lastName;
        for (const line of lines) {
            const l = line.toLowerCase();
            if (/\b(apelyido|last\s*name)\b/.test(l)) {
                const after = line.split(/:|\-|–|—/).slice(1).join(':') || line.replace(/.*?(apelyido|last\s*name)\b[:\s-]*/i, '');
                lastName = clean(after) || undefined;
                // Remove extra tokens that might trail
                if (lastName && /\b(mga\s+pangalan|given\s+names?)\b/i.test(lastName)) {
                    lastName = lastName.replace(/\b(mga\s+pangalan|given\s+names?)\b.*$/i, '').trim();
                }
                break;
            }
        }

        // First Name: from "Mga Pangalan" or "Given Names"
        let firstName;
        for (const line of lines) {
            const l = line.toLowerCase();
            if (/\b(mga\s+pangalan|given\s+names?)\b/.test(l)) {
                const after = line.split(/:|\-|–|—/).slice(1).join(':') || line.replace(/.*?(mga\s+pangalan|given\s+names?)\b[:\s-]*/i, '');
                firstName = clean(after) || undefined;
                break;
            }
        }

        // Birth Date: get text appearing after "Petsa ng Kapanganakan/Date of Birth"
        let birthDate;
        {
            const rx = /(petsa\s+ng\s+kapanganakan\s*\/\s*date\s+of\s+birth)[:\s-]*([A-Za-z0-9 ,\/\-.]+)/i;
            const m = raw.match(rx);
            if (m) {
                const tail = clean(m[2]);
                // Try to parse common date formats to YYYY-MM-DD
                const parsed = this.normalizeDate(tail);
                birthDate = parsed || tail;
            } else {
                // Try individual label presence
                const rx2 = /(petsa\s+ng\s+kapanganakan|date\s+of\s+birth)[:\s-]*([A-Za-z0-9 ,\/\-.]+)/i;
                const m2 = raw.match(rx2);
                if (m2) {
                    const tail2 = clean(m2[2]);
                    birthDate = this.normalizeDate(tail2) || tail2;
                }
            }
        }

        // ID Number: after mention of "Philippine Identification Card" next number found
        let idNumber;
        {
            const idx = lowerJoined.indexOf('philippine identification card');
            if (idx !== -1) {
                const after = raw.slice(idx + 'philippine identification card'.length);
                const num = after.match(/([A-Z0-9][A-Z0-9\- ]{4,})/i);
                if (num) {
                    idNumber = clean(num[1]).replace(/\s+/g, '');
                }
            }
            // fallback: look for CRN pattern or general number
            if (!idNumber) {
                const crn = raw.match(/\bCRN[:\s-]*([0-9\- ]{8,})/i);
                if (crn) idNumber = clean(crn[1]).replace(/\s+/g, '');
            }
        }

        // Fill form fields if present
        const idTypeEl = document.getElementById('id-type');
        const idNumEl = document.getElementById('id-number');
        const fnEl = document.getElementById('first-name');
        const lnEl = document.getElementById('last-name');
        const bdEl = document.getElementById('birth-date');

        if (idTypeEl) idTypeEl.value = 'national-id';
        setIfEmpty(lnEl, lastName);
        setIfEmpty(fnEl, firstName);
        // If birthDate is in human text, try normalize again for input[type=date]
        if (bdEl && !bdEl.value && birthDate) {
            const iso = this.normalizeDate(birthDate);
            bdEl.value = iso || '';
        }
        setIfEmpty(idNumEl, idNumber);
    }

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

    createFieldsSection(fields) {
        const section = document.createElement('div');
        section.className = 'result-section fields-highlight';
        section.style.cssText = 'background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 15px; border-radius: 8px; margin-bottom: 20px;';

        const titleElement = document.createElement('div');
        titleElement.className = 'result-title';
        titleElement.style.cssText = 'color: #0369a1; font-size: 1.1rem; font-weight: bold; margin-bottom: 12px;';
        
        let titleText = '📋 Extracted Identity Fields';
        if (fields.source === 'ai-vision') {
            titleText += ' ✅ <span style="color: #16a34a; font-size: 0.85rem;">(AI Vision-Verified)</span>';
        } else if (fields.source === 'ai-text') {
            titleText += ' <span style="color: #2563eb; font-size: 0.85rem;">(AI-Powered)</span>';
        }
        
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
        
        words.slice(0, 50).forEach((word, index) => { // Limit to first 50 words
            const wordElement = document.createElement('div');
            wordElement.style.marginBottom = '5px';
            wordElement.innerHTML = `
                <strong>Word ${index + 1}:</strong> "${word.text}"
                ${word.confidence ? ` (Confidence: ${(word.confidence * 100).toFixed(1)}%)` : ''}
            `;
            wordsContainer.appendChild(wordElement);
        });

        if (words.length > 50) {
            const moreElement = document.createElement('div');
            moreElement.style.fontStyle = 'italic';
            moreElement.textContent = `... and ${words.length - 50} more words`;
            wordsContainer.appendChild(moreElement);
        }

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
}

// Initialize OCR processor when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.ocrProcessor = new OCRProcessor();
    });
} else {
    window.ocrProcessor = new OCRProcessor();
}