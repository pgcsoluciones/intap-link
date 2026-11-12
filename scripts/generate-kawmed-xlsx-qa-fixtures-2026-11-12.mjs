#!/usr/bin/env node
// Synthetic, local-only KawMed XLSX QA fixtures. Never calls API/Cloudflare.
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import XLSXImport from 'xlsx'
const XLSX = XLSXImport.default || XLSXImport
const directory = resolve(process.argv[2] || process.env.HOME + '/intap-release-logs/kawmed-xlsx-fixtures-2026-11-12')
mkdirSync(directory, {recursive:true})
const fields = ['Codigo','Nombre','Apellido','WhatsApp','Correo','Zona','Territorio']
const row = n => ({Codigo:'QA-KM-'+String(n).padStart(4,'0'),Nombre:'Prueba'+n,Apellido:'KawMed',WhatsApp:'809555'+String(n).padStart(4,'0'),Correo:'qa-km-'+n+'@example.invalid',Zona:'Zona de prueba',Territorio:'Territorio QA'})
const writeBook=(name, data)=>{
 const sheet=XLSX.utils.json_to_sheet(data,{header:fields})
 const book=XLSX.utils.book_new()
 XLSX.utils.book_append_sheet(book,sheet,'Visitadores')
 // Use Node's filesystem explicitly: SheetJS ESM writeFile may use a browser-only writer under Node 24.
 const bytes=XLSX.write(book,{type:'buffer',bookType:'xlsx'})
 writeFileSync(resolve(directory,name),Buffer.from(bytes))
}
writeBook('01-visitadores-validos-3.xlsx',[1,2,3].map(row))
writeBook('02-visitadores-1000.xlsx',Array.from({length:1000},(_,i)=>row(i+1)))
writeBook('03-visitadores-1001.xlsx',Array.from({length:1001},(_,i)=>row(i+1)))
writeBook('04-filas-incompletas.xlsx',[row(1),{...row(2),WhatsApp:''},{...row(3),Nombre:''}])
writeBook('05-columnas-alternativas.xlsx',[{employee_code:'QA-ALT-1',first_name:'Alternativa',last_name:'Prueba',telefono:'8095551001',email:'alternativa@example.invalid',zona:'QA',territorio:'QA'}])
const csv=[fields.join(','),...([1,2,3].map(n=>fields.map(k=>JSON.stringify(String(row(n)[k]))).join(',')))].join('\r\n')+'\r\n'
writeFileSync(resolve(directory,'06-visitadores-validos-3.csv'),csv)
writeFileSync(resolve(directory,'07-archivo-invalido.xlsx'),'no es un archivo excel valido')
writeFileSync(resolve(directory,'08-archivo-vacio.xlsx'),'')
writeFileSync(resolve(directory,'09-archivo-mas-5mb.xlsx'),Buffer.alloc(5*1024*1024+1,65))
const map = source => ({employee_code:source.Codigo||source.codigo||source.employee_code||'',first_name:source.Nombre||source.nombre||source.first_name||'',last_name:source.Apellido||source.apellido||source.last_name||'',whatsapp:source.WhatsApp||source.whatsapp||source.Telefono||source.telefono||'',email:source.Correo||source.correo||source.Email||source.email||'',zone:source.Zona||source.zona||'',territory:source.Territorio||source.territorio||''})
const parse = file => {
 const book=XLSX.read(file,{type:'buffer',sheetRows:1001})
 const sheet=book.Sheets[book.SheetNames[0]]
 return XLSX.utils.sheet_to_json(sheet,{defval:''}).slice(0,1000).map(map).filter(r=>String(r.first_name).trim()&&String(r.whatsapp).trim())
}
const fs = await import('node:fs')
const get=name=>fs.readFileSync(resolve(directory,name))
assert.equal(parse(get('01-visitadores-validos-3.xlsx')).length,3)
assert.equal(parse(get('02-visitadores-1000.xlsx')).length,1000)
assert.equal(parse(get('03-visitadores-1001.xlsx')).length,1000)
assert.equal(parse(get('04-filas-incompletas.xlsx')).length,1)
assert.equal(parse(get('05-columnas-alternativas.xlsx')).length,1)
assert.equal(parse(get('06-visitadores-validos-3.csv')).length,3)
assert.equal(get('08-archivo-vacio.xlsx').length,0)
assert.ok(get('09-archivo-mas-5mb.xlsx').length>5*1024*1024)
assert.equal(JSON.parse(fs.readFileSync('node_modules/xlsx/package.json','utf8')).version,'0.20.3')
console.log('PASS: fixtures y parser local 0.20.3; no se llamó a API ni D1.')
console.log('CARPETA: '+directory)
console.log('IMPORTANTE: 1001 filas se TRUNCAN a 1000 (no se rechazan). Validar si es el comportamiento de producto esperado.')
console.log('PRUEBA MANUAL EN PREVIEW: subir 01 y confirmar; comprobar 3 registros QA, repetir y verificar actualización sin duplicados; probar CSV 06, archivo 07, vacío 08, >5MiB 09; revisar aislamiento entre patrocinadores.')
console.log('NO ejecutar estas importaciones en Producción. El script NO demuestra persistencia ni permisos de servidor.')
