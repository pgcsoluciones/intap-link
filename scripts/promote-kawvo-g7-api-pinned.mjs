// G7.1 Preview API: preflight by default; promotion requires explicit second invocation.
// Uses the pinned #171 read client and the immutable Stage receipts. No build/upload.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export const CANDIDATE='e9b1aa11189fe43e928ba26802e2f5f34fd5baa4';
export const PRIOR='23405a5b-e9ca-4247-843d-28cc4f236eaa';
export const NEXT='ebf507f7-325f-44c1-9849-2f93ae8ded0d';
export const WORKER='intap-api-preview';
export const OPS='6822465f2708a08f73ce3cb5666357fa4519784b';
const HOME=join(homedir(),'intap-release-logs/g7-pinned-read-ofwQf8Wa');
const BASE=join(HOME,'stage-api-'+CANDIDATE.slice(0,12));
const APP=join(HOME,'stage-app-'+CANDIDATE.slice(0,12));
const EVIDENCE=join(HOME,'preview-api-'+CANDIDATE.slice(0,12));
const SHA=b=>createHash('sha256').update(b).digest('hex');
const canonical=x=>JSON.stringify(x,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const check=(ok,msg)=>{if(!ok)throw Error('BLOCKED: '+msg)};
const read=path=>JSON.parse(readFileSync(path,'utf8'));
const save=(path,value)=>writeFileSync(path,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});
const uuid=s=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s||'');
const git=(root,...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();

export function deployment(data, expected=PRIOR){
 const d=data?.deployments?.[0];
 check(uuid(d?.id)&&Array.isArray(d.versions)&&d.versions.length===1,'deployment Preview inesperado');
 const v=d.versions[0];
 check(v.version_id===expected&&Number(v.percentage)===100,'Worker Preview activo divergente');
 return {id:d.id,version:v.version_id,percentage:100};
}
export function validateReceipts(api,app){
 check(api.result==='PASS'&&api.operation==='Stage API only; not activated'&&api.candidate===CANDIDATE&&api.version===NEXT&&api.inheritFrom===PRIOR&&api.bindings===35&&api.trafficUnchanged===true,'recibo Stage API incompatible');
 check(app.result==='PASS'&&app.candidate===CANDIDATE&&app.apiStage===NEXT&&app.protectedSurfacesUnchanged===true&&app.deployment?.commit===CANDIDATE,'recibo Stage App incompatible');
 check(app.deployment.branch==='qa-kawvo-g7-1-'+CANDIDATE.slice(0,12),'rama Stage App inesperada');
}
export function verifyCandidate(remote,stored){
 check(remote?.id===NEXT&&remote.annotations?.['workers/tag']===CANDIDATE,'Stage remoto/etiqueta divergente');
 check(remote.main_module===stored.main_module&&remote.modules?.length===stored.modules?.length,'módulos Stage remoto incompatibles');
 const bytes=ms=>(ms||[]).map(x=>({name:x.name,sha256:SHA(Buffer.from(x.content_base64||'','base64'))})).sort((a,b)=>a.name.localeCompare(b.name));
 check(canonical(bytes(remote.modules))===canonical(bytes(stored.modules)),'módulos Stage cambiados');
 const bindings=x=>(x?.bindings||[]).map(b=>({name:b.name,type:b.type,hash:SHA(Buffer.from(canonical(b)))})).sort((a,b)=>a.name.localeCompare(b.name));
 check(bindings(remote).length===35&&canonical(bindings(remote))===canonical(bindings(stored)),'bindings Stage cambiados');
 for(const key of ['compatibility_date','compatibility_flags','limits','placement','cache_options','usage_model','exports'])
  check(canonical(remote[key]??null)===canonical(stored[key]??null),'runtime Stage cambió: '+key);
}
async function reader(){
 const file=join(HOME,'kawmed-g3-1-pages.mjs'),bytes=readFileSync(file);
 const blob=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
 check(blob==='bc33561fbcd906172502bc558df427d952ea6fab','lector #171 distinto del aprobado');
 return import(pathToFileURL(file).href);
}
function authenticate(client){
 const paths=['Library/Preferences/.wrangler/config/default.toml','.wrangler/config/default.toml','.config/.wrangler/config/default.toml'].map(p=>join(client.home,p)).filter(existsSync);
 if(!process.env.CLOUDFLARE_API_TOKEN)check(paths.length===1,'sesión Wrangler ambigua');
 client.credentials();
 if(!process.env.CLOUDFLARE_API_TOKEN){
  const token=readFileSync(paths[0],'utf8').match(/^oauth_token\s*=\s*"([^"\r\n]+)"/m)?.[1];
  check(token,'sesión OAuth inválida después de whoami');
  client.headers={Authorization:'Bearer '+token};
 }
}
async function checkLive(client){
 const active=deployment((await client.api('/workers/scripts/'+WORKER+'/deployments')).result);
 const remote=(await client.api('/workers/workers/'+WORKER+'/versions/'+NEXT+'?include=modules')).result;
 const stored=read(join(BASE,'stage-version.private.json'));
 verifyCandidate(remote,stored);
 return active;
}
export async function execute(args=process.argv.slice(2),root=process.cwd()){
 process.umask(0o077);
 check(process.version==='v20.20.2','requiere Node 20.20.2 existente');
 check(args.length===0||(args.length===2&&args[0]==='--promote'&&args[1]===CANDIDATE),'sin argumentos: preflight; --promote SHA exacto: activar');
 root=resolve(root);
 check(git(root,'status','--porcelain')==='','checkout local con cambios; no intervenir');
 check(git(root,'rev-parse',CANDIDATE+'^{commit}')===CANDIDATE,'candidato Git ausente');
 validateReceipts(read(join(BASE,'stage-pass.json')),read(join(APP,'stage-pass.json')));
 const {Runner}=await reader(),client=new Runner({root});authenticate(client);
 const before=await checkLive(client);
 mkdirSync(EVIDENCE,{recursive:true,mode:0o700});
 const preflight=join(EVIDENCE,'preflight-pass.json');
 const mode=args.length?'promote':'preflight';
 if(!args.length){
  check(!existsSync(join(EVIDENCE,'promote-attempt.json')),'hay intento de promoción previo; consultar antes de repetir');
  const record={result:'PASS',operation:'Preview API preflight only; no traffic changed',candidate:CANDIDATE,worker:WORKER,previous:PRIOR,stage:NEXT,activeBefore:before,rollbackVersion:PRIOR,bindings:35,appStageVerified:true};
  if(existsSync(preflight))check(canonical(read(preflight))===canonical(record),'preflight anterior distinto; detenido');
  else save(preflight,record);
  console.log(JSON.stringify(record,null,2));return;
 }
 check(existsSync(preflight),'preflight independiente no realizado');
 const evidence=read(preflight);
 check(evidence.candidate===CANDIDATE&&evidence.previous===PRIOR&&evidence.stage===NEXT&&evidence.result==='PASS'&&canonical(evidence.activeBefore)===canonical(before),'preflight obsoleto; no promover');
 const attempt=join(EVIDENCE,'promote-attempt.json');
 check(!existsSync(attempt),'existe intento de promoción previo; no repetir POST');
 save(attempt,{operation:'Preview API activation once',candidate:CANDIDATE,previous:PRIOR,stage:NEXT,previousDeployment:before,startedAt:new Date().toISOString()});
 let response;
 try{
  response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+client.account+'/workers/scripts/'+WORKER+'/deployments',{
   method:'POST',headers:{...client.headers,'Content-Type':'application/json'},
   body:JSON.stringify({strategy:'percentage',versions:[{percentage:100,version_id:NEXT}],annotations:{'workers/message':'KAWVO G7.1 Preview API pinned '+CANDIDATE}}),
   signal:AbortSignal.timeout(120000),redirect:'error'
  });
 }catch{throw Error('BLOCKED: resultado HTTP de activación ambiguo; NO repetir POST; consultar el deployment y el marcador privado')}
 const data=await response.json().catch(()=>null);
 check(response.ok&&data?.success===true&&uuid(data?.result?.id),'respuesta de activación ambigua/HTTP '+response.status+'; NO repetir');
 const after=deployment((await client.api('/workers/scripts/'+WORKER+'/deployments')).result,NEXT);
 const receipt={result:'PASS',operation:'Preview API activated; App Preview not modified',candidate:CANDIDATE,previous:PRIOR,active:NEXT,deployment:after,rollbackVersion:PRIOR,rollbackRemoteRehearsed:false};
 save(join(EVIDENCE,'promote-pass.json'),receipt);
 console.log(JSON.stringify(receipt,null,2));
}
if(process.argv[1]==='-'||(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url))
 execute().catch(e=>{console.error(String(e.message).startsWith('BLOCKED:')?e.message:'BLOCKED: error; conservar evidencia, nunca repetir POST ambiguo');process.exitCode=1});
