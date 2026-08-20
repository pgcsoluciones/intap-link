import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPost } from '../../../../lib/api'
import FreeStarterNativePreview from './FreeStarterNativePreview'

export default function FreeOnboardingReview() {
  const navigate = useNavigate()
  const [me, setMe] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const variant = Number(sessionStorage.getItem('kawvo_free_starter_variant') || '1') === 2 ? 2 : 1
  const category = sessionStorage.getItem('kawvo_free_category') || ''
  const subcategory = sessionStorage.getItem('kawvo_free_subcategory') || ''

  useEffect(() => {
    apiGet('/me')
      .then((json: any) => {
        if (!json?.ok || !json.data?.profile_id) {
          navigate('/admin/free/onboarding/welcome', { replace: true })
          return
        }
        setMe(json.data)
      })
      .catch(() => setError('No pudimos abrir la vista previa.'))
      .finally(() => setLoading(false))
  }, [navigate])

  const accept = async () => {
    if (!me || saving) return
    if (!category || !subcategory) {
      setError('Falta definir tu actividad comercial antes de aplicar esta base.')
      return
    }

    setSaving(true)
    setError('')

    const result: any = await apiPost('/me/free/starter/apply', {
      category,
      subcategory,
      variant,
    }).catch(() => ({ ok: false, error: 'No pudimos aplicar tu perfil base.' }))

    setSaving(false)
    if (!result.ok) {
      setError(result.error || 'No pudimos aplicar tu perfil base.')
      return
    }

    sessionStorage.setItem('kawvo_free_starter_selected', String(variant))
    sessionStorage.setItem('kawvo_free_starter_materialized', '1')
    navigate('/admin/free', { replace: true })
  }

  const generateAlternative = () => {
    sessionStorage.setItem('kawvo_free_starter_variant', variant === 1 ? '2' : '1')
    navigate('/admin/free/onboarding/builder')
  }

  const changeActivity = () => {
    sessionStorage.removeItem('kawvo_free_category')
    sessionStorage.removeItem('kawvo_free_subcategory')
    sessionStorage.setItem('kawvo_free_starter_variant', '1')
    navigate('/admin/free/onboarding/category')
  }

  if (loading) return <main className="min-h-screen bg-[#f7f9fc] flex items-center justify-center"><div className="loading-spinner" /></main>

  if (!category) {
    return (
      <main className="min-h-screen bg-[#f7f9fc] px-4 py-10 font-['Inter'] text-slate-950">
        <section className="mx-auto max-w-md rounded-[28px] border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-2xl font-black">Falta definir tu actividad comercial</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Para preparar una base correcta necesitamos saber a qué te dedicas.</p>
          <button type="button" onClick={changeActivity} className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white">Definir mi actividad comercial</button>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-4 py-5 font-['Inter'] text-slate-950">
      <section className="mx-auto w-full max-w-[1040px]">
        <div className="mx-auto max-w-[430px] text-center lg:max-w-none">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-600">Tu propuesta {variant}</p>
          <h1 className="mt-2 text-[28px] font-black leading-tight tracking-[-0.04em]">Mira cómo puede comenzar tu perfil</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Esta es una base de ejemplo según tu actividad comercial. Todavía no está publicada y podrás cambiar textos, imágenes y datos.</p>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div className="flex justify-center">
            <FreeStarterNativePreview category={category} subcategory={subcategory} variant={variant} />
          </div>

          <aside className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,0.07)] lg:sticky lg:top-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">¿Qué te parece?</p>
            <h2 className="mt-2 text-xl font-black">Elige cómo quieres continuar</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">Al elegir esta base la vamos a colocar de verdad dentro de tu editor para que empieces desde ella, no desde una pantalla vacía.</p>

            {error && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p>}

            <button type="button" onClick={() => void accept()} disabled={saving} className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white disabled:opacity-50">
              {saving ? 'Aplicando tu base…' : 'Me quedo con esta base'}
            </button>

            <button type="button" onClick={generateAlternative} disabled={saving} className="mt-3 w-full rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-4 text-sm font-extrabold text-cyan-800 disabled:opacity-50">
              {variant === 1 ? 'Quiero ver otra propuesta' : 'Prefiero volver a la propuesta 1'}
            </button>

            <button type="button" onClick={changeActivity} disabled={saving} className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-extrabold text-slate-600 disabled:opacity-50">
              Cambiar mi actividad comercial
            </button>
          </aside>
        </div>
      </section>
    </main>
  )
}
