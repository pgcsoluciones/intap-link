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

async function sessionUserId(c: any): Promise<string | null> {
  const raw = parseCookie(c.req.header('Cookie') || '', cookieNames(c.env).session)
  if (!raw) return null
  const row = await c.env.DB.prepare(
    `SELECT user_id FROM auth_sessions
      WHERE session_hash = ? AND expires_at > datetime('now') AND revoked_at IS NULL
      LIMIT 1`,
  ).bind(await sha256Hex(raw)).first()
  return row ? String((row as any).user_id || '') : null
}

async function requireTeamNameAuth(c: any, next: any) {
  const userId = await sessionUserId(c)
  if (!userId) return c.json({ ok: false, error: 'Unauthorized' }, 401)
  c.set('userId', userId)
  await next()
}

function normalizeTeamName(value: unknown) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 80)
}

// El master define el nombre humano del Team. El nombre es independiente del
// nombre del perfil principal y es el que se muestra al validar un código.
app.put('/api/v1/me/team/name', requireTeamNameAuth, async (c: any) => {
  const userId = c.get('userId') as string
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Solicitud inválida.' }, 400) }

  const name = normalizeTeamName(body.name)
  if (name.length < 2) return c.json({ ok: false, error: 'El nombre del Team debe tener al menos 2 caracteres.' }, 400)

  const team = await c.env.DB.prepare(
    `SELECT id FROM team_workspaces WHERE owner_user_id = ? LIMIT 1`,
  ).bind(userId).first()
  if (!team) return c.json({ ok: false, error: 'Team no encontrado.' }, 404)

  await c.env.DB.prepare(
    `UPDATE team_workspaces SET name = ?, updated_at = datetime('now') WHERE id = ? AND owner_user_id = ?`,
  ).bind(name, String((team as any).id), userId).run()

  return c.json({ ok: true, data: { team_id: String((team as any).id), name } })
})

// Contexto autenticado del nombre: sirve tanto al master como a un miembro.
app.get('/api/v1/me/team/name', requireTeamNameAuth, async (c: any) => {
  const userId = c.get('userId') as string
  const row = await c.env.DB.prepare(
    `SELECT tw.id AS team_id, tw.name AS team_name, mp.name AS master_name, mp.slug AS master_slug,
            CASE WHEN tw.owner_user_id = ? THEN 'master' ELSE 'member' END AS role
       FROM team_workspaces tw
       JOIN profiles mp ON mp.id = tw.master_profile_id
       LEFT JOIN team_members tm ON tm.team_id = tw.id AND tm.user_id = ?
      WHERE tw.owner_user_id = ? OR tm.user_id = ?
      LIMIT 1`,
  ).bind(userId, userId, userId, userId).first()

  if (!row) return c.json({ ok: false, error: 'Team no encontrado.' }, 404)
  return c.json({ ok: true, data: {
    team_id: String((row as any).team_id),
    team_name: String((row as any).team_name || ''),
    master_name: String((row as any).master_name || ''),
    master_slug: String((row as any).master_slug || ''),
    role: String((row as any).role || ''),
  } })
})

// Se consulta solo después de que /public/team/code/inspect validó el código y
// devolvió team_id. No expone miembros, permisos ni información privada.
app.post('/api/v1/public/team/name', async (c: any) => {
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Solicitud inválida.' }, 400) }
  const teamId = String(body.team_id || '').trim()
  if (!teamId) return c.json({ ok: false, error: 'Team no identificado.' }, 400)

  const row = await c.env.DB.prepare(
    `SELECT tw.id AS team_id, tw.name AS team_name, mp.name AS master_name, mp.slug AS master_slug
       FROM team_workspaces tw
       JOIN profiles mp ON mp.id = tw.master_profile_id
      WHERE tw.id = ? AND tw.status = 'active'
      LIMIT 1`,
  ).bind(teamId).first()

  if (!row) return c.json({ ok: false, error: 'Team no disponible.' }, 404)
  return c.json({ ok: true, data: {
    team_id: String((row as any).team_id),
    team_name: String((row as any).team_name || (row as any).master_name || 'Mi Team'),
    master_name: String((row as any).master_name || ''),
    master_slug: String((row as any).master_slug || ''),
  } })
})

export default app
