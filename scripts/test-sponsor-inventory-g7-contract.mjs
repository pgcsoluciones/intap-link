import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {mkdtempSync,readFileSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'
import {build} from 'esbuild'
import ts from 'typescript'
export const WORKER_SOURCE='2286c937d9ce13422f22b289f5029343c2f5ae4c'
export const TENANT_A='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',TENANT_B='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const bridge=resolve('scripts/lib/sponsor-inventory-g7-sqlite.py')
let bundled
export async function inventoryFixture(count=1001){
 const dir=mkdtempSync(join(tmpdir(),'kawvo-g7-')),path=join(dir,'fixture.sqlite'),queries=[]
 execFileSync('python3',[bridge,path,'seed',process.cwd(),String(count)])
 if(!bundled){bundled=join(dir,'api.mjs');await build({entryPoints:['api/src/preview-free-entry.ts'],bundle:true,platform:'node',format:'esm',target:'node20',external:['cloudflare:*'],outfile:bundled,logLevel:'silent'})}
 const {default:app}=await import(pathToFileURL(bundled).href)
 let writeAttempts=0
 const read=(sql,args)=>{assert.match(sql.trim(),/^(SELECT|EXPLAIN)\b/i,'Inventory must not mutate');const rows=JSON.parse(execFileSync('python3',[bridge,path,'read',JSON.stringify([sql,args])],{encoding:'utf8',maxBuffer:8*1024*1024}));queries.push({sql,args,rows:rows.length});return rows}
 const DB={prepare(sql){let args=[];return{bind(...a){args=a;return this},async first(column){const row=read(sql,args)[0]||null;return column?row?.[column]:row},async all(){return{success:true,results:read(sql,args)}},async run(){writeAttempts++;throw Error('API attempted fixture mutation')}}},async batch(){writeAttempts++;throw Error('API attempted fixture batch')}}
 const alter=(sql,args=[])=>JSON.parse(execFileSync('python3',[bridge,path,'fixture',JSON.stringify([sql,args])],{encoding:'utf8'}))
 async function request(search='',{actor='normal',kind='sponsor',tenant=TENANT_A,token='a'.repeat(32),presented=token,environment='preview',authenticated=true}={}){
  const raw='fixture-'+actor,hash=createHash('sha256').update(raw).digest('hex').slice(0,24)
  const cookie=authenticated?'intap_preview_session_id='+raw+(actor==='operator'?'; kawvo_intap_active_account_v1='+encodeURIComponent(kind+':'+tenant+':'+hash+':'+token):''):''
  const response=await app.fetch(new Request('https://app.preview.intaprd.com/api/v1/sponsor/artifacts/page'+search,{headers:{Cookie:cookie,'X-Intap-Account-Tab':presented}}),{ENVIRONMENT:environment,DB,APP_URL:'https://app.preview.intaprd.com',WEB_URL:'https://preview.intaprd.com'}, {waitUntil(){throw Error('Unexpected asynchronous side effect')}})
  const json=await response.json();return{status:response.status,json,cache:response.headers.get('cache-control')}
 }
 return{dir,path,queries,request,alter,get writeAttempts(){return writeAttempts}}
}
export function checkG7Scope(){
 const base='b97a2f01672eaa14df04f74aa6ad882f9b4cd256',prior=p=>execFileSync('git',['show',base+':'+p],{encoding:'utf8'}),read=p=>readFileSync(p,'utf8')
 const recovered=['free-appointments','index','kawmed-live-guest','medical-access-codes','preview-free-entry','scan-status','sponsor-commercial-sales','sponsored-appointments','sponsored-code-generation','sponsored-commercial-links-core','sponsored-owner-flow','sponsored-profiles','sponsored-scan'].map(n=>'api/src/'+n+'.ts')
 const allowed=[...recovered,'scripts/test-kawmed-code-accordion-contract.mjs','scripts/test-intapcard-active-account-contract.mjs','scripts/test-sponsor-inventory-worker-compat.mjs','api/src/sponsored-profiles.ts','api/src/sponsor-inventory-page.ts','app/src/components/admin/sponsored/SponsorDashboard.tsx','app/src/components/admin/sponsored/SponsorInventory.tsx','app/src/components/admin/sponsored/sponsor-shell-navigation.ts','scripts/test-sponsor-inventory-g7-contract.mjs','scripts/lib/sponsor-inventory-g7-browser.mjs','scripts/lib/sponsor-inventory-g7-sqlite.py','docs/architecture/KAWVO_G7_1_SPONSOR_INVENTORY.md',...['inventory-320','inventory-1280'].map(n=>'docs/qa/KAWVO_G7/'+n+'.png')]
 const uniqueAllowed=[...new Set(allowed)].sort()
 const delta=[...new Set([...execFileSync('git',['diff','--name-only',base],{encoding:'utf8'}).trim().split('\n'),...execFileSync('git',['ls-files','--others','--exclude-standard'],{encoding:'utf8'}).trim().split('\n')].filter(Boolean))].sort()
 assert.ok(delta.every(p=>uniqueAllowed.includes(p)),'G7.1 isolated allowlist, no G6/infra/migrations/dependencies')
 if(process.argv.includes('--scope'))assert.deepEqual(delta,uniqueAllowed)
 const path='api/src/sponsored-profiles.ts'
 assert.equal(read(path),"import { registerSponsorInventoryPage } from './sponsor-inventory-page'\n"+execFileSync('git',['show',WORKER_SOURCE+':'+path],{encoding:'utf8'})+'\nregisterSponsorInventoryPage(app,requireUser)\n','Documented Worker API source plus additive G7 registration')
 for(const file of execFileSync('git',['ls-tree','-r','--name-only',WORKER_SOURCE,'--','api/src'],{encoding:'utf8'}).trim().split('\n')){if(file===path)continue;assert.deepEqual(readFileSync(file),execFileSync('git',['show',WORKER_SOURCE+':'+file]),'Documented Worker source preserved byte-for-byte: '+file)}
 assert.deepEqual(readFileSync('api/src/sponsor-inventory-page.ts'),execFileSync('git',['show','c84680705b3e9075e4b10d2c5074bbb5f9e5d7fa:api/src/sponsor-inventory-page.ts']),'Approved G7 SELECT-only module unchanged')
 execFileSync('git',['diff','--exit-code',base,'--','api','app/src/components/admin/medical','app/src/components/admin/free','app/src/components/admin/shared','app/src/components/admin/IntapcardAccountSelector.tsx','app/src/components/admin/AdminGuard.tsx','app/src/App.tsx','app/src/lib','web','functions','shared','.github','package.json','package-lock.json',...recovered.map(p=>':(exclude)'+p),':(exclude)api/src/sponsor-inventory-page.ts'])
 for(const p of ['SponsorCommercialSellers.tsx','SponsoredDashboard.tsx','SponsoredAppointments.tsx','SponsoredUnifiedShell.tsx'])assert.equal(read('app/src/components/admin/sponsored/'+p),prior('app/src/components/admin/sponsored/'+p),'Prior G5 owner/forms/mutations/roles intact')
 const owner='app/src/components/admin/sponsored/SponsorDashboard.tsx'
 const writes=source=>{const file=ts.createSourceFile('owner.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),calls=[];function visit(n){if(ts.isCallExpression(n)&&ts.isIdentifier(n.expression)&&['apiPost','apiPatch','apiPut','apiDelete','fetch'].includes(n.expression.text))calls.push(n.getText(file));ts.forEachChild(n,visit)}visit(file);return calls.sort()}
 assert.deepEqual(writes(read(owner)),writes(prior(owner)),'Every original mutation call/payload/header remains intact; new read-only dataflow only')
 assert.doesNotMatch(read('api/src/sponsor-inventory-page.ts'),/\.\s*(?:run|batch|exec)\s*\(/,'The new route cannot execute writes')
 console.log('PASS G7.1 scope and pre-existing API/routes/guards/G3-G5 preserved')
}
async function run(){
 checkG7Scope();const r=await inventoryFixture(1001);let groups=0
 const test=async(name,fn)=>{await fn();groups++;console.log('PASS G7.1 '+name)}
 const ok=async(search='',options)=>{const x=await r.request(search,options);assert.equal(x.status,200,JSON.stringify(x.json));assert.equal(x.json.data.tenant_id,TENANT_A);return x.json.data}
 await test('real SQLite first/next/previous bounded stable results, master excluded and exact summary',async()=>{
  const a=await ok();assert.equal(a.items.length,10);assert.equal(a.total,1001);assert.equal(a.previous_cursor,null);assert.equal(a.from,1);assert.ok(a.next_cursor)
  const b=await ok('?cursor='+a.next_cursor);assert.equal(b.from,11);assert.equal(b.items.length,10);assert.ok(b.items.every(row=>!a.items.some(x=>x.artifact_id===row.artifact_id)))
  const back=await ok('?cursor='+b.previous_cursor);assert.deepEqual(back.items,a.items)
  const summary=await ok('?summary=1');assert.equal(summary.totals.total,1001);assert.equal(summary.master.artifact_role,'master');assert.equal(summary.totals.active,500)
 })
 await test('Unicode/literal search, AND terms, status and tenant-bound queries',async()=>{
  const match=await ok('?q='+encodeURIComponent(' CLÍNICA árbol %_ '));assert.equal(match.total,1);assert.match(match.items[0].business_name,/ÁRBOL/)
  r.alter('UPDATE sponsored_profiles SET business_name=? WHERE id=?',['Clínica ÁRBOL %_ literal'.normalize('NFD'),'a-profile-000000']);assert.equal((await ok('?q='+encodeURIComponent('CLÍNICA ÁRBOL'))).total,1);r.alter('UPDATE sponsored_profiles SET business_name=? WHERE id=?',['Clínica ÁRBOL %_ literal','a-profile-000000'])
  assert.equal((await ok('?q='+encodeURIComponent("' OR 1=1 --"))).total,0)
  assert.equal((await ok('?q=cliente-b')).total,0);assert.equal((await ok('?q=caribe+norte&status=activated')).total,500)
  assert.equal((await ok('?status=published')).total,334);assert.equal((await ok('?q=no-coincide')).items.length,0)
 })
 await test('owner/admin permitted; viewer, outsider, unauthenticated and Production denied',async()=>{
  await ok('',{actor:'admin'});for(const actor of ['viewer','outsider'])assert.equal((await r.request('',{actor})).status,403)
  assert.equal((await r.request('',{authenticated:false})).status,401);assert.equal((await r.request('',{environment:'production'})).status,404)
 })
 await test('Multicuenta kind/id/token and persisted context verified on every read',async()=>{
  await ok('',{actor:'operator'});assert.equal((await r.request('',{actor:'operator',kind:'medical_master'})).status,403)
  assert.equal((await r.request('',{actor:'operator',presented:'b'.repeat(32)})).status,409)
  assert.equal((await r.request('',{actor:'operator',tenant:TENANT_B})).status,403)
  r.alter('UPDATE sponsor_user_context SET sponsor_id=? WHERE user_id=?',[TENANT_B,'operator']);const x=await r.request('',{actor:'operator',tenant:TENANT_B});assert.equal(x.status,200);assert.equal(x.json.data.total,23);assert.ok(x.json.data.items.every(i=>i.artifact_id.startsWith('b-')))
  r.alter('UPDATE sponsor_user_context SET sponsor_id=? WHERE user_id=?',[TENANT_A,'operator'])
 })
 await test('limits/unknown/duplicate filters and malformed/cross-query/cross-tenant cursors rejected',async()=>{
  for(const q of ['?limit=0','?limit=26','?limit=-1','?limit=1.2','?limit=999999','?q='+('x'.repeat(161)),'?status=wrong','?q=a&q=b','?sponsor_id='+TENANT_B,'?assignment=assigned','?summary=0','?summary=1&cursor=a','?cursor=garbage','?cursor='])assert.equal((await r.request(q)).status,400,q)
  assert.equal((await ok('?limit=25')).items.length,25)
  const a=await ok();assert.equal((await r.request('?q=other&cursor='+a.next_cursor)).status,400)
  r.alter('UPDATE sponsor_user_context SET sponsor_id=? WHERE user_id=?',[TENANT_B,'operator']);assert.equal((await r.request('?cursor='+a.next_cursor,{actor:'operator',tenant:TENANT_B})).status,400);r.alter('UPDATE sponsor_user_context SET sponsor_id=? WHERE user_id=?',[TENANT_A,'operator'])
 })
 await test('cursor remains stable during insert/delete and reset request is explicit',async()=>{
  const first=await ok();r.alter("INSERT INTO intap_artifacts(id,public_code) VALUES('newer','NEWERCODE')");r.alter("INSERT INTO sponsor_artifacts(sponsor_id,artifact_id,created_at) VALUES(?,'newer','2030-01-01 00:00:00')",[TENANT_A])
  const second=await ok('?cursor='+first.next_cursor);assert.equal(second.total,first.total);assert.equal(second.items.some(x=>x.artifact_id==='newer'),false);assert.equal((await ok()).total,1002)
  const only=await ok('?q=CLINICA');assert.equal(only.items.length,1)
  const custom=JSON.parse(Buffer.from(first.next_cursor,'base64url').toString());custom.k=['1900-01-01 00:00:00','a'];const empty=await ok('?cursor='+Buffer.from(JSON.stringify(custom)).toString('base64url'));assert.equal(empty.reset_required,true)
 })
 await test('0/1/N/N+1 cases and full traversal of 1001 immutable rows have no duplicate or missing IDs',async()=>{
  r.alter("DELETE FROM sponsor_artifacts WHERE artifact_id='newer'")
  let cursor,ids=[];do{const d=await ok(cursor?'?limit=25&cursor='+cursor:'?limit=25');ids.push(...d.items.map(x=>x.artifact_id));cursor=d.next_cursor}while(cursor)
  assert.equal(ids.length,1001);assert.equal(new Set(ids).size,1001)
  for(const count of [0,1,10,11]){const f=await inventoryFixture(count),a=await f.request();assert.equal(a.status,200);assert.equal(a.json.data.items.length,Math.min(10,count));assert.equal(a.json.data.total,count);assert.equal(Boolean(a.json.data.next_cursor),count>10);assert.equal(f.writeAttempts,0)}
 })
 await test('10001 rows stay in SQLite; response size and selected page remain bounded',async()=>{
  const large=await inventoryFixture(10001),first=await large.request('?limit=25');assert.equal(first.status,200);assert.equal(first.json.data.total,10001);assert.equal(first.json.data.items.length,25);assert.ok(JSON.stringify(first.json).length<24000);const found=await large.request('?q=ACODE010000');assert.equal(found.status,200);assert.equal(found.json.data.total,1);assert.equal(large.writeAttempts,0)
 })
 await test('SELECT-only, indexed tenant predicate, every inventory result bounded and no remote services',async()=>{
  assert.equal(r.writeAttempts,0);assert.ok(r.queries.filter(q=>/SELECT a|SELECT sa.artifact_id/.test(q.sql)).every(q=>q.rows<=26))
  const p=JSON.parse(execFileSync('python3',[bridge,r.path,'read',JSON.stringify(['EXPLAIN QUERY PLAN '+r.queries.find(q=>q.sql.includes('SELECT sa.artifact_id')&&q.sql.includes('LIKE')).sql,r.queries.find(q=>q.sql.includes('SELECT sa.artifact_id')&&q.sql.includes('LIKE')).args])],{encoding:'utf8'}));assert.ok(p.some(x=>/INDEX/.test(x.detail)));writeFileSync(join(r.dir,'query-plan.json'),JSON.stringify(p,null,2))
 })
 console.log('PASS G7.1 API/real SQLite '+groups+' groups; local fixtures only; evidence '+r.dir)
 if(process.argv.includes('--browser')){const {runG7Browser}=await import('./lib/sponsor-inventory-g7-browser.mjs');await runG7Browser()}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await run()
