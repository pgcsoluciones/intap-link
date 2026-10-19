import app from './index'
import { sendWebPushToUser } from './pwa-push'
import { cookieNames } from './lib/cookies'
import {
  availableAppointmentSlots,
  changeAppointmentRequestStatus,
  confirmAppointmentRequest,
  createAppointmentBlock,
  createAppointmentRequest,
  ensureAppointmentSubject,
  getAppointmentAvailabilityRows,
  getAppointmentBlocks,
  getAppointmentCustomReasons,
  getAppointmentReasons,
  getAppointmentSettings,
  listAppointmentRequests,
  publicAppointmentConfig,
  saveAppointmentConfiguration,
} from './appointments-core'

async function sha256Hex(input:string){
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input))
  return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('')
}
function parseCookie(header:string,name:string){
  const escaped=name.replace(/[.*+?^$()|[\]\\]/g,'\\$&')
  const match=header.match(new RegExp('(?:^|;\\s*)'+escaped+'=([^;]*)'))
  return match?decodeURIComponent(match[1]):null
}
async function sessionUserId(c:any){
  const raw=parseCookie(c.req.header('Cookie')||'',cookieNames(c.env).session)
  if(!raw)return''
  const row=await c.env.DB.prepare("SELECT user_id FROM auth_sessions WHERE session_hash=? AND expires_at>datetime('now') AND revoked_at IS NULL LIMIT 1").bind(await sha256Hex(raw)).first()
  return row?String((row as any).user_id||''):''
}
async function requireUser(c:any,next:any){
  const userId=await sessionUserId(c)
  if(!userId)return c.json({ok:false,error:'Unauthorized'},401)
  c.set('userId',userId)
  await next()
}
const MEDICAL_DEFAULT_REASONS=[
  'Consulta médica',
  'Evaluación inicial',
  'Seguimiento / control',
  'Revisión de resultados',
  'Procedimiento / tratamiento',
  'Chequeo preventivo',
  'Otro',
]

async function ensureMedicalAppointmentDefaults(db:D1Database,subjectId:string){
  await ensureAppointmentSubject(db,'medical',subjectId)
  const settings=await db.prepare("SELECT reason_mode FROM appointment_settings WHERE subject_type='medical' AND subject_id=? LIMIT 1").bind(subjectId).first()
  const count=await db.prepare("SELECT COUNT(*) AS n FROM appointment_reasons WHERE subject_type='medical' AND subject_id=?").bind(subjectId).first()
  if(String((settings as any)?.reason_mode||'default')==='custom'&&Number((count as any)?.n||0)>0)return
  const statements:any[]=[
    db.prepare("UPDATE appointment_settings SET reason_mode='custom',updated_at=datetime('now') WHERE subject_type='medical' AND subject_id=?").bind(subjectId),
    db.prepare("DELETE FROM appointment_reasons WHERE subject_type='medical' AND subject_id=?").bind(subjectId),
  ]
  MEDICAL_DEFAULT_REASONS.forEach((label,index)=>statements.push(
    db.prepare("INSERT INTO appointment_reasons(id,subject_type,subject_id,label,enabled,sort_order) VALUES (?,?,?,?,1,?)")
      .bind(crypto.randomUUID(),'medical',subjectId,label,index)
  ))
  await db.batch(statements)
}

function safeExternalUrl(value:unknown){
  const raw=String(value??'').trim().slice(0,1200)
  if(!raw)return''
  try{
    const u=new URL(raw)
    return u.protocol==='https:'||u.protocol==='http:'?u.toString():''
  }catch{return''}
}
function sponsorCtaUrl(row:any){
  const type=String(row?.banner_cta_type||'none')
  const value=String(row?.banner_cta_value||'').trim()
  if(type==='sponsor_url')return safeExternalUrl(value||row?.website_url)
  if(type==='sponsor_whatsapp'){
    const digits=cleanPhone(value||row?.contact_whatsapp)
    return digits?'https://wa.me/'+digits:''
  }
  return safeExternalUrl(row?.website_url)
}
async function medicalSponsorContext(c:any,profileId:string){
  const row=await c.env.DB.prepare(`SELECT
      mps.vademecum_url,mps.vademecum_label,mps.enabled,mps.program_id,
      st.id AS sponsor_id,st.name,st.logo_url,st.banner_title,st.banner_image_url,
      st.banner_cta_label,st.banner_cta_type,st.banner_cta_value,st.website_url,
      st.contact_whatsapp,st.is_active,
      msp.private_banner_image_url,msp.private_cta_label,msp.private_cta_url,
      msp.vademecum_url AS program_vademecum_url,msp.vademecum_label AS program_vademecum_label,
      msp.representative_cta_label,msp.representative_message_template,
      mp.name AS medical_name,mp.professional_prefix,
      mr.id AS representative_id,mr.first_name AS representative_first_name,mr.last_name AS representative_last_name,
      mr.whatsapp AS representative_whatsapp,mr.email AS representative_email,mr.zone AS representative_zone
    FROM medical_profile_sponsors mps
    JOIN sponsor_tenants st ON st.id=mps.sponsor_id
    JOIN medical_profiles mp ON mp.id=mps.medical_profile_id
    LEFT JOIN medical_sponsor_programs msp ON msp.id=mps.program_id AND msp.enabled=1
    LEFT JOIN medical_access_codes mac ON mac.medical_profile_id=mps.medical_profile_id AND mac.status='claimed'
    LEFT JOIN medical_representatives mr ON mr.id=mac.current_representative_id AND mr.active=1
    WHERE mps.medical_profile_id=? AND mps.enabled=1 AND st.is_active=1
      AND (mps.program_id IS NULL OR msp.id IS NOT NULL)
    LIMIT 1`).bind(profileId).first().catch(()=>null)
  if(!row)return null
  const vademecumUrl=safeExternalUrl((row as any).program_vademecum_url||(row as any).vademecum_url)
  const privateCtaUrl=safeExternalUrl((row as any).private_cta_url)
  const representativeWhatsapp=cleanPhone((row as any).representative_whatsapp)
  const representativeName=[(row as any).representative_first_name,(row as any).representative_last_name].map(v=>String(v||'').trim()).filter(Boolean).join(' ')
  const medicalName=[(row as any).professional_prefix,(row as any).medical_name].map(v=>String(v||'').trim()).filter(Boolean).join(' ')
  const representativeTemplate=String((row as any).representative_message_template||'Hola {visitador}, soy {medico}. Te contacto desde mi panel KawMed y necesito información de {patrocinador}.')
  const representativeMessage=representativeTemplate
    .replace(/\{visitador\}/gi,representativeName||'')
    .replace(/\{medico\}/gi,medicalName||'')
    .replace(/\{patrocinador\}/gi,String((row as any).name||''))
  const representativeUrl=representativeWhatsapp?'https://wa.me/'+representativeWhatsapp+'?text='+encodeURIComponent(representativeMessage):''
  return{
    id:String((row as any).sponsor_id||''),
    program_id:String((row as any).program_id||''),
    name:String((row as any).name||''),
    logo_url:safeExternalUrl((row as any).logo_url),
    banner_title:String((row as any).banner_title||'').trim(),
    banner_image_url:safeExternalUrl((row as any).private_banner_image_url||(row as any).banner_image_url),
    cta_label:representativeUrl?(String((row as any).representative_cta_label||'Contactar visitador').trim()||'Contactar visitador'):(String((row as any).private_cta_label||(row as any).banner_cta_label||'Conocer más').trim()||'Conocer más'),
    cta_url:representativeUrl||privateCtaUrl||sponsorCtaUrl(row),
    representative:representativeUrl?{
      id:String((row as any).representative_id||''),
      name:representativeName,
      whatsapp:representativeWhatsapp,
      email:String((row as any).representative_email||''),
      zone:String((row as any).representative_zone||''),
      url:representativeUrl,
      label:String((row as any).representative_cta_label||'Mi visitador').trim()||'Mi visitador',
    }:null,
    vademecum_url:vademecumUrl,
    vademecum_label:String((row as any).program_vademecum_label||(row as any).vademecum_label||'Ver vademécum').trim()||'Ver vademécum',
  }
}

function cleanSlug(value:unknown){return String(value??'').trim().toLowerCase().replace(/^\/+|\/+$/g,'').replace(/[^a-z0-9-]/g,'').slice(0,80)}
function cleanPhone(value:unknown){let digits=String(value??'').replace(/\D/g,'').slice(0,15);if(digits.startsWith('00'))digits=digits.slice(2);if(digits.length===10&&/^(809|829|849)/.test(digits))digits='1'+digits;return digits}
function formatPhoneForMessage(value:unknown){
  const digits=cleanPhone(value),local=digits.length===11&&digits.startsWith('1')?digits.slice(1):digits
  if(local.length===10&&/^(809|829|849)/.test(local))return local.slice(0,3)+'-'+local.slice(3,6)+'-'+local.slice(6)
  return digits?('+'+digits):String(value??'').trim()
}
function humanDate(value:string){
  const[y,m,d]=value.split('-').map(Number)
  try{return new Intl.DateTimeFormat('es-DO',{timeZone:'UTC',weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(Date.UTC(y,m-1,d,12)))}catch{return value}
}
function humanTime(value:string){
  const[h,m]=value.split(':').map(Number)
  try{return new Intl.DateTimeFormat('es-DO',{timeZone:'UTC',hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(Date.UTC(2000,0,1,h,m)))}catch{return value}
}
function appointmentMessage(row:any,displayName:string){
  return [
    ['Hola '+displayName+', deseo solicitar una cita.','', 'Mi nombre es '+String(row.customer_name||'').trim()+'.','Mi teléfono es '+formatPhoneForMessage(row.customer_phone)+'.',...(String(row.customer_email||'').trim()?['Mi correo es '+String(row.customer_email||'').trim()+'.']:[])].join('\n'),
    ['Motivo:',String(row.reason_label||'Consulta médica')].join('\n'),
    ['Fecha solicitada:',humanDate(String(row.appointment_date||'')),'','Hora solicitada:',humanTime(String(row.start_time||''))].join('\n'),
    String(row.details||'').trim()?['Detalles:',String(row.details||'').trim()].join('\n'):'',
    'Quedo pendiente de su confirmación. Muchas gracias.',
  ].filter(Boolean).join('\n\n')
}
async function publicSubject(c:any,slug:string){
  return c.env.DB.prepare(`SELECT id,user_id,slug,name,professional_prefix,specialty,whatsapp,phone,status
    FROM medical_profiles WHERE lower(slug)=? AND status='active' LIMIT 1`).bind(slug).first()
}
async function ownedSubject(c:any){
  const userId=String(c.get('userId')||'')
  const profile=await c.env.DB.prepare(`SELECT id,user_id,slug,name,professional_prefix,specialty,whatsapp,phone,status
    FROM medical_profiles WHERE user_id=? ORDER BY created_at ASC LIMIT 1`).bind(userId).first()
  if(!profile)return null
  const subjectId=String((profile as any).id||'')
  await ensureMedicalAppointmentDefaults(c.env.DB,subjectId)
  return{profile,userId,subject:{type:'medical',id:subjectId,ownerUserId:userId}}
}
async function addNotification(c:any,request:any,profile:any){
  const ownerUserId=String((profile as any).user_id||'')
  if(!ownerUserId||ownerUserId==='kawmed_demo_owner')return
  const actionUrl='/admin/medical/agenda?request='+encodeURIComponent(String(request.id||''))
  const title='Nueva solicitud de cita'
  const message=String(request.customer_name||'Paciente')+' · '+String(request.reason_label||'Consulta')+' · '+humanDate(String(request.appointment_date||''))+' · '+humanTime(String(request.start_time||''))
  await c.env.DB.prepare("INSERT INTO user_notifications(id,user_id,profile_id,type,title,message,source_type,source_id,action_label,action_url,created_at) VALUES (?,?,NULL,'medical_appointment_request',?,?,'appointment_request',?,'Revisar solicitud',?,datetime('now'))").bind(crypto.randomUUID(),ownerUserId,title,message,String(request.id||''),actionUrl).run().catch(()=>undefined)
  const push=sendWebPushToUser(c.env,ownerUserId,{title,body:message,url:actionUrl,tag:'agenda:'+String(request.id||'')}).catch(()=>undefined)
  try{if(c.executionCtx?.waitUntil)c.executionCtx.waitUntil(push);else await push}catch{await push}
}
async function markRead(c:any,userId:string,requestId:string){
  await c.env.DB.prepare("UPDATE user_notifications SET read_at=COALESCE(read_at,datetime('now')) WHERE user_id=? AND source_type='appointment_request' AND source_id=?").bind(userId,requestId).run().catch(()=>undefined)
}

app.get('/api/v1/public/medical-profiles/:slug/appointments',async(c:any)=>{
  c.header('Cache-Control','no-store, max-age=0')
  const profile=await publicSubject(c,cleanSlug(c.req.param('slug')))
  if(!profile)return c.json({ok:false,error:'Perfil médico no encontrado.'},404)
  const id=String((profile as any).id||'')
  const config=await publicAppointmentConfig(c.env.DB,'medical',id)
  const whatsapp=cleanPhone((profile as any).whatsapp||(profile as any).phone)
  const name=[(profile as any).professional_prefix,(profile as any).name].filter(Boolean).join(' ')
  return c.json({ok:true,data:{...config,enabled:config.enabled&&Boolean(whatsapp),business_name:name,has_whatsapp:Boolean(whatsapp)}})
})
app.get('/api/v1/public/medical-profiles/:slug/appointments/availability',async(c:any)=>{
  c.header('Cache-Control','no-store, max-age=0')
  const profile=await publicSubject(c,cleanSlug(c.req.param('slug')))
  if(!profile)return c.json({ok:false,error:'Perfil médico no encontrado.'},404)
  const date=String(c.req.query('date')||'')
  const slots=await availableAppointmentSlots(c.env.DB,'medical',String((profile as any).id||''),date)
  return c.json({ok:true,data:{date,slots}})
})
app.post('/api/v1/public/medical-profiles/:slug/appointments',async(c:any)=>{
  const profile=await publicSubject(c,cleanSlug(c.req.param('slug')))
  if(!profile)return c.json({ok:false,error:'Perfil médico no encontrado.'},404)
  const ownerUserId=String((profile as any).user_id||''),whatsapp=cleanPhone((profile as any).whatsapp||(profile as any).phone)
  if(!ownerUserId||!whatsapp)return c.json({ok:false,error:'Este perfil todavía no puede recibir solicitudes de cita.'},409)
  let body:any={};try{body=await c.req.json()}catch{return c.json({ok:false,error:'Solicitud inválida.'},400)}
  try{
    const subject={type:'medical',id:String((profile as any).id),ownerUserId}
    const created=await createAppointmentRequest(c.env.DB,subject,body)
    const request=await c.env.DB.prepare('SELECT * FROM appointment_requests WHERE id=? LIMIT 1').bind(String((created as any).id)).first()
    if(!request)return c.json({ok:false,error:'No pudimos registrar la solicitud.'},500)
    if(!(created as any).duplicate)await addNotification(c,request,profile)
    const displayName=[(profile as any).professional_prefix,(profile as any).name].filter(Boolean).join(' ')
    return c.json({ok:true,data:{request_id:String((request as any).id),status:String((request as any).status),whatsapp_url:'https://wa.me/'+whatsapp+'?text='+encodeURIComponent(appointmentMessage(request,displayName))}},201)
  }catch(error){return c.json({ok:false,error:error instanceof Error?error.message:'No pudimos registrar la solicitud.'},400)}
})

app.get('/api/v1/me/medical-profile/sponsor-context',requireUser,async(c:any)=>{
  const resolved=await ownedSubject(c)
  if(!resolved)return c.json({ok:false,error:'Perfil médico no encontrado.'},404)
  const sponsor=await medicalSponsorContext(c,resolved.subject.id)
  return c.json({ok:true,data:sponsor})
})

app.get('/api/v1/me/medical-profile/appointments',requireUser,async(c:any)=>{
  const resolved=await ownedSubject(c)
  if(!resolved)return c.json({ok:false,error:'Perfil médico no encontrado.'},404)
  const s=resolved.subject,settings=await getAppointmentSettings(c.env.DB,s.type,s.id)
  const results=await Promise.all([
    getAppointmentAvailabilityRows(c.env.DB,s.type,s.id),
    getAppointmentReasons(c.env.DB,s.type,s.id,settings.reason_mode),
    getAppointmentReasons(c.env.DB,s.type,s.id,'default'),
    getAppointmentCustomReasons(c.env.DB,s.type,s.id),
    getAppointmentBlocks(c.env.DB,s.type,s.id),
    listAppointmentRequests(c.env.DB,s.type,s.id,100),
  ])
  const p=resolved.profile
  return c.json({ok:true,data:{settings,availability:results[0],reasons:results[1],default_reasons:results[2],custom_reasons:results[3],blocks:results[4],requests:results[5],profile:{id:s.id,username:String((p as any).slug||''),business_name:[(p as any).professional_prefix,(p as any).name].filter(Boolean).join(' ')}}})
})
app.put('/api/v1/me/medical-profile/appointments/settings',requireUser,async(c:any)=>{
  const resolved=await ownedSubject(c);if(!resolved)return c.json({ok:false,error:'Perfil médico no encontrado.'},404)
  let body:any={};try{body=await c.req.json()}catch{return c.json({ok:false,error:'JSON inválido.'},400)}
  try{await saveAppointmentConfiguration(c.env.DB,resolved.subject.type,resolved.subject.id,body);return c.json({ok:true})}
  catch(error){return c.json({ok:false,error:error instanceof Error?error.message:'No pudimos guardar la agenda.'},400)}
})
app.post('/api/v1/me/medical-profile/appointments/blocks',requireUser,async(c:any)=>{
  const resolved=await ownedSubject(c);if(!resolved)return c.json({ok:false,error:'Perfil médico no encontrado.'},404)
  let body:any={};try{body=await c.req.json()}catch{return c.json({ok:false,error:'JSON inválido.'},400)}
  try{return c.json({ok:true,data:{id:await createAppointmentBlock(c.env.DB,resolved.subject.type,resolved.subject.id,body)}},201)}
  catch(error){return c.json({ok:false,error:error instanceof Error?error.message:'No pudimos bloquear el horario.'},400)}
})
app.delete('/api/v1/me/medical-profile/appointments/blocks/:id',requireUser,async(c:any)=>{
  const resolved=await ownedSubject(c);if(!resolved)return c.json({ok:false,error:'Perfil médico no encontrado.'},404)
  await c.env.DB.prepare('DELETE FROM appointment_blocks WHERE id=? AND subject_type=? AND subject_id=?').bind(c.req.param('id'),resolved.subject.type,resolved.subject.id).run()
  return c.json({ok:true})
})
app.post('/api/v1/me/medical-profile/appointments/requests/:id/:action',requireUser,async(c:any)=>{
  const userId=String(c.get('userId')||''),requestId=String(c.req.param('id')||''),action=String(c.req.param('action')||'')
  const row=await c.env.DB.prepare("SELECT ar.subject_id,mp.id FROM appointment_requests ar JOIN medical_profiles mp ON mp.id=ar.subject_id WHERE ar.id=? AND ar.subject_type='medical' AND mp.user_id=? LIMIT 1").bind(requestId,userId).first()
  if(!row)return c.json({ok:false,error:'Solicitud no encontrada.'},404)
  const subjectId=String((row as any).subject_id||'')
  try{
    if(action==='confirm')await confirmAppointmentRequest(c.env.DB,'medical',subjectId,requestId)
    else if(action==='reject'||action==='release')await changeAppointmentRequestStatus(c.env.DB,'medical',subjectId,requestId,action as any)
    else return c.json({ok:false,error:'Acción inválida.'},400)
    await markRead(c,userId,requestId)
    const request=await c.env.DB.prepare('SELECT id,customer_name,customer_phone,customer_email,appointment_date,start_time,end_time,timezone,reason_label,details,status FROM appointment_requests WHERE id=? LIMIT 1').bind(requestId).first()
    return c.json({ok:true,data:request})
  }catch(error){return c.json({ok:false,error:error instanceof Error?error.message:'No pudimos actualizar la solicitud.'},409)}
})

app.get('/api/v1/me/medical-profile/appointments/public-context',requireUser,async(c:any)=>{
  const userId=String(c.get('userId')||''),slug=cleanSlug(c.req.query('username'))
  if(!slug)return c.json({ok:false,error:'Perfil inválido.'},400)
  const profile=await c.env.DB.prepare("SELECT id,slug,name,professional_prefix,user_id FROM medical_profiles WHERE lower(slug)=? AND user_id=? LIMIT 1").bind(slug,userId).first()
  if(!profile)return c.json({ok:false,error:'Not owner'},403)
  const subjectId=String((profile as any).id||'')
  await ensureMedicalAppointmentDefaults(c.env.DB,subjectId)
  const settings=await getAppointmentSettings(c.env.DB,'medical',subjectId)
  const rows=await c.env.DB.prepare("SELECT id,customer_name,customer_phone,customer_email,appointment_date,start_time,end_time,timezone,reason_label,details,status,created_at FROM appointment_requests WHERE subject_type='medical' AND subject_id=? AND status='pending' ORDER BY created_at DESC LIMIT 12").bind(subjectId).all()
  const count=await c.env.DB.prepare("SELECT COUNT(*) AS n FROM appointment_requests WHERE subject_type='medical' AND subject_id=? AND status='pending'").bind(subjectId).first()
  const sponsor=await medicalSponsorContext(c,subjectId)
  return c.json({ok:true,data:{
    is_owner:true,
    enabled:settings.enabled,
    pending_count:Number((count as any)?.n||0),
    pending:rows.results||[],
    manage_url:'/admin/medical/agenda',
    resource_url:sponsor?.vademecum_url||'',
    resource_label:sponsor?.vademecum_label||'Ver vademécum',
    contact_url:sponsor?.representative?.url||'',
    contact_label:sponsor?.representative?.label||'Mi visitador'
  }})
})

export default app
