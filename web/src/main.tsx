import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import FreePreviewEditShortcut from './components/free-profile/FreePreviewEditShortcut'
import { installTeamPublicAccessPolicy, warmTeamPublicProfile } from './team-public-access-policy'
import './index.css'
import './components/profile-templates/IntapProfileAdonisgV1.mobile.css'

(() => {
  try {
    const q = new URLSearchParams(window.location.search)
    const slug = q.get('slug')
    if (slug && (window.location.pathname === '/' || window.location.pathname === '')) {
      const target = `/${encodeURIComponent(slug)}`
      window.location.replace(target)
      return
    }
  } catch {
    // no bloquea la app
  }
})()

// Safari/iPhone requires video.play() inside the original user gesture.
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
    result.catch(() => { video.controls = true })
  }
}, true)

async function bootstrap() {
  // Para perfiles Team sincronizamos primero los datos heredados del Master.
  // Así React solicita el perfil cuando plantilla, portafolio, servicios y demás
  // secciones corporativas ya están actualizadas.
  await warmTeamPublicProfile().catch(() => undefined)
  installTeamPublicAccessPolicy()

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
      <FreePreviewEditShortcut />
    </React.StrictMode>
  )
}

void bootstrap()
