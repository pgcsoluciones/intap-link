import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const s=readFileSync('app/src/components/admin/sponsored/SponsoredDashboard.tsx','utf8')
const scope=readFileSync('api/src/sponsored-profile-scope.ts','utf8')
assert.match(s,/apiPost\(route,\{\}\)/)
assert.match(s,/apiGet\(`\/me\/sponsored-profile\$\{profileScopeQuery\}`\)/)
assert.match(s,/String\(verified\.data\.id\)!==String\(data\?\.id\)/)
assert.match(s,/verified\.data\.status!==expected/)
assert.match(s,/setData\(verified\.data\)/)
assert.match(scope,/active\.kind!=='sponsored'/)
console.log('Sponsored publish exact-profile readback contract: OK')
