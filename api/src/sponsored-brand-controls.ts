import app from './index'
import { cookieNames } from './lib/cookies'
import { requireSuperAdmin } from './lib/admin-auth'

function clean(value:unknown,max=800){return String(value??'').trim().slice(0,max)}
async function sha256Hex(input:string){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input));return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('')}
function parseCookie(header:string,name:string){const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const match=header.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`));return match?decodeURIComponent(match[1]):null}
async function sessionUserId(c:any){const raw=parseCookie(c.req.header('Cookie')||'',cookieNames(c.env).session);if(!raw)return null;const row=await c.env.DB.prepare(`SELECT user_id FROM auth_sessions WHERE session_hash=? AND expires_at>datetime('now') AND revoked_at IS NULL LIMIT 1`).bind(await sha256Hex(raw)).first();return row?String((row as any).user_id||''):null}
async function requireUser(c:any,next:any){const id=await sessionUserId(c);if(!id)return c.json({ok:false,error:'Unauthorized'},401);c.set('userId',id);await next()}
function ext(file:File){const byType:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};return byType[file.type]||''}
async function uploadFile(c:any,sponsorId:string,kind:'logo'|'banner'){
  const fd=await c.req.formData();const raw=fd.get('file')
  if(!(raw&&typeof raw==='object'&&'stream' in (raw as any)))return c.json({ok:false,error:'Archivo requerido.'},400)
  const file=raw as File;const fileExt=ext(file)
  if(!fileExt)return c.json({ok:false,error:'Formato no permitido. Usa JPG, PNG o WEBP.'},400)
  if(Number(file.size||0)>8*1024*1024)return c.json({ok:false,error:'La imagen supera 8 MB.'},413)
  const key=`sponsors/${sponsorId}/${kind}/${crypto.randomUUID()}.${fileExt}`
  await c.env.BUCKET.put(key,file.stream(),{httpMetadata:{contentType:file.type||'image/jpeg'}})
  const origin=new URL(c.req.url).origin;const encoded=key.split('/').map(encodeURIComponent).join('/')
  return c.json({ok:true,url:`${origin}/api/v1/public/assets/${encoded}`,key})
}

// Sponsor owners/admins may change VISUAL ASSETS only.
// CTA, destination, title and commercial message remain centrally controlled by Super Admin.
app.patch('/api/v1/sponsor/settings',requireUser,async(c:any)=>{
  const userId=String(c.get('userId')||'')
  const membership=await c.env.DB.prepare(`SELECT sponsor_id,role FROM sponsor_members WHERE user_id=? AND status='active' LIMIT 1`).bind(userId).first()
  if(!membership||!['owner','admin'].includes(String((membership as any).role)))return c.json({ok:false,error:'No tienes permiso para editar la imagen del patrocinio.'},403)
  const body=await c.req.json().catch(()=>({}))
  await c.env.DB.prepare(`UPDATE sponsor_tenants SET logo_url=?,banner_image_url=?,updated_at=datetime('now') WHERE id=?`).bind(clean(body.logo_url),clean(body.banner_image_url),String((membership as any).sponsor_id)).run()
  return c.json({ok:true,data:{editable:['logo_url','banner_image_url'],locked:['banner_title','banner_cta_label','banner_cta_type','banner_cta_value','whatsapp_message_template']}})
})

app.post('/api/v1/superadmin/sponsors/:id/media',requireSuperAdmin('super_admin'),async(c:any)=>{
  const sponsorId=String(c.req.param('id')||'');const sponsor=await c.env.DB.prepare(`SELECT id FROM sponsor_tenants WHERE id=? LIMIT 1`).bind(sponsorId).first();if(!sponsor)return c.json({ok:false,error:'Patrocinador no encontrado.'},404)
  const kind=String(c.req.query('kind')||'')
  if(kind!=='logo'&&kind!=='banner')return c.json({ok:false,error:'Tipo de imagen no válido.'},400)
  return uploadFile(c,sponsorId,kind)
})

app.patch('/api/v1/superadmin/sponsors/:id/brand',requireSuperAdmin('super_admin'),async(c:any)=>{
  const sponsorId=String(c.req.param('id')||'');const body=await c.req.json().catch(()=>({}))
  const current=await c.env.DB.prepare(`SELECT id FROM sponsor_tenants WHERE id=? LIMIT 1`).bind(sponsorId).first();if(!current)return c.json({ok:false,error:'Patrocinador no encontrado.'},404)
  const ctaType=['beneficiary_whatsapp','sponsor_whatsapp','sponsor_url','none'].includes(String(body.banner_cta_type))?String(body.banner_cta_type):'none'
  await c.env.DB.prepare(`UPDATE sponsor_tenants SET logo_url=?,banner_title=?,banner_image_url=?,banner_cta_label=?,banner_cta_type=?,banner_cta_value=?,whatsapp_message_template=?,updated_at=datetime('now') WHERE id=?`).bind(
    clean(body.logo_url),clean(body.banner_title,80)||'Impulsado por',clean(body.banner_image_url),clean(body.banner_cta_label,60)||'Conocer más',ctaType,clean(body.banner_cta_value),clean(body.whatsapp_message_template,240),sponsorId,
  ).run()
  return c.json({ok:true})
})

export default app
