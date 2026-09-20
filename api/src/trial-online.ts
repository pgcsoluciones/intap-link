import { cookieNames } from './lib/cookies'
import { TRIAL_MASTER } from './trial-profiles'

const RESERVED = new Set(['edit','mi','admin','api','ia','s','demo','new','nuevo','crear','master'])
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function normalizeSlug(input: unknown) {
  return String(input || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60)
}
function validSlug(slug:string){return slug.length>=2 && slug.length<=60 && SLUG_RE.test(slug) && !RESERVED.has(slug)}
function normalizeEmail(value:any){return String(value||'').trim().toLowerCase().slice(0,160)}
function normalizePhone(value:any){return String(value||'').replace(/\D/g,'').slice(0,20)}
function normalizeInstagram(value:any){return String(value||'').trim().toLowerCase().replace(/^https?:\/\/(www\.)?instagram\.com\//i,'').replace(/^@/,'').replace(/[/?#].*$/,'').slice(0,80)}
function sqlDate(d:Date){return d.toISOString().replace('T',' ').replace('Z','')}
function parseJson(value:any){try{return JSON.parse(String(value||'{}'))}catch{return {}}}
function str(value:any,max=180){return String(value||'').trim().slice(0,max)}
async function sha256Hex(input:string){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input));return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('')}
function parseCookie(header:string,name:string){const escaped=name.replace(/[.*+?^$()|[\]\\]/g,'\\$&');const match=header.match(new RegExp('(?:^|;\\s*)'+escaped+'=([^;]*)'));return match?decodeURIComponent(match[1]):null}
async function sessionUserId(c:any){const raw=parseCookie(c.req.header('Cookie')||'',cookieNames(c.env).session);if(!raw)return null;const row=await c.env.DB.prepare("SELECT user_id FROM auth_sessions WHERE session_hash=? AND expires_at>datetime('now') AND revoked_at IS NULL LIMIT 1").bind(await sha256Hex(raw)).first();return row?String((row as any).user_id||''):null}
async function requireOwner(c:any,next:any){const id=await sessionUserId(c);if(!id)return c.json({ok:false,error:'Unauthorized'},401);c.set('userId',id);await next()}
function assetUrl(c:any,key:string){const origin=new URL(c.req.url).origin;return `${origin}/api/v1/public/assets/${key.split('/').map(encodeURIComponent).join('/')}`}
function ext(file:File){const t:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};return t[file.type]||''}
async function claimIdentity(env:any,trialId:string,userId:string,type:'user'|'email'|'phone'|'instagram',value:string){
  if(!value)return
  await env.DB.prepare('INSERT OR IGNORE INTO trial_identity_claims(id,trial_id,user_id,identity_type,identity_normalized) VALUES(?,?,?,?,?)')
    .bind(crypto.randomUUID(),trialId,userId,type,value).run()
}
async function identityConflict(env:any,userId:string,email:string,phone:string){
  const items:[string,string][]=[['user',userId],['email',email],['phone',phone]].filter((x):x is [string,string]=>Boolean(x[1]))
  for(const [type,value] of items){
    const row=await env.DB.prepare('SELECT trial_id,user_id FROM trial_identity_claims WHERE identity_type=? AND identity_normalized=? LIMIT 1').bind(type,value).first()
    if(row)return row
  }
  return null
}
function state(row:any){
  const expired=Boolean(row?.expires_at)&&Date.parse(String(row.expires_at).replace(' ','T')+'Z')<=Date.now()
  if(expired)return 'expired'
  if(Number(row?.is_disabled||0))return 'inactive'
  return String(row?.status||'draft')
}
function output(row:any){
  return {
    id:row.id,slug:row.slug||null,name:row.name||null,status:state(row),origin:row.origin||'online',
    profile:parseJson(row.profile_json),duration_hours:Number(row.duration_hours||96),
    owner_user_id:row.owner_user_id||null,started_at:row.started_at||null,activated_at:row.activated_at||null,
    expires_at:row.expires_at||null,expiration_notice_acknowledged_at:row.expiration_notice_acknowledged_at||null,
    conversion_requested_at:row.conversion_requested_at||null,converted_at:row.converted_at||null,
    created_at:row.created_at,updated_at:row.updated_at
  }
}
async function owned(c:any,id:string){
  const userId=String(c.get('userId')||'')
  return c.env.DB.prepare('SELECT * FROM trial_profiles WHERE id=? AND owner_user_id=? LIMIT 1').bind(id,userId).first()
}
async function addEvent(c:any,trialId:string,eventType:string,details:any={}){
  await c.env.DB.prepare('INSERT INTO trial_events(id,trial_id,event_type,details_json,created_by_admin_user_id) VALUES(?,?,?,?,NULL)')
    .bind(crypto.randomUUID(),trialId,eventType,JSON.stringify(details||{})).run()
}

export function registerTrialOnlineRoutes(app:any){
  app.get('/api/v1/me/trials/online', requireOwner, async(c:any)=>{
    const userId=String(c.get('userId')||'')
    const row=await c.env.DB.prepare('SELECT * FROM trial_profiles WHERE owner_user_id=? ORDER BY created_at DESC LIMIT 1').bind(userId).first()
    return c.json({ok:true,data:row?output(row):null})
  })

  app.get('/api/v1/me/trials/online/:id', requireOwner, async(c:any)=>{
    const row=await owned(c,c.req.param('id'))
    if(!row)return c.json({ok:false,error:'Trial no encontrado.'},404)
    return c.json({ok:true,data:output(row)})
  })

  app.post('/api/v1/me/trials/online/start', requireOwner, async(c:any)=>{
    const userId=String(c.get('userId')||'')
    const existing=await c.env.DB.prepare('SELECT * FROM trial_profiles WHERE owner_user_id=? ORDER BY created_at DESC LIMIT 1').bind(userId).first()
    if(existing)return c.json({ok:true,data:output(existing),reused:true})

    let body:any={};try{body=await c.req.json()}catch{body={}}
    const user=await c.env.DB.prepare('SELECT email FROM users WHERE id=? LIMIT 1').bind(userId).first()
    const email=normalizeEmail((user as any)?.email||body?.email)
    const phone=normalizePhone(body?.phone||body?.whatsapp)
    const conflict=await identityConflict(c.env,userId,email,phone)
    if(conflict){
      const previous=await c.env.DB.prepare('SELECT * FROM trial_profiles WHERE id=? LIMIT 1').bind(String((conflict as any).trial_id||'')).first()
      return c.json({ok:false,error:'Esta identidad ya utilizó una prueba gratuita de KawLink.',code:'trial_already_used',data:previous?output(previous):null},409)
    }

    const id=crypto.randomUUID()
    const snapshot=JSON.parse(JSON.stringify(TRIAL_MASTER))
    snapshot.profile.id=id
    snapshot.profile.slug=''
    snapshot.modules={banks:{enabled:false,items:[]}}
    const now=new Date()
    const startedAt=sqlDate(now)
    const expiresAt=sqlDate(new Date(now.getTime()+96*60*60*1000))
    await c.env.DB.prepare(`INSERT INTO trial_profiles(
      id,status,profile_json,created_by_admin_user_id,duration_hours,
      contact_name,contact_phone,contact_whatsapp,contact_email,contact_instagram,
      company_name,company_type,contact_source,contact_source_detail,prospect_notes,
      owner_user_id,started_at,origin,email_normalized,phone_normalized,expires_at
    ) VALUES(?,'draft',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'online',?,?,?)`).bind(
      id,JSON.stringify(snapshot),'online:'+userId,96,
      str(body?.name,120),str(body?.phone,40),str(body?.whatsapp||body?.phone,40),email,'',
      '',str(body?.sector,120),'web','KawLink Trial Online','',
      userId,startedAt,email,phone,expiresAt
    ).run()
    await claimIdentity(c.env,id,userId,'user',userId)
    if(email)await claimIdentity(c.env,id,userId,'email',email)
    if(phone)await claimIdentity(c.env,id,userId,'phone',phone)
    await addEvent(c,id,'trial.online_started',{started_at:startedAt,expires_at:expiresAt,duration_hours:96})
    const row=await c.env.DB.prepare('SELECT * FROM trial_profiles WHERE id=? LIMIT 1').bind(id).first()
    return c.json({ok:true,data:output(row),reused:false},201)
  })

  app.get('/api/v1/me/trials/online/slug/:slug', requireOwner, async(c:any)=>{
    const slug=normalizeSlug(c.req.param('slug'))
    if(!validSlug(slug))return c.json({ok:true,available:false,slug,reason:'invalid'})
    const userId=String(c.get('userId')||'')
    const own=await c.env.DB.prepare('SELECT id FROM trial_profiles WHERE owner_user_id=? ORDER BY created_at DESC LIMIT 1').bind(userId).first()
    const row=own
      ? await c.env.DB.prepare('SELECT id FROM trial_profiles WHERE slug=? AND id<>? LIMIT 1').bind(slug,(own as any).id).first()
      : await c.env.DB.prepare('SELECT id FROM trial_profiles WHERE slug=? LIMIT 1').bind(slug).first()
    return c.json({ok:true,available:!row,slug})
  })

  app.patch('/api/v1/me/trials/online/:id', requireOwner, async(c:any)=>{
    const id=c.req.param('id');const row=await owned(c,id)
    if(!row)return c.json({ok:false,error:'Trial no encontrado.'},404)
    if(state(row)==='expired')return c.json({ok:false,error:'Tu prueba ya finalizó.',code:'trial_expired'},410)
    let body:any={};try{body=await c.req.json()}catch{return c.json({ok:false,error:'JSON inválido.'},400)}
    if(!body?.profile||typeof body.profile!=='object'||Array.isArray(body.profile))return c.json({ok:false,error:'Perfil inválido.'},400)
    const encoded=JSON.stringify(body.profile)
    if(encoded.length>180000)return c.json({ok:false,error:'El perfil supera el tamaño permitido.'},413)
    const userId=String(c.get('userId')||'')
    await c.env.DB.prepare("UPDATE trial_profiles SET profile_json=?,updated_at=datetime('now') WHERE id=? AND owner_user_id=?").bind(encoded,id,userId).run()
    const instagram=normalizeInstagram(body?.profile?.profile?.instagram)
    if(instagram)await claimIdentity(c.env,id,userId,'instagram',instagram)
    return c.json({ok:true,data:{id,updated_at:new Date().toISOString()}})
  })

  app.post('/api/v1/me/trials/online/:id/publish', requireOwner, async(c:any)=>{
    const id=c.req.param('id');const row=await owned(c,id)
    if(!row)return c.json({ok:false,error:'Trial no encontrado.'},404)
    if(state(row)==='expired')return c.json({ok:false,error:'Tu prueba ya finalizó.',code:'trial_expired'},410)
    let body:any={};try{body=await c.req.json()}catch{return c.json({ok:false,error:'JSON inválido.'},400)}
    const snapshot=parseJson((row as any).profile_json)
    const profile=snapshot?.profile||{}
    const name=str(body?.name||profile.name,100)
    const role=str(profile.role,100)
    const phone=normalizePhone(profile.whatsapp||profile.phone)
    if(!name||!role||!phone)return c.json({ok:false,error:'Completa nombre, cargo o especialidad y teléfono/WhatsApp antes de publicar.',code:'required_fields_missing'},422)
    const currentSlug=str((row as any).slug,60)
    const requested=normalizeSlug(body?.slug||name)
    if(currentSlug&&requested&&requested!==currentSlug)return c.json({ok:false,error:'El usuario de una presentación publicada es permanente.',code:'slug_locked'},409)
    const slug=currentSlug||requested
    if(!validSlug(slug))return c.json({ok:false,error:'El usuario elegido no es válido.',code:'slug_invalid'},400)
    const duplicate=await c.env.DB.prepare('SELECT id FROM trial_profiles WHERE slug=? AND id<>? LIMIT 1').bind(slug,id).first()
    if(duplicate)return c.json({ok:false,error:'Ese usuario ya está en uso.',code:'slug_taken'},409)
    const expiresAt=str((row as any).expires_at,40)
    if(!expiresAt||Date.parse(expiresAt.replace(' ','T')+'Z')<=Date.now())return c.json({ok:false,error:'Tu prueba ya finalizó.',code:'trial_expired'},410)
    const activatedAt=str((row as any).activated_at,40)||sqlDate(new Date())
    snapshot.profile.slug=slug
    snapshot.profile.vcardFileName=`${slug}.vcf`
    const userId=String(c.get('userId')||'')
    await c.env.DB.prepare("UPDATE trial_profiles SET slug=?,name=?,status='active',profile_json=?,activated_at=?,updated_at=datetime('now') WHERE id=? AND owner_user_id=?")
      .bind(slug,name,JSON.stringify(snapshot),activatedAt,id,userId).run()
    const instagram=normalizeInstagram(snapshot.profile.instagram)
    if(instagram)await claimIdentity(c.env,id,userId,'instagram',instagram)
    await addEvent(c,id,'trial.published',{slug,activated_at:activatedAt,expires_at:expiresAt,online:true})
    return c.json({ok:true,data:{id,slug,name,status:'active',activated_at:activatedAt,expires_at:expiresAt,url:`/trial/${slug}`}})
  })

  app.post('/api/v1/me/trials/online/:id/media', requireOwner, async(c:any)=>{
    const id=c.req.param('id');const row=await owned(c,id)
    if(!row)return c.json({ok:false,error:'Trial no encontrado.'},404)
    if(state(row)==='expired')return c.json({ok:false,error:'Tu prueba ya finalizó.',code:'trial_expired'},410)
    const kind=String(c.req.query('kind')||'gallery')
    if(!['avatar','hero','gallery'].includes(kind))return c.json({ok:false,error:'Tipo de imagen no válido.'},400)
    const fd=await c.req.formData();const raw=fd.get('file')
    if(!(raw&&typeof raw==='object'&&'stream' in (raw as any)))return c.json({ok:false,error:'Archivo requerido.'},400)
    const file=raw as File;const extension=ext(file)
    if(!extension)return c.json({ok:false,error:'Usa JPG, PNG o WEBP.'},400)
    if(Number(file.size||0)>8*1024*1024)return c.json({ok:false,error:'La imagen supera 8 MB.'},413)
    const key=`trials/${id}/${kind}/${crypto.randomUUID()}.${extension}`
    await c.env.BUCKET.put(key,file.stream(),{httpMetadata:{contentType:file.type}})
    return c.json({ok:true,url:assetUrl(c,key),key})
  })

  app.get('/api/v1/me/trials/online/:id/notifications', requireOwner, async(c:any)=>{
    const id=c.req.param('id');if(!await owned(c,id))return c.json({ok:false,error:'Trial no encontrado.'},404)
    const rows=await c.env.DB.prepare("SELECT id,title,body,cta_label,cta_url,starts_at,ends_at,read_at,created_at FROM trial_notifications WHERE trial_id=? AND is_active=1 AND (starts_at IS NULL OR starts_at<=datetime('now')) AND (ends_at IS NULL OR ends_at>datetime('now')) ORDER BY created_at DESC LIMIT 20").bind(id).all()
    return c.json({ok:true,data:rows.results||[]})
  })

  app.post('/api/v1/me/trials/online/:id/notifications/:notificationId/read', requireOwner, async(c:any)=>{
    const id=c.req.param('id');if(!await owned(c,id))return c.json({ok:false,error:'Trial no encontrado.'},404)
    await c.env.DB.prepare("UPDATE trial_notifications SET read_at=COALESCE(read_at,datetime('now')) WHERE id=? AND trial_id=?").bind(c.req.param('notificationId'),id).run()
    return c.json({ok:true})
  })

  app.post('/api/v1/me/trials/online/:id/conversion-request', requireOwner, async(c:any)=>{
    const id=c.req.param('id');const userId=String(c.get('userId')||'')
    if(!await owned(c,id))return c.json({ok:false,error:'Trial no encontrado.'},404)
    await c.env.DB.prepare("UPDATE trial_profiles SET conversion_requested_at=COALESCE(conversion_requested_at,datetime('now')),updated_at=datetime('now') WHERE id=? AND owner_user_id=?").bind(id,userId).run()
    await addEvent(c,id,'trial.conversion_requested',{online:true})
    return c.json({ok:true,data:{id,requested:true}})
  })

  app.post('/api/v1/me/trials/online/:id/expiration-ack', requireOwner, async(c:any)=>{
    const id=c.req.param('id');const userId=String(c.get('userId')||'')
    const row=await owned(c,id);if(!row)return c.json({ok:false,error:'Trial no encontrado.'},404)
    if(state(row)!=='expired')return c.json({ok:false,error:'El Trial todavía no ha vencido.'},409)
    await c.env.DB.prepare("UPDATE trial_profiles SET expiration_notice_acknowledged_at=COALESCE(expiration_notice_acknowledged_at,datetime('now')),expiration_notice_acknowledged_by_user_id=?,updated_at=datetime('now') WHERE id=? AND owner_user_id=?")
      .bind(userId,id,userId).run()
    await addEvent(c,id,'trial.expiration_notice_acknowledged',{online:true})
    return c.json({ok:true,data:{id,acknowledged:true}})
  })
}
