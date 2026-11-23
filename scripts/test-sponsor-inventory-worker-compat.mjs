// Local SQLite fixtures: no Cloudflare access, writes or authenticated real QA.
import assert from 'node:assert/strict';
import path from 'node:path';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';import {pathToFileURL} from 'node:url';
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
