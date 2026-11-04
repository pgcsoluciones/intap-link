import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(path, 'utf8')
const medicalApi = read('api/src/medical-access-codes.ts')
const medicalMaster = read('app/src/components/admin/sponsored/SponsorKawMed.tsx')
const medicalAdmin = read('app/src/components/admin/SuperAdminKawMed.tsx')
const sponsoredApi = read('api/src/sponsored-profiles.ts')
const sponsoredMaster = read('app/src/components/admin/sponsored/SponsorDashboard.tsx')
const sponsoredGeneration = read('api/src/sponsored-code-generation.ts')
const linkApi = read('api/src/index.ts')
const scan = read('api/src/scan-status.ts')

function between(source, begin, end) {
  const start = source.indexOf(begin)
  assert.notEqual(start, -1, 'Missing boundary: ' + begin)
  const stop = source.indexOf(end, start + begin.length)
  assert.notEqual(stop, -1, 'Missing boundary: ' + end)
  return source.slice(start, stop)
}

// M: the exact persistent four-character station identifier belongs to the code,
// not to its potentially repeated 001/002 ordinal within each lot.
const medOverview = between(medicalApi, "app.get('/api/v1/sponsor/kawmed/overview'", "app.patch('/api/v1/sponsor/kawmed/programs/:id'")
assert.match(medOverview, /mac\.station_number,mdi\.display_code,mac\.claimed_at/)
assert.match(medOverview, /LEFT JOIN medical_display_identifiers mdi ON mdi\.medical_code_id=mac\.id/)
assert.match(medOverview, /WHERE p\.sponsor_id=\?/)
assert.match(medicalAdmin, /row\.display_code\|\|'—'/)
assert.match(medicalMaster, /display_code\?:string\|null/)
const medLabel = medicalMaster.match(/function station\(code:Code\)\{[^\n]+\}/)?.[0] || ''
assert.match(medLabel, /code\.display_code/)
assert.doesNotMatch(medLabel, /station_number/)
assert.match(medicalMaster, /station\(c\)/)

// P: Master beneficiary inventory and its commercial assignment table keep the
// permanent identifier allocated in Super Admin and read through the same artifact_id.
assert.match(sponsoredGeneration, /artifact_display_identifiers\(artifact_id,display_code,product_line,sequence_number\)/)
assert.match(sponsoredGeneration, /item\.displayCode,'P',item\.sequenceNumber/)
assert.match(sponsoredApi, /SELECT a\.public_code,di\.display_code/)
assert.match(sponsoredApi, /LEFT JOIN artifact_display_identifiers di ON di\.artifact_id=a\.id/)
assert.match(sponsoredMaster, /item\.display_code/)
assert.match(sponsoredMaster, /display_code:String\(a\.display_code\|\|''\)/)

// L: provisioning creates the immutable label, and the public scanner resolves
// the same stored label. Team invite codes are not physical station IDs.
const linkProvision = between(linkApi, "app.post('/api/v1/admin/artifacts'", '// Public resolver consumed by Pages Functions')
assert.match(linkProvision, /artifact_display_identifiers\(artifact_id,display_code,product_line,sequence_number\)/)
assert.match(linkProvision, /displayCode,'L',physicalSeq/)
assert.match(linkProvision, /display_code: displayCode/)
assert.match(scan, /di\.display_code/)
assert.match(scan, /LEFT JOIN artifact_display_identifiers di ON di\.artifact_id\s*=\s*a\.id/)

console.log('Physical-station source parity M/P/L and all sponsor Master panels: OK (static contract)')
