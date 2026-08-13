import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import AdminGuard from './components/admin/AdminGuard'
import AdminLogin from './components/admin/AdminLogin'
import AdminVerify from './components/admin/AdminVerify'
import AuthCallback from './components/admin/AuthCallback'
import AdminDashboard from './components/admin/AdminDashboard'
import AdminLinks from './components/admin/AdminLinks'
import AdminFAQs from './components/admin/AdminFAQs'
import AdminProducts from './components/admin/AdminProducts'
import AdminVideos from './components/admin/AdminVideos'
import AdminBlocks from './components/admin/AdminBlocks'
import AdminVisual from './components/admin/AdminVisual'
import AdminTemplate from './components/admin/AdminTemplate'
import AdminRetention from './components/admin/AdminRetention'
import SuperAdminDashboard from './components/admin/SuperAdminDashboard'
import OnboardingSlug from './components/admin/onboarding/OnboardingSlug'
import OnboardingCategory from './components/admin/onboarding/OnboardingCategory'
import OnboardingIdentity from './components/admin/onboarding/OnboardingIdentity'
import OnboardingContact from './components/admin/onboarding/OnboardingContact'
import FreeDashboard from './components/admin/free/FreeDashboard'
import FreeOnboardingSlug from './components/admin/free/onboarding/FreeOnboardingSlug'
import FreeOnboardingCategory from './components/admin/free/onboarding/FreeOnboardingCategory'
import FreeOnboardingIdentity from './components/admin/free/onboarding/FreeOnboardingIdentity'
import FreeOnboardingContact from './components/admin/free/onboarding/FreeOnboardingContact'
import FreeOnboardingDone from './components/admin/free/onboarding/FreeOnboardingDone'
import { ArtifactActivation, ArtifactActivationAuthenticated, ArtifactManager } from './components/admin/ArtifactActivation'

function UnknownAppRouteRedirect() {
  const location = useLocation()
  const WEB_URL = (import.meta.env.VITE_WEB_URL ?? 'https://intaprd.com').replace(/\/$/, '')

  if (location.pathname.startsWith('/admin') || location.pathname.startsWith('/auth')) {
    return <Navigate to="/admin" replace />
  }

  window.location.replace(`${WEB_URL}${location.pathname}${location.search}${location.hash}`)
  return null
}


function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth */}
        <Route path="/admin/login"       element={<AdminLogin />} />
        <Route path="/admin/check-email" element={<AdminVerify />} />
        <Route path="/auth/callback"     element={<AuthCallback />} />
        <Route path="/activate" element={<ArtifactActivation />} />

        {/* Onboarding (requiere sesión, no requiere perfil) */}
        <Route path="/admin/onboarding/slug"     element={<AdminGuard requireProfile={false}><OnboardingSlug /></AdminGuard>} />
        <Route path="/admin/onboarding/category" element={<AdminGuard requireProfile={false}><OnboardingCategory /></AdminGuard>} />
        <Route path="/admin/onboarding/identity" element={<AdminGuard requireProfile={false}><OnboardingIdentity /></AdminGuard>} />
        <Route path="/admin/onboarding/contact"  element={<AdminGuard requireProfile={false}><OnboardingContact /></AdminGuard>} />

        {/* INTAP LINK Gratis · rutas propias */}
        <Route path="/admin/free/onboarding/slug" element={<AdminGuard requireProfile={false} planScope="free"><FreeOnboardingSlug /></AdminGuard>} />
        <Route path="/admin/free/onboarding/category" element={<AdminGuard requireProfile={false} planScope="free"><FreeOnboardingCategory /></AdminGuard>} />
        <Route path="/admin/free/onboarding/identity" element={<AdminGuard requireProfile={false} planScope="free"><FreeOnboardingIdentity /></AdminGuard>} />
        <Route path="/admin/free/onboarding/contact" element={<AdminGuard requireProfile={false} planScope="free"><FreeOnboardingContact /></AdminGuard>} />
        <Route path="/admin/free/onboarding/done" element={<AdminGuard requireProfile={false} planScope="free"><FreeOnboardingDone /></AdminGuard>} />
        <Route path="/admin/free" element={<AdminGuard planScope="free"><FreeDashboard /></AdminGuard>} />
        <Route path="/admin/artifacts/activate" element={<AdminGuard requireProfile={false}><ArtifactActivationAuthenticated /></AdminGuard>} />
        <Route path="/admin/artifacts" element={<AdminGuard requireProfile={false}><ArtifactManager /></AdminGuard>} />

        {/* Super Admin interno */}
        <Route path="/superadmin" element={<AdminGuard><SuperAdminDashboard /></AdminGuard>} />

        {/* Panel principal (requiere sesión + perfil) */}
        <Route path="/admin/links"    element={<AdminGuard planScope="paid"><AdminLinks /></AdminGuard>} />
        <Route path="/admin/faqs"     element={<AdminGuard planScope="paid"><AdminFAQs /></AdminGuard>} />
        <Route path="/admin/products" element={<AdminGuard planScope="paid"><AdminProducts /></AdminGuard>} />
        <Route path="/admin/videos"   element={<AdminGuard planScope="paid"><AdminVideos /></AdminGuard>} />
        <Route path="/admin/blocks"   element={<AdminGuard planScope="paid"><AdminBlocks /></AdminGuard>} />
        <Route path="/admin/visual"    element={<AdminGuard planScope="paid"><AdminVisual /></AdminGuard>} />
        <Route path="/admin/template"   element={<AdminGuard planScope="paid"><AdminTemplate /></AdminGuard>} />
        <Route path="/admin/retention"  element={<AdminGuard><AdminRetention /></AdminGuard>} />
        <Route path="/admin"            element={<AdminGuard><AdminDashboard /></AdminGuard>} />

        {/* Entrada protegida */}
        <Route path="/" element={<AdminGuard><AdminDashboard /></AdminGuard>} />

        {/* Rutas desconocidas en app.intaprd.com:
            si parecen slug público, redirigir a intaprd.com/{slug} */}
        <Route path="*" element={<UnknownAppRouteRedirect />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
