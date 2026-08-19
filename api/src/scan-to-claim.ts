import app from './index'
import { cookieNames, buildScopedCookie, isPreviewEnvironment } from './lib/cookies'
import { isPublicCodeShape } from './artifacts'

const INTENT_TTL_SECONDS = 15 * 60

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function generateToken(bytes = 32): string {
  const array = new Uint8Array(bytes)
  crypto.getRandomValues(array)
  return Array.from(array).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function parseCookie(header: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = header.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function configuredAppUrl(c: any): string {
  const fallback = isPreviewEnvironment(c.env)
    ? 'https://app.preview.intaprd.com'
    : 'https://app.intaprd.com'
  return String(c.env.APP_URL || fallback).replace(/\/$/, '')
}

function configuredWebUrl(c: any): string {
  const fallback = isPreviewEnvironment(c.env)
    ? 'https://preview.intaprd.com'
    : 'https://intaprd.com'
  return String(c.env.WEB_URL || fallback).replace(/\/$/, '')
}

function activationIntentCookie(c: any, token: string, maxAge = INTENT_TTL_SECONDS): string {
  return buildScopedCookie(
    c.env,
    configuredAppUrl(c),
    cookieNames(c.env).activationIntent,
    token,
    maxAge,
  )
}

async function sessionUserId(c: any): Promise<string | null> {
  const rawSession = parseCookie(c.req.header('Cookie') || '', cookieNames(c.env).session)
  if (!rawSession) return null
  const sessionHash = await sha256Hex(rawSession)
  const session = await c.env.DB.prepare(
    `SELECT user_id FROM auth_sessions
      WHERE session_hash = ?
        AND expires_at > datetime('now')
        AND revoked_at IS NULL
      LIMIT 1`,
  ).bind(sessionHash).first()
  return session ? String((session as any).user_id) : null
}

async function requireScanAuth(c: any, next: any) {
  const userId = await sessionUserId(c)
  if (!userId) return c.json({ ok: false, error: 'Unauthorized' }, 401)
  c.set('userId', userId)
  await next()
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

// Existing permanent product URL (/l/:publicCode) calls this endpoint.
// The public code identifies the physical item; the activation secret never
// leaves the server. The server creates the same one-time activation intent
// used by the existing security model.
app.post('/api/v1/public/artifacts/scan/start', async (c: any) => {
  let body: any = {}
  try { body = await c.req.json() } catch {
    return c.json({ ok: false, error: 'Solicitud inválida.' }, 400)
  }

  const publicCode = String(body?.public_code || '').trim().toUpperCase()
  if (!isPublicCodeShape(publicCode)) {
    return c.json({ ok: false, error: 'Producto no válido.' }, 400)
  }

  const artifact = await c.env.DB.prepare(
    `SELECT a.id, a.public_code, a.product_type, a.status,
            a.owner_user_id, a.profile_id, p.slug AS profile_slug
       FROM intap_artifacts a
       LEFT JOIN profiles p ON p.id = a.profile_id
      WHERE a.public_code = ?
      LIMIT 1`,
  ).bind(publicCode).first()

  if (!artifact) return c.json({ ok: false, error: 'Producto no encontrado.' }, 404)

  const status = String((artifact as any).status || '')
  const profileSlug = String((artifact as any).profile_slug || '').trim()

  if (status === 'activated' && profileSlug) {
    return c.json({
      ok: true,
      state: 'activated',
      next: 'profile',
      next_url: `${configuredWebUrl(c)}/${encodeURIComponent(profileSlug)}`,
    })
  }

  if (status === 'suspended' || status === 'revoked') {
    return c.json({ ok: false, error: 'Este producto no está disponible. Contacta soporte.' }, 409)
  }

  if ((artifact as any).owner_user_id || !['available', 'unassigned'].includes(status)) {
    return c.json({ ok: false, error: 'Este producto ya no está disponible para activación.' }, 409)
  }

  const activationCode = await c.env.DB.prepare(
    `SELECT id
       FROM artifact_activation_codes
      WHERE artifact_id = ?
        AND status = 'active'
        AND (expires_at IS NULL OR expires_at > datetime('now'))
      ORDER BY created_at DESC, id DESC
      LIMIT 1`,
  ).bind(String((artifact as any).id)).first()

  if (!activationCode) {
    return c.json({ ok: false, error: 'Este producto todavía no está habilitado para activación.' }, 409)
  }

  const artifactId = String((artifact as any).id)
  const activationCodeId = String((activationCode as any).id)
  const intentRaw = generateToken(32)
  const intentHash = await sha256Hex(intentRaw)
  const intentId = crypto.randomUUID()
  const now = new Date().toISOString().replace('T', ' ').replace('Z', '')

  try {
    await c.env.DB.batch([
      c.env.DB.prepare(
        `UPDATE artifact_activation_intents
            SET status = 'revoked', revoked_at = ?
          WHERE artifact_id = ?
            AND status = 'active'`,
      ).bind(now, artifactId),
      c.env.DB.prepare(
        `INSERT INTO artifact_activation_intents
          (id, intent_hash, artifact_id, activation_code_id, status, expires_at, created_at)
         VALUES (?, ?, ?, ?, 'active', datetime(?, '+15 minutes'), ?)`,
      ).bind(intentId, intentHash, artifactId, activationCodeId, now, now),
    ])
  } catch (error) {
    console.error('[scan/start] intent creation failed', error)
    return c.json({ ok: false, error: 'No pudimos preparar la activación. Intenta nuevamente.' }, 500)
  }

  const userId = await sessionUserId(c)
  const appUrl = configuredAppUrl(c)
  const nextUrl = userId
    ? `${appUrl}/admin/artifacts/activate?scan=1`
    : `${appUrl}/admin/login?activation=scan`

  return c.json({
    ok: true,
    state: 'ready',
    next: userId ? 'confirm' : 'login',
    next_url: nextUrl,
    artifact: {
      public_code: publicCode,
      product_type: String((artifact as any).product_type || 'other'),
      label: productLabel(String((artifact as any).product_type || 'other')),
    },
  }, 200, {
    'Set-Cookie': activationIntentCookie(c, intentRaw),
  })
})

app.get('/api/v1/me/artifacts/scan/pending', requireScanAuth, async (c: any) => {
  const rawIntent = parseCookie(c.req.header('Cookie') || '', cookieNames(c.env).activationIntent)
  if (!rawIntent) return c.json({ ok: false, error: 'No hay una activación pendiente.' }, 404)

  const intentHash = await sha256Hex(rawIntent)
  const row = await c.env.DB.prepare(
    `SELECT i.id AS intent_id, i.artifact_id, i.activation_code_id,
            a.public_code, a.product_type, a.status
       FROM artifact_activation_intents i
       JOIN intap_artifacts a ON a.id = i.artifact_id
       JOIN artifact_activation_codes ac ON ac.id = i.activation_code_id
      WHERE i.intent_hash = ?
        AND i.status = 'active'
        AND i.revoked_at IS NULL
        AND i.expires_at > datetime('now')
        AND ac.status = 'active'
        AND (ac.expires_at IS NULL OR ac.expires_at > datetime('now'))
        AND a.owner_user_id IS NULL
        AND a.status IN ('available', 'unassigned')
      LIMIT 1`,
  ).bind(intentHash).first()

  if (!row) return c.json({ ok: false, error: 'La activación expiró o el producto ya no está disponible.' }, 404)

  const userId = c.get('userId') as string
  const user = await c.env.DB.prepare(
    `SELECT email FROM users WHERE id = ? LIMIT 1`,
  ).bind(userId).first()
  const profile = await c.env.DB.prepare(
    `SELECT id, slug FROM profiles WHERE user_id = ? LIMIT 1`,
  ).bind(userId).first()

  return c.json({
    ok: true,
    data: {
      public_code: String((row as any).public_code),
      product_type: String((row as any).product_type || 'other'),
      label: productLabel(String((row as any).product_type || 'other')),
      email: String((user as any)?.email || ''),
      has_profile: !!profile,
      profile_slug: profile ? String((profile as any).slug || '') : null,
    },
  })
})

app.post('/api/v1/me/artifacts/scan/confirm', requireScanAuth, async (c: any) => {
  const userId = c.get('userId') as string
  const rawIntent = parseCookie(c.req.header('Cookie') || '', cookieNames(c.env).activationIntent)
  if (!rawIntent) return c.json({ ok: false, error: 'No hay una activación pendiente.' }, 404)

  const intentHash = await sha256Hex(rawIntent)
  const candidate = await c.env.DB.prepare(
    `SELECT i.id AS intent_id, i.artifact_id, i.activation_code_id,
            a.public_code, a.product_type
       FROM artifact_activation_intents i
       JOIN intap_artifacts a ON a.id = i.artifact_id
       JOIN artifact_activation_codes ac ON ac.id = i.activation_code_id
      WHERE i.intent_hash = ?
        AND i.status = 'active'
        AND i.revoked_at IS NULL
        AND i.expires_at > datetime('now')
        AND ac.status = 'active'
        AND (ac.expires_at IS NULL OR ac.expires_at > datetime('now'))
        AND a.owner_user_id IS NULL
        AND a.status IN ('available', 'unassigned')
      LIMIT 1`,
  ).bind(intentHash).first()

  if (!candidate) {
    return c.json({ ok: false, error: 'La activación expiró o el producto ya fue utilizado.' }, 409)
  }

  let profile = await c.env.DB.prepare(
    `SELECT id, slug FROM profiles WHERE user_id = ? LIMIT 1`,
  ).bind(userId).first()

  const needsProfile = !profile
  const profileId = profile ? String((profile as any).id) : crypto.randomUUID()
  const temporarySlug = profile
    ? String((profile as any).slug || '')
    : `kawvo-${generateToken(8).slice(0, 12)}`.toLowerCase()

  const artifactId = String((candidate as any).artifact_id)
  const activationCodeId = String((candidate as any).activation_code_id)
  const claimAt = new Date().toISOString().replace('T', ' ').replace('Z', '')

  const statements: any[] = []
  if (needsProfile) {
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO profiles
          (id, user_id, slug, plan_id, theme_id, layout_id, is_published)
         SELECT ?, ?, ?, 'free', 'default', 'esencial', 0
          WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = ?)`,
      ).bind(profileId, userId, temporarySlug, userId),
    )
  }

  statements.push(
    c.env.DB.prepare(
      `UPDATE intap_artifacts
          SET owner_user_id = ?, profile_id = ?, status = 'activated',
              activated_at = ?, updated_at = ?
        WHERE id = ?
          AND owner_user_id IS NULL
          AND status IN ('available', 'unassigned')
          AND EXISTS (
            SELECT 1 FROM artifact_activation_intents i
             WHERE i.intent_hash = ?
               AND i.artifact_id = intap_artifacts.id
               AND i.activation_code_id = ?
               AND i.status = 'active'
               AND i.revoked_at IS NULL
               AND i.expires_at > ?
          )
          AND EXISTS (
            SELECT 1 FROM profiles p
             WHERE p.id = ? AND p.user_id = ? AND p.is_active = 1
          )`,
    ).bind(
      userId, profileId, claimAt, claimAt, artifactId,
      intentHash, activationCodeId, claimAt,
      profileId, userId,
    ),
    c.env.DB.prepare(
      `UPDATE artifact_activation_codes
          SET status = 'used', used_at = ?
        WHERE id = ?
          AND artifact_id = ?
          AND status = 'active'
          AND (expires_at IS NULL OR expires_at > ?)
          AND EXISTS (
            SELECT 1 FROM intap_artifacts a
             WHERE a.id = ?
               AND a.owner_user_id = ?
               AND a.profile_id = ?
               AND a.status = 'activated'
               AND a.activated_at = ?
          )`,
    ).bind(claimAt, activationCodeId, artifactId, claimAt, artifactId, userId, profileId, claimAt),
    c.env.DB.prepare(
      `UPDATE artifact_activation_intents
          SET status = 'consumed', consumed_at = ?
        WHERE intent_hash = ?
          AND artifact_id = ?
          AND activation_code_id = ?
          AND status = 'active'
          AND revoked_at IS NULL
          AND expires_at > ?
          AND EXISTS (
            SELECT 1 FROM artifact_activation_codes ac
             WHERE ac.id = ? AND ac.status = 'used' AND ac.used_at = ?
          )`,
    ).bind(claimAt, intentHash, artifactId, activationCodeId, claimAt, activationCodeId, claimAt),
    c.env.DB.prepare(
      `INSERT INTO artifact_activation_claims
        (intent_hash, artifact_id, activation_code_id, user_id, profile_id, claim_at, ok)
       VALUES (?, ?, ?, ?, ?, ?, CASE WHEN EXISTS (
         SELECT 1
           FROM intap_artifacts a
           JOIN artifact_activation_codes ac ON ac.id = ? AND ac.artifact_id = a.id
           JOIN artifact_activation_intents i ON i.intent_hash = ? AND i.artifact_id = a.id
          WHERE a.id = ?
            AND a.owner_user_id = ?
            AND a.profile_id = ?
            AND a.status = 'activated'
            AND a.activated_at = ?
            AND ac.status = 'used'
            AND ac.used_at = ?
            AND i.status = 'consumed'
            AND i.consumed_at = ?
       ) THEN 1 ELSE 0 END)`,
    ).bind(
      intentHash, artifactId, activationCodeId, userId, profileId, claimAt,
      activationCodeId, intentHash, artifactId, userId, profileId,
      claimAt, claimAt, claimAt,
    ),
  )

  try {
    await c.env.DB.batch(statements)
  } catch (error) {
    console.error('[scan/confirm] atomic claim rejected', error)
    return c.json({ ok: false, error: 'No se pudo completar la activación. El producto no fue consumido; vuelve a intentarlo.' }, 409)
  }

  profile = await c.env.DB.prepare(
    `SELECT id, slug FROM profiles WHERE id = ? AND user_id = ? LIMIT 1`,
  ).bind(profileId, userId).first()

  return c.json({
    ok: true,
    data: {
      public_code: String((candidate as any).public_code),
      product_type: String((candidate as any).product_type || 'other'),
      profile_id: profileId,
      profile_slug: profile ? String((profile as any).slug || temporarySlug) : temporarySlug,
      next_url: `${configuredAppUrl(c)}/admin/free`,
    },
  }, 201, {
    'Set-Cookie': activationIntentCookie(c, '', 0),
  })
})
