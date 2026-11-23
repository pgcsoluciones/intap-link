// Read-only Git/source checks and local SQLite fixtures. Never deploys or contacts Cloudflare.
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {readFileSync,existsSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {inventoryFixture,TENANT_A,TENANT_B} from './test-sponsor-inventory-g7-contract.mjs'
import {assertG8Runtime,G8_SNAPSHOT,G8_CORRECTION,G8_HANDLER} from './lib/kawvo-g8-freeze.mjs'

const SOURCE='fae4ced6966a5bfda5bb8f7b298dc8a22bfc5d99',MAIN='6e6bfbb1bd60c91a94e92d36f6cfdd9f91e3d9e2',G7='e9b1aa11189fe43e928ba26802e2f5f34fd5baa4',SEARCH='f42bccf2b8248b61603090a97ab56c9258400b58',WORKER_SOURCE='2286c937d9ce13422f22b289f5029343c2f5ae4c'
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim(),blob=(sha,path)=>execFileSync('git',['show',sha+':'+path]),read=p=>readFileSync(p),sha=b=>createHash('sha256').update(b).digest('hex')
const manifest=JSON.parse(read('docs/releases/KAWVO_G8_RELEASE_MANIFEST.json'))
const contract='docs/architecture/KAWVO_G8_MASTER_RELEASE_UNIFICATION_2026-11-23.md'
assert.equal(read(contract).toString(),blob(SOURCE,contract).toString().replaceAll('  \n','\n\n'),'Only four Markdown hard-break spaces become blank lines; normative text unchanged')
const allowed=['scripts/inspect-kawvo-g8-readonly.mjs','scripts/test-kawvo-g8-readonly.mjs','scripts/test-kawmed-live-pending-g8.mjs','docs/releases/KAWVO_G8_BLOCKERS_2026-11-23.md','docs/releases/KAWVO_G8_BLOCKER_MATRIX.json',contract,'AGENTS.md','scripts/test-kawvo-g8-release-contract.mjs','scripts/lib/kawvo-g8-browser.mjs','docs/releases/KAWVO_G8_AUDIT_2026-11-23.md','docs/releases/KAWVO_G8_RELEASE_MANIFEST.json','docs/releases/KAWVO_G8_DIFF_MAIN.tsv','docs/releases/KAWVO_G8_VALIDATION.json','docs/releases/KAWVO_G8_RELEASE_RUNBOOK_2026-11-23.md','docs/releases/KAWVO_G8_SCHEMA_READONLY.sql','docs/releases/kawvo-g8-proposed-migrations/0153_sponsor_sales_representatives.sql','docs/releases/kawvo-g8-proposed-migrations/0154_artifact_display_identifiers.sql']
allowed.push(G8_HANDLER,'scripts/lib/kawvo-g8-freeze.mjs','docs/releases/KAWVO_G8_003_LIVE_ACTIVATION_CONCURRENCY_2026-11-23.md','docs/releases/KAWVO_G8_004_INTEGRATION_2026-11-23.md')
const delta=[...new Set([git('diff','--name-only',SOURCE),git('ls-files','--others','--exclude-standard')].flatMap(x=>x.split('\n')).filter(Boolean))]
assert.ok(delta.every(p=>allowed.includes(p)),JSON.stringify({unexpected:delta.filter(p=>!allowed.includes(p))}))
assert.deepEqual(read('AGENTS.md'),blob('50e74d81c61e3e18c85aec3af8505101f43cde93','AGENTS.md'),'Approved governance copied exactly; no historical branch merge')
for(let i=0;i<manifest.chain.length;i++)git('merge-base','--is-ancestor',manifest.chain[i].sha,manifest.chain[i+1]?.sha||SOURCE)
git('merge-base','--is-ancestor',MAIN,SOURCE)
assertG8Runtime(process.cwd(),SOURCE)
assert.equal(manifest.integration.snapshot,G8_SNAPSHOT)
assert.equal(manifest.integration.correctiveCommit,G8_CORRECTION)
const historicalManifest=JSON.parse(blob(G8_SNAPSHOT,'docs/releases/KAWVO_G8_RELEASE_MANIFEST.json'))
for(const key of ['chain','unchangedFromMain','localArtifacts','localFunctions','excluded'])assert.deepEqual(manifest[key],historicalManifest[key],'Approved phases, unchanged layers and original artifact hashes preserved: '+key)
assert.deepEqual(Object.keys(manifest.runtimeTrees),Object.keys(historicalManifest.runtimeTrees))
assert.deepEqual(manifest.changes.filter(row=>row.path!==G8_HANDLER),historicalManifest.changes,'Original source manifest entries preserved')
assert.equal(manifest.mainObserved,MAIN)
assert.equal(manifest.historicalSnapshots.length,1)
assert.deepEqual(git('diff','--name-only',G8_SNAPSHOT,G8_CORRECTION).split('\n'),[G8_HANDLER,'docs/releases/KAWVO_G8_003_LIVE_ACTIVATION_CONCURRENCY_2026-11-23.md','scripts/test-kawmed-live-pending-g8.mjs'])
for(const path of ['scripts/test-kawmed-live-pending-g8.mjs','docs/releases/KAWVO_G8_003_LIVE_ACTIVATION_CONCURRENCY_2026-11-23.md'])assert.deepEqual(read(path),blob(G8_CORRECTION,path),'Corrective tests and handoff preserved exactly')
for(const snapshot of manifest.historicalSnapshots){
 assert.equal(snapshot.commit,G8_SNAPSHOT)
 assert.deepEqual(snapshot.files.map(row=>row.path),['KAWVO_G8_RELEASE_MANIFEST.json','KAWVO_G8_VALIDATION.json','KAWVO_G8_BLOCKER_MATRIX.json','KAWVO_G8_BLOCKERS_2026-11-23.md','KAWVO_G8_AUDIT_2026-11-23.md','KAWVO_G8_RELEASE_RUNBOOK_2026-11-23.md','KAWVO_G8_DIFF_MAIN.tsv'].map(name=>'docs/releases/'+name))
 for(const row of snapshot.files){const old=blob(snapshot.commit,row.path);assert.equal(sha(old),row.sha256);assert.equal(git('rev-parse',snapshot.commit+':'+row.path),row.gitBlob)}
}
const validation=JSON.parse(read('docs/releases/KAWVO_G8_VALIDATION.json')),historicalValidation=JSON.parse(blob(G8_SNAPSHOT,'docs/releases/KAWVO_G8_VALIDATION.json'))
for(const [key,value] of Object.entries(historicalValidation))assert.deepEqual(validation[key],value,'Historical validation results must remain unchanged: '+key)
assert.equal(validation.integrationValidation.correctiveCommit,G8_CORRECTION)
for(const [path,hash] of Object.entries(manifest.runtimeTrees)){
 const reference=path==='api/src'?G8_CORRECTION:SOURCE
 assert.equal(hash,git('rev-parse',reference+':'+path))
 git('diff','--exit-code',reference,'--',path)
}
for(const path of manifest.unchangedFromMain)git('diff','--exit-code',MAIN,'--',path)
for(const row of manifest.changes){const reference=row.path===G8_HANDLER?G8_CORRECTION:SOURCE;assert.equal(sha(read(row.path)),row.candidateSha256||row.sha256,row.path);assert.equal(git('rev-parse',reference+':'+row.path),row.gitBlob)}
assert.equal(manifest.decision,'NO-GO for Production');assert.equal(manifest.productionApproval,false)
assert.equal(manifest.issue134.releaseCertification.startsWith('PENDING'),true)
console.log('PASS G8 chain/main/source manifest, exact runtime freeze, scoped preparation and canonical governance')

// No individual historical PR merge, no new G6, and no PR #180 endpoints or consumer.
const paid=['AdminDashboard.tsx','AdminProducts.tsx','AdminFAQs.tsx','AdminVideos.tsx','AdminGuard.tsx','free/TeamPermissionGuard.tsx']
for(const name of paid){const p='app/src/components/admin/'+name;assert.deepEqual(read(p),blob(MAIN,p),'Paid/Team legacy unchanged: '+p)}
const routes=read('app/src/App.tsx').toString()
for(const route of ['/admin/faqs','/admin/products','/admin/videos'])assert.ok(routes.includes('path="'+route+'" element={<AdminGuard planScope="paid">'))
const fullTree=git('ls-tree','-r','--name-only',SOURCE)
assert.doesNotMatch(fullTree,/SponsorCommercialPages|sponsor-commercial-read-pagination|sponsor-commercial-g7-2a/)
for(const p of git('ls-tree','-r','--name-only',SOURCE,'--','api/src').split('\n'))assert.doesNotMatch(read(p).toString(),/\/sponsor\/commercial\/(?:sellers|assignments)\/page/)
assertG8Runtime(process.cwd(),G7,['api/src','web','functions','shared'])
assertG8Runtime(process.cwd(),SEARCH,['app/src','api/src','web','functions','shared'])
assert.deepEqual(read('api/src/sponsor-inventory-page.ts'),blob(G7,'api/src/sponsor-inventory-page.ts'))
assert.deepEqual(read('api/src/kawmed-live-guest.ts'),blob('d42691d8897c5e6fb376522ff9f54ecae74346e7','api/src/kawmed-live-guest.ts'))
console.log('PASS G8 paid/Team preservation, exact approved G7.1, G7.2 exclusion and historical #134 source reconciliation (not authenticated certification)')

// Exercise candidate API at this checkout; each read must enforce real server identity.
const f=await inventoryFixture(11)
for(const actor of ['normal','admin','operator']){const r=await f.request('',{actor});assert.equal(r.status,200);assert.equal(r.json.data.tenant_id,TENANT_A);assert.equal(r.json.data.items.length,10)}
for(const options of [{actor:'viewer'},{actor:'outsider'},{actor:'operator',kind:'medical_master'},{actor:'operator',tenant:TENANT_B}])assert.equal((await f.request('',options)).status,403)
assert.equal((await f.request('',{authenticated:false})).status,401)
assert.equal((await f.request('',{environment:'production'})).status,404,'Preview-only G7.1 API must not be silently enabled for Production')
assert.equal((await f.request('?q=other-tenant')).json.data.total,0)
const first=(await f.request()).json.data,next=(await f.request('?cursor='+first.next_cursor)).json.data
assert.equal(next.items.length,1);assert.ok(next.items.every(x=>!first.items.some(y=>y.artifact_id===x.artifact_id)));assert.equal(f.writeAttempts,0)
console.log('PASS G8 candidate API owner/admin/Multicuenta/tenant isolation, anonymous/viewer denial, pagination, Production exclusion and SELECT-only fixture')

// Proposed historical schemas stay outside api/migrations; no remote execution.
for(const name of ['0153_sponsor_sales_representatives.sql','0154_artifact_display_identifiers.sql']){
 assert.equal(existsSync('api/migrations/'+name),false,'Remote schema reconciliation remains a release gate')
 assert.deepEqual(read('docs/releases/kawvo-g8-proposed-migrations/'+name),blob(WORKER_SOURCE,'api/migrations/'+name))
}
const sql=read('docs/releases/KAWVO_G8_SCHEMA_READONLY.sql').toString().replace(/--[^\n]*/g,'')
for(const statement of sql.split(';').filter(x=>x.trim()))assert.match(statement.trim(),/^SELECT\b/i)
const localSchema=JSON.parse(execFileSync('python3',['-c',`import sqlite3,json,sys
c=sqlite3.connect(':memory:');c.executescript('CREATE TABLE sponsor_tenants(id TEXT PRIMARY KEY);CREATE TABLE intap_artifacts(id TEXT PRIMARY KEY);CREATE TABLE medical_access_codes(id TEXT PRIMARY KEY);')
for script in json.load(sys.stdin):c.executescript(script)
print(json.dumps([r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")]))`],{input:JSON.stringify(['0153_sponsor_sales_representatives.sql','0154_artifact_display_identifiers.sql'].map(name=>read('docs/releases/kawvo-g8-proposed-migrations/'+name).toString())),encoding:'utf8'}))
for(const name of ['sponsor_sales_representatives','sponsor_sales_assignments','sponsor_commercial_resources','artifact_display_identifiers','medical_display_identifiers'])assert.ok(localSchema.includes(name))
console.log('PASS G8 proposed schema provenance and SELECT-only preflight; remote D1/schema and rollback remain unverified')

// Never execute the historical Preview promotion/recovery automation as a release runner.
for(const name of ['promote','recover']){
 const source=read('scripts/'+name+'-kawmed-g7-1-search-preview.mjs').toString()
 assert.ok(source.includes("WORKER='intap-api-preview'"))
 assert.ok(source.includes("'ENVIRONMENT'&&b.text==='preview'"))
 assert.ok(source.includes(SEARCH));assert.ok(!source.includes("WORKER='intap-api'"))
}
console.log('PASS G8 historical operational scripts remain pinned to Preview; not executed or certified for Production')

if(process.argv.includes('--browser')){const {runG8Browser}=await import('./lib/kawvo-g8-browser.mjs');await runG8Browser()}
