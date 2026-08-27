import app from './preview-entry'
import { cookieNames } from './lib/cookies'

const DEFAULT_MODEL = 'gpt-5.6-luna'
const MAX_ANSWER_LENGTH = 700
const MAX_TOTAL_INPUT_LENGTH = 2800
const MAX_GENERATIONS_PER_DAY = 8
const COOLDOWN_SECONDS = 20
const MAX_OUTPUT_TOKENS = 1400
const INPUT_USD_PER_MILLION = 0.20
const OUTPUT_USD_PER_MILLION = 1.20

type AssistantProposal = {
  professional_title: string
  bio: string
  services_section_title: string
  services_section_description: string
  services: Array<{ title: string; description: string }>
  cta: { label: string; goal: 'contact' | 'quote' | 'book' | 'visit' | 'buy' | 'learn_more' }
}

type ExistingService = {
  id: string
  title: string
  description: string
  has_image: boolean
}

function parseCookie(header: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = header.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash)).map((value) => value.toString(16).padStart(2, '0')).join('')
}

async function requireAssistantAuth(c: any, next: any) {
  const rawSession = parseCookie(c.req.header('Cookie') || '', cookieNames(c.env).session)
  if (!rawSession) return c.json({ ok: false, error: 'Unauthorized' }, 401)

  const sessionHash = await sha256Hex(rawSession)
  const session = await c.env.DB.prepare(
    `SELECT user_id
       FROM auth_sessions
      WHERE session_hash = ?
        AND expires_at > datetime('now')
        AND revoked_at IS NULL
      LIMIT 1`,
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

function validateProposal(raw: unknown): AssistantProposal | null {
  const value = objectValue(raw)
  const cta = objectValue(value.cta)
  const allowedGoals = new Set(['contact', 'quote', 'book', 'visit', 'buy', 'learn_more'])
  const goal = allowedGoals.has(String(cta.goal)) ? String(cta.goal) as AssistantProposal['cta']['goal'] : 'contact'
  const services = Array.isArray(value.services)
    ? value.services.slice(0, 3).map((item: any) => ({
        title: text(item?.title, 60),
        description: text(item?.description, 90),
      })).filter((item: any) => item.title && item.description)
    : []

  const proposal: AssistantProposal = {
    professional_title: text(value.professional_title, 80),
    bio: text(value.bio, 300),
    services_section_title: text(value.services_section_title, 60),
    services_section_description: text(value.services_section_description, 240),
    services,
    cta: { label: text(cta.label, 45), goal },
  }

  if (!proposal.professional_title || !proposal.bio || !proposal.services_section_title || !proposal.cta.label || services.length < 1) return null
  return proposal
}

async function ownerContext(c: any, userId: string) {
  const profile = await c.env.DB.prepare(
    `SELECT id, slug, plan_id, name, bio, category, template_data
       FROM profiles
      WHERE user_id = ?
      LIMIT 1`,
  ).bind(userId).first()
  if (!profile) return null

  const profileId = String((profile as any).id)
  const [servicesResult, contact] = await Promise.all([
    c.env.DB.prepare(
      `SELECT id, title, description, image_url, sort_order
         FROM profile_products
        WHERE profile_id = ?
        ORDER BY sort_order ASC, created_at ASC
        LIMIT 10`,
    ).bind(profileId).all(),
    c.env.DB.prepare(
      `SELECT whatsapp, email, phone, address
         FROM profile_contact
        WHERE profile_id = ?
        LIMIT 1`,
    ).bind(profileId).first(),
  ])

  const templateData = parseObject((profile as any).template_data)
  const services: ExistingService[] = (servicesResult.results as any[]).map((row) => ({
    id: String(row.id),
    title: text(row.title, 60),
    description: text(row.description, 90),
    has_image: Boolean(row.image_url),
  }))

  return {
    profileId,
    slug: String((profile as any).slug || ''),
    planId: String((profile as any).plan_id || 'free'),
    name: text((profile as any).name, 80),
    bio: text((profile as any).bio, 300),
    category: text((profile as any).category, 120),
    professionalTitle: text(templateData.role || templateData.title, 80),
    templateData,
    services,
    contact: {
      whatsapp: text((contact as any)?.whatsapp, 80),
      email: text((contact as any)?.email, 120),
      phone: text((contact as any)?.phone, 80),
      address: text((contact as any)?.address, 180),
    },
  }
}

async function insertUsage(c: any, data: {
  userId: string
  profileId: string
  operation: 'generate' | 'apply'
  status: 'success' | 'error' | 'blocked'
  model?: string
  inputTokens?: number
  outputTokens?: number
  errorCode?: string | null
}) {
  const inputTokens = Math.max(0, Number(data.inputTokens || 0))
  const outputTokens = Math.max(0, Number(data.outputTokens || 0))
  const estimatedCost = (inputTokens * INPUT_USD_PER_MILLION + outputTokens * OUTPUT_USD_PER_MILLION) / 1_000_000
  try {
    await c.env.DB.prepare(
      `INSERT INTO ai_profile_assistant_usage
        (id, user_id, profile_id, operation, status, model, input_tokens, output_tokens, estimated_cost_usd, error_code, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    ).bind(
      crypto.randomUUID(), data.userId, data.profileId, data.operation, data.status,
      data.model || null, inputTokens, outputTokens, estimatedCost, data.errorCode || null,
    ).run()
  } catch {
    // Logging cannot break the user flow. Generation itself fails closed when the rate-limit table is absent.
  }
  return estimatedCost
}

async function generationLimit(c: any, userId: string) {
  const row = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n, MAX(created_at) AS last_created_at
       FROM ai_profile_assistant_usage
      WHERE user_id = ?
        AND operation = 'generate'
        AND status IN ('success', 'error')
        AND created_at >= datetime('now', '-1 day')`,
  ).bind(userId).first()

  const dailyLimit = Number(c.env.AI_PROFILE_DAILY_LIMIT || MAX_GENERATIONS_PER_DAY)
  const count = Number((row as any)?.n || 0)
  if (count >= dailyLimit) return { allowed: false, reason: 'daily_limit', retryAfter: 3600 }

  const lastCreatedAt = String((row as any)?.last_created_at || '')
  if (lastCreatedAt) {
    const lastMs = Date.parse(`${lastCreatedAt.replace(' ', 'T')}Z`)
    const cooldown = Number(c.env.AI_PROFILE_COOLDOWN_SECONDS || COOLDOWN_SECONDS)
    if (Number.isFinite(lastMs)) {
      const elapsed = Math.floor((Date.now() - lastMs) / 1000)
      if (elapsed < cooldown) return { allowed: false, reason: 'cooldown', retryAfter: cooldown - elapsed }
    }
  }
  return { allowed: true, reason: '', retryAfter: 0 }
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

function buildInput(answers: Record<string, string>, context: any) {
  return [
    'Contexto actual del perfil Kawvo:',
    `Actividad comercial: ${context.category || 'No indicada'}`,
    `Nombre o marca: ${context.name || 'No indicado'}`,
    `Título actual: ${context.professionalTitle || 'Vacío'}`,
    `Bio actual: ${context.bio || 'Vacía'}`,
    `Servicios actuales: ${context.services.length ? context.services.map((s: ExistingService) => `${s.title}: ${s.description}`).join(' | ') : 'Ninguno'}`,
    `Canales disponibles: ${[context.contact.whatsapp && 'WhatsApp', context.contact.phone && 'teléfono', context.contact.email && 'email', context.contact.address && 'ubicación'].filter(Boolean).join(', ') || 'No configurados'}`,
    '',
    'Respuestas del usuario:',
    `Qué hace: ${answers.activity_details || 'No respondió'}`,
    `Servicios que ofrece: ${answers.services_details || 'No respondió'}`,
    `Clientes que atiende: ${answers.clients || 'No respondió'}`,
    `Cómo prefiere que le contacten: ${answers.preferred_contact || 'No respondió'}`,
    `Qué quiere que hagan después de visitar el perfil: ${answers.next_action || 'No respondió'}`,
    `Contexto adicional: ${answers.extra_context || 'Ninguno'}`,
  ].join('\n')
}

// Keep the strict schema within the broadly supported Structured Outputs subset.
// Length limits are enforced again by validateProposal() before any value reaches D1.
const responseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    professional_title: { type: 'string' },
    bio: { type: 'string' },
    services_section_title: { type: 'string' },
    services_section_description: { type: 'string' },
    services: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { title: { type: 'string' }, description: { type: 'string' } },
        required: ['title', 'description'],
      },
    },
    cta: {
      type: 'object',
      additionalProperties: false,
      properties: {
        label: { type: 'string' },
        goal: { type: 'string', enum: ['contact', 'quote', 'book', 'visit', 'buy', 'learn_more'] },
      },
      required: ['label', 'goal'],
    },
  },
  required: ['professional_title', 'bio', 'services_section_title', 'services_section_description', 'services', 'cta'],
}

app.get('/api/v1/me/ai-profile-assistant/context', requireAssistantAuth, async (c: any) => {
  const userId = c.get('userId') as string
  const context = await ownerContext(c, userId)
  if (!context) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  let usage: any = null
  try {
    usage = await c.env.DB.prepare(
      `SELECT COUNT(*) AS n,
              COALESCE(SUM(input_tokens), 0) AS input_tokens,
              COALESCE(SUM(output_tokens), 0) AS output_tokens,
              COALESCE(SUM(estimated_cost_usd), 0) AS estimated_cost_usd
         FROM ai_profile_assistant_usage
        WHERE user_id = ? AND operation = 'generate' AND created_at >= datetime('now', '-1 day')`,
    ).bind(userId).first()
  } catch {
    return c.json({ ok: false, error: 'La función de IA requiere terminar su configuración de datos.' }, 503)
  }

  return c.json({ ok: true, data: {
    profile: {
      slug: context.slug,
      name: context.name,
      category: context.category,
      professional_title: context.professionalTitle,
      bio: context.bio,
      services: context.services,
      contact: context.contact,
    },
    limits: {
      max_answer_length: MAX_ANSWER_LENGTH,
      max_total_input_length: MAX_TOTAL_INPUT_LENGTH,
      daily_generations: Number(c.env.AI_PROFILE_DAILY_LIMIT || MAX_GENERATIONS_PER_DAY),
      cooldown_seconds: Number(c.env.AI_PROFILE_COOLDOWN_SECONDS || COOLDOWN_SECONDS),
    },
    usage_24h: {
      generations: Number((usage as any)?.n || 0),
      input_tokens: Number((usage as any)?.input_tokens || 0),
      output_tokens: Number((usage as any)?.output_tokens || 0),
      estimated_cost_usd: Number((usage as any)?.estimated_cost_usd || 0),
    },
  } })
})

app.post('/api/v1/me/ai-profile-assistant/generate', requireAssistantAuth, async (c: any) => {
  const userId = c.get('userId') as string
  const context = await ownerContext(c, userId)
  if (!context) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  if (!c.env.OPENAI_API_KEY) {
    await insertUsage(c, { userId, profileId: context.profileId, operation: 'generate', status: 'blocked', errorCode: 'missing_secret' })
    return c.json({ ok: false, error: 'La ayuda con IA todavía no está configurada.' }, 503)
  }

  let body: any
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Solicitud no válida.' }, 400) }
  const rawAnswers = objectValue(body?.answers)
  const keys = ['activity_details', 'services_details', 'clients', 'preferred_contact', 'next_action', 'extra_context']
  const answers: Record<string, string> = {}
  for (const key of keys) answers[key] = text(rawAnswers[key], MAX_ANSWER_LENGTH)

  const totalLength = Object.values(answers).reduce((sum, value) => sum + value.length, 0)
  if (totalLength < 8) return c.json({ ok: false, error: 'Cuéntanos un poco más para preparar una propuesta útil.' }, 400)
  if (totalLength > MAX_TOTAL_INPUT_LENGTH) return c.json({ ok: false, error: 'La información es demasiado extensa. Resume un poco tus respuestas.' }, 413)

  let limit: any
  try { limit = await generationLimit(c, userId) } catch {
    return c.json({ ok: false, error: 'La función de IA requiere terminar su configuración de datos.' }, 503)
  }
  if (!limit.allowed) {
    await insertUsage(c, { userId, profileId: context.profileId, operation: 'generate', status: 'blocked', errorCode: limit.reason })
    c.header('Retry-After', String(limit.retryAfter || 60))
    return c.json({
      ok: false,
      error: limit.reason === 'cooldown' ? 'Espera unos segundos antes de generar otra propuesta.' : 'Alcanzaste el límite de propuestas con IA por hoy.',
      retry_after_seconds: limit.retryAfter,
    }, 429)
  }

  const model = text(c.env.OPENAI_MODEL || DEFAULT_MODEL, 80) || DEFAULT_MODEL
  const safetyIdentifier = (await sha256Hex(`kawvo:${userId}`)).slice(0, 64)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 25_000)

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${c.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        store: false,
        safety_identifier: safetyIdentifier,
        max_output_tokens: MAX_OUTPUT_TOKENS,
        reasoning: { effort: 'none' },
        text: { verbosity: 'low', format: { type: 'json_schema', name: 'kawvo_profile_proposal', strict: true, schema: responseSchema } },
        instructions: [
          'Eres el asistente de Perfil Digital de Kawvo Link.',
          'Tu único objetivo es transformar información del usuario en una propuesta profesional, concreta y fiel a lo que realmente hace.',
          'Escribe en español natural de República Dominicana salvo que el usuario claramente use otro idioma.',
          'No inventes certificaciones, años de experiencia, precios, ubicaciones, clientes, garantías ni servicios no mencionados.',
          'Usa la actividad comercial y el contenido existente para evitar repetir preguntas o contradecir el perfil.',
          'El título profesional debe ser corto y reconocible.',
          'La bio debe explicar qué hace, para quién y el valor principal sin exageraciones.',
          'Propón entre 1 y 3 servicios, cada uno con título y descripción breve.',
          'El CTA debe ser coherente con los canales disponibles; si el canal preferido no existe, usa una acción genérica de contacto.',
          'No incluyas HTML, Markdown ni campos fuera del esquema.',
        ].join('\n'),
        input: buildInput(answers, context),
      }),
    })

    const payload: any = await response.json().catch(() => ({}))
    const usage = payload?.usage || {}
    if (!response.ok) {
      const errorCode = text(payload?.error?.code || `openai_${response.status}`, 80)
      await insertUsage(c, { userId, profileId: context.profileId, operation: 'generate', status: 'error', model, inputTokens: usage.input_tokens, outputTokens: usage.output_tokens, errorCode })
      if (response.status === 429) return c.json({ ok: false, error: 'La IA está recibiendo muchas solicitudes. Intenta nuevamente en un momento.' }, 503)
      return c.json({ ok: false, error: 'No pudimos preparar la propuesta con IA. Tu perfil no fue modificado.' }, 502)
    }

    if (payload?.status && payload.status !== 'completed') {
      await insertUsage(c, { userId, profileId: context.profileId, operation: 'generate', status: 'error', model, inputTokens: usage.input_tokens, outputTokens: usage.output_tokens, errorCode: `response_${text(payload.status, 40)}` })
      return c.json({ ok: false, error: 'La propuesta no pudo completarse. Intenta nuevamente; tu perfil sigue sin cambios.' }, 502)
    }

    let parsed: any = null
    try { parsed = JSON.parse(responseText(payload)) } catch { parsed = null }
    const proposal = validateProposal(parsed)
    if (!proposal) {
      await insertUsage(c, { userId, profileId: context.profileId, operation: 'generate', status: 'error', model, inputTokens: usage.input_tokens, outputTokens: usage.output_tokens, errorCode: 'invalid_structured_output' })
      return c.json({ ok: false, error: 'La propuesta llegó incompleta. Intenta generarla nuevamente; tu perfil sigue sin cambios.' }, 502)
    }

    const estimatedCost = await insertUsage(c, { userId, profileId: context.profileId, operation: 'generate', status: 'success', model, inputTokens: usage.input_tokens, outputTokens: usage.output_tokens })
    return c.json({ ok: true, data: {
      proposal,
      current: { professional_title: context.professionalTitle, bio: context.bio, services: context.services },
      usage: { model, input_tokens: Number(usage.input_tokens || 0), output_tokens: Number(usage.output_tokens || 0), estimated_cost_usd: estimatedCost },
    } })
  } catch (error: any) {
    const code = error?.name === 'AbortError' ? 'timeout' : 'network_error'
    await insertUsage(c, { userId, profileId: context.profileId, operation: 'generate', status: 'error', model, errorCode: code })
    return c.json({ ok: false, error: code === 'timeout' ? 'La IA tardó demasiado. Intenta nuevamente; tu perfil no fue modificado.' : 'No pudimos conectar con la IA. Tu perfil sigue disponible y sin cambios.' }, 504)
  } finally {
    clearTimeout(timeout)
  }
})

app.post('/api/v1/me/ai-profile-assistant/apply', requireAssistantAuth, async (c: any) => {
  const userId = c.get('userId') as string
  const context = await ownerContext(c, userId)
  if (!context) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  let body: any
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Solicitud no válida.' }, 400) }
  const proposal = validateProposal(body?.proposal)
  if (!proposal) return c.json({ ok: false, error: 'La propuesta no es válida.' }, 400)

  const apply = objectValue(body?.apply)
  const applyIdentity = Boolean(apply.identity)
  const applyBio = Boolean(apply.bio)
  const applyServicesSection = Boolean(apply.services_section)
  const applyServices = Boolean(apply.services)
  const confirmExistingServicesUpdate = body?.replace_existing_services === true

  if (!applyIdentity && !applyBio && !applyServicesSection && !applyServices) {
    return c.json({ ok: false, error: 'Selecciona al menos un cambio para aplicar.' }, 400)
  }
  if (applyServices && context.services.length > 0 && !confirmExistingServicesUpdate) {
    return c.json({ ok: false, error: 'Confirma explícitamente si deseas actualizar el texto de tus servicios actuales.', code: 'replace_services_confirmation_required' }, 409)
  }

  const nextTemplateData = { ...context.templateData }
  if (applyIdentity) {
    nextTemplateData.role = proposal.professional_title
    nextTemplateData.free_identity_confirmed = true
  }
  if (applyServicesSection) {
    nextTemplateData.services_section_title = proposal.services_section_title
    nextTemplateData.services_section_description = proposal.services_section_description
  }

  const statements: any[] = []
  if (applyIdentity || applyBio || applyServicesSection) {
    statements.push(c.env.DB.prepare(
      `UPDATE profiles
          SET bio = CASE WHEN ? = 1 THEN ? ELSE bio END,
              template_data = ?,
              updated_at = datetime('now')
        WHERE id = ? AND user_id = ?`,
    ).bind(applyBio ? 1 : 0, proposal.bio, JSON.stringify(nextTemplateData), context.profileId, userId))
  }

  if (applyServices) {
    for (let index = 0; index < proposal.services.length; index += 1) {
      const service = proposal.services[index]
      const existing = context.services[index]
      if (existing) {
        // Preserve image, price, WhatsApp text, featured state and ID; AI only changes the two text fields.
        statements.push(c.env.DB.prepare(
          `UPDATE profile_products
              SET title = ?, description = ?, sort_order = ?
            WHERE id = ? AND profile_id = ?`,
        ).bind(service.title, service.description, index, existing.id, context.profileId))
      } else {
        statements.push(c.env.DB.prepare(
          `INSERT INTO profile_products
            (id, profile_id, title, description, price, image_url, whatsapp_text, is_featured, sort_order, created_at)
           VALUES (?, ?, ?, ?, '', '', '', 0, ?, datetime('now'))`,
        ).bind(crypto.randomUUID(), context.profileId, service.title, service.description, index))
      }
    }
  }

  try {
    await c.env.DB.batch(statements)
  } catch {
    await insertUsage(c, { userId, profileId: context.profileId, operation: 'apply', status: 'error', errorCode: 'db_write_failed' })
    return c.json({ ok: false, error: 'No pudimos aplicar los cambios. Tu perfil anterior se mantiene.' }, 500)
  }

  await insertUsage(c, { userId, profileId: context.profileId, operation: 'apply', status: 'success' })
  return c.json({ ok: true, data: {
    applied: { identity: applyIdentity, bio: applyBio, services_section: applyServicesSection, services: applyServices },
    services_preserved: applyServices && context.services.length > 0,
    note: 'La sugerencia de CTA se muestra al usuario, pero no se guarda porque Kawvo determina el botón principal desde los canales de contacto reales.',
  } })
})
