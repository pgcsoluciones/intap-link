import app from './index'
import { cookieNames } from './lib/cookies'
import { syncTeamMemberFromMaster } from './team-master-sync'

const ADMIN_ROLES = new Set(['member', 'editor', 'subadmin'])
const KDF_ITERATIONS = 50000

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
function readPermissions(raw: unknown): string[] {
  try {
    const parsed = JSON.parse(String(raw || '[]'))
    return Array.isArray(parsed) ? Array.from(new Set(['name', 'role', ...parsed.map(String)])) : ['name', 'role']
  } catch { return ['name', 'role'] }
}
function normalizeSlugBase(value: unknown) {
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'team'
}
function sameValue(a: unknown, b: unknown) { return String(a ?? '') === String(b ?? '') }
function readObject(raw: unknown): Record<string, any> {
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
  } catch { return {} }
}

async function nextTeamMemberSlug(c: any, team: any) {
  const base = normalizeSlugBase((team as any).master_slug)
  const rows = await c.env.DB.prepare(`
    SELECT p.slug
      FROM team_members tm
      JOIN profiles p ON p.id=tm.profile_id
     WHERE tm.team_id=? AND lower(p.slug) LIKE lower(?)
  `).bind(String((team as any).id), `${base}-%`).all()
  let max = 0
  for (const row of (rows.results || []) as any[]) {
    const match = String(row.slug || '').toLowerCase().match(new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)$`))
    if (match) max = Math.max(max, Number(match[1]) || 0)
  }
  let sequence = max + 1
  for (let guard = 0; guard < 1000; guard += 1, sequence += 1) {
    const candidate = `${base}-${sequence}`
    const exists = await c.env.DB.prepare(`SELECT id FROM profiles WHERE lower(slug)=lower(?) LIMIT 1`).bind(candidate).first()
    if (!exists) return candidate
  }
  return `${base}-${Date.now()}`
}

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
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: KDF_ITERATIONS, hash: 'SHA-256' }, key, 256)
  return { salt: hex(salt), hash: hex(new Uint8Array(bits)) }
}

async function masterTeam(c: any, userId: string) {
  return c.env.DB.prepare(`SELECT tw.*,p.name master_name,p.slug master_slug,p.bio master_bio,p.category master_category,p.subcategory master_subcategory,p.theme_id master_theme_id,p.layout_id master_layout_id,p.free_palette_id master_palette_id,p.avatar_url master_avatar_url,p.hero_url master_hero_url,p.template_data master_template_data FROM team_workspaces tw JOIN profiles p ON p.id=tw.master_profile_id WHERE tw.owner_user_id=? AND tw.status='active' LIMIT 1`).bind(userId).first()
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

async function verifyClone(c: any, masterProfileId: string, memberProfileId: string) {
  const [master, member, masterContact, memberContact, counts] = await Promise.all([
    c.env.DB.prepare(`SELECT bio,category,subcategory,theme_id,layout_id,free_palette_id,free_brand_color,hero_url,hero_position_x,hero_position_y,hero_zoom,accent_color,button_style,template_id,blocks_order FROM profiles WHERE id=? LIMIT 1`).bind(masterProfileId).first(),
    c.env.DB.prepare(`SELECT bio,category,subcategory,theme_id,layout_id,free_palette_id,free_brand_color,hero_url,hero_position_x,hero_position_y,hero_zoom,accent_color,button_style,template_id,blocks_order,template_data FROM profiles WHERE id=? LIMIT 1`).bind(memberProfileId).first(),
    c.env.DB.prepare(`SELECT hours,address,map_url FROM profile_contact WHERE profile_id=? LIMIT 1`).bind(masterProfileId).first(),
    c.env.DB.prepare(`SELECT hours,address,map_url FROM profile_contact WHERE profile_id=? LIMIT 1`).bind(memberProfileId).first(),
    c.env.DB.prepare(`
      SELECT
        (SELECT COUNT(*) FROM profile_links WHERE profile_id=?) master_links,
        (SELECT COUNT(*) FROM profile_links WHERE profile_id=?) member_links,
        (SELECT COUNT(*) FROM profile_gallery WHERE profile_id=?) master_gallery,
        (SELECT COUNT(*) FROM profile_gallery WHERE profile_id=?) member_gallery,
        (SELECT COUNT(*) FROM profile_products WHERE profile_id=?) master_products,
        (SELECT COUNT(*) FROM profile_products WHERE profile_id=?) member_products,
        (SELECT COUNT(*) FROM profile_social_links WHERE profile_id=?) master_social,
        (SELECT COUNT(*) FROM profile_social_links WHERE profile_id=?) member_social,
        (SELECT COUNT(*) FROM profile_modules WHERE profile_id=?) master_modules,
        (SELECT COUNT(*) FROM profile_modules WHERE profile_id=?) member_modules,
        (SELECT COUNT(*) FROM profile_faqs WHERE profile_id=?) master_faqs,
        (SELECT COUNT(*) FROM profile_faqs WHERE profile_id=?) member_faqs,
        (SELECT COUNT(*) FROM profile_videos WHERE profile_id=?) master_videos,
        (SELECT COUNT(*) FROM profile_videos WHERE profile_id=?) member_videos,
        (SELECT COUNT(*) FROM profile_bank_accounts WHERE profile_id=?) master_banks,
        (SELECT COUNT(*) FROM profile_bank_accounts WHERE profile_id=?) member_banks
    `).bind(masterProfileId,memberProfileId,masterProfileId,memberProfileId,masterProfileId,memberProfileId,masterProfileId,memberProfileId,masterProfileId,memberProfileId,masterProfileId,memberProfileId,masterProfileId,memberProfileId,masterProfileId,memberProfileId).first(),
  ])
  if (!master || !member) return false
  const fields = ['bio','category','subcategory','theme_id','layout_id','free_palette_id','free_brand_color','hero_url','hero_position_x','hero_position_y','hero_zoom','accent_color','button_style','template_id','blocks_order']
  if (!fields.every((key) => sameValue((master as any)[key], (member as any)[key]))) return false
  if (!sameValue((masterContact as any)?.hours,(memberContact as any)?.hours) || !sameValue((masterContact as any)?.address,(memberContact as any)?.address) || !sameValue((masterContact as any)?.map_url,(memberContact as any)?.map_url)) return false
  const pairs = [['master_links','member_links'],['master_gallery','member_gallery'],['master_products','member_products'],['master_social','member_social'],['master_modules','member_modules'],['master_faqs','member_faqs'],['master_videos','member_videos'],['master_banks','member_banks']]
  if (!pairs.every(([a,b]) => Number((counts as any)?.[a] || 0) === Number((counts as any)?.[b] || 0))) return false
  const template = readObject((member as any).template_data)
  return template.team_member === true && String(template.team_master_profile_id || '') === masterProfileId
}

async function verifyAssignmentState(c: any, teamId: string, memberId: string, profileId: string, artifactId: string, codeId: string) {
  const row = await c.env.DB.prepare(`
    SELECT tm.id member_id,tm.profile_id member_profile_id,tm.artifact_id member_artifact_id,tm.status member_status,
           a.profile_id artifact_profile_id,a.status artifact_status,
           tc.status code_status,tc.member_profile_id code_profile_id,tc.artifact_id code_artifact_id
      FROM team_members tm
      JOIN intap_artifacts a ON a.id=tm.artifact_id
      JOIN team_link_codes tc ON tc.id=tm.invite_code_id
     WHERE tm.id=? AND tm.team_id=? LIMIT 1
  `).bind(memberId,teamId).first()
  if (!row) return false
  return String((row as any).member_profile_id)===profileId && String((row as any).member_artifact_id)===artifactId && String((row as any).member_status)==='active' && String((row as any).artifact_profile_id)===profileId && String((row as any).artifact_status)==='activated' && String((row as any).code_status)==='used' && String((row as any).code_profile_id)===profileId && String((row as any).code_artifact_id)===artifactId && Boolean(codeId)
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
    permissions: readPermissions((validated.row as any).permissions_json),
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
  const accessRole = ADMIN_ROLES.has(String(body.access_role || 'member')) ? String(body.access_role || 'member') : 'member'
  const publishNow = body.publish_now !== false

  if (!name || !roleTitle) return c.json({ ok: false, error: 'Nombre y cargo son obligatorios para preparar el perfil Team.' }, 400)

  const validated: any = await validateCodeForTeam(c, String((team as any).id), code, publicCode)
  if (validated.error) return c.json({ ok: false, error: validated.error }, validated.status)
  const invite = validated.row as any
  const permissions = readPermissions(invite.permissions_json)
  const allowed = new Set(permissions)

  const requestedPhone = cleanText(body.phone, 40)
  const requestedWhatsapp = cleanText(body.whatsapp, 40)
  const requestedEmail = cleanText(body.email, 180).toLowerCase()
  if (requestedPhone && !allowed.has('phone')) return c.json({ ok: false, error: 'Teléfono no está habilitado para este código Team.' }, 400)
  if (requestedWhatsapp && !allowed.has('whatsapp')) return c.json({ ok: false, error: 'WhatsApp no está habilitado para este código Team.' }, 400)
  if (requestedEmail && !allowed.has('email')) return c.json({ ok: false, error: 'Correo no está habilitado para este código Team.' }, 400)

  const masterContact = await c.env.DB.prepare(`SELECT whatsapp,email,phone FROM profile_contact WHERE profile_id=? LIMIT 1`).bind(String((team as any).master_profile_id)).first()
  const phone = allowed.has('phone') ? (requestedPhone || null) : ((masterContact as any)?.phone ?? null)
  const whatsapp = allowed.has('whatsapp') ? (requestedWhatsapp || null) : ((masterContact as any)?.whatsapp ?? null)
  const email = allowed.has('email') ? (requestedEmail || null) : ((masterContact as any)?.email ?? null)

  if (accessRole === 'editor' || accessRole === 'subadmin') {
    const existing = await c.env.DB.prepare(`SELECT id FROM team_members WHERE team_id=? AND admin_role=? LIMIT 1`).bind(String((team as any).id), accessRole).first()
    if (existing) return c.json({ ok: false, error: accessRole === 'editor' ? 'Free permite un solo Editor por Team.' : 'Free permite un solo Subadministrador por Team.' }, 409)
  }

  const seatUserId = crypto.randomUUID()
  const profileId = crypto.randomUUID()
  const memberId = crypto.randomUUID()
  const slug = await nextTeamMemberSlug(c, team)
  const syntheticEmail = `seat-${seatUserId.replace(/-/g,'')}@team.internal.kawvo`
  let masterTemplate: any = {}
  try { masterTemplate = JSON.parse(String((team as any).master_template_data || '{}')) || {} } catch { masterTemplate = {} }
  const templateData = { ...masterTemplate, role: roleTitle, free_identity_confirmed: true, team_member: true, team_id: String((team as any).id), team_master_profile_id: String((team as any).master_profile_id), team_permissions: permissions, team_access_role: accessRole, team_joined_at: new Date().toISOString() }
  const initialAvatar = allowed.has('photo') ? null : ((team as any).master_avatar_url || null)

  // A Team seat is an internal system user. Production has legacy databases where
  // users only exposes id/email, while newer schemas may also have created_at with
  // a default. Insert only the portable columns so Team assignment works across
  // both schemas without requiring a destructive/auth-schema migration.
  const statements: any[] = [
    c.env.DB.prepare(`INSERT INTO users(id,email) VALUES(?,?)`).bind(seatUserId,syntheticEmail),
    c.env.DB.prepare(`INSERT INTO profiles(id,user_id,slug,plan_id,theme_id,layout_id,name,bio,category,subcategory,free_palette_id,avatar_url,hero_url,template_data,is_published,created_at,updated_at) VALUES(?,?,?,'free',?,?,?,?,?,?,?,?,?,?,0,datetime('now'),datetime('now'))`).bind(profileId,seatUserId,slug,String((team as any).master_theme_id || 'default'),String((team as any).master_layout_id || 'esencial'),name,String((team as any).master_bio || ''),String((team as any).master_category || ''),String((team as any).master_subcategory || ''),String((team as any).master_palette_id || ''),initialAvatar,String((team as any).master_hero_url || ''),JSON.stringify(templateData)),
    c.env.DB.prepare(`INSERT INTO profile_contact(profile_id,whatsapp,email,phone,hours,address,map_url) SELECT ?,?,?,?,hours,address,map_url FROM profile_contact WHERE profile_id=?`).bind(profileId,whatsapp,email,phone,String((team as any).master_profile_id)),
    c.env.DB.prepare(`INSERT INTO team_members(id,team_id,user_id,profile_id,artifact_id,invite_code_id,status,permissions_json,admin_role,joined_at,updated_at) VALUES(?,?,?,?,?,?,'active',?,?,datetime('now'),datetime('now'))`).bind(memberId,String((team as any).id),seatUserId,profileId,String(invite.artifact_id),String(invite.id),JSON.stringify(permissions),accessRole),
    c.env.DB.prepare(`UPDATE intap_artifacts SET owner_user_id=?,profile_id=?,status='activated',activated_at=datetime('now'),updated_at=datetime('now') WHERE id=? AND owner_user_id IS NULL AND status IN('available','unassigned')`).bind(seatUserId,profileId,String(invite.artifact_id)),
    c.env.DB.prepare(`UPDATE artifact_activation_codes SET status='used',used_at=datetime('now') WHERE id=? AND status='active'`).bind(String(invite.activation_code_id)),
    c.env.DB.prepare(`UPDATE team_link_codes SET status='used',used_at=datetime('now'),used_by_user_id=NULL,artifact_id=?,member_profile_id=?,updated_at=datetime('now') WHERE id=? AND team_id=? AND used_at IS NULL`).bind(String(invite.artifact_id),profileId,String(invite.id),String((team as any).id)),
  ]

  let temporaryPassword = ''
  if (accessRole !== 'member') {
    temporaryPassword = randomPassword()
    let credential: { salt: string; hash: string }
    try {
      credential = await hashPassword(temporaryPassword)
    } catch (error) {
      console.error('[team/corporate/assign] credential hash failed', error)
      return c.json({ ok: false, error: 'No pudimos preparar el acceso administrativo del colaborador. Intenta nuevamente.' }, 500)
    }
    statements.push(c.env.DB.prepare(`INSERT INTO team_member_credentials(team_member_id,password_salt,password_hash,must_change_password,created_at,updated_at) VALUES(?,?,?,1,datetime('now'),datetime('now'))`).bind(memberId,credential.salt,credential.hash))
  }

  try { await c.env.DB.batch(statements) } catch (error) {
    console.error('[team/corporate/assign] failed', error)
    return c.json({ ok: false, error: 'No pudimos preparar este dispositivo. El código no fue consumido.' }, 409)
  }

  const teamId = String((team as any).id)
  const masterProfileId = String((team as any).master_profile_id)
  const artifactId = String(invite.artifact_id)
  let cloneOk = false
  try {
    await syncTeamMemberFromMaster(c, profileId, true)
    cloneOk = await verifyClone(c, masterProfileId, profileId)
    if (!cloneOk) {
      console.warn('[team/corporate/assign] clone verification mismatch; retrying', { profileId, masterProfileId })
      await syncTeamMemberFromMaster(c, profileId, true)
      cloneOk = await verifyClone(c, masterProfileId, profileId)
    }
  } catch (error) {
    console.error('[team/corporate/assign] initial Master clone failed', error)
  }

  const sourceOk = await verifyAssignmentState(c, teamId, memberId, profileId, artifactId, String(invite.activation_code_id))
  if (!cloneOk || !sourceOk) {
    await c.env.DB.prepare(`UPDATE profiles SET is_published=0,updated_at=datetime('now') WHERE id=?`).bind(profileId).run().catch(() => undefined)
    console.error('[team/corporate/assign] postcondition failed', { cloneOk, sourceOk, profileId, artifactId, memberId })
    return c.json({ ok: false, error: 'El dispositivo quedó reservado dentro del Team, pero la presentación Master no superó la verificación final. No fue publicada. Abre Team y sincroniza antes de entregarlo.' }, 500)
  }

  await c.env.DB.prepare(`UPDATE profiles SET is_published=?,updated_at=datetime('now') WHERE id=?`).bind(publishNow ? 1 : 0,profileId).run()

  return c.json({ ok: true, data: {
    member_id: memberId,
    profile_id: profileId,
    slug,
    public_code: publicCode,
    team_name: String((team as any).name || ''),
    access_role: accessRole,
    permissions,
    status: publishNow ? 'published' : 'draft',
    clone_verified: true,
    source_verified: true,
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
  await c.env.DB.prepare(`INSERT INTO team_member_credentials(team_member_id,password_salt,password_hash,must_change_password,failed_attempts,locked_until,updated_at) VALUES(?,?,?,1,0,NULL,datetime('now'),datetime('now')) ON CONFLICT(team_member_id) DO UPDATE SET password_salt=excluded.password_salt,password_hash=excluded.password_hash,must_change_password=1,failed_attempts=0,locked_until=NULL,updated_at=datetime('now')`).bind(String((member as any).id),credential.salt,credential.hash).run()
  return c.json({ ok: true, data: { temporary_password: temporaryPassword } })
})

export default app
