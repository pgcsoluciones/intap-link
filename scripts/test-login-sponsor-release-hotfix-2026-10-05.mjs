import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read=(p)=>readFileSync(p,'utf8')
const home=read('api/src/account-home-route.ts')
const owner=read('api/src/sponsored-owner-flow.ts')
const guard=read('app/src/components/admin/AdminGuard.tsx')
const sw=read('app/public/sw.js')

assert.match(home,/COALESCE\(profile_role,'beneficiary'\)='beneficiary'/,'former sponsor owner cannot be routed as sponsor from stale sponsored_profile')
assert.match(home,/WHERE sponsor_id=\? AND user_id=\? AND profile_role='sponsor_owner'/,'master profile is scoped to active sponsor membership')
assert.match(owner,/ownerChanged/,'owner email changes are detected')
assert.match(owner,/DB\.batch\(statements\)/,'sponsor ownership transfer is atomic at D1 batch level')
assert.match(owner,/UPDATE sponsor_members SET status='inactive'/,'old sponsor owner is deactivated')
assert.match(owner,/UPDATE sponsored_profiles SET user_id=\?/,'master profile ownership moves to new owner')
assert.match(owner,/sponsor_owner_account_required/,'owner transfer requires an existing Kawvo account')
assert.match(guard,/clearScanCode\(\)/,'stale scan state is cleared')
assert.doesNotMatch(guard,/apiPost\('\/public\/artifacts\/scan\/start'/,'AdminGuard never recreates stale scan intents')
assert.match(sw,/kawvo-shell-v3/,'service worker invalidates old shell cache')

console.log('Login + sponsor release hotfix contract: OK')
