import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, lstatSync, writeFileSync, cpSync, symlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const BASE = '6e6bfbb1bd60c91a94e92d36f6cfdd9f91e3d9e2'
export const CANDIDATE = '34d57a4bfebc9e59b0347d0497a159ca3f46ce7e'
export const CANDIDATE_BRANCH = 'feat/kawmed-g3-1-unified-doctor-shell'
export const PROJECT = 'intap-web2'
export const STAGE_BRANCH = 'qa-kawmed-g3-1-1116'
export const APP_PREVIEW = 'https://app.preview.intaprd.com'
export const ALLOWLIST = [
  'app/src/components/admin/medical/MedicalDashboard.tsx',
  'app/src/components/admin/medical/KawMedUnifiedShellFrame.tsx',
  'app/src/components/admin/medical/kawmed-shell-navigation.ts',
  'scripts/test-kawmed-shell-navigation-contract.mjs',
  'docs/architecture/KAWVO_KAWMED_G3_LOT_1.md',
].sort()
const here = dirname(fileURLToPath(import.meta.url))
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item)
const check = (condition, reason) => { if (!condition) throw Error(reason) }
const json = path => JSON.parse(readFileSync(path, 'utf8'))
const save = (path, data) => writeFileSync(path, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 })
const normal = url => new URL(url).origin
const immutable = (url, project) => new RegExp('^https://[a-f0-9]{8,}\\.' + project + '\\.pages\\.dev$').test(url)
const pagesOrigin = (url, project) => new RegExp('^https://[a-z0-9-]+\\.' + project + '\\.pages\\.dev$').test(url)

// Only API messages are inspected; never stringify the response, headers or env_vars.
function apiDiagnostic(path, status, body, secrets, networkError) {
  const clean = value => {
    let text = typeof value === 'string' ? value : ''
    for (const secret of secrets.filter(value => typeof value === 'string' && value.length).sort((a, b) => b.length - a.length)) text = text.split(secret).join('[oculto]')
    return text.replace(/https?:\/\/[^\s"'<>]+/gi, '[URL omitida]')
      .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [oculto]')
      .replace(/\b(authorization|x-auth-key|x-auth-email|oauth_token|refresh_token|access_token|api[_-]?(?:key|token)|token|secret)\b\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, '$1=[oculto]')
      .replace(/\b[a-f0-9]{32}\b/gi, '[identificador oculto]')
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[correo oculto]')
      .replace(/\b[A-Za-z0-9_-]{20,}(?:\.[A-Za-z0-9_-]+)*\b/g, '[valor oculto]')
      .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200)
  }
  const request = new URL(path, 'https://diagnostic.invalid')
  const route = request.pathname.match(/^\/pages\/projects\/(intap-web2|intap-link)(\/deployments)?(\/[^/]+)?$/)
  const endpoint = route ? '/pages/projects/' + route[1] + (route[2] || '') + (route[3] ? '/:deployment_id' : '') : '[endpoint omitido]'
  const pagination = ['page', 'per_page'].map(key => {
    const value = request.searchParams.get(key)
    return key + '=' + (value === null ? 'predeterminado' : /^\d{1,6}$/.test(value) ? value : '[omitido]')
  }).join('; ')
  const errors = Array.isArray(body?.errors) ? body.errors.slice(0, 3) : []
  const details = errors.flatMap(error => [error, ...(Array.isArray(error?.error_chain) ? error.error_chain.slice(0, 2) : [])]).slice(0, 4)
  const codes = details.map(error => /^\d{1,12}$/.test(String(error?.code ?? '')) ? String(error.code) : 'sin código').join(',') || 'sin código'
  const messages = details.map(error => clean(error?.message)).filter(Boolean).join(' | ')
  return 'Cloudflare GET ' + endpoint + '; ' + pagination + '; ' + (networkError ? 'fallo de red/timeout; detalle=' + clean(networkError.message) : 'HTTP ' + status + '; códigos=' + codes + '; detalle=' + (messages || (body === null ? 'respuesta JSON no válida' : 'sin mensaje de error API'))) + '; petición de solo lectura'
}

export function options(args) {
  const result = { action: 'preflight' }
  const names = new Set(['action', 'evidence', 'rollback-artifact', 'approve-stage', 'approve-promote', 'stage-reviewed'])
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--help') return { help: true }
    const key = args[i].replace(/^--/, '')
    check(args[i].startsWith('--') && names.has(key) && args[i + 1] && !args[i + 1].startsWith('--'), 'Argumento inválido: ' + args[i])
    check(!(key in result) || key === 'action' && !result.explicitAction, 'Argumento repetido: ' + key)
    result[key] = args[++i]
    if (key === 'action') result.explicitAction = true
  }
  check(['preflight', 'stage', 'promote'].includes(result.action), 'Acción no permitida')
  if (result.action === 'preflight') check(!result.evidence && !result['approve-stage'] && !result['approve-promote'] && !result['stage-reviewed'], 'Preflight no admite autorizaciones ni evidencia previa')
  else {
    check(result.evidence && !result['rollback-artifact'], 'Stage/promote requieren --evidence; rollback se prepara en preflight')
    const approval = result.action === 'stage' ? 'approve-stage' : 'approve-promote'
    check(result[approval] === CANDIDATE, 'Falta autorización explícita del SHA para ' + result.action)
    check(!result[result.action === 'stage' ? 'approve-promote' : 'approve-stage'], 'No combinar acciones/autorizaciones')
    if (result.action === 'promote') check(result['stage-reviewed'] === CANDIDATE, 'Falta revisión explícita del artefacto Stage')
    else check(!result['stage-reviewed'], 'No anticipar revisión de Stage')
  }
  return result
}

export function manifest(directory) {
  check(lstatSync(directory).isDirectory() && !lstatSync(directory).isSymbolicLink(), 'Artefacto debe ser un directorio real')
  const files = {}
  function walk(relative = '') {
    for (const item of readdirSync(join(directory, relative)).sort()) {
      check(/^[a-zA-Z0-9_.@+-]+$/.test(item), 'Ruta no admitida en artefacto')
      const name = relative ? relative + '/' + item : item
      const stat = lstatSync(join(directory, name))
      check(!stat.isSymbolicLink(), 'Symlink no permitido en artefacto')
      if (stat.isDirectory()) walk(name)
      else { check(stat.isFile(), 'Archivo especial no permitido'); files[name] = sha(readFileSync(join(directory, name))) }
    }
  }
  walk()
  check(files['index.html'] && Object.keys(files).some(name => /^assets\/.*\.js$/.test(name)), 'Falta index.html o bundle JS')
  check(!Object.keys(files).some(name => name === '_worker.js' || name.startsWith('_worker.js/') || name === '_routes.json' || name.startsWith('functions/')), 'App Pages estático únicamente; no Functions/Worker')
  check(!Object.keys(files).some(name => /(^|\/)(?:\.env(?:\.|$)|\.git(?:\/|$)|node_modules\/|wrangler\.|package(?:-lock)?\.json$)/.test(name)), 'Configuración, dependencias o credenciales fuera del artefacto App')
  // Do not accept an incomplete rollback copy that omits referenced lazy chunks/CSS.
  for (const name of Object.keys(files).filter(name => /\.(?:html|js|css)$/.test(name))) {
    const content = readFileSync(join(directory, name), 'utf8')
    for (const match of content.matchAll(/["'(](\/?assets\/[a-zA-Z0-9_.\/-]+\.(?:js|css))["')?]/g)) check(files[match[1].replace(/^\//, '')], 'Asset referenciado ausente: ' + match[1])
    for (const match of content.matchAll(/(?:from\s*|import\s*\()\s*["'](\.\/[^"']+\.(?:js|css))["']/g)) {
      const target = join(dirname(name), match[1]).split(sep).join('/')
      check(files[target], 'Chunk referenciado ausente: ' + target)
    }
  }
  return files
}

export function owner(deployment, project, expected = {}) {
  const meta = deployment?.deployment_trigger?.metadata || {}
  check(immutable(deployment?.url, project) && deployment?.id && deployment.latest_stage?.status === 'success', 'Deployment inmutable/success no verificable')
  check(['preview', 'production'].includes(deployment.environment) && /^[0-9a-f]{40}$/.test(meta.commit_hash || '') && typeof meta.branch === 'string' && meta.branch, 'Metadata incompleta de deployment')
  for (const [key, value] of Object.entries(expected)) {
    const actual = key === 'branch' ? meta.branch : key === 'commit' ? meta.commit_hash : deployment[key]
    check(actual === value, 'Metadata no coincide: ' + key)
  }
  return { id: deployment.id, url: deployment.url, environment: deployment.environment, branch: meta.branch, commit: meta.commit_hash,
    aliases: [...new Set((deployment.aliases || []).map(normal))].sort() }
}

export class Runner {
  constructor({ root = join(homedir(), 'Desktop/intap-link-universal-bilingual-audit'), home = homedir(), exec = execFileSync, fetch = globalThis.fetch } = {}) {
    this.root = realpathSync(root); this.home = home; this.exec = exec; this.fetch = fetch
    this.wrangler = join(this.root, 'node_modules/.bin/wrangler')
    this.runnerDigest = sha(readFileSync(join(here, 'kawmed-g3-1-pages.mjs')) + readFileSync(join(here, 'run-kawmed-g3-1-stage-preview-2026-11-16.sh')))
  }
  command(binary, args, cwd = this.root, log) {
    try {
      const output = this.exec(binary, args, { cwd, encoding: 'utf8', timeout: 240000, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: this.account || process.env.CLOUDFLARE_ACCOUNT_ID, WRANGLER_SEND_METRICS: 'false' } })
      if (log) writeFileSync(log, output, { mode: 0o600 })
      return output.trim()
    } catch (error) {
      // No raw bindings, credentials, account IDs or command output in exceptions.
      if (log) writeFileSync(log, String(error.stdout || '') + String(error.stderr || ''), { mode: 0o600 })
      throw Error('Falló ' + basename(binary) + ' ' + args.slice(0, 2).join(' ') + '; exit=' + (error.status ?? 'timeout') + (log ? '; consultar log privado' : ''))
    }
  }
  verifyRepo() {
    const git = (...args) => this.command('git', args)
    check(git('status', '--porcelain=v1', '--untracked-files=all') === '', 'Checkout debe estar limpio')
    const remotes = git('remote').split('\n').filter(name => /^(origin|github)$/.test(name))
    this.remote = remotes.find(name => /^(https:\/\/github\.com\/|git@github\.com:)pgcsoluciones\/intap-link(?:\.git)?$/.test(git('remote', 'get-url', name)))
    check(this.remote, 'No existe remoto origin/github del repositorio autorizado')
    const refs = Object.fromEntries(git('ls-remote', this.remote, 'refs/heads/main', 'refs/heads/' + CANDIDATE_BRANCH).split('\n').map(line => { const [id, ref] = line.split(/\s+/); return [ref, id] }))
    check(refs['refs/heads/main'] === BASE && refs['refs/heads/' + CANDIDATE_BRANCH] === CANDIDATE, 'main o candidato remoto cambió; revalidar alcance')
    check(git('rev-parse', CANDIDATE + '^{commit}') === CANDIDATE, 'Falta objeto candidato; sincronizar sin cambiar su SHA')
    check(canonical(git('diff', '--name-only', BASE, CANDIDATE).split('\n').sort()) === canonical(ALLOWLIST), 'Allowlist del candidato distinta de cinco archivos')
    git('diff', '--check', BASE, CANDIDATE)
  }
  credentials() {
    if (process.env.CLOUDFLARE_API_TOKEN) this.headers = { Authorization: 'Bearer ' + process.env.CLOUDFLARE_API_TOKEN }
    else {
      const paths = ['Library/Preferences/.wrangler/config/default.toml', '.wrangler/config/default.toml', '.config/.wrangler/config/default.toml'].map(name => join(this.home, name)).filter(existsSync)
      check(paths.length === 1, 'Se requiere una única sesión Wrangler existente o CLOUDFLARE_API_TOKEN; no se cambia autenticación')
      const token = readFileSync(paths[0], 'utf8').match(/^oauth_token\s*=\s*"([^"\r\n]+)"/m)?.[1]
      check(token, 'Sesión existente sin token legible; no se inicia login ni se solicitan permisos nuevos')
      this.headers = { Authorization: 'Bearer ' + token }
    }
    check(existsSync(this.wrangler), 'Falta Wrangler local; no se instalan dependencias')
    const output = this.command(this.wrangler, ['whoami'])
    const ids = [...new Set(output.match(/\b[a-f0-9]{32}\b/gi) || [])]
    this.account = process.env.CLOUDFLARE_ACCOUNT_ID || (ids.length === 1 ? ids[0] : '')
    check(/^[a-f0-9]{32}$/i.test(this.account) && ids.includes(this.account), 'No se pudo determinar una cuenta autorizada única')
  }
  async api(path) {
    const secrets = [this.account, ...Object.values(this.headers || {}), String(this.headers?.Authorization || '').replace(/^Bearer\s+/i, '')]
    let response
    try {
      response = await this.fetch('https://api.cloudflare.com/client/v4/accounts/' + this.account + path, { method: 'GET', headers: this.headers, signal: AbortSignal.timeout(30000) })
    } catch (error) { throw Error(apiDiagnostic(path, null, null, secrets, error)) }
    const body = await response.json().catch(() => null)
    check(response.ok && body?.success === true, apiDiagnostic(path, response.status, body, secrets))
    return body
  }
  async project(name) {
    const project = (await this.api('/pages/projects/' + name)).result
    check(project?.name === name && project.production_branch, 'Proyecto Pages no identificado')
    return project
  }
  async deployment(project, id) { return (await this.api('/pages/projects/' + project + '/deployments/' + encodeURIComponent(id))).result }
  async resolveOrigin(origin, project) {
    check(pagesOrigin(origin, project), 'Origen fuera del proyecto propietario')
    const found = []
    let exhausted = false
    for (let page = 1; page <= 25; page++) {
      // per_page is optional. Use the endpoint default, as Wrangler does, rather
      // than assuming that the generic Cloudflare page size is accepted by Pages.
      const body = await this.api('/pages/projects/' + project + '/deployments?page=' + page)
      check(Array.isArray(body.result), 'Lista Pages inválida')
      found.push(...body.result.filter(item => item.url === origin || (item.aliases || []).map(normal).includes(origin)))
      if (!body.result.length || body.result_info?.total_pages && page >= body.result_info.total_pages) { exhausted = true; break }
    }
    check(exhausted, 'Paginación Pages incompleta; no inferir ownership')
    check(found.length === 1, 'Origen no resuelto a un único deployment actual')
    return this.deployment(project, found[0].id)
  }
  workers() {
    const result = {}
    for (const name of ['intap-api', 'intap-api-preview']) {
      const status = JSON.parse(this.command(this.wrangler, ['deployments', 'status', '--name', name, '--json']))
      check(status.versions?.length === 1 && Number(status.versions[0].percentage) === 100, 'Worker no está en una versión única al 100%: ' + name)
      const version = status.versions[0].version_id
      check(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(version || ''), 'ID de versión Worker no válido')
      const detail = JSON.parse(this.command(this.wrangler, ['versions', 'view', version, '--name', name, '--json']))
      const groups = []
      function walk(value) { if (!value || typeof value !== 'object') return; if (Array.isArray(value.bindings)) groups.push(value.bindings); Object.values(value).forEach(walk) }
      walk(detail)
      check(groups.length === 1, 'No se pudo identificar bindings efectivos del Worker: ' + name)
      const bindings = groups[0]
      result[name] = { version, percentage: 100, bindingsSha256: sha(canonical([...bindings].sort((a, b) => a.name.localeCompare(b.name)))) }
      if (name === 'intap-api-preview') for (const key of ['APP_PAGES_ORIGIN', 'WEB_PAGES_ORIGIN']) {
        const entries = bindings.filter(item => item.name === key && item.type === 'plain_text')
        check(entries.length === 1 && entries[0].text === normal(entries[0].text), 'Origen efectivo no es HTTPS raíz inequívoco: ' + key)
        result[name][key] = entries[0].text
      }
    }
    return result
  }
  async bytes(url) {
    const response = await this.fetch(url, { method: 'GET', redirect: 'error', headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(45000) })
    check(response.ok, 'HTTP ' + response.status + ' al verificar bytes de ' + new URL(url).hostname)
    return Buffer.from(await response.arrayBuffer())
  }
  async surface(origin, route, directory) {
    mkdirSync(directory, { recursive: true, mode: 0o700 })
    const html = await this.bytes(origin + route)
    writeFileSync(join(directory, 'index.html'), html, { mode: 0o600 })
    const assets = [...new Set(html.toString('utf8').match(/\/assets\/[a-zA-Z0-9_.\/-]+\.(?:js|css)/g) || [])].sort()
    check(assets.some(name => name.endsWith('.js')), 'HTML sin bundle JS verificable')
    const result = { html: sha(html), assets: {} }
    for (const asset of assets) {
      check(!asset.includes('..'), 'Asset inválido')
      const bytes = await this.bytes(origin + asset)
      result.assets[asset] = sha(bytes)
      const target = join(directory, asset.slice(1))
      mkdirSync(dirname(target), { recursive: true, mode: 0o700 })
      writeFileSync(target, bytes, { mode: 0o600 })
    }
    return result
  }
  async compareArtifact(directory, origin, route = '/admin/login') {
    const files = manifest(directory)
    check((await this.bytes(origin + route)).equals(readFileSync(join(directory, 'index.html'))), 'HTML remoto difiere byte a byte')
    for (const name of Object.keys(files).filter(name => !['index.html', '_headers', '_redirects'].includes(name))) {
      check((await this.bytes(origin + '/' + name)).equals(readFileSync(join(directory, name))), 'Bundle remoto difiere byte a byte: ' + name)
    }
    return files
  }
  async snapshot(directory) {
    mkdirSync(directory, { recursive: true, mode: 0o700 })
    const workers = this.workers()
    const preview = workers['intap-api-preview']
    const projects = { app: await this.project(PROJECT), web: await this.project('intap-link') }
    const app = owner(await this.resolveOrigin(preview.APP_PAGES_ORIGIN, PROJECT), PROJECT, { environment: 'preview' })
    const web = owner(await this.resolveOrigin(preview.WEB_PAGES_ORIGIN, 'intap-link'), 'intap-link', { environment: 'preview' })
    check(app.aliases.includes(preview.APP_PAGES_ORIGIN) && app.url !== preview.APP_PAGES_ORIGIN, 'APP_PAGES_ORIGIN debe ser el alias mutable existente; no cambiar Worker')
    check(app.branch !== projects.app.production_branch && STAGE_BRANCH !== projects.app.production_branch && app.branch !== STAGE_BRANCH, 'Rama activa/Stage productiva o colisión de ramas')
    const protectedSurfaces = {}
    for (const [key, project, host, route] of [['appProduction', projects.app, 'https://app.intaprd.com', '/admin/login'], ['webProduction', projects.web, 'https://intaprd.com', '/']]) {
      const deployment = owner(await this.deployment(project.name, project.canonical_deployment?.id), project.name, { environment: 'production', branch: project.production_branch })
      const live = await this.surface(host, route, join(directory, key + '-live'))
      const fixed = await this.surface(deployment.url, route, join(directory, key + '-immutable'))
      check(canonical(live) === canonical(fixed), 'Dominio productivo no coincide con metadata canónica actual: ' + key)
      protectedSurfaces[key] = { deployment, fingerprints: live }
    }
    const webLive = await this.surface('https://preview.intaprd.com', '/', join(directory, 'web-preview-live'))
    const webFixed = await this.surface(web.url, '/', join(directory, 'web-preview-immutable'))
    check(canonical(webLive) === canonical(webFixed), 'Web Preview no coincide con origen efectivo')
    protectedSurfaces.webPreview = { deployment: web, fingerprints: webLive }
    const appLive = await this.surface(APP_PREVIEW, '/admin/login', join(directory, 'app-preview-live'))
    const appAlias = await this.surface(preview.APP_PAGES_ORIGIN, '/admin/login', join(directory, 'app-preview-alias'))
    const appFixed = await this.surface(app.url, '/admin/login', join(directory, 'app-preview-immutable'))
    check(canonical(appLive) === canonical(appAlias) && canonical(appLive) === canonical(appFixed), 'App Preview, alias y origen inmutable no coinciden')
    const result = { workers, protectedSurfaces, appPreview: { alias: preview.APP_PAGES_ORIGIN, deployment: app, fingerprints: appLive }, productionBranches: { app: projects.app.production_branch, web: projects.web.production_branch } }
    save(join(directory, 'snapshot.json'), result)
    return result
  }
  build(directory) {
    const source = join(directory, 'candidate-source')
    mkdirSync(source, { mode: 0o700 })
    this.command('git', ['archive', '--format=tar', '--output=' + join(directory, 'candidate.tar'), CANDIDATE])
    this.command('tar', ['-xf', join(directory, 'candidate.tar'), '-C', source])
    check(existsSync(join(this.root, 'node_modules')), 'Faltan dependencias existentes; no se instala nada')
    symlinkSync(join(this.root, 'node_modules'), join(source, 'node_modules'), 'dir')
    this.command('npm', ['run', 'build:preview', '-w', 'app'], source, join(directory, 'build-preview.log'))
    const target = join(directory, 'candidate-app')
    cpSync(join(source, 'app/dist'), target, { recursive: true })
    return manifest(target)
  }
  receipt(directory, data) { save(join(directory, 'receipt.json'), { schema: 1, candidate: CANDIDATE, base: BASE, runnerDigest: this.runnerDigest, ...data }) }
  readReceipt(directory, action) {
    const receipt = json(join(directory, 'receipt.json'))
    check(receipt.schema === 1 && receipt.candidate === CANDIDATE && receipt.base === BASE && receipt.runnerDigest === this.runnerDigest && receipt.action === action && receipt.result === 'PASS', 'Evidencia no válida para este runner/SHA/acción')
    return receipt
  }
  assertSame(a, b, protectedOnly = false) {
    const select = value => protectedOnly ? { workers: value.workers, protectedSurfaces: value.protectedSurfaces, productionBranches: value.productionBranches } : value
    check(canonical(select(a)) === canonical(select(b)), 'Deriva en baseline protegido; detener, no publicar/reintentar')
  }
  async preflight(args) {
    const parent = join(this.home, 'intap-release-logs')
    mkdirSync(parent, { recursive: true, mode: 0o700 })
    const directory = mkdtempSync(join(parent, 'kawmed-g3-1-'))
    console.log('EVIDENCE=' + directory)
    const baseline = await this.snapshot(join(directory, 'before'))
    const files = this.build(directory)
    let rollback = false
    if (args['rollback-artifact']) {
      const path = realpathSync(args['rollback-artifact'])
      manifest(path)
      await this.compareArtifact(path, baseline.appPreview.deployment.url)
      cpSync(path, join(directory, 'rollback-app'), { recursive: true })
      rollback = manifest(join(directory, 'rollback-app'))
    }
    this.assertSame(baseline, await this.snapshot(join(directory, 'after')))
    this.verifyRepo()
    this.receipt(directory, { action: 'preflight', result: 'PASS', capturedAt: new Date().toISOString(), baseline, files, rollback })
    console.log('PASS preflight: solo lecturas Cloudflare y build/evidencia local. Rollback: ' + (rollback ? 'copia del artefacto aportado y bytes públicos verificados; controles locales en manifiesto' : 'PENDIENTE; promoción bloqueada'))
    return directory
  }
  async retry(read) {
    let failure
    for (let attempt = 0; attempt < 8; attempt++) {
      try { return await read() } catch (error) { failure = error; if (attempt < 7) await new Promise(resolve => setTimeout(resolve, 3000)) }
    }
    throw failure
  }
  async publish(directory, branch, alias, productionBranch, log) {
    check(/^[a-zA-Z0-9][a-zA-Z0-9_./-]{0,150}$/.test(branch || '') && branch !== productionBranch && branch !== 'main' && !/^(production|master)$/.test(branch), 'Rama de publicación productiva/inválida prohibida')
    const output = this.command(this.wrangler, ['pages', 'deploy', join(directory, 'candidate-app'), '--project-name', PROJECT, '--branch', branch, '--commit-hash', CANDIDATE, '--commit-dirty=false'], dirname(log), log)
    const origins = [...new Set(output.match(/https:\/\/[a-f0-9]{8,}\.intap-web2\.pages\.dev/g) || [])]
    check(origins.length === 1, 'Upload sin origen inmutable único; NO repetir; revisar log')
    const deployment = await this.retry(async () => {
      const result = owner(await this.resolveOrigin(origins[0], PROJECT), PROJECT, { environment: 'preview', branch, commit: CANDIDATE })
      const aliases = result.aliases.filter(url => pagesOrigin(url, PROJECT) && url !== result.url)
      check(alias ? aliases.includes(alias) : aliases.length === 1, 'Alias real no coincide o es ambiguo')
      result.alias = alias || aliases[0]
      check(result.alias !== result.url, 'Alias no mutable')
      await this.compareArtifact(join(directory, 'candidate-app'), result.url)
      await this.compareArtifact(join(directory, 'candidate-app'), result.alias)
      return result
    })
    return deployment
  }
  async mutate(args) {
    const directory = realpathSync(args.evidence)
    check(!directory.startsWith(this.root + sep) && directory !== this.root, 'Evidencia debe estar fuera del checkout')
    const operation = join(directory, args.action)
    check(!existsSync(operation), 'Existe un intento previo; no repetir uploads ni sobrescribir evidencia')
    const prior = this.readReceipt(directory, 'preflight')
    check(canonical(manifest(join(directory, 'candidate-app'))) === canonical(prior.files), 'Artefacto cambió desde preflight')
    if (args.action === 'promote') {
      const stage = this.readReceipt(join(directory, 'stage'), 'stage')
      check(stage.deployment.branch === STAGE_BRANCH && stage.deployment.commit === CANDIDATE && stage.deployment.alias !== prior.baseline.appPreview.alias, 'Stage aislado no verificable')
      const fresh = owner(await this.deployment(PROJECT, stage.deployment.id), PROJECT, { environment: 'preview', branch: STAGE_BRANCH, commit: CANDIDATE })
      const { alias: _alias, ...stageOwner } = stage.deployment
      check(canonical(fresh) === canonical(stageOwner), 'Stage cambió tras revisión')
      await this.compareArtifact(join(directory, 'candidate-app'), fresh.url)
      await this.compareArtifact(join(directory, 'candidate-app'), stage.deployment.alias)
      check(prior.rollback && canonical(manifest(join(directory, 'rollback-app'))) === canonical(prior.rollback), 'Falta artefacto anterior completo verificado para rollback')
      await this.compareArtifact(join(directory, 'rollback-app'), prior.baseline.appPreview.deployment.url)
    }
    // An existing directory means a previous attempt, including an ambiguous/failed upload.
    // Atomic reservation also excludes simultaneous invocations against the same evidence.
    mkdirSync(operation, { mode: 0o700 })
    save(join(operation, 'attempt.json'), { candidate: CANDIDATE, action: args.action, startedAt: new Date().toISOString() })
    let deployment, failure
    try {
      const current = await this.snapshot(join(operation, 'before'))
      this.assertSame(prior.baseline, current)
      this.verifyRepo()
      const branch = args.action === 'stage' ? STAGE_BRANCH : current.appPreview.deployment.branch
      const alias = args.action === 'promote' ? current.appPreview.alias : null
      deployment = await this.publish(directory, branch, alias, current.productionBranches.app, join(operation, 'deploy.log'))
      if (args.action === 'stage') check(deployment.alias !== current.appPreview.alias, 'Stage usa alias activo; detener')
      if (args.action === 'promote') await this.retry(() => this.compareArtifact(join(directory, 'candidate-app'), APP_PREVIEW, '/admin/medical?kawvo_med_shell=1'))
    } catch (error) { failure = error.message }
    try {
      const after = await this.snapshot(join(operation, 'after'))
      this.assertSame(prior.baseline, after, args.action === 'promote')
      if (args.action === 'promote') check(after.appPreview.deployment.id === deployment?.id && after.appPreview.alias === prior.baseline.appPreview.alias, 'Alias efectivo no corresponde al deployment publicado')
    } catch (error) { failure = [failure, error.message].filter(Boolean).join('; ') }
    this.receipt(operation, { action: args.action, result: failure ? 'BLOCKED' : 'PASS', deployment, failure, completedAt: new Date().toISOString() })
    check(!failure, failure)
    console.log('PASS ' + args.action + ': ' + deployment.url + '; alias real=' + deployment.alias)
    console.log('QA shell autenticada: PENDIENTE en ' + APP_PREVIEW + '/admin/medical?kawvo_med_shell=1; pages.dev no acredita activación funcional')
  }
  async run(args) {
    check(process.versions.node.split('.')[0] === '20', 'Se requiere Node 20, como la CI; no se cambia toolchain automáticamente')
    this.verifyRepo()
    this.credentials()
    return args.action === 'preflight' ? this.preflight(args) : this.mutate(args)
  }
}

export async function main(args = process.argv.slice(2)) {
  const parsed = options(args)
  if (parsed.help) {
    console.log('KAW-G3-003: default --action preflight [--rollback-artifact DIR]. Solo lectura remota.\nStage: --action stage --evidence DIR --approve-stage ' + CANDIDATE + '\nPromoción posterior: --action promote --evidence DIR --approve-promote ' + CANDIDATE + ' --stage-reviewed ' + CANDIDATE + '\nEstas opciones preparan un procedimiento; Stage/promoción requieren autorización separada. Sin Worker/Web/D1/R2/OAuth/Producción.')
    return
  }
  await new Runner().run(parsed)
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error('BLOCKED: ' + error.message); process.exitCode = 1 })
