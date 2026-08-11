/*
 * B2B.2 integration test: executes the real Production and Preview artifact
 * migrations in SQLite, including the real claim triggers.
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

function seed(db, { codeExpiresAt = '2099-01-01 00:00:00.000', intentExpiresAt = codeExpiresAt } = {}) {
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
    intent: db.prepare(
      `SELECT status, consumed_at FROM artifact_activation_intents WHERE id = 'intent-1'`,
    ).get(),
    markerCount: db.prepare('SELECT COUNT(*) AS n FROM artifact_activation_claims').get().n,
  }
}

function claim(db, intentHash = 'intent-hash-1', userId = 'user-1', claimAt = '2026-08-12 00:00:00.000') {
  return db.prepare(
    `INSERT INTO artifact_activation_claims (id, intent_hash, user_id, profile_id, claim_at)
     VALUES (?, ?, ?, NULL, ?)`,
  ).run(crypto.randomUUID(), intentHash, userId, claimAt)
}

// Both migration sequences compile and expose the same atomic trigger contract.
for (const preview of [false, true]) {
  const db = makeDb(preview)
  assert.deepEqual(
    db.prepare(`SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'trg_artifact_activation_claim_%' ORDER BY name`).all().map(row => row.name),
    ['trg_artifact_activation_claim_after_insert', 'trg_artifact_activation_claim_before_insert'],
  )
  db.close()
}

// CASE 1: artifact transition occurs, the next SQL condition raises, and the
// complete statement rolls back physically. The test-only trigger injects a
// deterministic SQL failure immediately after the artifact transition.
{
  const db = makeDb()
  seed(db)
  db.exec(`
    CREATE TRIGGER test_force_next_transition_error
    AFTER UPDATE OF status ON intap_artifacts
    WHEN NEW.status = 'activated'
    BEGIN
      SELECT RAISE(ABORT, 'forced next transition error');
    END;
  `)
  const before = state(db)
  assert.throws(() => claim(db), /forced next transition error/)
  assert.deepEqual(state(db), before)
  db.close()
}

// CASE 2: expiration exactly at the preflight/claim boundary is invalid.
{
  const db = makeDb()
  seed(db, { codeExpiresAt: '2099-01-01 00:00:00.000', intentExpiresAt: '2026-08-12 00:00:00.000' })
  const before = state(db)
  assert.throws(() => claim(db, 'intent-hash-1', 'user-1', '2026-08-12 00:00:00.000'), /precondition failed/)
  assert.deepEqual(state(db), before)
  db.close()
}

// CASE 3: revocation between preflight and claim persists no transition.
{
  const db = makeDb()
  seed(db)
  db.prepare(`UPDATE artifact_activation_codes SET status = 'revoked' WHERE id = 'code-1'`).run()
  const before = state(db)
  assert.throws(() => claim(db), /precondition failed/)
  assert.deepEqual(state(db), before)
  db.close()
}

// CASE 4: two real SQLite writers contend for the same public artifact. The
// database serializes the writes; exactly one claim succeeds and the other
// fails its trigger precondition without changing the first owner.
{
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'intap-b2b2-'))
  const filename = path.join(directory, 'atomic.sqlite')
  const db = makeDb(false, filename)
  seed(db)
  db.prepare(
    `INSERT INTO artifact_activation_intents
      (id, intent_hash, artifact_id, activation_code_id, status, expires_at)
     VALUES (?, ?, ?, ?, 'active', ?)`,
  ).run('intent-2', 'intent-hash-2', 'artifact-1', 'code-1', '2099-01-01 00:00:00.000')

  db.close()

  const workerCode = `
    const { parentPort, workerData } = require('node:worker_threads')
    const { DatabaseSync } = require('node:sqlite')
    try {
      const db = new DatabaseSync(workerData.filename)
      db.prepare(
        'INSERT INTO artifact_activation_claims (id, intent_hash, user_id, profile_id, claim_at) VALUES (?, ?, ?, NULL, ?)'
      ).run(workerData.id, workerData.intentHash, workerData.userId, workerData.claimAt)
      db.close()
      parentPort.postMessage({ ok: true, userId: workerData.userId })
    } catch (error) {
      parentPort.postMessage({ ok: false, userId: workerData.userId, error: String(error?.message || error) })
    }
  `
  const runWorker = (id, intentHash, userId) => new Promise((resolve, reject) => {
    const worker = new Worker(workerCode, { eval: true, workerData: {
      filename, id, intentHash, userId, claimAt: '2026-08-12 00:00:00.000',
    } })
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
  assert.equal(finalState.artifact.owner_user_id, results.find(result => result.ok).userId)
  assert.equal(finalState.artifact.status, 'activated')
  assert.equal(finalState.artifact.public_code, 'PUBCODE1')
  assert.equal(finalState.code.status, 'used')
  const intentStatuses = finalDb.prepare(
    `SELECT intent_hash, status, consumed_at
       FROM artifact_activation_intents
      WHERE artifact_id = 'artifact-1'
      ORDER BY intent_hash`,
  ).all()
  assert.equal(intentStatuses.filter(intent => intent.status === 'consumed').length, 1)
  assert.equal(intentStatuses.filter(intent => intent.status === 'active').length, 1)
  assert.equal(intentStatuses.find(intent => intent.status === 'consumed').consumed_at, '2026-08-12 00:00:00.000')
  assert.equal(finalState.markerCount, 0)
  assert.equal(finalState.artifact.activated_at, '2026-08-12 00:00:00.000')
  assert.equal(finalState.code.used_at, '2026-08-12 00:00:00.000')
  assert.throws(() => claim(finalDb, 'intent-hash-1', 'user-2', '2026-08-12 00:00:02.000'), /precondition failed/)
  finalDb.close()
  fs.rmSync(directory, { recursive: true, force: true })
}

console.log('B2B.2 SQLite atomic rollback tests: PASS (Production/Preview migrations, rollback, stale expiry, revocation, one-time claim, double claimant)')
