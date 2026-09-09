#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const checks = []
const assert = (condition, message) => {
  checks.push({ ok: Boolean(condition), message })
  if (!condition) process.exitCode = 1
}

const resolver = read('web/src/components/ArtifactLinkResolver.tsx')
const callback = read('app/src/components/admin/AuthCallback.tsx')
const guard = read('app/src/components/admin/AdminGuard.tsx')
const legacyJoin = read('app/src/components/admin/free/FreeTeamJoin.tsx')
const assignUi = read('app/src/components/admin/free/FreeTeamAssign.tsx')
const corporate = read('api/src/team-corporate.ts')
const entry = read('api/src/preview-free-entry.ts')
const joinAuthority = read('api/src/team-join-authority.ts')
const scanStatus = read('api/src/scan-status.ts')
const app = read('app/src/App.tsx')

assert(resolver.includes('/admin/free/team/assign?public_code='), 'Public Team scan continues to Master assignment route')
assert(!resolver.includes('/admin/free/team/join?'), 'Public resolver does not enter legacy self-join')
assert(callback.includes('/admin/free/team/assign?public_code='), 'Auth callback resumes Team Master assignment')
assert(!callback.includes("navigate('/admin/free/team/join'"), 'Auth callback cannot resume legacy self-join')
assert(guard.includes('hasTeamActivationContext') && guard.includes('!hasTeamActivationContext'), 'AdminGuard gives Team context priority over independent scan/starter recovery')
assert(guard.includes('activation=team&public_code='), 'AdminGuard preserves Team source-of-truth identifiers through login')
assert(!legacyJoin.includes("apiPost('/me/team/join'"), 'Legacy Team join UI has no mutation call')
assert(legacyJoin.includes('/admin/free/team/assign?public_code='), 'Legacy Team join route funnels to Master assignment')
assert(joinAuthority.includes("app.post('/api/v1/me/team/join'"), 'Backend legacy self-join is explicitly guarded')
assert(joinAuthority.includes('TEAM_MASTER_PREPARATION_REQUIRED'), 'Backend legacy guard exposes deterministic authority code')
assert(entry.indexOf("import './team-join-authority'") >= 0 && entry.indexOf("import './team-join-authority'") < entry.indexOf("import './team-v2'"), 'Authority guard registers before legacy team-v2 routes')
assert(corporate.includes('syncTeamMemberFromMaster(c, profileId, true)'), 'Corporate assignment performs full initial Master clone')
assert(corporate.includes('verifyClone(c, masterProfileId, profileId)'), 'Corporate assignment verifies cloned presentation')
assert(corporate.includes('verifyAssignmentState('), 'Corporate assignment verifies Team/artifact/code source-of-truth relations')
assert(corporate.includes('is_published,created_at') && corporate.includes(",0,datetime('now'),datetime('now'))"), 'New Team profile starts unpublished')
assert(corporate.includes('UPDATE profiles SET is_published=?'), 'Publication happens only after verification')
assert(corporate.includes("allowed.has('phone') ? (requestedPhone || null)"), 'Delegated phone is member data while locked phone inherits Master')
assert(corporate.includes("allowed.has('whatsapp') ? (requestedWhatsapp || null)"), 'Delegated WhatsApp is member data while locked WhatsApp inherits Master')
assert(corporate.includes("allowed.has('email') ? (requestedEmail || null)"), 'Delegated email is member data while locked email inherits Master')
assert(assignUi.includes('clearTeamActivationContext()'), 'Successful Team preparation clears browser activation context')
assert(app.includes('<ActivationAuthorityEntry/>'), 'Independent activation route is protected by Team authority gate')
assert(scanStatus.indexOf('if (teamMemberId)') >= 0 && scanStatus.indexOf("if (status === 'activated')") > scanStatus.indexOf('if (teamMemberId)'), 'Scan status resolves Team membership before independent activation state')

for (const check of checks) console.log(`${check.ok ? '✓' : '✗'} ${check.message}`)
if (process.exitCode) {
  console.error(`\nTeam flow invariant audit FAILED (${checks.filter((c) => !c.ok).length}/${checks.length})`)
} else {
  console.log(`\nTeam flow invariant audit PASSED (${checks.length}/${checks.length})`)
}
