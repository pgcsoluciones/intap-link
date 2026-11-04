import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const ui=readFileSync('web/src/components/sponsored/SponsoredAwareArtifactResolver.tsx','utf8')
const api=readFileSync('api/src/sponsored-scan.ts','utf8')
const first="payload?.state==='sponsored_pending_activation'?<>"
const next="payload?.state==='sponsored_sponsor_inspection'?<>"
const a=ui.indexOf(first),b=ui.indexOf(next,a)
assert.ok(a>0 && b>a,'Sponsored pending screen scope remains available')
const view=ui.slice(a,b)
assert.match(view,/Activa tu presentación digital/,'Clear activation title')
assert.match(view,/Personaliza tu perfil profesional en pocos pasos/,'One helpful sentence')
assert.match(view,/\{productLabel\}\{physicalId\?' · '\+physicalId:''\}/,'Type and physical ID from scan')
assert.match(view,/\{activationCode\}/,'Public product ID retained for traceability')
assert.match(view,/onClick=\{\(\)=>go\(payload\.next_url\)\}/,'Existing claim URL stays intact')
assert.match(view,/>Activar ahora<\/button>/,'Product-neutral primary CTA')
assert.match(view,/>Activar después<\/button>/,'Deferral action retained')
assert.match(view,/window\.location\.assign\('\/'\)/,'Deferral does not switch Preview to Production')
assert.doesNotMatch(view,/Impulsamos tu crecimiento digital|Activar ahora mi llavero|BIENVENIDO|Producto anterior sin numeración física corta/i,'Avoid stale or repeated marketing and incorrect product label')
assert.doesNotMatch(view,/payload\.message/,'Avoid duplicate server-provided marketing line')
assert.doesNotMatch(view,/✓/,'Do not imply the product is already activated')
assert.match(ui, /payload\?\.state==='sponsored_master_login'/,'Master login flow preserved')
assert.match(ui, /payload\?\.state==='sponsored_draft_owner'/,'Draft owner flow preserved')
assert.match(ui, /if\(status==='normal'\)return <ArtifactLinkResolver\/>/,'Normal products unchanged')
assert.match(api, /state:'sponsored_pending_activation'/,'Same backend state')
assert.match(api, /\/admin\/sponsored\/activate\?public_code=/,'Same activation destination')
console.log('PASS: concise sponsored activation, contextual product labels, preserved claim and same-origin deferral')
