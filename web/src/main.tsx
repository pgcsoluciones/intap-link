import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import FreePreviewEditShortcut from './components/free-profile/FreePreviewEditShortcut'
import './index.css'
import './components/profile-templates/IntapProfileAdonisgV1.mobile.css'

// ✅ Redirección ultra-temprana (antes de que React se monte)
// Soporta: /?slug=juan  →  /juan
(() => {
  try {
    const q = new URLSearchParams(window.location.search)
    const slug = q.get('slug')

    // Solo redirige si estás en la raíz y existe slug
    if (slug && (window.location.pathname === '/' || window.location.pathname === '')) {
      const target = `/${encodeURIComponent(slug)}`
      window.location.replace(target)
      return
    }
  } catch {
    // Si algo falla, no bloquea la app
  }
})()

// Safari/iPhone requires video.play() to happen inside the original user gesture.
// The Argenis template previously deferred play() with setTimeout after React state,
// which can lose iOS user activation. Capture the tap first and start the featured
// video synchronously; React can still update its own state afterwards.
document.addEventListener('click', (event) => {
  const target = event.target
  if (!(target instanceof Element)) return
  const playButton = target.closest('.adonis-video-play')
  if (!playButton) return
  const stage = playButton.closest('.adonis-video-feature')
  const video = stage?.querySelector('video')
  if (!(video instanceof HTMLVideoElement)) return

  video.controls = true
  video.playsInline = true
  const result = video.play()
  if (result && typeof result.catch === 'function') {
    result.catch(() => {
      // Native controls remain visible so the user can retry directly.
      video.controls = true
    })
  }
}, true)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <FreePreviewEditShortcut />
  </React.StrictMode>
)
