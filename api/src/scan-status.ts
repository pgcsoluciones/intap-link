import app from './index'
import { cookieNames, isPreviewEnvironment } from './lib/cookies'
import { isPublicCodeShape } from './artifacts'

function configuredWebUrl(c: any): string {
  const fallback = isPreviewEnvironment(c.env)
    ? 'https://preview.intaprd.com'
    : 'https://intaprd.com'
  return String(c.env.WEB_URL || fallback).replace(/\/$/, '')
}

function configuredAppUrl(c: any): string {
  const fallback = isPreviewEnvironment(c.env)
    ? 'https://app.preview.intaprd.com'
    : 'https://app.intaprd.com'
  return String(c.env.APP_URL || fallback).replace(/\/$/, '')
}

function parseCookie(header: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = header.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function sessionUserId(c: any): Promise<string | null> {
  const rawSession = parseCookie(
    c.req.header('Cookie') || '',
    cookieNames(c.env).session,
  )
  if (!rawSession) return null

  const sessionHash = await sha256Hex(rawSession)
  const session = await c.env.DB.prepare(
    `SELECT user_id
       FROM auth_sessions
      WHERE session_hash = ?
        AND expires_at > datetime('now')
        AND revoked_at IS NULL
      LIMIT 1`,
  ).bind(sessionHash).first()

  return session ? String((session as any).user_id) : null
}

function productLabel(type: string): string {
  const labels: Record<string, string> = {
    card: 'Tarjeta NFC',
    ping: 'Ping NFC',
    bracelet: 'Pulsera NFC',
    keychain: 'Llavero NFC',
    stand: 'Estación de Contacto',
    qr: 'Código QR',
    other: 'Producto Kawvo',
  }
  return labels[type] || labels.other
}

// Read-only preflight for the permanent /l/:publicCode URL.
// IMPORTANT: scanning alone must never create/revoke activation intents,
// consume an activation code, create a profile, or change ownership.
app.post('/api/v1/public/artifacts/scan/status', async (c: any) => {
  let body: any = {}
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, error: 'Solicitud inválida.' }, 400)
  }

  const publicCode = String(body?.public_code || '').trim().toUpperCase()
  if (!isPublicCodeShape(publicCode)) {
    return c.json({ ok: false, error: 'Producto no válido.' }, 400)
  }

  const artifact = await c.env.DB.prepare(
    `SELECT a.id, a.public_code, a.product_type, a.status,
            a.owner_user_id, a.profile_id,
            p.slug AS profile_slug,
            p.user_id AS profile_user_id,
            p.is_active AS profile_is_active,
            p.is_published AS profile_is_published
       FROM intap_artifacts a
       LEFT JOIN profiles p ON p.id = a.profile_id
      WHERE a.public_code = ?
      LIMIT 1`,
  ).bind(publicCode).first()

  if (!artifact) {
    return c.json({ ok: false, error: 'Producto no encontrado.' }, 404)
  }

  const artifactId = String((artifact as any).id)
  const status = String((artifact as any).status || '')
  const productType = String((artifact as any).product_type || 'other')
  const profileSlug = String((artifact as any).profile_slug || '').trim()
  const base = {
    public_code: publicCode,
    product_type: productType,
    label: productLabel(productType),
  }

  if (status === 'activated') {
    const profileIsActive = Number((artifact as any).profile_is_active) === 1
    const profileIsPublished = Number((artifact as any).profile_is_published) === 1

    if (profileSlug && profileIsActive && profileIsPublished) {
      return c.json({
        ok: true,
        state: 'activated',
        artifact: base,
        next_url: `${configuredWebUrl(c)}/${encodeURIComponent(profileSlug)}`,
      })
    }

    if (profileSlug && profileIsActive && !profileIsPublished) {
      const currentUserId = await sessionUserId(c)
      const ownerUserId = String((artifact as any).owner_user_id || '')
      const profileUserId = String((artifact as any).profile_user_id || '')
      const isOwner = Boolean(
        currentUserId &&
        (currentUserId === ownerUserId || currentUserId === profileUserId)
      )

      return c.json({
        ok: true,
        state: isOwner ? 'profile_draft_owner' : 'profile_draft',
        artifact: base,
        message: isOwner
          ? 'Tu producto está activo, pero tu Perfil Digital todavía está en construcción.'
          : 'Este Perfil Digital todavía está en construcción.',
        next_url: isOwner
          ? `${configuredAppUrl(c)}/admin/free`
          : null,
        login_url: isOwner
          ? null
          : `${configuredAppUrl(c)}/admin/login?resume_profile=1&public_code=${encodeURIComponent(publicCode)}`,
      })
    }

    return c.json({
      ok: true,
      state: 'unavailable',
      artifact: base,
      message: 'El Perfil Digital vinculado a este producto no está disponible actualmente.',
    })
  }

  if (status === 'suspended' || status === 'revoked') {
    return c.json({
      ok: true,
      state: 'blocked',
      artifact: base,
      message: 'Este producto no está disponible actualmente.',
    })
  }

  if ((artifact as any).owner_user_id || !['available', 'unassigned'].includes(status)) {
    return c.json({
      ok: true,
      state: 'unavailable',
      artifact: base,
      message: 'Este producto ya no está disponible para activación.',
    })
  }

  const activationCode = await c.env.DB.prepare(
    `SELECT id
       FROM artifact_activation_codes
      WHERE artifact_id = ?
        AND status = 'active'
        AND (expires_at IS NULL OR expires_at > datetime('now'))
      ORDER BY created_at DESC, id DESC
      LIMIT 1`,
  ).bind(artifactId).first()

  if (!activationCode) {
    return c.json({
      ok: true,
      state: 'not_ready',
      artifact: base,
      message: 'Este producto todavía no está habilitado para activación.',
    })
  }

  return c.json({
    ok: true,
    state: 'pending_activation',
    artifact: base,
  })
})

export default app
