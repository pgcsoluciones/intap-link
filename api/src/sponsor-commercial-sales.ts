import app from './index'
import { cookieNames } from './lib/cookies'
import { resolveSponsorMembership } from './sponsored-multiprofile-access'

async function digest(input:string){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input));return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('')}
function cookie(header:string,name:string){const esc=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const match=header.match(new RegExp('(?:^|;\\s*)'+esc+'=([^;]*)'));return match?decodeURIComponent(match[1]):''}
async function authorized(c:any){
 const raw=cookie(c.req.header('Cookie')||'',cookieNames(c.env).session)
 if(!raw)return null
 const s=await c.env.DB.prepare("SELECT user_id FROM auth_sessions WHERE session_hash=? AND expires_at>datetime('now') AND revoked_at IS NULL LIMIT 1").bind(await digest(raw)).first()
 if(!s)return null
 const userId=String((s as any).user_id||'')
 const membership=await resolveSponsorMembership(c,userId)
 if(!membership||!['owner','admin'].includes(String((membership as any).role)))return null
 const sponsorId=String((membership as any).sponsor_id||'')
 const flag=await c.env.DB.prepare("SELECT enabled FROM sponsor_module_grants WHERE sponsor_id=? AND module_code='commercial_seller' LIMIT 1").bind(sponsorId).first()
 if(Number((flag as any)?.enabled)!==1)return null
 return {userId,sponsorId}
}
const trim=(x:unknown,n=120)=>String(x??'').trim().slice(0,n)
app.get('/api/v1/sponsor/commercial/sellers',async(c:any)=>{
 const ctx=await authorized(c);if(!ctx)return c.json({ok:false,error:'Acceso comercial no habilitado para esta empresa.'},403)
 const [reps,assignments]=await Promise.all([
 c.env.DB.prepare("SELECT * FROM sponsor_sales_representatives WHERE sponsor_id=? ORDER BY active DESC,first_name,last_name").bind(ctx.sponsorId).all(),
 c.env.DB.prepare("SELECT a.*,sa.artifact_id,ia.public_code FROM sponsor_sales_assignments a JOIN sponsor_artifacts sa ON sa.id=a.sponsor_artifact_id JOIN intap_artifacts ia ON ia.id=sa.artifact_id WHERE a.sponsor_id=? ORDER BY a.assigned_at DESC").bind(ctx.sponsorId).all()
 ])
 return c.json({ok:true,data:{sellers:reps.results||[],assignments:assignments.results||[]}})
})
app.post('/api/v1/sponsor/commercial/sellers/import',async(c:any)=>{
 const ctx=await authorized(c);if(!ctx)return c.json({ok:false,error:'Acceso no autorizado.'},403)
 const body=await c.req.json().catch(()=>({}));const rows=Array.isArray(body.rows)?body.rows:[]
 if(rows.length<1||rows.length>250)return c.json({ok:false,error:'Importa entre 1 y 250 vendedores por lote.'},422)
 const prepared:any[]=[]
 for(let i=0;i<rows.length;i++){
  const r=rows[i]||{},first=trim(r.first_name,100),last=trim(r.last_name,100),wa=trim(r.whatsapp,40)
  if(!first||!wa||!/^[+()0-9 .-]{7,40}$/.test(wa))return c.json({ok:false,error:'Fila '+(i+1)+': nombre y WhatsApp válido requeridos.'},422)
  prepared.push({id:crypto.randomUUID(),first,last,wa,email:trim(r.email,180),zone:trim(r.zone,120),territory:trim(r.territory,120),employee:trim(r.employee_code,70)})
 }
 await c.env.DB.batch(prepared.map(r=>c.env.DB.prepare("INSERT INTO sponsor_sales_representatives(id,sponsor_id,employee_code,first_name,last_name,whatsapp,email,zone,territory) VALUES (?,?,?,?,?,?,?,?,?)").bind(r.id,ctx.sponsorId,r.employee,r.first,r.last,r.wa,r.email,r.zone,r.territory)))
 return c.json({ok:true,created:prepared.length})
})
app.patch('/api/v1/sponsor/commercial/sellers/:id',async(c:any)=>{
 const ctx=await authorized(c);if(!ctx)return c.json({ok:false,error:'Acceso no autorizado.'},403)
 const id=trim(c.req.param('id'),80),body=await c.req.json().catch(()=>({}))
 if(typeof body.active!=='boolean')return c.json({ok:false,error:'Estado obligatorio.'},422)
 const changed=await c.env.DB.prepare("UPDATE sponsor_sales_representatives SET active=?,updated_at=datetime('now') WHERE id=? AND sponsor_id=?").bind(body.active?1:0,id,ctx.sponsorId).run()
 if(!changed.meta?.changes)return c.json({ok:false,error:'Vendedor no encontrado.'},404)
 return c.json({ok:true})
})
app.post('/api/v1/sponsor/commercial/assign',async(c:any)=>{
 const ctx=await authorized(c);if(!ctx)return c.json({ok:false,error:'Acceso no autorizado.'},403)
 const body=await c.req.json().catch(()=>({})),repId=trim(body.representative_id,80),codes=Array.isArray(body.codes)?body.codes.map((v:any)=>trim(v,70).toUpperCase()):[]
 const distinct=[...new Set(codes)].filter(Boolean)
 if(!repId||!distinct.length||distinct.length>250)return c.json({ok:false,error:'Selecciona vendedor y de 1 a 250 códigos.'},422)
 const seller=await c.env.DB.prepare("SELECT id FROM sponsor_sales_representatives WHERE id=? AND sponsor_id=? AND active=1").bind(repId,ctx.sponsorId).first()
 if(!seller)return c.json({ok:false,error:'Vendedor no disponible para este patrocinador.'},404)
 const placeholders=distinct.map(()=>'?').join(',')
 const artifacts=await c.env.DB.prepare("SELECT sa.id,ia.public_code FROM sponsor_artifacts sa JOIN intap_artifacts ia ON ia.id=sa.artifact_id WHERE sa.sponsor_id=? AND COALESCE(sa.artifact_role,'beneficiary')<>'master' AND ia.public_code IN ("+placeholders+")").bind(ctx.sponsorId,...distinct).all()
 const found=artifacts.results||[];if(found.length!==distinct.length)return c.json({ok:false,error:'Los códigos deben pertenecer todos a este patrocinador y no ser Master.'},422)
 const group=trim(body.group_label,120),ops:any[]=[]
 for(const item of found){
  ops.push(c.env.DB.prepare("UPDATE sponsor_sales_assignments SET active=0,ended_at=datetime('now') WHERE sponsor_id=? AND sponsor_artifact_id=? AND active=1").bind(ctx.sponsorId,item.id))
  ops.push(c.env.DB.prepare("INSERT INTO sponsor_sales_assignments(id,sponsor_id,sponsor_artifact_id,representative_id,group_label,assigned_by_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(),ctx.sponsorId,item.id,repId,group,ctx.userId))
 }
 await c.env.DB.batch(ops)
 return c.json({ok:true,assigned:found.length})
})
app.get('/api/v1/sponsor/commercial/config',async(c:any)=>{
 const raw=cookie(c.req.header('Cookie')||'',cookieNames(c.env).session)
 if(!raw)return c.json({ok:false,error:'Sin sesión.'},401)
 const s=await c.env.DB.prepare("SELECT user_id FROM auth_sessions WHERE session_hash=? AND expires_at>datetime('now') AND revoked_at IS NULL LIMIT 1").bind(await digest(raw)).first()
 if(!s)return c.json({ok:false,error:'Sin sesión.'},401)
 const membership=await resolveSponsorMembership(c,String((s as any).user_id||''))
 if(!membership)return c.json({ok:false,error:'Sin patrocinador seleccionado.'},403)
 const sponsorId=String((membership as any).sponsor_id)
 const rows=await c.env.DB.prepare("SELECT module_code,enabled FROM sponsor_module_grants WHERE sponsor_id=? AND module_code IN ('commercial_visitor','commercial_seller','commercial_vademecum','commercial_catalog')").bind(sponsorId).all()
 const resourceRow=await c.env.DB.prepare('SELECT resource_url,resource_label FROM sponsor_commercial_resources WHERE sponsor_id=?').bind(sponsorId).first()
 const grants=Object.fromEntries((rows.results||[]).map((r:any)=>[r.module_code,Number(r.enabled)===1]))
 return c.json({ok:true,data:{contact:grants.commercial_visitor?'visitor':grants.commercial_seller?'seller':'none',resource:grants.commercial_vademecum?'vademecum':grants.commercial_catalog?'catalog':'none',resource_url:String((resourceRow as any)?.resource_url||''),resource_label:String((resourceRow as any)?.resource_label||''),can_manage:['owner','admin'].includes(String((membership as any).role))}})
})

import { requireSuperAdmin } from './lib/admin-auth'
app.get('/api/v1/superadmin/sponsors/:id/commercial-resource',requireSuperAdmin('viewer'),async(c:any)=>{
 const id=String(c.req.param('id')||'')
 const sponsor=await c.env.DB.prepare('SELECT id FROM sponsor_tenants WHERE id=?').bind(id).first()
 if(!sponsor)return c.json({ok:false,error:'Patrocinador no encontrado.'},404)
 const row=await c.env.DB.prepare('SELECT resource_url,resource_label FROM sponsor_commercial_resources WHERE sponsor_id=?').bind(id).first()
 return c.json({ok:true,data:row||{resource_url:'',resource_label:''}})
})
app.patch('/api/v1/superadmin/sponsors/:id/commercial-resource',requireSuperAdmin('super_admin'),async(c:any)=>{
 const id=String(c.req.param('id')||''),body=await c.req.json().catch(()=>({}))
 const sponsor=await c.env.DB.prepare('SELECT id FROM sponsor_tenants WHERE id=?').bind(id).first()
 if(!sponsor)return c.json({ok:false,error:'Patrocinador no encontrado.'},404)
 const url=trim(body.resource_url,1200),label=trim(body.resource_label,80)
 if(url){let parsed:URL;try{parsed=new URL(url)}catch{return c.json({ok:false,error:'URL inválida.'},422)}
 if(parsed.protocol!=='https:'||parsed.username||parsed.password)return c.json({ok:false,error:'Solo se permiten enlaces HTTPS seguros.'},422)}
 await c.env.DB.prepare("INSERT INTO sponsor_commercial_resources(sponsor_id,resource_url,resource_label) VALUES (?,?,?) ON CONFLICT(sponsor_id) DO UPDATE SET resource_url=excluded.resource_url,resource_label=excluded.resource_label,updated_at=datetime('now')").bind(id,url,label).run()
 return c.json({ok:true})
})

export default app
