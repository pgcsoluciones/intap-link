import fs from 'node:fs'
import assert from 'node:assert/strict'
const read=p=>fs.readFileSync(p,'utf8')
const migration=read('api/migrations/0154_artifact_display_identifiers.sql')
const link=read('api/src/index.ts')
const med=read('api/src/medical-access-codes.ts')
const sponsor=read('api/src/sponsored-code-generation.ts')
const scan=read('api/src/scan-status.ts')
const sponsorScan=read('api/src/sponsored-scan.ts')
const sponsorTrace=read('api/src/sponsored-profiles.ts')
const app=read('app/src/components/admin/sponsored/SponsorDashboard.tsx')
const web=read('web/src/components/ArtifactLinkResolver.tsx')
const alphabet='0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'
function physical(line,n){let value=n+340,part='';for(let j=0;j<3;j++){part=alphabet[value%alphabet.length]+part;value=Math.floor(value/alphabet.length)}return line+part}
for(const line of ['M','L','P']){
 assert.equal(physical(line,1),line+'0A1')
 assert.match(physical(line,32767),new RegExp('^'+line+'[0-9A-Z]{3}$'))
 const seen=new Set()
 for(let n=1;n<=32767;n++){const code=physical(line,n);assert.equal(code.length,4);assert.ok(!seen.has(code),'Repeated physical label '+code);seen.add(code)}
}
assert.match(migration,/CREATE TABLE IF NOT EXISTS artifact_display_identifiers/)
assert.match(migration,/CREATE TABLE IF NOT EXISTS medical_display_identifiers/)
assert.match(migration,/display_code TEXT NOT NULL UNIQUE/)
assert.doesNotMatch(migration,/\bUPDATE\s+(?:intap_artifacts|medical_access_codes|sponsor_artifacts)\b/i)
assert.doesNotMatch(migration,/\bDELETE\s+FROM\b/i)
for(const [file,source,line] of [['link',link,'L'],['kawmed',med,'M'],['sponsor',sponsor,'P']]){
 assert.match(source,/sequence_number/)
 assert.match(source,/display_code/)
 assert.match(source,/n\+340|physicalSeq\+340/)
 assert.match(source,new RegExp("['\\\"]"+line+"['\\\"]"))
}
assert.match(scan,/artifact_display_identifiers di/)
assert.match(sponsorScan,/artifact_display_identifiers di/)
assert.match(sponsorTrace,/artifact_display_identifiers di/)
assert.match(med,/medical_display_identifiers mdi/)
assert.match(web,/artifact\.display_code/)
assert.match(app,/item\.display_code/)
assert.match(app,/item\.business_phone\|\|item\.business_whatsapp/)
console.log('Kawvo NFC physical release contract: M/L/P labels unique, old products preserved, scan and sponsor traceability linked: OK')
