import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { transform } from 'esbuild'

const source = await readFile('app/src/components/admin/sponsored/sponsored-shell-gate.ts', 'utf8')
const compiled = await transform(source, { loader: 'ts', format: 'esm' })
const { shouldShowSponsoredShell: gate, shouldReplaceSponsoredDraft: replaceDraft, requestSponsoredExit, sponsoredAgendaReturn } = await import(`data:text/javascript;base64,${Buffer.from(compiled.code).toString('base64')}`)
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
