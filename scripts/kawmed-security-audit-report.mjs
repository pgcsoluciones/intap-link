import fs from 'node:fs'
import path from 'node:path'
const reportPath=process.argv[2]||'.kawmed-prod-preflight/npm-audit.json'
if(!fs.existsSync(reportPath)){console.error('Informe no encontrado: '+reportPath);process.exit(2)}
const report=JSON.parse(fs.readFileSync(reportPath,'utf8'))
const app=JSON.parse(fs.readFileSync('app/package.json','utf8'))
const web=JSON.parse(fs.readFileSync('web/package.json','utf8'))
const api=JSON.parse(fs.readFileSync('api/package.json','utf8'))
const direct={...app.dependencies,...web.dependencies,...api.dependencies}
const dev={...app.devDependencies,...web.devDependencies,...api.devDependencies}
const rows=Object.entries(report.vulnerabilities||{}).map(([name,v])=>({
 name,severity:v.severity,
 scope:Object.hasOwn(direct,name)?'directa runtime':Object.hasOwn(dev,name)?'directa dev/build':'transitiva',
 fix:v.fixAvailable===false?'sin arreglo indicado':v.fixAvailable===true?'actualización potencialmente compatible':`${v.fixAvailable?.name||'?'}@${v.fixAvailable?.version||'?'} (mayor=${!!v.fixAvailable?.isSemVerMajor})`,
}))
rows.sort((a,b)=>({critical:0,high:1,moderate:2,low:3}[a.severity]??4)-({critical:0,high:1,moderate:2,low:3}[b.severity]??4))
console.log('Auditoría informativa — NO aprueba despliegue ni modifica paquetes')
for(const r of rows)console.log([r.severity,r.name,r.scope,r.fix].join(' | '))
console.log('Total:',rows.length,'; pendientes de evaluación y pruebas reales.')
