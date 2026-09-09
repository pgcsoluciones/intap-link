import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { apiGet, apiPost } from '../../lib/api'

interface Props {
  children: React.ReactNode
  /** If true, redirect to the free onboarding when user has no profile. */
  requireProfile?: boolean
  /** Keep Gratis and paid editors separated. */
  planScope?: 'free' | 'paid'
}

const SCAN_PUBLIC_CODE_KEY = 'kawvo_scan_public_code'

function readScanCode(): string {
  const raw = sessionStorage.getItem(SCAN_PUBLIC_CODE_KEY) || localStorage.getItem(SCAN_PUBLIC_CODE_KEY) || ''
  const code = raw.trim().toUpperCase()
  return /^[A-Z2-9]{8,24}$/.test(code) ? code : ''
}

function clearScanCode() {
  sessionStorage.removeItem(SCAN_PUBLIC_CODE_KEY)
  localStorage.removeItem(SCAN_PUBLIC_CODE_KEY)
}

function readTemplateData(value: unknown): Record<string, any> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch { return {} }
  }
  return {}
}

function interruptedFreeOnboardingRoute(data: any): string | null {
  if (!data?.profile_id) return null
  const planId = data?.plan_id || data?.plan_code || 'free'
  if (planId !== 'free') return null

  const template = readTemplateData(data?.templateData ?? data?.template_data)
  if (template.team_member === true || String(template.team_member || '').toLowerCase() === 'true') return null

  // Scan-to-claim creates a temporary kawvo-* slug. While that slug is still
  // present, the independent profile has not finished its first-run setup.
  // Established/legacy profiles must never be forced back through onboarding.
  const slug = String(data?.slug || '').trim().toLowerCase()
  if (!slug.startsWith('kawvo-')) return null

  const generated = template.free_starter_generated === true || String(template.free_starter_generated || '').toLowerCase() === 'true'
  const unconfirmed = template.free_starter_unconfirmed === true || String(template.free_starter_unconfirmed || '').toLowerCase() === 'true'
  const category = String(data?.category || template.free_starter_category || '').trim()
  const subcategory = String(data?.subcategory || template.free_starter_subcategory || '').trim()
  const leadSource = String(template.free_starter_lead_source || '').trim()

  if (!generated) {
    if (!category || !subcategory) return '/admin/free/onboarding/intro'
    if (!leadSource) return '/admin/free/onboarding/source'
    return '/admin/free/onboarding/builder'
  }
  if (unconfirmed) return '/admin/free/onboarding/review'
  return null
}

export default function AdminGuard({ children, requireProfile = true, planScope }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(false)

    apiGet('/me').then(async (json: any) => {
      if (!json.ok) {
        navigate('/admin/login', { replace: true })
        return
      }

      // Team activation/join is an explicit branch of the product activation
      // flow, not an interruption of the independent Free onboarding. While
      // the user is inside any Team route, that flow must have priority over
      // scan-resume and starter-resume redirects.
      const insideTeamFlow = location.pathname === '/admin/free/team' || location.pathname.startsWith('/admin/free/team/')

      if (location.pathname !== '/admin/artifacts/activate' && !insideTeamFlow) {
        // Scan-to-claim continuity only needs to run when this browser actually
        // remembers a scanned product. Avoid probing /scan/pending on every
        // normal panel reload: a 404 is the expected "nothing pending" state
        // and was delaying the guard while showing the dark loading screen.
        const scanCode = readScanCode()
        if (scanCode) {
          let scanPending: any = await apiGet('/me/artifacts/scan/pending')
            .catch(() => ({ ok: false }))

          if (!scanPending.ok) {
            const start: any = await apiPost('/public/artifacts/scan/start', { public_code: scanCode })
              .catch(() => ({ ok: false }))

            if (start.ok && start.state === 'ready') {
              scanPending = await apiGet('/me/artifacts/scan/pending')
                .catch(() => ({ ok: false }))
            } else if (start.ok && start.state === 'activated') {
              clearScanCode()
            } else if (!start.ok) {
              // A stale/invalid remembered code must not penalize every future
              // reload. Visiting /l/:code again will recreate continuity.
              clearScanCode()
            }
          }

          if (scanPending.ok && scanPending.data?.public_code) {
            navigate('/admin/artifacts/activate?scan=1', { replace: true })
            return
          }
        }
      }

      const pendingActivation = sessionStorage.getItem('intap_activation_public_code')
      if (pendingActivation && json.data?.profile_id && location.pathname !== '/admin/artifacts/activate' && !insideTeamFlow) {
        navigate('/admin/artifacts/activate', { replace: true })
        return
      }

      if (requireProfile && !json.data?.profile_id) {
        navigate('/admin/free/onboarding/welcome', { replace: true })
        return
      }

      const planId = json.data?.plan_id || json.data?.plan_code || 'free'
      if (json.data?.profile_id && planScope === 'free' && planId !== 'free') {
        navigate('/admin', { replace: true })
        return
      }
      if (json.data?.profile_id && planScope === 'paid' && planId === 'free') {
        navigate('/admin/free', { replace: true })
        return
      }

      // An activated independent product already owns a profile row before the
      // starter onboarding is finished. Previously that row made AdminGuard
      // treat it as an ordinary draft and the user could land on a blank panel.
      // Resume from server-persisted progress instead. Do not interfere while
      // the user is already inside onboarding, product activation or Team routes.
      const insideOnboarding = location.pathname.startsWith('/admin/free/onboarding/')
      const insideArtifactFlow = location.pathname.startsWith('/admin/artifacts')
      if (!insideOnboarding && !insideArtifactFlow && !insideTeamFlow) {
        const resume = interruptedFreeOnboardingRoute(json.data)
        if (resume) {
          navigate(resume, { replace: true })
          return
        }
      }

      setReady(true)
    }).catch(() => {
      navigate('/admin/login', { replace: true })
    })
  }, [location.pathname, navigate, planScope, requireProfile])

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#f7f9fc] flex items-center justify-center">
        <div className="loading-spinner" />
      </div>
    )
  }

  return <>{children}</>
}
