import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { jwt } from 'hono/jwt'
import { getEntitlements } from './engine/entitlements'

type Bindings = {
  DB: D1Database
  BUCKET: R2Bucket
  JWT_SECRET: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', cors())

// --- Auth & Middlewares ---

const requireAdmin = async (c: any, next: any) => {
  const adminEmail = 'juanluis@intaprd.com'
  const userEmail = c.req.header('X-User-Email')
  if (userEmail !== adminEmail) return c.json({ ok: false, error: 'Forbidden' }, 403)
  await next()
}

// --- Rutas de API ---

app.get('/api/health', (c) => c.json({ ok: true, status: 'healthy' }))

// --- Autenticación MAGIC LINK ---

app.post('/api/v1/auth/magic-link', async (c) => {
  const { email } = await c.req.json()
  // Simulación: Generamos un código de 6 dígitos
  const code = Math.floor(100000 + Math.random() * 900000).toString()

  // Guardamos en D1 para verificación temporal (Opcional, aquí simulamos que el código es '123456' para el test)
  console.log(`[AUTH] Código enviado a ${email}: ${code}`)

  return c.json({ ok: true, message: 'Código enviado (revisa la consola)' })
})

app.post('/api/v1/auth/verify', async (c) => {
  const { email, code } = await c.req.json()

  // Simulación de verificación
  if (code !== '123456') return c.json({ ok: false, error: 'Código inválido' }, 401)

  // En producción buscaríamos al usuario en D1
  const payload = { email, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 } // 24h
  // const token = await jwt.sign(payload, c.env.JWT_SECRET) // Comentado hasta tener el secret en wrangler.toml

  return c.json({ ok: true, token: 'mock-jwt-token', user: { email } })
})

// --- Analíticas ---

app.post('/api/v1/public/track', async (c) => {
  try {
    const { profileId, eventType, targetId } = await c.req.json()
    const id = crypto.randomUUID()
    await c.env.DB.prepare(
      `INSERT INTO analytics (id, profile_id, event_type, target_id) VALUES (?, ?, ?, ?)`
    )
      .bind(id, profileId, eventType, targetId || null)
      .run()
    return c.json({ ok: true })
  } catch (e) {
    return c.json({ ok: false }, 202)
  }
})

app.get('/api/v1/profile/stats/:profileId', async (c) => {
  const profileId = c.req.param('profileId')
  const totalViews = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM analytics WHERE profile_id = ? AND event_type = 'view'`
  )
    .bind(profileId)
    .first()

  const dailyViews = await c.env.DB.prepare(
    `SELECT date(created_at) as day, COUNT(*) as count 
     FROM analytics 
     WHERE profile_id = ? AND event_type = 'view' AND created_at > date('now', '-7 days') 
     GROUP BY day ORDER BY day ASC`
  )
    .bind(profileId)
    .all()

  const topLinks = await c.env.DB.prepare(
    `SELECT l.label, COUNT(a.id) as clics 
     FROM analytics a 
     JOIN profile_links l ON a.target_id = l.id 
     WHERE a.profile_id = ? AND a.event_type = 'click' 
     GROUP BY l.id ORDER BY clics DESC LIMIT 5`
  )
    .bind(profileId)
    .all()

  return c.json({
    ok: true,
    stats: {
      totalViews: (totalViews as any)?.count || 0,
      dailyViews: dailyViews.results,
      topLinks: topLinks.results,
    },
  })
})

// --- Galería (R2) ---

app.post('/api/v1/profile/gallery/upload', async (c) => {
  const { profileId } = await c.req.parseBody()

  // ✅ Fix TS: valida tipo File correctamente (sin cast)
  const fd = await c.req.formData()
  const fileVal = fd.get('file')

  if (!(fileVal && typeof fileVal === 'object' && 'name' in (fileVal as any) && 'stream' in (fileVal as any))) {
    return c.json({ ok: false, error: 'No file' }, 400)
  }

  const file = fileVal as any as File

  const key = `profiles/${profileId}/${crypto.randomUUID()}-${file.name}`
  await c.env.BUCKET.put(key, file.stream())

  const id = crypto.randomUUID()
  await c.env.DB.prepare(
    `INSERT INTO profile_gallery (id, profile_id, image_key, sort_order) VALUES (?, ?, ?, 0)`
  )
    .bind(id, profileId, key)
    .run()

  return c.json({ ok: true, id, key })
})

app.get('/api/v1/profile/gallery/:profileId', async (c) => {
  const profileId = c.req.param('profileId')
  const photos = await c.env.DB.prepare(
    `SELECT * FROM profile_gallery WHERE profile_id = ? ORDER BY sort_order ASC`
  )
    .bind(profileId)
    .all()
  return c.json({ ok: true, photos: photos.results })
})

// Sirve objetos desde R2 como endpoint público (Plan B: sin CDN público aún)
app.get('/api/v1/public/assets/*', async (c) => {
  const key = decodeURIComponent(c.req.path.slice('/api/v1/public/assets/'.length))
  if (!key) return c.json({ error: 'Key requerida' }, 400)

  const object = await c.env.BUCKET.get(key)
  if (!object) return c.json({ error: 'Archivo no encontrado' }, 404)

  const contentType = object.httpMetadata?.contentType || 'application/octet-stream'
  return new Response(object.body as ReadableStream, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
    },
  })
})

// Perfil Público
app.get('/api/v1/public/profiles/:slug', async (c) => {
  const slug = c.req.param('slug')
  const profile = await c.env.DB.prepare(
    'SELECT id, slug, plan_id, theme_id, is_published, name, bio, whatsapp_number FROM profiles WHERE slug = ?'
  )
    .bind(slug)
    .first()

  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  const [links, rawGallery, rawFaqs, rawProducts, entitlements, rawSocialLinks] = await Promise.all([
    c.env.DB.prepare(
      'SELECT id, label, url FROM profile_links WHERE profile_id = ? ORDER BY sort_order ASC'
    )
      .bind((profile as any).id)
      .all(),
    c.env.DB.prepare(
      'SELECT image_key FROM profile_gallery WHERE profile_id = ? ORDER BY sort_order ASC'
    )
      .bind((profile as any).id)
      .all(),
    c.env.DB.prepare(
      'SELECT id, question, answer, sort_order FROM profile_faqs WHERE profile_id = ? ORDER BY sort_order ASC'
    )
      .bind((profile as any).id)
      .all(),
    c.env.DB.prepare(
      'SELECT id, title, description, price, image_url, whatsapp_text, is_featured, sort_order FROM profile_products WHERE profile_id = ? ORDER BY sort_order ASC'
    )
      .bind((profile as any).id)
      .all(),
    getEntitlements(c, (profile as any).id as string),
    c.env.DB.prepare(
      'SELECT id, type, url, sort_order FROM profile_social_links WHERE profile_id = ? AND enabled = 1 ORDER BY sort_order ASC'
    )
      .bind((profile as any).id)
      .all(),
  ])

  // Construye URL pública vía el endpoint /assets (Plan B: sin CDN externo)
  const origin = new URL(c.req.url).origin
  const toAssetUrl = (key: string): string | null => {
    if (!key) return null
    if (key.startsWith('http')) return key
    const encodedKey = key.split('/').map(encodeURIComponent).join('/')
    return `${origin}/api/v1/public/assets/${encodedKey}`
  }

  // Filtra items demo/prueba y agrega image_url resuelta
  const isDemoKey = (key: string) =>
    key.startsWith('demo/') || key === 'profile_debug' || key.startsWith('profile_debug')

  const gallery = (rawGallery.results as { image_key: string }[])
    .filter((g) => g.image_key && !isDemoKey(g.image_key))
    .map((g) => ({ image_key: g.image_key, image_url: toAssetUrl(g.image_key) }))

  const products = rawProducts.results as {
    id: string
    title: string
    description: string | null
    price: string | null
    image_url: string | null
    whatsapp_text: string | null
    is_featured: number
    sort_order: number
  }[]

  const featured_product = products.find((p) => p.is_featured === 1) ?? null

  return c.json({
    ok: true,
    data: {
      profileId: (profile as any).id,
      slug: (profile as any).slug,
      planId: (profile as any).plan_id,
      themeId: (profile as any).theme_id,
      name: (profile as any).name,
      bio: (profile as any).bio,
      whatsapp_number: (profile as any).whatsapp_number ?? null,
      social_links: rawSocialLinks.results,
      links: links.results,
      gallery,
      faqs: rawFaqs.results,
      products,
      featured_product,
      entitlements,
    },
  })
})

/* ============================
   vCard público
   ============================ */

app.get('/api/v1/public/vcard/:profileId', async (c) => {
  const profileId = c.req.param('profileId')

  const profile = await c.env.DB.prepare(
    'SELECT slug, name, bio, whatsapp_number FROM profiles WHERE id = ?'
  ).bind(profileId).first() as { slug: string; name: string | null; bio: string | null; whatsapp_number: string | null } | null

  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  const fn = profile.name || profile.slug
  const profileUrl = `https://intap.link/${profile.slug}`

  const lines: string[] = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${fn}`,
    `N:${fn};;;`,
  ]
  if (profile.whatsapp_number) lines.push(`TEL;TYPE=CELL:${profile.whatsapp_number}`)
  if (profile.bio)             lines.push(`NOTE:${profile.bio.replace(/\n/g, '\\n')}`)
  lines.push(`URL:${profileUrl}`)
  lines.push('END:VCARD')

  const vcf = lines.join('\r\n') + '\r\n'
  const filename = `${profile.slug}.vcf`

  return new Response(vcf, {
    headers: {
      'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
})

/* ============================
   Waitlist
   ============================ */

const WAITLIST_MODES = ['Virtual', 'Fisica', 'Mixta'] as const

app.post('/api/v1/public/waitlist', async (c) => {
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Invalid JSON' }, 400) }

  const email     = String(body.email     || '').trim().toLowerCase()
  const whatsapp  = String(body.whatsapp  || '').trim()
  const name      = String(body.name      || '').trim()
  const sector    = String(body.sector    || '').trim()
  const mode      = String(body.mode      || '').trim()

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return c.json({ ok: false, error: 'valid email required' }, 400)
  if (!name || name.length < 2)
    return c.json({ ok: false, error: 'name required (min 2 chars)' }, 400)
  if (!sector || sector.length < 2)
    return c.json({ ok: false, error: 'sector required' }, 400)
  if (!(WAITLIST_MODES as readonly string[]).includes(mode))
    return c.json({ ok: false, error: 'mode must be Virtual, Fisica or Mixta' }, 400)

  // Idempotente: si ya existe, actualiza name/sector/mode y devuelve posición
  const existing = await c.env.DB.prepare(
    `SELECT id, position FROM waitlist WHERE email = ?1 OR (whatsapp IS NOT NULL AND whatsapp != '' AND whatsapp = ?2)`
  ).bind(email, whatsapp || '').first()

  if (existing) {
    await c.env.DB.prepare(
      `UPDATE waitlist SET name = ?1, sector = ?2, mode = ?3 WHERE id = ?4`
    ).bind(name, sector, mode, (existing as any).id).run()
    return c.json({ ok: true, position: (existing as any).position, updated: true })
  }

  const posRow = await c.env.DB.prepare(`SELECT COUNT(*) as n FROM waitlist`).first()
  const position = ((posRow as any)?.n || 0) + 1

  const id = crypto.randomUUID()
  await c.env.DB.prepare(
    `INSERT INTO waitlist (id, email, whatsapp, name, sector, mode, position) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
  ).bind(id, email, whatsapp || null, name, sector, mode, position).run()

  return c.json({ ok: true, position }, 201)
})

/* ============================
   FASE 3 — Leads (Captura)
   ============================ */

// --- Leads (Captura de contacto) + Turnstile condicional ---

const TURNSTILE_SITEKEY = '0x4AAAAAACgDVjTSshSRPS5q'

app.post('/api/v1/public/leads', async (c) => {
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Invalid JSON' }, 400) }

  const profile_slug = String(body.profile_slug || '').trim()
  const name = String(body.name || '').trim()
  const email = String(body.email || '').trim()
  const phone = String(body.phone || '').trim()
  const message = String(body.message || '').trim()
  const honeypot = String(body.hp || '').trim()
  const source_url = String(body.source_url || '').trim()
  const turnstile_token = String(body.turnstile_token || '').trim()

  if (!profile_slug || profile_slug.length < 2) return c.json({ ok: false, error: 'profile_slug required' }, 400)
  if (!name || name.length < 2) return c.json({ ok: false, error: 'name required' }, 400)
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ ok: false, error: 'valid email required' }, 400)
  if (!message || message.length < 10) return c.json({ ok: false, error: 'message must be at least 10 chars' }, 400)

  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || ''
  const ua = c.req.header('user-agent') || ''
  const ip_hash = await sha256Base64Url(ip || 'unknown')

  // Si honeypot viene lleno → exigir Turnstile (condicional)
  if (honeypot) {
    if (!turnstile_token) {
      return c.json({ ok: false, error: 'turnstile_required', sitekey: TURNSTILE_SITEKEY }, 403)
    }
    const ok = await verifyTurnstile(c, turnstile_token, ip)
    if (!ok) return c.json({ ok: false, error: 'turnstile_failed' }, 403)
  }

  // Rate limit (5 envíos / 10 min por ip_hash + slug)
  const rl = await c.env.DB.prepare(
    `SELECT COUNT(*) as n
     FROM lead_rate_limits
     WHERE profile_slug = ?1 AND ip_hash = ?2
       AND created_at >= datetime('now','-10 minutes')`
  ).bind(profile_slug, ip_hash).first()

  const count = ((rl as any)?.n || 0) as number

  // Si excedió límite → exigir Turnstile (condicional)
  if (count >= 5) {
    if (!turnstile_token) {
      return c.json({ ok: false, error: 'turnstile_required', sitekey: TURNSTILE_SITEKEY }, 403)
    }
    const ok = await verifyTurnstile(c, turnstile_token, ip)
    if (!ok) return c.json({ ok: false, error: 'turnstile_failed' }, 403)
  }

  // Insertar lead
  await c.env.DB.prepare(
    `INSERT INTO leads (profile_slug, name, email, phone, message, source_url, user_agent, ip_hash)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
  ).bind(profile_slug, name, email, phone, message, source_url, ua, ip_hash).run()

  // Registrar rate token
  await c.env.DB.prepare(
    `INSERT INTO lead_rate_limits (profile_slug, ip_hash) VALUES (?1, ?2)`
  ).bind(profile_slug, ip_hash).run()

  return c.json({ ok: true }, 201)
})

async function verifyTurnstile(c: any, token: string, ip: string): Promise<boolean> {
  const secret = (c.env as any).TURNSTILE_SECRET
  if (!secret) return false

  const form = new FormData()
  form.append('secret', secret)
  form.append('response', token)
  if (ip) form.append('remoteip', ip)

  const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: form,
  })

  // ✅ Fix TS: tipa como any para permitir data.success
  const data: any = await resp.json().catch(() => null)
  return !!(data && data.success)
}

async function sha256Base64Url(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  const bytes = new Uint8Array(hash)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

// Admin
app.get('/api/v1/admin/profiles', requireAdmin, async (c) => {
  const profiles = await c.env.DB.prepare(
    `SELECT p.id, p.slug, p.plan_id, p.is_published, u.email FROM profiles p JOIN users u ON p.user_id = u.id`
  ).all()
  return c.json({ ok: true, data: profiles.results })
})

app.post('/api/v1/admin/activate-module', async (c) => {
  const { profileId, moduleCode, secret } = await c.req.json()
  if (secret !== 'intap_master_key') return c.json({ ok: false, error: 'Unauthorized' }, 401)
  await c.env.DB.prepare(
    `INSERT INTO profile_modules (profile_id, module_code, expires_at) 
     VALUES (?, ?, datetime('now', '+1 year')) 
     ON CONFLICT(profile_id, module_code) DO UPDATE SET expires_at = excluded.expires_at`
  )
    .bind(profileId, moduleCode)
    .run()
  return c.json({ ok: true, message: `Módulo ${moduleCode} activado` })
})

export default app