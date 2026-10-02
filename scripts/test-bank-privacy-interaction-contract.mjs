import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const paths = [
  'web/src/components/free-profile/PublicBankAccounts.tsx',
  'web/src/components/sponsored/SponsoredBankAccounts.tsx',
  'web/src/components/demo/DemoBankAccounts.tsx',
]

for (const path of paths) {
  const source = await readFile(path, 'utf8')
  assert.match(source, />Cuentas</, `${path}: título discreto Cuentas`)
  assert.match(source, /RNC \/ CÉD\./, `${path}: etiqueta discreta RNC / CÉD.`)
  assert.match(source, /setExpanded\(false\)/, `${path}: cierre automático`)
  assert.match(source, /8000/, `${path}: cierre por inactividad`)
  assert.doesNotMatch(source, /Copiar cuenta/i, `${path}: no debe anunciar copia de cuenta`)
  assert.doesNotMatch(source, /Cuenta copiada/i, `${path}: no debe mostrar feedback de cuenta copiada`)
  assert.doesNotMatch(source, /Copiar cédula|Copiar RNC/i, `${path}: no debe anunciar copia de identidad`)
  assert.doesNotMatch(source, /se copia sin mostrarse/i, `${path}: no debe explicar el mecanismo sensible`)
}

const publicBank = await readFile(paths[0], 'utf8')
const sponsoredBank = await readFile(paths[1], 'utf8')
assert.match(publicBank, /IntersectionObserver/, 'Free\/Team\/Trial: cierre al abandonar visualmente la sección')
assert.match(sponsoredBank, /IntersectionObserver/, 'Sponsored: cierre al abandonar visualmente la sección')
assert.match(publicBank, /collapseAfterSensitiveAction/, 'Free\/Team\/Trial: colapsa tras interacción sensible')
assert.match(sponsoredBank, /collapseAfterSensitiveAction/, 'Sponsored: colapsa tras interacción sensible')

console.log('Bank privacy interaction contract: OK')
