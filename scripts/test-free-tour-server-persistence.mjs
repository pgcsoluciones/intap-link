import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const api = await readFile('api/src/free-appointments.ts','utf8')
const dashboard = await readFile('app/src/components/admin/free/FreeGuidedTour.tsx','utf8')
const account = await readFile('app/src/components/admin/free/FreeAccountGuidedTour.tsx','utf8')
const team = await readFile('app/src/components/admin/free/FreeTeamGuidedTour.tsx','utf8')
const helper = await readFile('app/src/components/admin/free/freeTourPersistence.ts','utf8')

assert.match(api,/tour_auto_disabled:template\.free_tour_auto_disabled===true/,'API expone preferencia persistida')
assert.match(api,/template\.free_tour_auto_disabled=body\.tour_auto_disabled===true/,'API guarda preferencia persistida')
assert.match(helper,/apiGet\('\/me\/free\/experience'\)/,'helper consulta preferencia server-side')
assert.match(helper,/apiPatch\('\/me\/free\/experience', \{ tour_auto_disabled: true \}\)/,'helper persiste Ya entendí server-side')

for (const [name,source] of [['Dashboard',dashboard],['Mi cuenta',account],['Team',team]]) {
  assert.match(source,/isFreeTourAutoDisabled/,`${name}: auto-recorrido consulta preferencia de cuenta`)
  assert.match(source,/disableFreeTourAuto/,`${name}: Ya entendí persiste en la cuenta`)
}
assert.match(dashboard,/const onReplay = \(\) => start\(true\)/,'Recorrido manual Dashboard sigue disponible')
assert.match(account,/start\(true\)/,'Recorrido manual Mi cuenta sigue disponible')
assert.match(team,/start\(true\)/,'Recorrido manual Team sigue disponible')

console.log('Free tour server persistence contract: OK')
