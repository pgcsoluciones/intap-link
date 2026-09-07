import app from './index'
import { cookieNames } from './lib/cookies'

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function parseCookie(header: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = header.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

async function requireArtifactOwner(c: any, next: any) {
  const rawSession = parseCookie(c.req.header('Cookie') || '', cookieNames(c.env).session)
  if (!rawSession) return c.json({ ok: false, error: 'Unauthorized' }, 401)
  const sessionHash = await sha256Hex(rawSession)
  const session = await c.env.DB.prepare(
    `SELECT user_id FROM auth_sessions
      WHERE session_hash = ? AND expires_at > datetime('now') AND revoked_at IS NULL LIMIT 1`,
  ).bind(sessionHash).first()
  if (!session) return c.json({ ok: false, error: 'Unauthorized' }, 401)
  c.set('userId', String((session as any).user_id))
  await next()
}

async function ownedArtifact(c: any, artifactId: string, userId: string) {
  return c.env.DB.prepare(
    `SELECT id, public_code, product_type, status, profile_id
       FROM intap_artifacts WHERE id = ? AND owner_user_id = ? LIMIT 1`,
  ).bind(artifactId, userId).first()
}

async function teamMembership(c: any, artifactId: string, userId: string) {
  return c.env.DB.prepare(
    `SELECT id, status FROM team_members WHERE artifact_id = ? AND user_id = ? LIMIT 1`,
  ).bind(artifactId, userId).first().catch(() => null)
}

app.post('/api/v1/me/artifacts/:id/deactivate', requireArtifactOwner, async (c: any) => {
  const userId = c.get('userId') as string
  const artifactId = String(c.req.param('id') || '')
  const artifact = await ownedArtifact(c, artifactId, userId)
  if (!artifact) return c.json({ ok: false, error: 'Producto no encontrado.' }, 404)
  const status = String((artifact as any).status || '')
  if (status === 'revoked') return c.json({ ok: false, error: 'Este producto está revocado.' }, 409)
  if (status === 'suspended') return c.json({ ok: true, data: { status: 'suspended' } })
  if (status !== 'activated') return c.json({ ok: false, error: 'Este producto no está activo.' }, 409)

  const membership = await teamMembership(c, artifactId, userId)
  const statements = [
    c.env.DB.prepare(`UPDATE intap_artifacts SET status='suspended', updated_at=datetime('now') WHERE id=? AND owner_user_id=? AND status='activated'`).bind(artifactId, userId),
  ]
  if (membership) statements.push(c.env.DB.prepare(`UPDATE team_members SET status='inactive', updated_at=datetime('now') WHERE id=?`).bind(String((membership as any).id)))
  await c.env.DB.batch(statements)
  return c.json({ ok: true, data: { status: 'suspended', team_bound: Boolean(membership) } })
})

app.post('/api/v1/me/artifacts/:id/reactivate', requireArtifactOwner, async (c: any) => {
  const userId = c.get('userId') as string
  const artifactId = String(c.req.param('id') || '')
  const artifact = await ownedArtifact(c, artifactId, userId)
  if (!artifact) return c.json({ ok: false, error: 'Producto no encontrado.' }, 404)
  const status = String((artifact as any).status || '')
  const profileId = String((artifact as any).profile_id || '')
  if (status === 'revoked') return c.json({ ok: false, error: 'Este producto está revocado.' }, 409)
  if (!profileId) return c.json({ ok: false, error: 'Primero vincula este producto a un perfil.' }, 409)
  if (status === 'activated') return c.json({ ok: true, data: { status: 'activated' } })
  if (status !== 'suspended') return c.json({ ok: false, error: 'Este producto no puede reactivarse desde su estado actual.' }, 409)

  const profile = await c.env.DB.prepare(`SELECT id FROM profiles WHERE id=? AND user_id=? AND is_active=1 LIMIT 1`).bind(profileId, userId).first()
  if (!profile) return c.json({ ok: false, error: 'El perfil vinculado ya no está disponible.' }, 409)
  const membership = await teamMembership(c, artifactId, userId)
  const statements = [
    c.env.DB.prepare(`UPDATE intap_artifacts SET status='activated', updated_at=datetime('now') WHERE id=? AND owner_user_id=? AND status='suspended' AND profile_id=?`).bind(artifactId, userId, profileId),
  ]
  if (membership) statements.push(c.env.DB.prepare(`UPDATE team_members SET status='active', updated_at=datetime('now') WHERE id=?`).bind(String((membership as any).id)))
  await c.env.DB.batch(statements)
  return c.json({ ok: true, data: { status: 'activated', team_bound: Boolean(membership) } })
})

app.post('/api/v1/me/artifacts/:id/unlink', requireArtifactOwner, async (c: any) => {
  const userId = c.get('userId') as string
  const artifactId = String(c.req.param('id') || '')
  const artifact = await ownedArtifact(c, artifactId, userId)
  if (!artifact) return c.json({ ok: false, error: 'Producto no encontrado.' }, 404)
  if (await teamMembership(c, artifactId, userId)) {
    return c.json({ ok: false, error: 'Este producto pertenece a un Team y no puede desvincularse como producto independiente.' }, 409)
  }
  const status = String((artifact as any).status || '')
  if (status === 'revoked') return c.json({ ok: false, error: 'Este producto está revocado.' }, 409)
  await c.env.DB.prepare(
    `UPDATE intap_artifacts SET profile_id=NULL, status=CASE WHEN status='revoked' THEN status ELSE 'suspended' END, updated_at=datetime('now') WHERE id=? AND owner_user_id=?`,
  ).bind(artifactId, userId).run()
  return c.json({ ok: true, data: { status: 'suspended', profile_id: null } })
})

app.post('/api/v1/me/artifacts/:id/link-current', requireArtifactOwner, async (c: any) => {
  const userId = c.get('userId') as string
  const artifactId = String(c.req.param('id') || '')
  const artifact = await ownedArtifact(c, artifactId, userId)
  if (!artifact) return c.json({ ok: false, error: 'Producto no encontrado.' }, 404)
  if (await teamMembership(c, artifactId, userId)) {
    return c.json({ ok: false, error: 'Este producto ya está vinculado a un Team.' }, 409)
  }
  const status = String((artifact as any).status || '')
  if (status === 'revoked') return c.json({ ok: false, error: 'Este producto está revocado.' }, 409)
  const profile = await c.env.DB.prepare(`SELECT id, slug FROM profiles WHERE user_id=? AND is_active=1 LIMIT 1`).bind(userId).first()
  if (!profile) return c.json({ ok: false, error: 'Primero necesitas un perfil activo.' }, 409)
  const profileId = String((profile as any).id)
  await c.env.DB.prepare(`UPDATE intap_artifacts SET profile_id=?, status='activated', updated_at=datetime('now') WHERE id=? AND owner_user_id=? AND status!='revoked'`).bind(profileId, artifactId, userId).run()
  return c.json({ ok: true, data: { status: 'activated', profile_id: profileId, profile_slug: String((profile as any).slug || '') } })
})

export default app
