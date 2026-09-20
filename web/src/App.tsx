import {
  lazy,
  Suspense,
  useEffect,
} from 'react'

import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useParams,
} from 'react-router-dom'

import PublicBankAccounts from './components/free-profile/PublicBankAccounts'
import PublicProfileErrorEnhancer from './components/PublicProfileErrorEnhancer'
import './components/PublicProfileError.css'

/*
 * IMPORTANTE
 * ----------
 * Las vistas públicas se cargan por ruta.
 *
 * Esto evita que el CSS de MarketingLanding,
 * BioPests u otras experiencias especiales
 * entre automáticamente en todos los perfiles.
 */

const PublicProfile = lazy(
  () => import('./components/PublicProfile'),
)

const SponsoredProfile = lazy(
  () => import('./components/sponsored/SponsoredProfile'),
)

const SponsoredAwareArtifactResolver = lazy(
  () => import('./components/sponsored/SponsoredAwareArtifactResolver'),
)

const KawvoLinkDemo = lazy(
  () => import('./components/demo/KawvoLinkDemo'),
)

const KawvoLinkDemoAi = lazy(
  () => import('./components/demo/KawvoLinkDemoAi'),
)

const KawvoLinkDemoShared = lazy(
  () => import('./components/demo/KawvoLinkDemoShared'),
)

const KawvoTrial = lazy(
  () => import('./components/trial/KawvoTrial'),
)

const IntapProfileBioPestsManager = lazy(
  () =>
    import(
      './components/profile-templates/IntapProfileBioPestsManager'
    ),
)

const IntapProfileBioPestsOperations = lazy(
  () =>
    import(
      './components/profile-templates/IntapProfileBioPestsOperations'
    ),
)

const KAWVO_LINK_HOME = 'https://nfc.kawvoia.com'

function RouteLoader() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#ffffff',
      }}
    />
  )
}

function RootRoute() {
  const location = useLocation()

  const slug =
    new URLSearchParams(
      location.search,
    ).get('slug')

  useEffect(() => {
    if (!slug) {
      window.location.replace(KAWVO_LINK_HOME)
    }
  }, [slug])

  if (slug) {
    return (
      <Navigate
        to={`/${slug}`}
        replace
      />
    )
  }

  return <RouteLoader />
}

function PublicProfileRoute() {
  return (
    <>
      <PublicProfile />
      <PublicBankAccounts />
    </>
  )
}

function SponsoredProfileRoute() {
  return <SponsoredProfile />
}

function TrialLoginRedirect() {
  useEffect(() => {
    const host=window.location.hostname.toLowerCase()
    const appOrigin=(host==='preview.intaprd.com'||host.includes('preview')||host.endsWith('.pages.dev'))
      ? 'https://app.preview.intaprd.com'
      : 'https://app.intaprd.com'
    window.location.replace(appOrigin+'/trial/login'+window.location.search)
  },[])
  return <RouteLoader />
}

function LegacyBankRoute() {
  const { slug = '' } = useParams()
  return <Navigate to={`/${encodeURIComponent(slug)}#bancos`} replace />
}

function App() {
  return (
    <BrowserRouter>
      <PublicProfileErrorEnhancer />
      <Suspense fallback={<RouteLoader />}>
        <Routes>
          <Route
            path="/"
            element={<RootRoute />}
          />

          <Route
            path="/l/:publicCode"
            element={<SponsoredAwareArtifactResolver />}
          />

          <Route
            path="/p/:username"
            element={<SponsoredProfileRoute />}
          />

          <Route
            path="/demo"
            element={<KawvoLinkDemo />}
          />

          <Route
            path="/demo/ia"
            element={<KawvoLinkDemoAi />}
          />

          <Route
            path="/demo/s/:token"
            element={<KawvoLinkDemoShared />}
          />

          <Route
            path="/trial"
            element={<KawvoTrial mode="master" />}
          />

          <Route
            path="/trial/login"
            element={<TrialLoginRedirect />}
          />

          <Route
            path="/trial/edit/:id"
            element={<KawvoTrial mode="editor" />}
          />

          <Route
            path="/trial/mi/:id"
            element={<KawvoTrial mode="owner" />}
          />

          <Route
            path="/trial/:slug"
            element={<KawvoTrial mode="public" />}
          />

          <Route
            path="/biopestsgrd"
            element={
              <IntapProfileBioPestsManager />
            }
          />

          <Route
            path="/biopestsvrd"
            element={
              <IntapProfileBioPestsOperations />
            }
          />

          <Route
            path="/biopestrd"
            element={
              <Navigate
                to="/biopestsgrd"
                replace
              />
            }
          />

          <Route
            path="/biopestsrd"
            element={
              <Navigate
                to="/biopestsgrd"
                replace
              />
            }
          />

          <Route
            path="/:slug/bancos"
            element={<LegacyBankRoute />}
          />

          <Route
            path="/:slug"
            element={<PublicProfileRoute />}
          />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App