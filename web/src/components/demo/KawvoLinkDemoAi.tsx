import { useMemo, useState } from 'react'
import { FREE_PROFILE_STARTER_ASSETS } from '../../../../shared/free-profile-starter-assets'
import type { FreeProfileLayoutId, FreeProfilePortfolioItem, FreeProfileService } from '../free-profile/IntapLinkGratis.types'
import './KawvoLinkDemoAi.css'

const TERMS_VERSION = 'demo-ai-v1.0'
const DRAFT_KEY = 'kawvo_demo_ai_draft_v1'
const SESSION_KEY = 'kawvo_demo_session'

type Step = 1 | 2 | 3 | 4 | 5
type AiReady = {
  status: 'ready'
  demo: {
    asset_category: string
    professional_title: string
    bio: string
    services_section_title: string
    services_section_description: string
    services: Array<{ title: string; description: string }>
  }
}
type AiNeedsInfo = { status: 'needs_more_info'; questions: string[] }

type ContactForm = {
  whatsapp: string
  samePhoneAsWhatsapp: boolean
  phone: string
  instagram: string
  email: string
}

function getSessionKey() {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY)
    if (existing) return existing
    const value = crypto.randomUUID()
    sessionStorage.setItem(SESSION_KEY, value)
    return value
  } catch {
    return `demo-${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 15)
  if (digits.length === 10) return `1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return digits
  return digits
}

function normalizeInstagram(value: string) {
  return value.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/\/$/, '').slice(0, 40)
}

function presentationForCategory(category: string): { layout: FreeProfileLayoutId; palette: 'oceano' | 'esmeralda' | 'violeta' | 'grafito' } {
  if (/Belleza|Salud|Agropecuario|Mascotas/.test(category)) return { layout: 'impacto', palette: 'esmeralda' }
  if (/Arte|Moda|Artesanía|Eventos/.test(category)) return { layout: 'personal', palette: 'violeta' }
  if (/Automotriz|Tecnología|Construcción/.test(category)) return { layout: 'impacto', palette: 'grafito' }
  return { layout: 'impacto', palette: 'oceano' }
}

function buildDraft(data: AiReady['demo'], input: {
  name: string
  activity: string
  role: string
  contact: ContactForm
  includeBankDemo: boolean
}) {
  const assets = [...((FREE_PROFILE_STARTER_ASSETS as Record<string, readonly string[]>)[data.asset_category] || [])]
  const fallbackAssets = [...((FREE_PROFILE_STARTER_ASSETS as Record<string, readonly string[]>)['Servicios generales'] || [])]
  const source = assets.length ? assets : fallbackAssets
  const imageAt = (index: number) => source[index % Math.max(source.length, 1)] || ''
  const presentation = presentationForCategory(data.asset_category)

  const services: FreeProfileService[] = data.services.slice(0, 3).map((service, index) => ({
    id: `demo-ai-service-${index + 1}`,
    title: service.title,
    description: service.description,
    image: imageAt(index + 2),
    iconKey: index === 1 ? 'chart-line' : 'handshake',
  }))

  const portfolio: FreeProfilePortfolioItem[] = [0, 1, 2, 3, 4].map((index) => ({
    id: `demo-ai-portfolio-${index + 1}`,
    title: `Muestra visual ${index + 1}`,
    description: `Imagen demostrativa relacionada con ${input.activity.slice(0, 54)}.`,
    image: imageAt(index + 1),
  }))

  const whatsapp = normalizePhone(input.contact.whatsapp)
  const phone = input.contact.samePhoneAsWhatsapp ? whatsapp : normalizePhone(input.contact.phone)

  return {
    version: 1,
    createdAt: Date.now(),
    assetCategory: data.asset_category,
    bankDemo: input.includeBankDemo,
    portrait: imageAt(1),
    hero: imageAt(0),
    form: {
      name: input.name.trim(),
      role: data.professional_title,
      bio: data.bio,
      whatsapp,
      phone,
      samePhoneAsWhatsapp: input.contact.samePhoneAsWhatsapp,
      instagram: normalizeInstagram(input.contact.instagram),
      email: input.contact.email.trim().slice(0, 120),
      servicesTitle: data.services_section_title,
      servicesDescription: data.services_section_description,
      layout: presentation.layout,
      palette: presentation.palette,
      services,
      portfolio,
    },
  }
}

function postEvent(eventType: string, sessionKey: string, metadata?: Record<string, unknown>) {
  fetch('/api/v1/public/demo/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_type: eventType, session_key: sessionKey, source: 'demo_ai', metadata }),
    keepalive: true,
  }).catch(() => undefined)
}

export default function KawvoLinkDemoAi() {
  const sessionKey = useMemo(getSessionKey, [])
  const [step, setStep] = useState<Step>(1)
  const [activity, setActivity] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [workDescription, setWorkDescription] = useState('')
  const [contact, setContact] = useState<ContactForm>({ whatsapp: '', samePhoneAsWhatsapp: true, phone: '', instagram: '', email: '' })
  const [consent, setConsent] = useState(false)
  const [includeBankDemo, setIncludeBankDemo] = useState(true)
  const [questions, setQuestions] = useState<string[]>([])
  const [clarification, setClarification] = useState('')
  const [round, setRound] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const next = () => {
    setError('')
    if (step === 1 && !activity.trim()) return setError('Cuéntanos a qué te dedicas.')
    if (step === 2 && !name.trim()) return setError('Escribe el nombre con el que quieres aparecer.')
    if (step === 3 && workDescription.trim().length < 8) return setError('Cuéntanos brevemente qué haces para preparar una buena Demo.')
    setStep((current) => Math.min(4, current + 1) as Step)
  }

  const generate = async () => {
    if (busy) return
    if (!consent) return setError('Acepta las condiciones de la Demo con IA para continuar.')
    if (!normalizePhone(contact.whatsapp)) return setError('Agrega un número de WhatsApp para completar tu Demo.')
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/v1/public/demo/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_key: sessionKey,
          consent: { accepted: true, version: TERMS_VERSION },
          activity,
          name,
          professional_title: role,
          work_description: workDescription,
          clarification: clarification || undefined,
          round,
        }),
      })
      const json: any = await response.json().catch(() => ({}))
      if (!response.ok || !json?.ok) {
        setError(json?.error || 'No pudimos preparar tu Demo con IA en este momento.')
        postEvent('demo_ai_fallback', sessionKey, { code: json?.code || response.status })
        return
      }
      const data = json.data as AiReady | AiNeedsInfo
      if (data.status === 'needs_more_info') {
        setQuestions(data.questions.slice(0, 3))
        setClarification('')
        setRound(2)
        setStep(5)
        return
      }
      const draft = buildDraft(data.demo, { name, activity, role, contact, includeBankDemo })
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
      const from = new URLSearchParams(window.location.search).get('from')
      window.location.assign(`/demo?ai=1${from ? `&from=${encodeURIComponent(from)}` : ''}`)
    } catch {
      setError('No pudimos preparar tu Demo con IA en este momento.')
      postEvent('demo_ai_fallback', sessionKey, { code: 'network' })
    } finally {
      setBusy(false)
    }
  }

  const submitClarification = async () => {
    if (!clarification.trim()) return setError('Responde brevemente para terminar tu Demo.')
    await generate()
  }

  const fallback = () => {
    postEvent('demo_ai_fallback', sessionKey, { reason: 'user_continue_manual' })
    const from = new URLSearchParams(window.location.search).get('from')
    window.location.assign(`/demo?manual=1${from ? `&from=${encodeURIComponent(from)}` : ''}`)
  }

  return (
    <main className="kawvo-demo-ai-page">
      <section className="kawvo-demo-ai-shell">
        <div className="kawvo-demo-ai-top">
          <a href="/demo?manual=1" className="kawvo-demo-ai-manual-link">Probar sin IA</a>
          <span>Demo con IA · Beta</span>
          <small>{step <= 4 ? `${step}/4` : 'Casi listo'}</small>
        </div>

        {step === 1 && <>
          <p className="kawvo-demo-ai-kicker">EMPECEMOS POR LO ESENCIAL</p>
          <h1>¿A qué te dedicas?</h1>
          <p>Escríbelo como normalmente lo dirías. Kawvo se encarga del resto.</p>
          <input autoFocus maxLength={120} value={activity} onChange={(event) => setActivity(event.target.value)} placeholder="Ej. Electricista, agente inmobiliaria, decoradora…" />
          <div className="kawvo-demo-ai-examples"><span>Electricista</span><span>Mecánico</span><span>Diseñadora gráfica</span></div>
          <button onClick={next}>Continuar</button>
        </>}

        {step === 2 && <>
          <p className="kawvo-demo-ai-kicker">TU PRESENTACIÓN</p>
          <h1>¿Cómo quieres aparecer?</h1>
          <label><span>Nombre o negocio</span><input autoFocus maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Juan Pérez o JP Electricidad" /></label>
          <label><span>Cargo o especialidad <small>Opcional</small></span><input maxLength={80} value={role} onChange={(event) => setRole(event.target.value)} placeholder="Ej. Electricista residencial" /></label>
          <button onClick={next}>Continuar</button>
        </>}

        {step === 3 && <>
          <p className="kawvo-demo-ai-kicker">CUÉNTANOS LO QUE HACES</p>
          <h1>¿Qué haces principalmente?</h1>
          <p>Como normalmente se lo explicarías a un cliente.</p>
          <textarea autoFocus rows={6} maxLength={900} value={workDescription} onChange={(event) => setWorkDescription(event.target.value)} placeholder="Ej. Instalo lámparas y abanicos, inversores, arreglo cortos y hago instalaciones nuevas." />
          <button onClick={next}>Continuar</button>
        </>}

        {step === 4 && <>
          <p className="kawvo-demo-ai-kicker">PARA QUE PUEDAN CONTACTARTE</p>
          <h1>Tus datos esenciales</h1>
          <label><span>WhatsApp</span><input inputMode="tel" maxLength={20} value={contact.whatsapp} onChange={(event) => setContact({ ...contact, whatsapp: event.target.value })} placeholder="809-000-0000" /><small>Lo mostraremos con el código +1.</small></label>
          <label className="kawvo-demo-ai-check"><input type="checkbox" checked={contact.samePhoneAsWhatsapp} onChange={(event) => setContact({ ...contact, samePhoneAsWhatsapp: event.target.checked })} /><span>Usar este mismo número para llamadas</span></label>
          {!contact.samePhoneAsWhatsapp && <label><span>Teléfono para llamadas</span><input inputMode="tel" maxLength={20} value={contact.phone} onChange={(event) => setContact({ ...contact, phone: event.target.value })} /></label>}
          <label><span>Instagram <small>Opcional</small></span><input maxLength={50} value={contact.instagram} onChange={(event) => setContact({ ...contact, instagram: event.target.value })} placeholder="@usuario" /></label>
          <label><span>Correo <small>Opcional</small></span><input type="email" maxLength={120} value={contact.email} onChange={(event) => setContact({ ...contact, email: event.target.value })} placeholder="correo@dominio.com" /></label>

          <label className="kawvo-demo-ai-check kawvo-demo-ai-bank-option"><input type="checkbox" checked={includeBankDemo} onChange={(event) => setIncludeBankDemo(event.target.checked)} /><span><strong>Mostrar cómo se verían tus datos para recibir transferencias</strong><small>Incluiremos un ejemplo ficticio de cuenta bancaria y cédula/RNC para que veas cómo tus clientes podrían consultar los datos necesarios para pagarte. Puedes quitar este ejemplo si no quieres mostrarlo.</small></span></label>

          <div className="kawvo-demo-ai-consent">
            <strong>Antes de crear tu Demo</strong>
            <p>La IA puede cometer errores. Revisa el contenido antes de compartirlo, no incluyas información sensible y recuerda que esta Demo es temporal.</p>
            <label className="kawvo-demo-ai-check"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>Acepto las condiciones de la Demo con IA</span></label>
          </div>
          <button onClick={() => void generate()} disabled={busy}>{busy ? '✨ Estamos preparando tu Perfil Digital…' : 'Crear mi Demo'}</button>
          <button className="kawvo-demo-ai-secondary" onClick={fallback}>Probar sin IA</button>
        </>}

        {step === 5 && <>
          <p className="kawvo-demo-ai-kicker">UNA ACLARACIÓN Y TERMINAMOS</p>
          <h1>{questions[0] || 'Cuéntanos un poco más'}</h1>
          {questions.length > 1 && <div className="kawvo-demo-ai-extra-questions">{questions.slice(1).map((question) => <p key={question}>{question}</p>)}</div>}
          <textarea autoFocus rows={5} maxLength={700} value={clarification} onChange={(event) => setClarification(event.target.value)} placeholder="Respuesta breve" />
          <button onClick={() => void submitClarification()} disabled={busy}>{busy ? '✨ Terminando tu Perfil Digital…' : 'Terminar mi Demo'}</button>
          <button className="kawvo-demo-ai-secondary" onClick={fallback}>Probar sin IA</button>
        </>}

        {error && <div className="kawvo-demo-ai-error" role="alert">{error}</div>}
        <p className="kawvo-demo-ai-foot">No crea una cuenta ni publica un perfil.</p>
      </section>
    </main>
  )
}
