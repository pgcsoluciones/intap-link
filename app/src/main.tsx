import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

const initialPath = window.location.pathname
document.body.classList.toggle(
  'kawvo-free-mobile',
  initialPath.startsWith('/admin/free') || initialPath.startsWith('/admin/artifacts'),
)

const standalone = window.matchMedia('(display-mode: standalone)').matches || Boolean((window.navigator as any).standalone)
if (standalone) localStorage.setItem('kawvo_pwa_installed', '1')

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined)
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
