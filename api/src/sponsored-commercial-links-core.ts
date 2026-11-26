import {commercialWhatsAppNumber,DEFAULT_SPONSOR_MESSAGE,renderSponsorMessage} from '../../shared/sponsor-commercial-message'
import {readSponsorContactTemplate} from './sponsor-commercial-message-settings'
/**
 * Private owner-only commercial links for a sponsored profile.
 * The CALLER must verify session, D1 ownership and, for Multicuenta, exact active
 * account kind and ID BEFORE invoking this resolver.
 *
 * Never call from a public anonymous profile endpoint.
 * No implicit sponsor/profile lookup or Master-to-beneficiary assignment fallback.
 */
export type SponsoredCommercialOwner={
  sponsor_id?:unknown
  artifact_id?:unknown
  profile_role?:unknown
  business_name?:unknown
}
export type SponsoredCommercialLinks={
  contact_label:string
  contact_url:string
  resource_label:string
  resource_url:string
}
export const EMPTY_SPONSORED_COMMERCIAL_LINKS:SponsoredCommercialLinks={
  contact_label:'',contact_url:'',resource_label:'',resource_url:'',
}

function safeHttpsUrl(value:unknown):string{
  const raw=String(value??'').trim()
  if(!raw)return''
  try{
    const parsed=new URL(raw)
    return parsed.protocol==='https:'&&!parsed.username&&!parsed.password?raw:''
  }catch{return''}
}

export async function resolveSponsoredCommercialLinks(db:D1Database,profile:SponsoredCommercialOwner):Promise<SponsoredCommercialLinks>{
  const sponsorId=String(profile?.sponsor_id||'').trim()
  if(!sponsorId)return{...EMPTY_SPONSORED_COMMERCIAL_LINKS}
  const master=String(profile?.profile_role||'')==='sponsor_owner'
  const grants=await db.prepare("SELECT module_code,enabled FROM sponsor_module_grants WHERE sponsor_id=? AND module_code IN ('commercial_seller','commercial_visitor','commercial_catalog','commercial_vademecum')").bind(sponsorId).all()
  const active=new Set((grants.results||[]).filter((x:any)=>Number(x.enabled)===1).map((x:any)=>String(x.module_code)))
  const resource:any=active.has('commercial_catalog')||active.has('commercial_vademecum')
    ?await db.prepare('SELECT resource_url,resource_label FROM sponsor_commercial_resources WHERE sponsor_id=?').bind(sponsorId).first()
    :null
  const resource_url=safeHttpsUrl(resource?.resource_url)

  // Representatives belong to beneficiary artifact assignments, never Master.
  let representative:any=null
  const artifactId=String(profile?.artifact_id||'').trim()
  if(!master&&artifactId&&(active.has('commercial_seller')||active.has('commercial_visitor'))){
    representative=await db.prepare("SELECT r.whatsapp,r.first_name,r.last_name,st.name AS sponsor_name FROM sponsor_sales_assignments a JOIN sponsor_sales_representatives r ON r.id=a.representative_id AND r.sponsor_id=a.sponsor_id AND r.active=1 JOIN sponsor_tenants st ON st.id=a.sponsor_id JOIN sponsor_artifacts sa ON sa.artifact_id=a.artifact_id AND sa.sponsor_id=a.sponsor_id WHERE a.sponsor_id=? AND sa.artifact_id=? AND a.active=1 ORDER BY a.assigned_at DESC LIMIT 1").bind(sponsorId,artifactId).first()
  }
  const digits=commercialWhatsAppNumber(representative?.whatsapp)
  // Existing owner-only links remain usable if the optional template read fails.
  // The settings editor itself does not claim persistence on a read/write failure.
  const template=digits?await readSponsorContactTemplate(db,sponsorId).catch(()=>DEFAULT_SPONSOR_MESSAGE):DEFAULT_SPONSOR_MESSAGE
  const message=renderSponsorMessage(template,{
    representative:[representative?.first_name,representative?.last_name].map(x=>String(x||'').trim()).filter(Boolean).join(' ')||(active.has('commercial_visitor')?'mi visitador':'mi vendedor'),
    beneficiary:String(profile.business_name||'').trim()||'un negocio patrocinado',
    sponsor:String(representative?.sponsor_name||'').trim()||'mi patrocinador'
  })
  const contact_url=digits?'https://wa.me/'+digits+'?text='+encodeURIComponent(message):''
  return{
    contact_label:contact_url?(active.has('commercial_visitor')?'Mi visitador':'Mi vendedor'):'',
    contact_url,
    resource_label:resource_url?(String(resource?.resource_label||'').trim()||(active.has('commercial_catalog')?'Catálogo':'Vademécum')):'',
    resource_url,
  }
}
