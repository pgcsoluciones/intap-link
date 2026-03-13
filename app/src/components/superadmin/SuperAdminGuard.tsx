/**
 * SuperAdminGuard — verifica sesión activa + rol de superadmin.
 *
 * Flujo:
 *  1. GET /me  → si falla o no hay sesión, muestra pantalla de error (sin redirect)
 *  2. GET /superadmin/metrics/overview → si retorna ok:false (403), muestra "Sin acceso" (sin redirect)
 *  3. Si ambas ok → renderiza children
 *
 * Sin navegación automática: todas las condiciones de error muestran pantalla estática.
 */

import { useEffect, useState } from 'react'
import { apiGet } from '../../lib/api'

type Status = 'checking' | 'ready' | 'forbidden' | 'no_session' | 'error'

interface ErrorInfo {
  label: string
  detail: string
}

export default function SuperAdminGuard({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('checking')
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null)

  useEffect(() => {
    apiGet('/me')
      .then((me: any) => {
        if (!me.ok) {
          setErrorInfo({
            label: 'Sin sesión activa',
            detail: `GET /me → ok: false  (${me.error ?? 'sin detalle'})`,
          })
          setStatus('no_session')
          return
        }
        return apiGet('/superadmin/metrics/overview')
          .then((res: any) => {
            if (res.ok) {
              setStatus('ready')
            } else {
              setErrorInfo({
                label: 'Sin permisos de Super Admin',
                detail: `GET /superadmin/metrics/overview → ok: false  (${res.error ?? 'sin detalle'})`,
              })
              setStatus('forbidden')
            }
          })
          .catch((err: unknown) => {
            setErrorInfo({
              label: 'Error al verificar permisos',
              detail: `GET /superadmin/metrics/overview lanzó excepción: ${String(err)}`,
            })
            setStatus('error')
          })
      })
      .catch((err: unknown) => {
        setErrorInfo({
          label: 'Error al verificar sesión',
          detail: `GET /me lanzó excepción: ${String(err)}`,
        })
        setStatus('error')
      })
  }, [])

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

  if (status === 'ready') {
    return <>{children}</>
  }

  // Pantalla estática para todos los estados de error — sin navigate(), sin redirect
  const icon = status === 'forbidden' ? '🔒' : status === 'no_session' ? '🔑' : '⚠️'
  const title =
    status === 'forbidden'  ? 'Acceso denegado' :
    status === 'no_session' ? 'Sesión requerida' :
                              'Error de verificación'

  return (
    <div className="min-h-screen bg-intap-dark flex items-center justify-center p-4">
      <div className="glass-card p-8 text-center max-w-md w-full">
        <div className="text-4xl mb-4">{icon}</div>
        <h1 className="text-lg font-black mb-2">{title}</h1>
        {errorInfo && (
          <div className="mt-4 text-left bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-xs font-bold text-slate-300 mb-1">{errorInfo.label}</p>
            <p className="text-xs text-slate-500 font-mono break-all">{errorInfo.detail}</p>
          </div>
        )}
        <p className="text-xs text-slate-600 mt-6">
          Navega manualmente a <span className="text-slate-400 font-mono">/admin</span> o <span className="text-slate-400 font-mono">/admin/login</span>
        </p>
      </div>
    </div>
  )
}
