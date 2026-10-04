import app from './index'
import { requireSuperAdmin, logAdminAction } from './lib/admin-auth'
import { isPreviewEnvironment } from './lib/cookies'
import { FREE_DEMO_V2_FREE_DEMO_V2_CLAIM_EMAIL, freeDemoClaimCookie, getActiveFreeDemoClaim } from './free-demo-claim-core'
import { getAppointmentSettings, getAppointmentAvailabilityRows, saveAppointmentConfiguration } from './appointments-core'
import { resolveFreeStarterContent, FREE_PROFILE_CATEGORIES } from '../../shared/free-profile-starter-content'
import { FREE_PROFILE_STARTER_ASSETS } from '../../shared/free-profile-starter-assets'

const MAX_PORTFOLIO=10
const MAX_QUICK_ACTIONS=3
const MAX_LINKS=3
const PALETTES=new Set(['intap','oceano','esmeralda','violeta','coral','grafito','arena','personalizada'])
const LAYOUTS=new Set(['impacto','personal','esencial'])
const QUICK_TYPES=new Set(['call','instagram','location','email','tiktok'])
const RESERVED=new Set(['admin','api','app','www','superadmin','support','demo','trial','p','l','free-demo'])

type TemplateDef={key:string;label:string;hint:string;category:string;subcategory:string}

const SPECIAL_TEMPLATES:TemplateDef[]=[
  {key:'ferreteria',label:'Ferretería',hint:'Herramientas, materiales, plomería, hogar y proyectos.',category:'Construcción e ingeniería',subcategory:'Ferretería'},
  {key:'taller-automotriz',label:'Taller automotriz / Mecánica',hint:'Mecánica, diagnóstico, mantenimiento y cuidado del vehículo.',category:'Automotriz y mecánica',subcategory:'Taller automotriz / Mecánica'},
  {key:'salon-belleza',label:'Belleza / Salón',hint:'Peluquería, uñas, estética y cuidado personal.',category:'Belleza y estética',subcategory:'Belleza / Salón'},
  {key:'restaurante-reposteria',label:'Restaurante / Repostería',hint:'Comida, cafetería, catering y repostería.',category:'Gastronomía y alimentos',subcategory:'Restaurante / Repostería'},
  {key:'serigrafia-impresion',label:'Diseño / Serigrafía / Impresión',hint:'Diseño gráfico, impresión, branding y producción.',category:'Arte, diseño y creatividad',subcategory:'Diseño / Serigrafía / Impresión'},
  {key:'tecnicos-instalaciones',label:'Técnicos / Instalaciones',hint:'Electricidad, plomería, A/C y mantenimiento.',category:'Mantenimiento e instalaciones técnicas',subcategory:'Técnicos / Instalaciones'},
  {key:'inmobiliaria',label:'Inmobiliaria',hint:'Venta, alquiler y gestión de propiedades.',category:'Inmobiliaria y propiedades',subcategory:'Inmobiliaria'},
  {key:'tienda-comercio',label:'Tienda / Comercio',hint:'Productos, ventas, retail y tiendas virtuales.',category:'Comercio, retail y tiendas virtuales',subcategory:'Tienda / Comercio'},
  {key:'servicios-profesionales',label:'Servicios profesionales',hint:'Abogados, contables, consultores y asesores.',category:'Servicios profesionales',subcategory:'Servicios profesionales'},
  {key:'eventos',label:'Eventos / Entretenimiento',hint:'Decoración, producción, fotografía y actividades.',category:'Eventos y entretenimiento',subcategory:'Eventos / Entretenimiento'},
  {key:'artesania',label:'Artesanía / Creativos',hint:'Crochet, manualidades, arte y productos hechos a mano.',category:'Artesanía y productos hechos a mano',subcategory:'Artesanía / Creativos'},
]
const categoryTemplates:TemplateDef[]=FREE_PROFILE_CATEGORIES
  .filter(category=>!SPECIAL_TEMPLATES.some(item=>item.category===category))
  .map(category=>({key:'categoria-'+slugify(category),label:category,hint:resolveFreeStarterContent(category).heroLabel,category,subcategory:category}))
export const FREE_DEMO_V2_TEMPLATES=[...SPECIAL_TEMPLATES,...categoryTemplates]

function slugify(value:unknown){
  return String(value??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60)
}
function validSlug(slug:string){return slug.length>=2&&slug.length<=60&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)&&!RESERVED.has(slug)}
function cleanText(value:unknown,max=500){return String(value??'').trim().slice(0,max)}
function parseJson(value:unknown){try{const v=JSON.parse(String(value||'{}'));return v&&typeof v==='object'&&!Array.isArray(v)?v:{}}catch{return {}}}
function webOrigin(c:any){return String(c.env.WEB_URL||(isPreviewEnvironment(c.env)?'https://preview.intaprd.com':'https://intaprd.com')).replace(/\/$/,'')}
function appOrigin(c:any){return String(c.env.APP_URL||(isPreviewEnvironment(c.env)?'https://app.preview.intaprd.com':'https://app.intaprd.com')).replace(/\/$/,'')}
function absoluteAsset(c:any,path:string){return /^https?:\/\//i.test(path)?path:webOrigin(c)+path}
function randomClaimCode(){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',bytes=crypto.getRandomValues(new Uint8Array(12));const raw=Array.from(bytes).map(x=>alphabet[x%alphabet.length]).join('');return 'CLM-'+raw.slice(0,4)+'-'+raw.slice(4,8)+'-'+raw.slice(8,12)}
async function sha256Hex(input:string){const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input));return Array.from(new Uint8Array(h)).map(b=>b.toString(16).padStart(2,'0')).join('')}
function templateByKey(key:string){return FREE_DEMO_V2_TEMPLATES.find(item=>item.key===key)}
function templatePreview(c:any,item:TemplateDef){
  const starter=resolveFreeStarterContent(item.category)
  const assets=[...((FREE_PROFILE_STARTER_ASSETS as Record<string,readonly string[]>)[starter.category]||[])]
  return{...item,role:starter.role,bio:starter.bio,palette:starter.recommendedPalette,hero_url:absoluteAsset(c,assets[0]||''),avatar_url:absoluteAsset(c,assets[1]||assets[0]||''),portfolio:assets.slice(2,7).map(asset=>absoluteAsset(c,asset))}
}
async function demoRow(c:any,id:string){
  return c.env.DB.prepare("SELECT d.*,p.slug,p.name,p.bio,p.category,p.subcategory,p.layout_id,p.free_palette_id,p.free_brand_color,p.avatar_url,p.hero_url,p.hero_position_x,p.hero_position_y,p.hero_zoom,p.template_data,p.is_published FROM free_demo_v2_profiles d JOIN profiles p ON p.id=d.profile_id WHERE d.id=? LIMIT 1").bind(id).first()
}

app.get('/api/v1/superadmin/free-demo-v2/templates',requireSuperAdmin('viewer'),async(c:any)=>{
  return c.json({ok:true,data:FREE_DEMO_V2_TEMPLATES.map(item=>templatePreview(c,item))})
})

app.get('/api/v1/superadmin/free-demo-v2',requireSuperAdmin('viewer'),async(c:any)=>{
  const rows=await c.env.DB.prepare("SELECT d.id,d.profile_id,d.template_key,d.template_label,d.status,d.published_at,d.claimed_at,d.created_at,p.name,p.slug,p.is_published,p.hero_url FROM free_demo_v2_profiles d JOIN profiles p ON p.id=d.profile_id ORDER BY d.created_at DESC").all()
  return c.json({ok:true,data:rows.results||[]})
})

app.post('/api/v1/superadmin/free-demo-v2',requireSuperAdmin('super_admin'),async(c:any)=>{
  let body:any={};try{body=await c.req.json()}catch{return c.json({ok:false,error:'JSON inválido.'},400)}
  const def=templateByKey(cleanText(body.template_key,80))
  if(!def)return c.json({ok:false,error:'Plantilla base no válida.'},400)
  const starter=resolveFreeStarterContent(def.category)
  const assets=[...((FREE_PROFILE_STARTER_ASSETS as Record<string,readonly string[]>)[starter.category]||[])]
  if(assets.length<3)return c.json({ok:false,error:'El banco gráfico de este rubro está incompleto.'},409)

  const demoId=crypto.randomUUID(),profileId=crypto.randomUUID(),ownerId=crypto.randomUUID()
  const internalSlug='demo-draft-'+demoId.replace(/-/g,'').slice(0,16)
  const syntheticEmail='free-demo-v2+'+profileId+'@internal.kawvo.invalid'
  const hero=absoluteAsset(c,assets[0]),avatar=absoluteAsset(c,assets[1]||assets[0])
  const portfolio=assets.slice(2,12).slice(0,MAX_PORTFOLIO)
  const map='https://www.google.com/maps/search/?api=1&query=Santo+Domingo%2C+Rep%C3%BAblica+Dominicana'
  const templateData={
    role:def.subcategory||starter.role,
    portfolio_title:'Mis trabajos',
    free_schedule_visible:true,
    free_quote_button_visible:true,
    free_schedule_configured:true,
    free_schedule:[{day:'Lunes a Viernes',hours:'8:00 AM - 6:00 PM'},{day:'Sábados',hours:'9:00 AM - 1:00 PM'}],
    free_demo_v2:true,
    free_demo_v2_template_key:def.key,
    free_demo_v2_template_label:def.label,
  }
  const adminUserId=String(c.get('adminUserId')||'')
  const statements:any[]=[
    c.env.DB.prepare('INSERT INTO users(id,email) VALUES(?,?)').bind(ownerId,syntheticEmail),
    c.env.DB.prepare("INSERT INTO profiles(id,user_id,slug,plan_id,theme_id,layout_id,name,bio,category,subcategory,free_palette_id,avatar_url,hero_url,hero_position_x,hero_position_y,hero_zoom,template_data,is_published,is_active,created_at,updated_at) VALUES(?,?,?,'free','default','impacto',?,?,?,?,?,?,?,50,50,1,?,0,1,datetime('now'),datetime('now'))").bind(profileId,ownerId,internalSlug,'Tu nombre o negocio',starter.bio,starter.category,def.subcategory,starter.recommendedPalette,avatar,hero,JSON.stringify(templateData)),
    c.env.DB.prepare("INSERT INTO free_demo_v2_profiles(id,profile_id,synthetic_owner_user_id,template_key,template_label,status,created_by_admin_user_id) VALUES(?,?,?,?,?,'draft',?)").bind(demoId,profileId,ownerId,def.key,def.label,adminUserId||null),
    c.env.DB.prepare("INSERT INTO profile_contact(profile_id,whatsapp,email,phone,hours,address,map_url) VALUES(?,?,?,?,?,?,?) ON CONFLICT(profile_id) DO UPDATE SET whatsapp=excluded.whatsapp,email=excluded.email,phone=excluded.phone,address=excluded.address,map_url=excluded.map_url,updated_at=datetime('now')").bind(profileId,'18090000000','', '18090000000',null,'Santo Domingo, República Dominicana',map),
    c.env.DB.prepare("INSERT INTO profile_social_links(id,profile_id,type,url,sort_order,enabled) VALUES(?,?,'call','tel:+18090000000',0,1)").bind('demo-v2:'+demoId+':quick:call',profileId),
    c.env.DB.prepare("INSERT INTO profile_social_links(id,profile_id,type,url,sort_order,enabled) VALUES(?,?,'instagram','https://www.instagram.com/kawvolink',1,1)").bind('demo-v2:'+demoId+':quick:instagram',profileId),
    c.env.DB.prepare("INSERT INTO profile_social_links(id,profile_id,type,url,sort_order,enabled) VALUES(?,?,'location',?,2,1)").bind('demo-v2:'+demoId+':quick:location',profileId,map),
    c.env.DB.prepare("INSERT INTO appointment_settings(subject_type,subject_id,enabled,slot_minutes,min_notice_minutes,horizon_days,timezone,reason_mode,created_at,updated_at) VALUES('free',?,1,30,120,30,'America/Santo_Domingo','default',datetime('now'),datetime('now'))").bind(profileId),
    c.env.DB.prepare("INSERT INTO appointment_availability(id,subject_type,subject_id,weekday,start_time,end_time,enabled,sort_order) VALUES(?, 'free', ?,1,'08:00','18:00',1,1)").bind('demo-v2:'+demoId+':av:1',profileId),
    c.env.DB.prepare("INSERT INTO appointment_availability(id,subject_type,subject_id,weekday,start_time,end_time,enabled,sort_order) VALUES(?, 'free', ?,2,'08:00','18:00',1,2)").bind('demo-v2:'+demoId+':av:2',profileId),
    c.env.DB.prepare("INSERT INTO appointment_availability(id,subject_type,subject_id,weekday,start_time,end_time,enabled,sort_order) VALUES(?, 'free', ?,3,'08:00','18:00',1,3)").bind('demo-v2:'+demoId+':av:3',profileId),
    c.env.DB.prepare("INSERT INTO appointment_availability(id,subject_type,subject_id,weekday,start_time,end_time,enabled,sort_order) VALUES(?, 'free', ?,4,'08:00','18:00',1,4)").bind('demo-v2:'+demoId+':av:4',profileId),
    c.env.DB.prepare("INSERT INTO appointment_availability(id,subject_type,subject_id,weekday,start_time,end_time,enabled,sort_order) VALUES(?, 'free', ?,5,'08:00','18:00',1,5)").bind('demo-v2:'+demoId+':av:5',profileId),
    c.env.DB.prepare("INSERT INTO appointment_availability(id,subject_type,subject_id,weekday,start_time,end_time,enabled,sort_order) VALUES(?, 'free', ?,6,'09:00','13:00',1,6)").bind('demo-v2:'+demoId+':av:6',profileId),
  ]
  portfolio.forEach((path,index)=>statements.push(c.env.DB.prepare('INSERT INTO profile_gallery(id,profile_id,image_key,alt_text,title,description,sort_order) VALUES(?,?,?,?,?,?,?)').bind('demo-v2:'+demoId+':portfolio:'+(index+1),profileId,absoluteAsset(c,path),def.label+' · ejemplo '+(index+1),'Trabajo '+(index+1),'Imagen de ejemplo del rubro. Sustitúyela por una foto real antes de publicar.',index)))
  await c.env.DB.batch(statements)
  await logAdminAction({db:c.env.DB,adminUserId,action:'free_demo_v2.create',targetType:'profile',targetId:profileId,after:{demo_id:demoId,template_key:def.key,status:'draft'}}).catch(()=>undefined)
  return c.json({ok:true,data:{id:demoId,status:'draft',edit_url:webOrigin(c)+'/free-demo/edit/'+demoId}},201)
})


app.get('/api/v1/superadmin/free-demo-v2/:id/editor',requireSuperAdmin('super_admin'),async(c:any)=>{
  const row=await demoRow(c,c.req.param('id'))
  if(!row)return c.json({ok:false,error:'Demo Free no encontrada.'},404)
  const profileId=String((row as any).profile_id)
  const [contact,social,gallery,links,settings,availability,products]=await Promise.all([
    c.env.DB.prepare('SELECT whatsapp,email,phone,address,map_url FROM profile_contact WHERE profile_id=? LIMIT 1').bind(profileId).first(),
    c.env.DB.prepare('SELECT id,type,url,sort_order,enabled FROM profile_social_links WHERE profile_id=? AND enabled=1 ORDER BY sort_order ASC LIMIT 3').bind(profileId).all(),
    c.env.DB.prepare('SELECT id,image_key,alt_text,title,description,sort_order FROM profile_gallery WHERE profile_id=? ORDER BY sort_order ASC LIMIT 10').bind(profileId).all(),
    c.env.DB.prepare('SELECT id,label,url,sort_order,is_active FROM profile_links WHERE profile_id=? AND is_active=1 ORDER BY sort_order ASC LIMIT 3').bind(profileId).all(),
    getAppointmentSettings(c.env.DB,'free',profileId),
    getAppointmentAvailabilityRows(c.env.DB,'free',profileId),
    c.env.DB.prepare('SELECT COUNT(*) AS n FROM profile_products WHERE profile_id=?').bind(profileId).first(),
  ])
  if(Number((products as any)?.n||0)!==0)return c.json({ok:false,error:'Contrato Demo Free inválido: Servicios debe permanecer vacío.'},409)
  return c.json({ok:true,data:{
    id:String((row as any).id),
    status:String((row as any).status),
    template_key:String((row as any).template_key),
    template_label:String((row as any).template_label),
    published_at:(row as any).published_at||null,
    profile:{
      id:profileId,slug:String((row as any).slug||''),name:String((row as any).name||''),bio:String((row as any).bio||''),
      category:String((row as any).category||''),subcategory:String((row as any).subcategory||''),
      layout_id:String((row as any).layout_id||'impacto'),free_palette_id:String((row as any).free_palette_id||'intap'),
      free_brand_color:String((row as any).free_brand_color||''),avatar_url:String((row as any).avatar_url||''),hero_url:String((row as any).hero_url||''),
      hero_position_x:Number((row as any).hero_position_x||50),hero_position_y:Number((row as any).hero_position_y||50),hero_zoom:Number((row as any).hero_zoom||1),
      template_data:parseJson((row as any).template_data),is_published:Boolean(Number((row as any).is_published||0)),
    },
    contact:contact||{},quick_actions:social.results||[],portfolio:gallery.results||[],links:links.results||[],
    experience:{appointment_enabled:settings.enabled,slot_minutes:settings.slot_minutes,min_notice_minutes:settings.min_notice_minutes,horizon_days:settings.horizon_days,timezone:settings.timezone,reason_mode:settings.reason_mode,availability},
    limits:{portfolio:MAX_PORTFOLIO,quick_actions:MAX_QUICK_ACTIONS,links:MAX_LINKS,services:0},
  }})
})

app.patch('/api/v1/superadmin/free-demo-v2/:id/profile',requireSuperAdmin('super_admin'),async(c:any)=>{
  const row=await demoRow(c,c.req.param('id'))
  if(!row)return c.json({ok:false,error:'Demo Free no encontrada.'},404)
  if(String((row as any).status)==='claimed')return c.json({ok:false,error:'Este perfil ya fue reclamado.'},409)
  let body:any={};try{body=await c.req.json()}catch{return c.json({ok:false,error:'JSON inválido.'},400)}
  const profileId=String((row as any).profile_id),currentTemplate=parseJson((row as any).template_data)
  const role=body.role!==undefined?cleanText(body.role,100):cleanText(currentTemplate.role,100)
  const portfolioTitle=body.portfolio_title!==undefined?cleanText(body.portfolio_title,80):cleanText(currentTemplate.portfolio_title||'Mis trabajos',80)
  const scheduleVisible=body.schedule_visible===undefined?currentTemplate.free_schedule_visible!==false:Boolean(body.schedule_visible)
  const quoteVisible=body.quote_button_visible===undefined?currentTemplate.free_quote_button_visible!==false:Boolean(body.quote_button_visible)
  const nextTemplate={...currentTemplate,role,portfolio_title:portfolioTitle,free_schedule_visible:scheduleVisible,free_quote_button_visible:quoteVisible,free_demo_v2:true}
  const layout=body.layout_id!==undefined?cleanText(body.layout_id,20):String((row as any).layout_id||'impacto')
  const palette=body.free_palette_id!==undefined?cleanText(body.free_palette_id,20):String((row as any).free_palette_id||'intap')
  if(!LAYOUTS.has(layout)||!PALETTES.has(palette))return c.json({ok:false,error:'Diseño o paleta no válidos.'},400)
  const brand=body.free_brand_color===undefined?String((row as any).free_brand_color||''):cleanText(body.free_brand_color,7).toUpperCase()
  if(brand&&!/^#[0-9A-F]{6}$/.test(brand))return c.json({ok:false,error:'Color de marca no válido.'},400)
  const name=body.name!==undefined?cleanText(body.name,100):String((row as any).name||'')
  const bio=body.bio!==undefined?cleanText(body.bio,1200):String((row as any).bio||'')
  const contact=body.contact&&typeof body.contact==='object'?body.contact:{}
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE profiles SET name=?,bio=?,layout_id=?,free_palette_id=?,free_brand_color=?,template_data=?,updated_at=datetime('now') WHERE id=?").bind(name,bio,layout,palette,brand||null,JSON.stringify(nextTemplate),profileId),
    c.env.DB.prepare("INSERT INTO profile_contact(profile_id,whatsapp,email,phone,hours,address,map_url) VALUES(?,?,?,?,?,?,?) ON CONFLICT(profile_id) DO UPDATE SET whatsapp=excluded.whatsapp,email=excluded.email,phone=excluded.phone,address=excluded.address,map_url=excluded.map_url,updated_at=datetime('now')").bind(profileId,cleanText(contact.whatsapp,40)||null,cleanText(contact.email,180)||null,cleanText(contact.phone,40)||null,null,cleanText(contact.address,240)||null,cleanText(contact.map_url,600)||null),
    c.env.DB.prepare("UPDATE free_demo_v2_profiles SET updated_at=datetime('now') WHERE id=?").bind(c.req.param('id')),
  ])
  return c.json({ok:true})
})

app.put('/api/v1/superadmin/free-demo-v2/:id/quick-actions',requireSuperAdmin('super_admin'),async(c:any)=>{
  const row=await demoRow(c,c.req.param('id'));if(!row)return c.json({ok:false,error:'Demo Free no encontrada.'},404)
  let body:any={};try{body=await c.req.json()}catch{return c.json({ok:false,error:'JSON inválido.'},400)}
  const items=(Array.isArray(body.items)?body.items:[]).slice(0,MAX_QUICK_ACTIONS).map((item:any)=>({type:cleanText(item.type,20),url:cleanText(item.url,800)})).filter((item:any)=>QUICK_TYPES.has(item.type)&&item.url)
  const profileId=String((row as any).profile_id),statements:any[]=[c.env.DB.prepare('DELETE FROM profile_social_links WHERE profile_id=?').bind(profileId)]
  items.forEach((item:any,index:number)=>statements.push(c.env.DB.prepare('INSERT INTO profile_social_links(id,profile_id,type,url,sort_order,enabled) VALUES(?,?,?,?,?,1)').bind('demo-v2:'+c.req.param('id')+':quick:'+(index+1),profileId,item.type,item.url,index)))
  await c.env.DB.batch(statements)
  return c.json({ok:true,data:{items}})
})

app.put('/api/v1/superadmin/free-demo-v2/:id/links',requireSuperAdmin('super_admin'),async(c:any)=>{
  const row=await demoRow(c,c.req.param('id'));if(!row)return c.json({ok:false,error:'Demo Free no encontrada.'},404)
  let body:any={};try{body=await c.req.json()}catch{return c.json({ok:false,error:'JSON inválido.'},400)}
  const items=(Array.isArray(body.items)?body.items:[]).slice(0,MAX_LINKS).map((item:any)=>({label:cleanText(item.label,80),url:cleanText(item.url,800)})).filter((item:any)=>item.label&&item.url)
  const profileId=String((row as any).profile_id),statements:any[]=[c.env.DB.prepare('DELETE FROM profile_links WHERE profile_id=?').bind(profileId)]
  items.forEach((item:any,index:number)=>statements.push(c.env.DB.prepare("INSERT INTO profile_links(id,profile_id,label,url,sort_order,is_active,updated_at,created_at) VALUES(?,?,?,?,?,1,datetime('now'),datetime('now'))").bind('demo-v2:'+c.req.param('id')+':link:'+(index+1),profileId,item.label,item.url,index)))
  await c.env.DB.batch(statements)
  return c.json({ok:true,data:{items}})
})

app.put('/api/v1/superadmin/free-demo-v2/:id/portfolio',requireSuperAdmin('super_admin'),async(c:any)=>{
  const row=await demoRow(c,c.req.param('id'));if(!row)return c.json({ok:false,error:'Demo Free no encontrada.'},404)
  let body:any={};try{body=await c.req.json()}catch{return c.json({ok:false,error:'JSON inválido.'},400)}
  const items=(Array.isArray(body.items)?body.items:[]).slice(0,MAX_PORTFOLIO).map((item:any)=>({image_key:cleanText(item.image_key,1200),title:cleanText(item.title,80),description:cleanText(item.description,240)})).filter((item:any)=>item.image_key)
  const profileId=String((row as any).profile_id),statements:any[]=[c.env.DB.prepare('DELETE FROM profile_gallery WHERE profile_id=?').bind(profileId)]
  items.forEach((item:any,index:number)=>statements.push(c.env.DB.prepare('INSERT INTO profile_gallery(id,profile_id,image_key,alt_text,title,description,sort_order) VALUES(?,?,?,?,?,?,?)').bind('demo-v2:'+c.req.param('id')+':portfolio:'+(index+1),profileId,item.image_key,item.title||'Trabajo '+(index+1),item.title||'Trabajo '+(index+1),item.description,index)))
  await c.env.DB.batch(statements)
  return c.json({ok:true,data:{items}})
})

app.post('/api/v1/superadmin/free-demo-v2/:id/media',requireSuperAdmin('super_admin'),async(c:any)=>{
  const row=await demoRow(c,c.req.param('id'));if(!row)return c.json({ok:false,error:'Demo Free no encontrada.'},404)
  const kind=cleanText(c.req.query('kind')||'portfolio',20)
  if(!['avatar','hero','portfolio'].includes(kind))return c.json({ok:false,error:'Tipo de imagen no válido.'},400)
  const form=await c.req.formData(),raw=form.get('file')
  if(!(raw&&typeof raw==='object'&&'stream' in (raw as any)))return c.json({ok:false,error:'Archivo requerido.'},400)
  const file=raw as File,types:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'},ext=types[file.type]
  if(!ext)return c.json({ok:false,error:'Usa JPG, PNG o WEBP.'},400)
  if(Number(file.size||0)>8*1024*1024)return c.json({ok:false,error:'La imagen supera 8 MB.'},413)
  const key='free-demo-v2/'+c.req.param('id')+'/'+kind+'/'+crypto.randomUUID()+'.'+ext
  await c.env.BUCKET.put(key,file.stream(),{httpMetadata:{contentType:file.type}})
  const url=webOrigin(c)+'/api/v1/public/assets/'+key.split('/').map(encodeURIComponent).join('/')
  if(kind==='avatar'||kind==='hero')await c.env.DB.prepare('UPDATE profiles SET '+(kind==='avatar'?'avatar_url':'hero_url')+"=?,updated_at=datetime('now') WHERE id=?").bind(url,String((row as any).profile_id)).run()
  return c.json({ok:true,data:{url,key}})
})

app.put('/api/v1/superadmin/free-demo-v2/:id/experience',requireSuperAdmin('super_admin'),async(c:any)=>{
  const row=await demoRow(c,c.req.param('id'));if(!row)return c.json({ok:false,error:'Demo Free no encontrada.'},404)
  let body:any={};try{body=await c.req.json()}catch{return c.json({ok:false,error:'JSON inválido.'},400)}
  const profileId=String((row as any).profile_id),template=parseJson((row as any).template_data)
  const scheduleVisible=body.schedule_visible!==false,quoteVisible=body.quote_button_visible!==false,appointmentEnabled=body.appointment_enabled===true
  if(!quoteVisible&&!appointmentEnabled)return c.json({ok:false,error:'Mantén visible Cotizar o Agenda.'},400)
  const availability=(Array.isArray(body.availability)?body.availability:[]).slice(0,28)
  await saveAppointmentConfiguration(c.env.DB,'free',profileId,{enabled:appointmentEnabled,slot_minutes:body.slot_minutes,min_notice_minutes:body.min_notice_minutes,horizon_days:body.horizon_days,timezone:body.timezone,reason_mode:'default',availability})
  const days=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
  const schedule=availability.filter((item:any)=>item.enabled!==false).map((item:any)=>({day:days[Number(item.weekday)]||'',hours:cleanText(item.start_time,5)+' - '+cleanText(item.end_time,5)}))
  const next={...template,free_schedule_visible:scheduleVisible,free_quote_button_visible:quoteVisible,free_schedule_configured:true,free_schedule:schedule}
  await c.env.DB.prepare("UPDATE profiles SET template_data=?,updated_at=datetime('now') WHERE id=?").bind(JSON.stringify(next),profileId).run()
  return c.json({ok:true})
})


app.post('/api/v1/superadmin/free-demo-v2/:id/publish',requireSuperAdmin('super_admin'),async(c:any)=>{
  const row=await demoRow(c,c.req.param('id'));if(!row)return c.json({ok:false,error:'Demo Free no encontrada.'},404)
  if(String((row as any).status)==='claimed')return c.json({ok:false,error:'Este perfil ya fue reclamado.'},409)
  let body:any={};try{body=await c.req.json()}catch{return c.json({ok:false,error:'JSON inválido.'},400)}
  const name=cleanText(body.name,100),requested=slugify(body.slug||name),current=String((row as any).slug||''),publishedAt=String((row as any).published_at||'')
  if(!name)return c.json({ok:false,error:'Escribe el nombre final.'},400)
  if(!validSlug(requested))return c.json({ok:false,error:'Slug no válido o reservado.'},400)
  if(publishedAt&&requested!==current)return c.json({ok:false,error:'El slug publicado es permanente.',code:'slug_locked'},409)
  const slug=publishedAt?current:requested
  const duplicate=await c.env.DB.prepare('SELECT id FROM profiles WHERE slug=? AND id<>? LIMIT 1').bind(slug,String((row as any).profile_id)).first()
  if(duplicate)return c.json({ok:false,error:'Ese slug ya está en uso.',code:'slug_taken'},409)
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE profiles SET name=?,slug=?,is_published=1,updated_at=datetime('now') WHERE id=?").bind(name,slug,String((row as any).profile_id)),
    c.env.DB.prepare("UPDATE free_demo_v2_profiles SET status='published',published_at=COALESCE(published_at,datetime('now')),updated_at=datetime('now') WHERE id=?").bind(c.req.param('id')),
  ])
  return c.json({ok:true,data:{id:c.req.param('id'),name,slug,status:'published',public_url:webOrigin(c)+'/'+slug}})
})

app.post('/api/v1/superadmin/free-demo-v2/:id/unpublish',requireSuperAdmin('super_admin'),async(c:any)=>{
  const row=await demoRow(c,c.req.param('id'));if(!row)return c.json({ok:false,error:'Demo Free no encontrada.'},404)
  if(!String((row as any).published_at||''))return c.json({ok:false,error:'La Demo todavía no ha sido publicada.'},409)
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE profiles SET is_published=0,updated_at=datetime('now') WHERE id=?").bind(String((row as any).profile_id)),
    c.env.DB.prepare("UPDATE free_demo_v2_profiles SET status='draft',updated_at=datetime('now') WHERE id=?").bind(c.req.param('id')),
  ])
  return c.json({ok:true})
})

app.post('/api/v1/superadmin/free-demo-v2/:id/claim-code',requireSuperAdmin('super_admin'),async(c:any)=>{
  const row=await demoRow(c,c.req.param('id'));if(!row)return c.json({ok:false,error:'Demo Free no encontrada.'},404)
  if(!Number((row as any).is_published||0)||!String((row as any).published_at||''))return c.json({ok:false,error:'Publica la presentación antes de generar el reclamo.'},409)
  const raw=randomClaimCode(),hash=await sha256Hex(raw),claimId=crypto.randomUUID(),adminUserId=String(c.get('adminUserId')||'')
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE free_demo_v2_claims SET status='revoked' WHERE demo_id=? AND status IN('active','in_progress')").bind(c.req.param('id')),
    c.env.DB.prepare("INSERT INTO free_demo_v2_claims(id,demo_id,special_email,slug_snapshot,code_hash,status,expires_at,created_by_admin_user_id) VALUES(?,?,?,?,?,'active',datetime('now','+30 days'),?)").bind(claimId,c.req.param('id'),FREE_DEMO_V2_CLAIM_EMAIL,String((row as any).slug),hash,adminUserId||null),
    c.env.DB.prepare("UPDATE free_demo_v2_profiles SET status='claim_ready',updated_at=datetime('now') WHERE id=?").bind(c.req.param('id')),
  ])
  return c.json({ok:true,data:{special_email:FREE_DEMO_V2_CLAIM_EMAIL,slug:String((row as any).slug),claim_code:raw,expires_in_days:30}})
})

app.post('/api/v1/auth/free-demo-v2-claim/login',async(c:any)=>{
  let body:any={};try{body=await c.req.json()}catch{return c.json({ok:false,error:'Solicitud inválida.'},400)}
  const email=cleanText(body.email,180).toLowerCase(),code=cleanText(body.code||body.password,40).toUpperCase()
  if(email!==FREE_DEMO_V2_CLAIM_EMAIL||!code)return c.json({ok:false,error:'not_claim',code:'not_claim'},404)
  const row=await c.env.DB.prepare("SELECT cl.id,cl.demo_id,d.profile_id,p.slug,p.name FROM free_demo_v2_claims cl JOIN free_demo_v2_profiles d ON d.id=cl.demo_id JOIN profiles p ON p.id=d.profile_id WHERE cl.special_email=? AND cl.code_hash=? AND cl.status='active' AND cl.expires_at>datetime('now') AND d.status='claim_ready' LIMIT 1").bind(FREE_DEMO_V2_CLAIM_EMAIL,await sha256Hex(code)).first()
  if(!row)return c.json({ok:false,error:'not_claim',code:'not_claim'},404)
  const lock=await c.env.DB.prepare("UPDATE free_demo_v2_claims SET status='in_progress' WHERE id=? AND status='active'").bind(String((row as any).id)).run()
  if(Number((lock as any)?.meta?.changes||0)!==1)return c.json({ok:false,error:'not_claim',code:'not_claim'},404)
  return c.json({ok:true,data:{next_url:'/claim/free-demo',slug:String((row as any).slug),name:String((row as any).name)}},200,{'Set-Cookie':freeDemoClaimCookie(c.env,appOrigin(c),code)})
})

app.get('/api/v1/auth/free-demo-v2-claim/context',async(c:any)=>{
  const row=await getActiveFreeDemoClaim(c)
  if(!row)return c.json({ok:false,error:'El acceso de reclamo expiró.'},401)
  return c.json({ok:true,data:{slug:String((row as any).slug),name:String((row as any).name),special_email:FREE_DEMO_V2_CLAIM_EMAIL}})
})


export default app
