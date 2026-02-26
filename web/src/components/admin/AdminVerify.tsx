import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiPost, apiGet } from '../../lib/api'

export default function AdminVerify() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const email = sessionStorage.getItem('otp_email') || ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const json: any = await apiPost('/auth/otp/verify', { email, code: code.trim() })
      if (!json.ok) { setError(json.error || 'Código inválido'); return }

      localStorage.setItem('intap_token', json.token)
      sessionStorage.removeItem('otp_email')

      // Check if user has a profile yet
      const me: any = await apiGet('/me')
      if (me.ok && me.data?.profile_id) {
        navigate('/admin', { replace: true })
      } else {
        navigate('/admin/onboarding/slug', { replace: true })
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
          <h1 className="text-2xl font-black mb-1">Ingresa el código</h1>
          <p className="text-sm text-slate-400">
            Enviado a <span className="text-white font-bold">{email || '—'}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">
              Código de 6 dígitos
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              required
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-intap-mint/50 transition-colors tracking-[0.5em] font-mono text-center text-lg"
            />
          </div>

          {error && <p className="text-xs text-red-400 text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading || code.length < 6}
            className="w-full bg-gradient-to-r from-intap-blue to-purple-600 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50 transition-opacity"
          >
            {loading ? 'Verificando…' : 'Verificar →'}
          </button>

          <button
            type="button"
            onClick={() => navigate('/admin/login')}
            className="text-xs text-slate-500 hover:text-white text-center transition-colors"
          >
            Volver e ingresar otro correo
          </button>
        </form>
      </div>
    </div>
  )
}
