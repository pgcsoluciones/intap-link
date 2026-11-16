// Read-only: no deploy, rollback, resource modification or secret output.
import {execFileSync} from 'node:child_process'
import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs'
import {homedir} from 'node:os'
import {join} from 'node:path'
const OLD='3d4973e4-e344-493a-a065-93f199b00359'
const NEW='1972228c-4dd7-4ede-9d94-8338132b3b20'
const PREVIEW='23405a5b-e9ca-4247-843d-28cc4f236eaa'
const run=(...args)=>JSON.parse(execFileSync('npx',['--no-install','wrangler',...args,'--json'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:16*1024*1024}))
const sort=x=>Array.isArray(x)?x.map(sort):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,sort(x[k])])):x
const equal=(a,b)=>JSON.stringify(sort(a))===JSON.stringify(sort(b))
const root=join(homedir(),'intap-release-logs')
mkdirSync(root,{recursive:true})
const log=mkdtempSync(join(root,'kawvo-worker-recovery-'))
const report={operation:'READ ONLY',errors:[]}
try{
 const active=(name,expected)=>{
  const d=run('deployments','status','--name',name)
  if(!Array.isArray(d.versions)||d.versions.length!==1||d.versions[0].version_id!==expected||Number(d.versions[0].percentage)!==100)throw Error('Versión activa inesperada: '+name)
  return {name,deployment_id:d.id,version:expected,percentage:100,created_on:d.created_on}
 }
 report.production=active('intap-api',NEW);report.preview=active('intap-api-preview',PREVIEW)
 const get=id=>{
  const v=run('versions','view',id,'--name','intap-api')
  if(v.id!==id||!v.resources||!Array.isArray(v.resources.bindings)||!v.resources.script||!v.resources.script_runtime)throw Error('Metadata de versión incompleta: '+id)
  const bs=v.resources.bindings
  if(bs.some(x=>typeof x.name!=='string'||typeof x.type!=='string')||new Set(bs.map(x=>x.name)).size!==bs.length)throw Error('Bindings no verificables')
  return v.resources
 }
 const a=get(OLD),b=get(NEW)
 const prior=new Map(a.bindings.map(x=>[x.name,x])),now=new Map(b.bindings.map(x=>[x.name,x]))
 report.versions={original:OLD,current:NEW}
 report.binding_counts={original:prior.size,current:now.size}
 report.bindings={
  added:[...now.keys()].filter(k=>!prior.has(k)).map(k=>({name:k,type:now.get(k).type})),
  removed:[...prior.keys()].filter(k=>!now.has(k)).map(k=>({name:k,type:prior.get(k).type})),
  changed:[...prior.keys()].filter(k=>now.has(k)&&!equal(prior.get(k),now.get(k))).map(k=>({name:k,original_type:prior.get(k).type,current_type:now.get(k).type,changed_fields:[...new Set([...Object.keys(prior.get(k)),...Object.keys(now.get(k))])].filter(f=>!equal(prior.get(k)[f],now.get(k)[f])).sort()})),
  resource_bindings:[...new Set([...prior.keys(),...now.keys()])].filter(k=>[prior.get(k),now.get(k)].some(x=>x&&['d1','r2_bucket','kv_namespace','durable_object_namespace','queue','service'].includes(x.type))).map(k=>({name:k,original_type:prior.get(k)?.type??null,current_type:now.get(k)?.type??null,metadata_equal:equal(prior.get(k),now.get(k))})),
  secret_names_only:[...new Set([...prior.keys(),...now.keys()])].filter(k=>[prior.get(k),now.get(k)].some(x=>x&&/secret/.test(x.type))).map(k=>({name:k,original_type:prior.get(k)?.type??null,current_type:now.get(k)?.type??null}))
 }
 report.runtime={equal:equal(a.script_runtime,b.script_runtime),changed_fields:[...new Set([...Object.keys(a.script_runtime),...Object.keys(b.script_runtime)])].filter(k=>!equal(a.script_runtime[k],b.script_runtime[k])).sort()}
 report.script={etag_equal:typeof a.script.etag==='string'&&typeof b.script.etag==='string'?a.script.etag===b.script.etag:null,handlers_equal:equal(a.script.handlers,b.script.handlers)&&equal(a.script.named_handlers,b.script.named_handlers)}
 // Confirm no concurrent change while auditing.
 active('intap-api',NEW);active('intap-api-preview',PREVIEW)
 report.note='Metadata only; does not establish unchanged D1/R2 contents, secret values or account-level triggers/routes. No rollback authorization implied.'
}catch(e){report.errors.push(String(e.message||e).split('\n')[0].slice(0,180));process.exitCode=1}
const file=join(log,'report.json')
writeFileSync(file,JSON.stringify(report,null,2)+'\n',{mode:0o600})
console.log('REPORTE: '+file+'\n'+JSON.stringify(report,null,2))
console.log('SIN CAMBIOS: solo lectura')
