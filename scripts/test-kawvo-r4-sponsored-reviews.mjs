import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {execFileSync} from 'node:child_process'
import {build} from 'esbuild'
import {webcrypto,createHash} from 'node:crypto'

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
INSERT INTO users VALUES('owner','owner@test.invalid'),('beneficiary','beneficiary@test.invalid'),('other','other@test.invalid'),('operator','intapcard@gmail.com');
CREATE TABLE sponsor_tenants(id TEXT PRIMARY KEY,name TEXT,slug TEXT,sponsor_type TEXT,logo_url TEXT,is_active INTEGER);
INSERT INTO sponsor_tenants VALUES('s','Sponsor','s','merchant','',1);
CREATE TABLE sponsor_members(sponsor_id TEXT,user_id TEXT,role TEXT,status TEXT,created_at TEXT DEFAULT '2026-01-01');
INSERT INTO sponsor_members(sponsor_id,user_id,role,status) VALUES('s','owner','owner','active'),('s','other','admin','active');
CREATE TABLE sponsor_user_context(user_id TEXT PRIMARY KEY,sponsor_id TEXT);
CREATE TABLE sponsored_profiles(id TEXT PRIMARY KEY,sponsor_id TEXT,user_id TEXT,username TEXT,business_name TEXT,address TEXT,status TEXT,profile_role TEXT,created_at TEXT DEFAULT '2026-01-01');
INSERT INTO sponsored_profiles(id,sponsor_id,user_id,username,business_name,address,status,profile_role) VALUES
('m','s','owner','master-shop','Master','Master address','published','sponsor_owner'),
('b','s','beneficiary','benef-shop','Beneficiary','Benef address','published','beneficiary'),
('11111111-1111-4111-8111-111111111111','s','operator','operator-shop','Operator','','published','beneficiary'),
('22222222-2222-4222-8222-222222222222','s','operator','operator-other','Other','','published','beneficiary');
`
try{
 execute([{script:fixture},{script:readFileSync(new URL('../docs/releases/kawvo-r4-proposed-migrations/sponsored-reviews.sql',import.meta.url),'utf8')},{script:readFileSync(new URL('../docs/releases/kawvo-r4-proposed-migrations/google-search-usage.sql',import.meta.url),'utf8')}])
 const bundled=await build({entryPoints:['api/src/reviews/sponsored-adapter.ts'],bundle:true,format:'esm',platform:'node',target:'node20',write:false})
 const {registerSponsoredReviewRoutes}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'))
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
 registerSponsoredReviewRoutes(router,router)
 const privatePath='/sponsored-profile/reviews/:profileId',publicPath='/api/v1/public/sponsored/:slug/reviews'
 const call=(method,path,{id='b',slug='benef-shop',user='beneficiary',scope,profile_id,body,headers={},env={}}={})=>{
  const h=handlers.get(method+' '+path);assert.ok(h)
  return h({env:{DB:db,ENVIRONMENT:'preview',...env},get:k=>k==='userId'?user:undefined,req:{param:k=>k==='profileId'?id:slug,query:k=>k==='scope'?scope:k==='profile_id'?profile_id:undefined,header:k=>headers[k],raw:body===undefined?new Request('https://app.preview.intaprd.com/test'):new Request('https://app.preview.intaprd.com/test',{method:'POST',body:JSON.stringify(body)}),json:async()=>body},header:()=>{},json:(data,status=200)=>({status,data})})
 }
 const a={enabled:true,googleReviewUrl:'https://g.page/r/Benef123/review'},b={enabled:true,googleReviewUrl:'https://g.page/r/Master123/review'}
 const master={id:'m',user:'owner',scope:'master'}
 assert.equal((await call('GET',privatePath)).data.data.enabled,false)
 assert.equal((await call('GET',privatePath,master)).status,200)
 assert.equal((await call('GET',privatePath,{...master,user:'other'})).status,403)
 assert.equal((await call('GET',privatePath,{...master,scope:undefined})).status,403)
 assert.equal((await call('GET',privatePath,{id:'m'})).status,403)
 assert.equal((await call('GET',privatePath,{profile_id:'b'})).status,403)
 assert.equal((await call('PUT',privatePath,{...master,id:'b',body:b})).status,403)
 assert.equal((await call('PUT',privatePath,{body:a,headers:{'X-KawMed-Delegate':'guest'}})).status,403)
 assert.equal((await call('GET',publicPath)).data.data,null)
 assert.equal((await call('PUT',privatePath,{body:a})).status,200)
 assert.equal((await call('PUT',privatePath,{...master,body:b})).status,200)
 assert.equal((await call('GET',privatePath)).data.data.publicUrl,'https://preview.intaprd.com/p/benef-shop')
 assert.deepEqual((await call('GET',publicPath)).data.data,{googleReviewUrl:a.googleReviewUrl})
 assert.deepEqual((await call('GET',publicPath,{slug:'master-shop'})).data.data,{googleReviewUrl:b.googleReviewUrl})
 const visitId=crypto.randomUUID()
 for(const eventType of ['review_click','review_view','review_qr','review_click'])assert.equal((await call('POST',publicPath+'/track',{body:{eventType,visitId}})).status,200)
 assert.deepEqual((await call('GET',privatePath)).data.data.stats,{days:30,views:1,qr:1,clicks:1,clickRate:100})
 assert.equal((await call('GET',privatePath,master)).data.data.stats.clicks,0)
 run("UPDATE sponsored_profiles SET status='draft' WHERE id='b'")
 assert.equal((await call('GET',publicPath)).data.data,null)
 assert.equal((await call('GET',privatePath)).status,200)
 run("UPDATE sponsored_profiles SET status='suspended' WHERE id='b'")
 assert.equal((await call('GET',privatePath)).status,403)
 run("UPDATE sponsored_profiles SET status='published' WHERE id='b'")
 run("UPDATE sponsor_tenants SET is_active=0 WHERE id='s'")
 assert.deepEqual((await call('GET',publicPath)).data.data,{googleReviewUrl:a.googleReviewUrl})
 assert.equal((await call('GET',privatePath,master)).status,403)
 assert.equal((await call('PUT',privatePath,{body:{enabled:false,googleReviewUrl:a.googleReviewUrl}})).status,200)
 assert.equal((await call('GET',publicPath)).data.data,null)
 const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222'
 const session='p1-test-session',token='a'.repeat(32),fingerprint=createHash('sha256').update(session).digest('hex').slice(0,24)
 const headers={Cookie:'intap_preview_session_id='+session+'; kawvo_intap_active_account_v1='+encodeURIComponent('sponsored:'+id+':'+fingerprint+':'+token),'X-Intap-Account-Tab':token}
 assert.equal((await call('GET',privatePath,{id,user:'operator'})).status,403)
 assert.equal((await call('GET',privatePath,{id,user:'operator',headers})).status,200)
 assert.equal((await call('PUT',privatePath,{id:other,user:'operator',headers,body:a})).status,403)
 assert.equal((await call('GET',privatePath,{id,user:'operator',headers:{...headers,'X-Intap-Account-Tab':'b'.repeat(32)}})).status,403)
 assert.equal((await call('POST',privatePath+'/google-search',{id,user:'operator',headers:{...headers,Origin:'https://evil.test'},body:{}})).status,403)
 // Test a valid sponsored search and share the global user/IP budget with Link.
 const searchEnv={GOOGLE_REVIEWS_SEARCH_ENABLED:'1',GOOGLE_PLACES_API_KEY:'places-test-secret-12345',GOOGLE_MAPS_EMBED_KEY:'embed-test-public-12345'}
 const browserHeaders={Origin:'https://app.preview.intaprd.com','Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1'}
 const savedFetch=globalThis.fetch
 let googleCalls=0
 try{
  globalThis.fetch=async(input,init)=>{
   googleCalls++;assert.equal(String(input),'https://places.googleapis.com/v1/places:searchText')
   assert.equal(init.headers['X-Goog-FieldMask'],'places.id')
   return new Response(JSON.stringify({places:[{id:'sponsored_place'}]}),{status:200})
  }
  const input={businessName:'Beneficiary',city:'Santo Domingo',countryCode:'DO'}
  assert.equal((await call('POST',privatePath+'/google-search',{id:'m',body:input,headers:browserHeaders,env:searchEnv})).status,403)
  assert.equal(googleCalls,0)
  assert.deepEqual((await call('POST',privatePath+'/google-search',{body:input,headers:browserHeaders,env:searchEnv})).data,{ok:true,results:[{placeId:'sponsored_place'}]})
  assert.equal(googleCalls,1)
  assert.equal(query("SELECT profile_id FROM review_google_search_usage")[0].profile_id,'sponsored:b')
 }finally{globalThis.fetch=savedFetch}
 // Multicuenta Master: context sponsor ID, actual presentation ID and owner are distinct.
 const sponsorId='33333333-3333-4333-8333-333333333333',masterId='44444444-4444-4444-8444-444444444444'
 run("INSERT INTO sponsor_tenants VALUES(?,'Other Sponsor','other-sponsor','merchant','',1)",[sponsorId])
 run("INSERT INTO sponsor_members(sponsor_id,user_id,role,status) VALUES(?,'operator','owner','active')",[sponsorId])
 run("INSERT INTO sponsor_user_context VALUES('operator',?)",[sponsorId])
 run("INSERT INTO sponsored_profiles(id,sponsor_id,user_id,username,business_name,status,profile_role) VALUES(?,?,'operator','operator-master','Operator Master','published','sponsor_owner')",[masterId,sponsorId])
 const masterHeaders={Cookie:'intap_preview_session_id='+session+'; kawvo_intap_active_account_v1='+encodeURIComponent('sponsor:'+sponsorId+':'+fingerprint+':'+token),'X-Intap-Account-Tab':token}
 const selection={id:masterId,user:'operator',scope:'master',headers:masterHeaders}
 assert.equal((await call('GET',privatePath,selection)).status,200)
 assert.equal((await call('PUT',privatePath,{...selection,id,body:a})).status,403)
 assert.equal((await call('GET',privatePath,{...selection,headers})).status,403)
 assert.equal((await call('GET',privatePath,{...selection,headers:{...masterHeaders,'X-Intap-Account-Tab':'b'.repeat(32)}})).status,403)
 run("UPDATE sponsor_user_context SET sponsor_id='s' WHERE user_id='operator'")
 assert.equal((await call('GET',privatePath,selection)).status,403)
 assert.equal(query('SELECT count(*) n FROM sponsored_review_settings')[0].n,2)
 const src=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
 const web=src('web/src/components/sponsored/SponsoredProfile.tsx')
 assert.ok(web.indexOf('<LinkReviews')<web.indexOf('<SponsoredBankAccounts'))
 assert.match(web,/data\.sponsor\?\.banner_enabled!==false/)
 const links=await build({entryPoints:['web/src/components/reviews/review-section-links.ts'],bundle:true,format:'esm',platform:'node',write:false})
 const {feedbackSectionLinks}=await import('data:text/javascript;base64,'+Buffer.from(links.outputFiles[0].text).toString('base64'))
 assert.equal(feedbackSectionLinks('https://preview.intaprd.com','benef-shop','sponsored').qrUrl,'https://preview.intaprd.com/p/benef-shop?src=reviews-qr#resenas')
 // P1-QA1: real owner-bar destinations, never add an ordinary account selector.
 const ownerLinksBundle=await build({entryPoints:['web/src/components/appointments/kawmedOwnerShellLinks.ts'],bundle:true,format:'esm',platform:'node',write:false})
 const {otherOwnerShellLinks}=await import('data:text/javascript;base64,'+Buffer.from(ownerLinksBundle.outputFiles[0].text).toString('base64'))
 const ownerContext={mode:'preview',hostname:'preview.intaprd.com',origin:'https://app.preview.intaprd.com',ownerApiBase:'https://app.preview.intaprd.com/api/v1/me/sponsored-profile/appointments',username:'benef-shop'}
 const ordinary={is_owner:true,allow_direct_actions:true,settings_url:'/admin/sponsored',manage_url:'/admin/sponsored/agenda'}
 const plain=otherOwnerShellLinks({...ownerContext,context:ordinary})
 assert.equal(plain.settings,'https://app.preview.intaprd.com/admin/sponsored?kawvo_sponsored_shell=1&sp_tab=profile')
 assert.equal(plain.agenda,'https://app.preview.intaprd.com/admin/sponsored?kawvo_sponsored_shell=1&sp_tab=agenda')
 assert.deepEqual(otherOwnerShellLinks({...ownerContext,context:{...ordinary,settings_url:'/admin/sponsored?profile_id='+id,manage_url:'/admin/sponsored/agenda?profile_id='+id}}),plain)
 const multi={...ordinary,allow_direct_actions:false,settings_url:'/admin/sponsored?profile_id='+id,manage_url:'/admin/sponsored/agenda?profile_id='+id}
 const scoped=otherOwnerShellLinks({...ownerContext,context:multi})
 assert.equal(new URL(scoped.settings).searchParams.get('profile_id'),id)
 assert.equal(new URL(scoped.agenda).searchParams.get('profile_id'),id)
 assert.equal(otherOwnerShellLinks({...ownerContext,context:{...multi,manage_url:'/admin/sponsored/agenda?profile_id='+other}}),null)
 assert.equal(otherOwnerShellLinks({...ownerContext,context:{...ordinary,is_owner:false}}),null)
 assert.equal(otherOwnerShellLinks({...ownerContext,context:{...ordinary,action_scope:'master',settings_url:'/admin/sponsor'}}),null)
 const appointments=src('api/src/sponsored-appointments.ts')
 assert.ok(appointments.includes("settings_url:isMaster?'/admin/sponsor':multi?'/admin/sponsored?profile_id='+encodeURIComponent(subjectId):'/admin/sponsored'"))
 assert.ok(appointments.includes("resolveOwnedSponsoredProfile(c,userId,'beneficiary')"))
 assert.ok(appointments.includes("return await sponsoredMultiProfileAccess(c,userId)?'/admin/sponsored/agenda?profile_id='"))
 assert.ok(src('web/src/components/reviews/LinkReviews.tsx').includes('horizontalInset={sponsored?22:0}'))
 assert.ok(src('web/src/components/reviews/ReviewSection.tsx').includes('horizontalInset=0'))
 console.log('PASS R4-P1 sponsored default, scope, isolation, visibility, statistics, QR and owner navigation')
}finally{rmSync(dir,{recursive:true,force:true})}
