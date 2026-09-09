import app from './index'
import { cookieNames } from './lib/cookies'

function normalizeCode(value: unknown) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '')
}

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
    `SELECT user_id FROM auth_sessions WHERE session_hash=? AND expires_at>datetime('now') AND revoked_at IS NULL LIMIT 1`,
  ).bind(await sha256Hex(raw)).first()
  return row ? String((row as any).user_id || '') : null
}

/**
 * Read-only authority preflight used by the public scan browser.
 * It never reserves, consumes, activates, publishes or mutates a Team/product.
 * The Team code identifies the Team; only the authenticated Master authorizes preparation.
 */
app.post('/api/v1/public/team/browser-authority', async (c: any) => {
  let body: any = {}
  try { body = await c.req.json() } catch {
    return c.json({ ok: false, error: 'Solicitud inválida.' }, 400)
  }

  const teamCode = normalizeCode(body.team_code)
  const publicCode = normalizeCode(body.public_code)
  if (!/^TEAM-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(teamCode) || !/^[A-Z2-9]{8,24}$/.test(publicCode)) {
    return c.json({ ok: false, error: 'Código Team o producto inválido.' }, 400)
  }

  const row = await c.env.DB.prepare(`
    SELECT tc.id code_id,tc.status code_status,tc.expires_at,tc.used_at,
           tw.id team_id,tw.name team_name,tw.owner_user_id,tw.master_profile_id,
           p.name master_name,
           a.id artifact_id,a.status artifact_status,a.owner_user_id artifact_owner_user_id,
           ac.id activation_code_id
      FROM team_link_codes tc
      JOIN team_workspaces tw ON tw.id=tc.team_id AND tw.status='active'
      JOIN profiles p ON p.id=tw.master_profile_id
      JOIN intap_artifacts a ON a.public_code=?
      LEFT JOIN artifact_activation_codes ac ON ac.id=(
        SELECT id FROM artifact_activation_codes
         WHERE artifact_id=a.id AND status='active'
           AND (expires_at IS NULL OR expires_at>datetime('now'))
         ORDER BY created_at DESC LIMIT 1
      )
     WHERE tc.code=?
     LIMIT 1
  `).bind(publicCode, teamCode).first()

  if (!row) return c.json({ ok: false, error: 'No pudimos validar este código Team para el producto.' }, 404)
  if ((row as any).used_at || String((row as any).code_status) === 'used') {
    return c.json({ ok: false, error: 'Este código Team ya fue utilizado.' }, 409)
  }
  if (String((row as any).code_status) === 'disabled') {
    return c.json({ ok: false, error: 'Este código Team está desactivado.' }, 409)
  }
  const expiresAt = String((row as any).expires_at || '')
  if (String((row as any).code_status) === 'expired' || (expiresAt && expiresAt <= new Date().toISOString().replace('T', ' ').slice(0, 19))) {
    return c.json({ ok: false, error: 'Este código Team caducó. Reactívalo o genera uno nuevo.' }, 410)
  }
  if ((row as any).artifact_owner_user_id || !['available', 'unassigned'].includes(String((row as any).artifact_status || '')) || !(row as any).activation_code_id) {
    return c.json({ ok: false, error: 'Este dispositivo ya no está disponible para vinculación.' }, 409)
  }

  const sessionUser = await sessionUserId(c)
  const ownerUserId = String((row as any).owner_user_id || '')
  const sessionState = !sessionUser
    ? 'signed_out'
    : sessionUser === ownerUserId
      ? 'master_verified'
      : 'different_account'

  return c.json({
    ok: true,
    data: {
      team_id: String((row as any).team_id),
      team_name: String((row as any).team_name || (row as any).master_name || 'Mi Team'),
      master_name: String((row as any).master_name || ''),
      public_code: publicCode,
      team_code: teamCode,
      session_state: sessionState,
      master_verified: sessionState === 'master_verified',
    },
  })
})
