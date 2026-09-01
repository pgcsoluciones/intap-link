import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiPost } from '../../lib/api'

type Mode = 'login' | 'register'
const SCAN_PUBLIC_CODE_KEY = 'kawvo_scan_public_code'

export default function AdminLogin() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const scanCode = String(searchParams.get('public_code') || '').trim().toUpperCase()
  const isScanFlow = searchParams.get('activation') === 'scan' && /^[A-Z2-9]{8,24}$/.test(scanCode)
  const requestedMode: Mode | null = searchParams.get('mode') === 'register'
    ? 'register'
    : searchParams.get('mode') === 'login'
      ? 'login'
      : null

  useEffect(() => {
    if (!isScanFlow) {
      // A normal/direct login must not inherit an old scan-to-claim context.
      // Otherwise AdminGuard can correctly authenticate the user and then
      // redirect them to /admin/artifacts/activate?scan=1 because a stale
      // product code remained in browser storage from a previous test/scan.
      sessionStorage.removeItem(SCAN_PUBLIC_CODE_KEY)
      localStorage.removeItem(SCAN_PUBLIC_CODE_KEY)
      if (requestedMode) setMode(requestedMode)
      return
    }

    sessionStorage.setItem(SCAN_PUBLIC_CODE_KEY, scanCode)
    localStorage.setItem(SCAN_PUBLIC_CODE_KEY, scanCode)
    // A customer arriving from a physical product can create an account if
    // needed; existing users can switch back to Acceder without losing the scan.
    setMode('register')
  }, [isScanFlow, requestedMode, scanCode])

  const persistAuthMode = (nextMode: Mode) => {
    sessionStorage.setItem('kawvo_auth_mode', nextMode)
    localStorage.setItem('kawvo_auth_mode', nextMode)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const json: any = await apiPost('/auth/magic-link/start', { email, mode })
      if (json.ok) {
        sessionStorage.setItem('magic_link_email', email)
        persistAuthMode(mode)
        navigate('/admin/check-email')
      } else {
        setError(json.error || 'Error al enviar el enlace')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = () => {
    persistAuthMode(mode)
    // OAuth must start on the same app custom domain that owns the session.
    // In Preview this yields app.preview.intaprd.com as redirect_uri instead
    // of the workers.dev origin; Production likewise stays on app.intaprd.com.
    window.location.href = '/api/v1/auth/google/start'
  }

  const isRegister = mode === 'register'

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[430px] flex-col justify-center">
        <div className="mb-8 text-center">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-600">KAWVO LINK</p>
          <h1 className="mt-3 text-[30px] font-black leading-tight tracking-[-0.04em]">{isScanFlow ? 'Activa tu producto' : isRegister ? 'Crea tu acceso' : 'Bienvenido de nuevo'}</h1>
          <p className="mx-auto mt-2 max-w-sm text-[15px] leading-6 text-slate-500">
            {isScanFlow
              ? 'Tu producto ya fue reconocido. Valida tu correo para continuar con la activación, sin escribir códigos.'
              : isRegister
                ? 'Valida tu correo para crear tu acceso a Kawvo Link. Si llegaste desde un artículo Kawvo, retomaremos su activación automáticamente.'
                : 'Accede para administrar tu perfil y tus productos Kawvo.'}
          </p>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-2 shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
          <div className="grid grid-cols-2 gap-1 rounded-[22px] bg-slate-100 p-1">
            <button type="button" onClick={() => { setMode('login'); setError('') }} className={`rounded-[18px] px-3 py-3 text-sm font-extrabold transition ${!isRegister ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>Acceder</button>
            <button type="button" onClick={() => { setMode('register'); setError('') }} className={`rounded-[18px] px-3 py-3 text-sm font-extrabold transition ${isRegister ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>Crear cuenta</button>
          </div>

          <div className="p-4 pt-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">
                Correo electrónico
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@email.com" required className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" />
              </label>
              {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">{error}</p>}
              <button type="submit" disabled={loading} className="w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white transition hover:bg-slate-800 disabled:opacity-40">{loading ? 'Enviando…' : isRegister ? 'Validar mi correo' : 'Continuar'}</button>
            </form>

            <div className="my-5 flex items-center gap-3"><span className="h-px flex-1 bg-slate-200" /><span className="text-xs font-semibold text-slate-400">o continúa con</span><span className="h-px flex-1 bg-slate-200" /></div>

            <button type="button" onClick={handleGoogle} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-extrabold text-slate-800 transition hover:bg-slate-50">
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 0 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Google
            </button>
          </div>
        </div>

        {isRegister && !isScanFlow && <div className="mt-5 rounded-[22px] border border-cyan-100 bg-cyan-50/70 p-4 text-center"><p className="text-sm font-extrabold text-slate-900">Tu Perfil Digital empieza desde tu artículo Kawvo</p><p className="mt-1 text-xs leading-5 text-slate-500">Escanea el QR o acerca el NFC de un artículo válido. Kawvo reconocerá la activación internamente; no tendrás que escribir códigos de compra ni de activación.</p></div>}
      </section>
    </main>
  )
}
