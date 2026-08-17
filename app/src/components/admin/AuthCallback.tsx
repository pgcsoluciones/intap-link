import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { API_BASE, apiGet } from '../../lib/api'

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
      .then((json: any) => {
        if (!json.ok) {
          setError(json.error || 'Enlace inválido o expirado')
          return
        }

        const pendingPublicCode = sessionStorage.getItem('intap_activation_public_code')
        if (pendingPublicCode) {
          navigate('/admin/artifacts/activate', { replace: true })
          return
        }

        const authMode = sessionStorage.getItem('kawvo_auth_mode') || 'login'
        sessionStorage.removeItem('kawvo_auth_mode')

        apiGet('/me/artifacts/activation/intent')
          .then((intent: any) => {
            if (intent.ok) {
              navigate('/admin/artifacts/activate', { replace: true })
              return
            }
            navigate(authMode === 'register' ? '/admin/free/onboarding/welcome' : '/admin', { replace: true })
          })
          .catch(() => navigate(authMode === 'register' ? '/admin/free/onboarding/welcome' : '/admin', { replace: true }))
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
              <p className="mt-2 text-sm text-slate-500">Un momento, estamos abriendo tu cuenta.</p>
            </>
          )}
        </div>
      </section>
    </main>
  )
}
