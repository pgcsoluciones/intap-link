import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { build } from 'esbuild'

const require = createRequire(import.meta.url), ts = require('typescript')
const base = '34d57a4bfebc9e59b0347d0497a159ca3f46ce7e', main = '6e6bfbb1bd60c91a94e92d36f6cfdd9f91e3d9e2'
const medicalPath = 'app/src/components/admin/medical/MedicalDashboard.tsx'
const freePath = 'app/src/components/admin/free/KawvoFreeShellPreview.tsx'
const prior = path => execFileSync('git', ['show', base + ':' + path], { encoding: 'utf8' })
const read = path => readFileSync(path, 'utf8')
const allowed = [medicalPath, freePath, 'app/src/components/admin/shared/KawvoProfileIdentity.tsx', 'app/src/components/admin/shared/KawvoReadyToPublish.tsx', 'scripts/test-kawvo-g3-1-1-ui-contract.mjs', 'docs/architecture/KAWVO_G3_1_1_UI_PUBLICATION_2026-11-17.md'].sort()
const delta = execFileSync('git', ['diff', '--name-only', base], { encoding: 'utf8' }).trim().split('\n').filter(Boolean)
delta.push(...execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean))
assert.deepEqual([...new Set(delta)].sort(), allowed, 'Exact six-file successor scope; no runners/infrastructure')
for (const path of ['app/src/components/admin/free/FreeDashboard.tsx', 'app/src/components/admin/free/FreePublicationActions.tsx', 'app/src/components/admin/free/FreeShellSessionExit.tsx', 'app/src/components/admin/free/FreeAccount.tsx', 'app/src/components/admin/medical/kawmed-shell-navigation.ts']) assert.equal(read(path), prior(path), 'Preserve existing rules/operations: ' + path)
assert.equal(prior(freePath), execFileSync('git', ['show', main + ':' + freePath], { encoding: 'utf8' }), 'Free successor starts from the same Free shell as main')
function operations(source) {
  const file = ts.createSourceFile('MedicalDashboard.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const result = { functions: new Map(), effects: [] }
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name && node.name.text !== 'MedicalDashboard') result.functions.set(node.name.text, node.getText(file))
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isArrowFunction(node.initializer)) result.functions.set(node.name.text, node.initializer.getText(file))
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'useEffect') result.effects.push(node.getText(file))
    ts.forEachChild(node, visit)
  }
  visit(file); return result
}
const before = operations(prior(medicalPath)), after = operations(read(medicalPath))
for (const [name, body] of before.functions) assert.equal(after.functions.get(name), body, 'Existing medical operation changed: ' + name)
assert.deepEqual(after.effects, before.effects, 'Existing medical effects unchanged')
console.log('PASS G3.1.1 static: successor scope, main Free comparison, existing medical operations/effects, Free mutations/logout/legacy/account and navigation guards unchanged')
if (!process.argv.includes('--browser')) process.exit(0)

const {runG311Browser}=await import('./lib/kawvo-g3-1-1-browser.mjs')
await runG311Browser()
