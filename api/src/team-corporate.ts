import app from './index'
import { cookieNames } from './lib/cookies'

const ADMIN_ROLES = new Set(['member', 'editor', 'subadmin'])

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
  const row = await c.env.DB.prepare(`SELECT user_id FROM auth_sessions WHERE session_hash=? AND expires_at>datetime('now') AND revoked_at IS NULL LIMIT 1`).bind(await sha256Hex(raw)).first()
  return row ? String((row as any).user_id || '') : null
}

async function requireAuth(c: any, next: any) {
  const userId = await sessionUserId(c)
  if (!userId) return c.json({ ok: false, error: 'Unauthorized' }, 401)
  c.set('userId', userId)
  await next()
}

function normalizeCode(value: unknown) { return String(value || '').trim().toUpperCase().replace(/\s+/g, '') }
function cleanText(value: unknown, max = 120) { return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max) }

function randomPassword(length = 12) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%'
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join('')
}

function hex(bytes: Uint8Array) { return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('') }

async function hashPassword(password: string, saltHex?: string) {
  const salt = saltHex ? new Uint8Array((saltHex.match(/.{1,2}/g) || []).map((part) => parseInt(part, 16))) : crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, key, 256)
  return { salt: hex(salt), hash: hex(new Uint8Array(bits)) }
}

async function masterTeam(c: any, userId: string) {
  return c.env.DB.prepare(`SELECT tw.*,p.name master_name,p.slug master_slug,p.bio master_bio,p.category master_category,p.subcategory master_subcategory,p.theme_id master_theme_id,p.layout_id master_layout_id,p.free_palette_id master_palette_id,p.hero_url master_hero_url,p.template_data master_template_data FROM team_workspaces tw JOIN profiles p ON p.id=tw.master_profile_id WHERE tw.owner_user_id=? AND tw.status='active' LIMIT 1`).bind(userId).first()
}

async function validateCodeForTeam(c: any, teamId: string, code: string, publicCode: string) {
  const row = await c.env.DB.prepare(`SELECT tc.id,tc.status,tc.expires_at,tc.used_at,tc.permissions_json,a.id artifact_id,a.status artifact_status,a.owner_user_id artifact_owner_user_id,ac.id activation_code_id FROM team_link_codes tc JOIN intap_artifacts a ON a.public_code=? LEFT JOIN artifact_activation_codes ac ON ac.id=(SELECT id FROM artifact_activation_codes WHERE artifact_id=a.id AND status='active' AND (expires_at IS NULL OR expires_at>datetime('now')) ORDER BY created_at DESC LIMIT 1) WHERE tc.team_id=? AND tc.code=? LIMIT 1`).bind(publicCode,teamId,code).first()
  if (!row) return { error: 'Código Team no válido para este Team.', status: 404 }
  if ((row as any).used_at || String((row as any).status) === 'used') return { error: 'Este código Team ya fue utilizado.', status: 409 }
  if (String((row as any).status) === 'disabled') return { error: 'Este código Team está desactivado.', status: 409 }
  if (String((row as any).status) === 'expired' || String((row as any).expires_at || '') <= new Date().toISOString().replace('T',' ').slice(0,19)) return { error: 'Este código Team caducó. Reactívalo o genera uno nuevo.', status: 410 }
  if ((row as any).artifact_owner_user_id || !['available','unassigned'].includes(String((row as any).artifact_status || '')) || !(row as any).activation_code_id) return { error: 'Este dispositivo ya no está disponible para vinculación.', status: 409 }
  return { row }
}

app.get('/api/v1/me/team/corporate/prepare', requireAuth, async (c: any) => {
  const userId = c.get('userId') as string
  const team = await masterTeam(c, userId)
  if (!team) return c.json({ ok: false, error: 'Solo el Administrador Master puede preparar dispositivos Team.' }, 403)
  const code = normalizeCode(c.req.query('team_code'))
  const publicCode = normalizeCode(c.req.query('public_code'))
  const validated: any = await validateCodeForTeam(c, String((team as any).id), code, publicCode)
  if (validated.error) return c.json({ ok: false, error: validated.error }, validated.status)
  return c.json({ ok: true, data: {
    team_id: String((team as any).id),
    team_name: String((team as any).name || (team as any).master_name || 'Mi Team'),
    master_name: String((team as any).master_name || ''),
    public_code: publicCode,
    team_code: code,
    permissions: (() => { try { const p = JSON.parse(String((validated.row as any).permissions_json || '[]')); return Array.isArray(p) ? p : [] } catch { return [] } })(),
  } })
})

app.post('/api/v1/me/team/corporate/assign', requireAuth, async (c: any) => {
  const userId = c.get('userId') as string
  const team = await masterTeam(c, userId)
  if (!team) return c.json({ ok: false, error: 'Solo el Administrador Master puede preparar dispositivos Team.' }, 403)

  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Solicitud inválida.' }, 400) }
  const code = normalizeCode(body.team_code)
  const publicCode = normalizeCode(body.public_code)
  const name = cleanText(body.name, 100)
  const roleTitle = cleanText(body.role_title, 100)
  const phone = cleanText(body.phone, 40)
  const whatsapp = cleanText(body.whatsapp, 40)
  const email = cleanText(body.email, 180).toLowerCase()
  const accessRole = ADMIN_ROLES.has(String(body.access_role || 'member')) ? String(body.access_role || 'member') : 'member'
  const publishNow = body.publish_now !== false

  if (!name || !roleTitle) return c.json({ ok: false, error: 'Nombre y cargo son obligatorios para preparar el perfil Team.' }, 400)

  const validated: any = await validateCodeForTeam(c, String((team as any).id), code, publicCode)
  if (validated.error) return c.json({ ok: false, error: validated.error }, validated.status)
  const invite = validated.row as any

  if (accessRole === 'editor' || accessRole === 'subadmin') {
    const existing = await c.env.DB.prepare(`SELECT id FROM team_members WHERE team_id=? AND admin_role=? LIMIT 1`).bind(String((team as any).id), accessRole).first()
    if (existing) return c.json({ ok: false, error: accessRole === 'editor' ? 'Free permite un solo Editor por Team.' : 'Free permite un solo Subadministrador por Team.' }, 409)
  }

  const seatUserId = crypto.randomUUID()
  const profileId = crypto.randomUUID()
  const memberId = crypto.randomUUID()
  const slug = `team-${crypto.randomUUID().replace(/-/g,'').slice(0,10)}`
  const syntheticEmail = `seat-${seatUserId.replace(/-/g,'')}@team.internal.kawvo`
  let masterTemplate: any = {}
  try { masterTemplate = JSON.parse(String((team as any).master_template_data || '{}')) || {} } catch { masterTemplate = {} }
  const permissions = (() => { try { const p = JSON.parse(String(invite.permissions_json || '[]')); return Array.isArray(p) ? Array.from(new Set(['name','role',...p.map(String)])) : ['name','role'] } catch { return ['name','role'] } })()
  const templateData = { ...masterTemplate, role: roleTitle, free_identity_confirmed: true, team_member: true, team_id: String((team as any).id), team_master_profile_id: String((team as any).master_profile_id), team_permissions: permissions, team_access_role: accessRole, team_joined_at: new Date().toISOString() }

  const statements: any[] = [
    c.env.DB.prepare(`INSERT INTO users(id,email,created_at) VALUES(?,?,datetime('now'))`).bind(seatUserId,syntheticEmail),
    c.env.DB.prepare(`INSERT INTO profiles(id,user_id,slug,plan_id,theme_id,layout_id,name,bio,category,subcategory,free_palette_id,avatar_url,hero_url,template_data,is_published,created_at,updated_at) VALUES(?,?,?,'free',?,?,?,?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))`).bind(profileId,seatUserId,slug,String((team as any).master_theme_id || 'default'),String((team as any).master_layout_id || 'esencial'),name,String((team as any).master_bio || ''),String((team as any).master_category || ''),String((team as any).master_subcategory || ''),String((team as any).master_palette_id || ''),null,String((team as any).master_hero_url || ''),JSON.stringify(templateData),publishNow ? 1 : 0),
    c.env.DB.prepare(`INSERT INTO profile_contact(profile_id,whatsapp,email,phone,hours,address,map_url) SELECT ?,?,?,?,hours,address,map_url FROM profile_contact WHERE profile_id=?`).bind(profileId,whatsapp || null,email || null,phone || null,String((team as any).master_profile_id)),
    c.env.DB.prepare(`INSERT INTO team_members(id,team_id,user_id,profile_id,artifact_id,invite_code_id,status,permissions_json,admin_role,joined_at,updated_at) VALUES(?,?,?,?,?,?,'active',?,?,datetime('now'),datetime('now'))`).bind(memberId,String((team as any).id),seatUserId,profileId,String(invite.artifact_id),String(invite.id),JSON.stringify(permissions),accessRole),
    c.env.DB.prepare(`UPDATE intap_artifacts SET owner_user_id=?,profile_id=?,status='activated',activated_at=datetime('now'),updated_at=datetime('now') WHERE id=? AND owner_user_id IS NULL AND status IN('available','unassigned')`).bind(seatUserId,profileId,String(invite.artifact_id)),
    c.env.DB.prepare(`UPDATE artifact_activation_codes SET status='used',used_at=datetime('now') WHERE id=? AND status='active'`).bind(String(invite.activation_code_id)),
    c.env.DB.prepare(`UPDATE team_link_codes SET status='used',used_at=datetime('now'),used_by_user_id=NULL,artifact_id=?,member_profile_id=?,updated_at=datetime('now') WHERE id=? AND team_id=? AND used_at IS NULL`).bind(String(invite.artifact_id),profileId,String(invite.id),String((team as any).id)),
  ]

  let temporaryPassword = ''
  if (accessRole !== 'member') {
    temporaryPassword = randomPassword()
    const credential = await hashPassword(temporaryPassword)
    statements.push(c.env.DB.prepare(`INSERT INTO team_member_credentials(team_member_id,password_salt,password_hash,must_change_password,created_at,updated_at) VALUES(?,?,?,1,datetime('now'),datetime('now'))`).bind(memberId,credential.salt,credential.hash))
  }

  try { await c.env.DB.batch(statements) } catch (error) {
    console.error('[team/corporate/assign] failed', error)
    return c.json({ ok: false, error: 'No pudimos preparar este dispositivo. El código no fue consumido.' }, 409)
  }

  return c.json({ ok: true, data: {
    member_id: memberId,
    profile_id: profileId,
    slug,
    public_code: publicCode,
    team_name: String((team as any).name || ''),
    access_role: accessRole,
    status: publishNow ? 'published' : 'draft',
    temporary_password: temporaryPassword || null,
  } })
})

app.post('/api/v1/me/team/members/:id/reset-access', requireAuth, async (c: any) => {
  const userId = c.get('userId') as string
  const team = await masterTeam(c, userId)
  if (!team) return c.json({ ok: false, error: 'Solo el Administrador Master puede restablecer accesos.' }, 403)
  const member = await c.env.DB.prepare(`SELECT id,admin_role FROM team_members WHERE id=? AND team_id=? LIMIT 1`).bind(String(c.req.param('id') || ''),String((team as any).id)).first()
  if (!member) return c.json({ ok: false, error: 'Miembro no encontrado.' }, 404)
  if (!['editor','subadmin'].includes(String((member as any).admin_role || 'member'))) return c.json({ ok: false, error: 'Este miembro no tiene acceso administrativo.' }, 409)
  const temporaryPassword = randomPassword()
  const credential = await hashPassword(temporaryPassword)
  await c.env.DB.prepare(`INSERT INTO team_member_credentials(team_member_id,password_salt,password_hash,must_change_password,failed_attempts,locked_until,updated_at) VALUES(?,?,?,1,0,NULL,datetime('now')) ON CONFLICT(team_member_id) DO UPDATE SET password_salt=excluded.password_salt,password_hash=excluded.password_hash,must_change_password=1,failed_attempts=0,locked_until=NULL,updated_at=datetime('now')`).bind(String((member as any).id),credential.salt,credential.hash).run()
  return c.json({ ok: true, data: { temporary_password: temporaryPassword } })
})

export default app
