// Regression: Free owner context must use the same host-only cookie origin
// as the production Multicuenta selector. No browser credentials are read.
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const free=read('web/src/components/free-profile/IntapLinkGratisProfile.tsx')
const owner=read('web/src/components/appointments/AppointmentOwnerBar.tsx')
const appEnv=read('app/.env.production')
const api=read('app/src/lib/api.ts')
const selector=read('app/src/components/admin/IntapcardAccountSelector.tsx')
const active=read('api/src/intap-active-account.ts')
const backend=read('api/src/free-appointments.ts')
assert.match(appEnv,/^VITE_API_URL=https:\/\/api\.intaprd\.com$/m)
assert.match(api,/const API_BASE =/)
assert.match(selector,/apiPost\('\/me\/intapcard\/active-account'/)
const cookieLine=active.split('\n').find(l=>l.includes("c.header('Set-Cookie',KEY+'='+"))
assert.ok(cookieLine)
assert.doesNotMatch(cookieLine,/Domain=/i)
assert.match(cookieLine,/HttpOnly; Secure; SameSite=Lax/)
const funcs=free.slice(free.indexOf('function appOrigin()'),free.indexOf('function loginUrl()'))
for(const [host,expected,nav] of [
 ['intaprd.com','https://api.intaprd.com','https://app.intaprd.com'],
 ['www.intaprd.com','https://api.intaprd.com','https://app.intaprd.com'],
 ['preview.intaprd.com','https://app.preview.intaprd.com','https://app.preview.intaprd.com'],
 ['fixture.intap-link.pages.dev','https://app.preview.intaprd.com','https://app.preview.intaprd.com']
]){
 const ctx={window:{location:{hostname:host}}}
 assert.equal(vm.runInNewContext(funcs+'\nfreeOwnerApiOrigin()',ctx),expected)
 assert.equal(vm.runInNewContext(funcs+'\nappOrigin()',ctx),nav)
}
assert.match(free,/showOwnerBar && !editMode && <AppointmentOwnerBar/)
assert.ok(free.includes("ownerApiBase={freeOwnerApiOrigin()+'/api/v1/me/free/appointments'} manageOrigin={appOrigin()}"))
assert.match(owner,/credentials:'include'/)
assert.match(owner,/if\(!context\)return null/)
assert.match(owner,/json\.data\?\.is_owner/)
assert.match(backend,/selected\.kind!=='free'\|\|selected\.id!==subjectId/)
assert.match(backend,/lower\(slug\)=\? AND user_id=\?/)
console.log('PASS_FREE_OWNER_BAR_PRODUCTION_ORIGIN_CONTRACT')
