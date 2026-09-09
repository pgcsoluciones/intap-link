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
const TEAM_CODE_KEY = 'kawvo_team_join_code'

function readScanCode(): string {
  const raw = sessionStorage.getItem(SCAN_PUBLIC_CODE_KEY) || localStorage.getItem(SCAN_PUBLIC_CODE_KEY) || ''
  const code = raw.trim().toUpperCase()
  return /^[A-Z2-9]{8,24}$/.test(code) ? code : ''
}

function readTeamCode(): string {
  const raw = sessionStorage.getItem(TEAM_CODE_KEY) || localStorage.getItem(TEAM_CODE_KEY) || ''
  const code = raw.trim().toUpperCase()
  return /^TEAM-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code) ? code : ''
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

    const scanCode = readScanCode()
    const teamCode = readTeamCode()
    const hasTeamActivationContext = Boolean(scanCode && teamCode)
    const insideTeamFlow = location.pathname === '/admin/free/team' || location.pathname.startsWith('/admin/free/team/')

    apiGet('/me').then(async (json: any) => {
      if (!json.ok) {
        // Never drop a validated Team activation into a generic login. The two
        // identifiers are the source of truth needed to resume Master preparation.
        if (hasTeamActivationContext) {
          navigate(`/admin/login?activation=team&public_code=${encodeURIComponent(scanCode)}&team_code=${encodeURIComponent(teamCode)}`, { replace: true })
        } else {
          navigate('/admin/login', { replace: true })
        }
        return
      }

      // A validated Team code and product pair always outranks the independent
      // scan-to-claim and starter recovery flows. This prevents a Team device
      // from ever materializing an independent Free draft by navigation overlap.
      if (hasTeamActivationContext && !insideTeamFlow) {
        navigate(`/admin/free/team/assign?public_code=${encodeURIComponent(scanCode)}&team_code=${encodeURIComponent(teamCode)}`, { replace: true })
        return
      }

      if (location.pathname !== '/admin/artifacts/activate' && !insideTeamFlow && !hasTeamActivationContext) {
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
      if (pendingActivation && json.data?.profile_id && location.pathname !== '/admin/artifacts/activate' && !insideTeamFlow && !hasTeamActivationContext) {
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

      const insideOnboarding = location.pathname.startsWith('/admin/free/onboarding/')
      const insideArtifactFlow = location.pathname.startsWith('/admin/artifacts')
      if (!insideOnboarding && !insideArtifactFlow && !insideTeamFlow && !hasTeamActivationContext) {
        const resume = interruptedFreeOnboardingRoute(json.data)
        if (resume) {
          navigate(resume, { replace: true })
          return
        }
      }

      setReady(true)
    }).catch(() => {
      if (hasTeamActivationContext) {
        navigate(`/admin/login?activation=team&public_code=${encodeURIComponent(scanCode)}&team_code=${encodeURIComponent(teamCode)}`, { replace: true })
      } else {
        navigate('/admin/login', { replace: true })
      }
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
