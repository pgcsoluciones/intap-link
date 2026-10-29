import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const med=readFileSync('app/src/components/admin/SuperAdminKawMed.tsx','utf8')
const sponsors=readFileSync('app/src/components/admin/SuperAdminSponsors.tsx','utf8')
const welcome=readFileSync('web/src/components/sponsored/SponsoredAwareArtifactResolver.tsx','utf8')
assert.match(med,/>Estación<\/th>/)
assert.doesNotMatch(med,/>Est\.<\/th>/)
assert.match(med,/row\.display_code\|\|'—'/)
assert.match(sponsors,/>Producto \(ID\)<\/th>/)
assert.match(welcome,/Producto '\+physicalId/)
console.log('Terminología física MED estación vs patrocinio producto: OK')
