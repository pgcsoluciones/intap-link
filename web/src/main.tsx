import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
