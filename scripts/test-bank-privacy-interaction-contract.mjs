import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const publicBankPath = 'web/src/components/free-profile/PublicBankAccounts.tsx'
const sponsoredBankPath = 'web/src/components/sponsored/SponsoredBankAccounts.tsx'
const demoBankPath = 'web/src/components/demo/DemoBankAccounts.tsx'
const trialPanelsPath = 'web/src/components/trial/TrialPanels.tsx'

const [publicBank, sponsoredBank, demoBank, trialPanels, bankApi, previewBankApi, sponsoredApi, trialApi, superAdminSponsors, sponsoredAdminBanks, sponsorApi, migration, middleware] = await Promise.all([
  readFile(publicBankPath, 'utf8'),
  readFile(sponsoredBankPath, 'utf8'),
  readFile(demoBankPath, 'utf8'),
  readFile(trialPanelsPath, 'utf8'),
  readFile('api/src/bank-accounts.ts', 'utf8'),
  readFile('api/src/preview-bank-accounts.ts', 'utf8'),
  readFile('api/src/sponsored-bank-accounts.ts', 'utf8'),
  readFile('api/src/trial-profiles.ts', 'utf8'),
  readFile('app/src/components/admin/SuperAdminSponsors.tsx', 'utf8'),
  readFile('app/src/components/admin/sponsored/SponsoredBankAccounts.tsx', 'utf8'),
  readFile('api/src/sponsored-profiles.ts', 'utf8'),
  readFile('api/migrations-preview/0089_sponsor_bank_account_limit.sql', 'utf8'),
  readFile('functions/_middleware.ts', 'utf8'),
])

for (const [path, source] of [
  [publicBankPath, publicBank],
  [sponsoredBankPath, sponsoredBank],
  [demoBankPath, demoBank],
  [trialPanelsPath, trialPanels],
]) {
  assert.match(source, /Datos para Transferencias/, `${path}: título Datos para Transferencias`)
  assert.match(source, /Copiar cuenta/, `${path}: CTA claro para copiar cuenta`)
  assert.match(source, /Cuenta copiada/, `${path}: feedback temporal de cuenta copiada`)
  assert.match(source, /Copiar RNC\/CÉD\./, `${path}: CTA claro para copiar RNC/CÉD.`)
  assert.match(source, /RNC\/CÉD\. copiada/, `${path}: feedback temporal de RNC/CÉD. copiada`)
}

assert.doesNotMatch(publicBank, /setExpanded|aria-expanded|8000|pointerdown/, 'Free/Team: bancos permanecen siempre desplegados')
assert.doesNotMatch(sponsoredBank, /setExpanded|aria-expanded|8000|pointerdown/, 'Sponsored: bancos permanecen siempre desplegados')
assert.doesNotMatch(demoBank, /setExpanded|aria-expanded|8000|pointerdown/, 'Demo: bancos permanecen siempre desplegados')

assert.match(bankApi, /display_number:\s*maskAccountNumber\(accountNumber\)/, 'Free/Team: número público siempre enmascarado')
assert.match(previewBankApi, /display_number:\s*maskAccountNumber\(accountNumber\)/, 'Preview: número público siempre enmascarado')
assert.match(sponsoredApi, /display_number:maskAccountNumber\(accountNumber\)/, 'Sponsored: número público siempre enmascarado')
assert.match(trialPanels, /'•••• '\+b\.account_number\.slice\(-4\)/, 'Trial: número público muestra solo últimos 4')

for (const [path, source] of [
  ['api/src/bank-accounts.ts', bankApi],
  ['api/src/preview-bank-accounts.ts', previewBankApi],
  ['api/src/sponsored-bank-accounts.ts', sponsoredApi],
  ['api/src/trial-profiles.ts', trialApi],
]) {
  assert.match(source, /holder_id_display|publicHolderId|publicTrialHolderId/, `${path}: expone identificación pública segura`)
}

assert.match(bankApi, /type === 'rnc' \? clean : `•••• \$\{clean\.slice\(-4\)\}`/, 'Free/Team: RNC completo, cédula últimos 4')
assert.match(sponsoredApi, /type==='rnc'\?number:`•••• \$\{number\.slice\(-4\)\}`/, 'Sponsored: RNC completo, cédula últimos 4')
assert.match(trialApi, /type==='rnc'\?value:`•••• \$\{value\.slice\(-4\)\}`/, 'Trial: RNC completo, cédula últimos 4')

function assertHierarchy(source, accountMarker, holderMarker, identityMarker, label) {
  const accountIndex = source.indexOf(accountMarker)
  const holderIndex = source.indexOf(holderMarker, accountIndex + 1)
  const identityIndex = source.indexOf(identityMarker, holderIndex + 1)
  assert.ok(accountIndex >= 0 && holderIndex > accountIndex && identityIndex > holderIndex, `${label}: orden cuenta → titular → identificación`)
}
assertHierarchy(publicBank, 'account.display_number', 'account.holder_name', 'account.holder_id_display', 'Free/Team')
assertHierarchy(sponsoredBank, 'item.display_number', 'item.holder_name', 'item.holder_id_display', 'Sponsored')
assertHierarchy(demoBank, '<code>{DEMO_MASKED}</code>', '<strong>{holderName}</strong>', 'Cédula: {DEMO_ID_MASKED}', 'Demo')
assertHierarchy(trialPanels, "b.account_number?'•••• '", '<b>{b.holder_name}</b>', 'idDisplay', 'Trial')

assert.match(migration, /bank_account_limit INTEGER NOT NULL DEFAULT 3/, 'Migración agrega límite bancario al tenant')
assert.match(migration, /BETWEEN 2 AND 5/, 'Migración restringe límite de 2 a 5')
assert.match(superAdminSponsors, /Cuentas bancarias permitidas/, 'SuperAdmin permite configurar límite bancario del tenant')
assert.match(superAdminSponsors, /<option value=\{2\}>2 cuentas<\/option>/, 'SuperAdmin ofrece mínimo 2')
assert.match(superAdminSponsors, /<option value=\{5\}>5 cuentas<\/option>/, 'SuperAdmin ofrece máximo 5')
assert.match(sponsorApi, /bank_account_limit/, 'API SuperAdmin persiste bank_account_limit')
assert.match(sponsoredApi, /sponsorBankAccountLimit/, 'API patrocinada resuelve límite por tenant')
assert.match(sponsoredApi, /LIMIT \?'\)\.bind\(profileId,maxAccounts\)/, 'API pública limita cuentas según tenant')
assert.match(sponsoredAdminBanks, /setMaxActive/, 'Panel patrocinado usa límite dinámico del tenant')
assert.match(sponsoredAdminBanks, /items\.length<maxActive/, 'Panel patrocinado permite hasta el límite dinámico')

assert.match(publicBank, /Enviar cuentas por WhatsApp/, 'Free/Team: compartir bancos conserva WhatsApp')
assert.match(publicBank, /Copiar enlace/, 'Free/Team: copiar enlace se conserva')
assert.match(sponsoredBank, /Enviar cuentas por WhatsApp/, 'Sponsored: compartir bancos conserva WhatsApp')
assert.match(sponsoredBank, /Copiar enlace/, 'Sponsored: copiar enlace se conserva')
assert.match(publicBank, /\?share=bancos&card=3#bancos/, 'Free/Team: URL bancaria canónica')
assert.match(sponsoredBank, /\?share=bancos&card=3#bancos/, 'Sponsored: URL bancaria canónica')
assert.match(middleware, /share=bancos: social card bancaria/, 'Middleware conserva Graph Card bancaria')
assert.match(middleware, /profileShareImage\(profile\)/, 'Graph Card bancaria usa imagen social del perfil')
assert.match(middleware, /twitterCard:\s*'summary_large_image'/, 'Graph Card bancaria mantiene formato gráfico grande')

console.log('Bank transfer data interaction contract: OK')
