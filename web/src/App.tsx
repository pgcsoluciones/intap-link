import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom'
import PublicProfile from './components/PublicProfile'
import IntapLinkGratisDemo from './components/free-profile/IntapLinkGratisDemo'
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
        <Route
          path="/demo/intap-link-gratis"
          element={<IntapLinkGratisDemo />}
        />
        <Route
          path="/demo/intap-link-gratis/:layoutId"
          element={<IntapLinkGratisDemo />}
        />
        <Route path="/:slug" element={<PublicProfile />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
