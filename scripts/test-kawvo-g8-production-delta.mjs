// G8 cutover delta guard. Source-only, never contacts Cloudflare or changes D1.
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
const BASE='0b56b73f5ebdf3b70923832b658cad683336c002'
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
const permitted=[
 'api/src/sponsor-inventory-page.ts',
 'app/src/components/admin/kawvo-release-host.ts',
 'app/src/components/admin/medical/KawMedShellReturn.ts',
 'app/src/components/admin/medical/kawmed-guest-shell-navigation.ts',
 'app/src/components/admin/medical/kawmed-master-shell-navigation.ts',
 'app/src/components/admin/medical/kawmed-shell-navigation.ts',
 'app/src/components/admin/sponsored/sponsor-shell-navigation.ts',
 'app/src/components/admin/sponsored/sponsored-shell-gate.ts'
].sort()
git('merge-base','--is-ancestor',BASE,'HEAD')
assert.equal(git('status','--porcelain'),'','No dirty candidate checkout')
const scope=['api','app','web','functions','shared','.github','package.json','package-lock.json','api/wrangler.toml','app/.env.production']
const changed=git('diff','--name-only',BASE,'HEAD','--',...scope).split('\n').filter(Boolean).sort()
assert.deepEqual(changed,permitted,'Only explicit release UI gates and G7.1 API environment gate may change')
const helper=readFileSync('app/src/components/admin/kawvo-release-host.ts','utf8')
assert.match(helper,/mode === 'preview' && host === 'app\.preview\.intaprd\.com'/)
assert.match(helper,/mode === 'production' && host === 'app\.intaprd\.com'/)
const api=readFileSync('api/src/sponsor-inventory-page.ts','utf8')
assert.match(api,/\['preview','production'\]\.includes\(String\(c\.env\.ENVIRONMENT\|\|''\)\.toLowerCase\(\)\)\?next\(\):c\.json/)
assert.doesNotMatch(api,/\.\s*(?:run|batch|exec)\s*\(/,'Inventory remains SELECT-only')
for(const [path,needle] of [
 ['app/src/components/admin/medical/kawmed-shell-navigation.ts','isKawvoReleaseAppHost'],
 ['app/src/components/admin/medical/kawmed-guest-shell-navigation.ts','isKawvoReleaseAppHost'],
 ['app/src/components/admin/medical/kawmed-master-shell-navigation.ts','isKawvoReleaseAppHost'],
 ['app/src/components/admin/medical/KawMedShellReturn.ts','isKawvoReleaseAppHost'],
 ['app/src/components/admin/sponsored/sponsor-shell-navigation.ts','isKawvoReleaseAppHost'],
 ['app/src/components/admin/sponsored/sponsored-shell-gate.ts','isKawvoReleaseAppHost']
])assert.ok(readFileSync(path,'utf8').includes(needle),'Missing exact release host gate: '+path)
console.log('PASS G8 activation delta: eight bounded runtime files, no G6/G7.2, workflows, data migrations or infrastructure')
