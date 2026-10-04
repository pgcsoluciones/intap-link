import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const freeBank=await readFile('web/src/components/free-profile/PublicBankAccounts.tsx','utf8')
const sponsoredBank=await readFile('web/src/components/sponsored/SponsoredBankAccounts.tsx','utf8')
const freeAppointments=await readFile('api/src/free-appointments.ts','utf8')
const sponsoredAppointments=await readFile('api/src/sponsored-appointments.ts','utf8')
const dashboardTour=await readFile('app/src/components/admin/free/FreeGuidedTour.tsx','utf8')
const accountTour=await readFile('app/src/components/admin/free/FreeAccountGuidedTour.tsx','utf8')
const teamTour=await readFile('app/src/components/admin/free/FreeTeamGuidedTour.tsx','utf8')
const tourHelper=await readFile('app/src/components/admin/free/freeTourPersistence.ts','utf8')
const freeQuote=await readFile('web/src/components/free-profile/FreeContactActions.tsx','utf8')
const sponsoredQuote=await readFile('web/src/components/sponsored/SponsoredProfile.tsx','utf8')
const middleware=await readFile('functions/_middleware.ts','utf8')

for(const [name,source] of [['Free',freeBank],['Patrocinado',sponsoredBank]]){
  assert.match(source,/ClipboardItem/,`${name}: RNC/CÉD usa ClipboardItem`)
  assert.match(source,/holder-id/,`${name}: conserva endpoint protegido de identidad`)
}

for(const [name,source] of [['Free agenda',freeAppointments],['Patrocinado agenda',sponsoredAppointments]]){
  assert.match(source,/function formatPhoneForMessage/,`${name}: falta normalización visual del teléfono`)
  assert.match(source,/Mi teléfono es '\+formatPhoneForMessage\(row\.customer_phone\)/,`${name}: mensaje sigue usando teléfono crudo`)
}

assert.match(freeAppointments,/tour_auto_disabled:template\.free_tour_auto_disabled===true/,'API expone preferencia del recorrido')
assert.match(freeAppointments,/template\.free_tour_auto_disabled=body\.tour_auto_disabled===true/,'API guarda preferencia del recorrido')
assert.match(tourHelper,/apiPatch\('\/me\/free\/experience', \{ tour_auto_disabled: true \}\)/,'Ya entendí persiste server-side')
for(const [name,source] of [['Dashboard',dashboardTour],['Mi cuenta',accountTour],['Team',teamTour]]){
  assert.match(source,/isFreeTourAutoDisabled/,`${name}: consulta preferencia server-side`)
  assert.match(source,/disableFreeTourAuto/,`${name}: persiste Ya entendí`)
}

for(const [name,source] of [['Free cotización',freeQuote],['Patrocinado cotización',sponsoredQuote]]){
  assert.match(source,/rnc:''/,`${name}: falta RNC en estado`)
  const n=source.indexOf('>Nombre *')
  const r=source.indexOf('>RNC <span')
  const p=source.indexOf('>Teléfono *')
  assert.ok(n>=0&&r>n&&p>r,`${name}: RNC debe ir debajo de Nombre y antes de Teléfono`)
  assert.match(source,/Mi RNC es/,`${name}: RNC no viaja en la solicitud`)
  assert.doesNotMatch(source,/opcional si adjuntas media/,`${name}: no debe mostrar nota opcional si adjuntas media`)
}

assert.match(middleware,/Solicita una cotización con \$\{businessName\} \| Kawvo Link/,'Patrocinado: título social contextual')
assert.match(middleware,/cotizar=1: social card contextual para perfiles Free\/Team/,'Free/Team: falta card social contextual')
assert.match(middleware,/Te comparto el formulario de cotización \/ información de \$\{businessName\}/,'Card social: falta contexto del formulario')
assert.match(freeQuote,/Completa tu solicitud aquí:/,'Free: mensaje compartido debe explicar el enlace aunque Instagram no genere card')
assert.match(sponsoredQuote,/Completa tu solicitud aquí:/,'Patrocinado: mensaje compartido debe explicar el enlace aunque Instagram no genere card')

console.log('Consolidated fixes contract: OK')
