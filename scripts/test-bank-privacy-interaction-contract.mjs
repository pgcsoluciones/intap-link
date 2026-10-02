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
}

const publicBank = await readFile(paths[0], 'utf8')
const sponsoredBank = await readFile(paths[1], 'utf8')
const middleware = await readFile('functions/_middleware.ts', 'utf8')
assert.doesNotMatch(publicBank, /IntersectionObserver|addEventListener\('scroll'/, 'Free/Team/Trial: scroll no debe cerrar la sección')
assert.doesNotMatch(sponsoredBank, /IntersectionObserver|addEventListener\('scroll'/, 'Sponsored: scroll no debe cerrar la sección')
assert.match(publicBank, /document\.addEventListener\('pointerdown'/, 'Free/Team/Trial: clic fuera sí cierra')
assert.match(sponsoredBank, /document\.addEventListener\('pointerdown'/, 'Sponsored: clic fuera sí cierra')
assert.match(publicBank, /Enviar cuentas por WhatsApp/, 'Free/Team/Trial: compartir bancos se muestra como enlace de texto')
assert.match(publicBank, /Copiar enlace/, 'Free/Team/Trial: copiar enlace se muestra como texto')
assert.match(sponsoredBank, /Enviar cuentas por WhatsApp/, 'Sponsored: compartir bancos se muestra como enlace de texto')
assert.match(sponsoredBank, /Copiar enlace/, 'Sponsored: copiar enlace se muestra como texto')
assert.match(publicBank, /\?share=bancos&card=3#bancos/, 'Free/Team/Trial: WhatsApp usa URL bancaria canónica con card social')
assert.match(sponsoredBank, /\?share=bancos&card=3#bancos/, 'Sponsored: WhatsApp usa URL bancaria canónica con card social')
assert.match(middleware, /share=bancos: social card bancaria/, 'Middleware conserva la Graph Card bancaria server-side')
assert.match(middleware, /profileShareImage\(profile\)/, 'Graph Card bancaria usa la imagen social del perfil del usuario')
assert.match(middleware, /twitterCard:\s*'summary_large_image'/, 'Graph Card bancaria mantiene formato gráfico grande')

console.log('Bank privacy interaction contract: OK')
