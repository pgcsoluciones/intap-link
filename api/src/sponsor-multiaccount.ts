import app from './index'
import { cookieNames } from './lib/cookies'
import { listSponsorAccounts, resolveSponsorMembership, setSponsorContext, sponsoredMultiProfileAccess } from './sponsored-multiprofile-access'

async function sha256Hex(input:string){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input));return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('')}
function parseCookie(header:string,name:string){const escaped=name.replace(/[.*+?^$()|[\]\\]/g,'\\$&');const match=header.match(new RegExp('(?:^|;\\s*)'+escaped+'=([^;]*)'));return match?decodeURIComponent(match[1]):null}
async function sessionUserId(c:any){const raw=parseCookie(c.req.header('Cookie')||'',cookieNames(c.env).session);if(!raw)return'';const row=await c.env.DB.prepare("SELECT user_id FROM auth_sessions WHERE session_hash=? AND expires_at>datetime('now') AND revoked_at IS NULL LIMIT 1").bind(await sha256Hex(raw)).first();return row?String((row as any).user_id||''):''}
async function requireUser(c:any,next:any){const id=await sessionUserId(c);if(!id)return c.json({ok:false,error:'Unauthorized'},401);c.set('userId',id);await next()}

app.get('/api/v1/sponsor/accounts',requireUser,async(c:any)=>{
  const userId=String(c.get('userId')||'')
  const multi=await sponsoredMultiProfileAccess(c,userId)
  const accounts=await listSponsorAccounts(c,userId)
  const current=await resolveSponsorMembership(c,userId)
  return c.json({ok:true,data:{
    multi_account:multi,
    current_sponsor_id:String((current as any)?.sponsor_id||''),
    accounts:multi?accounts:accounts.slice(0,1),
  }})
})

app.post('/api/v1/sponsor/context',requireUser,async(c:any)=>{
  const userId=String(c.get('userId')||''),body=await c.req.json().catch(()=>({})),sponsorId=String(body.sponsor_id||'').trim()
  if(!sponsorId)return c.json({ok:false,error:'Patrocinador requerido.'},422)
  if(!(await sponsoredMultiProfileAccess(c,userId)))return c.json({ok:false,error:'Esta cuenta no tiene acceso multicuenta.'},403)
  if(!(await setSponsorContext(c,userId,sponsorId)))return c.json({ok:false,error:'No tienes acceso a ese patrocinador.'},403)
  return c.json({ok:true,data:{sponsor_id:sponsorId}})
})

export default app
