import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import AdminGuard from './components/admin/AdminGuard'
import SuperAdminGuard from './components/admin/SuperAdminGuard'
import AdminLogin from './components/admin/AdminLogin'
import AdminVerify from './components/admin/AdminVerify'
import AuthCallback from './components/admin/AuthCallback'
import ActivationAuthorityEntry from './components/admin/ActivationAuthorityEntry'
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
import SuperAdminArtifacts from './components/admin/SuperAdminArtifacts'
import SuperAdminSupport from './components/admin/SuperAdminSupport'
import SuperAdminResources from './components/admin/SuperAdminResources'
import SuperAdminFeedback from './components/admin/SuperAdminFeedback'
import SuperAdminDemoMetrics from './components/admin/SuperAdminDemoMetrics'
import SuperAdminPromotions from './components/admin/SuperAdminPromotions'
import OnboardingSlug from './components/admin/onboarding/OnboardingSlug'
import OnboardingCategory from './components/admin/onboarding/OnboardingCategory'
import OnboardingIdentity from './components/admin/onboarding/OnboardingIdentity'
import OnboardingContact from './components/admin/onboarding/OnboardingContact'
import FreeDashboard from './components/admin/free/FreeDashboard'
import FreeIdentifier from './components/admin/free/FreeIdentifier'
import FreeLinks from './components/admin/free/FreeLinks'
import FreeLocation from './components/admin/free/FreeLocation'
import FreePortfolio from './components/admin/free/FreePortfolio'
import FreeQuickActions from './components/admin/free/FreeQuickActions'
import FreeServices from './components/admin/free/FreeServices'
import FreeStyle from './components/admin/free/FreeStyle'
import FreeVisualEditor from './components/admin/free/FreeVisualEditor'
import FreeBankAccounts from './components/admin/free/FreeBankAccounts'
import FreeContextHelp from './components/admin/free/FreeContextHelp'
import FreeRouteUx from './components/admin/free/FreeRouteUx'
import FreePwaHome from './components/admin/free/FreePwaHome'
import FreeAccount from './components/admin/free/FreeAccount'
import FreeNotifications from './components/admin/free/FreeNotifications'
import FreeTeamEntry from './components/admin/free/FreeTeamEntry'
import FreeTeamMember from './components/admin/free/FreeTeamMember'
import FreeTeamJoin from './components/admin/free/FreeTeamJoin'
import FreeTeamAssign from './components/admin/free/FreeTeamAssign'
import FreeTeamMemberEdit from './components/admin/free/FreeTeamMemberEdit'
import FreeTeamRoleLogin from './components/admin/free/FreeTeamRoleLogin'
import TeamPermissionGuard from './components/admin/free/TeamPermissionGuard'
import FreeOnboardingSlug from './components/admin/free/onboarding/FreeOnboardingSlug'
import FreeOnboardingCategory from './components/admin/free/onboarding/FreeOnboardingCategory'
import FreeOnboardingIdentity from './components/admin/free/onboarding/FreeOnboardingIdentity'
import FreeOnboardingContact from './components/admin/free/onboarding/FreeOnboardingContact'
import FreeOnboardingDone from './components/admin/free/onboarding/FreeOnboardingDone'
import FreeOnboardingWelcome from './components/admin/free/onboarding/FreeOnboardingWelcome'
import FreeOnboardingIntro from './components/admin/free/onboarding/FreeOnboardingIntro'
import FreeOnboardingSource from './components/admin/free/onboarding/FreeOnboardingSource'
import FreeOnboardingBuilder from './components/admin/free/onboarding/FreeOnboardingBuilder'
import FreeOnboardingReview from './components/admin/free/onboarding/FreeOnboardingReview'
import FreeArtifactActivation from './components/admin/free/onboarding/FreeArtifactActivation'
import { ArtifactManager } from './components/admin/ArtifactActivation'

const FreeAiProfileAssistant = lazy(() => import('./components/admin/free/FreeAiProfileAssistant'))
function AiRouteFallback(){return <div className="min-h-screen bg-[#f7f9fc] flex items-center justify-center"><div className="loading-spinner" /></div>}
function UnknownAppRouteRedirect(){const location=useLocation();const WEB_URL=(import.meta.env.VITE_WEB_URL??'https://intaprd.com').replace(/\/$/,'');if(location.pathname.startsWith('/admin')||location.pathname.startsWith('/auth'))return <Navigate to="/admin" replace/>;window.location.replace(`${WEB_URL}${location.pathname}${location.search}${location.hash}`);return null}

function App(){return <BrowserRouter><FreeRouteUx/><Routes>
<Route path="/admin/login" element={<AdminLogin/>}/><Route path="/admin/check-email" element={<AdminVerify/>}/><Route path="/auth/callback" element={<AuthCallback/>}/><Route path="/team-access/:slug" element={<FreeTeamRoleLogin/>}/><Route path="/activate-product/:publicCode" element={<ActivationAuthorityEntry/>}/><Route path="/activate" element={<Navigate to="/admin/artifacts/activate" replace/>}/>
<Route path="/admin/onboarding/slug" element={<AdminGuard requireProfile={false} planScope="paid"><OnboardingSlug/></AdminGuard>}/><Route path="/admin/onboarding/category" element={<AdminGuard requireProfile={false} planScope="paid"><OnboardingCategory/></AdminGuard>}/><Route path="/admin/onboarding/identity" element={<AdminGuard requireProfile={false} planScope="paid"><OnboardingIdentity/></AdminGuard>}/><Route path="/admin/onboarding/contact" element={<AdminGuard requireProfile={false} planScope="paid"><OnboardingContact/></AdminGuard>}/>
<Route path="/admin/free/onboarding/welcome" element={<FreeOnboardingWelcome/>}/><Route path="/admin/free/onboarding/product" element={<Navigate to="/admin/free/onboarding/welcome" replace/>}/><Route path="/admin/free/onboarding/bootstrap" element={<Navigate to="/admin/free/onboarding/welcome" replace/>}/><Route path="/admin/free/onboarding/intro" element={<AdminGuard requireProfile={false} planScope="free"><FreeOnboardingIntro/></AdminGuard>}/><Route path="/admin/free/onboarding/category" element={<AdminGuard requireProfile={false} planScope="free"><FreeOnboardingCategory/></AdminGuard>}/><Route path="/admin/free/onboarding/source" element={<AdminGuard requireProfile={false} planScope="free"><FreeOnboardingSource/></AdminGuard>}/><Route path="/admin/free/onboarding/builder" element={<AdminGuard requireProfile={false} planScope="free"><FreeOnboardingBuilder/></AdminGuard>}/><Route path="/admin/free/onboarding/review" element={<AdminGuard requireProfile={false} planScope="free"><FreeOnboardingReview/></AdminGuard>}/><Route path="/admin/free/onboarding/slug" element={<AdminGuard requireProfile={false} planScope="free"><TeamPermissionGuard permission="identifier"><FreeOnboardingSlug/></TeamPermissionGuard></AdminGuard>}/><Route path="/admin/free/onboarding/identity" element={<AdminGuard requireProfile={false} planScope="free"><FreeOnboardingIdentity/></AdminGuard>}/><Route path="/admin/free/onboarding/contact" element={<AdminGuard requireProfile={false} planScope="free"><TeamPermissionGuard permission={['phone','email','whatsapp']}><FreeOnboardingContact/></TeamPermissionGuard></AdminGuard>}/><Route path="/admin/free/onboarding/done" element={<AdminGuard requireProfile={false} planScope="free"><FreeOnboardingDone/></AdminGuard>}/>
<Route path="/admin/free/home" element={<AdminGuard planScope="free"><FreePwaHome/></AdminGuard>}/><Route path="/admin/free/account" element={<AdminGuard planScope="free"><FreeAccount/></AdminGuard>}/><Route path="/admin/free/notifications" element={<AdminGuard planScope="free"><FreeNotifications/></AdminGuard>}/><Route path="/admin/free/team" element={<AdminGuard planScope="free"><FreeTeamEntry/></AdminGuard>}/><Route path="/admin/free/team/assign" element={<AdminGuard requireProfile={false} planScope="free"><FreeTeamAssign/></AdminGuard>}/><Route path="/admin/free/team/member-edit" element={<AdminGuard requireProfile={false} planScope="free"><FreeTeamMemberEdit/></AdminGuard>}/><Route path="/admin/free/team/member" element={<AdminGuard requireProfile={false} planScope="free"><FreeTeamMember/></AdminGuard>}/><Route path="/admin/free/team/join" element={<AdminGuard requireProfile={false} planScope="free"><FreeTeamJoin/></AdminGuard>}/><Route path="/admin/free" element={<AdminGuard planScope="free"><FreeDashboard/></AdminGuard>}/>
<Route path="/admin/free/editor" element={<AdminGuard planScope="free"><TeamPermissionGuard permission="design"><FreeVisualEditor/></TeamPermissionGuard></AdminGuard>}/><Route path="/admin/free/ai-profile" element={<AdminGuard planScope="free"><TeamPermissionGuard permission="ai"><Suspense fallback={<AiRouteFallback/>}><FreeAiProfileAssistant/></Suspense></TeamPermissionGuard></AdminGuard>}/><Route path="/admin/free/bank-accounts" element={<AdminGuard planScope="free"><TeamPermissionGuard permission="bank_accounts"><FreeBankAccounts/></TeamPermissionGuard></AdminGuard>}/><Route path="/admin/free/identifier" element={<AdminGuard planScope="free"><TeamPermissionGuard permission="identifier"><FreeIdentifier/></TeamPermissionGuard></AdminGuard>}/><Route path="/admin/free/links" element={<AdminGuard planScope="free"><TeamPermissionGuard permission="links"><FreeLinks/></TeamPermissionGuard></AdminGuard>}/><Route path="/admin/free/location" element={<AdminGuard planScope="free"><TeamPermissionGuard permission="location"><FreeLocation/></TeamPermissionGuard></AdminGuard>}/><Route path="/admin/free/portfolio" element={<AdminGuard planScope="free"><TeamPermissionGuard permission="portfolio"><FreePortfolio/></TeamPermissionGuard></AdminGuard>}/><Route path="/admin/free/quick-actions" element={<AdminGuard planScope="free"><TeamPermissionGuard permission="quick_actions"><FreeQuickActions/></TeamPermissionGuard></AdminGuard>}/><Route path="/admin/free/services" element={<AdminGuard planScope="free"><TeamPermissionGuard permission="services"><FreeServices/></TeamPermissionGuard></AdminGuard>}/><Route path="/admin/free/style" element={<AdminGuard planScope="free"><TeamPermissionGuard permission="design"><FreeStyle/></TeamPermissionGuard></AdminGuard>}/><Route path="/admin/artifacts/activate" element={<AdminGuard requireProfile={false}><FreeArtifactActivation/></AdminGuard>}/><Route path="/admin/artifacts" element={<AdminGuard requireProfile={false}><ArtifactManager/></AdminGuard>}/>
<Route path="/superadmin" element={<SuperAdminGuard><SuperAdminDashboard/></SuperAdminGuard>}/><Route path="/superadmin/products" element={<SuperAdminGuard><SuperAdminArtifacts/></SuperAdminGuard>}/><Route path="/superadmin/support" element={<SuperAdminGuard><SuperAdminSupport/></SuperAdminGuard>}/><Route path="/superadmin/resources" element={<SuperAdminGuard><SuperAdminResources/></SuperAdminGuard>}/><Route path="/superadmin/feedback" element={<SuperAdminGuard><SuperAdminFeedback/></SuperAdminGuard>}/><Route path="/superadmin/demo" element={<SuperAdminGuard><SuperAdminDemoMetrics/></SuperAdminGuard>}/><Route path="/superadmin/promotions" element={<SuperAdminGuard><SuperAdminPromotions/></SuperAdminGuard>}/>
<Route path="/admin/links" element={<AdminGuard planScope="paid"><AdminLinks/></AdminGuard>}/><Route path="/admin/faqs" element={<AdminGuard planScope="paid"><AdminFAQs/></AdminGuard>}/><Route path="/admin/products" element={<AdminGuard planScope="paid"><AdminProducts/></AdminGuard>}/><Route path="/admin/videos" element={<AdminGuard planScope="paid"><AdminVideos/></AdminGuard>}/><Route path="/admin/blocks" element={<AdminGuard planScope="paid"><AdminBlocks/></AdminGuard>}/><Route path="/admin/visual" element={<AdminGuard planScope="paid"><AdminVisual/></AdminGuard>}/><Route path="/admin/template" element={<AdminGuard planScope="paid"><AdminTemplate/></AdminGuard>}/><Route path="/admin/retention" element={<AdminGuard><AdminRetention/></AdminGuard>}/><Route path="/admin" element={<AdminGuard planScope="paid"><AdminDashboard/></AdminGuard>}/><Route path="/" element={<AdminGuard planScope="paid"><AdminDashboard/></AdminGuard>}/><Route path="*" element={<UnknownAppRouteRedirect/>}/>
</Routes><FreeContextHelp/></BrowserRouter>}
export default App