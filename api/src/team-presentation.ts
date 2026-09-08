import app from './index'
import { cookieNames } from './lib/cookies'

const TEAM_PAGE_SIZE = 8
const TEAM_CODE_TTL_HOURS = 24
const TEAM_PERMISSIONS = ['name','role','photo','phone','email','whatsapp','portfolio','services','links','quick_actions','location','design'] as const

async function sha256Hex(input: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('')
}
function parseCookie(header: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = header.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}
async function userId(c: any) {
  const raw = parseCookie(c.req.header('Cookie') || '', cookieNames(c.env).session)
  if (!raw) return null
  const row = await c.env.DB.prepare(`SELECT user_id FROM auth_sessions WHERE session_hash=? AND expires_at>datetime('now') AND revoked_at IS NULL LIMIT 1`).bind(await sha256Hex(raw)).first()
  return row ? String((row as any).user_id || '') : null
}
async function requireAuth(c: any, next: any) {
  const id = await userId(c)
  if (!id) return c.json({ ok:false,error:'Unauthorized' },401)
  c.set('userId',id)
  await next()
}
function parsePermissions(value: unknown) {
  const allowed = new Set<string>(TEAM_PERMISSIONS)
  const incoming = Array.isArray(value) ? value.map(String) : []
  return Array.from(new Set(['name','role',...incoming.filter((key) => allowed.has(key))]))
}
function readPermissions(raw: unknown) { try { return parsePermissions(JSON.parse(String(raw || '[]'))) } catch { return ['name','role'] } }
function generateTeamCode() {
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const bytes=new Uint8Array(8); crypto.getRandomValues(bytes)
  const token=Array.from(bytes,(value)=>alphabet[value%alphabet.length]).join('')
  return `TEAM-${token.slice(0,4)}-${token.slice(4)}`
}
async function getMasterTeam(c:any,userId:string){
  const membership=await c.env.DB.prepare(`SELECT id FROM team_members WHERE user_id=? LIMIT 1`).bind(userId).first()
  if(membership)return null
  const profile=await c.env.DB.prepare(`SELECT id,name FROM profiles WHERE user_id=? AND is_active=1 LIMIT 1`).bind(userId).first()
  if(!profile)return null
  let team=await c.env.DB.prepare(`SELECT * FROM team_workspaces WHERE owner_user_id=? LIMIT 1`).bind(userId).first()
  if(!team){const id=crypto.randomUUID();await c.env.DB.prepare(`INSERT INTO team_workspaces(id,master_profile_id,owner_user_id,name,status,created_at,updated_at) VALUES(?,?,?,NULL,'active',datetime('now'),datetime('now'))`).bind(id,String((profile as any).id),userId).run();team=await c.env.DB.prepare(`SELECT * FROM team_workspaces WHERE id=? LIMIT 1`).bind(id).first()}
  return team
}

app.get('/api/v1/me/team',requireAuth,async(c:any)=>{
  const team=await getMasterTeam(c,c.get('userId') as string)
  if(!team)return c.json({ok:false,error:'Esta cuenta no puede administrar un Team.'},409)
  const teamId=String((team as any).id);const q=String(c.req.query('q')||'').trim();const like=`%${q}%`;const page=Math.max(1,Number(c.req.query('page')||1)||1);const offset=(page-1)*TEAM_PAGE_SIZE
  const [rows,count,memberCount]=await Promise.all([
    c.env.DB.prepare(`SELECT tc.id,tc.code,tc.status raw_status,tc.permissions_json,tc.expires_at,tc.used_at,tc.created_at,tc.updated_at,tc.artifact_id,pc.email used_by_email,p.name member_name,p.slug member_slug,a.public_code product_code,a.product_type FROM team_link_codes tc LEFT JOIN profiles p ON p.id=tc.member_profile_id LEFT JOIN profile_contact pc ON pc.profile_id=p.id LEFT JOIN intap_artifacts a ON a.id=tc.artifact_id WHERE tc.team_id=? AND (?='' OR tc.code LIKE ? OR COALESCE(pc.email,'') LIKE ? OR COALESCE(p.name,'') LIKE ? OR COALESCE(a.public_code,'') LIKE ?) ORDER BY tc.created_at DESC LIMIT ? OFFSET ?`).bind(teamId,q,like,like,like,like,TEAM_PAGE_SIZE,offset).all(),
    c.env.DB.prepare(`SELECT COUNT(*) n FROM team_link_codes tc LEFT JOIN profiles p ON p.id=tc.member_profile_id LEFT JOIN profile_contact pc ON pc.profile_id=p.id LEFT JOIN intap_artifacts a ON a.id=tc.artifact_id WHERE tc.team_id=? AND (?='' OR tc.code LIKE ? OR COALESCE(pc.email,'') LIKE ? OR COALESCE(p.name,'') LIKE ? OR COALESCE(a.public_code,'') LIKE ?)`).bind(teamId,q,like,like,like,like).first(),
    c.env.DB.prepare(`SELECT COUNT(*) n FROM team_members WHERE team_id=?`).bind(teamId).first(),
  ])
  const total=Number((count as any)?.n||0)
  const codes=(rows.results||[]).map((row:any)=>({
    ...row,
    status: row.raw_status==='used'?'assigned':row.raw_status==='disabled'?'disabled':row.raw_status==='expired'?'expired':'created',
    assignment_status: row.raw_status==='used'?'assigned':'unassigned',
    permissions:readPermissions(row.permissions_json),
  }))
  return c.json({ok:true,data:{team:{id:teamId,master_profile_id:String((team as any).master_profile_id),name:String((team as any).name||''),name_confirmed:Number((team as any).name_confirmed||0)===1,status:String((team as any).status||'active')},codes,pagination:{page,page_size:TEAM_PAGE_SIZE,total,pages:Math.max(1,Math.ceil(total/TEAM_PAGE_SIZE))},member_count:Number((memberCount as any)?.n||0),permission_options:TEAM_PERMISSIONS}})
})

app.post('/api/v1/me/team/codes',requireAuth,async(c:any)=>{
  const team=await getMasterTeam(c,c.get('userId') as string)
  if(!team)return c.json({ok:false,error:'Esta cuenta no puede administrar un Team.'},409)
  if(Number((team as any).name_confirmed||0)!==1||!String((team as any).name||'').trim())return c.json({ok:false,error:'Primero asigna y guarda un nombre para tu Team.'},409)
  let body:any={};try{body=await c.req.json()}catch{return c.json({ok:false,error:'Solicitud inválida.'},400)}
  const count=Math.min(50,Math.max(1,Number(body.count||1)||1));const permissions=parsePermissions(body.permissions);const created:any[]=[]
  for(let i=0;i<count;i+=1){let code=generateTeamCode();for(let retry=0;retry<5;retry+=1){const exists=await c.env.DB.prepare(`SELECT id FROM team_link_codes WHERE code=? LIMIT 1`).bind(code).first();if(!exists)break;code=generateTeamCode()}const id=crypto.randomUUID();await c.env.DB.prepare(`INSERT INTO team_link_codes(id,team_id,code,status,permissions_json,expires_at,created_at,updated_at) VALUES(?,?,?,'active',?,datetime('now','+${TEAM_CODE_TTL_HOURS} hours'),datetime('now'),datetime('now'))`).bind(id,String((team as any).id),code,JSON.stringify(permissions)).run();created.push({id,code,status:'created',assignment_status:'unassigned',permissions,valid_hours:TEAM_CODE_TTL_HOURS})}
  return c.json({ok:true,data:created})
})

export default app
