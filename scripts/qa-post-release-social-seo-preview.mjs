import assert from 'node:assert/strict'

const base = String(process.env.PREVIEW_BASE || 'https://preview.intaprd.com').replace(/\/$/, '')
const slug = String(process.env.PROFILE_SLUG || 'jlprince').trim()
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

async function getHtml(path) {
  const response = await fetch(`${base}${path}`, { headers: crawlerHeaders, redirect: 'follow' })
  assert.equal(response.status, 200, `${path}: HTTP ${response.status}`)
  return { response, html: await response.text() }
}

async function assertRealImage(image, label) {
  assert.ok(image, `${label}: falta og:image`)
  assert.ok(!/favicon\.ico/i.test(image), `${label}: no puede usar favicon: ${image}`)
  assert.ok(!/\/assets\/og\/kawvo-link-og\.png/i.test(image), `${label}: no puede usar card genérica de Kawvo: ${image}`)
  const response = await fetch(image, { redirect: 'follow' })
  assert.equal(response.status, 200, `${label}: og:image respondió ${response.status}: ${image}`)
  assert.match(response.headers.get('content-type') || '', /^image\//i, `${label}: og:image no devuelve una imagen`)
}

{
  const { response, html } = await getHtml(`/${encodeURIComponent(slug)}?share=perfil&card=3`)
  const title = meta(html, 'og:title')
  const image = meta(html, 'og:image')
  assert.ok(title && !/Crea tu Perfil Digital con Kawvo Link/i.test(title), `perfil: título genérico inesperado: ${title}`)
  await assertRealImage(image, 'perfil')
  assert.match(response.headers.get('x-robots-tag') || '', /noindex/i, 'Preview debe seguir siendo noindex')
  assert.match(html, /application\/ld\+json/i, 'perfil: falta JSON-LD')
  assert.match(html, new RegExp(`/${slug}/ai\\.md`, 'i'), 'perfil: falta enlace ai.md')
  assert.match(html, new RegExp(`/${slug}/facts\\.json`, 'i'), 'perfil: falta enlace facts.json')
  assert.match(html, /data-kawvo-profile-discovery="dynamic"/i, 'perfil: falta fallback semántico dinámico')
  console.log(`✓ Perfil Graph Card dinámico usa imagen real: ${image}`)
}

{
  const { html } = await getHtml(`/${encodeURIComponent(slug)}?share=bancos&card=3`)
  const title = meta(html, 'og:title')
  const image = meta(html, 'og:image')
  assert.match(title, /Datos bancarios/i, `bancos: título incorrecto: ${title}`)
  await assertRealImage(image, 'bancos')
  console.log(`✓ Bancos Graph Card usa imagen real del perfil: ${image}`)
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
  assert.ok(json?.canonicalUrl, 'facts.json: falta URL canónica')
  console.log('✓ facts.json dinámico disponible')
}

console.log('✓ QA post-release social + SEO/GEO Preview aprobado')