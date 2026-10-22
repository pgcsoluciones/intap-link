import fs from 'node:fs'
import assert from 'node:assert/strict'

const read = path => fs.readFileSync(path, 'utf8')
const web = read('web/src/App.tsx')
const app = read('app/src/App.tsx')
const owner = read('web/src/components/appointments/AppointmentOwnerBar.tsx')
const modal = read('web/src/components/appointments/AppointmentRequestModal.tsx')
const sponsor = read('api/src/sponsored-multiprofile-access.ts')
const worker = read('api/src/preview-free-entry.ts')
const api = read('api/src/index.ts')
assert.match(web, /path="\/m\/:slug"/, 'KawMed public route missing')
assert.match(web, /path="\/:slug"/, 'Legacy public profile route missing')
for (const route of ['/claim/kawmed','/claim/kawmed-master','/admin/medical','/admin/medical/agenda','/admin/medical/notifications','/admin/sponsor/kawmed','/superadmin/kawmed']) {
 assert.ok(app.includes('path="'+route+'"'), 'Medical App route missing: '+route)
}
for (const route of ['/trial/login','/admin/sponsored','/admin/sponsor','/superadmin/trials']) {
 assert.ok(app.includes('path="'+route+'"'), 'Existing App route missing: '+route)
}
assert.ok(owner.includes('mobileMenu?:boolean') && owner.includes('mobileMenu=false'), 'Mobile menu must remain opt-in')
assert.ok(owner.includes("settingsLabel='Configuración'"), 'Owner settings label default must be preserved')
assert.ok(modal.includes('detailsPlaceholder?:string'), 'Medical details placeholder must be optional')
assert.ok(modal.includes("detailsPlaceholder||'Ej.:"), 'Legacy appointment placeholder fallback must remain')
for (const name of ['sponsoredMultiProfileAccess','requestedSponsoredProfileId','listOwnedSponsoredBeneficiaryProfiles','resolveSponsorMembership','setSponsorContext']) {
 assert.match(sponsor,new RegExp('export (?:async )?function '+name+'\\('),'Sponsored integration missing '+name)
}
for (const mod of ['medical-appointments','medical-profile-owner','medical-access-codes']) {
 assert.ok(worker.includes("import './"+mod+"'"),'Medical worker registration missing: '+mod)
}
assert.ok(api.includes('registerMedicalProfileRoutes(app)'), 'Medical profile API registration missing')
const migrationFiles=['0090','0091','0092','0093','0094','0095','0096','0097','0098','0099','0150']
for (const id of migrationFiles){
 const names=fs.readdirSync('api/migrations').filter(n=>n.startsWith(id+'_kawmed_'))
 assert.equal(names.length,1,'Medical migration missing or ambiguous: '+id)
 const sql=read('api/migrations/'+names[0])
 assert.doesNotMatch(sql,/kawmed_demo_laura_mendez|kawmed_ins_ex_1|kawmed_ins_accept_1/,'Demo seed in production migration: '+names[0])
}
const medicalProfile = read('web/src/components/medical-profile/KawMedProfile.tsx')
for (const key of ["modal === 'schedule'", "modal === 'centers'"]) {
 assert.ok(medicalProfile.includes(key), 'Medical modal missing: '+key)
}
const bookingFromModal = /footer=\{<button[^>]+className="kawmed-modal__appointment-cta"[^>]+onClick=\{\(\) => \{ setModal\(null\); setAppointmentOpen\(true\) \}\}/g
assert.equal([...medicalProfile.matchAll(bookingFromModal)].length,2,'Both schedule and centers must offer booking CTA')
assert.ok(medicalProfile.includes('<AppointmentRequestModal'), 'Booking form must exist')

console.log('KawMed isolated integration: contract invariants OK')
