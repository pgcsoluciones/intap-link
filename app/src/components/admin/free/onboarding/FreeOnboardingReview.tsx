import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPut } from '../../../../lib/api'
import FreeStarterNativePreview from './FreeStarterNativePreview'

export default function FreeOnboardingReview() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [category, setCategory] = useState(() => sessionStorage.getItem('kawvo_free_category') || '')
  const [subcategory, setSubcategory] = useState(() => sessionStorage.getItem('kawvo_free_subcategory') || '')
  const [templateData, setTemplateData] = useState<Record<string, any>>({})

  useEffect(() => {
    let active = true
    apiGet('/me')
      .then((json: any) => {
        if (!active) return
        if (!json?.ok || !json.data?.profile_id) {
          navigate('/admin/free/onboarding/welcome', { replace: true })
          return
        }
        const template = json.data?.templateData && typeof json.data.templateData === 'object' ? json.data.templateData : {}
        setTemplateData(template)
        const savedCategory = category || String(json.data?.category || template.free_starter_category || '').trim()
        const savedSubcategory = subcategory || String(json.data?.subcategory || template.free_starter_subcategory || '').trim()
        if (savedCategory) {
          setCategory(savedCategory)
          sessionStorage.setItem('kawvo_free_category', savedCategory)
        }
        if (savedSubcategory) {
          setSubcategory(savedSubcategory)
          sessionStorage.setItem('kawvo_free_subcategory', savedSubcategory)
        }
      })
      .catch(() => setError('No pudimos abrir la vista previa de tu borrador.'))
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
    // hydrate once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate])

  const continueToPanel = async () => {
    if (saving) return
    setSaving(true)
    setError('')
    const nextTemplate = {
      ...templateData,
      free_starter_unconfirmed: false,
      free_starter_reviewed_at: new Date().toISOString(),
      free_onboarding_stage: 'customize',
      free_onboarding_updated_at: new Date().toISOString(),
    }
    const result: any = await apiPut('/me/profile', { template_data: nextTemplate })
      .catch(() => ({ ok: false, error: 'No pudimos guardar tu avance.' }))
    setSaving(false)
    if (!result?.ok) {
      setError(result?.error || 'No pudimos guardar tu avance. Intenta nuevamente.')
      return
    }
    setTemplateData(nextTemplate)
    navigate('/admin/free', { replace: true })
  }

  if (loading) return <main className="min-h-screen bg-[#f7f9fc] flex items-center justify-center"><div className="loading-spinner" /></main>

  if (!category) {
    return (
      <main className="min-h-screen bg-[#f7f9fc] px-4 py-10 font-['Inter'] text-slate-950">
        <section className="mx-auto max-w-md rounded-[28px] border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-2xl font-black">Falta definir tu actividad comercial</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Para preparar una base correcta necesitamos saber a qué te dedicas.</p>
          <button type="button" onClick={() => navigate('/admin/free/onboarding/category')} className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white">Definir mi actividad comercial</button>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-4 py-5 font-['Inter'] text-slate-950">
      <section className="mx-auto w-full max-w-[1040px]">
        <div className="mx-auto max-w-[430px] text-center lg:max-w-none">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-600">Tu borrador</p>
          <h1 className="mt-2 text-[28px] font-black leading-tight tracking-[-0.04em]">Este ya es tu perfil base</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Lo hemos preparado según tu actividad y ya quedó guardado como borrador. Ahora debes sustituir los datos de ejemplo por tu información real antes de publicarlo.</p>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div className="flex justify-center">
            <FreeStarterNativePreview category={category} subcategory={subcategory} variant={1} />
          </div>

          <aside className="rounded-[28px] border border-cyan-200 bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,0.07)] lg:sticky lg:top-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-700">Siguiente paso</p>
            <h2 className="mt-2 text-xl font-black">Personaliza tu perfil</h2>
            <div className="mt-4 rounded-2xl bg-cyan-50 p-4">
              <p className="text-sm font-black text-cyan-800">Empieza por aquí · Recomendado</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">Revisa primero tu foto, nombre, actividad, contacto, servicios e imágenes. Esos son los datos que convertirán esta base en tu perfil real.</p>
            </div>

            {error && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p>}

            <button type="button" onClick={() => void continueToPanel()} disabled={saving} className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white disabled:opacity-40">
              {saving ? 'Guardando avance…' : 'Editar mi perfil'}
            </button>
          </aside>
        </div>
      </section>
    </main>
  )
}
