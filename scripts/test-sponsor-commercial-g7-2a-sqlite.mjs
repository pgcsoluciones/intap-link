// G7.2-A real SQLite and full Hono route test. Private disposable fixture, no D1/Cloudflare writes.
import assert from 'node:assert/strict'
import {test} from 'node:test'
import {execFileSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
import {inventoryFixture,TENANT_A,TENANT_B} from './test-sponsor-inventory-g7-contract.mjs'

const f=await inventoryFixture(1001)
// Local fixture copy of historical 0153 schema. The archived test checkout has no .git.
const migration=String.raw`
CREATE TABLE sponsor_sales_representatives (
 id TEXT PRIMARY KEY, sponsor_id TEXT NOT NULL REFERENCES sponsor_tenants(id),
 employee_code TEXT, first_name TEXT NOT NULL, last_name TEXT NOT NULL DEFAULT '',
 whatsapp TEXT NOT NULL, email TEXT, zone TEXT, territory TEXT,
 active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')),
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE sponsor_sales_assignments (
 id TEXT PRIMARY KEY, sponsor_id TEXT NOT NULL REFERENCES sponsor_tenants(id),
 artifact_id TEXT NOT NULL REFERENCES intap_artifacts(id),
 representative_id TEXT NOT NULL REFERENCES sponsor_sales_representatives(id),
 group_label TEXT, assigned_by_user_id TEXT,
 assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
 ended_at TEXT, active INTEGER NOT NULL DEFAULT 1
);
`
execFileSync('python3',['-c','import sqlite3,sys; con=sqlite3.connect(sys.argv[1]);con.executescript(sys.stdin.read());con.commit()',f.path],{input:migration})
execFileSync('python3',['-c',String.raw`
import sqlite3,sys
p,a,b=sys.argv[1:4]
con=sqlite3.connect(p)
for tenant in [a,b]:
 con.execute("INSERT INTO sponsor_module_grants(sponsor_id,module_code,enabled) VALUES(?,'commercial_seller',1)",(tenant,))
 tag=tenant[0]
 count=1001 if tag=='a' else 11
 reps=[];assignments=[]
 for n in range(count):
  rep=f"rep-{tag}-{n:05d}"
  reps.append((rep,tenant,'Árbol' if n==0 else f'Nombre {n}','Apellido','18095550100','Zona'))
  assignments.append((f'assignment-{tag}-{n}',tenant,f'{tag}-artifact-{n:06d}',rep,f'Grupo {n}'))
 con.executemany('INSERT INTO sponsor_sales_representatives(id,sponsor_id,first_name,last_name,whatsapp,zone) VALUES(?,?,?,?,?,?)',reps)
 con.executemany('INSERT INTO sponsor_sales_assignments(id,sponsor_id,artifact_id,representative_id,group_label) VALUES(?,?,?,?,?)',assignments)
con.commit()
`,f.path,TENANT_A,TENANT_B])
const {default:app}=await import(new URL('file://'+f.dir+'/api.mjs'))
const dbSql=[]
const DB={
 prepare(sql){
  assert.match(sql.trim(),/^SELECT\b/i,'G7.2-A query must be read-only')
  let args=[]
  return{
   bind(...a){args=a;return this},
   async first(){dbSql.push({sql,args});return JSON.parse(execFileSync('python3',['scripts/lib/sponsor-inventory-g7-sqlite.py',f.path,'read',JSON.stringify([sql,args])],{encoding:'utf8'}))[0]||null},
   async all(){dbSql.push({sql,args});return{success:true,results:JSON.parse(execFileSync('python3',['scripts/lib/sponsor-inventory-g7-sqlite.py',f.path,'read',JSON.stringify([sql,args])],{encoding:'utf8'}))}}
  }
 },
 batch(){throw Error('Unexpected mutation')}
}
async function request(path,{actor='normal',environment='preview',tenant=TENANT_A,kind='sponsor',token='a'.repeat(32),sentToken=token}={}){
 const raw='fixture-'+actor
 const {createHash}=await import('node:crypto')
 const fingerprint=createHash('sha256').update(raw).digest('hex').slice(0,24)
 const cookie='intap_preview_session_id='+raw+(actor==='operator'?'; kawvo_intap_active_account_v1='+encodeURIComponent(kind+':'+tenant+':'+fingerprint+':'+token):'')
 const r=await app.fetch(new Request('https://app.preview.intaprd.com/api/v1/sponsor/commercial/'+path,{
  headers:{Cookie:cookie,'X-Intap-Account-Tab':sentToken}}),{ENVIRONMENT:environment,DB},{waitUntil(){throw Error('Unexpected async mutation')}})
 return{status:r.status,body:await r.json()}
}
test('full Hono, real SQLite: 1001 sellers, pages 10, total and no accidental tenant B',async()=>{
 const first=await request('sellers/page?limit=10')
 assert.equal(first.status,200,JSON.stringify(first.body))
 assert.equal(first.body.data.total,1001)
 assert.equal(first.body.data.items.length,10)
 assert.equal(first.body.data.has_more,true)
 const second=await request('sellers/page?page=2&limit=10')
 assert.equal(second.status,200)
 assert.equal(second.body.data.items.length,10)
 assert.notEqual(first.body.data.items[0].id,second.body.data.items[0].id)
 assert.ok(first.body.data.items.every(x=>x.id.startsWith('rep-a-')))
})
test('assignments: 1001 total, joined sponsor scope, status, page',async()=>{
 const result=await request('assignments/page?limit=25&state=active&page=2')
 assert.equal(result.status,200,JSON.stringify(result.body))
 assert.equal(result.body.data.total,1001)
 assert.equal(result.body.data.items.length,25)
 assert.ok(result.body.data.items.every(x=>x.id.startsWith('assignment-a-')))
})
test('no match, reset and forbidden roles',async()=>{
 let r=await request('sellers/page?q=not-a-real-person')
 assert.equal(r.status,200);assert.equal(r.body.data.total,0)
 r=await request('sellers/page?page=999')
 assert.equal(r.status,200);assert.equal(r.body.data.reset_required,true)
 for(const actor of ['viewer','outsider']){
  r=await request('sellers/page',{actor});assert.equal(r.status,403)
 }
 r=await request('sellers/page',{actor:'operator',tenant:TENANT_B,sentToken:'b'.repeat(32)})
 assert.equal(r.status,409)
 r=await request('sellers/page',{environment:'production'})
 assert.equal(r.status,404)
})
test('search case/accents and only SELECT',async()=>{
 const r=await request('sellers/page?q=arbol')
 assert.equal(r.status,200)
 // Deliberately require accent-insensitive match, as in the G7.1 search contract.
 assert.equal(r.body.data.total,1)
 assert.ok(dbSql.every(x=>/^\s*SELECT\b/i.test(x.sql)))
})
