import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPut } from '../../../../lib/api'

const CATEGORIES = [
  'Moda y accesorios', 'Salud y bienestar', 'Belleza y estética', 'Gastronomía',
  'Tecnología', 'Educación', 'Arte y diseño', 'Deportes y fitness',
  'Turismo y viajes', 'Servicios profesionales', 'Construcción y hogar',
  'Automotriz', 'Agropecuario', 'Retail', 'Otros',
]

export default function FreeOnboardingCategory() {
  const navigate = useNavigate()
  const [category, setCategory] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    apiGet('/me').then((json: any) => {
      if (json.ok) setCategory(json.data?.category || '')
    }).finally(() => setLoading(false))
  }, [])

  const handleContinue = async () => {
    if (!category || saving) return
    setSaving(true)
    setError('')
    try {
      const json: any = await apiPut('/me/profile', { category })
      if (json.ok) navigate('/admin/free/onboarding/identity')
      else setError(json.error || 'No pudimos guardar tu actividad.')
    } catch {
      setError('No pudimos conectar. Intenta nuevamente.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="min-h-screen bg-[#f7f9fc] flex items-center justify-center"><div className="loading-spinner" /></div>

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950">
      <section className="mx-auto w-full max-w-[430px] py-4">
        <div className="mb-8 flex gap-2" aria-label="Paso 2 de 4">
          {[1, 2, 3, 4].map((step) => <span key={step} className={`h-1.5 flex-1 rounded-full ${step <= 2 ? 'bg-cyan-500' : 'bg-slate-200'}`} />)}
        </div>

        <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.18em] text-cyan-600">Paso 2 de 4</p>
        <h1 className="text-[30px] font-black leading-tight tracking-[-0.03em]">¿A qué te dedicas?</h1>
        <p className="mt-2 text-[15px] leading-6 text-slate-500">Elige lo que mejor describe tu actividad.</p>

        <div className="mt-7 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,0.07)]">
          <div className="flex flex-wrap gap-2.5">
            {CATEGORIES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={`rounded-full border px-3.5 py-2.5 text-sm font-bold transition ${category === item ? 'border-cyan-500 bg-cyan-50 text-cyan-700 shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
              >
                {item}
              </button>
            ))}
          </div>

          {error && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">{error}</p>}

          <button
            type="button"
            onClick={handleContinue}
            disabled={!category || saving}
            className="mt-6 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white transition hover:bg-slate-800 disabled:opacity-35"
          >
            {saving ? 'Guardando…' : 'Continuar'}
          </button>
        </div>
      </section>
    </main>
  )
}
