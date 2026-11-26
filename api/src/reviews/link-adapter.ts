import { normalizeGoogleReviewUrl, parseExternalReviewSettings, publicExternalReviews } from './external-google'
import { readIntapSelection, matchesActiveIntapTab } from '../intap-active-account'
import { getEntitlements } from '../engine/entitlements'
import { isPreviewEnvironment } from '../lib/cookies'
import { googleSearchCapability,parseGoogleSearchInput,reserveGoogleSearch,searchGooglePlaces,GoogleSearchError } from './google-place-search'

type LinkProfile = {id:string; name:string|null; slug:string; user_id:string; plan_id:string; is_active:number; is_published:number; template_id:string|null; email:string}
type ReviewSettingsRow = {enabled:number; google_review_url:string}
const moduleCode='reviews_google'
// Base IDs used by the generic renderer; registered special templates remain excluded.
const genericTemplates=new Set(['','intap_profile_v2','intap-v2','restaurante','servicios','eventos'])
const selectProfile=`SELECT p.id,p.name,p.slug,p.user_id,p.plan_id,p.is_active,p.is_published,p.template_id,u.email
 FROM profiles p JOIN users u ON u.id=p.user_id`

/** Link-specific adapter; other product adapters must implement their own authority. */
async function eligible(c:any,p:LinkProfile):Promise<boolean>{
  if(Number(p.is_active)!==1||!p.slug||!genericTemplates.has(p.template_id||''))return false
  const db=c.env.DB as D1Database
  // A Team Master owns its own profile; members never edit corporate reviews.
  const [catalog,demo,limits]=await Promise.all([
    db.prepare('SELECT effects_json FROM modules WHERE code=? AND is_active=1').bind(moduleCode).first<{effects_json:string}>(),
    db.prepare("SELECT 1 FROM free_demo_v2_profiles WHERE profile_id=? AND status!='claimed' LIMIT 1").bind(p.id).first(),
    getEntitlements(c,p.id)
  ])
  if(demo||!catalog||!limits)return false
  try{
    const effects=JSON.parse(catalog.effects_json)
    return Array.isArray(effects.includedPlans)&&effects.includedPlans.includes(p.plan_id)
  }catch{return false}
}
// Read-only Team authority. Any member relation is checked, including inactive ones.
async function teamMembership(c:any,profileId:string){
  return (c.env.DB as D1Database).prepare(`SELECT tm.status member_status,tw.status team_status,tw.master_profile_id,tw.owner_user_id
    FROM team_members tm JOIN team_workspaces tw ON tw.id=tm.team_id
    WHERE tm.profile_id=? LIMIT 1`).bind(profileId).first<{member_status:string;team_status:string;master_profile_id:string;owner_user_id:string}>()
}
async function ownedProfile(c:any):Promise<LinkProfile|null>{
  if(c.get('freeDemoDelegated')||c.req.header('X-Kawvo-Free-Demo-Id')||c.req.header('X-KawMed-Delegate'))return null
  const db=c.env.DB as D1Database
  const p=await db.prepare(selectProfile+' WHERE p.id=? AND p.user_id=? LIMIT 1')
    .bind(c.req.param('profileId'),c.get('userId')).first<LinkProfile>()
  if(!p)return null
  if(p.email.trim().toLowerCase()==='intapcard@gmail.com'){
    const active=await readIntapSelection(c)
    if(!active||active.id!==p.id||active.kind!==(p.plan_id==='free'?'free':'paid')||!matchesActiveIntapTab(c,active))return null
  }
  if(await teamMembership(c,p.id))return null
  return await eligible(c,p)?p:null
}
async function publishedProfile(c:any,slug:string):Promise<LinkProfile|null>{
  const p=await (c.env.DB as D1Database).prepare(selectProfile+' WHERE p.slug=? AND p.is_active=1 AND p.is_published=1 LIMIT 1').bind(slug).first<LinkProfile>()
  return p&&await eligible(c,p)?p:null
}
// Team members display the Master's published corporate review destination.
// No copy into the member's settings and no member or delegate write grant.
async function publicReviewSource(c:any,p:LinkProfile):Promise<string|null>{
  const relation=await teamMembership(c,p.id)
  if(!relation)return p.id
  if(relation.member_status!=='active'||relation.team_status!=='active'||relation.master_profile_id===p.id)return null
  const master=await (c.env.DB as D1Database).prepare(selectProfile+' WHERE p.id=? AND p.user_id=? AND p.is_active=1 AND p.is_published=1 LIMIT 1').bind(relation.master_profile_id,relation.owner_user_id).first<LinkProfile>()
  if(!master||!await eligible(c,master)||await teamMembership(c,master.id))return null
  return master.id
}
async function settings(c:any,id:string){
  const row=await (c.env.DB as D1Database).prepare('SELECT enabled,google_review_url FROM profile_review_settings WHERE profile_id=?').bind(id).first<ReviewSettingsRow>()
  return row?{enabled:Number(row.enabled)===1,googleReviewUrl:row.google_review_url}:{enabled:false,googleReviewUrl:''}
}
function unavailable(c:any){return c.json({ok:false,error:'Reseñas no está disponible para esta cuenta.'},403)}
function failed(c:any){return c.json({ok:false,error:'Reseñas no disponible temporalmente.'},503)}
function noCache(c:any){c.header('Cache-Control','no-store')}
function publicUrl(c:any,p:ReviewSubject,namespace=''){
  const origin=isPreviewEnvironment(c.env)?'https://preview.intaprd.com':'https://intaprd.com'
  return p.slug?origin+'/'+namespace+encodeURIComponent(p.slug):''
}
const validEvents=new Set(['review_view','review_qr','review_click'])
const periods=new Set([7,30,90])
export type ReviewSubject={id:string;name:string|null;slug:string;user_id:string;is_published:number}
export type ReviewRouteAdapter={
 privatePath:string; publicPath:string; namespace:string; quotaPrefix:string;
 owned:(c:any)=>Promise<ReviewSubject|null>;
 published:(c:any,slug:string)=>Promise<ReviewSubject|null>;
 source:(c:any,p:ReviewSubject)=>Promise<string|null>;
 settings:(c:any,id:string)=>Promise<{enabled:boolean;googleReviewUrl:string}>;
 address:(c:any,p:ReviewSubject)=>Promise<string>;
 statsSql:string; saveSql:string; trackSql:string;
}
const linkAdapter:ReviewRouteAdapter={
 privatePath:'/profile/reviews/:profileId',publicPath:'/api/v1/public/profiles/:slug/reviews',namespace:'',quotaPrefix:'',
 owned:ownedProfile,published:publishedProfile,source:(c,p)=>publicReviewSource(c,p as LinkProfile),settings,
 address:async(c,p)=>{const contact=await (c.env.DB as D1Database).prepare('SELECT address FROM profile_contact WHERE profile_id=? LIMIT 1').bind(p.id).first<{address:string|null}>().catch(()=>null);return String(contact?.address||'')},
 statsSql:`SELECT event_type,COUNT(*) n FROM analytics WHERE profile_id=? AND event_type IN ('review_view','review_qr','review_click') AND created_at>=datetime('now',?) GROUP BY event_type`,
 saveSql:`INSERT INTO profile_review_settings(profile_id,enabled,google_review_url)
 SELECT id,?,? FROM profiles WHERE id=? AND user_id=? AND is_active=1
 ON CONFLICT(profile_id) DO UPDATE SET enabled=excluded.enabled,google_review_url=excluded.google_review_url,updated_at=datetime('now')`,
 trackSql:`INSERT INTO analytics(id,profile_id,event_type,target_id)
 SELECT ?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM analytics WHERE profile_id=? AND event_type=? AND target_id=?)`
}
export function registerLinkReviewRoutes(app:any,me:any){registerReviewRoutes(app,me,linkAdapter)}
/** Shared transport, validation and event semantics. Adapters own identity and storage. */
export function registerReviewRoutes(app:any,me:any,adapter:ReviewRouteAdapter){
  me.get(adapter.privatePath,async(c:any)=>{
    noCache(c)
    try{
      const p=await adapter.owned(c);if(!p)return unavailable(c)
      const days=Number(c.req.query('days')||30);if(!periods.has(days))return c.json({ok:false,error:'Período no válido.'},400)
      const config=await adapter.settings(c,p.id)
      const rows=await (c.env.DB as D1Database).prepare(adapter.statsSql).bind(p.id,'-'+days+' days').all<{event_type:string;n:number}>()
      const count=(type:string)=>Number(rows.results.find(r=>r.event_type===type)?.n||0)
      const views=count('review_view'),clicks=count('review_click')
      const search=googleSearchCapability(c.env)
      const address=search.available?await adapter.address(c,p):''
      const googleSearch=search.available?{...search,businessName:String(p.name||'').slice(0,120),address:address.slice(0,180)}:search
      return c.json({ok:true,data:{...config,googleSearch,published:Number(p.is_published)===1,publicUrl:publicUrl(c,p,adapter.namespace),stats:{days,views,qr:count('review_qr'),clicks,clickRate:views?Math.round(clicks/views*1000)/10:null}}})
    }catch{return failed(c)}
  })
  me.post(adapter.privatePath+'/google-search',async(c:any)=>{
    noCache(c)
    const error=(code:string,message:string,status:number)=>c.json({ok:false,code,error:message},status)
    try{
      // Explicit administrative browser origin + existing session/active-tab authority.
      const origin=isPreviewEnvironment(c.env)?'https://app.preview.intaprd.com':'https://app.intaprd.com'
      if(c.req.header('Origin')!==origin)return error('GOOGLE_SEARCH_ORIGIN','Origen no autorizado.',403)
      const p=await adapter.owned(c);if(!p)return unavailable(c)
      if(!googleSearchCapability(c.env).available)return error('GOOGLE_SEARCH_UNAVAILABLE','La búsqueda no está disponible. Puedes introducir tu enlace manualmente.',503)
      if(String(c.req.header('Content-Type')||'').split(';')[0].trim().toLowerCase()!=='application/json')return error('GOOGLE_SEARCH_INPUT','Datos de búsqueda no válidos.',400)
      let raw:unknown
      try{
        const reader=c.req.raw.body?.getReader()
        if(!reader)throw Error('body')
        const decoder=new TextDecoder('utf-8')
        let size=0,body=''
        while(true){
          const part=await reader.read()
          if(part.done)break
          size+=part.value.byteLength
          if(size>2048){await reader.cancel();throw Error('body limit')}
          body+=decoder.decode(part.value,{stream:true})
        }
        body+=decoder.decode()
        // Workers types do not support the fatal constructor option. Reject replacement characters instead.
        if(body.includes('\uFFFD'))throw Error('invalid utf8')
        raw=JSON.parse(body)
      }catch{return error('GOOGLE_SEARCH_INPUT','Datos de búsqueda no válidos.',400)}
      const input=parseGoogleSearchInput(raw)
      if(!input)return error('GOOGLE_SEARCH_INPUT','Comprueba el nombre, país y localidad.',400)
      await reserveGoogleSearch(c.env,String(c.get('userId')),adapter.quotaPrefix+p.id,String(c.req.header('CF-Connecting-IP')||''))
      const results=await searchGooglePlaces(input,c.env)
      return c.json({ok:true,results})
    }catch(e){
      if(e instanceof GoogleSearchError){
        if(e.status===429)c.header('Retry-After','60')
        return error(e.code,e.code==='GOOGLE_SEARCH_BILLING'?'Google rechazó la búsqueda porque la facturación no está habilitada. Puedes continuar manualmente.':e.code==='GOOGLE_SEARCH_PROVIDER_DENIED'?'Google rechazó la consulta. Comprueba las restricciones y la habilitación de Places API (New).':e.status===429?'Alcanzaste el límite de búsquedas. Intenta más tarde o introduce tu enlace manualmente.':'No pudimos buscar tu negocio. Intenta nuevamente o introduce tu enlace manualmente.',e.status)
      }
      return error('GOOGLE_SEARCH_UNAVAILABLE','No pudimos buscar tu negocio. Introduce tu enlace manualmente.',503)
    }
  })
  me.put(adapter.privatePath,async(c:any)=>{
    noCache(c)
    try{
      const p=await adapter.owned(c);if(!p)return unavailable(c)
      let raw:unknown;try{raw=await c.req.json()}catch{return c.json({ok:false,error:'JSON no válido.'},400)}
      const config=parseExternalReviewSettings(raw);if(!config)return c.json({ok:false,error:'Introduce un enlace oficial de reseñas de Google válido.'},400)
      // Independent row; no template_data writes or link slots.
      const result=await (c.env.DB as D1Database).prepare(adapter.saveSql)
        .bind(config.enabled?1:0,config.googleReviewUrl,p.id,p.user_id).run()
      if(!result.meta.changes)return unavailable(c)
      return c.json({ok:true,data:config})
    }catch{return failed(c)}
  })
  app.get(adapter.publicPath,async(c:any)=>{
    noCache(c)
    try{
      const p=await adapter.published(c,c.req.param('slug'));if(!p)return c.json({ok:true,data:null})
      const source=await adapter.source(c,p);if(!source)return c.json({ok:true,data:null})
      return c.json({ok:true,data:publicExternalReviews(await adapter.settings(c,source),true,true)})
    }catch{return failed(c)}
  })
  app.post(adapter.publicPath+'/track',async(c:any)=>{
    noCache(c)
    try{
      const body=await c.req.json().catch(()=>null)
      if(!body||!validEvents.has(body.eventType)||typeof body.visitId!=='string'||!/^[a-f0-9-]{36}$/i.test(body.visitId))return c.json({ok:false,error:'Evento no válido.'},400)
      const p=await adapter.published(c,c.req.param('slug'));if(!p)return c.json({ok:false},404)
      const source=await adapter.source(c,p);if(!source)return c.json({ok:false},404)
      const config=await adapter.settings(c,source);if(!config.enabled||!normalizeGoogleReviewUrl(config.googleReviewUrl))return c.json({ok:false},404)
      const event=String(body.eventType),target='reviews:'+body.visitId
      const db=c.env.DB as D1Database
      const insert=(type:string)=>db.prepare(adapter.trackSql)
        .bind(crypto.randomUUID(),p.id,type,target,p.id,type,target)
      // A click is itself evidence that the section was seen. Atomic pair keeps
      // the numerator inside the denominator even if a browser view POST fails.
      if(event==='review_click')await db.batch([insert('review_view'),insert(event)])
      else await insert(event).run()
      return c.json({ok:true})
    }catch{return failed(c)}
  })
}
