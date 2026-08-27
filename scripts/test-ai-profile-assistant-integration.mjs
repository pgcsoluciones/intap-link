import assert from 'node:assert/strict'

const { default: app } = await import('file:///tmp/kawvo-ai-api.mjs')

const BASE_PROPOSAL = {
  professional_title: 'Electricista residencial y comercial',
  bio: 'Instalaciones y reparaciones eléctricas para hogares y pequeños negocios, con atención clara y práctica.',
  services_section_title: 'Servicios eléctricos',
  services_section_description: 'Soluciones para instalaciones, averías y mejoras eléctricas.',
  services: [
    { title: 'Instalaciones eléctricas', description: 'Instalación de luminarias, abanicos, tomas y cableado.' },
    { title: 'Reparación de averías', description: 'Diagnóstico y corrección de cortos y fallas eléctricas.' },
  ],
  cta: { label: 'Solicita una cotización', goal: 'quote' },
}

class Statement {
  constructor(db, sql) {
    this.db = db
    this.sql = sql
    this.args = []
  }
  bind(...args) {
    this.args = args
    return this
  }
  async first() { return this.db.first(this.sql, this.args) }
  async all() { return this.db.all(this.sql, this.args) }
  async run() {
    this.db.runs.push({ sql: this.sql, args: this.args })
    return { success: true }
  }
}

class FakeDB {
  constructor({ services = [] } = {}) {
    this.services = services
    this.runs = []
    this.batches = []
  }
  prepare(sql) { return new Statement(this, sql) }
  async first(sql) {
    if (sql.includes('FROM auth_sessions')) return { user_id: 'user-1' }
    if (sql.includes('FROM profiles')) return {
      id: 'profile-1', slug: 'electricista-demo', plan_id: 'free', name: 'Juan Demo',
      bio: '', category: 'Mantenimiento e instalaciones técnicas', template_data: '{}',
    }
    if (sql.includes('FROM profile_contact')) return { whatsapp: '18095550000', email: '', phone: '', address: '' }
    if (sql.includes('FROM ai_profile_assistant_usage')) return { n: 0, last_created_at: null, input_tokens: 0, output_tokens: 0, estimated_cost_usd: 0 }
    return null
  }
  async all(sql) {
    if (sql.includes('FROM profile_products')) return { results: this.services }
    return { results: [] }
  }
  async batch(statements) {
    this.batches.push(statements.map((statement) => ({ sql: statement.sql, args: statement.args })))
    return statements.map(() => ({ success: true }))
  }
}

function env(db, overrides = {}) {
  return {
    ENVIRONMENT: 'preview',
    DB: db,
    OPENAI_API_KEY: 'test-key-not-real',
    OPENAI_MODEL: 'gpt-5.6-luna',
    AI_PROFILE_DAILY_LIMIT: '8',
    AI_PROFILE_COOLDOWN_SECONDS: '20',
    ...overrides,
  }
}

function request(path, body, { cookie = true } = {}) {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (cookie) headers.set('Cookie', 'intap_preview_session_id=test-session')
  return new Request(`https://app.preview.intaprd.com${path}`, {
    method: 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body),
  })
}

async function jsonResponse(response) {
  let body = null
  try { body = await response.json() } catch { body = null }
  return { status: response.status, body }
}

async function call(path, body, options = {}, db = new FakeDB(), envOverrides = {}) {
  const response = await app.fetch(request(path, body, options), env(db, envOverrides))
  return { ...(await jsonResponse(response)), db }
}

const originalFetch = globalThis.fetch
const originalSetTimeout = globalThis.setTimeout

try {
  // Auth is mandatory before any profile or OpenAI work.
  {
    const result = await call('/api/v1/me/ai-profile-assistant/generate', { answers: { activity_details: 'Soy electricista.' } }, { cookie: false })
    assert.equal(result.status, 401)
  }

  // Secret remains server-side and fails closed when absent.
  {
    const result = await call('/api/v1/me/ai-profile-assistant/generate', { answers: { activity_details: 'Soy electricista.' } }, {}, new FakeDB(), { OPENAI_API_KEY: '' })
    assert.equal(result.status, 503)
    assert.match(result.body.error, /no está configurada/i)
  }

  // Empty/too-short user input is rejected without calling OpenAI.
  {
    let upstreamCalled = false
    globalThis.fetch = async () => { upstreamCalled = true; throw new Error('should not run') }
    const result = await call('/api/v1/me/ai-profile-assistant/generate', { answers: { activity_details: 'hola' } })
    assert.equal(result.status, 400)
    assert.equal(upstreamCalled, false)
  }

  // Oversized combined input is rejected even though individual fields are bounded.
  {
    const long = 'x'.repeat(700)
    const result = await call('/api/v1/me/ai-profile-assistant/generate', { answers: {
      activity_details: long, services_details: long, clients: long, preferred_contact: long, next_action: long,
    } })
    assert.equal(result.status, 413)
  }

  // Informal Spanish, typos and emojis still produce a structured professional proposal.
  {
    globalThis.fetch = async (_url, init) => {
      const payload = JSON.parse(init.body)
      assert.equal(payload.model, 'gpt-5.6-luna')
      assert.equal(payload.store, false)
      assert.equal(payload.text.format.type, 'json_schema')
      assert.equal(payload.text.format.strict, true)
      assert.equal(payload.reasoning.effort, 'none')
      assert.match(payload.safety_identifier, /^[a-f0-9]{64}$/)
      return { ok: true, status: 200, json: async () => ({
        status: 'completed', output_text: JSON.stringify(BASE_PROPOSAL),
        usage: { input_tokens: 420, output_tokens: 190 },
      }) }
    }
    const result = await call('/api/v1/me/ai-profile-assistant/generate', { answers: {
      activity_details: 'soy electricista pongo abanico lampara inversore y arreglo corto 😅',
      clients: 'casa apartamento y negocio pequeño',
      next_action: 'que me tiren por wasap pa cotizar',
    } })
    assert.equal(result.status, 200)
    assert.equal(result.body.data.proposal.professional_title, BASE_PROPOSAL.professional_title)
    assert.equal(result.body.data.proposal.services.length, 2)
  }

  // Upstream rate limiting never mutates the profile and becomes a recoverable error.
  {
    globalThis.fetch = async () => ({ ok: false, status: 429, json: async () => ({ error: { code: 'rate_limit_exceeded' }, usage: {} }) })
    const result = await call('/api/v1/me/ai-profile-assistant/generate', { answers: { activity_details: 'Soy electricista residencial.' } })
    assert.equal(result.status, 503)
    assert.match(result.body.error, /muchas solicitudes/i)
    assert.equal(result.db.batches.length, 0)
  }

  // Invalid/non-JSON model output is rejected and never reaches apply/persistence.
  {
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ status: 'completed', output_text: 'not json', usage: {} }) })
    const result = await call('/api/v1/me/ai-profile-assistant/generate', { answers: { activity_details: 'Soy electricista residencial.' } })
    assert.equal(result.status, 502)
    assert.match(result.body.error, /incompleta/i)
  }

  // Network failure is handled without breaking Kawvo.
  {
    globalThis.fetch = async () => { throw new Error('network down') }
    const result = await call('/api/v1/me/ai-profile-assistant/generate', { answers: { activity_details: 'Soy electricista residencial.' } })
    assert.equal(result.status, 504)
    assert.match(result.body.error, /conectar con la IA/i)
  }

  // Timeout path: speed up timer while preserving AbortController behavior.
  {
    globalThis.setTimeout = (fn, _ms, ...args) => originalSetTimeout(fn, 5, ...args)
    globalThis.fetch = async (_url, init) => await new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => {
        const error = new Error('aborted')
        error.name = 'AbortError'
        reject(error)
      }, { once: true })
    })
    const result = await call('/api/v1/me/ai-profile-assistant/generate', { answers: { activity_details: 'Soy electricista residencial.' } })
    assert.equal(result.status, 504)
    assert.match(result.body.error, /tardó demasiado/i)
    globalThis.setTimeout = originalSetTimeout
  }

  // Applying existing services is explicit and non-destructive: image/IDs are preserved because only text is UPDATEd.
  {
    const db = new FakeDB({ services: [
      { id: 'service-1', title: 'Servicio viejo', description: 'Texto viejo', image_url: 'profiles/p1/service.jpg', sort_order: 0 },
    ] })
    const withoutConfirmation = await call('/api/v1/me/ai-profile-assistant/apply', {
      proposal: BASE_PROPOSAL,
      apply: { services: true },
      replace_existing_services: false,
    }, {}, db)
    assert.equal(withoutConfirmation.status, 409)

    const withConfirmation = await call('/api/v1/me/ai-profile-assistant/apply', {
      proposal: BASE_PROPOSAL,
      apply: { services: true },
      replace_existing_services: true,
    }, {}, db)
    assert.equal(withConfirmation.status, 200)
    const statements = db.batches.at(-1)
    assert.ok(statements.some((item) => /UPDATE profile_products/i.test(item.sql)))
    assert.ok(statements.every((item) => !/DELETE\s+FROM\s+profile_products/i.test(item.sql)))
  }

  // Manipulated/incomplete proposal is rejected server-side before any DB batch.
  {
    const db = new FakeDB()
    const result = await call('/api/v1/me/ai-profile-assistant/apply', {
      proposal: { professional_title: '<script>alert(1)</script>' },
      apply: { bio: true },
    }, {}, db)
    assert.equal(result.status, 400)
    assert.equal(db.batches.length, 0)
  }

  console.log('AI profile assistant endpoint integration checks: OK')
} finally {
  globalThis.fetch = originalFetch
  globalThis.setTimeout = originalSetTimeout
}
