import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { installKawvoBranding } from './kawvo-brand'
import './index.css'
import './kawvo-brand.css'

const initialPath = window.location.pathname
document.body.classList.toggle(
  'kawvo-free-mobile',
  initialPath.startsWith('/admin/free') || initialPath.startsWith('/admin/artifacts'),
)

const standalone = window.matchMedia('(display-mode: standalone)').matches || Boolean((window.navigator as any).standalone)

window.addEventListener('beforeinstallprompt', (event: Event) => {
  event.preventDefault()
  ;(window as any).__kawvoInstallPrompt = event
  window.dispatchEvent(new Event('kawvo:pwa-install-ready'))
})

window.addEventListener('appinstalled', () => {
  localStorage.setItem('kawvo_pwa_installed', '1')
  ;(window as any).__kawvoInstallPrompt = null
})
if (standalone) localStorage.setItem('kawvo_pwa_installed', '1')

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined)
  })
}

installKawvoBranding()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
