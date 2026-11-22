// Shared G3.1.1 browser assertions, with an additive contextual-resume entry for G3.2.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { build } from 'esbuild'
const require=createRequire(import.meta.url)
const main='6e6bfbb1bd60c91a94e92d36f6cfdd9f91e3d9e2'
const medicalPath='app/src/components/admin/medical/MedicalDashboard.tsx'
const freePath='app/src/components/admin/free/KawvoFreeShellPreview.tsx'
const read=path=>readFileSync(path,'utf8')
export async function runG311Browser({contextual=false}={}){
let chromium
try { ({ chromium } = require('playwright')) } catch { throw Error('BLOCKED: existing Playwright unavailable; no installation attempted') }
const executablePath = [process.env.KAWMED_TEST_BROWSER, chromium.executablePath(), '/usr/bin/chromium'].find(path => path && existsSync(path))
assert.ok(executablePath, 'BLOCKED: installed Chromium unavailable')
const css = readdirSync('app/dist/assets').filter(name => name.endsWith('.css')).map(name => read('app/dist/assets/' + name)).join('\n')
assert.ok(css, 'Build App Preview before browser fixtures')
const bundles = new Map()
async function bundle(baseline = false, mode = 'preview') {
  const key = baseline + ':' + mode
  if (!bundles.has(key)) {
    const baselinePaths = [freePath, 'app/src/components/admin/free/FreeDashboard.tsx', 'app/src/components/admin/free/FreeShellSessionExit.tsx']
    const result = await build({ stdin: { contents: `
import React,{useState} from 'react';import{createRoot}from'react-dom/client';import{BrowserRouter,Routes,Route,useNavigate,useLocation}from'react-router-dom';
import Medical from './${medicalPath}';import Free from './${freePath}';import FreeEntry from './app/src/components/admin/free/FreeDashboard.tsx';
import Notice from './app/src/components/admin/shared/KawvoReadyToPublish.tsx';
function Bridge(){const navigate=useNavigate();window.fixtureNavigate=(path,state)=>navigate(path,{state});return null}
function Module(){const navigate=useNavigate(),location=useLocation();return <main><h1>Módulo existente</h1><button onClick={()=>navigate('/admin/free/shell-preview?kawvo_shell=1',{state:location.state})}>Volver al shell</button></main>}
function App(){const[epoch,setEpoch]=useState(0);window.fixtureRemount=()=>setEpoch(n=>n+1);return <BrowserRouter key={epoch}><Bridge/><Routes>
<Route path="/admin/medical" element={<Medical scope={new URLSearchParams(location.search).get('fixture_scope')==='sponsor_master'?'sponsor_master':'doctor'}/>}/>
<Route path="/admin/medical/demo/:token" element={<Medical/>}/>
<Route path="/admin/free" element={<FreeEntry/>}/><Route path="/admin/free/shell-preview" element={<Free/>}/><Route path="/admin/free/*" element={<Module/>}/>
</Routes></BrowserRouter>};createRoot(document.getElementById('root')).render(<App/>);`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, jsx: 'automatic', format: 'iife', define: { 'import.meta.env': JSON.stringify({ MODE: mode }) },
      plugins: baseline ? [{ name: 'actual-main-free', setup(build) { build.onLoad({ filter: /(?:KawvoFreeShellPreview|FreeDashboard|FreeShellSessionExit)\.tsx$/ }, args => {
        const path = baselinePaths.find(path => args.path.endsWith('/' + path))
        return path ? { contents: execFileSync('git', ['show', main + ':' + path], { encoding: 'utf8' }), loader: 'tsx' } : undefined
      }) } }] : [] })
    bundles.set(key, result.outputFiles[0].text)
  }
  return bundles.get(key)
}
const medical = { id: 'doctor-a', professional_prefix: 'Dra.', name: 'Médica de prueba', slug: 'medica-prueba', specialty: 'Medicina general | Pediatría', bio: '', status: 'draft', country: 'República Dominicana', centers: [], schedules: [], insurance_policy: { accepted: [], excluded: [] } }
const free = { profile_id: 'free-a', name: 'Presentación de prueba', slug: 'presentacion-prueba', is_published: 0, avatar_url: '/fixture-avatar.svg', hero_url: '/fixture-avatar.svg', templateData: { role: 'Profesional', free_identity_confirmed: true }, freeReadiness: { ready: true, missing: [], steps: { identifier: true, identity: true, photo: true, hero: true, contact: false, quick_actions: false, portfolio: false, services: false } } }
const browser = await chromium.launch({ headless: true, executablePath })
let count = 0
async function scenario(name, run) { await run(); count++; console.log('PASS ' + name) }
async function open({ product = 'medical', width = 390, baseline = false, mode = 'preview', url, data = {}, failure = '', team = { role: 'none' } } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 } }), page = await context.newPage()
  page.setDefaultTimeout(12000)
  const server = { medical: structuredClone({ ...medical, ...(product === 'medical' ? data : {}) }), free: structuredClone({ ...free, ...(product === 'free' ? data : {}) }), publicationError: '', saveError: '', nextMedicalSave: null, team }
  const calls = [], errors = [], js = await bundle(baseline, mode)
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', async route => {
    const request = route.request(), target = new URL(request.url()), path = target.pathname
    const json = data => route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) })
    if (path.startsWith('/api/')) {
      calls.push({ path, method: request.method(), body: request.postDataJSON() })
      if (path === '/api/v1/me/medical-profile') {
        if (failure) return json({ ok: false, error: failure })
        if (request.method() === 'PATCH') {
          if (server.saveError) return json({ ok: false, error: server.saveError })
          server.medical = server.nextMedicalSave || { ...server.medical, ...request.postDataJSON() }
        }
        return json({ ok: true, data: server.medical })
      }
      if (path.endsWith('/medical-profile/appointments')) return json({ ok: true, data: { profile: { id: server.medical.id }, requests: [] } })
      if (path.endsWith('/sponsor-context')) return json({ ok: true, data: null })
      if (path.endsWith('/medical-profile/publication')) {
        if (server.publicationError) return json({ ok: false, error: server.publicationError })
        server.medical.status = request.postDataJSON().action === 'publish' ? 'active' : 'draft'
        return json({ ok: true, data: { status: server.medical.status } })
      }
      if (path === '/api/v1/me') return json(failure ? { ok: false, error: failure } : { ok: true, data: server.free })
      if (path === '/api/v1/me/home-route') return json({ ok: true, data: { kind: 'free', route: '/admin/free', agenda_route: '/admin/free/agenda' } })
      if (path === '/api/v1/me/team/context') return json({ ok: true, data: server.team })
      if (path.startsWith('/api/v1/superadmin/')) return json({ ok: false })
      if (path === '/api/v1/me/profile') {
        if (server.publicationError) return json({ ok: false, error: server.publicationError })
        server.free.is_published = request.postDataJSON().is_published ? 1 : 0
        return json({ ok: true })
      }
      if (path === '/api/v1/me/notifications' || path.endsWith('/notifications/profile-published')) return json({ ok: true, data: { unread_count: 0 } })
      if (path === '/api/v1/auth/logout') return json({ ok: true })
      if (path.endsWith('/free/appointments')) return json({ ok: true, data: { profile: { id: server.free.profile_id }, requests: [] } })
      if (baseline && product === 'free') return json({ ok: true, data: {}, photos: [] })
      throw Error('Unexpected fixture API: ' + path)
    }
    if (path === '/fixture.js') return route.fulfill({ contentType: 'application/javascript', body: js })
    if (path === '/fixture.css') return route.fulfill({ contentType: 'text/css', body: css })
    if (path === '/fixture-avatar.svg') return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" rx="20" fill="#0e7490"/><circle cx="48" cy="38" r="16" fill="#cffafe"/><path d="M18 90a30 30 0 0 1 60 0" fill="#cffafe"/></svg>' })
    if (path === '/admin/login' || path === '/admin/medical/agenda') return route.fulfill({ contentType: 'text/html', body: '<h1>Destino existente</h1>' })
    if (request.isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>' })
    return route.fulfill({ status: 404, body: '' })
  })
  await page.goto(url || 'https://app.preview.intaprd.com' + (product === 'medical' ? '/admin/medical?kawvo_med_shell=1' : '/admin/free'))
  return { page, server, calls, context, close: async () => { assert.deepEqual(errors, [], 'Browser runtime errors'); await context.close() } }
}
const writes = calls => calls.filter(call => call.method !== 'GET')
const nav = (page, product, width = 390) => page.getByRole('navigation', { name: product === 'medical' ? width >= 768 ? 'Secciones de Kawmed' : 'Navegación Kawmed' : width >= 768 ? 'Secciones de Kawvo' : 'Navegación Kawvo', exact: true })
async function dismiss(page) { await page.getByRole('dialog').getByRole('button', { name: 'Más tarde', exact: true }).click() }
async function medicalEditor(page) {
  await nav(page, 'medical').getByRole('button', { name: 'Perfil', exact: true }).click()
  await page.getByRole('button', { name: /Identidad y especialidades/ }).click()
  return page.locator('section').filter({ has: page.getByRole('heading', { name: 'Perfil profesional', exact: true }) })
}
try {
  await scenario('main Free baseline: redirect shell has no ready modal, explicit legacy still has it', async () => {
    const shell = await open({ product: 'free', baseline: true })
    await shell.page.getByRole('heading', { name: 'Mi espacio Kawvo', exact: true }).waitFor()
    assert.equal(await shell.page.getByRole('dialog').count(), 0)
    assert.ok(shell.page.url().includes('/admin/free/shell-preview'))
    assert.equal(writes(shell.calls).length, 0); await shell.close()
    const legacy = await open({ product: 'free', baseline: true, url: 'https://app.preview.intaprd.com/admin/free?legacy=1' })
    await legacy.page.getByRole('dialog', { name: 'Perfil Free listo para publicar', exact: true }).waitFor()
    assert.equal(writes(legacy.calls).length, 0); await legacy.close()
  })
  for (const product of ['medical', 'free']) {
    await scenario(product + ': saved draft notice, later, navigation, remount/resume, other profile and role isolation', async () => {
      const result = await open({ product }), { page, server, calls } = result
      await page.getByRole('dialog').waitFor()
      const review = page.getByRole('dialog').getByRole('button', { name: 'Revisar publicación', exact: true })
      await page.waitForFunction(() => document.activeElement?.textContent === 'Revisar publicación')
      await page.keyboard.press('Shift+Tab')
      assert.equal(await page.getByRole('dialog').getByRole('button', { name: 'Más tarde', exact: true }).evaluate(node => node === document.activeElement), true)
      await page.keyboard.press('Tab')
      assert.equal(await review.evaluate(node => node === document.activeElement), true)
      assert.equal(writes(calls).length, 0, 'Showing readiness never publishes')
      await dismiss(page)
      await page.getByRole('region', { name: 'Perfil listo para publicar', exact: true }).waitFor()
      await nav(page, product).getByRole('button', { name: 'Más', exact: true }).click()
      assert.equal(await page.getByRole('dialog').count(), 0)
      await page.evaluate(() => window.fixtureRemount())
      if(contextual&&product==='medical'){
        await page.waitForFunction(()=>document.querySelector('nav[aria-label="Navegación Kawmed"] [aria-current="page"]')?.textContent.includes('Más'))
        await nav(page,product).getByRole('button',{name:'Inicio',exact:true}).click()
      }
      await page.locator('[data-kawvo-profile-identity]').waitFor()
      assert.equal(await page.getByRole('dialog').count(), 0, 'Later survives same-profile remount')
      if (product === 'medical') server.medical = { ...server.medical, id: 'doctor-b', slug: 'doctor-b' }
      else server.free = { ...server.free, profile_id: 'free-b', slug: 'free-b' }
      await page.evaluate(() => window.fixtureRemount())
      await page.getByRole('dialog').waitFor()
      await page.keyboard.press('Escape')
      assert.equal(await page.getByRole('dialog').count(), 0)
      if (product === 'free') {
        server.team = { role: 'member', member: { permissions: ['name', 'role', 'photo'] } }
        await page.evaluate(() => window.fixtureRemount())
        await page.getByRole('dialog').waitFor()
        await dismiss(page)
      }
      assert.equal(writes(calls).length, 0)
      await result.close()
    })
    for (const width of [320, 360, 390, 430, 768, 1280]) await scenario(product + ' hierarchy ' + width, async () => {
      const result = await open({ product, width, data: product === 'medical' ? { status: 'active', name: 'Nombre profesional de prueba con varios apellidos' } : { is_published: 1, name: 'Nombre profesional de prueba con varios apellidos' } })
      const { page, calls } = result
      const identity = page.locator('[data-kawvo-profile-identity]'); await identity.waitFor()
      assert.equal(await page.getByRole('dialog').count(), 0)
      assert.equal(await page.getByText('Publicado', { exact: true }).filter({ visible: true }).count(), 1, 'One published state label')
      const utility = identity.getByLabel('Acciones de la cuenta', { exact: true })
      for (const name of ['Instalar app Kawvo', 'Cerrar sesión']) {
        const rect = await utility.getByRole('button', { name, exact: true }).boundingBox()
        assert.ok(rect.width >= 43.9 && rect.height >= 43.9)
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      const title = await identity.getByRole('heading').boundingBox(), buttons = await utility.boundingBox()
      if (product === 'medical' && width < 640) {
        const install = await utility.getByRole('button', { name: 'Instalar app Kawvo', exact: true }).boundingBox()
        const logout = await utility.getByRole('button', { name: 'Cerrar sesión', exact: true }).boundingBox()
        const layout = await utility.evaluate(node => ({ direction: getComputedStyle(node).flexDirection, wrap: getComputedStyle(node).flexWrap, gap: parseFloat(getComputedStyle(node).columnGap) }))
        assert.ok(buttons.y >= title.y + title.height, 'Medical mobile utilities follow identity')
        assert.equal(layout.direction, 'row', 'Medical mobile utilities use the existing horizontal layout')
        assert.equal(layout.wrap, 'wrap', 'Medical utilities preserve safe wrapping at narrow widths')
        if (install.width + logout.width + layout.gap <= buttons.width + 0.01) {
          assert.ok(Math.abs(install.y - logout.y) <= 1 && logout.x >= install.x + install.width, 'Medical utilities share one row when both fit')
        } else {
          assert.ok(logout.y >= install.y + install.height && Math.abs(logout.x - install.x) <= 1, 'Medical utilities wrap safely when the row is too narrow')
        }
      } else {
        assert.ok(buttons.x > title.x && buttons.y <= title.y + 5, 'Utilities above/right of identity')
      }
      if (process.env.KAWVO_G3_1_1_ARTIFACTS) {
        mkdirSync(process.env.KAWVO_G3_1_1_ARTIFACTS, { recursive: true })
        await page.screenshot({ path: process.env.KAWVO_G3_1_1_ARTIFACTS + '/' + product + '-' + width + '.png', fullPage: true })
      }
      if (width < 768) {
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
        const obscured = await page.locator('main button, main a').evaluateAll(nodes => {
          const navigation = document.querySelector('nav[aria-label^="Navegación"]')
          const controls = nodes.filter(node => node.getClientRects().length && !node.closest('nav, aside, header'))
          return controls.length > 0 && controls[controls.length - 1].getBoundingClientRect().bottom > navigation.getBoundingClientRect().top + 1
        })
        assert.equal(obscured, false, 'Last control remains above bottom navigation when scrolled')
      }
      for (const name of ['Perfil', 'Agenda', 'Más', 'Inicio']) { await nav(page, product, width).getByRole('button', { name, exact: true }).click(); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false) }
      assert.equal(writes(calls).length, 0)
      await utility.getByRole('button', { name: 'Instalar app Kawvo', exact: true }).click()
      if (product === 'medical') await page.getByRole('dialog', { name: 'Cómo instalar Kawvo', exact: true }).waitFor()
      else { await page.waitForURL('**/admin/free/account'); assert.equal(writes(calls).length, 0) }
      await result.close()
    })
    await scenario(product + ': publication error, explicit action, success and no auto-publication on review/navigation', async () => {
      const result = await open({ product }), { page, server, calls } = result
      await page.getByRole('dialog').getByRole('button', { name: 'Revisar publicación', exact: true }).click()
      assert.equal(writes(calls).length, 0)
      server.publicationError = 'Error de publicación simulado'
      const publish = () => page.getByRole('button', { name: product === 'medical' ? 'Sí, publicar' : 'Publicar presentación', exact: true }).click()
      await publish(); await page.getByRole('alert').filter({ hasText: 'Error de publicación simulado' }).waitFor()
      assert.equal(writes(calls).length, 1)
      server.publicationError = ''
      await publish()
      await page.getByText('Publicado', { exact: true }).filter({ visible: true }).waitFor()
      assert.equal(await page.getByRole('region', { name: 'Perfil listo para publicar', exact: true }).count(), 0)
      assert.equal(await page.getByRole('dialog').count(), 0)
      assert.equal(calls.filter(call => call.path === (product === 'medical' ? '/api/v1/me/medical-profile/publication' : '/api/v1/me/profile')).length, 2)
      if (product === 'medical') {
        await page.getByRole('button', { name: 'Despublicar', exact: true }).click()
        await page.getByRole('button', { name: 'Sí, despublicar', exact: true }).click()
      } else await page.getByRole('button', { name: 'Ocultar presentación', exact: true }).click()
      await page.getByRole('region', { name: 'Perfil listo para publicar', exact: true }).waitFor()
      assert.equal(await page.getByRole('dialog').count(), 0, 'Explicit hide does not reopen a dismissed prompt')
      await result.close()
    })
  }
  await scenario('medical: incomplete to unsaved to saved minimums, save error, recommendation-independent ready state', async () => {
    const result = await open({ data: { specialty: '' } }), { page, server, calls } = result
    const editor = await medicalEditor(page)
    await editor.getByRole('combobox', { name: /^Especialidad principal/ }).selectOption({ label: 'Medicina general' })
    assert.equal(await page.getByRole('dialog').count(), 0)
    server.saveError = 'No se guardaron los cambios'
    await editor.getByRole('button', { name: 'Guardar perfil médico', exact: true }).click()
    await page.getByText('No se guardaron los cambios', { exact: true }).waitFor()
    assert.equal(await page.getByRole('dialog').count(), 0)
    server.saveError = ''
    await editor.getByRole('button', { name: 'Guardar perfil médico', exact: true }).click()
    await page.getByRole('dialog').waitFor()
    assert.deepEqual(server.medical.centers, []); assert.deepEqual(server.medical.schedules, [])
    assert.equal(calls.filter(call => call.path.endsWith('/publication')).length, 0)
    await dismiss(page)
    // An authorized different profile returned in the next readback must not inherit dismissal.
    server.nextMedicalSave = { ...server.medical, id: 'doctor-c', slug: 'doctor-c' }
    await editor.getByRole('button', { name: 'Guardar perfil médico', exact: true }).click()
    await page.getByRole('dialog').waitFor()
    await result.close()
  })
  await scenario('Free: saved minimums on module return, no recommended completeness requirement', async () => {
    const result = await open({ product: 'free', data: { freeReadiness: { ...free.freeReadiness, ready: false, missing: ['Completa tu nombre'] }, templateData: { role: '', free_identity_confirmed: false } } })
    await result.page.getByRole('heading', { name: 'Mi espacio Kawvo', exact: true }).waitFor()
    assert.equal(await result.page.getByRole('dialog').count(), 0)
    await result.page.getByRole('button', { name: 'Continuar configuración', exact: true }).click()
    await result.page.getByRole('heading', { name: 'Módulo existente', exact: true }).waitFor()
    assert.equal(writes(result.calls).length, 0)
    result.server.free = structuredClone(free)
    await result.page.getByRole('button', { name: 'Volver al shell', exact: true }).click()
    await result.page.getByRole('dialog').waitFor()
    assert.equal(result.server.free.freeReadiness.steps.portfolio, false)
    assert.equal(writes(result.calls).length, 0)
    await result.close()
  })
  await scenario('medical utility logout still confirms dirty discard and cancellation preserves the form', async () => {
    const result = await open({ data: { status: 'active' } }), { page, calls } = result
    const editor = await medicalEditor(page)
    await editor.getByLabel('Nombre', { exact: true }).fill('Nombre no guardado')
    await nav(page, 'medical').getByRole('button', { name: 'Inicio', exact: true }).click()
    let discard = false, prompts = 0
    page.on('dialog', dialog => { prompts++; void (discard ? dialog.accept() : dialog.dismiss()) })
    const exit = page.locator('[data-kawvo-profile-identity]').getByRole('button', { name: 'Cerrar sesión', exact: true })
    await exit.click(); assert.equal(prompts, 1); assert.equal(writes(calls).length, 0)
    await nav(page, 'medical').getByRole('button', { name: 'Perfil', exact: true }).click()
    assert.equal(await editor.getByLabel('Nombre', { exact: true }).inputValue(), 'Nombre no guardado')
    await nav(page, 'medical').getByRole('button', { name: 'Inicio', exact: true }).click()
    discard = true; await exit.click(); await page.waitForURL('**/admin/login')
    assert.equal(prompts, 2); assert.deepEqual(writes(calls).map(call => call.path), ['/api/v1/auth/logout'])
    await result.close()
  })
  await scenario('medical legacy, Master, delegated and load errors retain guards; Free load failure has no notice', async () => {
    for (const options of [{ product: 'medical', url: 'https://app.preview.intaprd.com/admin/medical' }, { product: 'medical', url: 'https://app.preview.intaprd.com/admin/medical', data: { status: 'draft' }, legacyReady: true }, { product: 'medical', url: 'https://app.preview.intaprd.com/admin/medical?kawvo_med_shell=1&fixture_scope=sponsor_master', data: { status: 'draft' }, masterReady: true }, { product: 'medical', data: { guest_editor: true } }, { product: 'medical', data: { status: 'inactive' } }, { product: 'medical', failure: 'Unauthorized' }, { product: 'free', failure: 'Unauthorized' }]) {
      const result = await open({ ...options, data: { status: 'active', ...(options.data || {}) } })
      if (options.failure) await result.page.getByRole('alert').waitFor()
      else if (options.data?.status === 'inactive') await result.page.locator('[data-kawvo-profile-identity]').waitFor()
      else await result.page.getByText('Dra. Médica de prueba', { exact: true }).waitFor()
      if (options.legacyReady) await result.page.getByRole('dialog', { name: 'Perfil médico listo para publicar', exact: true }).waitFor()
      if (options.masterReady) {
        assert.equal(await result.page.getByRole('dialog').count(), 0)
        await result.page.getByRole('button', { name: 'Publicar', exact: true }).click()
        await result.page.getByRole('group', { name: 'Confirmar publicación de perfil', exact: true }).waitFor()
      }
      assert.equal(await result.page.getByRole('region', { name: 'Perfil listo para publicar', exact: true }).count(), 0)
      assert.equal(writes(result.calls).length, 0); await result.close()
    }
  })
  console.log(`PASS G3.1.1 browser: ${count} scenarios; actual components, React/router and compiled CSS; requests intercepted, not authenticated QA`)
} finally { await browser.close() }

}
