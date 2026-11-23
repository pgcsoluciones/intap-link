// G7.1 launch search: reproducible Cloudflare Preview promotion. No Production changes.
// Usage: node scripts/promote-kawmed-g7-1-search-preview.mjs --check | --apply | --rollback
import {execFileSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,writeFileSync,symlinkSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {homedir} from 'node:os';
import {createHash} from 'node:crypto';

const SHA='f42bccf2b8248b61603090a97ab56c9258400b58';
const ACCOUNT='adf4d5ebb625fed2c32e38cef57a6319';
const WORKER='intap-api-preview',PROJECT='intap-web2',BRANCH='kawmed-g7-1-search-full-qa';
const OLD='/assets/index-BWOJsn1t.js',NEW='/assets/index-D25-Z3tL.js';
const ROOT=resolve(process.cwd()), WRANGLER=join(ROOT,'node_modules/.bin/wrangler');
const DIR=join(homedir(),'intap-release-logs','g7-1-search-shared-'+SHA.slice(0,12));
const BASE='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT;
const check=(condition,message)=>{if(!condition)throw Error('BLOCKED: '+message)};
const save=(file,value)=>writeFileSync(file,JSON.stringify(value,null,2),{flag:'wx',mode:0o600});
const read=file=>JSON.parse(readFileSync(file,'utf8'));
const cmd=(bin,args,cwd=ROOT)=>execFileSync(bin,args,{cwd,encoding:'utf8',maxBuffer:20*1024*1024,stdio:['ignore','pipe','pipe']});
const git=(...args)=>cmd('git',args).trim();
const canon=x=>JSON.stringify(x);
const digest=x=>createHash('sha256').update(Buffer.from(x,'base64')).digest('hex');
const isOrigin=value=>{try{const u=new URL(value);return u.protocol==='https:'&&u.hostname.endsWith('.intap-web2.pages.dev')&&!u.search&&!u.hash&&!u.username}catch{return false}};

function auth(){
 if(process.env.CLOUDFLARE_API_TOKEN)return 'Bearer '+process.env.CLOUDFLARE_API_TOKEN;
 cmd(WRANGLER,['whoami']); // refresh existing Wrangler OAuth session
 const files=['Library/Preferences/.wrangler/config/default.toml','.wrangler/config/default.toml','.config/.wrangler/config/default.toml'].map(x=>join(homedir(),x)).filter(existsSync);
 check(files.length===1,'Wrangler session missing or ambiguous; no credentials requested');
 const token=readFileSync(files[0],'utf8').match(/^oauth_token\s*=\s*"([^"\r\n]+)"/m)?.[1];
 check(token,'Wrangler OAuth token unavailable');
 return 'Bearer '+token;
}
async function api(method,path,authorization,payload){
 const headers={Authorization:authorization};
 if(payload!==undefined)headers['Content-Type']='application/json';
 const res=await fetch(BASE+path,{method,headers,body:payload===undefined?undefined:JSON.stringify(payload),signal:AbortSignal.timeout(30000),redirect:'error'});
 const json=await res.json().catch(()=>null);
 check(res.ok&&json?.success===true,method+' '+path+' HTTP '+res.status+' errors '+JSON.stringify((json?.errors||[]).map(e=>e.code)));
 return json.result;
}
async function state(authorization){
 const deployment=await api('GET','/workers/scripts/'+WORKER+'/deployments',authorization);
 const versions=deployment?.deployments?.[0]?.versions;
 check(versions?.length===1&&Number(versions[0].percentage)===100,'Preview Worker traffic is not 100% single-version');
 const id=versions[0].version_id;
 const full=await api('GET','/workers/workers/'+WORKER+'/versions/'+id+'?include=modules',authorization);
 check(full?.id===id&&full.bindings?.length===35&&full.modules?.length===1,'Preview Worker 35-binding / 1-module contract changed');
 check(new Set(full.bindings.map(b=>b.name)).size===35,'duplicate bindings');
 check(full.modules[0].name===full.main_module&&full.modules[0].content_base64,'active Worker modules not readable');
 check(full.bindings.some(b=>b.name==='ENVIRONMENT'&&b.text==='preview'),'not Preview');
 check(full.bindings.some(b=>b.name==='DB'&&b.type==='d1')&&full.bindings.some(b=>b.name==='BUCKET'&&b.type==='r2_bucket'),'D1/R2 missing');
 const binding=full.bindings.find(b=>b.name==='APP_PAGES_ORIGIN');
 check(binding?.type==='plain_text'&&isOrigin(binding.text),'unexpected APP_PAGES_ORIGIN');
 return {id,full,origin:binding.text};
}
async function appBundle(url){
 const response=await fetch(url+'/admin/login?releasecheck='+Date.now(),{signal:AbortSignal.timeout(25000)});
 check(response.ok,'App did not serve login HTML: '+url);
 return (await response.text()).match(/\/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0]||null;
}
function verifyChangedOnlyOrigin(before,after,target){
 for(const field of ['main_module','compatibility_date','compatibility_flags','limits','placement','cache_options','usage_model','exports']){
  check(canon(before[field]??null)===canon(after[field]??null),'runtime changed: '+field);
 }
 check(after.modules?.length===before.modules.length,'module count changed');
 for(const m of before.modules){
  const next=after.modules.find(x=>x.name===m.name);
  check(next&&digest(next.content_base64)===digest(m.content_base64),'Worker module code changed');
 }
 check(after.bindings?.length===before.bindings.length,'binding count changed');
 for(const b of before.bindings){
  const next=after.bindings.find(x=>x.name===b.name);
  check(next,'missing binding '+b.name);
  if(b.name==='APP_PAGES_ORIGIN')check(next.type==='plain_text'&&next.text===target,'APP_PAGES_ORIGIN mismatch');
  else check(canon(next)===canon(b),'binding unexpectedly changed: '+b.name);
 }
}
async function stageApp(){
 const source=join(DIR,'source');
 check(!existsSync(source),'previous source stage exists; no retry');
 mkdirSync(source,{mode:0o700});
 const tar=execFileSync('git',['archive',SHA],{cwd:ROOT,maxBuffer:128*1024*1024});
 execFileSync('tar',['-x','-C',source],{input:tar,maxBuffer:128*1024*1024});
 symlinkSync(join(ROOT,'node_modules'),join(source,'node_modules'),'dir');
 cmd(join(ROOT,'node_modules/.bin/vite'),['build','--mode','preview'],join(source,'app'));
 check(readFileSync(join(source,'app/dist/index.html'),'utf8').includes(NEW),'G7.1 source build hash mismatch');
 const stdout=cmd(WRANGLER,['pages','deploy','app/dist','--project-name',PROJECT,'--branch',BRANCH,'--commit-hash',SHA,'--commit-dirty=false'],source);
 check(stdout.includes('Uploading Functions bundle'),'Cloudflare Pages Functions not uploaded; no Worker changes');
 const urls=[...new Set(stdout.match(/https:\/\/[0-9a-f]{8,}\.intap-web2\.pages\.dev/g)||[])];
 check(urls.length===1,'ambiguous Pages upload, no retry');
 return urls[0];
}
async function main(){
 const mode=process.argv[2]||'--check';
 check(['--check','--inspect','--apply','--rollback'].includes(mode)&&process.argv.length<=3,'invalid mode');
 check(existsSync(join(ROOT,'.git'))&&existsSync(WRANGLER),'run from repo root with existing dependencies');
 check(git('cat-file','-t',SHA)==='commit','pinned candidate SHA not locally available');
 const authorization=auth();
 const before=await state(authorization);
 if(mode==='--inspect'){
  // Forensic read-only path after an ambiguous upload. Do not submit POST.
  const attempted=existsSync(join(DIR,'attempt.json'))?read(join(DIR,'attempt.json')):null;
  const stage=existsSync(join(DIR,'pages-stage.json'))?read(join(DIR,'pages-stage.json')):null;
  const upload=existsSync(join(DIR,'upload-attempt.json'))?read(join(DIR,'upload-attempt.json')):null;
  const versionFile=existsSync(join(DIR,'new-version.json'))?read(join(DIR,'new-version.json')):null;
  const activation=existsSync(join(DIR,'activation-attempt.json'))?read(join(DIR,'activation-attempt.json')):null;
  const receipt=existsSync(join(DIR,'receipt.json'))?read(join(DIR,'receipt.json')):null;
  let recentVersions=null,versionListError=null;
  try{
   const list=await api('GET','/workers/workers/'+WORKER+'/versions',authorization);
   const rows=Array.isArray(list)?list:Array.isArray(list?.items)?list.items:Array.isArray(list?.versions)?list.versions:[];
   recentVersions=rows.slice(0,25).map(v=>({id:v.id,created_on:v.created_on,tag:v.annotations?.['workers/tag']||null,message:v.annotations?.['workers/message']||null}));
  }catch(e){versionListError=String(e.message).slice(0,250)}
  const live=await appBundle('https://app.preview.intaprd.com');
  const stageBundle=stage?.origin&&isOrigin(stage.origin)?await appBundle(stage.origin).catch(()=>null):null;
  const output={operation:'READ-ONLY FORENSICS; DO NOT RETRY POST',
   expectedOldWorker:attempted?.oldVersion||null,activeWorker:before.id,
   activeMatchesBefore:attempted?.oldVersion===before.id,
   oldOrigin:attempted?.oldOrigin||null,currentOrigin:before.origin,
   sharedBundle:live,sharedUnchanged:live===OLD,
   pagesOrigin:stage?.origin||null,pagesBundle:stageBundle,
   uploadAttemptExists:Boolean(upload),newVersionReceipt:versionFile?.newVersion||null,
   activationAttemptExists:Boolean(activation),finalReceiptExists:Boolean(receipt),
   recentVersions,versionListError,
   evidenceDirectory:DIR};
  console.log(JSON.stringify(output,null,2));return;
 }
  const bundle=await appBundle('https://app.preview.intaprd.com');
  console.log(JSON.stringify({operation:'read-only',workerVersion:before.id,origin:before.origin,bundle,expected:OLD,ready:bundle===OLD},null,2));return;
 }
 mkdirSync(DIR,{recursive:true,mode:0o700});
 const receiptPath=join(DIR,'receipt.json'),attemptPath=join(DIR,'attempt.json');
 if(mode==='--rollback'){
  check(existsSync(receiptPath),'no successful deployment receipt');
  const receipt=read(receiptPath);
  check(before.id===receipt.newVersion,'active Worker differs from last promotion; do not rollback');
  save(join(DIR,'rollback-attempt-'+Date.now()+'.json'),{from:before.id,to:receipt.oldVersion});
  await api('POST','/workers/scripts/'+WORKER+'/deployments',authorization,{strategy:'percentage',versions:[{version_id:receipt.oldVersion,percentage:100}],annotations:{'workers/message':'Restore G7.1 Preview previous version'}});
  check((await state(authorization)).id===receipt.oldVersion,'rollback not verified; do not retry');
  console.log(JSON.stringify({result:'PASS',operation:'rollback',version:receipt.oldVersion}));return;
 }
 check(!existsSync(attemptPath),'previous attempt recorded: investigate '+DIR+'; NEVER retry blind');
 check(git('status','--porcelain')==='','working tree not clean');
 check((await appBundle('https://app.preview.intaprd.com'))===OLD,'shared Preview does not match pinned baseline');
 check(!before.origin.includes(BRANCH),'candidate already active');
 save(attemptPath,{source:SHA,oldVersion:before.id,oldOrigin:before.origin,operation:'G7.1 Preview promotion',startedAt:new Date().toISOString()});
 const origin=await stageApp();
 save(join(DIR,'pages-stage.json'),{origin,source:SHA});
 check((await appBundle(origin))===NEW,'full Pages stage has unexpected bundle; do not activate');
 check((await state(authorization)).id===before.id,'Worker active version changed during Pages stage');
 check((await appBundle('https://app.preview.intaprd.com'))===OLD,'shared domain changed before activation');
 const metadata={main_module:before.full.main_module,bindings:before.full.bindings.map(b=>b.name==='APP_PAGES_ORIGIN'?{name:b.name,type:'plain_text',text:origin}:{name:b.name,type:'inherit',version_id:before.id}),annotations:{'workers/tag':SHA,'workers/message':'G7.1 Preview APP_PAGES_ORIGIN only; 34 inherited bindings'}};
 for(const key of ['compatibility_date','compatibility_flags','limits','placement','cache_options','usage_model','exports'])if(before.full[key]!==undefined&&before.full[key]!==null)metadata[key]=before.full[key];
 const form=new FormData();
 form.set('metadata',JSON.stringify(metadata));
 for(const m of before.full.modules)form.set(m.name,new Blob([Buffer.from(m.content_base64,'base64')],{type:m.content_type||'application/javascript+module'}),m.name);
 save(join(DIR,'upload-attempt.json'),{oldVersion:before.id,newOrigin:origin});
 const response=await fetch(BASE+'/workers/workers/'+WORKER+'/versions?bindings_inherit=strict',{method:'POST',headers:{Authorization:authorization},body:form,redirect:'error',signal:AbortSignal.timeout(120000)});
 const uploaded=await response.json().catch(()=>null);
 check(response.ok&&uploaded?.success===true&&uploaded.result?.id,'version upload ambiguous; no retry');
 const newVersion=uploaded.result.id;
 save(join(DIR,'new-version.json'),{newVersion});
 const candidate=await api('GET','/workers/workers/'+WORKER+'/versions/'+newVersion+'?include=modules',authorization);
 verifyChangedOnlyOrigin(before.full,candidate,origin);
 check((await state(authorization)).id===before.id,'active Worker changed before activation');
 save(join(DIR,'activation-attempt.json'),{oldVersion:before.id,newVersion,origin});
 await api('POST','/workers/scripts/'+WORKER+'/deployments',authorization,{strategy:'percentage',versions:[{version_id:newVersion,percentage:100}],annotations:{'workers/message':'G7.1 search Preview; rollback '+before.id}});
 check((await state(authorization)).id===newVersion,'Worker activation not verified');
 const served=await appBundle('https://app.preview.intaprd.com');
 save(receiptPath,{result:served===NEW?'PASS':'BLOCKED',oldVersion:before.id,newVersion,oldOrigin:before.origin,newOrigin:origin,bundle:served});
 check(served===NEW,'active Preview bundle mismatch: use --rollback after inspecting receipt');
 console.log(JSON.stringify({result:'PASS',sharedPreview:'https://app.preview.intaprd.com',bundle:served,oldVersion:before.id,newVersion,productionUnchanged:true},null,2));
}
main().catch(error=>{console.error(error.message.startsWith('BLOCKED:')?error.message:'BLOCKED: '+error.message);process.exitCode=1});
