import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom'
import AdminPanel from './AdminPanel'
import PublicProfile from './components/PublicProfile'
import HomeLanding from './components/HomeLanding'
import AdminGuard from './components/admin/AdminGuard'
import AdminLogin from './components/admin/AdminLogin'
import AdminVerify from './components/admin/AdminVerify'
import AuthCallback from './components/admin/AuthCallback'
import AdminDashboard from './components/admin/AdminDashboard'
import AdminLinks from './components/admin/AdminLinks'
import OnboardingSlug from './components/admin/onboarding/OnboardingSlug'
import OnboardingCategory from './components/admin/onboarding/OnboardingCategory'
import OnboardingIdentity from './components/admin/onboarding/OnboardingIdentity'
import OnboardingContact from './components/admin/onboarding/OnboardingContact'

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

        {/* Super-admin (legacy) */}
        <Route path="/superadmin" element={<AdminPanel />} />

        {/* Auth */}
        <Route path="/admin/login"      element={<AdminLogin />} />
        <Route path="/admin/check-email" element={<AdminVerify />} />
        <Route path="/auth/callback"    element={<AuthCallback />} />

        {/* Onboarding wizard (guarded, no profile required) */}
        <Route path="/admin/onboarding/slug"     element={<AdminGuard requireProfile={false}><OnboardingSlug /></AdminGuard>} />
        <Route path="/admin/onboarding/category" element={<AdminGuard requireProfile={false}><OnboardingCategory /></AdminGuard>} />
        <Route path="/admin/onboarding/identity" element={<AdminGuard requireProfile={false}><OnboardingIdentity /></AdminGuard>} />
        <Route path="/admin/onboarding/contact"  element={<AdminGuard requireProfile={false}><OnboardingContact /></AdminGuard>} />

        {/* Main admin (requires profile) */}
        <Route path="/admin/links" element={<AdminGuard><AdminLinks /></AdminGuard>} />
        <Route path="/admin"       element={<AdminGuard><AdminDashboard /></AdminGuard>} />

        {/* Public profiles */}
        <Route path="/:slug" element={<PublicProfile />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
