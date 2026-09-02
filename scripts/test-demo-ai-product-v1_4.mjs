import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const api = await readFile('api/src/routes/demo-ai.ts','utf8')
const wizard = await readFile('web/src/components/demo/KawvoLinkDemoAi.tsx','utf8')
const demo = await readFile('web/src/components/demo/KawvoLinkDemo.tsx','utf8')
const shared = await readFile('web/src/components/demo/KawvoLinkDemoShared.tsx','utf8')
const bank = await readFile('web/src/components/demo/DemoBankAccounts.tsx','utf8')

// V1.4 retained guarantees only. Later V1.5/V1.6 tests own copy and CTA refinements.
assert.match(api,/no copies ni parafrasees mecánicamente/i)
assert.match(api,/Creatividad editorial sí/i)
assert.match(wizard,/digits\.length === 10.*`1\$\{digits\}`/s)
assert.match(wizard,/includeBankDemo/)
assert.match(wizard,/bankDemo: input\.includeBankDemo/)
assert.match(demo,/window\.location\.replace\(`\/demo\/ia/)
assert.match(demo,/Personalizar con mis datos/)
assert.match(demo,/kawvo-demo-finish-floating/)
assert.match(demo,/DemoBankAccounts/)
assert.match(demo,/bankDemo: showBankDemo/)
assert.match(shared,/navigate\(`\/demo\/ia\?from=/)
assert.match(shared,/DemoBankAccounts/)
assert.match(bank,/123456789/)
assert.doesNotMatch(bank,/<input|<textarea/)

console.log('✓ Demo IA V1.4 retained contract: creatividad, +1, IA predeterminada, CTA flotante y banco demo preservados')
