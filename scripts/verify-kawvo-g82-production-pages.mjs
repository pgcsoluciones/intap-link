// KAWVO G8.2 Free — isolated Production Pages baseline, read-only.
// Governing contract: docs/releases/KAWVO_FREE_G82_ISOLATED_PRODUCTION_CANDIDATE_2026-11-24.md
// Reuses the Wrangler whoami/OAuth refresh method of the successful G8.2 Preview runner.
// No deployment, Git mutation, Worker query, D1, R2, rollback or credential output.
// Web baseline reconciled: GitHub compare c846d0e...d93f78c shows no Web/Functions/shared/dependency delta.
// --web-only preserves the operator's prior successful App and API receipts; it does not certify QA.
import {execFileSync} from 'node:child_process'
import {existsSync,readFileSync,mkdtempSync} from 'node:fs'
import {homedir,tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'

const ACCOUNT='adf4d5ebb625fed2c32e38cef57a6319'
const SHA='d93f78c46e2d8593e82dfacdfb6e2b1266adaa7a'
const CANDIDATE='7f90382216d7c239915eb54d87be97ca33e2c23d'
const PROJECTS=[
 {commit:SHA,name:'intap-web2',id:'60c0aaa5-7f2a-4457-a144-b324ab77a58c',domain:'https://app.intaprd.com',route:'/admin/login'},
 {commit:'c846d0e5e1b9dec310f5a037bf91a400791b7267',name:'intap-link',id:'ebd884a2-405a-489b-a6ae-91151ca1ea93',domain:'https://intaprd.com',route:'/'}
]
const BASE='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/pages/projects/'
const need=(ok,msg)=>{if(!ok)throw Error('BLOCKED: '+msg)}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(x)
function auth(){
 // Deliberately reject env credentials: this operator has a working native Wrangler session.
 need(!process.env.CLOUDFLARE_API_TOKEN&&!process.env.CLOUDFLARE_API_KEY&&!process.env.CLOUDFLARE_EMAIL,'unset external Cloudflare credentials first')
 const cwd=mkdtempSync(join(tmpdir(),'kawvo-g82-whoami-'))
 let who
 try{who=execFileSync('npx',['--yes','--package=wrangler@4.166.0','--','wrangler','whoami'],{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:120000})}
 catch{throw Error('BLOCKED: native Wrangler whoami unavailable; no raw output')}
 need(who.includes(ACCOUNT),'authorized account not confirmed by Wrangler')
 const paths=['Library/Preferences/.wrangler/config/default.toml','.wrangler/config/default.toml','.config/.wrangler/config/default.toml'].map(p=>join(homedir(),p)).filter(existsSync)
 need(paths.length===1,'Wrangler OAuth source missing or ambiguous')
 const token=readFileSync(paths[0],'utf8').match(/^oauth_token\s*=\s*"([^"\r\n]+)"/m)?.[1]
 need(token,'Wrangler OAuth token missing after whoami')
 return 'Bearer '+token
}
async function get(path,authorization){
 need(/^(intap-web2|intap-link)(\/deployments\/[a-f0-9-]{36})?$/.test(path),'GET outside Pages allowlist')
 const res=await fetch(BASE+path,{method:'GET',headers:{Authorization:authorization},redirect:'error',signal:AbortSignal.timeout(30000)})
 const body=await res.json().catch(()=>null)
 need(res.ok&&body?.success===true&&body.result,'GET '+path+' HTTP '+res.status+' codes '+(body?.errors||[]).map(e=>e.code).join(','))
 return body.result
}
function identity(target,p,d){
 const origin=new URL(d?.url||'https://invalid.invalid')
 const result={project:target.name,expectedId:target.id,canonicalId:p?.canonical_deployment?.id??null,
  id:d?.id??null,environment:d?.environment??null,productionBranch:p?.production_branch??null,
  branch:d?.deployment_trigger?.metadata?.branch??null,commit:d?.deployment_trigger?.metadata?.commit_hash??null,
  status:d?.latest_stage?.status??null,usesFunctions:typeof d?.uses_functions==='boolean'?d.uses_functions:null,
  origin:origin.origin}
 const checks={project:p?.name===target.name,canonical:result.canonicalId===target.id&&result.id===target.id,
  production:result.environment==='production'&&result.productionBranch==='main'&&result.branch==='main',
  commit:result.commit===target.commit,success:result.status==='success',functions:result.usesFunctions===true,
  origin:origin.protocol==='https:'&&!origin.username&&!origin.password&&!origin.search&&!origin.hash&&origin.pathname==='/'&&origin.hostname===target.id.slice(0,8)+'.'+target.name+'.pages.dev'}
 return {...result,checks,metadataPass:Object.values(checks).every(Boolean)}
}
async function fingerprint(origin,route){
 async function bytes(path){
  const res=await fetch(origin+path,{method:'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(30000)})
  need(res.ok,'public GET '+origin+path+' HTTP '+res.status)
  const b=Buffer.from(await res.arrayBuffer())
  need(b.length<=16*1024*1024,'public asset exceeds inspection limit')
  return b
 }
 const html=await bytes(route)
 const paths=[...new Set(html.toString().match(/\/assets\/[a-zA-Z0-9_.\/-]+\.(?:js|css)/g)||[])].sort()
 need(paths.some(x=>x.endsWith('.js'))&&paths.every(x=>!x.includes('..')),'public entry assets unavailable '+origin)
 const assets={}
 for(const path of paths)assets[path]=hash(await bytes(path))
 return {htmlSha256:hash(html),entryAssets:assets}
}
async function main(webOnly=false){
 const authorization=auth()
 const rows=[]
 for(const target of PROJECTS.filter(t=>!webOnly||t.name==='intap-link')){
  const p=await get(target.name,authorization)
  const id=p?.canonical_deployment?.id
  need(uuid(id),'canonical deployment unavailable '+target.name)
  const d=await get(target.name+'/deployments/'+id,authorization)
  const row=identity(target,p,d)
  console.log(JSON.stringify({metadata:row},null,2))
  if(!row.metadataPass){rows.push({...row,publicMatch:false});continue}
  const [immutable,live]=await Promise.all([fingerprint(row.origin,target.route),fingerprint(target.domain,target.route)])
  const publicMatch=JSON.stringify(immutable)===JSON.stringify(live)
  console.log(JSON.stringify({project:target.name,immutable,live,publicMatch},null,2))
  rows.push({...row,publicMatch})
 }
 need(rows.every(r=>r.metadataPass&&r.publicMatch),'Pages metadata or served entry fingerprint differs; do not publish')
 console.log(JSON.stringify({result:webOnly?'PASS_G82_WEB_PRODUCTION_BASELINE':'PASS_G82_PAGES_PRODUCTION_BASELINE',baseline:SHA,candidate:CANDIDATE,
  pages:rows.map(r=>({project:r.project,id:r.id,usesFunctions:r.usesFunctions})),
  remoteWrites:0,scope:'Current Pages identity, retained successful canonical target and public entry fingerprints only; not full artifact or authenticated QA.'},null,2))
}
function selfTest(){
 for(const t of PROJECTS){
  const p={name:t.name,production_branch:'main',canonical_deployment:{id:t.id}}
  const d={id:t.id,environment:'production',url:'https://'+t.id.slice(0,8)+'.'+t.name+'.pages.dev',deployment_trigger:{metadata:{branch:'main',commit_hash:t.commit}},latest_stage:{status:'success'},uses_functions:true}
  assert.equal(identity(t,p,d).metadataPass,true)
  assert.equal(identity(t,p,{...d,uses_functions:null}).metadataPass,false)
  assert.equal(identity(t,p,{...d,latest_stage:{status:'idle'}}).metadataPass,false)
  assert.equal(identity(t,p,{...d,environment:'preview'}).metadataPass,false)
  assert.equal(identity(t,p,{...d,deployment_trigger:{metadata:{branch:'main',commit_hash:'d93f78c'}}}).metadataPass,false)
  assert.equal(identity(t,{...p,canonical_deployment:{id:PROJECTS.find(x=>x!==t).id}},d).metadataPass,false)
 }
 console.log('PASS_G82_PAGES_READBACK_SELFTEST')
}
try{
 if(process.argv[2]==='--self-test')selfTest()
 else {need(['--read-only','--web-only'].includes(process.argv[2]),'explicit --read-only or --web-only required');await main(process.argv[2]==='--web-only')}
}catch(e){console.error(e?.message?.startsWith('BLOCKED:')?e.message:'BLOCKED: local/remote readback failed; raw details withheld');process.exitCode=1}
