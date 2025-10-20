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
        showMessage(Object.assign({}, d.identityOCR, { _origin: origin }));
      }
    }catch(e){ console.warn('message handler error', e); }
  });

  createBtn.addEventListener('click', async () => {
    createBtn.disabled = true;
    createBtn.textContent = 'Creating…';
    try{
  const frontendBase = frontendBaseEl.value?.trim() || undefined;
  const idType = (document.getElementById('demoIdType')?.value) || undefined;
  const payload = { ...(frontendBase ? { frontendBase } : {}), ...(idType ? { idType } : {}) };
      const res = await fetch('/api/verify/create', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
      const json = await res.json();
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
          const resp = await fetch(`/api/verify/session/${encodeURIComponent(json.sessionId)}`);
          if (!resp.ok) return;
          const j = await resp.json();
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
      const resp = await fetch(`/api/verify/session/${encodeURIComponent(current.sessionId)}/result`, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
      const j = await resp.json();
      if (!j?.success) alert('Push failed: ' + JSON.stringify(j));
      sessionInfo.innerHTML = `<pre>${JSON.stringify(j, null, 2)}</pre>`;
    } catch (e) { alert('Error: ' + String(e)); }
    finally { pushResultBtn.disabled = false; pushResultBtn.textContent = 'Push Result'; }
  });
})();