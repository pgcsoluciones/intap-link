import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiPost } from '../../lib/api'

export default function AdminLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [devCode, setDevCode] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setDevCode('')
    setLoading(true)
    try {
      const json: any = await apiPost('/auth/otp/request', { email })
      if (json.ok) {
        sessionStorage.setItem('otp_email', email)
        if (json.dev_code) {
          // Dev mode: show code on screen, user copies it and goes to /verify
          setDevCode(json.dev_code)
        } else {
          navigate('/admin/verify')
        }
      } else {
        setError(json.error || 'Error al enviar el código')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-intap-dark flex items-center justify-center px-4 font-['Inter']">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black mb-1">Accede a tu panel</h1>
          <p className="text-sm text-slate-400">Te enviamos un código de 6 dígitos</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">
              Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-intap-mint/50 transition-colors"
            />
          </div>

          {error && <p className="text-xs text-red-400 text-center">{error}</p>}

          {devCode && (
            <div className="rounded-xl bg-intap-mint/10 border border-intap-mint/30 p-4 flex flex-col gap-2">
              <p className="text-[10px] font-bold text-intap-mint uppercase tracking-widest">
                Código DEV (no hay email configurado)
              </p>
              <p className="text-3xl font-mono font-black text-white tracking-[0.3em] text-center">
                {devCode}
              </p>
              <button
                type="button"
                onClick={() => navigate('/admin/verify')}
                className="w-full bg-gradient-to-r from-intap-blue to-purple-600 text-white font-bold py-2.5 rounded-xl text-sm mt-1"
              >
                Ir a verificar →
              </button>
            </div>
          )}

          {!devCode && (
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-intap-blue to-purple-600 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50 transition-opacity"
            >
              {loading ? 'Enviando…' : 'Enviar código →'}
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
