import fs from 'node:fs'
import ts from 'typescript'

function assert(condition,label){
  if(!condition)throw new Error(`Falla Agenda phone normalization: ${label}`)
}

const corePath='api/src/appointments-core.ts'
const coreSource=fs.readFileSync(corePath,'utf8')
const transpiled=ts.transpileModule(coreSource,{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022},
  fileName:corePath,
}).outputText
const core=await import('data:text/javascript;base64,'+Buffer.from(transpiled).toString('base64'))
const normalize=core.normalizeAppointmentPhone
assert(typeof normalize==='function','normalizeAppointmentPhone debe exportarse y ser ejecutable')

const cases=[
  ['@809-555-1234','18095551234'],
  ['8095551234','18095551234'],
  ['(829) 555-1234','18295551234'],
  ['849 555 1234','18495551234'],
  ['+1 (809) 555-1234','18095551234'],
  ['0018095551234','18095551234'],
]
for(const [input,expected] of cases){
  const actual=normalize(input)
  assert(actual===expected,`${JSON.stringify(input)} -> ${actual}; esperado ${expected}`)
}
assert(normalize('@')==='', 'un valor sin dígitos no puede convertirse en destino WhatsApp')

const availabilityStart=coreSource.indexOf('export async function getAppointmentAvailabilityRows')
const blocksStart=coreSource.indexOf('export async function getAppointmentBlocks',availabilityStart)
assert(availabilityStart>=0&&blocksStart>availabilityStart,'se puede delimitar getAppointmentAvailabilityRows')
const availabilitySource=coreSource.slice(availabilityStart,blocksStart)
assert(!availabilitySource.includes('customer_phone'),'disponibilidad no debe intentar normalizar customer_phone')

const listStart=coreSource.indexOf('export async function listAppointmentRequests')
const confirmStart=coreSource.indexOf('export async function confirmAppointmentRequest',listStart)
assert(listStart>=0&&confirmStart>listStart,'se puede delimitar listAppointmentRequests')
const listSource=coreSource.slice(listStart,confirmStart)
assert(listSource.includes('customer_phone:normalizeAppointmentPhone(row.customer_phone)'),'lectura de solicitudes normaliza históricos antes de llegar al panel')

const createStart=coreSource.indexOf('export async function createAppointmentRequest')
assert(createStart>=0&&listStart>createStart,'se puede delimitar createAppointmentRequest')
const createSource=coreSource.slice(createStart,listStart)
assert(createSource.includes('phone=normalizeAppointmentPhone(body?.phone)'),'nuevas solicitudes se normalizan antes de persistir')
assert(createSource.includes('phone.length<7'),'backend rechaza teléfonos insuficientes')

const manager=fs.readFileSync('app/src/components/appointments/AppointmentManager.tsx','utf8')
assert(manager.includes("digits.length===10&&/^(809|829|849)/.test(digits)"),'respuesta de confirmación agrega código país RD')
assert(manager.includes("'https://wa.me/'+waPhone(item.customer_phone)"),'respuesta de confirmación usa destino WhatsApp normalizado')
assert(manager.includes('displayPhone(item.customer_phone)'),'panel muestra teléfono limpio en vez del valor crudo')

const modal=fs.readFileSync('web/src/components/appointments/AppointmentRequestModal.tsx','utf8')
assert(modal.includes('normalizePhoneInput'),'formulario filtra caracteres ajenos al teléfono')
assert(modal.includes('Teléfono / WhatsApp *'),'campo explica que el número se usará en WhatsApp')

console.log('Agenda phone normalization contract: OK')
