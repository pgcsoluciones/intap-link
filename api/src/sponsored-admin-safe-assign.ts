import app from './index'
import { requireSuperAdmin } from './lib/admin-auth'

function clean(value:unknown,max=180){return String(value??'').trim().slice(0,max)}

app.post('/api/v1/superadmin/sponsors/:id/assign-artifacts',requireSuperAdmin('super_admin'),async(c:any)=>{
  const sponsorId=String(c.req.param('id')||'')
  const sponsor=await c.env.DB.prepare(`SELECT id FROM sponsor_tenants WHERE id=? LIMIT 1`).bind(sponsorId).first()
  if(!sponsor)return c.json({ok:false,error:'Patrocinador no encontrado.'},404)
  const body=await c.req.json().catch(()=>({}))
  const rawCodes:string[]=Array.isArray(body.public_codes)
    ? body.public_codes.map((v:any)=>clean(v,64).toUpperCase()).filter((v:string)=>Boolean(v))
    : []
  const publicCodes:string[]=Array.from(new Set<string>(rawCodes))
  if(!publicCodes.length)return c.json({ok:false,error:'Agrega al menos un código de producto.'},422)
  const batchId=crypto.randomUUID();const batchName=clean(body.batch_name,100)||`Lote ${new Date().toISOString().slice(0,10)}`
  const accepted:string[]=[];const rejected:Array<{code:string;reason:string}>=[]

  for(const code of publicCodes){
    const artifact=await c.env.DB.prepare(`SELECT id,status,owner_user_id FROM intap_artifacts WHERE public_code=? LIMIT 1`).bind(code).first()
    if(!artifact){rejected.push({code,reason:'no encontrado'});continue}
    const artifactId=String((artifact as any).id)
    const existing=await c.env.DB.prepare(`SELECT sponsor_id,artifact_role FROM sponsor_artifacts WHERE artifact_id=? LIMIT 1`).bind(artifactId).first()
    if(existing){rejected.push({code,reason:String((existing as any).sponsor_id)===sponsorId?'ya asignado a este patrocinador':'asignado a otro patrocinador'});continue}
    if((artifact as any).owner_user_id){rejected.push({code,reason:'producto ya reclamado'});continue}
    if(!['available','unassigned'].includes(String((artifact as any).status||''))){rejected.push({code,reason:`estado ${String((artifact as any).status||'desconocido')}`});continue}
    accepted.push(artifactId)
  }

  if(!accepted.length)return c.json({ok:false,error:'Ninguno de los códigos está disponible para patrocinio.',data:{requested:publicCodes.length,assigned:0,rejected}},409)
  await c.env.DB.prepare(`INSERT INTO sponsor_batches (id,sponsor_id,name,quantity,city,zone,notes) VALUES (?,?,?,?,?,?,?)`).bind(batchId,sponsorId,batchName,accepted.length,clean(body.city,80),clean(body.zone,80),clean(body.notes,240)).run()
  for(const artifactId of accepted)await c.env.DB.prepare(`INSERT INTO sponsor_artifacts (sponsor_id,artifact_id,batch_id,status,artifact_role) VALUES (?,?,?,'available','beneficiary')`).bind(sponsorId,artifactId,batchId).run()
  return c.json({ok:true,data:{batch_id:batchId,requested:publicCodes.length,assigned:accepted.length,rejected}})
})

app.post('/api/v1/superadmin/sponsors/:id/master-artifact',requireSuperAdmin('super_admin'),async(c:any)=>{
  const sponsorId=String(c.req.param('id')||'');const body=await c.req.json().catch(()=>({}));const code=clean(body.public_code,64).toUpperCase()
  if(!code)return c.json({ok:false,error:'Código requerido.'},422)
  const sponsor=await c.env.DB.prepare(`SELECT id,master_artifact_id FROM sponsor_tenants WHERE id=? LIMIT 1`).bind(sponsorId).first()
  if(!sponsor)return c.json({ok:false,error:'Patrocinador no encontrado.'},404)
  const artifact=await c.env.DB.prepare(`SELECT id,status,owner_user_id FROM intap_artifacts WHERE public_code=? LIMIT 1`).bind(code).first()
  if(!artifact)return c.json({ok:false,error:'Producto no encontrado.'},404)
  const artifactId=String((artifact as any).id)
  if((artifact as any).owner_user_id)return c.json({ok:false,error:'Ese producto ya fue reclamado por un usuario.'},409)
  if(!['available','unassigned'].includes(String((artifact as any).status||'')))return c.json({ok:false,error:'Ese producto no está disponible para asignarse como Master.'},409)
  const existing=await c.env.DB.prepare(`SELECT sponsor_id,artifact_role FROM sponsor_artifacts WHERE artifact_id=? LIMIT 1`).bind(artifactId).first()
  if(existing&&!(String((existing as any).sponsor_id)===sponsorId&&String((existing as any).artifact_role)==='master'))return c.json({ok:false,error:'Ese producto ya pertenece a otro lote o patrocinador.'},409)
  const currentMaster=clean((sponsor as any).master_artifact_id,100)
  if(currentMaster&&currentMaster!==artifactId)return c.json({ok:false,error:'Este patrocinador ya tiene un llavero Master. Desvincúlalo administrativamente antes de asignar otro.'},409)
  if(!existing)await c.env.DB.prepare(`INSERT INTO sponsor_artifacts (sponsor_id,artifact_id,status,artifact_role) VALUES (?,?,'available','master')`).bind(sponsorId,artifactId).run()
  await c.env.DB.prepare(`UPDATE sponsor_tenants SET master_artifact_id=?,updated_at=datetime('now') WHERE id=?`).bind(artifactId,sponsorId).run()
  return c.json({ok:true,data:{public_code:code}})
})

export default app
