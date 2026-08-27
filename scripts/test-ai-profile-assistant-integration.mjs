import assert from 'node:assert/strict'

const { default: app } = await import('file:///tmp/kawvo-ai-api.mjs')

const BASE_PROPOSAL = {
  professional_title: 'Electricista residencial y comercial',
  bio: 'Resuelve instalaciones, averías y mejoras eléctricas en hogares y pequeños negocios. Presenta cada trabajo con claridad para que el cliente sepa qué necesita y cómo solicitarlo.',
  services_section_title: 'Soluciones eléctricas',
  services_section_description: 'Trabajos eléctricos pensados para resolver necesidades concretas de instalación, reparación y mejora.',
  services: [
    { title: 'Instalaciones eléctricas', description: 'Instalación de luminarias, abanicos, tomas y cableado para hogares o negocios.' },
    { title: 'Reparación de averías', description: 'Diagnóstico y corrección de cortos y fallas para recuperar el funcionamiento.' },
  ],
  portfolio: [],
  cta: { label: 'Solicita una cotización', goal: 'quote' },
  image_suggestions: [
    { purpose: 'Mostrar experiencia real', suggestion: 'Foto trabajando en una instalación o del resultado terminado.' },
  ],
}

class Statement {
  constructor(db, sql) { this.db = db; this.sql = sql; this.args = [] }
  bind(...args) { this.args = args; return this }
  async first() { return this.db.first(this.sql, this.args) }
  async all() { return this.db.all(this.sql, this.args) }
  async run() { this.db.runs.push({ sql: this.sql, args: this.args }); this.db.onRun(this.sql, this.args); return { success: true } }
}

class FakeDB {
  constructor({ services = [], channels = ['whatsapp'], acceptedTerms = ['ai-assistant-v1.0'], daily = 0, monthly = 0 } = {}) {
    this.services = services
    this.channels = channels
    this.acceptedTerms = new Set(acceptedTerms)
    this.daily = daily
    this.monthly = monthly
    this.runs = []
    this.batches = []
    this.queries = []
  }
  prepare(sql) { return new Statement(this, sql) }
  async first(sql, args = []) {
    this.queries.push({ sql, args })
    if (sql.includes('FROM auth_sessions')) return { user_id: 'user-1' }
    if (sql.includes('FROM profiles')) return { id: 'profile-1', slug: 'electricista-demo', plan_id: 'free', name: 'Juan Demo', bio: '', category: 'Mantenimiento e instalaciones técnicas', template_data: '{}' }
    if (sql.includes('FROM profile_contact')) return {
      whatsapp: this.channels.includes('whatsapp') ? '18095550000' : '',
      email: this.channels.includes('email') ? 'demo@example.com' : '',
      phone: this.channels.includes('phone') ? '8095550000' : '',
      address: this.channels.includes('visit') ? 'Santo Domingo' : '',
    }
    if (sql.includes('FROM ai_assistant_terms_acceptances')) return this.acceptedTerms.has(String(args[1])) ? { id: 'accept-1' } : null
    if (sql.includes('FROM ai_profile_assistant_usage')) return { daily_count: this.daily, monthly_count: this.monthly, last_created_at: null, input_tokens: 0, output_tokens: 0, estimated_cost_usd: 0 }
    return null
  }
  async all(sql) { if (sql.includes('FROM profile_products')) return { results: this.services }; return { results: [] } }
  async batch(statements) { this.batches.push(statements.map((s) => ({ sql: s.sql, args: s.args }))); return statements.map(() => ({ success: true })) }
  onRun(sql, args) { if (sql.includes('INSERT INTO ai_assistant_terms_acceptances')) this.acceptedTerms.add(String(args[1])) }
}

function env(db, overrides = {}) {
  return {
    ENVIRONMENT: 'preview', DB: db, OPENAI_API_KEY: 'test-key-not-real', OPENAI_MODEL: 'gpt-5.6-luna',
    AI_TERMS_VERSION: 'ai-assistant-v1.0', AI_PROFILE_DAILY_LIMIT: '8', AI_PROFILE_MONTHLY_LIMIT: '100',
    AI_PROFILE_MAX_ROUNDS: '2', AI_PROFILE_COOLDOWN_SECONDS: '20', FREE_MAX_SERVICES: '3', ...overrides,
  }
}
function request(path, body, { cookie = true, method = 'POST' } = {}) {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (cookie) headers.set('Cookie', 'intap_preview_session_id=test-session')
  return new Request(`https://app.preview.intaprd.com${path}`, { method, headers, body: method === 'GET' ? undefined : JSON.stringify(body ?? {}) })
}
async function call(path, body, options = {}, db = new FakeDB(), envOverrides = {}) {
  const response = await app.fetch(request(path, body, options), env(db, envOverrides))
  let parsed = null; try { parsed = await response.json() } catch {}
  return { status: response.status, body: parsed, db }
}

const originalFetch = globalThis.fetch
const originalSetTimeout = globalThis.setTimeout

try {
  // P: authentication is mandatory; the endpoint never accepts a target profile id from the client.
  {
    const result = await call('/api/v1/me/ai-profile-assistant/generate', { answers: { activity_details: 'Soy electricista.' } }, { cookie: false })
    assert.equal(result.status, 401)
  }

  // G: no accepted terms => no model call.
  {
    let upstreamCalled = false
    globalThis.fetch = async () => { upstreamCalled = true; throw new Error('must not run') }
    const db = new FakeDB({ acceptedTerms: [] })
    const result = await call('/api/v1/me/ai-profile-assistant/generate', { answers: { activity_details: 'Soy electricista residencial.' }, round: 1 }, {}, db)
    assert.equal(result.status, 428)
    assert.equal(result.body.code, 'consent_required')
    assert.equal(upstreamCalled, false)
  }

  // H: an old accepted version does not satisfy a new required version.
  {
    const db = new FakeDB({ acceptedTerms: ['ai-assistant-v1.0'] })
    const result = await call('/api/v1/me/ai-profile-assistant/generate', { answers: { activity_details: 'Soy electricista residencial.' }, round: 1 }, {}, db, { AI_TERMS_VERSION: 'ai-assistant-v1.1' })
    assert.equal(result.status, 428)
  }

  // Explicit versioned consent can be recorded.
  {
    const db = new FakeDB({ acceptedTerms: [] })
    const result = await call('/api/v1/me/ai-profile-assistant/terms/accept', { accepted: true, locale: 'es-DO' }, {}, db)
    assert.equal(result.status, 200)
    assert.equal(result.body.data.terms_version, 'ai-assistant-v1.0')
    assert.ok(db.runs.some((x) => /ai_assistant_terms_acceptances/.test(x.sql)))
  }

  // C: multiple configured channels are not prioritized arbitrarily.
  {
    let upstreamCalled = false
    globalThis.fetch = async () => { upstreamCalled = true; throw new Error('must not run') }
    const db = new FakeDB({ channels: ['whatsapp','phone','email'] })
    const result = await call('/api/v1/me/ai-profile-assistant/generate', { answers: { activity_details: 'Soy electricista.', clients: 'hogares' }, round: 1 }, {}, db)
    assert.equal(result.status, 200)
    assert.equal(result.body.data.status, 'needs_more_info')
    assert.deepEqual(result.body.data.options, ['whatsapp','phone','email'])
    assert.equal(upstreamCalled, false)
  }

  // D + A + K + N: one channel does not trigger needless question; ready proposal is textual and generation never mutates profile.
  {
    globalThis.fetch = async (_url, init) => {
      const payload = JSON.parse(init.body)
      assert.equal(payload.store, false)
      assert.equal(payload.text.verbosity, 'medium')
      assert.equal(payload.text.format.type, 'json_schema')
      assert.match(payload.instructions, /carta de presentación digital|primera impresión/i)
      assert.match(payload.instructions, /editing_scope|ALCANCE DE EDICIÓN/i)
      assert.match(payload.instructions, /portafolio/i)
      assert.match(payload.input, /"editing_scope":"missing_only"/)
      assert.match(payload.instructions, /nunca inventes/i)
      return { ok: true, status: 200, json: async () => ({ status: 'completed', output_text: JSON.stringify({ status: 'ready', proposal: BASE_PROPOSAL }), usage: { input_tokens: 500, output_tokens: 240 } }) }
    }
    const db = new FakeDB({ channels: ['whatsapp'] })
    const result = await call('/api/v1/me/ai-profile-assistant/generate', { answers: { activity_details: 'soy electricista pongo abanico lampara inversore y arreglo corto 😅', clients: 'casas y negocios', next_action: 'que me escriban pa cotizar' }, round: 1 }, {}, db)
    assert.equal(result.status, 200)
    assert.equal(result.body.data.status, 'ready')
    assert.equal(result.body.data.proposal.professional_title, BASE_PROPOSAL.professional_title)
    assert.equal(result.body.data.proposal.image_suggestions.length, 1)
    assert.equal(db.batches.length, 0)
  }

  // Editing scope is explicit and defaults to safe missing_only.
  {
    globalThis.fetch = async (_url, init) => {
      const payload = JSON.parse(init.body)
      assert.match(payload.input, /\"editing_scope\":\"full_profile\"/)
      return { ok: true, status: 200, json: async () => ({ status: 'completed', output_text: JSON.stringify({ status: 'ready', proposal: BASE_PROPOSAL }), usage: {} }) }
    }
    const result = await call('/api/v1/me/ai-profile-assistant/generate', { answers: { activity_details: 'Soy electricista.', preferred_contact: 'whatsapp' }, round: 1, editing_scope: 'full_profile' })
    assert.equal(result.status, 200)
    assert.equal(result.body.data.status, 'ready')
  }

  // B: the model can request only high-value missing information.
  {
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ status: 'completed', output_text: JSON.stringify({ status: 'needs_more_info', questions: ['¿Atiendes hogares, negocios o ambos?'] }), usage: {} }) })
    const result = await call('/api/v1/me/ai-profile-assistant/generate', { answers: { activity_details: 'Hago instalaciones eléctricas.' }, preferred_contact: 'whatsapp', round: 1 })
    assert.equal(result.status, 200)
    assert.equal(result.body.data.status, 'needs_more_info')
    assert.equal(result.body.data.questions.length, 1)
  }

  // E: backend normalizes excessive model questions to at most three.
  {
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ status: 'completed', output_text: JSON.stringify({ status: 'needs_more_info', questions: ['Q1','Q2','Q3','Q4'] }), usage: {} }) })
    const result = await call('/api/v1/me/ai-profile-assistant/generate', { answers: { activity_details: 'Hago instalaciones eléctricas.' }, preferred_contact: 'whatsapp', round: 1 })
    assert.equal(result.status, 200)
    assert.equal(result.body.data.questions.length, 3)
  }

  // F/O: prompt forbids invented services and server caps Free services to configured max even if model returns more.
  {
    const proposal = { ...BASE_PROPOSAL, services: Array.from({ length: 5 }, (_, i) => ({ title: `Servicio ${i+1}`, description: `Descripción ${i+1}` })) }
    globalThis.fetch = async (_url, init) => {
      assert.match(JSON.parse(init.body).instructions, /Nunca inventes/i)
      return { ok: true, status: 200, json: async () => ({ status: 'completed', output_text: JSON.stringify({ status: 'ready', proposal }), usage: {} }) }
    }
    const result = await call('/api/v1/me/ai-profile-assistant/generate', { answers: { activity_details: 'Hago trabajos eléctricos.', preferred_contact: 'whatsapp' }, round: 1 })
    assert.equal(result.status, 200)
    assert.equal(result.body.data.proposal.services.length, 3)
  }

  // I: quota exhaustion is a normal 429, separate from abuse/suspension.
  {
    const db = new FakeDB({ daily: 8 })
    const result = await call('/api/v1/me/ai-profile-assistant/generate', { answers: { activity_details: 'Soy electricista.' }, preferred_contact: 'whatsapp', round: 1 }, {}, db)
    assert.equal(result.status, 429)
    assert.equal(result.body.code, 'daily_limit')
  }

  // Round limit is enforced in backend.
  {
    const result = await call('/api/v1/me/ai-profile-assistant/generate', { answers: { activity_details: 'Soy electricista.' }, preferred_contact: 'whatsapp', round: 3 })
    assert.equal(result.status, 429)
    assert.equal(result.body.code, 'round_limit')
  }

  // L/M: apply is explicit, non-destructive and never publishes.
  {
    const db = new FakeDB({ services: [{ id:'service-1', title:'Viejo', description:'Viejo', image_url:'profiles/p1/service.jpg', sort_order:0 }] })
    const safeMissingOnly = await call('/api/v1/me/ai-profile-assistant/apply', {
      proposal: BASE_PROPOSAL,
      apply: { services:true },
      replace_existing_services:false,
      editing_scope:'missing_only',
    }, {}, db)
    assert.equal(safeMissingOnly.status, 200)

    const withoutConfirmation = await call('/api/v1/me/ai-profile-assistant/apply', {
      proposal: BASE_PROPOSAL,
      apply: { services:true },
      replace_existing_services:false,
      editing_scope:'full_profile',
    }, {}, db)
    assert.equal(withoutConfirmation.status, 409)

    const withConfirmation = await call('/api/v1/me/ai-profile-assistant/apply', {
      proposal: BASE_PROPOSAL,
      apply: { identity:true,bio:true,services_section:true,services:true },
      replace_existing_services:true,
      editing_scope:'full_profile',
    }, {}, db)
    assert.equal(withConfirmation.status, 200)
    assert.equal(withConfirmation.body.data.published, false)
    const statements = db.batches.at(-1)
    assert.ok(statements.some((x) => /UPDATE profiles/.test(x.sql)))
    assert.ok(statements.some((x) => /UPDATE profile_products/.test(x.sql)))
    assert.ok(statements.every((x) => !/DELETE\s+FROM\s+profile_products/i.test(x.sql)))
  }

  // Invalid proposal is rejected server-side.
  {
    const db = new FakeDB()
    const result = await call('/api/v1/me/ai-profile-assistant/apply', { proposal: { professional_title:'x' }, apply:{ bio:true } }, {}, db)
    assert.equal(result.status, 400)
    assert.equal(db.batches.length, 0)
  }

  // Timeout remains recoverable.
  {
    globalThis.setTimeout = (fn, _ms, ...args) => originalSetTimeout(fn, 5, ...args)
    globalThis.fetch = async (_url, init) => await new Promise((_resolve,reject) => init.signal.addEventListener('abort',()=>{ const e = new Error('aborted'); e.name='AbortError'; reject(e) },{ once:true }))
    const result = await call('/api/v1/me/ai-profile-assistant/generate', { answers:{ activity_details:'Soy electricista.' }, preferred_contact:'whatsapp', round:1 })
    assert.equal(result.status, 504)
    globalThis.setTimeout = originalSetTimeout
  }

  console.log('AI profile assistant endpoint integration checks: OK')
} finally {
  globalThis.fetch = originalFetch
  globalThis.setTimeout = originalSetTimeout
}
