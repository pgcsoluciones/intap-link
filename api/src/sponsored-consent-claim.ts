import app from './index'
import { cookieNames } from './lib/cookies'

const CONSENT_VERSION='sponsored-v1.1-2026-09-17'

async function sha256Hex(input:string){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input));return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('')}
function parseCookie(header:string,name:string){const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const match=header.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`));return match?decodeURIComponent(match[1]):null}
async function sessionUserId(c:any){const raw=parseCookie(c.req.header('Cookie')||'',cookieNames(c.env).session);if(!raw)return null;const row=await c.env.DB.prepare(`SELECT user_id FROM auth_sessions WHERE session_hash=? AND expires_at>datetime('now') AND revoked_at IS NULL LIMIT 1`).bind(await sha256Hex(raw)).first();return row?String((row as any).user_id||''):null}
async function requireUser(c:any,next:any){const id=await sessionUserId(c);if(!id)return c.json({ok:false,error:'Unauthorized'},401);c.set('userId',id);await next()}
function clean(value:unknown,max=100){return String(value??'').trim().slice(0,max)}

app.post('/api/v1/me/sponsored-profile/claim',requireUser,async(c:any)=>{
  const userId=String(c.get('userId')||'')
  const body=await c.req.json().catch(()=>({}))
  const publicCode=clean(body?.public_code,64).toUpperCase()
  const consentAccepted=body?.consent_accepted===true
  const consentVersion=clean(body?.consent_version,80)
  if(!publicCode)return c.json({ok:false,error:'Código requerido.'},400)

  const artifact=await c.env.DB.prepare(`SELECT a.id,a.status,a.owner_user_id,sa.sponsor_id,sa.status AS sponsor_artifact_status,sa.artifact_role,sa.beneficiary_user_id,sa.sponsored_profile_id,st.name AS sponsor_name,st.is_active FROM intap_artifacts a JOIN sponsor_artifacts sa ON sa.artifact_id=a.id JOIN sponsor_tenants st ON st.id=sa.sponsor_id WHERE a.public_code=? LIMIT 1`).bind(publicCode).first()
  if(!artifact)return c.json({ok:false,error:'Este producto no pertenece a un programa patrocinado.'},404)
  if(String((artifact as any).artifact_role)==='master')return c.json({ok:false,error:'Este es el llavero Master del patrocinador.'},409)

  const artifactId=String((artifact as any).id)
  const linkedProfileId=String((artifact as any).sponsored_profile_id||'')
  const linkedBeneficiary=String((artifact as any).beneficiary_user_id||(artifact as any).owner_user_id||'')

  // Resume is idempotent: once this exact device was already claimed by this
  // account, consent is not requested again and the user simply continues editing.
  if(linkedProfileId||String((artifact as any).sponsor_artifact_status)==='activated'||String((artifact as any).status)==='activated'){
    const existing=linkedProfileId
      ? await c.env.DB.prepare(`SELECT id,username,status,user_id,consent_version,consent_accepted_at FROM sponsored_profiles WHERE id=? LIMIT 1`).bind(linkedProfileId).first()
      : await c.env.DB.prepare(`SELECT id,username,status,user_id,consent_version,consent_accepted_at FROM sponsored_profiles WHERE artifact_id=? ORDER BY created_at DESC LIMIT 1`).bind(artifactId).first()
    const ownerId=String((existing as any)?.user_id||linkedBeneficiary)
    if(ownerId&&ownerId===userId){
      return c.json({ok:true,data:{id:String((existing as any)?.id||linkedProfileId),status:String((existing as any)?.status||'draft'),username:String((existing as any)?.username||''),consent_version:String((existing as any)?.consent_version||CONSENT_VERSION),already_claimed:true,next_url:'/admin/sponsored'}})
    }
    return c.json({ok:false,error:'Este dispositivo ya está vinculado a otra cuenta.',code:'sponsored_device_already_linked'},409)
  }

  // One beneficiary account = one sponsored device/profile. Master sponsor-owner
  // profiles are separate and intentionally excluded from this rule.
  const accountProfile=await c.env.DB.prepare(`SELECT id,username,status FROM sponsored_profiles WHERE user_id=? AND profile_role='beneficiary' ORDER BY created_at ASC LIMIT 1`).bind(userId).first()
  if(accountProfile){
    return c.json({ok:false,error:'Esta cuenta ya tiene un dispositivo patrocinado vinculado. Cada cuenta solo puede tener un dispositivo patrocinado.',code:'sponsored_account_already_linked',data:{profile_id:String((accountProfile as any).id||''),username:String((accountProfile as any).username||''),status:String((accountProfile as any).status||'draft'),next_url:'/admin/sponsored'}},409)
  }

  if(!consentAccepted||consentVersion!==CONSENT_VERSION)return c.json({ok:false,error:'Debes aceptar las condiciones del patrocinio para activar tu presentación.',code:'sponsored_consent_required'},422)
  if(Number((artifact as any).is_active)!==1)return c.json({ok:false,error:'El patrocinio no está activo.'},409)
  if(String((artifact as any).sponsor_artifact_status)!=='available'||!['available','unassigned'].includes(String((artifact as any).status||'')))return c.json({ok:false,error:'Este producto ya fue activado o no está disponible.'},409)

  const activation=await c.env.DB.prepare(`SELECT id FROM artifact_activation_codes WHERE artifact_id=? AND status='active' AND (expires_at IS NULL OR expires_at>datetime('now')) ORDER BY created_at DESC LIMIT 1`).bind(artifactId).first()
  if(!activation)return c.json({ok:false,error:'Este producto todavía no está habilitado para activación.'},409)

  const profileId=crypto.randomUUID()
  const sponsorName=clean((artifact as any).sponsor_name,160)
  try{
    await c.env.DB.batch([
      c.env.DB.prepare(`INSERT INTO sponsored_profiles (id,sponsor_id,artifact_id,user_id,status,profile_role,consent_version,consent_accepted_at,consent_sponsor_name) VALUES (?,?,?,?, 'draft','beneficiary',?,datetime('now'),?)`).bind(profileId,String((artifact as any).sponsor_id),artifactId,userId,CONSENT_VERSION,sponsorName),
      c.env.DB.prepare(`UPDATE sponsor_artifacts SET status='activated',beneficiary_user_id=?,sponsored_profile_id=?,activated_at=datetime('now') WHERE artifact_id=? AND status='available'`).bind(userId,profileId,artifactId),
      c.env.DB.prepare(`UPDATE intap_artifacts SET status='activated',owner_user_id=?,activated_at=datetime('now'),updated_at=datetime('now') WHERE id=? AND status IN ('available','unassigned')`).bind(userId,artifactId),
      c.env.DB.prepare(`UPDATE artifact_activation_codes SET status='used',used_at=datetime('now') WHERE id=? AND status='active'`).bind(String((activation as any).id)),
    ])
  }catch(error:any){
    const message=String(error?.message||error||'')
    if(/sponsored_account_already_linked|ux_sponsored_profiles_one_beneficiary_per_user|UNIQUE constraint failed: sponsored_profiles\.user_id/i.test(message)){
      return c.json({ok:false,error:'Esta cuenta ya tiene un dispositivo patrocinado vinculado. Cada cuenta solo puede tener un dispositivo patrocinado.',code:'sponsored_account_already_linked'},409)
    }
    throw error
  }

  return c.json({ok:true,data:{id:profileId,sponsor_name:sponsorName,status:'draft',consent_version:CONSENT_VERSION,next_url:'/admin/sponsored'}},201)
})

export default app
