import assert from 'node:assert/strict'

const base = String(process.env.PREVIEW_BASE || 'https://preview.intaprd.com').replace(/\/$/, '')
const slug = String(process.env.PROFILE_SLUG || 'qa-public-profile').trim()
const crawlerHeaders = {
  'user-agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  accept: 'text/html',
}

function meta(html, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, 'i'),
  ]
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match) return match[1]
  }
  return ''
}

function canonical(html) {
  return html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1]
    || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i)?.[1]
    || ''
}

function count(html, re) {
  return Array.from(html.matchAll(re)).length
}

async function getHtml(path) {
  const response = await fetch(`${base}${path}`, { headers: crawlerHeaders, redirect: 'follow' })
  assert.equal(response.status, 200, `${path}: HTTP ${response.status}`)
  return { response, html: await response.text() }
}

async function assertRealImage(image, label) {
  assert.ok(image, `${label}: falta og:image`)
  assert.ok(!/favicon\.ico/i.test(image), `${label}: no puede usar favicon: ${image}`)
  assert.ok(!/\/assets\/og\/kawvo-link-og\.png/i.test(image), `${label}: no puede usar card genérica de Kawvo: ${image}`)
  assert.ok(!/\.pages\.dev\//i.test(image), `${label}: og:image no puede depender de deployment .pages.dev: ${image}`)
  const response = await fetch(image, { redirect: 'follow' })
  assert.equal(response.status, 200, `${label}: og:image respondió ${response.status}: ${image}`)
  assert.match(response.headers.get('content-type') || '', /^image\//i, `${label}: og:image no devuelve una imagen`)
}

{
  const { response, html } = await getHtml(`/${encodeURIComponent(slug)}?share=perfil&card=3`)
  const title = meta(html, 'og:title')
  const image = meta(html, 'og:image')
  const canonicalUrl = canonical(html)
  const ogUrl = meta(html, 'og:url')
  const expectedCanonical = `${base}/${encodeURIComponent(slug)}`

  assert.ok(title && !/Crea tu Perfil Digital con Kawvo Link/i.test(title), `perfil: título genérico inesperado: ${title}`)
  await assertRealImage(image, 'perfil')
  assert.equal(canonicalUrl, expectedCanonical, `perfil: canonical incorrecto: ${canonicalUrl}`)
  assert.equal(ogUrl, expectedCanonical, `perfil: og:url incorrecto: ${ogUrl}`)
  assert.doesNotMatch(html, /https:\/\/[a-z0-9-]+\.intap-link\.pages\.dev/i, 'perfil: metadata todavía expone origin .pages.dev')
  assert.match(response.headers.get('x-robots-tag') || '', /noindex/i, 'Preview debe seguir siendo noindex')
  assert.equal(count(html, /<script\s+type=["']application\/ld\+json["']>/gi), 1, 'perfil: debe existir un solo JSON-LD consolidado')
  assert.match(html, /"@type":"ProfilePage"/i, 'perfil: JSON-LD debe usar ProfilePage')
  assert.equal(count(html, new RegExp(`<link[^>]+type=["']text/markdown["'][^>]+href=["'][^"']*/${slug}/ai\\.md["']`, 'gi')), 1, 'perfil: ai.md duplicado o ausente')
  assert.equal(count(html, new RegExp(`<link[^>]+type=["']application/json["'][^>]+href=["'][^"']*/${slug}/facts\\.json["']`, 'gi')), 1, 'perfil: facts.json duplicado o ausente')
  assert.match(html, /data-kawvo-profile-discovery="dynamic"/i, 'perfil: falta fallback semántico dinámico')
  assert.match(html, /data-kawvo-server-profile="1"/i, 'perfil: falta HTML semántico server-side')
  assert.match(html, /<div id="root">[\s\S]*data-kawvo-server-profile="1"/i, 'perfil: la semántica no está dentro del HTML inicial del root')
  assert.doesNotMatch(html, /<noscript[^>]+data-kawvo-profile-discovery="dynamic"/i, 'perfil: la semántica sigue encerrada en noscript')
  assert.match(html, /<h1>[^<]+<\/h1>/i, 'perfil: falta nombre legible en HTML inicial')
  assert.match(html, /<h2>Servicios<\/h2>/i, 'perfil: faltan servicios legibles en HTML inicial')
  console.log(`✓ Perfil canónico + Graph Card + HTML semántico dinámico: ${image}`)
}

{
  const { html } = await getHtml(`/${encodeURIComponent(slug)}?share=bancos&card=3`)
  const title = meta(html, 'og:title')
  const image = meta(html, 'og:image')
  assert.match(title, /Datos bancarios/i, `bancos: título incorrecto: ${title}`)
  await assertRealImage(image, 'bancos')
  console.log(`✓ Bancos Graph Card usa imagen real y estable del perfil: ${image}`)
}

{
  const ai = await fetch(`${base}/${encodeURIComponent(slug)}/ai.md`)
  assert.equal(ai.status, 200, `ai.md HTTP ${ai.status}`)
  const text = await ai.text()
  assert.ok(text.length > 100, 'ai.md demasiado corto')
  assert.match(text, /Servicios o productos/i, 'ai.md debe exponer servicios')
  assert.match(text, /Contacto/i, 'ai.md debe exponer contacto')
  console.log('✓ ai.md dinámico disponible')
}

{
  const facts = await fetch(`${base}/${encodeURIComponent(slug)}/facts.json`)
  assert.equal(facts.status, 200, `facts.json HTTP ${facts.status}`)
  const json = await facts.json()
  assert.ok(json?.entity?.name, 'facts.json: falta entidad')
  assert.ok(Array.isArray(json?.services), 'facts.json: services debe ser array')
  assert.equal(json?.canonicalUrl, `${base}/${encodeURIComponent(slug)}`, `facts.json: canonical incorrecto: ${json?.canonicalUrl}`)
  console.log('✓ facts.json dinámico disponible y canónico')
}

console.log('✓ QA post-release social + SEO/GEO/LLM Preview aprobado')
