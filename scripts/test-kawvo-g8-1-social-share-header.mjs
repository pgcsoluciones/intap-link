import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = path => readFileSync(path, 'utf8')
const shell = read('app/src/components/admin/free/KawvoFreeShellPreview.tsx')
const legacy = read('app/src/components/admin/free/FreeDashboard.tsx')
const master = read('app/src/components/admin/sponsored/SponsorDashboard.tsx')
const origin = read('app/src/components/admin/free/KawvoShellReturn.ts')
const social = read('functions/_middleware.ts')
const publicProfile = read('web/src/components/free-profile/IntapLinkGratisProfile.tsx')
const ownerBar = read('web/src/components/appointments/AppointmentOwnerBar.tsx')
const ownerApi = read('api/src/free-appointments.ts')

// Share the SAME public profile URL via WhatsApp. Never replace with an
// internal editor URL, tracking redirect or bank-account URL.
assert.match(shell, /encodeURIComponent\('Conoce mi presentación digital: '\+publicUrl\)/)
assert.match(legacy, /encodeURIComponent\('Conoce mi presentación digital: ' \+ url\)/)
assert.match(shell, /https:\/\/wa\.me\/\?text=/)
assert.match(legacy, /https:\/\/wa\.me\/\?text=/)
assert.match(shell, /const publicUrl=publicRoute\?webUrl\+publicRoute/)
// Publicly published Free profiles never enter the private preview redirect cycle.
assert.match(shell, /published&&publicUrl\?publicUrl/)
assert.match(shell, /\/api\/v1\/me\/free\/profile-preview\/\$\{encodeURIComponent\(accountSlug\)\}/)
assert.doesNotMatch(shell, /<FreeNotificationBell returnState=\{shellReturnState\}/)
assert.doesNotMatch(shell, /onClick=\{\(\)=>setTab\("profile"\)\} className="min-h-11 rounded-xl border/)
assert.doesNotMatch(shell, /onClick=\{\(\)=>setTab\("agenda"\)\} className="min-h-11 rounded-xl border/)
assert.match(shell, /grid-cols-2 gap-2/)
assert.match(shell, /!text-sm/)
assert.match(publicProfile, /showOwnerBar && !editMode && <AppointmentOwnerBar/)
assert.match(publicProfile, /shareProfileQrWhatsApp\(\)/)
assert.match(publicProfile, /https:\/\/wa\.me\/\?text=/)
assert.match(ownerBar, /public-context\?username=/)
assert.match(ownerBar, /context\.allow_direct_actions===false/)
assert.match(ownerBar, /\/admin\/free\/shell-preview\?/)
assert.match(ownerBar, /resume:'profile',slug:username/)
assert.match(ownerBar, /kawvo_shell:'1'/)
assert.match(ownerApi, /selected\.kind!=='free'\|\|selected\.id!==subjectId/)
assert.match(ownerApi, /allow_direct_actions:!multi/)
assert.match(shell, /<FreeShellSessionExit\/>/)
assert.match(master, /presentation\.agenda&&<button/)
assert.match(master, /presentation\.id&&<button/)
assert.doesNotMatch(master, /\/admin\/free\/notifications/)
assert.match(origin, /import\.meta\.env\.MODE === 'production' && host === 'app\.intaprd\.com'/)
assert.match(origin, /\/admin\/free\/shell-preview\?kawvo_shell=1/)

// Preserve existing Web Functions social-card construction, including
// the special bank sharing mode. This smoke is structural; network-level
// Open Graph rendering/WhatsApp preview still needs live QA.
for (const marker of ['og:title', 'og:image', 'og:description', "url.searchParams.get('share') === 'bancos'"]) {
  assert.ok(social.includes(marker), 'Missing existing social card marker: ' + marker)
}
console.log('PASS_G8_1_STATIC_NAV_WHATSAPP_SOCIAL_CONTRACT')
