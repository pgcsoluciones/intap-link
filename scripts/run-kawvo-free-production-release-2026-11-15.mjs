#!/usr/bin/env node
// App-only release runner. Stage first, then approved main only; no Worker/Web/D1/R2/OAuth mutations.
import {execFileSync} from 'node:child_process'
import {readFileSync,existsSync,mkdirSync,mkdtempSync,writeFileSync} from 'node:fs'
import {homedir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
const run=(cmd,args)=>execFileSync(cmd,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:8*1024*1024})
const normal=u=>String(u||'').replace(/\/$/,'').toLowerCase()
function existingCredentials(){
  if(process.env.CLOUDFLARE_API_TOKEN)return {Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN}
  if(process.env.CLOUDFLARE_API_KEY&&process.env.CLOUDFLARE_EMAIL)return {'X-Auth-Email':process.env.CLOUDFLARE_EMAIL,'X-Auth-Key':process.env.CLOUDFLARE_API_KEY}
  const paths=[
    join(homedir(),'Library','Preferences','.wrangler','config','default.toml'),
    join(homedir(),'.wrangler','config','default.toml'),
    join(homedir(),'.config','.wrangler','config','default.toml')
  ].filter(existsSync)
  if(paths.length!==1)throw Error('No se encontró una sola sesión Wrangler; ninguna operación Cloudflare fue modificada.')
  const token=readFileSync(paths[0],'utf8').match(/^oauth_token\s*=\s*"([^"\r\n]+)"/m)
  if(!token)throw Error('No hay token de acceso OAuth legible en sesión actual; no se requieren credenciales nuevas.')
  return {Authorization:'Bearer '+token[1]}
}
function existingAccount(){
  const output=run('npx',['--no-install','wrangler','whoami'])
  const ids=[...new Set((output.match(/\b[a-f0-9]{32}\b/gi)||[]).map(x=>x.toLowerCase()))]
  const id=process.env.CLOUDFLARE_ACCOUNT_ID || (ids.length===1?ids[0]:'')
  if(!/^[a-f0-9]{32}$/i.test(id)|| (ids.length&&!ids.includes(id.toLowerCase())))throw Error('Cuenta no determinada con precisión desde Wrangler.')
  return id
}

import {readdirSync,lstatSync} from 'node:fs'
const fail=message=>{throw Error(message)}
const sha256=b=>createHash('sha256').update(b).digest('hex')
const curl=url=>execFileSync('curl',['-fsSL','--connect-timeout','10','--max-time','75',url],{stdio:['ignore','pipe','pipe'],maxBuffer:64*1024*1024})
function asset(html){
  const match=html.toString('utf8').match(/\/assets\/index-[A-Za-z0-9_-]+\.js/)
  if(!match)fail('No se identificó el bundle principal')
  return match[0]
}
async function getProject(account,headers,name){
  const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+'/pages/projects/'+name,{headers,signal:AbortSignal.timeout(30000)})
  const body=await response.json().catch(()=>null)
  if(!response.ok||body?.success!==true||body?.result?.name!==name)fail('GET Pages '+name+' HTTP '+response.status+'; no se pudo comprobar el proyecto')
  return body.result
}

async function release(){
 const SHA='67cd49e224888dc19acefad933bfa0c7ddd6e9da', OLD='76babd4dd26faf7d502910c0fc65989c3b16f36a', CAND='156eb51083fc14864e7648fbdce9ec3f1a3d30db', TREE='c7851ebb92573b51cf0024796b163015385d10b9', APP_TREE='d59355ff57cffb18ff6bb7548a3c2d848386b505', STAGE='qa-kawvo-free-prod-artifact-1115';
 const approvedAsset='/assets/index-CUIxebii.js', approvedHash='ae39fc4fd0d41801f93cba116bdb0a69820c8458a98632ac883e1cded88ea2cb';
 const prev={name:'intap-web2',domain:'https://app.intaprd.com',route:'/admin/login',url:'https://f9f7fa23.intap-web2.pages.dev',id:'f9f7fa23-86de-43bd-bb1c-e940318d58d4',commit:'bd1b99ac3462ed772ad36dfdaa667f1da5fbb93e',bundle:'/assets/index-mEgtRfhn.js',hash:'7ea2e8f6c75c5c79b7599566d87355f7fc6a4bd2cc89fffec4f1c9f25ab0f917'};
 const web={name:'intap-link',domain:'https://intaprd.com',route:'/',url:'https://1672b41a.intap-link.pages.dev',id:'1672b41a-8e3d-44a8-b576-026693c04e29',commit:'31d4a6614c8e33aad04efe89fc8d683b2c1c203c',bundle:'/assets/index-a1Ow7Cq4.js',hash:'36bd90be36587c28baadb12b3fc564ea2c5c837397c621f6300be37712ee4c3b'};
 const equal=(a,b,msg)=>{if(a!==b)fail(msg)};
 const git=(...args)=>run('git',args).trim();
 const root=join(homedir(),'Desktop','intap-link-universal-bilingual-audit');
 process.chdir(root);
 mkdirSync(join(homedir(),'intap-release-logs'),{recursive:true});
 const log=mkdtempSync(join(homedir(),'intap-release-logs','kawvo-free-production-release-'));
 const save=(name,data)=>writeFileSync(join(log,name),JSON.stringify(data,null,2)+'\n',{mode:0o600});
 console.log('LOG: '+log);
 let phase='local', uploadAttempted=false;
 const mode=process.argv[2];
 const retry=async(fn)=>{let last;for(let n=0;n<8;n++){try{return await fn()}catch(e){last=e;if(n<7)await new Promise(r=>setTimeout(r,3000))}}throw last};
 function bundleAt(host,route,expected,hash){const b=asset(curl(host+route));if(expected)equal(b,expected,'Bundle inesperado en '+host);const digest=sha256(curl(host+b));if(hash)equal(digest,hash,'Hash inesperado en '+host);return {bundle:b,sha256:digest}}
 function localGuard(){
  equal(git('branch','--show-current'),'main','Rama local distinta de main');equal(git('status','--porcelain'),'','Checkout sucio');
  git('fetch','github','main');equal(git('rev-parse','HEAD'),SHA,'HEAD distinto');equal(git('rev-parse','github/main'),SHA,'main remoto distinto');
  equal(git('rev-parse','HEAD^{tree}'),TREE,'Árbol completo distinto');equal(git('rev-parse',CAND+'^{tree}'),TREE,'Candidato distinto');equal(git('rev-parse','HEAD:app'),APP_TREE,'Árbol App distinto');
  git('diff','--check',OLD,'HEAD');git('diff','--exit-code',OLD,'HEAD','--','api/','web/','shared/','functions/','package.json','package-lock.json','.github/');
  const v=JSON.parse(run('gh',['variable','list','--repo','pgcsoluciones/intap-link','--json','name,value']));
  equal(v.find(x=>x.name==='INTAP_PRODUCTION_APPROVAL')?.value,'SÍ','Variable de aprobación incorrecta');
  equal(v.find(x=>x.name==='INTAP_APPROVED_COMMIT')?.value,SHA,'Variable SHA incorrecta');
  const ci=JSON.parse(run('gh',['run','view','43781010487','--repo','pgcsoluciones/intap-link','--json','headSha,status,conclusion']));
  equal(ci.headSha,SHA,'CI SHA incorrecto');equal(ci.status,'completed','CI incompleta');equal(ci.conclusion,'success','CI no aprobada');
  execFileSync('python3',['scripts/production_approval_guard.py'],{env:{...process.env,INTAP_ENFORCE_PRODUCTION_APPROVAL:'1',INTAP_PRODUCTION_APPROVAL:'SÍ',INTAP_APPROVED_COMMIT:SHA},stdio:'inherit'});
  console.log('PASS: main exacto, allowlist y CI productiva');
 }
 try{
  if(!['stage','publish'].includes(mode))fail('Modo inválido: stage o publish');
  localGuard();
  // Obtain the same authenticated session used by the audited baseline.
  const account=existingAccount(),headers=existingCredentials();
  async function deployment(id){const res=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+'/pages/projects/intap-web2/deployments/'+id,{headers,signal:AbortSignal.timeout(30000)});const b=await res.json().catch(()=>null);if(!res.ok||b?.success!==true||b.result?.id!==id)fail('GET deployment App no verificable');return b.result}
  function validateMeta(d,branch,commit,env){
   if(!d)fail('Deployment ausente');const m=d.deployment_trigger?.metadata;
   equal(d.environment,env,'Entorno incorrecto');equal(m?.branch,branch,'Rama Pages incorrecta');equal(m?.commit_hash,commit,'Commit Pages incorrecto');equal(m?.commit_dirty,false,'Metadata dirty no es false');equal(d.latest_stage?.status,'success','Deployment no exitoso');if(d.uses_functions===true)fail('Pages Functions inesperadas en App');
   if(!/^https:\/\/[a-f0-9]{8,40}\.intap-web2\.pages\.dev\/?$/.test(d.url))fail('Origen App inmutable no reconocido');
  }
  async function canonical(x){
   const p=await getProject(account,headers,x.name),d=p.canonical_deployment,m=d?.deployment_trigger?.metadata;
   equal(p.production_branch,'main','Production branch cambió '+x.name);equal(p.source?.config?.production_deployments_enabled,false,'Auto-deploy no desactivado '+x.name);
   equal(d?.id,x.id,'Deployment cambió '+x.name);equal(d?.environment,'production','Entorno incorrecto '+x.name);equal(m?.branch,'main','Rama incorrecta '+x.name);equal(m?.commit_hash,x.commit,'Commit cambió '+x.name);equal(m?.commit_dirty,false,'Deployment dirty '+x.name);equal(d?.latest_stage?.status,'success','Deployment no exitoso '+x.name);equal(normal(d.url),x.url,'Origen cambió '+x.name);
   bundleAt(x.domain,x.route,x.bundle,x.hash);bundleAt(x.url,x.route,x.bundle,x.hash);
   return d;
  }
  const previewPairs=[['https://app.preview.intaprd.com','https://dbf7a9e4.intap-web2.pages.dev','/admin/login'],['https://qa-kawmed-guest-current-2026.intap-web2.pages.dev','https://dbf7a9e4.intap-web2.pages.dev','/admin/login']];
  const webLog=readFileSync(join(homedir(),'intap-release-logs','kawvo-g2-4-pages-A6GfUYz0','web-publish.log'),'utf8');
  const webRef=webLog.match(/https:\/\/[0-9a-f]{8,}\.intap-link\.pages\.dev/g)?.pop();
  if(!webRef)fail('Falta referencia Web Preview G2.4');
  previewPairs.push(['https://preview.intaprd.com',webRef,'/']);
  function protectedSurfaces(){
   const out=[];
   for(const [host,origin,route] of previewPairs){const a=bundleAt(origin,route);bundleAt(host,route,a.bundle,a.sha256);out.push({host,origin,...a})}
   for(const [name,id] of [['intap-api','3d4973e4-e344-493a-a065-93f199b00359'],['intap-api-preview','23405a5b-e9ca-4247-843d-28cc4f236eaa']]){
    const v=JSON.parse(run('npx',['--no-install','wrangler','deployments','status','--name',name,'--json'])).versions;
    if(!Array.isArray(v)||v.length!==1||v[0].version_id!==id||Number(v[0].percentage)!==100)fail('Worker cambió '+name);
    out.push({worker:name,version:id,percentage:100})
   }
   return JSON.stringify(out)
  }
  phase='baseline';
  validateMeta(await canonical(prev),'main',prev.commit,'production');await canonical(web);
  const rollback=await deployment(prev.id);validateMeta(rollback,'main',prev.commit,'production');equal(normal(rollback.url),prev.url,'Rollback distinto');
  const protectedBefore=protectedSurfaces();save('baseline.json',{app:prev,web,protected:JSON.parse(protectedBefore)});
  console.log('PASS: rollback disponible, App/Web productivos y Preview/Workers preservados');
  phase='build';
  if(!existsSync('node_modules'))fail('Dependencias locales no disponibles');
  const build=execFileSync('npm',['run','app:build'],{stdio:['ignore','pipe','pipe'],maxBuffer:64*1024*1024});writeFileSync(join(log,'build.log'),build,{mode:0o600});
  equal(asset(readFileSync('app/dist/index.html')),approvedAsset,'Nombre de bundle diferente al aprobado');equal(sha256(readFileSync('app/dist'+approvedAsset)),approvedHash,'Hash de bundle diferente al aprobado');
  // Only upload the static App directory; never discover root Web Pages Functions.
  for(const p of ['app/functions','app/dist/_worker.js','app/dist/functions'])if(existsSync(p))fail('Functions inesperadas '+p);
  function manifest(dir,prefix=''){return readdirSync(dir).sort().flatMap(n=>{const f=join(dir,n),p=prefix+n,stat=lstatSync(f);if(stat.isSymbolicLink())fail('Symlink inesperado en dist');return stat.isDirectory()?manifest(f,p+'/'):[p+':'+sha256(readFileSync(f))]})}
  const dist=JSON.stringify(manifest('app/dist'));save('artifact.json',{commit:SHA,bundle:approvedAsset,hash:approvedHash,manifest:JSON.parse(dist)});
  console.log('PASS: bundle de producción idéntico al G5.2 aprobado');
  function upload(branch,label){const raw=execFileSync('npx',['--no-install','wrangler','pages','deploy','dist','--project-name','intap-web2','--branch',branch,'--commit-hash',SHA,'--commit-dirty=false'],{cwd:join(root,'app'),stdio:['ignore','pipe','pipe'],maxBuffer:64*1024*1024});const out=raw.toString('utf8');writeFileSync(join(log,label+'.log'),out,{mode:0o600});const url=out.match(/https:\/\/[a-f0-9]{8,40}\.intap-web2\.pages\.dev/g)?.pop();if(!url)fail('No se obtuvo URL inmutable; no repetir upload');return url}
  if(mode==='stage'){
   phase='stage';localGuard();await canonical(prev);await canonical(web);equal(protectedSurfaces(),protectedBefore,'Superficie protegida cambió');
   const url=upload(STAGE,'stage');const short=new URL(url).hostname.split('.')[0];const d=await retry(async()=>{const res=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+'/pages/projects/intap-web2/deployments',{headers,signal:AbortSignal.timeout(30000)});const b=await res.json().catch(()=>null);if(!res.ok||b?.success!==true||!Array.isArray(b.result))fail('GET stage fallido');const hit=b.result.find(x=>normal(x.url)===url&&String(x.id).startsWith(short));validateMeta(hit,STAGE,SHA,'preview');bundleAt(url,'/admin/login',approvedAsset,approvedHash);return hit});
   await canonical(prev);await canonical(web);equal(protectedSurfaces(),protectedBefore,'Superficie protegida cambió');equal(JSON.stringify(manifest('app/dist')),dist,'Artefacto cambió');
   const result={stageId:d.id,stageUrl:url,commit:SHA,bundle:approvedAsset,hash:approvedHash,manifest:JSON.parse(dist)};save('stage-pass.json',result);console.log('PASS STAGE: '+JSON.stringify(result));console.log('SIN PUBLICACION PRODUCTIVA. LOG: '+log);return;
  }
  // Publish requires the exact already verified isolated Stage evidence, obtained from the preceding run.
  phase='stage-revalidation';
  const stageLog=process.argv[3];if(!stageLog||!stageLog.startsWith(join(homedir(),'intap-release-logs','kawvo-free-production-release-'))||!stageLog.endsWith('/stage-pass.json'))fail('Ruta de evidencia Stage requerida');
  const st=JSON.parse(readFileSync(stageLog,'utf8'));equal(st.commit,SHA,'Stage SHA distinto');equal(st.bundle,approvedAsset,'Stage bundle distinto');equal(st.hash,approvedHash,'Stage hash distinto');equal(JSON.stringify(st.manifest),dist,'Stage manifest distinto del build actual');
  const stage=await deployment(st.stageId);validateMeta(stage,STAGE,SHA,'preview');equal(normal(stage.url),st.stageUrl,'Stage URL distinta');bundleAt(st.stageUrl,'/admin/login',approvedAsset,approvedHash);
  localGuard();await canonical(prev);await canonical(web);equal(protectedSurfaces(),protectedBefore,'Superficie protegida cambió');
  phase='production-upload';uploadAttempted=true;
  const url=upload('main','production');phase='post-deploy';
  const post=await retry(async()=>{const p=await getProject(account,headers,'intap-web2'),d=p.canonical_deployment;equal(p.production_branch,'main','Rama productiva distinta');equal(p.source?.config?.production_deployments_enabled,false,'Auto-deploy cambió');validateMeta(d,'main',SHA,'production');equal(normal(d.url),url,'Deployment canónico no corresponde al upload');if(d.id===prev.id)fail('Deployment anterior sigue activo');bundleAt(url,'/admin/login',approvedAsset,approvedHash);for(const route of ['/admin/login','/admin/free','/admin/free?legacy=1'])bundleAt(prev.domain,route,approvedAsset,approvedHash);return d});
  await canonical(web);equal(protectedSurfaces(),protectedBefore,'Superficie protegida cambió');equal(JSON.stringify(manifest('app/dist')),dist,'Artefacto cambió');
  save('release-pass.json',{commit:SHA,deploymentId:post.id,url,bundle:approvedAsset,hash:approvedHash,rollback:prev.id});console.log('PASS APP PRODUCTION: '+url+' | '+post.id+' | '+SHA);console.log('QA autenticada pendiente. LOG: '+log);
 }catch(e){save('blocked.json',{phase,uploadAttempted,rollbackId:prev.id});console.error('BLOCKED '+phase+': '+(String(e.message||e).split('\n')[0].slice(0,200)));if(uploadAttempted)console.error('NO REPETIR UPLOAD. Revisar estado real y rollback exclusivamente App: '+prev.id);process.exitCode=1}
}
await release()
