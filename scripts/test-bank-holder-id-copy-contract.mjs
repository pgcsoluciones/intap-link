import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const targets = [
  'web/src/components/free-profile/PublicBankAccounts.tsx',
  'web/src/components/sponsored/SponsoredBankAccounts.tsx',
]

for (const path of targets) {
  const source = await readFile(path, 'utf8')
  assert.match(source, /holder-id/, `${path}: conserva endpoint específico de identidad`)
  assert.match(source, /ClipboardItem/, `${path}: usa ClipboardItem para conservar el gesto del usuario`)
  assert.match(source, /navigator\.clipboard\?\.write/, `${path}: inicia escritura avanzada desde el clic`)
  assert.match(source, /valuePromise/, `${path}: resuelve la identidad sin reutilizar la cuenta`)
  assert.match(source, /value===.*copy_value|value === .*copy_value/, `${path}: bloquea una respuesta que coincida con el número de cuenta`)
  assert.match(source, /RNC \/ CÉD\./, `${path}: conserva etiqueta discreta`)
}

console.log('Bank holder-id clipboard contract: OK')
