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
  'Nuestro equipo está trabajando para entregarte algo chulo.',
  'Estamos preparando una base pensada para tu actividad comercial.',
  'Estamos colocando textos, imágenes y secciones de ejemplo para que no empieces desde cero.',
  'Recuerda: estos son datos base. Luego debes cambiarlos por tus textos, fotos y datos reales.',
  'Ya casi, casi… estamos dando los últimos toques.',
  'Tu base estará lista en un momento. Después podrás revisar todo antes de continuar.',
]

const FIRST_BUILD_MS = 30000
const SECOND_BUILD_MS = 20000

export default function FreeOnboardingBuilder() {
  const navigate = useNavigate()
  const [imageIndex, setImageIndex] = useState(0)
  const [statusIndex, setStatusIndex] = useState(0)
  const [progress, setProgress] = useState(4)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const webBase = useMemo(() => (import.meta.env.VITE_WEB_URL ?? 'https://intaprd.com').replace(/\/$/, ''), [])
  const builderMediaBase = useMemo(() => import.meta.env.VITE_ENVIRONMENT === 'preview'
    ? 'https://feature-intap-link-approved-v9ix.intap-link.pages.dev'
    : webBase, [webBase])
  const variant = Number(sessionStorage.getItem('kawvo_free_starter_variant') || '1') === 2 ? 2 : 1
  const buildDuration = variant === 2 ? SECOND_BUILD_MS : FIRST_BUILD_MS

  useEffect(() => {
    if (done || error) return
    const imageTimer = window.setInterval(() => {
      setImageIndex((value) => (value + 1) % BUILDER_IMAGES.length)
    }, 5000)
    const messageTimer = window.setInterval(() => {
      setStatusIndex((value) => Math.min(value + 1, STATUS_MESSAGES.length - 1))
    }, Math.floor(buildDuration / STATUS_MESSAGES.length))
    const progressTimer = window.setInterval(() => {
      setProgress((value) => Math.min(96, value + 2))
    }, Math.max(400, Math.floor(buildDuration / 46)))
    return () => {
      window.clearInterval(imageTimer)
      window.clearInterval(messageTimer)
      window.clearInterval(progressTimer)
    }
  }, [buildDuration, done, error])

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
        role: subcategory || starter.role,
        services_section_title: starter.servicesTitle,
        services_section_description: starter.servicesDescription,
        free_starter_generated: true,
        free_starter_unconfirmed: true,
        free_starter_category: category,
        free_starter_subcategory: subcategory,
        free_starter_lead_source: leadSource,
        free_starter_variant: variant,
        free_starter_generated_at: new Date().toISOString(),
      }

      const result: any = await apiPut('/me/profile', {
        category,
        bio: starter.bio,
        layout_id: variant === 2 ? 'personal' : 'impacto',
        template_data: nextTemplate,
        is_published: false,
      }).catch(() => ({ ok: false, error: 'No pudimos guardar la configuración inicial.' }))

      if (!result.ok) {
        if (!cancelled) setError(result.error || 'No pudimos preparar tu perfil base.')
        return
      }

      const minimumWait = Math.max(0, buildDuration - (Date.now() - startedAt))
      window.setTimeout(() => {
        if (!cancelled) {
          setProgress(100)
          setDone(true)
        }
      }, minimumWait)
    }

    void build()
    return () => { cancelled = true }
  }, [buildDuration, navigate, variant])

  if (done) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[#f7f9fc] px-4 py-7 font-['Inter'] text-slate-950 sm:px-5 sm:py-8">
        <style>{`@keyframes kawvoConfetti{0%{transform:translateY(-15vh) rotate(0);opacity:1}100%{transform:translateY(110vh) rotate(620deg);opacity:0}}`}</style>
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          {Array.from({ length: 24 }).map((_, index) => (
            <span key={index} className={`absolute top-0 h-2.5 w-2.5 rounded-sm ${index % 4 === 0 ? 'bg-cyan-500' : index % 4 === 1 ? 'bg-amber-400' : index % 4 === 2 ? 'bg-violet-500' : 'bg-emerald-500'}`} style={{ left: `${4 + ((index * 17) % 92)}%`, animation: `kawvoConfetti ${1.8 + (index % 5) * 0.22}s ${((index * 7) % 10) / 10}s ease-in forwards` }} />
          ))}
        </div>

        <section className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[430px] flex-col items-center justify-center text-center">
          <div className="w-full rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-3xl">✓</div>
            <p className="mt-5 text-sm font-black uppercase tracking-[0.16em] text-cyan-700">KAWVO LINK</p>
            <h1 className="mt-2 text-[30px] font-black leading-tight tracking-[-0.04em]">¡Tu perfil base está listo!</h1>
            <p className="mt-4 text-base font-medium leading-7 text-slate-700">Ya preparamos {variant === 2 ? 'una nueva propuesta' : 'una configuración inicial'} según tu actividad comercial. Ahora queremos que la veas antes de seguir.</p>
            <div className="mt-5 rounded-2xl bg-cyan-100 p-4 text-base font-semibold leading-7 text-slate-800">Esta propuesta usa contenido e imágenes de ejemplo. Antes de publicar te guiaremos para sustituirlos por la información real de tu negocio.</div>
            <button type="button" onClick={() => navigate('/admin/free/onboarding/review')} className="mt-6 w-full rounded-2xl bg-slate-950 px-4 py-4 text-base font-extrabold text-white">Ver mi perfil base</button>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f9fc] px-4 py-7 font-['Inter'] text-slate-950 sm:px-5 sm:py-8">
      <style>{`@keyframes kawvoWorkerCross{0%{transform:translateX(-18px);opacity:.25}14%{opacity:1}86%{opacity:1}100%{transform:translateX(18px);opacity:.25}}`}</style>
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[430px] flex-col items-center justify-center text-center">
        <p className="text-sm font-black uppercase tracking-[0.16em] text-cyan-700">Estamos construyendo</p>
        <h1 className="mt-3 text-[28px] font-black leading-tight tracking-[-0.04em]">Ten paciencia, nuestros asistentes están haciendo algo chulo para ti</h1>
        <p className="mt-4 text-base font-medium leading-7 text-slate-700">Queremos entregarte una base que ya se parezca a un perfil real, no una pantalla vacía.</p>

        <div className="relative mt-8 h-60 w-full overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.07)]">
          <img
            key={imageIndex}
            src={`${builderMediaBase}${BUILDER_IMAGES[imageIndex]}`}
            alt="Asistentes preparando tu perfil"
            className="absolute inset-0 h-full w-full object-contain p-2"
            style={{ animation: 'kawvoWorkerCross 5s ease-in-out both' }}
          />
        </div>

        {error ? (
          <div className="mt-6 w-full rounded-2xl bg-rose-50 p-4 text-base font-semibold leading-7 text-rose-700">
            {error}
            <button type="button" onClick={() => window.location.reload()} className="mt-3 block w-full rounded-xl bg-white px-4 py-3 text-sm font-black text-rose-700">Intentar otra vez</button>
          </div>
        ) : (
          <>
            <p className="mt-6 min-h-14 text-base font-extrabold leading-7 text-slate-800">{STATUS_MESSAGES[statusIndex]}</p>
            <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-slate-200" aria-label={`Progreso ${progress}%`}>
              <div className="h-full rounded-full bg-cyan-500 transition-all duration-700" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-2 text-sm font-bold text-slate-600">{progress}%</p>
          </>
        )}
      </section>
    </main>
  )
}
