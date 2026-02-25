import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom'
import AdminPanel from './AdminPanel'
import PublicProfile from './components/PublicProfile'
import HomeLanding from './components/HomeLanding'

function RootRoute() {
  const location = useLocation()
  const slug = new URLSearchParams(location.search).get('slug')

  // Si viene ?slug=juan => redirige a /:slug
  if (slug) return <Navigate to={`/${slug}`} replace />

  // Sin slug: landing propia
  return <HomeLanding />
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
