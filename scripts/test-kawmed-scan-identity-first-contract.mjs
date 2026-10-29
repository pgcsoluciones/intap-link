import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const app=readFileSync('app/src/components/admin/KawMedClaim.tsx','utf8')
const api=readFileSync('api/src/medical-access-codes.ts','utf8')
assert.match(api,/data:\{code,display_code:/)
assert.match(app,/useState<'scan'\|'identity'\|'confirm'>\('scan'\)/)
assert.match(app,/Estación \{context\?\.display_code/)
assert.match(app,/\{context\?\.code\|\|code\}/)
assert.match(app,/onClick=\{\(\)=>setStep\('identity'\)\}/)
assert.match(app,/reason==='already_med'/)
assert.match(app,/reason==='already_owned'/)
console.log('KawMed identification-before-account contract OK')
