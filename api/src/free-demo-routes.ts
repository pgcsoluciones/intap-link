import app from './index'
import { requireSuperAdmin } from './lib/admin-auth'
import { buildScopedCookie, cookieNames, isPreviewEnvironment } from './lib/cookies'
import { FREE_DEMO_MANAGER_EMAIL, createManagedFreeDemo, freeDemoPreset, cleanDemoSlug, validDemoSlug, randomCode, randomToken, sha256Hex } from './free-demo-core'

const KDF_ITERATIONS=100000
function parseCookie(header:string,name:string){const escaped=name.replace(/[.*+?^$()|[\]\\]/g,'\\$&');const m=header.match(new RegExp('(?:^|;\\s*)'+escaped+'=([^;]*)'));return m?decodeURIComponent(m[1]):null}
function appUrl(c:any){return String(c.env.APP_URL||(isPreviewEnvironment(c.env)?'https://app.preview.intaprd.com':'https://app.intaprd.com')).replace(/\/$/,'')}
function claimCookieName(c:any){return isPreviewEnvironment(c.env)?'kawvo_free_demo_claim_preview':'kawvo_free_demo_claim'}
function claimCookie(c:any,value:string,maxAge=900){return buildScopedCookie(c.env,appUrl(c),claimCookieName(c),value,maxAge)}
function sessionCookie(c:any,value:string){return buildScopedCookie(c.env,appUrl(c),cookieNames(c.env).session,value,30*24*60*60)}
function cleanText(v:any,max=160){return String(v??'').trim().slice(0,max)}
function hex(bytes:Uint8Array){return Array.from(bytes).map(b=>b.toString(16).padStart(2,'0')).join('')}
async function passwordHash(password:string,saltHex:string){const salt=new Uint8Array((saltHex.match(/.{1,2}/g)||[]).map(x=>parseInt(x,16)));const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:KDF_ITERATIONS,hash:'SHA-256'},key,256);return hex(new Uint8Array(bits))}
async function newPasswordRecord(password:string){const salt=crypto.getRandomValues(new Uint8Array(16)),saltHex=hex(salt);return{salt:saltHex,hash:await passwordHash(password,saltHex)}}
async function sessionUser(c:any){const raw=parseCookie(c.req.header('Cookie')||'',cookieNames(c.env).session);if(!raw)return null;return c.env.DB.prepare("SELECT s.user_id,u.email FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.session_hash=? AND s.expires_at>datetime('now') AND s.revoked_at IS NULL LIMIT 1").bind(await sha256Hex(raw)).first()}
async function requireDemoManager(c:any,next:any){const row=await sessionUser(c);if(!row||String((row as any).email||'').trim().toLowerCase()!==FREE_DEMO_MANAGER_EMAIL)return c.json({ok:false,error:'Forbidden'},403);c.set('freeDemoManagerUserId',String((row as any).user_id));await next()}
async function activeClaimSession(c:any){const raw=parseCookie(c.req.header('Cookie')||'',claimCookieName(c));if(!raw)return null;return c.env.DB.prepare("SELECT s.id session_id,c.id claim_id,c.demo_id,c.special_email,d.profile_id,d.synthetic_owner_user_id,d.artifact_id,p.slug,p.name,p.template_data FROM free_demo_claim_sessions s JOIN free_demo_claims c ON c.id=s.claim_id JOIN free_demo_profiles d ON d.id=c.demo_id JOIN profiles p ON p.id=d.profile_id WHERE s.token_hash=? AND s.consumed_at IS NULL AND s.expires_at>datetime('now') AND c.status='in_progress' AND d.status='claim_ready' LIMIT 1").bind(await sha256Hex(raw)).first()}

app.get('/api/v1/superadmin/free-demo/templates',requireSuperAdmin('super_admin'),async(c:any)=>{
  const rows=await c.env.DB.prepare("SELECT t.*,COUNT(d.id) demo_count FROM free_demo_templates t LEFT JOIN free_demo_profiles d ON d.template_id=t.id GROUP BY t.id ORDER BY t.is_default DESC,t.created_at DESC").all()
  return c.json({ok:true,data:rows.results||[]})
})

app.post('/api/v1/superadmin/free-demo/templates',requireSuperAdmin('super_admin'),async(c:any)=>{
  const body=await c.req.json().catch(()=>({}));const name=cleanText(body.name,80),rubric=cleanText(body.rubric,80),templateEmail=cleanText(body.template_email,160).toLowerCase(),preset=cleanText(body.preset_key,30)||'professional'
  if(!name||!rubric||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(templateEmail))return c.json({ok:false,error:'Nombre, rubro y correo de plantilla son requeridos.'},400)
  if(await c.env.DB.prepare('SELECT id FROM free_demo_templates WHERE lower(template_email)=? LIMIT 1').bind(templateEmail).first())return c.json({ok:false,error:'Ese correo de plantilla ya existe.'},409)
  const id=crypto.randomUUID(),snapshot=freeDemoPreset(preset),makeDefault=body.is_default===true
  if(makeDefault)await c.env.DB.prepare('UPDATE free_demo_templates SET is_default=0 WHERE is_default=1').run()
  await c.env.DB.prepare('INSERT INTO free_demo_templates(id,name,rubric,template_email,preset_key,snapshot_json,is_default,created_by_admin_user_id) VALUES(?,?,?,?,?,?,?,?)').bind(id,name,rubric,templateEmail,preset,JSON.stringify(snapshot),makeDefault?1:0,String(c.get('adminUserId')||'')||null).run()
  return c.json({ok:true,data:{id,name,rubric,template_email:templateEmail,preset_key:preset,is_default:makeDefault}},201)
})

app.patch('/api/v1/superadmin/free-demo/templates/:id',requireSuperAdmin('super_admin'),async(c:any)=>{
  const id=c.req.param('id'),body=await c.req.json().catch(()=>({})),current=await c.env.DB.prepare('SELECT * FROM free_demo_templates WHERE id=? LIMIT 1').bind(id).first()
  if(!current)return c.json({ok:false,error:'Plantilla no encontrada.'},404)
  const name=body.name!==undefined?cleanText(body.name,80):String((current as any).name),rubric=body.rubric!==undefined?cleanText(body.rubric,80):String((current as any).rubric),active=body.is_active===undefined?Number((current as any).is_active):body.is_active?1:0,def=body.is_default===undefined?Number((current as any).is_default):body.is_default?1:0
  if(def)await c.env.DB.prepare('UPDATE free_demo_templates SET is_default=0 WHERE id<>?').bind(id).run()
  await c.env.DB.prepare("UPDATE free_demo_templates SET name=?,rubric=?,is_active=?,is_default=?,updated_at=datetime('now') WHERE id=?").bind(name,rubric,active,def,id).run()
  return c.json({ok:true})
})

app.post('/api/v1/superadmin/free-demo/templates/:id/generate',requireSuperAdmin('super_admin'),async(c:any)=>{
  const id=c.req.param('id'),body=await c.req.json().catch(()=>({}));const slug=cleanDemoSlug(body.slug),displayName=cleanText(body.name,100)
  try{const created=await createManagedFreeDemo(c.env.DB,{templateId:id,slug,displayName:displayName||undefined,createdFrom:'superadmin'});const web=String(c.env.WEB_URL||'https://intaprd.com').replace(/\/$/,'');return c.json({ok:true,data:{...created,public_url:web+'/'+created.slug,status:'draft'}},201)}
  catch(e:any){const code=String(e?.message||'');return c.json({ok:false,error:code==='slug_taken'?'Ese slug ya está en uso.':code==='slug_invalid'?'Slug no válido.':'No pudimos generar la Demo.'},code==='slug_taken'?409:400)}
})

app.get('/api/v1/superadmin/free-demo/profiles',requireSuperAdmin('super_admin'),async(c:any)=>{
  const rows=await c.env.DB.prepare("SELECT d.id,d.status,d.rubric,d.created_from,d.created_at,d.claimed_at,p.id profile_id,p.slug,p.name,p.is_published,t.name template_name,u.email manager_email,a.public_code FROM free_demo_profiles d JOIN profiles p ON p.id=d.profile_id LEFT JOIN free_demo_templates t ON t.id=d.template_id JOIN users u ON u.id=d.manager_user_id LEFT JOIN intap_artifacts a ON a.id=d.artifact_id ORDER BY d.created_at DESC").all()
  return c.json({ok:true,data:rows.results||[]})
})

app.post('/api/v1/superadmin/free-demo/profiles/:id/claim-code',requireSuperAdmin('super_admin'),async(c:any)=>{
  const id=c.req.param('id'),row=await c.env.DB.prepare("SELECT d.id,d.status,p.slug,p.is_published FROM free_demo_profiles d JOIN profiles p ON p.id=d.profile_id WHERE d.id=? LIMIT 1").bind(id).first()
  if(!row)return c.json({ok:false,error:'Demo no encontrada.'},404);if(String((row as any).status)==='claimed')return c.json({ok:false,error:'Este perfil ya fue reclamado.'},409);if(Number((row as any).is_published||0)!==1)return c.json({ok:false,error:'Publica la Demo antes de generar el código de reclamo.'},409)
  const raw=randomCode(),hash=await sha256Hex(raw),claimId=crypto.randomUUID()
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE free_demo_claims SET status='revoked' WHERE demo_id=? AND status IN ('active','in_progress')").bind(id),
    c.env.DB.prepare("INSERT INTO free_demo_claims(id,demo_id,special_email,code_hash,status,expires_at,created_by_admin_user_id) VALUES(?,?,?,?,'active',datetime('now','+30 days'),?)").bind(claimId,id,FREE_DEMO_MANAGER_EMAIL,hash,String(c.get('adminUserId')||'')||null),
    c.env.DB.prepare("UPDATE free_demo_profiles SET status='claim_ready',updated_at=datetime('now') WHERE id=?").bind(id),
  ])
  return c.json({ok:true,data:{special_email:FREE_DEMO_MANAGER_EMAIL,slug:String((row as any).slug),claim_code:raw,status:'active',expires_in_days:30}})
})

app.get('/api/v1/me/free-demos',requireDemoManager,async(c:any)=>{
  const uid=String(c.get('freeDemoManagerUserId')),rows=await c.env.DB.prepare("SELECT d.id,d.status,d.rubric,d.created_from,d.created_at,p.id profile_id,p.slug,p.name,p.bio,p.is_published,pc.whatsapp,pc.phone,pc.email,pc.address,a.public_code FROM free_demo_profiles d JOIN profiles p ON p.id=d.profile_id LEFT JOIN profile_contact pc ON pc.profile_id=p.id LEFT JOIN intap_artifacts a ON a.id=d.artifact_id WHERE d.manager_user_id=? AND d.status<>'claimed' ORDER BY d.created_at DESC").bind(uid).all()
  return c.json({ok:true,data:rows.results||[]})
})

app.patch('/api/v1/me/free-demos/:id',requireDemoManager,async(c:any)=>{
  const uid=String(c.get('freeDemoManagerUserId')),id=c.req.param('id'),body=await c.req.json().catch(()=>({}))
  const row=await c.env.DB.prepare("SELECT d.profile_id,d.status,p.slug,p.name,p.bio,p.is_published FROM free_demo_profiles d JOIN profiles p ON p.id=d.profile_id WHERE d.id=? AND d.manager_user_id=? AND d.status<>'claimed' LIMIT 1").bind(id,uid).first()
  if(!row)return c.json({ok:false,error:'Demo no encontrada.'},404)
  const profileId=String((row as any).profile_id),slug=body.slug!==undefined?cleanDemoSlug(body.slug):String((row as any).slug)
  if(!validDemoSlug(slug))return c.json({ok:false,error:'Slug no válido.'},400)
  if(await c.env.DB.prepare('SELECT id FROM profiles WHERE slug=? AND id<>? LIMIT 1').bind(slug,profileId).first())return c.json({ok:false,error:'Ese slug ya está en uso.'},409)
  const name=body.name!==undefined?cleanText(body.name,100):String((row as any).name||''),bio=body.bio!==undefined?cleanText(body.bio,300):String((row as any).bio||''),published=body.is_published===undefined?Number((row as any).is_published):body.is_published?1:0
  const contact=await c.env.DB.prepare('SELECT whatsapp,email,phone,hours,address,map_url FROM profile_contact WHERE profile_id=? LIMIT 1').bind(profileId).first()
  const whatsapp=body.whatsapp!==undefined?cleanText(body.whatsapp,40):String((contact as any)?.whatsapp||''),phone=body.phone!==undefined?cleanText(body.phone,40):String((contact as any)?.phone||''),email=body.email!==undefined?cleanText(body.email,160).toLowerCase():String((contact as any)?.email||''),address=body.address!==undefined?cleanText(body.address,180):String((contact as any)?.address||'')
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE profiles SET slug=?,name=?,bio=?,is_published=?,updated_at=datetime('now') WHERE id=?").bind(slug,name,bio,published,profileId),
    c.env.DB.prepare("INSERT INTO profile_contact(profile_id,whatsapp,email,phone,hours,address,map_url) VALUES(?,?,?,?,?,?,?) ON CONFLICT(profile_id) DO UPDATE SET whatsapp=excluded.whatsapp,email=excluded.email,phone=excluded.phone,address=excluded.address,updated_at=datetime('now')").bind(profileId,whatsapp,email,phone,(contact as any)?.hours||null,address,(contact as any)?.map_url||''),
    c.env.DB.prepare("UPDATE free_demo_profiles SET status=?,updated_at=datetime('now') WHERE id=?").bind(published?'published':'draft',id),
  ])
  return c.json({ok:true,data:{slug,name,is_published:Boolean(published)}})
})

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

app.get('/api/v1/auth/free-demo-claim/context',async(c:any)=>{const row=await activeClaimSession(c);if(!row)return c.json({ok:false,error:'El acceso de reclamo expiró.'},401);return c.json({ok:true,data:{slug:(row as any).slug,name:(row as any).name,special_email:(row as any).special_email}})})

app.post('/api/v1/auth/free-demo-claim/complete',async(c:any)=>{
  const claim=await activeClaimSession(c);if(!claim)return c.json({ok:false,error:'El acceso de reclamo expiró.'},401)
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
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO users(id,email) VALUES(?,?)').bind(userId,email),
    c.env.DB.prepare("INSERT INTO user_password_credentials(user_id,password_salt,password_hash,failed_attempts,locked_until,created_at,updated_at) VALUES(?,?,?,0,NULL,datetime('now'),datetime('now'))").bind(userId,cred.salt,cred.hash),
    c.env.DB.prepare("UPDATE profiles SET user_id=?,template_data=?,updated_at=datetime('now') WHERE id=? AND user_id=?").bind(userId,JSON.stringify(cleanTemplate),profileId,oldOwner),
    c.env.DB.prepare("UPDATE intap_artifacts SET owner_user_id=?,updated_at=datetime('now') WHERE profile_id=? AND owner_user_id=?").bind(userId,profileId,oldOwner),
    c.env.DB.prepare("UPDATE free_demo_profiles SET status='claimed',claimed_by_user_id=?,claimed_at=datetime('now'),updated_at=datetime('now') WHERE id=? AND status='claim_ready'").bind(userId,demoId),
    c.env.DB.prepare("UPDATE free_demo_claims SET status='used',used_at=datetime('now') WHERE id=? AND status='in_progress'").bind(claimId),
    c.env.DB.prepare("UPDATE free_demo_claim_sessions SET consumed_at=datetime('now') WHERE id=? AND consumed_at IS NULL").bind(String((claim as any).session_id)),
    c.env.DB.prepare("INSERT INTO auth_sessions(id,user_id,session_hash,expires_at,ip,user_agent,created_at) VALUES(?,?,?,datetime('now','+30 days'),?,?,datetime('now'))").bind(crypto.randomUUID(),userId,sessionHash,ip,ua),
  ])
  return c.json({ok:true,data:{slug:(claim as any).slug,next_url:'/admin/free/credentials?claimed=1'}},200,{'Set-Cookie':sessionCookie(c,rawSession)})
})

export default app
