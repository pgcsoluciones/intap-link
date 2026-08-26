import {
  lazy,
  Suspense,
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

const MarketingLanding = lazy(
  () => import('./components/marketing/MarketingLanding'),
)

const KawvoLinkDemo = lazy(
  () => import('./components/demo/KawvoLinkDemo'),
)

const KawvoLinkDemoShared = lazy(
  () => import('./components/demo/KawvoLinkDemoShared'),
)

const ArtifactLinkResolver = lazy(
  () => import('./components/ArtifactLinkResolver'),
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

  if (slug) {
    return (
      <Navigate
        to={`/${slug}`}
        replace
      />
    )
  }

  return <MarketingLanding />
}

function PublicProfileRoute() {
  return (
    <>
      <PublicProfile />
      <PublicBankAccounts />
    </>
  )
}

function LegacyBankRoute() {
  const { slug = '' } = useParams()
  return <Navigate to={`/${encodeURIComponent(slug)}#bancos`} replace />
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteLoader />}>
        <Routes>
          <Route
            path="/"
            element={<RootRoute />}
          />

          <Route
            path="/l/:publicCode"
            element={<ArtifactLinkResolver />}
          />

          <Route
            path="/demo"
            element={<KawvoLinkDemo />}
          />

          <Route
            path="/demo/s/:token"
            element={<KawvoLinkDemoShared />}
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
