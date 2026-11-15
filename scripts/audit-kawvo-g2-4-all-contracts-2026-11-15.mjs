#!/usr/bin/env node
// Diagnostic only: read local sources, run every independent contract, and collect
// all available failures. Never publishes or weakens any original contract.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const contracts=[
 'scripts/test-kawvo-free-shell-preview-isolation-2026-11-12.mjs',
 'scripts/test-kawvo-free-shell-desktop-parity-2026-11-12.mjs',
 'scripts/test-intapcard-active-account-contract.mjs',
 'scripts/test-kawvo-g2-free-direct-access-contract-2026-11-13.mjs',
 'scripts/test-kawvo-g2-free-return-list-contract-2026-11-13.mjs',
 'scripts/test-kawvo-g2-free-route-continuity-contract-2026-11-14.mjs',
 'scripts/test-kawvo-g2-free-preview-return-contract-2026-11-14.mjs',
 'scripts/test-free-contact-agenda-contract.mjs',
 'scripts/test-sponsored-profile-contract.mjs',
 'scripts/test-kawmed-isolation-contract.mjs'
]
const jobs=[
 ...['scripts/run-kawvo-g2-4-preview-return-local-qa-2026-11-14.sh','scripts/deploy-kawvo-g2-4-preview-return-pages-2026-11-14.sh'].map(path=>({name:'Sintaxis '+path,cmd:'bash',args:['-n',path]})),
 ...['scripts/audit-kawvo-g2-web-pages-alias-readonly-2026-11-14.mjs','scripts/assert-kawvo-g2-4-web-live-preservation-2026-11-15.mjs'].map(path=>({name:'Sintaxis '+path,cmd:process.execPath,args:['--check',path]})),
 {name:'Preservación exacta del Web activo',cmd:process.execPath,args:['scripts/assert-kawvo-g2-4-web-live-preservation-2026-11-15.mjs','529e58ec8ffae587ee02303ecfce2d569726a75d']},
 ...contracts.map(path=>({name:path,cmd:process.execPath,args:[path],contract:path}))
]
const options={encoding:'utf8',maxBuffer:8*1024*1024,timeout:120000}
const failures=[]
function diagnostic(path){
 // Only the two reviewed read-only literal contract suites. Run an ephemeral
 // in-memory diagnostic copy on failure, never alter or substitute real tests.
 if(!['scripts/test-free-contact-agenda-contract.mjs','scripts/test-sponsored-profile-contract.mjs'].includes(path))return
 const source=readFileSync(path,'utf8')
 const imports=source.split('\n').filter(line=>/^import /.test(line))
 if(imports.length!==1||imports[0]!=="import fs from 'node:fs'"){console.log('Diagnóstico ampliado no disponible: imports modificados');return}
 const prelude="const __issues=[];function __kawvoAuditRecord(message){__issues.push(String(message));console.error('INCONGRUENCIA: '+String(message))}\n"
 const diagnosticSource=prelude+source.replace(/\bthrow new Error\(/g,'__kawvoAuditRecord(')+"\nconsole.log('INCONGRUENCIAS DETECTADAS: '+__issues.length);\n"
 const result=spawnSync(process.execPath,['--input-type=module'],{...options,input:diagnosticSource})
 const lines=(result.stderr||'').split('\n').filter(line=>line.startsWith('INCONGRUENCIA: '))
 for(const line of lines)console.log(line)
 console.log('Diagnóstico ampliado: '+lines.length+' comprobaciones; resultados orientativos, no sustituyen el contrato original.')
 if(result.status!==0||result.error)console.log('Diagnóstico incompleto: '+(result.error?.message||result.stderr||'error de ejecución'))
}
for(const job of jobs){
 const result=spawnSync(job.cmd,job.args,options)
 if(result.status===0&&!result.error){console.log('PASS: '+job.name);continue}
 failures.push(job.name)
 console.log('\nFAIL: '+job.name)
 if(result.stdout)console.log(result.stdout)
 if(result.stderr)console.log(result.stderr)
 if(result.error)console.log(result.error.message)
 if(job.contract){try{diagnostic(job.contract)}catch(error){console.log('Diagnóstico ampliado no disponible: '+error.message)}}
}
console.log('\n=== RESUMEN AUDITORÍA G2.4 ===')
console.log('PASS: '+(jobs.length-failures.length)+' / '+jobs.length)
console.log('FAIL: '+failures.length)
for(const failure of failures)console.log('BLOQUEO: '+failure)
console.log('SIN DEPLOY: auditoría de contratos y sintaxis; preflight Cloudflare y builds se verifican aparte.')
if(failures.length)process.exitCode=1
