import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiPost } from '../../lib/api'

const API_ORIGIN = import.meta.env.VITE_API_URL ?? ''

type Mode = 'login' | 'register'

export default function AdminLogin() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const json: any = await apiPost('/auth/magic-link/start', { email, mode })
      if (json.ok) {
        sessionStorage.setItem('magic_link_email', email)
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
    window.location.href = `${API_ORIGIN}/api/v1/auth/google/start`
  }

  const isRegister = mode === 'register'

  return (
    <div className="min-h-screen bg-intap-dark flex items-center justify-center px-4 font-['Inter']">
      <div className="w-full max-w-sm animate-fade-in">

        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <img
            src="/logo.png"
            alt="Intap Link"
            className="w-40 mx-auto mb-4"
          />
          <h1 className="text-2xl font-black tracking-tight">
            {isRegister ? 'Crea tu cuenta gratis' : 'Bienvenido de nuevo'}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {isRegister
              ? 'Empieza a compartir tus links en segundos'
              : 'Accede a tu panel de control'}
          </p>
        </div>

        {/* Card */}
        <div className="glass-card p-1 flex flex-col gap-0">

          {/* Tabs */}
          <div className="flex rounded-[22px] bg-white/5 p-1 gap-1 mb-1">
            <button
              type="button"
              onClick={() => { setMode('login'); setError('') }}
              className={`flex-1 py-2.5 rounded-[18px] text-sm font-semibold transition-all ${
                !isRegister
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError('') }}
              className={`flex-1 py-2.5 rounded-[18px] text-sm font-semibold transition-all ${
                isRegister
                  ? 'bg-gradient-to-r from-intap-blue to-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Registrarse gratis
            </button>
          </div>

          {/* Form body */}
          <div className="p-5 flex flex-col gap-4">
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  required
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-intap-mint/60 focus:ring-1 focus:ring-intap-mint/20 transition-all"
                />
              </div>

              {error && (
                <p className="text-xs text-red-400 text-center bg-red-400/10 border border-red-400/20 rounded-lg py-2 px-3">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-intap-blue to-purple-600 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50 hover:opacity-90 transition-opacity shadow-lg"
              >
                {loading
                  ? 'Enviando enlace…'
                  : isRegister
                    ? 'Crear cuenta gratis →'
                    : 'Enviar enlace de acceso →'}
              </button>
            </form>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-xs text-slate-500">o</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <button
              type="button"
              onClick={handleGoogle}
              className="w-full bg-white/5 border border-white/10 text-white font-semibold py-3 rounded-xl text-sm hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continuar con Google
            </button>

            {/* Register extra info */}
            {isRegister && (
              <p className="text-center text-xs text-slate-500 mt-1">
                Sin tarjeta de crédito · Siempre gratis para empezar
              </p>
            )}
          </div>
        </div>

        {/* Footer toggle */}
        <p className="text-center text-xs text-slate-500 mt-5">
          {isRegister ? (
            <>
              ¿Ya tienes cuenta?{' '}
              <button
                type="button"
                onClick={() => { setMode('login'); setError('') }}
                className="text-intap-mint hover:underline font-semibold"
              >
                Iniciar sesión
              </button>
            </>
          ) : (
            <>
              ¿No tienes cuenta?{' '}
              <button
                type="button"
                onClick={() => { setMode('register'); setError('') }}
                className="text-intap-mint hover:underline font-semibold"
              >
                Regístrate gratis
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
