import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPut } from '../../../../lib/api'
import { FREE_PROFILE_CATEGORIES } from '../../../../../../shared/free-profile-starter-content'
import { resolveFreeSubcategories } from '../../../../../../shared/free-profile-subcategories'

function normalize(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export default function FreeOnboardingCategory() {
  const navigate = useNavigate()
  const [category, setCategory] = useState(() => sessionStorage.getItem('kawvo_free_category') || '')
  const [subcategory, setSubcategory] = useState(() => sessionStorage.getItem('kawvo_free_subcategory') || '')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const subcategories = useMemo(() => resolveFreeSubcategories(category), [category])
  const filteredCategories = useMemo(() => {
    const q = normalize(query.trim())
    if (!q) return FREE_PROFILE_CATEGORIES
    return FREE_PROFILE_CATEGORIES.filter((item) => normalize(item).includes(q))
  }, [query])

  useEffect(() => {
    apiGet('/me').then((json: any) => {
      if (json.ok && !category) setCategory(json.data?.category || '')
    }).finally(() => setLoading(false))
  }, [category])

  const chooseCategory = (value: string) => {
    setCategory(value)
    setSubcategory('')
    setQuery('')
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
        sessionStorage.setItem('kawvo_free_starter_variant', '1')
        navigate('/admin/free/onboarding/source')
      } else {
        setError(json.error || 'No pudimos guardar tu actividad comercial.')
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
        <p className="mt-2 text-[15px] leading-6 text-slate-500">Elige tu actividad comercial. Después te mostraremos opciones más específicas para preparar mejor tu perfil.</p>

        <div className="mt-7 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,0.07)]">
          <label className="block text-xs font-black uppercase tracking-[0.12em] text-slate-400">
            Actividad comercial
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={category || 'Busca o selecciona una actividad'}
              className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-bold text-slate-800 outline-none placeholder:text-slate-400 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
            />
          </label>

          <div className="mt-3 max-h-52 overflow-y-auto rounded-2xl border border-slate-100 bg-white p-2">
            {filteredCategories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => chooseCategory(item)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-bold transition ${category === item ? 'bg-cyan-50 text-cyan-700' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <span>{item}</span>
                {category === item && <span aria-hidden="true">✓</span>}
              </button>
            ))}
            {filteredCategories.length === 0 && <p className="px-3 py-4 text-sm text-slate-400">No encontramos una coincidencia. Prueba con otra palabra o selecciona “Otros”.</p>}
          </div>

          {category && (
            <div className="mt-6 border-t border-slate-100 pt-5">
              <label className="block text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                ¿Cuál opción describe mejor lo que haces?
                <select
                  value={subcategory}
                  onChange={(event) => setSubcategory(event.target.value)}
                  className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-bold text-slate-700 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                >
                  <option value="">Selecciona una opción</option>
                  {subcategories.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
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
