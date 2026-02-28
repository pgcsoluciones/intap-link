import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet } from '../../lib/api'

interface Props {
  children: React.ReactNode
  /** If true, redirect to /admin/onboarding/slug when user has no profile */
  requireProfile?: boolean
}

export default function AdminGuard({ children, requireProfile = true }: Props) {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    apiGet('/me').then((json: any) => {
      if (!json.ok) {
        navigate('/admin/login', { replace: true })
        return
      }
      if (requireProfile && !json.data?.profile_id) {
        navigate('/admin/onboarding/slug', { replace: true })
        return
      }
      setReady(true)
    }).catch(() => {
      navigate('/admin/login', { replace: true })
    })
  }, [navigate, requireProfile])

  if (!ready) {
    return (
      <div className="min-h-screen bg-intap-dark flex items-center justify-center">
        <div className="loading-spinner" />
      </div>
    )
  }

  return <>{children}</>
}
