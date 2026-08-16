import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet } from '../../lib/api'

export default function SuperAdminGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    apiGet('/superadmin/metrics/overview')
      .then((json: any) => {
        if (cancelled) return
        if (!json?.ok) {
          navigate('/admin', { replace: true })
          return
        }
        setReady(true)
      })
      .catch(() => {
        if (!cancelled) navigate('/admin/login', { replace: true })
      })

    return () => { cancelled = true }
  }, [navigate])

  if (!ready) {
    return (
      <div className="min-h-screen bg-intap-dark flex items-center justify-center">
        <div className="loading-spinner" />
      </div>
    )
  }

  return <>{children}</>
}
