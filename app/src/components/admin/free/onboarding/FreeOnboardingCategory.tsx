import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPut } from '../../../../lib/api'
import { FREE_PROFILE_CATEGORIES } from '../../../../../../shared/free-profile-starter-content'
import { resolveFreeSubcategories } from '../../../../../../shared/free-profile-subcategories'

export default function FreeOnboardingCategory() {
  const navigate = useNavigate()
  const [category, setCategory] = useState(() => sessionStorage.getItem('kawvo_free_category') || '')
  const [subcategory, setSubcategory] = useState(() => sessionStorage.getItem('kawvo_free_subcategory') || '')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const subcategories = useMemo(() => resolveFreeSubcategories(category), [category])

  useEffect(() => {
    apiGet('/me').then((json: any) => {
      if (json.ok && !category) setCategory(json.data?.category || '')
    }).finally(() => setLoading(false))
  }, [category])

  const chooseCategory = (value: string) => {
    setCategory(value)
    setSubcategory('')
    setError('')
  }

  const handleContinue = async () => {
    if (!category || !subcategory || saving) return
    setSaving(true)
    setError('')
    try {
      const json: any = await apiPut('/me/profile', { category })
      if (json.ok) {
        sessionStorage.setItem('kawvo_free_category', category)
        sessionStorage.setItem('kawvo_free_subcategory', subcategory)
        navigate('/admin/free/onboarding/source')
      } else {
        setError(json.error || 'No pudimos guardar tu actividad.')
      }
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
        <div className="mb-8 flex gap-2" aria-label="Paso 1 de 2">
          <span className="h-1.5 flex-1 rounded-full bg-cyan-500" />
          <span className="h-1.5 flex-1 rounded-full bg-slate-200" />
        </div>

        <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.18em] text-cyan-600">Paso 1 de 2</p>
        <h1 className="text-[30px] font-black leading-tight tracking-[-0.03em]">¿A qué te dedicas?</h1>
        <p className="mt-2 text-[15px] leading-6 text-slate-500">Primero elige tu rubro y luego la actividad que más se parece a lo que haces.</p>

        <div className="mt-7 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,0.07)]">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Rubro</p>
          <div className="mt-3 flex max-h-64 flex-wrap gap-2.5 overflow-y-auto pr-1">
            {FREE_PROFILE_CATEGORIES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => chooseCategory(item)}
                className={`rounded-full border px-3.5 py-2.5 text-sm font-bold transition ${category === item ? 'border-cyan-500 bg-cyan-50 text-cyan-700 shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
              >
                {item}
              </button>
            ))}
          </div>

          {category && (
            <div className="mt-6 border-t border-slate-100 pt-5">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">¿Cuál te describe mejor?</p>
              <div className="mt-3 grid gap-2">
                {subcategories.map((item) => (
                  <button key={item} type="button" onClick={() => setSubcategory(item)} className={`rounded-2xl border px-4 py-3 text-left text-sm font-bold transition ${subcategory === item ? 'border-cyan-500 bg-cyan-50 text-cyan-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                    {item}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">{error}</p>}

          <button
            type="button"
            onClick={handleContinue}
            disabled={!category || !subcategory || saving}
            className="mt-6 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white transition hover:bg-slate-800 disabled:opacity-35"
          >
            {saving ? 'Guardando…' : 'Continuar'}
          </button>
        </div>
      </section>
    </main>
  )
}
