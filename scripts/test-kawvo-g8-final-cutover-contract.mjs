// KAW-G8 CUTOVER — final release source contract.
// Preserves frozen #182 code and pins only the eight, independently tested activation files.
// Local Git + file reads only; no Cloudflare, deploy, merge or migrations.
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
const SOURCE='fae4ced6966a5bfda5bb8f7b298dc8a22bfc5d99'
const BASE='0b56b73f5ebdf3b70923832b658cad683336c002'
const ACTIVATION='7a7aa94da2b73f7d4125838f5961cde07eb957e1'
const MAIN='6e6bfbb1bd60c91a94e92d36f6cfdd9f91e3d9e2'
const CORRECTIVE='8bc33c1b62d2c11147ffc192119fac98009cd5b5'
const HANDLER='api/src/kawmed-demo-invitations.ts'
const changedFiles=[
 'api/src/sponsor-inventory-page.ts',
 'app/src/components/admin/kawvo-release-host.ts',
 'app/src/components/admin/medical/KawMedShellReturn.ts',
 'app/src/components/admin/medical/kawmed-guest-shell-navigation.ts',
 'app/src/components/admin/medical/kawmed-master-shell-navigation.ts',
 'app/src/components/admin/medical/kawmed-shell-navigation.ts',
 'app/src/components/admin/sponsored/sponsor-shell-navigation.ts',
 'app/src/components/admin/sponsored/sponsored-shell-gate.ts'
].sort()
const runtime=['api','app','web','functions','shared','.github','package.json','package-lock.json']
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim()
const bytes=(rev,path)=>execFileSync('git',['show',rev+':'+path])
const hash=b=>createHash('sha256').update(b).digest('hex')
git('merge-base','--is-ancestor',MAIN,BASE)
git('merge-base','--is-ancestor',SOURCE,BASE)
git('merge-base','--is-ancestor',CORRECTIVE,BASE)
git('merge-base','--is-ancestor',BASE,ACTIVATION)
git('merge-base','--is-ancestor',ACTIVATION,'HEAD')
// Original unified runtime is frozen in its original commit, not rewritten or tested under a false Preview-only rule.
const historicalDelta=git('diff','--name-only',SOURCE,BASE,'--',...runtime).split('\n').filter(Boolean)
assert.deepEqual(historicalDelta,[HANDLER],'Original G8 runtime change must remain solely the approved #183 corrective handler')
assert.deepEqual(bytes(BASE,HANDLER),bytes(CORRECTIVE,HANDLER),'Original LIVE race fix byte-locked')
for(const path of ['docs/architecture/KAWVO_G8_MASTER_RELEASE_UNIFICATION_2026-11-23.md',
 'docs/releases/KAWVO_G8_RELEASE_MANIFEST.json','scripts/test-kawvo-g8-release-contract.mjs','scripts/lib/kawvo-g8-freeze.mjs']){
 assert.deepEqual(readFileSync(path),bytes(BASE,path),'Historical release contract remains byte-for-byte: '+path)
}
const actual=git('diff','--name-only',BASE,'HEAD','--',...runtime).split('\n').filter(Boolean).sort()
assert.deepEqual(actual,changedFiles,'No unexpected runtime changes, G6/G7.2, package/dependency/infra or migration changes')
for(const path of changedFiles)assert.equal(hash(readFileSync(path)),hash(bytes(ACTIVATION,path)),'Activation runtime bytes must match tested SHA: '+path)
for(const path of ['app/src/components/admin/AdminDashboard.tsx','app/src/components/admin/AdminProducts.tsx',
 'app/src/components/admin/AdminFAQs.tsx','app/src/components/admin/AdminVideos.tsx',
 'app/src/components/admin/AdminGuard.tsx','app/src/components/admin/free/TeamPermissionGuard.tsx']){
 assert.deepEqual(readFileSync(path),bytes(MAIN,path),'Existing paid and Team behavior unchanged: '+path)
}
const manifest=JSON.parse(readFileSync('docs/releases/KAWVO_G8_RELEASE_MANIFEST.json','utf8'))
assert.equal(manifest.decision,'NO-GO for Production','Release status only changes with explicit production approval')
assert.equal(manifest.productionApproval,false,'No automated production authorization')
for(const path of ['api/migrations/0153_sponsor_sales_representatives.sql','api/migrations/0154_artifact_display_identifiers.sql'])
 assert.equal(git('ls-files','--',path),'','No migration imported into active migration directory')
console.log('PASS G8 final candidate: original #182 freeze and #183 fix preserved, 8 activation files pinned to tested SHA, paid/Team intact, G6/G7.2 excluded')
