export type AppointmentSubject={type:string;id:string;ownerUserId:string}
export type AppointmentSettings={
  enabled:boolean
  slot_minutes:number
  min_notice_minutes:number
  horizon_days:number
  timezone:string
  reason_mode:'default'|'custom'
}

export const DEFAULT_APPOINTMENT_REASONS=[
  {code:'visit',label:'Visita'},
  {code:'call',label:'Llamada'},
  {code:'meeting',label:'Reunión / cita'},
  {code:'check',label:'Evaluación / chequeo'},
  {code:'purchase',label:'Compra / retiro'},
  {code:'service',label:'Servicio / atención'},
  {code:'other',label:'Otro'},
] as const

const DEFAULT_AVAILABILITY=[
  {weekday:1,start_time:'08:00',end_time:'18:00'},
  {weekday:2,start_time:'08:00',end_time:'18:00'},
  {weekday:3,start_time:'08:00',end_time:'18:00'},
  {weekday:4,start_time:'08:00',end_time:'18:00'},
  {weekday:5,start_time:'08:00',end_time:'18:00'},
  {weekday:6,start_time:'09:00',end_time:'13:00'},
]

export function cleanAppointmentText(value:unknown,max=500){return String(value??'').trim().slice(0,max)}
export function validAppointmentDate(value:unknown){
  const text=String(value??'')
  if(!/^\d{4}-\d{2}-\d{2}$/.test(text))return false
  const date=new Date(text+'T12:00:00Z')
  return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===text
}
export function validAppointmentTime(value:unknown){
  const text=String(value??'')
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(text))return false
  return true
}
function timeMinutes(value:string){const[h,m]=value.split(':').map(Number);return h*60+m}
function minutesTime(value:number){const h=Math.floor(value/60),m=value%60;return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')}
function weekdayOf(date:string){return new Date(date+'T12:00:00Z').getUTCDay()}
function addDays(date:string,days:number){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}
function zonedParts(epoch:number,timeZone:string){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(epoch))
  const get=(type:string)=>Number(parts.find(p=>p.type===type)?.value||0)
  return{year:get('year'),month:get('month'),day:get('day'),hour:get('hour'),minute:get('minute'),second:get('second')}
}
function zonedEpoch(date:string,time:string,timeZone:string){
  const[y,m,d]=date.split('-').map(Number),[h,mi]=time.split(':').map(Number)
  const target=Date.UTC(y,m-1,d,h,mi,0)
  let guess=target
  for(let i=0;i<3;i++){
    const p=zonedParts(guess,timeZone)
    const represented=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second)
    guess+=target-represented
  }
  return guess
}
function localDateNow(timeZone:string){
  const p=zonedParts(Date.now(),timeZone)
  return String(p.year).padStart(4,'0')+'-'+String(p.month).padStart(2,'0')+'-'+String(p.day).padStart(2,'0')
}
function overlaps(aStart:string,aEnd:string,bStart:string,bEnd:string){return aStart<bEnd&&aEnd>bStart}
function bool(v:any){return Number(v||0)===1}

export async function ensureAppointmentSubject(db:D1Database,subjectType:string,subjectId:string){
  await db.prepare(`INSERT OR IGNORE INTO appointment_settings(subject_type,subject_id) VALUES (?,?)`).bind(subjectType,subjectId).run()
  const count=await db.prepare(`SELECT COUNT(*) AS n FROM appointment_availability WHERE subject_type=? AND subject_id=?`).bind(subjectType,subjectId).first()
  if(Number((count as any)?.n||0)===0){
    await db.batch(DEFAULT_AVAILABILITY.map((row,index)=>db.prepare(`INSERT INTO appointment_availability(id,subject_type,subject_id,weekday,start_time,end_time,enabled,sort_order) VALUES (?,?,?,?,?,?,1,?)`).bind(crypto.randomUUID(),subjectType,subjectId,row.weekday,row.start_time,row.end_time,index)))
  }
}

export async function getAppointmentSettings(db:D1Database,subjectType:string,subjectId:string):Promise<AppointmentSettings>{
  await ensureAppointmentSubject(db,subjectType,subjectId)
  const row=await db.prepare(`SELECT enabled,slot_minutes,min_notice_minutes,horizon_days,timezone,reason_mode FROM appointment_settings WHERE subject_type=? AND subject_id=? LIMIT 1`).bind(subjectType,subjectId).first()
  return{
    enabled:bool((row as any)?.enabled),
    slot_minutes:Number((row as any)?.slot_minutes||30),
    min_notice_minutes:Number((row as any)?.min_notice_minutes||120),
    horizon_days:Number((row as any)?.horizon_days||30),
    timezone:String((row as any)?.timezone||'America/Santo_Domingo'),
    reason_mode:String((row as any)?.reason_mode||'default')==='custom'?'custom':'default',
  }
}

export async function getAppointmentReasons(db:D1Database,subjectType:string,subjectId:string,mode:'default'|'custom'){
  if(mode==='default')return DEFAULT_APPOINTMENT_REASONS.map((item,index)=>({id:'system:'+item.code,code:item.code,label:item.label,enabled:true,sort_order:index}))
  const rows=await db.prepare(`SELECT id,label,enabled,sort_order FROM appointment_reasons WHERE subject_type=? AND subject_id=? ORDER BY sort_order ASC,created_at ASC`).bind(subjectType,subjectId).all()
  return (rows.results||[]).map((row:any)=>({id:String(row.id),code:'custom',label:String(row.label||''),enabled:bool(row.enabled),sort_order:Number(row.sort_order||0)}))
}

export async function getAppointmentAvailabilityRows(db:D1Database,subjectType:string,subjectId:string){
  await ensureAppointmentSubject(db,subjectType,subjectId)
  const rows=await db.prepare(`SELECT id,weekday,start_time,end_time,enabled,sort_order FROM appointment_availability WHERE subject_type=? AND subject_id=? ORDER BY weekday ASC,sort_order ASC,start_time ASC`).bind(subjectType,subjectId).all()
  return rows.results||[]
}

export async function getAppointmentBlocks(db:D1Database,subjectType:string,subjectId:string,fromDate?:string){
  const from=validAppointmentDate(fromDate)?String(fromDate):'0000-00-00'
  const rows=await db.prepare(`SELECT id,block_date,start_time,end_time,note,created_at FROM appointment_blocks WHERE subject_type=? AND subject_id=? AND block_date>=? ORDER BY block_date ASC,start_time ASC`).bind(subjectType,subjectId,from).all()
  return rows.results||[]
}

export async function availableAppointmentSlots(db:D1Database,subjectType:string,subjectId:string,date:string){
  const settings=await getAppointmentSettings(db,subjectType,subjectId)
  if(!settings.enabled||!validAppointmentDate(date))return[]
  const today=localDateNow(settings.timezone)
  if(date<today||date>addDays(today,settings.horizon_days))return[]
  const weekday=weekdayOf(date)
  const windows=await db.prepare(`SELECT start_time,end_time FROM appointment_availability WHERE subject_type=? AND subject_id=? AND weekday=? AND enabled=1 ORDER BY sort_order ASC,start_time ASC`).bind(subjectType,subjectId,weekday).all()
  const blocks=await db.prepare(`SELECT start_time,end_time FROM appointment_blocks WHERE subject_type=? AND subject_id=? AND block_date=?`).bind(subjectType,subjectId,date).all()
  const confirmed=await db.prepare(`SELECT start_time,end_time FROM appointment_requests WHERE subject_type=? AND subject_id=? AND appointment_date=? AND status='confirmed'`).bind(subjectType,subjectId,date).all()
  const blocked=(blocks.results||[]) as any[],booked=(confirmed.results||[]) as any[]
  const slots:{time:string;end_time:string}[]=[]
  for(const window of windows.results||[]){
    const start=String((window as any).start_time||''),end=String((window as any).end_time||'')
    if(!validAppointmentTime(start)||!validAppointmentTime(end))continue
    for(let minute=timeMinutes(start);minute+settings.slot_minutes<=timeMinutes(end);minute+=settings.slot_minutes){
      const slotStart=minutesTime(minute),slotEnd=minutesTime(minute+settings.slot_minutes)
      const manuallyBlocked=blocked.some((item:any)=>{
        const bs=String(item.start_time||''),be=String(item.end_time||'')
        if(!bs&&!be)return true
        return validAppointmentTime(bs)&&validAppointmentTime(be)&&overlaps(slotStart,slotEnd,bs,be)
      })
      if(manuallyBlocked)continue
      if(booked.some((item:any)=>overlaps(slotStart,slotEnd,String(item.start_time||''),String(item.end_time||''))))continue
      const startEpoch=zonedEpoch(date,slotStart,settings.timezone)
      if(startEpoch-Date.now()<settings.min_notice_minutes*60000)continue
      slots.push({time:slotStart,end_time:slotEnd})
    }
  }
  return slots
}

export async function publicAppointmentConfig(db:D1Database,subjectType:string,subjectId:string){
  const settings=await getAppointmentSettings(db,subjectType,subjectId)
  const today=localDateNow(settings.timezone)
  const reasons=(await getAppointmentReasons(db,subjectType,subjectId,settings.reason_mode)).filter((item:any)=>item.enabled)
  return{
    enabled:settings.enabled,
    slot_minutes:settings.slot_minutes,
    min_notice_minutes:settings.min_notice_minutes,
    horizon_days:settings.horizon_days,
    timezone:settings.timezone,
    min_date:today,
    max_date:addDays(today,settings.horizon_days),
    reasons,
  }
}

export async function saveAppointmentConfiguration(db:D1Database,subjectType:string,subjectId:string,body:any){
  await ensureAppointmentSubject(db,subjectType,subjectId)
  const slot=[15,30,45,60].includes(Number(body?.slot_minutes))?Number(body.slot_minutes):30
  const notice=Math.max(0,Math.min(10080,Number(body?.min_notice_minutes)||0))
  const horizon=Math.max(1,Math.min(90,Number(body?.horizon_days)||30))
  const timezone=cleanAppointmentText(body?.timezone||'America/Santo_Domingo',80)||'America/Santo_Domingo'
  try{new Intl.DateTimeFormat('en',{timeZone:timezone}).format(new Date())}catch{throw new Error('Zona horaria inválida.')}
  const reasonMode=body?.reason_mode==='custom'?'custom':'default'
  const availability=(Array.isArray(body?.availability)?body.availability:[]).slice(0,28).map((item:any,index:number)=>({
    weekday:Number(item?.weekday),start_time:String(item?.start_time||''),end_time:String(item?.end_time||''),enabled:item?.enabled!==false,sort_order:index,
  })).filter((item:any)=>item.weekday>=0&&item.weekday<=6&&validAppointmentTime(item.start_time)&&validAppointmentTime(item.end_time)&&timeMinutes(item.start_time)<timeMinutes(item.end_time))
  if(!availability.length)throw new Error('Define al menos un horario disponible.')
  const reasons=(Array.isArray(body?.reasons)?body.reasons:[]).slice(0,20).map((item:any,index:number)=>({label:cleanAppointmentText(item?.label,80),enabled:item?.enabled!==false,sort_order:index})).filter((item:any)=>item.label)
  if(reasonMode==='custom'&&!reasons.some((item:any)=>item.enabled))throw new Error('Activa al menos un motivo de agenda personalizado.')

  const statements:any[]=[
    db.prepare(`UPDATE appointment_settings SET enabled=?,slot_minutes=?,min_notice_minutes=?,horizon_days=?,timezone=?,reason_mode=?,updated_at=datetime('now') WHERE subject_type=? AND subject_id=?`).bind(body?.enabled===true?1:0,slot,notice,horizon,timezone,reasonMode,subjectType,subjectId),
    db.prepare(`DELETE FROM appointment_availability WHERE subject_type=? AND subject_id=?`).bind(subjectType,subjectId),
    db.prepare(`DELETE FROM appointment_reasons WHERE subject_type=? AND subject_id=?`).bind(subjectType,subjectId),
  ]
  availability.forEach((item:any)=>statements.push(db.prepare(`INSERT INTO appointment_availability(id,subject_type,subject_id,weekday,start_time,end_time,enabled,sort_order) VALUES (?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),subjectType,subjectId,item.weekday,item.start_time,item.end_time,item.enabled?1:0,item.sort_order)))
  if(reasonMode==='custom')reasons.forEach((item:any)=>statements.push(db.prepare(`INSERT INTO appointment_reasons(id,subject_type,subject_id,label,enabled,sort_order) VALUES (?,?,?,?,?,?)`).bind(crypto.randomUUID(),subjectType,subjectId,item.label,item.enabled?1:0,item.sort_order)))
  await db.batch(statements)
}

export async function createAppointmentBlock(db:D1Database,subjectType:string,subjectId:string,body:any){
  const date=String(body?.block_date||'')
  if(!validAppointmentDate(date))throw new Error('Fecha inválida.')
  const start=body?.start_time?String(body.start_time):'',end=body?.end_time?String(body.end_time):''
  if((start||end)&&(!validAppointmentTime(start)||!validAppointmentTime(end)||timeMinutes(start)>=timeMinutes(end)))throw new Error('Rango de horas inválido.')
  const id=crypto.randomUUID()
  await db.prepare(`INSERT INTO appointment_blocks(id,subject_type,subject_id,block_date,start_time,end_time,note) VALUES (?,?,?,?,?,?,?)`).bind(id,subjectType,subjectId,date,start||null,end||null,cleanAppointmentText(body?.note,160)||null).run()
  return id
}

export async function createAppointmentRequest(db:D1Database,subject:AppointmentSubject,body:any){
  const settings=await getAppointmentSettings(db,subject.type,subject.id)
  if(!settings.enabled)throw new Error('La agenda no está disponible.')
  const name=cleanAppointmentText(body?.name,120),phone=cleanAppointmentText(body?.phone,40),email=cleanAppointmentText(body?.email,180)
  const date=String(body?.date||''),start=String(body?.time||''),reasonId=cleanAppointmentText(body?.reason_id,120),details=cleanAppointmentText(body?.details,900)
  if(!name||!phone||!validAppointmentDate(date)||!validAppointmentTime(start)||!reasonId)throw new Error('Completa nombre, teléfono, fecha, hora y motivo.')
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Correo inválido.')
  const slots=await availableAppointmentSlots(db,subject.type,subject.id,date)
  const slot=slots.find(item=>item.time===start)
  if(!slot)throw new Error('Ese horario ya no está disponible. Selecciona otro.')
  const reasons=(await getAppointmentReasons(db,subject.type,subject.id,settings.reason_mode)).filter((item:any)=>item.enabled)
  const reason=reasons.find((item:any)=>String(item.id)===reasonId)
  if(!reason)throw new Error('Selecciona un motivo disponible.')
  const duplicate=await db.prepare(`SELECT id FROM appointment_requests WHERE subject_type=? AND subject_id=? AND customer_phone=? AND appointment_date=? AND start_time=? AND status='pending' AND created_at>datetime('now','-2 hours') LIMIT 1`).bind(subject.type,subject.id,phone,date,start).first()
  if(duplicate)return{duplicate:true,id:String((duplicate as any).id)}
  const recent=await db.prepare(`SELECT COUNT(*) AS n FROM appointment_requests WHERE subject_type=? AND subject_id=? AND customer_phone=? AND created_at>datetime('now','-24 hours')`).bind(subject.type,subject.id,phone).first()
  if(Number((recent as any)?.n||0)>=6)throw new Error('Has realizado varias solicitudes recientemente. Intenta nuevamente más tarde.')
  const id=crypto.randomUUID()
  await db.prepare(`INSERT INTO appointment_requests(id,subject_type,subject_id,owner_user_id,customer_name,customer_phone,customer_email,appointment_date,start_time,end_time,timezone,reason_id,reason_label,details,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'pending')`).bind(id,subject.type,subject.id,subject.ownerUserId,name,phone,email||null,date,start,slot.end_time,settings.timezone,reasonId,String((reason as any).label||'Cita'),details||null).run()
  return{duplicate:false,id,date,start_time:start,end_time:slot.end_time,reason_label:String((reason as any).label||'Cita'),name,phone,email,details,timezone:settings.timezone}
}

export async function listAppointmentRequests(db:D1Database,subjectType:string,subjectId:string,limit=80){
  await db.prepare(`UPDATE appointment_requests SET status='expired',updated_at=datetime('now') WHERE subject_type=? AND subject_id=? AND status='pending' AND appointment_date<date('now','-1 day')`).bind(subjectType,subjectId).run().catch(()=>undefined)
  const rows=await db.prepare(`SELECT id,customer_name,customer_phone,customer_email,appointment_date,start_time,end_time,timezone,reason_label,details,status,created_at,confirmed_at,rejected_at,cancelled_at FROM appointment_requests WHERE subject_type=? AND subject_id=? ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'confirmed' THEN 1 ELSE 2 END,appointment_date ASC,start_time ASC,created_at DESC LIMIT ?`).bind(subjectType,subjectId,Math.max(1,Math.min(200,limit))).all()
  return rows.results||[]
}

export async function confirmAppointmentRequest(db:D1Database,subjectType:string,subjectId:string,requestId:string){
  const row=await db.prepare(`SELECT id,appointment_date,start_time,end_time,status FROM appointment_requests WHERE id=? AND subject_type=? AND subject_id=? LIMIT 1`).bind(requestId,subjectType,subjectId).first()
  if(!row)throw new Error('Solicitud no encontrada.')
  if(String((row as any).status)==='confirmed')return{ok:true,already:true}
  if(String((row as any).status)!=='pending')throw new Error('Esta solicitud ya no está pendiente.')
  const date=String((row as any).appointment_date),start=String((row as any).start_time),end=String((row as any).end_time)
  const blocked=await db.prepare(`SELECT id FROM appointment_blocks WHERE subject_type=? AND subject_id=? AND block_date=? AND ((start_time IS NULL AND end_time IS NULL) OR (start_time<? AND end_time>?)) LIMIT 1`).bind(subjectType,subjectId,date,end,start).first()
  if(blocked)throw new Error('Ese horario está bloqueado actualmente.')
  const result=await db.prepare(`UPDATE appointment_requests SET status='confirmed',confirmed_at=datetime('now'),updated_at=datetime('now') WHERE id=? AND subject_type=? AND subject_id=? AND status='pending' AND NOT EXISTS (SELECT 1 FROM appointment_requests other WHERE other.subject_type=? AND other.subject_id=? AND other.appointment_date=? AND other.status='confirmed' AND other.id<>? AND other.start_time<? AND other.end_time>?)`).bind(requestId,subjectType,subjectId,subjectType,subjectId,date,requestId,end,start).run()
  if(Number((result as any)?.meta?.changes||0)!==1)throw new Error('Ese horario acaba de ser ocupado. Selecciona otra hora para esta solicitud.')
  return{ok:true,already:false}
}

export async function changeAppointmentRequestStatus(db:D1Database,subjectType:string,subjectId:string,requestId:string,action:'reject'|'release'){
  if(action==='reject'){
    const result=await db.prepare(`UPDATE appointment_requests SET status='rejected',rejected_at=datetime('now'),updated_at=datetime('now') WHERE id=? AND subject_type=? AND subject_id=? AND status='pending'`).bind(requestId,subjectType,subjectId).run()
    if(Number((result as any)?.meta?.changes||0)!==1)throw new Error('La solicitud ya no está pendiente.')
    return
  }
  const result=await db.prepare(`UPDATE appointment_requests SET status='cancelled',cancelled_at=datetime('now'),updated_at=datetime('now') WHERE id=? AND subject_type=? AND subject_id=? AND status='confirmed'`).bind(requestId,subjectType,subjectId).run()
  if(Number((result as any)?.meta?.changes||0)!==1)throw new Error('Solo puedes liberar una cita confirmada.')
}
