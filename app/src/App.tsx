import { BrowserRouter, Routes, Route } from 'react-router-dom'
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
import OnboardingSlug from './components/admin/onboarding/OnboardingSlug'
import OnboardingCategory from './components/admin/onboarding/OnboardingCategory'
import OnboardingIdentity from './components/admin/onboarding/OnboardingIdentity'
import OnboardingContact from './components/admin/onboarding/OnboardingContact'

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

        {/* Panel principal (requiere sesión + perfil) */}
        <Route path="/admin/links"    element={<AdminGuard><AdminLinks /></AdminGuard>} />
        <Route path="/admin/faqs"     element={<AdminGuard><AdminFAQs /></AdminGuard>} />
        <Route path="/admin/products" element={<AdminGuard><AdminProducts /></AdminGuard>} />
        <Route path="/admin/videos"   element={<AdminGuard><AdminVideos /></AdminGuard>} />
        <Route path="/admin/blocks"   element={<AdminGuard><AdminBlocks /></AdminGuard>} />
        <Route path="/admin/visual"    element={<AdminGuard><AdminVisual /></AdminGuard>} />
        <Route path="/admin/template"   element={<AdminGuard><AdminTemplate /></AdminGuard>} />
        <Route path="/admin/retention"  element={<AdminGuard><AdminRetention /></AdminGuard>} />
        <Route path="/admin"            element={<AdminGuard><AdminDashboard /></AdminGuard>} />

        {/* Entrada protegida */}
        <Route path="/" element={<AdminGuard><AdminDashboard /></AdminGuard>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
