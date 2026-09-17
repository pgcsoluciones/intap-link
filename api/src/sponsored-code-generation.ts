import app from './index'
import { requireSuperAdmin } from './lib/admin-auth'
import { generateHumanCode, hashActivationCode } from './artifacts'

const PRODUCT_TYPES=new Set(['card','ping','bracelet','keychain','stand','qr','other'])
function clean(v:unknown,max=120){return String(v??'').trim().slice(0,max)}
async function uniquePublicCode(c:any,length=10){for(let i=0;i<12;i++){const code=generateHumanCode(length);const exists=await c.env.DB.prepare(`SELECT id FROM intap_artifacts WHERE public_code=? LIMIT 1`).bind(code).first();if(!exists)return code}throw new Error('No se pudo generar un código único.')}
async function buildArtifact(c:any,productType:string){const artifactId=crypto.randomUUID();const publicCode=await uniquePublicCode(c,10);const activationCode=generateHumanCode(20);const activationHash=await hashActivationCode(activationCode);const activationId=crypto.randomUUID();return{artifactId,publicCode,activationCode,activationHash,activationId,productType}}
function masterAccessUrl(c:any,publicCode:string){const web=String(c.env.WEB_URL||'https://intaprd.com').replace(/\/$/,'');return `${web}/l/${encodeURIComponent(publicCode)}`}

app.post('/api/v1/superadmin/sponsors/:id/generate-batch',requireSuperAdmin('super_admin'),async(c:any)=>{
  const sponsorId=String(c.req.param('id')||'');const sponsor=await c.env.DB.prepare(`SELECT id,name FROM sponsor_tenants WHERE id=? LIMIT 1`).bind(sponsorId).first();if(!sponsor)return c.json({ok:false,error:'Patrocinador no encontrado.'},404)
  const body=await c.req.json().catch(()=>({}));const quantity=Math.floor(Number(body.quantity||0));if(!Number.isFinite(quantity)||quantity<1||quantity>500)return c.json({ok:false,error:'La cantidad debe estar entre 1 y 500.'},422)
  const productType=PRODUCT_TYPES.has(String(body.product_type))?String(body.product_type):'keychain';const batchId=crypto.randomUUID();const batchName=clean(body.batch_name,100)||`Lote ${new Date().toISOString().slice(0,10)}`;const city=clean(body.city,80);const zone=clean(body.zone,80);const notes=clean(body.notes,240)
  const generated:any[]=[];for(let i=0;i<quantity;i++)generated.push(await buildArtifact(c,productType))
  const statements:any[]=[c.env.DB.prepare(`INSERT INTO sponsor_batches (id,sponsor_id,name,quantity,city,zone,notes) VALUES (?,?,?,?,?,?,?)`).bind(batchId,sponsorId,batchName,quantity,city,zone,notes)]
  for(const item of generated){statements.push(c.env.DB.prepare(`INSERT INTO intap_artifacts (id,public_code,product_type,status,created_at,updated_at) VALUES (?,?,?,'available',datetime('now'),datetime('now'))`).bind(item.artifactId,item.publicCode,item.productType));statements.push(c.env.DB.prepare(`INSERT INTO artifact_activation_codes (id,artifact_id,activation_code_hash,status,created_at) VALUES (?,?,?,'active',datetime('now'))`).bind(item.activationId,item.artifactId,item.activationHash));statements.push(c.env.DB.prepare(`INSERT INTO sponsor_artifacts (sponsor_id,artifact_id,batch_id,status,artifact_role) VALUES (?,?,?,'available','beneficiary')`).bind(sponsorId,item.artifactId,batchId))}
  await c.env.DB.batch(statements)
  const web=String(c.env.WEB_URL||'https://intaprd.com').replace(/\/$/,'')
  return c.json({ok:true,data:{batch_id:batchId,batch_name:batchName,quantity,product_type:productType,codes:generated.map(i=>({public_code:i.publicCode,public_url:`${web}/l/${encodeURIComponent(i.publicCode)}`}))}},201)
})

app.post('/api/v1/superadmin/sponsors/:id/generate-master',requireSuperAdmin('super_admin'),async(c:any)=>{
  const sponsorId=String(c.req.param('id')||'');const sponsor=await c.env.DB.prepare(`SELECT id,master_artifact_id FROM sponsor_tenants WHERE id=? LIMIT 1`).bind(sponsorId).first();if(!sponsor)return c.json({ok:false,error:'Patrocinador no encontrado.'},404)
  if((sponsor as any).master_artifact_id){const existing=await c.env.DB.prepare(`SELECT public_code FROM intap_artifacts WHERE id=? LIMIT 1`).bind(String((sponsor as any).master_artifact_id)).first();if(existing){const publicCode=String((existing as any).public_code);const publicUrl=masterAccessUrl(c,publicCode);return c.json({ok:true,data:{public_code:publicCode,public_url:publicUrl,activation_url:publicUrl,already_exists:true}})}}
  const item=await buildArtifact(c,'keychain')
  await c.env.DB.batch([
    c.env.DB.prepare(`INSERT INTO intap_artifacts (id,public_code,product_type,status,created_at,updated_at) VALUES (?,?,'keychain','available',datetime('now'),datetime('now'))`).bind(item.artifactId,item.publicCode),
    c.env.DB.prepare(`INSERT INTO artifact_activation_codes (id,artifact_id,activation_code_hash,status,created_at) VALUES (?,?,?,'active',datetime('now'))`).bind(item.activationId,item.artifactId,item.activationHash),
    c.env.DB.prepare(`INSERT INTO sponsor_artifacts (sponsor_id,artifact_id,status,artifact_role) VALUES (?,?,'available','master')`).bind(sponsorId,item.artifactId),
    c.env.DB.prepare(`UPDATE sponsor_tenants SET master_artifact_id=?,updated_at=datetime('now') WHERE id=?`).bind(item.artifactId,sponsorId),
  ])
  const publicUrl=masterAccessUrl(c,item.publicCode)
  return c.json({ok:true,data:{public_code:item.publicCode,public_url:publicUrl,activation_url:publicUrl,already_exists:false}},201)
})

export default app
