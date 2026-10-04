import { buildScopedCookie, isPreviewEnvironment } from './lib/cookies'

export const FREE_DEMO_V2_CLAIM_EMAIL='intapcard@gmail.com'

export function freeDemoClaimCookieName(env:any){
  return isPreviewEnvironment(env)?'kawvo_free_demo_v2_claim_preview':'kawvo_free_demo_v2_claim'
}
export function freeDemoClaimCookie(env:any,appUrl:string,value:string,maxAge=900){
  return buildScopedCookie(env,appUrl,freeDemoClaimCookieName(env),value,maxAge)
}
function parseCookie(header:string,name:string){
  for(const part of header.split(';')){
    const i=part.indexOf('=')
    if(i<0)continue
    if(part.slice(0,i).trim()===name)return decodeURIComponent(part.slice(i+1).trim())
  }
  return null
}
async function sha256Hex(input:string){
  const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input))
  return Array.from(new Uint8Array(h)).map(b=>b.toString(16).padStart(2,'0')).join('')
}

export async function getActiveFreeDemoClaim(c:any){
  const raw=parseCookie(c.req.header('Cookie')||'',freeDemoClaimCookieName(c.env))
  if(!raw)return null
  return c.env.DB.prepare(`SELECT cl.id claim_id,cl.demo_id,cl.slug_snapshot,d.profile_id,d.synthetic_owner_user_id,p.name,p.slug,p.template_data
    FROM free_demo_v2_claims cl
    JOIN free_demo_v2_profiles d ON d.id=cl.demo_id
    JOIN profiles p ON p.id=d.profile_id
    WHERE cl.code_hash=? AND cl.status='active' AND cl.expires_at>datetime('now') AND d.status='claim_ready'
    LIMIT 1`).bind(await sha256Hex(raw)).first()
}

export async function finalizeFreeDemoClaimToVerifiedUser(c:any,userId:string,verifiedEmail:string){
  const claim=await getActiveFreeDemoClaim(c)
  if(!claim)return {ok:false,error:'claim_expired',status:401}
  const email=String(verifiedEmail||'').trim().toLowerCase()
  if(!userId||!email)return {ok:false,error:'verified_identity_required',status:400}
  if(email===FREE_DEMO_V2_CLAIM_EMAIL)return {ok:false,error:'claim_email_cannot_be_owner',status:409}

  const profileId=String((claim as any).profile_id)
  const oldOwner=String((claim as any).synthetic_owner_user_id)
  const demoId=String((claim as any).demo_id)
  const claimId=String((claim as any).claim_id)
  const template=(()=>{try{return JSON.parse(String((claim as any).template_data||'{}'))||{}}catch{return {}}})()
  delete template.free_demo_v2
  delete template.free_demo_v2_template_key
  delete template.free_demo_v2_template_label

  const existingProfile=await c.env.DB.prepare('SELECT id FROM profiles WHERE user_id=? AND id<>? LIMIT 1').bind(userId,profileId).first()
  if(existingProfile)return {ok:false,error:'verified_user_already_has_free_profile',status:409}

  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE profiles
      SET user_id=?,template_data=?,updated_at=datetime('now')
      WHERE id=? AND user_id=? AND EXISTS(
        SELECT 1 FROM free_demo_v2_profiles d JOIN free_demo_v2_claims cl ON cl.demo_id=d.id
        WHERE d.id=? AND d.status='claim_ready' AND cl.id=? AND cl.status='active'
      )`).bind(userId,JSON.stringify(template),profileId,oldOwner,demoId,claimId),
    c.env.DB.prepare(`UPDATE free_demo_v2_profiles
      SET status='claimed',claimed_by_user_id=?,claimed_at=datetime('now'),updated_at=datetime('now')
      WHERE id=? AND status='claim_ready' AND EXISTS(SELECT 1 FROM profiles p WHERE p.id=? AND p.user_id=?)`)
      .bind(userId,demoId,profileId,userId),
    c.env.DB.prepare(`UPDATE free_demo_v2_claims
      SET status='used',used_at=datetime('now')
      WHERE id=? AND status='active' AND EXISTS(
        SELECT 1 FROM free_demo_v2_profiles d WHERE d.id=? AND d.status='claimed' AND d.claimed_by_user_id=?
      )`).bind(claimId,demoId,userId),
  ])

  const verify=await c.env.DB.prepare(`SELECT p.user_id,d.status,d.claimed_at,cl.status claim_status,u.email
    FROM profiles p
    JOIN free_demo_v2_profiles d ON d.profile_id=p.id
    JOIN free_demo_v2_claims cl ON cl.demo_id=d.id
    JOIN users u ON u.id=p.user_id
    WHERE p.id=? AND d.id=? AND cl.id=? LIMIT 1`).bind(profileId,demoId,claimId).first()

  if(String((verify as any)?.user_id||'')!==userId||String((verify as any)?.status||'')!=='claimed'||String((verify as any)?.claim_status||'')!=='used'){
    return {ok:false,error:'claim_transfer_failed',status:500}
  }
  return {ok:true,profile_id:profileId,demo_id:demoId,slug:String((claim as any).slug||''),owner_email:String((verify as any)?.email||email),claimed_at:(verify as any)?.claimed_at||null}
}