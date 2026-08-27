import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPost } from '../../../lib/api'
import { FreeBackButton } from './FreePanelUi'

type Service = { id?: string; title: string; description: string; has_image?: boolean }
type Proposal = {
  professional_title: string
  bio: string
  services_section_title: string
  services_section_description: string
  services: Array<{ title: string; description: string }>
  cta: { label: string; goal: string }
}
type AssistantContext = {
  profile: {
    slug: string
    name: string
    category: string
    professional_title: string
    bio: string
    services: Service[]
    contact: { whatsapp?: string; email?: string; phone?: string; address?: string }
  }
  limits: {
    max_answer_length: number
    max_total_input_length: number
    daily_generations: number
    cooldown_seconds: number
  }
  usage_24h: { generations: number }
}
type Answers = {
  activity_details: string
  services_details: string
  clients: string
  preferred_contact: string
  next_action: string
  extra_context: string
}

type ApplySelection = {
  identity: boolean
  bio: boolean
  services_section: boolean
  services: boolean
}

const EMPTY_ANSWERS: Answers = {
  activity_details: '',
  services_details: '',
  clients: '',
  preferred_contact: '',
  next_action: '',
  extra_context: '',
}

function categoryExamples(category: string) {
  const c = category.toLowerCase()
  if (c.includes('inmobili')) return {
    activity: 'Ej. Ayudo a comprar, vender y alquilar apartamentos y casas en Santo Domingo.',
    services: 'Ej. Venta, alquiler, búsqueda de propiedades y asesoría para inversión.',
    clients: 'Ej. Familias, inversionistas y personas que viven fuera del país.',
    action: 'Ej. Que me escriban por WhatsApp para coordinar una visita.',
  }
  if (c.includes('gastr') || c.includes('alimento') || c.includes('restaur')) return {
    activity: 'Ej. Preparo comida por encargo y también atiendo eventos pequeños.',
    services: 'Ej. Menú diario, catering, postres y pedidos personalizados.',
    clients: 'Ej. Familias, oficinas y personas que organizan eventos.',
    action: 'Ej. Que pidan el menú o hagan un pedido por WhatsApp.',
  }
  if (c.includes('belleza') || c.includes('estética')) return {
    activity: 'Ej. Hago uñas, maquillaje y peinados para eventos y clientes regulares.',
    services: 'Ej. Manicure, maquillaje social, peinados y citas a domicilio.',
    clients: 'Ej. Mujeres que buscan atención por cita y servicios para eventos.',
    action: 'Ej. Que reserven una cita conmigo.',
  }
  if (c.includes('automotriz') || c.includes('mecánica')) return {
    activity: 'Ej. Diagnostico y reparo vehículos, hago mantenimiento y trabajos eléctricos.',
    services: 'Ej. Diagnóstico, mantenimiento, frenos y electricidad automotriz.',
    clients: 'Ej. Dueños de vehículos particulares y pequeñas flotillas.',
    action: 'Ej. Que me escriban para cotizar o coordinar una revisión.',
  }
  if (c.includes('mantenimiento') || c.includes('instalaciones') || c.includes('construcción')) return {
    activity: 'Ej. Soy electricista: instalo abanicos, lámparas e inversores, arreglo cortos y hago instalaciones nuevas.',
    services: 'Ej. Instalaciones eléctricas, reparación de averías, inversores y luminarias.',
    clients: 'Ej. Hogares, apartamentos, oficinas y pequeños negocios.',
    action: 'Ej. Que me escriban por WhatsApp para pedir una cotización.',
  }
  if (c.includes('salud') || c.includes('bienestar')) return {
    activity: 'Ej. Atiendo pacientes por cita y ofrezco orientación personalizada según sus necesidades.',
    services: 'Ej. Consultas, evaluaciones y seguimiento.',
    clients: 'Ej. Adultos que buscan atención profesional por cita.',
    action: 'Ej. Que soliciten una cita o me contacten para información.',
  }
  return {
    activity: 'Cuéntalo como se lo explicarías a un cliente, sin preocuparte por escribir perfecto.',
    services: 'Menciona los servicios o trabajos que más te interesa destacar.',
    clients: 'Ej. Personas, familias, negocios, empresas o un tipo de cliente específico.',
    action: 'Ej. Que te escriban, pidan una cotización, reserven, visiten tu negocio o conozcan tus trabajos.',
  }
}

function Question({ label, hint, value, onChange, maxLength = 700, rows = 3 }: {
  label: string
  hint?: string
  value: string
  onChange: (value: string) => void
  maxLength?: number
  rows?: number
}) {
  return (
    <label className="block">
      <span className="text-[15px] font-black text-slate-800">{label}</span>
      {hint && <span className="mt-1 block text-sm font-medium leading-5 text-slate-500">{hint}</span>}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value.slice(0, maxLength))}
        rows={rows}
        maxLength={maxLength}
        className="mt-3 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base leading-6 text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
      />
      <span className="mt-1 block text-right text-[11px] font-bold text-slate-400">{value.length}/{maxLength}</span>
    </label>
  )
}

export default function FreeAiProfileAssistant() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [applying, setApplying] = useState(false)
  const [context, setContext] = useState<AssistantContext | null>(null)
  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS)
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [selection, setSelection] = useState<ApplySelection>({ identity: true, bio: true, services_section: true, services: true })
  const [replaceServices, setReplaceServices] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    apiGet('/me/ai-profile-assistant/context')
      .then((json: any) => {
        if (!json?.ok) throw new Error(json?.error || 'No pudimos cargar la ayuda con IA.')
        const data = json.data as AssistantContext
        setContext(data)
        setSelection((current) => ({ ...current, services: (data.profile.services || []).length === 0 }))
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'No pudimos cargar la ayuda con IA.'))
      .finally(() => setLoading(false))
  }, [])

  const examples = useMemo(() => categoryExamples(context?.profile.category || ''), [context?.profile.category])
  const hasExistingIdentity = Boolean(context?.profile.professional_title && context?.profile.bio)
  const hasExistingServices = Boolean(context?.profile.services?.length)
  const contactOptions = useMemo(() => {
    if (!context) return []
    const values: string[] = []
    if (context.profile.contact.whatsapp) values.push('WhatsApp')
    if (context.profile.contact.phone) values.push('teléfono')
    if (context.profile.contact.email) values.push('correo')
    if (context.profile.contact.address) values.push('visita o ubicación')
    return values
  }, [context])

  const totalAnswerLength = Object.values(answers).reduce((sum, value) => sum + value.trim().length, 0)
  const enoughInformation = totalAnswerLength >= 8 || Boolean(context?.profile.bio || context?.profile.services?.length)

  const updateAnswer = (key: keyof Answers, value: string) => setAnswers((current) => ({ ...current, [key]: value }))

  async function generate() {
    if (generating || !enoughInformation) return
    setGenerating(true)
    setError('')
    setSuccess('')
    try {
      const json: any = await apiPost('/me/ai-profile-assistant/generate', { answers })
      if (!json?.ok) {
        setError(json?.error || 'No pudimos preparar tu propuesta. Tu perfil no fue modificado.')
        return
      }
      setProposal(json.data.proposal as Proposal)
      setReplaceServices(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setError('No pudimos conectar con la IA. Tu perfil sigue sin cambios.')
    } finally {
      setGenerating(false)
    }
  }

  function updateProposal<K extends keyof Proposal>(key: K, value: Proposal[K]) {
    setProposal((current) => current ? { ...current, [key]: value } : current)
  }

  function updateService(index: number, key: 'title' | 'description', value: string) {
    setProposal((current) => {
      if (!current) return current
      const services = current.services.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item)
      return { ...current, services }
    })
  }

  async function applyProposal() {
    if (!proposal || applying) return
    if (!Object.values(selection).some(Boolean)) {
      setError('Selecciona al menos un cambio para aplicar.')
      return
    }
    if (selection.services && hasExistingServices && !replaceServices) {
      setError('Para cambiar tus servicios actuales, confirma primero la casilla de reemplazo.')
      return
    }

    setApplying(true)
    setError('')
    setSuccess('')
    try {
      const json: any = await apiPost('/me/ai-profile-assistant/apply', {
        proposal,
        apply: selection,
        replace_existing_services: replaceServices,
      })
      if (!json?.ok) {
        setError(json?.error || 'No pudimos aplicar los cambios. Tu perfil anterior se mantiene.')
        return
      }
      setSuccess('Tus cambios fueron aplicados al perfil.')
    } catch {
      setError('No pudimos aplicar los cambios. Tu perfil anterior se mantiene.')
    } finally {
      setApplying(false)
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-[#f7f9fc] grid place-items-center font-['Inter']"><div className="loading-spinner" /></main>
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] pb-24 font-['Inter'] text-slate-950">
      <section className="mx-auto w-full max-w-[760px] px-4 py-5 sm:px-5 sm:py-7">
        <div className="mb-5"><FreeBackButton onClick={() => navigate('/admin/free/editor')} /></div>

        <header className="rounded-[28px] border border-cyan-100 bg-gradient-to-br from-white via-white to-cyan-50 p-5 shadow-[0_18px_55px_rgba(15,23,42,0.07)] sm:p-7">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-cyan-600 text-2xl text-white shadow-sm" aria-hidden="true">✦</span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.15em] text-cyan-700">Kawvo · Ayuda con IA</p>
              <h1 className="mt-2 text-[28px] font-black leading-tight tracking-[-0.04em] sm:text-3xl">Te ayudo a presentar mejor lo que haces</h1>
              <p className="mt-2 text-base font-medium leading-7 text-slate-600">Respóndeme como hablas normalmente. Prepararé una propuesta profesional y <strong className="font-black text-slate-800">tú decides qué aplicar</strong> a tu perfil.</p>
            </div>
          </div>
          <div className="mt-5 rounded-2xl bg-white/80 px-4 py-3 text-sm font-semibold leading-6 text-slate-600 ring-1 ring-cyan-100">
            La IA nunca publica ni cambia tu perfil automáticamente. Primero podrás revisar y editar todo.
          </div>
        </header>

        {error && <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold leading-6 text-rose-700">{error}</div>}
        {success && (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
            <p className="font-black">✓ {success}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => navigate('/admin/free/editor')} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white">Volver a mi perfil</button>
              <button type="button" onClick={() => { setSuccess(''); setProposal(null) }} className="rounded-xl bg-white px-4 py-2.5 text-sm font-black text-emerald-700 ring-1 ring-emerald-200">Crear otra propuesta</button>
            </div>
          </div>
        )}

        {!proposal && context && (
          <>
            <section className="mt-5 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Ya sé de tu perfil</p>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                {context.profile.category && <div className="rounded-xl bg-slate-50 px-3 py-2.5"><span className="font-bold text-slate-500">Actividad:</span> <span className="font-black text-slate-800">{context.profile.category}</span></div>}
                {context.profile.professional_title && <div className="rounded-xl bg-slate-50 px-3 py-2.5"><span className="font-bold text-slate-500">Actualmente:</span> <span className="font-black text-slate-800">{context.profile.professional_title}</span></div>}
                {hasExistingServices && <div className="rounded-xl bg-slate-50 px-3 py-2.5"><span className="font-bold text-slate-500">Servicios:</span> <span className="font-black text-slate-800">{context.profile.services.length} guardados</span></div>}
                {contactOptions.length > 0 && <div className="rounded-xl bg-slate-50 px-3 py-2.5"><span className="font-bold text-slate-500">Contacto:</span> <span className="font-black text-slate-800">{contactOptions.join(', ')}</span></div>}
              </div>
              <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">No te preguntaré de nuevo lo que ya está claro en Kawvo. Solo necesito lo que falta para entender mejor cómo quieres presentarte.</p>
            </section>

            <section className="mt-5 space-y-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,0.06)] sm:p-6">
              {!hasExistingIdentity && (
                <Question
                  label="¿Qué haces exactamente?"
                  hint={examples.activity}
                  value={answers.activity_details}
                  onChange={(value) => updateAnswer('activity_details', value)}
                />
              )}

              {!hasExistingServices && (
                <Question
                  label="¿Qué servicios ofreces?"
                  hint={examples.services}
                  value={answers.services_details}
                  onChange={(value) => updateAnswer('services_details', value)}
                />
              )}

              <Question
                label="¿A qué tipo de clientes atiendes?"
                hint={examples.clients}
                value={answers.clients}
                onChange={(value) => updateAnswer('clients', value)}
              />

              {contactOptions.length !== 1 && (
                <Question
                  label="¿Cómo prefieres que te contacten?"
                  hint={contactOptions.length ? `Ya tienes ${contactOptions.join(', ')}. Dime cuál prefieres priorizar.` : 'Ej. WhatsApp, llamada, correo o visita.'}
                  value={answers.preferred_contact}
                  onChange={(value) => updateAnswer('preferred_contact', value)}
                  rows={2}
                />
              )}

              <Question
                label="¿Qué quieres que una persona haga después de visitar tu perfil?"
                hint={examples.action}
                value={answers.next_action}
                onChange={(value) => updateAnswer('next_action', value)}
              />

              {hasExistingIdentity && hasExistingServices && (
                <Question
                  label="¿Hay algo que quieras mejorar o destacar más?"
                  hint="Opcional. Por ejemplo: quiero sonar más profesional, destacar que trabajo a domicilio o enfocarme en clientes empresariales."
                  value={answers.extra_context}
                  onChange={(value) => updateAnswer('extra_context', value)}
                />
              )}

              <button
                type="button"
                onClick={() => void generate()}
                disabled={!enoughInformation || generating}
                className="w-full rounded-2xl bg-slate-950 px-5 py-4 text-base font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-35"
              >
                {generating ? 'Preparando tu propuesta…' : '✦ Preparar mi propuesta con IA'}
              </button>
              <p className="text-center text-[11px] font-semibold leading-5 text-slate-400">Puedes escribir informal, con errores o emojis. Kawvo organizará la información sin inventar datos.</p>
            </section>
          </>
        )}

        {proposal && context && (
          <section className="mt-5 space-y-5">
            <div className="rounded-[24px] border border-cyan-200 bg-cyan-50 p-4">
              <p className="font-black text-cyan-900">Propuesta lista para revisar</p>
              <p className="mt-1 text-sm font-semibold leading-6 text-cyan-800">Puedes editar cualquier texto aquí. Nada se aplicará hasta que pulses <strong>Aplicar a mi perfil</strong>.</p>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div><p className="text-xs font-black uppercase tracking-[0.12em] text-cyan-700">Identidad</p><h2 className="mt-1 text-xl font-black">Cómo te presentas</h2></div>
                <label className="flex items-center gap-2 text-xs font-black text-slate-600"><input type="checkbox" checked={selection.identity} onChange={(e) => setSelection((s) => ({ ...s, identity: e.target.checked }))} className="h-4 w-4 accent-cyan-600" /> Aplicar</label>
              </div>
              <input value={proposal.professional_title} onChange={(e) => updateProposal('professional_title', e.target.value.slice(0, 80))} maxLength={80} className="mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-black outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" />
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div><p className="text-xs font-black uppercase tracking-[0.12em] text-cyan-700">Descripción</p><h2 className="mt-1 text-xl font-black">Sobre ti o tu negocio</h2></div>
                <label className="flex items-center gap-2 text-xs font-black text-slate-600"><input type="checkbox" checked={selection.bio} onChange={(e) => setSelection((s) => ({ ...s, bio: e.target.checked }))} className="h-4 w-4 accent-cyan-600" /> Aplicar</label>
              </div>
              <textarea value={proposal.bio} onChange={(e) => updateProposal('bio', e.target.value.slice(0, 300))} maxLength={300} rows={5} className="mt-4 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base leading-6 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" />
              <p className="mt-1 text-right text-[11px] font-bold text-slate-400">{proposal.bio.length}/300</p>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div><p className="text-xs font-black uppercase tracking-[0.12em] text-cyan-700">Servicios</p><h2 className="mt-1 text-xl font-black">Lo que ofreces</h2></div>
                <div className="flex flex-col items-end gap-2">
                  <label className="flex items-center gap-2 text-xs font-black text-slate-600"><input type="checkbox" checked={selection.services_section} onChange={(e) => setSelection((s) => ({ ...s, services_section: e.target.checked }))} className="h-4 w-4 accent-cyan-600" /> Presentación</label>
                  <label className="flex items-center gap-2 text-xs font-black text-slate-600"><input type="checkbox" checked={selection.services} onChange={(e) => setSelection((s) => ({ ...s, services: e.target.checked }))} className="h-4 w-4 accent-cyan-600" /> Servicios</label>
                </div>
              </div>

              <input value={proposal.services_section_title} onChange={(e) => updateProposal('services_section_title', e.target.value.slice(0, 60))} maxLength={60} className="mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black outline-none focus:border-cyan-400" />
              <textarea value={proposal.services_section_description} onChange={(e) => updateProposal('services_section_description', e.target.value.slice(0, 240))} maxLength={240} rows={3} className="mt-3 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 outline-none focus:border-cyan-400" />

              <div className="mt-4 space-y-3">
                {proposal.services.map((service, index) => (
                  <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-400">Servicio {index + 1}</p>
                    <input value={service.title} onChange={(e) => updateService(index, 'title', e.target.value.slice(0, 60))} maxLength={60} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-black outline-none focus:border-cyan-400" />
                    <textarea value={service.description} onChange={(e) => updateService(index, 'description', e.target.value.slice(0, 90))} maxLength={90} rows={2} className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm leading-5 outline-none focus:border-cyan-400" />
                  </div>
                ))}
              </div>

              {hasExistingServices && selection.services && (
                <label className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-5 text-amber-900">
                  <input type="checkbox" checked={replaceServices} onChange={(e) => setReplaceServices(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-amber-700" />
                  <span>Entiendo que aplicar estos servicios reemplazará los {context.profile.services.length} servicios que tengo ahora. Mis demás datos del perfil no se modificarán.</span>
                </label>
              )}
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Sugerencia de acción</p>
              <p className="mt-2 text-lg font-black text-slate-900">“{proposal.cta.label}”</p>
              <p className="mt-1 text-sm font-medium leading-6 text-slate-500">La IA te recomienda esta acción, pero Kawvo conserva el botón real según los canales de contacto que ya tienes configurados. No cambiará tu WhatsApp, teléfono ni correo.</p>
            </div>

            <div className="sticky bottom-3 z-30 rounded-[24px] border border-slate-200 bg-white/95 p-3 shadow-[0_18px_55px_rgba(15,23,42,0.16)] backdrop-blur">
              <button type="button" onClick={() => void applyProposal()} disabled={applying || (selection.services && hasExistingServices && !replaceServices)} className="w-full rounded-2xl bg-cyan-700 px-5 py-4 text-base font-black text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-40">{applying ? 'Aplicando cambios…' : 'Aplicar a mi perfil'}</button>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setProposal(null)} disabled={applying} className="rounded-xl bg-slate-100 px-3 py-2.5 text-xs font-black text-slate-700">Volver a preguntas</button>
                <button type="button" onClick={() => void generate()} disabled={applying || generating} className="rounded-xl bg-slate-100 px-3 py-2.5 text-xs font-black text-slate-700">{generating ? 'Generando…' : 'Generar otra'}</button>
              </div>
            </div>
          </section>
        )}
      </section>
    </main>
  )
}
