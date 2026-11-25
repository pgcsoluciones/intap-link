import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {execFileSync} from 'node:child_process'
import {build} from 'esbuild'
import {webcrypto} from 'node:crypto'

if(!globalThis.crypto)globalThis.crypto=webcrypto
const dir=mkdtempSync(join(tmpdir(),'kawvo-r4-test-'))
const database=join(dir,'test.sqlite')
const python=`import sqlite3,sys,json
db=sqlite3.connect(sys.argv[1])
db.row_factory=sqlite3.Row
db.execute("PRAGMA foreign_keys=ON")
request=json.load(sys.stdin)
out=[]
with db:
 for x in request:
  if x.get("script"):
   db.executescript(x["script"])
   out.append(None)
   continue
  c=db.execute(x["sql"],x.get("args",[]))
  if x["mode"]=="run":
   out.append({"success":True,"meta":{"changes":c.rowcount}})
  elif x["mode"]=="first":
   row=c.fetchone()
   out.append(dict(row) if row else None)
  else:
   out.append({"results":[dict(row) for row in c.fetchall()]})
print(json.dumps(out))
`
const execute=(requests)=>JSON.parse(execFileSync('python3',['-c',python,database],{input:JSON.stringify(requests),encoding:'utf8'}))
const run=(sql,args=[])=>execute([{sql,args,mode:'run'}])[0]
const query=(sql,args=[])=>execute([{sql,args,mode:'all'}])[0].results
const fixture=`
CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT);
CREATE TABLE plans(id TEXT PRIMARY KEY,name TEXT);
CREATE TABLE profiles(id TEXT PRIMARY KEY,user_id TEXT,slug TEXT UNIQUE,plan_id TEXT,is_active INTEGER,is_published INTEGER,template_id TEXT,template_data TEXT,FOREIGN KEY(user_id) REFERENCES users(id));
CREATE TABLE plan_limits(plan_id TEXT PRIMARY KEY,max_links INTEGER,max_photos INTEGER,max_faqs INTEGER,max_products INTEGER,max_videos INTEGER,can_use_vcard INTEGER);
CREATE TABLE modules(code TEXT PRIMARY KEY,name TEXT,effects_json TEXT);
CREATE TABLE profile_modules(profile_id TEXT,module_code TEXT,expires_at TEXT);
CREATE TABLE profile_plan_overrides(profile_id TEXT,trial_plan_id TEXT,trial_ends_at TEXT);
CREATE TABLE team_workspaces(id TEXT PRIMARY KEY,master_profile_id TEXT,status TEXT);
CREATE TABLE team_members(profile_id TEXT,team_id TEXT,status TEXT);
CREATE TABLE free_demo_v2_profiles(profile_id TEXT,status TEXT);
CREATE TABLE analytics(id TEXT PRIMARY KEY,profile_id TEXT,event_type TEXT,target_id TEXT,created_at TEXT DEFAULT (datetime('now')),FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE CASCADE);
INSERT INTO users VALUES ('owner','owner@example.test'),('other','other@example.test'),('operator','intapcard@gmail.com');
INSERT INTO plans VALUES ('free','Free'),('pro','Pro');
INSERT INTO plan_limits VALUES ('free',3,10,0,0,0,1),('pro',10,10,10,10,10,1);
INSERT INTO profiles VALUES ('p1','owner','test-profile','free',1,1,NULL,'{"unrelated":true}'),('p2','other','other-profile','free',1,1,NULL,'{}'),('p3','operator','operator-profile','free',1,1,NULL,'{}'),('p4','owner','paid-profile','pro',1,1,NULL,'{}');
`
try{
 execute([{script:fixture},{script:readFileSync(new URL('../docs/releases/kawvo-r4-proposed-migrations/review-settings.sql',import.meta.url),'utf8')}])
 const bundled=await build({entryPoints:['api/src/reviews/link-adapter.ts'],bundle:true,format:'esm',platform:'node',target:'node20',write:false})
 const {registerLinkReviewRoutes}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'))
 class Statement{
  constructor(sql,args=[]){this.sql=sql;this.args=args}
  bind(...args){return new Statement(this.sql,args)}
  async first(){return execute([{sql:this.sql,args:this.args,mode:'first'}])[0]}
  async all(){return execute([{sql:this.sql,args:this.args,mode:'all'}])[0]}
  async run(){return execute([{sql:this.sql,args:this.args,mode:'run'}])[0]}
 }
 const db={prepare:sql=>new Statement(sql),batch:async statements=>execute(statements.map(s=>({sql:s.sql,args:s.args,mode:'run'})))}
 const handlers=new Map()
 const router={get:(p,h)=>handlers.set('GET '+p,h),put:(p,h)=>handlers.set('PUT '+p,h),post:(p,h)=>handlers.set('POST '+p,h)}
 registerLinkReviewRoutes(router,router)
 const ownerPath='/profile/reviews/:profileId',publicPath='/api/v1/public/profiles/:slug/reviews'
 const call=(method,path,{id='p1',slug='test-profile',user='owner',body,headers={},days,delegated=false}={})=>{
  const h=handlers.get(method+' '+path);assert.ok(h)
  return h({env:{DB:db,ENVIRONMENT:'preview'},get:k=>k==='userId'?user:k==='freeDemoDelegated'?delegated:undefined,req:{param:k=>k==='profileId'?id:slug,query:k=>k==='days'?days:undefined,header:k=>headers[k],json:async()=>body},header:()=>{},json:(data,status=200)=>({status,data})})
 }
 const url='https://g.page/r/Cabc123/review'
 const config={enabled:true,googleReviewUrl:url}
 assert.equal((await call('GET',publicPath)).data.data,null)
 assert.equal((await call('GET',ownerPath)).data.data.enabled,false)
 assert.equal((await call('GET',ownerPath,{id:'p2'})).status,403)
 assert.equal((await call('GET',ownerPath,{id:'p3',user:'operator'})).status,403)
 assert.equal((await call('GET',ownerPath,{id:'p4'})).status,403)
 assert.equal((await call('PUT',ownerPath,{delegated:true,body:config})).status,403)
 assert.equal((await call('PUT',ownerPath,{headers:{'X-KawMed-Delegate':'guest'},body:config})).status,403)
 assert.equal((await call('PUT',ownerPath,{body:{enabled:true,googleReviewUrl:'https://evil.test/'}})).status,400)
 assert.equal((await call('PUT',ownerPath,{id:'p2',body:config})).status,403)
 assert.equal((await call('PUT',ownerPath,{body:config})).status,200)
 assert.deepEqual((await call('GET',publicPath)).data.data,{googleReviewUrl:url})
 assert.equal(query("SELECT template_data FROM profiles WHERE id='p1'")[0].template_data,'{"unrelated":true}')
 assert.equal(query('SELECT * FROM profile_review_settings').length,1)
 const visitId=crypto.randomUUID()
 for(const eventType of ['review_click','review_click','review_view','review_qr','review_qr']){
  assert.equal((await call('POST',publicPath+'/track',{body:{eventType,visitId}})).status,200)
 }
 const stats=(await call('GET',ownerPath,{days:'7'})).data.data
 assert.equal(stats.publicUrl,'https://preview.intaprd.com/test-profile')
 assert.deepEqual(stats.stats,{days:7,views:1,qr:1,clicks:1,clickRate:100})
 assert.equal((await call('GET',ownerPath,{days:'999'})).status,400)
 run("UPDATE profiles SET is_published=0 WHERE id='p1'")
 assert.equal((await call('GET',publicPath)).data.data,null)
 assert.equal((await call('POST',publicPath+'/track',{body:{eventType:'review_click',visitId:crypto.randomUUID()}})).status,404)
 run("UPDATE profiles SET is_published=1 WHERE id='p1'")
 run("INSERT INTO team_workspaces VALUES ('t1','p1','active')")
 assert.equal((await call('GET',ownerPath)).status,403)
 assert.equal((await call('GET',publicPath)).data.data,null)
 run("DELETE FROM team_workspaces WHERE id='t1'")
 run("INSERT INTO free_demo_v2_profiles VALUES ('p1','published')")
 assert.equal((await call('GET',ownerPath)).status,403)
 run("DELETE FROM free_demo_v2_profiles")
 run("UPDATE profiles SET template_id='real_estate_novi_v4' WHERE id='p1'")
 assert.equal((await call('GET',publicPath)).data.data,null)
 run("UPDATE profiles SET template_id=NULL WHERE id='p1'")
 assert.equal((await call('PUT',ownerPath,{body:{enabled:false,googleReviewUrl:url}})).status,200)
 assert.equal((await call('GET',publicPath)).data.data,null)
 run("DELETE FROM profiles WHERE id='p1'")
 assert.equal(query('SELECT * FROM profile_review_settings').length,0)
 assert.equal(query('SELECT * FROM analytics').length,0)
 console.log('PASS R4 isolated SQLite adapter: configuration, owner, Team/demo, plan, visibility, analytics and deletion')
}finally{rmSync(dir,{recursive:true,force:true})}
