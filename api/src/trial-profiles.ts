import { requireSuperAdmin, logAdminAction } from './lib/admin-auth'

const RESERVED = new Set(['edit','admin','api','ia','s','demo','new','nuevo','crear','master'])
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SOURCE_TYPES = new Set(['fair_event','commercial_visit','street_direct','whatsapp','instagram','web','referral','call','point_of_sale','other'])

const MASTER = {
  layout: 'impacto',
  colors: {
    primary:'#0C4A6E', secondary:'#0284C7', accent:'#0891B2', button:'#0284C7',
    background:'#F0F9FF', surface:'#FFFFFF', text:'#0F172A', heroGradient:'#0C4A6E'
  },
  profile: {
    id:'trial-master', slug:'trial', name:'Laura Gómez', role:'Profesional independiente',
    personalBadge:'Trial Kawvo Link', aboutTitle:'Sobre mí', portfolioTitle:'Mis trabajos',
    servicesTitle:'Mis servicios', servicesDescription:'Una muestra de lo que puedo hacer por ti.',
    bio:'Ayudo a mis clientes con soluciones prácticas, atención personalizada y un servicio pensado para sus necesidades.',
    phone:'18090000000', whatsapp:'18090000000', email:'', whatsappGreetingName:'Laura',
    whatsappCtaLabel:'Hablar por WhatsApp', instagram:'kawvolink', location:'Parque Duarte, Samaná',
    portrait:'/assets/free-starter/servicios-profesionales/servicios-profesionales-01.webp',
    hero:'/assets/free-starter/servicios-profesionales/servicios-profesionales-01.webp',
    heroPositionX:50, heroPositionY:50, heroZoom:1, category:'Trial', vcardFileName:'kawvo-trial.vcf',
    quickActions:[
      {type:'call',label:'Llamar',url:'tel:+18090000000'},
      {type:'instagram',label:'Instagram',url:'https://instagram.com/kawvolink'},
      {type:'location',label:'Ubicación',url:'https://www.google.com/maps/search/?api=1&query=Parque+Duarte+Samana'}
    ],
    services:[
      {id:'trial-service-1',title:'Asesoría personalizada',description:'Una solución pensada para lo que necesitas.',image:'/assets/free-starter/servicios-profesionales/servicios-profesionales-03.webp',iconKey:'handshake'},
      {id:'trial-service-2',title:'Consultoría profesional',description:'Acompañamiento claro para tomar mejores decisiones.',image:'/assets/free-starter/servicios-profesionales/servicios-profesionales-04.webp',iconKey:'chart-line'},
      {id:'trial-service-3',title:'Atención especializada',description:'Un servicio directo, profesional y cercano.',image:'/assets/free-starter/servicios-profesionales/servicios-profesionales-05.webp',iconKey:'handshake'}
    ],
    portfolio:[2,3,4,5,6].map((n,i)=>({id:`trial-work-${i+1}`,title:`Trabajo ${i+1}`,description:'Ejemplo visual de trabajos, proyectos o productos.',image:`/assets/free-starter/servicios-profesionales/servicios-profesionales-0${n}.webp`})),
    customLinks:[]
  }
}

function normalizeSlug(input: unknown) {
  return String(input || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60)
}
function validSlug(slug:string){return slug.length>=2 && slug.length<=60 && SLUG_RE.test(slug) && !RESERVED.has(slug)}
function parseJson(value:any){try{return JSON.parse(String(value||'{}'))}catch{return {}}}
function str(value:any,max=180){return String(value||'').trim().slice(0,max)}
function durationHours(value:any,fallback=72){const n=Math.round(Number(value));return Number.isFinite(n)?Math.min(720,Math.max(1,n)):fallback}
function sqlDate(d:Date){return d.toISOString().replace('T',' ').replace('Z','')}
function prospectFromRow(row:any){
  return {
    contact_name:str(row.contact_name,120),
    phone:str(row.contact_phone,40),
    whatsapp:str(row.contact_whatsapp,40),
    email:str(row.contact_email,160),
    instagram:str(row.contact_instagram,100),
    company_name:str(row.company_name,160),
    company_type:str(row.company_type,120),
    source:str(row.contact_source,60),
    source_detail:str(row.contact_source_detail,180),
    notes:str(row.prospect_notes,1200),
  }
}
function normalizeProspect(input:any){
  const sourceRaw=str(input?.source,60)
  return {
    contact_name:str(input?.contact_name,120),
    phone:str(input?.phone,40),
    whatsapp:str(input?.whatsapp,40),
    email:str(input?.email,160),
    instagram:str(input?.instagram,100),
    company_name:str(input?.company_name,160),
    company_type:str(input?.company_type,120),
    source:SOURCE_TYPES.has(sourceRaw)?sourceRaw:(sourceRaw?'other':''),
    source_detail:str(input?.source_detail,180),
    notes:str(input?.notes,1200),
  }
}
function rowOut(row:any){
  const expired = row.status === 'expired' || (row.status === 'active' && row.expires_at && Date.parse(String(row.expires_at).replace(' ','T')+'Z') <= Date.now())
  return {
    id:row.id,slug:row.slug,name:row.name,status:expired?'expired':row.status,
    profile:parseJson(row.profile_json),
    duration_hours:durationHours(row.duration_hours,72),
    prospect:prospectFromRow(row),
    activated_at:row.activated_at,expires_at:row.expires_at,created_at:row.created_at,updated_at:row.updated_at
  }
}
function assetUrl(c:any,key:string){const origin=new URL(c.req.url).origin;return `${origin}/api/v1/public/assets/${key.split('/').map(encodeURIComponent).join('/')}`}
function ext(file:File){const t:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};return t[file.type]||''}
async function addEvent(c:any,trialId:string,eventType:string,details:any={}){
  const adminUserId=String(c.get?.('adminUserId')||'')
  await c.env.DB.prepare(`INSERT INTO trial_events(id,trial_id,event_type,details_json,created_by_admin_user_id) VALUES(?,?,?,?,?)`)
    .bind(crypto.randomUUID(),trialId,eventType,JSON.stringify(details||{}),adminUserId||null).run()
}
export async function expireDueTrials(env:any){
  if(!env?.DB)return
  await env.DB.prepare(`UPDATE trial_profiles SET status='expired',updated_at=datetime('now') WHERE status='active' AND expires_at IS NOT NULL AND expires_at<=datetime('now')`).run()
}

export function registerTrialRoutes(app:any){
  app.get('/api/v1/superadmin/trials/context', requireSuperAdmin('super_admin'), async (c:any) => {
    return c.json({ok:true,role:c.get('adminRole')})
  })

  app.get('/api/v1/public/trials/master', (c:any) => c.json({ok:true,data:MASTER}))

  app.get('/api/v1/superadmin/trials', requireSuperAdmin('super_admin'), async (c:any) => {
    await expireDueTrials(c.env)
    const page=Math.max(1,Number(c.req.query('page')||1))
    const pageSize=Math.min(50,Math.max(5,Number(c.req.query('page_size')||20)))
    const status=str(c.req.query('status'),20)
    const q=str(c.req.query('q'),100).toLowerCase()
    const source=str(c.req.query('source'),60)
    const companyType=str(c.req.query('company_type'),120)
    const where:string[]=[]; const binds:any[]=[]
    if(['draft','active','expired'].includes(status)){where.push('status=?');binds.push(status)}
    if(source){where.push('contact_source=?');binds.push(source)}
    if(companyType){where.push('lower(company_type) LIKE ?');binds.push(`%${companyType.toLowerCase()}%`)}
    if(q){
      where.push(`(lower(COALESCE(name,'')) LIKE ? OR lower(COALESCE(slug,'')) LIKE ? OR lower(COALESCE(contact_name,'')) LIKE ? OR lower(COALESCE(contact_phone,'')) LIKE ? OR lower(COALESCE(contact_whatsapp,'')) LIKE ? OR lower(COALESCE(contact_email,'')) LIKE ? OR lower(COALESCE(company_name,'')) LIKE ?)`)
      for(let i=0;i<7;i++)binds.push(`%${q}%`)
    }
    const clause=where.length?`WHERE ${where.join(' AND ')}`:''
    const count=await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM trial_profiles ${clause}`).bind(...binds).first()
    const rows=await c.env.DB.prepare(`SELECT * FROM trial_profiles ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`).bind(...binds,pageSize,(page-1)*pageSize).all()
    return c.json({ok:true,data:{items:(rows.results||[]).map(rowOut),page,page_size:pageSize,total:Number((count as any)?.n||0),pages:Math.max(1,Math.ceil(Number((count as any)?.n||0)/pageSize))}})
  })

  app.post('/api/v1/superadmin/trials', requireSuperAdmin('super_admin'), async (c:any) => {
    const id=crypto.randomUUID(); const adminUserId=String(c.get('adminUserId')||'')
    let body:any={}; try{body=await c.req.json()}catch{body={}}
    const snapshot=JSON.parse(JSON.stringify(MASTER)); snapshot.profile.id=id; snapshot.profile.slug=''
    snapshot.modules={banks:{enabled:Boolean(body?.modules?.banks),items:[]}}
    const prospect=normalizeProspect(body?.prospect||{})
    const duration=durationHours(body?.duration_hours,72)
    await c.env.DB.prepare(`INSERT INTO trial_profiles(
      id,status,profile_json,created_by_admin_user_id,duration_hours,
      contact_name,contact_phone,contact_whatsapp,contact_email,contact_instagram,
      company_name,company_type,contact_source,contact_source_detail,prospect_notes
    ) VALUES(?,'draft',?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
      id,JSON.stringify(snapshot),adminUserId,duration,
      prospect.contact_name,prospect.phone,prospect.whatsapp,prospect.email,prospect.instagram,
      prospect.company_name,prospect.company_type,prospect.source,prospect.source_detail,prospect.notes
    ).run()
    await addEvent(c,id,'trial.created',{status:'draft',duration_hours:duration,source:prospect.source}).catch(()=>undefined)
    await logAdminAction({db:c.env.DB,adminUserId,action:'trial.create',targetType:'profile',targetId:id,after:{status:'draft',duration_hours:duration}}).catch(()=>undefined)
    return c.json({ok:true,data:{id,status:'draft',duration_hours:duration}},201)
  })

  app.get('/api/v1/superadmin/trials/:id/events', requireSuperAdmin('super_admin'), async (c:any) => {
    const rows=await c.env.DB.prepare('SELECT id,event_type,details_json,created_at FROM trial_events WHERE trial_id=? ORDER BY created_at DESC LIMIT 100').bind(c.req.param('id')).all()
    return c.json({ok:true,data:(rows.results||[]).map((r:any)=>({...r,details:parseJson(r.details_json)}))})
  })

  app.get('/api/v1/superadmin/trials/:id', requireSuperAdmin('super_admin'), async (c:any) => {
    await expireDueTrials(c.env)
    const row=await c.env.DB.prepare('SELECT * FROM trial_profiles WHERE id=? LIMIT 1').bind(c.req.param('id')).first()
    if(!row)return c.json({ok:false,error:'Trial no encontrado.'},404)
    return c.json({ok:true,data:rowOut(row)})
  })

  app.patch('/api/v1/superadmin/trials/:id', requireSuperAdmin('super_admin'), async (c:any) => {
    const id=c.req.param('id'); const existing=await c.env.DB.prepare('SELECT * FROM trial_profiles WHERE id=? LIMIT 1').bind(id).first()
    if(!existing)return c.json({ok:false,error:'Trial no encontrado.'},404)
    let body:any; try{body=await c.req.json()}catch{return c.json({ok:false,error:'JSON inválido.'},400)}
    const sets:string[]=[]; const values:any[]=[]
    if(body?.profile!==undefined){
      if(!body.profile || typeof body.profile!=='object' || Array.isArray(body.profile))return c.json({ok:false,error:'Perfil inválido.'},400)
      const encoded=JSON.stringify(body.profile)
      if(encoded.length>180000)return c.json({ok:false,error:'El perfil supera el tamaño permitido.'},413)
      sets.push('profile_json=?');values.push(encoded)
    }
    if(body?.prospect!==undefined){
      const p=normalizeProspect(body.prospect)
      sets.push('contact_name=?','contact_phone=?','contact_whatsapp=?','contact_email=?','contact_instagram=?','company_name=?','company_type=?','contact_source=?','contact_source_detail=?','prospect_notes=?')
      values.push(p.contact_name,p.phone,p.whatsapp,p.email,p.instagram,p.company_name,p.company_type,p.source,p.source_detail,p.notes)
    }
    if(body?.duration_hours!==undefined){
      if((existing as any).activated_at)return c.json({ok:false,error:'La duración de un Trial publicado se gestiona con Extender Trial.'},409)
      const duration=durationHours(body.duration_hours,72);sets.push('duration_hours=?');values.push(duration)
    }
    if(!sets.length)return c.json({ok:false,error:'No hay cambios para guardar.'},400)
    sets.push(`updated_at=datetime('now')`)
    await c.env.DB.prepare(`UPDATE trial_profiles SET ${sets.join(',')} WHERE id=?`).bind(...values,id).run()
    if(body?.prospect!==undefined)await addEvent(c,id,'prospect.updated',{source:normalizeProspect(body.prospect).source}).catch(()=>undefined)
    if(body?.duration_hours!==undefined)await addEvent(c,id,'duration.updated',{duration_hours:durationHours(body.duration_hours,72)}).catch(()=>undefined)
    return c.json({ok:true,data:{id,updated_at:new Date().toISOString()}})
  })

  app.get('/api/v1/superadmin/trials/slug/:slug', requireSuperAdmin('super_admin'), async (c:any) => {
    const slug=normalizeSlug(c.req.param('slug'))
    if(!validSlug(slug))return c.json({ok:true,available:false,slug,reason:'invalid'})
    const trialId=str(c.req.query('trial_id'),80)
    const row=trialId
      ? await c.env.DB.prepare('SELECT id FROM trial_profiles WHERE slug=? AND id<>? LIMIT 1').bind(slug,trialId).first()
      : await c.env.DB.prepare('SELECT id FROM trial_profiles WHERE slug=? LIMIT 1').bind(slug).first()
    return c.json({ok:true,available:!row,slug})
  })

  app.post('/api/v1/superadmin/trials/:id/publish', requireSuperAdmin('super_admin'), async (c:any) => {
    const id=c.req.param('id'); let body:any; try{body=await c.req.json()}catch{return c.json({ok:false,error:'JSON inválido.'},400)}
    const existing=await c.env.DB.prepare('SELECT * FROM trial_profiles WHERE id=? LIMIT 1').bind(id).first()
    if(!existing)return c.json({ok:false,error:'Trial no encontrado.'},404)
    const name=str(body?.name,100)
    if(!name)return c.json({ok:false,error:'Escribe un nombre para el Trial.'},400)
    const currentSlug=str((existing as any).slug,60)
    const requestedSlug=normalizeSlug(body?.slug||name)
    if(currentSlug && requestedSlug && requestedSlug!==currentSlug)return c.json({ok:false,error:'El slug de un Trial publicado es permanente.',code:'slug_locked'},409)
    const slug=currentSlug||requestedSlug
    if(!validSlug(slug))return c.json({ok:false,error:'Slug no válido o reservado.'},400)
    const duplicate=await c.env.DB.prepare('SELECT id FROM trial_profiles WHERE slug=? AND id<>? LIMIT 1').bind(slug,id).first()
    if(duplicate)return c.json({ok:false,error:'Ese slug ya está en uso.',code:'slug_taken'},409)

    let activatedAt=str((existing as any).activated_at,40); let expiresAt=str((existing as any).expires_at,40)
    const firstPublish=!activatedAt
    if(firstPublish){
      const now=new Date(); activatedAt=sqlDate(now)
      expiresAt=sqlDate(new Date(now.getTime()+durationHours((existing as any).duration_hours,72)*60*60*1000))
    }
    const snapshot=parseJson((existing as any).profile_json)
    if(snapshot.profile){snapshot.profile.slug=slug;snapshot.profile.vcardFileName=`${slug}.vcf`}
    await c.env.DB.prepare(`UPDATE trial_profiles SET slug=?,name=?,status=CASE WHEN expires_at IS NOT NULL AND expires_at<=datetime('now') THEN 'expired' ELSE 'active' END,profile_json=?,activated_at=?,expires_at=?,updated_at=datetime('now') WHERE id=?`)
      .bind(slug,name,JSON.stringify(snapshot),activatedAt,expiresAt,id).run()
    const adminUserId=String(c.get('adminUserId')||'')
    if(firstPublish)await addEvent(c,id,'trial.published',{slug,activated_at:activatedAt,expires_at:expiresAt,duration_hours:durationHours((existing as any).duration_hours,72)}).catch(()=>undefined)
    await logAdminAction({db:c.env.DB,adminUserId,action:firstPublish?'trial.publish':'trial.save',targetType:'profile',targetId:id,after:{slug,expires_at:expiresAt}}).catch(()=>undefined)
    return c.json({ok:true,data:{id,slug,name,status:Date.parse(expiresAt.replace(' ','T')+'Z')<=Date.now()?'expired':'active',activated_at:activatedAt,expires_at:expiresAt,url:`/trial/${slug}`}})
  })

  app.post('/api/v1/superadmin/trials/:id/extend', requireSuperAdmin('super_admin'), async (c:any) => {
    const id=c.req.param('id'); const existing=await c.env.DB.prepare('SELECT * FROM trial_profiles WHERE id=? LIMIT 1').bind(id).first()
    if(!existing)return c.json({ok:false,error:'Trial no encontrado.'},404)
    if(!(existing as any).activated_at)return c.json({ok:false,error:'El Trial todavía no ha sido publicado.'},409)
    let body:any={};try{body=await c.req.json()}catch{return c.json({ok:false,error:'JSON inválido.'},400)}
    const previous=str((existing as any).expires_at,40)
    let nextDate:Date
    if(body?.expires_at){
      nextDate=new Date(String(body.expires_at))
      if(Number.isNaN(nextDate.getTime()))return c.json({ok:false,error:'Fecha de vencimiento inválida.'},400)
    }else{
      const hours=durationHours(body?.hours,24)
      const base=Math.max(Date.now(),Date.parse(previous.replace(' ','T')+'Z')||Date.now())
      nextDate=new Date(base+hours*60*60*1000)
    }
    if(nextDate.getTime()<=Date.now())return c.json({ok:false,error:'El nuevo vencimiento debe quedar en el futuro.'},400)
    const next=sqlDate(nextDate)
    await c.env.DB.prepare(`UPDATE trial_profiles SET status='active',expires_at=?,updated_at=datetime('now') WHERE id=?`).bind(next,id).run()
    await addEvent(c,id,'trial.extended',{previous_expires_at:previous,expires_at:next,hours:body?.hours||null}).catch(()=>undefined)
    return c.json({ok:true,data:{id,status:'active',expires_at:next}})
  })

  app.post('/api/v1/superadmin/trials/:id/media', requireSuperAdmin('super_admin'), async (c:any) => {
    const id=c.req.param('id'); const row=await c.env.DB.prepare('SELECT id FROM trial_profiles WHERE id=? LIMIT 1').bind(id).first()
    if(!row)return c.json({ok:false,error:'Trial no encontrado.'},404)
    const kind=String(c.req.query('kind')||'gallery'); if(!['avatar','hero','gallery'].includes(kind))return c.json({ok:false,error:'Tipo de imagen no válido.'},400)
    const fd=await c.req.formData(); const raw=fd.get('file')
    if(!(raw && typeof raw==='object' && 'stream' in (raw as any)))return c.json({ok:false,error:'Archivo requerido.'},400)
    const file=raw as File; const extension=ext(file)
    if(!extension)return c.json({ok:false,error:'Usa JPG, PNG o WEBP.'},400)
    if(Number(file.size||0)>8*1024*1024)return c.json({ok:false,error:'La imagen supera 8 MB.'},413)
    const key=`trials/${id}/${kind}/${crypto.randomUUID()}.${extension}`
    await c.env.BUCKET.put(key,file.stream(),{httpMetadata:{contentType:file.type}})
    return c.json({ok:true,url:assetUrl(c,key),key})
  })

  app.get('/api/v1/public/trials/:slug/banks/:bankId/holder-id', async (c:any) => {
    const slug=normalizeSlug(c.req.param('slug')); if(!validSlug(slug))return c.json({ok:false,error:'Trial no encontrado.'},404)
    const row=await c.env.DB.prepare('SELECT * FROM trial_profiles WHERE slug=? LIMIT 1').bind(slug).first()
    if(!row || (row as any).status==='draft')return c.json({ok:false,error:'Trial no encontrado.'},404)
    const data=rowOut(row)
    if(data.status==='expired')return c.json({ok:false,error:'Trial finalizado.'},410)
    const snapshot=parseJson((row as any).profile_json)
    const banks=Array.isArray(snapshot?.modules?.banks?.items)?snapshot.modules.banks.items:[]
    const account=banks.find((item:any)=>String(item?.id||'')===c.req.param('bankId'))
    const value=String(account?.holder_id_number||'').replace(/\D/g,'')
    if(!account || !value)return c.json({ok:false,error:'Dato no disponible.'},404)
    return c.json({ok:true,data:{copy_value:value}})
  })

  app.get('/api/v1/public/trials/:slug', async (c:any) => {
    const slug=normalizeSlug(c.req.param('slug')); if(!validSlug(slug))return c.json({ok:false,error:'Trial no encontrado.'},404)
    const row=await c.env.DB.prepare('SELECT * FROM trial_profiles WHERE slug=? LIMIT 1').bind(slug).first()
    if(!row || (row as any).status==='draft')return c.json({ok:false,error:'Trial no encontrado.'},404)
    const data=rowOut(row)
    const publicProfile=JSON.parse(JSON.stringify(data.profile||{}))
    const bankItems=publicProfile?.modules?.banks?.items
    if(Array.isArray(bankItems))for(const item of bankItems)delete item.holder_id_number
    data.profile=publicProfile
    delete (data as any).prospect
    if(data.status==='expired' && (row as any).status!=='expired')c.executionCtx.waitUntil(c.env.DB.prepare(`UPDATE trial_profiles SET status='expired',updated_at=datetime('now') WHERE id=? AND status='active'`).bind((row as any).id).run())
    return c.json({ok:true,data})
  })
}
