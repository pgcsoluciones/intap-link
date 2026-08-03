import { lazy, Suspense } from 'react'
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
import AdminGallery from './components/admin/AdminGallery'
import SuperAdminDashboard from './components/admin/SuperAdminDashboard'
import OnboardingSlug from './components/admin/onboarding/OnboardingSlug'
import OnboardingCategory from './components/admin/onboarding/OnboardingCategory'
import OnboardingIdentity from './components/admin/onboarding/OnboardingIdentity'
import OnboardingContact from './components/admin/onboarding/OnboardingContact'
import FreeOnboardingSlug from './components/admin/free/onboarding/FreeOnboardingSlug'
import FreeOnboardingCategory from './components/admin/free/onboarding/FreeOnboardingCategory'
import FreeOnboardingIdentity from './components/admin/free/onboarding/FreeOnboardingIdentity'
import FreeOnboardingContact from './components/admin/free/onboarding/FreeOnboardingContact'
import FreeLinks from './components/admin/free/FreeLinks'
import FreePortfolio from './components/admin/free/FreePortfolio'
import FreeServices from './components/admin/free/FreeServices'
import { WEB_ORIGIN } from './lib/runtime-env'
const FreeLocation = lazy(() => import('./components/admin/free/FreeLocation'))

function UnknownAppRouteRedirect() {
  const location = useLocation()
  if (location.pathname.startsWith('/admin') || location.pathname.startsWith('/auth')) {
    return <Navigate to="/admin" replace />
  }

  window.location.replace(`${WEB_ORIGIN}${location.pathname}${location.search}${location.hash}`)
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

        {/* Onboarding (requiere sesión, no requiere perfil) */}
        <Route path="/admin/onboarding/slug"     element={<AdminGuard requireProfile={false}><OnboardingSlug /></AdminGuard>} />
        <Route path="/admin/onboarding/category" element={<AdminGuard requireProfile={false}><OnboardingCategory /></AdminGuard>} />
        <Route path="/admin/onboarding/identity" element={<AdminGuard requireProfile={false}><OnboardingIdentity /></AdminGuard>} />
        <Route path="/admin/onboarding/contact"  element={<AdminGuard requireProfile={false}><OnboardingContact /></AdminGuard>} />

        {/* Onboarding exclusivo INTAP LINK Gratis */}
        <Route
          path="/admin/free/onboarding/slug"
          element={
            <AdminGuard requireProfile={false} planScope="free">
              <FreeOnboardingSlug />
            </AdminGuard>
          }
        />
        <Route
          path="/admin/free/onboarding/category"
          element={
            <AdminGuard requireProfile={false} planScope="free">
              <FreeOnboardingCategory />
            </AdminGuard>
          }
        />
        <Route
          path="/admin/free/onboarding/identity"
          element={
            <AdminGuard requireProfile={false} planScope="free">
              <FreeOnboardingIdentity />
            </AdminGuard>
          }
        />
        <Route
          path="/admin/free/onboarding/contact"
          element={
            <AdminGuard requireProfile={false} planScope="free">
              <FreeOnboardingContact />
            </AdminGuard>
          }
        />
        <Route
          path="/admin/free/location"
          element={
            <AdminGuard planScope="free">
              <Suspense
                fallback={
                  <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                    <div className="loading-spinner" />
                  </div>
                }
              >
                <FreeLocation />
              </Suspense>
            </AdminGuard>
          }
        />
        <Route
          path="/admin/free/links"
          element={
            <AdminGuard planScope="free">
              <FreeLinks />
            </AdminGuard>
          }
        />
        <Route
          path="/admin/free/portfolio"
          element={
            <AdminGuard planScope="free">
              <FreePortfolio />
            </AdminGuard>
          }
        />
        <Route
          path="/admin/free/services"
          element={
            <AdminGuard planScope="free">
              <FreeServices />
            </AdminGuard>
          }
        />

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
        <Route path="/admin/gallery"    element={<AdminGuard planScope="paid"><AdminGallery /></AdminGuard>} />
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
