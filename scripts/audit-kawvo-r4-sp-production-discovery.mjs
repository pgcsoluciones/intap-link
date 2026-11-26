// Read-only production SEO/GEO baseline. Existing auditor runs in a private directory.
import {execFileSync,spawnSync} from 'node:child_process'
import {existsSync,readFileSync,mkdirSync,mkdtempSync,writeFileSync} from 'node:fs'
import {homedir,tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
process.umask(0o077)
const CANDIDATE='168b42106bb9e1034801a217b6f574b48cc04a6d',MAIN='e28b934a61c669ed270a656ae42cf68c1b518a82',DB='3a2d724d-5938-4777-a63e-423bb41862c0'
const ROOT=process.cwd(),LOG=join(homedir(),'intap-release-logs'),remote='https://github.com/pgcsoluciones/intap-link.git'
const BASE='https://api.cloudflare.com/client/v4/accounts/adf4d5ebb625fed2c32e38cef57a6319'
const check=(ok,msg)=>{if(!ok)throw Error('BLOCKED: '+msg)}
const git=(...args)=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
const sha=b=>createHash('sha256').update(b).digest('hex')
let token
function auth(){
 execFileSync('npx',['--yes','--package=wrangler@4.166.0','--','wrangler','whoami'],{cwd:tmpdir(),stdio:'pipe',env:{...process.env,WRANGLER_SEND_METRICS:'false'}})
 const f=['Library/Preferences/.wrangler/config/default.toml','.wrangler/config/default.toml','.config/.wrangler/config/default.toml'].map(x=>join(homedir(),x)).filter(existsSync)
 check(f.length===1,'sesión Wrangler ambigua')
 const t=readFileSync(f[0],'utf8').match(/^oauth_token\s*=\s*"([^"\r\n]+)"/m)?.[1];check(t,'sesión ausente');return 'Bearer '+t
}
const queries={
 cols:"SELECT name FROM pragma_table_info('profile_contact')",
 pcols:"SELECT name FROM pragma_table_info('profiles')",
 sponsored:"SELECT username AS slug FROM sponsored_profiles WHERE status='published' ORDER BY username",
 inventory:"SELECT p.id AS profile_id,p.slug,p.name,p.plan_id,p.template_id,c.address FROM profiles p LEFT JOIN profile_contact c ON c.profile_id=p.id WHERE p.is_active=1 AND p.is_published=1 ORDER BY p.slug"
}
async function request(path,sql){
 check(sql?path==='/d1/database/'+DB+'/query'&&Object.values(queries).includes(sql)&&sql.startsWith('SELECT '):['/workers/scripts/intap-api/deployments','/pages/projects/intap-web2','/pages/projects/intap-link','/d1/database/'+DB].includes(path),'operación fuera de lectura')
 const send=()=>fetch(BASE+path,{method:sql?'POST':'GET',headers:{Authorization:token,...(sql?{'Content-Type':'application/json'}:{})},body:sql?JSON.stringify({sql}):undefined,redirect:'error',signal:AbortSignal.timeout(30000)})
 let r=await send();if(r.status===401){await r.arrayBuffer();token=auth();r=await send()}const j=await r.json().catch(()=>null);check(r.ok&&j?.success===true,'Cloudflare HTTP '+r.status);return j.result
}
async function query(name){const r=await request('/d1/database/'+DB+'/query',queries[name]);check(r?.length===1&&r[0].success===true&&r[0].meta?.changed_db===false&&Number(r[0].meta.rows_written||0)===0&&Number(r[0].meta.changes||0)===0,'SELECT no acreditado '+name);return r}
async function baseline(){
 const w=await request('/workers/scripts/intap-api/deployments');const vs=w.deployments?.[0]?.versions
 check(vs?.length===1&&vs[0].version_id==='766e8d93-260c-4fb7-841c-a833515bf9d6'&&Number(vs[0].percentage)===100,'Worker productivo cambió')
 for(const [name,id] of [['intap-web2','166657db-e27e-4a5b-9396-1232aa4d0fd0'],['intap-link','f4c4990d-98ed-42a3-a989-cd082a7168f4']]){
 const p=await request('/pages/projects/'+name);check(p.canonical_deployment?.id===id&&p.source?.config?.production_deployments_enabled===false,'Pages cambió '+name)
 }
}
let dir
try{
 check(process.argv.length===2,'solo lectura, sin argumentos')
 check(git('status','--porcelain')==='','checkout sucio')
 check(git('rev-parse',CANDIDATE+'^{commit}')===CANDIDATE,'candidato ausente')
 check(git('ls-remote',remote,'refs/heads/main').split(/\s+/)[0]===MAIN,'main cambió')
 check(git('ls-remote',remote,'refs/heads/release/kawvo-r4-sp-production-2026-11-26').split(/\s+/)[0]===CANDIDATE,'candidato cambió')
 const prev=JSON.parse(readFileSync(join(LOG,'r4-sp-production-preflight-sKDItz','report.json'),'utf8'))
 check(prev.result==='PROD_PREFLIGHT_REVIEW_REQUIRED'&&prev.blockers?.length===1&&prev.blockers[0]==='Proveniencia Pages requiere reconciliación intap-link'&&prev.migrationState==='ABSENT_EXPECTED','recibo preflight distinto')
 git('diff','--exit-code','1751bb55a2aae1f0f390708c526241bc6a17de5d',MAIN,'--','api','web','functions','shared','package.json','package-lock.json')
 token=auth();await baseline()
 const db=await request('/d1/database/'+DB);check(db.uuid===DB&&db.name==='intap_db','D1 productiva distinta')
 const ccols=(await query('cols'))[0].results.map(x=>x.name),pcols=(await query('pcols'))[0].results.map(x=>x.name)
 // Only existing, known geographic field names; never invent data or query private medical records.
 const fields=['latitude','longitude','city','country','map_url','hours'].map(k=>ccols.includes(k)?'c.'+k+' AS '+k:pcols.includes(k)?'p.'+k+' AS '+k:null).filter(Boolean)
 queries.inventory=queries.inventory.replace('c.address FROM','c.address'+(fields.length?','+fields.join(','):'')+' FROM')
 const inventory=await query('inventory'),sponsored=(await query('sponsored'))[0].results
 check(inventory[0].results.length>0,'inventario vacío')
 mkdirSync(LOG,{recursive:true,mode:0o700});dir=mkdtempSync(join(LOG,'r4-sp-production-discovery-'))
 const input=join(dir,'inventory.private.json'),out=join(dir,'profiles.private.json')
 writeFileSync(input,JSON.stringify(inventory),{mode:0o600})
 const source=git('show',CANDIDATE+':scripts/audit_production_profiles.py')
 // Reuse original contract checks, redirect only local output paths (no checkout writes).
 check(source.includes('"/tmp/intap-production-profiles.json"')&&source.includes('"contracts/protected-profiles.production.json"'),'auditor original cambió')
 const local=source.replace('"/tmp/intap-production-profiles.json"',JSON.stringify(input)).replace('"contracts/protected-profiles.production.json"',JSON.stringify(out))
 const py=spawnSync('python3',['-c',local],{cwd:dir,encoding:'utf8',maxBuffer:8*1024*1024})
 writeFileSync(join(dir,'audit.private.log'),(py.stdout||'')+'\n'+(py.stderr||''),{mode:0o600})
 check([0,2].includes(py.status)&&existsSync(out),'auditor no completó')
 const result=JSON.parse(readFileSync(out,'utf8'))
 check(result.profiles?.length===inventory[0].results.length,'auditoría incompleta')
 const checks=[]
 for(const {slug} of sponsored){
  if(typeof slug!=='string'||!/^[a-z0-9][a-z0-9-]{2,29}$/.test(slug)){checks.push({slug:slug||null,errors:['slug inválido']});continue}
  const url='https://intaprd.com/p/'+encodeURIComponent(slug)
  const one={slug,errors:[]}
  try{
   const r=await fetch(url,{headers:{'User-Agent':'Twitterbot/1.0','Cache-Control':'no-cache'},redirect:'manual',signal:AbortSignal.timeout(30000)}),html=await r.text()
   one.status=r.status;one.htmlSha256=sha(html)
   if(r.status!==200)one.errors.push('HTTP '+r.status)
   const meta=k=>{const key=k.replace(/[.*+?^$\{\}()|\[\]\\]/g,'\\$&');const a=html.match(new RegExp('<meta[^>]+(?:property|name)=["\\x27]'+key+'["\\x27][^>]+content=["\\x27]([^"\\x27]*)','i'));return a?.[1]||''}
   for(const k of ['og:title','og:description','og:url','og:image','twitter:card','twitter:image'])if(!meta(k))one.errors.push('falta '+k)
   if(meta('og:url').replace(/\/$/,'')!==url)one.errors.push('OG URL distinta')
   if(!html.includes('rel="canonical" href="'+url+'"'))one.errors.push('canonical no acreditada')
   const api=await fetch('https://intaprd.com/api/v1/public/sponsored/'+encodeURIComponent(slug),{cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(30000)})
   const j=await api.json().catch(()=>null);one.apiStatus=api.status
   if(api.status!==200||j?.ok!==true||!j.data)one.errors.push('API pública no acreditada')
  }catch{one.errors.push('lectura incompleta')}
  checks.push(one)
 }
 await baseline()
 const report={result:result.audit?.passed&&checks.every(x=>!x.errors.length)?'PROD_DISCOVERY_BASELINE_PASS':'PROD_DISCOVERY_BASELINE_REVIEW_REQUIRED',candidate:CANDIDATE,linkProfiles:result.profiles.length,sponsoredProfiles:checks.length,linkIncidents:result.audit?.error_count,linkIssues:result.profiles.filter(p=>p.errors.length).map(p=>({slug:p.slug,errors:p.errors})),sponsoredIssues:checks.filter(x=>x.errors.length).map(x=>({slug:x.slug,errors:x.errors})),redirects:result.legacy_redirects.map(r=>({status:r.status,source:r.source})),globals:result.globals,freeKiB:Number(execFileSync('df',['-Pk',homedir()],{encoding:'utf8'}).trim().split('\n').pop().trim().split(/\s+/)[3]),evidence:dir,noRemoteWrites:true}
 writeFileSync(join(dir,'sponsored.private.json'),JSON.stringify(checks,null,2),{mode:0o600});writeFileSync(join(dir,'report.json'),JSON.stringify(report,null,2),{mode:0o600})
 console.log(JSON.stringify(report,null,2))
 if(report.result!=='PROD_DISCOVERY_BASELINE_PASS')process.exitCode=2
}catch(e){console.error(JSON.stringify({result:'PROD_DISCOVERY_BASELINE_BLOCKED',error:String(e?.message||'').startsWith('BLOCKED:')?e.message:'Error de lectura: '+(e?.code||e?.name||'Error'),evidence:dir,noRemoteWrites:true}));process.exitCode=1}
