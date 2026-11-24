// G8.1: change only the App Pages origin of the official Preview frontdoor.
// One-shot guarded promotion; never deploys API code, Production, D1 or R2.
// Usage: node --input-type=module - --check | --apply | --inspect | --rollback
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir, tmpdir } from 'node:os'
import { createHash } from 'node:crypto'

const ACCOUNT = 'adf4d5ebb625fed2c32e38cef57a6319'
const WORKER = 'intap-api-preview'
const BASELINE = '9c63a559-49be-4617-bf69-2acd6d035589'
const NEW_ORIGIN = 'https://612b7245.intap-web2.pages.dev'
const PREVIEW = 'https://app.preview.intaprd.com'
const NEW_BUNDLE = '/assets/index-CRNEulvk.js'
const DIR = join(homedir(), 'intap-release-logs', 'kawvo-g8-1-preview-app-612b7245')
const BASE = 'https://api.cloudflare.com/client/v4/accounts/' + ACCOUNT
const mode = process.argv[2] || '--check'
const check = (ok, message) => { if (!ok) throw new Error('BLOCKED: ' + message) }
const safeWrite = (name, data) => writeFileSync(join(DIR, name), JSON.stringify(data, null, 2), { flag: 'wx', mode: 0o600 })
const read = name => JSON.parse(readFileSync(join(DIR, name), 'utf8'))
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
const sha256 = b64 => createHash('sha256').update(Buffer.from(b64, 'base64')).digest('hex')

function auth() {
  if (process.env.CLOUDFLARE_API_TOKEN) return 'Bearer ' + process.env.CLOUDFLARE_API_TOKEN
  execFileSync('npx', ['--yes', '--package=wrangler@4.166.0', '--', 'wrangler', 'whoami'], { stdio: 'pipe', cwd: tmpdir() })
  const paths = [
    'Library/Preferences/.wrangler/config/default.toml',
    '.wrangler/config/default.toml',
    '.config/.wrangler/config/default.toml',
  ].map(p => join(homedir(), p)).filter(existsSync)
  check(paths.length === 1, 'Wrangler OAuth source missing/ambiguous')
  const token = readFileSync(paths[0], 'utf8').match(/^oauth_token\s*=\s*"([^"\r\n]+)"/m)?.[1]
  check(token, 'Wrangler OAuth token unavailable')
  return 'Bearer ' + token
}
async function api(method, path, token, body) {
  const headers = { Authorization: token }
  if (body !== undefined && !(body instanceof FormData)) headers['Content-Type'] = 'application/json'
  const response = await fetch(BASE + path, {
    method, headers,
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    redirect: 'error', signal: AbortSignal.timeout(method === 'GET' ? 30000 : 120000),
  })
  const data = await response.json().catch(() => null)
  check(response.ok && data?.success === true, method + ' ' + path + ' HTTP ' + response.status + ' codes ' + JSON.stringify((data?.errors || []).map(e => e.code)))
  return data.result
}
async function snapshot(token) {
  const deployments = await api('GET', '/workers/scripts/' + WORKER + '/deployments', token)
  const versions = deployments?.deployments?.[0]?.versions
  check(Array.isArray(versions) && versions.length === 1 && Number(versions[0]?.percentage) === 100, 'Preview Worker is not single version at 100%')
  const id = versions[0].version_id
  const full = await api('GET', '/workers/workers/' + WORKER + '/versions/' + id + '?include=modules', token)
  check(full?.id === id && full.bindings?.length === 35 && full.modules?.length === 1, 'Preview runtime 35 bindings / one module changed')
  check(new Set(full.bindings.map(b => b.name)).size === 35, 'duplicate Worker bindings')
  check(full.modules[0].name === full.main_module && full.modules[0].content_base64, 'Worker source module unavailable')
  check(full.bindings.some(b => b.name === 'ENVIRONMENT' && b.text === 'preview'), 'wrong Worker environment')
  check(full.bindings.some(b => b.name === 'DB' && b.type === 'd1') && full.bindings.some(b => b.name === 'BUCKET' && b.type === 'r2_bucket'), 'D1 or R2 bindings missing')
  const origin = full.bindings.find(b => b.name === 'APP_PAGES_ORIGIN')
  check(origin?.type === 'plain_text' && /^https:\/\/[a-z0-9.-]+\.intap-web2\.pages\.dev$/.test(origin.text), 'unexpected old App Preview origin')
  return { id, full, origin: origin.text }
}
async function bundle(origin) {
  const u = new URL('/admin/login', origin)
  u.searchParams.set('g81verify', Date.now().toString())
  const response = await fetch(u, { redirect: 'follow', signal: AbortSignal.timeout(25000) })
  check(response.ok, 'App login not available at ' + origin + ' HTTP ' + response.status)
  const text = await response.text()
  const match = text.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/)
  check(match, 'App bundle missing at ' + origin)
  return match[0]
}
function invariant(before, after) {
  for (const key of ['main_module', 'compatibility_date', 'compatibility_flags', 'limits', 'placement', 'cache_options', 'usage_model', 'exports']) {
    check(same(before[key], after[key]), 'Worker runtime changed: ' + key)
  }
  check(after.modules?.length === before.modules.length, 'Worker module count changed')
  for (const m of before.modules) {
    const next = after.modules.find(x => x.name === m.name)
    check(next && sha256(next.content_base64) === sha256(m.content_base64), 'Worker API module code changed')
  }
  check(after.bindings?.length === before.bindings.length, 'Worker binding count changed')
  for (const b of before.bindings) {
    const next = after.bindings.find(x => x.name === b.name)
    check(next, 'Worker binding removed: ' + b.name)
    if (b.name === 'APP_PAGES_ORIGIN') {
      check(next.type === 'plain_text' && next.text === NEW_ORIGIN, 'App origin not switched exclusively')
    } else check(same(next, b), 'Worker binding changed: ' + b.name)
  }
}
async function main() {
  check(['--check', '--apply', '--inspect', '--rollback'].includes(mode) && process.argv.length <= 3, 'Invalid mode')
  const token = auth()
  const active = await snapshot(token)
  const liveBundle = await bundle(PREVIEW)
  const stagedBundle = await bundle(NEW_ORIGIN)
  const attemptExists = existsSync(join(DIR, 'attempt.json'))
  const receiptExists = existsSync(join(DIR, 'receipt.json'))
  if (mode === '--check' || mode === '--inspect') {
    console.log(JSON.stringify({
      operation: 'READ ONLY', activeWorker: active.id, previousAppOrigin: active.origin,
      currentPreviewBundle: liveBundle, stagedOrigin: NEW_ORIGIN, stagedBundle,
      stageExpected: NEW_BUNDLE, ready: active.id === BASELINE
        && active.origin !== NEW_ORIGIN && stagedBundle === NEW_BUNDLE && !attemptExists,
      attemptExists, receiptExists,
      note: 'Only APP_PAGES_ORIGIN may change; all other 34 Worker bindings and API bytes preserved',
    }, null, 2))
    return
  }
  check(stagedBundle === NEW_BUNDLE, 'isolated App stage bundle is not the pinned G8.1 build')
  if (mode === '--rollback') {
    check(receiptExists, 'no successful receipt; no rollback')
    const receipt = read('receipt.json')
    check(active.id === receipt.newVersion && active.origin === NEW_ORIGIN, 'active Worker does not match recorded promotion')
    check(receipt.oldVersion === BASELINE, 'old Worker receipt mismatched')
    safeWrite('rollback-attempt.json', { from: active.id, to: receipt.oldVersion, at: new Date().toISOString() })
    await api('POST', '/workers/scripts/' + WORKER + '/deployments', token, {
      strategy: 'percentage', versions: [{ version_id: receipt.oldVersion, percentage: 100 }],
      annotations: { 'workers/message': 'G8.1 official Preview rollback to recorded G7.1 Worker' },
    })
    const restored = await snapshot(token)
    check(restored.id === receipt.oldVersion && restored.origin === receipt.oldOrigin, 'rollback readback mismatched, do NOT retry')
    console.log(JSON.stringify({ result: 'PASS', operation: 'rollback', restoredVersion: restored.id, restoredOrigin: restored.origin }, null, 2))
    return
  }
  check(!attemptExists, 'prior promotion attempt exists, inspect; NEVER retry upload blindly')
  check(active.id === BASELINE, 'active Preview Worker changed since preflight')
  check(active.origin !== NEW_ORIGIN, 'candidate already active')
  check(liveBundle !== NEW_BUNDLE, 'candidate bundle already served by shared Preview')
  mkdirSync(DIR, { recursive: true, mode: 0o700 })
  safeWrite('attempt.json', {
    operation: 'G8.1 official App Preview promotion', oldVersion: active.id,
    oldOrigin: active.origin, oldBundle: liveBundle, newOrigin: NEW_ORIGIN, newBundle: stagedBundle,
    at: new Date().toISOString(),
  })
  const metadata = {
    main_module: active.full.main_module,
    bindings: active.full.bindings.map(b => b.name === 'APP_PAGES_ORIGIN'
      ? { name: b.name, type: 'plain_text', text: NEW_ORIGIN }
      : { name: b.name, type: 'inherit', version_id: active.id }),
    annotations: {
      'workers/tag': 'G8.1-APP-612b7245',
      'workers/message': 'G8.1 Preview App origin only; 34 inherited bindings; rollback ' + active.id,
    },
  }
  for (const key of ['compatibility_date', 'compatibility_flags', 'limits', 'placement', 'cache_options', 'usage_model', 'exports']) {
    if (active.full[key] !== undefined && active.full[key] !== null) metadata[key] = active.full[key]
  }
  const form = new FormData()
  form.set('metadata', JSON.stringify(metadata))
  for (const m of active.full.modules) {
    form.set(m.name, new Blob([Buffer.from(m.content_base64, 'base64')], { type: m.content_type || 'application/javascript+module' }), m.name)
  }
  safeWrite('upload-attempt.json', { oldVersion: active.id, newOrigin: NEW_ORIGIN })
  const uploaded = await api('POST', '/workers/workers/' + WORKER + '/versions?bindings_inherit=strict', token, form)
  check(uploaded?.id && /^[a-f0-9-]{36}$/i.test(uploaded.id), 'ambiguous Worker version upload; NO RETRY')
  safeWrite('new-version.json', { id: uploaded.id })
  const after = await api('GET', '/workers/workers/' + WORKER + '/versions/' + uploaded.id + '?include=modules', token)
  invariant(active.full, after)
  const still = await snapshot(token)
  check(still.id === active.id && still.origin === active.origin, 'Preview Worker changed during stage')
  check(await bundle(PREVIEW) === liveBundle, 'Preview App changed during stage')
  safeWrite('activation-attempt.json', { oldVersion: active.id, newVersion: uploaded.id })
  await api('POST', '/workers/scripts/' + WORKER + '/deployments', token, {
    strategy: 'percentage', versions: [{ version_id: uploaded.id, percentage: 100 }],
    annotations: { 'workers/message': 'G8.1 App Preview promoted; rollback ' + active.id },
  })
  const activated = await snapshot(token)
  check(activated.id === uploaded.id && activated.origin === NEW_ORIGIN, 'activation readback mismatch; DO NOT RETRY')
  const seen = await bundle(PREVIEW)
  safeWrite('receipt.json', {
    result: seen === NEW_BUNDLE ? 'PASS' : 'BLOCKED', oldVersion: active.id,
    newVersion: uploaded.id, oldOrigin: active.origin, newOrigin: NEW_ORIGIN,
    oldBundle: liveBundle, actualBundle: seen,
  })
  check(seen === NEW_BUNDLE, 'Preview HTML bundle mismatch; use --rollback after inspection')
  console.log(JSON.stringify({
    result: 'PASS_G8_1_OFFICIAL_PREVIEW', url: PREVIEW,
    version: uploaded.id, previousVersion: active.id, origin: NEW_ORIGIN,
    bundle: seen, productionUnchanged: true,
  }, null, 2))
}
main().catch(error => {
  const msg = String(error?.message || error)
  console.error(msg.startsWith('BLOCKED:') ? msg : 'BLOCKED: ' + msg)
  process.exitCode = 1
})
