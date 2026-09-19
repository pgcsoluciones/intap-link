import app from './index'
import { requireSuperAdmin, logAdminAction } from './lib/admin-auth'

const RESERVED = new Set(['edit','admin','api','ia','s','demo','new','nuevo','crear','master'])
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

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
function rowOut(row:any){
  const expired = row.status === 'expired' || (row.status === 'active' && row.expires_at && Date.parse(row.expires_at+'Z') <= Date.now())
  return {id:row.id,slug:row.slug,name:row.name,status:expired?'expired':row.status,profile:parseJson(row.profile_json),activated_at:row.activated_at,expires_at:row.expires_at,created_at:row.created_at,updated_at:row.updated_at}
}
function assetUrl(c:any,key:string){const origin=new URL(c.req.url).origin;return `${origin}/api/v1/public/assets/${key.split('/').map(encodeURIComponent).join('/')}`}
function ext(file:File){const t:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};return t[file.type]||''}

app.get('/api/v1/superadmin/trials/context', requireSuperAdmin('super_admin'), async c => {
  return c.json({ok:true,role:c.get('adminRole')})
})

app.get('/api/v1/public/trials/master', c => c.json({ok:true,data:MASTER}))

app.post('/api/v1/superadmin/trials', requireSuperAdmin('super_admin'), async c => {
  const id=crypto.randomUUID(); const adminUserId=String(c.get('adminUserId')||'')
  let body:any={}; try{body=await c.req.json()}catch{body={}}
  const snapshot=JSON.parse(JSON.stringify(MASTER)); snapshot.profile.id=id; snapshot.profile.slug=''
  snapshot.modules={banks:{enabled:Boolean(body?.modules?.banks),items:[]}}
  await c.env.DB.prepare(`INSERT INTO trial_profiles(id,status,profile_json,created_by_admin_user_id) VALUES(?,'draft',?,?)`).bind(id,JSON.stringify(snapshot),adminUserId).run()
  await logAdminAction({db:c.env.DB,adminUserId,action:'trial.create',targetType:'profile',targetId:id,after:{status:'draft'}}).catch(()=>undefined)
  return c.json({ok:true,data:{id,status:'draft'}},201)
})

app.get('/api/v1/superadmin/trials/:id', requireSuperAdmin('super_admin'), async c => {
  const row=await c.env.DB.prepare('SELECT * FROM trial_profiles WHERE id=? LIMIT 1').bind(c.req.param('id')).first()
  if(!row)return c.json({ok:false,error:'Trial no encontrado.'},404)
  return c.json({ok:true,data:rowOut(row)})
})

app.patch('/api/v1/superadmin/trials/:id', requireSuperAdmin('super_admin'), async c => {
  const id=c.req.param('id'); const existing=await c.env.DB.prepare('SELECT * FROM trial_profiles WHERE id=? LIMIT 1').bind(id).first()
  if(!existing)return c.json({ok:false,error:'Trial no encontrado.'},404)
  let body:any; try{body=await c.req.json()}catch{return c.json({ok:false,error:'JSON inválido.'},400)}
  if(!body || typeof body.profile!=='object' || Array.isArray(body.profile))return c.json({ok:false,error:'Perfil inválido.'},400)
  const encoded=JSON.stringify(body.profile)
  if(encoded.length>180000)return c.json({ok:false,error:'El perfil supera el tamaño permitido.'},413)
  await c.env.DB.prepare(`UPDATE trial_profiles SET profile_json=?,updated_at=datetime('now') WHERE id=?`).bind(encoded,id).run()
  return c.json({ok:true,data:{id,updated_at:new Date().toISOString()}})
})

app.get('/api/v1/superadmin/trials/slug/:slug', requireSuperAdmin('super_admin'), async c => {
  const slug=normalizeSlug(c.req.param('slug'))
  if(!validSlug(slug))return c.json({ok:true,available:false,slug,reason:'invalid'})
  const row=await c.env.DB.prepare('SELECT id FROM trial_profiles WHERE slug=? LIMIT 1').bind(slug).first()
  return c.json({ok:true,available:!row,slug})
})

app.post('/api/v1/superadmin/trials/:id/publish', requireSuperAdmin('super_admin'), async c => {
  const id=c.req.param('id'); let body:any; try{body=await c.req.json()}catch{return c.json({ok:false,error:'JSON inválido.'},400)}
  const name=String(body?.name||'').trim().slice(0,100); const slug=normalizeSlug(body?.slug||name)
  if(!name)return c.json({ok:false,error:'Escribe un nombre para el Trial.'},400)
  if(!validSlug(slug))return c.json({ok:false,error:'Slug no válido o reservado.'},400)
  const existing=await c.env.DB.prepare('SELECT * FROM trial_profiles WHERE id=? LIMIT 1').bind(id).first()
  if(!existing)return c.json({ok:false,error:'Trial no encontrado.'},404)
  const duplicate=await c.env.DB.prepare('SELECT id FROM trial_profiles WHERE slug=? AND id<>? LIMIT 1').bind(slug,id).first()
  if(duplicate)return c.json({ok:false,error:'Ese slug ya está en uso.',code:'slug_taken'},409)
  const current=rowOut(existing)
  let activatedAt=String((existing as any).activated_at||''); let expiresAt=String((existing as any).expires_at||'')
  if(!activatedAt){
    const now=new Date(); activatedAt=now.toISOString().replace('T',' ').replace('Z',''); expiresAt=new Date(now.getTime()+72*60*60*1000).toISOString().replace('T',' ').replace('Z','')
  }
  const snapshot=parseJson((existing as any).profile_json); if(snapshot.profile){snapshot.profile.slug=slug;snapshot.profile.vcardFileName=`${slug}.vcf`}
  await c.env.DB.prepare(`UPDATE trial_profiles SET slug=?,name=?,status='active',profile_json=?,activated_at=?,expires_at=?,updated_at=datetime('now') WHERE id=?`).bind(slug,name,JSON.stringify(snapshot),activatedAt,expiresAt,id).run()
  const adminUserId=String(c.get('adminUserId')||'')
  await logAdminAction({db:c.env.DB,adminUserId,action:'trial.publish',targetType:'profile',targetId:id,before:{status:current.status},after:{status:'active',slug,expires_at:expiresAt}}).catch(()=>undefined)
  return c.json({ok:true,data:{id,slug,name,status:'active',activated_at:activatedAt,expires_at:expiresAt,url:`/trial/${slug}`}})
})

app.post('/api/v1/superadmin/trials/:id/media', requireSuperAdmin('super_admin'), async c => {
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

app.get('/api/v1/public/trials/:slug/banks/:bankId/holder-id', async c => {
  const slug=normalizeSlug(c.req.param('slug')); if(!validSlug(slug))return c.json({ok:false,error:'Trial no encontrado.'},404)
  const row=await c.env.DB.prepare('SELECT * FROM trial_profiles WHERE slug=? LIMIT 1').bind(slug).first()
  if(!row || (row as any).status==='draft')return c.json({ok:false,error:'Trial no encontrado.'},404)
  const snapshot=parseJson((row as any).profile_json)
  const banks=Array.isArray(snapshot?.modules?.banks?.items)?snapshot.modules.banks.items:[]
  const account=banks.find((item:any)=>String(item?.id||'')===c.req.param('bankId'))
  const value=String(account?.holder_id_number||'').replace(/\D/g,'')
  if(!account || !value)return c.json({ok:false,error:'Dato no disponible.'},404)
  return c.json({ok:true,data:{copy_value:value}})
})

app.get('/api/v1/public/trials/:slug', async c => {
  const slug=normalizeSlug(c.req.param('slug')); if(!validSlug(slug))return c.json({ok:false,error:'Trial no encontrado.'},404)
  const row=await c.env.DB.prepare('SELECT * FROM trial_profiles WHERE slug=? LIMIT 1').bind(slug).first()
  if(!row || (row as any).status==='draft')return c.json({ok:false,error:'Trial no encontrado.'},404)
  const data=rowOut(row)
  const publicProfile=JSON.parse(JSON.stringify(data.profile||{}))
  const bankItems=publicProfile?.modules?.banks?.items
  if(Array.isArray(bankItems))for(const item of bankItems)delete item.holder_id_number
  data.profile=publicProfile
  if(data.status==='expired' && (row as any).status!=='expired')c.executionCtx.waitUntil(c.env.DB.prepare(`UPDATE trial_profiles SET status='expired',updated_at=datetime('now') WHERE id=? AND status='active'`).bind((row as any).id).run())
  return c.json({ok:true,data})
})

export default app
