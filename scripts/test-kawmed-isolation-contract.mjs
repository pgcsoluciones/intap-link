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

const claim = read('app/src/components/admin/KawMedClaim.tsx')
const master = read('app/src/components/admin/KawMedMasterClaim.tsx')
const login = read('app/src/components/admin/AdminLogin.tsx')
const callback = read('app/src/components/admin/AuthCallback.tsx')
const medicalCodes = read('api/src/medical-access-codes.ts')
for (const text of ["claim-check/", "confirm_account:true", "confirm_email:account.email", "Cerrar sesión y usar otro correo", "Ir a iniciar sesión", "Salir de la activación"]) {
 assert.ok(claim.includes(text), 'MED account safety / escape missing: '+text)
}
for (const text of ["confirm_account:true", "confirm_email:currentEmail", "setWrongAccount(access.data?.allowed!==true)", "Ir a iniciar sesión", "Salir de la activación"]) {
 assert.ok(master.includes(text), 'Master account safety / escape missing: '+text)
}
for (const text of ["kawmed_account_mismatch", "kawmed_confirmation_required", "kawmed_existing_link_account", "kawmed/claim-check/:code"]) {
 assert.ok(medicalCodes.includes(text), 'Medical API security guard missing: '+text)
}
assert.ok(login.includes("isMedicalResume")&&login.includes("isMedicalMasterResume"),'MED login resume must be explicit')
assert.ok(callback.includes("kawvo_kawmed_claim_resume")&&callback.includes("kawvo_kawmed_master_resume"),'MED magic-link callback must restore activation')

assert.ok(claim.includes("Entrar a mi KawMed"),'Claimed MED codes must offer owner dashboard recovery')
assert.ok(medicalCodes.includes("codeOwned?'already_owned':'code_unavailable'"),'Claimed MED code owner must be checked server-side')
const masterPost=medicalCodes.split("app.post('/api/v1/me/kawmed-master/claim'")[1]?.split("app.get('/api/v1/superadmin/kawmed/codes'")[0]||''
assert.ok(masterPost.includes("body.confirm_account!==true"),'Master claim must require consent at POST boundary')
assert.ok(masterPost.includes("clean(body.confirm_email,254).toLowerCase()!==accountEmail"),'Master claim must verify confirmed email at POST boundary')
assert.ok(masterPost.includes("kawmed_existing_link_account"),'Master claim must refuse Link collision at POST boundary')
const medPost=medicalCodes.split("app.post('/api/v1/me/kawmed/claim'")[1]?.split("async function sponsorMembership")[0]||''
assert.ok(medPost.includes("body.confirm_account!==true"),'Independent MED claim must require consent')
assert.ok(medPost.includes("clean(body.confirm_email,254).toLowerCase()!==checkEmail"),'Independent MED claim must verify confirmed email')
const homeRoute=read('api/src/account-home-route.ts')
for(const route of ["'/admin/medical'","'/admin/sponsor/kawmed'"]) {
 assert.ok(homeRoute.includes(route),'Medical account home-route missing: '+route)
}
assert.ok(homeRoute.includes("email!=='intapcard@gmail.com'"),'Special multiaccount must not be hijacked by medical home-route')

const lifecycleApi=read('api/src/medical-profile-owner.ts')
const lifecycleUi=read('app/src/components/admin/medical/MedicalDashboard.tsx')
for(const part of ["medical-profile/suspend","medical-profile/reactivate","medical-profile/delete-account","ELIMINAR KAWMED","shared_account_protected","DELETE FROM users WHERE id=?","DELETE FROM auth_sessions WHERE user_id=?","email_released:true"]){
 assert.ok(lifecycleApi.includes(part),'Medical lifecycle API contract missing: '+part)
}
for(const part of ["Suspender perfil","Reactivar perfil","Eliminar cuenta KawMed definitivamente","Confirmar eliminación definitiva","account_email"]){
 assert.ok(lifecycleUi.includes(part),'Medical lifecycle UI missing: '+part)
}
assert.ok(lifecycleApi.includes("if(ownerScope(c)!=='doctor')"),'Master profile must be protected')
assert.ok(lifecycleApi.includes("email==='intapcard@gmail.com'"),'Operator multicuenta must be protected')
assert.ok(lifecycleApi.includes("DELETE FROM appointment_requests WHERE subject_type='medical'"),'Medical appointments must not be orphaned')
assert.ok(lifecycleApi.includes("status='inactive',claimed_by_user_id=NULL"),'MED codes must never be reused after deletion')

console.log('KawMed isolated integration: contract invariants OK')
