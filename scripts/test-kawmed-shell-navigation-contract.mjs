import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { build, transform } from 'esbuild'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const base = '6e6bfbb1bd60c91a94e92d36f6cfdd9f91e3d9e2'
const directory = 'app/src/components/admin/medical/'
const dashboardPath = directory + 'MedicalDashboard.tsx'
const dashboard = readFileSync(dashboardPath, 'utf8')
const previous = execFileSync('git', ['show', base + ':' + dashboardPath], { encoding: 'utf8' })
const helper = readFileSync(directory + 'kawmed-shell-navigation.ts', 'utf8')
const frame = readFileSync(directory + 'KawMedUnifiedShellFrame.tsx', 'utf8')
const { code } = await transform(helper, { loader: 'ts', format: 'esm' })
const navigation = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))
const { canUseKawMedShell, hasPendingKawMedEdits, kawMedLoadPresentation } = navigation
const enabled = { mode: 'preview', hostname: 'app.preview.intaprd.com', pathname: '/admin/medical', search: '?kawvo_med_shell=1', scope: 'doctor', delegated: false, profileId: 'doctor-a', guestEditor: false }
assert.equal(canUseKawMedShell(enabled), true)
for (const change of [
  { mode: 'production' }, { mode: 'development' }, { hostname: 'app.intaprd.com' },
  { hostname: 'qa.intap-web2.pages.dev' }, { hostname: 'app.preview.intaprd.com.evil.invalid' },
  { pathname: '/admin/medical/demo/token' }, { pathname: '/admin/sponsor/kawmed' }, { pathname: '/admin/medical/agenda' },
  { search: '' }, { search: '?kawvo_shell=1' }, { search: '?kawvo_med_shell=true' },
  { scope: 'sponsor_master' }, { delegated: true }, { guestEditor: true }, { guestEditor: 'true' },
  { profileId: undefined }, { profileId: null }, { profileId: '' }, { profileId: ' ' },
]) assert.equal(canUseKawMedShell({ ...enabled, ...change }), false, JSON.stringify(change))
assert.deepEqual(navigation.KAWMED_SHELL_TABS.map(item => item.label), ['Inicio', 'Perfil', 'Agenda', 'Más'])
assert.deepEqual(navigation.KAWMED_PROFILE_SECTIONS.map(item => item.id), ['profile', 'centers', 'schedule', 'insurance', 'appearance'])
assert.notEqual(kawMedLoadPresentation('Unauthorized').title, kawMedLoadPresentation('Perfil médico no encontrado.').title)
assert.notEqual(kawMedLoadPresentation('').title, kawMedLoadPresentation('Error de conexión').title)

const profile = { id: 'doctor-a', name: 'Nombre guardado', specialty: 'Medicina general', slug: 'doctor-a', insurance_policy: { accepted: [{ insurance_name: 'ARS Humano' }], excluded: [] } }
const cleanDraft = { profile, form: { ...profile }, acceptedText: 'ARS Humano', excludedText: '', secondaryDraft: '', newCenter: { name: '', address: '', phone: '' }, editingCenter: null, newSchedule: { center_id: '', start_time: '08:00', end_time: '12:00', shift: '', notes: '' }, editingSchedule: null }
assert.equal(hasPendingKawMedEdits(cleanDraft), false)
for (const change of [
  { form: { ...profile, name: 'Cambio pendiente' } }, { acceptedText: 'Otra ARS' }, { excludedText: 'Excepción' },
  { secondaryDraft: 'Especialidad pendiente' }, { newCenter: { name: 'Centro pendiente' } },
  { editingCenter: { id: 'center-a' } }, { editingSchedule: { id: 'schedule-a' } },
  { newSchedule: { ...cleanDraft.newSchedule, center_id: 'center-a' } },
  { newSchedule: { ...cleanDraft.newSchedule, start_time: '09:00' } },
]) assert.equal(hasPendingKawMedEdits({ ...cleanDraft, ...change }), true, JSON.stringify(change))

// Compare the actual baseline operations/effects, not a second implementation of their behavior.
function operations(source) {
  const file = ts.createSourceFile('MedicalDashboard.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const functions = new Map(), effects = []
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name && node.name.text !== 'MedicalDashboard') functions.set(node.name.text, node.getText(file))
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isArrowFunction(node.initializer)) functions.set(node.name.text, node.initializer.getText(file))
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'useEffect') effects.push(node.getText(file))
    ts.forEachChild(node, visit)
  }
  visit(file)
  return { functions, effects }
}
const before = operations(previous), after = operations(dashboard)
for (const [name, body] of before.functions) assert.equal(after.functions.get(name), body, 'Existing operation changed: ' + name)
assert.deepEqual(after.effects, before.effects, 'No new load/autosave effects or changes to existing effects')
assert.doesNotMatch(helper + frame, /\bfetch\s*\(|\bapi(?:Get|Post|Put|Patch|Delete)\s*\(|(?:session|local)Storage/)
assert.doesNotMatch(dashboard, /\/admin\/free\/credentials|FreePublicationActions|FreeAgendaSummary/)
const allowed = new Set([dashboardPath, directory + 'KawMedUnifiedShellFrame.tsx', directory + 'kawmed-shell-navigation.ts', 'scripts/test-kawmed-shell-navigation-contract.mjs', 'docs/architecture/KAWVO_KAWMED_G3_LOT_1.md'])
const changed = execFileSync('git', ['diff', '--name-only', base], { encoding: 'utf8' }).trim().split('\n').filter(Boolean)
changed.push(...execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean))
for (const path of changed) assert.ok(allowed.has(path), 'Path outside G3.1: ' + path)
assert.deepEqual(new Set(changed), allowed, 'Exact G3.1 allowlist')
console.log(`PASS G3.1 core: opt-in/fallback matrix, draft detection, ${before.functions.size} unchanged operations, unchanged effects, scoped diff`)

if (process.argv.includes('--browser')) {
  let chromium
  try { ({ chromium } = require('playwright')) } catch { throw Error('BLOCKED browser: Playwright is not available; no dependency was installed') }
  const cssFiles = readdirSync('app/dist/assets').filter(name => name.endsWith('.css'))
  assert.ok(cssFiles.length, 'Build App Preview first; browser checks use real compiled CSS')
  const css = cssFiles.map(name => readFileSync('app/dist/assets/' + name, 'utf8')).join('\n')
  const bundles = new Map()
  async function bundle(mode) {
    if (!bundles.has(mode)) {
      const result = await build({ stdin: { contents: `import {createRoot} from 'react-dom/client'; import MedicalDashboard from './${dashboardPath}'; const params=new URLSearchParams(location.search); createRoot(document.getElementById('root')).render(<MedicalDashboard scope={params.get('fixture_scope')==='sponsor_master'?'sponsor_master':'doctor'} embedded={params.get('fixture_scope')==='sponsor_master'}/>);`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, format: 'iife', jsx: 'automatic', define: { 'import.meta.env': JSON.stringify({ MODE: mode }) } })
      bundles.set(mode, result.outputFiles[0].text)
    }
    return bundles.get(mode)
  }
  const fixture = { id: '11111111-1111-4111-8111-111111111111', name: 'Doctora de prueba', professional_prefix: 'Dra.', specialty: 'Medicina general | Pediatría', subspecialty: '', slug: 'doctora-prueba', bio: 'Presentación guardada', phone: '', whatsapp: '', email: '', city: '', province: '', country: 'República Dominicana', organization: '', status: 'active', avatar_url: '', cover_url: '', template: 'classic', palette: 'aqua', centers: [], schedules: [], insurance_policy: { accepted: [], excluded: [] }, account_email: 'doctor-fixture@example.invalid' }
  const browserPath = process.env.KAWMED_TEST_BROWSER || [chromium.executablePath(), '/usr/bin/chromium'].find(path => existsSync(path))
  if (!browserPath) throw Error('BLOCKED browser: no installed Chromium executable; no browser was downloaded')
  const browser = await chromium.launch({ headless: true, executablePath: browserPath })
  const scenarios = []
  async function open({ mode = 'preview', url = 'https://app.preview.intaprd.com/admin/medical?kawvo_med_shell=1', data = {}, failure, width = 390, delay = 0 } = {}) {
    const context = await browser.newContext({ viewport: { width, height: 900 } })
    const page = await context.newPage(), calls = [], errors = []
    page.setDefaultTimeout(10000)
    let saved = structuredClone({ ...fixture, ...data })
    const js = await bundle(mode)
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/*', async route => {
      const request = route.request(), target = new URL(request.url())
      const json = body => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
      if (target.pathname.startsWith('/api/')) {
        calls.push({ path: target.pathname, method: request.method(), body: request.postDataJSON() })
        if (delay) await new Promise(resolve => setTimeout(resolve, delay))
        if (target.pathname === '/api/v1/me/medical-profile') {
          if (failure) return json(failure)
          if (request.method() === 'PATCH') saved = { ...saved, ...request.postDataJSON() }
          return json({ ok: true, data: data === null ? null : saved })
        }
        if (target.pathname.endsWith('/appointments')) return json({ ok: true, data: { requests: [], profile: { id: saved.id } } })
        if (target.pathname.endsWith('/sponsor-context')) return json({ ok: true, data: null })
        if (target.pathname.endsWith('/publication')) {
          saved.status = request.postDataJSON().action === 'publish' ? 'active' : 'draft'
          return json({ ok: true, data: { status: saved.status, public_url: '/m/' + saved.slug } })
        }
        throw Error('Unexpected fixture API: ' + request.method() + ' ' + target.pathname)
      }
      if (target.pathname === '/g3-fixture.js') return route.fulfill({ contentType: 'application/javascript', body: js })
      if (target.pathname === '/g3-fixture.css') return route.fulfill({ contentType: 'text/css', body: css })
      if (target.pathname === '/admin/medical/agenda' || target.pathname === '/admin/medical/notifications') return route.fulfill({ contentType: 'text/html', body: '<h1>Módulo existente · destino verificado</h1>' })
      if (request.isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/g3-fixture.css"></head><body><div id="root"></div><script src="/g3-fixture.js"></script></body></html>' })
      return route.fulfill({ status: 404, body: '' })
    })
    await page.goto(url)
    const close = async () => { assert.deepEqual(errors, [], 'Browser runtime errors'); await context.close() }
    return { page, calls, close }
  }
  const nav = page => page.getByRole('navigation', { name: 'Navegación Kawmed', exact: true })
  const writes = calls => calls.filter(call => call.method !== 'GET')
  try {
    // Actual MedicalDashboard, React DOM and compiled CSS; every request is fulfilled in memory.
    for (const width of [320, 360, 390, 430, 768, 1280]) {
      const { page, calls, close } = await open({ width })
      await page.locator('[data-kawmed-shell="doctor"]').waitFor()
      assert.ok((await page.locator('[data-kawmed-shell="doctor"]').evaluate(node => getComputedStyle(node).fontFamily)).includes('sans-serif'), 'Offline font fallback')
      const menu = width >= 768 ? page.getByRole('navigation', { name: 'Secciones de Kawmed', exact: true }) : nav(page)
      for (const name of ['Inicio', 'Perfil', 'Agenda', 'Más']) {
        await menu.getByRole('button', { name, exact: true }).click()
        assert.ok(await page.getByRole('heading', { name: name === 'Perfil' ? 'Mi perfil' : name === 'Más' ? 'Más opciones' : name, exact: true }).isVisible())
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, `Global overflow ${width}/${name}`)
      }
      assert.equal(writes(calls).length, 0, 'Top-level navigation must not write')
      const undersized = await page.locator('button, a, input:not([type=file]), select').evaluateAll(nodes => nodes.filter(node => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden').filter(node => { const r = node.getBoundingClientRect(); return r.width < 43.9 || r.height < 43.9 }).map(node => node.textContent || node.getAttribute('aria-label') || node.tagName))
      assert.deepEqual(undersized, [], 'Touch targets ' + width)
      for (const section of navigation.KAWMED_PROFILE_SECTIONS) {
        await menu.getByRole('button', { name: 'Perfil', exact: true }).click()
        await page.getByRole('button', { name: new RegExp(section.title) }).click()
        const overflowing = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
        if (overflowing) console.error(await page.locator('body *').evaluateAll(nodes => nodes.filter(node => node.getClientRects().length && node.getBoundingClientRect().right > innerWidth + 1).map(node => ({ tag: node.tagName, class: node.className, text: (node.textContent || '').slice(0,100), right: node.getBoundingClientRect().right, width: node.getBoundingClientRect().width })).slice(-18)))
        assert.equal(overflowing, false, `Module overflow ${width}/${section.id}`)
        const targets = await page.locator('button, a, input:not([type=file]), select').evaluateAll(nodes => nodes.filter(node => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden').filter(node => { const r = node.getBoundingClientRect(); return r.width < 43.9 || r.height < 43.9 }).map(node => node.textContent || node.tagName))
        assert.deepEqual(targets, [], 'Module touch targets ' + width + '/' + section.id)
        if (width < 768) {
          await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
          const obscured = await page.locator('main[data-kawmed-shell] button, main[data-kawmed-shell] a, main[data-kawmed-shell] input:not([type=file]), main[data-kawmed-shell] select').evaluateAll(nodes => {
            const boundary = document.querySelector('nav[aria-label="Navegación Kawmed"]').getBoundingClientRect().top
            const controls = nodes.filter(node => !node.closest('nav, aside, header') && node.getClientRects().length)
            return controls.length > 0 && controls[controls.length - 1].getBoundingClientRect().bottom > boundary + 1
          })
          assert.equal(obscured, false, `Last control under bottom navigation ${width}/${section.id}`)
        }
        await page.getByRole('button', { name: 'Volver a las secciones', exact: false }).click()
      }
      if (process.env.KAWMED_TEST_ARTIFACTS) {
        mkdirSync(process.env.KAWMED_TEST_ARTIFACTS, { recursive: true })
        await menu.getByRole('button', { name: 'Inicio', exact: true }).click()
        await page.screenshot({ path: process.env.KAWMED_TEST_ARTIFACTS + '/home-' + width + '.png', fullPage: true })
      }
      assert.equal(writes(calls).length, 0, 'Browsing modules must not write')
      await close(); scenarios.push('responsive ' + width)
    }

    const { page, calls, close } = await open()
    await page.locator('[data-kawmed-shell="doctor"]').waitFor()
    await nav(page).getByRole('button', { name: 'Perfil', exact: true }).click()
    await page.getByRole('button', { name: /Identidad y especialidades/ }).click()
    const identity = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Perfil profesional', exact: true }) })
    await identity.getByLabel('Nombre', { exact: true }).fill('Nombre pendiente sin guardar')
    await nav(page).getByRole('button', { name: 'Inicio', exact: true }).click()
    await nav(page).getByRole('button', { name: 'Más', exact: true }).click()
    await page.getByRole('link', { name: 'Solicitudes médicas', exact: true }).click()
    assert.ok(page.url().endsWith('/admin/medical?kawvo_med_shell=1'), 'Unsaved notification exit blocked')
    await nav(page).getByRole('button', { name: 'Agenda', exact: true }).click()
    await page.getByRole('button', { name: 'Abrir Agenda médica', exact: true }).click()
    assert.ok(await page.getByRole('alert').filter({ hasText: 'cambios sin guardar' }).isVisible())
    await nav(page).getByRole('button', { name: 'Perfil', exact: true }).click()
    assert.equal(await identity.getByLabel('Nombre', { exact: true }).inputValue(), 'Nombre pendiente sin guardar')
    assert.equal(calls.filter(call => call.path === '/api/v1/me/medical-profile').length, 1, 'Navigation must not reload the profile')
    assert.equal(writes(calls).length, 0)
    await page.getByRole('button', { name: 'Volver a las secciones', exact: false }).click()
    await page.getByRole('button', { name: /Centros de atención/ }).click()
    const centers = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Centros de atención', exact: true }) })
    await centers.getByLabel('Nombre', { exact: true }).fill('Centro sin guardar')
    await nav(page).getByRole('button', { name: 'Más', exact: true }).click()
    await nav(page).getByRole('button', { name: 'Perfil', exact: true }).click()
    assert.equal(await centers.getByLabel('Nombre', { exact: true }).inputValue(), 'Centro sin guardar')
    await page.getByRole('button', { name: 'Panel anterior', exact: true }).click()
    assert.equal(await page.locator('[data-kawmed-shell]').count(), 0)
    await page.getByRole('button', { name: 'Perfil', exact: true }).click()
    assert.equal(await identity.getByLabel('Nombre', { exact: true }).inputValue(), 'Nombre pendiente sin guardar', 'Legacy fallback keeps parent drafts')
    assert.equal(writes(calls).length, 0)
    await close(); scenarios.push('drafts, blocked exits, legacy fallback, single load')

    for (const options of [
      { url: 'https://app.preview.intaprd.com/admin/medical' },
      { mode: 'production' },
      { url: 'https://app.intaprd.com/admin/medical?kawvo_med_shell=1' },
      { url: 'https://qa.intap-web2.pages.dev/admin/medical?kawvo_med_shell=1' },
      { url: 'https://app.preview.intaprd.com/admin/sponsor/kawmed?kawvo_med_shell=1&fixture_scope=sponsor_master' },
      { url: 'https://app.preview.intaprd.com/admin/medical/demo/i-fixture?kawvo_med_shell=1' },
      { data: { guest_editor: true } },
    ]) {
      const result = await open(options)
      await result.page.getByRole('heading', { name: 'Dra. Doctora de prueba', exact: true }).waitFor()
      assert.equal(await result.page.locator('[data-kawmed-shell]').count(), 0)
      assert.equal(writes(result.calls).length, 0)
      await result.close()
    }
    scenarios.push('legacy, production, pages.dev, Master and delegated fallbacks')

    for (const failure of [{ ok: false, error: 'Unauthorized' }, { ok: false, error: 'Perfil médico no encontrado.' }, { ok: false, error: 'Error de conexión' }]) {
      const result = await open({ failure, delay: 250 })
      await result.page.getByRole('alert').waitFor()
      assert.equal(await result.page.locator('[data-kawmed-shell]').count(), 0, 'No shell before authorized profile')
      assert.equal(writes(result.calls).length, 0)
      await result.close()
    }
    scenarios.push('permission, missing profile and load error')

    const empty = await open({ data: null })
    await empty.page.getByRole('alert').filter({ hasText: 'No hay un perfil médico autorizado' }).waitFor()
    assert.equal(await empty.page.locator('[data-kawmed-shell]').count(), 0)
    await empty.close(); scenarios.push('empty authorized response stays outside shell')

    const accessibility = await open()
    await accessibility.page.locator('[data-kawmed-shell="doctor"]').waitFor()
    await accessibility.page.keyboard.press('Tab')
    assert.notEqual(await accessibility.page.locator(':focus').evaluate(node => getComputedStyle(node).outlineStyle), 'none', 'Visible keyboard focus')
    await nav(accessibility.page).getByRole('button', { name: 'Más', exact: true }).click()
    await accessibility.page.getByRole('button', { name: 'Instalar app Kawvo', exact: true }).click()
    await accessibility.page.getByRole('dialog', { name: 'Cómo instalar Kawvo', exact: true }).waitFor()
    assert.equal(writes(accessibility.calls).length, 0)
    await accessibility.close(); scenarios.push('visible focus and existing PWA help from Más')

    const incomplete = await open({ data: { specialty: '', status: 'draft' } })
    await incomplete.page.getByRole('button', { name: 'Ir a los datos del perfil', exact: true }).click()
    assert.ok(await incomplete.page.getByRole('heading', { name: 'Perfil profesional', exact: true }).isVisible(), 'Missing requirements open the existing form')
    assert.equal(writes(incomplete.calls).length, 0)
    await incomplete.close(); scenarios.push('missing requirements navigate to existing editor without saving')

    const publication = await open({ data: { status: 'draft' } })
    await publication.page.getByRole('button', { name: 'Revisar publicación', exact: true }).click()
    assert.equal(writes(publication.calls).length, 0, 'Opening confirmation must not publish')
    await nav(publication.page).getByRole('button', { name: 'Más', exact: true }).click()
    await nav(publication.page).getByRole('button', { name: 'Inicio', exact: true }).click()
    await publication.page.getByRole('button', { name: 'Sí, publicar', exact: true }).click()
    await publication.page.getByRole('status').filter({ hasText: 'Perfil publicado correctamente' }).waitFor()
    assert.deepEqual(writes(publication.calls).map(({ path, method, body }) => ({ path, method, body })), [{ path: '/api/v1/me/medical-profile/publication', method: 'POST', body: { action: 'publish', confirm: true } }])
    assert.ok(await nav(publication.page).getByRole('button', { name: 'Inicio', exact: true }).getAttribute('aria-current') === 'page')
    await publication.close(); scenarios.push('existing publication confirmation and navigation retained')

    const agenda = await open()
    await nav(agenda.page).getByRole('button', { name: 'Agenda', exact: true }).click()
    await agenda.page.getByRole('button', { name: 'Abrir Agenda médica', exact: true }).click()
    await agenda.page.waitForURL('https://app.preview.intaprd.com/admin/medical/agenda')
    assert.equal(writes(agenda.calls).length, 0)
    await agenda.close(); scenarios.push('existing Agenda URL without mutation')
    console.log('PASS G3.1 browser fixtures: ' + scenarios.join('; '))
    console.log('LIMIT: synthetic intercepted responses; not authenticated Preview QA, D1/R2/OAuth or deployment evidence')
  } finally { await browser.close() }
}
