// One-shot G7.1 Preview recovery after ambiguous Worker version POST.
// --check is read only. --resume reuses staged Pages and attempts one Worker upload.
import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
const CANDIDATE='f42bccf2b8248b61603090a97ab56c9258400b58';
const ACTIVE='ebf507f7-325f-44c1-9849-2f93ae8ded0d';
const OLD_ORIGIN='https://qa-kawmed-guest-current-2026.intap-web2.pages.dev';
const OLD_BUNDLE='/assets/index-BWOJsn1t.js',NEW_BUNDLE='/assets/index-D25-Z3tL.js';
const ACCOUNT='adf4d5ebb625fed2c32e38cef57a6319',WORKER='intap-api-preview';
const DIR=join(homedir(),'intap-release-logs','g7-1-search-shared-'+CANDIDATE.slice(0,12));
const BASE='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT;
const ROOT=resolve(process.cwd()),WRANGLER=join(ROOT,'node_modules/.bin/wrangler');
const check=(ok,msg)=>{if(!ok)throw Error('BLOCKED: '+msg)};
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2),{flag:'wx',mode:0o600});
const sort=x=>Array.isArray(x)?x.map(sort):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,sort(x[k])])):x;
const same=(a,b)=>JSON.stringify(sort(a??null))===JSON.stringify(sort(b??null));
const checksum=base64=>createHash('sha256').update(Buffer.from(base64,'base64')).digest('hex');
function auth(){
 if(process.env.CLOUDFLARE_API_TOKEN)return 'Bearer '+process.env.CLOUDFLARE_API_TOKEN;
 execFileSync(WRANGLER,['whoami'],{stdio:['ignore','pipe','pipe']});
 const files=['Library/Preferences/.wrangler/config/default.toml','.wrangler/config/default.toml','.config/.wrangler/config/default.toml'].map(p=>join(homedir(),p)).filter(existsSync);
 check(files.length===1,'Wrangler OAuth session ambiguous');
 const token=readFileSync(files[0],'utf8').match(/^oauth_token\s*=\s*"([^"\r\n]+)"/m)?.[1];
 check(Boolean(token),'existing Wrangler token unavailable');
 return 'Bearer '+token;
}
async function request(method,path,token,body){
 const headers={Authorization:token};if(body!==undefined)headers['Content-Type']='application/json';
 const response=await fetch(BASE+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(method==='GET'?30000:120000)});
 const data=await response.json().catch(()=>null);
 return {ok:response.ok&&data?.success===true,status:response.status,result:data?.result,errors:(data?.errors||[]).map(e=>({code:e.code,message:String(e.message||'').slice(0,200)})).slice(0,5)};
}
async function get(path,token){const r=await request('GET',path,token);check(r.ok,'GET '+path+' HTTP '+r.status+' codes '+r.errors.map(e=>e.code).join(','));return r.result}
async function snapshot(token){
 const deployments=await get('/workers/scripts/'+WORKER+'/deployments',token),versions=deployments?.deployments?.[0]?.versions;
 check(versions?.length===1&&Number(versions[0].percentage)===100,'not 100% single version');
 const id=versions[0].version_id,v=await get('/workers/workers/'+WORKER+'/versions/'+id+'?include=modules',token);
 check(v.id===id&&v.bindings?.length===35&&v.modules?.length===1,'35 bindings / 1 module changed');
 check(v.modules[0].name===v.main_module&&v.modules[0].content_base64,'module bytes missing');
 check(v.bindings.some(b=>b.name==='ENVIRONMENT'&&b.text==='preview'),'not Preview');
 check(v.bindings.some(b=>b.name==='DB'&&b.type==='d1')&&v.bindings.some(b=>b.name==='BUCKET'&&b.type==='r2_bucket'),'D1/R2 missing');
 return v;
}
async function versions(token){
 const data=await get('/workers/workers/'+WORKER+'/versions',token);
 const rows=Array.isArray(data)?data:Array.isArray(data?.items)?data.items:Array.isArray(data?.versions)?data.versions:null;
 check(rows?.length>0,'versions unavailable');return rows;
}
async function bundle(origin){
 const r=await fetch(origin+'/admin/login?g71='+Date.now(),{signal:AbortSignal.timeout(30000)});
 check(r.ok,'HTTP '+r.status+' for '+origin);
 return (await r.text()).match(/\/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0]||null;
}
function stage(){
 const a=join(DIR,'attempt.json'),p=join(DIR,'pages-stage.json'),u=join(DIR,'upload-attempt.json');
 check(existsSync(a)&&existsSync(p)&&existsSync(u),'original attempt evidence missing');
 const aa=read(a),pp=read(p),uu=read(u),url=new URL(pp.origin);
 check(aa.source===CANDIDATE&&aa.oldVersion===ACTIVE&&aa.oldOrigin===OLD_ORIGIN,'original receipt mismatch');
 check(pp.source===CANDIDATE&&url.protocol==='https:'&&/^[a-f0-9]{8}\.intap-web2\.pages\.dev$/.test(url.hostname)&&url.pathname==='/'&&!url.search&&!url.hash,'Pages origin invalid');
 check(uu.oldVersion===ACTIVE&&uu.newOrigin===pp.origin,'upload receipt mismatch');
 check(!existsSync(join(DIR,'activation-attempt.json'))&&!existsSync(join(DIR,'receipt.json'))&&!existsSync(join(DIR,'new-version.json')),'activation or version already confirmed');
 return pp.origin;
}
function invariant(oldV,newV,origin){
 for(const key of ['main_module','compatibility_date','compatibility_flags','limits','placement','cache_options','usage_model','exports'])check(same(oldV[key],newV[key]),'runtime mismatch '+key);
 check(newV.modules?.length===oldV.modules.length,'module count changed');
 for(const m of oldV.modules){const next=newV.modules.find(x=>x.name===m.name);check(next&&checksum(next.content_base64)===checksum(m.content_base64),'module changed')}
 check(newV.bindings?.length===35,'binding count changed');
 for(const b of oldV.bindings){const x=newV.bindings.find(v=>v.name===b.name);check(x,'binding missing '+b.name);if(b.name==='APP_PAGES_ORIGIN')check(x.type==='plain_text'&&x.text===origin,'new origin mismatch');else check(same(x,b),'binding changed '+b.name)}
}
async function main(){
 const mode=process.argv[2]||'--check';
 check(['--check','--resume'].includes(mode)&&process.argv.length===3,'use --check or --resume');
 check(existsSync(join(ROOT,'.git'))&&existsSync(WRANGLER),'run from repository root');
 const origin=stage(),token=auth(),current=await snapshot(token),history=await versions(token);
 const live=await bundle('https://app.preview.intaprd.com'),pages=await bundle(origin);
 const candidate=history.filter(x=>x.annotations?.['workers/tag']===CANDIDATE);
 const safe=current.id===ACTIVE&&current.bindings.find(x=>x.name==='APP_PAGES_ORIGIN')?.text===OLD_ORIGIN&&live===OLD_BUNDLE&&pages===NEW_BUNDLE&&history[0].id===ACTIVE&&candidate.length===0;
 if(mode==='--check'){console.log(JSON.stringify({operation:'READ ONLY',ready:safe,active:current.id,origin,pagesBundle:pages,sharedBundle:live,candidateVersions:candidate.map(x=>x.id),previousUploadAttempt:true},null,2));return;}
 check(safe,'remote state is not safe for a one-shot recovery');
 check(!existsSync(join(DIR,'recovery-attempt.json')),'recovery already attempted; never retry POST');
 const metadata={main_module:current.main_module,modules:current.modules,bindings:current.bindings.map(b=>b.name==='APP_PAGES_ORIGIN'?{name:b.name,type:'plain_text',text:origin}:{name:b.name,type:'inherit',version_id:ACTIVE}),annotations:{'workers/tag':CANDIDATE,'workers/message':'G7.1 Preview APP_PAGES_ORIGIN only, 34 bindings inherited'}};
 for(const key of ['compatibility_date','compatibility_flags','limits','placement','cache_options','usage_model','exports'])if(current[key]!==undefined&&current[key]!==null)metadata[key]=current[key];
 save(join(DIR,'recovery-attempt.json'),{candidate:CANDIDATE,oldVersion:ACTIVE,origin,priorVersionIds:history.map(x=>x.id),startedAt:new Date().toISOString()});
 const uploaded=await request('POST','/workers/workers/'+WORKER+'/versions?deploy=false',token,metadata);
 save(join(DIR,'recovery-upload-response.json'),{ok:uploaded.ok,status:uploaded.status,errors:uploaded.errors,newVersion:uploaded.result?.id||null});
 check(uploaded.ok&&/^[a-f0-9-]{36}$/i.test(uploaded.result?.id||''),'upload failed/ambiguous; inspect recovery-upload-response.json, no retry');
 const newVersion=uploaded.result.id,newData=await get('/workers/workers/'+WORKER+'/versions/'+newVersion+'?include=modules',token);
 invariant(current,newData,origin);
 check((await snapshot(token)).id===ACTIVE,'active Worker changed before activation');
 check((await bundle('https://app.preview.intaprd.com'))===OLD_BUNDLE,'shared bundle changed before activation');
 save(join(DIR,'activation-attempt.json'),{oldVersion:ACTIVE,newVersion,origin});
 const deployed=await request('POST','/workers/scripts/'+WORKER+'/deployments',token,{strategy:'percentage',versions:[{version_id:newVersion,percentage:100}],annotations:{'workers/message':'G7.1 search Preview; rollback '+ACTIVE}});
 save(join(DIR,'recovery-activation-response.json'),{ok:deployed.ok,status:deployed.status,errors:deployed.errors});
 check(deployed.ok,'activation failed/ambiguous; do not retry');
 const active=await snapshot(token),served=await bundle('https://app.preview.intaprd.com');
 const pass=active.id===newVersion&&served===NEW_BUNDLE;
 save(join(DIR,'receipt.json'),{result:pass?'PASS':'BLOCKED',oldVersion:ACTIVE,newVersion,oldOrigin:OLD_ORIGIN,newOrigin:origin,bundle:served});
 check(pass,'read-back mismatch; inspect receipt and rollback using original script');
 console.log(JSON.stringify({result:'PASS',url:'https://app.preview.intaprd.com',bundle:served,oldVersion:ACTIVE,newVersion,productionUntouched:true},null,2));
}
main().catch(error=>{console.error(String(error.message||error).startsWith('BLOCKED:')?error.message:'BLOCKED: '+String(error.message||error));process.exitCode=1});
