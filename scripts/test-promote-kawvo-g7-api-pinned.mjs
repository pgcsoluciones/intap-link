import assert from 'node:assert/strict';
import {test} from 'node:test';
import {deployment,validateReceipts,verifyCandidate,CANDIDATE,PRIOR,NEXT} from './promote-kawvo-g7-api-pinned.mjs';
const did='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const d=(version=PRIOR,percentage=100)=>({deployments:[{id:did,versions:[{version_id:version,percentage}]}]});
test('sólo acepta el Worker anterior al 100%',()=>{
 assert.equal(deployment(d()).version,PRIOR);
 assert.throws(()=>deployment(d(NEXT)),/BLOCKED/);
 assert.throws(()=>deployment(d(PRIOR,50)),/BLOCKED/);
 assert.throws(()=>deployment({deployments:[{id:did,versions:[{version_id:PRIOR,percentage:50},{version_id:NEXT,percentage:50}]}]}),/BLOCKED/);
});
test('requiere ambos recibos exactos',()=>{
 const api={result:'PASS',operation:'Stage API only; not activated',candidate:CANDIDATE,version:NEXT,inheritFrom:PRIOR,bindings:35,trafficUnchanged:true};
 const app={result:'PASS',candidate:CANDIDATE,apiStage:NEXT,protectedSurfacesUnchanged:true,deployment:{commit:CANDIDATE,branch:'qa-kawvo-g7-1-'+CANDIDATE.slice(0,12)}};
 assert.doesNotThrow(()=>validateReceipts(api,app));
 assert.throws(()=>validateReceipts({...api,trafficUnchanged:false},app),/BLOCKED/);
 assert.throws(()=>validateReceipts(api,{...app,protectedSurfacesUnchanged:false}),/BLOCKED/);
});
test('módulos, bindings y SHA de Stage deben concordar',()=>{
 const version={id:NEXT,annotations:{'workers/tag':CANDIDATE},main_module:'entry.js',modules:[{name:'entry.js',content_base64:Buffer.from('hello').toString('base64')}],bindings:Array.from({length:35},(_,i)=>({name:'B'+i,type:'plain_text',text:'v'+i})),compatibility_date:'2026-11-01'};
 assert.doesNotThrow(()=>verifyCandidate(version,structuredClone(version)));
 const changed=structuredClone(version);changed.modules[0].content_base64=Buffer.from('bad').toString('base64');
 assert.throws(()=>verifyCandidate(changed,version),/BLOCKED/);
 const bindings=structuredClone(version);bindings.bindings[0].text='wrong';
 assert.throws(()=>verifyCandidate(bindings,version),/BLOCKED/);
});
