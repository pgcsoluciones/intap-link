import app from './index'
import { cookieNames } from './lib/cookies'
import { requireSuperAdmin } from './lib/admin-auth'
import { liveGuestInvitation, sessionActor } from './kawmed-live-guest'

const email=(v:unknown)=>String(v||'').trim().toLowerCase().slice(0,254)
const sha=async(v:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))).map(b=>b.toString(16).padStart(2,'0')).join('')
function cookie(header:string,name:string){return header.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1)||''}
async function user(c:any){const token=cookie(c.req.header('Cookie')||'',cookieNames(c.env).session);if(!token)return null;return c.env.DB.prepare("SELECT u.id,u.email FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.session_hash=? AND s.revoked_at IS NULL AND s.expires_at>datetime('now') LIMIT 1").bind(await sha(decodeURIComponent(token))).first()}
async function invitation(c:any,token:string){
 if(/^i-[a-f0-9-]{36}$/.test(token))return c.env.DB.prepare("SELECT * FROM kawmed_demo_invitations WHERE id=? LIMIT 1").bind(token.slice(2)).first()
 if(!/^[a-f0-9]{64}$/.test(token))return null
 return c.env.DB.prepare("SELECT * FROM kawmed_demo_invitations WHERE token_hash=? LIMIT 1").bind(await sha(token)).first()
}
const deny=(c:any)=>c.json({ok:false,error:'Invitación no disponible o vencida.'},403)
function snapshot(source:any){const allowed=['name','professional_prefix','specialty','subspecialty','bio','avatar_url','cover_url','phone','whatsapp','email','city','province','country','organization','template','palette','centers','schedules','insurance_policy'];return Object.fromEntries(allowed.map(k=>[k,source?.[k]??(k==='centers'||k==='schedules'?[]:k==='insurance_policy'?{accepted:[],excluded:[]}:'' )]))}
app.get('/api/v1/superadmin/kawmed/demo-invitations',requireSuperAdmin('viewer'),async(c:any)=>{
 const rows=await c.env.DB.prepare("SELECT i.id,i.invited_email,i.status,i.expires_at,i.accepted_at,i.created_at,p.name AS profile_name,p.slug FROM kawmed_demo_invitations i JOIN medical_profiles p ON p.id=i.source_medical_profile_id ORDER BY i.created_at DESC LIMIT 100").all()
 return c.json({ok:true,data:rows.results||[]})
})
app.post('/api/v1/superadmin/kawmed/demo-invitations',requireSuperAdmin('super_admin'),async(c:any)=>{
 const admin=await user(c),b=await c.req.json().catch(()=>({})),invited=email(b.email),profileId=String(b.medical_profile_id||'')
 if(!admin)return c.json({ok:false,error:'Inicia sesión.'},401)
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invited))return c.json({ok:false,error:'Correo inválido.'},422)
 const duration=[24,72,168].includes(Number(b.hours))?Number(b.hours):72
 const profile=await c.env.DB.prepare('SELECT * FROM medical_profiles WHERE id=? LIMIT 1').bind(profileId).first()
 if(!profile)return c.json({ok:false,error:'Perfil demo no encontrado.'},404)
 // Only the privileged operator's own demonstration profile can be shared.
 const owner=await c.env.DB.prepare('SELECT email FROM users WHERE id=?').bind(String((profile as any).user_id||'')).first()
 if(email((owner as any)?.email)!=='intapcard@gmail.com')return c.json({ok:false,error:'Solamente los perfiles demo de Intapcard se pueden invitar.'},403)
 const fields=snapshot(profile)
 for(const [key,sql] of Object.entries({centers:'SELECT name,address,city,province,phone,map_url FROM medical_profile_centers WHERE medical_profile_id=?',schedules:'SELECT day_of_week,shift,start_time,end_time FROM medical_profile_schedules WHERE medical_profile_id=?'})){
 const rows=await c.env.DB.prepare(sql).bind(profileId).all();fields[key]=(rows.results||[]).map((x:any)=>({...x}))
 }
 const appearance=await c.env.DB.prepare('SELECT template,palette FROM medical_profile_appearance WHERE medical_profile_id=?').bind(profileId).first()
 fields.template=String((appearance as any)?.template||'classic')
 fields.palette=String((appearance as any)?.palette||'aqua')
 const accepted=await c.env.DB.prepare('SELECT insurance_name FROM medical_profile_insurances WHERE medical_profile_id=? ORDER BY sort_order').bind(profileId).all()
 const excluded=await c.env.DB.prepare('SELECT insurance_name FROM medical_profile_insurance_exclusions WHERE medical_profile_id=? ORDER BY sort_order').bind(profileId).all()
 fields.insurance_policy={accepted:(accepted.results||[]).map((x:any)=>({insurance_name:x.insurance_name})),excluded:(excluded.results||[]).map((x:any)=>({insurance_name:x.insurance_name}))}
 // Sponsor attributes are copied only into the private guest sandbox.
 // Never expose sponsor credentials, representative contact lists or live patient records.
 const sponsorship=await c.env.DB.prepare(`SELECT st.name AS sponsor_name,st.logo_url,
   p.name AS program_name,p.private_banner_image_url,p.private_cta_label,p.private_cta_url,
   p.vademecum_label,p.vademecum_url,p.representative_cta_label,p.representative_message_template,
   mr.whatsapp AS representative_whatsapp, TRIM(COALESCE(mr.first_name,'')||' '||COALESCE(mr.last_name,'')) AS representative_name, mr.zone AS representative_zone
   FROM medical_profile_sponsors mps
   JOIN sponsor_tenants st ON st.id=mps.sponsor_id
   LEFT JOIN medical_sponsor_programs p ON p.id=mps.program_id
   LEFT JOIN medical_access_codes mac ON mac.medical_profile_id=mps.medical_profile_id AND mac.status='claimed'
   LEFT JOIN medical_representatives mr ON mr.id=mac.current_representative_id AND mr.active=1
   WHERE mps.medical_profile_id=? AND mps.enabled=1 LIMIT 1`).bind(profileId).first()
 fields.demo_mode=sponsorship?'sponsored':'independent'
 fields.demo_agenda={requests:[{id:'demo-request-1',patient_name:'Paciente de ejemplo',requested_date:'2026-11-02',requested_time:'10:00',status:'pending',reason:'Primera consulta'},{id:'demo-request-2',patient_name:'Paciente de demostración',requested_date:'2026-11-03',requested_time:'15:00',status:'confirmed',reason:'Seguimiento'}],blocked_dates:[]}
 fields.sponsor_demo=sponsorship?{
   sponsor_name:String((sponsorship as any).sponsor_name||''),
   sponsor_logo_url:String((sponsorship as any).logo_url||''),
   program_name:String((sponsorship as any).program_name||''),
   banner_url:String((sponsorship as any).private_banner_image_url||''),
   cta_label:String((sponsorship as any).private_cta_label||''),
   cta_url:String((sponsorship as any).private_cta_url||''),
   vademecum_label:String((sponsorship as any).vademecum_label||''),
   vademecum_url:String((sponsorship as any).vademecum_url||''),
   representative_cta_label:String((sponsorship as any).representative_cta_label||'Mi visitador'),
   representative_message_template:String((sponsorship as any).representative_message_template||'Hola {visitador}, soy {medico}. Te contacto desde KawMed para conocer {patrocinador}.'),
   representative_name:String((sponsorship as any).representative_name||''),
   representative_whatsapp:String((sponsorship as any).representative_whatsapp||''),
   representative_zone:String((sponsorship as any).representative_zone||'')
 }:null
 const raw=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(x=>x.toString(16).padStart(2,'0')).join('')
 const id=crypto.randomUUID(),expires=new Date(Date.now()+duration*3600000).toISOString()
 await c.env.DB.prepare("INSERT INTO kawmed_demo_invitations(id,owner_user_id,source_medical_profile_id,invited_email,token_hash,expires_at,sandbox_json) VALUES(?,?,?,?,?,?,?)").bind(id,String((profile as any).user_id),profileId,invited,await sha(raw),expires,JSON.stringify(fields)).run()
 if(b.live_access===true){
   await c.env.DB.prepare("INSERT INTO kawmed_demo_live_access(invitation_id,medical_profile_id,owner_user_id) VALUES(?,?,?)").bind(id,profileId,String((profile as any).user_id)).run()
 }
 return c.json({ok:true,data:{id,email:invited,expires_at:expires,url:String(c.env.APP_URL||'https://app.intaprd.com').replace(/\/$/,'')+'/admin/medical/demo/'+raw}},201)
})
app.get('/api/v1/me/kawmed/demo-invitations',async(c:any)=>{
 const actor=await user(c);if(!actor)return c.json({ok:false,error:'Unauthorized'},401)
 const records=await c.env.DB.prepare("SELECT i.id,i.expires_at,i.status,p.name AS profile_name FROM kawmed_demo_invitations i JOIN medical_profiles p ON p.id=i.source_medical_profile_id WHERE lower(i.invited_email)=? AND i.status IN ('pending','active') AND i.expires_at>datetime('now') ORDER BY i.created_at DESC LIMIT 20").bind(email(actor.email)).all()
 return c.json({ok:true,data:(records.results||[]).map((i:any)=>({id:String(i.id),profile_name:String(i.profile_name),expires_at:String(i.expires_at),url:'/admin/medical/demo/i-'+String(i.id)}))})
})
app.get('/api/v1/me/kawmed/live-access/:token',async(c:any)=>{
 const actor:any=await sessionActor(c)
 if(!actor)return c.json({ok:false,error:'Unauthorized'},401)
 const grant:any=await liveGuestInvitation(c,String(actor.email),String(c.req.param('token')||''))
 if(!grant)return c.json({ok:false,error:'Invitación no disponible para esta cuenta.'},403)
 return c.json({ok:true,data:{medical_profile_id:grant.medical_profile_id,expires_at:grant.expires_at,guest_editor:true}})
})
app.post('/api/v1/me/kawmed/live-access/:token/activate',async(c:any)=>{
 const actor:any=await sessionActor(c)
 if(!actor)return c.json({ok:false,error:'Unauthorized'},401)
 const grant:any=await liveGuestInvitation(c,String(actor.email),String(c.req.param('token')||''))
 if(!grant)return deny(c)
 await c.env.DB.prepare("UPDATE kawmed_demo_invitations SET status='active',accepted_user_id=COALESCE(accepted_user_id,?),accepted_at=COALESCE(accepted_at,datetime('now')),updated_at=datetime('now') WHERE id=? AND status IN ('pending','active') AND datetime(expires_at)>datetime('now')").bind(String(actor.id),String(grant.id)).run()
 return c.json({ok:true,data:{medical_profile_id:grant.medical_profile_id}})
})
app.get('/api/v1/me/kawmed/demo/:token',async(c:any)=>{
 const actor=await user(c);if(!actor)return c.json({ok:false,error:'Unauthorized'},401)
 const row:any=await invitation(c,c.req.param('token'))
 if(!row||email(actor.email)!==email(row.invited_email)||['revoked','expired'].includes(row.status)||Date.parse(row.expires_at)<=Date.now())return deny(c)
 return c.json({ok:true,data:{invitation_id:row.id,expires_at:row.expires_at,profile:JSON.parse(row.sandbox_json),demo:true,permissions:{edit_profile:true,edit_credentials:false,publish:false,delete_account:false}}})
})
app.patch('/api/v1/me/kawmed/demo/:token',async(c:any)=>{
 const actor=await user(c);if(!actor)return c.json({ok:false,error:'Unauthorized'},401)
 const row:any=await invitation(c,c.req.param('token'))
 if(!row||email(actor.email)!==email(row.invited_email)||row.status==='revoked'||Date.parse(row.expires_at)<=Date.now())return deny(c)
 const b=await c.req.json().catch(()=>({}))
 const existing=JSON.parse(row.sandbox_json),allowed=['name','professional_prefix','specialty','subspecialty','bio','phone','whatsapp','city','province','organization']
 for(const k of allowed)if(Object.prototype.hasOwnProperty.call(b,k)){if(typeof b[k]!=='string')return c.json({ok:false,error:'Dato inválido.'},422);existing[k]=b[k].slice(0,700)}
 if(b.template!==undefined&&['classic','pastel'].includes(String(b.template)))existing.template=b.template
 if(b.palette!==undefined&&['aqua','lavender','mint','peach','sky'].includes(String(b.palette)))existing.palette=b.palette
 if(b.centers!==undefined){
   if(!Array.isArray(b.centers)||b.centers.length>20)return c.json({ok:false,error:'Máximo 20 centros de demostración.'},422)
   existing.centers=b.centers.map((x:any)=>({name:String(x.name||'').slice(0,120),address:String(x.address||'').slice(0,200),city:String(x.city||'').slice(0,80),province:String(x.province||'').slice(0,80),phone:String(x.phone||'').slice(0,40),map_url:String(x.map_url||'').slice(0,500)}))
 }
 if(b.schedules!==undefined){
   if(!Array.isArray(b.schedules)||b.schedules.length>50)return c.json({ok:false,error:'Máximo 50 horarios de demostración.'},422)
   existing.schedules=b.schedules.map((x:any)=>({day_of_week:Math.max(1,Math.min(7,Number(x.day_of_week)||1)),shift:String(x.shift||'').slice(0,60),start_time:/^\d{2}:\d{2}$/.test(String(x.start_time||''))?String(x.start_time):'08:00',end_time:/^\d{2}:\d{2}$/.test(String(x.end_time||''))?String(x.end_time):'12:00'}))
 }
 if(b.insurance_policy!==undefined){
   const policy=b.insurance_policy||{}
   if(!Array.isArray(policy.accepted)||!Array.isArray(policy.excluded)||policy.accepted.length>50||policy.excluded.length>50)return c.json({ok:false,error:'Seguros de demostración inválidos.'},422)
   existing.insurance_policy={accepted:policy.accepted.map((x:any)=>({insurance_name:String(x.insurance_name||'').slice(0,120)})),excluded:policy.excluded.map((x:any)=>({insurance_name:String(x.insurance_name||'').slice(0,120)}))}
 }
 if(b.sponsor_demo!==undefined){
   if(existing.demo_mode!=='sponsored'||!existing.sponsor_demo)return c.json({ok:false,error:'Esta demo no tiene patrocinio.'},403)
   const values=b.sponsor_demo||{}
   for(const key of ['cta_label','vademecum_label']){
     if(values[key]!==undefined){if(typeof values[key]!=='string')return c.json({ok:false,error:'Valor de patrocinio inválido.'},422);existing.sponsor_demo[key]=values[key].slice(0,120)}
   }
   // Sponsor ownership, target URLs and legal associations are immutable even in demo.
 }
 if(b.demo_agenda!==undefined){
   const agenda=b.demo_agenda
   if(!agenda||!Array.isArray(agenda.requests)||!Array.isArray(agenda.blocked_dates)||agenda.requests.length>30||agenda.blocked_dates.length>90)return c.json({ok:false,error:'Agenda de demostración inválida.'},422)
   const prior=Array.isArray(existing.demo_agenda?.requests)?existing.demo_agenda.requests:[]
   if(agenda.requests.some((x:any)=>!prior.some((old:any)=>old.id===x.id)))return c.json({ok:false,error:'No se permiten pacientes reales ni citas externas en la demo.'},422)
   existing.demo_agenda={requests:agenda.requests.map((x:any)=>{const original=prior.find((v:any)=>v.id===x.id);return {...original,status:['pending','confirmed','cancelled'].includes(x.status)?x.status:original.status}}),blocked_dates:agenda.blocked_dates.map((v:any)=>String(v).slice(0,10)).filter((v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v))}
 }
 const result=await c.env.DB.prepare("UPDATE kawmed_demo_invitations SET sandbox_json=?,status='active',accepted_user_id=COALESCE(accepted_user_id,?),accepted_at=COALESCE(accepted_at,datetime('now')),updated_at=datetime('now') WHERE id=? AND status IN ('pending','active') AND expires_at>datetime('now')").bind(JSON.stringify(existing),String(actor.id),row.id).run()
 if(!result.meta?.changes)return deny(c)
 return c.json({ok:true,data:{profile:existing}})
})
app.post('/api/v1/superadmin/kawmed/demo-invitations/:id/revoke',requireSuperAdmin('super_admin'),async(c:any)=>{
 await c.env.DB.prepare("UPDATE kawmed_demo_invitations SET status='revoked',updated_at=datetime('now') WHERE id=?").bind(c.req.param('id')).run()
 return c.json({ok:true})
})
