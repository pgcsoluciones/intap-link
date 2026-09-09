import app from './index'
import { cookieNames } from './lib/cookies'

async function sha256Hex(input: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function parseCookie(header: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = header.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

async function requireMaster(c: any) {
  const raw = parseCookie(c.req.header('Cookie') || '', cookieNames(c.env).session)
  if (!raw) return null
  const session = await c.env.DB.prepare(
    `SELECT user_id FROM auth_sessions WHERE session_hash=? AND expires_at>datetime('now') AND revoked_at IS NULL LIMIT 1`,
  ).bind(await sha256Hex(raw)).first()
  if (!session) return null
  const userId = String((session as any).user_id || '')
  const team = await c.env.DB.prepare(
    `SELECT id FROM team_workspaces WHERE owner_user_id=? AND status='active' LIMIT 1`,
  ).bind(userId).first()
  return team ? { userId, teamId: String((team as any).id) } : null
}

app.post('/api/v1/me/team/codes/delete', async (c: any) => {
  const access = await requireMaster(c)
  if (!access) return c.json({ ok: false, error: 'Solo el Administrador Master puede eliminar códigos Team.' }, 403)

  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Solicitud inválida.' }, 400) }
  const code = String(body.code || '').trim().toUpperCase()
  if (!code) return c.json({ ok: false, error: 'Código requerido.' }, 400)

  const row = await c.env.DB.prepare(
    `SELECT id,status,used_at,used_by_user_id,member_profile_id FROM team_link_codes WHERE team_id=? AND code=? LIMIT 1`,
  ).bind(access.teamId, code).first()
  if (!row) return c.json({ ok: false, error: 'Código no encontrado.' }, 404)

  const used = Boolean((row as any).used_at || (row as any).used_by_user_id || (row as any).member_profile_id || ['used','assigned'].includes(String((row as any).status || '')))
  if (used) {
    return c.json({ ok: false, error: 'Un código ya asignado no puede eliminarse porque forma parte de la trazabilidad del miembro.' }, 409)
  }

  const result: any = await c.env.DB.prepare(
    `DELETE FROM team_link_codes WHERE id=? AND team_id=? AND used_at IS NULL AND used_by_user_id IS NULL AND member_profile_id IS NULL AND status NOT IN ('used','assigned')`,
  ).bind(String((row as any).id), access.teamId).run()
  if (Number(result?.meta?.changes || 0) < 1) return c.json({ ok: false, error: 'No pudimos eliminar este código.' }, 409)

  return c.json({ ok: true, data: { code } })
})
