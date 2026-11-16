#!/usr/bin/env node
// G2 corrective lot: read-only preflight, then exact approved main App-only publication. No Stage creation, no Worker/Web/D1/R2/OAuth mutations.
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
 const SHA='6e6bfbb1bd60c91a94e92d36f6cfdd9f91e3d9e2', CAND='ddfb941a0b33863f3a843edce12c265c1366a3be', OLD='67cd49e224888dc19acefad933bfa0c7ddd6e9da', TREE='c9f9e610f30fbf618d75fc3aada1bdc970751811', APP_TREE='2db0d1af98bc7dac026227622158090979c0c8a0', STAGE='qa-kawvo-g2-corrective-prod-artifact-1115';
 const approvedAsset='/assets/index-0JfVc0Uy.js', approvedHash='8e973a468930a2974b46d724a241979300832824b5842950fa3aa51b05f31010';
 const prev={name:'intap-web2',domain:'https://app.intaprd.com',route:'/admin/login',url:'https://812ddfc0.intap-web2.pages.dev',id:'812ddfc0-7719-489f-bb99-5fb0e3bb8e20',commit:OLD,bundle:'/assets/index-CUIxebii.js',hash:'ae39fc4fd0d41801f93cba116bdb0a69820c8458a98632ac883e1cded88ea2cb'};
 const web={name:'intap-link',domain:'https://intaprd.com',route:'/',url:'https://1672b41a.intap-link.pages.dev',id:'1672b41a-8e3d-44a8-b576-026693c04e29',commit:'31d4a6614c8e33aad04efe89fc8d683b2c1c203c',bundle:'/assets/index-a1Ow7Cq4.js',hash:'36bd90be36587c28baadb12b3fc564ea2c5c837397c621f6300be37712ee4c3b'};
 const equal=(a,b,msg)=>{if(a!==b)fail(msg)};
 const git=(...args)=>run('git',args).trim();
 const root=join(homedir(),'Desktop','intap-link-universal-bilingual-audit');
 process.chdir(root);
 mkdirSync(join(homedir(),'intap-release-logs'),{recursive:true});
 const log=mkdtempSync(join(homedir(),'intap-release-logs','kawvo-free-g2-qa-production-publish-'));
 const save=(name,data)=>writeFileSync(join(log,name),JSON.stringify(data,null,2)+'\n',{mode:0o600});
 console.log('LOG: '+log);
 let phase='local', uploadAttempted=false;
 const mode=process.argv[2]||'preflight';
 const retry=async(fn)=>{let last;for(let n=0;n<8;n++){try{return await fn()}catch(e){last=e;if(n<7)await new Promise(r=>setTimeout(r,3000))}}throw last};
 function bundleAt(host,route,expected,hash){const b=asset(curl(host+route));if(expected)equal(b,expected,'Bundle inesperado en '+host);const digest=sha256(curl(host+b));if(hash)equal(digest,hash,'Hash inesperado en '+host);return {bundle:b,sha256:digest}}
 function localGuard(){
  equal(git('branch','--show-current'),'main','Rama local distinta de main');equal(git('status','--porcelain'),'','Checkout sucio');
  git('fetch','github','main');equal(git('rev-parse','HEAD'),SHA,'HEAD distinto');equal(git('rev-parse','github/main'),SHA,'main remoto distinto');
  equal(git('rev-parse','HEAD^{tree}'),TREE,'Árbol completo distinto');equal(git('rev-parse',CAND+'^{tree}'),TREE,'Candidato distinto');equal(git('rev-parse','HEAD:app'),APP_TREE,'Árbol App distinto');equal(git('rev-list','--parents','-n','1',SHA),SHA+' '+OLD+' '+CAND,'Parents inesperados');git('diff','--exit-code',CAND,SHA);
  equal(git('rev-parse',OLD+':app'),'d59355ff57cffb18ff6bb7548a3c2d848386b505','App base distinto del productivo');
  git('merge-base','--is-ancestor',OLD,SHA);git('diff','--check',OLD,SHA);git('diff','--exit-code',OLD,SHA,'--','api/','web/','shared/','functions/','package.json','package-lock.json','.github/');
  const expectedFiles=['app/src/components/admin/free/FreeAgendaSummary.tsx','app/src/components/admin/free/FreeAppointments.tsx','app/src/components/admin/free/FreeDashboard.tsx','app/src/components/admin/free/KawvoFreeShellPreview.tsx','app/src/components/admin/free/freeAgendaSummaryData.ts','app/src/components/appointments/AppointmentManager.tsx','docs/architecture/KAWVO_FREE_G2_QA_CORRECTIONS_2026-11-15.md','scripts/test-kawvo-free-g2-qa-corrections-2026-11-15.mjs'].sort();
  equal(JSON.stringify(git('diff','--name-only',OLD,SHA).split('\n').sort()),JSON.stringify(expectedFiles),'Allowlist exacta cambió');
  const pr=JSON.parse(run('gh',['pr','view','168','--repo','pgcsoluciones/intap-link','--json','headRefOid,state,mergeCommit']));
  equal(pr.headRefOid,CAND,'PR head distinto');equal(pr.state,'MERGED','PR no fusionado');equal(pr.mergeCommit?.oid,SHA,'Merge SHA distinto');
  const ci=JSON.parse(run('gh',['run','view','43805648930','--repo','pgcsoluciones/intap-link','--json','headSha,status,conclusion']));
  equal(ci.headSha,SHA,'CI SHA incorrecto');
  const vars=JSON.parse(run('gh',['variable','list','--repo','pgcsoluciones/intap-link','--json','name,value']));
  const approval=vars.find(x=>x.name==='INTAP_PRODUCTION_APPROVAL')?.value||'NO',approvedCommit=vars.find(x=>x.name==='INTAP_APPROVED_COMMIT')?.value||'';
  save('github.json',{commit:SHA,candidate:CAND,base:OLD,ci:43805648930,ciStatus:ci.status,ciConclusion:ci.conclusion,pr:168,productionApproval:approval==='SÍ'?'SÍ':'NO',approvedCommit:/^[a-f0-9]{40}$/.test(approvedCommit)?approvedCommit:null});
  if(mode==='publish'){
   equal(approval,'SÍ','Variable de aprobación incorrecta');equal(approvedCommit,SHA,'Variable SHA incorrecta');equal(ci.status,'completed','CI incompleta');equal(ci.conclusion,'success','CI no aprobada');
   execFileSync('python3',['scripts/production_approval_guard.py'],{env:{...process.env,INTAP_ENFORCE_PRODUCTION_APPROVAL:'1',INTAP_PRODUCTION_APPROVAL:'SÍ',INTAP_APPROVED_COMMIT:SHA},stdio:'inherit'});
  }
  equal(git('rev-parse','HEAD:functions'),'034acf3d90ea40fe7262b39942d6a6e58c8c4ea1','Árbol Functions distinto');
  equal(git('rev-parse',prev.commit+':functions'),'034acf3d90ea40fe7262b39942d6a6e58c8c4ea1','Functions del App histórico distintas');
  const tracked=git('ls-tree','-r','--name-only','HEAD','--','functions/').split('\n').filter(Boolean).sort();
  function actualFiles(dir){return readdirSync(dir).sort().flatMap(n=>{const p=dir+'/'+n,stat=lstatSync(p);if(stat.isSymbolicLink())fail('Symlink inesperado '+p);if(stat.isDirectory())return actualFiles(p);if(!stat.isFile())fail('Archivo no regular '+p);return [p]})}
  equal(JSON.stringify(actualFiles('functions').sort()),JSON.stringify(tracked),'Archivos Functions locales extra o faltantes');
  for(const p of tracked)equal(git('hash-object','--no-filters',p),git('rev-parse','HEAD:'+p),'Functions local distinta '+p);
  for(const p of ['wrangler.toml','wrangler.json','wrangler.jsonc'])if(existsSync(p))fail('Configuración Wrangler raíz inesperada: '+p);
  console.log('PASS: main exacto, candidato idéntico, allowlist y Functions históricas; CI main '+ci.status+'/'+ci.conclusion);
 }
 try{
  if(!['preflight','publish'].includes(mode))fail('Modo inválido: preflight o publish.');
  localGuard();
  for(const p of ['scripts/test-kawvo-free-g2-qa-corrections-2026-11-15.mjs','scripts/test-kawvo-g5-publication-navigation-2026-11-15.mjs','scripts/test-intapcard-active-account-contract.mjs','scripts/test-intapcard-multiaccount-contract.mjs','scripts/test-intapcard-kawmed-integrated-contract.mjs','scripts/test-kawmed-isolation-contract.mjs'])execFileSync('node',[p],{stdio:'inherit'});
  // Obtain the same authenticated session used by the audited baseline.
  const account=existingAccount(),headers=existingCredentials();equal(account.toLowerCase(),'adf4d5ebb625fed2c32e38cef57a6319','Cuenta Cloudflare distinta');
  async function deployment(id){const res=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+'/pages/projects/intap-web2/deployments/'+id,{headers,signal:AbortSignal.timeout(30000)});const b=await res.json().catch(()=>null);if(!res.ok||b?.success!==true||b.result?.id!==id)fail('GET deployment App no verificable');return b.result}
  function validateMeta(d,branch,commit,env){
   if(!d)fail('Deployment ausente');const m=d.deployment_trigger?.metadata;
   equal(d.environment,env,'Entorno incorrecto');equal(m?.branch,branch,'Rama Pages incorrecta');equal(m?.commit_hash,commit,'Commit Pages incorrecto');equal(m?.commit_dirty,false,'Metadata dirty no es false');equal(d.latest_stage?.status,'success','Deployment no exitoso');equal(d.uses_functions,true,'Pages Functions históricas ausentes o no verificables');
   if(!/^https:\/\/[a-f0-9]{8,40}\.intap-web2\.pages\.dev\/?$/.test(d.url))fail('Origen App inmutable no reconocido');
  }
  async function canonical(x){
   const p=await getProject(account,headers,x.name),d=p.canonical_deployment,m=d?.deployment_trigger?.metadata;
   equal(p.production_branch,'main','Production branch cambió '+x.name);equal(p.source?.config?.production_deployments_enabled,false,'Auto-deploy no desactivado '+x.name);
   equal(d?.id,x.id,'Deployment cambió '+x.name);equal(d?.environment,'production','Entorno incorrecto '+x.name);equal(m?.branch,'main','Rama incorrecta '+x.name);equal(m?.commit_hash,x.commit,'Commit cambió '+x.name);equal(m?.commit_dirty,false,'Deployment dirty '+x.name);equal(d?.latest_stage?.status,'success','Deployment no exitoso '+x.name);equal(normal(d.url),x.url,'Origen cambió '+x.name);
   bundleAt(x.domain,x.route,x.bundle,x.hash);bundleAt(x.url,x.route,x.bundle,x.hash);
   return d;
  }
  const approvedPreviewLog=join(homedir(),'intap-release-logs','kawvo-g2-qa-preview-YCebsrKG');
  const evidence=JSON.parse(readFileSync(join(approvedPreviewLog,'published-owner.json'),'utf8'));
  equal(evidence.commit,CAND,'Preview aprobado SHA distinto');equal(evidence.environment,'preview','Preview entorno distinto');equal(evidence.branch,'qa-kawmed-guest-current-2026-11-02','Preview rama distinta');equal(evidence.alias,'https://qa-kawmed-guest-current-2026.intap-web2.pages.dev','Preview alias distinto');equal(evidence.status,'success','Preview evidencia no exitosa');
  const origin=normal(evidence.stage);if(!/^https:\/\/[a-f0-9]{8,40}\.intap-web2\.pages\.dev$/.test(origin))fail('Preview origen inmutable inválido');
  const previewAsset=asset(readFileSync(join(approvedPreviewLog,'served.html'))),previewHash=sha256(readFileSync(join(approvedPreviewLog,'served.js')));
  const previewPairs=[['https://app.preview.intaprd.com',origin,'/admin/login'],[evidence.alias,origin,'/admin/login']];
  const webLog=readFileSync(join(homedir(),'intap-release-logs','kawvo-g2-4-pages-A6GfUYz0','web-publish.log'),'utf8');
  const webRef=webLog.match(/https:\/\/[0-9a-f]{8,}\.intap-link\.pages\.dev/g)?.pop();
  if(!webRef)fail('Falta referencia Web Preview G2.4');
  previewPairs.push(['https://preview.intaprd.com',webRef,'/']);
  function protectedSurfaces(){
   const out=[];
   for(const [host,ref,route] of previewPairs){const a=ref===origin?bundleAt(ref,route,previewAsset,previewHash):bundleAt(ref,route);bundleAt(host,route,a.bundle,a.sha256);out.push({host,origin:ref,...a})}
   for(const [name,id] of [['intap-api','3d4973e4-e344-493a-a065-93f199b00359'],['intap-api-preview','23405a5b-e9ca-4247-843d-28cc4f236eaa']]){
    const v=JSON.parse(run('npx',['--no-install','wrangler','deployments','status','--name',name,'--json'])).versions;
    if(!Array.isArray(v)||v.length!==1||v[0].version_id!==id||Number(v[0].percentage)!==100)fail('Worker cambió '+name);
    out.push({worker:name,version:id,percentage:100})
   }
   return JSON.stringify(out)
  }
  // Check effective security headers of the immutable App with and without the new frontend.
  function securityHeaders(host,route){
   const h=run('curl',['-fsS','--connect-timeout','10','--max-time','35','-D','-','-o','/dev/null',host+route]);
   const result={};for(const k of ['x-content-type-options','x-frame-options','referrer-policy','permissions-policy','content-security-policy']){
    const line=h.split(/\r?\n/).find(x=>x.toLowerCase().startsWith(k+':'));result[k]=line?line.slice(k.length+1).trim():null;
   }
   if(result['x-content-type-options']!=='nosniff'||result['x-frame-options']!=='DENY')fail('Cabeceras históricas App no verificables '+host);
   return JSON.stringify(result)
  }
  phase='baseline';
  validateMeta(await canonical(prev),'main',prev.commit,'production');await canonical(web);
  const rollback=await deployment(prev.id);validateMeta(rollback,'main',prev.commit,'production');equal(normal(rollback.url),prev.url,'Rollback distinto');
  const historicalHeaders=securityHeaders(prev.url,prev.route);const domainHeaders=securityHeaders(prev.domain,prev.route);
  const protectedBefore=protectedSurfaces();save('baseline.json',{app:prev,web,functionsTree:'034acf3d90ea40fe7262b39942d6a6e58c8c4ea1',historicalHeaders:JSON.parse(historicalHeaders),domainHeaders:JSON.parse(domainHeaders),protected:JSON.parse(protectedBefore)});
  console.log('PASS: rollback disponible, App/Web productivos y Preview/Workers preservados');
  phase='build';
  if(!existsSync('node_modules'))fail('Dependencias locales no disponibles');
  const build=execFileSync('npm',['run','app:build'],{stdio:['ignore','pipe','pipe'],maxBuffer:64*1024*1024});writeFileSync(join(log,'build.log'),build,{mode:0o600});
  equal(asset(readFileSync('app/dist/index.html')),approvedAsset,'Nombre de bundle diferente al aprobado');equal(sha256(readFileSync('app/dist'+approvedAsset)),approvedHash,'Hash de bundle diferente al aprobado');
  // Match the historical App Pages deployment: upload app/dist from repo root with the exact unchanged root functions/.
  for(const p of ['app/functions','app/dist/_worker.js','app/dist/functions'])if(existsSync(p))fail('Functions inesperadas '+p);
  function manifest(dir,prefix=''){return readdirSync(dir).sort().flatMap(n=>{const f=join(dir,n),p=prefix+n,stat=lstatSync(f);if(stat.isSymbolicLink())fail('Symlink inesperado en dist');return stat.isDirectory()?manifest(f,p+'/'):[p+':'+sha256(readFileSync(f))]})}
  const dist=JSON.stringify(manifest('app/dist'));save('artifact.json',{commit:SHA,bundle:approvedAsset,hash:approvedHash,manifest:JSON.parse(dist)});
  console.log('PASS: artefacto production-mode idéntico al candidato G2 aceptado (no publicado)');
  phase='stage-revalidation';
  const stageLog=join(homedir(),'intap-release-logs','kawvo-free-g2-qa-production-stage-ndTvZ5','stage-pass.json');
  const st=JSON.parse(readFileSync(stageLog,'utf8'));
  equal(st.stageId,'c531e061-dd26-40c2-9253-0f5cd8883e7c','Stage ID distinto');equal(st.stageUrl,'https://c531e061.intap-web2.pages.dev','Stage URL distinta');equal(st.commit,CAND,'Stage SHA distinto');equal(st.base,OLD,'Stage base distinta');equal(st.tree,TREE,'Stage tree distinto');equal(st.appTree,APP_TREE,'Stage App tree distinto');equal(st.bundle,approvedAsset,'Stage bundle distinto');equal(st.hash,approvedHash,'Stage hash distinto');equal(st.rollback,prev.id,'Stage rollback distinto');equal(st.previewOrigin,origin,'Preview origen distinto');equal(st.previewAsset,previewAsset,'Preview asset distinto');equal(st.previewHash,previewHash,'Preview hash distinto');equal(JSON.stringify(st.manifest),dist,'Manifest Stage distinto del build actual');
  const stage=await deployment(st.stageId);validateMeta(stage,STAGE,CAND,'preview');equal(normal(stage.url),st.stageUrl,'Stage URL distinta');bundleAt(st.stageUrl,'/admin/login',approvedAsset,approvedHash);equal(securityHeaders(st.stageUrl,'/admin/login'),historicalHeaders,'Cabeceras Stage cambiaron');
  localGuard();await canonical(prev);await canonical(web);equal(protectedSurfaces(),protectedBefore,'Superficie protegida cambió');
  if(mode==='preflight'){
   save('preflight-pass.json',{commit:SHA,candidate:CAND,tree:TREE,appTree:APP_TREE,stageId:st.stageId,stageUrl:st.stageUrl,bundle:approvedAsset,hash:approvedHash,manifest:JSON.parse(dist),rollback:prev.id});
   console.log('PASS G2 POST-MERGE PREFLIGHT: Stage, hashes, rollback y superficies protegidas intactos. SIN DEPLOY. LOG: '+log);return;
  }
  phase='production-upload';uploadAttempted=true;
  const raw=execFileSync('npx',['--no-install','wrangler','pages','deploy','app/dist','--project-name','intap-web2','--branch','main','--commit-hash',SHA,'--commit-dirty=false'],{cwd:root,stdio:['ignore','pipe','pipe'],maxBuffer:64*1024*1024});
  const out=raw.toString('utf8');writeFileSync(join(log,'production.log'),out,{mode:0o600});const url=out.match(/https:\/\/[a-f0-9]{8,40}\.intap-web2\.pages\.dev/g)?.pop();if(!url)fail('No se obtuvo URL inmutable; no repetir upload');
  phase='post-deploy';
  const post=await retry(async()=>{const p=await getProject(account,headers,'intap-web2'),d=p.canonical_deployment;equal(p.production_branch,'main','Rama productiva distinta');equal(p.source?.config?.production_deployments_enabled,false,'Auto-deploy cambió');validateMeta(d,'main',SHA,'production');equal(normal(d.url),url,'Deployment canónico no corresponde al upload');if(d.id===prev.id)fail('Deployment anterior sigue activo');bundleAt(url,'/admin/login',approvedAsset,approvedHash);for(const route of ['/admin/login','/admin/free','/admin/free?legacy=1','/admin/free/agenda'])bundleAt(prev.domain,route,approvedAsset,approvedHash);equal(securityHeaders(url,'/admin/login'),historicalHeaders,'Cabeceras App inmutable cambiaron');equal(securityHeaders(prev.domain,'/admin/login'),domainHeaders,'Cabeceras dominio App cambiaron');return d});
  await canonical(web);equal(protectedSurfaces(),protectedBefore,'Superficie protegida cambió');equal(JSON.stringify(manifest('app/dist')),dist,'Artefacto cambió');
  save('release-pass.json',{commit:SHA,candidate:CAND,stageId:st.stageId,deploymentId:post.id,url,bundle:approvedAsset,hash:approvedHash,rollback:prev.id});console.log('PASS APP PRODUCTION: '+url+' | '+post.id+' | '+SHA);console.log('QA autenticada pendiente. LOG: '+log);
 }catch(e){save('blocked.json',{phase,uploadAttempted,rollbackId:prev.id});console.error('BLOCKED '+phase+': '+(String(e.message||e).split('\n')[0].slice(0,200)));if(uploadAttempted)console.error('NO REPETIR UPLOAD. Revisar estado real y rollback exclusivamente App: '+prev.id);process.exitCode=1}
}
await release()
