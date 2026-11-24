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
const frontdoor = read('api/src/preview-frontdoor-entry.ts')
const privatePreview = read('api/src/free-profile-preview.ts')
const clickFallback = read('app/src/free-preview-link-fallback.ts')


// Share the SAME public profile URL via WhatsApp. Never replace with an
// internal editor URL, tracking redirect or bank-account URL.
assert.match(shell, /encodeURIComponent\('Conoce mi presentación digital: '\+publicUrl\)/)
assert.match(legacy, /encodeURIComponent\('Conoce mi presentación digital: ' \+ url\)/)
assert.match(shell, /https:\/\/wa\.me\/\?text=/)
assert.match(legacy, /https:\/\/wa\.me\/\?text=/)
assert.match(shell, /const publicUrl=publicRoute\?webUrl\+publicRoute/)
// Free preview must keep the established authenticated Production document route
// and browser return fragment; the public URL remains reserved for sharing.
assert.match(shell, /const previewHref=accountSlug\?\(isFreeDemoDelegationActive\(\)\&\&publicUrl\?publicUrl:/)
assert.match(shell, /full=1#kawvo_shell=1&tab=profile&slug=/)
// Free navigation must be consistent for published vs. unpublished profiles.
assert.match(legacy, /href=\{delegatedDemo&&publicUrl\?publicUrl:`\/api\/v1\/me\/free\/profile-preview\//)
assert.match(clickFallback, /window\.location\.hostname === 'app\.preview\.intaprd\.com'\) return/)
assert.doesNotMatch(clickFallback, /get\('kawvo_shell'\) === '1'/)
// Bounded private preview renewal; auth and token verification stay mandatory.
assert.match(frontdoor, /if\(url\.searchParams\.get\('preview_retry'\)==='1'\)/)
assert.match(frontdoor, /status:403/)
assert.match(frontdoor, /return renewPreviewRedirect\(slug,embedded\)/)
assert.match(privatePreview, /target\.searchParams\.set\('preview_retry', '1'\)/)
assert.match(privatePreview, /previewSessionCookie\(rawToken, PREVIEW_SESSION_TTL_SECONDS, environment\)/)
// Forensic regression: Production's .intaprd.com cookie also reaches
// preview.intaprd.com; the two environments must never parse the same name.
assert.match(privatePreview, /const PRODUCTION_PREVIEW_SESSION_COOKIE = 'kawvo_preview_session'/)
assert.match(privatePreview, /const PREVIEW_SESSION_COOKIE = 'kawvo_free_preview_session_v2'/)
assert.match(privatePreview, /const name = isProduction \? PRODUCTION_PREVIEW_SESSION_COOKIE : PREVIEW_SESSION_COOKIE/)
assert.match(frontdoor, /const PREVIEW_SESSION_COOKIE = 'kawvo_free_preview_session_v2'/)
assert.doesNotMatch(frontdoor, /const PREVIEW_SESSION_COOKIE = 'kawvo_preview_session'/)
assert.ok(privatePreview.includes("isProduction ? '.intaprd.com' : '.preview.intaprd.com'"))
// Simulate an older Production cookie arriving before the Preview cookie.
// The server must read only the namespaced Preview session, without trusting
// browser cookie ordering, nor using a Production token as Preview auth.
const mixedCookies='kawvo_preview_session=old-production-token; kawvo_free_preview_session_v2=valid-preview-token'
const selected=mixedCookies.split(';').map(x=>x.trim()).find(x=>x.startsWith('kawvo_free_preview_session_v2='))
assert.equal(selected,'kawvo_free_preview_session_v2=valid-preview-token')

assert.match(frontdoor, /validatePreviewSession\(request,env,slug\)/)

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
