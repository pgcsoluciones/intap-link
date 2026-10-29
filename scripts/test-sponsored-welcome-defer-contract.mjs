import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const s=readFileSync('web/src/components/sponsored/SponsoredAwareArtifactResolver.tsx','utf8')
const a=readFileSync('app/src/components/admin/sponsored/SponsoredActivation.tsx','utf8')
assert.match(s,/payload\?\.state==='sponsored_pending_activation'/)
assert.match(s,/>Activar luego<\/button>/)
assert.match(s,/Tu producto seguirá disponible/)
assert.match(a,/function activateLater\(\)/)
assert.match(a,/>Activar luego<\/button>/)
console.log('Sponsored activation can be deferred at welcome and consent: OK')
