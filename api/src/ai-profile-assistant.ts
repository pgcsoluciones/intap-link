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
const FREE_MAX_PORTFOLIO = 5
const COOLDOWN_SECONDS = 20
const MAX_OUTPUT_TOKENS = 1800
const INPUT_USD_PER_MILLION = 0.20
const OUTPUT_USD_PER_MILLION = 1.20

const ALLOWED_GOALS = new Set(['contact', 'quote', 'book', 'visit', 'buy', 'learn_more'])

type ImageSuggestion = { purpose: string; suggestion: string }
type PortfolioProposal = { id: string; title: string; description: string }
type EditingScope = 'missing_only' | 'full_profile'
type AssistantProposal = {
  professional_title: string
  bio: string
  services_section_title: string
  services_section_description: string
  services: Array<{ id: string; title: string; description: string }>
  portfolio: PortfolioProposal[]
  cta: { label: string; goal: 'contact' | 'quote' | 'book' | 'visit' | 'buy' | 'learn_more' }
  image_suggestions: ImageSuggestion[]
}
type AssistantResult =
  | { status: 'ready'; proposal: AssistantProposal }
  | { status: 'needs_more_info'; questions: string[] }

type ExistingService = { id: string; title: string; description: string; has_image: boolean }
type ExistingPortfolio = { id: string; title: string; description: string }

type PlanLimits = {
  max_services: number
  max_portfolio: number
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
    max_portfolio: free ? numericEnv(c.env.FREE_MAX_PORTFOLIO, FREE_MAX_PORTFOLIO, 1, 20) : numericEnv(c.env.PAID_MAX_PORTFOLIO, 20, 1, 100),
    ai_daily_generations: numericEnv(c.env.AI_PROFILE_DAILY_LIMIT, MAX_GENERATIONS_PER_DAY, 1, 1000),
    ai_monthly_generations: numericEnv(c.env.AI_PROFILE_MONTHLY_LIMIT, MAX_GENERATIONS_PER_MONTH, 1, 10000),
    ai_max_rounds: numericEnv(c.env.AI_PROFILE_MAX_ROUNDS, MAX_ROUNDS_PER_SESSION, 1, 5),
  }
}
function configuredChannels(contact: any): string[] {
  return [contact.whatsapp && 'whatsapp', contact.phone && 'phone', contact.email && 'email', contact.address && 'visit'].filter(Boolean) as string[]
}

function strictText(value: unknown, max: number): string | null {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim()
  return normalized.length <= max ? normalized : null
}

function validateProposal(raw: unknown, maxServices: number, maxPortfolio: number): AssistantProposal | null {
  const value = objectValue(raw)
  const cta = objectValue(value.cta)
  const goal = ALLOWED_GOALS.has(String(cta.goal)) ? String(cta.goal) as AssistantProposal['cta']['goal'] : 'contact'

  const rawServices = Array.isArray(value.services) ? value.services.slice(0, maxServices) : []
  const services = rawServices.map((item: any) => ({
    id: strictText(item?.id, 80),
    title: strictText(item?.title, 60),
    description: strictText(item?.description, 90),
  }))
  if (services.some((item) => item.id === null || item.title === null || item.description === null)) return null

  const rawPortfolio = Array.isArray(value.portfolio) ? value.portfolio.slice(0, maxPortfolio) : []
  const portfolio = rawPortfolio.map((item: any) => ({
    id: strictText(item?.id, 80),
    title: strictText(item?.title, 80),
    description: strictText(item?.description, 90),
  }))
  if (portfolio.some((item) => item.id === null || item.title === null || item.description === null)) return null

  const rawImageSuggestions = Array.isArray(value.image_suggestions) ? value.image_suggestions.slice(0, 4) : []
  const imageSuggestions = rawImageSuggestions.map((item: any) => ({
    purpose: strictText(item?.purpose, 70),
    suggestion: strictText(item?.suggestion, 180),
  }))
  if (imageSuggestions.some((item) => item.purpose === null || item.suggestion === null)) return null

  const professionalTitle = strictText(value.professional_title, 80)
  const bio = strictText(value.bio, 300)
  const servicesSectionTitle = strictText(value.services_section_title, 60)
  const servicesSectionDescription = strictText(value.services_section_description, 240)
  const ctaLabel = strictText(cta.label, 45)

  if (
    professionalTitle === null ||
    bio === null ||
    servicesSectionTitle === null ||
    servicesSectionDescription === null ||
    ctaLabel === null
  ) return null

  const proposal: AssistantProposal = {
    professional_title: professionalTitle,
    bio,
    services_section_title: servicesSectionTitle,
    services_section_description: servicesSectionDescription,
    services: services
      .filter((item) => item.id)
      .map((item) => ({ id: item.id!, title: item.title!, description: item.description! })),
    portfolio: portfolio
      .filter((item) => item.id)
      .map((item) => ({ id: item.id!, title: item.title!, description: item.description! })),
    cta: { label: ctaLabel, goal },
    image_suggestions: imageSuggestions
      .filter((item) => item.purpose && item.suggestion)
      .map((item) => ({ purpose: item.purpose!, suggestion: item.suggestion! })),
  }

  if (!proposal.professional_title || !proposal.bio || !proposal.services_section_title || !proposal.cta.label) return null
  return proposal
}

function validateAssistantResult(raw: unknown, maxServices: number, maxPortfolio: number): AssistantResult | null {
  const value = objectValue(raw)
  if (value.status === 'needs_more_info') {
    if (value.proposal !== null) return null
    const rawQuestions = Array.isArray(value.questions) ? value.questions.slice(0, 3) : []
    if (!rawQuestions.length) return null

    const questions = rawQuestions
      .map((item: unknown) => objectValue(item))
      .filter((item) => item.kind === 'user_fact')
      .map((item) => text(item.question, 180))
      .filter(Boolean)

    // An empty array here is intentional: the model asked something, but it was
    // not a fact that only this user can confirm. The generate route will retry
    // internally instead of exposing that question to the user.
    return { status: 'needs_more_info', questions }
  }
  if (value.status === 'ready') {
    if (value.questions !== null) return null
    const proposal = validateProposal(value.proposal, maxServices, maxPortfolio)
    return proposal ? { status: 'ready', proposal } : null
  }
  return null
}



async function ownerContext(c: any, userId: string) {
  const profile = await c.env.DB.prepare(
    `SELECT id, slug, plan_id, name, bio, category, subcategory, template_data FROM profiles WHERE user_id = ? LIMIT 1`,
  ).bind(userId).first()
  if (!profile) return null
  const profileId = String((profile as any).id)
  const [servicesResult, portfolioResult, contact] = await Promise.all([
    c.env.DB.prepare(`SELECT id, title, description, image_url, sort_order FROM profile_products WHERE profile_id = ? ORDER BY sort_order ASC, id ASC LIMIT 20`).bind(profileId).all(),
    c.env.DB.prepare(`SELECT id, title, description FROM profile_gallery WHERE profile_id = ? ORDER BY sort_order ASC, id ASC LIMIT 5`).bind(profileId).all(),
    c.env.DB.prepare(`SELECT whatsapp, email, phone, address FROM profile_contact WHERE profile_id = ? LIMIT 1`).bind(profileId).first(),
  ])
  const templateData = parseObject((profile as any).template_data)
  const services: ExistingService[] = (servicesResult.results as any[]).map((row) => ({
    id: String(row.id), title: text(row.title, 60), description: text(row.description, 90), has_image: Boolean(row.image_url),
  }))
  const portfolio: ExistingPortfolio[] = (portfolioResult.results as any[]).map((row) => ({
    id: String(row.id), title: text(row.title, 80), description: text(row.description, 90),
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
    subcategory: text((profile as any).subcategory, 120),
    professionalTitle: text(templateData.role || templateData.title, 80),
    aiActivityContext: text(templateData.ai_activity_context, 500),
    servicesSectionTitle: text(templateData.services_section_title, 60),
    servicesSectionDescription: text(templateData.services_section_description, 240),
    templateData,
    services,
    portfolio,
    contact: contactData,
    configuredChannels: configuredChannels(contactData),
  }
}

function aiContextReadiness(context: any) {
  const missing: string[] = []

  if (!context.category) missing.push('category')
  if (!context.subcategory) missing.push('subcategory')
  if (!context.professionalTitle) missing.push('professional_title')
  if (!context.aiActivityContext) missing.push('activity_context')

  return {
    ready: missing.length === 0,
    missing,
    summary: {
      name: context.name,
      category: context.category,
      subcategory: context.subcategory,
      professional_title: context.professionalTitle,
      activity_context: context.aiActivityContext,
      services_count: context.services.length,
      portfolio_count: context.portfolio.length,
      configured_channels: context.configuredChannels,
    },
  }
}

async function aiContextHash(context: any) {
  return sha256Hex(JSON.stringify({
    name: context.name || '',
    category: context.category || '',
    subcategory: context.subcategory || '',
    professional_title: context.professionalTitle || '',
    activity_context: context.aiActivityContext || '',
  }))
}

async function aiContextConfirmation(context: any) {
  const readiness = aiContextReadiness(context)

  if (!readiness.ready) {
    return {
      confirmed: false,
      required: false,
      confirmed_at: null,
    }
  }

  const currentHash = await aiContextHash(context)
  const storedHash = text(context.templateData.ai_context_confirmed_hash, 128)
  const confirmed = Boolean(storedHash && storedHash === currentHash)

  return {
    confirmed,
    required: !confirmed,
    confirmed_at: confirmed
      ? text(context.templateData.ai_context_confirmed_at, 80) || null
      : null,
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


async function isSuperAdminUser(c: any, userId: string): Promise<boolean> {
  try {
    const adminRow = await c.env.DB.prepare(
      `SELECT role FROM admin_users WHERE user_id = ? LIMIT 1`,
    ).bind(userId).first()

    if (String((adminRow as any)?.role || '') === 'super_admin') return true
  } catch {}

  try {
    const userRow = await c.env.DB.prepare(
      `SELECT email FROM users WHERE id = ? LIMIT 1`,
    ).bind(userId).first()

    const email = String((userRow as any)?.email || '').trim().toLowerCase()
    if (!email) return false

    const adminList = String(c.env.ADMIN_EMAILS || '')
      .split(',')
      .map((value: string) => value.trim().toLowerCase())
      .filter(Boolean)

    return adminList.includes(email)
  } catch {
    return false
  }
}

async function generationLimit(c: any, userId: string, limits: PlanLimits) {
  const row = await c.env.DB.prepare(
    `SELECT
       SUM(CASE WHEN created_at >= datetime('now','-1 day') AND status = 'success' THEN 1 ELSE 0 END) AS daily_count,
       SUM(CASE WHEN strftime('%Y-%m', created_at) = strftime('%Y-%m','now') AND status = 'success' THEN 1 ELSE 0 END) AS monthly_count,
       MAX(CASE WHEN status = 'success' THEN created_at ELSE NULL END) AS last_created_at
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

function buildInput(answers: Record<string, string>, followUp: Array<{ question: string; answer: string }>, conversation: Array<{ role: 'user' | 'assistant'; content: string }>, context: any, limits: PlanLimits, editingScope: EditingScope, mustFinalize: boolean) {
  const safeProfile = {
    name: context.name,
    category: context.category,
    subcategory: context.subcategory,
    professional_title: context.professionalTitle,
    activity_context_in_user_words: context.aiActivityContext,
    bio: context.bio,
    services_section_title: context.servicesSectionTitle,
    services_section_description: context.servicesSectionDescription,
    existing_services: context.services.map((s: ExistingService) => ({ id: s.id, title: s.title, description: s.description, has_image: s.has_image })),
    portfolio: context.portfolio.map((item: ExistingPortfolio, index: number) => ({ index: index + 1, id: item.id, title: item.title, description: item.description })),
  }
  return JSON.stringify({
    profile: safeProfile,
    configured_channels: context.configuredChannels,
    plan: { code: context.planId, limits },
    editing_scope: editingScope,
    field_limits: { name: 80, professional_title: 80, bio: 300, portfolio_max: limits.max_portfolio, portfolio_title: 80, portfolio_description: 90, services_max: limits.max_services, service_title: 60, service_description: 90, services_section_title: 60, services_section_description: 240 },
    answers,
    follow_up_answers: followUp,
    conversation,
    must_finalize: mustFinalize,
  })
}

const proposalSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    professional_title: { type: 'string' }, bio: { type: 'string' }, services_section_title: { type: 'string' }, services_section_description: { type: 'string' },
    services: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { id: { type: 'string' }, title: { type: 'string' }, description: { type: 'string' } }, required: ['id','title','description'] } },
    portfolio: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { id: { type: 'string' }, title: { type: 'string' }, description: { type: 'string' } }, required: ['id','title','description'] } },
    cta: { type: 'object', additionalProperties: false, properties: { label: { type: 'string' }, goal: { type: 'string', enum: ['contact','quote','book','visit','buy','learn_more'] } }, required: ['label','goal'] },
    image_suggestions: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { purpose: { type: 'string' }, suggestion: { type: 'string' } }, required: ['purpose','suggestion'] } },
  },
  required: ['professional_title','bio','services_section_title','services_section_description','services','portfolio','cta','image_suggestions'],
}

const responseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['ready','needs_more_info'] },
    proposal: { anyOf: [proposalSchema, { type: 'null' }] },
    questions: { anyOf: [{
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          question: { type: 'string' },
          kind: { type: 'string', enum: ['user_fact','general_knowledge','platform_knowledge','already_available','strategy'] },
        },
        required: ['question','kind'],
      },
    }, { type: 'null' }] },
  },
  required: ['status','proposal','questions'],
}

const EDITORIAL_INSTRUCTIONS = [
  'ROL: Eres el estratega de presentación, posicionamiento y copy de Kawvo Link. No eres un rellenador de campos, un chatbot genérico ni un generador de frases bonitas.',
  'MISIÓN KAWVO: un Perfil Digital Kawvo es una carta de presentación digital. En pocos segundos el visitante debe entender quién es la persona o negocio, qué hace, qué necesidad puede resolverle o qué valor aporta, por qué puede ser relevante y cuál es el siguiente paso. La meta no es vender por vender: es presentar mejor, comunicar valor con claridad, generar confianza y facilitar la siguiente acción.',
  'SUFICIENCIA Y AUTONOMÍA: analiza primero todo el perfil, respuestas y conversación. Si puedes producir una propuesta útil, específica y creíble, hazlo sin pedir permiso adicional. No preguntes para completar una plantilla mental. Solo devuelve needs_more_info cuando avanzar obligaría a inventar un hecho importante o cuando una aclaración pueda cambiar materialmente la propuesta. Normalmente haz una sola pregunta; usa hasta tres solo si son realmente imprescindibles. Nunca repitas algo ya guardado, ya respondido o inferible de forma razonable.',
  'CONOCIMIENTO GENERAL: puedes usar libremente tu conocimiento general sobre profesiones, industrias, servicios, marketing, comportamiento del cliente, comunicación y buenas prácticas de copy para comprender el contexto, escoger vocabulario natural del sector, identificar beneficios razonablemente derivados y mejorar la presentación. Ese conocimiento sirve para interpretar y redactar; nunca lo conviertas en un hecho particular del usuario sin respaldo.',
  'PREGUNTAS SOLO POR HECHOS DEL USUARIO: una pregunta de seguimiento solo se justifica cuando falta un hecho personal, comercial u operativo que únicamente el usuario puede confirmar y cuya ausencia impide redactar de forma segura. No preguntes al usuario qué significa un concepto general, una categoría comercial, una expresión de marketing, una profesión, un tipo de solución o una funcionalidad que puedas comprender razonablemente usando el perfil, el contexto disponible y conocimiento general.',
  'CLASIFICACIÓN OBLIGATORIA DE PREGUNTAS: si status=needs_more_info, cada elemento de questions debe incluir question y kind. Usa user_fact únicamente si la respuesta es un hecho particular de esta persona o negocio que solo ese usuario puede confirmar y que sea realmente necesario para evitar inventar. Usa general_knowledge para conceptos o conocimiento general; platform_knowledge para información sobre Kawvo o la plataforma; already_available si ya está en profile, answers, follow_up_answers o conversation; strategy si estás intentando delegar al usuario una decisión de copy, posicionamiento o jerarquía que debes resolver tú. Solo las preguntas user_fact pueden mostrarse al usuario.',
  'EXPRESIONES AMPLIAS: si el usuario usa una expresión como presentación digital completa, solución integral, servicio completo, atención personalizada o similar, no le pidas que defina la expresión solo para poder redactar. Interprétala como una idea general y escribe únicamente con los hechos concretos ya respaldados. Si no conoces componentes específicos, no los enumeres ni los inventes; redacta a un nivel de generalidad seguro.',
  'NO PREGUNTES POR LA PROPIA SOLUCIÓN KAWVO: no delegues al usuario la tarea de explicarte conceptos, estructura, beneficios genéricos o lógica de un Perfil Digital Kawvo cuando puedan resolverse con las instrucciones del sistema y el contexto disponible. Pregunta únicamente por información particular de su negocio, actividad, cliente, servicio, preferencia o situación que no puedas conocer de otro modo.',
  'NO DELEGUES LA ESTRATEGIA: no preguntes al usuario qué valor quiere reflejar, qué beneficio quiere comunicar, cómo quiere posicionarse, qué mensaje debería transmitir ni qué lo hace diferente cuando eso pueda deducirse razonablemente del perfil y de sus respuestas. El usuario aporta hechos, contexto y preferencias básicas; tú haces el trabajo de análisis, posicionamiento, jerarquía y copy.',
  'CONTEXTO EN PALABRAS DEL USUARIO: profile.activity_context_in_user_words contiene una explicación privada escrita libremente por el usuario sobre lo que hace. Trátala como fuente factual y de intención, no como copy final. Puede estar escrita de forma informal, incompleta o poco profesional: comprende su significado y conviértelo en comunicación clara sin inventar hechos.',
  'CONVERSACIÓN: conversation contiene el hilo de esta sesión. Úsalo como memoria de trabajo. Integra todas las respuestas previas y nunca vuelvas a preguntar lo ya respondido. follow_up_answers contiene las respuestas de la pantalla actual y también debe considerarse contexto confirmado.',
  'ÚLTIMA RONDA: si must_finalize=true, produce la mejor propuesta posible con la información disponible. No devuelvas needs_more_info salvo que hacerlo implique inventar un hecho esencial que haga insegura o engañosa la propuesta.',
  'HECHOS E INFERENCIAS: distingue hechos confirmados, inferencias razonables y redacción comercial. Puedes inferir beneficios directos y evidentes, pero nunca convertir una posibilidad en una promesa. Nunca inventes certificaciones, experiencia, años, precios, ubicaciones, clientes, marcas, garantías, capacidades, resultados, ventajas competitivas, servicios, disponibilidad ni tiempos de entrega.',
  'INTERPRETACIÓN EDITORIAL: las respuestas del usuario son materia prima factual, no texto final para copiar. NO INVENTAR no significa transcribir literalmente ni escribir con miedo. Puedes reinterpretar, condensar, jerarquizar, combinar y reformular los hechos para encontrar una manera más clara, atractiva y estratégica de presentarlos. Busca primero cuál es el ángulo más fuerte de la propuesta y escribe desde ese ángulo. Puedes expresar beneficios razonablemente derivados, problemas que el producto o servicio ayuda a reducir y valor práctico evidente, siempre que no los conviertas en hechos específicos no respaldados. Evita repetir las mismas palabras del usuario cuando exista una forma más natural, poderosa o memorable de comunicar la misma idea.',
  'PERSPECTIVA: piensa desde el visitante y desde la impresión que debe dejar el perfil. No resumas mecánicamente ni respetes el orden de entrada. Antes de redactar, identifica internamente qué idea merece protagonismo, qué tensión o necesidad del visitante conecta mejor con la oferta y cuál es la forma más distintiva de explicarla usando los hechos disponibles. Después construye el copy alrededor de esa idea principal. Esto aplica solo al copy; nunca sugieras reorganizar visualmente botones, módulos, secciones o servicios.',
  'SECTOR: adapta vocabulario, tono, prioridad y forma de describir servicios a la actividad. Escribe en español natural, profesional y cercano para República Dominicana, sin jerga local innecesaria salvo que el tono del usuario la justifique.',
  'COPY: cada frase debe explicar, posicionar, diferenciar, generar interés, transmitir confianza, mostrar valor o facilitar una acción. Escribe como un buen estratega de marca y copywriter humano, no como un formulario que rellena campos. La redacción puede tener personalidad, ritmo, contraste, síntesis y una idea memorable cuando el contexto lo permita. Evita construcciones de plantilla como propuesta pensada para, solución diseñada para, presencia clara para mostrar lo que haces, te ayudamos a, una forma práctica de o similares cuando puedan reemplazarse por una expresión más específica. Evita lenguaje infantil, robótico, académico, excesivamente formal, exageradamente publicitario o genérico. Evita frases vacías como calidad y confianza, somos tu mejor opción, soluciones a tu medida, servicio personalizado, excelencia garantizada o comprometidos con nuestros clientes salvo respaldo concreto.',
  'LIBERTAD CREATIVA CONTROLADA: para professional_title, bio, services_section_title, services_section_description y CTA tienes libertad editorial real. No estás obligado a conservar la estructura, orden, vocabulario ni tono literal del texto existente. Puedes cambiar el enfoque, el punto de entrada y la manera de expresar el valor si el resultado representa mejor los mismos hechos. Piensa varias formulaciones internamente y entrega solo la más fuerte. La creatividad está limitada por los hechos, no por la redacción original.',
  'COHERENCIA: la propuesta cuenta una sola historia. professional_title posiciona; bio explica valor; servicios demuestran qué puede hacer; CTA indica el siguiente paso. Evita redundancia entre campos.',
  'TÍTULO: corto, específico y fácil de comprender. Puede usar especialidad + enfoque si está respaldado. Evita Emprendedor, Servicios profesionales o Soluciones integrales cuando exista algo más concreto.',
  'BIO: normalmente 2 o 3 frases breves. Explica qué hace, en qué situación ayuda, para quién y qué valor práctico obtiene el cliente cuando el contexto lo permita. No sobrecargues ni repitas servicios. Evita aperturas automáticas tipo Somos una empresa dedicada, En [nombre] realizamos o Nos especializamos en ofrecer.',
  'LÍMITES REALES: respeta field_limits exactamente. Nombre y título/puesto 80; bio 300; portafolio máximo 5, título 80 y descripción 90; servicios máximo 3, título 60 y descripción 90; título de sección de servicios 60 y descripción general 240; CTA máximo 45. Cada texto debe nacer terminado dentro de su límite. Nunca redactes una frase más larga esperando que el sistema la recorte. Si necesitas acortar, reescribe y cierra la idea naturalmente dentro del máximo permitido.',
  'ALCANCE DE EDICIÓN: editing_scope=missing_only significa conservar todo campo ya completado y proponer contenido únicamente para vacíos; puedes usar lo existente como contexto. editing_scope=full_profile permite proponer mejoras de texto, pero nunca modifica imágenes, URLs, canales, cuentas bancarias, diseño ni orden. El nombre no se cambia por IA en ningún alcance.',
  'TRABAJOS/PORTAFOLIO: actúa únicamente como optimizador de texto ya escrito por el usuario. Tú NO ves los píxeles de las imágenes. Conserva exactamente cada id recibido. Si el título existente tiene texto, puedes mejorarlo sin cambiar su significado; si está vacío, debe permanecer vacío. Si la descripción existente tiene texto, puedes mejorar redacción, claridad y presentación sin añadir hechos nuevos; si está vacía, debe permanecer vacía. Nunca generes título o descripción desde cero, nunca completes un campo vacío y nunca deduzcas contenido de la foto. No elimines, reemplaces, reordenes ni cruces datos entre trabajos. En missing_only conserva portfolio sin cambios; en full_profile optimiza únicamente campos que ya contienen texto.',
  'SERVICIOS: actúa únicamente como optimizador de los servicios ya creados por el usuario. Conserva exactamente cada id recibido y el mismo orden. No crees servicios nuevos ni elimines servicios existentes. Si el título existente tiene texto, puedes mejorarlo sin cambiar el servicio real; si está vacío, debe permanecer vacío. Si la descripción existente tiene texto, puedes mejorar claridad, utilidad y redacción sin añadir hechos nuevos; si está vacía, debe permanecer vacía. En missing_only conserva los servicios sin cambios; en full_profile optimiza únicamente campos que ya contienen texto. Respeta siempre los límites de caracteres.',
  'SECCIÓN SERVICIOS: prefiere un título específico cuando surja natural; no fuerces creatividad. Si lo creativo suena artificial usa algo simple y claro. La descripción introduce desde necesidad, beneficio o contexto, sin repetir ni rellenar.',
  'CTA Y CANALES: configured_channels informa qué canales existen, pero no obliga a elegir uno. Redacta un CTA compatible con la intención y con los canales disponibles. Si no hace falta un canal concreto, usa una acción genérica y útil como solicitar cotización, reservar o contactar. Pregunta por preferencia de canal únicamente cuando necesites saber literalmente qué medio prefiere el usuario para recibir contactos y esa elección cambie materialmente la propuesta. La mera aparición de palabras como contacto, WhatsApp, correo, llamada o ubicación en otro contexto no convierte una pregunta en una pregunta de canal.',
  'IMÁGENES: image_suggestions son recomendaciones textuales, nunca generación ni modificación. Sugiere qué mostrar y por qué ayuda al visitante. Prioriza fotos reales del profesional, negocio, proceso, producto, trabajo realizado o resultado cuando sea pertinente.',
  'CONTENIDO EXISTENTE: si ya es bueno conserva su esencia y mejora claridad, estructura, posicionamiento, lectura móvil y conversión. No reemplaces por cambiar.',
  'MÓVIL: frases cortas, palabras concretas, jerarquía clara, lectura rápida y cero relleno.',
  'REVISIÓN SILENCIOSA antes de ready: claridad, especificidad, credibilidad, diferenciación, beneficio, conversión, lectura móvil, coherencia, ausencia de redundancia y fidelidad a los hechos. Si el texto podría servir sin cambios a cien negocios, hazlo más específico usando solo el contexto disponible.',
  'SALIDA: devuelve exclusivamente JSON válido conforme al esquema. La raíz siempre contiene status, proposal y questions. Si status=ready, proposal contiene la propuesta y questions=null. Si status=needs_more_info, proposal=null y questions contiene 1 a 3 preguntas. No HTML, Markdown, comentarios, explicaciones ni razonamiento interno.',
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
       FROM ai_profile_assistant_usage WHERE user_id = ? AND operation = 'generate' AND status = 'success'`,
    ).bind(userId).first()
  } catch {
    return c.json({ ok: false, error: 'La función de IA requiere terminar su configuración de datos.' }, 503)
  }
  const limits = planLimits(c, context.planId)
  const unlimitedAi = await isSuperAdminUser(c, userId)
  const contextReadiness = aiContextReadiness(context)
  const contextConfirmation = await aiContextConfirmation(context)
  return c.json({ ok: true, data: {
    beta: true,
    context_readiness: contextReadiness,
    context_confirmation: contextConfirmation,
    consent: { required: !consent.accepted, accepted: consent.accepted, terms_version: consent.termsVersion },
    profile: {
      slug: context.slug, name: context.name, category: context.category,
      subcategory: context.subcategory,
      professional_title: context.professionalTitle,
      activity_context: context.aiActivityContext,
      bio: context.bio,
      services_section_title: context.servicesSectionTitle,
      services_section_description: context.servicesSectionDescription,
      services: context.services, portfolio: context.portfolio, contact: context.contact,
      configured_channels: context.configuredChannels,
    },
    plan: { code: context.planId, limits, upgrade_available: context.planId === 'free' },
    usage: {
      unlimited: unlimitedAi,
      daily: Number((usage as any)?.daily_count || 0), monthly: Number((usage as any)?.monthly_count || 0),
      remaining_today: unlimitedAi ? null : Math.max(0, limits.ai_daily_generations - Number((usage as any)?.daily_count || 0)),
      remaining_month: unlimitedAi ? null : Math.max(0, limits.ai_monthly_generations - Number((usage as any)?.monthly_count || 0)),
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

app.post('/api/v1/me/ai-profile-assistant/context/update', requireAssistantAuth, async (c: any) => {
  const userId = c.get('userId') as string
  const context = await ownerContext(c, userId)
  if (!context) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  let consent
  try {
    consent = await termsAccepted(c, userId)
  } catch {
    return c.json({ ok: false, error: 'La función de IA requiere terminar su configuración de datos.' }, 503)
  }

  if (!consent.accepted) {
    return c.json({
      ok: false,
      error: 'Debes aceptar las condiciones del Asistente IA antes de completar este contexto.',
      code: 'consent_required',
    }, 428)
  }

  let body: any
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, error: 'Solicitud no válida.' }, 400)
  }

  const hasCategory = Object.prototype.hasOwnProperty.call(body || {}, 'category')
  const hasSubcategory = Object.prototype.hasOwnProperty.call(body || {}, 'subcategory')
  const hasProfessionalTitle = Object.prototype.hasOwnProperty.call(body || {}, 'professional_title')
  const hasActivityContext = Object.prototype.hasOwnProperty.call(body || {}, 'activity_context')

  const nextCategory = hasCategory ? text(body.category, 120) : context.category
  const nextSubcategory = hasSubcategory ? text(body.subcategory, 120) : context.subcategory
  const nextProfessionalTitle = hasProfessionalTitle
    ? text(body.professional_title, 80)
    : context.professionalTitle
  const nextActivityContext = hasActivityContext
    ? text(body.activity_context, 500)
    : context.aiActivityContext

  const nextTemplateData: Record<string, unknown> = {
    ...context.templateData,
    role: nextProfessionalTitle,
    ai_activity_context: nextActivityContext,
  }

  delete nextTemplateData.ai_context_confirmed_hash
  delete nextTemplateData.ai_context_confirmed_at

  await c.env.DB.prepare(
    `UPDATE profiles
        SET category = ?,
            subcategory = ?,
            template_data = ?,
            updated_at = datetime('now')
      WHERE id = ? AND user_id = ?`,
  ).bind(
    nextCategory,
    nextSubcategory,
    JSON.stringify(nextTemplateData),
    context.profileId,
    userId,
  ).run()

  const updatedContext = await ownerContext(c, userId)
  if (!updatedContext) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  return c.json({
    ok: true,
    data: {
      context_readiness: aiContextReadiness(updatedContext),
      context_confirmation: await aiContextConfirmation(updatedContext),
    },
  })
})

app.post('/api/v1/me/ai-profile-assistant/context/confirm', requireAssistantAuth, async (c: any) => {
  const userId = c.get('userId') as string
  const context = await ownerContext(c, userId)
  if (!context) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  let consent
  try {
    consent = await termsAccepted(c, userId)
  } catch {
    return c.json({ ok: false, error: 'La función de IA requiere terminar su configuración de datos.' }, 503)
  }

  if (!consent.accepted) {
    return c.json({
      ok: false,
      error: 'Debes aceptar las condiciones del Asistente IA antes de confirmar tu contexto.',
      code: 'consent_required',
    }, 428)
  }

  const readiness = aiContextReadiness(context)

  if (!readiness.ready) {
    return c.json({
      ok: false,
      error: 'Completa primero los datos básicos de tu actividad.',
      code: 'ai_context_incomplete',
      context_readiness: readiness,
    }, 422)
  }

  const contextHash = await aiContextHash(context)
  const confirmedAt = new Date().toISOString()
  const nextTemplateData = {
    ...context.templateData,
    ai_context_confirmed_hash: contextHash,
    ai_context_confirmed_at: confirmedAt,
  }

  await c.env.DB.prepare(
    `UPDATE profiles
        SET template_data = ?, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?`,
  ).bind(
    JSON.stringify(nextTemplateData),
    context.profileId,
    userId,
  ).run()

  return c.json({
    ok: true,
    data: {
      confirmed: true,
      required: false,
      confirmed_at: confirmedAt,
    },
  })
})

app.post('/api/v1/me/ai-profile-assistant/generate', requireAssistantAuth, async (c: any) => {
  const userId = c.get('userId') as string
  const context = await ownerContext(c, userId)
  if (!context) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)
  let consent
  try { consent = await termsAccepted(c, userId) } catch { return c.json({ ok: false, error: 'La función de IA requiere terminar su configuración de datos.' }, 503) }
  if (!consent.accepted) return c.json({ ok: false, error: 'Para utilizar el Asistente IA de Kawvo debes aceptar sus condiciones de uso.', code: 'consent_required' }, 428)

  const contextReadiness = aiContextReadiness(context)
  if (!contextReadiness.ready) {
    return c.json({
      ok: false,
      error: 'Antes de usar la IA necesitamos conocer un poco mejor tu actividad.',
      code: 'ai_context_incomplete',
      context_readiness: contextReadiness,
    }, 422)
  }

  const contextConfirmation = await aiContextConfirmation(context)
  if (!contextConfirmation.confirmed) {
    return c.json({
      ok: false,
      error: 'Confirma que la información que Kawvo conoce de ti está correcta antes de continuar.',
      code: 'ai_context_confirmation_required',
      context_confirmation: contextConfirmation,
    }, 428)
  }

  if (!c.env.OPENAI_API_KEY) {
    await insertUsage(c, { userId, profileId: context.profileId, operation: 'generate', status: 'blocked', errorCode: 'missing_secret' })
    return c.json({ ok: false, error: 'La ayuda con IA todavía no está configurada.' }, 503)
  }

  let body: any
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Solicitud no válida.' }, 400) }
  const round = numericEnv(body?.round, 1, 1, 99)
  const editingScope: EditingScope = body?.editing_scope === 'full_profile' ? 'full_profile' : 'missing_only'
  const limits = planLimits(c, context.planId)
  if (round > limits.ai_max_rounds) return c.json({ ok: false, error: 'Ya utilizaste las rondas de información disponibles para esta propuesta.', code: 'round_limit' }, 429)

  const rawAnswers = objectValue(body?.answers)
  const keys = ['activity_details','services_details','clients','preferred_contact','next_action','extra_context']
  const answers: Record<string,string> = {}
  for (const key of keys) answers[key] = text(rawAnswers[key], MAX_ANSWER_LENGTH)
  const followUp: FollowUpAnswer[] = Array.isArray(body?.follow_up_answers)
    ? body.follow_up_answers.slice(0, 3).map((item: any) => ({ question: text(item?.question, 180), answer: text(item?.answer, MAX_ANSWER_LENGTH) })).filter((item: FollowUpAnswer) => item.question && item.answer)
    : []
  const conversation: Array<{ role: 'user' | 'assistant'; content: string }> = Array.isArray(body?.conversation)
    ? body.conversation.slice(-12).map((item: any) => ({ role: item?.role === 'assistant' ? 'assistant' as const : 'user' as const, content: text(item?.content, 700) })).filter((item: any) => item.content)
    : []
  const totalLength = Object.values(answers).reduce((sum: number, value: string) => sum + value.length, 0) + followUp.reduce((sum: number, value: FollowUpAnswer) => sum + value.question.length + value.answer.length, 0) + conversation.reduce((sum: number, value) => sum + value.content.length, 0)
  const hasExistingContent = Boolean(context.bio || context.professionalTitle || context.services.length)
  if (totalLength < 8 && !hasExistingContent) return c.json({ ok: false, error: 'Cuéntanos un poco más para preparar una propuesta útil.' }, 400)
  if (totalLength > MAX_TOTAL_INPUT_LENGTH) return c.json({ ok: false, error: 'La información es demasiado extensa. Resume un poco tus respuestas.' }, 413)

  const unlimitedAi = await isSuperAdminUser(c, userId)

  if (!unlimitedAi) {
    let limit: any
    try { limit = await generationLimit(c, userId, limits) } catch { return c.json({ ok: false, error: 'La función de IA requiere terminar su configuración de datos.' }, 503) }
    if (!limit.allowed) {
      await insertUsage(c, { userId, profileId: context.profileId, operation: 'generate', status: 'blocked', errorCode: limit.reason })
      c.header('Retry-After', String(limit.retryAfter || 60))
      return c.json({ ok: false, error: limit.reason === 'cooldown' ? 'Espera unos segundos antes de generar otra propuesta.' : 'Alcanzaste el límite disponible del Asistente IA por ahora.', code: limit.reason, retry_after_seconds: limit.retryAfter }, 429)
    }
  }

  const model = text(c.env.OPENAI_MODEL || DEFAULT_MODEL, 80) || DEFAULT_MODEL
  const safetyIdentifier = (await sha256Hex(`kawvo:${userId}`)).slice(0,64)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 40_000)
  try {
    const callAssistant = async (forceFinalize: boolean, internalRetry = false) => {
      const retryInstruction = internalRetry
        ? '\nBARRERA SERVER-SIDE GLOBAL: una aclaración anterior fue descartada porque no pedía un hecho particular que solo este usuario pudiera confirmar. No repitas esa clase de pregunta. Usa el perfil, las respuestas, la conversación y conocimiento general para resolver conceptos, estrategia, jerarquía y contexto de plataforma. Produce la mejor propuesta posible. Solo devuelve needs_more_info si falta un user_fact esencial para no inventar.'
        : ''

      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { Authorization: `Bearer ${c.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model, store: false, safety_identifier: safetyIdentifier, max_output_tokens: MAX_OUTPUT_TOKENS,
          reasoning: { effort: 'none' },
          text: { verbosity: 'medium', format: { type: 'json_schema', name: 'kawvo_profile_assistant_result', strict: true, schema: responseSchema } },
          instructions: EDITORIAL_INSTRUCTIONS + retryInstruction,
          input: buildInput(answers, followUp, conversation, context, limits, editingScope, forceFinalize),
        }),
      })

      const payload: any = await response.json().catch(() => ({}))
      return { response, payload }
    }

    let totalInputTokens = 0
    let totalOutputTokens = 0

    let { response, payload } = await callAssistant(round >= limits.ai_max_rounds)
    let usage = payload?.usage || {}
    totalInputTokens += Number(usage.input_tokens || 0)
    totalOutputTokens += Number(usage.output_tokens || 0)

    if (!response.ok) {
      const errorCode = text(payload?.error?.code || `openai_${response.status}`,80)
      await insertUsage(c,{ userId,profileId:context.profileId,operation:'generate',status:'error',model,inputTokens:totalInputTokens,outputTokens:totalOutputTokens,errorCode })
      if (response.status === 429) return c.json({ ok:false,error:'La IA está recibiendo muchas solicitudes. Intenta nuevamente en un momento.' },503)
      return c.json({ ok:false,error:'No pudimos preparar la propuesta con IA. Tu perfil no fue modificado.' },502)
    }
    if (payload?.status && payload.status !== 'completed') {
      await insertUsage(c,{ userId,profileId:context.profileId,operation:'generate',status:'error',model,inputTokens:totalInputTokens,outputTokens:totalOutputTokens,errorCode:`response_${text(payload.status,40)}` })
      return c.json({ ok:false,error:'La propuesta no pudo completarse. Tu perfil sigue sin cambios.' },502)
    }

    let parsed: any = null
    try { parsed = JSON.parse(responseText(payload)) } catch {}
    let result = validateAssistantResult(parsed, limits.max_services, limits.max_portfolio)

    if (!result) {
      await insertUsage(c,{ userId,profileId:context.profileId,operation:'generate',status:'error',model,inputTokens:totalInputTokens,outputTokens:totalOutputTokens,errorCode:'invalid_structured_output' })
      return c.json({ ok:false,error:'La respuesta de IA llegó incompleta. Tu perfil sigue sin cambios.' },502)
    }

    const blockedNonUserFollowUp = result.status === 'needs_more_info'
      && result.questions.length === 0

    if (blockedNonUserFollowUp) {
      ;({ response, payload } = await callAssistant(true, true))
      usage = payload?.usage || {}
      totalInputTokens += Number(usage.input_tokens || 0)
      totalOutputTokens += Number(usage.output_tokens || 0)

      if (!response.ok) {
        const errorCode = `clarification_retry_${text(payload?.error?.code || `openai_${response.status}`,60)}`
        await insertUsage(c,{ userId,profileId:context.profileId,operation:'generate',status:'error',model,inputTokens:totalInputTokens,outputTokens:totalOutputTokens,errorCode })
        return c.json({ ok:false,error:'No pudimos terminar la propuesta con la información disponible. Tu perfil no fue modificado.' },502)
      }
      if (payload?.status && payload.status !== 'completed') {
        await insertUsage(c,{ userId,profileId:context.profileId,operation:'generate',status:'error',model,inputTokens:totalInputTokens,outputTokens:totalOutputTokens,errorCode:`clarification_retry_response_${text(payload.status,40)}` })
        return c.json({ ok:false,error:'No pudimos terminar la propuesta con la información disponible. Tu perfil no fue modificado.' },502)
      }

      parsed = null
      try { parsed = JSON.parse(responseText(payload)) } catch {}
      result = validateAssistantResult(parsed, limits.max_services, limits.max_portfolio)

      if (!result) {
        await insertUsage(c,{ userId,profileId:context.profileId,operation:'generate',status:'error',model,inputTokens:totalInputTokens,outputTokens:totalOutputTokens,errorCode:'clarification_retry_invalid_output' })
        return c.json({ ok:false,error:'No pudimos terminar la propuesta con la información disponible. Tu perfil no fue modificado.' },502)
      }

      if (result.status === 'needs_more_info' && result.questions.length === 0) {
        await insertUsage(c,{ userId,profileId:context.profileId,operation:'generate',status:'error',model,inputTokens:totalInputTokens,outputTokens:totalOutputTokens,errorCode:'blocked_non_user_follow_up' })
        return c.json({ ok:false,error:'No pudimos completar la propuesta sin una aclaración válida. Intenta nuevamente; tu perfil no fue modificado.' },502)
      }
    }

    const estimatedCost = await insertUsage(c,{ userId,profileId:context.profileId,operation:'generate',status:'success',model,inputTokens:totalInputTokens,outputTokens:totalOutputTokens })
    return c.json({ ok:true,data:{ ...result, round, usage:{ model,input_tokens:totalInputTokens,output_tokens:totalOutputTokens,estimated_cost_usd:estimatedCost }, plan:{ code:context.planId, limits } } })
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
  const editingScope: EditingScope = body?.editing_scope === 'full_profile' ? 'full_profile' : 'missing_only'
  const proposal = validateProposal(body?.proposal, limits.max_services, limits.max_portfolio)
  if (!proposal) return c.json({ ok:false,error:'La propuesta no es válida.' },400)
  const apply = objectValue(body?.apply)
  const applyIdentity = Boolean(apply.identity)
  const applyBio = Boolean(apply.bio)
  const applyServicesSection = Boolean(apply.services_section)
  const applyServices = Boolean(apply.services)
  const applyPortfolio = Boolean(apply.portfolio)
  const confirmExistingServicesUpdate = body?.replace_existing_services === true
  if (!applyIdentity && !applyBio && !applyServicesSection && !applyServices && !applyPortfolio) return c.json({ ok:false,error:'Selecciona al menos un cambio para aplicar.' },400)
  if (editingScope === 'full_profile' && applyServices && context.services.length > 0 && !confirmExistingServicesUpdate) return c.json({ ok:false,error:'Confirma explícitamente si deseas actualizar el texto de tus servicios actuales.',code:'replace_services_confirmation_required' },409)

  const effectiveIdentity = applyIdentity && (editingScope === 'full_profile' || !context.professionalTitle)
  const effectiveBio = applyBio && (editingScope === 'full_profile' || !context.bio)
  const effectiveServices = applyServices && editingScope === 'full_profile' && context.services.length > 0
  const effectivePortfolio = applyPortfolio && editingScope === 'full_profile' && context.portfolio.length > 0

  const nextTemplateData = { ...context.templateData }
  if (effectiveIdentity) { nextTemplateData.role = proposal.professional_title; nextTemplateData.free_identity_confirmed = true }
  if (applyServicesSection) {
    if (editingScope === 'full_profile' || !context.servicesSectionTitle) nextTemplateData.services_section_title = proposal.services_section_title
    if (editingScope === 'full_profile' || !context.servicesSectionDescription) nextTemplateData.services_section_description = proposal.services_section_description
  }
  const statements:any[] = []
  if (effectiveIdentity || effectiveBio || applyServicesSection) {
    statements.push(c.env.DB.prepare(`UPDATE profiles SET bio = CASE WHEN ? = 1 THEN ? ELSE bio END, template_data = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`).bind(effectiveBio?1:0,proposal.bio,JSON.stringify(nextTemplateData),context.profileId,userId))
  }
  if (effectiveServices) {
    const servicesById = new Map(context.services.map((item: ExistingService) => [item.id, item]))
    for (const service of proposal.services.slice(0, limits.max_services)) {
      const existing = servicesById.get(service.id)
      if (!existing) continue
      const nextTitle = existing.title ? (service.title || existing.title) : existing.title
      const nextDescription = existing.description ? (service.description || existing.description) : existing.description
      if (nextTitle !== existing.title || nextDescription !== existing.description) {
        statements.push(c.env.DB.prepare(`UPDATE profile_products SET title = ?, description = ? WHERE id = ? AND profile_id = ?`).bind(nextTitle,nextDescription,existing.id,context.profileId))
      }
    }
  }
  if (effectivePortfolio) {
    const portfolioById = new Map(context.portfolio.map((item: ExistingPortfolio) => [item.id, item]))
    for (const item of proposal.portfolio.slice(0, limits.max_portfolio)) {
      const existing = portfolioById.get(item.id)
      if (!existing) continue
      const nextTitle = existing.title ? (item.title || existing.title) : existing.title
      const nextDescription = existing.description ? (item.description || existing.description) : existing.description
      if (nextTitle !== existing.title || nextDescription !== existing.description) {
        statements.push(c.env.DB.prepare(`UPDATE profile_gallery SET title = ?, description = ? WHERE id = ? AND profile_id = ?`).bind(nextTitle,nextDescription,existing.id,context.profileId))
      }
    }
  }
  try { if (statements.length) await c.env.DB.batch(statements) } catch {
    await insertUsage(c,{ userId,profileId:context.profileId,operation:'apply',status:'error',errorCode:'db_write_failed' })
    return c.json({ ok:false,error:'No pudimos aplicar los cambios. Tu perfil anterior se mantiene.' },500)
  }
  await insertUsage(c,{ userId,profileId:context.profileId,operation:'apply',status:'success' })
  return c.json({ ok:true,data:{ applied:{ identity:effectiveIdentity,bio:effectiveBio,services_section:applyServicesSection,services:effectiveServices,portfolio:effectivePortfolio }, editing_scope:editingScope, published:false, services_preserved:effectiveServices && context.services.length>0, note:'Aplicar modifica únicamente los campos seleccionados. No publica, no cambia plantilla, colores, orden de botones, orden de secciones ni canales.' } })
})
