import {registerReviewRoutes,type ReviewRouteAdapter,type ReviewSubject} from './link-adapter'
import {resolveOwnedSponsoredProfile,sponsoredProfileScope} from '../sponsored-profile-scope'
import {sponsoredMultiProfileAccess,resolveSponsorMembership} from '../sponsored-multiprofile-access'
import {readIntapSelection,matchesActiveIntapTab} from '../intap-active-account'

type SponsoredRow={id:string;user_id:string;username:string|null;business_name:string|null;address:string|null;status:string;profile_role:string|null;sponsor_id:string}
const subject=(row:SponsoredRow):ReviewSubject=>({id:row.id,user_id:row.user_id,slug:row.username||'',name:row.business_name,is_published:row.status==='published'?1:0})
const validRole=(row:SponsoredRow)=>row.profile_role==='sponsor_owner'||row.profile_role==='beneficiary'||row.profile_role===null
// Existing scoped resolver plus exact identity/owner and active-tab checks.
// Ordinary beneficiaries must not send a profile_id selector.
async function owned(c:any):Promise<ReviewSubject|null>{
 if(c.get('freeDemoDelegated')||c.req.header('X-Kawvo-Free-Demo-Id')||c.req.header('X-KawMed-Delegate'))return null
 const user=String(c.get('userId')||'');if(!user)return null
 const rawScope=c.req.query('scope');if(rawScope!==undefined&&rawScope!=='master')return null
 const scope=sponsoredProfileScope(c)
 if(await sponsoredMultiProfileAccess(c,user)){
  const active=await readIntapSelection(c)
  if(!active||active.kind!==(scope==='master'?'sponsor':'sponsored')||!matchesActiveIntapTab(c,active))return null
 }
 const row=await resolveOwnedSponsoredProfile(c,user,scope) as SponsoredRow|null
 if(!row||row.id!==c.req.param('profileId')||row.user_id!==user||!validRole(row)||!['draft','published'].includes(row.status))return null
 if(scope==='master'){
  if(row.profile_role!=='sponsor_owner')return null
  const membership=await resolveSponsorMembership(c,user)
  if(!membership||String((membership as any).sponsor_id)!==row.sponsor_id||String((membership as any).role)!=='owner')return null
 }else if(row.profile_role==='sponsor_owner')return null
 return subject(row)
}
// Keep sponsored public publication rules: disabling a sponsor's new claims
// does not unpublish already claimed beneficiary presentations.
async function published(c:any,slug:string):Promise<ReviewSubject|null>{
 if(!/^[a-z0-9][a-z0-9-]{2,29}$/.test(slug))return null
 const row=await (c.env.DB as D1Database).prepare("SELECT sp.* FROM sponsored_profiles sp JOIN sponsor_tenants st ON st.id=sp.sponsor_id WHERE sp.username=? AND sp.status='published' AND sp.user_id IS NOT NULL LIMIT 1").bind(slug).first<SponsoredRow>()
 return row&&validRole(row)?subject(row):null
}
const adapter:ReviewRouteAdapter={
 privatePath:'/sponsored-profile/reviews/:profileId',publicPath:'/api/v1/public/sponsored/:slug/reviews',namespace:'p/',quotaPrefix:'sponsored:',
 owned,published,source:async(_c,p)=>p.id,
 settings:async(c,id)=>{
  const row=await (c.env.DB as D1Database).prepare('SELECT enabled,google_review_url FROM sponsored_review_settings WHERE sponsored_profile_id=?').bind(id).first<{enabled:number;google_review_url:string}>()
  return row?{enabled:Number(row.enabled)===1,googleReviewUrl:row.google_review_url}:{enabled:false,googleReviewUrl:''}
 },
 address:async(c,p)=>{
  const row=await (c.env.DB as D1Database).prepare('SELECT address FROM sponsored_profiles WHERE id=? AND user_id=?').bind(p.id,p.user_id).first<{address:string|null}>()
  return String(row?.address||'')
 },
 statsSql:`SELECT event_type,COUNT(*) n FROM sponsored_review_events WHERE sponsored_profile_id=? AND event_type IN ('review_view','review_qr','review_click') AND created_at>=datetime('now',?) GROUP BY event_type`,
 saveSql:`INSERT INTO sponsored_review_settings(sponsored_profile_id,enabled,google_review_url)
 SELECT id,?,? FROM sponsored_profiles WHERE id=? AND user_id=? AND status IN ('draft','published')
 ON CONFLICT(sponsored_profile_id) DO UPDATE SET enabled=excluded.enabled,google_review_url=excluded.google_review_url,updated_at=datetime('now')`,
 trackSql:`INSERT OR IGNORE INTO sponsored_review_events(id,sponsored_profile_id,event_type,target_id)
 SELECT ?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM sponsored_review_events WHERE sponsored_profile_id=? AND event_type=? AND target_id=?)`
}
export function registerSponsoredReviewRoutes(app:any,me:any){registerReviewRoutes(app,me,adapter)}
