import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {build} from 'esbuild'
import ts from 'typescript'
const config=readFileSync('api/wrangler.g7-2a-visual.toml','utf8')
const stage=readFileSync('api/src/g7-2a-stage-entry.ts','utf8')
const html=readFileSync('api/src/g7-2a-qa-view.ts','utf8')
const app=readFileSync('app/src/components/admin/sponsored/SponsorCommercialPages.tsx','utf8')
const dashboard=readFileSync('app/src/components/admin/sponsored/SponsorDashboard.tsx','utf8')
const routes=[...config.matchAll(/^\s*pattern\s*=\s*"([^"]+)"\s*$/gm)].map(x=>x[1])
assert.deepEqual(routes,[
 'app.preview.intaprd.com/admin/sponsor/g7-2-qa*',
 'app.preview.intaprd.com/api/v1/sponsor/commercial/sellers/page*',
 'app.preview.intaprd.com/api/v1/sponsor/commercial/assignments/page*'
])
assert.match(config,/^name = "kawvo-g7-2a-readonly-stage"$/m)
assert.match(config,/^main = "src\/g7-2a-stage-entry.ts"$/m)
assert.match(config,/^ENVIRONMENT = "preview"$/m)
assert.match(config,/^database_name = "intap_db_preview"$/m)
assert.match(config,/^database_id = "e9f46214-623f-48da-af13-74198e12b222"$/m)
assert.doesNotMatch(config,/^\s*\[triggers\]|^\s*\[\[r2_buckets\]\]|^\s*(?:crons|APP_PAGES_ORIGIN|WEB_PAGES_ORIGIN|custom_domain)\s*=/m)
assert.match(stage,/url\.hostname!=='app\.preview\.intaprd\.com'/)
assert.match(stage,/app\.get\('\/admin\/sponsor\/g7-2-qa'/)
assert.match(stage,/for\(const resource of \['sellers','assignments'\] as const\)/)
assert.doesNotMatch(stage,/\.run\(|\.batch\(/)
assert.match(html,/fetch\('\/api\/v1\/sponsor\/commercial\/'/)
assert.match(html,/credentials:'same-origin'/)
assert.match(html,/sessionStorage\.getItem\('kawvo_intap_active_tab_v1'\)/)
assert.match(html,/textContent/)
assert.doesNotMatch(html,/innerHTML|localStorage|apiPost|method:'POST'|Authorization:/)
for(const [path,src] of [
 ['api/src/g7-2a-qa-view.ts',html],
 ['api/src/g7-2a-stage-entry.ts',stage],
 ['app/src/components/admin/sponsored/SponsorCommercialPages.tsx',app],
 ['app/src/components/admin/sponsored/SponsorDashboard.tsx',dashboard]
]){
 const sf=ts.createSourceFile(path,src,ts.ScriptTarget.Latest,true,path.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS)
 assert.equal(sf.parseDiagnostics.length,0,'Parse failures in '+path)
}
const result=await build({entryPoints:['api/src/g7-2a-stage-entry.ts'],bundle:true,write:false,platform:'browser',format:'esm',target:'es2022',logLevel:'silent'})
assert.ok(result.outputFiles[0].contents.length>0)
console.log('PASS G7.2 visual first-party QA: exactly 3 scoped routes, safe HTML and Stage bundle; NO deploy')
