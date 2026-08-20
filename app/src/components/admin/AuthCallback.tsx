import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { API_BASE, apiGet, apiPost } from '../../lib/api'

const SCAN_PUBLIC_CODE_KEY = 'kawvo_scan_public_code'

function readScanCode(): string {
  const value = sessionStorage.getItem(SCAN_PUBLIC_CODE_KEY) || localStorage.getItem(SCAN_PUBLIC_CODE_KEY) || ''
  const code = value.trim().toUpperCase()
  return /^[A-Z2-9]{8,24}$/.test(code) ? code : ''
}

export default function AuthCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState('')

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setError('Enlace inválido: falta el token')
      return
    }

    fetch(`${API_BASE}/auth/magic-link/verify?token=${encodeURIComponent(token)}`, { credentials: 'include' })
      .then((res) => res.json())
      .then(async (json: any) => {
        if (!json.ok) {
          setError(json.error || 'Enlace inválido o expirado')
          return
        }

        const authMode = sessionStorage.getItem('kawvo_auth_mode') || localStorage.getItem('kawvo_auth_mode') || 'login'
        sessionStorage.removeItem('kawvo_auth_mode')
        localStorage.removeItem('kawvo_auth_mode')

        // 1) If a valid scan intent already exists, resume it.
        const pending: any = await apiGet('/me/artifacts/scan/pending').catch(() => ({ ok: false }))
        if (pending.ok) {
          navigate('/admin/artifacts/activate?scan=1', { replace: true })
          return
        }

        // 2) Deterministic recovery: the scanned public code is continuity data,
        // not an activation secret. Recreate the one-time server intent now that
        // authentication is complete, from the APP origin itself.
        const scanCode = readScanCode()
        if (scanCode) {
          const start: any = await apiPost('/public/artifacts/scan/start', { public_code: scanCode })
            .catch(() => ({ ok: false, error: 'No pudimos preparar la activación.' }))
          if (start.ok) {
            navigate('/admin/artifacts/activate?scan=1', { replace: true })
            return
          }
          setError(start.error || 'No pudimos reanudar la activación de tu producto.')
          return
        }

        // Legacy/manual compatibility only when this login did not originate
        // from the permanent product scan flow.
        const pendingPublicCode = sessionStorage.getItem('intap_activation_public_code')
        if (pendingPublicCode) {
          navigate('/admin/artifacts/activate', { replace: true })
          return
        }

        const intent: any = await apiGet('/me/artifacts/activation/intent').catch(() => ({ ok: false }))
        if (intent.ok) {
          navigate('/admin/artifacts/activate', { replace: true })
          return
        }

        navigate(authMode === 'register' ? '/admin/free/onboarding/welcome' : '/admin', { replace: true })
      })
      .catch(() => setError('Error de conexión. Inténtalo de nuevo.'))
  }, [navigate, searchParams])

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[430px] flex-col items-center justify-center text-center">
        <div className="w-full rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
          {error ? (
            <>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-rose-500">KAWVO LINK</p>
              <h1 className="mt-3 text-xl font-black">No pudimos abrir este enlace</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">{error}</p>
              <a href="/admin/login" className="mt-5 inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-extrabold text-white">Solicitar nuevo acceso</a>
            </>
          ) : (
            <>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-600">KAWVO LINK</p>
              <h1 className="mt-3 text-xl font-black">Validando tu acceso…</h1>
              <p className="mt-2 text-sm text-slate-500">Un momento, estamos retomando la activación de tu producto.</p>
            </>
          )}
        </div>
      </section>
    </main>
  )
}