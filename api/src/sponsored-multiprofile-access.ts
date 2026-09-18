export const SPONSORED_MULTIPROFILE_AUTHORIZED_EMAIL='intapcard@gmail.com'

export async function sponsoredMultiProfileAccess(c:any,userId:string){
  if(!userId)return false
  const user=await c.env.DB.prepare(`SELECT email FROM users WHERE id=? LIMIT 1`).bind(userId).first()
  return String((user as any)?.email||'').trim().toLowerCase()===SPONSORED_MULTIPROFILE_AUTHORIZED_EMAIL
}

export function requestedSponsoredProfileId(c:any){
  return String(c.req.query('profile_id')||'').trim()
}

export async function listOwnedSponsoredBeneficiaryProfiles(c:any,userId:string){
  const rows=await c.env.DB.prepare(`
    SELECT sp.id,sp.sponsor_id,sp.artifact_id,sp.username,sp.business_name,sp.status,sp.created_at,
           st.name AS sponsor_name,a.public_code,a.product_type
      FROM sponsored_profiles sp
      JOIN sponsor_tenants st ON st.id=sp.sponsor_id
      LEFT JOIN intap_artifacts a ON a.id=sp.artifact_id
     WHERE sp.user_id=? AND COALESCE(sp.profile_role,'beneficiary')='beneficiary'
     ORDER BY sp.created_at DESC
  `).bind(userId).all()
  return rows.results||[]
}
