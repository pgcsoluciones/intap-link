import app from './index'
import { cookieNames } from './lib/cookies'
import { resolveOwnedSponsoredProfile, sponsoredProfileScope } from './sponsored-profile-scope'
import {
  availableAppointmentSlots,
  changeAppointmentRequestStatus,
  confirmAppointmentRequest,
  createAppointmentBlock,
  createAppointmentRequest,
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
function cleanUsername(value:unknown){return String(value??'').trim().toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'').replace(/-+/g,'-').replace(/^-|-$/g,'')}
function cleanPhone(value:unknown){let digits=String(value??'').replace(/\D/g,'').slice(0,15);if(digits.startsWith('00'))digits=digits.slice(2);if(digits.length===10&&/^(809|829|849)/.test(digits))digits='1'+digits;return digits}
function humanDate(value:string,timeZone:string){
  const parts=value.split('-').map(Number),y=parts[0],m=parts[1],d=parts[2]
  try{return new Intl.DateTimeFormat('es-DO',{timeZone,weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(Date.UTC(y,m-1,d,12)))}
  catch{return value}
}
function humanTime(value:string){
  const parts=value.split(':').map(Number),h=parts[0],m=parts[1]
  try{return new Intl.DateTimeFormat('es-DO',{hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(2000,0,1,h,m))}
  catch{return value}
}
function appointmentMessage(row:any){
  const lines=[
    'Hola, mi nombre es '+String(row.customer_name||'').trim()+'.',
    'Mi teléfono es '+String(row.customer_phone||'').trim()+'.',
    ...(String(row.customer_email||'').trim()?['Mi correo es '+String(row.customer_email||'').trim()+'.']:[]),
    '',
    'Estoy interesado/a en agendar: '+String(row.reason_label||'Cita')+'.',
    '',
    'Fecha solicitada: '+humanDate(String(row.appointment_date||''),String(row.timezone||'America/Santo_Domingo'))+'.',
    'Hora solicitada: '+humanTime(String(row.start_time||''))+'.',
    ...(String(row.details||'').trim()?['','Detalles:',String(row.details||'').trim()]:[]),
    '',
    'Quedo atento/a a la confirmación de disponibilidad.',
  ]
  return lines.join('\n')
}
async function sponsoredPublicSubject(c:any,username:string){
  return c.env.DB.prepare("SELECT id,user_id,username,business_name,whatsapp,phone,status,profile_role FROM sponsored_profiles WHERE username=? AND status='published' LIMIT 1").bind(username).first()
}
async function ownedSubject(c:any){
  const userId=String(c.get('userId')||'')
  const profile=await resolveOwnedSponsoredProfile(c,userId,sponsoredProfileScope(c))
  if(!profile)return null
  return{profile,userId,subject:{type:'sponsored',id:String((profile as any).id||''),ownerUserId:userId}}
}
async function addAppointmentNotification(c:any,request:any,profile:any){
  const ownerUserId=String((profile as any).user_id||'')
  if(!ownerUserId)return
  const id=crypto.randomUUID()
  const profileId=String((profile as any).id||'')
  const isMaster=String((profile as any).profile_role||'')==='sponsor_owner'
  const actionUrl=(isMaster?'/admin/sponsored/agenda?scope=master&request=':'/admin/sponsored/agenda?profile_id='+encodeURIComponent(profileId)+'&request=')+encodeURIComponent(String(request.id||''))
  const title='Nueva solicitud de agenda'
  const message=String(request.customer_name||'Cliente')+' · '+String(request.reason_label||'Cita')+' · '+humanDate(String(request.appointment_date||''),String(request.timezone||'America/Santo_Domingo'))+' · '+humanTime(String(request.start_time||''))
  await c.env.DB.prepare("INSERT INTO user_notifications(id,user_id,profile_id,type,title,message,source_type,source_id,action_label,action_url,created_at) VALUES (?,?,NULL,'sponsored_appointment_request',?,?,'appointment_request',?,'Revisar solicitud',?,datetime('now'))").bind(id,ownerUserId,title,message,String(request.id||''),actionUrl).run().catch(()=>undefined)
}
async function markRequestNotificationRead(c:any,userId:string,requestId:string){
  await c.env.DB.prepare("UPDATE user_notifications SET read_at=COALESCE(read_at,datetime('now')) WHERE user_id=? AND source_type='appointment_request' AND source_id=?").bind(userId,requestId).run().catch(()=>undefined)
}

app.get('/api/v1/public/sponsored/:username/appointments',async(c:any)=>{
  const username=cleanUsername(c.req.param('username'))
  const profile=await sponsoredPublicSubject(c,username)
  if(!profile)return c.json({ok:false,error:'Perfil no encontrado.'},404)
  const config=await publicAppointmentConfig(c.env.DB,'sponsored',String((profile as any).id))
  const whatsapp=cleanPhone((profile as any).whatsapp||(profile as any).phone)
  return c.json({ok:true,data:{...config,enabled:config.enabled&&Boolean(whatsapp),business_name:String((profile as any).business_name||''),has_whatsapp:Boolean(whatsapp)}})
})

app.get('/api/v1/public/sponsored/:username/appointments/availability',async(c:any)=>{
  const username=cleanUsername(c.req.param('username')),date=String(c.req.query('date')||'')
  const profile=await sponsoredPublicSubject(c,username)
  if(!profile)return c.json({ok:false,error:'Perfil no encontrado.'},404)
  const slots=await availableAppointmentSlots(c.env.DB,'sponsored',String((profile as any).id),date)
  return c.json({ok:true,data:{date,slots}})
})

app.post('/api/v1/public/sponsored/:username/appointments',async(c:any)=>{
  const username=cleanUsername(c.req.param('username'))
  const profile=await sponsoredPublicSubject(c,username)
  if(!profile)return c.json({ok:false,error:'Perfil no encontrado.'},404)
  const ownerUserId=String((profile as any).user_id||'')
  const whatsapp=cleanPhone((profile as any).whatsapp||(profile as any).phone)
  if(!ownerUserId||!whatsapp)return c.json({ok:false,error:'Este perfil todavía no puede recibir solicitudes de agenda.'},409)
  let body:any={};try{body=await c.req.json()}catch{return c.json({ok:false,error:'Solicitud inválida.'},400)}
  try{
    const created=await createAppointmentRequest(c.env.DB,{type:'sponsored',id:String((profile as any).id),ownerUserId},body)
    const request=await c.env.DB.prepare('SELECT * FROM appointment_requests WHERE id=? LIMIT 1').bind(String((created as any).id)).first()
    if(!request)return c.json({ok:false,error:'No pudimos registrar la solicitud.'},500)
    if(!(created as any).duplicate)await addAppointmentNotification(c,request,profile)
    return c.json({ok:true,data:{request_id:String((request as any).id),status:String((request as any).status),whatsapp_url:'https://wa.me/'+whatsapp+'?text='+encodeURIComponent(appointmentMessage(request))}},201)
  }catch(error){return c.json({ok:false,error:error instanceof Error?error.message:'No pudimos registrar la solicitud.'},400)}
})

app.get('/api/v1/me/sponsored-profile/appointments',requireUser,async(c:any)=>{
  const resolved=await ownedSubject(c)
  if(!resolved)return c.json({ok:false,error:'Perfil patrocinado no encontrado.'},404)
  const subject=resolved.subject
  const settings=await getAppointmentSettings(c.env.DB,subject.type,subject.id)
  const results=await Promise.all([
    getAppointmentAvailabilityRows(c.env.DB,subject.type,subject.id),
    getAppointmentReasons(c.env.DB,subject.type,subject.id,settings.reason_mode),
    getAppointmentReasons(c.env.DB,subject.type,subject.id,'default'),
    getAppointmentCustomReasons(c.env.DB,subject.type,subject.id),
    getAppointmentBlocks(c.env.DB,subject.type,subject.id),
    listAppointmentRequests(c.env.DB,subject.type,subject.id,100),
  ])
  return c.json({ok:true,data:{settings,availability:results[0],reasons:results[1],default_reasons:results[2],custom_reasons:results[3],blocks:results[4],requests:results[5],profile:{id:subject.id,username:String((resolved.profile as any).username||''),business_name:String((resolved.profile as any).business_name||'')}}})
})

app.put('/api/v1/me/sponsored-profile/appointments/settings',requireUser,async(c:any)=>{
  const resolved=await ownedSubject(c)
  if(!resolved)return c.json({ok:false,error:'Perfil patrocinado no encontrado.'},404)
  let body:any={};try{body=await c.req.json()}catch{return c.json({ok:false,error:'JSON inválido.'},400)}
  try{await saveAppointmentConfiguration(c.env.DB,resolved.subject.type,resolved.subject.id,body);return c.json({ok:true})}
  catch(error){return c.json({ok:false,error:error instanceof Error?error.message:'No pudimos guardar la agenda.'},400)}
})

app.post('/api/v1/me/sponsored-profile/appointments/blocks',requireUser,async(c:any)=>{
  const resolved=await ownedSubject(c)
  if(!resolved)return c.json({ok:false,error:'Perfil patrocinado no encontrado.'},404)
  let body:any={};try{body=await c.req.json()}catch{return c.json({ok:false,error:'JSON inválido.'},400)}
  try{return c.json({ok:true,data:{id:await createAppointmentBlock(c.env.DB,resolved.subject.type,resolved.subject.id,body)}},201)}
  catch(error){return c.json({ok:false,error:error instanceof Error?error.message:'No pudimos bloquear el horario.'},400)}
})

app.delete('/api/v1/me/sponsored-profile/appointments/blocks/:id',requireUser,async(c:any)=>{
  const resolved=await ownedSubject(c)
  if(!resolved)return c.json({ok:false,error:'Perfil patrocinado no encontrado.'},404)
  await c.env.DB.prepare('DELETE FROM appointment_blocks WHERE id=? AND subject_type=? AND subject_id=?').bind(c.req.param('id'),resolved.subject.type,resolved.subject.id).run()
  return c.json({ok:true})
})

app.post('/api/v1/me/sponsored-profile/appointments/requests/:id/:action',requireUser,async(c:any)=>{
  const userId=String(c.get('userId')||''),requestId=String(c.req.param('id')||''),action=String(c.req.param('action')||'')
  const row=await c.env.DB.prepare("SELECT ar.subject_id,sp.id FROM appointment_requests ar JOIN sponsored_profiles sp ON sp.id=ar.subject_id WHERE ar.id=? AND ar.subject_type='sponsored' AND sp.user_id=? LIMIT 1").bind(requestId,userId).first()
  if(!row)return c.json({ok:false,error:'Solicitud no encontrada.'},404)
  const subjectId=String((row as any).subject_id||'')
  try{
    if(action==='confirm')await confirmAppointmentRequest(c.env.DB,'sponsored',subjectId,requestId)
    else if(action==='reject'||action==='release')await changeAppointmentRequestStatus(c.env.DB,'sponsored',subjectId,requestId,action as any)
    else return c.json({ok:false,error:'Acción inválida.'},400)
    await markRequestNotificationRead(c,userId,requestId)
    const request=await c.env.DB.prepare('SELECT id,customer_name,customer_phone,customer_email,appointment_date,start_time,end_time,timezone,reason_label,details,status FROM appointment_requests WHERE id=? LIMIT 1').bind(requestId).first()
    return c.json({ok:true,data:request})
  }catch(error){return c.json({ok:false,error:error instanceof Error?error.message:'No pudimos actualizar la solicitud.'},409)}
})

app.get('/api/v1/me/sponsored-profile/appointments/public-context',requireUser,async(c:any)=>{
  const userId=String(c.get('userId')||''),username=cleanUsername(c.req.query('username'))
  if(!username)return c.json({ok:false,error:'Perfil inválido.'},400)
  const profile=await c.env.DB.prepare('SELECT id,username,business_name,user_id,profile_role FROM sponsored_profiles WHERE username=? AND user_id=? LIMIT 1').bind(username,userId).first()
  if(!profile)return c.json({ok:false,error:'Not owner'},403)
  const subjectId=String((profile as any).id||'')
  const settings=await getAppointmentSettings(c.env.DB,'sponsored',subjectId)
  const rows=await c.env.DB.prepare("SELECT id,customer_name,customer_phone,customer_email,appointment_date,start_time,end_time,timezone,reason_label,details,status,created_at FROM appointment_requests WHERE subject_type='sponsored' AND subject_id=? AND status='pending' ORDER BY created_at DESC LIMIT 12").bind(subjectId).all()
  const count=await c.env.DB.prepare("SELECT COUNT(*) AS n FROM appointment_requests WHERE subject_type='sponsored' AND subject_id=? AND status='pending'").bind(subjectId).first()
  const pending=rows.results||[]
  const isMaster=String((profile as any).profile_role||'')==='sponsor_owner'
  const manageUrl=isMaster?'/admin/sponsored/agenda?scope=master':'/admin/sponsored/agenda?profile_id='+encodeURIComponent(subjectId)
  return c.json({ok:true,data:{is_owner:true,enabled:settings.enabled,pending_count:Number((count as any)?.n||0),pending,manage_url:manageUrl}})
})

export default app
