import app from './index'
import { cookieNames, isPreviewEnvironment } from './lib/cookies'

function configuredWebUrl(c:any){const fallback=isPreviewEnvironment(c.env)?'https://preview.intaprd.com':'https://intaprd.com';return String(c.env.WEB_URL||fallback).replace(/\/$/,'')}
function configuredAppUrl(c:any){const fallback=isPreviewEnvironment(c.env)?'https://app.preview.intaprd.com':'https://app.intaprd.com';return String(c.env.APP_URL||fallback).replace(/\/$/,'')}
function parseCookie(header:string,name:string){const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const match=header.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`));return match?decodeURIComponent(match[1]):null}
async function sha256Hex(input:string){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input));return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('')}
async function sessionUserId(c:any){const raw=parseCookie(c.req.header('Cookie')||'',cookieNames(c.env).session);if(!raw)return null;const row=await c.env.DB.prepare(`SELECT user_id FROM auth_sessions WHERE session_hash=? AND expires_at>datetime('now') AND revoked_at IS NULL LIMIT 1`).bind(await sha256Hex(raw)).first();return row?String((row as any).user_id||''):null}
function productLabel(type:string){const labels:Record<string,string>={card:'Tarjeta NFC',ping:'Ping NFC',bracelet:'Pulsera NFC',keychain:'Llavero NFC',stand:'Estación de Contacto',qr:'Código QR',other:'Producto Kawvo'};return labels[type]||labels.other}

app.post('/api/v1/public/artifacts/scan/status',async(c:any,next:any)=>{
  let body:any={}
  try{body=await c.req.json()}catch{return next()}
  const publicCode=String(body?.public_code||'').trim().toUpperCase()
  if(!publicCode)return next()
  const row=await c.env.DB.prepare(`SELECT a.id,a.public_code,a.product_type,a.status AS artifact_status,a.owner_user_id,sa.sponsor_id,sa.status AS sponsor_artifact_status,sa.artifact_role,sa.beneficiary_user_id,sp.id AS sponsored_profile_id,sp.username,sp.status AS sponsored_profile_status,sp.user_id AS sponsored_user_id,st.name AS sponsor_name,st.logo_url AS sponsor_logo_url,st.banner_title,st.sponsor_type,st.is_active AS sponsor_is_active FROM intap_artifacts a JOIN sponsor_artifacts sa ON sa.artifact_id=a.id JOIN sponsor_tenants st ON st.id=sa.sponsor_id LEFT JOIN sponsored_profiles sp ON sp.id=sa.sponsored_profile_id WHERE a.public_code=? LIMIT 1`).bind(publicCode).first().catch(()=>null)
  if(!row)return next()

  const artifactId=String((row as any).id||'')
  const artifactStatus=String((row as any).artifact_status||'')
  const productType=String((row as any).product_type||'other')
  const currentUserId=await sessionUserId(c)
  const sponsorId=String((row as any).sponsor_id||'')
  const sponsor={id:sponsorId,name:String((row as any).sponsor_name||'Patrocinador'),logo_url:String((row as any).sponsor_logo_url||''),banner_title:String((row as any).banner_title||'Impulsado por'),type:String((row as any).sponsor_type||'merchant')}
  const artifact={public_code:publicCode,product_type:productType,label:productLabel(productType)}

  if(String((row as any).artifact_role||'beneficiary')==='master'){
    const membership=currentUserId?await c.env.DB.prepare(`SELECT role FROM sponsor_members WHERE sponsor_id=? AND user_id=? AND status='active' LIMIT 1`).bind(sponsorId,currentUserId).first():null
    return c.json({ok:true,state:membership?'sponsored_master':'sponsored_master_login',artifact,sponsor,message:membership?`Este es tu llavero Master · código ${publicCode}.`:'Este llavero Master requiere iniciar sesión como patrocinador.',manage_url:membership?`${configuredAppUrl(c)}/admin/sponsor`:null,login_url:membership?null:`${configuredAppUrl(c)}/admin/login?resume_sponsor=1&public_code=${encodeURIComponent(publicCode)}`})
  }

  const sponsoredStatus=String((row as any).sponsor_artifact_status||'')
  const profileStatus=String((row as any).sponsored_profile_status||'')
  const username=String((row as any).username||'')
  const beneficiary=String((row as any).sponsored_user_id||(row as any).beneficiary_user_id||'')

  // Once activated, the beneficiary presentation is perpetual. Sponsor commercial
  // inactivity cannot remove or block an already claimed profile.
  if(sponsoredStatus==='activated'||artifactStatus==='activated'){
    if(profileStatus==='published'&&username)return c.json({ok:true,state:'activated',artifact,sponsor,next_url:`${configuredWebUrl(c)}/p/${encodeURIComponent(username)}`})
    const isOwner=Boolean(currentUserId&&beneficiary&&currentUserId===beneficiary)
    return c.json({ok:true,state:isOwner?'sponsored_draft_owner':'sponsored_draft',artifact,sponsor,message:isOwner?'Tu presentación patrocinada todavía está en construcción.':'Esta presentación todavía está en construcción.',next_url:isOwner?`${configuredAppUrl(c)}/admin/sponsored`:null,login_url:isOwner?null:`${configuredAppUrl(c)}/admin/login?resume_sponsored=1&public_code=${encodeURIComponent(publicCode)}`})
  }

  if(sponsoredStatus==='inactive')return c.json({ok:true,state:'blocked',artifact,sponsor,message:'Este producto patrocinado está inactivo.'})
  if(Number((row as any).sponsor_is_active)!==1)return c.json({ok:true,state:'blocked',artifact,sponsor,message:'Este patrocinio no está habilitado para nuevas activaciones.'})
  if(!['available','unassigned'].includes(artifactStatus)||(row as any).owner_user_id)return c.json({ok:true,state:'unavailable',artifact,sponsor,message:'Este producto patrocinado ya no está disponible para activación.'})

  const activation=await c.env.DB.prepare(`SELECT id FROM artifact_activation_codes WHERE artifact_id=? AND status='active' AND (expires_at IS NULL OR expires_at>datetime('now')) ORDER BY created_at DESC,id DESC LIMIT 1`).bind(artifactId).first()
  if(!activation)return c.json({ok:true,state:'not_ready',artifact,sponsor,message:'Este producto patrocinado todavía no está habilitado para activación.'})
  return c.json({ok:true,state:'sponsored_pending_activation',artifact,sponsor,message:'Impulsamos tu crecimiento digital. Activa ahora tu llavero y personaliza tu presentación.',next_url:`${configuredAppUrl(c)}/admin/sponsored/activate?public_code=${encodeURIComponent(publicCode)}`})
})

export default app
