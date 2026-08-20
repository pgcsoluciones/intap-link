import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

const initialPath = window.location.pathname
document.body.classList.toggle(
  'kawvo-free-mobile',
  initialPath.startsWith('/admin/free') || initialPath.startsWith('/admin/artifacts'),
)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
