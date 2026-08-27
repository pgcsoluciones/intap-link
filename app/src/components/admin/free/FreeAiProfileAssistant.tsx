import { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPost } from '../../../lib/api'
import { FreeBackButton, basicPlanWhatsAppUrl } from './FreePanelUi'
import { useNavigate } from 'react-router-dom'

type Service = { id?: string; title: string; description: string; has_image?: boolean }
type PortfolioItem = { id: string; title: string; description: string }
type EditingScope = 'missing_only' | 'full_profile'
type ImageSuggestion = { purpose: string; suggestion: string }
type Proposal = {
  professional_title: string
  bio: string
  services_section_title: string
  services_section_description: string
  services: Array<{ title: string; description: string }>
  portfolio: PortfolioItem[]
  cta: { label: string; goal: string }
  image_suggestions: ImageSuggestion[]
}
type Limits = { max_services: number; max_portfolio: number; ai_daily_generations: number; ai_monthly_generations: number; ai_max_rounds: number }
type AssistantContext = {
  beta: boolean
  consent: { required: boolean; accepted: boolean; terms_version: string }
  profile: {
    slug: string
    name: string
    category: string
    professional_title: string
    bio: string
    services_section_title?: string
    services_section_description?: string
    services: Service[]
    portfolio: PortfolioItem[]
    contact: { whatsapp?: string; email?: string; phone?: string; address?: string }
    configured_channels: string[]
  }
  plan: { code: string; limits: Limits; upgrade_available: boolean }
  usage: { daily: number; monthly: number; remaining_today: number; remaining_month: number }
}
type Answers = {
  activity_details: string
  services_details: string
  clients: string
  preferred_contact: string
  next_action: string
  extra_context: string
}
type ApplySelection = { identity: boolean; bio: boolean; services_section: boolean; services: boolean; portfolio: boolean }
type FollowUp = { question: string; answer: string }
type ConversationTurn = { role: 'user' | 'assistant'; content: string }

const EMPTY_ANSWERS: Answers = { activity_details: '', services_details: '', clients: '', preferred_contact: '', next_action: '', extra_context: '' }

const TERMS_POINTS = [
  'Debes revisar y verificar cualquier contenido antes de aplicarlo o publicarlo.',
  'La inteligencia artificial puede cometer errores, omitir información o interpretar datos incorrectamente.',
  'Eres responsable del contenido final que decidas utilizar.',
  'No debes usar el Asistente IA con fines ilegales, fraudulentos, abusivos ni para intentar evadir sus límites.',
  'Kawvo puede limitar, suspender o retirar el acceso por abuso, uso excesivo, seguridad o necesidades operativas.',
  'La función está en Beta y puede cambiar, interrumpirse o modificarse.',
  'Puede ofrecerse gratuitamente ahora sin garantizar que permanezca gratuita; en el futuro puede formar parte total o parcialmente de planes de pago.',
  'El uso está sujeto a los Términos y Condiciones generales de Kawvo y a estas condiciones específicas.',
  'Las limitaciones de responsabilidad aplican en la medida permitida por la legislación aplicable.',
]

function categoryExamples(category: string) {
  const c = category.toLowerCase()
  if (c.includes('inmobili')) return { activity: 'Ej. Ayudo a comprar, vender y alquilar propiedades.', clients: 'Ej. Familias, inversionistas o propietarios.', action: 'Ej. Que me escriban para coordinar una visita.' }
  if (c.includes('automotriz') || c.includes('mecán')) return { activity: 'Ej. Diagnostico y reparo vehículos y hago mantenimiento.', clients: 'Ej. Dueños de vehículos y pequeñas flotillas.', action: 'Ej. Que me contacten para cotizar una revisión.' }
  if (c.includes('constru') || c.includes('electric') || c.includes('mantenimiento')) return { activity: 'Ej. Instalo lámparas, abanicos, inversores y hago instalaciones nuevas.', clients: 'Ej. Hogares, oficinas y pequeños negocios.', action: 'Ej. Que me escriban para una cotización.' }
  return { activity: 'Cuéntalo como se lo explicarías a un cliente.', clients: 'Ej. Personas, familias, negocios o un tipo de cliente específico.', action: 'Ej. Que te escriban, coticen, reserven, visiten o conozcan tus trabajos.' }
}

function channelLabel(channel: string) {
  return ({ whatsapp: 'WhatsApp', phone: 'Llamada', email: 'Correo', visit: 'Visita / ubicación' } as Record<string,string>)[channel] || channel
}

function Question({ label, hint, value, onChange, rows = 3 }: { label: string; hint?: string; value: string; onChange: (v:string)=>void; rows?: number }) {
  return <label className="block">
    <span className="text-[15px] font-black text-slate-800">{label}</span>
    {hint && <span className="mt-1 block text-sm font-medium leading-5 text-slate-500">{hint}</span>}
    <textarea value={value} onChange={(e)=>onChange(e.target.value.slice(0,700))} maxLength={700} rows={rows} className="mt-3 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base leading-6 outline-none focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100" />
    <span className="mt-1 block text-right text-[11px] font-bold text-slate-400">{value.length}/700</span>
  </label>
}

export default function FreeAiProfileAssistant() {
  const navigate = useNavigate()
  const [loading,setLoading] = useState(true)
  const [context,setContext] = useState<AssistantContext|null>(null)
  const [answers,setAnswers] = useState<Answers>(EMPTY_ANSWERS)
  const [proposal,setProposal] = useState<Proposal|null>(null)
  const [suggestedProposal,setSuggestedProposal] = useState<Proposal|null>(null)
  const [followUp,setFollowUp] = useState<FollowUp[]>([])
  const [conversation,setConversation] = useState<ConversationTurn[]>([])
  const [round,setRound] = useState(1)
  const [generating,setGenerating] = useState(false)
  const [applying,setApplying] = useState(false)
  const [accepting,setAccepting] = useState(false)
  const [termsChecked,setTermsChecked] = useState(false)
  const [showFullTerms,setShowFullTerms] = useState(false)
  const [selection,setSelection] = useState<ApplySelection>({ identity:true,bio:true,services_section:true,services:true,portfolio:true })
  const [editingScope,setEditingScope] = useState<EditingScope>('missing_only')
  const [cooldownSeconds,setCooldownSeconds] = useState(0)
  const [replaceServices,setReplaceServices] = useState(false)
  const [error,setError] = useState('')
  const [success,setSuccess] = useState('')
  const [portfolioTitles,setPortfolioTitles] = useState<Record<string,string>>({})
  const [remainingProfileItems,setRemainingProfileItems] = useState<string[]>([])

  async function loadContext() {
    const json:any = await apiGet('/me/ai-profile-assistant/context')
    if (!json?.ok) throw new Error(json?.error || 'No pudimos cargar la ayuda con IA.')
    const data = json.data as AssistantContext
    setContext(data)
    setPortfolioTitles((current)=>{
      const next: Record<string,string> = {}
      for (const item of data.profile.portfolio || []) {
        next[item.id] = current[item.id] || item.title || ''
      }
      return next
    })
  }
  useEffect(()=>{ loadContext().catch((e)=>setError(e?.message || 'No pudimos cargar la ayuda con IA.')).finally(()=>setLoading(false)) },[])

  const examples = useMemo(()=>categoryExamples(context?.profile.category || ''),[context?.profile.category])
  const hasExistingIdentity = Boolean(context?.profile.professional_title && context?.profile.bio)
  const hasExistingServices = Boolean(context?.profile.services?.length)
  const hasExistingPortfolio = Boolean(context?.profile.portfolio?.length)
  const hasExistingContent = Boolean(context?.profile.professional_title || context?.profile.bio || context?.profile.services?.length || context?.profile.portfolio?.some((x)=>x.title || x.description))
  const missingTitle = Boolean(context && !context.profile.professional_title.trim())
  const missingBio = Boolean(context && !context.profile.bio.trim())
  const missingServices = Boolean(context && context.profile.services.length === 0)
  const missingServicesSectionTitle = Boolean(context && !(context.profile.services_section_title || '').trim())
  const missingServicesSectionDescription = Boolean(context && !(context.profile.services_section_description || '').trim())
  const missingServicesSectionCopy = missingServicesSectionTitle || missingServicesSectionDescription
  const incompletePortfolio = context?.profile.portfolio?.filter((item)=>!item.title.trim() || !item.description.trim()) || []
  const missingPortfolioTitleItems = context?.profile.portfolio?.filter((item)=>!item.title.trim()) || []
  const missingPortfolioCopy = incompletePortfolio.length > 0
  const hasMissingEditorialContent = missingTitle || missingBio || missingServices || missingServicesSectionCopy || missingPortfolioCopy
  const channels = context?.profile.configured_channels || []
  const totalAnswerLength = Object.values(answers).reduce((s,v)=>s+v.trim().length,0)
  const missingOnlyAnswerLength = [
    missingTitle ? answers.activity_details : '',
    missingBio ? answers.clients : '',
    (missingServices || missingServicesSectionCopy) ? answers.services_details : '',
    missingPortfolioCopy ? answers.extra_context : '',
  ].reduce((sum,value)=>sum+value.trim().length,0)
  const enoughInformation = hasExistingContent || totalAnswerLength >= 4
  const atServiceLimit = Boolean(context && context.profile.services.length >= context.plan.limits.max_services)

  function chooseEditingScope(next: EditingScope) {
    if (next === editingScope) return
    setEditingScope(next)
    setAnswers(EMPTY_ANSWERS)
    setFollowUp([])
    setConversation([])
    setProposal(null)
    setSuggestedProposal(null)
    setRound(1)
    setReplaceServices(false)
    setError('')
    setSuccess('')
    setRemainingProfileItems([])
  }

  useEffect(()=>{
    if (!context) return
    if (editingScope === 'full_profile') {
      setSelection({ identity:true,bio:true,services_section:true,services:true,portfolio:context.profile.portfolio.length>0 })
    } else {
      setSelection({
        identity:!context.profile.professional_title,
        bio:!context.profile.bio,
        services_section:!(context.profile.services_section_title && context.profile.services_section_description),
        services:context.profile.services.length===0,
        portfolio:context.profile.portfolio.some((item)=>!item.title || !item.description),
      })
    }
  },[editingScope,context])

  useEffect(()=>{
    if (cooldownSeconds <= 0) return
    const timer = window.setInterval(()=>setCooldownSeconds((value)=>Math.max(0,value-1)),1000)
    return ()=>window.clearInterval(timer)
  },[cooldownSeconds])

  async function acceptTerms() {
    if (!termsChecked || accepting) return
    setAccepting(true); setError('')
    try {
      const json:any = await apiPost('/me/ai-profile-assistant/terms/accept',{ accepted:true, locale:'es-DO' })
      if (!json?.ok) throw new Error(json?.error || 'No pudimos registrar tu aceptación.')
      await loadContext()
    } catch (e:any) { setError(e?.message || 'No pudimos registrar tu aceptación.') } finally { setAccepting(false) }
  }

  async function generate(nextRound = round) {
    if (generating || !context) return
    setGenerating(true); setError(''); setSuccess(''); setRemainingProfileItems([])
    try {
      const answeredTurns: ConversationTurn[] = followUp.flatMap((item)=>item.answer.trim() ? [{ role:'assistant' as const, content:item.question }, { role:'user' as const, content:item.answer.trim() }] : [])
      const conversationPayload = [...conversation, ...answeredTurns]
      const confirmedPortfolioTitles = missingPortfolioTitleItems
        .map((item,index)=>({ index:context.profile.portfolio.findIndex((x)=>x.id===item.id)+1, id:item.id, title:(portfolioTitles[item.id] || '').trim().slice(0,80) }))
        .filter((item)=>item.title)
      const portfolioContext = confirmedPortfolioTitles.length
        ? `Títulos de portafolio confirmados por el usuario: ${confirmedPortfolioTitles.map((item)=>`Foto ${item.index}: ${item.title}`).join(' | ')}`
        : ''
      const answersForModel = {
        ...answers,
        extra_context: [answers.extra_context.trim(), portfolioContext].filter(Boolean).join(' ').slice(0,700),
      }
      const json:any = await apiPost('/me/ai-profile-assistant/generate',{ answers:answersForModel, follow_up_answers:followUp, conversation:conversationPayload, round:nextRound, editing_scope:editingScope })
      if (!json?.ok) {
        if (json?.code === 'cooldown') { setCooldownSeconds(Number(json.retry_after_seconds || 20)); setError(''); return }
        setError(json?.error || 'No pudimos preparar tu propuesta. Tu perfil no fue modificado.'); return
      }
      if (json.data?.status === 'needs_more_info') {
        const questions = (json.data.questions || []).slice(0,3)
        setConversation(conversationPayload)
        setFollowUp(questions.map((q:string)=>({ question:q, answer:'' })))
        setRound(Math.min(nextRound + 1, context.plan.limits.ai_max_rounds))

        setProposal(null)
        window.scrollTo({ top:0, behavior:'smooth' })
        return
      }
      if (json.data?.status === 'ready' && json.data.proposal) {
        setConversation(conversationPayload)
        setProposal(json.data.proposal as Proposal)
        setSuggestedProposal(json.data.proposal as Proposal)
        setFollowUp([])
        setReplaceServices(false)
        window.scrollTo({ top:0, behavior:'smooth' })
      }
    } catch { setError('No pudimos conectar con la IA. Tu perfil sigue sin cambios.') } finally { setGenerating(false) }
  }

  function updateProposal<K extends keyof Proposal>(key:K,value:Proposal[K]) { setProposal((p)=>p ? { ...p,[key]:value }:p) }
  function updateService(index:number,key:'title'|'description',value:string) { setProposal((p)=>p ? { ...p,services:p.services.map((s,i)=>i===index?{...s,[key]:value}:s) }:p) }
  function updatePortfolio(index:number,key:'title'|'description',value:string) { setProposal((p)=>p ? { ...p,portfolio:p.portfolio.map((item,i)=>i===index?{...item,[key]:value}:item) }:p) }

  async function loadRemainingProfileItems() {
    try {
      const [meJson, linksJson, bankJson, contactJson]: any[] = await Promise.all([
        apiGet('/me').catch(()=>({ ok:false })),
        apiGet('/me/links').catch(()=>({ ok:false })),
        apiGet('/me/bank-accounts').catch(()=>({ ok:false })),
        apiGet('/me/contact').catch(()=>({ ok:false })),
      ])

      const pending: string[] = []
      const steps = meJson?.data?.freeReadiness?.steps || {}

      if (!steps.quick_actions) pending.push('Botones rápidos')

      const place = String(
        contactJson?.data?.place_name ||
        contactJson?.data?.address ||
        ''
      ).trim()
      if (!place) pending.push('Ubicación')

      const links = Array.isArray(linksJson?.data) ? linksJson.data : []
      if (links.length === 0) pending.push('Enlaces')

      const banks = Array.isArray(bankJson?.data?.items) ? bankJson.data.items : []
      if (banks.length === 0) pending.push('Cuentas bancarias')

      setRemainingProfileItems(pending)
    } catch {
      setRemainingProfileItems([])
    }
  }

  async function applyProposal() {
    if (!proposal || applying) return
    if (!Object.values(selection).some(Boolean)) { setError('Selecciona al menos un cambio para aplicar.'); return }
    if (selection.services && hasExistingServices && !replaceServices) { setError('Confirma que deseas actualizar el texto de tus servicios actuales.'); return }
    setApplying(true); setError(''); setSuccess('')
    try {
      const json:any = await apiPost('/me/ai-profile-assistant/apply',{ proposal,apply:selection,replace_existing_services:replaceServices,editing_scope:editingScope })
      if (!json?.ok) { setError(json?.error || 'No pudimos aplicar los cambios. Tu perfil anterior se mantiene.'); return }
      setSuccess('Cambios aplicados correctamente')
      await Promise.all([loadContext(), loadRemainingProfileItems()])
    } catch { setError('No pudimos aplicar los cambios. Tu perfil anterior se mantiene.') } finally { setApplying(false) }
  }

  if (loading) return <main className="min-h-screen bg-[#f7f9fc] grid place-items-center"><div className="loading-spinner" /></main>

  if (context?.consent.required) return <main className="min-h-screen bg-[#f7f9fc] px-4 py-6 font-['Inter'] text-slate-950">
    <section className="mx-auto max-w-[620px]">
      <FreeBackButton onClick={()=>navigate('/admin/free/editor')} />
      <div className="rounded-[28px] border border-cyan-100 bg-white p-5 shadow-sm sm:p-7">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-700">Asistente IA de Kawvo · Beta</p>
        <h1 className="mt-2 text-2xl font-black tracking-[-0.03em]">Antes de comenzar</h1>
        <p className="mt-3 text-sm font-medium leading-6 text-slate-600">El Asistente IA puede ayudarte a redactar y mejorar tu Perfil Digital usando la información que proporciones y los datos disponibles en tu perfil. La IA puede equivocarse, por eso siempre revisarás la propuesta antes de aplicar o publicar.</p>
        <div className="mt-5 rounded-2xl bg-slate-50 p-4">
          <ul className="space-y-2 text-sm font-medium leading-5 text-slate-700">{TERMS_POINTS.slice(0,showFullTerms?TERMS_POINTS.length:5).map((p)=><li key={p} className="flex gap-2"><span>•</span><span>{p}</span></li>)}</ul>
          <button type="button" onClick={()=>setShowFullTerms((v)=>!v)} className="mt-3 text-sm font-black text-cyan-700 underline">{showFullTerms?'Ver menos':'Leer condiciones completas'}</button>
        </div>
        <label className="mt-5 flex items-start gap-3 rounded-2xl border border-slate-200 p-4 text-sm font-bold leading-5 text-slate-700">
          <input type="checkbox" checked={termsChecked} onChange={(e)=>setTermsChecked(e.target.checked)} className="mt-0.5 h-5 w-5 accent-cyan-700" />
          <span>He leído y acepto las condiciones de uso del Asistente IA.</span>
        </label>
        {error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={()=>void acceptTerms()} disabled={!termsChecked || accepting} className="rounded-2xl bg-cyan-700 px-4 py-3.5 font-black text-white disabled:opacity-40">{accepting?'Guardando…':'Aceptar y continuar'}</button>
          <button type="button" onClick={()=>navigate('/admin/free/editor')} className="rounded-2xl bg-slate-100 px-4 py-3.5 font-black text-slate-700">Ahora no</button>
        </div>
        <p className="mt-4 text-center text-[11px] font-semibold text-slate-400">Versión {context.consent.terms_version}</p>
      </div>
    </section>
  </main>

  return <main className="min-h-screen bg-[#f7f9fc] pb-24 font-['Inter'] text-slate-950">
    <section className="mx-auto w-full max-w-[760px] px-4 py-5 sm:px-5 sm:py-7">
      <FreeBackButton onClick={()=>navigate('/admin/free/editor')} />
      <header className="rounded-[28px] border border-cyan-100 bg-gradient-to-br from-white to-cyan-50 p-5 shadow-sm sm:p-7">
        <p className="text-xs font-black uppercase tracking-[0.15em] text-cyan-700">Kawvo · Asistente IA · Beta</p>
        <h1 className="mt-2 text-[28px] font-black leading-tight tracking-[-0.04em]">Haz que tu perfil te presente mejor</h1>
        <p className="mt-2 text-base font-medium leading-7 text-slate-600">Kawvo usa lo que ya sabe de tu perfil y solo te pide lo necesario. <strong className="text-slate-800">Tú revisas y decides qué aplicar.</strong></p>
        <div className="mt-4 rounded-2xl bg-white/80 px-4 py-3 text-sm font-semibold leading-6 text-slate-600 ring-1 ring-cyan-100">La IA no publica, no cambia tu diseño, plantilla, colores, botones ni orden de secciones.</div>
      </header>

      {error && <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold leading-6 text-rose-700">{error}</div>}
      {cooldownSeconds>0 && <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-800">Puedes generar otra propuesta en {cooldownSeconds} s.</div>}
      {context && <section className="mt-5 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3"><p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Contexto que Kawvo ya conoce</p><span className="rounded-full bg-cyan-50 px-3 py-1 text-[11px] font-black text-cyan-700">Plan {context.plan.code}</span></div>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          {context.profile.category && <div className="rounded-xl bg-slate-50 px-3 py-2.5"><b>Actividad:</b> {context.profile.category}</div>}
          {context.profile.professional_title && <div className="rounded-xl bg-slate-50 px-3 py-2.5"><b>Actualmente:</b> {context.profile.professional_title}</div>}
          <div className="rounded-xl bg-slate-50 px-3 py-2.5"><b>Servicios:</b> {context.profile.services.length}/{context.plan.limits.max_services}</div>
          {channels.length>0 && <div className="rounded-xl bg-slate-50 px-3 py-2.5"><b>Canales:</b> {channels.map(channelLabel).join(', ')}</div>}
        </div>
        <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">Disponibilidad IA hoy: {context.usage.remaining_today} · este mes: {context.usage.remaining_month}</p>
        {atServiceLimit && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">Tu Plan Gratis permite hasta {context.plan.limits.max_services} servicios. La IA puede ayudarte a elegir y redactar los más importantes. {context.plan.upgrade_available && <a href={basicPlanWhatsAppUrl()} target="_blank" rel="noreferrer" className="ml-1 font-black underline">Solicitar Plan Básico</a>}</div>}
      </section>}

      {hasExistingContent && !proposal && followUp.length===0 && context && <section className="mt-5 rounded-[24px] border border-cyan-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-cyan-700">Contenido existente</p>
        <h2 className="mt-1 text-xl font-black">¿Cómo quieres que te ayude la IA?</h2>
        <div className="mt-4 grid gap-3">
          <button type="button" onClick={()=>chooseEditingScope('missing_only')} className={`rounded-2xl border p-4 text-left ${editingScope==='missing_only'?'border-cyan-500 bg-cyan-50':'border-slate-200 bg-white'}`}><p className="font-black">Completar solo lo que falta · Recomendado</p><p className="mt-1 text-sm font-medium leading-5 text-slate-600">Conserva intactos los campos que ya completaste. La IA los usa como contexto y trabaja solo sobre lo pendiente.</p></button>
          <button type="button" onClick={()=>chooseEditingScope('full_profile')} className={`rounded-2xl border p-4 text-left ${editingScope==='full_profile'?'border-cyan-500 bg-cyan-50':'border-slate-200 bg-white'}`}><p className="font-black">Revisar y mejorar mi contenido</p><p className="mt-1 text-sm font-medium leading-5 text-slate-600">Puede proponerte mejoras de texto en título, presentación, trabajos y servicios. Tú revisas todo antes de aplicar.</p></button>
        </div>
        <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">Nunca modifica imágenes, enlaces, cuentas bancarias, diseño, plantilla, colores ni orden.</p>
      </section>}

      {!proposal && followUp.length===0 && context && <section className="mt-5 space-y-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="rounded-2xl bg-slate-50 px-4 py-3">
          <p className="text-sm font-black text-slate-800">{editingScope==='missing_only'?'Voy a preguntarte solo por lo que falta.':'Voy a revisar tu perfil completo para entender qué conviene mejorar.'}</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">Las preguntas cambian según lo que ya tienes y la opción que elegiste.</p>
        </div>

        {editingScope==='missing_only' && !hasMissingEditorialContent ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p className="font-black text-emerald-800">No encontré campos de texto pendientes.</p><p className="mt-1 text-sm font-semibold leading-6 text-emerald-700">Si quieres que Kawvo proponga mejoras sobre lo que ya tienes, selecciona “Revisar y mejorar mi contenido”.</p></div> : <>
          {missingPortfolioTitleItems.length>0 && <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-violet-700">Ayuda a Kawvo a identificar tus fotos</p>
            <h3 className="mt-1 text-base font-black text-slate-900">Ponle un título breve a cada trabajo</h3>
            <p className="mt-1 text-sm font-medium leading-6 text-slate-600">Kawvo no adivina lo que aparece en tus imágenes. Tú indicas qué muestra cada foto y la IA puede pulir el título y redactar una descripción corta a partir de ese dato y del contexto de tu perfil.</p>
            <div className="mt-4 space-y-3">
              {missingPortfolioTitleItems.map((item)=>{
                const position=context.profile.portfolio.findIndex((x)=>x.id===item.id)+1
                const value=portfolioTitles[item.id] || ''
                return <label key={item.id} className="block rounded-xl bg-white p-3">
                  <span className="text-sm font-black text-slate-800">Foto {position} · ¿Qué trabajo muestra?</span>
                  <input value={value} onChange={(e)=>setPortfolioTitles((current)=>({...current,[item.id]:e.target.value.slice(0,80)}))} maxLength={80} placeholder="Ej. Identidad corporativa" className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 font-semibold outline-none focus:border-violet-400" />
                  <span className="mt-1 block text-right text-[11px] font-bold text-slate-400">{value.length}/80</span>
                </label>
              })}
            </div>
          </div>}
          <Question label="¿Hay algo que quieras contarle a Kawvo antes de trabajar tu perfil?" hint="Opcional. Puedes escribirlo como se lo explicarías a una persona. No tienes que definir tu propuesta de valor ni saber de marketing: Kawvo hará ese análisis usando tu perfil y su conocimiento general." value={answers.extra_context} onChange={(v)=>setAnswers((a)=>({...a,extra_context:v}))} rows={4} />
          <div className="rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4 text-sm font-semibold leading-6 text-cyan-900">Kawvo ya conoce el contenido de tu perfil. Si tiene suficiente información, preparará la propuesta directamente. Si falta un hecho importante, te preguntará solo lo mínimo necesario.</div>
        </>}

        {hasMissingEditorialContent || editingScope==='full_profile' ? <button type="button" onClick={()=>void generate(1)} disabled={!enoughInformation || generating || cooldownSeconds>0 || missingPortfolioTitleItems.some((item)=>!(portfolioTitles[item.id] || '').trim())} className="w-full rounded-2xl bg-slate-950 px-5 py-4 text-base font-black text-white disabled:opacity-35">{generating?'Analizando tu perfil…':cooldownSeconds>0?`Disponible en ${cooldownSeconds} s`:answers.extra_context.trim()?'✦ Preparar mi propuesta':'✦ Mejorar con lo que ya sabes'}</button> : null}
        <p className="text-center text-[11px] font-semibold leading-5 text-slate-400">La IA usa el perfil completo como contexto, interpreta tus respuestas y solo pregunta cuando realmente necesita confirmar un hecho.</p>
      </section>}

      {!proposal && followUp.length>0 && context && <section className="mt-5 rounded-[28px] border border-cyan-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-cyan-700">Kawvo necesita confirmar algo</p><h2 className="mt-2 text-xl font-black">Una aclaración antes de preparar tu propuesta</h2><p className="mt-2 text-sm font-medium leading-6 text-slate-600">La IA ya revisó tu perfil. Responde solo este dato y continuará con todo el contexto anterior.</p>
        <div className="mt-5 space-y-5">{followUp.map((item,index)=>{
          const isChannelQuestion = /contact/i.test(item.question) && channels.length>1
          return <div key={item.question}>{isChannelQuestion ? <><p className="text-[15px] font-black text-slate-800">{item.question}</p><div className="mt-3 flex flex-wrap gap-2">{channels.map((ch)=><button key={ch} type="button" onClick={()=>{
            setAnswers((a)=>({...a,preferred_contact:ch}))
            setFollowUp((items)=>items.map((x,i)=>i===index?{...x,answer:ch}:x))
          }} className={`rounded-xl px-4 py-2.5 text-sm font-black ${item.answer===ch?'bg-cyan-700 text-white':'bg-slate-100 text-slate-700'}`}>{channelLabel(ch)}</button>)}</div></> : <Question label={item.question} value={item.answer} onChange={(v)=>setFollowUp((items)=>items.map((x,i)=>i===index?{...x,answer:v}:x))} />}</div>})}</div>
        <button type="button" onClick={()=>void generate(round)} disabled={generating || followUp.some((x)=>!x.answer.trim())} className="mt-5 w-full rounded-2xl bg-cyan-700 px-5 py-4 font-black text-white disabled:opacity-35">{generating?'Preparando…':'Continuar con mi propuesta'}</button>
      </section>}

      {proposal && context && <section className="mt-5 space-y-5">
        <div className="rounded-[24px] border border-cyan-200 bg-cyan-50 p-4"><p className="font-black text-cyan-900">Propuesta lista para revisar</p><p className="mt-1 text-sm font-semibold leading-6 text-cyan-800">Revisa la propuesta antes de aplicarla. Tú decides qué contenido utilizar. Nada se aplicará hasta que pulses <strong>Aplicar a mi perfil</strong>.</p></div>
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div><p className="text-xs font-black uppercase tracking-[0.12em] text-cyan-700">Identidad</p><h2 className="mt-1 text-xl font-black">Cómo te presentas</h2></div>
          {editingScope==='full_profile' && context.profile.professional_title ? <div className="mt-4 space-y-3"><div className="rounded-2xl bg-slate-50 p-4"><p className="text-[11px] font-black uppercase text-slate-400">Tu texto actual</p><p className="mt-2 font-bold text-slate-700">{context.profile.professional_title}</p></div><div className="rounded-2xl border border-cyan-200 bg-cyan-50/50 p-4"><p className="text-[11px] font-black uppercase text-cyan-700">Sugerencia de Kawvo</p><input value={proposal.professional_title} onChange={(e)=>updateProposal('professional_title',e.target.value.slice(0,80))} className="mt-2 w-full rounded-xl border border-cyan-200 bg-white px-3 py-3 font-black"/></div><div className="grid grid-cols-2 gap-2"><button type="button" onClick={()=>{updateProposal('professional_title',context.profile.professional_title);setSelection((s)=>({...s,identity:false}))}} className={`rounded-xl px-3 py-3 text-sm font-black ${!selection.identity?'bg-slate-900 text-white':'bg-slate-100 text-slate-700'}`}>Mantener mi texto</button><button type="button" onClick={()=>{if(suggestedProposal)updateProposal('professional_title',suggestedProposal.professional_title);setSelection((s)=>({...s,identity:true}))}} className={`rounded-xl px-3 py-3 text-sm font-black ${selection.identity?'bg-cyan-700 text-white':'bg-cyan-50 text-cyan-800'}`}>Usar texto sugerido</button></div></div> : <input value={editingScope==='missing_only'&&context.profile.professional_title?context.profile.professional_title:proposal.professional_title} disabled={editingScope==='missing_only'&&Boolean(context.profile.professional_title)} onChange={(e)=>updateProposal('professional_title',e.target.value.slice(0,80))} className="mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-black" />}
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-xl font-black">Sobre ti o tu negocio</h2>{editingScope==='full_profile' && context.profile.bio ? <div className="mt-4 space-y-3"><div className="rounded-2xl bg-slate-50 p-4"><p className="text-[11px] font-black uppercase text-slate-400">Tu texto actual</p><p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-6 text-slate-700">{context.profile.bio}</p></div><div className="rounded-2xl border border-cyan-200 bg-cyan-50/50 p-4"><p className="text-[11px] font-black uppercase text-cyan-700">Sugerencia de Kawvo</p><textarea value={proposal.bio} onChange={(e)=>updateProposal('bio',e.target.value.slice(0,300))} maxLength={300} rows={5} className="mt-2 w-full resize-none rounded-xl border border-cyan-200 bg-white px-4 py-3.5 leading-6"/></div><div className="grid grid-cols-2 gap-2"><button type="button" onClick={()=>{updateProposal('bio',context.profile.bio);setSelection((s)=>({...s,bio:false}))}} className={`rounded-xl px-3 py-3 text-sm font-black ${!selection.bio?'bg-slate-900 text-white':'bg-slate-100 text-slate-700'}`}>Mantener mi texto</button><button type="button" onClick={()=>{if(suggestedProposal)updateProposal('bio',suggestedProposal.bio);setSelection((s)=>({...s,bio:true}))}} className={`rounded-xl px-3 py-3 text-sm font-black ${selection.bio?'bg-cyan-700 text-white':'bg-cyan-50 text-cyan-800'}`}>Usar texto sugerido</button></div></div> : <textarea value={editingScope==='missing_only'&&context.profile.bio?context.profile.bio:proposal.bio} disabled={editingScope==='missing_only'&&Boolean(context.profile.bio)} onChange={(e)=>updateProposal('bio',e.target.value.slice(0,300))} maxLength={300} rows={5} className="mt-4 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 leading-6" />}</div>
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex justify-between gap-3"><h2 className="text-xl font-black">Servicios</h2><div className="space-y-2 text-right text-xs font-black"><label className="block"><input type="checkbox" checked={selection.services_section} onChange={(e)=>setSelection((s)=>({...s,services_section:e.target.checked}))} className="mr-2 accent-cyan-700"/>Presentación</label><label className="block"><input type="checkbox" checked={selection.services} onChange={(e)=>setSelection((s)=>({...s,services:e.target.checked}))} className="mr-2 accent-cyan-700"/>Servicios</label></div></div>
          <input value={proposal.services_section_title} onChange={(e)=>updateProposal('services_section_title',e.target.value.slice(0,60))} className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 font-black" />
          <textarea value={proposal.services_section_description} onChange={(e)=>updateProposal('services_section_description',e.target.value.slice(0,240))} rows={3} className="mt-3 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 leading-6" />
          <div className="mt-4 space-y-3">{proposal.services.map((s,index)=><div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-[11px] font-black uppercase text-slate-400">Servicio {index+1}</p><input value={s.title} onChange={(e)=>updateService(index,'title',e.target.value.slice(0,60))} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-black"/><textarea value={s.description} onChange={(e)=>updateService(index,'description',e.target.value.slice(0,90))} rows={2} className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5"/></div>)}</div>
          {hasExistingServices && selection.services && <label className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-5 text-amber-900"><input type="checkbox" checked={replaceServices} onChange={(e)=>setReplaceServices(e.target.checked)} className="mt-0.5 accent-amber-700"/><span>Confirmo que quiero actualizar el texto de los servicios propuestos. Kawvo conservará los servicios existentes, sus IDs, imágenes, precios, texto de WhatsApp y estado destacado; no se eliminarán automáticamente.</span></label>}
        </div>
        {proposal.portfolio?.length>0 && <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.12em] text-cyan-700">Mis trabajos</p><h2 className="mt-1 text-xl font-black">Textos de tus fotos</h2></div><label className="text-xs font-black"><input type="checkbox" checked={selection.portfolio} onChange={(e)=>setSelection((s)=>({...s,portfolio:e.target.checked}))} className="mr-2 accent-cyan-700"/>Aplicar</label></div>
          <p className="mt-2 text-sm font-medium leading-6 text-slate-500">Máximo 5 trabajos. Tú identificas cada foto; Kawvo puede pulir el título y redacta la descripción a partir de ese título y del contexto. Título máximo 80 caracteres y descripción máxima 90. Las imágenes no se reemplazan ni se reordenan.</p>
          <div className="mt-4 space-y-3">{proposal.portfolio.map((item,index)=>{ const current=context.profile.portfolio.find((x)=>x.id===item.id); const lockTitle=editingScope==='missing_only'&&Boolean(current?.title); const lockDescription=editingScope==='missing_only'&&Boolean(current?.description); return <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-[11px] font-black uppercase text-slate-400">Trabajo {index+1}</p><input value={lockTitle?(current?.title||''):item.title} disabled={lockTitle} onChange={(e)=>updatePortfolio(index,'title',e.target.value.slice(0,80))} maxLength={80} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-black disabled:bg-slate-100 disabled:text-slate-500"/>{lockTitle&&<p className="mt-1 text-[11px] font-bold text-emerald-700">✓ Ya completado · se conservará</p>}<textarea value={lockDescription?(current?.description||''):item.description} disabled={lockDescription} onChange={(e)=>updatePortfolio(index,'description',e.target.value.slice(0,90))} maxLength={90} rows={2} className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 disabled:bg-slate-100 disabled:text-slate-500"/>{lockDescription&&<p className="mt-1 text-[11px] font-bold text-emerald-700">✓ Ya completado · se conservará</p>}</div>})}</div>
        </div>}
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase text-slate-400">Siguiente acción sugerida</p><p className="mt-2 text-lg font-black">“{proposal.cta.label}”</p><p className="mt-1 text-sm font-medium leading-6 text-slate-500">Es una recomendación de copy. No cambia ni reordena tus Botones rápidos.</p></div>
        {proposal.image_suggestions?.length>0 && <div className="rounded-[24px] border border-violet-200 bg-violet-50 p-5"><p className="text-xs font-black uppercase tracking-[0.12em] text-violet-700">Ideas de imágenes</p><p className="mt-2 text-sm font-semibold leading-6 text-violet-900">Son recomendaciones, no imágenes generadas.</p><div className="mt-3 space-y-2">{proposal.image_suggestions.map((x)=><div key={x.purpose} className="rounded-xl bg-white p-3"><p className="text-sm font-black">{x.purpose}</p><p className="mt-1 text-sm font-medium leading-5 text-slate-600">{x.suggestion}</p></div>)}</div></div>}
        <div className="sticky bottom-3 z-30 rounded-[24px] border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur">
          {success ? <>
            <div className="mb-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="font-black text-emerald-800">✓ Cambios aplicados correctamente</p>
              <p className="mt-1 text-sm font-semibold leading-6 text-emerald-700">Tu perfil fue actualizado. No se publicó automáticamente.</p>
              {remainingProfileItems.length>0 && <div className="mt-3 rounded-xl bg-white/80 p-3">
                <p className="text-sm font-black text-slate-800">Para obtener un perfil más completo todavía te falta:</p>
                <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{remainingProfileItems.join(' · ')}</p>
                <p className="mt-1 text-xs font-medium leading-5 text-slate-500">Estos datos no los completa la IA. Puedes configurarlos desde tu editor.</p>
              </div>}
            </div>
            <button type="button" disabled className="w-full cursor-not-allowed rounded-2xl bg-cyan-700 px-5 py-4 text-base font-black text-white opacity-35">✓ Cambios aplicados</button>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" onClick={()=>{setSuccess('');setRemainingProfileItems([])}} className="rounded-xl bg-slate-100 px-3 py-3 text-sm font-black text-slate-700">Modificar datos</button>
              <a href={`/api/v1/me/free/profile-preview/${encodeURIComponent(context.profile.slug)}?full=1`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center rounded-xl bg-slate-950 px-3 py-3 text-sm font-black text-white">Ver mi perfil</a>
            </div>
            {remainingProfileItems.length>0 && <button type="button" onClick={()=>navigate('/admin/free/editor')} className="mt-2 w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm font-black text-amber-900">Completar campos pendientes</button>}
          </> : <>
            <button type="button" onClick={()=>void applyProposal()} disabled={applying || (selection.services && hasExistingServices && !replaceServices)} className="w-full rounded-2xl bg-cyan-700 px-5 py-4 text-base font-black text-white disabled:opacity-40">{applying?'Aplicando…':'Aplicar a mi perfil'}</button>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" onClick={()=>{setProposal(null);setFollowUp([]);setRound(1)}} className="rounded-xl bg-slate-100 px-3 py-2.5 text-xs font-black">Volver a preguntas</button>
              <button type="button" onClick={()=>void generate(1)} disabled={generating || cooldownSeconds>0} className="rounded-xl bg-slate-100 px-3 py-2.5 text-xs font-black">{generating?'Generando…':cooldownSeconds>0?`Disponible en ${cooldownSeconds} s`:'Generar otra'}</button>
            </div>
          </>}
        </div>
      </section>}
    </section>
  </main>
}
