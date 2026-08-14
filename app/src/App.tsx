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
import FreeLinks from './components/admin/free/FreeLinks'
import FreeLocation from './components/admin/free/FreeLocation'
import FreePortfolio from './components/admin/free/FreePortfolio'
import FreeServices from './components/admin/free/FreeServices'
import FreeStyle from './components/admin/free/FreeStyle'
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

        {/* Onboarding Premium/legacy (requiere sesión, no requiere perfil) */}
        <Route path="/admin/onboarding/slug"     element={<AdminGuard requireProfile={false} planScope="paid"><OnboardingSlug /></AdminGuard>} />
        <Route path="/admin/onboarding/category" element={<AdminGuard requireProfile={false} planScope="paid"><OnboardingCategory /></AdminGuard>} />
        <Route path="/admin/onboarding/identity" element={<AdminGuard requireProfile={false} planScope="paid"><OnboardingIdentity /></AdminGuard>} />
        <Route path="/admin/onboarding/contact"  element={<AdminGuard requireProfile={false} planScope="paid"><OnboardingContact /></AdminGuard>} />

        {/* INTAP LINK Gratis · rutas propias */}
        <Route path="/admin/free/onboarding/slug" element={<AdminGuard requireProfile={false} planScope="free"><FreeOnboardingSlug /></AdminGuard>} />
        <Route path="/admin/free/onboarding/category" element={<AdminGuard requireProfile={false} planScope="free"><FreeOnboardingCategory /></AdminGuard>} />
        <Route path="/admin/free/onboarding/identity" element={<AdminGuard requireProfile={false} planScope="free"><FreeOnboardingIdentity /></AdminGuard>} />
        <Route path="/admin/free/onboarding/contact" element={<AdminGuard requireProfile={false} planScope="free"><FreeOnboardingContact /></AdminGuard>} />
        <Route path="/admin/free/onboarding/done" element={<AdminGuard requireProfile={false} planScope="free"><FreeOnboardingDone /></AdminGuard>} />
        <Route path="/admin/free" element={<AdminGuard planScope="free"><FreeDashboard /></AdminGuard>} />
        <Route path="/admin/free/links" element={<AdminGuard planScope="free"><FreeLinks /></AdminGuard>} />
        <Route path="/admin/free/location" element={<AdminGuard planScope="free"><FreeLocation /></AdminGuard>} />
        <Route path="/admin/free/portfolio" element={<AdminGuard planScope="free"><FreePortfolio /></AdminGuard>} />
        <Route path="/admin/free/services" element={<AdminGuard planScope="free"><FreeServices /></AdminGuard>} />
        <Route path="/admin/free/style" element={<AdminGuard planScope="free"><FreeStyle /></AdminGuard>} />
        <Route path="/admin/artifacts/activate" element={<AdminGuard requireProfile={false}><ArtifactActivationAuthenticated /></AdminGuard>} />
        <Route path="/admin/artifacts" element={<AdminGuard requireProfile={false}><ArtifactManager /></AdminGuard>} />

        {/* Super Admin interno */}
        <Route path="/superadmin" element={<AdminGuard><SuperAdminDashboard /></AdminGuard>} />

        {/* Panel Premium */}
        <Route path="/admin/links"    element={<AdminGuard planScope="paid"><AdminLinks /></AdminGuard>} />
        <Route path="/admin/faqs"     element={<AdminGuard planScope="paid"><AdminFAQs /></AdminGuard>} />
        <Route path="/admin/products" element={<AdminGuard planScope="paid"><AdminProducts /></AdminGuard>} />
        <Route path="/admin/videos"   element={<AdminGuard planScope="paid"><AdminVideos /></AdminGuard>} />
        <Route path="/admin/blocks"   element={<AdminGuard planScope="paid"><AdminBlocks /></AdminGuard>} />
        <Route path="/admin/visual"    element={<AdminGuard planScope="paid"><AdminVisual /></AdminGuard>} />
        <Route path="/admin/template"   element={<AdminGuard planScope="paid"><AdminTemplate /></AdminGuard>} />
        <Route path="/admin/retention"  element={<AdminGuard><AdminRetention /></AdminGuard>} />

        {/* Entradas generales: Gratis nunca debe renderizar AdminDashboard */}
        <Route path="/admin" element={<AdminGuard planScope="paid"><AdminDashboard /></AdminGuard>} />
        <Route path="/" element={<AdminGuard planScope="paid"><AdminDashboard /></AdminGuard>} />

        {/* Rutas desconocidas en app.intaprd.com:
            si parecen slug público, redirigir a intaprd.com/{slug} */}
        <Route path="*" element={<UnknownAppRouteRedirect />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
