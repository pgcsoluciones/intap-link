import app from './index'
import { cookieNames } from './lib/cookies'
import { delegateHeader } from './kawmed-live-guest'
import { resolveSponsorMembership, resolveOwnedMedicalContext } from './sponsored-multiprofile-access'

async function sha256Hex(input:string){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input));return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('')}
function parseCookie(header:string,name:string){const escaped=name.replace(/[.*+?^$()|[\]\\]/g,'\\$&');const match=header.match(new RegExp('(?:^|;\\s*)'+escaped+'=([^;]*)'));return match?decodeURIComponent(match[1]):null}
async function sessionUserId(c:any){const raw=parseCookie(c.req.header('Cookie')||'',cookieNames(c.env).session);if(!raw)return'';const row=await c.env.DB.prepare("SELECT user_id FROM auth_sessions WHERE session_hash=? AND expires_at>datetime('now') AND revoked_at IS NULL LIMIT 1").bind(await sha256Hex(raw)).first();return row?String((row as any).user_id||''):''}
async function requireUser(c:any,next:any){const id=await sessionUserId(c);if(!id)return c.json({ok:false,error:'Unauthorized'},401);if(delegateHeader(c) && /\/medical-profile\/(?:delete-account|suspend|reactivate)(?:\/|$)/.test(new URL(c.req.url).pathname))return c.json({ok:false,error:'El administrador invitado no puede cambiar propiedad ni eliminar o suspender cuentas.'},403);c.set('userId',id);await next()}
const clean=(v:unknown,max=500)=>String(v??'').trim().slice(0,max)
const cleanSlug=(v:unknown)=>clean(v,80).toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'').replace(/-+/g,'-').replace(/^-|-$/g,'')
function ext(file:File){const byType:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};return byType[file.type]||''}
function ownerScope(c:any){return String(c.req.query('scope')||'').trim()==='sponsor_master'?'sponsor_master':'doctor'}
async function uniqueMedicalSlug(c:any,base:string){
  let root=cleanSlug(base)||('kawmed-'+crypto.randomUUID().slice(0,8)),candidate=root,n=2
  while(await c.env.DB.prepare("SELECT id FROM medical_profiles WHERE slug=? LIMIT 1").bind(candidate).first())candidate=(root+'-'+n++).slice(0,80)
  return candidate
}
async function ensureSponsorMasterProfile(c:any,userId:string){
  const membership=await resolveSponsorMembership(c,userId)
  if(!membership||!['owner','admin'].includes(String((membership as any).role||'')))return null
  const sponsorId=String((membership as any).sponsor_id||'')
  const current=await c.env.DB.prepare(`SELECT mp.*
    FROM medical_sponsor_master_profiles msmp
    JOIN medical_profiles mp ON mp.id=msmp.medical_profile_id
    WHERE msmp.sponsor_id=? LIMIT 1`).bind(sponsorId).first()
  if(current)return{userId,profile:current,sponsorId,scope:'sponsor_master'}
  const sponsor=await c.env.DB.prepare("SELECT id,name,slug,contact_email,contact_whatsapp,logo_url,banner_image_url FROM sponsor_tenants WHERE id=? AND is_active=1 LIMIT 1").bind(sponsorId).first()
  if(!sponsor)return null
  const profileId=crypto.randomUUID(),slug=await uniqueMedicalSlug(c,(String((sponsor as any).slug||'kawmed')+'-med'))
  await c.env.DB.batch([
    c.env.DB.prepare(`INSERT INTO medical_profiles(id,user_id,slug,name,professional_prefix,specialty,subspecialty,bio,avatar_url,cover_url,phone,whatsapp,email,city,province,country,organization,status)
      VALUES(?,NULL,?,?,NULL,'Laboratorio médico',NULL,'Perfil médico de ejemplo del programa KawMed.',?,?,?, ?,?,NULL,NULL,'República Dominicana',?,'draft')`).bind(
        profileId,slug,String((sponsor as any).name||'Patrocinador KawMed'),String((sponsor as any).logo_url||''),String((sponsor as any).banner_image_url||''),
        String((sponsor as any).contact_whatsapp||''),String((sponsor as any).contact_whatsapp||''),String((sponsor as any).contact_email||''),String((sponsor as any).name||'')
      ),
    c.env.DB.prepare("INSERT INTO medical_sponsor_master_profiles(sponsor_id,medical_profile_id,created_by_user_id) VALUES(?,?,?)").bind(sponsorId,profileId,userId),
  ])
  const created=await c.env.DB.prepare("SELECT * FROM medical_profiles WHERE id=? LIMIT 1").bind(profileId).first()
  return created?{userId,profile:created,sponsorId,scope:'sponsor_master'}:null
}
async function owned(c:any){
  const userId=String(c.get('userId')||'')
  if(ownerScope(c)==='sponsor_master')return ensureSponsorMasterProfile(c,userId)
  const profile=await resolveOwnedMedicalContext(c,userId)
  return profile?{userId,profile,scope:'doctor'}:null
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
  const appearance=await c.env.DB.prepare('SELECT template,palette FROM medical_profile_appearance WHERE medical_profile_id=?').bind(id).first()
  return{...profile,template:String((appearance as any)?.template||'classic'),palette:String((appearance as any)?.palette||'aqua'),centers:centers.results||[],schedules:schedules.results||[],services:services.results||[],insurance_policy:{accepts_all:(accepted.results||[]).length===0,accepted:(accepted.results||[]).map((r:any)=>({id:r.id,insurance_name:r.insurance_name,sort_order:r.sort_order,active:r.active})),excluded:(excluded.results||[]).map((r:any)=>({id:r.id,insurance_name:r.insurance_name,sort_order:r.sort_order,active:r.active}))}}
}
app.get('/api/v1/me/medical-profile',requireUser,async(c:any)=>{
  const r=await owned(c);if(!r)return c.json({ok:false,error:'Perfil médico no encontrado.'},404)
  const result=await full(c,r.profile)
  if(r.scope==='doctor'){
    if(delegateHeader(c))return c.json({ok:true,data:{...result,guest_editor:true}})
    const user=await c.env.DB.prepare('SELECT email FROM users WHERE id=? LIMIT 1').bind(r.userId).first()
    return c.json({ok:true,data:{...result,account_email:String((user as any)?.email||'')}})
  }
  return c.json({ok:true,data:result})
})
// Lifecycle controls apply only to the authenticated doctor's medical profile.
// Sponsor Master profiles are administered independently and cannot be altered here.
app.post('/api/v1/me/medical-profile/suspend',requireUser,async(c:any)=>{
  if(ownerScope(c)!=='doctor')return c.json({ok:false,error:'Operación no disponible para el perfil Master.'},403)
  const r=await owned(c);if(!r)return c.json({ok:false,error:'Perfil médico no encontrado.'},404)
  const body=await c.req.json().catch(()=>({}))
  if(body.confirm!==true)return c.json({ok:false,error:'Confirma la suspensión antes de continuar.'},422)
  await c.env.DB.prepare("UPDATE medical_profiles SET status='inactive',updated_at=datetime('now') WHERE id=? AND user_id=?").bind(String(r.profile.id),r.userId).run()
  return c.json({ok:true,data:{status:'inactive',email_released:false}})
})
app.post('/api/v1/me/medical-profile/reactivate',requireUser,async(c:any)=>{
  if(ownerScope(c)!=='doctor')return c.json({ok:false,error:'Operación no disponible para el perfil Master.'},403)
  const r=await owned(c);if(!r)return c.json({ok:false,error:'Perfil médico no encontrado.'},404)
  const body=await c.req.json().catch(()=>({}))
  if(body.confirm!==true)return c.json({ok:false,error:'Confirma la reactivación.'},422)
  await c.env.DB.prepare("UPDATE medical_profiles SET status='draft',updated_at=datetime('now') WHERE id=? AND user_id=? AND status='inactive'").bind(String(r.profile.id),r.userId).run()
  return c.json({ok:true,data:{status:'draft',email_released:false}})
})

// Hard deletion requires an unshared account and explicit typed confirmation.
// D1 batch is transactional: a foreign-key restriction rolls back all changes.
app.post('/api/v1/me/medical-profile/delete-account',requireUser,async(c:any)=>{
  if(ownerScope(c)!=='doctor')return c.json({ok:false,error:'No se puede eliminar una cuenta Master por esta vía.'},403)
  const userId=String(c.get('userId')||'')
  const r=await owned(c);if(!r)return c.json({ok:false,error:'Perfil médico no encontrado.'},404)
  const body=await c.req.json().catch(()=>({}))
  const user=await c.env.DB.prepare('SELECT email FROM users WHERE id=? LIMIT 1').bind(userId).first()
  const email=String((user as any)?.email||'').trim().toLowerCase()
  const phrase=String(body.confirm_phrase||'').trim().toUpperCase()
  if(!email||email==='intapcard@gmail.com')return c.json({ok:false,error:'Esta cuenta multicuenta no puede eliminarse desde KawMed.'},403)
  if(String(body.confirm_email||'').trim().toLowerCase()!==email||phrase!=='ELIMINAR KAWMED'||String(body.confirm_slug||'').trim()!==String(r.profile.slug))
    return c.json({ok:false,error:'Para eliminar definitivamente confirma el correo, el enlace público y escribe ELIMINAR KAWMED.'},422)
  const guard=await c.env.DB.prepare(`SELECT
    (SELECT COUNT(*) FROM profiles WHERE user_id=?) AS link_profiles,
    (SELECT COUNT(*) FROM sponsored_profiles WHERE user_id=?) AS sponsored_profiles,
    (SELECT COUNT(*) FROM sponsor_members WHERE user_id=?) AS sponsor_members,
    (SELECT COUNT(*) FROM medical_sponsor_masters WHERE claimed_by_user_id=?) AS medical_masters,
    (SELECT COUNT(*) FROM medical_profiles WHERE user_id=?) AS medical_profiles,
    (SELECT COUNT(*) FROM intap_artifacts WHERE owner_user_id=?) AS owned_artifacts`).bind(userId,userId,userId,userId,userId,userId).first()
  if(Number((guard as any)?.link_profiles||0)>0||Number((guard as any)?.sponsored_profiles||0)>0||Number((guard as any)?.sponsor_members||0)>0||
     Number((guard as any)?.medical_masters||0)>0||Number((guard as any)?.owned_artifacts||0)>0||Number((guard as any)?.medical_profiles||0)!==1)
    return c.json({ok:false,error:'Esta identidad tiene otros perfiles o permisos vinculados. La eliminación requiere revisión administrativa y no se realizará automáticamente.',code:'shared_account_protected'},409)
  const adminRole=await c.env.DB.prepare('SELECT role FROM admin_users WHERE user_id=? LIMIT 1').bind(userId).first().catch(()=>null)
  if(adminRole)return c.json({ok:false,error:'Esta identidad tiene permisos administrativos. No puede eliminarse desde el perfil médico.',code:'admin_account_protected'},409)
  const id=String(r.profile.id)
  try{
    await c.env.DB.batch([
      c.env.DB.prepare("UPDATE medical_profiles SET status='inactive' WHERE id=? AND user_id=?").bind(id,userId),
      c.env.DB.prepare("UPDATE medical_access_codes SET status='inactive',claimed_by_user_id=NULL,medical_profile_id=NULL,updated_at=datetime('now') WHERE claimed_by_user_id=?").bind(userId),
      c.env.DB.prepare("DELETE FROM appointment_requests WHERE subject_type='medical' AND subject_id=?").bind(id),
      c.env.DB.prepare("DELETE FROM appointment_blocks WHERE subject_type='medical' AND subject_id=?").bind(id),
      c.env.DB.prepare("DELETE FROM appointment_reasons WHERE subject_type='medical' AND subject_id=?").bind(id),
      c.env.DB.prepare("DELETE FROM appointment_availability WHERE subject_type='medical' AND subject_id=?").bind(id),
      c.env.DB.prepare("DELETE FROM appointment_settings WHERE subject_type='medical' AND subject_id=?").bind(id),
      c.env.DB.prepare("DELETE FROM medical_profiles WHERE id=? AND user_id=?").bind(id,userId),
      c.env.DB.prepare("DELETE FROM auth_sessions WHERE user_id=?").bind(userId),
      c.env.DB.prepare("DELETE FROM users WHERE id=?").bind(userId),
    ])
  }catch(err){
    console.error('[KawMed account deletion] blocked by dependent records',err)
    return c.json({ok:false,error:'No se eliminó la cuenta porque existen datos vinculados que requieren una limpieza segura. Ningún dato debe borrarse parcialmente.',code:'deletion_dependency_blocked'},409)
  }
  const remains=await c.env.DB.prepare('SELECT id FROM users WHERE id=? LIMIT 1').bind(userId).first()
  if(remains)return c.json({ok:false,error:'No se pudo liberar la identidad; revisa la cuenta con soporte.'},500)
  let mediaCleanupPending=false
  try{
    let cursor:string|undefined
    do{
      const page=await c.env.BUCKET.list({prefix:'medical/'+id+'/',cursor})
      if(page.objects.length)await c.env.BUCKET.delete(page.objects.map((item:any)=>item.key))
      cursor=page.truncated?page.cursor:undefined
    }while(cursor)
  }catch(err){mediaCleanupPending=true;console.error('[KawMed deletion] medical media cleanup pending',err)}
  return c.json({ok:true,data:{deleted:true,email_released:true,slug:String(r.profile.slug),media_cleanup_pending:mediaCleanupPending}})
})

app.put('/api/v1/me/medical-profile/appearance',requireUser,async(c:any)=>{
  const r=await owned(c);if(!r)return c.json({ok:false,error:'Perfil médico no encontrado.'},404)
  const b=await c.req.json().catch(()=>({}))
  const template=String(b.template||'')
  const palette=String(b.palette||'')
  if(!['classic','pastel'].includes(template)||!['aqua','lavender','mint','peach','sky'].includes(palette))
    return c.json({ok:false,error:'Apariencia no válida.'},422)
  const id=String(r.profile.id)
  await c.env.DB.prepare(`INSERT INTO medical_profile_appearance(medical_profile_id,template,palette,updated_at) VALUES(?,?,?,datetime('now')) ON CONFLICT(medical_profile_id) DO UPDATE SET template=excluded.template,palette=excluded.palette,updated_at=datetime('now')`).bind(id,template,palette).run()
  const saved=await c.env.DB.prepare('SELECT template,palette FROM medical_profile_appearance WHERE medical_profile_id=?').bind(id).first()
  if(String((saved as any)?.template)!==template||String((saved as any)?.palette)!==palette)return c.json({ok:false,error:'No se pudo verificar apariencia.'},500)
  c.header('Cache-Control','no-store')
  return c.json({ok:true,data:{template,palette}})
})
app.post('/api/v1/me/medical-profile/publication',requireUser,async(c:any)=>{
  const r=await owned(c)
  if(!r)return c.json({ok:false,error:'Perfil médico no encontrado.'},404)
  const body=await c.req.json().catch(()=>({}))
  const action=String(body.action||'')
  if(!['publish','unpublish'].includes(action))return c.json({ok:false,error:'Acción inválida.'},422)
  if(body.confirm!==true)return c.json({ok:false,error:'Confirma el cambio de publicación.'},422)
  const current=String(r.profile.status||'draft')
  const desired=action==='publish'?'active':'draft'
  if(current===desired)return c.json({ok:true,data:{status:desired,unchanged:true}})
  if(action==='publish'&&(!String(r.profile.name||'').trim()||!String(r.profile.specialty||'').trim()||!String(r.profile.slug||'').trim()))
    return c.json({ok:false,error:'Completa nombre, especialidad y enlace público antes de publicar.'},422)
  const write=await c.env.DB.prepare("UPDATE medical_profiles SET status=?,updated_at=datetime('now') WHERE id=? AND status=?").bind(desired,String(r.profile.id),current).run()
  if(Number(write?.meta?.changes||0)!==1)return c.json({ok:false,error:'El estado cambió. Actualiza y vuelve a intentar.'},409)
  return c.json({ok:true,data:{status:desired,public_url:'/m/'+String(r.profile.slug||'')}})
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
    // A generic profile save may change the primary specialty but must never erase persisted additions.
    specialty:b.specialty!==undefined?[
      clean(b.specialty,400).split(' | ')[0].trim(),
      ...String(p.specialty||'').split(' | ').slice(1).map(x=>x.trim()).filter(Boolean),
    ].filter(Boolean).join(' | ').slice(0,400):String(p.specialty||''),
    subspecialty:b.subspecialty!==undefined?clean(b.subspecialty,140):String(p.subspecialty||''),
    bio:b.bio!==undefined?clean(b.bio,700):String(p.bio||''),
    phone:b.phone!==undefined?clean(b.phone,40):String(p.phone||''),
    whatsapp:b.whatsapp!==undefined?clean(b.whatsapp,40):String(p.whatsapp||''),
    email:b.email!==undefined?clean(b.email,160).toLowerCase():String(p.email||''),
    city:b.city!==undefined?clean(b.city,100):String(p.city||''),
    province:b.province!==undefined?clean(b.province,100):String(p.province||''),
    country:b.country!==undefined?clean(b.country,100):String(p.country||'República Dominicana'),
    organization:b.organization!==undefined?clean(b.organization,120):String(p.organization||''),
    status:String(p.status||'draft'), // Publication changes require explicit confirmation through /publication.
  }
  if(!next.name||!next.specialty)return c.json({ok:false,error:'Nombre y especialidad son requeridos.'},422)
  const write:any=await c.env.DB.prepare(`UPDATE medical_profiles SET slug=?,name=?,professional_prefix=?,specialty=?,subspecialty=?,bio=?,phone=?,whatsapp=?,email=?,city=?,province=?,country=?,organization=?,status=?,updated_at=datetime('now') WHERE id=? AND specialty=?`).bind(
    slug,next.name,next.professional_prefix,next.specialty,next.subspecialty,next.bio,next.phone,next.whatsapp,next.email,next.city,next.province,next.country,next.organization,next.status,String(p.id),String(p.specialty||'')
  ).run()
  if(Number(write?.meta?.changes||0)!==1)return c.json({ok:false,error:'El perfil fue modificado mientras guardabas. Actualiza y vuelve a guardar.'},409)
  const updated=await c.env.DB.prepare("SELECT * FROM medical_profiles WHERE id=?").bind(String(p.id)).first()
  return c.json({ok:true,data:await full(c,updated)})
})

// Atomic specialty append: never replace the entire profile or lose existing specialties.
app.post('/api/v1/me/medical-profile/specialties',requireUser,async(c:any)=>{
  const r=await owned(c);if(!r)return c.json({ok:false,error:'Perfil médico no encontrado.'},404)
  const body=await c.req.json().catch(()=>({}))
  const name=clean(body.specialty,140)
  if(!name||name.includes('|'))return c.json({ok:false,error:'Introduce una especialidad válida.'},422)
  const id=String(r.profile.id)
  const current=await c.env.DB.prepare('SELECT specialty FROM medical_profiles WHERE id=?').bind(id).first()
  if(!current)return c.json({ok:false,error:'Perfil médico no encontrado.'},404)
  const names=String((current as any).specialty||'').split(' | ').map(x=>x.trim()).filter(Boolean)
  if(names.some(x=>x.toLocaleLowerCase('es')===name.toLocaleLowerCase('es')))
    return c.json({ok:false,error:'Esta especialidad ya está registrada.'},409)
  // Compare-and-set prevents concurrent clients from silently discarding another update.
  const before=String((current as any).specialty||'')
  const combined=[...names,name].join(' | ')
  if(combined.length>400)return c.json({ok:false,error:'Límite de especialidades alcanzado.'},422)
  const write:any=await c.env.DB.prepare("UPDATE medical_profiles SET specialty=?,updated_at=datetime('now') WHERE id=? AND specialty=?")
    .bind(combined,id,before).run()
  if(Number(write?.meta?.changes||0)!==1)
    return c.json({ok:false,error:'El perfil cambió mientras guardabas. Actualiza e inténtalo nuevamente.'},409)
  const saved=await c.env.DB.prepare('SELECT specialty FROM medical_profiles WHERE id=?').bind(id).first()
  const persisted=String((saved as any)?.specialty||'')
  if(persisted!==combined)return c.json({ok:false,error:'No se pudo confirmar la escritura en D1.'},500)
  c.header('Cache-Control','no-store')
  return c.json({ok:true,data:{profile_id:id,slug:String(r.profile.slug||''),specialty:persisted,added:name}})
})
// Dedicated removal preserves the primary specialty and rejects concurrent edits.
app.delete('/api/v1/me/medical-profile/specialties',requireUser,async(c:any)=>{
  const r=await owned(c);if(!r)return c.json({ok:false,error:'Perfil médico no encontrado.'},404)
  const body=await c.req.json().catch(()=>({}))
  const target=clean(body.specialty,140)
  const before=String(r.profile.specialty||'')
  const items=before.split(' | ').map(x=>x.trim()).filter(Boolean)
  const index=items.findIndex((x,i)=>i>0&&x.toLocaleLowerCase('es')===target.toLocaleLowerCase('es'))
  if(index<0)return c.json({ok:false,error:'Especialidad adicional no encontrada.'},404)
  const next=items.filter((_,i)=>i!==index).join(' | ')
  const result:any=await c.env.DB.prepare("UPDATE medical_profiles SET specialty=?,updated_at=datetime('now') WHERE id=? AND specialty=?").bind(next,String(r.profile.id),before).run()
  if(Number(result?.meta?.changes||0)!==1)return c.json({ok:false,error:'El perfil cambió durante la operación. Actualiza y vuelve a intentarlo.'},409)
  const saved=await c.env.DB.prepare("SELECT specialty FROM medical_profiles WHERE id=?").bind(String(r.profile.id)).first()
  if(String((saved as any)?.specialty||'')!==next)return c.json({ok:false,error:'No se pudo verificar la eliminación.'},500)
  c.header('Cache-Control','no-store')
  return c.json({ok:true,data:{specialty:next}})
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
