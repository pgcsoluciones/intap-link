import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const s=readFileSync('app/src/components/admin/KawMedClaim.tsx','utf8')
assert.match(s,/Estación \{context\?\.display_code/)
assert.match(s,/>Salir \/ Activar luego<\/button>/)
assert.match(s,/sessionStorage\.removeItem\(STORAGE_KEY\)/)
assert.match(s,/window\.location\.replace\('https:\/\/intaprd\.com\/'\)/)
assert.match(s,/onClick=\{\(\)=>setStep\('identity'\)\}/)
console.log('KawMed salida voluntaria sin activación: OK')
