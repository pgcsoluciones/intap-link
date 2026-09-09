import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')
const api = read('api/src/team-browser-authority.ts')
const entry = read('api/src/preview-free-entry.ts')
const gate = read('app/src/components/admin/TeamActivationAuthorityGate.tsx')
const activation = read('app/src/components/admin/ActivationAuthorityEntry.tsx')
const login = read('app/src/components/admin/AdminLogin.tsx')

let passed = 0
function assert(condition, label) {
  if (!condition) {
    console.error(`✗ ${label}`)
    process.exitCode = 1
    return
  }
  passed += 1
  console.log(`✓ ${label}`)
}

assert(api.includes("/api/v1/public/team/browser-authority"), 'Public browser authority endpoint exists')
assert(api.includes("session_state: sessionState"), 'Authority endpoint reports browser session state')
assert(api.includes("sessionUser === ownerUserId"), 'Master verification compares authenticated user with Team owner')
assert(!api.includes('UPDATE ') && !api.includes('INSERT ') && !api.includes('DELETE '), 'Authority preflight is read-only')
assert(entry.includes("import './team-browser-authority'"), 'Authority endpoint is registered in Worker entry')
assert(gate.includes("signed_out"), 'Gate handles signed-out browser')
assert(gate.includes("different_account"), 'Gate handles wrong browser account')
assert(gate.includes("master_verified"), 'Gate handles verified Master')
assert(gate.includes('Iniciar sesión como Administrador Master'), 'Gate explicitly invites Master login')
assert(activation.includes('<TeamActivationAuthorityGate'), 'Physical activation route uses Team browser authority gate')
assert(login.includes("/public/team/browser-authority"), 'Team login identifies Team before authentication')
assert(login.includes('TEAM IDENTIFICADO'), 'Team login displays identified Team')
assert(login.includes('Administrador Master:'), 'Team login displays required Master identity')
assert(login.includes('este navegador necesita confirmar una sesión'), 'Team login explains browser-session requirement')

if (!process.exitCode) console.log(`Team browser authority audit PASSED (${passed}/14)`)
