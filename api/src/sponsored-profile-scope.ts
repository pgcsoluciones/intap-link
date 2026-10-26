import { requestedSponsoredProfileId, sponsoredMultiProfileAccess, resolveSponsorMembership } from './sponsored-multiprofile-access'
import { readIntapSelection } from './intap-active-account'

export function sponsoredProfileScope(c:any){return String(c.req.query('scope')||'').trim().toLowerCase()==='master'?'master':'beneficiary'}

export async function resolveOwnedSponsoredProfile(c:any,userId:string,scope:'master'|'beneficiary'){
  const multi=await sponsoredMultiProfileAccess(c,userId)
  const active=multi?await readIntapSelection(c):null
  if(scope==='master'){
    if(multi&&active?.kind!=='sponsor')return null
    const membership=multi
      ?await resolveSponsorMembership(c,userId)
      :await c.env.DB.prepare("SELECT sponsor_id,role FROM sponsor_members WHERE user_id=? AND status='active' AND role='owner' ORDER BY created_at ASC LIMIT 1").bind(userId).first()
    if(!membership)return null
    if(multi&&String((membership as any).sponsor_id)!==active?.id)return null
    return c.env.DB.prepare("SELECT * FROM sponsored_profiles WHERE sponsor_id=? AND user_id=? AND profile_role='sponsor_owner' ORDER BY created_at ASC LIMIT 1").bind(String((membership as any).sponsor_id),userId).first()
  }
  const requestedId=requestedSponsoredProfileId(c)
  if(multi){
    if(!active||active.kind!=='sponsored'||(requestedId&&requestedId!==active.id))return null
    return c.env.DB.prepare("SELECT * FROM sponsored_profiles WHERE id=? AND user_id=? AND COALESCE(profile_role,'beneficiary')='beneficiary' LIMIT 1").bind(active.id,userId).first()
  }
  if(requestedId)return null // Only explicitly multiaccount users may choose by ID.
  return c.env.DB.prepare("SELECT * FROM sponsored_profiles WHERE user_id=? AND COALESCE(profile_role,'beneficiary')='beneficiary' ORDER BY created_at DESC LIMIT 1").bind(userId).first()
}
