import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
import {build} from 'esbuild'

const component='app/src/components/admin/sponsored/SponsorCommercialPages.tsx'
const dashboard='app/src/components/admin/sponsored/SponsorDashboard.tsx'
const page=readFileSync(component,'utf8'),parent=readFileSync(dashboard,'utf8')
for(const [path,source] of [[component,page],[dashboard,parent]]){
 const parsed=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
 assert.equal(parsed.parseDiagnostics.length,0,path+' must parse as TSX')
}
assert.match(parent,/import SponsorCommercialPages from '\.\/SponsorCommercialPages'/)
assert.match(parent,/sm_commercial_page/)
assert.match(parent,/if\(!g7Enabled\|\|commercialPaging\|\|!assignmentsView/)
assert.match(parent,/\{commercialPaging&&assignmentsView&&tenant\?\.id&&<SponsorCommercialPages/)
assert.match(parent,/\{!commercialPaging&&commercialConfig\.contact/)
assert.match(page,/new URLSearchParams\(\{limit:'10',page:String\(page\),state\}\)/)
assert.match(page,/tenant_id!==tenantId/)
assert.match(page,/has_previous/)
assert.match(page,/has_more/)
assert.match(page,/onOpenLegacy/)
assert.doesNotMatch(page,/apiPost|apiPatch|apiDelete|sponsor\/artifacts\b/)
const built=await build({entryPoints:[component],bundle:true,write:false,platform:'browser',format:'esm',
 target:'es2022',logLevel:'silent',loader:{'.tsx':'tsx'},
 external:['react','react-dom','react-router-dom','xlsx']})
assert.ok(built.outputFiles[0].contents.length>0)
console.log('PASS G7.2 commercial mobile pager TSX and scoped opt-in; NO deploy')
