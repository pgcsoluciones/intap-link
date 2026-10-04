import { ensureAppointmentSubject } from './appointments-core'
import { resolveFreeStarterContent } from '../../shared/free-profile-starter-content'
import { FREE_PROFILE_STARTER_ASSETS } from '../../shared/free-profile-starter-assets'

export const FREE_DEMO_MANAGER_EMAIL='intapcard@gmail.com'

export type FreeDemoPresetDefinition={
  key:string
  label:string
  hint:string
  category:string
  role?:string
  bio?:string
  services?:Array<{title:string;description:string}>
}

export const FREE_DEMO_CATALOG:FreeDemoPresetDefinition[]=[
  {key:'hardware',label:'Ferretería',hint:'Herramientas, materiales, plomería y hogar',category:'Construcción e ingeniería',role:'Ferretería y soluciones para tu proyecto',bio:'Herramientas, materiales y soluciones para construcción, reparación, mantenimiento y mejoras del hogar.',services:[
    {title:'Herramientas y equipos',description:'Opciones para construcción, reparación, instalación y mantenimiento.'},
    {title:'Plomería, hogar y acabados',description:'Productos para instalaciones, reparaciones y mejoras de tus espacios.'},
    {title:'Cotiza tu proyecto',description:'Consulta disponibilidad, precios y materiales para tu próxima compra.'},
  ]},
  {key:'auto',label:'Taller automotriz / Mecánica',hint:'Mecánica, diagnóstico, pintura y detailing',category:'Automotriz y mecánica'},
  {key:'beauty',label:'Belleza / Salón',hint:'Peluquería, uñas, estética y cuidado personal',category:'Belleza y estética'},
  {key:'health',label:'Salud / Bienestar',hint:'Médicos, terapeutas, fisioterapia y bienestar',category:'Salud y bienestar'},
  {key:'food',label:'Restaurante / Repostería',hint:'Comida, cafetería, catering y repostería',category:'Gastronomía y alimentos'},
  {key:'professional',label:'Servicios profesionales',hint:'Abogados, contables, consultores y asesores',category:'Servicios profesionales'},
  {key:'technical',label:'Técnicos / Instalaciones',hint:'Electricidad, plomería, A/C y mantenimiento',category:'Mantenimiento e instalaciones técnicas'},
  {key:'printing',label:'Diseño / Serigrafía / Impresión',hint:'Diseño gráfico, impresión, branding y producción',category:'Arte, diseño y creatividad',role:'Diseño, serigrafía e impresión',bio:'Diseño, impresión y producción visual para marcas, negocios, eventos y proyectos personalizados.',services:[
    {title:'Diseño y artes gráficas',description:'Diseño de piezas visuales, identidad y preparación de artes para impresión.'},
    {title:'Serigrafía e impresión',description:'Producción de piezas impresas y personalizadas para marcas, negocios y eventos.'},
    {title:'Pedidos personalizados',description:'Cotiza cantidades, acabados, medidas y opciones según tu proyecto.'},
  ]},
  {key:'retail',label:'Tienda / Comercio',hint:'Productos, ventas, retail y tiendas virtuales',category:'Comercio, retail y tiendas virtuales'},
  {key:'realestate',label:'Inmobiliaria',hint:'Venta, alquiler y gestión de propiedades',category:'Inmobiliaria y propiedades'},
  {key:'construction',label:'Construcción / Ingeniería',hint:'Obras, remodelación, arquitectura e ingeniería',category:'Construcción e ingeniería'},
  {key:'creative',label:'Artesanía / Creativos',hint:'Crochet, manualidades, arte y productos hechos a mano',category:'Artesanía y productos hechos a mano'},
  {key:'events',label:'Eventos / Entretenimiento',hint:'Decoración, producción, fotografía y actividades',category:'Eventos y entretenimiento'},
  {key:'tech',label:'Tecnología',hint:'Equipos, reparación, redes y soluciones digitales',category:'Tecnología y electrónica'},
  {key:'education',label:'Educación / Formación',hint:'Cursos, talleres, tutorías y capacitación',category:'Educación y formación'},
  {key:'general',label:'Servicios generales',hint:'Negocios y servicios de múltiples categorías',category:'Servicios generales'},
]

type DemoSnapshot={
  name:string
  role:string
  bio:string
  category:string
  subcategory:string
  layout_id:string
  free_palette_id:string
  avatar_url:string
  hero_url:string
  contact:{whatsapp:string;phone:string;email:string;address:string;map_url:string}
  quick_actions:Array<{type:string;url:string}>
  services:Array<{title:string;description:string;image_url:string}>
  gallery:Array<{title:string;description:string;image_key:string;alt_text:string}>
  template_data:Record<string,any>
}

function absoluteAsset(webOrigin:string,path:string){
  const base=String(webOrigin||'').replace(/\/$/,'')
  if(!path)return''
  if(/^https?:\/\//i.test(path))return path
  return base+path
}

function catalogDefinition(key:string){
  return FREE_DEMO_CATALOG.find(x=>x.key===key)||FREE_DEMO_CATALOG.find(x=>x.key==='general')!
}

export function freeDemoPreset(key:string,webOrigin=''):DemoSnapshot{
  const definition=catalogDefinition(key)
  const starter=resolveFreeStarterContent(definition.category)
  const assets=[...((FREE_PROFILE_STARTER_ASSETS as Record<string,readonly string[]>)[starter.category]||[])]
  const urls=assets.map(x=>absoluteAsset(webOrigin,x))
  const services=(definition.services?.length?definition.services:starter.services).slice(0,3).map((x:any,i:number)=>({
    title:String(x.title||'Servicio'),
    description:String(x.description||''),
    image_url:urls[i+3]||urls[i+2]||urls[0]||'',
  }))
  const gallery=[2,3,4,5,6].map((n,i)=>({
    title:`Trabajo ${i+1}`,
    description:'Imagen de ejemplo del rubro. Sustitúyela por una foto real antes de entregar el perfil.',
    image_key:urls[n-1]||urls[0]||'',
    alt_text:`Ejemplo ${i+1} · ${definition.label}`,
  })).filter(x=>x.image_key)
  const role=definition.role||starter.role
  const bio=definition.bio||starter.bio
  const locationUrl='https://www.google.com/maps/search/?api=1&query=Santo+Domingo%2C+Rep%C3%BAblica+Dominicana'
  return{
    name:`Demo ${definition.label}`,
    role,
    bio,
    category:starter.category,
    subcategory:definition.label,
    layout_id:'impacto',
    free_palette_id:starter.recommendedPalette,
    avatar_url:urls[1]||urls[0]||'',
    hero_url:urls[0]||'',
    contact:{whatsapp:'18090000000',phone:'18090000000',email:'',address:'Santo Domingo, República Dominicana',map_url:locationUrl},
    quick_actions:[
      {type:'call',url:'tel:+18090000000'},
      {type:'instagram',url:'https://www.instagram.com/kawvolink'},
      {type:'location',url:locationUrl},
    ],
    services,
    gallery,
    template_data:{
      role,
      services_section_title:starter.servicesTitle,
      services_section_description:starter.servicesDescription,
      free_identity_confirmed:true,
      free_quote_button_visible:true,
      free_schedule_visible:true,
      free_schedule_configured:true,
      free_schedule:[{day:'Lunes a Viernes',hours:'8:00 AM - 6:00 PM'},{day:'Sábados',hours:'9:00 AM - 1:00 PM'}],
      portfolio_title:'Mis trabajos',
      free_starter_generated:true,
      free_starter_materialized:true,
      free_starter_unconfirmed:false,
      free_starter_category:starter.category,
      free_starter_subcategory:definition.label,
      free_demo_seed:true,
      free_demo_preset:key,
    },
  }
}

export function cleanDemoSlug(value:unknown){
  return String(value??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9-]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,60)
}
export function validDemoSlug(value:string){
  return /^[a-z0-9][a-z0-9-]{2,59}$/.test(value)&&!['admin','api','app','www','superadmin','support','demo','trial','p','l'].includes(value)
}
export async function sha256Hex(input:string){
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input))
  return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('')
}
export function randomCode(){
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes=crypto.getRandomValues(new Uint8Array(12))
  return Array.from(bytes).map(b=>alphabet[b%alphabet.length]).join('')
}
export function randomToken(bytes=32){
  const a=crypto.getRandomValues(new Uint8Array(bytes))
  return Array.from(a).map(b=>b.toString(16).padStart(2,'0')).join('')
}

async function managerUserId(db:D1Database,email=FREE_DEMO_MANAGER_EMAIL){
  const row=await db.prepare('SELECT id FROM users WHERE lower(trim(email))=? LIMIT 1').bind(email.toLowerCase()).first()
  return row?String((row as any).id):''
}

export async function applyFreeDemoPreset(db:D1Database,input:{
  profileId:string
  syntheticUserId:string
  presetKey:string
  webOrigin:string
  displayName?:string
  slug?:string
}){
  const snap=freeDemoPreset(input.presetKey,input.webOrigin)
  const existing=await db.prepare('SELECT id,slug,template_data FROM profiles WHERE id=? AND user_id=? LIMIT 1').bind(input.profileId,input.syntheticUserId).first()
  if(!existing)throw new Error('demo_profile_missing')

  const slug=input.slug?cleanDemoSlug(input.slug):String((existing as any).slug||'')
  if(!validDemoSlug(slug))throw new Error('slug_invalid')
  const duplicate=await db.prepare('SELECT id FROM profiles WHERE slug=? AND id<>? LIMIT 1').bind(slug,input.profileId).first()
  if(duplicate)throw new Error('slug_taken')

  let previousTemplate:Record<string,any>={}
  try{previousTemplate=JSON.parse(String((existing as any).template_data||'{}'))||{}}catch{previousTemplate={}}
  const templateData={
    ...previousTemplate,
    ...snap.template_data,
    free_demo_profile:true,
    free_demo_manager_email:FREE_DEMO_MANAGER_EMAIL,
  }
  const name=String(input.displayName||snap.name||'Demo Kawvo').trim().slice(0,100)
  const quickIds={
    call:`demo:${input.profileId}:quick:call`,
    instagram:`demo:${input.profileId}:quick:instagram`,
    location:`demo:${input.profileId}:quick:location`,
  }

  const statements:any[]=[
    db.prepare(`UPDATE profiles SET slug=?,name=?,bio=?,category=?,subcategory=?,layout_id=?,free_palette_id=?,avatar_url=?,hero_url=?,hero_position_x=50,hero_position_y=50,hero_zoom=1,template_data=?,is_published=0,updated_at=datetime('now') WHERE id=? AND user_id=?`)
      .bind(slug,name,snap.bio,snap.category,snap.subcategory,snap.layout_id,snap.free_palette_id,snap.avatar_url,snap.hero_url,JSON.stringify(templateData),input.profileId,input.syntheticUserId),
    db.prepare(`INSERT INTO profile_contact(profile_id,whatsapp,email,phone,hours,address,map_url) VALUES(?,?,?,?,?,?,?) ON CONFLICT(profile_id) DO UPDATE SET whatsapp=excluded.whatsapp,email=excluded.email,phone=excluded.phone,hours=excluded.hours,address=excluded.address,map_url=excluded.map_url,updated_at=datetime('now')`)
      .bind(input.profileId,snap.contact.whatsapp,snap.contact.email,snap.contact.phone,null,snap.contact.address,snap.contact.map_url),
    db.prepare("DELETE FROM profile_social_links WHERE profile_id=? AND id LIKE 'demo:%'").bind(input.profileId),
    db.prepare("DELETE FROM profile_gallery WHERE profile_id=?").bind(input.profileId),
    db.prepare("DELETE FROM profile_products WHERE profile_id=?").bind(input.profileId),
  ]
  snap.quick_actions.slice(0,3).forEach((x,i)=>{
    const id=x.type==='call'?quickIds.call:x.type==='instagram'?quickIds.instagram:quickIds.location
    statements.push(db.prepare('INSERT INTO profile_social_links(id,profile_id,type,url,sort_order,enabled) VALUES(?,?,?,?,?,1)').bind(id,input.profileId,x.type,x.url,i))
  })
  snap.gallery.slice(0,10).forEach((x,i)=>statements.push(db.prepare('INSERT INTO profile_gallery(id,profile_id,image_key,alt_text,title,description,sort_order) VALUES(?,?,?,?,?,?,?)').bind(`demo:${input.profileId}:gallery:${i+1}`,input.profileId,x.image_key,x.alt_text||x.title,x.title,x.description||'',i)))
  snap.services.slice(0,3).forEach((x,i)=>statements.push(db.prepare('INSERT INTO profile_products(id,profile_id,title,description,price,image_url,whatsapp_text,is_featured,sort_order) VALUES(?,?,?,?,NULL,?,NULL,0,?)').bind(`demo:${input.profileId}:service:${i+1}`,input.profileId,x.title,x.description,x.image_url||null,i)))
  await db.batch(statements)
  await ensureAppointmentSubject(db,'free',input.profileId)
  await db.prepare("UPDATE appointment_settings SET enabled=1,updated_at=datetime('now') WHERE subject_type='free' AND subject_id=?").bind(input.profileId).run()
  return{slug,name,presetKey:input.presetKey,category:snap.category,subcategory:snap.subcategory}
}

export async function createManagedFreeDemo(db:D1Database,input:{
  managerEmail?:string
  slug:string
  displayName?:string
  presetKey?:string
  webOrigin?:string
  artifactId?:string|null
  createdFrom?:'superadmin'|'free_activation'
}){
  const managerId=await managerUserId(db,input.managerEmail||FREE_DEMO_MANAGER_EMAIL)
  if(!managerId)throw new Error('demo_manager_missing')
  const slug=cleanDemoSlug(input.slug)
  if(!validDemoSlug(slug))throw new Error('slug_invalid')
  if(await db.prepare('SELECT id FROM profiles WHERE slug=? LIMIT 1').bind(slug).first())throw new Error('slug_taken')

  const profileId=crypto.randomUUID(),demoId=crypto.randomUUID(),syntheticUserId=crypto.randomUUID()
  const syntheticEmail=`free-demo+${profileId}@internal.kawvo.invalid`
  const presetKey=input.presetKey||'general'
  const snap=freeDemoPreset(presetKey,input.webOrigin||'')
  const name=String(input.displayName||snap.name||'Demo Kawvo').trim().slice(0,100)
  const templateData={...snap.template_data,free_demo_profile:true,free_demo_manager_email:input.managerEmail||FREE_DEMO_MANAGER_EMAIL}

  await db.batch([
    db.prepare('INSERT INTO users(id,email) VALUES(?,?)').bind(syntheticUserId,syntheticEmail),
    db.prepare(`INSERT INTO profiles(id,user_id,slug,plan_id,theme_id,layout_id,name,bio,category,subcategory,free_palette_id,avatar_url,hero_url,template_data,is_published,is_active,created_at,updated_at) VALUES(?,?,?,'free','default',?,?,?,?,?,?,?,?,?,0,1,datetime('now'),datetime('now'))`)
      .bind(profileId,syntheticUserId,slug,snap.layout_id,name,snap.bio,snap.category,snap.subcategory,snap.free_palette_id,snap.avatar_url,snap.hero_url,JSON.stringify(templateData)),
    db.prepare(`INSERT INTO free_demo_profiles(id,profile_id,synthetic_owner_user_id,manager_user_id,template_id,status,rubric,artifact_id,created_from) VALUES(?,?,?,?,NULL,'draft',?,?,?)`)
      .bind(demoId,profileId,syntheticUserId,managerId,snap.subcategory,input.artifactId||null,input.createdFrom||'superadmin'),
  ])

  try{
    await applyFreeDemoPreset(db,{profileId,syntheticUserId,presetKey,webOrigin:input.webOrigin||'',displayName:name,slug})
  }catch(error){
    await db.batch([
      db.prepare('DELETE FROM free_demo_profiles WHERE id=?').bind(demoId),
      db.prepare('DELETE FROM profiles WHERE id=? AND user_id=?').bind(profileId,syntheticUserId),
      db.prepare('DELETE FROM users WHERE id=?').bind(syntheticUserId),
    ]).catch(()=>undefined)
    throw error
  }

  return{demoId,profileId,syntheticUserId,slug,managerId,presetKey}
}

export async function createManagedFreeDemoFromArtifact(db:D1Database,input:{
  userId:string
  artifactId:string
  activationCodeId:string
  intentHash:string
  publicCode:string
  productType:string
  claimAt:string
  webOrigin?:string
}){
  const user=await db.prepare('SELECT email FROM users WHERE id=? LIMIT 1').bind(input.userId).first()
  if(String((user as any)?.email||'').trim().toLowerCase()!==FREE_DEMO_MANAGER_EMAIL)return null

  const created=await createManagedFreeDemo(db,{
    slug:`demo-${String(input.publicCode||'').toLowerCase()}`,
    artifactId:input.artifactId,
    createdFrom:'free_activation',
    presetKey:'general',
    webOrigin:input.webOrigin||'',
  })
  try{
    await db.batch([
      db.prepare(`UPDATE intap_artifacts SET owner_user_id=?,profile_id=?,status='activated',activated_at=?,updated_at=? WHERE id=? AND owner_user_id IS NULL AND status IN('available','unassigned') AND EXISTS (SELECT 1 FROM artifact_activation_intents i JOIN artifact_activation_codes ac ON ac.id=i.activation_code_id WHERE i.intent_hash=? AND i.artifact_id=? AND i.activation_code_id=? AND i.status='active' AND i.revoked_at IS NULL AND i.expires_at>? AND ac.artifact_id=? AND ac.status='active' AND (ac.expires_at IS NULL OR ac.expires_at>?))`)
        .bind(created.syntheticUserId,created.profileId,input.claimAt,input.claimAt,input.artifactId,input.intentHash,input.artifactId,input.activationCodeId,input.claimAt,input.artifactId,input.claimAt),
      db.prepare(`UPDATE artifact_activation_codes SET status='used',used_at=? WHERE id=? AND artifact_id=? AND status='active' AND (expires_at IS NULL OR expires_at>?) AND EXISTS (SELECT 1 FROM intap_artifacts a WHERE a.id=? AND a.owner_user_id=? AND a.profile_id=? AND a.status='activated' AND a.activated_at=?)`)
        .bind(input.claimAt,input.activationCodeId,input.artifactId,input.claimAt,input.artifactId,created.syntheticUserId,created.profileId,input.claimAt),
      db.prepare(`UPDATE artifact_activation_intents SET status='consumed',consumed_at=? WHERE intent_hash=? AND artifact_id=? AND activation_code_id=? AND status='active' AND revoked_at IS NULL AND expires_at>? AND EXISTS (SELECT 1 FROM artifact_activation_codes ac WHERE ac.id=? AND ac.status='used' AND ac.used_at=?)`)
        .bind(input.claimAt,input.intentHash,input.artifactId,input.activationCodeId,input.claimAt,input.activationCodeId,input.claimAt),
      db.prepare(`INSERT INTO artifact_activation_claims(intent_hash,artifact_id,activation_code_id,user_id,profile_id,claim_at,ok) VALUES(?,?,?,?,?,?,CASE WHEN EXISTS(SELECT 1 FROM intap_artifacts a JOIN artifact_activation_codes ac ON ac.id=? JOIN artifact_activation_intents i ON i.intent_hash=? WHERE a.id=? AND a.owner_user_id=? AND a.profile_id=? AND a.status='activated' AND a.activated_at=? AND ac.artifact_id=a.id AND ac.status='used' AND ac.used_at=? AND i.artifact_id=a.id AND i.activation_code_id=ac.id AND i.status='consumed' AND i.consumed_at=?) THEN 1 ELSE 0 END)`)
        .bind(input.intentHash,input.artifactId,input.activationCodeId,input.userId,created.profileId,input.claimAt,input.activationCodeId,input.intentHash,input.artifactId,created.syntheticUserId,created.profileId,input.claimAt,input.claimAt,input.claimAt),
    ])
  }catch(error){
    await db.batch([
      db.prepare("DELETE FROM appointment_availability WHERE subject_type='free' AND subject_id=?").bind(created.profileId),
      db.prepare("DELETE FROM appointment_reasons WHERE subject_type='free' AND subject_id=?").bind(created.profileId),
      db.prepare("DELETE FROM appointment_blocks WHERE subject_type='free' AND subject_id=?").bind(created.profileId),
      db.prepare("DELETE FROM appointment_settings WHERE subject_type='free' AND subject_id=?").bind(created.profileId),
      db.prepare('DELETE FROM free_demo_profiles WHERE id=?').bind(created.demoId),
      db.prepare('DELETE FROM profiles WHERE id=? AND user_id=?').bind(created.profileId,created.syntheticUserId),
      db.prepare('DELETE FROM users WHERE id=?').bind(created.syntheticUserId),
    ]).catch(()=>undefined)
    throw error
  }

  return{...created,publicCode:input.publicCode,productType:input.productType}
}
