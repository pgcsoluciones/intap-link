// G7.2-A: executable contract tests, synthetic contexts and read-only DB (no Cloudflare/D1).
import assert from 'node:assert/strict'
import {test} from 'node:test'
import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {build} from 'esbuild'

const file=resolve('api/src/sponsor-commercial-pages.ts')
const source=readFileSync(file,'utf8')
const compiled=await build({
 stdin:{contents:source,resolveDir:resolve('api/src'),sourcefile:'sponsor-commercial-pages.ts',loader:'ts'},
 bundle:true,write:false,platform:'node',format:'esm',
 plugins:[{name:'fake-auth-context',setup(b){
  b.onResolve({filter:/^\.\/(?:intap-active-account|sponsored-multiprofile-access)$/},a=>({path:a.path,namespace:'fixture'}))
  b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path.includes('intap-active-account')
   ?'export async function readIntapSelection(c){return c.selection};export function matchesActiveIntapTab(c,s){return s.tabToken===c.tabToken}'
   :'export async function sponsoredMultiProfileAccess(c){return Boolean(c.multi)}',loader:'js'}))
 }}]
})
const {commercialPage,registerSponsorCommercialPages}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].contents).toString('base64'))
const tenant='tenant-a',other='tenant-b'
const auth=async c=>c.identity===false?null:{userId:'user-a',sponsorId:tenant}
function ctx(resource='sellers',query='',overrides={}){
 const statements=[],c={
  req:{url:'https://app.preview.intaprd.com/api/v1/sponsor/commercial/'+resource+'/page'+query},
  env:{ENVIRONMENT:'preview',DB:{
   prepare(sql){
    assert.match(sql,/^\s*SELECT\b/i,'read-only SQL')
    const record={sql,args:[]};statements.push(record)
    return{bind(...args){record.args=args;return this},async first(){return {n:11}},async all(){return{success:true,results:Array.from({length:10},(_,i)=>({id:'a-'+i}))}}}
   },
   batch(){throw Error('Write attempted')}
  }},
  headers:{},header(k,v){this.headers[k]=v},json(data,status=200){return{status,data}}
 }
 Object.assign(c,overrides)
 return {c,statements}
}
test('read-only bounded seller page; SQL scope, deterministic ordering and limit',async()=>{
 const {c,statements}=ctx('sellers','?page=2&limit=10&q=Ana&state=active')
 const r=await commercialPage(c,'sellers',auth)
 assert.equal(r.status,200);assert.equal(r.data.data.version,'g7.2-a')
 assert.equal(r.data.data.page,2);assert.equal(r.data.data.has_previous,true)
 assert.equal(statements.length,2)
 for(const st of statements)assert.equal(st.args[0],tenant)
 assert.match(statements[1].sql,/ORDER BY r.active DESC.*r.id ASC LIMIT \? OFFSET \?/)
 assert.deepEqual(statements[1].args.slice(-2),[10,10])
 assert.equal(c.headers['Cache-Control'],'no-store')
})
test('assignments use sponsored tenant joins and bounded ordering',async()=>{
 const {c,statements}=ctx('assignments','?limit=25&state=inactive')
 const r=await commercialPage(c,'assignments',auth)
 assert.equal(r.status,200)
 assert.match(statements[1].sql,/sa.sponsor_id=a.sponsor_id/)
 assert.match(statements[1].sql,/r.sponsor_id=a.sponsor_id/)
 assert.match(statements[1].sql,/a.assigned_at DESC,a.id DESC/)
 assert.deepEqual(statements[1].args.slice(-2),[25,0])
})
test('forbidden identity, invalid params and stale tabs block before list SQL',async()=>{
 for(const query of ['?limit=250','?page=0','?page=10000','?state=lost','?q=a&q=b','?cursor=invalid']){
  const {c}=ctx('sellers',query);assert.equal((await commercialPage(c,'sellers',auth)).status,400,query)
 }
 let x=ctx('sellers','',{identity:false})
 assert.equal((await commercialPage(x.c,'sellers',auth)).status,403)
 x=ctx('sellers','',{multi:true,selection:{kind:'sponsor',id:other,tabToken:'a'},tabToken:'a'})
 assert.equal((await commercialPage(x.c,'sellers',auth)).status,403)
 x=ctx('sellers','',{multi:true,selection:{kind:'sponsor',id:tenant,tabToken:'a'},tabToken:'b'})
 assert.equal((await commercialPage(x.c,'sellers',auth)).status,409)
 assert.equal(x.statements.length,0)
})
test('Preview-only route registrations cannot be enabled in production',async()=>{
 const routes=[]
 registerSponsorCommercialPages({get(path,...handlers){routes.push({path,handlers})}},auth)
 assert.deepEqual(routes.map(x=>x.path),[
 '/api/v1/sponsor/commercial/sellers/page',
 '/api/v1/sponsor/commercial/assignments/page'
 ])
 let next=0
 const {c}=ctx()
 c.env.ENVIRONMENT='production'
 const result=await routes[0].handlers[0](c,()=>{next++})
 assert.equal(result.status,404);assert.equal(next,0)
 c.env.ENVIRONMENT='preview'
 await routes[0].handlers[0](c,()=>{next++})
 assert.equal(next,1)
})
