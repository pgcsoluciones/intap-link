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

export async function listSponsorAccounts(c:any,userId:string){
  if(!userId)return[]
  const rows=await c.env.DB.prepare(`
    SELECT sm.sponsor_id,sm.role,sm.status,sm.created_at,st.name,st.slug,st.sponsor_type,st.logo_url,st.is_active,
           EXISTS(SELECT 1 FROM medical_sponsor_programs msp WHERE msp.sponsor_id=st.id AND msp.enabled=1) AS has_kawmed,
           EXISTS(SELECT 1 FROM sponsor_artifacts sa WHERE sa.sponsor_id=st.id AND sa.artifact_role='master') AS has_normal_master,
           EXISTS(SELECT 1 FROM medical_sponsor_masters msm WHERE msm.sponsor_id=st.id AND msm.status<>'inactive') AS has_kawmed_master
      FROM sponsor_members sm
      JOIN sponsor_tenants st ON st.id=sm.sponsor_id
     WHERE sm.user_id=? AND sm.status='active' AND st.is_active=1
     ORDER BY sm.created_at ASC,st.name ASC
  `).bind(userId).all()
  return rows.results||[]
}

export async function resolveSponsorMembership(c:any,userId:string){
  if(!userId)return null
  const multi=await sponsoredMultiProfileAccess(c,userId)
  if(multi){
    const context=await c.env.DB.prepare(`SELECT sponsor_id FROM sponsor_user_context WHERE user_id=? LIMIT 1`).bind(userId).first().catch(()=>null)
    const requested=String((context as any)?.sponsor_id||'')
    if(requested){
      const selected=await c.env.DB.prepare(`
        SELECT sm.sponsor_id,sm.role,st.name,st.slug,st.sponsor_type,st.logo_url,st.is_active
          FROM sponsor_members sm JOIN sponsor_tenants st ON st.id=sm.sponsor_id
         WHERE sm.user_id=? AND sm.sponsor_id=? AND sm.status='active' AND st.is_active=1 LIMIT 1
      `).bind(userId,requested).first()
      if(selected)return selected
    }
  }
  return c.env.DB.prepare(`
    SELECT sm.sponsor_id,sm.role,st.name,st.slug,st.sponsor_type,st.logo_url,st.is_active
      FROM sponsor_members sm JOIN sponsor_tenants st ON st.id=sm.sponsor_id
     WHERE sm.user_id=? AND sm.status='active' AND st.is_active=1
     ORDER BY CASE WHEN sm.role='owner' THEN 0 ELSE 1 END,sm.created_at ASC
     LIMIT 1
  `).bind(userId).first()
}

export async function setSponsorContext(c:any,userId:string,sponsorId:string){
  const allowed=await sponsoredMultiProfileAccess(c,userId)
  if(!allowed)return false
  const membership=await c.env.DB.prepare(`
    SELECT 1 FROM sponsor_members sm JOIN sponsor_tenants st ON st.id=sm.sponsor_id
     WHERE sm.user_id=? AND sm.sponsor_id=? AND sm.status='active' AND st.is_active=1 LIMIT 1
  `).bind(userId,sponsorId).first()
  if(!membership)return false
  await c.env.DB.prepare(`
    INSERT INTO sponsor_user_context(user_id,sponsor_id,updated_at)
    VALUES(?,?,datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET sponsor_id=excluded.sponsor_id,updated_at=datetime('now')
  `).bind(userId,sponsorId).run()
  return true
}
