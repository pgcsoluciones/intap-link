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
  assert.match(source, /<svg/, `${path}: icono bancario monocromático junto al título`)
  assert.doesNotMatch(source, /720/, `${path}: no debe cerrarse inmediatamente tras copiar`)
  assert.doesNotMatch(source, /Copiar cuenta/i, `${path}: no debe anunciar copia de cuenta`)
  assert.doesNotMatch(source, /Cuenta copiada/i, `${path}: no debe mostrar feedback de cuenta copiada`)
  assert.doesNotMatch(source, /Copiar cédula|Copiar RNC/i, `${path}: no debe anunciar copia de identidad`)
  assert.doesNotMatch(source, /se copia sin mostrarse/i, `${path}: no debe explicar el mecanismo sensible`)
  assert.match(source, /Enviar cuentas por WhatsApp/, `${path}: compartir bancos debe verse como enlace de texto`)
  assert.match(source, /Copiar enlace/, `${path}: copiar enlace debe verse como texto`)
}

const publicBank = await readFile(paths[0], 'utf8')
const sponsoredBank = await readFile(paths[1], 'utf8')
assert.doesNotMatch(publicBank, /IntersectionObserver|addEventListener\('scroll'/, 'Free/Team/Trial: scroll no debe cerrar la sección')
assert.doesNotMatch(sponsoredBank, /IntersectionObserver|addEventListener\('scroll'/, 'Sponsored: scroll no debe cerrar la sección')
assert.match(publicBank, /document\.addEventListener\('pointerdown'/, 'Free/Team/Trial: clic fuera sí cierra')
assert.match(sponsoredBank, /document\.addEventListener\('pointerdown'/, 'Sponsored: clic fuera sí cierra')

console.log('Bank privacy interaction contract: OK')
