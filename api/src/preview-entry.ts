import app from './index'
import { cookieNames } from './lib/cookies'

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
}

function parseCookie(header: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = header.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

async function requirePreviewAuth(c: any, next: any) {
  const rawSession = parseCookie(
    c.req.header('Cookie') || '',
    cookieNames(c.env).session,
  )

  if (!rawSession) {
    return c.json({ ok: false, error: 'Unauthorized' }, 401)
  }

  const sessionHash = await sha256Hex(rawSession)
  const session = await c.env.DB.prepare(
    `SELECT user_id
       FROM auth_sessions
      WHERE session_hash = ?
        AND expires_at > datetime('now')
        AND revoked_at IS NULL
      LIMIT 1`,
  ).bind(sessionHash).first()

  if (!session) {
    return c.json({ ok: false, error: 'Unauthorized' }, 401)
  }

  c.set('userId', (session as any).user_id)
  await next()
}

function isUploadFile(value: unknown): value is File {
  return !!(
    value &&
    typeof value === 'object' &&
    'name' in value &&
    'stream' in value
  )
}

const ALLOWED_IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp'])
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

function validateImage(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase() || ''

  if (!ALLOWED_IMAGE_EXTS.has(ext)) {
    return 'Formato no permitido. Usa JPG, PNG o WebP.'
  }

  if (!file.type.startsWith('image/')) {
    return 'El archivo debe ser una imagen.'
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return 'La imagen optimizada supera el límite de 5 MB.'
  }

  return null
}

function publicAssetUrl(c: any, key: string) {
  const origin = new URL(c.req.url).origin
  const encoded = key.split('/').map(encodeURIComponent).join('/')
  return `${origin}/api/v1/public/assets/${encoded}`
}

function ownAssetKeyFromUrl(value: string | null | undefined): string | null {
  if (!value) return null

  try {
    const url = new URL(value)
    const marker = '/api/v1/public/assets/'
    const index = url.pathname.indexOf(marker)
    if (index < 0) return null
    return decodeURIComponent(url.pathname.slice(index + marker.length))
  } catch {
    return null
  }
}

async function deleteR2Prefix(bucket: R2Bucket, prefix: string) {
  let cursor: string | undefined
  do {
    const page = await bucket.list({ prefix, cursor })
    const keys = page.objects.map((object) => object.key)
    if (keys.length > 0) await bucket.delete(keys)
    cursor = page.truncated ? page.cursor : undefined
  } while (cursor)
}

app.delete('/api/v1/me/gallery/:id', requirePreviewAuth, async (c: any) => {
  const userId = c.get('userId') as string
  const galleryId = c.req.param('id')

  const row = await c.env.DB.prepare(
    `SELECT g.image_key
       FROM profile_gallery g
       JOIN profiles p ON p.id = g.profile_id
      WHERE g.id = ? AND p.user_id = ?
      LIMIT 1`,
  ).bind(galleryId, userId).first()

  if (!row) {
    return c.json({ ok: false, error: 'Imagen no encontrada' }, 404)
  }

  await c.env.DB.prepare(
    `DELETE FROM profile_gallery
      WHERE id = ?
        AND profile_id = (SELECT id FROM profiles WHERE user_id = ? LIMIT 1)`,
  ).bind(galleryId, userId).run()

  const key = String((row as any).image_key || '')
  if (key) {
    await c.env.BUCKET.delete(key).catch(() => undefined)
  }

  return c.json({ ok: true })
})

app.post('/api/v1/me/gallery/:id/replace', requirePreviewAuth, async (c: any) => {
  const userId = c.get('userId') as string
  const galleryId = c.req.param('id')
  const fd = await c.req.formData()
  const fileValue = fd.get('file')

  if (!isUploadFile(fileValue)) {
    return c.json({ ok: false, error: 'Archivo requerido' }, 400)
  }

  const validationError = validateImage(fileValue)
  if (validationError) {
    return c.json({ ok: false, error: validationError }, 400)
  }

  const row = await c.env.DB.prepare(
    `SELECT g.image_key, g.profile_id
       FROM profile_gallery g
       JOIN profiles p ON p.id = g.profile_id
      WHERE g.id = ? AND p.user_id = ?
      LIMIT 1`,
  ).bind(galleryId, userId).first()

  if (!row) {
    return c.json({ ok: false, error: 'Imagen no encontrada' }, 404)
  }

  const profileId = String((row as any).profile_id)
  const oldKey = String((row as any).image_key || '')
  const ext = fileValue.name.split('.').pop()?.toLowerCase() || 'webp'
  const key = `profiles/${profileId}/${crypto.randomUUID()}.${ext}`

  await c.env.BUCKET.put(key, fileValue.stream(), {
    httpMetadata: { contentType: fileValue.type || 'image/webp' },
  })

  await c.env.DB.prepare(
    `UPDATE profile_gallery SET image_key = ? WHERE id = ? AND profile_id = ?`,
  ).bind(key, galleryId, profileId).run()

  if (oldKey && oldKey !== key) {
    await c.env.BUCKET.delete(oldKey).catch(() => undefined)
  }

  return c.json({
    ok: true,
    key,
    image_url: publicAssetUrl(c, key),
  })
})

app.post('/api/v1/me/products/:id/image', requirePreviewAuth, async (c: any) => {
  const userId = c.get('userId') as string
  const productId = c.req.param('id')
  const fd = await c.req.formData()
  const fileValue = fd.get('file')

  if (!isUploadFile(fileValue)) {
    return c.json({ ok: false, error: 'Archivo requerido' }, 400)
  }

  const validationError = validateImage(fileValue)
  if (validationError) {
    return c.json({ ok: false, error: validationError }, 400)
  }

  const row = await c.env.DB.prepare(
    `SELECT pr.profile_id, pr.image_url
       FROM profile_products pr
       JOIN profiles p ON p.id = pr.profile_id
      WHERE pr.id = ? AND p.user_id = ?
      LIMIT 1`,
  ).bind(productId, userId).first()

  if (!row) {
    return c.json({ ok: false, error: 'Servicio no encontrado' }, 404)
  }

  const profileId = String((row as any).profile_id)
  const oldKey = ownAssetKeyFromUrl((row as any).image_url)
  const ext = fileValue.name.split('.').pop()?.toLowerCase() || 'webp'
  const key = `service-images/${profileId}/${productId}/${crypto.randomUUID()}.${ext}`

  await c.env.BUCKET.put(key, fileValue.stream(), {
    httpMetadata: { contentType: fileValue.type || 'image/webp' },
  })

  const imageUrl = publicAssetUrl(c, key)

  await c.env.DB.prepare(
    `UPDATE profile_products SET image_url = ? WHERE id = ? AND profile_id = ?`,
  ).bind(imageUrl, productId, profileId).run()

  if (oldKey && oldKey !== key) {
    await c.env.BUCKET.delete(oldKey).catch(() => undefined)
  }

  return c.json({ ok: true, image_url: imageUrl })
})

app.delete('/api/v1/me/products/:id/image', requirePreviewAuth, async (c: any) => {
  const userId = c.get('userId') as string
  const productId = c.req.param('id')

  const row = await c.env.DB.prepare(
    `SELECT pr.profile_id, pr.image_url
       FROM profile_products pr
       JOIN profiles p ON p.id = pr.profile_id
      WHERE pr.id = ? AND p.user_id = ?
      LIMIT 1`,
  ).bind(productId, userId).first()

  if (!row) {
    return c.json({ ok: false, error: 'Servicio no encontrado' }, 404)
  }

  const profileId = String((row as any).profile_id)
  const oldKey = ownAssetKeyFromUrl((row as any).image_url)

  await c.env.DB.prepare(
    `UPDATE profile_products SET image_url = NULL WHERE id = ? AND profile_id = ?`,
  ).bind(productId, profileId).run()

  if (oldKey) {
    await c.env.BUCKET.delete(oldKey).catch(() => undefined)
  }

  return c.json({ ok: true })
})

// Preview-only safety endpoint while the destructive flow is validated.
// Deletes the user's profile and its cascaded content, but never deletes the account.
// Physical artifacts remain owned by the same user and are detached from the deleted profile.
app.delete('/api/v1/me/profile', requirePreviewAuth, async (c: any) => {
  const userId = c.get('userId') as string
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Confirmación requerida.' }, 400) }

  const row = await c.env.DB.prepare(
    `SELECT p.id AS profile_id, p.slug, u.email
       FROM profiles p
       JOIN users u ON u.id = p.user_id
      WHERE p.user_id = ?
      LIMIT 1`,
  ).bind(userId).first()

  if (!row) return c.json({ ok: false, error: 'No tienes un perfil para eliminar.' }, 404)

  const profileId = String((row as any).profile_id || '')
  const slug = String((row as any).slug || '').trim()
  const email = String((row as any).email || '').trim().toLowerCase()
  const confirmSlug = String(body?.confirm_slug || '').trim()
  const confirmEmail = String(body?.confirm_email || '').trim().toLowerCase()
  const expectedPhrase = `ELIMINAR ${slug}`

  if (confirmEmail !== email || confirmSlug !== expectedPhrase) {
    return c.json({ ok: false, error: `Para confirmar escribe exactamente “${expectedPhrase}” y tu correo de acceso.` }, 400)
  }

  // Make the profile unreachable before destructive cleanup.
  await c.env.DB.prepare(
    `UPDATE profiles SET is_published = 0 WHERE id = ? AND user_id = ?`,
  ).bind(profileId, userId).run()

  // Keep physical products owned by the account, but detach them from the profile being removed.
  await c.env.DB.prepare(
    `UPDATE intap_artifacts
        SET profile_id = NULL, updated_at = datetime('now')
      WHERE profile_id = ?`,
  ).bind(profileId).run()

  // Activation receipts are permanent audit records. Keep the receipt, but detach
  // its nullable profile reference before deleting the profile. Without this step,
  // artifact_activation_claims.profile_id (NO ACTION by schema) blocks the delete.
  await c.env.DB.prepare(
    `UPDATE artifact_activation_claims
        SET profile_id = NULL
      WHERE profile_id = ?`,
  ).bind(profileId).run()

  // Foreign-key cascades remove profile-owned relational content.
  await c.env.DB.prepare(
    `DELETE FROM profiles WHERE id = ? AND user_id = ?`,
  ).bind(profileId, userId).run()

  const stillExists = await c.env.DB.prepare(
    `SELECT id FROM profiles WHERE id = ? LIMIT 1`,
  ).bind(profileId).first()
  if (stillExists) return c.json({ ok: false, error: 'No se pudo completar la eliminación.' }, 500)

  // Best-effort media cleanup. A storage failure must not resurrect a deleted profile.
  await Promise.all([
    deleteR2Prefix(c.env.BUCKET, `profiles/${profileId}/`),
    deleteR2Prefix(c.env.BUCKET, `service-images/${profileId}/`),
  ]).catch((error) => console.error('[DELETE /me/profile] R2 cleanup:', error))

  return c.json({
    ok: true,
    deleted: { profile_id: profileId, slug },
    account_deleted: false,
    artifacts_detached: true,
  })
})

export default app
