import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const src=readFileSync('app/src/components/admin/sponsored/SponsoredActivation.tsx','utf8')
assert.match(src,/function activateLater\(\)/)
assert.match(src,/sessionStorage\.removeItem\(KEY\)/)
assert.match(src,/localStorage\.removeItem\(KEY\)/)
assert.match(src,/window\.location\.replace\('https:\/\/intaprd\.com\/'\)/)
assert.match(src,/>Activar luego<\/button>/)
assert.doesNotMatch(src,/if\(!me\?\.ok\)\{window\.location\.assign/)
assert.match(src,/setRequiresLogin\(!me\?\.ok\)/)
assert.match(src,/if\(requiresLogin\)\{window\.location\.assign/)
assert.match(src,/setResumePanelUrl\(String\(status\.next_url\)\)/)
assert.doesNotMatch(src,/if\(status\.state==='sponsored_draft_owner'.*enterSponsoredPanel/)
console.log('Sponsored activation: no forced login or draft redirect; later leaves without claiming: OK')
