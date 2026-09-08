import app from './index'
import { buildScopedCookie, cookieNames } from './lib/cookies'

const ROLES = new Set(['editor','subadmin'])

function clean(value: unknown){return String(value||'').trim()}
function parseCookie(header:string,name:string){const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const m=header.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`));return m?decodeURIComponent(m[1]):null}
async function sha256Hex(input:string){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input));return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('')}
function hex(bytes:Uint8Array){return Array.from(bytes).map(b=>b.toString(16).padStart(2,'0')).join('')}
async function passwordHash(password:string,saltHex:string){const salt=new Uint8Array((saltHex.match(/.{1,2}/g)||[]).map(part=>parseInt(part,16)));const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:150000,hash:'SHA-256'},key,256);return hex(new Uint8Array(bits))}
function randomPassword(length=12){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';const bytes=new Uint8Array(length);crypto.getRandomValues(bytes);return Array.from(bytes,v=>alphabet[v%alphabet.length]).join('')}
async function newPasswordRecord(password:string){const salt=crypto.getRandomValues(new Uint8Array(16));const saltHex=hex(salt);return {salt:saltHex,hash:await passwordHash(password,saltHex)}}
function newSessionToken(){const bytes=crypto.getRandomValues(new Uint8Array(32));return hex(bytes)}
function appUrl(c:any){return String(c.env.APP_URL||((String(c.env.ENVIRONMENT||'').toLowerCase()==='preview')?'https://app.preview.intaprd.com':'https://app.intaprd.com')).replace(/\/$/,'')}
async function sessionUserId(c:any){const raw=parseCookie(c.req.header('Cookie')||'',cookieNames(c.env).session);if(!raw)return null;const row=await c.env.DB.prepare(`SELECT user_id FROM auth_sessions WHERE session_hash=? AND expires_at>datetime('now') AND revoked_at IS NULL LIMIT 1`).bind(await sha256Hex(raw)).first();return row?String((row as any).user_id||''):null}
async function requireAuth(c:any,next:any){const id=await sessionUserId(c);if(!id)return c.json({ok:false,error:'Unauthorized'},401);c.set('userId',id);await next()}
async function masterTeam(c:any,userId:string){return c.env.DB.prepare(`SELECT id FROM team_workspaces WHERE owner_user_id=? AND status='active' LIMIT 1`).bind(userId).first()}

app.get('/api/v1/public/team/member-access/status',async(c:any)=>{
  const slug=clean(c.req.query('slug')).toLowerCase();if(!slug)return c.json({ok:false,error:'Perfil requerido.'},400)
  const row=await c.env.DB.prepare(`SELECT tm.id,tm.admin_role,tm.status,tw.name team_name,p.slug FROM profiles p JOIN team_members tm ON tm.profile_id=p.id JOIN team_workspaces tw ON tw.id=tm.team_id WHERE lower(p.slug)=lower(?) AND p.is_active=1 AND p.is_published=1 AND tm.status='active' AND tw.status='active' LIMIT 1`).bind(slug).first()
  if(!row)return c.json({ok:true,data:{enabled:false}})
  const role=String((row as any).admin_role||'member')
  return c.json({ok:true,data:{enabled:ROLES.has(role),role:ROLES.has(role)?role:null,team_name:String((row as any).team_name||'')}})
})

app.post('/api/v1/public/team/member-access/login',async(c:any)=>{
  let body:any={};try{body=await c.req.json()}catch{return c.json({ok:false,error:'Solicitud inválida.'},400)}
  const slug=clean(body.slug).toLowerCase(),password=String(body.password||'')
  if(!slug||!password)return c.json({ok:false,error:'Contraseña requerida.'},400)
  const row=await c.env.DB.prepare(`SELECT tm.id member_id,tm.user_id,tm.admin_role,tm.status,cred.password_salt,cred.password_hash,cred.must_change_password,cred.failed_attempts,cred.locked_until FROM profiles p JOIN team_members tm ON tm.profile_id=p.id JOIN team_workspaces tw ON tw.id=tm.team_id LEFT JOIN team_member_credentials cred ON cred.team_member_id=tm.id WHERE lower(p.slug)=lower(?) AND p.is_active=1 AND tm.status='active' AND tw.status='active' LIMIT 1`).bind(slug).first()
  if(!row||!ROLES.has(String((row as any).admin_role||''))||!(row as any).password_hash)return c.json({ok:false,error:'Acceso no disponible para este perfil.'},403)
  if((row as any).locked_until&&String((row as any).locked_until)>new Date().toISOString().replace('T',' ').slice(0,19))return c.json({ok:false,error:'Acceso temporalmente bloqueado. Intenta más tarde.'},429)
  const candidate=await passwordHash(password,String((row as any).password_salt||''))
  if(candidate!==String((row as any).password_hash||'')){
    const attempts=Number((row as any).failed_attempts||0)+1
    await c.env.DB.prepare(`UPDATE team_member_credentials SET failed_attempts=?,locked_until=CASE WHEN ?>=5 THEN datetime('now','+15 minutes') ELSE NULL END,updated_at=datetime('now') WHERE team_member_id=?`).bind(attempts,attempts,String((row as any).member_id)).run()
    return c.json({ok:false,error:attempts>=5?'Demasiados intentos. Espera 15 minutos.':'Contraseña incorrecta.'},401)
  }
  const raw=newSessionToken(),hash=await sha256Hex(raw),id=crypto.randomUUID();const ip=c.req.header('CF-Connecting-IP')||'',ua=c.req.header('User-Agent')||''
  await c.env.DB.batch([
    c.env.DB.prepare(`INSERT INTO auth_sessions(id,user_id,session_hash,created_at,expires_at,ip,user_agent) VALUES(?,?,?,datetime('now'),datetime('now','+30 days'),?,?)`).bind(id,String((row as any).user_id),hash,ip,ua),
    c.env.DB.prepare(`UPDATE team_member_credentials SET failed_attempts=0,locked_until=NULL,last_login_at=datetime('now'),updated_at=datetime('now') WHERE team_member_id=?`).bind(String((row as any).member_id)),
  ])
  const cookie=buildScopedCookie(c.env,appUrl(c),cookieNames(c.env).session,raw,30*24*60*60)
  return c.json({ok:true,data:{role:String((row as any).admin_role),must_change_password:Number((row as any).must_change_password||0)===1,next_url:'/admin/free/team'}},200,{'Set-Cookie':cookie})
})

app.post('/api/v1/me/team/access/change-password',requireAuth,async(c:any)=>{
  const userId=c.get('userId') as string;let body:any={};try{body=await c.req.json()}catch{return c.json({ok:false,error:'Solicitud inválida.'},400)}
  const password=String(body.password||'');if(password.length<8)return c.json({ok:false,error:'La contraseña debe tener al menos 8 caracteres.'},400)
  const member=await c.env.DB.prepare(`SELECT id,admin_role FROM team_members WHERE user_id=? AND status='active' LIMIT 1`).bind(userId).first();if(!member||!ROLES.has(String((member as any).admin_role||'')))return c.json({ok:false,error:'Acceso Team no disponible.'},403)
  const rec=await newPasswordRecord(password);await c.env.DB.prepare(`UPDATE team_member_credentials SET password_salt=?,password_hash=?,must_change_password=0,failed_attempts=0,locked_until=NULL,password_changed_at=datetime('now'),updated_at=datetime('now') WHERE team_member_id=?`).bind(rec.salt,rec.hash,String((member as any).id)).run();return c.json({ok:true})
})

app.post('/api/v1/me/team/members/:id/role',requireAuth,async(c:any)=>{
  const userId=c.get('userId') as string;const team=await masterTeam(c,userId);if(!team)return c.json({ok:false,error:'Solo el Administrador Master puede asignar roles.'},403)
  let body:any={};try{body=await c.req.json()}catch{return c.json({ok:false,error:'Solicitud inválida.'},400)}
  const role=String(body.role||'member');if(!['member','editor','subadmin'].includes(role))return c.json({ok:false,error:'Rol no válido.'},400)
  const memberId=String(c.req.param('id')||'');const target=await c.env.DB.prepare(`SELECT id,admin_role FROM team_members WHERE id=? AND team_id=? LIMIT 1`).bind(memberId,String((team as any).id)).first();if(!target)return c.json({ok:false,error:'Miembro no encontrado.'},404)
  if(ROLES.has(role)){const other=await c.env.DB.prepare(`SELECT id FROM team_members WHERE team_id=? AND admin_role=? AND id<>? LIMIT 1`).bind(String((team as any).id),role,memberId).first();if(other)return c.json({ok:false,error:role==='editor'?'Free permite un solo Editor por Team.':'Free permite un solo Subadministrador por Team.'},409)}
  let temporaryPassword:string|null=null
  if(ROLES.has(role)){
    const existing=await c.env.DB.prepare(`SELECT team_member_id FROM team_member_credentials WHERE team_member_id=? LIMIT 1`).bind(memberId).first()
    if(!existing){temporaryPassword=randomPassword();const rec=await newPasswordRecord(temporaryPassword);await c.env.DB.prepare(`INSERT INTO team_member_credentials(team_member_id,password_salt,password_hash,must_change_password,created_at,updated_at) VALUES(?,?,?,1,datetime('now'),datetime('now'))`).bind(memberId,rec.salt,rec.hash).run()}
  }else{
    await c.env.DB.prepare(`DELETE FROM team_member_credentials WHERE team_member_id=?`).bind(memberId).run()
    await c.env.DB.prepare(`UPDATE auth_sessions SET revoked_at=datetime('now') WHERE user_id=(SELECT user_id FROM team_members WHERE id=?) AND revoked_at IS NULL`).bind(memberId).run()
  }
  await c.env.DB.prepare(`UPDATE team_members SET admin_role=?,updated_at=datetime('now') WHERE id=? AND team_id=?`).bind(role,memberId,String((team as any).id)).run()
  return c.json({ok:true,data:{role,temporary_password:temporaryPassword}})
})

export default app
