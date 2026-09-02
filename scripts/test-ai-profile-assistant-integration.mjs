import assert from 'node:assert/strict'

const { default: app } = await import('file:///tmp/kawvo-ai-api.mjs')

const PROFILE = {
  id: 'profile-1',
  slug: 'electricista-demo',
  plan_id: 'free',
  name: 'Juan Demo',
  bio: 'Electricista para hogares y pequeños negocios.',
  category: 'Mantenimiento e instalaciones técnicas',
  subcategory: 'Electricidad',
  professional_title: 'Electricista residencial y comercial',
  activity_context: 'Instalo luminarias, abanicos, tomas, cableado y corrijo averías eléctricas.',
}

async function sha256Hex(input) {
  const bytes = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash)).map((v) => v.toString(16).padStart(2, '0')).join('')
}

const CONFIRMED_HASH = await sha256Hex(JSON.stringify({
  name: PROFILE.name,
  category: PROFILE.category,
  subcategory: PROFILE.subcategory,
  professional_title: PROFILE.professional_title,
  activity_context: PROFILE.activity_context,
}))

const DEFAULT_SERVICES = [
  { id: 'service-1', title: 'Instalaciones', description: 'Instalaciones eléctricas residenciales.', image_url: 'profiles/p1/s1.jpg', sort_order: 0 },
  { id: 'service-2', title: 'Reparaciones', description: 'Corrección de averías eléctricas.', image_url: 'profiles/p1/s2.jpg', sort_order: 1 },
]

const BASE_PROPOSAL = {
  professional_title: 'Electricista residencial y comercial',
  bio: 'Resuelve instalaciones, averías y mejoras eléctricas en hogares y pequeños negocios.',
  services_section_title: 'Soluciones eléctricas',
  services_section_description: 'Trabajos eléctricos para instalación, reparación y mejora.',
  services: [
    { id: 'service-1', title: 'Instalaciones eléctricas', description: 'Instalación de luminarias, abanicos, tomas y cableado.' },
    { id: 'service-2', title: 'Reparación de averías', description: 'Diagnóstico y corrección de cortos y fallas eléctricas.' },
  ],
  portfolio: [],
  cta: { label: 'Solicita una cotización', goal: 'quote' },
  image_suggestions: [
    { purpose: 'Mostrar experiencia real', suggestion: 'Usa una foto real de un trabajo terminado.' },
  ],
}

class Statement {
  constructor(db, sql) { this.db = db; this.sql = sql; this.args = [] }
  bind(...args) { this.args = args; return this }
  async first() { return this.db.first(this.sql, this.args) }
  async all() { return this.db.all(this.sql, this.args) }
  async run() {
    this.db.runs.push({ sql: this.sql, args: this.args })
    this.db.onRun(this.sql, this.args)
    return { success: true, meta: { changes: 1 } }
  }
}

class FakeDB {
  constructor({
    services = DEFAULT_SERVICES,
    channels = ['whatsapp'],
    acceptedTerms = ['ai-assistant-v1.0'],
    daily = 0,
    monthly = 0,
    readyContext = true,
    confirmed = true,
  } = {}) {
    this.services = services.map((item) => ({ ...item }))
    this.channels = channels
    this.acceptedTerms = new Set(acceptedTerms)
    this.daily = daily
    this.monthly = monthly
    this.readyContext = readyContext
    this.confirmed = confirmed
    this.runs = []
    this.batches = []
    this.queries = []
  }

  prepare(sql) { return new Statement(this, sql) }

  async first(sql, args = []) {
    this.queries.push({ sql, args })
    if (sql.includes('FROM auth_sessions')) return { user_id: 'user-1' }
    if (sql.includes('FROM admin_users')) return null
    if (sql.includes('FROM users')) return { email: 'demo@example.com' }
    if (sql.includes('FROM profiles')) {
      const templateData = this.readyContext ? {
        role: PROFILE.professional_title,
        ai_activity_context: PROFILE.activity_context,
        ...(this.confirmed ? {
          ai_context_confirmed_hash: CONFIRMED_HASH,
          ai_context_confirmed_at: '2026-09-02T12:00:00.000Z',
        } : {}),
      } : {}
      return {
        id: PROFILE.id,
        slug: PROFILE.slug,
        plan_id: PROFILE.plan_id,
        name: PROFILE.name,
        bio: PROFILE.bio,
        category: this.readyContext ? PROFILE.category : '',
        subcategory: this.readyContext ? PROFILE.subcategory : '',
        template_data: JSON.stringify(templateData),
      }
    }
    if (sql.includes('FROM profile_contact')) return {
      whatsapp: this.channels.includes('whatsapp') ? '18095550000' : '',
      email: this.channels.includes('email') ? 'demo@example.com' : '',
      phone: this.channels.includes('phone') ? '8095550000' : '',
      address: this.channels.includes('visit') ? 'Santo Domingo' : '',
    }
    if (sql.includes('FROM ai_assistant_terms_acceptances')) {
      return this.acceptedTerms.has(String(args[1])) ? { id: 'accept-1' } : null
    }
    if (sql.includes('FROM ai_profile_assistant_usage')) {
      return {
        daily_count: this.daily,
        monthly_count: this.monthly,
        last_created_at: null,
        input_tokens: 0,
        output_tokens: 0,
        estimated_cost_usd: 0,
      }
    }
    return null
  }

  async all(sql) {
    if (sql.includes('FROM profile_products')) return { results: this.services }
    if (sql.includes('FROM profile_gallery')) return { results: [] }
    return { results: [] }
  }

  async batch(statements) {
    const batch = statements.map((s) => ({ sql: s.sql, args: s.args }))
    this.batches.push(batch)
    return batch.map(() => ({ success: true }))
  }

  onRun(sql, args) {
    if (sql.includes('INSERT INTO ai_assistant_terms_acceptances')) this.acceptedTerms.add(String(args[1]))
  }
}

function env(db, overrides = {}) {
  return {
    ENVIRONMENT: 'preview',
    DB: db,
    OPENAI_API_KEY: 'test-key-not-real',
    OPENAI_MODEL: 'gpt-5.6-luna',
    AI_TERMS_VERSION: 'ai-assistant-v1.0',
    AI_PROFILE_DAILY_LIMIT: '8',
    AI_PROFILE_MONTHLY_LIMIT: '100',
    AI_PROFILE_MAX_ROUNDS: '2',
    AI_PROFILE_COOLDOWN_SECONDS: '20',
    FREE_MAX_SERVICES: '3',
    FREE_MAX_PORTFOLIO: '5',
    ADMIN_EMAILS: '',
    ...overrides,
  }
}

function request(path, body, { cookie = true, method = 'POST' } = {}) {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (cookie) headers.set('Cookie', 'intap_preview_session_id=test-session')
  return new Request(`https://app.preview.intaprd.com${path}`, {
    method,
    headers,
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
  })
}

async function call(path, body, options = {}, db = new FakeDB(), envOverrides = {}) {
  const response = await app.fetch(request(path, body, options), env(db, envOverrides))
  let parsed = null
  try { parsed = await response.json() } catch {}
  return { status: response.status, body: parsed, db }
}

function completedReady(proposal = BASE_PROPOSAL) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      status: 'completed',
      output_text: JSON.stringify({ status: 'ready', proposal, questions: null }),
      usage: { input_tokens: 500, output_tokens: 240 },
    }),
  }
}

const originalFetch = globalThis.fetch

try {
  // Authentication is mandatory.
  {
    const result = await call('/api/v1/me/ai-profile-assistant/generate', { answers: { activity_details: 'Soy electricista.' } }, { cookie: false })
    assert.equal(result.status, 401)
  }

  // Consent is mandatory and blocks model use.
  {
    let upstreamCalled = false
    globalThis.fetch = async () => { upstreamCalled = true; throw new Error('must not run') }
    const db = new FakeDB({ acceptedTerms: [] })
    const result = await call('/api/v1/me/ai-profile-assistant/generate', { answers: { activity_details: 'Soy electricista.' }, round: 1 }, {}, db)
    assert.equal(result.status, 428)
    assert.equal(result.body.code, 'consent_required')
    assert.equal(upstreamCalled, false)
  }

  // The hardened assistant requires enough factual context before generation.
  {
    const db = new FakeDB({ readyContext: false })
    const result = await call('/api/v1/me/ai-profile-assistant/generate', { answers: { activity_details: 'Soy electricista.' }, round: 1 }, {}, db)
    assert.equal(result.status, 422)
    assert.equal(result.body.code, 'ai_context_incomplete')
  }

  // Ready context must also be explicitly confirmed.
  {
    const db = new FakeDB({ confirmed: false })
    const result = await call('/api/v1/me/ai-profile-assistant/generate', { answers: { activity_details: 'Soy electricista.' }, round: 1 }, {}, db)
    assert.equal(result.status, 428)
    assert.equal(result.body.code, 'ai_context_confirmation_required')
  }

  // A valid generation uses confirmed profile context, strict schema and does not mutate profile data.
  {
    let upstreamCalled = false
    globalThis.fetch = async (_url, init) => {
      upstreamCalled = true
      const payload = JSON.parse(init.body)
      assert.equal(payload.store, false)
      assert.equal(payload.text.format.type, 'json_schema')
      assert.equal(payload.text.format.strict, true)
      assert.match(payload.input, /"subcategory":"Electricidad"/)
      assert.match(payload.input, /"activity_context_in_user_words":/)
      assert.match(payload.input, /"existing_services":/)
      assert.match(payload.input, /"id":"service-1"/)
      assert.match(payload.instructions, /NO DELEGUES LA ESTRATEGIA/i)
      assert.match(payload.instructions, /Nunca generes título o descripción desde cero/i)
      return completedReady()
    }
    const db = new FakeDB({ channels: ['whatsapp', 'phone', 'email'] })
    const result = await call('/api/v1/me/ai-profile-assistant/generate', {
      answers: { extra_context: 'Haz que mi perfil se presente mejor.' },
      round: 1,
      editing_scope: 'full_profile',
    }, {}, db)
    assert.equal(result.status, 200)
    assert.equal(result.body.data.status, 'ready')
    assert.equal(result.body.data.proposal.services[0].id, 'service-1')
    assert.equal(upstreamCalled, true)
    assert.equal(db.batches.length, 0)
  }

  // Only user_fact follow-ups are exposed to the user.
  {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'completed',
        output_text: JSON.stringify({
          status: 'needs_more_info',
          proposal: null,
          questions: [{ question: '¿Atiendes fuera de Santo Domingo?', kind: 'user_fact' }],
        }),
        usage: {},
      }),
    })
    const result = await call('/api/v1/me/ai-profile-assistant/generate', {
      answers: { activity_details: 'Hago instalaciones eléctricas.' },
      round: 1,
    })
    assert.equal(result.status, 200)
    assert.equal(result.body.data.status, 'needs_more_info')
    assert.deepEqual(result.body.data.questions, ['¿Atiendes fuera de Santo Domingo?'])
  }

  // Strategy/general-knowledge questions are blocked server-side and trigger one internal retry.
  {
    let calls = 0
    globalThis.fetch = async () => {
      calls += 1
      if (calls === 1) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: 'completed',
            output_text: JSON.stringify({
              status: 'needs_more_info',
              proposal: null,
              questions: [{ question: '¿Qué propuesta de valor quieres comunicar?', kind: 'strategy' }],
            }),
            usage: {},
          }),
        }
      }
      return completedReady()
    }
    const result = await call('/api/v1/me/ai-profile-assistant/generate', {
      answers: { activity_details: 'Hago trabajos eléctricos.' },
      round: 1,
    })
    assert.equal(result.status, 200)
    assert.equal(result.body.data.status, 'ready')
    assert.equal(calls, 2)
  }

  // Daily quota and round limits are enforced before model use.
  {
    const quota = await call('/api/v1/me/ai-profile-assistant/generate', { answers: { activity_details: 'Soy electricista.' }, round: 1 }, {}, new FakeDB({ daily: 8 }))
    assert.equal(quota.status, 429)
    assert.equal(quota.body.code, 'daily_limit')

    const round = await call('/api/v1/me/ai-profile-assistant/generate', { answers: { activity_details: 'Soy electricista.' }, round: 3 })
    assert.equal(round.status, 429)
    assert.equal(round.body.code, 'round_limit')
  }

  // Missing-only never rewrites existing services.
  {
    const db = new FakeDB()
    const result = await call('/api/v1/me/ai-profile-assistant/apply', {
      proposal: BASE_PROPOSAL,
      apply: { services: true },
      replace_existing_services: false,
      editing_scope: 'missing_only',
    }, {}, db)
    assert.equal(result.status, 200)
    assert.equal(result.body.data.published, false)
    assert.equal(result.body.data.applied.services, false)
    assert.equal(db.batches.length, 0)
  }

  // Full-profile service copy updates require confirmation and preserve IDs/order fields.
  {
    const db = new FakeDB()
    const blocked = await call('/api/v1/me/ai-profile-assistant/apply', {
      proposal: BASE_PROPOSAL,
      apply: { services: true },
      replace_existing_services: false,
      editing_scope: 'full_profile',
    }, {}, db)
    assert.equal(blocked.status, 409)
    assert.equal(blocked.body.code, 'replace_services_confirmation_required')

    const applied = await call('/api/v1/me/ai-profile-assistant/apply', {
      proposal: BASE_PROPOSAL,
      apply: { services: true },
      replace_existing_services: true,
      editing_scope: 'full_profile',
    }, {}, db)
    assert.equal(applied.status, 200)
    assert.equal(applied.body.data.published, false)
    assert.equal(applied.body.data.applied.services, true)
    assert.equal(db.batches.length, 1)
    const sql = db.batches[0].map((entry) => entry.sql).join('\n')
    assert.match(sql, /UPDATE profile_products SET title = \?, description = \? WHERE id = \? AND profile_id = \?/)
    assert.doesNotMatch(sql, /sort_order/)
    assert.doesNotMatch(sql, /DELETE FROM profile_products/i)
  }

  console.log('AI profile assistant integration checks: OK')
} finally {
  globalThis.fetch = originalFetch
}
