/**
 * SuperAdminGuard — verifica sesión activa + rol de superadmin.
 *
 * Flujo:
 *  1. GET /me  → si no hay sesión, redirect a /admin/login
 *  2. GET /superadmin/metrics/overview → si retorna ok:false (403), muestra pantalla de acceso denegado
 *  3. Si ambas ok → renderiza children
 *
 * Nota: los endpoints de superadmin usan la misma session_id cookie que el
 * admin regular, pero además validan que el usuario exista en admin_users.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet } from '../../lib/api'

type Status = 'checking' | 'ready' | 'forbidden'

export default function SuperAdminGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('checking')

  useEffect(() => {
    apiGet('/me')
      .then((me: any) => {
        if (!me.ok) {
          navigate('/admin/login', { replace: true })
          return
        }
        return apiGet('/superadmin/metrics/overview').then((res: any) => {
          setStatus(res.ok ? 'ready' : 'forbidden')
        })
      })
      .catch(() => navigate('/admin/login', { replace: true }))
  }, [navigate])

  if (status === 'checking') {
    return (
      <div className="min-h-screen bg-intap-dark flex items-center justify-center">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-intap-mint/30 border-t-intap-mint rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500">Verificando acceso…</p>
        </div>
      </div>
    )
  }

  if (status === 'forbidden') {
    return (
      <div className="min-h-screen bg-intap-dark flex items-center justify-center p-4">
        <div className="glass-card p-8 text-center max-w-sm w-full">
          <div className="text-4xl mb-4">🚫</div>
          <h1 className="text-lg font-black mb-2">Sin acceso</h1>
          <p className="text-sm text-slate-400 mb-6">
            Tu cuenta no tiene permisos de Super Admin.<br />
            Contacta al administrador del sistema.
          </p>
          <button
            onClick={() => navigate('/admin')}
            className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-bold hover:bg-white/10 transition-colors"
          >
            Volver al panel
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
