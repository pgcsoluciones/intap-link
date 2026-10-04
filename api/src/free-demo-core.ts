import { ensureAppointmentSubject } from './appointments-core'

export const FREE_DEMO_MANAGER_EMAIL='intapcard@gmail.com'
export const FREE_DEMO_PRESETS=['professional','wellness','food','retail','creative','business','hardware'] as const

type DemoSnapshot={
  name:string; role:string; bio:string; category:string; subcategory?:string;
  layout_id:string; free_palette_id:string; avatar_url:string; hero_url:string;
  contact:{whatsapp:string;phone:string;email:string;address:string;map_url:string};
  services:Array<{title:string;description:string;image_url:string}>;
  gallery:Array<{title:string;description:string;image_key:string;alt_text:string}>;
  template_data:Record<string,any>;
}

const A='/assets/free-starter/'
function img(folder:string,n:number){return `${A}${folder}/${folder}-${String(n).padStart(2,'0')}.webp`}
function snapshot(folder:string,input:{name:string;role:string;bio:string;category:string;palette:string;services:[string,string][]}):DemoSnapshot{
  return {
    name:input.name,role:input.role,bio:input.bio,category:input.category,subcategory:'',
    layout_id:'impacto',free_palette_id:input.palette,avatar_url:img(folder,2),hero_url:img(folder,1),
    contact:{whatsapp:'18090000000',phone:'18090000000',email:'',address:'Santo Domingo, República Dominicana',map_url:'https://www.google.com/maps/search/?api=1&query=Santo+Domingo+Republica+Dominicana'},
    services:input.services.slice(0,3).map((x,i)=>({title:x[0],description:x[1],image_url:img(folder,i+3)})),
    gallery:[2,3,4,5,6].map((n,i)=>({title:`Trabajo ${i+1}`,description:'Ejemplo visual de trabajos, proyectos o productos.',image_key:img(folder,n),alt_text:`Trabajo ${i+1}`})),
    template_data:{
      role:input.role,
      free_identity_confirmed:true,
      free_quote_button_visible:true,
      free_schedule_visible:true,
      free_schedule_configured:true,
      free_schedule:[{day:'Lunes a Viernes',hours:'8:00 AM - 6:00 PM'},{day:'Sábados',hours:'9:00 AM - 1:00 PM'}],
      services_title:'Mis servicios',
      services_description:'Conoce cómo podemos ayudarte.',
      portfolio_title:'Mis trabajos',
      free_demo_seed:true,
    },
  }
}

export function freeDemoPreset(key:string):DemoSnapshot{
  const presets:Record<string,DemoSnapshot>={
    professional:snapshot('servicios-profesionales',{name:'Laura Gómez',role:'Profesional independiente',bio:'Soluciones prácticas, atención personalizada y un servicio pensado para cada necesidad.',category:'Servicios profesionales',palette:'oceano',services:[['Asesoría personalizada','Una solución pensada para lo que necesitas.'],['Consultoría profesional','Acompañamiento claro para tomar mejores decisiones.'],['Atención especializada','Servicio directo, profesional y cercano.']]}),
    wellness:snapshot('salud-bienestar',{name:'Carla Wellness',role:'Especialista en bienestar',bio:'Experiencias de cuidado personal con atención cercana y profesional.',category:'Salud y bienestar',palette:'esmeralda',services:[['Cuidado personalizado','Atención adaptada a tus objetivos.'],['Tratamientos','Opciones de bienestar con acompañamiento profesional.'],['Reserva tu cita','Coordina tu próxima atención.']]}),
    food:snapshot('gastronomia-alimentos',{name:'Sabor Local',role:'Cocina & experiencias',bio:'Sabores preparados con dedicación para pedidos, eventos y experiencias gastronómicas.',category:'Gastronomía y alimentos',palette:'grafito',services:[['Nuestro menú','Descubre una selección preparada para cada ocasión.'],['Pedidos','Haz tu pedido de forma rápida y sencilla.'],['Eventos y catering','Opciones para reuniones y celebraciones.']]}),
    retail:snapshot('comercio-retail-tiendas-virtuales',{name:'Nova Store',role:'Tienda & ventas',bio:'Productos seleccionados, novedades y atención directa para ayudarte a elegir.',category:'Comercio y retail',palette:'violeta',services:[['Novedades','Conoce lo más reciente de nuestra tienda.'],['Pedidos','Consulta disponibilidad y realiza tu pedido.'],['Atención personalizada','Te ayudamos a encontrar la mejor opción.']]}),
    creative:snapshot('arte-diseno-creatividad',{name:'Luna Creativa',role:'Diseño & creación',bio:'Ideas convertidas en piezas visuales y creaciones personalizadas.',category:'Arte, diseño y creatividad',palette:'violeta',services:[['Diseño personalizado','Propuestas pensadas especialmente para ti.'],['Proyectos creativos','Ideas desarrolladas de principio a fin.'],['Creaciones especiales','Piezas únicas para marcas y ocasiones.']]}),
    business:snapshot('servicios-generales',{name:'Grupo Nova',role:'Soluciones empresariales',bio:'Soluciones confiables para empresas y clientes que buscan respuesta rápida y resultados.',category:'Servicios generales',palette:'oceano',services:[['Soluciones','Servicios adaptados a cada necesidad.'],['Soporte y atención','Respuesta directa para solicitudes.'],['Cotizaciones','Recibe información y una propuesta.']]}),
    hardware:snapshot('servicios-generales',{name:'Ferretería Demo',role:'Ferretería y soluciones para tu proyecto',bio:'Herramientas, materiales y atención directa para hogares, técnicos y profesionales.',category:'Ferretería',palette:'oceano',services:[['Herramientas y equipos','Opciones para construcción, reparación y mantenimiento.'],['Plomería y hogar','Soluciones prácticas para instalaciones y mejoras.'],['Cotiza tu proyecto','Solicita precios e información desde un solo lugar.']]}),
  }
  return structuredClone(presets[key]||presets.professional)
}

export function cleanDemoSlug(value:unknown){
  return String(value??'').trim().toLowerCase().replace(/[^a-z0-9-]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,60)
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

export async function createManagedFreeDemo(db:D1Database,input:{
  templateId?:string|null; managerEmail?:string; slug:string; displayName?:string;
  artifactId?:string|null; createdFrom?:'superadmin'|'free_activation';
}){
  const managerId=await managerUserId(db,input.managerEmail||FREE_DEMO_MANAGER_EMAIL)
  if(!managerId)throw new Error('demo_manager_missing')
  const slug=cleanDemoSlug(input.slug)
  if(!validDemoSlug(slug))throw new Error('slug_invalid')
  const exists=await db.prepare('SELECT id FROM profiles WHERE slug=? LIMIT 1').bind(slug).first()
  if(exists)throw new Error('slug_taken')

  let template:any=null
  if(input.templateId)template=await db.prepare('SELECT * FROM free_demo_templates WHERE id=? AND is_active=1 LIMIT 1').bind(input.templateId).first()
  if(!template)template=await db.prepare('SELECT * FROM free_demo_templates WHERE is_active=1 ORDER BY is_default DESC,created_at DESC LIMIT 1').first()
  const snap:DemoSnapshot=template?JSON.parse(String((template as any).snapshot_json||'{}')):freeDemoPreset('professional')
  const profileId=crypto.randomUUID(),demoId=crypto.randomUUID(),syntheticUserId=crypto.randomUUID()
  const syntheticEmail=`free-demo+${profileId}@internal.kawvo.invalid`
  const name=String(input.displayName||snap.name||'Demo Kawvo').trim().slice(0,100)
  const templateData={...(snap.template_data||{}),free_demo_profile:true,free_demo_manager_email:input.managerEmail||FREE_DEMO_MANAGER_EMAIL}

  const statements:any[]=[
    db.prepare('INSERT INTO users(id,email) VALUES(?,?)').bind(syntheticUserId,syntheticEmail),
    db.prepare(`INSERT INTO profiles(id,user_id,slug,plan_id,theme_id,layout_id,name,bio,category,subcategory,free_palette_id,avatar_url,hero_url,template_data,is_published,is_active,created_at,updated_at)
      VALUES(?,?,?,'free','default',?,?,?,?,?,?,?,?,?,0,1,datetime('now'),datetime('now'))`)
      .bind(profileId,syntheticUserId,slug,snap.layout_id||'impacto',name,snap.bio||'',snap.category||'',snap.subcategory||'',snap.free_palette_id||'oceano',snap.avatar_url||'',snap.hero_url||'',JSON.stringify(templateData)),
    db.prepare('INSERT INTO profile_contact(profile_id,whatsapp,email,phone,hours,address,map_url) VALUES(?,?,?,?,?,?,?)')
      .bind(profileId,snap.contact?.whatsapp||'',snap.contact?.email||'',snap.contact?.phone||'',null,snap.contact?.address||'',snap.contact?.map_url||''),
    db.prepare(`INSERT INTO free_demo_profiles(id,profile_id,synthetic_owner_user_id,manager_user_id,template_id,status,rubric,artifact_id,created_from)
      VALUES(?,?,?,?,?,'draft',?,?,?)`).bind(demoId,profileId,syntheticUserId,managerId,template?String((template as any).id):null,template?String((template as any).rubric||''):snap.category||'',input.artifactId||null,input.createdFrom||'superadmin'),
  ]
  snap.services.slice(0,3).forEach((x,i)=>statements.push(db.prepare(`INSERT INTO profile_products(id,profile_id,title,description,price,image_url,whatsapp_text,is_featured,sort_order) VALUES(?,?,?,?,NULL,?,NULL,0,?)`).bind(crypto.randomUUID(),profileId,x.title,x.description,x.image_url||null,i)))
  snap.gallery.slice(0,10).forEach((x,i)=>statements.push(db.prepare(`INSERT INTO profile_gallery(id,profile_id,image_key,alt_text,title,description,sort_order) VALUES(?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),profileId,x.image_key,x.alt_text||x.title,x.title,x.description||'',i)))
  await db.batch(statements)
  await ensureAppointmentSubject(db,'free',profileId)
  await db.prepare(`UPDATE appointment_settings SET enabled=1,updated_at=datetime('now') WHERE subject_type='free' AND subject_id=?`).bind(profileId).run()
  return {demoId,profileId,syntheticUserId,slug,managerId,templateId:template?String((template as any).id):null}
}

export async function createManagedFreeDemoFromArtifact(db:D1Database,input:{
  userId:string;artifactId:string;activationCodeId:string;intentHash:string;publicCode:string;productType:string;claimAt:string;
}){
  const user=await db.prepare('SELECT email FROM users WHERE id=? LIMIT 1').bind(input.userId).first()
  if(String((user as any)?.email||'').trim().toLowerCase()!==FREE_DEMO_MANAGER_EMAIL)return null

  const created=await createManagedFreeDemo(db,{slug:`demo-${String(input.publicCode||'').toLowerCase()}`,artifactId:input.artifactId,createdFrom:'free_activation'})
  try{
    await db.batch([
      db.prepare(`UPDATE intap_artifacts
        SET owner_user_id=?,profile_id=?,status='activated',activated_at=?,updated_at=?
        WHERE id=? AND owner_user_id IS NULL AND status IN('available','unassigned')
          AND EXISTS (
            SELECT 1 FROM artifact_activation_intents i
            JOIN artifact_activation_codes ac ON ac.id=i.activation_code_id
            WHERE i.intent_hash=? AND i.artifact_id=? AND i.activation_code_id=?
              AND i.status='active' AND i.revoked_at IS NULL AND i.expires_at>?
              AND ac.artifact_id=? AND ac.status='active'
              AND (ac.expires_at IS NULL OR ac.expires_at>?)
          )`).bind(created.syntheticUserId,created.profileId,input.claimAt,input.claimAt,input.artifactId,input.intentHash,input.artifactId,input.activationCodeId,input.claimAt,input.artifactId,input.claimAt),
      db.prepare(`UPDATE artifact_activation_codes SET status='used',used_at=?
        WHERE id=? AND artifact_id=? AND status='active'
          AND (expires_at IS NULL OR expires_at>?)
          AND EXISTS (
            SELECT 1 FROM intap_artifacts a
            WHERE a.id=? AND a.owner_user_id=? AND a.profile_id=? AND a.status='activated' AND a.activated_at=?
          )`).bind(input.claimAt,input.activationCodeId,input.artifactId,input.claimAt,input.artifactId,created.syntheticUserId,created.profileId,input.claimAt),
      db.prepare(`UPDATE artifact_activation_intents SET status='consumed',consumed_at=?
        WHERE intent_hash=? AND artifact_id=? AND activation_code_id=?
          AND status='active' AND revoked_at IS NULL AND expires_at>?
          AND EXISTS (
            SELECT 1 FROM artifact_activation_codes ac
            WHERE ac.id=? AND ac.status='used' AND ac.used_at=?
          )`).bind(input.claimAt,input.intentHash,input.artifactId,input.activationCodeId,input.claimAt,input.activationCodeId,input.claimAt),
      db.prepare(`INSERT INTO artifact_activation_claims
        (intent_hash,artifact_id,activation_code_id,user_id,profile_id,claim_at,ok)
        VALUES(?,?,?,?,?,?,CASE WHEN EXISTS(
          SELECT 1
          FROM intap_artifacts a
          JOIN artifact_activation_codes ac ON ac.id=?
          JOIN artifact_activation_intents i ON i.intent_hash=?
          WHERE a.id=? AND a.owner_user_id=? AND a.profile_id=? AND a.status='activated' AND a.activated_at=?
            AND ac.artifact_id=a.id AND ac.status='used' AND ac.used_at=?
            AND i.artifact_id=a.id AND i.activation_code_id=ac.id AND i.status='consumed' AND i.consumed_at=?
        ) THEN 1 ELSE 0 END)`).bind(
          input.intentHash,input.artifactId,input.activationCodeId,input.userId,created.profileId,input.claimAt,
          input.activationCodeId,input.intentHash,input.artifactId,created.syntheticUserId,created.profileId,input.claimAt,input.claimAt,input.claimAt
        ),
    ])
  }catch(error){
    // createManagedFreeDemo committed its canonical Free shell first. If the
    // activation receipt fails, remove that shell so a failed/raced device
    // activation never leaves a ghost Demo behind.
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

  return {...created,publicCode:input.publicCode,productType:input.productType}
}
