import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom'
import PublicProfile from './components/PublicProfile'
import IntapProfileBioPests from './components/profile-templates/IntapProfileBioPests'
import MarketingLanding from './components/marketing/MarketingLanding'

function RootRoute() {
  const location = useLocation()
  const slug = new URLSearchParams(location.search).get('slug')
  if (slug) return <Navigate to={`/${slug}`} replace />
  return <MarketingLanding />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRoute />} />

        {/* BioPests: dos perfiles canónicos que comparten la plantilla corporativa. */}
        <Route path="/biopestsgrd" element={<IntapProfileBioPests />} />
        <Route path="/biopestsvrd" element={<IntapProfileBioPests />} />

        {/* Alias anteriores: se corrige el typo sin mantener un tercer perfil. */}
        <Route path="/biopestrd" element={<Navigate to="/biopestsgrd" replace />} />
        <Route path="/biopestsrd" element={<Navigate to="/biopestsgrd" replace />} />

        <Route path="/:slug" element={<PublicProfile />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
