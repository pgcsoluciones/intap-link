import fs from 'node:fs'

function read(path){return fs.readFileSync(path,'utf8')}
function has(text,needle,label){if(!text.includes(needle))throw new Error(`Falta contrato: ${label}`)}

const core=read('api/src/appointments-core.ts')
const modal=read('web/src/components/appointments/AppointmentRequestModal.tsx')
const manager=read('app/src/components/appointments/AppointmentManager.tsx')
const free=read('api/src/free-appointments.ts')
const sponsored=read('api/src/sponsored-appointments.ts')

has(core,'normalizeAppointmentPhone','núcleo normaliza teléfono del solicitante')
has(core,"replace(/\\D/g,'')",'normalización elimina @, espacios, guiones y símbolos')
has(core,"digits.startsWith('00')",'normalización acepta prefijo internacional 00')
has(core,"digits.length===10&&/^(809|829|849)/.test(digits)",'normalización agrega código país a números RD')
has(core,"phone=normalizeAppointmentPhone(body?.phone)",'solicitud persiste número normalizado')
has(core,"phone.length<7",'backend rechaza teléfono inválido')
has(core,"customer_phone:normalizeAppointmentPhone(row.customer_phone)",'lectura normaliza solicitudes históricas')

has(modal,'function normalizePhoneInput','formulario filtra caracteres ajenos al teléfono')
has(modal,"replace(/[^0-9+()\\-\\s]/g,'')",'campo no permite @')
has(modal,'Teléfono / WhatsApp *','etiqueta explica uso WhatsApp')

has(manager,'function waPhone(value:string)','gestor normaliza número antes de WhatsApp')
has(manager,"digits.length===10&&/^(809|829|849)/.test(digits)",'gestor agrega código país RD')
has(manager,"'https://wa.me/'+waPhone(item.customer_phone)",'respuesta usa wa.me con número canónico')
has(manager,'displayPhone(item.customer_phone)','card muestra teléfono limpio')

has(free,"whatsapp_url:'https://wa.me/'+whatsapp",'Agenda Free conserva envío al WhatsApp del negocio')
has(sponsored,"whatsapp_url:'https://wa.me/'+whatsapp",'Agenda patrocinada conserva envío al WhatsApp del negocio')

console.log('Agenda phone normalization contract: OK')
