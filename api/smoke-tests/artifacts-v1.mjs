/*
 * B2 local contract/smoke tests.
 * Run with: esbuild api/src/index.ts --bundle --platform=node --format=esm --outfile=/tmp/intap-b2-index.mjs
 *           INTAP_B2_INDEX=/tmp/intap-b2-index.mjs node api/smoke-tests/artifacts-v1.mjs
 * Uses a deterministic in-memory D1 double; it never contacts Cloudflare.
 */
import assert from 'node:assert/strict'
const { default: app } = await import(process.env.INTAP_B2_INDEX || '../src/index.ts')
import {
  hashActivationCode,
  isActivationCodeShape,
  isPublicCodeShape,
  normalizeActivationCode,
  publicArtifactUrl,
} from '../src/artifacts.ts'

const activationCode = 'ABCD23456789'
const publicCode = 'ZXCV234567'

class FakeStatement {
  constructor(db, sql) { this.db = db; this.sql = sql; this.params = [] }
  bind(...params) { this.params = params; return this }
  first() { return Promise.resolve(this.db.first(this.sql, this.params)) }
  all() { return Promise.resolve(this.db.all(this.sql, this.params)) }
  run() { return Promise.resolve(this.db.run(this.sql, this.params)) }
}

class FakeDB {
  constructor() {
    this.artifactStatus = 'available'
    this.codeStatus = 'active'
    this.intentStatus = 'active'
    this.intentExpired = false
    this.intentRevoked = false
    this.ownerUserId = null
    this.profileId = null
    this.profileSlug = 'juanperez'
  }
  prepare(sql) { return new FakeStatement(this, sql) }
  first(sql, params) {
    if (sql.includes('SELECT id, user_id FROM auth_sessions')) return { id: 'session-1', user_id: 'user-1' }
    if (sql.includes('SELECT id FROM users WHERE id = ?')) return { email: 'qa@example.test' }
    if (sql.includes('SELECT ac.status as code_status')) {
      return { code_status: this.codeStatus, expires_at: null, public_code: publicCode, product_type: 'card', artifact_status: this.artifactStatus }
    }
    if (sql.includes('SELECT ac.id as activation_id')) {
      return { activation_id: 'activation-1', artifact_id: 'artifact-1', code_status: this.codeStatus, expires_at: null, public_code: publicCode, product_type: 'card', artifact_status: this.artifactStatus }
    }
    if (sql.includes('SELECT i.id FROM artifact_activation_intents')) {
      return this.intentStatus === 'active' && !this.intentExpired && !this.intentRevoked
        ? { id: 'intent-1' }
        : null
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
      return this.intentStatus === 'consumed'
        ? { id: 'artifact-1', public_code: publicCode, product_type: 'card', status: this.artifactStatus, profile_id: this.profileId, profile_slug: this.profileId ? this.profileSlug : null, profile_name: 'QA Profile', activated_at: '2026-08-11 00:00:00', created_at: '2026-08-11 00:00:00', updated_at: '2026-08-11 00:00:00' }
        : null
    }
    return null
  }
  all(sql) {
    if (sql.includes('FROM intap_artifacts a')) {
      return { results: [{ id: 'artifact-1', public_code: publicCode, product_type: 'card', status: this.artifactStatus, profile_id: this.profileId, profile_slug: this.profileId ? this.profileSlug : null, profile_name: 'QA Profile', activated_at: null, created_at: '2026-08-11 00:00:00', updated_at: '2026-08-11 00:00:00' }] }
    }
    return { results: [] }
  }
  run(sql) {
    if (sql.includes('INSERT INTO artifact_activation_intents')) {
      return { meta: { changes: this.artifactStatus === 'available' && this.codeStatus === 'active' ? 1 : 0 } }
    }
    if (sql.includes('INSERT INTO artifact_activation_claims')) {
      if (this.artifactStatus !== 'available' || this.codeStatus !== 'active' || this.intentStatus !== 'active' || this.intentExpired || this.intentRevoked) {
        throw new Error('activation claim precondition failed')
      }
      this.artifactStatus = 'activated'
      this.codeStatus = 'used'
      this.intentStatus = 'consumed'
      this.ownerUserId = 'user-1'
      return { meta: { changes: 1 } }
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

assert.equal(normalizeActivationCode(' abcd-2345 6789 '), activationCode)
assert.equal(isActivationCodeShape(activationCode), true)
assert.equal(isPublicCodeShape(publicCode), true)
assert.equal(publicArtifactUrl('https://preview.example.test/', publicCode), `https://preview.example.test/l/${publicCode}`)
assert.notEqual(await hashActivationCode(activationCode), activationCode)

let response = await request('/api/v1/public/artifacts/activation/inspect', { method: 'POST', body: JSON.stringify({ activation_code: activationCode }) })
let json = await response.json()
assert.equal(response.status, 200)
assert.equal(json.ok, true)
assert.equal(json.data.public_code, publicCode)
assert.equal(JSON.stringify(json).includes('activation_code_hash'), false)

response = await request('/api/v1/me/artifacts/activate', { method: 'POST', headers: { Cookie: 'intap_preview_session_id=test-session; intap_preview_activation_intent=opaque-intent' }, body: JSON.stringify({}) })
json = await response.json()
assert.equal(response.status, 201)
assert.equal(json.data.status, 'activated')
assert.equal(json.data.public_code, publicCode)

response = await request('/api/v1/me/artifacts/activate', { method: 'POST', headers: { Cookie: 'intap_preview_session_id=other-session; intap_preview_activation_intent=opaque-intent' }, body: JSON.stringify({}) })
assert.equal(response.status, 409)

db.profileId = 'profile-1'
response = await request(`/api/v1/me/artifacts/artifact-1/profile`, { method: 'PATCH', headers: { Cookie: 'intap_preview_session_id=test-session' }, body: JSON.stringify({ profile_id: 'profile-1' }) })
assert.equal(response.status, 200)

response = await request(`/api/v1/public/artifacts/${publicCode}/resolve`)
json = await response.json()
assert.equal(response.status, 200)
assert.equal(json.data.redirect_path, '/juanperez')

db.profileSlug = 'jpconsulting'
response = await request(`/api/v1/public/artifacts/${publicCode}/resolve`)
json = await response.json()
assert.equal(json.data.redirect_path, '/jpconsulting')
assert.equal(json.data.public_code, publicCode)

db.artifactStatus = 'suspended'
response = await request(`/api/v1/public/artifacts/${publicCode}/resolve`)
assert.equal(response.status, 410)

db.artifactStatus = 'activated'
db.profileId = null
response = await request(`/api/v1/public/artifacts/${publicCode}/resolve`)
assert.equal(response.status, 409)

db.codeStatus = 'used'
response = await request('/api/v1/public/artifacts/activation/inspect', { method: 'POST', body: JSON.stringify({ activation_code: activationCode }) })
assert.equal(response.status, 409)

console.log('B2 artifact smoke tests: PASS (local D1 double; no remote calls)')
