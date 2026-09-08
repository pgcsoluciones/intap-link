import app from './index'
import { cookieNames } from './lib/cookies'

async function sha256Hex(input:string){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input));return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('')}
function parseCookie(header:string,name:string){const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const m=header.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`));return m?decodeURIComponent(m[1]):null}
async function sessionUserId(c:any){const raw=parseCookie(c.req.header('Cookie')||'',cookieNames(c.env).session);if(!raw)return null;const row=await c.env.DB.prepare(`SELECT user_id FROM auth_sessions WHERE session_hash=? AND expires_at>datetime('now') AND revoked_at IS NULL LIMIT 1`).bind(await sha256Hex(raw)).first();return row?String((row as any).user_id||''):null}
async function requireAuth(c:any,next:any){const id=await sessionUserId(c);if(!id)return c.json({ok:false,error:'Unauthorized'},401);c.set('userId',id);await next()}
function permissions(raw:unknown){try{const p=JSON.parse(String(raw||'[]'));return Array.isArray(p)?p.map(String):[]}catch{return []}}
async function access(c:any,userId:string){const master=await c.env.DB.prepare(`SELECT id team_id,'master' role FROM team_workspaces WHERE owner_user_id=? AND status='active' LIMIT 1`).bind(userId).first();if(master)return master;return c.env.DB.prepare(`SELECT tm.team_id,tm.admin_role role FROM team_members tm JOIN team_workspaces tw ON tw.id=tm.team_id WHERE tm.user_id=? AND tm.status='active' AND tw.status='active' LIMIT 1`).bind(userId).first()}

app.post('/api/v1/me/team/members/:id/avatar',requireAuth,async(c:any)=>{
  const requester=c.get('userId') as string;const grant=await access(c,requester);const role=String((grant as any)?.role||'')
  if(!grant||!['master','editor','subadmin'].includes(role))return c.json({ok:false,error:'Tu rol no permite editar miembros.'},403)
  const member=await c.env.DB.prepare(`SELECT tm.id,tm.profile_id,tm.permissions_json FROM team_members tm WHERE tm.id=? AND tm.team_id=? LIMIT 1`).bind(String(c.req.param('id')||''),String((grant as any).team_id)).first()
  if(!member)return c.json({ok:false,error:'Miembro no encontrado.'},404)
  if(role!=='master'&&!permissions((member as any).permissions_json).includes('photo'))return c.json({ok:false,error:'Foto no está habilitada para este miembro.'},403)
  const fd=await c.req.formData();const fileVal=fd.get('file')
  if(!(fileVal&&typeof fileVal==='object'&&'name' in (fileVal as any)&&'stream' in (fileVal as any)))return c.json({ok:false,error:'Archivo requerido.'},400)
  const file=fileVal as any as File;const ext=file.name.split('.').pop()?.toLowerCase()||'jpg';if(!['jpg','jpeg','png','webp'].includes(ext))return c.json({ok:false,error:'Formato no permitido.'},400)
  if(Number((file as any).size||0)>8*1024*1024)return c.json({ok:false,error:'La imagen supera 8 MB.'},413)
  const profileId=String((member as any).profile_id),key=`avatars/${profileId}/${crypto.randomUUID()}.${ext}`
  await c.env.BUCKET.put(key,file.stream(),{httpMetadata:{contentType:file.type||'image/jpeg'}})
  const origin=new URL(c.req.url).origin,encodedKey=key.split('/').map(encodeURIComponent).join('/'),avatarUrl=`${origin}/api/v1/public/assets/${encodedKey}`
  await c.env.DB.prepare(`UPDATE profiles SET avatar_url=?,updated_at=datetime('now') WHERE id=?`).bind(avatarUrl,profileId).run()
  return c.json({ok:true,avatar_url:avatarUrl})
})

export default app
