import assert from 'node:assert/strict'

const base = String(process.env.PREVIEW_BASE || 'https://preview.intaprd.com').replace(/\/$/, '')
const endpoint = `${base}/api/v1/public/demo/ai/generate`
const consent = { accepted: true, version: 'demo-ai-v1.0' }

async function post(body) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await response.json().catch(() => ({}))
  return { response, json }
}

function session(label) {
  return `qa-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

async function readyCase(label, activity, work, expected) {
  const result = await post({ session_key: session(label), consent, activity, name: `QA ${label}`, work_description: work, round: 1 })
  assert.equal(result.response.status, 200, `${label}: HTTP ${result.response.status} ${JSON.stringify(result.json)}`)
  assert.equal(result.json?.ok, true, `${label}: ok`)
  assert.equal(result.json?.data?.status, 'ready', `${label}: debe quedar ready`)
  assert.equal(result.json?.data?.demo?.asset_category, expected, `${label}: categoría`)
  assert.ok(result.json.data.demo.professional_title.length <= 80, `${label}: cargo <=80`)
  assert.ok(result.json.data.demo.bio.length <= 300, `${label}: bio <=300`)
  assert.equal(result.json.data.demo.services.length, 3, `${label}: exactamente 3 servicios`)
  for (const service of result.json.data.demo.services) {
    assert.ok(service.title.length <= 60, `${label}: service title <=60`)
    assert.ok(service.description.length <= 90, `${label}: service desc <=90`)
  }
  console.log(`✓ ${label}: ${expected}`)
}

await readyCase('A-mecanico', 'Mecánico', 'Mantenimiento, frenos, tren delantero, escaneo y diagnóstico.', 'Automotriz y mecánica')
await readyCase('B-electricista', 'Electricista residencial', 'Instalo lámparas, abanicos, inversores y hago instalaciones eléctricas nuevas.', 'Mantenimiento e instalaciones técnicas')
await readyCase('C-interiores', 'Decoradora de interiores', 'Decoro apartamentos, Airbnb y oficinas.', 'Hogar, decoración y mobiliario')
await readyCase('D-bodas', 'Decoradora de bodas', 'Decoro bodas y celebraciones con ambientación para el evento.', 'Eventos y entretenimiento')
await readyCase('F-aire', 'Técnico de aire acondicionado', 'Instalo, mantengo y reparo equipos de aire acondicionado.', 'Mantenimiento e instalaciones técnicas')

{
  const result = await post({ session_key: session('E-tecnico'), consent, activity: 'Técnico', name: 'QA Técnico', work_description: 'Hago trabajos técnicos para clientes.', round: 1 })
  assert.equal(result.response.status, 200)
  assert.equal(result.json?.data?.status, 'needs_more_info')
  assert.ok(result.json.data.questions?.length >= 1)
  console.log('✓ E-técnico: needs_more_info sin llamada innecesaria')
}

{
  const result = await post({ session_key: session('H-no-name'), consent, activity: 'Mecánico', name: '', work_description: 'Mantenimiento y frenos.', round: 1 })
  assert.equal(result.response.status, 400)
  console.log('✓ H: nombre vacío rechazado; IA no inventa identidad')
}

{
  const result = await post({ session_key: session('consent'), consent: { accepted: false, version: 'demo-ai-v1.0' }, activity: 'Mecánico', name: 'QA', work_description: 'Mantenimiento y frenos.', round: 1 })
  assert.equal(result.response.status, 428)
  assert.equal(result.json?.code, 'consent_required')
  console.log('✓ consentimiento: OpenAI bloqueado sin aceptación')
}

{
  const key = session('cooldown')
  const first = await post({ session_key: key, consent, activity: 'Mecánico', name: 'QA Rate', work_description: 'Mantenimiento y frenos.', round: 1 })
  assert.equal(first.response.status, 200)
  const second = await post({ session_key: key, consent, activity: 'Mecánico', name: 'QA Rate', work_description: 'Mantenimiento y frenos.', round: 1 })
  assert.equal(second.response.status, 429)
  assert.equal(second.json?.code, 'cooldown')
  assert.equal(second.json?.fallback, true)
  console.log('✓ rate-limit/cooldown: 429 con fallback')
}

{
  const snapshot = {
    profile: {
      id: 'demo-local-only', slug: 'demo', name: 'QA Demo IA', role: 'Mecánico automotriz', personalBadge: 'Demo Kawvo Link', aboutTitle: 'Sobre mí', portfolioTitle: 'Mis trabajos', servicesTitle: 'Servicios', servicesDescription: 'Muestra temporal', bio: 'Demo temporal para validar el ciclo de compartir.', phone: '18090000000', whatsappGreetingName: 'QA', whatsappCtaLabel: 'Hablar por WhatsApp', instagram: '', location: '', portrait: '/assets/free-starter/automotriz-mecanica/automotriz-mecanica-02.webp', hero: '/assets/free-starter/automotriz-mecanica/automotriz-mecanica-01.webp', heroPositionX: 50, heroPositionY: 50, heroZoom: 1, category: 'Automotriz y mecánica', vcardFileName: 'kawvo-demo.vcf', quickActions: [{ type: 'call', label: 'Llamar', url: 'tel:+18090000000' }], services: [], portfolio: [], customLinks: [],
    },
    layout: 'impacto',
    colors: { primary: '#111827', secondary: '#374151', accent: '#64748B', button: '#111827', background: '#F3F4F6', surface: '#FFFFFF', text: '#111827', heroGradient: '#111827' },
  }
  const form = new FormData()
  form.set('snapshot', JSON.stringify(snapshot))
  form.set('sector_key', 'Automotriz y mecánica')
  form.set('session_key', session('share'))
  const created = await fetch(`${base}/api/v1/public/demo/share`, { method: 'POST', body: form })
  const createdJson = await created.json().catch(() => ({}))
  assert.equal(created.status, 201, `share create: ${JSON.stringify(createdJson)}`)
  assert.match(String(createdJson?.url || ''), /\/demo\/s\/[a-f0-9]{48}$/)
  const expiry = Date.parse(createdJson.expires_at)
  const hours = (expiry - Date.now()) / 3_600_000
  assert.ok(hours > 23 && hours <= 24.1, `snapshot TTL debe ser ~24h, fue ${hours}`)
  const opened = await fetch(createdJson.url)
  assert.equal(opened.status, 200)
  console.log('✓ viralidad: snapshot temporal ~24h y /demo/s/{token} abre correctamente')
}

console.log('✓ DEMO IA Preview E2E: matriz mínima aprobada')
