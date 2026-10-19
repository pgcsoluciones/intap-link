import fs from 'node:fs'

function read(path){ return fs.readFileSync(path,'utf8') }
function assert(condition,message){ if(!condition){ console.error('✗ '+message); process.exit(1) } }

const apiIndex=read('api/src/index.ts')
const route=read('api/src/routes/medical-profile.ts')
const webApp=read('web/src/App.tsx')
const profile=read('web/src/components/medical-profile/KawMedProfile.tsx')
const appointment=read('web/src/components/medical-profile/KawMedAppointmentModal.tsx')
const previewMigration=read('api/migrations-preview/0090_kawmed_medical_profiles_v1.sql')
const previewInsurance=read('api/migrations-preview/0091_kawmed_insurance_exclusions.sql')
const prodMigration=read('api/migrations/0090_kawmed_medical_profiles_v1.sql')
const prodInsurance=read('api/migrations/0091_kawmed_insurance_exclusions.sql')

assert(apiIndex.includes("registerMedicalProfileRoutes"),'API no registra KawMed')
assert(route.includes("/api/v1/public/medical-profiles/:slug"),'falta endpoint público KawMed')
assert(route.includes("medical_profile_centers"),'falta centros médicos')
assert(route.includes("medical_profile_schedules"),'falta horarios médicos')
assert(route.includes("medical_profile_services"),'falta servicios médicos')
assert(route.includes("medical_profile_insurance_exclusions"),'falta política de exclusiones de seguros')
assert(webApp.includes("components/medical-profile/KawMedProfile"),'Web no carga componente KawMed')
assert(webApp.includes('path="/m/:slug"'),'falta ruta pública /m/:slug')
assert(profile.includes("/public/medical-profiles/"),'KawMed no consume su API pública')
assert(profile.includes("/assets/kawmed/laura-mendez-hero.jpg"),'falta fallback visual del demo KawMed')
assert(profile.includes("insurance_policy"),'perfil público no presenta política de seguros')
assert(appointment.includes("solicitar una cita"),'falta flujo de solicitud de cita por WhatsApp')

for (const [name,sql] of [
  ['preview 0090',previewMigration],
  ['production 0090',prodMigration],
]) {
  assert(sql.includes('CREATE TABLE IF NOT EXISTS medical_profiles'),name+': falta medical_profiles')
  assert(sql.includes('CREATE TABLE IF NOT EXISTS medical_profile_centers'),name+': falta medical_profile_centers')
  assert(sql.includes('CREATE TABLE IF NOT EXISTS medical_profile_schedules'),name+': falta medical_profile_schedules')
  assert(sql.includes('CREATE TABLE IF NOT EXISTS medical_profile_services'),name+': falta medical_profile_services')
  assert(sql.includes("'lauramendez'"),name+': falta demo Laura Méndez')
}

for (const [name,sql] of [
  ['preview 0091',previewInsurance],
  ['production 0091',prodInsurance],
]) {
  assert(sql.includes('medical_profile_insurance_exclusions'),name+': falta tabla de exclusiones')
}

console.log('KawMed medical profile v1 contract: OK')
