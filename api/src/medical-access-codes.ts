import app from './index'
import { requireSuperAdmin } from './lib/admin-auth'
import { cookieNames } from './lib/cookies'

function clean(value:unknown,max=500){return String(value??'').trim().slice(0,max)}
function safeUrl(value:unknown){const raw=clean(value,1200);if(!raw)return'';try{const u=new URL(raw);return u.protocol==='https:'||u.protocol==='http:'?u.toString():''}catch{return''}}
function normalizeCode(value:unknown){return clean(value,32).toUpperCase()}
function validMedCode(value:string){return /^MED-[A-Z2-9]{3}-[A-Z2-9]{3}$/.test(value)}
async function sha256Hex(input:string){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input));return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('')}
function parseCookie(header:string,name:string){const escaped=name.replace(/[.*+?^$()|[\]\\]/g,'\\$&');const match=header.match(new RegExp('(?:^|;\\s*)'+escaped+'=([^;]*)'));return match?decodeURIComponent(match[1]):null}
async function sessionUserId(c:any){const raw=parseCookie(c.req.header('Cookie')||'',cookieNames(c.env).session);if(!raw)return'';const row=await c.env.DB.prepare("SELECT user_id FROM auth_sessions WHERE session_hash=? AND expires_at>datetime('now') AND revoked_at IS NULL LIMIT 1").bind(await sha256Hex(raw)).first();return row?String((row as any).user_id||''):''}
async function requireUser(c:any,next:any){const userId=await sessionUserId(c);if(!userId)return c.json({ok:false,error:'Unauthorized'},401);c.set('userId',userId);await next()}
function medCode(){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',bytes=crypto.getRandomValues(new Uint8Array(6));const raw=Array.from(bytes).map(x=>alphabet[x%alphabet.length]).join('');return 'MED-'+raw.slice(0,3)+'-'+raw.slice(3,6)}
async function uniqueMedCode(c:any){for(let i=0;i<30;i++){const code=medCode();const row=await c.env.DB.prepare('SELECT id FROM medical_access_codes WHERE code=? LIMIT 1').bind(code).first();if(!row)return code}throw new Error('No se pudo generar un código MED único.')}
function slugBase(value:string){return value.trim().toLowerCase().replace(/@.*$/,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,20)||'medico'}
async function uniqueMedicalSlug(c:any,base:string){const root=('med-'+slugBase(base)).slice(0,28);let candidate=root,n=2;while(await c.env.DB.prepare('SELECT id FROM medical_profiles WHERE slug=? LIMIT 1').bind(candidate).first()){candidate=(root+'-'+n++).slice(0,30)}return candidate}

app.get('/api/v1/superadmin/kawmed/programs',requireSuperAdmin('viewer'),async(c:any)=>{
  const rows=await c.env.DB.prepare(`SELECT p.*,st.name AS sponsor_name,st.logo_url AS sponsor_logo_url,
    (SELECT COUNT(*) FROM medical_access_codes mac WHERE mac.program_id=p.id) AS codes_total,
    (SELECT COUNT(*) FROM medical_access_codes mac WHERE mac.program_id=p.id AND mac.status='claimed') AS codes_claimed
    FROM medical_sponsor_programs p JOIN sponsor_tenants st ON st.id=p.sponsor_id
    ORDER BY p.created_at DESC`).all()
  return c.json({ok:true,data:rows.results||[]})
})

app.post('/api/v1/superadmin/kawmed/programs',requireSuperAdmin('super_admin'),async(c:any)=>{
  const body=await c.req.json().catch(()=>({})),sponsorId=clean(body.sponsor_id,80),name=clean(body.name,120)
  if(!sponsorId||!name)return c.json({ok:false,error:'Patrocinador y nombre del programa son requeridos.'},422)
  const sponsor=await c.env.DB.prepare('SELECT id FROM sponsor_tenants WHERE id=? LIMIT 1').bind(sponsorId).first()
  if(!sponsor)return c.json({ok:false,error:'Patrocinador no encontrado.'},404)
  const id=crypto.randomUUID()
  await c.env.DB.prepare(`INSERT INTO medical_sponsor_programs(
    id,sponsor_id,name,private_banner_image_url,private_cta_label,private_cta_url,vademecum_url,vademecum_label,notes,enabled
  ) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(
    id,sponsorId,name,safeUrl(body.private_banner_image_url),clean(body.private_cta_label,80)||'Conocer más',safeUrl(body.private_cta_url),
    safeUrl(body.vademecum_url),clean(body.vademecum_label,80)||'Ver vademécum',clean(body.notes,500),body.enabled===false?0:1
  ).run()
  return c.json({ok:true,data:{id}},201)
})

app.patch('/api/v1/superadmin/kawmed/programs/:id',requireSuperAdmin('super_admin'),async(c:any)=>{
  const id=clean(c.req.param('id'),80),body=await c.req.json().catch(()=>({}))
  const current=await c.env.DB.prepare('SELECT * FROM medical_sponsor_programs WHERE id=? LIMIT 1').bind(id).first()
  if(!current)return c.json({ok:false,error:'Programa KawMed no encontrado.'},404)
  await c.env.DB.prepare(`UPDATE medical_sponsor_programs SET name=?,private_banner_image_url=?,private_cta_label=?,private_cta_url=?,vademecum_url=?,vademecum_label=?,notes=?,enabled=?,updated_at=datetime('now') WHERE id=?`).bind(
    clean(body.name,120)||String((current as any).name||''),body.private_banner_image_url!==undefined?safeUrl(body.private_banner_image_url):String((current as any).private_banner_image_url||''),
    body.private_cta_label!==undefined?(clean(body.private_cta_label,80)||'Conocer más'):String((current as any).private_cta_label||'Conocer más'),
    body.private_cta_url!==undefined?safeUrl(body.private_cta_url):String((current as any).private_cta_url||''),
    body.vademecum_url!==undefined?safeUrl(body.vademecum_url):String((current as any).vademecum_url||''),
    body.vademecum_label!==undefined?(clean(body.vademecum_label,80)||'Ver vademécum'):String((current as any).vademecum_label||'Ver vademécum'),
    body.notes!==undefined?clean(body.notes,500):String((current as any).notes||''),
    body.enabled===undefined?Number((current as any).enabled??1):(body.enabled?1:0),id
  ).run()
  return c.json({ok:true})
})

app.get('/api/v1/superadmin/kawmed/codes',requireSuperAdmin('viewer'),async(c:any)=>{
  const q=clean(c.req.query('q'),80),status=clean(c.req.query('status'),20),program=clean(c.req.query('program_id'),80)
  const where:string[]=['1=1'],binds:any[]=[]
  if(q){where.push('(mac.code LIKE ? OR COALESCE(u.email,\'\') LIKE ? OR COALESCE(mp.name,\'\') LIKE ? OR COALESCE(b.name,\'\') LIKE ?)');const like='%'+q+'%';binds.push(like,like,like,like)}
  if(['available','claimed','inactive'].includes(status)){where.push('mac.status=?');binds.push(status)}
  if(program){where.push('mac.program_id=?');binds.push(program)}
  const rows=await c.env.DB.prepare(`SELECT mac.*,b.name AS batch_name,p.name AS program_name,st.name AS sponsor_name,
    u.email AS claimed_email,mp.name AS medical_name,mp.slug AS medical_slug
    FROM medical_access_codes mac
    LEFT JOIN medical_code_batches b ON b.id=mac.batch_id
    LEFT JOIN medical_sponsor_programs p ON p.id=mac.program_id
    LEFT JOIN sponsor_tenants st ON st.id=p.sponsor_id
    LEFT JOIN users u ON u.id=mac.claimed_by_user_id
    LEFT JOIN medical_profiles mp ON mp.id=mac.medical_profile_id
    WHERE ${where.join(' AND ')} ORDER BY mac.created_at DESC LIMIT 500`).bind(...binds).all()
  return c.json({ok:true,data:rows.results||[]})
})

app.get('/api/v1/superadmin/kawmed/profiles',requireSuperAdmin('viewer'),async(c:any)=>{
  const rows=await c.env.DB.prepare(`SELECT mp.id,mp.slug,mp.name,mp.professional_prefix,mp.specialty,mp.status,mp.user_id,u.email,
    mac.code,mac.claimed_at,p.name AS program_name,st.name AS sponsor_name
    FROM medical_profiles mp
    LEFT JOIN users u ON u.id=mp.user_id
    LEFT JOIN medical_access_codes mac ON mac.medical_profile_id=mp.id AND mac.status='claimed'
    LEFT JOIN medical_sponsor_programs p ON p.id=mac.program_id
    LEFT JOIN sponsor_tenants st ON st.id=p.sponsor_id
    ORDER BY mp.created_at DESC LIMIT 500`).all()
  return c.json({ok:true,data:rows.results||[]})
})

app.post('/api/v1/superadmin/kawmed/batches',requireSuperAdmin('super_admin'),async(c:any)=>{
  const body=await c.req.json().catch(()=>({})),quantity=Math.floor(Number(body.quantity||0)),programId=clean(body.program_id,80)
  if(!Number.isFinite(quantity)||quantity<1||quantity>500)return c.json({ok:false,error:'La cantidad debe estar entre 1 y 500 códigos por lote.'},422)
  if(programId){const program=await c.env.DB.prepare('SELECT id,enabled FROM medical_sponsor_programs WHERE id=? LIMIT 1').bind(programId).first();if(!program)return c.json({ok:false,error:'Programa patrocinado no encontrado.'},404);if(Number((program as any).enabled)!==1)return c.json({ok:false,error:'El programa patrocinado está inactivo.'},409)}
  const id=crypto.randomUUID(),name=clean(body.name,120)||('Lote MED '+new Date().toISOString().slice(0,10)),adminId=String(c.get('adminUserId')||'')
  const codes:any[]=[],reserved=new Set<string>()
  for(let i=0;i<quantity;i++){
    let code=''
    for(let attempt=0;attempt<30&&!code;attempt++){
      const candidate=await uniqueMedCode(c)
      if(!reserved.has(candidate)){reserved.add(candidate);code=candidate}
    }
    if(!code)throw new Error('No se pudo completar un lote de códigos MED únicos.')
    codes.push({id:crypto.randomUUID(),code})
  }
  const statements:any[]=[c.env.DB.prepare('INSERT INTO medical_code_batches(id,program_id,name,quantity,notes,created_by_admin_user_id) VALUES(?,?,?,?,?,?)').bind(id,programId||null,name,quantity,clean(body.notes,500),adminId||null)]
  for(const item of codes)statements.push(c.env.DB.prepare("INSERT INTO medical_access_codes(id,code,batch_id,program_id,status,created_by_admin_user_id) VALUES(?,?,?,?, 'available',?)").bind(item.id,item.code,id,programId||null,adminId||null))
  await c.env.DB.batch(statements)
  const appUrl=String(c.env.APP_URL||'https://app.intaprd.com').replace(/\/$/,'')
  return c.json({ok:true,data:{batch_id:id,name,quantity,sponsored:Boolean(programId),codes:codes.map(x=>({code:x.code,claim_url:appUrl+'/claim/kawmed?code='+encodeURIComponent(x.code)}))}},201)
})

app.patch('/api/v1/superadmin/kawmed/codes/:code/status',requireSuperAdmin('super_admin'),async(c:any)=>{
  const code=normalizeCode(c.req.param('code')),body=await c.req.json().catch(()=>({})),status=String(body.status||'')
  if(!validMedCode(code)||!['available','inactive'].includes(status))return c.json({ok:false,error:'Código o estado inválido.'},422)
  const current=await c.env.DB.prepare('SELECT status FROM medical_access_codes WHERE code=? LIMIT 1').bind(code).first()
  if(!current)return c.json({ok:false,error:'Código MED no encontrado.'},404)
  if(String((current as any).status)==='claimed')return c.json({ok:false,error:'Un código reclamado no se puede reutilizar ni volver a disponible.'},409)
  await c.env.DB.prepare("UPDATE medical_access_codes SET status=?,updated_at=datetime('now') WHERE code=? AND status<>'claimed'").bind(status,code).run()
  return c.json({ok:true})
})

app.get('/api/v1/public/kawmed/claim/:code',async(c:any)=>{
  const code=normalizeCode(c.req.param('code'));if(!validMedCode(code))return c.json({ok:false,error:'Código MED inválido.'},400)
  const row=await c.env.DB.prepare(`SELECT mac.code,mac.status,p.name AS program_name,st.name AS sponsor_name
    FROM medical_access_codes mac LEFT JOIN medical_sponsor_programs p ON p.id=mac.program_id LEFT JOIN sponsor_tenants st ON st.id=p.sponsor_id
    WHERE mac.code=? LIMIT 1`).bind(code).first()
  if(!row)return c.json({ok:false,error:'Código MED no encontrado.'},404)
  return c.json({ok:true,data:{code,status:String((row as any).status),sponsored:Boolean((row as any).program_name),program_name:String((row as any).program_name||''),sponsor_name:String((row as any).sponsor_name||'')}})
})

app.post('/api/v1/me/kawmed/claim',requireUser,async(c:any)=>{
  const userId=String(c.get('userId')||''),body=await c.req.json().catch(()=>({})),code=normalizeCode(body.code)
  if(!validMedCode(code))return c.json({ok:false,error:'Código MED inválido.'},422)
  const prior=await c.env.DB.prepare("SELECT code,medical_profile_id FROM medical_access_codes WHERE claimed_by_user_id=? AND status='claimed' LIMIT 1").bind(userId).first()
  if(prior)return c.json({ok:false,error:'Esta cuenta ya activó un acceso KawMed.',code:'kawmed_already_claimed',medical_profile_id:String((prior as any).medical_profile_id||'')},409)
  const access=await c.env.DB.prepare(`SELECT mac.*,p.sponsor_id,p.vademecum_url,p.vademecum_label
    FROM medical_access_codes mac LEFT JOIN medical_sponsor_programs p ON p.id=mac.program_id WHERE mac.code=? LIMIT 1`).bind(code).first()
  if(!access)return c.json({ok:false,error:'Código MED no encontrado.'},404)
  if(String((access as any).status)!=='available')return c.json({ok:false,error:'Este código MED ya fue utilizado o está inactivo.'},409)
  const user=await c.env.DB.prepare('SELECT email FROM users WHERE id=? LIMIT 1').bind(userId).first()
  const email=String((user as any)?.email||'').trim().toLowerCase()
  let profile=await c.env.DB.prepare('SELECT id,slug FROM medical_profiles WHERE user_id=? ORDER BY created_at ASC LIMIT 1').bind(userId).first()
  let profileId=String((profile as any)?.id||''),profileSlug=String((profile as any)?.slug||''),created=false
  if(!profileId){
    profileId=crypto.randomUUID();profileSlug=await uniqueMedicalSlug(c,email||'medico')
    await c.env.DB.prepare(`INSERT INTO medical_profiles(id,user_id,slug,name,specialty,email,status,created_at,updated_at)
      VALUES(?,?,?,?,?,?,'draft',datetime('now'),datetime('now'))`).bind(profileId,userId,profileSlug,email?email.split('@')[0]:'Médico','Medicina',email).run()
    created=true
  }
  const claim=await c.env.DB.prepare("UPDATE medical_access_codes SET status='claimed',claimed_by_user_id=?,medical_profile_id=?,claimed_at=datetime('now'),updated_at=datetime('now') WHERE code=? AND status='available'").bind(userId,profileId,code).run()
  if(Number((claim as any)?.meta?.changes||0)!==1){
    if(created)await c.env.DB.prepare('DELETE FROM medical_profiles WHERE id=? AND user_id=? AND status=\'draft\'').bind(profileId,userId).run().catch(()=>undefined)
    return c.json({ok:false,error:'Este código MED acaba de ser utilizado por otra cuenta.'},409)
  }
  const sponsorId=String((access as any).sponsor_id||'')
  if(sponsorId){
    await c.env.DB.prepare(`INSERT INTO medical_profile_sponsors(medical_profile_id,sponsor_id,program_id,vademecum_url,vademecum_label,enabled,updated_at)
      VALUES(?,?,?,?,?,1,datetime('now'))
      ON CONFLICT(medical_profile_id) DO UPDATE SET sponsor_id=excluded.sponsor_id,program_id=excluded.program_id,vademecum_url=excluded.vademecum_url,vademecum_label=excluded.vademecum_label,enabled=1,updated_at=datetime('now')`).bind(
        profileId,sponsorId,String((access as any).program_id||''),String((access as any).vademecum_url||''),String((access as any).vademecum_label||'Ver vademécum')
      ).run()
  }
  return c.json({ok:true,data:{medical_profile_id:profileId,slug:profileSlug,sponsored:Boolean(sponsorId),next_url:'/admin/medical'}},201)
})

export default app
