#!/usr/bin/env node
// KAW-G8 P0: inspect whether the *native* Wrangler version upload can safely replace
// the failed custom Beta JSON POST. READ-ONLY: only GET / local inspection.
// No writes to Cloudflare, GitHub, D1, R2, or checkout.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const ROOT=join(homedir(),'Desktop/kawvo-g8-production-main');
const G8='71dd92b870482427d8576e68d89c3167bcfe8f12';
const APPROVED_MAIN='c846d0e5e1b9dec310f5a037bf91a400791b7267';
const BASELINE='3d4973e4-e344-493a-a065-93f199b00359';
const LATEST_AT_FAILURE='1972228c-4dd7-4ede-9d94-8338132b3b20';
const EXPECTED_BUNDLE='f465c714f3a5b4b3627d58797be32621c674e7056e27ff4c36fbf8e09e96fbd6';
const hash=x=>createHash('sha256').update(x).digest('hex');
const check=(ok,s)=>{if(!ok)throw Error('BLOCKED: '+s)};
const git=(...a)=>execFileSync('git',a,{cwd:ROOT,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:15000}).trim();
const normalized=v=>JSON.stringify(v,Object.keys(v||{}).sort());
const sig=b=>(b||[]).map(x=>x.name+':'+x.type).sort();
const safePrint=(k,v)=>console.log(k+'='+v);
async function get(reader,url){return reader.get(url)}
async function main(){
 check(process.argv.length===2,'no arguments accepted');
 check(git('rev-parse','HEAD')===G8,'frozen G8 checkout SHA drift');
 check(git('status','--porcelain','--untracked-files=no')==='','tracked source checkout dirty');
 const lock=hash(readFileSync(join(ROOT,'package-lock.json')));
 check(lock==='28e4a1fd70b83e419cb88605b86c86784808546d3bcd527eb034350c4591aa27','lockfile drift');
 const inspector=await import(pathToFileURL(join(ROOT,'scripts/inspect-kawvo-g8-readonly.mjs')).href);
 const reader=inspector.credentials(ROOT);
 const ep='/accounts/'+reader.account+'/workers';
 const deploy=(await get(reader,ep+'/scripts/intap-api/deployments'))?.deployments?.[0];
 check(deploy?.versions?.length===1&&deploy.versions[0]?.version_id===BASELINE&&Number(deploy.versions[0]?.percentage)===100,'active production API changed; halt');
 // The Beta version list is necessary because script-upload inheritance follows
 // latest, while the failed Beta POST explicitly pinned G8.6.
 const response=await fetch('https://api.cloudflare.com/client/v4'+ep+'/scripts/intap-api/versions?per_page=1',
  {method:'GET',redirect:'error',headers:{Authorization:reader.authorization},signal:AbortSignal.timeout(30000)});
 const body=await response.json().catch(()=>null);
 check(response.ok&&body?.success===true,'read-only latest version GET failed HTTP '+response.status);
 const rows=Array.isArray(body.result)?body.result:body.result?.items||body.result?.versions;
 check(Array.isArray(rows)&&rows.length>0,'unknown latest version response');
 const latest=rows[0].id;
 check(latest===LATEST_AT_FAILURE,'latest version changed since rejected upload; human review first');
 const baseline=await get(reader,ep+'/workers/intap-api/versions/'+BASELINE+'?include=modules');
 const latestVersion=await get(reader,ep+'/workers/intap-api/versions/'+latest+'?include=modules');
 inspector.versionSummary(baseline,'intap-api');
 inspector.versionSummary(latestVersion,'intap-api');
 const oldBindings=sig(baseline.bindings),newBindings=sig(latestVersion.bindings);
 const sameBindings=normalized(oldBindings)===normalized(newBindings);
 safePrint('SOURCE_G8_SHA',G8);
 safePrint('APPROVED_MAIN_SHA',APPROVED_MAIN);
 safePrint('ACTIVE_G8_6_VERSION',BASELINE);
 safePrint('LATEST_UPLOADED_VERSION',latest);
 safePrint('BASELINE_BINDINGS_COUNT',oldBindings.length);
 safePrint('LATEST_BINDINGS_COUNT',newBindings.length);
 safePrint('BINDING_NAMES_AND_TYPES_EQUAL',sameBindings);
 safePrint('EXPECTED_APPROVED_MAC_BUNDLE_SHA256',EXPECTED_BUNDLE);
 safePrint('NATIVE_UPLOAD_AVAILABLE_IN_REPO','api/wrangler.toml + wrangler versions upload');
 safePrint('REMOTE_WRITES',0);
 safePrint('TRAFFIC_CHANGES',0);
 if(!sameBindings)throw Error('BLOCKED: latest upload bindings differ; Wrangler strict latest inheritance cannot be assumed safe');
 // Equal names/types do NOT certify secret values, settings, unversioned routes,
 // crons, nor ability to upload. This tool cannot authorize a stage operation.
 console.log('PASS_READONLY_NATIVE_PATH_PRECHECK');
 console.log('NO_GO_STAGE: requires reviewed native Wrangler dry-run, baseline/latest effective-binding verification and separate one-time authorization');
}
main().catch(e=>{console.error(e.message?.startsWith('BLOCKED:')?e.message:'BLOCKED: read-only precheck failed (details redacted)');process.exitCode=1});
