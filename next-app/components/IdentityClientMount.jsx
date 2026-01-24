'use client'
import { useEffect, useRef } from 'react'

function loadScript(src){
  return new Promise((resolve, reject)=>{
    if(document.querySelector(`script[src="${src}"]`)) return resolve()
    const s = document.createElement('script')
    s.src = src
    s.async = false
    s.onload = ()=>resolve()
    s.onerror = (e)=>reject(e)
    document.body.appendChild(s)
  })
}

export default function IdentityClientMount({ embedMode=false }){
  const containerRef = useRef(null)

  useEffect(()=>{
    // Render a minimal DOM that the legacy scripts expect
    const container = containerRef.current
    if(!container) return

    // Insert the main structure expected by the legacy scripts (IDs are referenced by original JS)
    container.innerHTML = `
      <div class="app-container">
        <div id="camera-root">
          <video id="video" autoplay muted playsinline></video>
          <canvas id="canvas" style="display:none"></canvas>
        </div>
        <div id="results-root"></div>
      </div>
    `

    // Load original scripts from /js. Preserve order: camera, alignment, scanning-algorithm, ocr, main
    const scripts = [
      '/js/camera.js',
      '/js/alignment.js',
      '/js/ocr.js',
      '/js/main.js'
    ]

    // load sequentially
    ;(async ()=>{
      for(const s of scripts){
        try{ await loadScript(s) }catch(e){ console.warn('Failed loading', s, e) }
      }
    })()

    return ()=>{
      // do minimal cleanup: remove added nodes but keep scripts cached
      if(container) container.innerHTML = ''
    }
  },[])

  return (
    <div ref={containerRef} className="w-full" />
  )
}
