import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = path => readFileSync(path, 'utf8')
const shell = read('app/src/components/admin/free/KawvoFreeShellPreview.tsx')
const legacy = read('app/src/components/admin/free/FreeDashboard.tsx')
const master = read('app/src/components/admin/sponsored/SponsorDashboard.tsx')
const origin = read('app/src/components/admin/free/KawvoShellReturn.ts')
const social = read('functions/_middleware.ts')

// Share the SAME public profile URL via WhatsApp. Never replace with an
// internal editor URL, tracking redirect or bank-account URL.
assert.match(shell, /encodeURIComponent\('Conoce mi presentación digital: '\+publicUrl\)/)
assert.match(legacy, /encodeURIComponent\('Conoce mi presentación digital: ' \+ url\)/)
assert.match(shell, /https:\/\/wa\.me\/\?text=/)
assert.match(legacy, /https:\/\/wa\.me\/\?text=/)
assert.match(shell, /const publicUrl=publicRoute\?webUrl\+publicRoute/)
assert.match(shell, /<FreeNotificationBell returnState=\{shellReturnState\}/)
assert.match(shell, /setTab\("profile"\)/)
assert.match(shell, /setTab\("agenda"\)/)
assert.match(shell, /grid-cols-2 gap-2/)
assert.match(shell, /<FreeShellSessionExit\/>/)
assert.match(master, /presentation\.agenda&&<button/)
assert.match(master, /presentation\.id&&<button/)
assert.doesNotMatch(master, /\/admin\/free\/notifications/)
assert.match(origin, /mode === 'production' && host === 'app\.intaprd\.com'/)
assert.match(origin, /\/admin\/free\/shell-preview\?kawvo_shell=1/)

// Preserve existing Web Functions social-card construction, including
// the special bank sharing mode. This smoke is structural; network-level
// Open Graph rendering/WhatsApp preview still needs live QA.
for (const marker of ['og:title', 'og:image', 'og:description', "url.searchParams.get('share') === 'bancos'"]) {
  assert.ok(social.includes(marker), 'Missing existing social card marker: ' + marker)
}
console.log('PASS_G8_1_STATIC_NAV_WHATSAPP_SOCIAL_CONTRACT')
