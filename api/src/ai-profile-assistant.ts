import app from './preview-entry'
import { cookieNames } from './lib/cookies'

const DEFAULT_MODEL = 'gpt-5.6-luna'
const DEFAULT_TERMS_VERSION = 'ai-assistant-v1.0'
const MAX_ANSWER_LENGTH = 700
const MAX_TOTAL_INPUT_LENGTH = 3200
const MAX_GENERATIONS_PER_DAY = 8
const MAX_GENERATIONS_PER_MONTH = 100
const MAX_ROUNDS_PER_SESSION = 2
const FREE_MAX_SERVICES = 3
const COOLDOWN_SECONDS = 20
const MAX_OUTPUT_TOKENS = 1800
const INPUT_USD_PER_MILLION = 0.20
const OUTPUT_USD_PER_MILLION = 1.20

const ALLOWED_GOALS = new Set(['contact', 'quote', 'book', 'visit', 'buy', 'learn_more'])

type ImageSuggestion = { purpose: string; suggestion: string }
type AssistantProposal = {
  professional_title: string
  bio: string
  services_section_title: string
  services_section_description: string
  services: Array<{ title: string; description: string }>
  cta: { label: string; goal: 'contact' | 'quote' | 'book' | 'visit' | 'buy' | 'learn_more' }
  image_suggestions: ImageSuggestion[]
}
type AssistantResult =
  | { status: 'ready'; proposal: AssistantProposal }
  | { status: 'needs_more_info'; questions: string[] }

type ExistingService = { id: string; title: string; description: string; has_image: boolean }

type PlanLimits = {
  max_services: number
  ai_daily_generations: number
  ai_monthly_generations: number
  ai_max_rounds: number
}

function parseCookie(header: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = header.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash)).map((v) => v.toString(16).padStart(2, '0')).join('')
}

async function requireAssistantAuth(c: any, next: any) {
  const rawSession = parseCookie(c.req.header('Cookie') || '', cookieNames(c.env).session)
  if (!rawSession) return c.json({ ok: false, error: 'Unauthorized' }, 401)
  const sessionHash = await sha256Hex(rawSession)
  const session = await c.env.DB.prepare(
    `SELECT user_id FROM auth_sessions
      WHERE session_hash = ? AND expires_at > datetime('now') AND revoked_at IS NULL LIMIT 1`,
  ).bind(sessionHash).first()
  if (!session) return c.json({ ok: false, error: 'Unauthorized' }, 401)
  c.set('userId', String((session as any).user_id || ''))
  await next()
}

function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
}
function parseObject(value: unknown): Record<string, any> {
  if (!value) return {}
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>
  if (typeof value !== 'string') return {}
  try { return objectValue(JSON.parse(value)) } catch { return {} }
}
function text(value: unknown, max: number): string {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max)
}
function numericEnv(value: unknown, fallback: number, min = 1, max = 100000) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.floor(n))) : fallback
}
function planLimits(c: any, planId: string): PlanLimits {
  const free = planId === 'free'
  return {
    max_services: free ? numericEnv(c.env.FREE_MAX_SERVICES, FREE_MAX_SERVICES, 1, 20) : numericEnv(c.env.PAID_MAX_SERVICES, 20, 1, 100),
    ai_daily_generations: numericEnv(c.env.AI_PROFILE_DAILY_LIMIT, MAX_GENERATIONS_PER_DAY, 1, 1000),
    ai_monthly_generations: numericEnv(c.env.AI_PROFILE_MONTHLY_LIMIT, MAX_GENERATIONS_PER_MONTH, 1, 10000),
    ai_max_rounds: numericEnv(c.env.AI_PROFILE_MAX_ROUNDS, MAX_ROUNDS_PER_SESSION, 1, 5),
  }
}
function configuredChannels(contact: any): string[] {
  return [contact.whatsapp && 'whatsapp', contact.phone && 'phone', contact.email && 'email', contact.address && 'visit'].filter(Boolean) as string[]
}

function validateProposal(raw: unknown, maxServices: number): AssistantProposal | null {
  const value = objectValue(raw)
  const cta = objectValue(value.cta)
  const goal = ALLOWED_GOALS.has(String(cta.goal)) ? String(cta.goal) as AssistantProposal['cta']['goal'] : 'contact'
  const services = Array.isArray(value.services)
    ? value.services.slice(0, maxServices).map((item: any) => ({
        title: text(item?.title, 60), description: text(item?.description, 110),
      })).filter((item: any) => item.title && item.description)
    : []
  const imageSuggestions = Array.isArray(value.image_suggestions)
    ? value.image_suggestions.slice(0, 4).map((item: any) => ({
        purpose: text(item?.purpose, 70), suggestion: text(item?.suggestion, 180),
      })).filter((item: any) => item.purpose && item.suggestion)
    : []
  const proposal: AssistantProposal = {
    professional_title: text(value.professional_title, 80),
    bio: text(value.bio, 300),
    services_section_title: text(value.services_section_title, 60),
    services_section_description: text(value.services_section_description, 240),
    services,
    cta: { label: text(cta.label, 45), goal },
    image_suggestions: imageSuggestions,
  }
  if (!proposal.professional_title || !proposal.bio || !proposal.services_section_title || !proposal.cta.label || services.length < 1) return null
  return proposal
}

function validateAssistantResult(raw: unknown, maxServices: number): AssistantResult | null {
  const value = objectValue(raw)
  if (value.status === 'needs_more_info') {
    if ('proposal' in value) return null
    const questions = Array.isArray(value.questions)
      ? value.questions.map((q: unknown) => text(q, 180)).filter(Boolean).slice(0, 3)
      : []
    return questions.length ? { status: 'needs_more_info', questions } : null
  }
  if (value.status === 'ready') {
    if ('questions' in value) return null
    const proposal = validateProposal(value.proposal, maxServices)
    return proposal ? { status: 'ready', proposal } : null
  }
  return null
}

async function ownerContext(c: any, userId: string) {
  const profile = await c.env.DB.prepare(
    `SELECT id, slug, plan_id, name, bio, category, template_data FROM profiles WHERE user_id = ? LIMIT 1`,
  ).bind(userId).first()
  if (!profile) return null
  const profileId = String((profile as any).id)
  const [servicesResult, contact] = await Promise.all([
    c.env.DB.prepare(`SELECT id, title, description, image_url, sort_order FROM profile_products WHERE profile_id = ? ORDER BY sort_order ASC, created_at ASC LIMIT 20`).bind(profileId).all(),
    c.env.DB.prepare(`SELECT whatsapp, email, phone, address FROM profile_contact WHERE profile_id = ? LIMIT 1`).bind(profileId).first(),
  ])
  const templateData = parseObject((profile as any).template_data)
  const services: ExistingService[] = (servicesResult.results as any[]).map((row) => ({
    id: String(row.id), title: text(row.title, 60), description: text(row.description, 110), has_image: Boolean(row.image_url),
  }))
  const contactData = {
    whatsapp: text((contact as any)?.whatsapp, 80),
    email: text((contact as any)?.email, 120),
    phone: text((contact as any)?.phone, 80),
    address: text((contact as any)?.address, 180),
  }
  return {
    profileId,
    slug: String((profile as any).slug || ''),
    planId: String((profile as any).plan_id || 'free'),
    name: text((profile as any).name, 80),
    bio: text((profile as any).bio, 300),
    category: text((profile as any).category, 120),
    professionalTitle: text(templateData.role || templateData.title, 80),
    servicesSectionTitle: text(templateData.services_section_title, 60),
    servicesSectionDescription: text(templateData.services_section_description, 240),
    templateData,
    services,
    contact: contactData,
    configuredChannels: configuredChannels(contactData),
  }
}

async function termsAccepted(c: any, userId: string) {
  const termsVersion = text(c.env.AI_TERMS_VERSION || DEFAULT_TERMS_VERSION, 80) || DEFAULT_TERMS_VERSION
  const row = await c.env.DB.prepare(
    `SELECT id FROM ai_assistant_terms_acceptances WHERE user_id = ? AND terms_version = ? ORDER BY accepted_at DESC LIMIT 1`,
  ).bind(userId, termsVersion).first()
  return { accepted: Boolean(row), termsVersion }
}

async function insertUsage(c: any, data: {
  userId: string; profileId: string; operation: 'generate' | 'apply'; status: 'success' | 'error' | 'blocked';
  model?: string; inputTokens?: number; outputTokens?: number; errorCode?: string | null
}) {
  const inputTokens = Math.max(0, Number(data.inputTokens || 0))
  const outputTokens = Math.max(0, Number(data.outputTokens || 0))
  const estimatedCost = (inputTokens * INPUT_USD_PER_MILLION + outputTokens * OUTPUT_USD_PER_MILLION) / 1_000_000
  try {
    await c.env.DB.prepare(
      `INSERT INTO ai_profile_assistant_usage
        (id,user_id,profile_id,operation,status,model,input_tokens,output_tokens,estimated_cost_usd,error_code,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now'))`,
    ).bind(crypto.randomUUID(), data.userId, data.profileId, data.operation, data.status, data.model || null, inputTokens, outputTokens, estimatedCost, data.errorCode || null).run()
  } catch {}
  return estimatedCost
}

async function generationLimit(c: any, userId: string, limits: PlanLimits) {
  const row = await c.env.DB.prepare(
    `SELECT
       SUM(CASE WHEN created_at >= datetime('now','-1 day') AND status IN ('success','error') THEN 1 ELSE 0 END) AS daily_count,
       SUM(CASE WHEN strftime('%Y-%m', created_at) = strftime('%Y-%m','now') AND status IN ('success','error') THEN 1 ELSE 0 END) AS monthly_count,
       MAX(CASE WHEN status IN ('success','error') THEN created_at ELSE NULL END) AS last_created_at
     FROM ai_profile_assistant_usage WHERE user_id = ? AND operation = 'generate'`,
  ).bind(userId).first()
  const daily = Number((row as any)?.daily_count || 0)
  const monthly = Number((row as any)?.monthly_count || 0)
  if (daily >= limits.ai_daily_generations) return { allowed: false, reason: 'daily_limit', retryAfter: 3600, daily, monthly }
  if (monthly >= limits.ai_monthly_generations) return { allowed: false, reason: 'monthly_limit', retryAfter: 86400, daily, monthly }
  const lastCreatedAt = String((row as any)?.last_created_at || '')
  if (lastCreatedAt) {
    const lastMs = Date.parse(`${lastCreatedAt.replace(' ', 'T')}Z`)
    const cooldown = numericEnv(c.env.AI_PROFILE_COOLDOWN_SECONDS, COOLDOWN_SECONDS, 1, 300)
    if (Number.isFinite(lastMs)) {
      const elapsed = Math.floor((Date.now() - lastMs) / 1000)
      if (elapsed < cooldown) return { allowed: false, reason: 'cooldown', retryAfter: cooldown - elapsed, daily, monthly }
    }
  }
  return { allowed: true, reason: '', retryAfter: 0, daily, monthly }
}

function responseText(payload: any): string {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) return payload.output_text
  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    for (const part of Array.isArray(item?.content) ? item.content : []) {
      if (typeof part?.text === 'string' && part.text.trim()) return part.text
    }
  }
  return ''
}

function buildInput(answers: Record<string, string>, followUp: Array<{ question: string; answer: string }>, context: any, limits: PlanLimits) {
  const safeProfile = {
    name: context.name,
    category: context.category,
    professional_title: context.professionalTitle,
    bio: context.bio,
    services_section_title: context.servicesSectionTitle,
    services_section_description: context.servicesSectionDescription,
    existing_services: context.services.map((s: ExistingService) => ({ title: s.title, description: s.description, has_image: s.has_image })),
  }
  return JSON.stringify({
    profile: safeProfile,
    configured_channels: context.configuredChannels,
    plan: { code: context.planId, limits },
    answers,
    follow_up_answers: followUp,
  })
}

const proposalSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    professional_title: { type: 'string' }, bio: { type: 'string' }, services_section_title: { type: 'string' }, services_section_description: { type: 'string' },
    services: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { title: { type: 'string' }, description: { type: 'string' } }, required: ['title','description'] } },
    cta: { type: 'object', additionalProperties: false, properties: { label: { type: 'string' }, goal: { type: 'string', enum: ['contact','quote','book','visit','buy','learn_more'] } }, required: ['label','goal'] },
    image_suggestions: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { purpose: { type: 'string' }, suggestion: { type: 'string' } }, required: ['purpose','suggestion'] } },
  },
  required: ['professional_title','bio','services_section_title','services_section_description','services','cta','image_suggestions'],
}

const responseSchema = {
  anyOf: [
    { type: 'object', additionalProperties: false, properties: { status: { type: 'string', enum: ['ready'] }, proposal: proposalSchema }, required: ['status','proposal'] },
    { type: 'object', additionalProperties: false, properties: { status: { type: 'string', enum: ['needs_more_info'] }, questions: { type: 'array', items: { type: 'string' } } }, required: ['status','questions'] },
  ],
}

const EDITORIAL_INSTRUCTIONS = [
  'ROL: Eres el estratega de presentación, posicionamiento y copy de Kawvo Link. No eres un rellenador de campos, un chatbot genérico ni un generador de frases bonitas.',
  'MISIÓN KAWVO: un Perfil Digital Kawvo es una carta de presentación digital. En pocos segundos el visitante debe entender quién es la persona o negocio, qué hace, qué necesidad puede resolverle o qué valor aporta, por qué puede ser relevante y cuál es el siguiente paso. La meta no es vender por vender: es presentar mejor, comunicar valor con claridad, generar confianza y facilitar la siguiente acción.',
  'SUFICIENCIA: antes de redactar decide si existe información suficiente para producir una presentación específica y creíble. No preguntes para completar una plantilla mental. Si falta información verdaderamente esencial, devuelve needs_more_info con 1 a 3 preguntas de alto valor informativo. No preguntes lo ya guardado, ya respondido o inferible de forma segura.',
  'HECHOS E INFERENCIAS: distingue hechos confirmados, inferencias razonables y redacción comercial. Puedes inferir beneficios directos y evidentes, pero nunca convertir una posibilidad en una promesa. Nunca inventes certificaciones, experiencia, años, precios, ubicaciones, clientes, marcas, garantías, capacidades, resultados, ventajas competitivas, servicios, disponibilidad ni tiempos de entrega.',
  'PERSPECTIVA: piensa desde el visitante. No resumas mecánicamente ni respetes el orden de entrada. Prioriza lo que más ayude a comprender qué hace, cómo ayuda, qué valor tiene y qué debe hacer después. Esto aplica solo al copy; nunca sugieras reorganizar visualmente botones, módulos, secciones o servicios.',
  'SECTOR: adapta vocabulario, tono, prioridad y forma de describir servicios a la actividad. Escribe en español natural, profesional y cercano para República Dominicana, sin jerga local innecesaria salvo que el tono del usuario la justifique.',
  'COPY: cada frase debe explicar, posicionar, diferenciar, generar interés, transmitir confianza, mostrar valor o facilitar una acción. Evita lenguaje infantil, robótico, académico, excesivamente formal, exageradamente publicitario, genérico o de plantilla. Evita frases vacías como calidad y confianza, somos tu mejor opción, soluciones a tu medida, servicio personalizado, excelencia garantizada o comprometidos con nuestros clientes salvo respaldo concreto.',
  'COHERENCIA: la propuesta cuenta una sola historia. professional_title posiciona; bio explica valor; servicios demuestran qué puede hacer; CTA indica el siguiente paso. Evita redundancia entre campos.',
  'TÍTULO: corto, específico y fácil de comprender. Puede usar especialidad + enfoque si está respaldado. Evita Emprendedor, Servicios profesionales o Soluciones integrales cuando exista algo más concreto.',
  'BIO: normalmente 2 o 3 frases breves. Explica qué hace, en qué situación ayuda, para quién y qué valor práctico obtiene el cliente cuando el contexto lo permita. No sobrecargues ni repitas servicios. Evita aperturas automáticas tipo Somos una empresa dedicada, En [nombre] realizamos o Nos especializamos en ofrecer.',
  'SERVICIOS: propone únicamente servicios reales y respeta plan.limits.max_services. Cada título debe ser concreto y escaneable; cada descripción debe expresar utilidad, beneficio o problema que resuelve. No inventes servicios para llenar cupos ni escribas definiciones de diccionario.',
  'SECCIÓN SERVICIOS: prefiere un título específico cuando surja natural; no fuerces creatividad. Si lo creativo suena artificial usa algo simple y claro. La descripción introduce desde necesidad, beneficio o contexto, sin repetir ni rellenar.',
  'CTA Y CANALES: configured_channels solo informa qué canales existen. Si hay varias alternativas razonables y el usuario no indicó preferencia, no elijas arbitrariamente: devuelve needs_more_info. Los canales no determinan por sí solos la intención. No sugieras una acción incompatible con canales existentes.',
  'IMÁGENES: image_suggestions son recomendaciones textuales, nunca generación ni modificación. Sugiere qué mostrar y por qué ayuda al visitante. Prioriza fotos reales del profesional, negocio, proceso, producto, trabajo realizado o resultado cuando sea pertinente.',
  'CONTENIDO EXISTENTE: si ya es bueno conserva su esencia y mejora claridad, estructura, posicionamiento, lectura móvil y conversión. No reemplaces por cambiar.',
  'MÓVIL: frases cortas, palabras concretas, jerarquía clara, lectura rápida y cero relleno.',
  'REVISIÓN SILENCIOSA antes de ready: claridad, especificidad, credibilidad, diferenciación, beneficio, conversión, lectura móvil, coherencia, ausencia de redundancia y fidelidad a los hechos. Si el texto podría servir sin cambios a cien negocios, hazlo más específico usando solo el contexto disponible.',
  'SALIDA: devuelve exclusivamente JSON válido conforme al esquema. No HTML, Markdown, comentarios, explicaciones ni razonamiento interno.',
].join('\n')

app.get('/api/v1/me/ai-profile-assistant/context', requireAssistantAuth, async (c: any) => {
  const userId = c.get('userId') as string
  const context = await ownerContext(c, userId)
  if (!context) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)
  let consent
  let usage: any
  try {
    consent = await termsAccepted(c, userId)
    usage = await c.env.DB.prepare(
      `SELECT
        SUM(CASE WHEN created_at >= datetime('now','-1 day') THEN 1 ELSE 0 END) AS daily_count,
        SUM(CASE WHEN strftime('%Y-%m',created_at)=strftime('%Y-%m','now') THEN 1 ELSE 0 END) AS monthly_count,
        COALESCE(SUM(input_tokens),0) AS input_tokens,
        COALESCE(SUM(output_tokens),0) AS output_tokens,
        COALESCE(SUM(estimated_cost_usd),0) AS estimated_cost_usd
       FROM ai_profile_assistant_usage WHERE user_id = ? AND operation = 'generate' AND status IN ('success','error')`,
    ).bind(userId).first()
  } catch {
    return c.json({ ok: false, error: 'La función de IA requiere terminar su configuración de datos.' }, 503)
  }
  const limits = planLimits(c, context.planId)
  return c.json({ ok: true, data: {
    beta: true,
    consent: { required: !consent.accepted, accepted: consent.accepted, terms_version: consent.termsVersion },
    profile: {
      slug: context.slug, name: context.name, category: context.category,
      professional_title: context.professionalTitle, bio: context.bio,
      services_section_title: context.servicesSectionTitle,
      services_section_description: context.servicesSectionDescription,
      services: context.services, contact: context.contact,
      configured_channels: context.configuredChannels,
    },
    plan: { code: context.planId, limits, upgrade_available: context.planId === 'free' },
    usage: {
      daily: Number((usage as any)?.daily_count || 0), monthly: Number((usage as any)?.monthly_count || 0),
      remaining_today: Math.max(0, limits.ai_daily_generations - Number((usage as any)?.daily_count || 0)),
      remaining_month: Math.max(0, limits.ai_monthly_generations - Number((usage as any)?.monthly_count || 0)),
      input_tokens: Number((usage as any)?.input_tokens || 0), output_tokens: Number((usage as any)?.output_tokens || 0), estimated_cost_usd: Number((usage as any)?.estimated_cost_usd || 0),
    },
  } })
})

app.post('/api/v1/me/ai-profile-assistant/terms/accept', requireAssistantAuth, async (c: any) => {
  const userId = c.get('userId') as string
  let body: any
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Solicitud no válida.' }, 400) }
  if (body?.accepted !== true) return c.json({ ok: false, error: 'Debes aceptar explícitamente las condiciones para continuar.' }, 400)
  const termsVersion = text(c.env.AI_TERMS_VERSION || DEFAULT_TERMS_VERSION, 80) || DEFAULT_TERMS_VERSION
  const locale = text(body?.locale || 'es-DO', 20) || 'es-DO'
  await c.env.DB.prepare(
    `INSERT INTO ai_assistant_terms_acceptances (id,user_id,terms_version,accepted_at,locale,source) VALUES (?,?,?,datetime('now'),?,'assistant_ui')`,
  ).bind(crypto.randomUUID(), userId, termsVersion, locale).run()
  return c.json({ ok: true, data: { terms_version: termsVersion, accepted: true } })
})

app.post('/api/v1/me/ai-profile-assistant/generate', requireAssistantAuth, async (c: any) => {
  const userId = c.get('userId') as string
  const context = await ownerContext(c, userId)
  if (!context) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)
  let consent
  try { consent = await termsAccepted(c, userId) } catch { return c.json({ ok: false, error: 'La función de IA requiere terminar su configuración de datos.' }, 503) }
  if (!consent.accepted) return c.json({ ok: false, error: 'Para utilizar el Asistente IA de Kawvo debes aceptar sus condiciones de uso.', code: 'consent_required' }, 428)
  if (!c.env.OPENAI_API_KEY) {
    await insertUsage(c, { userId, profileId: context.profileId, operation: 'generate', status: 'blocked', errorCode: 'missing_secret' })
    return c.json({ ok: false, error: 'La ayuda con IA todavía no está configurada.' }, 503)
  }

  let body: any
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Solicitud no válida.' }, 400) }
  const round = numericEnv(body?.round, 1, 1, 99)
  const limits = planLimits(c, context.planId)
  if (round > limits.ai_max_rounds) return c.json({ ok: false, error: 'Ya utilizaste las rondas de información disponibles para esta propuesta.', code: 'round_limit' }, 429)

  const rawAnswers = objectValue(body?.answers)
  const keys = ['activity_details','services_details','clients','preferred_contact','next_action','extra_context']
  const answers: Record<string,string> = {}
  for (const key of keys) answers[key] = text(rawAnswers[key], MAX_ANSWER_LENGTH)
  const followUp = Array.isArray(body?.follow_up_answers)
    ? body.follow_up_answers.slice(0, 3).map((item: any) => ({ question: text(item?.question, 180), answer: text(item?.answer, MAX_ANSWER_LENGTH) })).filter((item: any) => item.question && item.answer)
    : []
  const totalLength = Object.values(answers).reduce((sum,v) => sum + v.length, 0) + followUp.reduce((sum,v) => sum + v.question.length + v.answer.length, 0)
  const hasExistingContent = Boolean(context.bio || context.professionalTitle || context.services.length)
  if (totalLength < 8 && !hasExistingContent) return c.json({ ok: false, error: 'Cuéntanos un poco más para preparar una propuesta útil.' }, 400)
  if (totalLength > MAX_TOTAL_INPUT_LENGTH) return c.json({ ok: false, error: 'La información es demasiado extensa. Resume un poco tus respuestas.' }, 413)

  if (context.configuredChannels.length > 1 && !answers.preferred_contact && !followUp.some((x) => /contact|whatsapp|llamada|correo/i.test(x.question))) {
    return c.json({ ok: true, data: { status: 'needs_more_info', questions: ['¿Cómo prefieres que te contacten principalmente?'], options: context.configuredChannels, round } })
  }

  let limit: any
  try { limit = await generationLimit(c, userId, limits) } catch { return c.json({ ok: false, error: 'La función de IA requiere terminar su configuración de datos.' }, 503) }
  if (!limit.allowed) {
    await insertUsage(c, { userId, profileId: context.profileId, operation: 'generate', status: 'blocked', errorCode: limit.reason })
    c.header('Retry-After', String(limit.retryAfter || 60))
    return c.json({ ok: false, error: limit.reason === 'cooldown' ? 'Espera unos segundos antes de generar otra propuesta.' : 'Alcanzaste el límite disponible del Asistente IA por ahora.', code: limit.reason, retry_after_seconds: limit.retryAfter }, 429)
  }

  const model = text(c.env.OPENAI_MODEL || DEFAULT_MODEL, 80) || DEFAULT_MODEL
  const safetyIdentifier = (await sha256Hex(`kawvo:${userId}`)).slice(0,64)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 25_000)
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${c.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model, store: false, safety_identifier: safetyIdentifier, max_output_tokens: MAX_OUTPUT_TOKENS,
        reasoning: { effort: 'none' },
        text: { verbosity: 'medium', format: { type: 'json_schema', name: 'kawvo_profile_assistant_result', strict: true, schema: responseSchema } },
        instructions: EDITORIAL_INSTRUCTIONS,
        input: buildInput(answers, followUp, context, limits),
      }),
    })
    const payload: any = await response.json().catch(() => ({}))
    const usage = payload?.usage || {}
    if (!response.ok) {
      const errorCode = text(payload?.error?.code || `openai_${response.status}`,80)
      await insertUsage(c,{ userId,profileId:context.profileId,operation:'generate',status:'error',model,inputTokens:usage.input_tokens,outputTokens:usage.output_tokens,errorCode })
      if (response.status === 429) return c.json({ ok:false,error:'La IA está recibiendo muchas solicitudes. Intenta nuevamente en un momento.' },503)
      return c.json({ ok:false,error:'No pudimos preparar la propuesta con IA. Tu perfil no fue modificado.' },502)
    }
    if (payload?.status && payload.status !== 'completed') {
      await insertUsage(c,{ userId,profileId:context.profileId,operation:'generate',status:'error',model,inputTokens:usage.input_tokens,outputTokens:usage.output_tokens,errorCode:`response_${text(payload.status,40)}` })
      return c.json({ ok:false,error:'La propuesta no pudo completarse. Tu perfil sigue sin cambios.' },502)
    }
    let parsed: any = null
    try { parsed = JSON.parse(responseText(payload)) } catch {}
    const result = validateAssistantResult(parsed, limits.max_services)
    if (!result) {
      await insertUsage(c,{ userId,profileId:context.profileId,operation:'generate',status:'error',model,inputTokens:usage.input_tokens,outputTokens:usage.output_tokens,errorCode:'invalid_structured_output' })
      return c.json({ ok:false,error:'La respuesta de IA llegó incompleta. Tu perfil sigue sin cambios.' },502)
    }
    const estimatedCost = await insertUsage(c,{ userId,profileId:context.profileId,operation:'generate',status:'success',model,inputTokens:usage.input_tokens,outputTokens:usage.output_tokens })
    return c.json({ ok:true,data:{ ...result, round, usage:{ model,input_tokens:Number(usage.input_tokens||0),output_tokens:Number(usage.output_tokens||0),estimated_cost_usd:estimatedCost }, plan:{ code:context.planId, limits } } })
  } catch (error:any) {
    const code = error?.name === 'AbortError' ? 'timeout' : 'network_error'
    await insertUsage(c,{ userId,profileId:context.profileId,operation:'generate',status:'error',model,errorCode:code })
    return c.json({ ok:false,error:code === 'timeout' ? 'La IA tardó demasiado. Intenta nuevamente; tu perfil no fue modificado.' : 'No pudimos conectar con la IA. Tu perfil sigue disponible y sin cambios.' },504)
  } finally { clearTimeout(timeout) }
})

app.post('/api/v1/me/ai-profile-assistant/apply', requireAssistantAuth, async (c: any) => {
  const userId = c.get('userId') as string
  const context = await ownerContext(c,userId)
  if (!context) return c.json({ ok:false,error:'Perfil no encontrado' },404)
  let body:any
  try { body = await c.req.json() } catch { return c.json({ ok:false,error:'Solicitud no válida.' },400) }
  const limits = planLimits(c,context.planId)
  const proposal = validateProposal(body?.proposal, limits.max_services)
  if (!proposal) return c.json({ ok:false,error:'La propuesta no es válida.' },400)
  const apply = objectValue(body?.apply)
  const applyIdentity = Boolean(apply.identity)
  const applyBio = Boolean(apply.bio)
  const applyServicesSection = Boolean(apply.services_section)
  const applyServices = Boolean(apply.services)
  const confirmExistingServicesUpdate = body?.replace_existing_services === true
  if (!applyIdentity && !applyBio && !applyServicesSection && !applyServices) return c.json({ ok:false,error:'Selecciona al menos un cambio para aplicar.' },400)
  if (applyServices && context.services.length > 0 && !confirmExistingServicesUpdate) return c.json({ ok:false,error:'Confirma explícitamente si deseas actualizar el texto de tus servicios actuales.',code:'replace_services_confirmation_required' },409)

  const nextTemplateData = { ...context.templateData }
  if (applyIdentity) { nextTemplateData.role = proposal.professional_title; nextTemplateData.free_identity_confirmed = true }
  if (applyServicesSection) { nextTemplateData.services_section_title = proposal.services_section_title; nextTemplateData.services_section_description = proposal.services_section_description }
  const statements:any[] = []
  if (applyIdentity || applyBio || applyServicesSection) {
    statements.push(c.env.DB.prepare(`UPDATE profiles SET bio = CASE WHEN ? = 1 THEN ? ELSE bio END, template_data = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`).bind(applyBio?1:0,proposal.bio,JSON.stringify(nextTemplateData),context.profileId,userId))
  }
  if (applyServices) {
    for (let index=0; index<proposal.services.length && index<limits.max_services; index+=1) {
      const service = proposal.services[index]
      const existing = context.services[index]
      if (existing) {
        statements.push(c.env.DB.prepare(`UPDATE profile_products SET title = ?, description = ?, sort_order = ? WHERE id = ? AND profile_id = ?`).bind(service.title,service.description,index,existing.id,context.profileId))
      } else {
        statements.push(c.env.DB.prepare(`INSERT INTO profile_products (id,profile_id,title,description,price,image_url,whatsapp_text,is_featured,sort_order,created_at) VALUES (?,?,?,?,'','','',0,?,datetime('now'))`).bind(crypto.randomUUID(),context.profileId,service.title,service.description,index))
      }
    }
  }
  try { if (statements.length) await c.env.DB.batch(statements) } catch {
    await insertUsage(c,{ userId,profileId:context.profileId,operation:'apply',status:'error',errorCode:'db_write_failed' })
    return c.json({ ok:false,error:'No pudimos aplicar los cambios. Tu perfil anterior se mantiene.' },500)
  }
  await insertUsage(c,{ userId,profileId:context.profileId,operation:'apply',status:'success' })
  return c.json({ ok:true,data:{ applied:{ identity:applyIdentity,bio:applyBio,services_section:applyServicesSection,services:applyServices }, published:false, services_preserved:applyServices && context.services.length>0, note:'Aplicar modifica únicamente los campos seleccionados. No publica, no cambia plantilla, colores, orden de botones, orden de secciones ni canales.' } })
})
