import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { transform } from 'esbuild'

const source = await readFile('app/src/components/admin/sponsored/sponsored-shell-gate.ts', 'utf8')
const compiled = await transform(source, { loader: 'ts', format: 'esm' })
const { shouldShowSponsoredShell: gate, shouldReplaceSponsoredDraft: replaceDraft, requestSponsoredExit, sponsoredAgendaReturn, sponsoredAccountSelectionUrl: selectionUrl } = await import(`data:text/javascript;base64,${Buffer.from(compiled.code).toString('base64')}`)
const allowed = { mode: 'preview', hostname: 'app.preview.intaprd.com', search: '?profile_id=abc&kawvo_sponsored_shell=1', isMaster: false, legacyPanel: false, profileId: 'abc' }
assert.equal(gate(allowed), true)
for (const change of [
  { mode: 'production' }, { hostname: 'app.intaprd.com' }, { hostname: 'x.pages.dev' },
  { search: '?profile_id=abc' }, { search: '?profile_id=other&kawvo_sponsored_shell=1' },
  { isMaster: true }, { legacyPanel: true }, { profileId: null },
]) assert.equal(gate({ ...allowed, ...change }), false, JSON.stringify(change))
assert.equal(gate({ ...allowed, search: '?kawvo_sponsored_shell=1' }), true)
assert.equal(replaceDraft(false, 1, 1), true)
assert.equal(replaceDraft(false, 2, 1), false)
assert.equal(replaceDraft(true, 1, 1), false)
assert.equal(sponsoredAgendaReturn('?profile_id=abc&kawvo_sponsored_shell=1','preview','app.preview.intaprd.com'),'/admin/sponsored?profile_id=abc&kawvo_sponsored_shell=1')
assert.equal(sponsoredAgendaReturn('?profile_id=abc&kawvo_sponsored_shell=1','production','app.intaprd.com'),'/admin/sponsored?profile_id=abc')
assert.equal(sponsoredAgendaReturn('?scope=master&kawvo_sponsored_shell=1','preview','app.preview.intaprd.com'),'/admin/sponsor')
assert.equal(sponsoredAgendaReturn('?scope=master&profile_id=abc&kawvo_sponsored_shell=1','preview','app.preview.intaprd.com'),'/admin/sponsored?profile_id=abc')
const selected = {profileId:'abc',selection:{kind:'sponsored',id:'abc',route:'/admin/sponsored'},mode:'preview',hostname:'app.preview.intaprd.com',search:''}
const firstSelection = '/admin/sponsored?profile_id=abc&kawvo_sponsored_shell=1&sp_tab=home'
assert.equal(selectionUrl(selected),firstSelection,'Initial selection requires no prior shell context')
assert.equal(selectionUrl({...selected,selection:{...selected.selection,route:'/admin/sponsored?profile_id=abc'}}),firstSelection)
const returning = '?profile_id=abc&sp_tab=profile&sp_module=location&sp_q=consulta'
assert.equal(selectionUrl({...selected,returnSearch:returning}),'/admin/sponsored?profile_id=abc&kawvo_sponsored_shell=1&sp_tab=profile&sp_module=location&sp_q=consulta')
assert.equal(selectionUrl({...selected,returnSearch:returning.replace('abc','other')}),firstSelection,'Another account cannot inherit the previous profile surface')
for(const selection of [
 {...selected.selection,kind:'sponsor'}, {...selected.selection,id:'other'}, {...selected.selection,route:undefined},
 ...['https://evil.example/admin/sponsored','https://app.preview.intaprd.com/admin/sponsored','//evil.example/admin/sponsored','/admin/sponsor','/admin/sponsored/agenda','/admin/sponsored?scope=master','/admin/sponsored?scope=','/admin/sponsored?profile_id=other','/admin/sponsored?profile_id=abc&profile_id=other','/admin/sponsored#profile','/admin/sponsored/../sponsor'].map(route=>({...selected.selection,route})),
]) assert.equal(selectionUrl({...selected,selection}),null,'Reject mismatched identity/noncanonical route: '+JSON.stringify(selection))
for(const search of ['?kawvo_sponsored_shell=0','?kawvo_sponsored_shell=1&sp_legacy=1'])assert.equal(selectionUrl({...selected,search}),'/admin/sponsored?profile_id=abc&kawvo_sponsored_shell=0','Explicit legacy is preserved')
for(const change of [{mode:'production'},{hostname:'app.intaprd.com'},{hostname:'stage.pages.dev'}])assert.equal(selectionUrl({...selected,...change}),'/admin/sponsored','No automatic G4 outside App Preview')
const target = new EventTarget()
assert.equal(requestSponsoredExit(target), true)
target.addEventListener('kawvo-sponsored-before-exit', event => event.preventDefault())
assert.equal(requestSponsoredExit(target), false)
const tools = await readFile('app/src/components/admin/sponsored/SponsoredExperienceTools.tsx', 'utf8')
for (const [start, end, mutation] of [
  ['async function logout()', 'async function openAccount()', "apiPost('/auth/logout'"],
  ['async function unlink()', 'const readyToUnlink=', 'apiPost(`/me/sponsored-profile/unlink'],
]) {
  const body = tools.slice(tools.indexOf(start), tools.indexOf(end))
  assert.ok(body.includes('if(!requestSponsoredExit(window))return'))
  assert.ok(body.indexOf('requestSponsoredExit(window)') < body.indexOf(mutation), `${start}: exit check must precede mutation`)
}
console.log('Sponsored G4: Preview UI gate and selected-profile matching PASS')
