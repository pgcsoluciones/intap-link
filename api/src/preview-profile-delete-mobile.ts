import app from './preview-entry'
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
  const rawSession = parseCookie(c.req.header('Cookie') || '', cookieNames(c.env).session)
  if (!rawSession) return c.json({ ok: false, error: 'Unauthorized' }, 401)

  const sessionHash = await sha256Hex(rawSession)
  const session = await c.env.DB.prepare(
    `SELECT user_id
       FROM auth_sessions
      WHERE session_hash = ?
        AND expires_at > datetime('now')
        AND revoked_at IS NULL
      LIMIT 1`,
  ).bind(sessionHash).first()

  if (!session) return c.json({ ok: false, error: 'Unauthorized' }, 401)
  c.set('userId', (session as any).user_id)
  await next()
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

// Preview-only compatibility endpoint for mobile/PWA clients.
// It deliberately uses POST so confirmation data does not depend on a DELETE request body.
// The legacy DELETE /api/v1/me/profile remains available while this path is validated.
app.post('/api/v1/me/profile/delete', requirePreviewAuth, async (c: any) => {
  const userId = c.get('userId') as string
  let body: any = {}
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, error: 'Confirmación requerida.' }, 400)
  }

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
    return c.json({
      ok: false,
      error: `Para confirmar escribe exactamente “${expectedPhrase}” y tu correo de acceso.`,
    }, 400)
  }

  await c.env.DB.prepare(
    `UPDATE profiles SET is_published = 0 WHERE id = ? AND user_id = ?`,
  ).bind(profileId, userId).run()

  await c.env.DB.prepare(
    `UPDATE intap_artifacts
        SET profile_id = NULL, updated_at = datetime('now')
      WHERE profile_id = ?`,
  ).bind(profileId).run()

  await c.env.DB.prepare(
    `UPDATE artifact_activation_claims
        SET profile_id = NULL
      WHERE profile_id = ?`,
  ).bind(profileId).run()

  // profile_products was created without ON DELETE CASCADE in the historical schema.
  // Delete these rows explicitly so any profile with services/products can be removed.
  await c.env.DB.prepare(
    `DELETE FROM profile_products WHERE profile_id = ?`,
  ).bind(profileId).run()

  await c.env.DB.prepare(
    `DELETE FROM profiles WHERE id = ? AND user_id = ?`,
  ).bind(profileId, userId).run()

  const stillExists = await c.env.DB.prepare(
    `SELECT id FROM profiles WHERE id = ? LIMIT 1`,
  ).bind(profileId).first()

  if (stillExists) {
    return c.json({ ok: false, error: 'No se pudo completar la eliminación.' }, 500)
  }

  await Promise.all([
    deleteR2Prefix(c.env.BUCKET, `profiles/${profileId}/`),
    deleteR2Prefix(c.env.BUCKET, `service-images/${profileId}/`),
  ]).catch((error) => console.error('[POST /me/profile/delete] R2 cleanup:', error))

  return c.json({
    ok: true,
    deleted: { profile_id: profileId, slug },
    account_deleted: false,
    artifacts_detached: true,
    transport: 'post-mobile-safe',
  })
})

export default app
