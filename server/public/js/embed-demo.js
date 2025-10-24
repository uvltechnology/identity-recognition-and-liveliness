(function(){
  const createBtn = document.getElementById('createBtn');
  const openWrapper = document.getElementById('openWrapper');
  const iframeContainer = document.getElementById('iframeContainer');
  const sessionInfo = document.getElementById('sessionInfo');
  const messages = document.getElementById('messages');
  const frontendBaseEl = document.getElementById('frontendBase');

  let current = null;
  let iframeEl = null;
  let pollTimer = null;

  function showMessage(m){
    messages.innerHTML = `<pre>${JSON.stringify(m, null, 2)}</pre>`;
  }

  window.addEventListener('message', (evt) => {
    try{
      const d = evt.data;
      const origin = evt.origin;
      if (d && d.identityOCR) {
        const message = Object.assign({}, d.identityOCR, { _origin: origin });
        showMessage(message);
        
        // Log postMessage activity for live API monitoring
        if (typeof logApiResponse === 'function') {
          logApiResponse(200, {
            type: 'PostMessage - Identity OCR',
            action: message.action || 'unknown',
            data: message,
            origin: origin
          });
        }
        
        // Handle test mode authorization completion
        if (message.action === 'test_auth_complete') {
          console.log('🧪 Test Mode Authorization Result:', message);
          
          // Update session info with test result
          const resultText = message.authorized ? 'Authorized' : 'Cancelled Authorization';
          const statusColor = message.authorized ? '#10b981' : '#ef4444';
          
          const testResult = document.createElement('div');
          testResult.style.cssText = `
            margin-top: 1rem; 
            padding: 1rem; 
            background: ${statusColor}20; 
            border: 1px solid ${statusColor}; 
            border-radius: 6px;
            color: ${statusColor};
            font-weight: bold;
          `;
          testResult.innerHTML = `🧪 Test Mode Result: ${resultText}`;
          
          const sessionInfoDiv = document.getElementById('sessionInfo');
          if (sessionInfoDiv) {
            sessionInfoDiv.appendChild(testResult);
          }
        }
      } else if (d && d.type) {
        // Log other postMessage types for live API monitoring
        if (typeof logApiResponse === 'function') {
          logApiResponse(200, {
            type: 'PostMessage - ' + d.type,
            data: d,
            origin: origin
          });
        }
      }
    }catch(e){ console.warn('message handler error', e); }
  });

  createBtn.addEventListener('click', async () => {
    createBtn.disabled = true;
    createBtn.textContent = 'Creating…';
    try{
  const frontendBase = frontendBaseEl.value?.trim() || undefined;
  const idType = (document.getElementById('demoIdType')?.value) || undefined;
  const testModeValue = (document.getElementById('testModeSelect')?.value) || 'camera';
  
  // Determine testMode based on selection
  const testMode = testModeValue === 'test';
  
  const payload = { 
    ...(frontendBase ? { frontendBase } : {}), 
    ...(idType ? { idType } : {}),
    testMode: testMode
  };
      // Log API request for live monitoring
      if (typeof logApiRequest === 'function') {
        logApiRequest('POST', '/api/verify/create', payload);
      }
      
      const res = await fetch('/api/verify/create', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
      const json = await res.json();
      
      // Log API response for live monitoring
      if (typeof logApiResponse === 'function') {
        logApiResponse(res.status, json);
      }
      
      if (!json?.success) {
        sessionInfo.innerText = 'Failed to create session: ' + (json?.error || JSON.stringify(json));
        return;
      }
      current = json;
      sessionInfo.innerHTML = `<pre>${JSON.stringify(json, null, 2)}</pre>`;

      // embed the identity iframe (hosted by identity server) using iframeUrl when available
      // Pass expectedOrigin so the embed page knows where to postMessage back to
  const embedExpectedOrigin = frontendBaseEl.value?.trim() || window.location.origin;
  const expectedOrigin = embedExpectedOrigin;
  const baseSrc = json.iframeUrl || json.wrapperUrl || json.directAdminUrl;
      const src = baseSrc + (baseSrc.includes('?') ? '&' : '?') + `expectedOrigin=${encodeURIComponent(expectedOrigin)}`;
      iframeEl = document.createElement('iframe');
      iframeEl.src = src;
      iframeEl.style.width = '100%';
      iframeEl.style.height = '100%';
      iframeEl.style.border = '0';
      iframeEl.allow = 'camera; microphone; fullscreen';
      iframeEl.setAttribute('referrerpolicy', 'no-referrer');

      // If modal exists, show modal and inject iframe there; otherwise fallback to inline container
      const embedModal = document.getElementById('embedModal');
      const modalArea = document.getElementById('modalFrameArea');
      if (embedModal && modalArea) {
        modalArea.innerHTML = '';
        modalArea.appendChild(iframeEl);
        embedModal.style.display = 'flex';

        // Close handlers
        const modalClose = document.getElementById('modalClose');
        const closeModal = () => { embedModal.style.display = 'none'; modalArea.innerHTML = ''; };
        modalClose.addEventListener('click', closeModal);
        // ESC key
        const escHandler = (e) => { if (e.key === 'Escape') { closeModal(); window.removeEventListener('keydown', escHandler); } };
        window.addEventListener('keydown', escHandler);
      } else {
        iframeContainer.innerHTML = '';
        iframeContainer.appendChild(iframeEl);
      }

      // Start polling session state
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(async () => {
        try {
          const sessionUrl = `/api/verify/session/${encodeURIComponent(json.sessionId)}`;
          
          // Log polling request (only first few times to avoid spam)
          const pollCount = window.pollRequestCount || 0;
          if (pollCount < 3 && typeof logApiRequest === 'function') {
            logApiRequest('GET', sessionUrl + ' (polling)', null);
            window.pollRequestCount = pollCount + 1;
          }
          
          const resp = await fetch(sessionUrl);
          if (!resp.ok) return;
          const j = await resp.json();
          
          // Log polling response (only if data changed)
          if (pollCount < 3 && typeof logApiResponse === 'function') {
            logApiResponse(resp.status, { ...j, note: 'Session polling update' });
          }
          
          sessionInfo.innerHTML = `<pre>${JSON.stringify(j, null, 2)}</pre>`;
        } catch (e) { /* ignore */ }
      }, 2000);

    }catch(e){ sessionInfo.innerText = 'Error: ' + String(e); }
    finally { createBtn.disabled = false; createBtn.textContent='Create & Embed'; }
  });

  openWrapper.addEventListener('click', () => {
    if (!current) return alert('Create a session first');
    const url = current.wrapperUrl || current.iframeUrl || current.directAdminUrl;
    window.open(url, '_blank');
  });

  // Push a simulated verification result to the server for the current session
  const pushResultBtn = document.getElementById('pushResult');
  pushResultBtn.addEventListener('click', async () => {
    if (!current) return alert('Create a session first');
    try {
      pushResultBtn.disabled = true;
      pushResultBtn.textContent = 'Pushing…';
      const payload = {
        status: 'done',
        result: { verified: true, confidence: 'high' },
        payload: { note: 'Demo pushed result' },
        ttlSeconds: 300
      };
      
      const resultUrl = `/api/verify/session/${encodeURIComponent(current.sessionId)}/result`;
      
      // Log push result request for live monitoring
      if (typeof logApiRequest === 'function') {
        logApiRequest('POST', resultUrl, payload);
      }
      
      const resp = await fetch(resultUrl, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
      const j = await resp.json();
      
      // Log push result response for live monitoring
      if (typeof logApiResponse === 'function') {
        logApiResponse(resp.status, j);
      }
      
      if (!j?.success) alert('Push failed: ' + JSON.stringify(j));
      sessionInfo.innerHTML = `<pre>${JSON.stringify(j, null, 2)}</pre>`;
    } catch (e) { alert('Error: ' + String(e)); }
    finally { pushResultBtn.disabled = false; pushResultBtn.textContent = 'Push Result'; }
  });
})();