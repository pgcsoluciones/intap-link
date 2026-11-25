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
  // Empty auto-created Team workspace is not an actual Team for R4.
  const [catalog,team,demo,limits]=await Promise.all([
    db.prepare('SELECT effects_json FROM modules WHERE code=? AND is_active=1').bind(moduleCode).first<{effects_json:string}>(),
    db.prepare(`SELECT 1 FROM team_workspaces tw WHERE tw.master_profile_id=? AND tw.status='active'
      AND (EXISTS(SELECT 1 FROM team_members tm WHERE tm.team_id=tw.id)
        OR EXISTS(SELECT 1 FROM team_link_codes tc WHERE tc.team_id=tw.id))
      UNION ALL SELECT 1 FROM team_members tm JOIN team_workspaces tw ON tw.id=tm.team_id
      WHERE tm.profile_id=? AND tm.status='active' AND tw.status='active' LIMIT 1`).bind(p.id,p.id).first(),
    db.prepare("SELECT 1 FROM free_demo_v2_profiles WHERE profile_id=? AND status!='claimed' LIMIT 1").bind(p.id).first(),
    getEntitlements(c,p.id)
  ])
  if(team||demo||!catalog||!limits)return false
  try{
    const effects=JSON.parse(catalog.effects_json)
    return Array.isArray(effects.includedPlans)&&effects.includedPlans.includes(p.plan_id)
  }catch{return false}
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
  return await eligible(c,p)?p:null
}
async function publishedProfile(c:any,slug:string):Promise<LinkProfile|null>{
  const p=await (c.env.DB as D1Database).prepare(selectProfile+' WHERE p.slug=? AND p.is_active=1 AND p.is_published=1 LIMIT 1').bind(slug).first<LinkProfile>()
  return p&&await eligible(c,p)?p:null
}
async function settings(c:any,id:string){
  const row=await (c.env.DB as D1Database).prepare('SELECT enabled,google_review_url FROM profile_review_settings WHERE profile_id=?').bind(id).first<ReviewSettingsRow>()
  return row?{enabled:Number(row.enabled)===1,googleReviewUrl:row.google_review_url}:{enabled:false,googleReviewUrl:''}
}
function unavailable(c:any){return c.json({ok:false,error:'Reseñas no está disponible para esta cuenta.'},403)}
function failed(c:any){return c.json({ok:false,error:'Reseñas no disponible temporalmente.'},503)}
function noCache(c:any){c.header('Cache-Control','no-store')}
function publicUrl(c:any,p:LinkProfile){
  const origin=isPreviewEnvironment(c.env)?'https://preview.intaprd.com':'https://intaprd.com'
  return origin+'/'+encodeURIComponent(p.slug)
}
const validEvents=new Set(['review_view','review_qr','review_click'])
const periods=new Set([7,30,90])
/** Mounted on the existing authenticated /me router and existing public API. */
export function registerLinkReviewRoutes(app:any,me:any){
  me.get('/profile/reviews/:profileId',async(c:any)=>{
    noCache(c)
    try{
      const p=await ownedProfile(c);if(!p)return unavailable(c)
      const days=Number(c.req.query('days')||30);if(!periods.has(days))return c.json({ok:false,error:'Período no válido.'},400)
      const config=await settings(c,p.id)
      const rows=await (c.env.DB as D1Database).prepare(`SELECT event_type,COUNT(*) n FROM analytics
        WHERE profile_id=? AND event_type IN ('review_view','review_qr','review_click')
        AND created_at>=datetime('now',?) GROUP BY event_type`).bind(p.id,'-'+days+' days').all<{event_type:string;n:number}>()
      const count=(type:string)=>Number(rows.results.find(r=>r.event_type===type)?.n||0)
      const views=count('review_view'),clicks=count('review_click')
      const search=googleSearchCapability(c.env)
      const contact=search.available?await (c.env.DB as D1Database).prepare('SELECT address FROM profile_contact WHERE profile_id=? LIMIT 1').bind(p.id).first<{address:string|null}>().catch(()=>null):null
      const googleSearch=search.available?{...search,businessName:String(p.name||'').slice(0,120),address:String(contact?.address||'').slice(0,180)}:search
      return c.json({ok:true,data:{...config,googleSearch,published:Number(p.is_published)===1,publicUrl:publicUrl(c,p),stats:{days,views,qr:count('review_qr'),clicks,clickRate:views?Math.round(clicks/views*1000)/10:null}}})
    }catch{return failed(c)}
  })
  me.post('/profile/reviews/:profileId/google-search',async(c:any)=>{
    noCache(c)
    const error=(code:string,message:string,status:number)=>c.json({ok:false,code,error:message},status)
    try{
      // Explicit administrative browser origin + existing session/active-tab authority.
      const origin=isPreviewEnvironment(c.env)?'https://app.preview.intaprd.com':'https://app.intaprd.com'
      if(c.req.header('Origin')!==origin)return error('GOOGLE_SEARCH_ORIGIN','Origen no autorizado.',403)
      const p=await ownedProfile(c);if(!p)return unavailable(c)
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
      await reserveGoogleSearch(c.env,String(c.get('userId')),p.id,String(c.req.header('CF-Connecting-IP')||''))
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
  me.put('/profile/reviews/:profileId',async(c:any)=>{
    noCache(c)
    try{
      const p=await ownedProfile(c);if(!p)return unavailable(c)
      let raw:unknown;try{raw=await c.req.json()}catch{return c.json({ok:false,error:'JSON no válido.'},400)}
      const config=parseExternalReviewSettings(raw);if(!config)return c.json({ok:false,error:'Introduce un enlace oficial de reseñas de Google válido.'},400)
      // Independent row; no template_data writes or link slots.
      const result=await (c.env.DB as D1Database).prepare(`INSERT INTO profile_review_settings(profile_id,enabled,google_review_url)
        SELECT id,?,? FROM profiles WHERE id=? AND user_id=? AND is_active=1
        ON CONFLICT(profile_id) DO UPDATE SET enabled=excluded.enabled,google_review_url=excluded.google_review_url,updated_at=datetime('now')`)
        .bind(config.enabled?1:0,config.googleReviewUrl,p.id,p.user_id).run()
      if(!result.meta.changes)return unavailable(c)
      return c.json({ok:true,data:config})
    }catch{return failed(c)}
  })
  app.get('/api/v1/public/profiles/:slug/reviews',async(c:any)=>{
    noCache(c)
    try{
      const p=await publishedProfile(c,c.req.param('slug'));if(!p)return c.json({ok:true,data:null})
      return c.json({ok:true,data:publicExternalReviews(await settings(c,p.id),true,true)})
    }catch{return failed(c)}
  })
  app.post('/api/v1/public/profiles/:slug/reviews/track',async(c:any)=>{
    noCache(c)
    try{
      const body=await c.req.json().catch(()=>null)
      if(!body||!validEvents.has(body.eventType)||typeof body.visitId!=='string'||!/^[a-f0-9-]{36}$/i.test(body.visitId))return c.json({ok:false,error:'Evento no válido.'},400)
      const p=await publishedProfile(c,c.req.param('slug'));if(!p)return c.json({ok:false},404)
      const config=await settings(c,p.id);if(!config.enabled||!normalizeGoogleReviewUrl(config.googleReviewUrl))return c.json({ok:false},404)
      const event=String(body.eventType),target='reviews:'+body.visitId
      const db=c.env.DB as D1Database
      const insert=(type:string)=>db.prepare(`INSERT INTO analytics(id,profile_id,event_type,target_id)
        SELECT ?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM analytics WHERE profile_id=? AND event_type=? AND target_id=?)`)
        .bind(crypto.randomUUID(),p.id,type,target,p.id,type,target)
      // A click is itself evidence that the section was seen. Atomic pair keeps
      // the numerator inside the denominator even if a browser view POST fails.
      if(event==='review_click')await db.batch([insert('review_view'),insert(event)])
      else await insert(event).run()
      return c.json({ok:true})
    }catch{return failed(c)}
  })
}
