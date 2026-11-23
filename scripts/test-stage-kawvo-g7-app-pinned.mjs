import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,statSync,symlinkSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {tmpdir} from 'node:os'
import {pathToFileURL} from 'node:url'
import {ACTIVE,API_STAGE,APP_STAGE_BRANCH,CANDIDATE,appContext,publishAppStage,stageApp} from './stage-kawvo-g7-api-pinned.mjs'

const sha=x=>createHash('sha256').update(x).digest('hex'),reader=mkdtempSync(join(tmpdir(),'g7-app-reader-'))
for(const name of ['kawmed-g3-1-pages.mjs','run-kawmed-g3-1-stage-preview-2026-11-16.sh'])writeFileSync(join(reader,name),execFileSync('git',['show','fefa9180edd3c13f4548b835d2436b72eb2b96b6:scripts/'+name]))
const {Runner,manifest,owner}=await import(pathToFileURL(join(reader,'kawmed-g3-1-pages.mjs')).href)
const url='https://abcdef12.intap-web2.pages.dev',alias='https://qa-kawvo-g7-1-e9b1aa11189f.intap-web2.pages.dev'
const activeAlias='https://qa-kawmed-guest-current-2026.intap-web2.pages.dev'
const baseline={workers:{'intap-api-preview':{version:ACTIVE,bindingsSha256:'fixture-preview-bindings'},'intap-api':{version:'fixture-production-version'}},protectedSurfaces:{appProduction:{fixture:'unchanged'},webProduction:{fixture:'unchanged'},webPreview:{fixture:'unchanged'}},productionBranches:{app:'main',web:'main'},appPreview:{alias:activeAlias,deployment:{id:'old',branch:'qa-kawmed-guest-current-2026-11-02',aliases:[activeAlias]},fingerprints:{fixture:'approved-G5'}}}
const put=(base,name,value)=>{const file=join(base,name);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,value)}
for(const mode of ['success','wrong-sha','wrong-branch','production','alias-active','alias-ambiguous','remote-bytes','missing-functions-upload','upload-error','protected-drift','worker-drift','branch-collision','artifact-change','context-change','context-addition','functions-bundle-change','prior-preflight']){
 const directory=mkdtempSync(join(tmpdir(),'g7-app-stage-fixture-')),source=join(directory,'source'),dist=join(source,'app/dist')
 for(const [name,value] of Object.entries({'app/dist/index.html':'<script type="module" src="/assets/index-fixture.js"></script><link rel="stylesheet" href="/assets/index-fixture.css">','app/dist/assets/index-fixture.js':'import "./chunk-fixture.js"; export const fixture=true','app/dist/assets/chunk-fixture.js':'export const chunk=true','app/dist/assets/index-fixture.css':'body{margin:0}','app/dist/_headers':'/*\n X-Content-Type-Options: nosniff','app/dist/_redirects':'/* /index.html 200','functions/_middleware.ts':'export const onRequest=({next})=>next()','shared/fixture.ts':'export const fixture=true','package.json':'{}','package-lock.json':'{}','app/package.json':'{}'}))put(source,name,value)
 put(directory,'app-functions.bundle','compiled functions fixture');put(directory,'app-functions-routes.json','{"include":["/*"],"exclude":[]}')
 const prepared={candidate:CANDIDATE,files:manifest(dist),context:appContext(source),functionsSourceTree:'fixture-tree',functionsSha256:sha(readFileSync(join(directory,'app-functions.bundle'))),routesSha256:sha(readFileSync(join(directory,'app-functions-routes.json')))}
 put(directory,'prepared.json',JSON.stringify(prepared));const preparedTime=statSync(join(directory,'prepared.json')).mtimeMs
 let uploads=0,snapshots=0,compares=0
 const client={wrangler:'fixture-existing-wrangler',
  async snapshot(path){snapshots++;mkdirSync(path);const state=structuredClone(baseline);if(mode==='protected-drift'&&snapshots===2)state.protectedSurfaces.webPreview.fixture='changed';if(mode==='worker-drift')state.workers['intap-api-preview'].version='changed';if(mode==='branch-collision')state.appPreview.deployment.branch=APP_STAGE_BRANCH;return state},
  assertSame:Runner.prototype.assertSame,
  command(binary,args,cwd,log){uploads++;assert.equal(binary,this.wrangler);assert.deepEqual(args,['pages','deploy','app/dist','--project-name','intap-web2','--branch',APP_STAGE_BRANCH,'--commit-hash',CANDIDATE,'--commit-dirty=false']);assert.equal(cwd,source);assert.ok(existsSync(join(cwd,'functions/_middleware.ts')));if(mode==='upload-error')throw Error('fixture ambiguous upload failure');const output=(mode==='missing-functions-upload'?'':'Uploading Functions bundle\n')+url;writeFileSync(log,output);return output},
  retry:async fn=>fn(),
  async resolveOrigin(origin,project){assert.equal(origin,url);assert.equal(project,'intap-web2');return {id:'fixture-stage-id',url,environment:mode==='production'?'production':'preview',latest_stage:{status:'success'},deployment_trigger:{metadata:{branch:mode==='wrong-branch'?'wrong':APP_STAGE_BRANCH,commit_hash:mode==='wrong-sha'?'0'.repeat(40):CANDIDATE}},aliases:mode==='alias-active'?[activeAlias]:mode==='alias-ambiguous'?[alias,'https://another.intap-web2.pages.dev']:[alias]}},
  async bytes(request){const origin=new URL(request).origin,name=new URL(request).pathname;assert.ok([url,alias].includes(origin));return mode==='remote-bytes'&&name.endsWith('.js')?Buffer.from('wrong bytes'):readFileSync(join(dist,name==='/admin/login'?'index.html':name))},
  async compareArtifact(...args){compares++;return Runner.prototype.compareArtifact.apply(this,args)}
 }
 if(mode==='artifact-change')put(source,'app/dist/assets/index-fixture.js','changed')
 if(mode==='context-change')put(source,'functions/_middleware.ts','changed')
 if(mode==='context-addition')put(source,'functions/new.ts','unexpected function')
 if(mode==='functions-bundle-change')put(directory,'app-functions.bundle','changed')
 if(mode==='prior-preflight')mkdirSync(join(directory,'before'))
 const compiledTime=statSync(join(directory,'app-functions.bundle')).mtimeMs
 if(mode==='success'){
  const receipt=await publishAppStage({directory,source,client,manifest,owner});assert.equal(receipt.result,'PASS');assert.equal(receipt.apiStage,API_STAGE);assert.equal(receipt.protectedSurfacesUnchanged,true);assert.equal(receipt.functionsRemoteBinaryEquality,false);assert.equal(receipt.deployment.url,url);assert.equal(receipt.deployment.alias,alias);assert.equal(compares,2)
 }else{await assert.rejects(()=>publishAppStage({directory,source,client,manifest,owner}));assert.ok(!existsSync(join(directory,'stage-pass.json')))}
 const beforeUpload=['worker-drift','branch-collision','artifact-change','context-change','context-addition','functions-bundle-change','prior-preflight'].includes(mode)
 assert.equal(uploads,beforeUpload?0:1)
 if(uploads){assert.equal(snapshots,2,'Protected surfaces checked after failed/successful upload');await assert.rejects(()=>publishAppStage({directory,source,client,manifest,owner}),/intento Stage App/);assert.equal(uploads,1,'Never retry a previous/ambiguous upload')}
 assert.equal(statSync(join(directory,'prepared.json')).mtimeMs,preparedTime);assert.equal(statSync(join(directory,'app-functions.bundle')).mtimeMs,compiledTime)
 console.log('PASS simulated Stage App: '+mode+'; exact SHA/project/root Functions; no actual HTTP/upload')
}
// App must require the existing API PASS locally, never rerun its upload/reads.
const missing=mkdtempSync(join(tmpdir(),'g7-app-missing-receipt-'))
await assert.rejects(()=>stageApp({snapshot:join(missing,'active-version.private.json')}),/ENOENT/)
put(missing,'stage-api-'+CANDIDATE.slice(0,12)+'/stage-pass.json',JSON.stringify({result:'PASS',candidate:'wrong'}))
await assert.rejects(()=>stageApp({snapshot:join(missing,'active-version.private.json')}),/recibo Stage API no coincide/)
console.log('PASS API receipt required locally; Stage API is never rerun by App')

// Validate the canonical Functions command against exact candidate source and existing toolchain.
// Reuse the previously compiled App bytes; do not rerun functional builds/CI.
const root=process.env.G7_TEST_SOURCE_ROOT||process.cwd(),local=mkdtempSync(join(tmpdir(),'g7-app-functions-local-')),source=join(local,'source');mkdirSync(source)
execFileSync('tar',['-x','-C',source],{input:execFileSync('git',['archive',CANDIDATE,'functions','shared','package.json','package-lock.json','app/package.json'],{cwd:root}),stdio:['pipe','pipe','pipe']})
symlinkSync(join(root,'node_modules'),join(source,'node_modules'),'dir')
execFileSync('cp',['-R',join(root,'app/dist'),join(source,'app/dist')])
const output=execFileSync(join(root,'node_modules/.bin/wrangler'),['pages','functions','build','functions','--outfile',join(local,'app-functions.bundle'),'--output-routes-path',join(local,'app-functions-routes.json'),'--build-output-directory','app/dist'],{cwd:source,encoding:'utf8',stdio:['ignore','pipe','pipe'],env:{...process.env,WRANGLER_SEND_METRICS:'false',WRANGLER_LOG_PATH:join(local,'wrangler.private.log')}})
writeFileSync(join(local,'functions-build.private.log'),output)
assert.ok(statSync(join(local,'app-functions.bundle')).size>1000);assert.ok(JSON.parse(readFileSync(join(local,'app-functions-routes.json'))).include.length>0)
console.log('PASS local Functions compilation from exact candidate, installed Wrangler; existing App artifact reused; no Cloudflare deployment. Evidence: '+local)
