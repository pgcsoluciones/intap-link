import app from './index'
import { cookieNames } from './lib/cookies'

async function sha256Hex(input:string){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input));return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('')}
function parseCookie(header:string,name:string){const escaped=name.replace(/[.*+?^$()|[\]\\]/g,'\\$&');const match=header.match(new RegExp('(?:^|;\\s*)'+escaped+'=([^;]*)'));return match?decodeURIComponent(match[1]):null}
async function sessionUserId(c:any){const raw=parseCookie(c.req.header('Cookie')||'',cookieNames(c.env).session);if(!raw)return'';const row=await c.env.DB.prepare("SELECT user_id FROM auth_sessions WHERE session_hash=? AND expires_at>datetime('now') AND revoked_at IS NULL LIMIT 1").bind(await sha256Hex(raw)).first();return row?String((row as any).user_id||''):''}
async function requireUser(c:any,next:any){const id=await sessionUserId(c);if(!id)return c.json({ok:false,error:'Unauthorized'},401);c.set('userId',id);await next()}
const clean=(v:unknown,max=500)=>String(v??'').trim().slice(0,max)
const cleanSlug=(v:unknown)=>clean(v,80).toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'').replace(/-+/g,'-').replace(/^-|-$/g,'')
function ext(file:File){const byType:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};return byType[file.type]||''}
async function owned(c:any){
  const userId=String(c.get('userId')||'')
  const profile=await c.env.DB.prepare("SELECT * FROM medical_profiles WHERE user_id=? ORDER BY created_at ASC LIMIT 1").bind(userId).first()
  return profile?{userId,profile}:null
}
async function full(c:any,profile:any){
  const id=String(profile.id)
  const [centers,schedules,services,accepted,excluded]=await Promise.all([
    c.env.DB.prepare("SELECT * FROM medical_profile_centers WHERE medical_profile_id=? ORDER BY sort_order,name").bind(id).all(),
    c.env.DB.prepare("SELECT * FROM medical_profile_schedules WHERE medical_profile_id=? ORDER BY day_of_week,sort_order,start_time").bind(id).all(),
    c.env.DB.prepare("SELECT * FROM medical_profile_services WHERE medical_profile_id=? ORDER BY sort_order,title").bind(id).all(),
    c.env.DB.prepare("SELECT * FROM medical_profile_insurances WHERE medical_profile_id=? ORDER BY sort_order,insurance_name").bind(id).all(),
    c.env.DB.prepare("SELECT * FROM medical_profile_insurance_exclusions WHERE medical_profile_id=? ORDER BY sort_order,insurance_name").bind(id).all(),
  ])
  return{...profile,centers:centers.results||[],schedules:schedules.results||[],services:services.results||[],insurance_policy:{accepts_all:(accepted.results||[]).length===0,accepted:(accepted.results||[]).map((r:any)=>({id:r.id,insurance_name:r.insurance_name,sort_order:r.sort_order,active:r.active})),excluded:(excluded.results||[]).map((r:any)=>({id:r.id,insurance_name:r.insurance_name,sort_order:r.sort_order,active:r.active}))}}
}
app.get('/api/v1/me/medical-profile',requireUser,async(c:any)=>{
  const r=await owned(c);if(!r)return c.json({ok:false,error:'Perfil médico no encontrado.'},404)
  return c.json({ok:true,data:await full(c,r.profile)})
})
app.patch('/api/v1/me/medical-profile',requireUser,async(c:any)=>{
  const r=await owned(c);if(!r)return c.json({ok:false,error:'Perfil médico no encontrado.'},404)
  const b=await c.req.json().catch(()=>({})),p:any=r.profile
  const slug=b.slug!==undefined?cleanSlug(b.slug):String(p.slug||'')
  if(!slug)return c.json({ok:false,error:'El enlace del perfil es requerido.'},422)
  const conflict=await c.env.DB.prepare("SELECT id FROM medical_profiles WHERE slug=? AND id<>? LIMIT 1").bind(slug,String(p.id)).first()
  if(conflict)return c.json({ok:false,error:'Ese enlace ya está ocupado.'},409)
  const next={
    name:b.name!==undefined?clean(b.name,100):String(p.name||''),
    professional_prefix:b.professional_prefix!==undefined?clean(b.professional_prefix,20):String(p.professional_prefix||''),
    specialty:b.specialty!==undefined?clean(b.specialty,100):String(p.specialty||''),
    subspecialty:b.subspecialty!==undefined?clean(b.subspecialty,140):String(p.subspecialty||''),
    bio:b.bio!==undefined?clean(b.bio,700):String(p.bio||''),
    phone:b.phone!==undefined?clean(b.phone,40):String(p.phone||''),
    whatsapp:b.whatsapp!==undefined?clean(b.whatsapp,40):String(p.whatsapp||''),
    email:b.email!==undefined?clean(b.email,160).toLowerCase():String(p.email||''),
    city:b.city!==undefined?clean(b.city,100):String(p.city||''),
    province:b.province!==undefined?clean(b.province,100):String(p.province||''),
    country:b.country!==undefined?clean(b.country,100):String(p.country||'República Dominicana'),
    organization:b.organization!==undefined?clean(b.organization,120):String(p.organization||''),
    status:['draft','active','inactive'].includes(String(b.status))?String(b.status):String(p.status||'draft'),
  }
  if(!next.name||!next.specialty)return c.json({ok:false,error:'Nombre y especialidad son requeridos.'},422)
  await c.env.DB.prepare(`UPDATE medical_profiles SET slug=?,name=?,professional_prefix=?,specialty=?,subspecialty=?,bio=?,phone=?,whatsapp=?,email=?,city=?,province=?,country=?,organization=?,status=?,updated_at=datetime('now') WHERE id=?`).bind(
    slug,next.name,next.professional_prefix,next.specialty,next.subspecialty,next.bio,next.phone,next.whatsapp,next.email,next.city,next.province,next.country,next.organization,next.status,String(p.id)
  ).run()
  const updated=await c.env.DB.prepare("SELECT * FROM medical_profiles WHERE id=?").bind(String(p.id)).first()
  return c.json({ok:true,data:await full(c,updated)})
})
app.post('/api/v1/me/medical-profile/media',requireUser,async(c:any)=>{
  const r=await owned(c);if(!r)return c.json({ok:false,error:'Perfil médico no encontrado.'},404)
  const kind=String(c.req.query('kind')||'');if(kind!=='avatar'&&kind!=='cover')return c.json({ok:false,error:'Tipo de imagen inválido.'},400)
  const fd=await c.req.formData(),raw=fd.get('file')
  if(!(raw&&typeof raw==='object'&&'stream' in (raw as any)))return c.json({ok:false,error:'Archivo requerido.'},400)
  const file=raw as File,fileExt=ext(file);if(!fileExt)return c.json({ok:false,error:'Usa JPG, PNG o WEBP.'},400)
  if(Number(file.size||0)>8*1024*1024)return c.json({ok:false,error:'La imagen supera 8 MB.'},413)
  const key=`medical/${String(r.profile.id)}/${kind}/${crypto.randomUUID()}.${fileExt}`
  await c.env.BUCKET.put(key,file.stream(),{httpMetadata:{contentType:file.type||'image/jpeg'}})
  const origin=new URL(c.req.url).origin,url=`${origin}/api/v1/public/assets/${key.split('/').map(encodeURIComponent).join('/')}`
  const column=kind==='avatar'?'avatar_url':'cover_url'
  await c.env.DB.prepare(`UPDATE medical_profiles SET ${column}=?,updated_at=datetime('now') WHERE id=?`).bind(url,String(r.profile.id)).run()
  return c.json({ok:true,url})
})
app.post('/api/v1/me/medical-profile/centers',requireUser,async(c:any)=>{
  const r=await owned(c);if(!r)return c.json({ok:false,error:'Perfil médico no encontrado.'},404)
  const b=await c.req.json().catch(()=>({})),name=clean(b.name,120);if(!name)return c.json({ok:false,error:'Nombre del centro requerido.'},422)
  const id=crypto.randomUUID()
  await c.env.DB.prepare(`INSERT INTO medical_profile_centers(id,medical_profile_id,name,address,city,province,country,phone,map_url,latitude,longitude,sort_order,active) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,1)`).bind(
    id,String(r.profile.id),name,clean(b.address,200),clean(b.city,100),clean(b.province,100),clean(b.country,100)||'República Dominicana',clean(b.phone,40),clean(b.map_url,1000),b.latitude??null,b.longitude??null,Number(b.sort_order||0)
  ).run()
  return c.json({ok:true,data:{id}},201)
})
app.patch('/api/v1/me/medical-profile/centers/:id',requireUser,async(c:any)=>{
  const r=await owned(c);if(!r)return c.json({ok:false,error:'Perfil médico no encontrado.'},404)
  const id=clean(c.req.param('id'),80),b=await c.req.json().catch(()=>({}))
  const current=await c.env.DB.prepare("SELECT * FROM medical_profile_centers WHERE id=? AND medical_profile_id=? LIMIT 1").bind(id,String(r.profile.id)).first()
  if(!current)return c.json({ok:false,error:'Centro no encontrado.'},404)
  await c.env.DB.prepare(`UPDATE medical_profile_centers SET name=?,address=?,city=?,province=?,country=?,phone=?,map_url=?,latitude=?,longitude=?,sort_order=?,active=? WHERE id=?`).bind(
    b.name!==undefined?clean(b.name,120):(current as any).name,b.address!==undefined?clean(b.address,200):(current as any).address,b.city!==undefined?clean(b.city,100):(current as any).city,b.province!==undefined?clean(b.province,100):(current as any).province,b.country!==undefined?clean(b.country,100):(current as any).country,b.phone!==undefined?clean(b.phone,40):(current as any).phone,b.map_url!==undefined?clean(b.map_url,1000):(current as any).map_url,b.latitude!==undefined?b.latitude:(current as any).latitude,b.longitude!==undefined?b.longitude:(current as any).longitude,b.sort_order!==undefined?Number(b.sort_order):(current as any).sort_order,b.active===undefined?Number((current as any).active??1):(b.active?1:0),id
  ).run()
  return c.json({ok:true})
})
app.delete('/api/v1/me/medical-profile/centers/:id',requireUser,async(c:any)=>{
  const r=await owned(c);if(!r)return c.json({ok:false,error:'Perfil médico no encontrado.'},404)
  await c.env.DB.prepare("DELETE FROM medical_profile_centers WHERE id=? AND medical_profile_id=?").bind(clean(c.req.param('id'),80),String(r.profile.id)).run()
  return c.json({ok:true})
})
app.post('/api/v1/me/medical-profile/schedules',requireUser,async(c:any)=>{
  const r=await owned(c);if(!r)return c.json({ok:false,error:'Perfil médico no encontrado.'},404)
  const b=await c.req.json().catch(()=>({})),centerId=clean(b.center_id,80)
  const center=await c.env.DB.prepare("SELECT id FROM medical_profile_centers WHERE id=? AND medical_profile_id=? LIMIT 1").bind(centerId,String(r.profile.id)).first()
  if(!center)return c.json({ok:false,error:'Centro inválido.'},422)
  const day=Math.max(1,Math.min(7,Number(b.day_of_week||1))),start=clean(b.start_time,5),end=clean(b.end_time,5)
  if(!/^\d{2}:\d{2}$/.test(start)||!/^\d{2}:\d{2}$/.test(end))return c.json({ok:false,error:'Horario inválido.'},422)
  const id=crypto.randomUUID()
  await c.env.DB.prepare(`INSERT INTO medical_profile_schedules(id,medical_profile_id,center_id,day_of_week,shift,start_time,end_time,notes,sort_order,active) VALUES(?,?,?,?,?,?,?,?,?,1)`).bind(
    id,String(r.profile.id),centerId,day,clean(b.shift,60),start,end,clean(b.notes,180),Number(b.sort_order||0)
  ).run()
  return c.json({ok:true,data:{id}},201)
})
app.patch('/api/v1/me/medical-profile/schedules/:id',requireUser,async(c:any)=>{
  const r=await owned(c);if(!r)return c.json({ok:false,error:'Perfil médico no encontrado.'},404)
  const id=clean(c.req.param('id'),80),b=await c.req.json().catch(()=>({}))
  const current=await c.env.DB.prepare("SELECT * FROM medical_profile_schedules WHERE id=? AND medical_profile_id=? LIMIT 1").bind(id,String(r.profile.id)).first()
  if(!current)return c.json({ok:false,error:'Horario no encontrado.'},404)
  const centerId=b.center_id!==undefined?clean(b.center_id,80):String((current as any).center_id)
  const center=await c.env.DB.prepare("SELECT id FROM medical_profile_centers WHERE id=? AND medical_profile_id=? LIMIT 1").bind(centerId,String(r.profile.id)).first()
  if(!center)return c.json({ok:false,error:'Centro inválido.'},422)
  await c.env.DB.prepare(`UPDATE medical_profile_schedules SET center_id=?,day_of_week=?,shift=?,start_time=?,end_time=?,notes=?,sort_order=?,active=? WHERE id=?`).bind(
    centerId,b.day_of_week!==undefined?Math.max(1,Math.min(7,Number(b.day_of_week))):(current as any).day_of_week,b.shift!==undefined?clean(b.shift,60):(current as any).shift,b.start_time!==undefined?clean(b.start_time,5):(current as any).start_time,b.end_time!==undefined?clean(b.end_time,5):(current as any).end_time,b.notes!==undefined?clean(b.notes,180):(current as any).notes,b.sort_order!==undefined?Number(b.sort_order):(current as any).sort_order,b.active===undefined?Number((current as any).active??1):(b.active?1:0),id
  ).run()
  return c.json({ok:true})
})
app.delete('/api/v1/me/medical-profile/schedules/:id',requireUser,async(c:any)=>{
  const r=await owned(c);if(!r)return c.json({ok:false,error:'Perfil médico no encontrado.'},404)
  await c.env.DB.prepare("DELETE FROM medical_profile_schedules WHERE id=? AND medical_profile_id=?").bind(clean(c.req.param('id'),80),String(r.profile.id)).run()
  return c.json({ok:true})
})
app.put('/api/v1/me/medical-profile/insurances',requireUser,async(c:any)=>{
  const r=await owned(c);if(!r)return c.json({ok:false,error:'Perfil médico no encontrado.'},404)
  const b=await c.req.json().catch(()=>({}))
  const accepted=Array.isArray(b.accepted)?b.accepted.map((x:any)=>clean(x,120)).filter(Boolean).slice(0,50):[]
  const excluded=Array.isArray(b.excluded)?b.excluded.map((x:any)=>clean(x,120)).filter(Boolean).slice(0,50):[]
  const pid=String(r.profile.id)
  const statements:any[]=[
    c.env.DB.prepare("DELETE FROM medical_profile_insurances WHERE medical_profile_id=?").bind(pid),
    c.env.DB.prepare("DELETE FROM medical_profile_insurance_exclusions WHERE medical_profile_id=?").bind(pid),
  ]
  accepted.forEach((name:string,index:number)=>statements.push(c.env.DB.prepare("INSERT INTO medical_profile_insurances(id,medical_profile_id,insurance_name,sort_order,active,created_at) VALUES(?,?,?,?,1,datetime('now'))").bind(crypto.randomUUID(),pid,name,index)))
  excluded.forEach((name:string,index:number)=>statements.push(c.env.DB.prepare("INSERT INTO medical_profile_insurance_exclusions(id,medical_profile_id,insurance_name,sort_order,active,created_at) VALUES(?,?,?,?,1,datetime('now'))").bind(crypto.randomUUID(),pid,name,index)))
  await c.env.DB.batch(statements)
  return c.json({ok:true,data:{accepted,excluded}})
})
export default app
