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
        const applyNationalIdRules = this.isNationalIdSelected();
        const applyPassportRules = this.isPassportSelected();
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

            // Client-side parsing based on provided label rules for PH National ID
            if (applyNationalIdRules) {
                this.parseAndFillFromRawText(result.basicText.text);
            }
        }

        if (result.structuredText && result.structuredText.text) {
            const structuredSection = this.createResultSection('Structured Text', result.structuredText.text);
            container.appendChild(structuredSection);

            // Attempt parsing from structured text as well (fallback/merge)
            if (applyNationalIdRules) {
                this.parseAndFillFromRawText(result.structuredText.text);
            }
        }

        if (result.basicText && result.basicText.words && result.basicText.words.length > 0) {
            const wordsSection = this.createResultSection(
                `Detected Words (${result.basicText.words.length} total)`,
                this.formatWordsList(result.basicText.words)
            );
            container.appendChild(wordsSection);

            // Priority fill: Use specific word indices per request
            if (applyNationalIdRules) {
                this.fillFromWordIndices(result.basicText.words);
            }

            // Passport-specific extraction rules
            if (applyPassportRules) {
                this.fillPassportFromWords(result.basicText.words);
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

    // Passport-only: derive last name between 'PHL' and 'Pangalan'; if token after PHL is 'Apelyido', instead use the name after 'Surname'
    fillPassportFromWords(words) {
        if (!this.isPassportSelected()) return;
        if (!Array.isArray(words) || words.length === 0) return;

        const ln = this.extractPassportLastName(words);
        const fn = this.extractPassportFirstName(words);
        const pid = this.extractPassportIdNumber(words);
        const bdate = this.extractPassportBirthDateFromWords(words);
        const payload = { idType: 'passport' };
        if (ln) payload.lastName = ln;
        if (fn) payload.firstName = fn;
        if (pid) payload.idNumber = pid;
        if (bdate) payload.birthDate = bdate;
        if (ln || fn || pid || bdate) this.fillDetailsForm(payload);
    }

    extractPassportLastName(words) {
        const norm = (t) => (t || '').toString().trim();
        const isPHL = (t) => /^phl$/i.test(norm(t));
        const isPangalan = (t) => /pangalan/i.test(norm(t));
        const isApelyido = (t) => /apelyido/i.test(norm(t));
        const isSurname = (t) => /surname/i.test(norm(t));

        // Priority rule: look for sequence 'P', '<', then token starting with 'PHL...'
        for (let i = 0; i <= words.length - 3; i++) {
            const t0 = norm(words[i]?.text);
            const t1 = norm(words[i + 1]?.text);
            const t2 = (words[i + 2]?.text || '').toString().trim();
            if (/^p$/i.test(t0) && t1 === '<' && t2) {
                // Extract last name from t2 by stripping leading 'PHL' and everything after '<'
                let candidate = t2.replace(/^PHL/i, '');
                candidate = candidate.split('<')[0];
                candidate = candidate.replace(/^[^A-Za-z]+|[^A-Za-z'\-\s]+$/g, '');
                candidate = candidate.replace(/\s+/g, ' ').trim();
                if (candidate) {
                    return candidate;
                }
            }
        }

        let phlIdx = -1;
        for (let i = 0; i < words.length; i++) {
            if (isPHL(words[i]?.text)) { phlIdx = i; break; }
        }
        if (phlIdx === -1) return null;

        // Find Pangalan boundary after PHL
        let pangalanIdx = -1;
        for (let i = phlIdx + 1; i < words.length; i++) {
            if (isPangalan(words[i]?.text)) { pangalanIdx = i; break; }
        }

        // If immediate token after PHL is 'Apelyido', do not take next; instead use the text after 'Surname'
        const immediate = words[phlIdx + 1]?.text || '';
        if (isApelyido(immediate)) {
            let surnameIdx = -1;
            for (let i = phlIdx + 1; i < (pangalanIdx !== -1 ? pangalanIdx : words.length); i++) {
                if (isSurname(words[i]?.text)) { surnameIdx = i; break; }
            }
            if (surnameIdx !== -1) {
                // Take tokens after 'Surname' up to boundary 'Pangalan' or until label-like token
                const end = (pangalanIdx !== -1 ? pangalanIdx : words.length);
                const tail = words.slice(surnameIdx + 1, end)
                    .map(w => norm(w?.text))
                    .filter(Boolean)
                    .filter(s => !isSurname(s) && !isApelyido(s) && !/^last$/i.test(s) && !/^name$/i.test(s));
                const joined = tail.join(' ').replace(/\s+/g, ' ').trim();
                return joined || null;
            }
            // If no Surname found, fall back to between PHL and Pangalan
        }

        // Default: take tokens between PHL and Pangalan as last name (skipping labels)
        if (pangalanIdx !== -1 && pangalanIdx > phlIdx + 1) {
            const between = words.slice(phlIdx + 1, pangalanIdx)
                .map(w => norm(w?.text))
                .filter(Boolean)
                .filter(s => !isApelyido(s) && !/^last$/i.test(s) && !/^name$/i.test(s) && !isSurname(s));
            const result = between.join(' ').replace(/\s+/g, ' ').trim();
            return result || null;
        }
        return null;
    }

    // Passport-only: First Name using sequence P, <, PHLxxxx, << then 2-5 tokens separated by '<'; fallback to older boundary rule
    extractPassportFirstName(words) {
        const raw = (t) => (t || '').toString().trim();
        const clean = (s) => (s || '').replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');

        // Priority MRZ-like rule
        for (let i = 0; i <= words.length - 4; i++) {
            const t0 = raw(words[i]?.text);
            const t1 = raw(words[i + 1]?.text);
            const t2 = raw(words[i + 2]?.text);
            const t3 = raw(words[i + 3]?.text);
            if (/^p$/i.test(t0) && t1 === '<' && /^PHL/i.test(t2) && /^<+$/.test(t3)) {
                // Collect next 2-5 name parts, skipping '<' separators and splitting within tokens on '<'
                const parts = [];
                let k = i + 4;
                // If the very first token after the MRZ marker is a long run of '<', abort and return null
                const firstTok = raw(words[k]?.text || '');
                if (/^<{3,}$/.test(firstTok)) {
                    return null;
                }
                while (k < words.length && parts.length < 5) {
                    let token = raw(words[k]?.text);
                    if (!token) { k++; continue; }
                    // Hard stop at a long run of separators like <<<<<<<<<<<<<<<<<<
                    if (/^<{3,}$/.test(token)) {
                        // If we've already collected some parts, end here; do not cross into trailing data like PHL95020...
                        break;
                    }
                    // Skip short separator tokens (single or double '<')
                    if (/^<+$/.test(token)) { k++; continue; } // pure separators
                    // Split by '<' in case names are embedded like 'JOHN<RONALD'
                    const segs = token.split('<').map(clean).filter(Boolean);
                    for (const seg of segs) {
                        if (seg) parts.push(seg);
                        if (parts.length >= 5) break;
                    }
                    // Heuristic stop if we encounter obvious boundary labels soon after
                    if (parts.length >= 2 && parts.length <= 5) {
                        // acceptable range achieved; but keep scanning until next pure separator or limit
                    }
                    k++;
                    // Optional stop: if next token is a long run of separators, end collection
                    if (k < words.length && /^<{3,}$/.test(raw(words[k]?.text || ''))) {
                        break;
                    }
                }
                if (parts.length >= 1) {
                    return parts.join(' ').replace(/\s+/g, ' ').trim();
                }
            }
        }

        // Fallback: between 'Names' and boundary tokens
        const norm = (t) => (t || '').toString().trim().replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
        const isNames = (t) => /\bnames\b/i.test(norm(t));
        const isBoundary = (t) => /(pasaporte|pasaportab|panggitnang)/i.test(norm(t));

        let namesIdx = -1;
        for (let i = 0; i < words.length; i++) {
            if (isNames(words[i]?.text)) { namesIdx = i; break; }
        }
        if (namesIdx === -1) return null;

        let boundaryIdx = -1;
        for (let i = namesIdx + 1; i < words.length; i++) {
            if (isBoundary(words[i]?.text)) { boundaryIdx = i; break; }
        }

        if (boundaryIdx !== -1 && boundaryIdx > namesIdx + 1) {
            const between = words.slice(namesIdx + 1, boundaryIdx)
                .map(w => norm(w?.text))
                .filter(Boolean)
                // Remove label-like tokens that might be interleaved
                .filter(s => !/^given$/i.test(s) && !/^mga$/i.test(s) && !/^pangalan$/i.test(s) && !/^names?$/i.test(s) && !/^gitnang$/i.test(s) && !/^panggitnang$/i.test(s));
            const result = between.join(' ').replace(/\s+/g, ' ').trim();
            return result || null;
        }
        return null;
    }

    // Passport-only: Extract passport ID number from a token that contains 'PHL' followed by digits; take substring before 'PHL'
    extractPassportIdNumber(words) {
        if (!Array.isArray(words) || words.length === 0) return null;
        for (let i = 0; i < words.length; i++) {
            const t = (words[i]?.text || '').toString().trim();
            if (!t) continue;
            const up = t.toUpperCase();
            const idx = up.indexOf('PHL');
            if (idx > 0) {
                const tail = up.slice(idx + 3);
                // Count digits in the next segment (allowing letters like 'M')
                const digitCount = (tail.match(/\d/g) || []).length;
                if (digitCount >= 8) {
                    // Take everything before 'PHL' as the passport ID number (alphanumeric only)
                    let before = t.slice(0, idx).replace(/[^A-Za-z0-9]/g, '');
                    // Prefer 8-12 characters; accept >= 6 as fallback
                    if (before.length >= 8) return before;
                    if (before.length >= 6) return before;
                }
            }
        }
        return null;
    }

    // Passport-only: Extract birth date from tokens after 'birth' as DD MON YYYY or search globally for that pattern
    extractPassportBirthDateFromWords(words) {
        if (!Array.isArray(words) || words.length === 0) return null;

        const raw = (t) => (t || '').toString().trim();
        const clean = (s) => (s || '').toString().trim().replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
        const isBirth = (t) => /\bbirth\b/i.test(raw(t));
        const isDay = (t) => /^\d{1,2}$/.test(clean(t));
        const isYear = (t) => /^(19|20)\d{2}$/.test(clean(t));
        const isMonth = (t) => {
            const u = clean(t).toUpperCase();
            return ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','SEPT','OCT','NOV','DEC'].includes(u);
        };
        const monNum = (t) => this.monthToNumber(clean(t));
        const toISO = (d, m, y) => {
            const dd = String(parseInt(clean(d), 10)).padStart(2, '0');
            const mm = monNum(m);
            const yy = clean(y);
            if (!mm) return null;
            return `${yy}-${mm}-${dd}`;
        };

        // 1) Prefer sequence immediately after a 'birth' token
        let birthIdx = -1;
        for (let i = 0; i < words.length; i++) {
            if (isBirth(words[i]?.text)) { birthIdx = i; break; }
        }
        if (birthIdx !== -1) {
            for (let j = birthIdx + 1; j + 2 < words.length && j <= birthIdx + 4; j++) {
                const d = raw(words[j]?.text);
                const m = raw(words[j + 1]?.text);
                const y = raw(words[j + 2]?.text);
                if (isDay(d) && isMonth(m) && isYear(y)) {
                    const iso = toISO(d, m, y);
                    if (iso) return iso;
                }
            }
        }

        // 2) Fallback: scan globally for any DD MON YYYY triplet
        for (let i = 0; i + 2 < words.length; i++) {
            const d = raw(words[i]?.text);
            const m = raw(words[i + 1]?.text);
            const y = raw(words[i + 2]?.text);
            if (isDay(d) && isMonth(m) && isYear(y)) {
                const iso = toISO(d, m, y);
                if (iso) return iso;
            }
        }

        return null;
    }

    // Fill fields using fixed 1-based word indices from OCR results
    fillFromWordIndices(words) {
        if (!this.isNationalIdSelected()) return;
        if (!Array.isArray(words) || words.length === 0) return;

        const getWord = (idx1Based) => {
            const i = idx1Based - 1;
            if (i < 0 || i >= words.length) return '';
            const t = (words[i]?.text || '').toString().trim();
            return t;
        };

        // Map indices
    const idNumberRaw = getWord(13);
    const lastNameRaw = getWord(22);
    const firstNameRaw = getWord(28);
        const birthMonthRaw = getWord(42);
        const birthDayRaw = getWord(43);
        const birthYearRaw = getWord(45);

        // Clean and normalize
        const cleanAlnum = (s) => (s || '').replace(/[^A-Za-z0-9\-]/g, '').trim();
        const cleanWord = (s) => (s || '').replace(/[,:;]+$/g, '').trim();

    // Prefer dynamic extraction for ID number: between 'Card' and 'Tirahan' with strict 0000-0000-0000-0000 format
    const dynamicIdNumber = this.extractIdNumberBetweenCardAndTirahan(words);
    const idNumber = dynamicIdNumber || cleanAlnum(idNumberRaw);
    // Prefer dynamic extraction: last name between 'Name' and the token starting with 'Mga'
    const dynamicLastName = this.extractLastNameBetweenNameAndMga(words);
    const lastName = cleanWord(dynamicLastName || lastNameRaw);
    // Prefer dynamic extraction for first name: between 'Names' and 'Gitnang'
    const dynamicFirstName = this.extractFirstNameBetweenNamesAndGitnang(words);
    const firstName = cleanWord(dynamicFirstName || firstNameRaw);

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

        // Compose birth date if possible from indices
        let birthDateISO = null;
        if (yearNum && monthNum && dayNum) {
            birthDateISO = `${yearNum}-${monthNum}-${dayNum}`;
        }

        // Prefer dynamic birth date: value immediately after 'Birth'
        const dynamicBirthDateISO = this.extractBirthDateAfterBirthToken(words) || null;

        // Apply to form (overwrite if values exist; per requirement, use these indices to determine data)
        this.fillDetailsForm({
            idType: 'national-id',
            firstName: firstName || undefined,
            lastName: lastName || undefined,
            birthDate: dynamicBirthDateISO || birthDateISO || undefined,
            idNumber: idNumber || undefined,
        });

        // Log for debugging
        console.log('[WordIndex Extraction]', {
            idNumberRaw, lastNameRaw, firstNameRaw, birthMonthRaw, birthDayRaw, birthYearRaw,
            idNumber, lastName, firstName, birthDateISO, dynamicBirthDateISO, dynamicLastName, dynamicFirstName, dynamicIdNumber
        });
    }

    // Find last name as the text between a word containing 'Name' and the next word starting with 'Mga'
    extractLastNameBetweenNameAndMga(words) {
        if (!Array.isArray(words) || words.length === 0) return null;

        const isNameToken = (t) => /\bname\b/i.test(t);
        const isMgaToken = (t) => /^mga\b/i.test(t);

        let nameIdx = -1;
        let mgaIdx = -1;

        for (let i = 0; i < words.length; i++) {
            const t = (words[i]?.text || '').toString().trim();
            if (nameIdx === -1 && isNameToken(t)) {
                nameIdx = i;
                continue;
            }
            if (nameIdx !== -1 && isMgaToken(t)) {
                mgaIdx = i;
                break;
            }
        }

        if (nameIdx !== -1 && mgaIdx !== -1 && mgaIdx > nameIdx + 1) {
            const between = words.slice(nameIdx + 1, mgaIdx)
                .map(w => (w?.text || '').toString().trim())
                .filter(Boolean)
                // strip leading/trailing punctuation
                .map(s => s.replace(/^[,:;\-]+|[,:;\-]+$/g, ''))
                // drop common label fragments if present
                .filter(s => !/^last$/i.test(s) && !/^apelyido$/i.test(s) && !/^surname$/i.test(s) && !/^family$/i.test(s) && !/^name$/i.test(s));

            const result = between.join(' ').replace(/\s+/g, ' ').trim();
            return result || null;
        }
        return null;
    }

    // Find first name between a word containing 'Names' and a word containing 'Gitnang'
    extractFirstNameBetweenNamesAndGitnang(words) {
        if (!Array.isArray(words) || words.length === 0) return null;

        const normalize = (t) => (t || '').toString().trim().replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
        const isNamesToken = (t) => /\bnames\b/i.test(normalize(t));
        const isGitnangToken = (t) => /\bgitnang\b/i.test(normalize(t));

        let namesIdx = -1;
        let gitnangIdx = -1;

        for (let i = 0; i < words.length; i++) {
            const t = (words[i]?.text || '');
            if (namesIdx === -1 && isNamesToken(t)) {
                namesIdx = i;
                continue;
            }
            if (namesIdx !== -1 && isGitnangToken(t)) {
                gitnangIdx = i;
                break;
            }
        }

        if (namesIdx !== -1 && gitnangIdx !== -1 && gitnangIdx > namesIdx + 1) {
            const between = words.slice(namesIdx + 1, gitnangIdx)
                .map(w => normalize(w?.text))
                .filter(Boolean)
                // drop label fragments if they appear between
                .filter(s => !/^given$/i.test(s) && !/^mga$/i.test(s) && !/^pangalan$/i.test(s) && !/^names?$/i.test(s) && !/^gitnang$/i.test(s));
            const result = between.join(' ').replace(/\s+/g, ' ').trim();
            return result || null;
        }
        return null;
    }

    // Extract ID number between tokens containing 'Card' and 'Tirahan', enforce 0000-0000-0000-0000
    extractIdNumberBetweenCardAndTirahan(words) {
        if (!Array.isArray(words) || words.length === 0) return null;

        const normalize = (t) => (t || '').toString().trim();
        const isCardToken = (t) => /\bcard\b/i.test(normalize(t));
        const isTirahanToken = (t) => /\btirahan\b/i.test(normalize(t));

        let cardIdx = -1;
        let tirahanIdx = -1;

        for (let i = 0; i < words.length; i++) {
            const t = (words[i]?.text || '');
            if (cardIdx === -1 && isCardToken(t)) {
                cardIdx = i;
                continue;
            }
            if (cardIdx !== -1 && isTirahanToken(t)) {
                tirahanIdx = i;
                break;
            }
        }

        if (cardIdx !== -1 && tirahanIdx !== -1 && tirahanIdx > cardIdx + 1) {
            const between = words.slice(cardIdx + 1, tirahanIdx)
                .map(w => (w?.text || '').toString().trim())
                .filter(Boolean)
                .join(' ');

            // Look for four groups of 4 digits (allowing separators), then normalize with dashes
            const m = between.match(/(\d{4})\D*(\d{4})\D*(\d{4})\D*(\d{4})/);
            if (m) {
                return `${m[1]}-${m[2]}-${m[3]}-${m[4]}`;
            }

            // Fallback: collect digits only and format if 16+ digits
            const digits = between.replace(/\D/g, '');
            if (digits.length >= 16) {
                const d = digits.slice(0, 16);
                return `${d.slice(0,4)}-${d.slice(4,8)}-${d.slice(8,12)}-${d.slice(12,16)}`;
            }
        }

        return null;
    }

    // Extract birth date from words immediately following a token containing 'Birth'
    extractBirthDateAfterBirthToken(words) {
        if (!Array.isArray(words) || words.length === 0) return null;

        const normalize = (t) => (t || '').toString().trim();
        const isBirthToken = (t) => /\bbirth\b/i.test(normalize(t));

        let birthIdx = -1;
        for (let i = 0; i < words.length; i++) {
            const t = (words[i]?.text || '');
            if (isBirthToken(t)) {
                birthIdx = i;
                break;
            }
        }

        if (birthIdx === -1 || birthIdx >= words.length - 1) return null;

        // Collect the next few tokens after 'Birth' to search for a date
        const tailTokens = words.slice(birthIdx + 1, Math.min(words.length, birthIdx + 1 + 8))
            .map(w => (w?.text || '').toString().trim())
            .filter(Boolean);

        if (tailTokens.length === 0) return null;

        const tryNormalize = (s) => this.normalizeDate(s) || null;

        // Try the entire tail joined
        let candidate = tryNormalize(tailTokens.join(' '));
        if (candidate) return candidate;

        // Try sliding windows of tokens (1..5 tokens)
        for (let win = 1; win <= Math.min(5, tailTokens.length); win++) {
            for (let start = 0; start + win <= tailTokens.length; start++) {
                const part = tailTokens.slice(start, start + win).join(' ');
                const iso = tryNormalize(part);
                if (iso) return iso;
            }
        }

        // Try digits-only assembly for patterns like 05041989 or 19890405
        const digits = tailTokens.join(' ').replace(/\D/g, '');
        if (digits.length >= 8) {
            // Try YYYYMMDD
            const ymd = digits.slice(0, 8);
            const y = ymd.slice(0, 4);
            const m = ymd.slice(4, 6);
            const d = ymd.slice(6, 8);
            if (/^(19|20)\d{2}$/.test(y) && /^(0[1-9]|1[0-2])$/.test(m) && /^(0[1-9]|[12]\d|3[01])$/.test(d)) {
                return `${y}-${m}-${d}`;
            }
            // Try DDMMYYYY
            const dmy = digits.slice(0, 8);
            const d2 = dmy.slice(0, 2);
            const m2 = dmy.slice(2, 4);
            const y2 = dmy.slice(4, 8);
            if (/^(0[1-9]|[12]\d|3[01])$/.test(d2) && /^(0[1-9]|1[0-2])$/.test(m2) && /^(19|20)\d{2}$/.test(y2)) {
                return `${y2}-${m2}-${d2}`;
            }
        }

        return null;
    }

    // Parse OCR text to extract specific PH National ID fields
    parseAndFillFromRawText(text) {
        if (!this.isNationalIdSelected()) return;
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
}

// Initialize OCR processor when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.ocrProcessor = new OCRProcessor();
    });
} else {
    window.ocrProcessor = new OCRProcessor();
}