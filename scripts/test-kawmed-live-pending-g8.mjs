// Focal #134 test: original handlers + SQLite temporary fixture. No network or remote D1.
import assert from 'node:assert/strict'
import {mkdtempSync,readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {pathToFileURL} from 'node:url'
import {build} from 'esbuild'
const directory=mkdtempSync(join(tmpdir(),'kawvo-g8-live-local-')),database=join(directory,'fixture.sqlite'),bundle=join(directory,'handlers.mjs')
const query=(sql,args=[])=>JSON.parse(execFileSync('python3',['-c',`import sqlite3,json,sys
c=sqlite3.connect(sys.argv[1]);c.row_factory=sqlite3.Row
r=c.execute(sys.argv[2],json.loads(sys.argv[3]));rows=[dict(x) for x in r.fetchall()] if r.description else [];c.commit();print(json.dumps(rows))`,database,sql,JSON.stringify(args)],{encoding:'utf8'}))
execFileSync('python3',['-c',`import sqlite3,sys
c=sqlite3.connect(sys.argv[1]);c.executescript("CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT);CREATE TABLE auth_sessions(user_id TEXT,session_hash TEXT,expires_at TEXT,revoked_at TEXT);CREATE TABLE medical_profiles(id TEXT PRIMARY KEY,user_id TEXT,name TEXT);")
c.executescript(sys.stdin.read());c.commit()`,database],{input:readFileSync('api/migrations/0151_kawmed_demo_invitations.sql','utf8')+'\n'+readFileSync('api/migrations/0152_kawmed_live_guest_access.sql','utf8')})
const hash=x=>createHash('sha256').update(x).digest('hex'),id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',token='c'.repeat(64),cookie='local-fixture-session'
for(const [user,email] of [['owner','intapcard@gmail.com'],['guest','guest@example.test'],['outsider','outsider@example.test'],['other-owner','other@example.test']])query('INSERT INTO users VALUES (?,?)',[user,email])
query("INSERT INTO auth_sessions VALUES (?,?,datetime('now','+1 day'),NULL)",['guest',hash(cookie)])
query('INSERT INTO medical_profiles VALUES (?,?,?)',['doctor-a','owner','Synthetic saved profile'])
query('INSERT INTO medical_profiles VALUES (?,?,?)',['doctor-b','owner','Other synthetic profile'])
query("INSERT INTO kawmed_demo_invitations(id,token_hash,invited_email,owner_user_id,source_medical_profile_id,status,expires_at,sandbox_json) VALUES (?,?,?,'owner','doctor-a','pending',datetime('now','+1 day'),'{}')",[id,hash(token),'guest@example.test'])
query('INSERT INTO kawmed_demo_live_access(invitation_id,medical_profile_id,owner_user_id) VALUES (?,?,?)',[id,'doctor-a','owner'])
await build({stdin:{contents:"export {default as app} from './api/src/preview-free-entry';export {liveGuestProfile,liveGuestInvitation} from './api/src/kawmed-live-guest'",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',target:'node20',external:['cloudflare:*'],outfile:bundle,logLevel:'silent'})
const {app,liveGuestProfile}=await import(pathToFileURL(bundle).href),base='/api/v1/me/kawmed/live-access/:token'
const get=app.routes.find(r=>r.method==='GET'&&r.path===base)?.handler,activate=app.routes.find(r=>r.method==='POST'&&r.path===base+'/activate')?.handler
assert.ok(get&&activate,'Original registered handlers required')
let updates=0,beforeActivationWrite=null,lastChanges=0
const DB={prepare(sql){let args=[];return{bind(...values){args=values;return this},async first(){return query(sql,args)[0]||null},async run(){assert.match(sql,/^UPDATE kawmed_demo_invitations SET status='active'/);if(beforeActivationWrite){beforeActivationWrite();beforeActivationWrite=null}updates++;lastChanges=Number(execFileSync('python3',['-c',`import sqlite3,json,sys
c=sqlite3.connect(sys.argv[1]);r=c.execute(sys.argv[2],json.loads(sys.argv[3]));c.commit();print(r.rowcount)`,database,sql,JSON.stringify(args)],{encoding:'utf8'}));return{success:true,meta:{changes:lastChanges}}}}}}
const ctx=({session=true,requested='i-'+id,delegate='i-'+id}={})=>({env:{ENVIRONMENT:'preview',DB},req:{header:name=>name==='Cookie'&&session?'intap_preview_session_id='+cookie:name==='X-KawMed-Delegate'?delegate:'',param:()=>requested},json:(data,status=200)=>Response.json(data,{status})})
const reset=()=>{query("UPDATE kawmed_demo_invitations SET status='pending',expires_at=datetime('now','+1 day') WHERE id=?",[id]);query("UPDATE users SET email='guest@example.test' WHERE id='guest'");query("UPDATE kawmed_demo_live_access SET medical_profile_id='doctor-a',owner_user_id='owner' WHERE invitation_id=?",[id]);updates=0}
const denied=async label=>{assert.equal((await get(ctx())).status,403,label+' GET');assert.equal((await activate(ctx())).status,403,label+' POST');assert.equal(await liveGuestProfile(ctx(),'guest'),null,label+' edit');assert.equal(updates,0,label+' cannot activate');console.log('PASS local #134 '+label)}
assert.equal((await get(ctx({session:false}))).status,401);assert.equal((await activate(ctx({session:false}))).status,401);assert.equal(updates,0)
assert.equal(await liveGuestProfile(ctx(),'guest'),null,'pending may not edit')
let response=await get(ctx());assert.equal(response.status,200);assert.equal((await response.json()).data.medical_profile_id,'doctor-a');assert.equal(updates,0)
response=await get(ctx({requested:token}));assert.equal((await response.json()).data.medical_profile_id,'doctor-a','Hashed token path resolves same authorized grant')
response=await activate(ctx());assert.equal(response.status,200);assert.equal((await response.json()).data.medical_profile_id,'doctor-a');assert.equal(updates,1)
assert.equal(query('SELECT status FROM kawmed_demo_invitations WHERE id=?',[id])[0].status,'active')
assert.equal((await liveGuestProfile(ctx(),'guest')).id,'doctor-a');assert.equal(await liveGuestProfile(ctx({delegate:'doctor-b'}),'guest'),null)
response=await activate(ctx());assert.equal(response.status,200,'normal active re-entry stays authorized');assert.equal((await liveGuestProfile(ctx(),'guest')).id,'doctor-a')
console.log('PASS local #134 anonymous denied; pending GET no edit; original activate pending→active; correct profile; active re-entry')
reset();query("UPDATE users SET email='wrong@example.test' WHERE id='guest'");await denied('wrong invited email')
reset();query("UPDATE kawmed_demo_invitations SET expires_at=datetime('now','-1 minute') WHERE id=?",[id]);await denied('expired grant')
reset();query("UPDATE kawmed_demo_invitations SET status='revoked' WHERE id=?",[id]);await denied('revoked grant')
reset();query("UPDATE kawmed_demo_live_access SET owner_user_id='other-owner' WHERE invitation_id=?",[id]);await denied('owner/profile mismatch')
reset();query('DELETE FROM kawmed_demo_live_access WHERE invitation_id=?',[id]);await denied('missing live grant');query('INSERT INTO kawmed_demo_live_access(invitation_id,medical_profile_id,owner_user_id) VALUES (?,?,?)',[id,'doctor-a','owner'])
reset();query("INSERT INTO kawmed_demo_invitations(id,token_hash,invited_email,owner_user_id,source_medical_profile_id,status,expires_at,sandbox_json) VALUES (?,?,?,'owner','doctor-a','pending',datetime('now','+1 day'),'{}')",[other,hash('d'.repeat(64)),'guest@example.test']);query('INSERT INTO kawmed_demo_live_access(invitation_id,medical_profile_id,owner_user_id) VALUES (?,?,?)',[other,'doctor-b','owner']);await denied('older invitation superseded by newest grant')
query('DELETE FROM kawmed_demo_live_access WHERE invitation_id=?',[other]);query('DELETE FROM kawmed_demo_invitations WHERE id=?',[other]);reset();await activate(ctx());query("UPDATE medical_profiles SET name='Saved local change' WHERE id='doctor-a'");query("UPDATE kawmed_demo_invitations SET status='revoked' WHERE id=?",[id]);assert.equal(await liveGuestProfile(ctx(),'guest'),null);assert.equal(query("SELECT name FROM medical_profiles WHERE id='doctor-a'")[0].name,'Saved local change')
const owner=readFileSync('api/src/medical-profile-owner.ts','utf8');assert.match(owner,/if\(delegateHeader\(c\) &&/);assert.match(owner,/delete-account\|suspend\|reactivate/)
console.log('PASS local #134 revocation terminates delegated reads without reverting saved data; owner lifecycle restriction retained')
console.log('PASS focal #134 with original handlers and local SQLite only; real authorized new-invitation QA remains BLOCKED, no remote POST executed')
if(process.argv.includes('--race')){
 reset();beforeActivationWrite=()=>query("UPDATE kawmed_demo_invitations SET status='revoked' WHERE id=?",[id])
 const raced=await activate(ctx());assert.equal(lastChanges,0);assert.equal(await liveGuestProfile(ctx(),'guest'),null,'Revocation still prevents delegated editing')
 console.log('REPRO #134 local race: grant revoked between read and UPDATE; UPDATE changes=0; handler status='+raced.status+'; editing denied')
 assert.equal(raced.status,403,'FAIL: activation must not report success when conditional UPDATE changed zero rows; no product patch in this audit')
}
