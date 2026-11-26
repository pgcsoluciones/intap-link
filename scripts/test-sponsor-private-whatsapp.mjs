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
CREATE TABLE sponsor_tenants(id TEXT PRIMARY KEY,name TEXT,whatsapp_message_template TEXT);
INSERT INTO sponsor_tenants VALUES('a','Ferretería A','Mensaje público A'),('b','Ferretería B','Mensaje público B');
CREATE TABLE sponsor_module_grants(sponsor_id TEXT,module_code TEXT,enabled INTEGER);
INSERT INTO sponsor_module_grants VALUES('a','commercial_seller',1),('b','commercial_seller',1);
CREATE TABLE sponsor_sales_representatives(id TEXT PRIMARY KEY,sponsor_id TEXT,first_name TEXT,last_name TEXT,whatsapp TEXT,active INTEGER);
INSERT INTO sponsor_sales_representatives VALUES('ra','a','Carlos','Pérez','809-555-0100',1),('rb','b','Ana','López','+1 829 555 0100',1);
CREATE TABLE sponsor_artifacts(artifact_id TEXT PRIMARY KEY,sponsor_id TEXT);
INSERT INTO sponsor_artifacts VALUES('aa','a'),('bb','b');
CREATE TABLE sponsor_sales_assignments(sponsor_id TEXT,artifact_id TEXT,representative_id TEXT,active INTEGER,assigned_at TEXT);
INSERT INTO sponsor_sales_assignments VALUES('a','aa','ra',1,'2026-01-01'),('b','bb','rb',1,'2026-01-01');
CREATE TABLE sponsor_commercial_resources(sponsor_id TEXT PRIMARY KEY,resource_url TEXT,resource_label TEXT);
`
try{
 execute([{script:fixture},{script:readFileSync(new URL('../docs/releases/kawvo-sponsor-contact-proposed-migrations/contact-message.sql',import.meta.url),'utf8')}])
 const built=await build({entryPoints:['api/src/sponsored-commercial-links-core.ts','api/src/sponsor-commercial-message-settings.ts'],bundle:true,format:'esm',platform:'node',write:false,outdir:'out'})
 const load=async n=>import('data:text/javascript;base64,'+Buffer.from(built.outputFiles.find(x=>x.path.endsWith('/'+n+'.js')).text).toString('base64'))
 const {resolveSponsoredCommercialLinks}=await load('sponsored-commercial-links-core')
 const {registerSponsorMessageSettings}=await load('sponsor-commercial-message-settings')
 class Statement{
  constructor(sql,args=[]){this.sql=sql;this.args=args}
  bind(...args){return new Statement(this.sql,args)}
  async first(){return execute([{sql:this.sql,args:this.args,mode:'first'}])[0]}
  async all(){return execute([{sql:this.sql,args:this.args,mode:'all'}])[0]}
  async run(){return execute([{sql:this.sql,args:this.args,mode:'run'}])[0]}
 }
 const db={prepare:sql=>new Statement(sql),batch:async statements=>execute(statements.map(s=>({sql:s.sql,args:s.args,mode:'run'})))}
 const handlers=new Map()
 const router={get:(p,h)=>handlers.set('GET '+p,h),patch:(p,h)=>handlers.set('PATCH '+p,h)}
 registerSponsorMessageSettings(router,async c=>c.ctx)
 const path='/api/v1/sponsor/commercial/contact-message'
 const request=(method,ctx,body)=>handlers.get(method+' '+path)({ctx,env:{DB:db},req:{json:async()=>body},header:()=>{},json:(data,status=200)=>({data,status})})
 const owner={userId:'owner-a',sponsorId:'a'},other={userId:'owner-b',sponsorId:'b'}
 const subject={sponsor_id:'a',artifact_id:'aa',profile_role:'beneficiary',business_name:'Mi Negocio'}
 const subjectB={...subject,sponsor_id:'b',artifact_id:'bb'}
 const url=async s=>new URL((await resolveSponsoredCommercialLinks(db,s)).contact_url)
 const initial=await url(subject)
 assert.equal(initial.pathname,'/18095550100')
 assert.match(initial.searchParams.get('text'),/Carlos Pérez.*Mi Negocio.*Ferretería A/)
 assert.equal((await request('GET',null)).status,403)
 const template='Hola {vendedor}, soy {negocio}. ¿Me ayudas con {patrocinador}?'
 assert.equal((await request('PATCH',null,{sponsor_id:'a',message_template:template})).status,403)
 assert.equal((await request('PATCH',other,{sponsor_id:'a',message_template:template})).status,403)
 assert.equal((await request('PATCH',owner,{sponsor_id:'a',message_template:'{desconocida}'})).status,422)
 assert.equal((await request('PATCH',owner,{sponsor_id:'a',message_template:'x'.repeat(401)})).status,422)
 assert.equal((await request('PATCH',owner,{sponsor_id:'a',message_template:template,contact_whatsapp:'123'})).status,403)
 assert.equal((await request('PATCH',owner,{sponsor_id:'a',message_template:template})).status,200)
 assert.equal((await request('GET',owner)).data.data.message_template,template)
 assert.equal((await url(subject)).searchParams.get('text'),'Hola Carlos Pérez, soy Mi Negocio. ¿Me ayudas con Ferretería A?')
 assert.match((await url(subjectB)).searchParams.get('text'),/Ana López.*Ferretería B/)
 assert.equal(query('SELECT whatsapp_message_template FROM sponsor_tenants WHERE id=?',['a'])[0].whatsapp_message_template,'Mensaje público A')
 assert.equal((await resolveSponsoredCommercialLinks(db,{...subject,profile_role:'sponsor_owner'})).contact_url,'')
 assert.equal((await resolveSponsoredCommercialLinks(db,{...subject,artifact_id:'bb'})).contact_url,'')
 run("UPDATE sponsor_sales_representatives SET active=0 WHERE id='ra'")
 assert.equal((await resolveSponsoredCommercialLinks(db,subject)).contact_url,'')
 run("UPDATE sponsor_sales_representatives SET active=1 WHERE id='ra'")
 run("UPDATE sponsor_module_grants SET enabled=0 WHERE sponsor_id='a'")
 assert.equal((await resolveSponsoredCommercialLinks(db,subject)).contact_url,'')
 const sales=readFileSync(new URL('../api/src/sponsor-commercial-sales.ts',import.meta.url),'utf8')
 assert.match(sales,/registerSponsorMessageSettings\(app,authorized\)/)
 assert.match(sales,/resolveSponsorMembership\(c,userId\)/)
 assert.match(sales,/\['owner','admin'\]/)
 const editor=readFileSync(new URL('../app/src/components/admin/sponsored/SponsorContactMessage.tsx',import.meta.url),'utf8')
 assert.match(editor,/text-base/)
 assert.match(editor,/w-full min-w-0/)
 console.log('PASS private commercial template: defaults, persistence, tenant isolation, invalid input, assigned representative, Dominican phone, public banner unchanged')
}finally{rmSync(dir,{recursive:true,force:true})}
