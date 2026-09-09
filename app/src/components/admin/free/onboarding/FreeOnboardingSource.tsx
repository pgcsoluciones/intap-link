import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPut } from '../../../../lib/api'

const SOURCES = [
  'Recomendación',
  'Instagram',
  'WhatsApp',
  'Tienda o punto de venta',
  'Evento',
  'Cliente o amigo',
  'Otro',
] as const

export default function FreeOnboardingSource() {
  const navigate = useNavigate()
  const [source, setSource] = useState(() => sessionStorage.getItem('kawvo_free_lead_source') || '')
  const [templateData, setTemplateData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    apiGet('/me').then((json: any) => {
      if (!active || !json?.ok) return
      const template = json.data?.templateData && typeof json.data.templateData === 'object' ? json.data.templateData : {}
      setTemplateData(template)
      const savedSource = String(template.free_starter_lead_source || '').trim()
      if (!source && savedSource) {
        setSource(savedSource)
        sessionStorage.setItem('kawvo_free_lead_source', savedSource)
      }
      const category = String(json.data?.category || template.free_starter_category || '').trim()
      const subcategory = String(json.data?.subcategory || template.free_starter_subcategory || '').trim()
      if (category) sessionStorage.setItem('kawvo_free_category', category)
      if (subcategory) sessionStorage.setItem('kawvo_free_subcategory', subcategory)
    }).catch(() => setError('No pudimos recuperar el avance de tu perfil.'))
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
    // hydrate once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const continueFlow = async () => {
    if (!source || saving) return
    setSaving(true)
    setError('')
    const nextTemplate = {
      ...templateData,
      free_starter_lead_source: source,
      free_onboarding_stage: 'builder',
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
    sessionStorage.setItem('kawvo_free_lead_source', source)
    navigate('/admin/free/onboarding/builder')
  }

  if (loading) return <main className="min-h-screen bg-[#f7f9fc] flex items-center justify-center"><div className="loading-spinner" /></main>

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-4 py-7 font-['Inter'] text-slate-950 sm:px-5 sm:py-8">
      <section className="mx-auto w-full max-w-[430px] py-3 sm:py-4">
        <div className="mb-8 flex gap-2" aria-label="Paso 2 de 2">
          <span className="h-1.5 flex-1 rounded-full bg-cyan-500" />
          <span className="h-1.5 flex-1 rounded-full bg-cyan-500" />
        </div>

        <p className="mb-2 text-sm font-extrabold uppercase tracking-[0.14em] text-cyan-700">Última pregunta</p>
        <h1 className="text-[30px] font-black leading-tight tracking-[-0.03em]">¿Cómo supiste de nosotros?</h1>
        <p className="mt-3 text-base font-medium leading-7 text-slate-700">Esto nos ayuda a entender cómo llegan nuestros clientes a Kawvo y mejorar la experiencia.</p>

        <div className="mt-7 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,0.07)]">
          <div className="grid gap-3">
            {SOURCES.map((item) => (
              <button key={item} type="button" onClick={() => setSource(item)} className={`min-h-13 rounded-2xl border px-4 py-3.5 text-left text-base font-bold transition ${source === item ? 'border-cyan-500 bg-cyan-50 text-cyan-800' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}>
                {item}
              </button>
            ))}
          </div>

          {error && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-3 text-sm font-semibold text-rose-700">{error}</p>}

          <button type="button" onClick={() => void continueFlow()} disabled={!source || saving} className="mt-6 w-full rounded-2xl bg-slate-950 px-4 py-4 text-base font-extrabold text-white transition disabled:opacity-35">
            {saving ? 'Guardando avance…' : 'Preparar mi perfil base'}
          </button>
        </div>
      </section>
    </main>
  )
}
