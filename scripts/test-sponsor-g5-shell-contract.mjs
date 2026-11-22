import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {build} from 'esbuild'
const require=createRequire(import.meta.url),ts=require('typescript'),base='46cc46d17b6bd17af735a627a12357e1938eeb44',dir='app/src/components/admin/sponsored/'
const read=p=>readFileSync(p,'utf8'),prior=p=>execFileSync('git',['show',base+':'+p],{encoding:'utf8'})
const allowed=[...['SponsorDashboard.tsx','SponsoredDashboard.tsx','SponsorCommercialSellers.tsx','SponsoredUnifiedShell.tsx','SponsoredAppointments.tsx','sponsor-shell-navigation.ts'].map(p=>dir+p),'app/src/components/admin/IntapcardAccountSelector.tsx','scripts/test-sponsor-g5-shell-contract.mjs','scripts/lib/sponsor-g5-browser.mjs','docs/architecture/KAWVO_G5_MASTER_UNIFIED.md',...['home-320','home-1280','presentation-390','sponsorship-390'].map(p=>'docs/qa/KAWVO_G5/'+p+'.png')].sort()
const delta=[...new Set([...execFileSync('git',['diff','--name-only',base],{encoding:'utf8'}).trim().split('\n'),...execFileSync('git',['ls-files','--others','--exclude-standard'],{encoding:'utf8'}).trim().split('\n')].filter(Boolean))].sort()
assert.ok(delta.every(p=>allowed.includes(p)),'G5 exact App/tests/docs allowlist; no runners or unrelated changes')
if(process.argv.includes('--scope'))assert.deepEqual(delta,allowed)
execFileSync('git',['diff','--exit-code',base,'--','api','web','functions','shared','.github','package.json','package-lock.json','app/package.json','app/src/App.tsx','app/src/lib','app/src/components/admin/medical','app/src/components/admin/free','app/src/components/admin/shared','app/src/components/admin/AdminGuard.tsx','app/src/components/appointments'])
for(const p of ['SponsoredAccessEntry.tsx','SponsoredActivation.tsx','SponsoredResumeGate.tsx','SponsoredBankAccounts.tsx','SponsoredExperienceTools.tsx','sponsored-shell-gate.ts','SponsorKawMed.tsx'])assert.equal(read(dir+p),prior(dir+p),'G3/G4/activation original remains untouched: '+p)
for(const p of ['scripts/lib/sponsored-g4-browser.mjs','scripts/lib/kawmed-g3-4-browser.mjs','scripts/lib/kawmed-g3-3-browser.mjs','scripts/lib/kawmed-g3-2-browser.mjs','scripts/test-sponsored-g4-unified-contract.mjs'])assert.equal(read(p),prior(p),'Previous cumulative assertions unchanged: '+p)
function scan(source){const f=ts.createSourceFile('source.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),calls=[],functions=new Map();function visit(n){if(ts.isCallExpression(n)&&ts.isIdentifier(n.expression)&&/^(apiGet|apiPost|apiPatch|apiPut|apiDelete|fetch)$/.test(n.expression.text))calls.push(n.getText(f));if(ts.isFunctionDeclaration(n)&&n.name)functions.set(n.name.text,n.getText(f));ts.forEachChild(n,visit)}visit(f);return{calls:calls.sort(),functions}}
for(const name of ['SponsorDashboard.tsx','SponsorCommercialSellers.tsx','SponsoredDashboard.tsx'])assert.deepEqual(scan(read(dir+name)).calls,scan(prior(dir+name)).calls,'Original endpoints/payloads and invocation count: '+name)
const sales=scan(read(dir+'SponsorCommercialSellers.tsx')),oldSales=scan(prior(dir+'SponsorCommercialSellers.tsx'))
for(const name of ['load','selectNext','template','addManual','upload','saveAssignments','toggle'])assert.equal(sales.functions.get(name),oldSales.functions.get(name),'Original commercial operation unchanged: '+name)
const chooser='app/src/components/admin/IntapcardAccountSelector.tsx',now=scan(read(chooser)),old=scan(prior(chooser))
assert.equal(now.calls.filter(c=>c==="apiGet('/sponsor/me')").length,1,'One authorized tenant read for optional Multicuenta return')
assert.deepEqual(now.calls.filter(c=>c!=="apiGet('/sponsor/me')"),old.calls,'All selection/logout/activation calls and payloads intact')
for(const name of ['beginActivation','signOut'])assert.equal(now.functions.get(name),old.functions.get(name))
const profile=scan(read(dir+'SponsoredDashboard.tsx')),oldProfile=scan(prior(dir+'SponsoredDashboard.tsx'))
for(const name of ['profilePayload','saveAll','togglePublish','uploadImage','uploadGalleryBatch'])assert.equal(profile.functions.get(name),oldProfile.functions.get(name),'Original profile save/publication/media function: '+name)
const compiled=await build({entryPoints:[dir+'sponsor-shell-navigation.ts'],bundle:true,write:false,format:'esm',platform:'node'}),nav=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'))
const context={mode:'preview',hostname:'app.preview.intaprd.com',search:'',tenant:{id:'tenant-a',role:'owner'},active:{kind:'sponsor',id:'tenant-a'}}
assert.equal(nav.canUseSponsorShell(context),true)
for(const change of [{mode:'production'},{hostname:'app.intaprd.com'},{hostname:'stage.pages.dev'},{search:'?legacy=1'},{search:'?kawvo_sponsor_shell=0'},{search:'?scope=master'},{search:'?sm_sponsor=tenant-b'},{tenant:{id:'tenant-a',role:'viewer'}},{active:{kind:'sponsored',id:'tenant-a'}},{active:{kind:'sponsor',id:'tenant-b'}}])assert.equal(nav.canUseSponsorShell({...context,...change}),false,JSON.stringify(change))
assert.equal(nav.canUseSponsorShell({...context,active:null}),true,'Normal authorized membership requires no invented multicuenta session')
const surface={tab:'profile',module:'insurance',query:'client',status:'activated',assignment:'assigned',page:2}
assert.equal(nav.sponsorSurface('?sm_tab=https://evil.example&sm_module=credentials&sm_page=-1').tab,'home')
assert.equal(nav.sponsorSurface('?sm_tab=profile&sm_module=credentials').module,undefined)
assert.equal(nav.sponsorSurface('?sm_tab=more&sm_tool=agenda&sm_section=evil').section,undefined)
const target=nav.sponsorShellUrl('tenant-a',{tab:'profile',module:'contact',profileQuery:'teléfono',query:'client',page:2}),ret=nav.getSponsorReturn(target.split('?')[1],'preview','app.preview.intaprd.com')
assert.equal(ret.sponsor,'tenant-a');assert.equal(ret.surface.module,'contact');assert.equal(ret.surface.page,2)
assert.equal(nav.sponsorSelectionUrl('tenant-a',{kind:'sponsor',id:'tenant-a',route:'/admin/sponsor'},'preview','app.preview.intaprd.com','',target.split('?')[1]),target+'&sponsor_id=tenant-a')
const other=nav.sponsorSelectionUrl('tenant-b',{kind:'sponsor',id:'tenant-b',route:'/admin/sponsor'},'preview','app.preview.intaprd.com','',target.split('?')[1]);assert.equal(new URLSearchParams(other.split('?')[1]).get('sm_tab'),'home');assert.equal(other.includes('sm_module'),false)
for(const selection of [{kind:'sponsored',id:'tenant-a',route:'/admin/sponsor'},{kind:'sponsor',id:'tenant-b',route:'/admin/sponsor'},{kind:'sponsor',id:'tenant-a',route:'https://evil.example/admin/sponsor'}])assert.throws(()=>nav.sponsorSelectionUrl('tenant-a',selection,'preview','app.preview.intaprd.com',''))
assert.equal(nav.sponsorSelectionUrl('tenant-a',{route:'/admin/sponsor'},'production','app.intaprd.com',''),'/admin/sponsor?sponsor_id=tenant-a')
assert.ok(nav.sponsorAgendaEntry('?scope=master&section=blocks','preview','app.preview.intaprd.com').includes('sm_section=blocks'))
assert.equal(nav.sponsorAgendaEntry('?scope=master&legacy=1','preview','app.preview.intaprd.com'),null)
assert.equal(nav.sponsorAgendaEntry('?scope=master','production','app.intaprd.com'),null)
console.log('PASS G5 contract: exact scope, unchanged APIs/payloads/saves/guards, closed tenant context, canonical entries and Production fallback')
if(process.argv.includes('--browser')){const {runSponsorG5Browser}=await import('./lib/sponsor-g5-browser.mjs');await runSponsorG5Browser()}
