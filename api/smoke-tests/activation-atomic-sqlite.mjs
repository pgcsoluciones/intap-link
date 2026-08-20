/* B2B.3A: real SQLite model of the D1 atomic claim batch. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Worker } from 'node:worker_threads'
import { DatabaseSync } from 'node:sqlite'

const root = new URL('..', import.meta.url)
const read = (relative) => fs.readFileSync(new URL(relative, root), 'utf8')
const CLAIM_AT = '2026-08-12 00:00:00.000'
const CLAIM_AT_2 = '2026-08-12 00:00:01.000'

function makeDb(preview = false, filename = ':memory:') {
  const db = new DatabaseSync(filename)
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE);
    CREATE TABLE profiles (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, is_active INTEGER NOT NULL DEFAULT 1);
  `)
  const migrations = preview
    ? ['migrations-preview/0028_intap_artifacts.sql', 'migrations-preview/0029_artifact_activation_intents.sql', 'migrations-preview/0030_artifact_activation_claims.sql']
    : ['migrations/0027_intap_artifacts.sql', 'migrations/0028_artifact_activation_intents.sql', 'migrations/0029_artifact_activation_claims.sql']
  for (const migration of migrations) db.exec(read(migration))
  return db
}

function seed(db, { codeExpiresAt = '2099-01-01 00:00:00.000', intentExpiresAt = codeExpiresAt, secondIntent = false, secondCode = false } = {}) {
  db.prepare('INSERT INTO users (id, email) VALUES (?, ?)').run('user-1', 'one@example.test')
  db.prepare('INSERT INTO users (id, email) VALUES (?, ?)').run('user-2', 'two@example.test')
  db.prepare("INSERT INTO intap_artifacts (id, public_code, product_type, status) VALUES ('artifact-1', 'PUBCODE1', 'card', 'available')").run()
  db.prepare("INSERT INTO artifact_activation_codes (id, artifact_id, activation_code_hash, status, expires_at) VALUES ('code-1', 'artifact-1', 'hash-1', 'active', ?)").run(codeExpiresAt)
  db.prepare("INSERT INTO artifact_activation_intents (id, intent_hash, artifact_id, activation_code_id, status, expires_at) VALUES ('intent-1', 'intent-hash-1', 'artifact-1', 'code-1', 'active', ?)").run(intentExpiresAt)
  if (secondIntent || secondCode) {
    if (secondCode) db.prepare("INSERT INTO artifact_activation_codes (id, artifact_id, activation_code_hash, status, expires_at) VALUES ('code-2', 'artifact-1', 'hash-2', 'active', '2099-01-01 00:00:00.000')").run()
    db.prepare("INSERT INTO artifact_activation_intents (id, intent_hash, artifact_id, activation_code_id, status, expires_at) VALUES ('intent-2', 'intent-hash-2', 'artifact-1', ?, 'active', '2099-01-01 00:00:00.000')").run(secondCode ? 'code-2' : 'code-1')
  }
}

function state(db) {
  return {
    artifact: db.prepare("SELECT public_code, status, owner_user_id, profile_id, activated_at, updated_at FROM intap_artifacts WHERE id = 'artifact-1'").get(),
    code: db.prepare("SELECT status, used_at FROM artifact_activation_codes WHERE id = 'code-1'").get(),
    intents: db.prepare("SELECT intent_hash, status, consumed_at, revoked_at FROM artifact_activation_intents WHERE artifact_id = 'artifact-1' ORDER BY intent_hash").all().map(row => ({ ...row })),
    receiptCount: db.prepare('SELECT COUNT(*) AS n FROM artifact_activation_claims').get().n,
    receipt: (() => { const row = db.prepare('SELECT intent_hash, artifact_id, activation_code_id, user_id, profile_id, claim_at, ok FROM artifact_activation_claims ORDER BY intent_hash LIMIT 1').get(); return row ? { ...row } : row })(),
  }
}

function claimStatements({ intentHash, userId, profileId = null, claimAt = CLAIM_AT, codeId = 'code-1' }) {
  return [
    [
      `UPDATE intap_artifacts SET owner_user_id = ?, profile_id = ?, status = 'activated', activated_at = ?, updated_at = ?
       WHERE id = (SELECT artifact_id FROM artifact_activation_intents WHERE intent_hash = ?)
         AND owner_user_id IS NULL AND status IN ('available', 'unassigned')
         AND EXISTS (SELECT 1 FROM artifact_activation_intents i JOIN artifact_activation_codes ac ON ac.id = i.activation_code_id JOIN intap_artifacts a ON a.id = i.artifact_id AND ac.artifact_id = a.id
                     WHERE i.intent_hash = ? AND i.status = 'active' AND i.revoked_at IS NULL AND i.expires_at > ? AND ac.status = 'active' AND (ac.expires_at IS NULL OR ac.expires_at > ?))
         AND (? IS NULL OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = ? AND p.user_id = ? AND p.is_active = 1))`,
      [userId, profileId, claimAt, claimAt, intentHash, intentHash, claimAt, claimAt, profileId, profileId, userId],
    ],
    [
      `UPDATE artifact_activation_codes SET status = 'used', used_at = ?
       WHERE id = ? AND status = 'active' AND (expires_at IS NULL OR expires_at > ?)
         AND EXISTS (SELECT 1 FROM artifact_activation_intents i JOIN artifact_activation_codes ac ON ac.id = i.activation_code_id JOIN intap_artifacts a ON a.id = i.artifact_id AND ac.artifact_id = a.id
                     WHERE i.intent_hash = ? AND i.status = 'active' AND i.revoked_at IS NULL AND i.expires_at > ? AND a.owner_user_id = ? AND a.status = 'activated' AND a.activated_at = ?)`,
      [claimAt, codeId, claimAt, intentHash, claimAt, userId, claimAt],
    ],
    [
      `UPDATE artifact_activation_intents SET status = 'consumed', consumed_at = ?
       WHERE intent_hash = ? AND status = 'active' AND revoked_at IS NULL AND expires_at > ?
         AND EXISTS (SELECT 1 FROM artifact_activation_codes ac WHERE ac.id = artifact_activation_intents.activation_code_id AND ac.artifact_id = artifact_activation_intents.artifact_id AND ac.status = 'used' AND ac.used_at = ?)
         AND EXISTS (SELECT 1 FROM intap_artifacts a WHERE a.id = artifact_activation_intents.artifact_id AND a.owner_user_id = ? AND a.status = 'activated' AND a.activated_at = ?)`,
      [claimAt, intentHash, claimAt, claimAt, userId, claimAt],
    ],
    [
      `INSERT INTO artifact_activation_claims (intent_hash, artifact_id, activation_code_id, user_id, profile_id, claim_at, ok)
       VALUES (?, (SELECT artifact_id FROM artifact_activation_intents WHERE intent_hash = ?), (SELECT activation_code_id FROM artifact_activation_intents WHERE intent_hash = ?), ?, ?, ?, CASE WHEN EXISTS (
         SELECT 1 FROM artifact_activation_intents i JOIN artifact_activation_codes ac ON ac.id = i.activation_code_id JOIN intap_artifacts a ON a.id = i.artifact_id AND ac.artifact_id = a.id
                 WHERE i.intent_hash = ? AND i.status = 'consumed' AND i.consumed_at = ? AND ac.status = 'used' AND ac.used_at = ?
                   AND a.id = (SELECT artifact_id FROM artifact_activation_intents WHERE intent_hash = ?)
                   AND ac.id = (SELECT activation_code_id FROM artifact_activation_intents WHERE intent_hash = ?)
            AND a.owner_user_id = ? AND a.status = 'activated' AND a.activated_at = ?
            AND ((? IS NULL AND a.profile_id IS NULL) OR (? IS NOT NULL AND a.profile_id = ?))
            AND (? IS NULL OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = a.profile_id AND p.user_id = ? AND p.is_active = 1))
       ) THEN 1 ELSE 0 END)`,
      [intentHash, intentHash, intentHash, userId, profileId, claimAt, intentHash, claimAt, claimAt, intentHash, intentHash, userId, claimAt, profileId, profileId, profileId, profileId, userId],
    ],
  ]
}

function batch(db, args) {
  db.exec('BEGIN')
  try {
    const results = claimStatements(args).map(([sql, params]) => db.prepare(sql).run(...params))
    db.exec('COMMIT')
    return results
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

for (const preview of [false, true]) {
  const db = makeDb(preview)
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'trigger' AND name LIKE '%activation_claim%'").get().n, 0)
  const ddl = db.prepare("SELECT sql FROM sqlite_master WHERE name = 'artifact_activation_claims'").get().sql
  assert.match(ddl, /intent_hash\s+TEXT PRIMARY KEY/)
  assert.match(ddl, /CHECK \(ok = 1\)/)
  db.close()
}

// A/H: successful claim leaves exactly one immutable receipt with one claimAt.
for (const preview of [false, true]) {
  const db = makeDb(preview)
  seed(db)
  batch(db, { intentHash: 'intent-hash-1', userId: 'user-1' })
  const s = state(db)
  assert.equal(s.receiptCount, 1)
  assert.deepEqual(s.receipt, { intent_hash: 'intent-hash-1', artifact_id: 'artifact-1', activation_code_id: 'code-1', user_id: 'user-1', profile_id: null, claim_at: CLAIM_AT, ok: 1 })
  assert.equal(s.artifact.activated_at, CLAIM_AT)
  assert.equal(s.code.used_at, CLAIM_AT)
  assert.equal(s.intents[0].consumed_at, CLAIM_AT)
  assert.equal(s.artifact.public_code, 'PUBCODE1')
  db.close()
}

// B/C: same user/profile/intent fails with the exact same or a different claimAt.
{
  const db = makeDb(); seed(db); batch(db, { intentHash: 'intent-hash-1', userId: 'user-1' })
  assert.throws(() => batch(db, { intentHash: 'intent-hash-1', userId: 'user-1', claimAt: CLAIM_AT }), /UNIQUE constraint failed|PRIMARY KEY constraint failed/)
  assert.throws(() => batch(db, { intentHash: 'intent-hash-1', userId: 'user-1', claimAt: CLAIM_AT_2 }), /CHECK constraint failed|constraint failed/)
  assert.equal(state(db).receiptCount, 1)
  db.close()
}

// F/G: failures before or at the receipt assertion roll back all transitions.
{
  const db = makeDb(); seed(db); const before = state(db)
  assert.throws(() => batch(db, { intentHash: 'intent-hash-1', userId: 'user-1', codeId: 'missing-code' }), /CHECK constraint failed|constraint failed/)
  assert.deepEqual(state(db), before)
  db.close()
}
for (const setup of [
  (db) => seed(db, { intentExpiresAt: CLAIM_AT }),
  (db) => seed(db, { codeExpiresAt: CLAIM_AT }),
  (db) => { seed(db); db.prepare("UPDATE artifact_activation_intents SET revoked_at = ?, status = 'revoked' WHERE id = 'intent-1'").run(CLAIM_AT) },
]) {
  const db = makeDb(); setup(db); const before = state(db)
  assert.throws(() => batch(db, { intentHash: 'intent-hash-1', userId: 'user-1' }), /CHECK constraint failed|constraint failed/)
  assert.deepEqual(state(db), before); db.close()
}

// B: two active intents for the same code and artifact cannot both claim.
{
  const db = makeDb(); seed(db, { secondIntent: true })
  batch(db, { intentHash: 'intent-hash-1', userId: 'user-1' })
  const beforeSecond = state(db)
  assert.throws(() => batch(db, { intentHash: 'intent-hash-2', userId: 'user-1', claimAt: CLAIM_AT }), /UNIQUE constraint failed|PRIMARY KEY constraint failed|constraint failed/)
  const afterSecond = state(db)
  assert.equal(afterSecond.receiptCount, 1)
  assert.equal(afterSecond.intents.filter(intent => intent.status === 'consumed').length, 1)
  assert.equal(afterSecond.intents.find(intent => intent.intent_hash === 'intent-hash-2').status, 'active')
  assert.deepEqual(afterSecond.artifact, beforeSecond.artifact)
  assert.deepEqual(afterSecond.code, beforeSecond.code)
  db.close()
}

// C: two different codes/intents attached to one artifact still allow only
// one initial activation; the artifact UNIQUE receipt is the guard.
{
  const db = makeDb(); seed(db, { secondCode: true })
  batch(db, { intentHash: 'intent-hash-1', userId: 'user-1' })
  assert.throws(() => batch(db, { intentHash: 'intent-hash-2', userId: 'user-1', claimAt: CLAIM_AT }), /UNIQUE constraint failed|PRIMARY KEY constraint failed|constraint failed/)
  assert.equal(state(db).receiptCount, 1)
  db.close()
}

const workerCode = `
  const { parentPort, workerData } = require('node:worker_threads')
  const { DatabaseSync } = require('node:sqlite')
  const db = new DatabaseSync(workerData.filename)
  db.exec('PRAGMA busy_timeout = 5000')
  const at = workerData.claimAt
  const h = workerData.intentHash
  const u = workerData.userId
  const q = [
    [\`UPDATE intap_artifacts SET owner_user_id = ?, profile_id = NULL, status = 'activated', activated_at = ?, updated_at = ? WHERE id = (SELECT artifact_id FROM artifact_activation_intents WHERE intent_hash = ?) AND owner_user_id IS NULL AND status IN ('available', 'unassigned') AND EXISTS (SELECT 1 FROM artifact_activation_intents i JOIN artifact_activation_codes ac ON ac.id = i.activation_code_id JOIN intap_artifacts a ON a.id = i.artifact_id AND ac.artifact_id = a.id WHERE i.intent_hash = ? AND i.status = 'active' AND i.revoked_at IS NULL AND i.expires_at > ? AND ac.status = 'active' AND (ac.expires_at IS NULL OR ac.expires_at > ?))\`, [u, at, at, h, h, at, at]],
    [\`UPDATE artifact_activation_codes SET status = 'used', used_at = ? WHERE id = (SELECT activation_code_id FROM artifact_activation_intents WHERE intent_hash = ?) AND status = 'active' AND (expires_at IS NULL OR expires_at > ?) AND EXISTS (SELECT 1 FROM artifact_activation_intents i JOIN artifact_activation_codes ac ON ac.id = i.activation_code_id JOIN intap_artifacts a ON a.id = i.artifact_id AND ac.artifact_id = a.id WHERE i.intent_hash = ? AND i.status = 'active' AND i.revoked_at IS NULL AND i.expires_at > ? AND a.owner_user_id = ? AND a.status = 'activated' AND a.activated_at = ?)\`, [at, h, at, h, at, u, at]],
    [\`UPDATE artifact_activation_intents SET status = 'consumed', consumed_at = ? WHERE intent_hash = ? AND status = 'active' AND revoked_at IS NULL AND expires_at > ? AND EXISTS (SELECT 1 FROM artifact_activation_codes ac WHERE ac.id = artifact_activation_intents.activation_code_id AND ac.artifact_id = artifact_activation_intents.artifact_id AND ac.status = 'used' AND ac.used_at = ?) AND EXISTS (SELECT 1 FROM intap_artifacts a WHERE a.id = artifact_activation_intents.artifact_id AND a.owner_user_id = ? AND a.status = 'activated' AND a.activated_at = ?)\`, [at, h, at, at, u, at]],
    [\`INSERT INTO artifact_activation_claims (intent_hash, artifact_id, activation_code_id, user_id, profile_id, claim_at, ok) VALUES (?, (SELECT artifact_id FROM artifact_activation_intents WHERE intent_hash = ?), (SELECT activation_code_id FROM artifact_activation_intents WHERE intent_hash = ?), ?, NULL, ?, CASE WHEN EXISTS (SELECT 1 FROM artifact_activation_intents i JOIN artifact_activation_codes ac ON ac.id = i.activation_code_id JOIN intap_artifacts a ON a.id = i.artifact_id AND ac.artifact_id = a.id WHERE i.intent_hash = ? AND i.status = 'consumed' AND i.consumed_at = ? AND ac.status = 'used' AND ac.used_at = ? AND a.id = (SELECT artifact_id FROM artifact_activation_intents WHERE intent_hash = ?) AND ac.id = (SELECT activation_code_id FROM artifact_activation_intents WHERE intent_hash = ?) AND a.owner_user_id = ? AND a.status = 'activated' AND a.activated_at = ?) THEN 1 ELSE 0 END)\`, [h, h, h, u, at, h, at, at, h, h, u, at]],
  ]
  try { db.exec('BEGIN'); for (const [sql, p] of q) db.prepare(sql).run(...p); db.exec('COMMIT'); parentPort.postMessage({ ok: true, userId: u }) }
  catch (error) { try { db.exec('ROLLBACK') } catch {} parentPort.postMessage({ ok: false, userId: u, error: String(error?.message || error) }) }
  db.close()
`

function runWorker(filename, intentHash, userId, claimAt = CLAIM_AT, id = '') {
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerCode, { eval: true, workerData: { filename, intentHash, userId, claimAt, id } })
    worker.once('message', resolve); worker.once('error', reject)
  })
}

// D: same user + same intent + same claimAt concurrently yields one receipt.
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'intap-b2b3a-same-')); const filename = path.join(dir, 'same.sqlite')
  const db = makeDb(false, filename); seed(db); db.close()
  const results = await Promise.all([runWorker(filename, 'intent-hash-1', 'user-1'), runWorker(filename, 'intent-hash-1', 'user-1')])
  assert.equal(results.filter(r => r.ok).length, 1); assert.equal(state(new DatabaseSync(filename)).receiptCount, 1)
  const check = new DatabaseSync(filename); assert.equal(state(check).receiptCount, 1); check.close(); fs.rmSync(dir, { recursive: true, force: true })
}

// E: two users competing for one artifact still produce exactly one receipt.
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'intap-b2b3a-users-')); const filename = path.join(dir, 'users.sqlite')
  const db = makeDb(false, filename); seed(db, { secondIntent: true }); db.close()
  const results = await Promise.all([runWorker(filename, 'intent-hash-1', 'user-1'), runWorker(filename, 'intent-hash-2', 'user-2')])
  assert.equal(results.filter(r => r.ok).length, 1); const check = new DatabaseSync(filename); assert.equal(state(check).receiptCount, 1); check.close(); fs.rmSync(dir, { recursive: true, force: true })
}

console.log('B2B.3B SQLite atomic receipt tests: PASS (intent/code/artifact uniqueness, same-claimAt retry, assertion rollback, expiry, revocation, concurrency)')
