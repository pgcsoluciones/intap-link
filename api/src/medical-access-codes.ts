import app from './index'
import { requireSuperAdmin } from './lib/admin-auth'
import { cookieNames } from './lib/cookies'
import { SPONSORED_MULTIPROFILE_AUTHORIZED_EMAIL, resolveSponsorMembership, setSponsorContext, setMedicalContextCookie } from './sponsored-multiprofile-access'

function clean(value:unknown,max=500){return String(value??'').trim().slice(0,max)}
function safeUrl(value:unknown){const raw=clean(value,1200);if(!raw)return'';try{const u=new URL(raw);return u.protocol==='https:'||u.protocol==='http:'?u.toString():''}catch{return''}}
function normalizeCode(value:unknown){return clean(value,32).toUpperCase()}
function validMedCode(value:string){return /^MED-[A-Z2-9]{3}-[A-Z2-9]{3}$/.test(value)}
function medMasterCode(){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',bytes=crypto.getRandomValues(new Uint8Array(6));const raw=Array.from(bytes).map(x=>alphabet[x%alphabet.length]).join('');return 'MEDM-'+raw.slice(0,3)+'-'+raw.slice(3,6)}
function validMedMasterCode(value:string){return /^MEDM-[A-Z2-9]{3}-[A-Z2-9]{3}$/.test(value)}
async function uniqueMedMasterCode(c:any){for(let i=0;i<30;i++){const code=medMasterCode();const row=await c.env.DB.prepare('SELECT id FROM medical_sponsor_masters WHERE master_code=? LIMIT 1').bind(code).first();if(!row)return code}throw new Error('No se pudo generar un Master KawMed único.')}
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
    id,sponsor_id,name,private_banner_image_url,private_cta_label,private_cta_url,vademecum_url,vademecum_label,representative_cta_label,representative_message_template,notes,enabled
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
    id,sponsorId,name,safeUrl(body.private_banner_image_url),clean(body.private_cta_label,80)||'Conocer más',safeUrl(body.private_cta_url),
    safeUrl(body.vademecum_url),clean(body.vademecum_label,80)||'Ver vademécum',
    clean(body.representative_cta_label,80)||'Mi visitador',
    clean(body.representative_message_template,400)||'Hola {visitador}, soy {medico}. Te contacto desde mi panel KawMed y necesito información de {patrocinador}.',
    clean(body.notes,500),body.enabled===false?0:1
  ).run()
  return c.json({ok:true,data:{id}},201)
})

app.patch('/api/v1/superadmin/kawmed/programs/:id',requireSuperAdmin('super_admin'),async(c:any)=>{
  const id=clean(c.req.param('id'),80),body=await c.req.json().catch(()=>({}))
  const current=await c.env.DB.prepare('SELECT * FROM medical_sponsor_programs WHERE id=? LIMIT 1').bind(id).first()
  if(!current)return c.json({ok:false,error:'Programa KawMed no encontrado.'},404)
  await c.env.DB.prepare(`UPDATE medical_sponsor_programs SET name=?,private_banner_image_url=?,private_cta_label=?,private_cta_url=?,vademecum_url=?,vademecum_label=?,representative_cta_label=?,representative_message_template=?,notes=?,enabled=?,updated_at=datetime('now') WHERE id=?`).bind(
    clean(body.name,120)||String((current as any).name||''),body.private_banner_image_url!==undefined?safeUrl(body.private_banner_image_url):String((current as any).private_banner_image_url||''),
    body.private_cta_label!==undefined?(clean(body.private_cta_label,80)||'Conocer más'):String((current as any).private_cta_label||'Conocer más'),
    body.private_cta_url!==undefined?safeUrl(body.private_cta_url):String((current as any).private_cta_url||''),
    body.vademecum_url!==undefined?safeUrl(body.vademecum_url):String((current as any).vademecum_url||''),
    body.vademecum_label!==undefined?(clean(body.vademecum_label,80)||'Ver vademécum'):String((current as any).vademecum_label||'Ver vademécum'),
    body.representative_cta_label!==undefined?(clean(body.representative_cta_label,80)||'Mi visitador'):String((current as any).representative_cta_label||'Mi visitador'),
    body.representative_message_template!==undefined?(clean(body.representative_message_template,400)||'Hola {visitador}, soy {medico}. Te contacto desde mi panel KawMed y necesito información de {patrocinador}.'):String((current as any).representative_message_template||'Hola {visitador}, soy {medico}. Te contacto desde mi panel KawMed y necesito información de {patrocinador}.'),
    body.notes!==undefined?clean(body.notes,500):String((current as any).notes||''),
    body.enabled===undefined?Number((current as any).enabled??1):(body.enabled?1:0),id
  ).run()
  return c.json({ok:true})
})


app.get('/api/v1/superadmin/kawmed/masters/:sponsorId',requireSuperAdmin('viewer'),async(c:any)=>{
  const sponsorId=clean(c.req.param('sponsorId'),80)
  const row=await c.env.DB.prepare(`SELECT msm.*,st.name AS sponsor_name,u.email AS claimed_email
    FROM medical_sponsor_masters msm
    JOIN sponsor_tenants st ON st.id=msm.sponsor_id
    LEFT JOIN users u ON u.id=msm.claimed_by_user_id
    WHERE msm.sponsor_id=? LIMIT 1`).bind(sponsorId).first()
  const appUrl=String(c.env.APP_URL||'https://app.intaprd.com').replace(/\/$/,'')
  return c.json({ok:true,data:row?{...row,claim_url:appUrl+'/claim/kawmed-master?code='+encodeURIComponent(String((row as any).master_code||''))}:null})
})

app.post('/api/v1/superadmin/kawmed/masters/:sponsorId',requireSuperAdmin('super_admin'),async(c:any)=>{
  const sponsorId=clean(c.req.param('sponsorId'),80)
  const sponsor=await c.env.DB.prepare('SELECT id,name FROM sponsor_tenants WHERE id=? LIMIT 1').bind(sponsorId).first()
  if(!sponsor)return c.json({ok:false,error:'Patrocinador no encontrado.'},404)
  const existing=await c.env.DB.prepare('SELECT * FROM medical_sponsor_masters WHERE sponsor_id=? LIMIT 1').bind(sponsorId).first()
  const appUrl=String(c.env.APP_URL||'https://app.intaprd.com').replace(/\/$/,'')
  if(existing){
    const code=String((existing as any).master_code||'')
    return c.json({ok:true,data:{master_code:code,status:String((existing as any).status||'available'),claim_url:appUrl+'/claim/kawmed-master?code='+encodeURIComponent(code),already_exists:true}})
  }
  const id=crypto.randomUUID(),code=await uniqueMedMasterCode(c),adminId=String(c.get('adminUserId')||'')
  await c.env.DB.prepare(`INSERT INTO medical_sponsor_masters(id,sponsor_id,master_code,status,created_by_admin_user_id) VALUES(?,?,?,'available',?)`).bind(id,sponsorId,code,adminId||null).run()
  return c.json({ok:true,data:{master_code:code,status:'available',claim_url:appUrl+'/claim/kawmed-master?code='+encodeURIComponent(code),already_exists:false}},201)
})

app.get('/api/v1/public/kawmed-master/:code',async(c:any)=>{
  const code=normalizeCode(c.req.param('code'))
  if(!validMedMasterCode(code))return c.json({ok:false,error:'Código Master KawMed inválido.'},400)
  const row=await c.env.DB.prepare(`SELECT msm.master_code,msm.status,st.id AS sponsor_id,st.name AS sponsor_name,st.logo_url
    FROM medical_sponsor_masters msm JOIN sponsor_tenants st ON st.id=msm.sponsor_id
    WHERE msm.master_code=? LIMIT 1`).bind(code).first()
  if(!row)return c.json({ok:false,error:'Master KawMed no encontrado.'},404)
  return c.json({ok:true,data:{master_code:String((row as any).master_code),status:String((row as any).status),sponsor_id:String((row as any).sponsor_id),sponsor_name:String((row as any).sponsor_name||''),logo_url:String((row as any).logo_url||'')}})
})


app.get('/api/v1/me/kawmed-master/access/:code',requireUser,async(c:any)=>{
  const userId=String(c.get('userId')||''),code=normalizeCode(c.req.param('code'))
  if(!validMedMasterCode(code))return c.json({ok:false,error:'Código Master KawMed inválido.'},422)
  const master=await c.env.DB.prepare(`SELECT msm.sponsor_id,msm.status,msm.claimed_by_user_id,st.contact_email,st.is_active
    FROM medical_sponsor_masters msm JOIN sponsor_tenants st ON st.id=msm.sponsor_id
    WHERE msm.master_code=? LIMIT 1`).bind(code).first()
  if(!master)return c.json({ok:false,error:'Master KawMed no encontrado.'},404)
  const user=await c.env.DB.prepare('SELECT email FROM users WHERE id=? LIMIT 1').bind(userId).first()
  const accountEmail=String((user as any)?.email||'').trim().toLowerCase()
  const sponsorEmail=String((master as any).contact_email||'').trim().toLowerCase()
  const existingLink=accountEmail!==SPONSORED_MULTIPROFILE_AUTHORIZED_EMAIL&&!(String((master as any).status)==='claimed'&&String((master as any).claimed_by_user_id||'')===userId)&&Boolean(
    await c.env.DB.prepare('SELECT id FROM profiles WHERE user_id=? LIMIT 1').bind(userId).first()||
    await c.env.DB.prepare('SELECT id FROM sponsored_profiles WHERE user_id=? LIMIT 1').bind(userId).first()
  )
  const sponsorId=String((master as any).sponsor_id||'')
  const alreadyMember=await c.env.DB.prepare(`SELECT role FROM sponsor_members WHERE sponsor_id=? AND user_id=? AND status='active' LIMIT 1`).bind(sponsorId,userId).first()
  const authorizedSpecial=accountEmail===SPONSORED_MULTIPROFILE_AUTHORIZED_EMAIL
  const claimedBy=String((master as any).claimed_by_user_id||'')
  const claimedByOther=String((master as any).status)==='claimed'&&claimedBy&&claimedBy!==userId
  const allowed=Number((master as any).is_active)===1&&!claimedByOther&&!existingLink&&Boolean(alreadyMember||authorizedSpecial||(sponsorEmail&&accountEmail===sponsorEmail))
  return c.json({ok:true,data:{
    authenticated:true,
    current_email:accountEmail,
    allowed,
    existing_link:existingLink,
    sponsor_id:sponsorId,
    status:String((master as any).status||'available'),
    reason:claimedByOther?'claimed_by_other':existingLink?'existing_link':allowed?'allowed':'wrong_account',
  }})
})

app.post('/api/v1/me/kawmed-master/claim',requireUser,async(c:any)=>{
  const userId=String(c.get('userId')||''),body=await c.req.json().catch(()=>({})),code=normalizeCode(body.code)
  if(!validMedMasterCode(code))return c.json({ok:false,error:'Código Master KawMed inválido.'},422)
  if(body.confirm_account!==true)return c.json({ok:false,error:'Confirma tu cuenta antes de activar el Master KawMed.',code:'kawmed_confirmation_required'},422)
  const master=await c.env.DB.prepare(`SELECT msm.*,st.name AS sponsor_name,st.contact_email,st.is_active
    FROM medical_sponsor_masters msm JOIN sponsor_tenants st ON st.id=msm.sponsor_id
    WHERE msm.master_code=? LIMIT 1`).bind(code).first()
  if(!master)return c.json({ok:false,error:'Master KawMed no encontrado.'},404)
  if(Number((master as any).is_active)!==1)return c.json({ok:false,error:'El patrocinador está inactivo.'},409)
  if(String((master as any).status)==='inactive')return c.json({ok:false,error:'Este Master KawMed está inactivo.'},409)
  const claimedBy=String((master as any).claimed_by_user_id||'')
  if(String((master as any).status)==='claimed'&&claimedBy&&claimedBy!==userId)return c.json({ok:false,error:'Este Master KawMed ya fue activado por otra cuenta.'},409)

  const user=await c.env.DB.prepare('SELECT email FROM users WHERE id=? LIMIT 1').bind(userId).first()
  const accountEmail=String((user as any)?.email||'').trim().toLowerCase()
  const sponsorEmail=String((master as any).contact_email||'').trim().toLowerCase()
  if(!accountEmail||clean(body.confirm_email,254).toLowerCase()!==accountEmail)return c.json({ok:false,error:'El correo confirmado no coincide con la sesión.',code:'kawmed_account_mismatch'},403)
  if(accountEmail!==SPONSORED_MULTIPROFILE_AUTHORIZED_EMAIL&&!(String((master as any).status)==='claimed'&&claimedBy===userId)){
    const link=await c.env.DB.prepare('SELECT id FROM profiles WHERE user_id=? LIMIT 1').bind(userId).first()
    const regularSponsored=await c.env.DB.prepare('SELECT id FROM sponsored_profiles WHERE user_id=? LIMIT 1').bind(userId).first()
    if(link||regularSponsored)return c.json({ok:false,error:'Este correo ya tiene una cuenta Link. Utiliza otro correo para KawMed Master.',code:'kawmed_existing_link_account'},409)
  }
  const sponsorId=String((master as any).sponsor_id||'')
  const alreadyMember=await c.env.DB.prepare(`SELECT role FROM sponsor_members WHERE sponsor_id=? AND user_id=? AND status='active' LIMIT 1`).bind(sponsorId,userId).first()
  const authorizedSpecial=accountEmail===SPONSORED_MULTIPROFILE_AUTHORIZED_EMAIL
  if(!alreadyMember&&!authorizedSpecial&&(!sponsorEmail||accountEmail!==sponsorEmail)){
    return c.json({ok:false,error:'Este Master debe activarse con el correo propietario registrado para el patrocinador.',code:'kawmed_master_wrong_account'},403)
  }

  await c.env.DB.batch([
    c.env.DB.prepare(`INSERT INTO sponsor_members(sponsor_id,user_id,role,status,created_at) VALUES(?,?,'owner','active',datetime('now')) ON CONFLICT(sponsor_id,user_id) DO UPDATE SET role='owner',status='active'`).bind(sponsorId,userId),
    c.env.DB.prepare(`UPDATE medical_sponsor_masters SET status='claimed',claimed_by_user_id=?,claimed_at=COALESCE(claimed_at,datetime('now')),updated_at=datetime('now') WHERE id=?`).bind(userId,String((master as any).id||'')),
  ])
  if(authorizedSpecial)await setSponsorContext(c,userId,sponsorId)
  return c.json({ok:true,data:{sponsor_id:sponsorId,sponsor_name:String((master as any).sponsor_name||''),next_url:'/admin/sponsor/kawmed'}},201)
})

app.get('/api/v1/superadmin/kawmed/codes',requireSuperAdmin('viewer'),async(c:any)=>{
  const q=clean(c.req.query('q'),80),status=clean(c.req.query('status'),20),program=clean(c.req.query('program_id'),80)
  const where:string[]=['1=1'],binds:any[]=[]
  if(q){where.push('(mac.code LIKE ? OR COALESCE(mdi.display_code,\'\') LIKE ? OR COALESCE(u.email,\'\') LIKE ? OR COALESCE(mp.name,\'\') LIKE ? OR COALESCE(b.name,\'\') LIKE ?)');const like='%'+q+'%';binds.push(like,like,like,like,like)}
  if(['available','claimed','inactive'].includes(status)){where.push('mac.status=?');binds.push(status)}
  if(program){where.push('mac.program_id=?');binds.push(program)}
  const rows=await c.env.DB.prepare(`SELECT mac.*,mdi.display_code,b.name AS batch_name,p.name AS program_name,st.name AS sponsor_name,
    u.email AS claimed_email,mp.name AS medical_name,mp.slug AS medical_slug,mp.specialty AS medical_specialty,
    COALESCE(mp.whatsapp,mp.phone) AS medical_phone,mp.email AS medical_email,
    mr.id AS representative_id,TRIM(COALESCE(mr.first_name,'')||' '||COALESCE(mr.last_name,'')) AS representative_name,
    mr.whatsapp AS representative_whatsapp,mr.zone AS representative_zone
    FROM medical_access_codes mac
    LEFT JOIN medical_display_identifiers mdi ON mdi.medical_code_id=mac.id
    LEFT JOIN medical_code_batches b ON b.id=mac.batch_id
    LEFT JOIN medical_sponsor_programs p ON p.id=mac.program_id
    LEFT JOIN sponsor_tenants st ON st.id=p.sponsor_id
    LEFT JOIN users u ON u.id=mac.claimed_by_user_id
    LEFT JOIN medical_profiles mp ON mp.id=mac.medical_profile_id
    LEFT JOIN medical_representatives mr ON mr.id=mac.current_representative_id
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
    codes.push({id:crypto.randomUUID(),code,station_number:i+1})
  }
  const lastLabel=await c.env.DB.prepare('SELECT COALESCE(MAX(sequence_number),0) AS last FROM medical_display_identifiers').first()
  const startLabel=Number((lastLabel as any)?.last||0)
  if(startLabel+quantity>32767)return c.json({ok:false,error:'Se agotó la serie física de cuatro caracteres KawMed.'},409)
  const alphabet='0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  const shortLabel=(n:number)=>{let value=n+340,part='';for(let j=0;j<3;j++){part=alphabet[value%alphabet.length]+part;value=Math.floor(value/alphabet.length)}return 'M'+part}
  codes.forEach((item,i)=>{item.display_code=shortLabel(startLabel+i+1);item.physical_sequence=startLabel+i+1})
  const statements:any[]=[c.env.DB.prepare('INSERT INTO medical_code_batches(id,program_id,name,quantity,notes,created_by_admin_user_id) VALUES(?,?,?,?,?,?)').bind(id,programId||null,name,quantity,clean(body.notes,500),adminId||null)]
  for(const item of codes){statements.push(c.env.DB.prepare("INSERT INTO medical_access_codes(id,code,batch_id,program_id,station_number,status,created_by_admin_user_id) VALUES(?,?,?,?,?,'available',?)").bind(item.id,item.code,id,programId||null,item.station_number,adminId||null));statements.push(c.env.DB.prepare('INSERT INTO medical_display_identifiers(medical_code_id,display_code,sequence_number) VALUES(?,?,?)').bind(item.id,item.display_code,item.physical_sequence))}
  await c.env.DB.batch(statements)
  const appUrl=String(c.env.APP_URL||'https://app.intaprd.com').replace(/\/$/,'')
  return c.json({ok:true,data:{batch_id:id,name,quantity,sponsored:Boolean(programId),codes:codes.map(x=>({code:x.code,station_number:x.station_number,display_code:x.display_code,claim_url:appUrl+'/claim/kawmed?code='+encodeURIComponent(x.code)}))}},201)
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
  const row=await c.env.DB.prepare(`SELECT mac.code,mac.status,mdi.display_code,p.name AS program_name,st.name AS sponsor_name
    FROM medical_access_codes mac LEFT JOIN medical_display_identifiers mdi ON mdi.medical_code_id=mac.id LEFT JOIN medical_sponsor_programs p ON p.id=mac.program_id LEFT JOIN sponsor_tenants st ON st.id=p.sponsor_id
    WHERE mac.code=? LIMIT 1`).bind(code).first()
  if(!row)return c.json({ok:false,error:'Código MED no encontrado.'},404)
  return c.json({ok:true,data:{code,display_code:String((row as any).display_code||''),status:String((row as any).status),sponsored:Boolean((row as any).program_name),program_name:String((row as any).program_name||''),sponsor_name:String((row as any).sponsor_name||'')}})
})

app.get('/api/v1/me/kawmed/claim-check/:code',requireUser,async(c:any)=>{
  const userId=String(c.get('userId')||''),code=normalizeCode(c.req.param('code'))
  if(!validMedCode(code))return c.json({ok:false,error:'Código MED inválido.'},422)
  const user=await c.env.DB.prepare('SELECT email FROM users WHERE id=? LIMIT 1').bind(userId).first()
  const email=String((user as any)?.email||'').trim().toLowerCase()
  const med=await c.env.DB.prepare("SELECT id FROM medical_profiles WHERE user_id=? LIMIT 1").bind(userId).first()
  const medCode=await c.env.DB.prepare("SELECT code FROM medical_access_codes WHERE claimed_by_user_id=? AND status='claimed' LIMIT 1").bind(userId).first()
  const link=await c.env.DB.prepare('SELECT id FROM profiles WHERE user_id=? LIMIT 1').bind(userId).first()
  const sponsored=await c.env.DB.prepare("SELECT id FROM sponsored_profiles WHERE user_id=? LIMIT 1").bind(userId).first()
  const codeRow=await c.env.DB.prepare('SELECT status,claimed_by_user_id,medical_profile_id FROM medical_access_codes WHERE code=? LIMIT 1').bind(code).first()
  if(!codeRow)return c.json({ok:false,error:'Código MED no encontrado.'},404)
  const special=email===SPONSORED_MULTIPROFILE_AUTHORIZED_EMAIL
  const existingLink=Boolean(link||sponsored)
  const codeOwned=String((codeRow as any).status)==='claimed'&&String((codeRow as any).claimed_by_user_id||'')===userId
  const reason=String((codeRow as any).status)!=='available'?(codeOwned?'already_owned':'code_unavailable'):
    !special&&(med||medCode)?'already_med':
    existingLink&&!special?'existing_link':'ready'
  return c.json({ok:true,data:{email,authenticated:true,existing_link:existingLink,special_multiaccount:special,can_activate:reason==='ready',reason,code_status:String((codeRow as any).status),next_url:codeOwned?(special?'/admin/accounts':'/admin/medical'):null}})
})

app.post('/api/v1/me/kawmed/claim',requireUser,async(c:any)=>{
  const userId=String(c.get('userId')||''),body=await c.req.json().catch(()=>({})),code=normalizeCode(body.code)
  if(!validMedCode(code))return c.json({ok:false,error:'Código MED inválido.'},422)
  if(body.confirm_account!==true)return c.json({ok:false,error:'Confirma expresamente el correo y la activación KawMed antes de continuar.',code:'kawmed_confirmation_required'},422)
  const checkUser=await c.env.DB.prepare('SELECT email FROM users WHERE id=? LIMIT 1').bind(userId).first()
  const checkEmail=String((checkUser as any)?.email||'').trim().toLowerCase()
  if(!checkEmail||clean(body.confirm_email,254).toLowerCase()!==checkEmail)return c.json({ok:false,error:'La sesión no corresponde al correo confirmado. Cambia de cuenta y vuelve a validar.',code:'kawmed_account_mismatch'},403)
  if(checkEmail!==SPONSORED_MULTIPROFILE_AUTHORIZED_EMAIL){
    const existing=await c.env.DB.prepare('SELECT id FROM profiles WHERE user_id=? LIMIT 1').bind(userId).first()
    const sponsored=await c.env.DB.prepare('SELECT id FROM sponsored_profiles WHERE user_id=? LIMIT 1').bind(userId).first()
    if(existing||sponsored)return c.json({ok:false,error:'Este correo ya tiene una cuenta Kawvo Link registrada. Para evitar conflictos, utiliza otro correo para KawMed.',code:'kawmed_existing_link_account'},409)
  }
  const prior=await c.env.DB.prepare("SELECT code,medical_profile_id FROM medical_access_codes WHERE claimed_by_user_id=? AND status='claimed' LIMIT 1").bind(userId).first()
  if(prior&&checkEmail!==SPONSORED_MULTIPROFILE_AUTHORIZED_EMAIL)return c.json({ok:false,error:'Esta cuenta ya activó un acceso KawMed.',code:'kawmed_already_claimed',medical_profile_id:String((prior as any).medical_profile_id||'')},409)
  const access=await c.env.DB.prepare(`SELECT mac.*,p.sponsor_id,p.vademecum_url,p.vademecum_label,p.enabled AS program_enabled,st.is_active AS sponsor_active
    FROM medical_access_codes mac
    LEFT JOIN medical_sponsor_programs p ON p.id=mac.program_id
    LEFT JOIN sponsor_tenants st ON st.id=p.sponsor_id
    WHERE mac.code=? LIMIT 1`).bind(code).first()
  if(!access)return c.json({ok:false,error:'Código MED no encontrado.'},404)
  if(String((access as any).status)!=='available')return c.json({ok:false,error:'Este código MED ya fue utilizado o está inactivo.'},409)
  if(String((access as any).program_id||'')){
    if(Number((access as any).program_enabled)!==1)return c.json({ok:false,error:'El programa patrocinado de este código está pausado.'},409)
    if(Number((access as any).sponsor_active)!==1)return c.json({ok:false,error:'El patrocinador de este código no está activo.'},409)
  }
  const user=await c.env.DB.prepare('SELECT email FROM users WHERE id=? LIMIT 1').bind(userId).first()
  const email=String((user as any)?.email||'').trim().toLowerCase()
  let profile=checkEmail===SPONSORED_MULTIPROFILE_AUTHORIZED_EMAIL?null:await c.env.DB.prepare('SELECT id,slug FROM medical_profiles WHERE user_id=? ORDER BY created_at ASC LIMIT 1').bind(userId).first()
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
  if(checkEmail===SPONSORED_MULTIPROFILE_AUTHORIZED_EMAIL)setMedicalContextCookie(c,profileId)
  return c.json({ok:true,data:{medical_profile_id:profileId,slug:profileSlug,sponsored:Boolean(sponsorId),next_url:'/admin/medical'}},201)
})

async function sponsorMembership(c:any,write=false){
  const userId=await sessionUserId(c)
  if(!userId)return{error:c.json({ok:false,error:'Unauthorized'},401)}
  const row=await resolveSponsorMembership(c,userId)
  if(!row)return{error:c.json({ok:false,error:'No tienes acceso a un patrocinador.'},403)}
  if(write&&!['owner','admin'].includes(String((row as any).role||'')))return{error:c.json({ok:false,error:'No tienes permiso para administrar KawMed.'},403)}
  return{userId,sponsorId:String((row as any).sponsor_id||''),role:String((row as any).role||''),sponsorName:String((row as any).name||'')}
}
function normalizePhone(value:unknown){let d=String(value??'').replace(/\D/g,'');if(d.length===10)d='1'+d;return d.slice(0,15)}
function representativeName(row:any){return [String(row?.first_name||'').trim(),String(row?.last_name||'').trim()].filter(Boolean).join(' ')}
function waMessage(template:string,ctx:{visitador:string;medico:string;patrocinador:string}){
  return template.replace(/\{visitador\}/gi,ctx.visitador).replace(/\{medico\}/gi,ctx.medico).replace(/\{patrocinador\}/gi,ctx.patrocinador)
}

app.get('/api/v1/sponsor/kawmed/overview',async(c:any)=>{
  const auth:any=await sponsorMembership(c,false);if(auth.error)return auth.error
  const sponsorId=auth.sponsorId
  const [tenant,master,programs,batches,reps,codes]=await Promise.all([
    c.env.DB.prepare("SELECT id,name,slug,logo_url,banner_image_url,contact_email,contact_whatsapp,website_url FROM sponsor_tenants WHERE id=? LIMIT 1").bind(sponsorId).first(),
    c.env.DB.prepare("SELECT master_code,status,claimed_at FROM medical_sponsor_masters WHERE sponsor_id=? LIMIT 1").bind(sponsorId).first(),
    c.env.DB.prepare(`SELECT p.*,
      (SELECT COUNT(*) FROM medical_access_codes mac WHERE mac.program_id=p.id) codes_total,
      (SELECT COUNT(*) FROM medical_access_codes mac WHERE mac.program_id=p.id AND mac.status='claimed') codes_claimed
      FROM medical_sponsor_programs p WHERE p.sponsor_id=? ORDER BY p.created_at DESC`).bind(sponsorId).all(),
    c.env.DB.prepare(`SELECT b.*,p.name AS program_name,
      (SELECT COUNT(*) FROM medical_access_codes mac WHERE mac.batch_id=b.id) codes_total,
      (SELECT COUNT(*) FROM medical_access_codes mac WHERE mac.batch_id=b.id AND mac.status='claimed') codes_claimed
      FROM medical_code_batches b JOIN medical_sponsor_programs p ON p.id=b.program_id
      WHERE p.sponsor_id=? ORDER BY b.created_at DESC`).bind(sponsorId).all(),
    c.env.DB.prepare(`SELECT mr.*,
      (SELECT COUNT(*) FROM medical_access_codes mac WHERE mac.current_representative_id=mr.id) codes_total,
      (SELECT COUNT(*) FROM medical_access_codes mac WHERE mac.current_representative_id=mr.id AND mac.status='claimed') doctors_active
      FROM medical_representatives mr WHERE mr.sponsor_id=? ORDER BY mr.active DESC,mr.first_name,mr.last_name`).bind(sponsorId).all(),
    c.env.DB.prepare(`SELECT mac.id,mac.code,mac.status,mac.station_number,mac.claimed_at,mac.batch_id,
      b.name AS batch_name,p.id AS program_id,p.name AS program_name,
      mp.id AS medical_profile_id,mp.name AS medical_name,mp.professional_prefix,mp.specialty AS medical_specialty,
      COALESCE(NULLIF(mp.whatsapp,''),mp.phone) AS medical_phone,COALESCE(NULLIF(mp.email,''),u.email) AS medical_email,mp.slug AS medical_slug,
      mr.id AS representative_id,mr.employee_code AS representative_code,mr.first_name AS representative_first_name,mr.last_name AS representative_last_name,
      mr.whatsapp AS representative_whatsapp,mr.zone AS representative_zone,mr.territory AS representative_territory,
      cra.group_label AS assignment_group,cra.assigned_at AS representative_assigned_at
      FROM medical_access_codes mac
      JOIN medical_sponsor_programs p ON p.id=mac.program_id
      LEFT JOIN medical_code_batches b ON b.id=mac.batch_id
      LEFT JOIN medical_profiles mp ON mp.id=mac.medical_profile_id
      LEFT JOIN users u ON u.id=mac.claimed_by_user_id
      LEFT JOIN medical_representatives mr ON mr.id=mac.current_representative_id
      LEFT JOIN medical_code_representative_assignments cra ON cra.medical_access_code_id=mac.id AND cra.active=1
      WHERE p.sponsor_id=?
      ORDER BY b.created_at DESC,COALESCE(mac.station_number,999999),mac.created_at`).bind(sponsorId).all()
  ])
  return c.json({ok:true,data:{
    sponsor:{id:sponsorId,name:auth.sponsorName,role:auth.role,...(tenant||{})},
    master:master||null,
    programs:programs.results||[],
    batches:batches.results||[],
    representatives:reps.results||[],
    codes:codes.results||[]
  }})
})

app.patch('/api/v1/sponsor/kawmed/programs/:id',async(c:any)=>{
  const auth:any=await sponsorMembership(c,true);if(auth.error)return auth.error
  const id=clean(c.req.param('id'),80),body=await c.req.json().catch(()=>({}))
  const current=await c.env.DB.prepare("SELECT * FROM medical_sponsor_programs WHERE id=? AND sponsor_id=? LIMIT 1").bind(id,auth.sponsorId).first()
  if(!current)return c.json({ok:false,error:'Programa KawMed no encontrado.'},404)
  await c.env.DB.prepare(`UPDATE medical_sponsor_programs SET
    private_banner_image_url=?,private_cta_label=?,private_cta_url=?,
    vademecum_url=?,vademecum_label=?,representative_cta_label=?,representative_message_template=?,
    updated_at=datetime('now') WHERE id=? AND sponsor_id=?`).bind(
      body.private_banner_image_url!==undefined?safeUrl(body.private_banner_image_url):String((current as any).private_banner_image_url||''),
      body.private_cta_label!==undefined?(clean(body.private_cta_label,80)||'Conocer más'):String((current as any).private_cta_label||'Conocer más'),
      body.private_cta_url!==undefined?safeUrl(body.private_cta_url):String((current as any).private_cta_url||''),
      body.vademecum_url!==undefined?safeUrl(body.vademecum_url):String((current as any).vademecum_url||''),
      body.vademecum_label!==undefined?(clean(body.vademecum_label,80)||'Ver vademécum'):String((current as any).vademecum_label||'Ver vademécum'),
      body.representative_cta_label!==undefined?(clean(body.representative_cta_label,80)||'Mi visitador'):String((current as any).representative_cta_label||'Mi visitador'),
      body.representative_message_template!==undefined?(clean(body.representative_message_template,400)||String((current as any).representative_message_template||'')):String((current as any).representative_message_template||''),
      id,auth.sponsorId
    ).run()
  return c.json({ok:true})
})

app.post('/api/v1/sponsor/kawmed/representatives/import',async(c:any)=>{
  const auth:any=await sponsorMembership(c,true);if(auth.error)return auth.error
  const body=await c.req.json().catch(()=>({})),rows=Array.isArray(body.rows)?body.rows.slice(0,1000):[]
  if(!rows.length)return c.json({ok:false,error:'No hay colaboradores para importar.'},422)
  const statements:any[]=[];let accepted=0
  for(const source of rows){
    const firstName=clean(source.first_name||source.nombre,80),lastName=clean(source.last_name||source.apellido,80)
    const whatsapp=normalizePhone(source.whatsapp||source.telefono||source.phone),email=clean(source.email||source.correo,160).toLowerCase()
    const employeeCode=clean(source.employee_code||source.codigo||source.code,60).toUpperCase(),zone=clean(source.zone||source.zona,100),territory=clean(source.territory||source.territorio,120)
    if(!firstName||whatsapp.length<10)continue
    const id=crypto.randomUUID()
    if(employeeCode){
      statements.push(c.env.DB.prepare(`INSERT INTO medical_representatives(id,sponsor_id,employee_code,first_name,last_name,whatsapp,email,zone,territory,active)
        VALUES(?,?,?,?,?,?,?,?,?,1)
        ON CONFLICT(sponsor_id,employee_code) WHERE employee_code IS NOT NULL AND employee_code<>'' DO UPDATE SET
        first_name=excluded.first_name,last_name=excluded.last_name,whatsapp=excluded.whatsapp,email=excluded.email,zone=excluded.zone,territory=excluded.territory,active=1,updated_at=datetime('now')`)
        .bind(id,auth.sponsorId,employeeCode,firstName,lastName,whatsapp,email,zone,territory))
    }else{
      statements.push(c.env.DB.prepare(`INSERT INTO medical_representatives(id,sponsor_id,first_name,last_name,whatsapp,email,zone,territory,active)
        VALUES(?,?,?,?,?,?,?,?,1)`).bind(id,auth.sponsorId,firstName,lastName,whatsapp,email,zone,territory))
    }
    accepted++
  }
  if(!statements.length)return c.json({ok:false,error:'Ninguna fila válida. Nombre y WhatsApp son obligatorios.'},422)
  await c.env.DB.batch(statements)
  return c.json({ok:true,data:{received:rows.length,accepted}})
})

app.post('/api/v1/sponsor/kawmed/representatives',async(c:any)=>{
  const auth:any=await sponsorMembership(c,true);if(auth.error)return auth.error
  const body=await c.req.json().catch(()=>({})),firstName=clean(body.first_name,80),whatsapp=normalizePhone(body.whatsapp)
  if(!firstName||whatsapp.length<10)return c.json({ok:false,error:'Nombre y WhatsApp válido son requeridos.'},422)
  const id=crypto.randomUUID()
  await c.env.DB.prepare(`INSERT INTO medical_representatives(id,sponsor_id,employee_code,first_name,last_name,whatsapp,email,zone,territory,active)
    VALUES(?,?,?,?,?,?,?,?,?,1)`).bind(id,auth.sponsorId,clean(body.employee_code,60).toUpperCase()||null,firstName,clean(body.last_name,80),whatsapp,clean(body.email,160).toLowerCase(),clean(body.zone,100),clean(body.territory,120)).run()
  return c.json({ok:true,data:{id}},201)
})

app.patch('/api/v1/sponsor/kawmed/representatives/:id',async(c:any)=>{
  const auth:any=await sponsorMembership(c,true);if(auth.error)return auth.error
  const id=clean(c.req.param('id'),80),body=await c.req.json().catch(()=>({}))
  const current=await c.env.DB.prepare('SELECT * FROM medical_representatives WHERE id=? AND sponsor_id=? LIMIT 1').bind(id,auth.sponsorId).first()
  if(!current)return c.json({ok:false,error:'Visitador no encontrado.'},404)
  const whatsapp=body.whatsapp!==undefined?normalizePhone(body.whatsapp):String((current as any).whatsapp||'')
  if(whatsapp.length<10)return c.json({ok:false,error:'WhatsApp inválido.'},422)
  await c.env.DB.prepare(`UPDATE medical_representatives SET employee_code=?,first_name=?,last_name=?,whatsapp=?,email=?,zone=?,territory=?,active=?,updated_at=datetime('now') WHERE id=? AND sponsor_id=?`).bind(
    body.employee_code!==undefined?(clean(body.employee_code,60).toUpperCase()||null):(current as any).employee_code,
    body.first_name!==undefined?(clean(body.first_name,80)||String((current as any).first_name)):(current as any).first_name,
    body.last_name!==undefined?clean(body.last_name,80):(current as any).last_name,whatsapp,
    body.email!==undefined?clean(body.email,160).toLowerCase():(current as any).email,
    body.zone!==undefined?clean(body.zone,100):(current as any).zone,
    body.territory!==undefined?clean(body.territory,120):(current as any).territory,
    body.active===undefined?Number((current as any).active??1):(body.active?1:0),id,auth.sponsorId
  ).run()
  return c.json({ok:true})
})

app.post('/api/v1/sponsor/kawmed/assign',async(c:any)=>{
  const auth:any=await sponsorMembership(c,true);if(auth.error)return auth.error
  const body=await c.req.json().catch(()=>({})),representativeId=clean(body.representative_id,80),batchId=clean(body.batch_id,80),groupLabel=clean(body.group_label,120)
  const rep=await c.env.DB.prepare('SELECT id FROM medical_representatives WHERE id=? AND sponsor_id=? AND active=1 LIMIT 1').bind(representativeId,auth.sponsorId).first()
  if(!rep)return c.json({ok:false,error:'Visitador inválido o inactivo.'},422)
  let codeIds=Array.isArray(body.code_ids)?body.code_ids.map((v:any)=>clean(v,80)).filter(Boolean).slice(0,500):[]
  let source='selection'
  if(!codeIds.length){
    const quantity=Math.max(0,Math.min(500,Math.floor(Number(body.quantity||0))))
    if(!batchId||!quantity)return c.json({ok:false,error:'Selecciona códigos o indica lote y cantidad.'},422)
    const rows=await c.env.DB.prepare(`SELECT mac.id FROM medical_access_codes mac
      JOIN medical_sponsor_programs p ON p.id=mac.program_id
      WHERE mac.batch_id=? AND p.sponsor_id=? AND mac.status<>'inactive'
        AND (mac.current_representative_id IS NULL OR mac.current_representative_id='')
      ORDER BY COALESCE(mac.station_number,999999),mac.created_at
      LIMIT ?`).bind(batchId,auth.sponsorId,quantity).all()
    codeIds=(rows.results||[]).map((r:any)=>String(r.id||'')).filter(Boolean);source='quantity'
  }
  if(!codeIds.length)return c.json({ok:false,error:'No hay códigos disponibles para asignar.'},409)
  const marks=codeIds.map(()=>'?').join(',')
  const owned=await c.env.DB.prepare(`SELECT mac.id FROM medical_access_codes mac JOIN medical_sponsor_programs p ON p.id=mac.program_id WHERE p.sponsor_id=? AND mac.id IN (${marks})`).bind(auth.sponsorId,...codeIds).all()
  const allowed=(owned.results||[]).map((r:any)=>String(r.id||''))
  if(!allowed.length)return c.json({ok:false,error:'Los códigos seleccionados no pertenecen a este patrocinador.'},403)
  const statements:any[]=[]
  for(const id of allowed){
    statements.push(
      c.env.DB.prepare("UPDATE medical_code_representative_assignments SET active=0,ended_at=datetime('now') WHERE medical_access_code_id=? AND active=1").bind(id),
      c.env.DB.prepare("INSERT INTO medical_code_representative_assignments(id,medical_access_code_id,representative_id,assigned_by_user_id,assignment_source,group_label,active) VALUES(?,?,?,?,?,?,1)").bind(crypto.randomUUID(),id,representativeId,auth.userId,source,groupLabel),
      c.env.DB.prepare("UPDATE medical_access_codes SET current_representative_id=?,updated_at=datetime('now') WHERE id=?").bind(representativeId,id)
    )
  }
  await c.env.DB.batch(statements)
  return c.json({ok:true,data:{assigned:allowed.length}})
})

app.get('/api/v1/sponsor/kawmed/assignments/history',async(c:any)=>{
  const auth:any=await sponsorMembership(c,false);if(auth.error)return auth.error
  const codeId=clean(c.req.query('code_id'),80)
  const rows=await c.env.DB.prepare(`SELECT a.id,a.medical_access_code_id,a.assignment_source,a.group_label,a.assigned_at,a.ended_at,a.active,
    mr.first_name,mr.last_name,mr.employee_code,mr.zone
    FROM medical_code_representative_assignments a
    JOIN medical_representatives mr ON mr.id=a.representative_id
    JOIN medical_access_codes mac ON mac.id=a.medical_access_code_id
    JOIN medical_sponsor_programs p ON p.id=mac.program_id
    WHERE p.sponsor_id=? AND (?='' OR a.medical_access_code_id=?)
    ORDER BY a.assigned_at DESC LIMIT 500`).bind(auth.sponsorId,codeId,codeId).all()
  return c.json({ok:true,data:rows.results||[]})
})

export default app
