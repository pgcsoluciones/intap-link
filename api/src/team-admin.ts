import app from './index'
import { cookieNames } from './lib/cookies'

const CODE_PAGE_SIZE = 8
const ADMIN_ROLES = new Set(['member', 'editor', 'subadmin'])
const BASIC_FIELDS = ['name', 'role', 'phone', 'email', 'whatsapp'] as const

type TeamAccess = {
  teamId: string
  teamName: string
  masterProfileId: string
  accessRole: 'master' | 'editor' | 'subadmin' | 'member'
  memberId?: string
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
  const row = await c.env.DB.prepare(`SELECT user_id FROM auth_sessions WHERE session_hash=? AND expires_at>datetime('now') AND revoked_at IS NULL LIMIT 1`).bind(await sha256Hex(raw)).first()
  return row ? String((row as any).user_id || '') : null
}

async function requireAuth(c: any, next: any) {
  const userId = await sessionUserId(c)
  if (!userId) return c.json({ ok: false, error: 'Unauthorized' }, 401)
  c.set('userId', userId)
  await next()
}

function readPermissions(raw: unknown): string[] {
  try {
    const parsed = JSON.parse(String(raw || '[]'))
    return Array.isArray(parsed) ? Array.from(new Set(parsed.map(String))) : []
  } catch { return [] }
}

async function teamAccess(c: any, userId: string): Promise<TeamAccess | null> {
  const master = await c.env.DB.prepare(`SELECT id,name,master_profile_id FROM team_workspaces WHERE owner_user_id=? AND status='active' LIMIT 1`).bind(userId).first()
  if (master) return { teamId: String((master as any).id), teamName: String((master as any).name || ''), masterProfileId: String((master as any).master_profile_id), accessRole: 'master' }

  const member = await c.env.DB.prepare(`SELECT tm.id,tm.team_id,tm.admin_role,tw.name,tw.master_profile_id FROM team_members tm JOIN team_workspaces tw ON tw.id=tm.team_id WHERE tm.user_id=? AND tw.status='active' LIMIT 1`).bind(userId).first()
  if (!member) return null
  const role = String((member as any).admin_role || 'member') as TeamAccess['accessRole']
  return { teamId: String((member as any).team_id), teamName: String((member as any).name || ''), masterProfileId: String((member as any).master_profile_id), accessRole: role, memberId: String((member as any).id) }
}

app.get('/api/v1/me/team/admin-context', requireAuth, async (c: any) => {
  const userId = c.get('userId') as string
  const access = await teamAccess(c, userId)
  return c.json({ ok: true, data: access ? {
    role: access.accessRole,
    team_id: access.teamId,
    team_name: access.teamName,
    master_profile_id: access.masterProfileId,
    can_manage_team: access.accessRole === 'master' || access.accessRole === 'editor' || access.accessRole === 'subadmin',
    can_generate_codes: access.accessRole === 'master',
    can_manage_roles: access.accessRole === 'master',
    can_toggle_members: access.accessRole === 'master' || access.accessRole === 'subadmin',
    can_edit_members: access.accessRole === 'master' || access.accessRole === 'editor' || access.accessRole === 'subadmin',
  } : { role: 'none', can_manage_team: false, can_generate_codes: false, can_manage_roles: false, can_toggle_members: false, can_edit_members: false } })
})

app.get('/api/v1/me/team/manage', requireAuth, async (c: any) => {
  const userId = c.get('userId') as string
  const access = await teamAccess(c, userId)
  if (!access || access.accessRole === 'member') return c.json({ ok: false, error: 'Este módulo solo puede ser gestionado por el administrador o un rol autorizado.' }, 403)

  const q = String(c.req.query('q') || '').trim()
  const like = `%${q}%`
  const page = Math.max(1, Number(c.req.query('page') || 1) || 1)
  const offset = (page - 1) * CODE_PAGE_SIZE

  const [members, memberCount, codeRows, codeCount] = await Promise.all([
    c.env.DB.prepare(`SELECT tm.id,tm.user_id,tm.profile_id,tm.artifact_id,tm.status,tm.permissions_json,tm.admin_role,tm.joined_at,tm.updated_at,u.email,p.name,p.slug,json_extract(COALESCE(p.template_data,'{}'),'$.role') role,a.public_code product_code,a.product_type FROM team_members tm JOIN users u ON u.id=tm.user_id JOIN profiles p ON p.id=tm.profile_id JOIN intap_artifacts a ON a.id=tm.artifact_id WHERE tm.team_id=? ORDER BY tm.joined_at DESC`).bind(access.teamId).all(),
    c.env.DB.prepare(`SELECT COUNT(*) n FROM team_members WHERE team_id=?`).bind(access.teamId).first(),
    access.accessRole === 'master' ? c.env.DB.prepare(`SELECT tc.id,tc.code,tc.status,tc.permissions_json,tc.expires_at,tc.used_at,tc.created_at,tc.updated_at,tc.artifact_id,u.email used_by_email,p.name member_name,p.slug member_slug,a.public_code product_code,a.product_type FROM team_link_codes tc LEFT JOIN users u ON u.id=tc.used_by_user_id LEFT JOIN profiles p ON p.id=tc.member_profile_id LEFT JOIN intap_artifacts a ON a.id=tc.artifact_id WHERE tc.team_id=? AND (?='' OR tc.code LIKE ? OR COALESCE(u.email,'') LIKE ? OR COALESCE(p.name,'') LIKE ? OR COALESCE(a.public_code,'') LIKE ?) ORDER BY tc.created_at DESC LIMIT ? OFFSET ?`).bind(access.teamId,q,like,like,like,like,CODE_PAGE_SIZE,offset).all() : Promise.resolve({ results: [] }),
    access.accessRole === 'master' ? c.env.DB.prepare(`SELECT COUNT(*) n FROM team_link_codes tc LEFT JOIN users u ON u.id=tc.used_by_user_id LEFT JOIN profiles p ON p.id=tc.member_profile_id LEFT JOIN intap_artifacts a ON a.id=tc.artifact_id WHERE tc.team_id=? AND (?='' OR tc.code LIKE ? OR COALESCE(u.email,'') LIKE ? OR COALESCE(p.name,'') LIKE ? OR COALESCE(a.public_code,'') LIKE ?)`).bind(access.teamId,q,like,like,like,like).first() : Promise.resolve({ n: 0 }),
  ])

  const total = Number((codeCount as any)?.n || 0)
  return c.json({ ok: true, data: {
    team: { id: access.teamId, name: access.teamName, master_profile_id: access.masterProfileId },
    access: {
      role: access.accessRole,
      can_generate_codes: access.accessRole === 'master',
      can_manage_roles: access.accessRole === 'master',
      can_toggle_members: access.accessRole === 'master' || access.accessRole === 'subadmin',
      can_edit_members: true,
    },
    members: (members.results || []).map((row: any) => ({ ...row, permissions: readPermissions(row.permissions_json) })),
    member_count: Number((memberCount as any)?.n || 0),
    codes: ((codeRows as any).results || []).map((row: any) => ({ ...row, permissions: readPermissions(row.permissions_json), reserved: Boolean(row.artifact_id && !row.used_at) })),
    pagination: { page, page_size: CODE_PAGE_SIZE, total, pages: Math.max(1, Math.ceil(total / CODE_PAGE_SIZE)) },
  } })
})

app.post('/api/v1/me/team/codes/:id/reserve', requireAuth, async (c: any) => {
  const userId = c.get('userId') as string
  const access = await teamAccess(c, userId)
  if (!access || access.accessRole !== 'master') return c.json({ ok: false, error: 'Solo el administrador Team puede reservar dispositivos.' }, 403)
  let body: any = {}; try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Solicitud inválida.' }, 400) }
  const publicCode = String(body.public_code || '').trim().toUpperCase()
  if (!publicCode) return c.json({ ok: false, error: 'Ingresa el código del producto.' }, 400)

  const codeRow = await c.env.DB.prepare(`SELECT id,status,used_at,artifact_id FROM team_link_codes WHERE id=? AND team_id=? LIMIT 1`).bind(String(c.req.param('id') || ''), access.teamId).first()
  if (!codeRow || (codeRow as any).used_at || String((codeRow as any).status) === 'used') return c.json({ ok: false, error: 'Este código Team ya no puede reservar un producto.' }, 409)

  const artifact = await c.env.DB.prepare(`SELECT id,status,owner_user_id FROM intap_artifacts WHERE public_code=? LIMIT 1`).bind(publicCode).first()
  if (!artifact || (artifact as any).owner_user_id || !['available','unassigned'].includes(String((artifact as any).status || ''))) return c.json({ ok: false, error: 'Este producto ya fue activado o no está disponible.' }, 409)
  const activation = await c.env.DB.prepare(`SELECT id FROM artifact_activation_codes WHERE artifact_id=? AND status='active' AND (expires_at IS NULL OR expires_at>datetime('now')) ORDER BY created_at DESC LIMIT 1`).bind(String((artifact as any).id)).first()
  if (!activation) return c.json({ ok: false, error: 'Este producto todavía no está habilitado para activación.' }, 409)
  const other = await c.env.DB.prepare(`SELECT id FROM team_link_codes WHERE artifact_id=? AND used_at IS NULL AND id<>? LIMIT 1`).bind(String((artifact as any).id), String((codeRow as any).id)).first()
  if (other) return c.json({ ok: false, error: 'Este producto ya está reservado para otra vinculación Team.' }, 409)

  await c.env.DB.prepare(`UPDATE team_link_codes SET artifact_id=?,updated_at=datetime('now') WHERE id=? AND team_id=? AND used_at IS NULL`).bind(String((artifact as any).id), String((codeRow as any).id), access.teamId).run()
  return c.json({ ok: true, data: { public_code: publicCode, reserved: true } })
})

app.post('/api/v1/me/team/codes/:id/unreserve', requireAuth, async (c: any) => {
  const userId = c.get('userId') as string
  const access = await teamAccess(c, userId)
  if (!access || access.accessRole !== 'master') return c.json({ ok: false, error: 'Solo el administrador Team puede liberar reservas.' }, 403)
  await c.env.DB.prepare(`UPDATE team_link_codes SET artifact_id=NULL,updated_at=datetime('now') WHERE id=? AND team_id=? AND used_at IS NULL AND status<>'used'`).bind(String(c.req.param('id') || ''), access.teamId).run()
  return c.json({ ok: true })
})

app.post('/api/v1/me/team/members/:id/role', requireAuth, async (c: any) => {
  const userId = c.get('userId') as string
  const access = await teamAccess(c, userId)
  if (!access || access.accessRole !== 'master') return c.json({ ok: false, error: 'Solo el administrador Team puede asignar roles.' }, 403)
  let body: any = {}; try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Solicitud inválida.' }, 400) }
  const role = String(body.role || 'member')
  if (!ADMIN_ROLES.has(role)) return c.json({ ok: false, error: 'Rol no válido.' }, 400)
  const memberId = String(c.req.param('id') || '')
  const target = await c.env.DB.prepare(`SELECT id FROM team_members WHERE id=? AND team_id=? LIMIT 1`).bind(memberId, access.teamId).first()
  if (!target) return c.json({ ok: false, error: 'Miembro no encontrado.' }, 404)

  if (role === 'editor' || role === 'subadmin') {
    const existing = await c.env.DB.prepare(`SELECT id FROM team_members WHERE team_id=? AND admin_role=? AND id<>? LIMIT 1`).bind(access.teamId, role, memberId).first()
    if (existing) return c.json({ ok: false, error: role === 'editor' ? 'Free permite un solo Editor por Team.' : 'Free permite un solo Subadministrador por Team.' }, 409)
  }
  await c.env.DB.prepare(`UPDATE team_members SET admin_role=?,updated_at=datetime('now') WHERE id=? AND team_id=?`).bind(role, memberId, access.teamId).run()
  return c.json({ ok: true, data: { role } })
})

app.post('/api/v1/me/team/members/:id/status', requireAuth, async (c: any) => {
  const userId = c.get('userId') as string
  const access = await teamAccess(c, userId)
  if (!access || !['master','subadmin'].includes(access.accessRole)) return c.json({ ok: false, error: 'Tu rol no permite activar o desactivar miembros.' }, 403)
  let body: any = {}; try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Solicitud inválida.' }, 400) }
  const status = body.active === false ? 'inactive' : 'active'
  const target = await c.env.DB.prepare(`SELECT id,artifact_id,user_id FROM team_members WHERE id=? AND team_id=? LIMIT 1`).bind(String(c.req.param('id') || ''), access.teamId).first()
  if (!target) return c.json({ ok: false, error: 'Miembro no encontrado.' }, 404)
  if (String((target as any).user_id) === userId) return c.json({ ok: false, error: 'No puedes cambiar tu propio estado desde este rol.' }, 409)
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE team_members SET status=?,updated_at=datetime('now') WHERE id=? AND team_id=?`).bind(status, String((target as any).id), access.teamId),
    c.env.DB.prepare(`UPDATE intap_artifacts SET status=?,updated_at=datetime('now') WHERE id=?`).bind(status === 'active' ? 'activated' : 'suspended', String((target as any).artifact_id)),
  ])
  return c.json({ ok: true, data: { status } })
})

app.put('/api/v1/me/team/members/:id/basic', requireAuth, async (c: any) => {
  const userId = c.get('userId') as string
  const access = await teamAccess(c, userId)
  if (!access || !['master','editor','subadmin'].includes(access.accessRole)) return c.json({ ok: false, error: 'Tu rol no permite editar miembros.' }, 403)
  let body: any = {}; try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Solicitud inválida.' }, 400) }
  const target = await c.env.DB.prepare(`SELECT tm.id,tm.profile_id,tm.permissions_json,p.template_data FROM team_members tm JOIN profiles p ON p.id=tm.profile_id WHERE tm.id=? AND tm.team_id=? LIMIT 1`).bind(String(c.req.param('id') || ''), access.teamId).first()
  if (!target) return c.json({ ok: false, error: 'Miembro no encontrado.' }, 404)
  const permissions = new Set(readPermissions((target as any).permissions_json))
  const allowed = (field: string) => access.accessRole === 'master' || permissions.has(field)
  const statements: any[] = []

  if (Object.prototype.hasOwnProperty.call(body, 'name')) {
    if (!allowed('name')) return c.json({ ok: false, error: 'Nombre no está habilitado para este miembro.' }, 403)
    statements.push(c.env.DB.prepare(`UPDATE profiles SET name=?,updated_at=datetime('now') WHERE id=?`).bind(String(body.name || '').trim() || null, String((target as any).profile_id)))
  }
  if (Object.prototype.hasOwnProperty.call(body, 'role')) {
    if (!allowed('role')) return c.json({ ok: false, error: 'Cargo no está habilitado para este miembro.' }, 403)
    let template: any = {}; try { template = JSON.parse(String((target as any).template_data || '{}')) || {} } catch { template = {} }
    template.role = String(body.role || '').trim()
    statements.push(c.env.DB.prepare(`UPDATE profiles SET template_data=?,updated_at=datetime('now') WHERE id=?`).bind(JSON.stringify(template), String((target as any).profile_id)))
  }
  for (const field of BASIC_FIELDS.slice(2)) {
    if (!Object.prototype.hasOwnProperty.call(body, field)) continue
    if (!allowed(field)) return c.json({ ok: false, error: `${field} no está habilitado para este miembro.` }, 403)
  }
  if (['phone','email','whatsapp'].some((field) => Object.prototype.hasOwnProperty.call(body, field))) {
    const current = await c.env.DB.prepare(`SELECT phone,email,whatsapp,hours,address,map_url FROM profile_contact WHERE profile_id=? LIMIT 1`).bind(String((target as any).profile_id)).first()
    statements.push(c.env.DB.prepare(`INSERT INTO profile_contact(profile_id,whatsapp,email,phone,hours,address,map_url) VALUES(?,?,?,?,?,?,?) ON CONFLICT(profile_id) DO UPDATE SET whatsapp=excluded.whatsapp,email=excluded.email,phone=excluded.phone`).bind(
      String((target as any).profile_id),
      Object.prototype.hasOwnProperty.call(body,'whatsapp') ? String(body.whatsapp || '').trim() || null : (current as any)?.whatsapp ?? null,
      Object.prototype.hasOwnProperty.call(body,'email') ? String(body.email || '').trim() || null : (current as any)?.email ?? null,
      Object.prototype.hasOwnProperty.call(body,'phone') ? String(body.phone || '').trim() || null : (current as any)?.phone ?? null,
      (current as any)?.hours ?? null,(current as any)?.address ?? null,(current as any)?.map_url ?? null,
    ))
  }
  if (!statements.length) return c.json({ ok: false, error: 'No hay cambios para guardar.' }, 400)
  await c.env.DB.batch(statements)
  return c.json({ ok: true })
})

app.post('/api/v1/public/team/code/inspect-v2', async (c: any) => {
  let body: any = {}; try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Solicitud inválida.' }, 400) }
  const code = String(body.code || '').trim().toUpperCase().replace(/\s+/g, '')
  const publicCode = String(body.public_code || '').trim().toUpperCase()
  if (!code || !publicCode) return c.json({ ok: false, error: 'Ingresa el código de vinculación.' }, 400)

  const artifact = await c.env.DB.prepare(`SELECT id,status,owner_user_id FROM intap_artifacts WHERE public_code=? LIMIT 1`).bind(publicCode).first()
  if (!artifact || (artifact as any).owner_user_id || !['available','unassigned'].includes(String((artifact as any).status || ''))) return c.json({ ok: false, error: 'Este producto ya no está disponible para vincularse a un Team.' }, 409)
  const invite = await c.env.DB.prepare(`SELECT tc.id,tc.team_id,tc.status,tc.expires_at,tc.used_at,tc.artifact_id,tc.permissions_json,tw.name team_name,tw.status team_status,mp.name master_name,mp.slug master_slug FROM team_link_codes tc JOIN team_workspaces tw ON tw.id=tc.team_id JOIN profiles mp ON mp.id=tw.master_profile_id WHERE tc.code=? LIMIT 1`).bind(code).first()
  if (!invite) return c.json({ ok: false, error: 'Código de vinculación no válido.' }, 404)
  if (String((invite as any).team_status) !== 'active') return c.json({ ok: false, error: 'Este Team no está disponible.' }, 409)
  if ((invite as any).used_at || String((invite as any).status) === 'used') return c.json({ ok: false, error: 'Este código ya fue utilizado.' }, 409)
  if (String((invite as any).status) === 'expired') return c.json({ ok: false, error: 'Este código caducó. Solicita su reactivación al administrador Team.' }, 410)
  if (String((invite as any).status) === 'disabled') return c.json({ ok: false, error: 'Este código está desactivado.' }, 409)

  const reservedArtifactId = String((invite as any).artifact_id || '')
  if (reservedArtifactId && reservedArtifactId !== String((artifact as any).id)) return c.json({ ok: false, error: 'Este código fue preparado para otro producto.' }, 409)
  const otherReservation = await c.env.DB.prepare(`SELECT id FROM team_link_codes WHERE artifact_id=? AND used_at IS NULL AND id<>? LIMIT 1`).bind(String((artifact as any).id), String((invite as any).id)).first()
  if (otherReservation) return c.json({ ok: false, error: 'Este producto está reservado para otro código Team.' }, 409)

  const activation = await c.env.DB.prepare(`SELECT id FROM artifact_activation_codes WHERE artifact_id=? AND status='active' AND (expires_at IS NULL OR expires_at>datetime('now')) ORDER BY created_at DESC LIMIT 1`).bind(String((artifact as any).id)).first()
  if (!activation) return c.json({ ok: false, error: 'Este producto todavía no está habilitado para activación.' }, 409)

  return c.json({ ok: true, data: {
    code,
    team_id: String((invite as any).team_id),
    team_name: String((invite as any).team_name || (invite as any).master_name || 'Mi Team'),
    master_name: String((invite as any).master_name || ''),
    master_slug: String((invite as any).master_slug || ''),
    expires_at: String((invite as any).expires_at || ''),
    permissions: readPermissions((invite as any).permissions_json),
    reserved_for_this_product: Boolean(reservedArtifactId),
  } })
})

export default app
