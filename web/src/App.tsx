import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom'
import PublicProfile from './components/PublicProfile'
import HomeLanding from './components/HomeLanding'

function RootRoute() {
  const location = useLocation()
  const slug = new URLSearchParams(location.search).get('slug')
  if (slug) return <Navigate to={`/${slug}`} replace />
  return <HomeLanding />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRoute />} />
        <Route path="/:slug" element={<PublicProfile />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
