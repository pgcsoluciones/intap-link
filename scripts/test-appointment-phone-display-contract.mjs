import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

for (const path of ['api/src/free-appointments.ts','api/src/sponsored-appointments.ts']) {
  const source = await readFile(path, 'utf8')
  assert.match(source, /function formatPhoneForMessage\(/, `${path}: falta formateador de teléfono para mensaje`)
  assert.match(source, /local\.slice\(0,3\).*local\.slice\(3,6\).*local\.slice\(6\)/s, `${path}: falta formato 809-000-0000`)
  assert.match(source, /Mi teléfono es '\+formatPhoneForMessage\(row\.customer_phone\)/, `${path}: appointmentMessage no usa el número normalizado`)
  assert.doesNotMatch(source, /Mi teléfono es '\+String\(row\.customer_phone\|\|''\)\.trim\(\)/, `${path}: todavía imprime el teléfono crudo`)
}
console.log('Appointment phone display contract: OK')
