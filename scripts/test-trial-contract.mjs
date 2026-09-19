import fs from 'node:fs'
import assert from 'node:assert/strict'

const api=fs.readFileSync('api/src/trial-profiles.ts','utf8')
const app=fs.readFileSync('web/src/App.tsx','utf8')
const ui=fs.readFileSync('web/src/components/trial/KawvoTrial.tsx','utf8')
const migration=fs.readFileSync('api/migrations/0070_trial_profiles_72h.sql','utf8')

for(const route of ['/trial','/trial/edit/:id','/trial/:slug']) assert.ok(app.includes(route),`missing route ${route}`)
assert.ok(api.includes("requireSuperAdmin('super_admin')"),'trial mutations must require super_admin')
assert.ok(api.includes("72*60*60*1000"),'expiry must be 72 hours from activation')
assert.ok(api.includes("status='active'"),'publish must activate trial')
assert.ok(api.includes("status='expired'"),'expired state must be persisted lazily')
assert.ok(api.includes("trial_profiles"),'trial storage missing')
assert.ok(migration.includes("CREATE TABLE IF NOT EXISTS trial_profiles"),'isolated trial table missing')
assert.ok(!migration.includes('ALTER TABLE profiles'),'must not mutate Free profile schema')
assert.ok(!migration.includes('sponsored_profiles'),'must not mutate Sponsored profile schema')
assert.ok(ui.includes('Los cambios se guardan automáticamente.'),'autosave UX missing')
assert.ok(ui.includes("https://app.preview.intaprd.com"),'preview superadmin calls must use host-only authenticated app origin')
assert.ok(ui.includes("path.startsWith('/api/v1/superadmin/')"),'protected Trial API must be routed through authenticated app origin')
assert.ok(ui.includes('Esta demostración ha finalizado.'),'expiration UX missing')
assert.ok(ui.includes('intaprd.com/trial/'),'final slug prefix missing')
assert.ok(!ui.includes('/demo/'),'trial UI must not depend on /demo namespace')
console.log('trial contract: ok')
