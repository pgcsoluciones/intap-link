import { normalizeGoogleReviewUrl, parseExternalReviewSettings, publicExternalReviews } from './external-google'
import { readIntapSelection, matchesActiveIntapTab } from '../intap-active-account'
import { getEntitlements } from '../engine/entitlements'
import { isPreviewEnvironment } from '../lib/cookies'

type LinkProfile = {id:string; slug:string; user_id:string; plan_id:string; is_active:number; is_published:number; template_id:string|null; email:string}
type ReviewSettingsRow = {enabled:number; google_review_url:string}
const moduleCode='reviews_google'
const specialTemplates=new Set(['real_estate_novi_v4','automotive_jason_v3','events_1a_v1','car_rental_rentao_v1','industrial_aycdom_v1','personal_brand_adonisg_v1'])
const selectProfile=`SELECT p.id,p.slug,p.user_id,p.plan_id,p.is_active,p.is_published,p.template_id,u.email
 FROM profiles p JOIN users u ON u.id=p.user_id`

/** Link-specific adapter; other product adapters must implement their own authority. */
async function eligible(c:any,p:LinkProfile):Promise<boolean>{
  if(Number(p.is_active)!==1||!p.slug||specialTemplates.has(p.template_id||''))return false
  const db=c.env.DB as D1Database
  const [catalog,team,demo,limits]=await Promise.all([
    db.prepare('SELECT effects_json FROM modules WHERE code=?').bind(moduleCode).first<{effects_json:string}>(),
    db.prepare(`SELECT 1 FROM team_workspaces WHERE master_profile_id=? AND status='active'
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
      return c.json({ok:true,data:{...config,published:Number(p.is_published)===1,publicUrl:publicUrl(c,p),stats:{days,views,qr:count('review_qr'),clicks,clickRate:views?Math.round(clicks/views*1000)/10:null}}})
    }catch{return failed(c)}
  })
  me.put('/profile/reviews/:profileId',async(c:any)=>{
    noCache(c)
    try{
      const p=await ownedProfile(c);if(!p)return unavailable(c)
      let raw:unknown;try{raw=await c.req.json()}catch{return c.json({ok:false,error:'JSON no válido.'},400)}
      const config=parseExternalReviewSettings(raw);if(!config)return c.json({ok:false,error:'Introduce un enlace oficial de reseñas de Google válido.'},400)
      // Independent row; no template_data writes or link slots.
      await (c.env.DB as D1Database).prepare(`INSERT INTO profile_review_settings(profile_id,enabled,google_review_url)
        VALUES(?,?,?) ON CONFLICT(profile_id) DO UPDATE SET enabled=excluded.enabled,google_review_url=excluded.google_review_url,updated_at=datetime('now')`)
        .bind(p.id,config.enabled?1:0,config.googleReviewUrl).run()
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
      await (c.env.DB as D1Database).prepare(`INSERT INTO analytics(id,profile_id,event_type,target_id)
        SELECT ?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM analytics WHERE profile_id=? AND event_type=? AND target_id=?)`)
        .bind(crypto.randomUUID(),p.id,event,target,p.id,event,target).run()
      return c.json({ok:true})
    }catch{return failed(c)}
  })
}
