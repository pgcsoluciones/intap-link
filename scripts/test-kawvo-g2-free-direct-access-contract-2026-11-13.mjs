import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// G2.1 static contracts are safeguards, not a substitute for authenticated mobile QA.
const app=readFileSync('app/src/App.tsx','utf8')
const shell=readFileSync('app/src/components/admin/free/KawvoFreeShellPreview.tsx','utf8')
const buttons=readFileSync('app/src/components/admin/free/FreePanelUi.tsx','utf8')
const agenda=readFileSync('app/src/components/admin/free/FreeAppointments.tsx','utf8')
const legacy=readFileSync('app/src/components/admin/free/FreeDashboard.tsx','utf8')

assert.match(app,/path="\/admin\/free\/shell-preview" element=\{<AdminGuard planScope="free"><KawvoFreeShellPreview\/><\/AdminGuard>\}/,'G2 keeps the Free route authorization guard')
assert.match(app,/path="\/admin\/free" element=\{<AdminGuard planScope="free"><FreeDashboard\/><\/AdminGuard>\}/,'Legacy Free panel remains available')
assert.match(shell,/import\.meta\.env\.MODE==='preview'/,'Shell remains Preview build only')
assert.match(shell,/window\.location\.hostname==='app\.preview\.intaprd\.com'/,'Shell remains private Preview host only')
assert.match(shell,/get\('kawvo_shell'\)==='1'/,'Opt-in remains mandatory')

// Home CTAs must stop using a round-trip through the original panel when safe.
assert.match(shell,/const nextAction=\(\)=>\{\s*if\(published\)\{setTab\('profile'\);return\}/,'Published profile opens the new Profile tab')
assert.match(shell,/if\(readyToPublish\)\{navigate\('\/admin\/free'\);return\}/,'Publish workflow still uses the canonical dashboard')
assert.match(shell,/navigate\('\/admin\/free\/onboarding\/identity\?from=panel',\{state:shellReturnState\}\)/,'Draft continues directly in existing identity editor')
assert.match(shell,/\/api\/v1\/me\/free\/profile-preview\/\$\{encodeURIComponent\(accountSlug\)\}\?full=1/,'Preview opens the same private endpoint as FreeDashboard')
assert.match(shell,/href=\{previewHref\} target="_blank" rel="noopener noreferrer"/,'Preview does not require the old panel and opens safely in a new tab')
assert.match(shell,/previewHref\?<a[\s\S]*?:<button type="button" disabled/,'Preview stays unavailable without a slug')
assert.match(legacy,/\/api\/v1\/me\/free\/profile-preview\/\$\{encodeURIComponent\(me\.slug\)\}\?full=1/,'Private preview URL mirrors existing Free flow')

// Sharing has the same published-only gate as FreeDashboard.
assert.match(shell,/if\(!published\|\|!publicUrl\)return/,'Sharing checks publication and URL before acting')
assert.match(shell,/disabled=\{!published\|\|!publicUrl\} onClick=\{\(\)=>void sharePublicUrl\(\)\}/,'Sharing is visibly disabled for drafts')
assert.match(shell,/navigator\.share\(\{title:accountName,url:publicUrl\}\)/,'Use native share when supported')
assert.match(shell,/navigator\.clipboard\.writeText\(publicUrl\)/,'Fallback copies the public URL')
assert.match(legacy,/disabled=\{!me\?\.is_published\}/,'Legacy share visibility remains unchanged')

// Return state is passed only by navigation; it is not a new source of permissions.
assert.match(shell,/const go=\(id:string\)=>\{const path=routeById\.get\(id\);if\(path\)navigate\(path,\{state:shellReturnState\}\)\}/,'Existing modules receive an explicit shell return marker')
assert.match(shell,/if\(agendaRoute\)navigate\(agendaRoute,\{state:shellReturnState\}\)/,'Agenda receives the same marker')
assert.match(buttons,/location\.state as \{kawvoShellReturn\?:boolean\}\|null/,'Shared back button checks only current route state')
assert.match(buttons,/import\.meta\.env\.MODE === 'preview'/,'Return shortcut is restricted to Preview builds')
assert.match(buttons,/window\.location\.hostname === 'app\.preview\.intaprd\.com'/,'Return shortcut is restricted to Preview host')
assert.match(buttons,/if \(returnToShell\) \{[\s\S]*?navigate\('\/admin\/free\/shell-preview\?kawvo_shell=1'\)/,'Back button returns to shell only on explicit state')
assert.match(buttons,/onClick\(event\)/,'Original back behavior remains for all other sessions')
assert.match(agenda,/location\.state as \{kawvoShellReturn\?:boolean\}\|null/,'Agenda respects original navigation state')
assert.match(agenda,/returnToShell\?'\/admin\/free\/shell-preview\?kawvo_shell=1':'\/admin\/free\/account'/,'Agenda retains original return path as fallback')
assert.match(agenda,/apiBase="\/me\/free\/appointments"/,'Agenda continues using its existing endpoint')

// G2.1 is strictly read-only in the shell, no publishing, no account changes or hidden privilege bypass.
assert.doesNotMatch(shell,/apiPost\(|apiPut\(|apiPatch\(|apiDelete\(|apiUpload\(/,'Shell cannot write profile changes')
assert.doesNotMatch(shell,/window\.location\.assign|window\.location\.replace/,'Shell does not redirect across origins')
assert.match(legacy,/const togglePublished = async \(\) =>/,'Publication remains implemented only by the original dashboard')
console.log('PASS: G2.1 direct preview/share, guarded publication, Preview-only module return, no new writes')
