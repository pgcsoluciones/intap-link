import app from './index'
import { requireSuperAdmin, logAdminAction } from './lib/admin-auth'
import { buildScopedCookie, cookieNames, isPreviewEnvironment } from './lib/cookies'
import { ensureAppointmentSubject, getAppointmentSettings, getAppointmentAvailabilityRows, saveAppointmentConfiguration } from './appointments-core'
import { resolveFreeStarterContent, FREE_PROFILE_CATEGORIES } from '../../shared/free-profile-starter-content'
import { FREE_PROFILE_STARTER_ASSETS } from '../../shared/free-profile-starter-assets'

const CLAIM_EMAIL='intapcard@gmail.com'
const MAX_PORTFOLIO=10
const MAX_QUICK_ACTIONS=3
const MAX_LINKS=3
const PALETTES=new Set(['intap','oceano','esmeralda','violeta','coral','grafito','arena','personalizada'])
const LAYOUTS=new Set(['impacto','personal','esencial'])
const QUICK_TYPES=new Set(['call','instagram','location','email','tiktok'])
const RESERVED=new Set(['admin','api','app','www','superadmin','support','demo','trial','p','l','free-demo'])
const KDF_ITERATIONS=100000

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
function randomToken(bytes=32){const a=crypto.getRandomValues(new Uint8Array(bytes));return Array.from(a).map(b=>b.toString(16).padStart(2,'0')).join('')}
function randomClaimCode(){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',bytes=crypto.getRandomValues(new Uint8Array(12));const raw=Array.from(bytes).map(x=>alphabet[x%alphabet.length]).join('');return 'CLM-'+raw.slice(0,4)+'-'+raw.slice(4,8)+'-'+raw.slice(8,12)}
async function sha256Hex(input:string){const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input));return Array.from(new Uint8Array(h)).map(b=>b.toString(16).padStart(2,'0')).join('')}
function bytesHex(bytes:Uint8Array){return Array.from(bytes).map(b=>b.toString(16).padStart(2,'0')).join('')}
async function passwordHash(password:string,saltHex:string){const salt=new Uint8Array((saltHex.match(/.{1,2}/g)||[]).map(x=>parseInt(x,16)));const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:KDF_ITERATIONS,hash:'SHA-256'},key,256);return bytesHex(new Uint8Array(bits))}
async function passwordRecord(password:string){const salt=crypto.getRandomValues(new Uint8Array(16)),saltHex=bytesHex(salt);return{salt:saltHex,hash:await passwordHash(password,saltHex)}}
function parseCookie(header:string,name:string){for(const part of header.split(';')){const index=part.indexOf('=');if(index<0)continue;if(part.slice(0,index).trim()===name)return decodeURIComponent(part.slice(index+1).trim())}return null}
function claimCookieName(c:any){return isPreviewEnvironment(c.env)?'kawvo_free_demo_v2_claim_preview':'kawvo_free_demo_v2_claim'}
function claimCookie(c:any,value:string,maxAge=900){return buildScopedCookie(c.env,appOrigin(c),claimCookieName(c),value,maxAge)}
function sessionCookie(c:any,value:string){return buildScopedCookie(c.env,appOrigin(c),cookieNames(c.env).session,value,30*24*60*60)}
function templateByKey(key:string){return FREE_DEMO_V2_TEMPLATES.find(item=>item.key===key)}
function templatePreview(c:any,item:TemplateDef){
  const starter=resolveFreeStarterContent(item.category)
  const assets=[...((FREE_PROFILE_STARTER_ASSETS as Record<string,readonly string[]>)[starter.category]||[])]
  return{...item,role:starter.role,bio:starter.bio,palette:starter.recommendedPalette,hero_url:absoluteAsset(c,assets[0]||''),avatar_url:absoluteAsset(c,assets[1]||assets[0]||''),portfolio:assets.slice(2,7).map(asset=>absoluteAsset(c,asset))}
}
async function demoRow(c:any,id:string){
  return c.env.DB.prepare("SELECT d.*,p.slug,p.name,p.bio,p.category,p.subcategory,p.layout_id,p.free_palette_id,p.free_brand_color,p.avatar_url,p.hero_url,p.hero_position_x,p.hero_position_y,p.hero_zoom,p.template_data,p.is_published FROM free_demo_v2_profiles d JOIN profiles p ON p.id=d.profile_id WHERE d.id=? LIMIT 1").bind(id).first()
}
async function activeClaim(c:any){
  const raw=parseCookie(c.req.header('Cookie')||'',claimCookieName(c))
  if(!raw)return null
  return c.env.DB.prepare("SELECT cl.id claim_id,cl.demo_id,cl.slug_snapshot,d.profile_id,d.synthetic_owner_user_id,p.name,p.slug,p.template_data FROM free_demo_v2_claims cl JOIN free_demo_v2_profiles d ON d.id=cl.demo_id JOIN profiles p ON p.id=d.profile_id WHERE cl.code_hash=? AND cl.status='in_progress' AND cl.expires_at>datetime('now') AND d.status='claim_ready' LIMIT 1").bind(await sha256Hex(raw)).first()
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
  ]
  portfolio.forEach((path,index)=>statements.push(c.env.DB.prepare('INSERT INTO profile_gallery(id,profile_id,image_key,alt_text,title,description,sort_order) VALUES(?,?,?,?,?,?,?)').bind('demo-v2:'+demoId+':portfolio:'+(index+1),profileId,absoluteAsset(c,path),def.label+' · ejemplo '+(index+1),'Trabajo '+(index+1),'Imagen de ejemplo del rubro. Sustitúyela por una foto real antes de publicar.',index)))
  await c.env.DB.batch(statements)
  await ensureAppointmentSubject(c.env.DB,'free',profileId)
  await c.env.DB.prepare("UPDATE appointment_settings SET enabled=1,updated_at=datetime('now') WHERE subject_type='free' AND subject_id=?").bind(profileId).run()
  await logAdminAction({db:c.env.DB,adminUserId,action:'free_demo_v2.create',targetType:'profile',targetId:profileId,after:{demo_id:demoId,template_key:def.key,status:'draft'}}).catch(()=>undefined)
  return c.json({ok:true,data:{id:demoId,status:'draft',edit_url:webOrigin(c)+'/free-demo/edit/'+demoId}},201)
})
