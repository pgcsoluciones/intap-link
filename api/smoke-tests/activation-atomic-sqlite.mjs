/*
 * B2B.3 integration test: executes the real Production and Preview claim
 * migrations in SQLite and runs the same five-statement claim batch as API.
 * The local batch harness uses a SQLite transaction only to model D1's
 * documented DB.batch rollback boundary; production code uses DB.batch().
 * Run with: node api/smoke-tests/activation-atomic-sqlite.mjs
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Worker } from 'node:worker_threads'
import { DatabaseSync } from 'node:sqlite'

const root = new URL('..', import.meta.url)
const read = (relative) => fs.readFileSync(new URL(relative, root), 'utf8')
const CLAIM_AT = '2026-08-12 00:00:00.000'

function makeDb(preview = false, filename = ':memory:') {
  const db = new DatabaseSync(filename)
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE);
    CREATE TABLE profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      is_active INTEGER NOT NULL DEFAULT 1
    );
  `)

  const migrations = preview
    ? [
        'migrations-preview/0028_intap_artifacts.sql',
        'migrations-preview/0029_artifact_activation_intents.sql',
        'migrations-preview/0030_artifact_activation_claims.sql',
      ]
    : [
        'migrations/0027_intap_artifacts.sql',
        'migrations/0028_artifact_activation_intents.sql',
        'migrations/0029_artifact_activation_claims.sql',
      ]
  for (const migration of migrations) db.exec(read(migration))
  return db
}

function seed(db, {
  codeExpiresAt = '2099-01-01 00:00:00.000',
  intentExpiresAt = codeExpiresAt,
  secondIntent = false,
} = {}) {
  db.prepare('INSERT INTO users (id, email) VALUES (?, ?)').run('user-1', 'one@example.test')
  db.prepare('INSERT INTO users (id, email) VALUES (?, ?)').run('user-2', 'two@example.test')
  db.prepare(
    `INSERT INTO intap_artifacts (id, public_code, product_type, status)
     VALUES (?, ?, 'card', 'available')`,
  ).run('artifact-1', 'PUBCODE1')
  db.prepare(
    `INSERT INTO artifact_activation_codes
      (id, artifact_id, activation_code_hash, status, expires_at)
     VALUES (?, ?, ?, 'active', ?)`,
  ).run('code-1', 'artifact-1', 'hash-1', codeExpiresAt)
  db.prepare(
    `INSERT INTO artifact_activation_intents
      (id, intent_hash, artifact_id, activation_code_id, status, expires_at)
     VALUES (?, ?, ?, ?, 'active', ?)`,
  ).run('intent-1', 'intent-hash-1', 'artifact-1', 'code-1', intentExpiresAt)
  if (secondIntent) {
    db.prepare(
      `INSERT INTO artifact_activation_intents
        (id, intent_hash, artifact_id, activation_code_id, status, expires_at)
       VALUES (?, ?, ?, ?, 'active', ?)`,
    ).run('intent-2', 'intent-hash-2', 'artifact-1', 'code-1', '2099-01-01 00:00:00.000')
  }
}

function state(db) {
  return {
    artifact: db.prepare(
      `SELECT public_code, status, owner_user_id, profile_id, activated_at, updated_at
         FROM intap_artifacts WHERE id = 'artifact-1'`,
    ).get(),
    code: db.prepare(
      `SELECT status, used_at FROM artifact_activation_codes WHERE id = 'code-1'`,
    ).get(),
    intents: db.prepare(
      `SELECT intent_hash, status, consumed_at, revoked_at
         FROM artifact_activation_intents WHERE artifact_id = 'artifact-1'
        ORDER BY intent_hash`,
    ).all(),
    assertionCount: db.prepare(
      'SELECT COUNT(*) AS n FROM artifact_activation_claim_assertions',
    ).get().n,
  }
}

function statements({ intentHash, userId, profileId = null, claimAt = CLAIM_AT, codeIdOverride = null }) {
  const codeId = codeIdOverride || 'code-1'
  const claimId = `claim-${intentHash}-${userId}`
  return [
    {
      sql: `UPDATE intap_artifacts
               SET owner_user_id = ?, profile_id = ?, status = 'activated', activated_at = ?, updated_at = ?
             WHERE id = (SELECT i.artifact_id FROM artifact_activation_intents i WHERE i.intent_hash = ?)
               AND owner_user_id IS NULL
               AND status IN ('available', 'unassigned')
               AND EXISTS (
                 SELECT 1 FROM artifact_activation_intents i
                 JOIN artifact_activation_codes ac ON ac.id = i.activation_code_id
                 JOIN intap_artifacts a ON a.id = i.artifact_id AND ac.artifact_id = a.id
                  WHERE i.intent_hash = ? AND i.status = 'active' AND i.revoked_at IS NULL
                    AND i.expires_at > ? AND ac.status = 'active'
                    AND (ac.expires_at IS NULL OR ac.expires_at > ?)
               )
               AND (? IS NULL OR EXISTS (
                 SELECT 1 FROM profiles p WHERE p.id = ? AND p.user_id = ? AND p.is_active = 1
               ))`,
      params: [userId, profileId, claimAt, claimAt, intentHash, intentHash, claimAt, claimAt, profileId, profileId, userId],
    },
    {
      sql: `UPDATE artifact_activation_codes
               SET status = 'used', used_at = ?
             WHERE id = ? AND status = 'active'
               AND (expires_at IS NULL OR expires_at > ?)
               AND EXISTS (
                 SELECT 1 FROM artifact_activation_intents i
                 JOIN artifact_activation_codes ac ON ac.id = i.activation_code_id
                 JOIN intap_artifacts a ON a.id = i.artifact_id AND ac.artifact_id = a.id
                  WHERE i.intent_hash = ? AND i.status = 'active' AND i.revoked_at IS NULL
                    AND i.expires_at > ? AND a.owner_user_id = ?
                    AND a.status = 'activated' AND a.activated_at = ?
               )`,
      params: [claimAt, codeId, claimAt, intentHash, claimAt, userId, claimAt],
    },
    {
      sql: `UPDATE artifact_activation_intents
               SET status = 'consumed', consumed_at = ?
             WHERE intent_hash = ? AND status = 'active' AND revoked_at IS NULL AND expires_at > ?
               AND EXISTS (
                 SELECT 1 FROM artifact_activation_codes ac
                  WHERE ac.id = artifact_activation_intents.activation_code_id
                    AND ac.artifact_id = artifact_activation_intents.artifact_id
                    AND ac.status = 'used' AND ac.used_at = ?
               )
               AND EXISTS (
                 SELECT 1 FROM intap_artifacts a
                  WHERE a.id = artifact_activation_intents.artifact_id
                    AND a.owner_user_id = ? AND a.status = 'activated' AND a.activated_at = ?
               )`,
      params: [claimAt, intentHash, claimAt, claimAt, userId, claimAt],
    },
    {
      sql: `INSERT INTO artifact_activation_claim_assertions
              (id, intent_hash, user_id, profile_id, claim_at, ok)
            VALUES (?, ?, ?, ?, ?, CASE WHEN EXISTS (
              SELECT 1
                FROM artifact_activation_intents i
                JOIN artifact_activation_codes ac ON ac.id = i.activation_code_id
                JOIN intap_artifacts a ON a.id = i.artifact_id AND ac.artifact_id = a.id
               WHERE i.intent_hash = ? AND i.status = 'consumed' AND i.consumed_at = ?
                 AND ac.status = 'used' AND ac.used_at = ?
                 AND a.owner_user_id = ? AND a.status = 'activated' AND a.activated_at = ?
                 AND ((? IS NULL AND a.profile_id IS NULL) OR (? IS NOT NULL AND a.profile_id = ?))
                 AND (? IS NULL OR EXISTS (
                   SELECT 1 FROM profiles p WHERE p.id = a.profile_id AND p.user_id = ? AND p.is_active = 1
                 ))
            ) THEN 1 ELSE 0 END)`,
      params: [claimId, intentHash, userId, profileId, claimAt, intentHash, claimAt, claimAt, userId, claimAt, profileId, profileId, profileId, profileId, userId],
    },
    {
      sql: 'DELETE FROM artifact_activation_claim_assertions WHERE id = ? AND ok = 1',
      params: [claimId],
    },
  ]
}

// This is only a local SQLite model of D1's DB.batch([...]) rollback contract.
function batch(db, args) {
  db.exec('BEGIN')
  try {
    const results = statements(args).map(({ sql, params }) => db.prepare(sql).run(...params))
    db.exec('COMMIT')
    return results
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

for (const preview of [false, true]) {
  const db = makeDb(preview)
  assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'trigger' AND name LIKE '%activation_claim%'`).get().n, 0)
  assert.equal(db.prepare(`SELECT sql FROM sqlite_master WHERE name = 'artifact_activation_claim_assertions'`).get().sql.includes('CHECK (ok = 1)'), true)
  db.close()
}

// CASE 1: successful claim, one shared claimAt, and no assertion residue.
for (const preview of [false, true]) {
  const db = makeDb(preview)
  seed(db)
  batch(db, { intentHash: 'intent-hash-1', userId: 'user-1' })
  const finalState = state(db)
  assert.equal(finalState.artifact.status, 'activated')
  assert.equal(finalState.artifact.owner_user_id, 'user-1')
  assert.equal(finalState.artifact.activated_at, CLAIM_AT)
  assert.equal(finalState.code.status, 'used')
  assert.equal(finalState.code.used_at, CLAIM_AT)
  assert.deepEqual(finalState.intents.map(row => ({ ...row })), [{ intent_hash: 'intent-hash-1', status: 'consumed', consumed_at: CLAIM_AT, revoked_at: null }])
  assert.equal(finalState.assertionCount, 0)
  assert.equal(finalState.artifact.public_code, 'PUBCODE1')
  db.close()
}

// CASE 2: artifact update is valid but the code transition targets an invalid
// code; CHECK(ok = 1) fails and SQLite restores every row physically.
{
  const db = makeDb()
  seed(db)
  const before = state(db)
  assert.throws(() => batch(db, { intentHash: 'intent-hash-1', userId: 'user-1', codeIdOverride: 'missing-code' }), /CHECK constraint failed|constraint failed/)
  assert.deepEqual(state(db), before)
  db.close()
}

// CASE 3: intent is invalid at claim time; no transition is effective.
{
  const db = makeDb()
  seed(db)
  db.prepare(`UPDATE artifact_activation_intents SET revoked_at = ?, status = 'revoked' WHERE id = 'intent-1'`).run('2026-08-11 23:59:00.000')
  const before = state(db)
  assert.throws(() => batch(db, { intentHash: 'intent-hash-1', userId: 'user-1' }), /CHECK constraint failed|constraint failed/)
  assert.deepEqual(state(db), before)
  db.close()
}

// CASE 4/5/6: exact-boundary expiry, code expiry, and intent revocation.
for (const setup of [
  (db) => seed(db, { intentExpiresAt: CLAIM_AT }),
  (db) => seed(db, { codeExpiresAt: CLAIM_AT }),
  (db) => { seed(db); db.prepare(`UPDATE artifact_activation_intents SET revoked_at = ?, status = 'revoked' WHERE id = 'intent-1'`).run(CLAIM_AT) },
]) {
  const db = makeDb()
  setup(db)
  const before = state(db)
  assert.throws(() => batch(db, { intentHash: 'intent-hash-1', userId: 'user-1' }), /CHECK constraint failed|constraint failed/)
  assert.deepEqual(state(db), before)
  db.close()
}

// CASE 7/8/9/10: two concurrent real SQLite writers, one-time retry, and the
// invariant that all three timestamps are exactly the same claimAt.
{
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'intap-b2b3-'))
  const filename = path.join(directory, 'atomic.sqlite')
  const db = makeDb(false, filename)
  seed(db, { secondIntent: true })
  db.close()

  const workerCode = `
    const { parentPort, workerData } = require('node:worker_threads')
    const { DatabaseSync } = require('node:sqlite')
    const claimAt = ${JSON.stringify(CLAIM_AT)}
    function run(db) {
      db.exec('BEGIN')
      try {
        const q = [
          [\`UPDATE intap_artifacts SET owner_user_id = ?, profile_id = NULL, status = 'activated', activated_at = ?, updated_at = ? WHERE id = (SELECT artifact_id FROM artifact_activation_intents WHERE intent_hash = ?) AND owner_user_id IS NULL AND status IN ('available', 'unassigned') AND EXISTS (SELECT 1 FROM artifact_activation_intents i JOIN artifact_activation_codes ac ON ac.id = i.activation_code_id WHERE i.intent_hash = ? AND i.status = 'active' AND i.revoked_at IS NULL AND i.expires_at > ? AND ac.status = 'active' AND (ac.expires_at IS NULL OR ac.expires_at > ?))\`, [workerData.userId, claimAt, claimAt, workerData.intentHash, workerData.intentHash, claimAt, claimAt]],
          [\`UPDATE artifact_activation_codes SET status = 'used', used_at = ? WHERE id = (SELECT activation_code_id FROM artifact_activation_intents WHERE intent_hash = ?) AND status = 'active' AND (expires_at IS NULL OR expires_at > ?) AND EXISTS (SELECT 1 FROM artifact_activation_intents i JOIN intap_artifacts a ON a.id = i.artifact_id WHERE i.intent_hash = ? AND i.status = 'active' AND i.revoked_at IS NULL AND i.expires_at > ? AND a.owner_user_id = ? AND a.status = 'activated' AND a.activated_at = ?)\`, [claimAt, workerData.intentHash, claimAt, workerData.intentHash, claimAt, workerData.userId, claimAt]],
          [\`UPDATE artifact_activation_intents SET status = 'consumed', consumed_at = ? WHERE intent_hash = ? AND status = 'active' AND revoked_at IS NULL AND expires_at > ? AND EXISTS (SELECT 1 FROM artifact_activation_codes ac WHERE ac.id = artifact_activation_intents.activation_code_id AND ac.status = 'used' AND ac.used_at = ?) AND EXISTS (SELECT 1 FROM intap_artifacts a WHERE a.id = artifact_activation_intents.artifact_id AND a.owner_user_id = ? AND a.status = 'activated' AND a.activated_at = ?)\`, [claimAt, workerData.intentHash, claimAt, claimAt, workerData.userId, claimAt]],
          [\`INSERT INTO artifact_activation_claim_assertions (id, intent_hash, user_id, profile_id, claim_at, ok) VALUES (?, ?, ?, NULL, ?, CASE WHEN EXISTS (SELECT 1 FROM artifact_activation_intents i JOIN artifact_activation_codes ac ON ac.id = i.activation_code_id JOIN intap_artifacts a ON a.id = i.artifact_id WHERE i.intent_hash = ? AND i.status = 'consumed' AND i.consumed_at = ? AND ac.status = 'used' AND ac.used_at = ? AND a.owner_user_id = ? AND a.status = 'activated' AND a.activated_at = ?) THEN 1 ELSE 0 END)\`, [workerData.id, workerData.intentHash, workerData.userId, claimAt, workerData.intentHash, claimAt, claimAt, workerData.userId, claimAt]],
          [\`DELETE FROM artifact_activation_claim_assertions WHERE id = ? AND ok = 1\`, [workerData.id]],
        ]
        for (const [sql, params] of q) db.prepare(sql).run(...params)
        db.exec('COMMIT')
        return { ok: true, userId: workerData.userId }
      } catch (error) {
        db.exec('ROLLBACK')
        return { ok: false, userId: workerData.userId, error: String(error?.message || error) }
      }
    }
    const db = new DatabaseSync(workerData.filename)
    const result = run(db)
    db.close()
    parentPort.postMessage(result)
  `
  const runWorker = (id, intentHash, userId) => new Promise((resolve, reject) => {
    const worker = new Worker(workerCode, { eval: true, workerData: { filename, id, intentHash, userId } })
    worker.once('message', resolve)
    worker.once('error', reject)
  })
  const results = await Promise.all([
    runWorker('claim-1', 'intent-hash-1', 'user-1'),
    runWorker('claim-2', 'intent-hash-2', 'user-2'),
  ])
  assert.equal(results.filter(result => result.ok).length, 1)
  assert.equal(results.filter(result => !result.ok).length, 1)

  const finalDb = new DatabaseSync(filename)
  const finalState = state(finalDb)
  const winner = results.find(result => result.ok).userId
  assert.equal(finalState.artifact.owner_user_id, winner)
  assert.equal(finalState.artifact.status, 'activated')
  assert.equal(finalState.code.status, 'used')
  assert.equal(finalState.artifact.activated_at, CLAIM_AT)
  assert.equal(finalState.code.used_at, CLAIM_AT)
  assert.equal(finalState.intents.filter(intent => intent.status === 'consumed').length, 1)
  assert.equal(finalState.intents.filter(intent => intent.status === 'active').length, 1)
  assert.equal(finalState.assertionCount, 0)
  assert.throws(() => batch(finalDb, { intentHash: 'intent-hash-1', userId: 'user-2', claimAt: '2026-08-12 00:00:02.000' }), /CHECK constraint failed|constraint failed/)
  assert.equal(state(finalDb).assertionCount, 0)
  finalDb.close()
  fs.rmSync(directory, { recursive: true, force: true })
}

console.log('B2B.3 SQLite atomic rollback tests: PASS (D1 batch assertion, real rollback, expiry, revocation, one-time claim, concurrency)')
