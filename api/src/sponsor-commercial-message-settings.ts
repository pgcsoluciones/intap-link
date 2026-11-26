import {DEFAULT_SPONSOR_MESSAGE,validSponsorMessage} from '../../shared/sponsor-commercial-message'
type SponsorContext={userId:string;sponsorId:string}
export async function readSponsorContactTemplate(db:D1Database,sponsorId:string){
 const row=await db.prepare('SELECT message_template FROM sponsor_commercial_contact_settings WHERE sponsor_id=?').bind(sponsorId).first<{message_template:string}>()
 const value=row?.message_template
 return validSponsorMessage(value)?value:DEFAULT_SPONSOR_MESSAGE
}
/** Authorized owner/admin with existing commercial grant; no public route. */
export function registerSponsorMessageSettings(app:any,authorized:(c:any)=>Promise<SponsorContext|null>){
 const path='/api/v1/sponsor/commercial/contact-message'
 app.get(path,async(c:any)=>{
  const ctx=await authorized(c);if(!ctx)return c.json({ok:false,error:'Acceso comercial no autorizado.'},403)
  c.header('Cache-Control','no-store')
  return c.json({ok:true,data:{sponsor_id:ctx.sponsorId,message_template:await readSponsorContactTemplate(c.env.DB,ctx.sponsorId)}})
 })
 app.patch(path,async(c:any)=>{
  const ctx=await authorized(c);if(!ctx)return c.json({ok:false,error:'Acceso comercial no autorizado.'},403)
  const body=await c.req.json().catch(()=>null)
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['sponsor_id','message_template'].includes(k))||body.sponsor_id!==ctx.sponsorId)return c.json({ok:false,error:'El patrocinador no coincide con la cuenta activa.'},403)
  if(!validSponsorMessage(body.message_template))return c.json({ok:false,error:'Escribe un mensaje de 1 a 400 caracteres y usa solo las variables indicadas.'},422)
  const message=body.message_template.trim()
  await c.env.DB.prepare(`INSERT INTO sponsor_commercial_contact_settings(sponsor_id,message_template)
    VALUES(?,?) ON CONFLICT(sponsor_id) DO UPDATE SET message_template=excluded.message_template,updated_at=datetime('now')`).bind(ctx.sponsorId,message).run()
  c.header('Cache-Control','no-store')
  return c.json({ok:true,data:{sponsor_id:ctx.sponsorId,message_template:message}})
 })
}
