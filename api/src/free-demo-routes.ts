import app from './index'
import { requireSuperAdmin } from './lib/admin-auth'
import { buildScopedCookie, cookieNames, isPreviewEnvironment } from './lib/cookies'
import {
  FREE_DEMO_MANAGER_EMAIL,
  FREE_DEMO_CATALOG,
  applyFreeDemoPreset,
  cleanDemoSlug,
  createManagedFreeDemo,
  randomCode,
  randomToken,
  sha256Hex,
  validDemoSlug,
} from './free-demo-core'

const KDF_ITERATIONS=100000
const MANAGEMENT_TTL_SECONDS=8*60*60

function parseCookie(header:string,name:string){
  const escaped=name.replace(/[.*+?^$()|[\]\\]/g,'\\$&')
  const m=header.match(new RegExp('(?:^|;\\s*)'+escaped+'=([^;]*)'))
  return m?decodeURIComponent(m[1]):null
}
function appUrl(c:any){return String(c.env.APP_URL||(isPreviewEnvironment(c.env)?'https://app.preview.intaprd.com':'https://app.intaprd.com')).replace(/\/$/,'')}
function webOrigin(c:any){return String(c.env.WEB_PAGES_ORIGIN||c.env.WEB_URL||'').replace(/\/$/,'')}
function claimCookieName(c:any){return isPreviewEnvironment(c.env)?'kawvo_free_demo_claim_preview':'kawvo_free_demo_claim'}
function managerBridgeCookieName(c:any){return isPreviewEnvironment(c.env)?'kawvo_free_demo_manager_bridge_preview':'kawvo_free_demo_manager_bridge'}
function claimCookie(c:any,value:string,maxAge=900){return buildScopedCookie(c.env,appUrl(c),claimCookieName(c),value,maxAge)}
function managerBridgeCookie(c:any,value:string,maxAge=MANAGEMENT_TTL_SECONDS){return buildScopedCookie(c.env,appUrl(c),managerBridgeCookieName(c),value,maxAge)}
function sessionCookie(c:any,value:string,maxAge=30*24*60*60){return buildScopedCookie(c.env,appUrl(c),cookieNames(c.env).session,value,maxAge)}
function cleanText(v:any,max=160){return String(v??'').trim().slice(0,max)}
function hex(bytes:Uint8Array){return Array.from(bytes).map(b=>b.toString(16).padStart(2,'0')).join('')}
async function passwordHash(password:string,saltHex:string){
  const salt=new Uint8Array((saltHex.match(/.{1,2}/g)||[]).map(x=>parseInt(x,16)))
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits'])
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:KDF_ITERATIONS,hash:'SHA-256'},key,256)
  return hex(new Uint8Array(bits))
}
async function newPasswordRecord(password:string){
  const salt=crypto.getRandomValues(new Uint8Array(16)),saltHex=hex(salt)
  return{salt:saltHex,hash:await passwordHash(password,saltHex)}
}
async function sessionUser(c:any){
  const raw=parseCookie(c.req.header('Cookie')||'',cookieNames(c.env).session)
  if(!raw)return null
  return c.env.DB.prepare("SELECT s.id session_id,s.user_id,u.email FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.session_hash=? AND s.expires_at>datetime('now') AND s.revoked_at IS NULL LIMIT 1")
    .bind(await sha256Hex(raw)).first()
}
async function requireDemoManager(c:any,next:any){
  const row=await sessionUser(c)
  if(!row||String((row as any).email||'').trim().toLowerCase()!==FREE_DEMO_MANAGER_EMAIL)return c.json({ok:false,error:'Forbidden'},403)
  c.set('freeDemoManagerUserId',String((row as any).user_id))
  c.set('freeDemoManagerSessionId',String((row as any).session_id))
  await next()
}
async function activeClaimSession(c:any){
  const raw=parseCookie(c.req.header('Cookie')||'',claimCookieName(c))
  if(!raw)return null
  return c.env.DB.prepare("SELECT s.id session_id,c.id claim_id,c.demo_id,c.special_email,d.profile_id,d.synthetic_owner_user_id,d.artifact_id,p.slug,p.name,p.template_data FROM free_demo_claim_sessions s JOIN free_demo_claims c ON c.id=s.claim_id JOIN free_demo_profiles d ON d.id=c.demo_id JOIN profiles p ON p.id=d.profile_id WHERE s.token_hash=? AND s.consumed_at IS NULL AND s.expires_at>datetime('now') AND c.status='in_progress' AND d.status='claim_ready' LIMIT 1")
    .bind(await sha256Hex(raw)).first()
}
async function activeManagementContext(c:any){
  const bridgeRaw=parseCookie(c.req.header('Cookie')||'',managerBridgeCookieName(c))
  const current=await sessionUser(c)
  if(!bridgeRaw||!current)return null
  return c.env.DB.prepare(`SELECT ms.id management_session_id,ms.manager_user_id,ms.synthetic_owner_user_id,
      d.id demo_id,d.profile_id,d.status,p.slug,p.name,p.is_published
    FROM free_demo_management_sessions ms
    JOIN free_demo_profiles d ON d.id=ms.demo_id
    JOIN profiles p ON p.id=d.profile_id
    WHERE ms.token_hash=? AND ms.synthetic_owner_user_id=? AND ms.consumed_at IS NULL
      AND ms.expires_at>datetime('now') AND d.status<>'claimed'
    LIMIT 1`)
    .bind(await sha256Hex(bridgeRaw),String((current as any).user_id)).first()
}
function jsonWithCookies(body:any,status:number,cookies:string[]){
  const headers=new Headers({'Content-Type':'application/json; charset=UTF-8'})
  for(const cookie of cookies)headers.append('Set-Cookie',cookie)
  return new Response(JSON.stringify(body),{status,headers})
}
function presetExists(key:string){return FREE_DEMO_CATALOG.some(x=>x.key===key)}

// ── Catálogo precargado: fuente única para SuperAdmin y cuenta gestora.
app.get('/api/v1/me/free-demos/catalog',requireDemoManager,async(c:any)=>{
  return c.json({ok:true,data:FREE_DEMO_CATALOG})
})
app.get('/api/v1/superadmin/free-demo/catalog',requireSuperAdmin('viewer'),async(c:any)=>{
  return c.json({ok:true,data:FREE_DEMO_CATALOG})
})

app.get('/api/v1/superadmin/free-demo/template-codes',requireSuperAdmin('viewer'),async(c:any)=>{
  const rows=await c.env.DB.prepare(`SELECT tc.id,tc.preset_key,tc.status,tc.expires_at,tc.used_at,tc.created_at,tc.demo_id,
      p.slug,p.name
    FROM free_demo_template_codes tc
    LEFT JOIN free_demo_profiles d ON d.id=tc.demo_id
    LEFT JOIN profiles p ON p.id=d.profile_id
    ORDER BY tc.created_at DESC
    LIMIT 100`).all()
  return c.json({ok:true,data:rows.results||[]})
})

app.post('/api/v1/superadmin/free-demo/catalog/:presetKey/code',requireSuperAdmin('super_admin'),async(c:any)=>{
  const presetKey=cleanText(c.req.param('presetKey'),40)
  if(!presetExists(presetKey))return c.json({ok:false,error:'Plantilla precargada no válida.'},404)
  const compact=randomCode()
  const raw=`DMO-${compact.slice(0,4)}-${compact.slice(4,8)}-${compact.slice(8,12)}`
  const id=crypto.randomUUID()
  await c.env.DB.prepare(`INSERT INTO free_demo_template_codes
    (id,preset_key,code_hash,status,expires_at,created_by_admin_user_id)
    VALUES(?,?,?,'active',datetime('now','+30 days'),?)`)
    .bind(id,presetKey,await sha256Hex(raw),String(c.get('adminUserId')||'')||null).run()
  const preset=FREE_DEMO_CATALOG.find(x=>x.key===presetKey)
  return c.json({ok:true,data:{id,preset_key:presetKey,preset_label:preset?.label||presetKey,demo_code:raw,status:'active',expires_in_days:30}},201)
})

// ── SuperAdmin: supervisa, publica y entrega códigos de reclamo.
app.get('/api/v1/superadmin/free-demo/profiles',requireSuperAdmin('viewer'),async(c:any)=>{
  const rows=await c.env.DB.prepare("SELECT d.id,d.status,d.rubric,d.created_from,d.created_at,d.claimed_at,p.id profile_id,p.slug,p.name,p.is_published,u.email manager_email,a.public_code FROM free_demo_profiles d JOIN profiles p ON p.id=d.profile_id JOIN users u ON u.id=d.manager_user_id LEFT JOIN intap_artifacts a ON a.id=d.artifact_id ORDER BY d.created_at DESC").all()
  return c.json({ok:true,data:rows.results||[]})
})

app.patch('/api/v1/superadmin/free-demo/profiles/:id',requireSuperAdmin('super_admin'),async(c:any)=>{
  const id=c.req.param('id'),body=await c.req.json().catch(()=>({}))
  const row=await c.env.DB.prepare("SELECT d.profile_id,d.status,d.published_at,p.slug,p.name,p.is_published FROM free_demo_profiles d JOIN profiles p ON p.id=d.profile_id WHERE d.id=? LIMIT 1").bind(id).first()
  if(!row)return c.json({ok:false,error:'Demo no encontrada.'},404)
  if(String((row as any).status)==='claimed')return c.json({ok:false,error:'Ese perfil ya fue reclamado y no puede administrarse como Demo.'},409)
  const profileId=String((row as any).profile_id),published=body.is_published===undefined?Number((row as any).is_published):body.is_published?1:0
  if(published===1&&!String((row as any).published_at||''))return c.json({ok:false,error:'La primera publicación se finaliza desde la cuenta Demo definiendo nombre y slug.',code:'finalize_required'},409)
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE profiles SET is_published=?,updated_at=datetime('now') WHERE id=?").bind(published,profileId),
    c.env.DB.prepare("UPDATE free_demo_profiles SET status=?,updated_at=datetime('now') WHERE id=?").bind(published?'published':'draft',id),
  ])
  return c.json({ok:true,data:{slug:String((row as any).slug),name:String((row as any).name||''),is_published:Boolean(published),status:published?'published':'draft'}})
})

app.post('/api/v1/superadmin/free-demo/profiles/:id/claim-code',requireSuperAdmin('super_admin'),async(c:any)=>{
  const id=c.req.param('id')
  const row=await c.env.DB.prepare("SELECT d.id,d.status,p.slug,p.is_published FROM free_demo_profiles d JOIN profiles p ON p.id=d.profile_id WHERE d.id=? LIMIT 1").bind(id).first()
  if(!row)return c.json({ok:false,error:'Demo no encontrada.'},404)
  if(String((row as any).status)==='claimed')return c.json({ok:false,error:'Este perfil ya fue reclamado.'},409)
  if(Number((row as any).is_published||0)!==1)return c.json({ok:false,error:'Publica la Demo antes de generar el código de reclamo.'},409)
  const raw=randomCode(),hash=await sha256Hex(raw),claimId=crypto.randomUUID()
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE free_demo_claims SET status='revoked' WHERE demo_id=? AND status IN ('active','in_progress')").bind(id),
    c.env.DB.prepare("INSERT INTO free_demo_claims(id,demo_id,special_email,code_hash,status,expires_at,created_by_admin_user_id) VALUES(?,?,?,?,'active',datetime('now','+30 days'),?)").bind(claimId,id,FREE_DEMO_MANAGER_EMAIL,hash,String(c.get('adminUserId')||'')||null),
    c.env.DB.prepare("UPDATE free_demo_profiles SET status='claim_ready',updated_at=datetime('now') WHERE id=?").bind(id),
  ])
  return c.json({ok:true,data:{special_email:FREE_DEMO_MANAGER_EMAIL,slug:String((row as any).slug),claim_code:raw,status:'active',expires_in_days:30}})
})

// ── intapcard@gmail.com: crea y administra múltiples Free Demo.
app.get('/api/v1/me/free-demos',requireDemoManager,async(c:any)=>{
  const uid=String(c.get('freeDemoManagerUserId'))
  const rows=await c.env.DB.prepare("SELECT d.id,d.status,d.rubric,d.created_from,d.created_at,d.published_at,p.id profile_id,p.slug,p.name,p.bio,p.category,p.subcategory,p.is_published,p.avatar_url,p.hero_url,pc.whatsapp,pc.phone,pc.email,pc.address,a.public_code FROM free_demo_profiles d JOIN profiles p ON p.id=d.profile_id LEFT JOIN profile_contact pc ON pc.profile_id=p.id LEFT JOIN intap_artifacts a ON a.id=d.artifact_id WHERE d.manager_user_id=? AND d.status<>'claimed' ORDER BY d.created_at DESC").bind(uid).all()
  return c.json({ok:true,data:rows.results||[]})
})

app.post('/api/v1/me/free-demos/redeem-code',requireDemoManager,async(c:any)=>{
  const managerId=String(c.get('freeDemoManagerUserId'))
  const body=await c.req.json().catch(()=>({}))
  const code=cleanText(body.code,40).toUpperCase()
  if(!code)return c.json({ok:false,error:'Escribe el código Demo.'},400)
  const row=await c.env.DB.prepare(`SELECT id,preset_key
    FROM free_demo_template_codes
    WHERE code_hash=? AND status='active'
      AND (expires_at IS NULL OR expires_at>datetime('now'))
    LIMIT 1`).bind(await sha256Hex(code)).first()
  if(!row)return c.json({ok:false,error:'Código Demo inválido, vencido o ya utilizado.'},404)
  const codeId=String((row as any).id),presetKey=String((row as any).preset_key||'')
  if(!presetExists(presetKey))return c.json({ok:false,error:'La plantilla asociada a este código ya no está disponible.'},409)
  const lock=await c.env.DB.prepare("UPDATE free_demo_template_codes SET status='redeeming' WHERE id=? AND status='active'").bind(codeId).run()
  if(Number((lock as any)?.meta?.changes||0)!==1)return c.json({ok:false,error:'Ese código Demo ya fue utilizado.'},409)
  try{
    const draftSlug=`demo-draft-${randomToken(6)}`
    const created=await createManagedFreeDemo(c.env.DB,{slug:draftSlug,presetKey,webOrigin:webOrigin(c),createdFrom:'superadmin'})
    await c.env.DB.prepare(`UPDATE free_demo_template_codes
      SET status='used',redeemed_by_manager_user_id=?,demo_id=?,used_at=datetime('now')
      WHERE id=? AND status='redeeming'`).bind(managerId,created.demoId,codeId).run()
    return c.json({ok:true,data:{demo_id:created.demoId,preset_key:presetKey,status:'draft'}},201)
  }catch(error){
    await c.env.DB.prepare("UPDATE free_demo_template_codes SET status='active' WHERE id=? AND status='redeeming'").bind(codeId).run().catch(()=>undefined)
    throw error
  }
})

app.post('/api/v1/me/free-demos/:id/publish',requireDemoManager,async(c:any)=>{
  const uid=String(c.get('freeDemoManagerUserId')),id=c.req.param('id'),body=await c.req.json().catch(()=>({}))
  const row=await c.env.DB.prepare(`SELECT d.profile_id,d.status,d.published_at,p.slug,p.name,p.is_published
    FROM free_demo_profiles d
    JOIN profiles p ON p.id=d.profile_id
    WHERE d.id=? AND d.manager_user_id=? AND d.status<>'claimed'
    LIMIT 1`).bind(id,uid).first()
  if(!row)return c.json({ok:false,error:'Demo no encontrada.'},404)
  const name=cleanText(body.name,100)
  if(!name)return c.json({ok:false,error:'Escribe el nombre final de la presentación.'},400)
  const requestedSlug=cleanDemoSlug(body.slug||name)
  if(!validDemoSlug(requestedSlug))return c.json({ok:false,error:'Slug no válido.'},400)
  const currentSlug=String((row as any).slug||'')
  const publishedAt=String((row as any).published_at||'')
  if(publishedAt&&requestedSlug!==currentSlug)return c.json({ok:false,error:'El slug publicado es permanente.',code:'slug_locked'},409)
  const duplicate=await c.env.DB.prepare('SELECT id FROM profiles WHERE slug=? AND id<>? LIMIT 1').bind(requestedSlug,String((row as any).profile_id)).first()
  if(duplicate)return c.json({ok:false,error:'Ese slug ya está en uso.',code:'slug_taken'},409)
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE profiles SET name=?,slug=?,is_published=1,updated_at=datetime('now') WHERE id=?").bind(name,requestedSlug,String((row as any).profile_id)),
    c.env.DB.prepare("UPDATE free_demo_profiles SET status='published',published_at=COALESCE(published_at,datetime('now')),updated_at=datetime('now') WHERE id=?").bind(id),
  ])
  return c.json({ok:true,data:{name,slug:requestedSlug,status:'published',is_published:true}})
})

app.patch('/api/v1/me/free-demos/:id',requireDemoManager,async(c:any)=>{
  const uid=String(c.get('freeDemoManagerUserId')),id=c.req.param('id'),body=await c.req.json().catch(()=>({}))
  const row=await c.env.DB.prepare("SELECT d.profile_id,d.status,d.published_at,p.slug,p.name,p.is_published FROM free_demo_profiles d JOIN profiles p ON p.id=d.profile_id WHERE d.id=? AND d.manager_user_id=? AND d.status<>'claimed' LIMIT 1").bind(id,uid).first()
  if(!row)return c.json({ok:false,error:'Demo no encontrada.'},404)
  if(body.is_published===undefined)return c.json({ok:false,error:'No hay cambios para guardar.'},400)
  const published=body.is_published?1:0
  if(published===1 && !String((row as any).published_at||''))return c.json({ok:false,error:'Finaliza la Demo definiendo nombre y slug antes de publicarla.',code:'finalize_required'},409)
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE profiles SET is_published=?,updated_at=datetime('now') WHERE id=?").bind(published,String((row as any).profile_id)),
    c.env.DB.prepare("UPDATE free_demo_profiles SET status=?,updated_at=datetime('now') WHERE id=?").bind(published?'published':'draft',id),
  ])
  return c.json({ok:true,data:{slug:String((row as any).slug),name:String((row as any).name||''),is_published:Boolean(published)}})
})

// Entra al editor Free REAL del perfil Demo sin ampliar ownership normal.
app.post('/api/v1/me/free-demos/:id/open',requireDemoManager,async(c:any)=>{
  const managerId=String(c.get('freeDemoManagerUserId')),id=c.req.param('id')
  const row=await c.env.DB.prepare("SELECT d.id,d.profile_id,d.synthetic_owner_user_id,d.status,p.slug FROM free_demo_profiles d JOIN profiles p ON p.id=d.profile_id WHERE d.id=? AND d.manager_user_id=? AND d.status<>'claimed' LIMIT 1").bind(id,managerId).first()
  if(!row)return c.json({ok:false,error:'Demo no encontrada.'},404)

  const bridgeRaw=randomToken(),bridgeHash=await sha256Hex(bridgeRaw),syntheticRaw=randomToken(),syntheticHash=await sha256Hex(syntheticRaw)
  const ip=c.req.header('CF-Connecting-IP')||c.req.header('X-Forwarded-For')||'',ua=c.req.header('User-Agent')||''
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE free_demo_management_sessions SET consumed_at=datetime('now') WHERE manager_user_id=? AND consumed_at IS NULL").bind(managerId),
    c.env.DB.prepare("INSERT INTO free_demo_management_sessions(id,demo_id,manager_user_id,synthetic_owner_user_id,token_hash,expires_at) VALUES(?,?,?,?,?,datetime('now','+8 hours'))").bind(crypto.randomUUID(),id,managerId,String((row as any).synthetic_owner_user_id),bridgeHash),
    c.env.DB.prepare("INSERT INTO auth_sessions(id,user_id,session_hash,expires_at,ip,user_agent,created_at) VALUES(?,?,?,datetime('now','+8 hours'),?,?,datetime('now'))").bind(crypto.randomUUID(),String((row as any).synthetic_owner_user_id),syntheticHash,ip,ua),
  ])
  return jsonWithCookies({ok:true,data:{next_url:'/admin/free',slug:String((row as any).slug)}},200,[sessionCookie(c,syntheticRaw,MANAGEMENT_TTL_SECONDS),managerBridgeCookie(c,bridgeRaw)])
})

app.get('/api/v1/me/free-demo-management/context',async(c:any)=>{
  const row=await activeManagementContext(c)
  if(!row)return c.json({ok:false,active:false},404)
  return c.json({ok:true,active:true,data:{demo_id:(row as any).demo_id,profile_id:(row as any).profile_id,slug:(row as any).slug,name:(row as any).name,status:(row as any).status}})
})

app.post('/api/v1/me/free-demo-management/return',async(c:any)=>{
  const row=await activeManagementContext(c)
  const current=await sessionUser(c)
  if(!row||!current)return c.json({ok:false,error:'La sesión de administración Demo ya no está activa.'},401)
  const raw=randomToken(),hash=await sha256Hex(raw),ip=c.req.header('CF-Connecting-IP')||c.req.header('X-Forwarded-For')||'',ua=c.req.header('User-Agent')||''
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE free_demo_management_sessions SET consumed_at=datetime('now') WHERE id=? AND consumed_at IS NULL").bind(String((row as any).management_session_id)),
    c.env.DB.prepare("UPDATE auth_sessions SET revoked_at=datetime('now') WHERE id=?").bind(String((current as any).session_id)),
    c.env.DB.prepare("INSERT INTO auth_sessions(id,user_id,session_hash,expires_at,ip,user_agent,created_at) VALUES(?,?,?,datetime('now','+30 days'),?,?,datetime('now'))").bind(crypto.randomUUID(),String((row as any).manager_user_id),hash,ip,ua),
  ])
  return jsonWithCookies({ok:true,data:{next_url:'/admin/free/demos'}},200,[sessionCookie(c,raw),managerBridgeCookie(c,'',0)])
})

// ── Reclamo de un solo uso.
app.post('/api/v1/auth/free-demo-claim/login',async(c:any)=>{
  const body=await c.req.json().catch(()=>({})),email=cleanText(body.email,160).toLowerCase(),code=cleanText(body.code||body.password,64).toUpperCase()
  if(email!==FREE_DEMO_MANAGER_EMAIL||!code)return c.json({ok:false,error:'Código de reclamo no válido.',code:'not_claim'},404)
  const row=await c.env.DB.prepare("SELECT c.id claim_id,c.demo_id,p.slug,p.name FROM free_demo_claims c JOIN free_demo_profiles d ON d.id=c.demo_id JOIN profiles p ON p.id=d.profile_id WHERE c.special_email=? AND c.code_hash=? AND c.status='active' AND (c.expires_at IS NULL OR c.expires_at>datetime('now')) AND d.status='claim_ready' LIMIT 1").bind(FREE_DEMO_MANAGER_EMAIL,await sha256Hex(code)).first()
  if(!row)return c.json({ok:false,error:'Código de reclamo no válido o ya utilizado.',code:'not_claim'},404)
  const claimId=String((row as any).claim_id)
  const lock=await c.env.DB.prepare("UPDATE free_demo_claims SET status='in_progress' WHERE id=? AND status='active'").bind(claimId).run()
  if(Number((lock as any)?.meta?.changes||0)!==1)return c.json({ok:false,error:'Código de reclamo no válido o ya utilizado.',code:'not_claim'},404)
  const raw=randomToken(),sid=crypto.randomUUID()
  await c.env.DB.prepare("INSERT INTO free_demo_claim_sessions(id,claim_id,token_hash,expires_at) VALUES(?,?,?,datetime('now','+15 minutes'))").bind(sid,claimId,await sha256Hex(raw)).run()
  return c.json({ok:true,data:{next_url:'/claim/free-demo',slug:(row as any).slug,name:(row as any).name}},200,{'Set-Cookie':claimCookie(c,raw)})
})

app.get('/api/v1/auth/free-demo-claim/context',async(c:any)=>{
  const row=await activeClaimSession(c)
  if(!row)return c.json({ok:false,error:'El acceso de reclamo expiró.'},401)
  return c.json({ok:true,data:{slug:(row as any).slug,name:(row as any).name,special_email:(row as any).special_email}})
})

app.post('/api/v1/auth/free-demo-claim/complete',async(c:any)=>{
  const claim=await activeClaimSession(c)
  if(!claim)return c.json({ok:false,error:'El acceso de reclamo expiró.'},401)
  const body=await c.req.json().catch(()=>({})),email=cleanText(body.new_email,160).toLowerCase(),password=String(body.password||'')
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email===FREE_DEMO_MANAGER_EMAIL)return c.json({ok:false,error:'Usa un correo válido diferente al correo Demo.'},400)
  if(password.length<8||password.length>128)return c.json({ok:false,error:'La contraseña debe tener entre 8 y 128 caracteres.'},400)
  if(await c.env.DB.prepare('SELECT id FROM users WHERE lower(email)=? LIMIT 1').bind(email).first())return c.json({ok:false,error:'Ese correo ya está vinculado a otra cuenta. Usa un correo disponible.'},409)
  const profileId=String((claim as any).profile_id),oldOwner=String((claim as any).synthetic_owner_user_id),demoId=String((claim as any).demo_id),claimId=String((claim as any).claim_id),userId=crypto.randomUUID(),cred=await newPasswordRecord(password),rawSession=randomToken(),sessionHash=await sha256Hex(rawSession),ip=c.req.header('CF-Connecting-IP')||c.req.header('X-Forwarded-For')||'',ua=c.req.header('User-Agent')||''
  let cleanTemplate:any={}
  try{cleanTemplate=JSON.parse(String((claim as any).template_data||'{}'))||{}}catch{cleanTemplate={}}
  delete cleanTemplate.free_demo_profile
  delete cleanTemplate.free_demo_manager_email
  delete cleanTemplate.free_demo_seed
  delete cleanTemplate.free_demo_preset
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO users(id,email) VALUES(?,?)').bind(userId,email),
    c.env.DB.prepare("INSERT INTO user_password_credentials(user_id,password_salt,password_hash,failed_attempts,locked_until,created_at,updated_at) VALUES(?,?,?,0,NULL,datetime('now'),datetime('now'))").bind(userId,cred.salt,cred.hash),
    c.env.DB.prepare("UPDATE profiles SET user_id=?,template_data=?,updated_at=datetime('now') WHERE id=? AND user_id=?").bind(userId,JSON.stringify(cleanTemplate),profileId,oldOwner),
    c.env.DB.prepare("UPDATE intap_artifacts SET owner_user_id=?,updated_at=datetime('now') WHERE profile_id=? AND owner_user_id=?").bind(userId,profileId,oldOwner),
    c.env.DB.prepare("UPDATE free_demo_profiles SET status='claimed',claimed_by_user_id=?,claimed_at=datetime('now'),updated_at=datetime('now') WHERE id=? AND status='claim_ready'").bind(userId,demoId),
    c.env.DB.prepare("UPDATE free_demo_claims SET status='used',used_at=datetime('now') WHERE id=? AND status='in_progress'").bind(claimId),
    c.env.DB.prepare("UPDATE free_demo_claim_sessions SET consumed_at=datetime('now') WHERE id=? AND consumed_at IS NULL").bind(String((claim as any).session_id)),
    c.env.DB.prepare("UPDATE free_demo_management_sessions SET consumed_at=datetime('now') WHERE demo_id=? AND consumed_at IS NULL").bind(demoId),
    c.env.DB.prepare("INSERT INTO auth_sessions(id,user_id,session_hash,expires_at,ip,user_agent,created_at) VALUES(?,?,?,datetime('now','+30 days'),?,?,datetime('now'))").bind(crypto.randomUUID(),userId,sessionHash,ip,ua),
  ])
  return c.json({ok:true,data:{slug:(claim as any).slug,next_url:'/admin/free/credentials?claimed=1'}},200,{'Set-Cookie':sessionCookie(c,rawSession)})
})

export default app
