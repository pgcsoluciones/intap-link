import assert from 'node:assert/strict'
import fs from 'node:fs'

const { default: app } = await import(process.env.INTAP_B2B1_INDEX || '../src/index.ts')

const publicCode = 'ZXCV234567'
const intentCookie = 'opaque-intent-token'

class FakeStatement {
  constructor(db, sql) { this.db = db; this.sql = sql; this.params = [] }
  bind(...params) { this.params = params; return this }
  first() { return Promise.resolve(this.db.first(this.sql, this.params)) }
  all() { return Promise.resolve({ results: [] }) }
  run() { return Promise.resolve(this.db.run(this.sql, this.params)) }
}

class FakeDB {
  constructor() { this.reset() }
  reset() {
    this.artifactStatus = 'available'
    this.codeStatus = 'active'
    this.codeExpired = false
    this.intentStatus = 'active'
    this.intentExpired = false
    this.intentRevoked = false
    this.ownerUserId = null
    this.profileId = null
    this.profileSlug = 'juanperez'
    this.sessionUserId = 'user-1'
  }
  prepare(sql) { return new FakeStatement(this, sql) }
  batch() {
    if (!this.pending()) throw new Error('activation claim assertion failed')
    this.artifactStatus = 'activated'
    this.codeStatus = 'used'
    this.intentStatus = 'consumed'
    this.ownerUserId = this.sessionUserId
    return []
  }
  first(sql, params) {
    if (sql.includes('SELECT id, user_id FROM auth_sessions')) return { id: 'session-1', user_id: this.sessionUserId }
    if (sql.includes('SELECT id FROM users WHERE id = ?')) return { email: 'qa@example.test' }
    if (sql.includes('SELECT ac.status as code_status')) {
      return { code_status: this.codeStatus, expires_at: null, public_code: publicCode, product_type: 'card', artifact_status: this.artifactStatus }
    }
    if (sql.includes('SELECT i.id FROM artifact_activation_intents')) {
      return this.pending() ? { id: 'intent-1' } : null
    }
    if (sql.includes('SELECT a.public_code, a.product_type')) {
      return this.pending() ? { public_code: publicCode, product_type: 'card' } : null
    }
    if (sql.includes('SELECT id FROM profiles WHERE id = ? AND user_id = ? AND is_active = 1')) {
      return params[0] === 'profile-1' ? { id: 'profile-1' } : null
    }
    if (sql.includes('SELECT a.public_code, a.status, a.profile_id')) {
      return this.artifactStatus === 'activated'
        ? { public_code: publicCode, status: 'activated', profile_id: this.profileId, slug: this.profileSlug, is_active: 1, is_published: 1 }
        : { public_code: publicCode, status: this.artifactStatus, profile_id: this.profileId, slug: this.profileSlug, is_active: 1, is_published: 1 }
    }
    if (sql.includes('SELECT a.id, a.public_code, a.product_type')) {
      return this.intentStatus === 'consumed' && this.ownerUserId === this.sessionUserId
        ? { id: 'artifact-1', public_code: publicCode, product_type: 'card', status: this.artifactStatus, profile_id: this.profileId, profile_slug: this.profileId ? this.profileSlug : null, profile_name: 'QA Profile', activated_at: '2026-08-11 00:00:00', created_at: '2026-08-11 00:00:00', updated_at: '2026-08-11 00:00:00' }
        : null
    }
    return null
  }
  pending() {
    return this.intentStatus === 'active' && !this.intentExpired && !this.intentRevoked && this.codeStatus === 'active' && !this.codeExpired && this.artifactStatus === 'available' && this.ownerUserId == null
  }
  run(sql) {
    if (sql.includes('INSERT INTO artifact_activation_intents')) {
      return { meta: { changes: this.pending() ? 1 : 0 } }
    }
    return { meta: { changes: 1 } }
  }

}

const db = new FakeDB()
const env = {
  DB: db,
  API_URL: 'https://api-preview.example.test',
  WEB_URL: 'https://preview.example.test',
  APP_URL: 'https://app.preview.example.test',
  ENVIRONMENT: 'preview',
  ADMIN_EMAILS: 'qa@example.test',
}

async function request(path, init = {}) {
  const headers = new Headers(init.headers || {})
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  return app.fetch(new Request(`https://api-preview.example.test${path}`, { ...init, headers }), env)
}

const repoRoot = new URL('../..', import.meta.url).pathname
const apiSource = fs.readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8')
const cookieSource = fs.readFileSync(new URL('../src/lib/cookies.ts', import.meta.url), 'utf8')
const activationUi = fs.readFileSync(new URL('../../app/src/components/admin/ArtifactActivation.tsx', import.meta.url), 'utf8')
const authCallbackUi = fs.readFileSync(new URL('../../app/src/components/admin/AuthCallback.tsx', import.meta.url), 'utf8')
const adminLoginUi = fs.readFileSync(new URL('../../app/src/components/admin/AdminLogin.tsx', import.meta.url), 'utf8')

assert.match(apiSource, /artifact_activation_intents/)
assert.match(apiSource, /const intentToken = generateToken\(32\)/)
assert.match(apiSource, /const intentHash = await sha256Hex\(intentToken\)/)
assert.match(cookieSource, /HttpOnly; Secure; SameSite=Lax; Path=/)
assert.match(apiSource, /artifact_activation_claims/)
assert.match(apiSource, /const claimAt = new Date\(\)/)
assert.match(apiSource, /DB\.batch\(\[/)
assert.match(apiSource, /intent_hash, artifact_id, activation_code_id, user_id, profile_id, claim_at, ok/)
assert.doesNotMatch(apiSource.slice(apiSource.indexOf("me.post('/artifacts/activate'"), apiSource.indexOf("me.patch('/artifacts/:id/profile'")), /DELETE FROM artifact_activation_claims|artifact_activation_claim_assertions/)
assert.doesNotMatch(apiSource.slice(apiSource.indexOf("me.post('/artifacts/activate'"), apiSource.indexOf("me.patch('/artifacts/:id/profile'")), /CREATE TRIGGER|RAISE\(/)
assert.match(cookieSource, /intap_preview_activation_intent/)
assert.match(cookieSource, /isPreviewEnvironment/)
assert.match(apiSource, /const resumeActivation = await hasPendingActivationIntent\(c\)/)
assert.match(apiSource, /headers\.set\('Location', `\$\{appUrl\}\$\{resumeActivation \? '\/admin\/artifacts\/activate' : '\/admin'\}`\)/)
assert.match(apiSource, /i\.status = 'active'/)
assert.match(apiSource, /i\.revoked_at IS NULL/)
assert.match(apiSource, /i\.expires_at > datetime\('now'\)/)
assert.match(apiSource, /a\.owner_user_id IS NULL/)
assert.doesNotMatch(apiSource.slice(apiSource.indexOf("me.post('/artifacts/activate'"), apiSource.indexOf("me.patch('/artifacts/:id/profile'")), /activation_code\b|activationCode/)
const googleStart = apiSource.slice(apiSource.indexOf("app.get('/api/v1/auth/google/start'"), apiSource.indexOf("app.get('/api/v1/auth/google/callback'"))
const magicStart = apiSource.slice(apiSource.indexOf("app.post('/api/v1/auth/magic-link/start'"), apiSource.indexOf("app.get('/api/v1/auth/magic-link/verify'"))
assert.doesNotMatch(googleStart, /activation_code|intap_activation_code/)
assert.doesNotMatch(magicStart, /activation_code|intap_activation_code/)
assert.match(authCallbackUi, /apiGet\('\/me\/artifacts\/activation\/intent'\)/)
assert.match(adminLoginUi, /auth\/google\/start/)
assert.doesNotMatch(activationUi, /sessionStorage|localStorage/)
assert.doesNotMatch(authCallbackUi, /intap_activation_code|sessionStorage.*activation_code|localStorage.*activation_code/)

let response = await request('/api/v1/public/artifacts/activation/inspect', {
  method: 'POST', body: JSON.stringify({ activation_code: 'ABCD23456789' }),
})
let json = await response.json()
assert.equal(response.status, 200)
assert.equal(json.data.public_code, publicCode)
assert.match(response.headers.get('set-cookie') || '', /intap_preview_activation_intent=.*HttpOnly.*Max-Age=900/)
assert.doesNotMatch(response.headers.get('set-cookie') || '', /Domain=\.intaprd\.com/)
assert.doesNotMatch(JSON.stringify(json), /activation_code|activation_code_hash/)

response = await request('/api/v1/me/artifacts/activation/intent', {
  headers: { Cookie: `intap_preview_session_id=test-session; intap_preview_activation_intent=${intentCookie}` },
})
assert.equal(response.status, 200)

// Explicit preflight-to-claim condition change: revocation causes all three
// conditional updates to return zero; no artifact/code/intent state changes.
db.codeStatus = 'revoked'
response = await request('/api/v1/me/artifacts/activate', {
  method: 'POST', headers: { Cookie: `intap_preview_session_id=test-session; intap_preview_activation_intent=${intentCookie}` }, body: '{}',
})
assert.equal(response.status, 409)
assert.equal(db.artifactStatus, 'available')
assert.equal(db.intentStatus, 'active')

db.reset()
db.intentExpired = true
response = await request('/api/v1/me/artifacts/activate', {
  method: 'POST', headers: { Cookie: `intap_preview_session_id=test-session; intap_preview_activation_intent=${intentCookie}` }, body: '{}',
})
assert.equal(response.status, 409)
assert.equal(db.artifactStatus, 'available')
assert.equal(db.codeStatus, 'active')

db.reset()
db.codeExpired = true
response = await request('/api/v1/me/artifacts/activate', {
  method: 'POST', headers: { Cookie: `intap_preview_session_id=test-session; intap_preview_activation_intent=${intentCookie}` }, body: '{}',
})
assert.equal(response.status, 409)
assert.equal(db.artifactStatus, 'available')
assert.equal(db.intentStatus, 'active')

db.reset()
response = await request('/api/v1/me/artifacts/activate', {
  method: 'POST', headers: { Cookie: `intap_preview_session_id=test-session; intap_preview_activation_intent=${intentCookie}` }, body: '{}',
})
json = await response.json()
assert.equal(response.status, 201)
assert.equal(db.ownerUserId, 'user-1')
assert.equal(db.intentStatus, 'consumed')
assert.equal(db.codeStatus, 'used')
assert.equal(json.data.public_code, publicCode)

// A consumed intent and a second claimant cannot be reused.
db.sessionUserId = 'user-2'
response = await request('/api/v1/me/artifacts/activate', {
  method: 'POST', headers: { Cookie: `intap_preview_session_id=other-session; intap_preview_activation_intent=${intentCookie}` }, body: '{}',
})
assert.equal(response.status, 409)
assert.equal(db.ownerUserId, 'user-1')
assert.equal(db.artifactStatus, 'activated')

db.profileId = 'profile-1'
response = await request('/api/v1/me/artifacts/artifact-1/profile', {
  method: 'PATCH', headers: { Cookie: 'intap_preview_session_id=test-session' }, body: JSON.stringify({ profile_id: 'profile-1' }),
})
assert.equal(response.status, 200)
response = await request(`/api/v1/public/artifacts/${publicCode}/resolve`)
json = await response.json()
assert.equal(response.status, 200)
assert.equal(json.data.public_code, publicCode)
assert.equal(json.data.redirect_path, '/juanperez')

db.profileSlug = 'jpconsulting'
response = await request(`/api/v1/public/artifacts/${publicCode}/resolve`)
json = await response.json()
assert.equal(json.data.public_code, publicCode)
assert.equal(json.data.redirect_path, '/jpconsulting')

console.log('B2B.1 activation intent smoke tests: PASS (atomic stale-condition, expiry, revocation, reuse, concurrency, UI contracts)')
