import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  const [ready, setReady] = useState(false)

  useEffect(() => {
    apiGet('/me').then((json: any) => {
      if (!json.ok) {
        navigate('/admin/login', { replace: true })
        return
      }
      if (requireProfile && !json.data?.profile_id) {
        navigate('/admin/free/onboarding/slug', { replace: true })
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
  }, [navigate, planScope, requireProfile])

  if (!ready) {
    return (
      <div className="min-h-screen bg-intap-dark flex items-center justify-center">
        <div className="loading-spinner" />
      </div>
    )
  }

  return <>{children}</>
}
