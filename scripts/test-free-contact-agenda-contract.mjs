import fs from 'node:fs'

function read(path){return fs.readFileSync(path,'utf8')}
function has(text,needle,label){if(!text.includes(needle))throw new Error('Falta contrato: '+label)}
function absent(text,needle,label){if(text.includes(needle))throw new Error('Regresión: '+label)}
function ordered(text,needles,label){
  let cursor=-1
  for(const needle of needles){
    const next=text.indexOf(needle,cursor+1)
    if(next<0)throw new Error('Falta contrato de orden '+label+': '+needle)
    if(next<=cursor)throw new Error('Orden inválido '+label+': '+needle)
    cursor=next
  }
}

const profile=read('web/src/components/free-profile/IntapLinkGratisProfile.tsx')
const actions=read('web/src/components/free-profile/FreeContactActions.tsx')
const banks=read('web/src/components/free-profile/PublicBankAccounts.tsx')
const adapter=read('web/src/components/free-profile/IntapLinkGratis.adapter.ts')
const dashboard=read('app/src/components/admin/free/FreeDashboard.tsx')
const account=read('app/src/components/admin/free/FreeAccount.tsx')
const settings=read('app/src/components/admin/free/FreeExperienceSettings.tsx')
const app=read('app/src/App.tsx')
const pwa=read('app/src/components/admin/free/FreePwaHome.tsx')
const bridge=read('app/src/components/notifications/PwaNotificationBridge.tsx')
const api=read('api/src/free-appointments.ts')
const publicApi=read('api/src/index.ts')
const entry=read('api/src/preview-free-entry.ts')
const homeRoute=read('api/src/account-home-route.ts')
const core=read('api/src/appointments-core.ts')
const previewRunner=read('scripts/run-preview-free-contact-agenda-2026-09-30.sh')
const types=read('web/src/components/free-profile/IntapLinkGratis.types.ts')

has(types,'experience?: FreeProfileExperience','experiencia Free es compatible con Demo/Trial que reutilizan la plantilla base')

// Lo aprobado arriba de la plantilla Free no se mueve.
ordered(profile,[
  '<Identity profile={profile}',
  'ilx-main-cta',
  'ilx-quick',
  'ilx-save-contact',
  'ilx-about',
  '<FreeContactActions',
  'ilx-portfolio',
  'id="ilx-bank-slot"',
  'ilx-links',
  'ilx-share',
],'plantilla pública Free')

has(profile,'<FreeContactActions profile={profile} colors={colors} />','perfil Free integra las nuevas acciones sin una segunda fuente de datos')
absent(profile,'ilx-services-section','Servicios no debe renderizarse como sección pública Free')
absent(profile,'/>\\\\n\\\\n          {customLinks','no deben renderizarse escapes de salto de línea antes de Mis enlaces')
absent(dashboard,"to: '/admin/free/services'",'Servicios no debe aparecer como opción del panel Free')
absent(dashboard,'Agrega tus servicios','copy de Servicios no debe reaparecer en panel Free')

has(actions,'Nuestro horario','sección pública de horario')
has(actions,"gridTemplateColumns:'44px minmax(0,1fr) auto'",'Horario Free replica geometría visual del Patrocinado')
has(actions,"background:'var(--ilx-action)'",'Horario usa la paleta propia del Free')
has(actions,"experience.appointmentEnabled?<>Cotizar /<br/>información</>:<>Cotizar / información</>",'Cotizar usa dos líneas solo cuando comparte fila con Agenda')
has(actions,'Agendar','CTA Agenda')
has(actions,'Compartir formulario','enlace compartir cotización')
has(actions,'Compartir agendar','enlace compartir agenda')
if((actions.match(/minHeight:66/g)||[]).length<2)throw new Error('Cotizar y Agendar deben mantener la misma altura visual')
has(actions,"background:'var(--ilx-action)'",'Cotizar hereda paleta Free')
has(actions,"border:'1.5px solid var(--ilx-action)'",'Agendar hereda paleta Free')
has(actions,"apiBase+'/appointments'",'Agenda pública Free reutiliza AppointmentRequestModal')
has(actions,"params.get('cotizar')==='1'",'deep link Cotizar Free')
has(actions,"params.get('agendar')==='1'",'deep link Agenda Free')
absent(actions,'free-experience','la UI Free no debe depender de un segundo fetch silencioso')
has(actions,'const experience=profile.experience??{schedule:[],quoteButtonVisible:false,appointmentEnabled:false}','consumidores Demo/Trial no reciben acciones Free por omisión')
has(actions,'experience.quoteButtonVisible','Cotizar se renderiza desde el payload canónico')
has(actions,'experience.appointmentEnabled','Agenda se renderiza desde el payload canónico')

has(adapter,"readString(templateData, 'free_portfolio_title', 'portfolio_section_title')",'nombre Catálogo/Portafolio editable')
has(banks,"document.getElementById('ilx-bank-slot')",'cuentas bancarias usan la posición definida dentro de la plantilla')

has(account,'<FreeExperienceSettings />','Horario/Cotización/Agenda viven en Mi cuenta')
has(settings,'PRESENTACIÓN Y CONTACTO','grupo integrado en Mi cuenta')
has(settings,'Guardar horario','Mi cuenta edita y guarda horario independiente de Agenda')
has(settings,'Configurar disponibilidad de Agenda','Agenda conserva su configuración separada del horario público')
has(settings,'Cotizar / información','control Cotizar en Mi cuenta')
has(settings,'Agenda','control Agenda en Mi cuenta')
has(settings,'Nombre de Catálogo / Portafolio','nombre editable de catálogo/portafolio')

has(app,'path="/admin/free/agenda"','ruta privada de Agenda Free')
has(homeRoute,"agenda_route:'/admin/free/agenda'",'Home/PWA conoce ruta Agenda Free')
has(pwa,"'free_appointment_request'",'Home PWA muestra solicitudes Free')
has(bridge,"'free_appointment_request'",'PWA avisa solicitudes Free')

has(entry,"import './free-appointments'",'Worker registra endpoints Free')
has(publicApi,'freeExperience','API pública canónica incluye experiencia Free')
has(publicApi,'freeAppointmentSettings','payload canónico incluye estado de Agenda Free')
has(publicApi,'rawFreeAvailability','payload canónico incluye disponibilidad de horario Free')
has(publicApi,'quote_button_visible: publicTemplateData.free_quote_button_visible !== false','Cotizar viene activo por defecto desde la API canónica')
has(adapter,"readObject(data, 'freeExperience')",'adaptador consume experiencia Free del payload canónico')
has(api,"'/api/v1/public/profiles/:slug/appointments'",'API pública de Agenda Free')
has(api,"'/api/v1/me/free/experience'",'API privada de configuración Free')
has(api,"'/api/v1/me/free/appointments'",'API privada de Agenda Free')
has(api,"type:'free'",'Agenda usa subject_type Free')
has(api,"template?.free_quote_button_visible!==false",'API de configuración mantiene Cotizar activo por defecto')
has(api,'Debes mantener visible al menos Cotizar / información o Agendar.','nunca se apagan ambas acciones')
has(api,'free_schedule_configured','Horario Free es independiente de Agenda y admite edición explícita')
has(core,'subject_type','motor Agenda sigue siendo reutilizable por sujeto')
has(core,'DEFAULT_AVAILABILITY','Free reutiliza la disponibilidad genérica, sin duplicar motor')
has(previewRunner,'run npm run build:preview -w web','Preview Web compila con .env.preview y nunca con configuración de Producción')
absent(previewRunner,'run npm run build -w web','runner no puede compilar Web Preview en modo production')
has(previewRunner,'https://preview.intaprd.com','runner valida contra dominio/API Preview')
has(previewRunner,'https://api.intaprd.com','runner detecta y bloquea contaminación del bundle con API de Producción')
has(previewRunner,'D1 Preview','runner valida un perfil real existente en la base Preview')

console.log('Free Contact + Agenda contract checks: OK')
