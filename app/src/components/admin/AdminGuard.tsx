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

      if (location.pathname !== '/admin/artifacts/activate') {
        // First resume an existing one-time scan intent.
        let scanPending: any = await apiGet('/me/artifacts/scan/pending')
          .catch(() => ({ ok: false }))

        // If transient intent continuity was lost but this browser still knows
        // which permanent product was scanned, recreate the intent from the APP
        // origin before any legacy onboarding redirect can run.
        if (!scanPending.ok) {
          const scanCode = readScanCode()
          if (scanCode) {
            const start: any = await apiPost('/public/artifacts/scan/start', { public_code: scanCode })
              .catch(() => ({ ok: false }))
            if (start.ok) {
              scanPending = await apiGet('/me/artifacts/scan/pending')
                .catch(() => ({ ok: false }))
            }
          }
        }

        if (scanPending.ok) {
          navigate('/admin/artifacts/activate?scan=1', { replace: true })
          return
        }
      }

      const pendingActivation = sessionStorage.getItem('intap_activation_public_code')
      if (pendingActivation && json.data?.profile_id && location.pathname !== '/admin/artifacts/activate') {
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

      setReady(true)
    }).catch(() => {
      navigate('/admin/login', { replace: true })
    })
  }, [location.pathname, navigate, planScope, requireProfile])

  if (!ready) {
    return (
      <div className="min-h-screen bg-intap-dark flex items-center justify-center">
        <div className="loading-spinner" />
      </div>
    )
  }

  return <>{children}</>
}
