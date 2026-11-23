// G7.2-A isolated Stage API: exactly two authenticated SELECT-only endpoints.
// Never import preview-free-entry, frontdoor, sponsor-commercial-sales, or route registries.
import { Hono } from 'hono'
import { cookieNames } from './lib/cookies'
import { resolveSponsorMembership } from './sponsored-multiprofile-access'
import { commercialPage } from './sponsor-commercial-pages'

const app=new Hono<{Bindings:{ENVIRONMENT:string}}>()
async function digest(input:string){
 const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input))
 return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('')
}
function cookie(header:string,name:string){
 const prefix=name+'='
 const part=header.split(';').map(x=>x.trim()).find(x=>x.startsWith(prefix))
 if(!part)return''
 try{return decodeURIComponent(part.slice(prefix.length))}catch{return''}
}
async function authorized(c:any){
 const raw=cookie(c.req.header('Cookie')||'',cookieNames(c.env).session)
 if(!raw)return null
 const session=await c.env.DB.prepare("SELECT user_id FROM auth_sessions WHERE session_hash=? AND expires_at>datetime('now') AND revoked_at IS NULL LIMIT 1").bind(await digest(raw)).first()
 if(!session)return null
 const userId=String(session.user_id||'')
 const membership=await resolveSponsorMembership(c,userId)
 if(!membership||!['owner','admin'].includes(String(membership.role)))return null
 const sponsorId=String(membership.sponsor_id||'')
 const grant=await c.env.DB.prepare("SELECT 1 FROM sponsor_module_grants WHERE sponsor_id=? AND module_code IN ('commercial_seller','commercial_visitor') AND enabled=1 LIMIT 1").bind(sponsorId).first()
 return grant?{userId,sponsorId}:null
}
for(const resource of ['sellers','assignments'] as const){
 app.get('/api/v1/sponsor/commercial/'+resource+'/page',async c=>{
  if(c.env.ENVIRONMENT!=='preview')return c.json({ok:false,error:'Not found'},404)
  return commercialPage(c,resource,authorized)
 })
}
app.all('*',c=>c.json({ok:false,error:'Not found'},404))
export default app
