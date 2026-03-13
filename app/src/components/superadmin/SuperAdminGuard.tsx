/**
 * SuperAdminGuard — verifica sesión activa + rol de superadmin.
 *
 * Flujo:
 *  1. GET /me  → si falla o no hay sesión, muestra pantalla de error (sin redirect)
 *  2. GET /superadmin/metrics/overview → si retorna ok:false (403), muestra "Sin acceso"
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

const TIMEOUT_MS = 10_000

export default function SuperAdminGuard({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('checking')
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const start = Date.now()
    console.log('[SuperAdminGuard] Iniciando verificación…')

    // Timeout de seguridad: si las llamadas no resuelven en TIMEOUT_MS, mostrar error
    const timer = setTimeout(() => {
      console.error('[SuperAdminGuard] Timeout — las llamadas API no respondieron en', TIMEOUT_MS, 'ms')
      setErrorInfo({
        label: 'Timeout de conexión',
        detail: `Las llamadas API no respondieron en ${TIMEOUT_MS / 1000}s. Verifica que el worker esté activo y que la sesión sea válida en este dominio.`,
      })
      setStatus('error')
    }, TIMEOUT_MS)

    // Ticker para mostrar tiempo transcurrido en la pantalla de checking
    const ticker = setInterval(() => setElapsed(Math.round((Date.now() - start) / 1000)), 1000)

    apiGet('/me')
      .then((me: any) => {
        console.log('[SuperAdminGuard] GET /me →', me)
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
            console.log('[SuperAdminGuard] GET /superadmin/metrics/overview →', res)
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
            console.error('[SuperAdminGuard] Error en /superadmin/metrics/overview:', err)
            setErrorInfo({
              label: 'Error al verificar permisos',
              detail: `GET /superadmin/metrics/overview lanzó excepción: ${String(err)}`,
            })
            setStatus('error')
          })
      })
      .catch((err: unknown) => {
        console.error('[SuperAdminGuard] Error en /me:', err)
        setErrorInfo({
          label: 'Error al verificar sesión',
          detail: `GET /me lanzó excepción: ${String(err)}`,
        })
        setStatus('error')
      })
      .finally(() => {
        clearTimeout(timer)
        clearInterval(ticker)
      })

    return () => {
      clearTimeout(timer)
      clearInterval(ticker)
    }
  }, [])

  // ── Checking (carga) ─────────────────────────────────────────────────────────
  if (status === 'checking') {
    return (
      <div style={{ minHeight: '100vh', background: '#030712', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{
            width: 40, height: 40, margin: '0 auto 16px',
            border: '3px solid rgba(13,242,201,0.25)',
            borderTopColor: '#0df2c9',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }} />
          <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 8 }}>
            Verificando acceso…
          </p>
          {elapsed > 0 && (
            <p style={{ color: '#475569', fontSize: 12 }}>
              {elapsed}s — abre DevTools → Console para diagnóstico
            </p>
          )}
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    )
  }

  // ── Ready ────────────────────────────────────────────────────────────────────
  if (status === 'ready') {
    return <>{children}</>
  }

  // ── Error states (forbidden / no_session / error) ────────────────────────────
  // Pantalla estática con fondo blanco claro para máxima visibilidad diagnóstica
  const icon   = status === 'forbidden' ? '🔒' : status === 'no_session' ? '🔑' : '⚠️'
  const title  = status === 'forbidden'  ? 'Acceso denegado'
               : status === 'no_session' ? 'Sesión requerida'
               :                           'Error de verificación'

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{
        background: '#1e293b',
        border: '1px solid #334155',
        borderRadius: 16,
        padding: '2rem',
        maxWidth: 480,
        width: '100%',
        textAlign: 'center',
        color: '#f1f5f9',
        fontFamily: 'Inter, sans-serif',
      }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>{icon}</div>
        <h1 style={{ fontSize: 20, fontWeight: 900, marginBottom: 8 }}>{title}</h1>

        {errorInfo && (
          <div style={{
            marginTop: 16,
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: 8,
            padding: '0.75rem 1rem',
            textAlign: 'left',
          }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 4 }}>
              {errorInfo.label}
            </p>
            <p style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace', wordBreak: 'break-all', margin: 0 }}>
              {errorInfo.detail}
            </p>
          </div>
        )}

        <p style={{ fontSize: 12, color: '#475569', marginTop: 20 }}>
          Navega manualmente a{' '}
          <a href="/admin/login" style={{ color: '#94a3b8' }}>/admin/login</a>
          {' '}·{' '}
          <a href="/admin" style={{ color: '#94a3b8' }}>/admin</a>
        </p>
      </div>
    </div>
  )
}
