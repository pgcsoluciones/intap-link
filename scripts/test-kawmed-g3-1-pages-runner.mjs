import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BASE, CANDIDATE, CANDIDATE_BRANCH, PROJECT, STAGE_BRANCH, APP_PREVIEW, ALLOWLIST, Runner, manifest, options, owner, normalizeWebSeo } from './kawmed-g3-1-pages.mjs'

// No Cloudflare, git mutation, build, credential lookup or real upload in this suite.
const temporary = mkdtempSync(join(tmpdir(), 'kawmed-pages-contract-'))
let checks = 0
const test = async (name, action) => { await action(); checks++; console.log('PASS ' + name) }
const artifact = version => ({
  'index.html': '<script type="module" src="/assets/main.js"></script><link rel="stylesheet" href="/assets/main.css">',
  'assets/main.js': 'export const version=' + JSON.stringify(version) + '; import("./lazy.js");',
  'assets/lazy.js': 'export default ' + JSON.stringify(version),
  'assets/main.css': '/*' + version + '*/ body{margin:0}',
  '_headers': '/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n',
})
function writeArtifact(directory, files) {
  for (const [name, bytes] of Object.entries(files)) { mkdirSync(join(directory, name, '..'), { recursive: true }); writeFileSync(join(directory, name), bytes) }
}
const previous = artifact('previous'), candidate = artifact('candidate')
function deployment(id, url, environment, branch, commit, aliases = []) {
  return { id, url, environment, aliases, deployment_trigger: { metadata: { branch, commit_hash: commit } }, latest_stage: { status: 'success' } }
}
function fixture() {
  const root = mkdtempSync(join(temporary, 'fixture-'))
  const repository = join(root, 'repo'); mkdirSync(repository)
  const rollback = join(root, 'previous-app'); writeArtifact(rollback, previous)
  const activeAlias = 'https://existing-app-from-metadata.intap-web2.pages.dev'
  const appOld = deployment('app-old', 'https://cccc3333.intap-web2.pages.dev', 'preview', 'existing-preview-branch', BASE, [activeAlias])
  const appProd = deployment('app-prod', 'https://aaaa1111.intap-web2.pages.dev', 'production', 'main', BASE)
  const webProd = deployment('web-prod', 'https://bbbb2222.intap-link.pages.dev', 'production', 'main', BASE)
  const webPreview = deployment('web-preview', 'https://dddd4444.intap-link.pages.dev', 'preview', 'web-preview-existing', BASE)
  const deployments = [appOld, appProd, webProd, webPreview]
  const writes = [], requests = []
  let currentApp = appOld
  const workerState = {
    'intap-api': { version: 'current-production-version', percentage: 100, bindingsSha256: 'current-production-bindings' },
    'intap-api-preview': { version: 'current-preview-version', percentage: 100, bindingsSha256: 'current-preview-bindings', APP_PAGES_ORIGIN: activeAlias, WEB_PAGES_ORIGIN: webPreview.url },
  }
  const runner = new Runner({ root: repository, home: root, exec: (_binary, args) => {
    assert.deepEqual(args.slice(0, 2), ['pages', 'deploy'])
    assert.equal(args[args.indexOf('--project-name') + 1], PROJECT)
    assert.equal(args[args.indexOf('--commit-hash') + 1], CANDIDATE)
    const branch = args[args.indexOf('--branch') + 1]
    assert.notEqual(branch, 'main')
    writes.push({ branch, args })
    const stage = branch === STAGE_BRANCH
    const fresh = deployment(stage ? 'stage' : 'promoted', stage ? 'https://eeee5555.intap-web2.pages.dev' : 'https://ffff6666.intap-web2.pages.dev', 'preview', branch, CANDIDATE,
      [stage ? 'https://real-stage-alias.intap-web2.pages.dev' : activeAlias])
    deployments.push(fresh)
    if (!stage) { currentApp.aliases = []; currentApp = fresh }
    return fresh.url
  }, fetch: async (url, init) => {
    requests.push({ url, method: init.method })
    assert.equal(init.method, 'GET', 'Every HTTP request is read-only; uploads are limited to the explicit CLI boundary')
    const target = new URL(url)
    if (target.hostname === 'api.cloudflare.com') {
      if (target.searchParams.get('per_page') === '100') return { ok: false, status: 400, json: async () => ({ success: false, errors: [{ code: 8000024, message: 'Invalid query parameter per_page=100.' }] }) }
      const project = target.pathname.match(/\/pages\/projects\/([^/]+)/)?.[1]
      const id = target.pathname.match(/\/deployments\/([^/]+)$/)?.[1]
      let result
      if (id) result = deployments.find(item => item.id === id)
      else if (target.pathname.endsWith('/deployments')) result = deployments.filter(item => new URL(item.url).hostname.endsWith('.' + project + '.pages.dev'))
      else result = { name: project, production_branch: 'main', canonical_deployment: { id: project === PROJECT ? appProd.id : webProd.id } }
      return { ok: true, status: 200, json: async () => ({ success: true, result: structuredClone(result), result_info: { total_pages: 1 } }) }
    }
    let deployed
    if (target.origin === APP_PREVIEW || target.origin === activeAlias) deployed = currentApp
    else if (target.origin === 'https://app.intaprd.com') deployed = appProd
    else if (target.origin === 'https://intaprd.com') deployed = webProd
    else if (target.origin === 'https://preview.intaprd.com') deployed = webPreview
    else deployed = deployments.find(item => item.url === target.origin || item.aliases.includes(target.origin))
    assert.ok(deployed, 'No unknown hosts in fixture: ' + target.origin)
    const files = deployed.deployment_trigger.metadata.commit_hash === CANDIDATE ? candidate : previous
    const name = target.pathname.startsWith('/assets/') ? target.pathname.slice(1) : 'index.html'
    return { ok: name in files, status: name in files ? 200 : 404, arrayBuffer: async () => Buffer.from(files[name] || '') }
  } })
  runner.verifyRepo = () => {}
  runner.credentials = () => { runner.account = 'fixture-account'; runner.headers = {} }
  runner.workers = () => structuredClone(workerState)
  runner.build = directory => { writeArtifact(join(directory, 'candidate-app'), candidate); return manifest(join(directory, 'candidate-app')) }
  return { runner, root, rollback, writes, requests, workerState, activeAlias, deployments }
}
const action = (name, evidence) => options(['--action', name, '--evidence', evidence, name === 'stage' ? '--approve-stage' : '--approve-promote', CANDIDATE, ...(name === 'promote' ? ['--stage-reviewed', CANDIDATE] : [])])
try {
  await test('reported HTTP 400/8000024 is diagnosed; origin lookup uses server-default page size without uploads', async () => {
    const f = fixture()
    await assert.rejects(() => f.runner.api('/pages/projects/intap-web2/deployments?page=1&per_page=100'), error => {
      assert.match(error.message, /HTTP 400; códigos=8000024/)
      assert.match(error.message, /per_page=100/)
      assert.match(error.message, /Invalid query parameter/)
      return true
    })
    const deployment = await f.runner.resolveOrigin(f.activeAlias, PROJECT)
    assert.equal(deployment.id, 'app-old')
    const listing = f.requests.map(item => new URL(item.url)).filter(url => url.pathname.endsWith('/deployments'))
    assert.equal(listing.length, 2)
    assert.equal(listing[1].searchParams.get('page'), '1')
    assert.equal(listing[1].searchParams.has('per_page'), false)
    assert.equal(f.writes.length, 0)
  })
  await test('Preview pointer resolution stops at exact match, checks detail and handles real historical volume', async () => {
    for (const scenario of ['early', 'late', 'duplicate', 'stale', 'repeated', 'missing', 'bounded']) {
      const f = fixture(), pages = [], target = f.deployments[0], other = f.deployments[1]
      f.runner.fetch = async (url, init) => {
        assert.equal(init.method, 'GET')
        const request = new URL(url)
        if (request.pathname.endsWith('/app-old')) return { ok: true, json: async () => ({ success: true, result: scenario === 'stale' ? { ...target, aliases: [] } : target }) }
        assert.equal(request.searchParams.get('env'), 'preview')
        assert.equal(request.searchParams.has('per_page'), false)
        const page = Number(request.searchParams.get('page')); pages.push(page)
        const historical = { ...other, id: scenario === 'repeated' ? 'same' : 'history-' + page }
        const match = page === (scenario === 'late' ? 26 : 2)
        const result = scenario === 'duplicate' && match ? [target, { ...target, id: 'duplicate' }] : match && ['early', 'late', 'stale'].includes(scenario) ? [target] : [historical]
        return { ok: true, json: async () => ({ success: true, result, result_info: { page, total_pages: scenario === 'missing' ? 3 : scenario === 'bounded' ? 501 : 212 } }) }
      }
      if (scenario === 'duplicate' || scenario === 'missing') await assert.rejects(() => f.runner.resolveOrigin(f.activeAlias, PROJECT), /único deployment/)
      else if (scenario === 'stale') await assert.rejects(() => f.runner.resolveOrigin(f.activeAlias, PROJECT), /Origen cambió/)
      else if (scenario === 'repeated') await assert.rejects(() => f.runner.resolveOrigin(f.activeAlias, PROJECT), /Paginación Pages repetida/)
      else if (scenario === 'bounded') await assert.rejects(() => f.runner.resolveOrigin(f.activeAlias, PROJECT), /Paginación Pages incompleta/)
      else assert.equal((await f.runner.resolveOrigin(f.activeAlias, PROJECT)).id, target.id)
      const expected = { early: 2, late: 26, duplicate: 2, stale: 2, repeated: 2, missing: 3, bounded: 500 }[scenario]
      assert.deepEqual(pages, Array.from({ length: expected }, (_, index) => index + 1))
      assert.equal(f.writes.length, 0)
    }
  })
  await test('API diagnostics retain bounded code/message/context while redacting account, credentials and response payloads', async () => {
    const f = fixture(), account = 'abcdef1234567890abcdef1234567890', token = 'private-bearer-fixture-value', extraSecret = 'unknownPrivateToken12345678901234567890'
    f.runner.account = account; f.runner.headers = { Authorization: 'Bearer ' + token }
    f.runner.fetch = async () => ({ ok: false, status: 400, json: async () => ({
      success: false,
      errors: [{ code: 8000024, message: `Invalid per_page=100. account=${account}; Bearer ${token}; token=${extraSecret}; https://api.cloudflare.com/client/v4/accounts/${account}?token=${token}; owner@example.invalid\n\u001b[31m`, error_chain: [{ code: 1234, message: 'Use the default page size.' }] }],
      result: { env_vars: { DO_NOT_LOG: 'private-response-value' } },
    }) })
    await assert.rejects(() => f.runner.api('/pages/projects/intap-web2/deployments?page=2&per_page=100'), error => {
      const message = error.message
      assert.match(message, /GET \/pages\/projects\/intap-web2\/deployments; page=2; per_page=100; HTTP 400/)
      assert.match(message, /códigos=8000024,1234/)
      assert.match(message, /Invalid per_page=100/)
      assert.match(message, /Use the default page size/)
      for (const secret of [account, token, extraSecret, 'owner@example.invalid', 'private-response-value', 'env_vars', 'Authorization', 'https://api.cloudflare.com']) assert.ok(!message.includes(secret), 'Sensitive data leaked in diagnostic')
      assert.doesNotMatch(message, /[\n\u001b]/)
      assert.ok(message.length < 1200)
      return true
    })
    assert.equal(f.writes.length, 0)
  })
  await test('non-JSON, malformed API errors and network failures remain sanitized and actionable', async () => {
    const f = fixture(), account = 'abcdef1234567890abcdef1234567890', token = 'private-transport-token'
    f.runner.account = account; f.runner.headers = { Authorization: 'Bearer ' + token }
    for (const scenario of ['non-json', 'malformed', 'network', 'long-message']) {
      f.runner.fetch = async () => {
        if (scenario === 'network') throw Error(`Timeout https://api.cloudflare.com/accounts/${account}?token=${token} Bearer ${token}`)
        return { ok: false, status: 503, json: async () => {
          if (scenario === 'non-json') throw Error('raw HTML should never be logged')
          return { success: false, errors: scenario === 'malformed' ? { message: 'do not dump malformed payload' } : [{ code: 8000024, message: 'invalid parameter '.repeat(200) }] }
        } }
      }
      await assert.rejects(() => f.runner.api('/pages/projects/intap-web2/deployments?page=3'), error => {
        assert.match(error.message, /GET \/pages\/projects\/intap-web2\/deployments; page=3; per_page=predeterminado/)
        assert.match(error.message, scenario === 'network' ? /fallo de red\/timeout/ : /HTTP 503/)
        if (scenario === 'non-json') assert.match(error.message, /JSON no válida/)
        if (scenario === 'malformed') assert.match(error.message, /sin código/)
        for (const secret of [account, token, 'raw HTML', 'malformed payload', 'https://api.cloudflare.com']) assert.ok(!error.message.includes(secret))
        assert.ok(error.message.length < 1200)
        return true
      })
    }
    assert.equal(f.writes.length, 0)
  })
  await test('Web SEO comparison normalizes only observed host-specific tags, not page content or assets', () => {
    const a = 'https://intaprd.com', b = 'https://1672b41a.intap-link.pages.dev'
    const html = host => `<link rel="canonical" href="${host}/" />
<meta property="og:url" content="${host}/" />
<meta property="og:image" content="${host}/assets/og/kawvo-link-og.png" />
<meta property="og:image:secure_url" content="${host}/assets/og/kawvo-link-og.png" />
<meta name="twitter:image" content="${host}/assets/og/kawvo-link-og.png" />
<script type="module" src="/assets/main.js"></script><main>Original</main>`
    const expected = normalizeWebSeo(html(a), a)
    assert.equal(expected, normalizeWebSeo(html(b), b))
    for (const changed of [html(b).replace('Original', 'Modified'), html(b).replace('main.js', 'other.js'), html(b).replace('kawvo-link-og.png', 'other.png'), html(b).replace(b + '/', 'https://other.invalid/'), html(b) + '<script>changed()</script>', html(b) + '<a href="' + b + '/">link</a>']) {
      assert.notEqual(expected, normalizeWebSeo(changed, b))
    }
    assert.notEqual(normalizeWebSeo(html(a), b), expected)
  })
  await test('default is read-only; invalid or combined approvals rejected before execution', () => {
    assert.equal(options([]).action, 'preflight')
    for (const args of [ ['--action', 'production'], ['--action', 'stage'], ['--action', 'stage', '--evidence', '/tmp/x', '--approve-stage', BASE],
      ['--action', 'preflight', '--approve-stage', CANDIDATE], ['--action', 'stage', '--action', 'promote'],
      ['--action', 'promote', '--evidence', '/tmp/x', '--approve-promote', CANDIDATE], ['--project', 'intap-link'] ]) assert.throws(() => options(args))
  })
  await test('metadata requires exact project, immutable URL, branch, SHA, success and Preview environment', () => {
    const good = deployment('stage', 'https://eeee5555.intap-web2.pages.dev', 'preview', STAGE_BRANCH, CANDIDATE)
    const expected = { environment: 'preview', branch: STAGE_BRANCH, commit: CANDIDATE }
    assert.equal(owner(good, PROJECT, expected).commit, CANDIDATE)
    for (const changed of [ { ...good, environment: 'production' }, { ...good, url: 'https://eeee5555.intap-link.pages.dev' }, { ...good, latest_stage: { status: 'failed' } },
      { ...good, deployment_trigger: { metadata: { branch: 'main', commit_hash: CANDIDATE } } }, { ...good, deployment_trigger: { metadata: { branch: STAGE_BRANCH, commit_hash: BASE } } } ]) assert.throws(() => owner(changed, PROJECT, expected))
  })
  await test('real Git guards reject dirty tree, moved main/candidate and extra candidate files', () => {
    const f = fixture(), runner = f.runner
    const verify = Runner.prototype.verifyRepo.bind(runner)
    for (const issue of ['', 'dirty', 'main', 'candidate', 'extra']) {
      runner.command = (_binary, args) => {
        if (args[0] === 'status') return issue === 'dirty' ? 'M app/file' : ''
        if (args[0] === 'remote') return args[1] ? 'https://github.com/pgcsoluciones/intap-link.git' : 'origin'
        if (args[0] === 'ls-remote') return `${issue === 'main' ? CANDIDATE : BASE}\trefs/heads/main\n${issue === 'candidate' ? BASE : CANDIDATE}\trefs/heads/${CANDIDATE_BRANCH}`
        if (args[0] === 'rev-parse') return CANDIDATE
        if (args.includes('--name-only')) return [...ALLOWLIST, ...(issue === 'extra' ? ['api/changed.ts'] : [])].join('\n')
        return ''
      }
      if (issue) assert.throws(verify)
      else verify()
    }
  })
  await test('artifact rejects symlinks, missing lazy chunks and Worker/Functions payloads', () => {
    const f = fixture()
    assert.equal(Object.keys(manifest(f.rollback)).length, 5)
    rmSync(join(f.rollback, 'assets/lazy.js'))
    assert.throws(() => manifest(f.rollback), /Chunk referenciado ausente/)
    writeArtifact(f.rollback, previous)
    writeFileSync(join(f.rollback, '_worker.js'), 'forbidden')
    assert.throws(() => manifest(f.rollback), /no Functions\/Worker/)
    rmSync(join(f.rollback, '_worker.js'))
    symlinkSync(join(f.rollback, 'index.html'), join(f.rollback, 'linked.html'))
    assert.throws(() => manifest(f.rollback), /Symlink/)
  })
  await test('Worker inspection uses current version IDs and fingerprints bindings without recording secrets', () => {
    const f = fixture()
    delete f.runner.workers
    const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']
    f.runner.command = (_binary, args) => {
      const name = args[args.indexOf('--name') + 1], id = ids[name === 'intap-api' ? 0 : 1]
      if (args[0] === 'deployments') return JSON.stringify({ versions: [{ version_id: id, percentage: 100 }] })
      assert.equal(args[2], id)
      return JSON.stringify({ resources: { bindings: [
        { name: 'SECRET_FIXTURE', type: 'secret_text', text: 'never-log-this-value' },
        ...(name === 'intap-api-preview' ? [{ name: 'APP_PAGES_ORIGIN', type: 'plain_text', text: f.activeAlias }, { name: 'WEB_PAGES_ORIGIN', type: 'plain_text', text: 'https://dddd4444.intap-link.pages.dev' }] : []),
      ] } })
    }
    const result = f.runner.workers()
    assert.equal(result['intap-api'].version, ids[0])
    assert.equal(result['intap-api-preview'].APP_PAGES_ORIGIN, f.activeAlias)
    assert.doesNotMatch(JSON.stringify(result), /never-log-this-value|SECRET_FIXTURE/)
    assert.match(result['intap-api-preview'].bindingsSha256, /^[a-f0-9]{64}$/)
  })
  await test('default preflight resolves current origin, records rollback evidence and never uploads', async () => {
    const f = fixture(), evidence = await f.runner.run(options([]))
    const report = JSON.parse(readFileSync(join(evidence, 'receipt.json')))
    assert.equal(report.baseline.appPreview.alias, f.activeAlias)
    assert.equal(report.baseline.appPreview.deployment.commit, BASE)
    assert.equal(report.rollback, false)
    assert.equal(f.writes.length, 0)
    assert.ok(f.requests.length > 0 && f.requests.every(item => item.method === 'GET'))
    await assert.rejects(() => f.runner.run(action('promote', evidence)))
    assert.equal(f.writes.length, 0)
  })
  await test('Stage is exactly one isolated App upload; no automatic promotion or repeated upload', async () => {
    const f = fixture(), evidence = await f.runner.run(options([]))
    await f.runner.run(action('stage', evidence))
    assert.deepEqual(f.writes.map(item => item.branch), [STAGE_BRANCH])
    const stage = JSON.parse(readFileSync(join(evidence, 'stage/receipt.json')))
    assert.equal(stage.deployment.alias, 'https://real-stage-alias.intap-web2.pages.dev', 'Use metadata, not branch truncation')
    await assert.rejects(() => f.runner.run(action('stage', evidence)))
    await assert.rejects(() => f.runner.run(action('promote', evidence)), /rollback/)
    assert.equal(f.writes.length, 1)
  })
  await test('promotion reuses exact artifact and existing alias branch; Workers/Web/Production stay unchanged', async () => {
    const f = fixture(), evidence = await f.runner.run(options(['--rollback-artifact', f.rollback]))
    await f.runner.run(action('stage', evidence))
    await f.runner.run(action('promote', evidence))
    assert.deepEqual(f.writes.map(item => item.branch), [STAGE_BRANCH, 'existing-preview-branch'])
    const receipt = JSON.parse(readFileSync(join(evidence, 'promote/receipt.json')))
    assert.equal(receipt.result, 'PASS'); assert.equal(receipt.deployment.alias, f.activeAlias)
    await assert.rejects(() => f.runner.run(action('promote', evidence)))
    assert.equal(f.writes.length, 2)
  })
  await test('changed artifact, Worker, App/Web Production or Web Preview blocks before an upload', async () => {
    for (const change of ['artifact', 'worker', 'app-prod', 'web-prod', 'web-preview']) {
      const f = fixture(), evidence = await f.runner.run(options([]))
      if (change === 'artifact') writeFileSync(join(evidence, 'candidate-app/assets/main.js'), 'altered')
      else if (change === 'worker') f.workerState['intap-api'].version = 'unexpected-version'
      else f.deployments.find(item => item.id === change).deployment_trigger.metadata.commit_hash = CANDIDATE
      await assert.rejects(() => f.runner.run(action('stage', evidence)))
      assert.equal(f.writes.length, 0)
    }
  })
  await test('publication boundary rejects production branches without invoking Wrangler', async () => {
    const f = fixture()
    for (const branch of ['main', 'production', 'master', 'another-production-branch', '--project-name', 'bad\nbranch']) await assert.rejects(() => f.runner.publish(f.root, branch, null, 'another-production-branch', join(f.root, 'log')))
    assert.equal(f.writes.length, 0)
  })
  await test('receipt from another SHA or runner cannot authorize an upload', async () => {
    for (const field of ['candidate', 'runnerDigest']) {
      const f = fixture(), evidence = await f.runner.run(options([]))
      const file = join(evidence, 'receipt.json'), report = JSON.parse(readFileSync(file))
      report[field] = 'different'; writeFileSync(file, JSON.stringify(report))
      await assert.rejects(() => f.runner.run(action('stage', evidence)), /Evidencia no válida/)
      assert.equal(f.writes.length, 0)
    }
  })
  await test('byte verification checks lazy chunks as well as entry JS/CSS', async () => {
    const f = fixture()
    await f.runner.compareArtifact(f.rollback, 'https://cccc3333.intap-web2.pages.dev')
    writeFileSync(join(f.rollback, 'assets/lazy.js'), 'altered-lazy-chunk')
    await assert.rejects(() => f.runner.compareArtifact(f.rollback, 'https://cccc3333.intap-web2.pages.dev'), /byte a byte/)
    assert.equal(f.writes.length, 0)
  })
  await test('ambiguous upload failure retains attempt, checks protected surfaces and blocks blind retry/promotion', async () => {
    const f = fixture(), evidence = await f.runner.run(options([]))
    let attempts = 0
    f.runner.exec = () => { attempts++; throw Object.assign(Error('upload failed'), { status: 1, stderr: 'simulated upload error' }) }
    await assert.rejects(() => f.runner.run(action('stage', evidence)), /Falló/)
    assert.equal(JSON.parse(readFileSync(join(evidence, 'stage/receipt.json'))).result, 'BLOCKED')
    assert.ok(JSON.parse(readFileSync(join(evidence, 'stage/after/snapshot.json'))).protectedSurfaces)
    await assert.rejects(() => f.runner.run(action('stage', evidence)))
    await assert.rejects(() => f.runner.run(action('promote', evidence)))
    assert.equal(attempts, 1)
  })
  console.log(`PASS KAW-G3-003: ${checks} safety/flow contracts; all remote services and uploads simulated`)
} finally { rmSync(temporary, { recursive: true, force: true }) }
