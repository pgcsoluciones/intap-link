import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'

const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function humanCode(length){
  const bytes=randomBytes(length)
  return Array.from(bytes,b=>alphabet[b%alphabet.length]).join('')
}
function runWrangler(command){
  const result=spawnSync('npx',['wrangler','d1','execute','intap_db_preview','--remote','--config','api/wrangler.preview.toml','--command',command],{stdio:'inherit',shell:false})
  if(result.status!==0)process.exit(result.status||1)
}

const publicCode=humanCode(10)
const activationCode=humanCode(20)
const artifactId=randomUUID()
const activationId=randomUUID()
const activationHash=createHash('sha256').update(activationCode).digest('hex')

const sql=[
  "INSERT INTO intap_artifacts (id, public_code, product_type, status, created_at, updated_at) VALUES ('"+artifactId+"','"+publicCode+"','keychain','available',datetime('now'),datetime('now'));",
  "INSERT INTO artifact_activation_codes (id, artifact_id, activation_code_hash, status, expires_at, created_at) VALUES ('"+activationId+"','"+artifactId+"','"+activationHash+"','active',NULL,datetime('now'));",
].join(' ')

console.log('\nCreando código de activación SOLO en D1 Preview…\n')
runWrangler(sql)
console.log('\nVerificando artefacto Preview…\n')
runWrangler("SELECT public_code,product_type,status FROM intap_artifacts WHERE public_code='"+publicCode+"' LIMIT 1;")

console.log('\n============================================================')
console.log('KAWVO LINK · CÓDIGO PREVIEW CREADO')
console.log('============================================================')
console.log('Código de activación: '+activationCode)
console.log('Código público:        '+publicCode)
console.log('Tipo:                  keychain')
console.log('Entorno:               PREVIEW')
console.log('Activación:             https://app.preview.intaprd.com/admin/activate')
console.log('============================================================')
console.log('El código de activación se muestra una sola vez. Guárdalo antes de cerrar esta terminal.')
