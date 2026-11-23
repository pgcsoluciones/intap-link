// Default prepares locally; --check-auth reads only; --stage uploads a version, never traffic.
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {existsSync,mkdirSync,readFileSync,writeFileSync,symlinkSync} from 'node:fs'
import {homedir} from 'node:os'
import {dirname,join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'

export const CANDIDATE='e9b1aa11189fe43e928ba26802e2f5f34fd5baa4'
export const ACTIVE='23405a5b-e9ca-4247-843d-28cc4f236eaa'
export const WORKER='intap-api-preview'
export const SNAPSHOT=join(homedir(),'intap-release-logs/g7-pinned-read-ofwQf8Wa/active-version.private.json')
export const CREATE='/workers/workers/'+WORKER+'/versions?deploy=false'
const runtime=['compatibility_date','compatibility_flags','limits','placement','cache_options','usage_model','exports']
const sha=x=>createHash('sha256').update(x).digest('hex')
const canonical=x=>JSON.stringify(sort(x))
function sort(x){return Array.isArray(x)?x.map(sort):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,sort(x[k])])):x}
function save(file,value){writeFileSync(file,JSON.stringify(value,null,2),{mode:0o600,flag:'wx'})}
const read=file=>JSON.parse(readFileSync(file,'utf8'))
function checked(condition,message){if(!condition)throw Error('BLOCKED: '+message)}
function orderedBindings(v){return [...v.bindings].sort((a,b)=>a.name.localeCompare(b.name))}
export function validateSnapshot(v){
 checked(v?.id===ACTIVE,'el snapshot no corresponde a la activa verificada')
 checked(v.bindings?.length===35&&new Set(v.bindings.map(b=>b.name)).size===35,'se requieren los 35 bindings únicos del snapshot')
 checked(v.modules?.length===1&&v.modules[0].name===v.main_module,'falta el módulo/entrypoint original de recuperación')
 checked(v.bindings.every(b=>typeof b.name==='string'&&b.type!=='inherit'),'bindings originales sin resolver')
 checked(v.bindings.some(b=>b.name==='ENVIRONMENT'&&b.type==='plain_text'&&b.text==='preview'),'snapshot fuera de Preview')
 checked(v.bindings.some(b=>b.name==='DB'&&b.type==='d1')&&v.bindings.some(b=>b.name==='BUCKET'&&b.type==='r2_bucket'),'faltan bindings D1/R2 existentes')
 checked(typeof v.compatibility_date==='string'&&v.compatibility_date.length>0,'falta compatibilidad efectiva')
 checked(!Object.keys(v.assets||{}).length&&!v.containers?.length&&!Object.keys(v.migrations||{}).length,'assets/containers/migraciones requieren revisión; no se alteran')
 checked(Object.entries(v.exports||{}).every(([name,x])=>name==='default'&&x.type==='worker'&&(!x.state||x.state==='created')),'exports adicionales/lifecycle fuera de alcance')
}
export function payload(v,modules){
 validateSnapshot(v)
 checked(Array.isArray(modules)&&modules.length>0&&new Set(modules.map(m=>m.name)).size===modules.length,'módulos preparados vacíos/duplicados')
 const body={main_module:modules[0].name,modules,bindings:v.bindings.map(({name})=>({name,type:'inherit',version_id:ACTIVE})),annotations:{'workers/tag':CANDIDATE,'workers/message':'G7.1 Stage API; bindings pinned to verified active version; no traffic change'}}
 for(const key of runtime)if(v[key]!==undefined&&v[key]!==null)body[key]=structuredClone(v[key])
 return body
}
export function traffic(result){
 const d=result?.deployments?.[0]
 checked(typeof d?.id==='string'&&d.id.length>0&&d.versions?.length===1&&d.versions[0].version_id===ACTIVE&&Number(d.versions[0].percentage)===100,'la activa/tráfico cambió; no subir ni activar')
 return {id:d.id,versions:d.versions}
}
export function authenticate(client){
 // The pinned #171 reader snapshots OAuth before whoami. Wrangler may refresh
 // that session during whoami: read the same session again afterwards.
 const paths=()=>['Library/Preferences/.wrangler/config/default.toml','.wrangler/config/default.toml','.config/.wrangler/config/default.toml'].map(p=>join(client.home,p)).filter(existsSync)
 const before=process.env.CLOUDFLARE_API_TOKEN?null:paths()
 if(before)checked(before.length===1,'se requiere una única sesión Wrangler existente')
 client.credentials()
 if(!before)return {sessionReloaded:false}
 const after=paths();checked(after.length===1&&after[0]===before[0],'cambió el contexto de sesión Wrangler; detener')
 const token=readFileSync(after[0],'utf8').match(/^oauth_token\s*=\s*"([^"\r\n]+)"/m)?.[1]
 checked(token,'sesión Wrangler existente sin token legible después de whoami')
 const sessionReloaded=client.headers?.Authorization!=='Bearer '+token
 client.headers={Authorization:'Bearer '+token}
 return {sessionReloaded}
}
export async function authenticationPreflight(client){
 return traffic((await client.api('/workers/scripts/'+WORKER+'/deployments')).result)
}
export function verifyVersion(v,newVersion,modules){
 checked(newVersion.id!==ACTIVE&&/^[a-f0-9-]{36}$/i.test(newVersion.id||''),'ID Stage inválido')
 checked(newVersion.annotations?.['workers/tag']===CANDIDATE,'anotación SHA Stage incorrecta')
 checked(newVersion.main_module===modules[0].name&&newVersion.modules?.length===modules.length,'módulos Stage inesperados')
 for(const module of modules){const found=newVersion.modules.find(m=>m.name===module.name);checked(found&&Buffer.from(found.content_base64,'base64').equals(Buffer.from(module.content_base64,'base64')),'bytes Stage distintos; NO repetir upload')}
 checked(canonical(orderedBindings(v))===canonical(orderedBindings(newVersion)),'bindings resueltos distintos; NO activar')
 for(const key of runtime)checked(canonical(key==='compatibility_flags'?(v[key]||[]):(v[key]??null))===canonical(key==='compatibility_flags'?(newVersion[key]||[]):(newVersion[key]??null)),'runtime distinto: '+key+'; NO activar')
}
export async function uploadStage({directory,version,modules,client,fetch:request=globalThis.fetch}){
 const body=payload(version,modules),attempt=join(directory,'stage-attempt.json')
 checked(!existsSync(attempt),'existe intento anterior; revisar evidencia, no repetir upload')
 const before=await authenticationPreflight(client)
 save(join(directory,'traffic-before.json'),before)
 save(attempt,{candidate:CANDIDATE,inheritFrom:ACTIVE,operation:'stage-version-only',payloadSha256:sha(canonical(body)),startedAt:new Date().toISOString()})
 const response=await request('https://api.cloudflare.com/client/v4/accounts/'+client.account+CREATE,{method:'POST',headers:{...client.headers,'Content-Type':'application/json'},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(120000)})
 const posted=await response.json().catch(()=>null);save(join(directory,'stage-response.private.json'),posted)
 const codes=(posted?.errors||[]).map(x=>String(x.code)).filter(x=>/^\d+$/.test(x)).slice(0,3)
 checked(response.ok&&posted?.success===true&&/^[a-f0-9-]{36}$/i.test(posted.result?.id||''),'Stage HTTP '+response.status+' códigos='+codes.join(',')+'; NO repetir upload')
 const id=posted.result.id;checked(id!==ACTIVE,'respuesta Stage reutiliza ID activo')
 const uploaded=(await client.api('/workers/workers/'+WORKER+'/versions/'+id+'?include=modules')).result
 save(join(directory,'stage-version.private.json'),uploaded)
 const after=traffic((await client.api('/workers/scripts/'+WORKER+'/deployments')).result)
 save(join(directory,'traffic-after.json'),after)
 checked(canonical(before)===canonical(after),'deployment activo cambió durante Stage; detener')
 verifyVersion(version,uploaded,modules)
 const receipt={result:'PASS',operation:'Stage API only; not activated',candidate:CANDIDATE,version:id,inheritFrom:ACTIVE,bindings:35,modules:modules.map(m=>({name:m.name,sha256:sha(Buffer.from(m.content_base64,'base64'))})),trafficUnchanged:true,binaryEqualityWithDocumentedSource:false,remoteRollbackRehearsed:false}
 save(join(directory,'stage-pass.json'),receipt);return receipt
}
export async function main(args=process.argv.slice(2),{root=process.cwd(),snapshot=SNAPSHOT}={}){
 process.umask(0o077)
 checked(process.version==='v20.20.2','se requiere Node 20.20.2 existente')
 checked(args.length<=1&&args.every(x=>['--stage','--check-auth'].includes(x)),'usar --check-auth o --stage por separado; por defecto prepara localmente')
 root=resolve(root);snapshot=resolve(snapshot)
 const folder=dirname(snapshot),version=read(snapshot),directory=join(folder,'stage-api-'+CANDIDATE.slice(0,12))
 validateSnapshot(version)
 const git=(...a)=>execFileSync('git',a,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
 checked(git('status','--porcelain')==='','checkout con cambios ajenos; no se modifica')
 checked(git('rev-parse',CANDIDATE+'^{commit}')===CANDIDATE,'falta objeto del candidato exacto')
 git('diff','--exit-code','HEAD',CANDIDATE,'--','package.json','package-lock.json','api/package.json')
 const source=join(directory,'source'),bundle=join(directory,'prepared-modules.private.json'),prepared=join(directory,'prepared.json')
 if(args.includes('--check-auth'))checked(existsSync(prepared),'--check-auth requiere el paquete existente; no recompila')
 if(existsSync(directory)){
  checked(existsSync(prepared)&&!existsSync(join(directory,'stage-attempt.json')),'preparación incompleta o intento previo; no repetir')
  const record=read(prepared);checked(record.candidate===CANDIDATE&&record.snapshotSha256===sha(readFileSync(snapshot))&&record.bundleSha256===sha(readFileSync(bundle)),'artefacto/snapshot cambió')
 }else{
  mkdirSync(directory,{mode:0o700});mkdirSync(source,{mode:0o700})
  execFileSync('tar',['-x','-C',source],{input:execFileSync('git',['archive',CANDIDATE,'api/src','api/tsconfig.json','api/package.json','shared'],{maxBuffer:64*1024*1024}),stdio:['pipe','pipe','pipe']})
  for(const rel of ['node_modules','api/node_modules'])symlinkSync(join(root,rel),join(source,rel),'dir')
  const config=join(directory,'build-only.json'),form=join(directory,'compiled-form.private.bin')
  save(config,{name:WORKER,main:join(source,'api/src/preview-frontdoor-entry.ts'),compatibility_date:version.compatibility_date.slice(0,10),compatibility_flags:version.compatibility_flags||[]})
  try{const output=execFileSync(join(root,'node_modules/.bin/wrangler'),['versions','upload','--dry-run','--config',config,'--outdir',join(directory,'bundle'),'--outfile',form],{cwd:source,encoding:'utf8',stdio:['ignore','pipe','pipe'],env:{...process.env,WRANGLER_SEND_METRICS:'false',WRANGLER_LOG_PATH:join(directory,'wrangler.private.log')}});writeFileSync(join(directory,'build.private.log'),output,{mode:0o600})}catch(error){writeFileSync(join(directory,'build.private.log'),String(error.stdout||'')+String(error.stderr||''),{mode:0o600});throw Error('BLOCKED: compilación local; revisar build.private.log, no se subió código')}
  const bytes=readFileSync(form),boundary=bytes.subarray(0,bytes.indexOf('\r\n')).toString().slice(2)
  const parts=await new Response(bytes,{headers:{'content-type':'multipart/form-data; boundary='+boundary}}).formData(),metadata=JSON.parse(String(parts.get('metadata'))),modules=[]
  for(const [name,file] of parts)if(name!=='metadata'){checked(typeof file!=='string','parte de módulo no binaria');modules.push({name,content_type:file.type,content_base64:Buffer.from(await file.arrayBuffer()).toString('base64')})}
  checked(modules.some(m=>m.name===metadata.main_module),'bundle sin main_module');modules.sort((a,b)=>a.name===metadata.main_module?-1:b.name===metadata.main_module?1:a.name.localeCompare(b.name))
  save(bundle,modules)
  save(prepared,{candidate:CANDIDATE,snapshotSha256:sha(readFileSync(snapshot)),bundleSha256:sha(readFileSync(bundle)),compiler:'existing Wrangler versions upload --dry-run; no historical TOML'})
 }
 const modules=read(bundle);saveIfMissing(join(directory,'payload.private.json'),payload(version,modules))
 if(!args.length){console.log('PASS preparación local; sin HTTP. Evidencia privada: '+directory);return}
 const utility=join(folder,'kawmed-g3-1-pages.mjs'),utilityBytes=readFileSync(utility)
 checked(createHash('sha1').update('blob '+utilityBytes.length+'\0').update(utilityBytes).digest('hex')==='bc33561fbcd906172502bc558df427d952ea6fab','lector #171 difiere del helper verificado')
 const {Runner}=await import(pathToFileURL(utility).href),client=new Runner({root}),auth=authenticate(client)
 if(args.includes('--check-auth')){
  await authenticationPreflight(client)
  const receipt={result:'PASS',operation:'authentication read only; no upload',candidate:CANDIDATE,active:ACTIVE,...auth,packageReused:true,preparedSha256:sha(readFileSync(prepared)),bundleSha256:sha(readFileSync(bundle)),checkedAt:new Date().toISOString()}
  save(join(directory,'auth-check-'+Date.now()+'.json'),receipt);console.log(JSON.stringify(receipt,null,2));return
 }
 const receipt=await uploadStage({directory,version,modules,client});console.log(JSON.stringify({...receipt,evidence:directory},null,2))
}
function saveIfMissing(file,value){if(existsSync(file))checked(canonical(read(file))===canonical(value),'payload preparado distinto');else save(file,value)}
if(process.argv[1]==='-'||(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url))main().catch(error=>{try{const file=join(dirname(SNAPSHOT),'stage-api-'+CANDIDATE.slice(0,12),'error.private.txt');if(existsSync(dirname(file)))writeFileSync(file,String(error.stack||error),{mode:0o600,flag:'wx'})}catch{}console.error(String(error.message||'').startsWith('BLOCKED:')?error.message:'BLOCKED: fallo local/API; conservar evidencia privada y NO repetir Stage.');process.exitCode=1})
