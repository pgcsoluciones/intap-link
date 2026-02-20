import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom'
import Dashboard from './Dashboard'
import AdminPanel from './AdminPanel'
import PublicProfile from './components/PublicProfile'

function RootRoute() {
  const location = useLocation()
  const slug = new URLSearchParams(location.search).get('slug')

  // Si viene ?slug=juan => redirige de forma inmediata (sin useEffect)
  if (slug) return <Navigate to={`/${slug}`} replace />

  // Si no, muestra el dashboard normal
  return <Dashboard />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRoute />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/:slug" element={<PublicProfile />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
