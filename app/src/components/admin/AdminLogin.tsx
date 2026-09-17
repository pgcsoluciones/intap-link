import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiPost } from '../../lib/api'

type Mode = 'login' | 'register'
const SCAN_PUBLIC_CODE_KEY = 'kawvo_scan_public_code'
const TEAM_CODE_KEY = 'kawvo_team_join_code'

function validProduct(value: string) { return /^[A-Z2-9]{8,24}$/.test(value) }
function validTeam(value: string) { return /^TEAM-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(value) }

export default function AdminLogin() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [recoveryStage, setRecoveryStage] = useState<'idle' | 'email' | 'code' | 'new' | 'done'>('idle')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [recoveryPassword, setRecoveryPassword] = useState('')
  const [recoveryConfirm, setRecoveryConfirm] = useState('')
  const [loginMethod, setLoginMethod] = useState<'email' | 'password'>('email')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [teamIdentity, setTeamIdentity] = useState<any>(null)

  const queryScanCode = String(searchParams.get('public_code') || '').trim().toUpperCase()
  const queryTeamCode = String(searchParams.get('team_code') || '').trim().toUpperCase()
  const storedScanCode = String(sessionStorage.getItem(SCAN_PUBLIC_CODE_KEY) || localStorage.getItem(SCAN_PUBLIC_CODE_KEY) || '').trim().toUpperCase()
  const storedTeamCode = String(sessionStorage.getItem(TEAM_CODE_KEY) || localStorage.getItem(TEAM_CODE_KEY) || '').trim().toUpperCase()

  const explicitTeamFlow = searchParams.get('activation') === 'team' && validProduct(queryScanCode) && validTeam(queryTeamCode)
  const storedTeamFlow = !searchParams.get('activation') && validProduct(storedScanCode) && validTeam(storedTeamCode)
  const isTeamFlow = explicitTeamFlow || storedTeamFlow
  const scanCode = explicitTeamFlow ? queryScanCode : isTeamFlow ? storedScanCode : queryScanCode
  const teamCode = explicitTeamFlow ? queryTeamCode : isTeamFlow ? storedTeamCode : queryTeamCode

  const validProductCode = validProduct(scanCode)
  const isScanFlow = searchParams.get('activation') === 'scan' && validProductCode
  const isDraftResume = searchParams.get('resume_profile') === '1' && validProductCode
  const isSwitchUser = searchParams.get('switch_user') === '1' && isScanFlow
  const hasProductContext = isScanFlow || isDraftResume || isTeamFlow

  const teamResumeUrl = useMemo(() => isTeamFlow
    ? `/admin/free/team/assign?public_code=${encodeURIComponent(scanCode)}&team_code=${encodeURIComponent(teamCode)}`
    : '', [isTeamFlow, scanCode, teamCode])

  useEffect(() => {
    if (!hasProductContext) {
      sessionStorage.removeItem(SCAN_PUBLIC_CODE_KEY)
      localStorage.removeItem(SCAN_PUBLIC_CODE_KEY)
      sessionStorage.removeItem(TEAM_CODE_KEY)
      localStorage.removeItem(TEAM_CODE_KEY)
      return
    }

    if (validProductCode) {
      sessionStorage.setItem(SCAN_PUBLIC_CODE_KEY, scanCode)
      localStorage.setItem(SCAN_PUBLIC_CODE_KEY, scanCode)
    }
    if (isTeamFlow) {
      sessionStorage.setItem(TEAM_CODE_KEY, teamCode)
      localStorage.setItem(TEAM_CODE_KEY, teamCode)
      setMode('login')
      apiPost('/public/team/browser-authority', { public_code: scanCode, team_code: teamCode })
        .then((json: any) => { if (json?.ok) setTeamIdentity(json.data || null) })
        .catch(() => undefined)
      return
    }
    setMode(isDraftResume || isSwitchUser ? 'login' : 'register')
  }, [hasProductContext, isDraftResume, isSwitchUser, isTeamFlow, scanCode, teamCode, validProductCode])

  const persistAuthMode = (nextMode: Mode) => {
    sessionStorage.setItem('kawvo_auth_mode', nextMode)
    localStorage.setItem('kawvo_auth_mode', nextMode)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login' && loginMethod === 'password' && !hasProductContext) {
        const json: any = await apiPost('/auth/password/login', { email, password })
        if (json.ok) {
          persistAuthMode(mode)
          window.location.assign('/admin')
        } else {
          setError(json.error || 'Correo o contraseña incorrectos.')
        }
      } else {
        const json: any = await apiPost('/auth/magic-link/start', { email, mode })
        if (json.ok) {
          sessionStorage.setItem('magic_link_email', email)
          persistAuthMode(mode)
          if (teamResumeUrl) {
            sessionStorage.setItem('kawvo_team_resume_url', teamResumeUrl)
            localStorage.setItem('kawvo_team_resume_url', teamResumeUrl)
          }
          navigate('/admin/check-email')
        } else {
          setError(json.error || 'Error al enviar el enlace')
        }
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }


  const startPasswordRecovery = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      const json:any = await apiPost('/auth/password/reset/start', { email })
      if (json?.ok) setRecoveryStage('code')
      else setError(json?.error || 'No pudimos enviar el código.')
    } catch { setError('Error de conexión') } finally { setLoading(false) }
  }

  const confirmPasswordRecovery = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      const json:any = await apiPost('/auth/password/reset/confirm', { email, code: recoveryCode })
      if (json?.ok) setRecoveryStage('new')
      else setError(json?.error || 'Código incorrecto o expirado.')
    } catch { setError('Error de conexión') } finally { setLoading(false) }
  }

  const completePasswordRecovery = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    if (recoveryPassword.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return }
    if (recoveryPassword !== recoveryConfirm) { setError('Las contraseñas no coinciden.'); return }
    setLoading(true)
    try {
      const json:any = await apiPost('/auth/password/reset/complete', { password: recoveryPassword })
      if (json?.ok) {
        setPassword(''); setRecoveryCode(''); setRecoveryPassword(''); setRecoveryConfirm(''); setRecoveryStage('done')
      } else setError(json?.error || 'No pudimos restablecer la contraseña.')
    } catch { setError('Error de conexión') } finally { setLoading(false) }
  }

  const handleGoogle = () => {
    persistAuthMode(mode)
    if (teamResumeUrl) {
      sessionStorage.setItem('kawvo_team_resume_url', teamResumeUrl)
      localStorage.setItem('kawvo_team_resume_url', teamResumeUrl)
    }
    window.location.href = '/api/v1/auth/google/start'
  }

  const isRegister = mode === 'register'

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[430px] flex-col justify-center">
        <div className="mb-7 text-center">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-600">KAWVO LINK</p>
          <h1 className="mt-3 text-[30px] font-black leading-tight tracking-[-0.04em]">{isTeamFlow ? 'Confirma tu acceso' : isDraftResume ? 'Continúa tu perfil' : isSwitchUser ? 'Continúa con otra cuenta' : isScanFlow ? 'Activa tu producto' : isRegister ? 'Crea tu acceso' : 'Bienvenido de nuevo'}</h1>
          <p className="mx-auto mt-2 max-w-sm text-[15px] leading-6 text-slate-500">
            {isTeamFlow
              ? 'Inicia sesión con la cuenta Administrador Master para continuar preparando este dispositivo.'
              : isDraftResume
                ? 'Inicia sesión para continuar configurando tu Perfil Digital.'
                : isSwitchUser
                  ? 'La sesión anterior fue cerrada. Accede o crea una cuenta para continuar con este producto.'
                  : isScanFlow
                    ? 'Tu producto está listo. Accede o crea una cuenta para continuar.'
                    : isRegister
                      ? 'Valida tu correo para crear tu acceso a Kawvo Link.'
                      : 'Accede para administrar tu perfil y tus productos Kawvo.'}
          </p>
        </div>

        {isTeamFlow && teamIdentity && <div className="mb-4 rounded-[22px] border border-cyan-200 bg-cyan-50 p-4 text-center">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-cyan-700">TEAM</p>
          <p className="mt-1 text-lg font-black text-slate-950">{teamIdentity.team_name}</p>
          {teamIdentity.master_name && <p className="mt-1 text-sm font-semibold text-slate-600">Administrador: {teamIdentity.master_name}</p>}
        </div>}

        <div className="rounded-[28px] border border-slate-200 bg-white p-2 shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
          {!isTeamFlow && <div className="grid grid-cols-2 gap-1 rounded-[22px] bg-slate-100 p-1">
            <button type="button" onClick={() => { setMode('login'); setError('') }} className={`rounded-[18px] px-3 py-3 text-sm font-extrabold transition ${!isRegister ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>Acceder</button>
            <button type="button" onClick={() => { setMode('register'); setError('') }} className={`rounded-[18px] px-3 py-3 text-sm font-extrabold transition ${isRegister ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>Crear cuenta</button>
          </div>}

          <div className="p-4 pt-5">
            {!isRegister && !hasProductContext && recoveryStage === 'idle' && <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1"><button type="button" onClick={() => { setLoginMethod('email'); setError('') }} className={`rounded-xl px-3 py-2.5 text-xs font-black ${loginMethod === 'email' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>Correo seguro</button><button type="button" onClick={() => { setLoginMethod('password'); setError('') }} className={`rounded-xl px-3 py-2.5 text-xs font-black ${loginMethod === 'password' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>Contraseña Kawvo</button></div>}
            <form onSubmit={handleSubmit} className={`space-y-4 ${recoveryStage !== 'idle' ? 'hidden' : ''}`}>
              <label className="block text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">
                Correo electrónico
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@email.com" required className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" />
              </label>
              {!isRegister && loginMethod === 'password' && !hasProductContext && <label className="block text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Contraseña Kawvo<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Tu contraseña Kawvo" required className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" /></label>}
              {!isRegister && loginMethod === 'password' && !hasProductContext && <button type="button" onClick={() => { setRecoveryStage('email'); setError('') }} className="-mt-1 block w-full text-right text-xs font-extrabold text-cyan-700 hover:text-cyan-800">Olvidé mi contraseña</button>}
              {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">{error}</p>}
              <button type="submit" disabled={loading} className="w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white transition hover:bg-slate-800 disabled:opacity-40">{loading ? 'Procesando…' : isTeamFlow ? 'Continuar como Master' : isRegister ? 'Validar mi correo' : loginMethod === 'password' && !hasProductContext ? 'Entrar con contraseña' : 'Continuar'}</button>
            </form>

            {recoveryStage !== 'idle' && <div className="space-y-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-black text-slate-950">Restablecer contraseña</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Usaremos un código enviado a tu correo para confirmar que eres el dueño de la cuenta.</p>
              </div>

              {recoveryStage === 'email' && <form onSubmit={startPasswordRecovery} className="space-y-4">
                <label className="block text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Correo electrónico<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@email.com" required autoComplete="email" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" /></label>
                {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">{error}</p>}
                <button type="submit" disabled={loading} className="w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white disabled:opacity-40">{loading ? 'Enviando…' : 'Enviar código'}</button>
              </form>}

              {recoveryStage === 'code' && <form onSubmit={confirmPasswordRecovery} className="space-y-4">
                <p className="text-xs leading-5 text-slate-500">Si <strong>{email}</strong> está registrado, recibirás un código de 6 dígitos. Expira en 10 minutos.</p>
                <label className="block text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Código de verificación<input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={recoveryCode} onChange={(e) => setRecoveryCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" required className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-center text-lg font-black tracking-[0.25em] text-slate-900 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" /></label>
                {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">{error}</p>}
                <button type="submit" disabled={loading || recoveryCode.length !== 6} className="w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white disabled:opacity-40">{loading ? 'Validando…' : 'Validar código'}</button>
                <button type="button" onClick={() => { setRecoveryStage('email'); setRecoveryCode(''); setError('') }} className="w-full text-xs font-extrabold text-cyan-700">Enviar otro código</button>
              </form>}

              {recoveryStage === 'new' && <form onSubmit={completePasswordRecovery} className="space-y-4">
                <label className="block text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Nueva contraseña Kawvo<input type="password" value={recoveryPassword} onChange={(e) => setRecoveryPassword(e.target.value)} minLength={8} maxLength={128} autoComplete="new-password" required className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-900 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" /></label>
                <label className="block text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Repetir contraseña<input type="password" value={recoveryConfirm} onChange={(e) => setRecoveryConfirm(e.target.value)} minLength={8} maxLength={128} autoComplete="new-password" required className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-900 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" /></label>
                {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">{error}</p>}
                <button type="submit" disabled={loading} className="w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white disabled:opacity-40">{loading ? 'Guardando…' : 'Restablecer contraseña'}</button>
              </form>}

              {recoveryStage === 'done' && <div className="space-y-4">
                <div className="rounded-2xl bg-emerald-50 px-4 py-4 text-sm font-bold text-emerald-800">Contraseña Kawvo restablecida. Ya puedes acceder con tu nueva contraseña.</div>
                <button type="button" onClick={() => { setRecoveryStage('idle'); setLoginMethod('password'); setError('') }} className="w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white">Volver a acceder</button>
              </div>}

              {recoveryStage !== 'done' && <button type="button" onClick={() => { setRecoveryStage('idle'); setRecoveryCode(''); setRecoveryPassword(''); setRecoveryConfirm(''); setError('') }} className="w-full text-xs font-extrabold text-slate-500">Cancelar</button>}
            </div>}

            <div className="my-5 flex items-center gap-3"><span className="h-px flex-1 bg-slate-200" /><span className="text-xs font-semibold text-slate-400">o continúa con</span><span className="h-px flex-1 bg-slate-200" /></div>

            <button type="button" onClick={handleGoogle} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-extrabold text-slate-800 transition hover:bg-slate-50">
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 0 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Google
            </button>
          </div>
        </div>

        {isRegister && !hasProductContext && <div className="mt-5 rounded-[22px] border border-cyan-100 bg-cyan-50/70 p-4 text-center"><p className="text-sm font-extrabold text-slate-900">Perfil Digital Gratis con tu artículo Kawvo</p><p className="mt-1 text-xs leading-5 text-slate-500">Crea tu acceso y sigue los pasos en pantalla.</p></div>}
      </section>
    </main>
  )
}
