(function(){
  const createBtn = document.getElementById('createBtn');
  const openWrapper = document.getElementById('openWrapper');
  const pushResult = document.getElementById('pushResult');
  const iframeContainer = document.getElementById('iframeContainer');
  const modal = document.getElementById('embedModal');
  const modalFrameArea = document.getElementById('modalFrameArea');
  const modalClose = document.getElementById('modalClose');
  const sessionInfo = document.getElementById('sessionInfo');
  const messages = document.getElementById('messages');
  let currentSession = null;
  let currentIframe = null;

  function logMessage(m){
    const node = document.createElement('div');
    node.textContent = `[${new Date().toLocaleTimeString()}] ${JSON.stringify(m)}`;
    messages.innerHTML = '';
    messages.appendChild(node);
  }

  function showSession(s){
    currentSession = s;
    sessionInfo.innerHTML = `<pre>${JSON.stringify(s, null, 2)}</pre>`;
  }

  createBtn.addEventListener('click', async ()=>{
    const frontendBase = document.getElementById('frontendBase').value || undefined;
    const idType = document.getElementById('demoIdType').value || 'national-id';
    const successWebhook = document.getElementById('successWebhook').value || undefined;
    const cancelWebhook = document.getElementById('cancelWebhook').value || undefined;

    const payload = { frontendBase, idType };
    if (successWebhook) payload.successWebhook = successWebhook;
    if (cancelWebhook) payload.cancelWebhook = cancelWebhook;

    try{
      createBtn.disabled = true;
      createBtn.textContent = 'Creating...';
      const res = await fetch('/api/verify/create', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!json || !json.success) {
        alert('Failed to create session: ' + (json?.error || 'unknown'));
        return;
      }
      showSession(json);
      // Build iframe src (prefer server-provided iframeUrl)
      const src = json.iframeUrl || json.wrapperUrl || json.directAdminUrl || '';
      // Open modal with iframe
      openModalWithSrc(src + (src.includes('?') ? '&' : '?') + `expectedOrigin=${encodeURIComponent(window.location.origin)}`);
    }catch(e){
      console.warn('create session failed', e);
      alert('Failed to create session');
    }finally{
      createBtn.disabled = false;
      createBtn.textContent = 'Create & Embed';
    }
  });

  openWrapper.addEventListener('click', ()=>{
    if (!currentSession) return alert('No session created');
    const origin = window.location.origin;
    const url = (currentSession.wrapperUrl || '') + (currentSession.wrapperUrl && currentSession.wrapperUrl.includes('?') ? '&' : '?') + `frontendBase=${encodeURIComponent(window.location.origin)}`;
    window.open(url, '_blank');
  });

  pushResult.addEventListener('click', async ()=>{
    if (!currentSession) return alert('No session created');
    try{
      const sid = currentSession.sessionId || currentSession.sessionId || currentSession.sessionId;
      await fetch(`/api/verify/session/${encodeURIComponent(sid)}/result`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ status: 'done', result: { fields: { firstName: 'Demo', lastName: 'User', idNumber: 'X1234567' } }, finishedAt: new Date().toISOString() }) });
      alert('Pushed demo result');
    }catch(e){ console.warn('push result failed', e); alert('Push failed'); }
  });

  function openModalWithSrc(src){
    // create iframe
    modal.style.display = 'flex';
    modalFrameArea.innerHTML = '';
    const ifr = document.createElement('iframe');
    ifr.src = src;
    ifr.title = 'Identity embed demo frame';
    ifr.style.width = '100%';
    ifr.style.height = '100%';
    ifr.setAttribute('allow','camera; microphone; fullscreen');
    modalFrameArea.appendChild(ifr);
    currentIframe = ifr;
  }

  modalClose.addEventListener('click', ()=>{ modal.style.display = 'none'; modalFrameArea.innerHTML = ''; currentIframe = null; });
  // ESC to close
  window.addEventListener('keydown', (ev)=>{ if (ev.key === 'Escape' && modal.style.display === 'flex') { modalClose.click(); } });

  // Listen for postMessage from embed
  window.addEventListener('message', (evt)=>{
    try{
      const msg = evt.data;
      logMessage({ origin: evt.origin, data: msg });
      // If session update arrives, refresh session info
      if (msg && msg.identityOCR && msg.identityOCR.session) {
        // Poll the session endpoint once to refresh state
        fetch(`/api/verify/session/${encodeURIComponent(msg.identityOCR.session)}`).then(r=>r.json()).then(j=>{ if (j && j.success) showSession(j); });
      }
    }catch(e){ console.warn('message handler error', e); }
  });
})();
