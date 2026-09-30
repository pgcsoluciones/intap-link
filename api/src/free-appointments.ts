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
function cleanSlug(value:unknown){return String(value??'').trim().toLowerCase().replace(/^\/+|\/+$/g,'')}
function cleanPhone(value:unknown){let digits=String(value??'').replace(/\D/g,'').slice(0,15);if(digits.startsWith('00'))digits=digits.slice(2);if(digits.length===10&&/^(809|829|849)/.test(digits))digits='1'+digits;return digits}
function parseTemplateData(value:any){
  if(value&&typeof value==='object'&&!Array.isArray(value))return {...value}
  try{const parsed=JSON.parse(String(value||'{}'));return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{}}catch{return{}}
}
function portfolioTitle(template:any){
  return String(template?.free_portfolio_title||template?.portfolio_section_title||'Portafolio').trim().slice(0,40)||'Portafolio'
}
function quoteVisible(template:any){return template?.free_quote_button_visible!==false}
function humanDate(value:string){
  const[y,m,d]=value.split('-').map(Number)
  try{return new Intl.DateTimeFormat('es-DO',{timeZone:'UTC',weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(Date.UTC(y,m-1,d,12)))}catch{return value}
}
function humanTime(value:string){
  const[h,m]=value.split(':').map(Number)
  try{return new Intl.DateTimeFormat('es-DO',{timeZone:'UTC',hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(Date.UTC(2000,0,1,h,m)))}catch{return value}
}
function appointmentMessage(row:any){
  return [
    ['Hola, mi nombre es '+String(row.customer_name||'').trim()+'.','Mi teléfono es '+String(row.customer_phone||'').trim()+'.',...(String(row.customer_email||'').trim()?['Mi correo es '+String(row.customer_email||'').trim()+'.']:[])].join('\n'),
    ['Estoy interesado/a en agendar:',String(row.reason_label||'Cita')].join('\n'),
    ['Fecha solicitada:',humanDate(String(row.appointment_date||'')),'','Hora solicitada:',humanTime(String(row.start_time||''))].join('\n'),
    String(row.details||'').trim()?['Detalles:',String(row.details||'').trim()].join('\n'):'',
    'Quedo atento/a a la confirmación de disponibilidad.',
  ].filter(Boolean).join('\n\n')
}
const DAY_LABELS=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
const DEFAULT_FREE_SCHEDULE=[{day:'Lunes a Viernes',hours:'8:00 AM - 6:00 PM'},{day:'Sábados',hours:'9:00 AM - 1:00 PM'}]
function cleanSchedule(value:any){
  if(!Array.isArray(value))return[]
  return value.slice(0,7).map((item:any)=>({
    day:String(item?.day||'').trim().slice(0,40),
    hours:String(item?.hours||'').trim().slice(0,60),
  })).filter((item:any)=>item.day&&item.hours)
}
function freeSchedule(template:any){
  if(template?.free_schedule_configured===true)return cleanSchedule(template?.free_schedule)
  return DEFAULT_FREE_SCHEDULE
}
function publicSchedule(rows:any[]){
  const groups=new Map<number,string[]>()
  for(const row of rows){
    if(Number(row.enabled||0)!==1)continue
    const day=Number(row.weekday)
    if(day<0||day>6)continue
    const list=groups.get(day)||[]
    list.push(humanTime(String(row.start_time||''))+' – '+humanTime(String(row.end_time||'')))
    groups.set(day,list)
  }
  return Array.from(groups.entries()).sort((a,b)=>a[0]-b[0]).map(([day,hours])=>({day:DAY_LABELS[day],hours:hours.join(' · ')}))
}
async function ownedFreeProfile(c:any,userId:string){
  return c.env.DB.prepare("SELECT id,user_id,slug,name,template_data FROM profiles WHERE user_id=? AND lower(COALESCE(plan_id,'free'))='free' ORDER BY created_at ASC LIMIT 1").bind(userId).first()
}
async function publicFreeProfile(c:any,slug:string){
  const profile=await c.env.DB.prepare(`SELECT id,user_id,slug,name,template_data,plan_id,is_published
    FROM profiles
    WHERE lower(slug)=? AND lower(COALESCE(plan_id,'free'))='free' AND COALESCE(is_published,0)=1
    LIMIT 1`).bind(slug).first()
  if(!profile)return null
  const contact=await c.env.DB.prepare('SELECT whatsapp,phone,email FROM profile_contact WHERE profile_id=? LIMIT 1').bind(String((profile as any).id||'')).first().catch(()=>null)
  return {...(profile as any),whatsapp:(contact as any)?.whatsapp??null,phone:(contact as any)?.phone??null,email:(contact as any)?.email??null}
}
async function ownerContext(c:any){
  const userId=String(c.get('userId')||'')
  const profile=await ownedFreeProfile(c,userId)
  if(!profile)return null
  const id=String((profile as any).id||'')
  await ensureAppointmentSubject(c.env.DB,'free',id)
  return{userId,profile,subject:{type:'free',id,ownerUserId:userId}}
}
async function addNotification(c:any,request:any,profile:any){
  const userId=String((profile as any).user_id||'')
  if(!userId)return
  const actionUrl='/admin/free/agenda?request='+encodeURIComponent(String(request.id||''))
  const title='Nueva solicitud de agenda'
  const message=String(request.customer_name||'Cliente')+' · '+String(request.reason_label||'Cita')+' · '+humanDate(String(request.appointment_date||''))+' · '+humanTime(String(request.start_time||''))
  await c.env.DB.prepare("INSERT INTO user_notifications(id,user_id,profile_id,type,title,message,source_type,source_id,action_label,action_url,created_at) VALUES (?,?,?,'free_appointment_request',?,?,'appointment_request',?,'Revisar solicitud',?,datetime('now'))").bind(crypto.randomUUID(),userId,String((profile as any).id||''),title,message,String(request.id||''),actionUrl).run().catch(()=>undefined)
  const push=sendWebPushToUser(c.env,userId,{title,body:message,url:actionUrl,tag:'agenda:'+String(request.id||'')}).catch(()=>undefined)
  try{
    if(c.executionCtx?.waitUntil)c.executionCtx.waitUntil(push)
    else await push
  }catch{await push}
}
async function markRead(c:any,userId:string,requestId:string){
  await c.env.DB.prepare("UPDATE user_notifications SET read_at=COALESCE(read_at,datetime('now')) WHERE user_id=? AND source_type='appointment_request' AND source_id=?").bind(userId,requestId).run().catch(()=>undefined)
}

app.get('/api/v1/public/profiles/:slug/appointments',async(c:any)=>{
  c.header('Cache-Control','no-store, max-age=0')
  const profile=await publicFreeProfile(c,cleanSlug(c.req.param('slug')))
  if(!profile)return c.json({ok:false,error:'Perfil no encontrado.'},404)
  const id=String((profile as any).id||'')
  const config=await publicAppointmentConfig(c.env.DB,'free',id)
  const whatsapp=cleanPhone((profile as any).whatsapp||(profile as any).phone)
  return c.json({ok:true,data:{...config,enabled:config.enabled&&Boolean(whatsapp),business_name:String((profile as any).name||''),has_whatsapp:Boolean(whatsapp)}})
})
app.get('/api/v1/public/profiles/:slug/appointments/availability',async(c:any)=>{
  c.header('Cache-Control','no-store, max-age=0')
  const profile=await publicFreeProfile(c,cleanSlug(c.req.param('slug')))
  if(!profile)return c.json({ok:false,error:'Perfil no encontrado.'},404)
  const date=String(c.req.query('date')||'')
  const slots=await availableAppointmentSlots(c.env.DB,'free',String((profile as any).id||''),date)
  return c.json({ok:true,data:{date,slots}})
})
app.post('/api/v1/public/profiles/:slug/appointments',async(c:any)=>{
  const profile=await publicFreeProfile(c,cleanSlug(c.req.param('slug')))
  if(!profile)return c.json({ok:false,error:'Perfil no encontrado.'},404)
  const ownerUserId=String((profile as any).user_id||''),whatsapp=cleanPhone((profile as any).whatsapp||(profile as any).phone)
  if(!ownerUserId||!whatsapp)return c.json({ok:false,error:'Este perfil todavía no puede recibir solicitudes de agenda.'},409)
  let body:any={};try{body=await c.req.json()}catch{return c.json({ok:false,error:'Solicitud inválida.'},400)}
  try{
    const created=await createAppointmentRequest(c.env.DB,{type:'free',id:String((profile as any).id),ownerUserId},body)
    const request=await c.env.DB.prepare('SELECT * FROM appointment_requests WHERE id=? LIMIT 1').bind(String((created as any).id)).first()
    if(!request)return c.json({ok:false,error:'No pudimos registrar la solicitud.'},500)
    if(!(created as any).duplicate)await addNotification(c,request,profile)
    return c.json({ok:true,data:{request_id:String((request as any).id),status:String((request as any).status),whatsapp_url:'https://wa.me/'+whatsapp+'?text='+encodeURIComponent(appointmentMessage(request))}},201)
  }catch(error){return c.json({ok:false,error:error instanceof Error?error.message:'No pudimos registrar la solicitud.'},400)}
})

app.get('/api/v1/me/free/experience',requireUser,async(c:any)=>{
  const resolved=await ownerContext(c)
  if(!resolved)return c.json({ok:false,error:'Perfil Free no encontrado.'},404)
  const template=parseTemplateData((resolved.profile as any).template_data)
  const settings=await getAppointmentSettings(c.env.DB,'free',resolved.subject.id,false)
  return c.json({ok:true,data:{
    quote_button_visible:quoteVisible(template),
    appointment_enabled:settings.enabled,
    portfolio_title:portfolioTitle(template),
    schedule:freeSchedule(template),
  }})
})
app.patch('/api/v1/me/free/experience',requireUser,async(c:any)=>{
  const resolved=await ownerContext(c)
  if(!resolved)return c.json({ok:false,error:'Perfil Free no encontrado.'},404)
  let body:any={};try{body=await c.req.json()}catch{return c.json({ok:false,error:'JSON inválido.'},400)}
  const template=parseTemplateData((resolved.profile as any).template_data)
  const currentSettings=await getAppointmentSettings(c.env.DB,'free',resolved.subject.id,false)
  const nextQuote=body.quote_button_visible===undefined?quoteVisible(template):body.quote_button_visible===true
  const nextAgenda=body.appointment_enabled===undefined?currentSettings.enabled:body.appointment_enabled===true
  if(!nextQuote&&!nextAgenda)return c.json({ok:false,error:'Debes mantener visible al menos Cotizar / información o Agendar.'},422)
  if(body.portfolio_title!==undefined)template.free_portfolio_title=String(body.portfolio_title||'').trim().slice(0,40)||'Portafolio'
  if(body.quote_button_visible!==undefined)template.free_quote_button_visible=nextQuote
  if(body.schedule!==undefined){template.free_schedule=cleanSchedule(body.schedule);template.free_schedule_configured=true}
  const statements:any[]=[
    c.env.DB.prepare("UPDATE profiles SET template_data=?,updated_at=datetime('now') WHERE id=?").bind(JSON.stringify(template),resolved.subject.id),
  ]
  if(body.appointment_enabled!==undefined)statements.push(c.env.DB.prepare("UPDATE appointment_settings SET enabled=?,updated_at=datetime('now') WHERE subject_type='free' AND subject_id=?").bind(nextAgenda?1:0,resolved.subject.id))
  await c.env.DB.batch(statements)
  return c.json({ok:true,data:{quote_button_visible:nextQuote,appointment_enabled:nextAgenda,portfolio_title:portfolioTitle(template),schedule:freeSchedule(template)}})
})

app.get('/api/v1/me/free/appointments',requireUser,async(c:any)=>{
  const resolved=await ownerContext(c)
  if(!resolved)return c.json({ok:false,error:'Perfil Free no encontrado.'},404)
  const settings=await getAppointmentSettings(c.env.DB,'free',resolved.subject.id)
  const results=await Promise.all([
    getAppointmentAvailabilityRows(c.env.DB,'free',resolved.subject.id),
    getAppointmentReasons(c.env.DB,'free',resolved.subject.id,settings.reason_mode),
    getAppointmentReasons(c.env.DB,'free',resolved.subject.id,'default'),
    getAppointmentCustomReasons(c.env.DB,'free',resolved.subject.id),
    getAppointmentBlocks(c.env.DB,'free',resolved.subject.id),
    listAppointmentRequests(c.env.DB,'free',resolved.subject.id,100),
  ])
  return c.json({ok:true,data:{settings,availability:results[0],reasons:results[1],default_reasons:results[2],custom_reasons:results[3],blocks:results[4],requests:results[5],profile:{id:resolved.subject.id,username:String((resolved.profile as any).slug||''),business_name:String((resolved.profile as any).name||'')}}})
})
app.put('/api/v1/me/free/appointments/settings',requireUser,async(c:any)=>{
  const resolved=await ownerContext(c)
  if(!resolved)return c.json({ok:false,error:'Perfil Free no encontrado.'},404)
  let body:any={};try{body=await c.req.json()}catch{return c.json({ok:false,error:'JSON inválido.'},400)}
  if(body?.enabled===false){
    const template=parseTemplateData((resolved.profile as any).template_data)
    if(!quoteVisible(template))return c.json({ok:false,error:'No puedes desactivar Agenda mientras Cotizar / información esté oculto. Activa Cotizar primero.'},422)
  }
  try{await saveAppointmentConfiguration(c.env.DB,'free',resolved.subject.id,body);return c.json({ok:true})}
  catch(error){return c.json({ok:false,error:error instanceof Error?error.message:'No pudimos guardar la agenda.'},400)}
})
app.post('/api/v1/me/free/appointments/blocks',requireUser,async(c:any)=>{
  const resolved=await ownerContext(c);if(!resolved)return c.json({ok:false,error:'Perfil Free no encontrado.'},404)
  let body:any={};try{body=await c.req.json()}catch{return c.json({ok:false,error:'JSON inválido.'},400)}
  try{return c.json({ok:true,data:{id:await createAppointmentBlock(c.env.DB,'free',resolved.subject.id,body)}},201)}
  catch(error){return c.json({ok:false,error:error instanceof Error?error.message:'No pudimos bloquear el horario.'},400)}
})
app.delete('/api/v1/me/free/appointments/blocks/:id',requireUser,async(c:any)=>{
  const resolved=await ownerContext(c);if(!resolved)return c.json({ok:false,error:'Perfil Free no encontrado.'},404)
  await c.env.DB.prepare("DELETE FROM appointment_blocks WHERE id=? AND subject_type='free' AND subject_id=?").bind(c.req.param('id'),resolved.subject.id).run()
  return c.json({ok:true})
})
app.post('/api/v1/me/free/appointments/requests/:id/:action',requireUser,async(c:any)=>{
  const userId=String(c.get('userId')||''),requestId=String(c.req.param('id')||''),action=String(c.req.param('action')||'')
  const row=await c.env.DB.prepare("SELECT ar.subject_id,p.id FROM appointment_requests ar JOIN profiles p ON p.id=ar.subject_id WHERE ar.id=? AND ar.subject_type='free' AND p.user_id=? LIMIT 1").bind(requestId,userId).first()
  if(!row)return c.json({ok:false,error:'Solicitud no encontrada.'},404)
  const subjectId=String((row as any).subject_id||'')
  try{
    if(action==='confirm')await confirmAppointmentRequest(c.env.DB,'free',subjectId,requestId)
    else if(action==='reject'||action==='release')await changeAppointmentRequestStatus(c.env.DB,'free',subjectId,requestId,action as any)
    else return c.json({ok:false,error:'Acción inválida.'},400)
    await markRead(c,userId,requestId)
    const request=await c.env.DB.prepare('SELECT id,customer_name,customer_phone,customer_email,appointment_date,start_time,end_time,timezone,reason_label,details,status FROM appointment_requests WHERE id=? LIMIT 1').bind(requestId).first()
    return c.json({ok:true,data:request})
  }catch(error){return c.json({ok:false,error:error instanceof Error?error.message:'No pudimos actualizar la solicitud.'},409)}
})


app.get('/api/v1/me/free/appointments/public-context',requireUser,async(c:any)=>{
  const userId=String(c.get('userId')||''),slug=cleanSlug(c.req.query('username'))
  if(!slug)return c.json({ok:false,error:'Perfil inválido.'},400)
  const profile=await c.env.DB.prepare("SELECT id,slug,name,user_id FROM profiles WHERE lower(slug)=? AND user_id=? AND lower(COALESCE(plan_id,'free'))='free' LIMIT 1").bind(slug,userId).first()
  if(!profile)return c.json({ok:false,error:'Not owner'},403)
  const subjectId=String((profile as any).id||'')
  const settings=await getAppointmentSettings(c.env.DB,'free',subjectId)
  const rows=await c.env.DB.prepare("SELECT id,customer_name,customer_phone,customer_email,appointment_date,start_time,end_time,timezone,reason_label,details,status,created_at FROM appointment_requests WHERE subject_type='free' AND subject_id=? AND status='pending' ORDER BY created_at DESC LIMIT 12").bind(subjectId).all()
  const count=await c.env.DB.prepare("SELECT COUNT(*) AS n FROM appointment_requests WHERE subject_type='free' AND subject_id=? AND status='pending'").bind(subjectId).first()
  return c.json({ok:true,data:{is_owner:true,enabled:settings.enabled,pending_count:Number((count as any)?.n||0),pending:rows.results||[],manage_url:'/admin/free/agenda'}})
})

export default app
