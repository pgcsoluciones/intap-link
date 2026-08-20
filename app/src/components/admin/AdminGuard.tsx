import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { apiGet } from '../../lib/api'

interface Props {
  children: React.ReactNode
  /** If true, redirect to the free onboarding when user has no profile. */
  requireProfile?: boolean
  /** Keep Gratis and paid editors separated. */
  planScope?: 'free' | 'paid'
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

      // Server-side scan activation has priority over every onboarding route.
      // This also rescues users who land on an old /free/onboarding/* URL after
      // authentication while a valid scan-to-claim intent is still pending.
      if (location.pathname !== '/admin/artifacts/activate') {
        const scanPending: any = await apiGet('/me/artifacts/scan/pending')
          .catch(() => ({ ok: false }))
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
