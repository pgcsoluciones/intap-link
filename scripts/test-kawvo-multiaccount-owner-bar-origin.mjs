import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const helper=read('web/src/components/appointments/ownerApiOrigin.ts')
const source=helper.replace('export function ownerApiOrigin(appOrigin: string): string','function ownerApiOrigin(appOrigin)')
for(const [app,api] of [
 ['https://app.intaprd.com','https://api.intaprd.com'],
 ['https://app.preview.intaprd.com','https://app.preview.intaprd.com'],
 ['https://example.pages.dev','https://example.pages.dev']
]){
 assert.equal(vm.runInNewContext(source+'\nownerApiOrigin('+JSON.stringify(app)+')'),api)
}
for(const [file,kind] of [
 ['medical-profile/KawMedProfile.tsx','medical-profile'],
 ['sponsored/SponsoredProfile.tsx','sponsored-profile']
]){
 const s=read('web/src/components/'+file)
 assert.ok(s.includes("import { ownerApiOrigin } from '../appointments/ownerApiOrigin'"))
 assert.ok(s.includes("ownerApiBase={ownerApiOrigin(appOrigin())+'/api/v1/me/"+kind+"/appointments'}"))
 assert.ok(s.includes('manageOrigin={appOrigin()}'))
}
const free=read('web/src/components/free-profile/IntapLinkGratisProfile.tsx')
// The active Preview baseline predates the Production-only Free origin fix.
assert.ok(free.includes("ownerApiBase={appOrigin()+'/api/v1/me/free/appointments'}"))
assert.ok(read('api/src/preview-frontdoor-entry.ts').includes("kawvo_free_preview_session_v2"))
assert.ok(read('api/src/free-profile-preview.ts').includes("kawvo_free_preview_session_v2"))
const bar=read('web/src/components/appointments/AppointmentOwnerBar.tsx')
assert.match(bar,/credentials:'include'/)
assert.match(bar,/json\.data\?\.is_owner/)
assert.match(bar,/if\(!context\)return null/)
assert.match(bar,/context\.allow_direct_actions!==false/)
const access=read('api/src/sponsored-multiprofile-access.ts')
assert.ok(access.includes("if(!active||active.kind!=='medical'||active.id!==id)return null"))
const sponsor=read('api/src/sponsored-appointments.ts')
assert.ok(sponsor.includes('if(active.kind!==requiredKind)'))
assert.ok(sponsor.includes('if(active.id!==requiredId)'))
const medical=read('api/src/medical-appointments.ts')
assert.ok(medical.includes("if(!profile)return c.json({ok:false,error:'Not owner'},403)"))
console.log('PASS_KAWVO_MULTIACCOUNT_OWNER_BAR_ORIGIN_SOURCE_CONTRACT')
