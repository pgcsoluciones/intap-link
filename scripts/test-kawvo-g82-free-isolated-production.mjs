// Isolated Free-only production candidate; no API, Preview frontdoor, or D1 changes.
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const app=read('app/src/components/admin/free/KawvoFreeShellPreview.tsx')
const owner=read('web/src/components/appointments/AppointmentOwnerBar.tsx')
const free=read('web/src/components/free-profile/IntapLinkGratisProfile.tsx')
const previewCookie=read('api/src/free-profile-preview.ts')
const previewFrontdoor=read('api/src/preview-frontdoor-entry.ts')

assert.match(app, /const previewHref=accountSlug\?\(isFreeDemoDelegationActive\(\)\&\&publicUrl\?publicUrl:/)
assert.match(app, /full=1#kawvo_shell=1&tab=profile&slug=/)
assert.match(app, /window\.open\(whatsappUrl,'_blank','noopener,noreferrer'\)/)
assert.match(app, /mobileUtilitiesRow/)
assert.match(app, /\[&_button\]:!text-sm/)
assert.doesNotMatch(app, /<FreeNotificationBell returnState=\{shellReturnState\}/)
assert.doesNotMatch(app, /onClick=\{\(\)=>setTab\("profile"\)\} className="min-h-11 rounded-xl border/)
assert.doesNotMatch(app, /onClick=\{\(\)=>setTab\("agenda"\)\} className="min-h-11 rounded-xl border/)

assert.match(free, /showOwnerBar && !editMode && <AppointmentOwnerBar/)
assert.doesNotMatch(free, /showOwnerBar && profile\.experience && <AppointmentOwnerBar/)
assert.match(free, /shareProfileQrWhatsApp\(\)/)
assert.match(owner, /const freeMulti=ownerApiBase\.endsWith\('\/api\/v1\/me\/free\/appointments'\)/)
assert.match(owner, /context\.allow_direct_actions===false/)
assert.match(owner, /context\.settings_url==='\/admin\/free'/)
assert.match(owner, /resume:'profile',slug:username/)
assert.match(owner, /if\(!context\)return null/)

// Preview cookie isolation must stay on its own PR and NEVER be copied
// accidentally into the production-only release.
assert.match(previewCookie, /const PREVIEW_SESSION_COOKIE = 'kawvo_preview_session'/)
assert.doesNotMatch(previewCookie,/kawvo_free_preview_session_v2/)
assert.match(previewFrontdoor, /const PREVIEW_SESSION_COOKIE = 'kawvo_preview_session'/)
console.log('PASS_G82_FREE_ISOLATED_PRODUCTION_SOURCE_CONTRACT')
