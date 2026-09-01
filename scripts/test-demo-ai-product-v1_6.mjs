import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const wizard = await readFile('web/src/components/demo/KawvoLinkDemoAi.tsx','utf8')
const demo = await readFile('web/src/components/demo/KawvoLinkDemo.tsx','utf8')
const shared = await readFile('web/src/components/demo/KawvoLinkDemoShared.tsx','utf8')
const sharedCss = await readFile('web/src/components/demo/KawvoLinkDemoShared.css','utf8')

assert.match(wizard,/Mostrar cómo se verían tus datos para recibir transferencias/)
assert.match(wizard,/cuenta bancaria y cédula\/RNC/)
assert.match(demo,/target\.closest\('\.ilx-share button'\)/)
assert.match(demo,/\.kawvo-demo-preview \.ilx-share button \{ pointer-events: none/)
assert.match(shared,/target\.closest\('\.ilx-share button'\)/)
assert.match(sharedCss,/\.kawvo-demo-shared-preview \.ilx-share button\{pointer-events:none/)
console.log('✓ Demo IA V1.6 contract: compartir, QR y copiar enlace solo demostrativos + CTA bancario claro')
