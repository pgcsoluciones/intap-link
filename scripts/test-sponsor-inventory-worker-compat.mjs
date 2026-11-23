// Local SQLite fixtures: no Cloudflare access, writes or authenticated real QA.
import assert from 'node:assert/strict';
import path from 'node:path';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';import {pathToFileURL} from 'node:url';
import {mkdtempSync,mkdirSync,symlinkSync,readFileSync,writeFileSync} from 'node:fs';import {tmpdir} from 'node:os';import {build} from 'esbuild';
import {inventoryFixture,TENANT_A,TENANT_B,WORKER_SOURCE,checkG7Scope} from './test-sponsor-inventory-g7-contract.mjs';
checkG7Scope();
const r=await inventoryFixture(11);const {default:app}=await import(pathToFileURL(path.join(r.dir,'api.mjs')).href);
for(const [method,url] of [['GET','config'],['GET','sellers'],['POST','sellers/import'],['PATCH','sellers/:id'],['POST','assign']])assert.ok(app.routes.some(x=>x.method===method&&x.path==='/api/v1/sponsor/commercial/'+url));
assert.equal(typeof app.scheduled,'function');console.log('PASS compatibility: commercial route registrations and scheduled export coexist with G7');
// Historical schema is used only in the ephemeral fixture, never copied/applied to D1.
const schema=execFileSync('git',['show',WORKER_SOURCE+':api/migrations/0153_sponsor_sales_representatives.sql'],{encoding:'utf8'});
execFileSync('python3',['-c',"import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); c.executescript(sys.stdin.read()); c.commit()",r.path],{input:schema});
for(const t of [TENANT_A,TENANT_B]){
 r.alter("INSERT INTO sponsor_module_grants(sponsor_id,module_code,enabled) VALUES(?,'commercial_seller',1)",[t]);
 r.alter('INSERT INTO sponsor_sales_representatives(id,sponsor_id,first_name,whatsapp) VALUES(?,?,?,?)',['rep-'+t[0],t,'Fixture '+t[0],'18095550100']);
 r.alter('INSERT INTO sponsor_commercial_resources(sponsor_id,resource_url,resource_label) VALUES(?,?,?)',[t,'https://example.test/'+t[0],'Fixture '+t[0]]);
}
const writes=[];const DB={prepare(sql){let args=[];return{bind(...values){args=values;return this},async all(){assert.match(sql.trim(),/^SELECT/i);const rows=JSON.parse(execFileSync('python3',['scripts/lib/sponsor-inventory-g7-sqlite.py',r.path,'read',JSON.stringify([sql,args])],{encoding:'utf8'}));return {results:rows,success:true}},async first(){return (await this.all()).results[0]||null},async run(){writes.push({sql,args});throw Error('Fixture intercepted API write')}}},async batch(){writes.push({batch:true});throw Error('Unexpected API batch')}};
async function commercial(route,{actor='normal',method='GET',body,authenticated=true}={}){const headers={'Content-Type':'application/json'};if(authenticated)headers.Cookie='intap_preview_session_id=fixture-'+actor;const response=await app.fetch(new Request('https://app.preview.intaprd.com/api/v1/sponsor/commercial/'+route,{method,headers,...(body?{body:JSON.stringify(body)}:{})}),{ENVIRONMENT:'preview',DB},{waitUntil(){throw Error('Unexpected async mutation')}});return {status:response.status,data:await response.json()}}
const config=await commercial('config');assert.equal(config.status,200);assert.equal(config.data.data.can_manage,true);assert.equal(config.data.data.resource_url,'https://example.test/a');
const sellers=await commercial('sellers');assert.equal(sellers.status,200);assert.deepEqual(sellers.data.data.sellers.map(x=>x.id),['rep-a']);
assert.equal((await commercial('config',{authenticated:false})).status,401);
assert.equal((await commercial('sellers',{actor:'viewer'})).status,403);
assert.equal((await commercial('sellers/import',{method:'POST',body:{rows:[]}})).status,422);
assert.equal((await commercial('assign',{method:'POST',body:{codes:[]}})).status,422);
assert.equal((await commercial('sellers/rep-a',{actor:'viewer',method:'PATCH',body:{active:false}})).status,403);
assert.equal(writes.length,0);assert.equal(r.writeAttempts,0);console.log('PASS compatibility: real commercial GET config/sellers tenant isolation, unauthorized/invalid operations and zero writes; SQLite fixtures only');

// Exercise the recovered public-context guards before any Agenda/data read or write.
r.alter('ALTER TABLE auth_sessions ADD COLUMN id TEXT');r.alter('UPDATE auth_sessions SET id=user_id');
const beneficiary='cccccccc-cccc-cccc-cccc-cccccccccccc',master='dddddddd-dddd-dddd-dddd-dddddddddddd';
r.alter("UPDATE sponsored_profiles SET id=?,user_id='operator',profile_role='beneficiary' WHERE id='a-profile-000000'",[beneficiary]);
r.alter("UPDATE sponsored_profiles SET id=?,user_id='operator',profile_role='sponsor_owner' WHERE id='a-profile-000011'",[master]);
const fingerprint=createHash('sha256').update('fixture-operator').digest('hex').slice(0,24);
for(const [slug,requiredKind,requiredId] of [['a-profile-000000','sponsored',beneficiary],['a-profile-000011','sponsor',TENANT_A]]){
 for(const [kind,id,code] of [['medical',requiredId,'owner_account_category_mismatch'],[requiredKind,TENANT_B,'owner_account_identity_mismatch'],['','','owner_selection_missing']]){
  const Cookie='intap_preview_session_id=fixture-operator'+(kind?'; kawvo_intap_active_account_v1='+encodeURIComponent(kind+':'+id+':'+fingerprint+':'+ 'a'.repeat(32)):'');
  const response=await app.fetch(new Request('https://app.preview.intaprd.com/api/v1/me/sponsored-profile/appointments/public-context?username='+slug,{headers:{Cookie}}),{ENVIRONMENT:'preview',DB},{waitUntil(){throw Error('Unexpected side effect')}});
  assert.equal(response.status,403);assert.equal((await response.json()).code,code);
 }
}
// The legacy global auth middleware attempts last_seen_at after each response.
// Intercept it and assert its exact shape; G7 and commercial checks above still require zero writes.
assert.equal(writes.length,6);for(const op of writes){assert.equal(op.sql,"UPDATE auth_sessions SET last_seen_at = datetime('now') WHERE id = ?");assert.deepEqual(op.args,['operator'])}
assert.equal(r.writeAttempts,0);
console.log('PASS recovered public owner-context: six Master/beneficiary context denials; six legacy session-touch attempts intercepted, zero business writes');

// Reconstruct the documented source locally. These artifacts are NOT the downloaded Worker.
const evidence=mkdtempSync(path.join(tmpdir(),'g7-frontdoor-proof-')),baseline=path.join(evidence,'source');mkdirSync(baseline);
execFileSync('tar',['-x','-C',baseline],{input:execFileSync('git',['archive',WORKER_SOURCE,'api','shared'],{maxBuffer:64*1024*1024})});
for(const rel of ['node_modules','api/node_modules'])symlinkSync(path.resolve(rel),path.join(baseline,rel),'dir');
const manifests=[];
async function bundle(root,entry,name){const file=path.join(evidence,name+'.mjs');await build({entryPoints:[path.join(root,'api/src',entry)],bundle:true,platform:'node',format:'esm',target:'node20',external:['cloudflare:*'],outfile:file,logLevel:'silent'});const bytes=readFileSync(file);manifests.push({name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});return (await import(pathToFileURL(file).href)).default;}
const oldApp=await bundle(baseline,'preview-free-entry.ts','documented-api');
const catalog=a=>a.routes.map(({method,path})=>({method,path})),before=catalog(oldApp),after=catalog(app),newPath='/api/v1/sponsor/artifacts/page';
assert.equal(before.filter(x=>x.path===newPath).length,0);
assert.deepEqual(after.filter(x=>x.path===newPath),Array.from({length:3},()=>({method:'GET',path:newPath})));
assert.deepEqual(after.filter(x=>x.path!==newPath),before,'Every original route/method/middleware remains in the original order');
console.log('PASS full route catalog: '+before.length+' original registrations/order preserved; only three handlers on the new GET');
const oldFront=await bundle(baseline,'preview-frontdoor-entry.ts','documented-frontdoor');
const newFront=await bundle(process.cwd(),'preview-frontdoor-entry.ts','candidate-frontdoor');
assert.equal(newFront.scheduled.toString(),oldFront.scheduled.toString(),'Scheduled composition remains exact in compiled artifacts');
const originalFetch=globalThis.fetch,upstream=[];
try{
 globalThis.fetch=async(url,init)=>{upstream.push({url:String(url),method:init.method,marker:new Headers(init.headers).get('x-intap-preview-proxy')});return new Response('fixture-pages',{headers:{'content-type':'text/plain','x-frame-options':'DENY'}})};
 const env={ENVIRONMENT:'preview',APP_PAGES_ORIGIN:'https://fixture-app.example.test',WEB_PAGES_ORIGIN:'https://fixture-web.example.test'};
 for(const [host,target,marker] of [['app.preview.intaprd.com','fixture-app.example.test','app-custom-domain'],['preview.intaprd.com','fixture-web.example.test','web-custom-domain']]){
  const responses=[];for(const worker of [oldFront,newFront]){const response=await worker.fetch(new Request('https://'+host+'/assets/fixture.js?q=1'),env,{});responses.push({status:response.status,body:await response.text(),headers:[...response.headers]})}
  assert.deepEqual(responses[1],responses[0]);assert.deepEqual(upstream.slice(-2),Array.from({length:2},()=>({url:'https://'+target+'/assets/fixture.js?q=1',method:'GET',marker})));
 }
 for(const worker of [oldFront,newFront]){const response=await worker.fetch(new Request('https://app.preview.intaprd.com/admin/sponsor'),{ENVIRONMENT:'preview'},{});assert.equal(response.status,503)}
 for(const worker of [oldFront,newFront]){const response=await worker.fetch(new Request('https://app.preview.intaprd.com/api/v1/sponsor/commercial/config'),env,{});assert.equal(response.status,401)}
 assert.equal(upstream.length,4,'Missing bindings and private API must never fetch an invented Pages origin');
}finally{globalThis.fetch=originalFetch}
console.log('PASS frontdoor: same App/Web binding values produce identical proxy targets/responses; missing origins stay 503');
async function cron(worker,expression){const calls=[],tasks=[];const DB={prepare(sql){let args=[];return {bind(...values){args=values;return this},async all(){calls.push({method:'all',sql,args});return {results:[]}},async run(){calls.push({method:'run',sql,args});return {success:true,meta:{changes:0}}}}}};const previous=globalThis.fetch;let network=0;globalThis.fetch=async()=>{network++;throw Error('Scheduled fixture must not access network')};try{worker.scheduled({cron:expression},{DB,INSTAGRAM_TOKEN_ENCRYPTION_KEY:'fixture-only-not-a-real-key'},{waitUntil(p){tasks.push(p)}});await Promise.all(tasks);assert.equal(network,0)}finally{globalThis.fetch=previous}return calls.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))}
for(const expression of ['17 * * * *','17 5 * * *']){const oldCalls=await cron(oldFront,expression),newCalls=await cron(newFront,expression);assert.deepEqual(newCalls,oldCalls);assert.ok(newCalls.some(x=>x.sql.includes('sponsored_quote_media')));assert.ok(newCalls.some(x=>x.sql.includes('free_quote_media')));if(expression==='17 * * * *')assert.ok(newCalls.every(x=>x.method==='all'));else{assert.ok(newCalls.some(x=>x.sql.includes('team_link_codes')));assert.ok(newCalls.some(x=>x.sql.includes('trial_profiles')));assert.ok(newCalls.some(x=>x.sql.includes('profile_instagram_connections')))}}
console.log('PASS both scheduled paths: identical local fake DB calls for media/Instagram/Team/trial; no network or real data');
const report={source:WORKER_SOURCE,recordedVersion:'23405a5b-e9ca-4247-843d-28cc4f236eaa',recordedETag:'357ae54d4a6de4a1762adb8497ab14192333beb157eb955a904106b15573acbb',binaryEqualityAccredited:false,kind:'local reconstruction with installed esbuild; NOT deploy/rollback package',originalRegistrations:before.length,newRegistrations:after.length,manifests};
writeFileSync(path.join(evidence,'manifest.json'),JSON.stringify(report,null,2),{mode:0o600});
console.log('Local reconstruction and verification evidence: '+evidence);
