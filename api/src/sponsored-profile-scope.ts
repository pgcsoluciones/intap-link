import { requestedSponsoredProfileId, sponsoredMultiProfileAccess } from './sponsored-multiprofile-access'

export function sponsoredProfileScope(c:any){return String(c.req.query('scope')||'').trim().toLowerCase()==='master'?'master':'beneficiary'}

export async function resolveOwnedSponsoredProfile(c:any,userId:string,scope:'master'|'beneficiary'){
  if(scope==='master'){
    const membership=await c.env.DB.prepare(`SELECT sponsor_id,role FROM sponsor_members WHERE user_id=? AND status='active' AND role='owner' ORDER BY created_at ASC LIMIT 1`).bind(userId).first()
    if(!membership)return null
    return c.env.DB.prepare(`SELECT * FROM sponsored_profiles WHERE sponsor_id=? AND user_id=? AND profile_role='sponsor_owner' ORDER BY created_at ASC LIMIT 1`).bind(String((membership as any).sponsor_id),userId).first()
  }
  const requestedId=requestedSponsoredProfileId(c)
  if(requestedId){
    const allowed=await sponsoredMultiProfileAccess(c,userId)
    if(!allowed)return null
    return c.env.DB.prepare(`SELECT * FROM sponsored_profiles WHERE id=? AND user_id=? AND COALESCE(profile_role,'beneficiary')='beneficiary' LIMIT 1`).bind(requestedId,userId).first()
  }
  return c.env.DB.prepare(`SELECT * FROM sponsored_profiles WHERE user_id=? AND COALESCE(profile_role,'beneficiary')='beneficiary' ORDER BY created_at DESC LIMIT 1`).bind(userId).first()
}
