// G1 read-only route preservation comparison between deployed Preview and isolated candidate.
// Assumptions: Vite may split modules; absence of a string is a warning, not proof of missing functionality.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import assert from 'node:assert/strict'
const [activeFolder, candidateFolder, reportFile] = process.argv.slice(2)
if (!activeFolder || !candidateFolder || !reportFile) {
  console.error('Uso: node compare-kawvo-g1-live-app-routes-2026-11-12.mjs <activeDir> <candidateDir> <reportPath>')
  process.exit(2)
}
const readAllJs = dir => readdirSync(dir).filter(x=>x.endsWith('.js')).sort().map(x=>readFileSync(join(dir,x),'utf8')).join('\n')
const active = readAllJs(activeFolder), candidate = readAllJs(candidateFolder)
assert(active.length>0 && candidate.length>0, 'Ambos artefactos deben contener JS')
const app = readFileSync('app/src/App.tsx','utf8')
const declared = [...app.matchAll(/<Route\s+path="([^"]+)"/g)].map(m=>m[1])
const routes = [...new Set(declared.filter(x=>x.startsWith('/admin/')||x.startsWith('/superadmin/')))].sort()
const jsRoutes = text => new Set([...text.matchAll(/\/(?:admin|superadmin)\/[a-zA-Z0-9_/:?=.+-]+/g)].map(m=>m[0].replace(/[\.,;]+$/,'')))
const livePaths = jsRoutes(active), candidatePaths = jsRoutes(candidate)
const checks = routes.map(route=>({route,active:active.includes(route),candidate:candidate.includes(route)}))
const missing = checks.filter(x=>x.active&&!x.candidate)
const added = checks.filter(x=>!x.active&&x.candidate)
const present = checks.filter(x=>x.active&&x.candidate)
const liveOnly = [...livePaths].filter(x=>!candidatePaths.has(x)).sort()
const candidateOnly = [...candidatePaths].filter(x=>!livePaths.has(x)).sort()
const report = {
  kind:'static-bundle-route-diff-not-functional-evidence',
  appSourceRoutes:routes.length,
  inBoth:present.length,
  inActiveNotCandidate:missing,
  inCandidateNotActive:added,
  liveOnlyDynamicStrings:liveOnly,
  candidateOnlyDynamicStrings:candidateOnly,
  notes:['Strings absent from bundled JS may be moved to chunks or generated dynamically.','Presence of a string does NOT prove navigation, OAuth, data isolation, permissions, or feature parity.','Do not change Worker APP_PAGES_ORIGIN based on this report.']
}
writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n')
console.log('Rutas App.tsx examinadas:',routes.length)
console.log('En ambos bundles:',present.length)
console.log('ACTIVO SÍ / CANDIDATO NO:',missing.length)
for(const x of missing)console.log('  REVISAR:',x.route)
console.log('SOLO CANDIDATO:',added.length)
for(const x of added.slice(0,30))console.log('  NUEVA:',x.route)
console.log('Cadenas rutas adicionales SOLO ACTIVO:',liveOnly.length)
for(const p of liveOnly.slice(0,60))console.log('  DINÁMICA REVISAR:',p)
console.log('Informe:',reportFile)
console.log('G1: comparación estática terminada, sin autorización de promoción.')
