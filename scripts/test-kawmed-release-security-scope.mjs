import fs from 'node:fs'
function assert(ok,message){if(!ok){console.error('FAIL '+message);process.exitCode=1}}
const artifacts=fs.readFileSync('app/src/components/admin/SuperAdminArtifacts.tsx','utf8')
const packageJson=JSON.parse(fs.readFileSync('app/package.json','utf8'))
const runner=fs.readFileSync('scripts/run-production-kawmed-v1-2026-10-22.sh','utf8')
const prodDir='api/migrations'
const paths=fs.readdirSync(prodDir).filter(name=>/^(?:009[0-9]|0150)_kawmed_/.test(name))
assert(packageJson.dependencies.xlsx,'xlsx dependency unexpectedly absent; review export implementation')
assert(artifacts.includes("XLSX.utils.json_to_sheet") && artifacts.includes("XLSX.writeFile"),'Excel export flow changed')
assert(!/XLSX\.(read|readFile)\s*\(/.test(artifacts),'xlsx now parses untrusted files; reassess vulnerability')
assert(runner.includes('DESPLIEGUE BLOQUEADO:') && runner.includes('fail "DESPLIEGUE BLOQUEADO:'),'production script missing fail-closed security gate')
assert(runner.includes('shasum -a 256 -c'),'production script missing backup verification')
assert(runner.includes('migrations list intap_db --remote'),'production script missing pending-migration check')
assert(runner.includes('migrations apply intap_db --remote'),'production script migration target changed')
for(const name of paths){const sql=fs.readFileSync(prodDir+'/'+name,'utf8');assert(!sql.includes('kawmed_demo_laura_mendez'),'demo medical row in production migration '+name)}
if(!process.exitCode)console.log('KawMed release security scope: OK — xlsx export-only; deployment remains gated pending vulnerability triage')
