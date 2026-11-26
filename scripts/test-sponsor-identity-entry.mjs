import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {build} from 'esbuild'
const ts=createRequire(import.meta.url)('typescript')
const dir='app/src/components/admin/sponsored/'
const read=p=>readFileSync(p,'utf8')
const link=read(dir+'SponsorDashboard.tsx'),med=read(dir+'SponsorKawMed.tsx')
function assertIdentityEntry(source,filename,handler){
 const f=ts.createSourceFile(filename,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
 assert.equal(f.parseDiagnostics.length,0)
 const buttons=[]
 function visit(n){
  if(ts.isJsxElement(n)&&n.openingElement.tagName.getText(f)==='button'&&n.getText(f).includes('title="Identidad de patrocinio"')&&n.getText(f).includes(handler))buttons.push(n)
  ts.forEachChild(n,visit)
 }
 visit(f)
 assert.equal(buttons.length,3,'Home, sponsorship and backward-compatible More')
 assert.equal(buttons.filter(n=>n.getText(f).includes('min-h-11')&&n.getText(f).includes('min-w-0')).length,2,'New access controls have mobile touch targets')
 const home=buttons.filter(n=>{let a=n.parent;while(a){if(ts.isJsxElement(a)&&a.openingElement.tagName.getText(f)==='section'&&a.getText(f).includes('>Inicio</h1>'))return true;a=a.parent}return false})
 assert.equal(home.length,1,'Exactly one direct home entry')
}
assertIdentityEntry(link,'SponsorDashboard.tsx',"go({tab:'more',tool:'brand'")
assertIdentityEntry(med,'SponsorKawMed.tsx',"openMasterTool('identity')")
assert.ok(link.includes("tab={surface.tab==='more'&&surface.tool==='brand'?'sponsorship':surface.tab}"))
assert.ok(med.includes("tab={masterSection==='codes'||masterSection==='identity'?'sponsorship'"))
assert.ok(link.includes("surface.tool==='brand'?'← Volver a Patrocinios'"))
assert.ok(med.includes("masterSection==='identity'?'← Volver a Patrocinios'"))
assert.equal((link.match(/<SponsorContactMessage /g)||[]).length,1,'Single existing editor instance')
assert.equal((med.match(/onClick=\{\(\)=>void saveProgramIdentity\(\)\}/g)||[]).length,1,'Single existing medical save')
const compiled=await build({entryPoints:[dir+'sponsor-shell-navigation.ts','app/src/components/admin/medical/kawmed-master-shell-navigation.ts'],bundle:true,write:false,outdir:'out',platform:'node',format:'esm',define:{'import.meta.env':JSON.stringify({MODE:'preview'})}})
const load=async name=>import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles.find(f=>f.path.endsWith('/'+name+'.js')).text).toString('base64'))
const ln=await load('sponsor-shell-navigation'),mn=await load('kawmed-master-shell-navigation')
const url=ln.sponsorShellUrl('tenant-a',{tab:'more',tool:'brand',view:'assignments',assignment:'assigned',page:2})
const lr=ln.getSponsorReturn(url.split('?')[1],'preview','app.preview.intaprd.com')
assert.equal(lr.sponsor,'tenant-a');assert.equal(lr.surface.tool,'brand');assert.equal(lr.surface.view,'assignments');assert.equal(lr.surface.page,2)
const mu=mn.kawMedMasterContextUrl('/admin/sponsor/kawmed',{account:'profile-a',sponsor:'tenant-a',tab:'more',masterSection:'identity',codeQuery:'Estación',codeStatus:'claimed',codeRep:'rep-a'})
const mr=mn.getKawMedMasterReturn(mu.split('?')[1],'/admin/sponsor/kawmed')
assert.equal(mr.sponsor,'tenant-a');assert.equal(mr.masterSection,'identity');assert.equal(mr.codeQuery,'Estación');assert.equal(mr.codeRep,'rep-a')
console.log('PASS Master identity entry: direct home/sponsorship, canonical tenant return, mobile targets, single editor')
