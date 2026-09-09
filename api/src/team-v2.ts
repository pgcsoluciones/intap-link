import app from './index'
import { cookieNames } from './lib/cookies'

const TEAM_CODE_TTL_HOURS = 24
const TEAM_CODE_PURGE_HOURS = 48
const TEAM_PAGE_SIZE = 5
const TEAM_PERMISSIONS = ['name','role','photo','phone','email','whatsapp','portfolio','services','links','quick_actions','location','design'] as const

type TeamPermission = typeof TEAM_PERMISSIONS[number]

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
  return row ? String((row as any).user_id) : null
}

async function requireTeamAuth(c: any, next: any) {
  const userId = await sessionUserId(c)
  if (!userId) return c.json({ ok: false, error: 'Unauthorized' }, 401)
  c.set('userId', userId)
  await next()
}

function normalizeCode(value: unknown) { return String(value || '').trim().toUpperCase().replace(/\s+/g, '') }
function normalizeSlugBase(value: unknown) {
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'team'
}
async function nextTeamMemberSlug(c: any, teamId: string, masterSlug: string) {
  const base = normalizeSlugBase(masterSlug)
  const rows = await c.env.DB.prepare(`SELECT p.slug FROM team_members tm JOIN profiles p ON p.id=tm.profile_id WHERE tm.team_id=? AND lower(p.slug) LIKE lower(?)`).bind(teamId, `${base}-%`).all()
  let max = 0
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  for (const row of (rows.results || []) as any[]) {
    const match = String(row.slug || '').toLowerCase().match(new RegExp(`^${escaped}-(\\d+)$`))
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
function jsonObject(raw: unknown): Record<string, any> { try { const value = JSON.parse(String(raw || '{}')); return value && typeof value === 'object' && !Array.isArray(value) ? value : {} } catch { return {} } }
function parsePermissions(value: unknown): TeamPermission[] {
  const allowed = new Set<string>(TEAM_PERMISSIONS)
  const incoming = Array.isArray(value) ? value.map(String) : []
  return Array.from(new Set<TeamPermission>(['name','role', ...incoming.filter((key): key is TeamPermission => allowed.has(key))]))
}
function readPermissions(raw: unknown) { try { return parsePermissions(JSON.parse(String(raw || '[]'))) } catch { return ['name','role'] as TeamPermission[] } }
function generateTeamCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = new Uint8Array(8); crypto.getRandomValues(bytes)
  const token = Array.from(bytes, (value) => alphabet[value % alphabet.length]).join('')
  return `TEAM-${token.slice(0,4)}-${token.slice(4)}`
}

export async function cleanupExpiredTeamCodes(env: any) {
  if (!env?.DB) return
  await env.DB.prepare(`UPDATE team_link_codes SET status='expired',updated_at=datetime('now') WHERE status='active' AND expires_at<=datetime('now')`).run()
  await env.DB.prepare(`DELETE FROM team_link_codes WHERE status!='used' AND used_at IS NULL AND created_at<=datetime('now','-${TEAM_CODE_PURGE_HOURS} hours')`).run()
}

async function ensureMasterTeam(c: any, userId: string) {
  await cleanupExpiredTeamCodes(c.env)
  const membership = await c.env.DB.prepare(`SELECT id FROM team_members WHERE user_id=? LIMIT 1`).bind(userId).first()
  if (membership) return null
  const profile = await c.env.DB.prepare(`SELECT id,name FROM profiles WHERE user_id=? AND is_active=1 LIMIT 1`).bind(userId).first()
  if (!profile) return null
  let team = await c.env.DB.prepare(`SELECT * FROM team_workspaces WHERE owner_user_id=? LIMIT 1`).bind(userId).first()
  if (!team) {
    const id = crypto.randomUUID()
    await c.env.DB.prepare(`INSERT INTO team_workspaces(id,master_profile_id,owner_user_id,name,status,created_at,updated_at) VALUES(?,?,?,?,'active',datetime('now'),datetime('now'))`)
      .bind(id,String((profile as any).id),userId,String((profile as any).name || 'Mi equipo')).run()
    team = await c.env.DB.prepare(`SELECT * FROM team_workspaces WHERE id=? LIMIT 1`).bind(id).first()
  }
  return team
}

app.get('/api/v1/me/team/context', requireTeamAuth, async (c: any) => {
  const userId = c.get('userId') as string
  await cleanupExpiredTeamCodes(c.env)
  const [master, member] = await Promise.all([
    c.env.DB.prepare(`SELECT tw.id,tw.master_profile_id,tw.name,tw.status,p.slug master_slug,p.name master_name FROM team_workspaces tw JOIN profiles p ON p.id=tw.master_profile_id WHERE tw.owner_user_id=? LIMIT 1`).bind(userId).first(),
    c.env.DB.prepare(`SELECT tm.id,tm.team_id,tm.profile_id,tm.artifact_id,tm.status,tm.permissions_json,tw.master_profile_id,mp.slug master_slug,mp.name master_name,a.public_code,a.status artifact_status FROM team_members tm JOIN team_workspaces tw ON tw.id=tm.team_id JOIN profiles mp ON mp.id=tw.master_profile_id JOIN intap_artifacts a ON a.id=tm.artifact_id WHERE tm.user_id=? LIMIT 1`).bind(userId).first(),
  ])
  return c.json({ ok: true, data: {
    role: member ? 'member' : master ? 'master' : 'none',
    master: master ? { team_id:String((master as any).id),profile_id:String((master as any).master_profile_id),name:String((master as any).master_name || (master as any).name || ''),slug:String((master as any).master_slug || '') } : null,
    member: member ? { id:String((member as any).id),team_id:String((member as any).team_id),profile_id:String((member as any).profile_id),artifact_id:String((member as any).artifact_id),public_code:String((member as any).public_code || ''),artifact_status:String((member as any).artifact_status || ''),status:String((member as any).status || ''),permissions:readPermissions((member as any).permissions_json),master_profile_id:String((member as any).master_profile_id),master_name:String((member as any).master_name || ''),master_slug:String((member as any).master_slug || '') } : null,
  }})
})

app.get('/api/v1/me/team', requireTeamAuth, async (c: any) => {
  const userId = c.get('userId') as string
  const team = await ensureMasterTeam(c,userId)
  if (!team) return c.json({ ok:false,error:'Esta cuenta no puede administrar un Team.' },409)
  const teamId = String((team as any).id)
  const q = String(c.req.query('q') || '').trim(); const like = `%${q}%`
  const page = Math.max(1,Number(c.req.query('page') || 1) || 1); const offset=(page-1)*TEAM_PAGE_SIZE
  const [rows,count,memberCount] = await Promise.all([
    c.env.DB.prepare(`SELECT tc.id,tc.code,tc.status,tc.permissions_json,tc.expires_at,tc.used_at,tc.created_at,tc.updated_at,tc.artifact_id,u.email used_by_email,p.name member_name,p.slug member_slug,a.public_code product_code,a.product_type FROM team_link_codes tc LEFT JOIN users u ON u.id=tc.used_by_user_id LEFT JOIN profiles p ON p.id=tc.member_profile_id LEFT JOIN intap_artifacts a ON a.id=tc.artifact_id WHERE tc.team_id=? AND (?='' OR tc.code LIKE ? OR COALESCE(u.email,'') LIKE ? OR COALESCE(p.name,'') LIKE ? OR COALESCE(a.public_code,'') LIKE ?) ORDER BY tc.created_at DESC LIMIT ? OFFSET ?`).bind(teamId,q,like,like,like,like,TEAM_PAGE_SIZE,offset).all(),
    c.env.DB.prepare(`SELECT COUNT(*) n FROM team_link_codes tc LEFT JOIN users u ON u.id=tc.used_by_user_id LEFT JOIN profiles p ON p.id=tc.member_profile_id LEFT JOIN intap_artifacts a ON a.id=tc.artifact_id WHERE tc.team_id=? AND (?='' OR tc.code LIKE ? OR COALESCE(u.email,'') LIKE ? OR COALESCE(p.name,'') LIKE ? OR COALESCE(a.public_code,'') LIKE ?)`).bind(teamId,q,like,like,like,like).first(),
    c.env.DB.prepare(`SELECT COUNT(*) n FROM team_members WHERE team_id=?`).bind(teamId).first(),
  ])
  const total = Number((count as any)?.n || 0)
  return c.json({ ok:true,data:{ team:{id:teamId,master_profile_id:String((team as any).master_profile_id),name:String((team as any).name || ''),status:String((team as any).status || 'active')},codes:(rows.results || []).map((row:any)=>({...row,permissions:readPermissions(row.permissions_json)})),pagination:{page,page_size:TEAM_PAGE_SIZE,total,pages:Math.max(1,Math.ceil(total/TEAM_PAGE_SIZE))},member_count:Number((memberCount as any)?.n || 0),permission_options:TEAM_PERMISSIONS }})
})

app.post('/api/v1/me/team/codes', requireTeamAuth, async (c: any) => {
  const userId=c.get('userId') as string; const team=await ensureMasterTeam(c,userId)
  if(!team) return c.json({ok:false,error:'Esta cuenta no puede administrar un Team.'},409)
  let body:any={}; try{body=await c.req.json()}catch{return c.json({ok:false,error:'Solicitud inválida.'},400)}
  const count=Math.min(50,Math.max(1,Number(body.count || 1) || 1)); const permissions=parsePermissions(body.permissions); const created:any[]=[]
  for(let i=0;i<count;i+=1){
    let code=generateTeamCode()
    for(let retry=0;retry<5;retry+=1){const exists=await c.env.DB.prepare(`SELECT id FROM team_link_codes WHERE code=? LIMIT 1`).bind(code).first();if(!exists)break;code=generateTeamCode()}
    const id=crypto.randomUUID()
    await c.env.DB.prepare(`INSERT INTO team_link_codes(id,team_id,code,status,permissions_json,expires_at,created_at,updated_at) VALUES(?,?,?,'active',?,datetime('now','+${TEAM_CODE_TTL_HOURS} hours'),datetime('now'),datetime('now'))`).bind(id,String((team as any).id),code,JSON.stringify(permissions)).run()
    created.push({id,code,status:'active',permissions,valid_hours:TEAM_CODE_TTL_HOURS})
  }
  return c.json({ok:true,data:created})
})

app.post('/api/v1/me/team/codes/:id/deactivate', requireTeamAuth, async (c:any)=>{
  const userId=c.get('userId') as string;const team=await ensureMasterTeam(c,userId);if(!team)return c.json({ok:false,error:'Equipo no encontrado.'},404)
  await c.env.DB.prepare(`UPDATE team_link_codes SET status='disabled',updated_at=datetime('now') WHERE id=? AND team_id=? AND status IN('active','expired') AND used_at IS NULL`).bind(String(c.req.param('id')||''),String((team as any).id)).run();return c.json({ok:true})
})

app.post('/api/v1/me/team/codes/:id/reactivate', requireTeamAuth, async (c:any)=>{
  const userId=c.get('userId') as string;const team=await ensureMasterTeam(c,userId);if(!team)return c.json({ok:false,error:'Equipo no encontrado.'},404);const id=String(c.req.param('id')||'')
  const row=await c.env.DB.prepare(`SELECT status,used_at FROM team_link_codes WHERE id=? AND team_id=? LIMIT 1`).bind(id,String((team as any).id)).first();if(!row)return c.json({ok:false,error:'Código no encontrado.'},404);if((row as any).used_at || String((row as any).status)==='used')return c.json({ok:false,error:'Un código utilizado no puede reactivarse.'},409)
  const result:any=await c.env.DB.prepare(`UPDATE team_link_codes SET status='active',expires_at=datetime('now','+${TEAM_CODE_TTL_HOURS} hours'),updated_at=datetime('now') WHERE id=? AND team_id=? AND used_at IS NULL`).bind(id,String((team as any).id)).run()
  if(Number(result?.meta?.changes || 0)<1)return c.json({ok:false,error:'No pudimos reactivar este código.'},409)
  const updated=await c.env.DB.prepare(`SELECT status,expires_at FROM team_link_codes WHERE id=? AND team_id=? LIMIT 1`).bind(id,String((team as any).id)).first()
  return c.json({ok:true,data:{status:String((updated as any)?.status||'active'),expires_at:String((updated as any)?.expires_at||''),valid_hours:TEAM_CODE_TTL_HOURS}})
})

app.post('/api/v1/public/team/code/inspect', async (c:any)=>{
  await cleanupExpiredTeamCodes(c.env);let body:any={};try{body=await c.req.json()}catch{return c.json({ok:false,error:'Solicitud inválida.'},400)}
  const code=normalizeCode(body.code),publicCode=normalizeCode(body.public_code);if(!code)return c.json({ok:false,error:'Ingresa el código de vinculación.'},400)
  const row=await c.env.DB.prepare(`SELECT tc.id,tc.status,tc.expires_at,tc.permissions_json,tc.used_at,tw.id team_id,tw.status team_status,p.name master_name,p.slug master_slug,a.id artifact_id,a.status artifact_status,a.owner_user_id artifact_owner_user_id FROM team_link_codes tc JOIN team_workspaces tw ON tw.id=tc.team_id JOIN profiles p ON p.id=tw.master_profile_id LEFT JOIN intap_artifacts a ON a.public_code=? WHERE tc.code=? LIMIT 1`).bind(publicCode,code).first()
  if(!row)return c.json({ok:false,error:'Código de vinculación no válido.'},404)
  if(String((row as any).team_status)!=='active')return c.json({ok:false,error:'Este Team no está disponible.'},409)
  if((row as any).used_at || String((row as any).status)==='used')return c.json({ok:false,error:'Este código ya fue utilizado.'},409)
  if(String((row as any).status)==='expired')return c.json({ok:false,error:'Este código caducó. Solicita uno nuevo al administrador Team.'},410)
  if(String((row as any).status)==='disabled')return c.json({ok:false,error:'Este código está desactivado. Solicita al administrador Team que lo reactive.'},409)
  if(!(row as any).artifact_id || (row as any).artifact_owner_user_id || !['available','unassigned'].includes(String((row as any).artifact_status||'')))return c.json({ok:false,error:'Este producto ya no está disponible para vincularse a un Team.'},409)
  const activation=await c.env.DB.prepare(`SELECT id FROM artifact_activation_codes WHERE artifact_id=? AND status='active' AND (expires_at IS NULL OR expires_at>datetime('now')) ORDER BY created_at DESC LIMIT 1`).bind(String((row as any).artifact_id)).first();if(!activation)return c.json({ok:false,error:'Este producto todavía no está habilitado para activación.'},409)
  return c.json({ok:true,data:{code,team_id:String((row as any).team_id),master_name:String((row as any).master_name||'Perfil Team'),master_slug:String((row as any).master_slug||''),expires_at:String((row as any).expires_at||''),permissions:readPermissions((row as any).permissions_json)}})
})

app.post('/api/v1/me/team/join', requireTeamAuth, async (c:any)=>{
  const userId=c.get('userId') as string;await cleanupExpiredTeamCodes(c.env);let body:any={};try{body=await c.req.json()}catch{return c.json({ok:false,error:'Solicitud inválida.'},400)}
  const code=normalizeCode(body.code),publicCode=normalizeCode(body.public_code)
  const invite=await c.env.DB.prepare(`SELECT tc.id,tc.team_id,tc.status,tc.expires_at,tc.permissions_json,tc.used_at,tw.master_profile_id,tw.owner_user_id team_owner_user_id,mp.name master_name,mp.slug master_slug,mp.bio master_bio,mp.category master_category,mp.subcategory master_subcategory,mp.theme_id master_theme_id,mp.layout_id master_layout_id,mp.free_palette_id master_palette_id,mp.avatar_url master_avatar_url,mp.hero_url master_hero_url,mp.template_data master_template_data,a.id artifact_id,a.status artifact_status,a.owner_user_id artifact_owner_user_id,ac.id activation_code_id FROM team_link_codes tc JOIN team_workspaces tw ON tw.id=tc.team_id JOIN profiles mp ON mp.id=tw.master_profile_id JOIN intap_artifacts a ON a.public_code=? LEFT JOIN artifact_activation_codes ac ON ac.id=(SELECT id FROM artifact_activation_codes WHERE artifact_id=a.id AND status='active' AND (expires_at IS NULL OR expires_at>datetime('now')) ORDER BY created_at DESC LIMIT 1) WHERE tc.code=? LIMIT 1`).bind(publicCode,code).first()
  if(!invite)return c.json({ok:false,error:'Código de vinculación no válido.'},404)
  if((invite as any).used_at || String((invite as any).status)==='used')return c.json({ok:false,error:'Este código ya fue utilizado.'},409)
  if(String((invite as any).status)!=='active')return c.json({ok:false,error:'Este código ya no está activo. Solicita uno nuevo al administrador Team.'},410)
  if((invite as any).artifact_owner_user_id || !['available','unassigned'].includes(String((invite as any).artifact_status||'')) || !(invite as any).activation_code_id)return c.json({ok:false,error:'Este producto ya no está disponible para vinculación.'},409)
  if(String((invite as any).team_owner_user_id)===userId)return c.json({ok:false,error:'El administrador Team no puede usar su propio código como miembro.'},409)
  if(await c.env.DB.prepare(`SELECT id FROM team_members WHERE user_id=? LIMIT 1`).bind(userId).first())return c.json({ok:false,error:'Esta cuenta ya pertenece a un Team.'},409)
  if(await c.env.DB.prepare(`SELECT id FROM team_workspaces WHERE owner_user_id=? LIMIT 1`).bind(userId).first())return c.json({ok:false,error:'Una cuenta administradora Team no puede convertirse en miembro.'},409)

  const existingProfile=await c.env.DB.prepare(`SELECT id,slug FROM profiles WHERE user_id=? LIMIT 1`).bind(userId).first();const profileId=existingProfile?String((existingProfile as any).id):crypto.randomUUID();const slug=existingProfile?String((existingProfile as any).slug||''):await nextTeamMemberSlug(c,String((invite as any).team_id),String((invite as any).master_slug||'team'))
  const permissions=readPermissions((invite as any).permissions_json);const masterTemplate=jsonObject((invite as any).master_template_data);const nextTemplate={...masterTemplate,role:'',free_identity_confirmed:false,team_member:true,team_id:String((invite as any).team_id),team_master_profile_id:String((invite as any).master_profile_id),team_permissions:permissions,team_joined_at:new Date().toISOString()}
  const [contact,links,gallery,services,user]=await Promise.all([
    c.env.DB.prepare(`SELECT whatsapp,email,phone,hours,address,map_url FROM profile_contact WHERE profile_id=? LIMIT 1`).bind(String((invite as any).master_profile_id)).first(),
    c.env.DB.prepare(`SELECT type,url,sort_order,enabled FROM profile_social_links WHERE profile_id=? ORDER BY sort_order`).bind(String((invite as any).master_profile_id)).all(),
    c.env.DB.prepare(`SELECT image_key,alt_text,title,description,sort_order FROM profile_gallery WHERE profile_id=? ORDER BY sort_order`).bind(String((invite as any).master_profile_id)).all(),
    c.env.DB.prepare(`SELECT title,description,price,image_url,whatsapp_text,is_featured,sort_order FROM profile_products WHERE profile_id=? ORDER BY sort_order`).bind(String((invite as any).master_profile_id)).all(),
    c.env.DB.prepare(`SELECT email FROM users WHERE id=? LIMIT 1`).bind(userId).first(),
  ])
  const statements:any[]=[]
  if(!existingProfile) statements.push(c.env.DB.prepare(`INSERT INTO profiles(id,user_id,slug,plan_id,theme_id,layout_id,name,bio,category,subcategory,free_palette_id,avatar_url,hero_url,template_data,is_published,created_at,updated_at) VALUES(?,?,?,'free',?,?,NULL,?,?,?,?,?,?,?,0,datetime('now'),datetime('now'))`).bind(profileId,userId,slug,String((invite as any).master_theme_id||'default'),String((invite as any).master_layout_id||'esencial'),String((invite as any).master_bio||''),String((invite as any).master_category||''),String((invite as any).master_subcategory||''),String((invite as any).master_palette_id||''),permissions.includes('photo')?null:String((invite as any).master_avatar_url||''),String((invite as any).master_hero_url||''),JSON.stringify(nextTemplate)))
  else {
    statements.push(c.env.DB.prepare(`UPDATE profiles SET name=NULL,bio=?,category=?,subcategory=?,theme_id=?,layout_id=?,free_palette_id=?,avatar_url=?,hero_url=?,template_data=?,is_published=0,updated_at=datetime('now') WHERE id=? AND user_id=?`).bind(String((invite as any).master_bio||''),String((invite as any).master_category||''),String((invite as any).master_subcategory||''),String((invite as any).master_theme_id||'default'),String((invite as any).master_layout_id||'esencial'),String((invite as any).master_palette_id||''),permissions.includes('photo')?null:String((invite as any).master_avatar_url||''),String((invite as any).master_hero_url||''),JSON.stringify(nextTemplate),profileId,userId))
    statements.push(c.env.DB.prepare(`DELETE FROM profile_social_links WHERE profile_id=?`).bind(profileId),c.env.DB.prepare(`DELETE FROM profile_gallery WHERE profile_id=?`).bind(profileId),c.env.DB.prepare(`DELETE FROM profile_products WHERE profile_id=?`).bind(profileId))
  }
  statements.push(c.env.DB.prepare(`INSERT INTO profile_contact(profile_id,whatsapp,email,phone,hours,address,map_url) VALUES(?,?,?,?,?,?,?) ON CONFLICT(profile_id) DO UPDATE SET whatsapp=excluded.whatsapp,email=excluded.email,phone=excluded.phone,hours=excluded.hours,address=excluded.address,map_url=excluded.map_url`).bind(profileId,(contact as any)?.whatsapp??null,(contact as any)?.email??null,(contact as any)?.phone??null,(contact as any)?.hours??null,(contact as any)?.address??null,(contact as any)?.map_url??null))
  for(const item of links.results||[])statements.push(c.env.DB.prepare(`INSERT INTO profile_social_links(id,profile_id,type,url,sort_order,enabled) VALUES(?,?,?,?,?,?)`).bind(crypto.randomUUID(),profileId,(item as any).type,(item as any).url,Number((item as any).sort_order||0),Number((item as any).enabled??1)))
  for(const item of gallery.results||[])statements.push(c.env.DB.prepare(`INSERT INTO profile_gallery(id,profile_id,image_key,alt_text,title,description,sort_order) VALUES(?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),profileId,(item as any).image_key,(item as any).alt_text,(item as any).title,(item as any).description,Number((item as any).sort_order||0)))
  for(const item of services.results||[])statements.push(c.env.DB.prepare(`INSERT INTO profile_products(id,profile_id,title,description,price,image_url,whatsapp_text,is_featured,sort_order) VALUES(?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),profileId,(item as any).title,(item as any).description,(item as any).price,(item as any).image_url,(item as any).whatsapp_text,Number((item as any).is_featured||0),Number((item as any).sort_order||0)))
  const memberId=crypto.randomUUID()
  statements.push(
    c.env.DB.prepare(`INSERT INTO team_members(id,team_id,user_id,profile_id,artifact_id,invite_code_id,status,permissions_json,joined_at,updated_at) SELECT ?,?,?,?,?,?,'active',?,datetime('now'),datetime('now') WHERE EXISTS(SELECT 1 FROM team_link_codes WHERE id=? AND status='active' AND used_at IS NULL AND expires_at>datetime('now'))`).bind(memberId,String((invite as any).team_id),userId,profileId,String((invite as any).artifact_id),String((invite as any).id),JSON.stringify(permissions),String((invite as any).id)),
    c.env.DB.prepare(`UPDATE intap_artifacts SET owner_user_id=?,profile_id=?,status='activated',activated_at=datetime('now'),updated_at=datetime('now') WHERE id=? AND owner_user_id IS NULL AND status IN('available','unassigned')`).bind(userId,profileId,String((invite as any).artifact_id)),
    c.env.DB.prepare(`UPDATE artifact_activation_codes SET status='used',used_at=datetime('now') WHERE id=? AND status='active'`).bind(String((invite as any).activation_code_id)),
    c.env.DB.prepare(`UPDATE team_link_codes SET status='used',used_at=datetime('now'),used_by_user_id=?,artifact_id=?,member_profile_id=?,updated_at=datetime('now') WHERE id=? AND status='active' AND used_at IS NULL AND expires_at>datetime('now')`).bind(userId,String((invite as any).artifact_id),profileId,String((invite as any).id)),
    c.env.DB.prepare(`INSERT INTO user_notifications(id,user_id,profile_id,type,title,message,source_type,action_label,action_url,created_at) VALUES(?,?,?,'team_member_joined','Nuevo dispositivo vinculado al Team',?,'team','Abrir Team','/admin/free/team',datetime('now'))`).bind(crypto.randomUUID(),String((invite as any).team_owner_user_id),String((invite as any).master_profile_id),`El código ${code} fue utilizado. Producto ${publicCode} · ${String((user as any)?.email || 'usuario registrado')}.`),
  )
  try{await c.env.DB.batch(statements)}catch(error){console.error('[team/join] atomic batch failed',error);return c.json({ok:false,error:'No pudimos completar la vinculación. El código y el producto no fueron consumidos.'},409)}
  return c.json({ok:true,data:{team_id:String((invite as any).team_id),profile_id:profileId,public_code:publicCode,master_name:String((invite as any).master_name||''),master_slug:String((invite as any).master_slug||''),permissions,next_url:'/admin/free/team/member'}})
})

app.post('/api/v1/me/team/member/device/deactivate', requireTeamAuth, async (c:any)=>{
  const userId=c.get('userId') as string;const member=await c.env.DB.prepare(`SELECT id,artifact_id FROM team_members WHERE user_id=? LIMIT 1`).bind(userId).first();if(!member)return c.json({ok:false,error:'No perteneces a un Team.'},404)
  await c.env.DB.batch([c.env.DB.prepare(`UPDATE team_members SET status='inactive',updated_at=datetime('now') WHERE id=?`).bind(String((member as any).id)),c.env.DB.prepare(`UPDATE intap_artifacts SET status='suspended',updated_at=datetime('now') WHERE id=? AND owner_user_id=?`).bind(String((member as any).artifact_id),userId)]);return c.json({ok:true})
})
app.post('/api/v1/me/team/member/device/reactivate', requireTeamAuth, async (c:any)=>{
  const userId=c.get('userId') as string;const member=await c.env.DB.prepare(`SELECT id,artifact_id,profile_id FROM team_members WHERE user_id=? LIMIT 1`).bind(userId).first();if(!member)return c.json({ok:false,error:'No perteneces a un Team.'},404)
  await c.env.DB.batch([c.env.DB.prepare(`UPDATE team_members SET status='active',updated_at=datetime('now') WHERE id=?`).bind(String((member as any).id)),c.env.DB.prepare(`UPDATE intap_artifacts SET status='activated',profile_id=?,updated_at=datetime('now') WHERE id=? AND owner_user_id=?`).bind(String((member as any).profile_id),String((member as any).artifact_id),userId)]);return c.json({ok:true})
})

export default app
