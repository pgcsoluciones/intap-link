import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiPost } from '../../../../lib/api'

const RESERVED = new Set(['admin', 'api', 'auth', 'me', 'assets', 'favicon', 'www'])
const SLUG_RE = /^[a-z0-9_-]{2,32}$/

export default function FreeOnboardingSlug() {
  const navigate = useNavigate()
  const [slug, setSlug] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isValid = SLUG_RE.test(slug) && !RESERVED.has(slug)

  const handleChange = (value: string) => {
    setSlug(value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))
    setError('')
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!isValid || loading) return

    setLoading(true)
    setError('')
    try {
      const json: any = await apiPost('/me/profile/claim', { slug })
      if (json.ok) {
        navigate('/admin/free/onboarding/category')
      } else {
        setError(json.error || 'No pudimos guardar esta URL.')
      }
    } catch {
      setError('No pudimos conectar. Intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[430px] flex-col justify-center">
        <div className="mb-8 flex gap-2" aria-label="Paso 1 de 4">
          {[1, 2, 3, 4].map((step) => (
            <span key={step} className={`h-1.5 flex-1 rounded-full ${step === 1 ? 'bg-cyan-500' : 'bg-slate-200'}`} />
          ))}
        </div>

        <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.18em] text-cyan-600">Paso 1 de 4</p>
        <h1 className="text-[30px] font-black leading-tight tracking-[-0.03em]">Comienza con tu enlace</h1>
        <p className="mt-2 text-[15px] leading-6 text-slate-500">Elige la dirección pública que compartirás con tus contactos.</p>

        <form onSubmit={handleSubmit} className="mt-7 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
          <label className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Tu URL</label>
          <div className="mt-2 flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 focus-within:border-cyan-400 focus-within:ring-4 focus-within:ring-cyan-100">
            <span className="mr-1.5 text-sm font-semibold text-slate-500">intaprd.com/</span>
            <input
              value={slug}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="mi-nombre"
              maxLength={32}
              autoFocus
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
            />
            {slug.length >= 2 && <span className={`ml-2 text-sm font-black ${isValid ? 'text-cyan-600' : 'text-rose-500'}`}>{isValid ? '✓' : '×'}</span>}
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-400">Usa letras, números, guiones o guion bajo.</p>

          {error && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">{error}</p>}

          <button
            type="submit"
            disabled={!isValid || loading}
            className="mt-6 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-35"
          >
            {loading ? 'Guardando…' : 'Continuar'}
          </button>
        </form>
      </section>
    </main>
  )
}
