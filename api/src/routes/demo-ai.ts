import { callStructuredOpenAI } from '../lib/openai-structured'

const DEFAULT_MODEL = 'gpt-5.6-luna'
const TERMS_VERSION = 'demo-ai-v1.0'
const MAX_ACTIVITY = 120
const MAX_NAME = 80
const MAX_ROLE = 80
const MAX_DESCRIPTION = 900
const MAX_CLARIFICATION = 700
const DEFAULT_SESSION_LIMIT = 3
const DEFAULT_IP_LIMIT = 20
const DEFAULT_COOLDOWN_SECONDS = 12
const MAX_SERVICES = 3

export const DEMO_AI_CATEGORIES = [
  'Moda y accesorios',
  'Belleza y estética',
  'Salud y bienestar',
  'Gastronomía y alimentos',
  'Tecnología y electrónica',
  'Marketing y comunicación digital',
  'Arte, diseño y creatividad',
  'Educación y formación',
  'Construcción e ingeniería',
  'Hogar, decoración y mobiliario',
  'Mantenimiento e instalaciones técnicas',
  'Inmobiliaria y propiedades',
  'Automotriz y mecánica',
  'Comercio, retail y tiendas virtuales',
  'Servicios profesionales',
  'Turismo, viajes y hospitalidad',
  'Deportes y fitness',
  'Agropecuario y jardinería',
  'Logística, mensajería y entregas',
  'Eventos y entretenimiento',
  'Artesanía y productos hechos a mano',
  'Mascotas y animales',
  'Servicios generales',
  'Otros',
] as const

type DemoAiCategory = typeof DEMO_AI_CATEGORIES[number]

type DemoService = { title: string; description: string }
type DemoReady = {
  status: 'ready'
  demo: {
    asset_category: DemoAiCategory
    professional_title: string
    bio: string
    services_section_title: string
    services_section_description: string
    services: DemoService[]
  }
}
type DemoNeedsInfo = { status: 'needs_more_info'; questions: string[] }
type DemoResult = DemoReady | DemoNeedsInfo

function clean(value: unknown, max: number) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function numberEnv(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.floor(parsed))) : fallback
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash)).map((item) => item.toString(16).padStart(2, '0')).join('')
}

function categoryFromText(activityRaw: string, detailRaw = ''): DemoAiCategory | null {
  const text = `${activityRaw} ${detailRaw}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const has = (...values: string[]) => values.some((value) => text.includes(value))

  if (has('mecanico', 'mecanica', 'freno', 'tren delantero', 'diagnostico automotriz', 'taller auto')) return 'Automotriz y mecánica'
  if (has('electricista', 'aire acondicionado', 'aires', 'nevera', 'refrigeracion', 'camara', 'control de acceso', 'plomer', 'instalacion tecnica')) return 'Mantenimiento e instalaciones técnicas'
  if (has('decoracion de interiores', 'decoradora de interiores', 'interiorismo', 'airbnb', 'mobiliario')) return 'Hogar, decoración y mobiliario'
  if (has('decoracion de bodas', 'decoradora de bodas', 'boda', 'evento', 'cumpleanos', 'entretenimiento')) return 'Eventos y entretenimiento'
  if (has('community manager', 'redes sociales', 'marketing digital', 'social media')) return 'Marketing y comunicación digital'
  if (has('disenador grafico', 'diseno grafico', 'ilustracion', 'branding', 'creativ')) return 'Arte, diseño y creatividad'
  if (has('inmobili', 'bienes raices', 'propiedad', 'apartamento en venta')) return 'Inmobiliaria y propiedades'
  if (has('bisuteria', 'jabon artesanal', 'artesania', 'hecho a mano')) return 'Artesanía y productos hechos a mano'
  if (has('salon', 'estetica', 'unas', 'maquillaje', 'peluquer')) return 'Belleza y estética'
  if (has('salud', 'terapia', 'bienestar', 'nutricion')) return 'Salud y bienestar'
  if (has('restaurante', 'comida', 'reposteria', 'catering', 'cocina')) return 'Gastronomía y alimentos'
  if (has('computadora', 'tecnologia', 'electronica', 'software', 'sistemas')) return 'Tecnología y electrónica'
  if (has('profesor', 'curso', 'educacion', 'capacitacion', 'formacion')) return 'Educación y formación'
  if (has('construccion', 'ingeniero civil', 'arquitect', 'obra')) return 'Construcción e ingeniería'
  if (has('tienda', 'retail', 'ecommerce', 'venta de productos', 'ropa', 'moda')) return has('ropa', 'moda') ? 'Moda y accesorios' : 'Comercio, retail y tiendas virtuales'
  if (has('hotel', 'turismo', 'viaje', 'excursion', 'hospedaje')) return 'Turismo, viajes y hospitalidad'
  if (has('gym', 'gimnasio', 'fitness', 'entrenador', 'deporte')) return 'Deportes y fitness'
  if (has('agro', 'agric', 'jardin', 'vivero')) return 'Agropecuario y jardinería'
  if (has('mensajeria', 'delivery', 'entrega', 'logistica')) return 'Logística, mensajería y entregas'
  if (has('mascota', 'veterin', 'perro', 'gato')) return 'Mascotas y animales'
  if (has('abogado', 'contador', 'consultor', 'asesor empresarial', 'servicios profesionales')) return 'Servicios profesionales'
  if (has('multiservicio', 'servicios generales')) return 'Servicios generales'
  return null
}

export function classifyDemoActivity(activity: string, detail = ''): { category: DemoAiCategory | null; ambiguous: boolean; question?: string } {
  const normalized = clean(activity, MAX_ACTIVITY).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const combinedCategory = categoryFromText(activity, detail)
  if (combinedCategory) return { category: combinedCategory, ambiguous: false }

  const ambiguousTerms: Array<[RegExp, string]> = [
    [/^(tecnico|tecnica)$/, '¿Qué tipo de trabajos técnicos realizas principalmente?'],
    [/^(decorador|decoradora)$/, '¿Decoras principalmente interiores, eventos u otro tipo de espacios?'],
    [/^(ingeniero|ingeniera)$/, '¿En qué área de ingeniería trabajas principalmente?'],
    [/^(disenador|disenadora)$/, '¿Qué tipo de diseño realizas principalmente?'],
    [/^(asesor|asesora)$/, '¿En qué área brindas asesoría principalmente?'],
  ]
  for (const [pattern, question] of ambiguousTerms) {
    if (pattern.test(normalized)) return { category: null, ambiguous: true, question }
  }
  return { category: null, ambiguous: false }
}

function validateResult(raw: unknown): DemoResult | null {
  const value: any = raw && typeof raw === 'object' ? raw : null
  if (!value) return null
  if (value.status === 'needs_more_info') {
    const questions = Array.isArray(value.questions)
      ? value.questions.map((item: unknown) => clean(item, 180)).filter(Boolean).slice(0, 3)
      : []
    return questions.length ? { status: 'needs_more_info', questions } : null
  }
  if (value.status !== 'ready' || !value.demo || typeof value.demo !== 'object') return null
  const category = DEMO_AI_CATEGORIES.includes(value.demo.asset_category) ? value.demo.asset_category as DemoAiCategory : null
  if (!category) return null
  const professionalTitle = clean(value.demo.professional_title, 80)
  const bio = clean(value.demo.bio, 300)
  const sectionTitle = clean(value.demo.services_section_title, 60)
  const sectionDescription = clean(value.demo.services_section_description, 240)
  const services = Array.isArray(value.demo.services)
    ? value.demo.services.slice(0, MAX_SERVICES).map((item: any) => ({
        title: clean(item?.title, 60),
        description: clean(item?.description, 90),
      })).filter((item: DemoService) => item.title && item.description)
    : []
  if (!professionalTitle || !bio || !sectionTitle || services.length < 1) return null
  return {
    status: 'ready',
    demo: {
      asset_category: category,
      professional_title: professionalTitle,
      bio,
      services_section_title: sectionTitle,
      services_section_description: sectionDescription,
      services,
    },
  }
}

const demoSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['ready', 'needs_more_info'] },
    demo: {
      anyOf: [
        {
          type: 'object', additionalProperties: false,
          properties: {
            asset_category: { type: 'string', enum: [...DEMO_AI_CATEGORIES] },
            professional_title: { type: 'string' },
            bio: { type: 'string' },
            services_section_title: { type: 'string' },
            services_section_description: { type: 'string' },
            services: {
              type: 'array', maxItems: 3,
              items: { type: 'object', additionalProperties: false, properties: { title: { type: 'string' }, description: { type: 'string' } }, required: ['title', 'description'] },
            },
          },
          required: ['asset_category', 'professional_title', 'bio', 'services_section_title', 'services_section_description', 'services'],
        },
        { type: 'null' },
      ],
    },
    questions: { anyOf: [{ type: 'array', maxItems: 3, items: { type: 'string' } }, { type: 'null' }] },
  },
  required: ['status', 'demo', 'questions'],
}

const INSTRUCTIONS = [
  'Eres el estratega de presentación de Kawvo Link para una Demo temporal. No eres un chatbot abierto.',
  'Tu objetivo es convertir pocos datos confirmados en una presentación móvil clara, profesional, cercana y específica.',
  'Usa español natural compatible con República Dominicana, frases cortas y cero relleno.',
  'Nunca cambies el nombre dado por la persona. Si professional_title está vacío, propón uno seguro basado únicamente en la actividad y explicación confirmadas.',
  'No inventes años, certificaciones, licencias, precios, ubicación, clientes, marcas, garantías, resultados, disponibilidad, tiempos, ventajas competitivas ni servicios no respaldados.',
  'Extrae hasta 3 servicios de lo que la persona dijo que hace. No llenes cupos inventando.',
  'REDACCIÓN DE SERVICIOS: no copies ni parafrasees mecánicamente la frase del usuario. Usa conocimiento general del sector para transformar el hecho confirmado en una presentación más atractiva, concreta y orientada al cliente, sin agregar capacidades no mencionadas.',
  'Cada descripción de servicio debe explicar para qué le sirve al cliente, qué situación atiende o qué valor práctico aporta. Debe sentirse redactada, no transcrita. Evita repetir el título del servicio o las mismas palabras de work_description cuando puedas expresarlo mejor sin cambiar el hecho.',
  'Puedes aportar variedad de vocabulario, ritmo y enfoque comercial a partir de hechos confirmados. Creatividad editorial sí; hechos nuevos, promesas o servicios nuevos no.',
  'No incluyas CTA, layout, colores, URLs, ubicación, slug, publicación ni decisiones de botones.',
  'asset_category debe ser exactamente una categoría permitida. Profesión y categoría visual son cosas distintas: nunca uses el nombre técnico de la categoría como cargo salvo que sea natural y coincida con la actividad.',
  'Si existe ambigüedad material que impide saber qué hace, devuelve needs_more_info. Normalmente una pregunta; máximo tres si son imprescindibles.',
  'Si la explicación ya resuelve la ambigüedad, no preguntes.',
  'Evita frases genéricas como calidad y confianza, somos tu mejor opción, soluciones a tu medida, excelencia garantizada o servicio personalizado.',
  'Respeta límites desde el origen: professional_title 80, bio 300, título sección 60, descripción sección 240, máximo 3 servicios, título servicio 60 y descripción servicio 90.',
  'No repitas en el copy llamadas a escribir por WhatsApp; la plantilla ya tiene ese CTA visual.',
  'Devuelve solo JSON conforme al esquema.',
].join('\n')

async function insertAiEvent(c: any, eventType: string, sessionKey: string, metadata: Record<string, unknown>) {
  await c.env.DB.prepare(
    `INSERT INTO demo_events (id,event_type,snapshot_id,sector_key,source,session_key,metadata_json,created_at)
     VALUES (?,?,NULL,NULL,'demo_ai_api',?,?,datetime('now'))`
  ).bind(crypto.randomUUID(), eventType, sessionKey, JSON.stringify(metadata)).run()
}

async function rateLimit(c: any, sessionKey: string, ipHash: string, round: number) {
  const sessionLimit = numberEnv(c.env.DEMO_AI_SESSION_LIMIT, DEFAULT_SESSION_LIMIT, 1, 20)
  const ipLimit = numberEnv(c.env.DEMO_AI_IP_LIMIT, DEFAULT_IP_LIMIT, 2, 500)
  const dailyLimit = numberEnv(c.env.DEMO_AI_DAILY_LIMIT, 500, 10, 10000)
  const cooldown = numberEnv(c.env.DEMO_AI_COOLDOWN_SECONDS, DEFAULT_COOLDOWN_SECONDS, 1, 120)
  const [sessionRow, ipRow, globalRow] = await Promise.all([
    c.env.DB.prepare(
      `SELECT COUNT(*) AS total, MAX(created_at) AS last_at FROM demo_events
       WHERE source='demo_ai_api' AND event_type='demo_ai_started' AND session_key=? AND created_at >= datetime('now','-24 hours')`
    ).bind(sessionKey).first(),
    c.env.DB.prepare(
      `SELECT COUNT(*) AS total FROM demo_events
       WHERE source='demo_ai_api' AND event_type='demo_ai_started'
         AND json_extract(metadata_json,'$.ip_hash')=? AND created_at >= datetime('now','-1 hour')`
    ).bind(ipHash).first(),
    c.env.DB.prepare(
      `SELECT COUNT(*) AS total FROM demo_events
       WHERE source='demo_ai_api' AND event_type='demo_ai_started' AND created_at >= datetime('now','-24 hours')`
    ).first(),
  ])
  const sessionTotal = Number((sessionRow as any)?.total || 0)
  const ipTotal = Number((ipRow as any)?.total || 0)
  const globalTotal = Number((globalRow as any)?.total || 0)
  if (globalTotal >= dailyLimit) return { allowed: false, code: 'daily_budget', retryAfter: 3600 }
  if (sessionTotal >= sessionLimit) return { allowed: false, code: 'session_limit', retryAfter: 3600 }
  if (ipTotal >= ipLimit) return { allowed: false, code: 'rate_limit', retryAfter: 900 }
  const last = String((sessionRow as any)?.last_at || '')
  if (last && round <= 1) {
    const elapsed = Math.floor((Date.now() - Date.parse(`${last.replace(' ', 'T')}Z`)) / 1000)
    if (Number.isFinite(elapsed) && elapsed < cooldown) return { allowed: false, code: 'cooldown', retryAfter: cooldown - elapsed }
  }
  return { allowed: true, code: '', retryAfter: 0 }
}

export function registerDemoAiRoutes(app: any) {
  app.post('/api/v1/public/demo/ai/generate', async (c: any) => {
    if (String(c.env.DEMO_AI_ENABLED || '1') === '0') {
      return c.json({ ok: false, error: 'La Demo con IA no está disponible en este momento.', code: 'disabled', fallback: true }, 503)
    }

    let body: any
    try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Revisa la información e inténtalo nuevamente.' }, 400) }

    const accepted = body?.consent?.accepted === true
    const consentVersion = clean(body?.consent?.version, 40)
    if (!accepted || consentVersion !== TERMS_VERSION) {
      return c.json({ ok: false, error: 'Debes aceptar las condiciones de la Demo con IA para continuar.', code: 'consent_required' }, 428)
    }

    const sessionKey = clean(body?.session_key, 120)
    const activity = clean(body?.activity, MAX_ACTIVITY)
    const name = clean(body?.name, MAX_NAME)
    const role = clean(body?.professional_title, MAX_ROLE)
    const workDescription = clean(body?.work_description, MAX_DESCRIPTION)
    const clarification = clean(body?.clarification, MAX_CLARIFICATION)
    const round = Math.min(2, Math.max(1, Number(body?.round || 1)))

    if (!/^[a-zA-Z0-9._:-]{12,120}$/.test(sessionKey)) return c.json({ ok: false, error: 'No pudimos iniciar esta Demo. Recarga e inténtalo de nuevo.' }, 400)
    if (!activity) return c.json({ ok: false, error: 'Cuéntanos a qué te dedicas.' }, 400)
    if (!name) return c.json({ ok: false, error: 'Escribe el nombre con el que quieres aparecer.' }, 400)
    if (!workDescription || workDescription.length < 8) return c.json({ ok: false, error: 'Cuéntanos brevemente qué haces para preparar una Demo útil.' }, 400)
    if (!c.env.OPENAI_API_KEY) return c.json({ ok: false, error: 'La Demo con IA no está disponible en este momento.', code: 'unavailable', fallback: true }, 503)

    const ip = clean(c.req.header('CF-Connecting-IP') || 'unknown', 80)
    const ipHash = (await sha256Hex(`kawvo-demo-ai:${ip}`)).slice(0, 64)
    const limit = await rateLimit(c, sessionKey, ipHash, round).catch(() => ({ allowed: false, code: 'rate_unavailable', retryAfter: 60 }))
    if (!limit.allowed) {
      c.header('Retry-After', String(limit.retryAfter || 60))
      return c.json({ ok: false, error: limit.code === 'cooldown' ? 'Espera unos segundos antes de volver a generar.' : 'Ya utilizaste las generaciones disponibles por ahora.', code: limit.code, fallback: true }, 429)
    }

    const deterministic = classifyDemoActivity(activity, `${workDescription} ${clarification}`)
    if (deterministic.ambiguous && !clarification && round === 1) {
      await insertAiEvent(c, 'demo_ai_needs_more_info', sessionKey, { reason: 'deterministic_ambiguity', consent_version: consentVersion })
      return c.json({ ok: true, data: { status: 'needs_more_info', questions: [deterministic.question] } })
    }

    await insertAiEvent(c, 'demo_ai_started', sessionKey, { ip_hash: ipHash, consent_version: consentVersion, round })

    const model = clean(c.env.OPENAI_MODEL || DEFAULT_MODEL, 80) || DEFAULT_MODEL
    const safetyIdentifier = (await sha256Hex(`kawvo-demo:${sessionKey}`)).slice(0, 64)
    const input = JSON.stringify({
      activity,
      display_name: name,
      professional_title_if_provided: role,
      work_description: workDescription,
      clarification,
      known_category_hint: deterministic.category,
      field_limits: {
        professional_title: 80,
        bio: 300,
        services_section_title: 60,
        services_section_description: 240,
        services_max: 3,
        service_title: 60,
        service_description: 90,
      },
      allowed_asset_categories: DEMO_AI_CATEGORIES,
      must_finalize: round >= 2,
    })

    const ai = await callStructuredOpenAI({
      apiKey: c.env.OPENAI_API_KEY,
      model,
      safetyIdentifier,
      schemaName: 'kawvo_demo_ai_result',
      schema: demoSchema,
      instructions: INSTRUCTIONS,
      input,
      maxOutputTokens: 1400,
      timeoutMs: numberEnv(c.env.DEMO_AI_TIMEOUT_MS, 20_000, 5_000, 30_000),
    })

    if (!ai.ok) {
      await insertAiEvent(c, 'demo_ai_failed', sessionKey, { code: ai.errorCode || 'unknown', status: ai.status })
      const timeout = ai.errorCode === 'timeout'
      return c.json({ ok: false, error: timeout ? 'La preparación tardó más de lo esperado.' : 'No pudimos preparar la Demo con IA en este momento.', code: ai.errorCode || 'ai_failed', fallback: true }, timeout ? 504 : 502)
    }

    const result = validateResult(ai.parsed)
    if (!result) {
      await insertAiEvent(c, 'demo_ai_failed', sessionKey, { code: 'invalid_output' })
      return c.json({ ok: false, error: 'No pudimos terminar la propuesta. Puedes continuar sin IA.', code: 'invalid_output', fallback: true }, 502)
    }

    if (result.status === 'ready' && deterministic.category) {
      result.demo.asset_category = deterministic.category
    }

    if (result.status === 'needs_more_info') {
      if (round >= 2) {
        await insertAiEvent(c, 'demo_ai_failed', sessionKey, { code: 'clarification_exhausted' })
        return c.json({ ok: false, error: 'Necesitamos más información de la disponible. Puedes continuar sin IA.', code: 'clarification_exhausted', fallback: true }, 422)
      }
      await insertAiEvent(c, 'demo_ai_needs_more_info', sessionKey, { questions: result.questions.length })
      return c.json({ ok: true, data: result })
    }

    await insertAiEvent(c, 'demo_ai_generated', sessionKey, { asset_category: result.demo.asset_category, input_tokens: ai.usage.input_tokens, output_tokens: ai.usage.output_tokens })
    return c.json({ ok: true, data: result })
  })
}

export const DEMO_AI_TERMS_VERSION = TERMS_VERSION
