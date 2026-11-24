// G8.2 App+Web official Preview, dual-origin adaptation of proven G7.1/G8.1 JSON recovery.
// --check read-only; --resume one shot, with markers before remote writes.
import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {homedir,tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
const CANDIDATE='2714b46093e80555c3c83feba0ad44304176dbe0';
const ACTIVE='eac200b1-1268-41d4-b651-60a22b1bb076';
const OLD_ORIGIN='https://612b7245.intap-web2.pages.dev';
const NEW_ORIGIN='https://bd482514.intap-web2.pages.dev';
const OLD_BUNDLE='/assets/index-CRNEulvk.js',NEW_BUNDLE='/assets/index-DU9Euvfp.js';
const ACCOUNT='adf4d5ebb625fed2c32e38cef57a6319',WORKER='intap-api-preview';
const DIR=join(homedir(),'intap-release-logs','kawvo-g8-2-preview-app-web-2714b460');
const BASE='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT;
const ROOT=resolve(process.cwd());
const OLD_WEB_ORIGIN='https://qa-sponsor-scan-1104.intap-link.pages.dev';
const NEW_WEB_ORIGIN='https://7014ce2e.intap-link.pages.dev';
const OLD_WEB_BUNDLE='/assets/index-1YEoozaP.js',NEW_WEB_BUNDLE='/assets/index-BRNLk2GQ.js';
const HASHES={oldApp:'1866cbee1baff6fe4fd4a67638d6e4a0c97ccd35418fad6cdc7311b30afff6b7',newApp:'354af5c79bf554196536cf33755876b2ee5afa3ed5cc6311bbfd827e6069c103',oldWeb:'d0babb9b899ad38e566f4037f04c8eb3664f802d9d835166d259963dfd4dfa22',newWeb:'ff1b015bc6f497573e134a16bb1cca5ad656a2a568426b542044bf6998715ac0'};
const newOriginFor=name=>name==='APP_PAGES_ORIGIN'?NEW_ORIGIN:name==='WEB_PAGES_ORIGIN'?NEW_WEB_ORIGIN:null;
const check=(ok,msg)=>{if(!ok)throw Error('BLOCKED: '+msg)};
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2),{flag:'wx',mode:0o600});
const sort=x=>Array.isArray(x)?x.map(sort):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,sort(x[k])])):x;
const same=(a,b)=>JSON.stringify(sort(a??null))===JSON.stringify(sort(b??null));
const checksum=base64=>createHash('sha256').update(Buffer.from(base64,'base64')).digest('hex');
function auth(){
 if(process.env.CLOUDFLARE_API_TOKEN)return 'Bearer '+process.env.CLOUDFLARE_API_TOKEN;
 execFileSync('npx',['--yes','--package=wrangler@4.166.0','--','wrangler','whoami'],{stdio:['ignore','pipe','pipe'],cwd:tmpdir()});
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
 const r=await fetch(origin+'/admin/login?g81='+Date.now(),{signal:AbortSignal.timeout(30000)});
 check(r.ok,'HTTP '+r.status+' for '+origin);
 return (await r.text()).match(/\/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0]||null;
}

function stage(){
 const urlA=new URL(NEW_ORIGIN),urlW=new URL(NEW_WEB_ORIGIN);
 check(urlA.protocol==='https:'&&/^[a-f0-9]{8}\.intap-web2\.pages\.dev$/.test(urlA.hostname)&&urlA.pathname==='/'&&!urlA.search&&!urlA.hash,'invalid App stage');
 check(urlW.protocol==='https:'&&/^[a-f0-9]{8}\.intap-link\.pages\.dev$/.test(urlW.hostname)&&urlW.pathname==='/'&&!urlW.search&&!urlW.hash,'invalid Web stage');
 check(!existsSync(join(DIR,'recovery-attempt.json'))&&!existsSync(join(DIR,'activation-attempt.json'))&&!existsSync(join(DIR,'receipt.json'))&&!existsSync(join(DIR,'new-version.json')),'previous operation found; read-only reconciliation required');
}
function invariant(oldV,newV){
 for(const key of ['main_module','compatibility_date','compatibility_flags','limits','placement','cache_options','usage_model','exports'])check(same(oldV[key],newV[key]),'runtime mismatch '+key);
 check(newV.modules?.length===oldV.modules.length,'module count changed');
 for(const m of oldV.modules){const next=newV.modules.find(x=>x.name===m.name);check(next&&checksum(next.content_base64)===checksum(m.content_base64),'module changed')}
 check(newV.bindings?.length===35,'binding count changed');
 for(const b of oldV.bindings){const x=newV.bindings.find(v=>v.name===b.name);check(x,'binding missing '+b.name);const expected=newOriginFor(b.name);if(expected){check(x.type==='plain_text'&&x.text===expected,'origin mismatch '+b.name)}else check(same(x,b),'binding changed '+b.name)}
}
async function asset(origin,path){
 const r=await fetch(origin+path+(path.includes('?')?'&':'?')+'kaw82='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(30000)});
 check(r.ok,'HTML HTTP '+r.status+' '+origin);
 const name=(await r.text()).match(/\/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0];
 check(Boolean(name),'bundle unidentified '+origin);
 const js=await fetch(origin+name,{cache:'no-store',signal:AbortSignal.timeout(30000)});
 check(js.ok,'JS HTTP '+js.status+' '+origin);
 return {name,hash:createHash('sha256').update(Buffer.from(await js.arrayBuffer())).digest('hex')};
}
async function inspect(token){
 const current=await snapshot(token),history=await versions(token);
 const app=current.bindings.find(x=>x.name==='APP_PAGES_ORIGIN');
 const web=current.bindings.find(x=>x.name==='WEB_PAGES_ORIGIN');
 const [la,lw,sa,sw]=await Promise.all([
  asset('https://app.preview.intaprd.com','/admin/login'),
  asset('https://preview.intaprd.com','/'),
  asset(NEW_ORIGIN,'/admin/login'),
  asset(NEW_WEB_ORIGIN,'/')
 ]);
 const liveOk=current.id===ACTIVE&&app?.type==='plain_text'&&app?.text===OLD_ORIGIN&&web?.type==='plain_text'&&web?.text===OLD_WEB_ORIGIN;
 const filesOk=la.name===OLD_BUNDLE&&la.hash===HASHES.oldApp&&lw.name===OLD_WEB_BUNDLE&&lw.hash===HASHES.oldWeb
   &&sa.name===NEW_BUNDLE&&sa.hash===HASHES.newApp&&sw.name===NEW_WEB_BUNDLE&&sw.hash===HASHES.newWeb;
 const tag='KAWVO-G8.2-2714b460';
 const candidates=history.filter(x=>x.annotations?.['workers/tag']===tag);
 const safe=liveOk&&filesOk&&candidates.length===0&&history[0]?.id===ACTIVE;
 return {current,history,tag,candidates,safe,liveOk,filesOk,la,lw,sa,sw,appOrigin:app?.text,webOrigin:web?.text};
}
async function main(){
 const mode=process.argv[2]||'--check';
 check(['--check','--resume'].includes(mode)&&process.argv.length===3,'use --check or --resume');
 // Independent ops branch; the staged build commit is pinned separately.
 check(existsSync(join(ROOT,'.git')),'run from repository root');
 stage();
 const token=auth(),old=await inspect(token);
 if(mode==='--check'){
  console.log(JSON.stringify({operation:'READ ONLY',ready:old.safe,active:old.current.id,oldAppOrigin:old.appOrigin,oldWebOrigin:old.webOrigin,appLive:old.la,webLive:old.lw,appStage:old.sa,webStage:old.sw,candidateVersions:old.candidates.map(x=>x.id),bindingCount:old.current.bindings.length,method:'PROVEN_G7_1_JSON_RECOVERY_DUAL_ORIGIN'},null,2));
  return;
 }
 check(old.safe,'remote state differs from approved G8.2 preflight; DO NOT POST');
 const inherited=old.current.bindings.map(b=>{
  const origin=newOriginFor(b.name);
  return origin?{name:b.name,type:'plain_text',text:origin}:{name:b.name,type:'inherit',version_id:ACTIVE};
 });
 check(inherited.length===35&&inherited.filter(b=>b.type==='plain_text').length===2,'binding projection changed');
 const metadata={main_module:old.current.main_module,modules:old.current.modules,bindings:inherited,annotations:{'workers/tag':old.tag,'workers/message':'G8.2 Preview App+Web origins only, 33 bindings inherited'}};
 for(const key of ['compatibility_date','compatibility_flags','limits','placement','cache_options','usage_model','exports'])if(old.current[key]!==undefined&&old.current[key]!==null)metadata[key]=old.current[key];
 save(join(DIR,'recovery-attempt.json'),{candidate:CANDIDATE,oldVersion:ACTIVE,oldAppOrigin:OLD_ORIGIN,oldWebOrigin:OLD_WEB_ORIGIN,newAppOrigin:NEW_ORIGIN,newWebOrigin:NEW_WEB_ORIGIN,priorVersionIds:old.history.map(x=>x.id),startedAt:new Date().toISOString()});
 const uploaded=await request('POST','/workers/workers/'+WORKER+'/versions?deploy=false',token,metadata);
 save(join(DIR,'recovery-upload-response.json'),{ok:uploaded.ok,status:uploaded.status,errors:uploaded.errors,newVersion:uploaded.result?.id||null});
 check(uploaded.ok&&/^[a-f0-9-]{36}$/i.test(uploaded.result?.id||''),'upload failed or ambiguous; inspect response; NO RETRY');
 const newVersion=uploaded.result.id,newData=await get('/workers/workers/'+WORKER+'/versions/'+newVersion+'?include=modules',token);
 invariant(old.current,newData);
 const before=await snapshot(token);
 check(before.id===ACTIVE,'active Worker changed before activation');
 const [liveA,liveW]=await Promise.all([asset('https://app.preview.intaprd.com','/admin/login'),asset('https://preview.intaprd.com','/')]);
 check(liveA.name===OLD_BUNDLE&&liveA.hash===HASHES.oldApp&&liveW.name===OLD_WEB_BUNDLE&&liveW.hash===HASHES.oldWeb,'domains changed before activation');
 save(join(DIR,'activation-attempt.json'),{oldVersion:ACTIVE,newVersion,newAppOrigin:NEW_ORIGIN,newWebOrigin:NEW_WEB_ORIGIN,at:new Date().toISOString()});
 const deployed=await request('POST','/workers/scripts/'+WORKER+'/deployments',token,{strategy:'percentage',versions:[{version_id:newVersion,percentage:100}],annotations:{'workers/message':'G8.2 Preview App+Web; rollback '+ACTIVE}});
 save(join(DIR,'recovery-activation-response.json'),{ok:deployed.ok,status:deployed.status,errors:deployed.errors});
 check(deployed.ok,'activation failed or ambiguous; NO RETRY');
 const active=await snapshot(token);
 const [newA,newW]=await Promise.all([asset('https://app.preview.intaprd.com','/admin/login'),asset('https://preview.intaprd.com','/')]);
 const bindingA=active.bindings.find(x=>x.name==='APP_PAGES_ORIGIN')?.text;
 const bindingW=active.bindings.find(x=>x.name==='WEB_PAGES_ORIGIN')?.text;
 const pass=active.id===newVersion&&bindingA===NEW_ORIGIN&&bindingW===NEW_WEB_ORIGIN
   &&newA.name===NEW_BUNDLE&&newA.hash===HASHES.newApp
   &&newW.name===NEW_WEB_BUNDLE&&newW.hash===HASHES.newWeb;
 save(join(DIR,'receipt.json'),{result:pass?'PASS':'BLOCKED',candidate:CANDIDATE,oldVersion:ACTIVE,newVersion,oldAppOrigin:OLD_ORIGIN,oldWebOrigin:OLD_WEB_ORIGIN,newAppOrigin:NEW_ORIGIN,newWebOrigin:NEW_WEB_ORIGIN,app:newA,web:newW});
 check(pass,'readback mismatch; STOP and reconcile');
 console.log(JSON.stringify({result:'PASS',method:'PROVEN_G7_1_JSON_RECOVERY_DUAL_ORIGIN',oldVersion:ACTIVE,newVersion,app:'https://app.preview.intaprd.com',web:'https://preview.intaprd.com',bundleApp:newA,bundleWeb:newW,productionUntouched:true},null,2));
}
main().catch(error=>{console.error(String(error.message||error).startsWith('BLOCKED:')?error.message:'BLOCKED: '+String(error.message||error));process.exitCode=1});
