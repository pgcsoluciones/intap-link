import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiPost } from '../../../lib/api'

const RESERVED = new Set(['admin', 'api', 'auth', 'me', 'assets', 'favicon', 'www'])
const SLUG_RE = /^[a-z0-9_-]{2,32}$/

export default function OnboardingSlug() {
  const navigate = useNavigate()
  const [slug, setSlug] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isValid = SLUG_RE.test(slug) && !RESERVED.has(slug)

  const handleChange = (val: string) => {
    setSlug(val.toLowerCase().replace(/[^a-z0-9_-]/g, ''))
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return
    setLoading(true)
    setError('')
    try {
      const json: any = await apiPost('/me/profile/claim', { slug })
      if (json.ok) {
        navigate('/admin/onboarding/category')
      } else {
        setError(json.error || 'Error al reclamar el slug')
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
        {/* Progress */}
        <div className="flex gap-1 mb-8">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className={`h-1 flex-1 rounded-full ${step === 1 ? 'bg-intap-mint' : 'bg-white/10'}`} />
          ))}
        </div>

        <div className="mb-8">
          <p className="text-xs font-bold text-intap-mint uppercase tracking-widest mb-2">Paso 1 de 4</p>
          <h1 className="text-2xl font-black mb-1">Elige tu URL</h1>
          <p className="text-sm text-slate-400">Esta será tu dirección pública. Ej: intap-web2.pages.dev/tu-slug</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Tu slug</label>
            <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus-within:border-intap-mint/50 transition-colors">
              <span className="text-slate-500 text-sm select-none mr-1">…/</span>
              <input
                type="text"
                value={slug}
                onChange={(e) => handleChange(e.target.value)}
                placeholder="mi-nombre"
                maxLength={32}
                required
                className="bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none flex-1"
              />
              {slug.length >= 2 && (
                <span className={`text-xs font-bold ${isValid ? 'text-intap-mint' : 'text-red-400'}`}>
                  {isValid ? '✓' : '✗'}
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-500">Solo letras, números, guiones o guiones bajos. Mín. 2 caracteres.</p>
          </div>

          {error && <p className="text-xs text-red-400 text-center">{error}</p>}

          <button
            type="submit"
            disabled={!isValid || loading}
            className="w-full bg-gradient-to-r from-intap-blue to-purple-600 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50 transition-opacity"
          >
            {loading ? 'Guardando…' : 'Continuar →'}
          </button>
        </form>
      </div>
    </div>
  )
}
