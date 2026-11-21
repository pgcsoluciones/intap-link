import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {build} from 'esbuild'
const require=createRequire(import.meta.url),ts=require('typescript'),base='594113eeff8d6bd9cd39e572e953f7af7d2fba95',dir='app/src/components/admin/sponsored/'
const read=p=>readFileSync(p,'utf8'),prior=p=>execFileSync('git',['show',base+':'+p],{encoding:'utf8'})
const allowed=[...['SponsoredDashboard.tsx','SponsoredAppointments.tsx','SponsoredExperienceTools.tsx','sponsored-shell-gate.ts','SponsoredUnifiedShell.tsx','SponsoredProfileSelector.tsx','SponsoredResumeGate.tsx','SponsoredActivation.tsx','SponsoredAccessEntry.tsx','SponsoredBankAccounts.tsx','SponsoredGuidedTour.tsx'].map(p=>dir+p),'app/src/components/admin/IntapcardAccountSelector.tsx','scripts/test-sponsored-g4-shell-gate.mjs','scripts/test-sponsored-g4-unified-contract.mjs','scripts/lib/sponsored-g4-browser.mjs','docs/architecture/KAWVO_G4_BENEFICIARY_START.md',...['home-320','profile-390','agenda-390','home-1280'].map(p=>'docs/qa/KAWVO_G4/'+p+'.png')].sort()
const delta=[...new Set([...execFileSync('git',['diff','--name-only',base],{encoding:'utf8'}).trim().split('\n'),...execFileSync('git',['ls-files','--others','--exclude-standard'],{encoding:'utf8'}).trim().split('\n')].filter(Boolean))].sort()
assert.ok(delta.every(p=>allowed.includes(p)),'Exact App UI/tests/docs allowlist; no runners, infrastructure or unrelated changes')
if(process.argv.includes('--scope'))assert.deepEqual(delta,allowed)
execFileSync('git',['diff','--exit-code',base,'--','api','web','shared','functions','package.json','package-lock.json','.github','app/package.json','app/tsconfig.json','app/vite.config.ts'])
for(const p of ['app/src/App.tsx','app/src/components/admin/AdminGuard.tsx','app/src/lib/api.ts','app/src/components/appointments/AppointmentManager.tsx',...['KawvoProfileIdentity.tsx','KawvoReadyToPublish.tsx'].map(p=>'app/src/components/admin/shared/'+p),'scripts/test-sponsored-profile-contract.mjs','scripts/test-free-contact-agenda-contract.mjs','scripts/lib/kawmed-g3-4-browser.mjs','scripts/lib/kawmed-g3-3-browser.mjs','scripts/lib/kawmed-g3-2-browser.mjs','scripts/lib/kawvo-g3-1-1-browser.mjs'])assert.equal(read(p),prior(p),'Protected original remains byte-for-byte: '+p)
execFileSync('git',['diff','--exit-code',base,'--','app/src/components/admin/medical','app/src/components/admin/free'])
function scan(source){const f=ts.createSourceFile('source.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),calls=[],functions=new Map();function visit(n){if(ts.isCallExpression(n)&&ts.isIdentifier(n.expression)&&/^(apiGet|apiPost|apiPatch|apiPut|apiDelete|fetch)$/.test(n.expression.text))calls.push(n.getText(f));if(ts.isFunctionDeclaration(n)&&n.name)functions.set(n.name.text,n.getText(f));ts.forEachChild(n,visit)}visit(f);return{calls:calls.sort(),functions}}
for(const name of ['SponsoredDashboard.tsx','SponsoredExperienceTools.tsx','SponsoredActivation.tsx','SponsoredBankAccounts.tsx','SponsoredAccessEntry.tsx','SponsoredProfileSelector.tsx'])assert.deepEqual(scan(read(dir+name)).calls,scan(prior(dir+name)).calls,'Original API endpoints, payloads and invocation count protected: '+name)
assert.equal(scan(read(dir+'SponsoredDashboard.tsx')).functions.get('profilePayload'),scan(prior(dir+'SponsoredDashboard.tsx')).functions.get('profilePayload'),'Profile payload/normalization unchanged')
const selector=scan(read('app/src/components/admin/IntapcardAccountSelector.tsx')),oldSelector=scan(prior('app/src/components/admin/IntapcardAccountSelector.tsx'))
for(const p of ['beginActivation','signOut'])assert.equal(selector.functions.get(p),oldSelector.functions.get(p),'Existing activation/logout operations unchanged')
assert.deepEqual(selector.calls.filter(c=>!c.startsWith("apiGet('/me/sponsored-profile?profile_id='")),oldSelector.calls,'Account selection adds only a read of the original profile endpoint; kind+id/token mutation unchanged')
const compiled=await build({entryPoints:[dir+'sponsored-shell-gate.ts'],bundle:true,write:false,format:'esm',platform:'node'})
const nav=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'))
const search='?profile_id=profile-a&kawvo_sponsored_shell=1',surface={tab:'profile',module:'location',query:'Dirección'}
const url=nav.sponsoredShellUrl('profile-a',surface)
assert.deepEqual(nav.sponsoredSurface(url.split('?')[1]),{...surface,section:undefined})
assert.equal(new URL('https://fixture'+url).searchParams.get('profile_id'),'profile-a')
assert.equal(nav.sponsoredSurface('?sp_tab=profile&sp_module=credentials').module,undefined)
assert.equal(nav.sponsoredSurface('?sp_tab=agenda&sp_section=https://evil.example').section,undefined)
assert.equal(nav.sponsoredSurface('?sp_tab=unknown').tab,'home')
for(const change of [['production','app.preview.intaprd.com',search],['preview','app.intaprd.com',search],['preview','stage.pages.dev',search],['preview','app.preview.intaprd.com',search+'&scope=master']])assert.equal(nav.isSponsoredShellRequest(...change),false)
assert.equal(nav.sponsoredEntryUrl('/admin/sponsored/select',search,'preview','app.preview.intaprd.com'),'/admin/sponsored/select?kawvo_sponsored_shell=1')
assert.equal(nav.sponsoredEntryUrl('/admin/sponsor',search,'preview','app.preview.intaprd.com'),'/admin/sponsor')
assert.equal(nav.sponsoredEntryUrl('https://evil.example',search,'preview','app.preview.intaprd.com'),'https://evil.example')
assert.equal(nav.sponsoredEntryUrl('/admin/sponsored',search,'production','app.intaprd.com'),'/admin/sponsored')
console.log('PASS G4 static: allowlist, unchanged protected components/old assertions/endpoints/payloads/consent, role isolation and closed UI return codec')
if(process.argv.includes('--browser')){const {runSponsoredG4Browser}=await import('./lib/sponsored-g4-browser.mjs');await runSponsoredG4Browser()}
if(process.argv.includes('--cumulative')){const {runG34Browser}=await import('./lib/kawmed-g3-4-browser.mjs');await runG34Browser();const {runG33Browser}=await import('./lib/kawmed-g3-3-browser.mjs');await runG33Browser();const {runG32Browser}=await import('./lib/kawmed-g3-2-browser.mjs');await runG32Browser()}
