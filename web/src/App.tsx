import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom'
import PublicProfile from './components/PublicProfile'
import IntapProfileBioPestsManager from './components/profile-templates/IntapProfileBioPestsManager'
import IntapProfileBioPestsOperations from './components/profile-templates/IntapProfileBioPestsOperations'
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

        {/* BioPests: identidad y contacto individual por slug; contenido corporativo compartido. */}
        <Route path="/biopestsgrd" element={<IntapProfileBioPestsManager />} />
        <Route path="/biopestsvrd" element={<IntapProfileBioPestsOperations />} />

        {/* Alias anteriores: se corrige el typo sin mantener un tercer perfil. */}
        <Route path="/biopestrd" element={<Navigate to="/biopestsgrd" replace />} />
        <Route path="/biopestsrd" element={<Navigate to="/biopestsgrd" replace />} />

        <Route path="/:slug" element={<PublicProfile />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
