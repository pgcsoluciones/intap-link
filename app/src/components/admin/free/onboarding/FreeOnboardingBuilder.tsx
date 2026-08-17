import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPut } from '../../../../lib/api'
import { resolveFreeStarterContent } from '../../../../../../shared/free-profile-starter-content'

const BUILDER_IMAGES = [
  '/assets/free-onboarding-builder/perfil-en-construccion-01.webp',
  '/assets/free-onboarding-builder/perfil-en-construccion-02.webp',
  '/assets/free-onboarding-builder/perfil-en-construccion-03.webp',
  '/assets/free-onboarding-builder/perfil-en-construccion-04.webp',
]

const STATUS_MESSAGES = [
  'Preparando la estructura de tu perfil…',
  'Organizando una base para tu sector…',
  'Seleccionando contenido e imágenes…',
  'Dándole los últimos toques…',
]

export default function FreeOnboardingBuilder() {
  const navigate = useNavigate()
  const [imageIndex, setImageIndex] = useState(0)
  const [statusIndex, setStatusIndex] = useState(0)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const webBase = useMemo(() => (import.meta.env.VITE_WEB_URL ?? 'https://intaprd.com').replace(/\/$/, ''), [])

  useEffect(() => {
    if (done || error) return
    const timer = window.setInterval(() => {
      setImageIndex((value) => (value + 1) % BUILDER_IMAGES.length)
      setStatusIndex((value) => Math.min(value + 1, STATUS_MESSAGES.length - 1))
    }, 1150)
    return () => window.clearInterval(timer)
  }, [done, error])

  useEffect(() => {
    let cancelled = false

    const build = async () => {
      const category = sessionStorage.getItem('kawvo_free_category') || ''
      const subcategory = sessionStorage.getItem('kawvo_free_subcategory') || ''
      const leadSource = sessionStorage.getItem('kawvo_free_lead_source') || ''
      if (!category || !subcategory || !leadSource) {
        navigate('/admin/free/onboarding/category', { replace: true })
        return
      }

      const starter = resolveFreeStarterContent(category)
      const startedAt = Date.now()
      const me: any = await apiGet('/me').catch(() => ({ ok: false }))
      if (!me.ok) {
        if (!cancelled) setError('No pudimos abrir tu perfil para preparar la base.')
        return
      }

      const previousTemplate = me.data?.templateData && typeof me.data.templateData === 'object' ? me.data.templateData : {}
      const nextTemplate = {
        ...previousTemplate,
        services_section_title: starter.servicesTitle,
        services_section_description: starter.servicesDescription,
        free_starter_generated: true,
        free_starter_unconfirmed: true,
        free_starter_category: category,
        free_starter_subcategory: subcategory,
        free_starter_lead_source: leadSource,
        free_starter_generated_at: new Date().toISOString(),
      }

      const result: any = await apiPut('/me/profile', {
        category,
        role: subcategory || starter.role,
        bio: starter.bio,
        template_data: nextTemplate,
      }).catch(() => ({ ok: false, error: 'No pudimos guardar la configuración inicial.' }))

      if (!result.ok) {
        if (!cancelled) setError(result.error || 'No pudimos preparar tu perfil base.')
        return
      }

      const minimumWait = Math.max(0, 4800 - (Date.now() - startedAt))
      window.setTimeout(() => {
        if (!cancelled) setDone(true)
      }, minimumWait)
    }

    void build()
    return () => { cancelled = true }
  }, [navigate])

  if (done) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950">
        <style>{`@keyframes kawvoConfetti{0%{transform:translateY(-15vh) rotate(0);opacity:1}100%{transform:translateY(110vh) rotate(620deg);opacity:0}}`}</style>
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          {Array.from({ length: 24 }).map((_, index) => (
            <span key={index} className={`absolute top-0 h-2.5 w-2.5 rounded-sm ${index % 4 === 0 ? 'bg-cyan-500' : index % 4 === 1 ? 'bg-amber-400' : index % 4 === 2 ? 'bg-violet-500' : 'bg-emerald-500'}`} style={{ left: `${4 + ((index * 17) % 92)}%`, animation: `kawvoConfetti ${1.8 + (index % 5) * 0.22}s ${((index * 7) % 10) / 10}s ease-in forwards` }} />
          ))}
        </div>

        <section className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[430px] flex-col items-center justify-center text-center">
          <div className="w-full rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-3xl">✓</div>
            <p className="mt-5 text-[11px] font-black uppercase tracking-[0.22em] text-cyan-600">KAWVO LINK</p>
            <h1 className="mt-2 text-[30px] font-black leading-tight tracking-[-0.04em]">¡Tu perfil base está listo!</h1>
            <p className="mt-3 text-[15px] leading-6 text-slate-500">Ya preparamos una configuración inicial según tu sector. Ahora toca editarla con tus datos reales.</p>
            <div className="mt-4 rounded-2xl bg-cyan-50 p-4 text-sm leading-6 text-slate-600">No te preocupes, te ayudaremos paso a paso hasta completar lo necesario para publicar tu perfil.</div>
            <button type="button" onClick={() => navigate('/admin/free')} className="mt-6 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white">Editar mi perfil</button>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950">
      <style>{`@keyframes kawvoWorkerCross{0%{transform:translateX(-115%);opacity:0}12%{opacity:1}78%{opacity:1}100%{transform:translateX(115%);opacity:0}}`}</style>
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[430px] flex-col items-center justify-center text-center">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-600">Estamos construyendo</p>
        <h1 className="mt-3 text-[28px] font-black leading-tight tracking-[-0.04em]">Ten paciencia, nuestros asistentes están haciendo algo chulo para ti</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">En unos segundos tendrás una base lista para empezar a personalizar.</p>

        <div className="relative mt-8 h-56 w-full overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.07)]">
          <img key={imageIndex} src={`${webBase}${BUILDER_IMAGES[imageIndex]}`} alt="Asistentes preparando tu perfil" className="absolute bottom-0 left-0 h-full w-full object-contain" style={{ animation: 'kawvoWorkerCross 1.15s ease-in-out both' }} />
        </div>

        {error ? (
          <div className="mt-6 w-full rounded-2xl bg-rose-50 p-4 text-sm font-semibold leading-6 text-rose-700">
            {error}
            <button type="button" onClick={() => window.location.reload()} className="mt-3 block w-full rounded-xl bg-white px-4 py-3 text-xs font-black text-rose-700">Intentar otra vez</button>
          </div>
        ) : (
          <>
            <p className="mt-6 text-sm font-extrabold text-slate-700">{STATUS_MESSAGES[statusIndex]}</p>
            <div className="mt-4 flex gap-2" aria-hidden="true">
              {STATUS_MESSAGES.map((_, index) => <span key={index} className={`h-2 w-8 rounded-full transition ${index <= statusIndex ? 'bg-cyan-500' : 'bg-slate-200'}`} />)}
            </div>
          </>
        )}
      </section>
    </main>
  )
}
