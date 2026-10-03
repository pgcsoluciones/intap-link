import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

for (const path of [
  'web/src/components/free-profile/FreeContactActions.tsx',
  'web/src/components/sponsored/SponsoredProfile.tsx',
]) {
  const source = await readFile(path, 'utf8')
  assert.match(source, /rnc:''/, `${path}: estado de cotización incluye RNC`)
  assert.match(source, />RNC <span[^>]*>\(opcional\)<\/span>/, `${path}: formulario muestra RNC opcional`)
  assert.match(source, /inputMode="numeric"/, `${path}: RNC usa teclado numérico`)
  assert.match(source, /slice\(0,11\)/, `${path}: RNC limita longitud`)
  assert.match(source, /Mi RNC es/, `${path}: RNC se incluye en el mensaje enviado`)
}

console.log('Quote optional RNC contract: OK')
