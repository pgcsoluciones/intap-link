import app from './index'
import { cookieNames } from './lib/cookies'
import { requireSuperAdmin } from './lib/admin-auth'

const USERNAME_RE=/^[a-z0-9][a-z0-9-]{2,29}$/
const RESERVED=new Set(['admin','api','app','www','superadmin','support','demo','med','p','l'])
function clean(v:unknown,max=500){return String(v??'').trim().slice(0,max)}
function slug(v:unknown){return String(v??'').trim().toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,30)}
async function sha256Hex(input:string){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input));return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('')}
function parseCookie(header:string,name:string){const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const match=header.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`));return match?decodeURIComponent(match[1]):null}
async function sessionUserId(c:any){const raw=parseCookie(c.req.header('Cookie')||'',cookieNames(c.env).session);if(!raw)return null;const row=await c.env.DB.prepare(`SELECT user_id FROM auth_sessions WHERE session_hash=? AND expires_at>datetime('now') AND revoked_at IS NULL LIMIT 1`).bind(await sha256Hex(raw)).first();return row?String((row as any).user_id||''):null}
async function requireUser(c:any,next:any){const id=await sessionUserId(c);if(!id)return c.json({ok:false,error:'Unauthorized'},401);c.set('userId',id);await next()}
async function uniqueTenantSlug(c:any,base:string){let candidate=base||`patrocinador-${crypto.randomUUID().slice(0,8)}`;let n=2;while(await c.env.DB.prepare(`SELECT id FROM sponsor_tenants WHERE slug=? LIMIT 1`).bind(candidate).first()){candidate=`${base||'patrocinador'}-${n++}`.slice(0,30)}return candidate}

app.post('/api/v1/superadmin/sponsors',requireSuperAdmin('super_admin'),async(c:any)=>{
  const body=await c.req.json().catch(()=>({}))
  const name=clean(body.name,120);const email=clean(body.contact_email,160).toLowerCase();const requestedProfileSlug=slug(body.slug);const sponsorType=body.sponsor_type==='brand'?'brand':'merchant'
  if(!name||!email)return c.json({ok:false,error:'Nombre y correo del patrocinador son requeridos.'},422)
  if(requestedProfileSlug&&(!USERNAME_RE.test(requestedProfileSlug)||RESERVED.has(requestedProfileSlug)))return c.json({ok:false,error:'El slug público no es válido.'},422)
  if(requestedProfileSlug){const used=await c.env.DB.prepare(`SELECT id FROM sponsored_profiles WHERE username=? LIMIT 1`).bind(requestedProfileSlug).first();if(used)return c.json({ok:false,error:'Ese slug público ya está ocupado.'},409)}
  const tenantSlug=await uniqueTenantSlug(c,slug(name))
  const id=crypto.randomUUID()
  await c.env.DB.prepare(`INSERT INTO sponsor_tenants (id,name,slug,profile_slug,sponsor_type,logo_url,contact_email,contact_whatsapp,website_url,created_by_admin_user_id) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(id,name,tenantSlug,requestedProfileSlug||null,sponsorType,clean(body.logo_url,800),email,clean(body.contact_whatsapp,40),clean(body.website_url,800),String(c.get('adminUserId')||'')).run()
  return c.json({ok:true,data:{id,slug:tenantSlug,profile_slug:requestedProfileSlug||null}},201)
})

app.patch('/api/v1/superadmin/sponsors/:id',requireSuperAdmin('super_admin'),async(c:any)=>{
  const id=String(c.req.param('id')||'');const body=await c.req.json().catch(()=>({}));const current=await c.env.DB.prepare(`SELECT * FROM sponsor_tenants WHERE id=? LIMIT 1`).bind(id).first();if(!current)return c.json({ok:false,error:'Patrocinador no encontrado.'},404)
  const nextProfileSlug=body.slug!==undefined?slug(body.slug):slug((current as any).profile_slug)
  if(nextProfileSlug&&(!USERNAME_RE.test(nextProfileSlug)||RESERVED.has(nextProfileSlug)))return c.json({ok:false,error:'El slug público no es válido.'},422)
  if(nextProfileSlug){const used=await c.env.DB.prepare(`SELECT id FROM sponsored_profiles WHERE username=? AND sponsor_id<>? LIMIT 1`).bind(nextProfileSlug,id).first();if(used)return c.json({ok:false,error:'Ese slug público ya está ocupado.'},409)}
  const active=(body.is_active===false||Number(body.is_active)===0)?0:1
  await c.env.DB.prepare(`UPDATE sponsor_tenants SET name=?,sponsor_type=?,profile_slug=?,logo_url=?,contact_email=?,contact_whatsapp=?,website_url=?,is_active=?,updated_at=datetime('now') WHERE id=?`).bind(clean(body.name,120)||String((current as any).name),body.sponsor_type==='brand'?'brand':'merchant',nextProfileSlug||null,clean(body.logo_url,800),clean(body.contact_email,160).toLowerCase(),clean(body.contact_whatsapp,40),clean(body.website_url,800),active,id).run()
  if(nextProfileSlug){await c.env.DB.prepare(`UPDATE sponsored_profiles SET username=COALESCE(username,?),updated_at=datetime('now') WHERE sponsor_id=? AND profile_role='sponsor_owner'`).bind(nextProfileSlug,id).run()}
  return c.json({ok:true})
})

app.post('/api/v1/me/sponsored-profile/publish',requireUser,async(c:any)=>{
  const userId=String(c.get('userId')||'')
  const row=await c.env.DB.prepare(`SELECT * FROM sponsored_profiles WHERE user_id=? ORDER BY CASE WHEN profile_role='sponsor_owner' THEN 0 ELSE 1 END,created_at DESC LIMIT 1`).bind(userId).first()
  if(!row)return c.json({ok:false,error:'No tienes un perfil patrocinado.'},404)
  const missing:string[]=[];const username=slug((row as any).username);const role=String((row as any).profile_role||'beneficiary')
  if(!username)missing.push('usuario')
  if(!clean((row as any).business_name,100))missing.push('nombre')
  if(!clean((row as any).whatsapp,40)&&!clean((row as any).phone,40))missing.push('número de contacto')
  if(role!=='sponsor_owner'){
    if(!clean((row as any).specialization,100))missing.push('especialización')
    if(!clean((row as any).what_we_do,240))missing.push('qué hacemos')
  }
  if(missing.length)return c.json({ok:false,error:'Completa los datos requeridos antes de publicar.',missing},422)
  await c.env.DB.prepare(`UPDATE sponsored_profiles SET status='published',published_at=COALESCE(published_at,datetime('now')),updated_at=datetime('now') WHERE id=?`).bind(String((row as any).id)).run()
  return c.json({ok:true,data:{public_path:`/p/${encodeURIComponent(username)}`}})
})

export default app
