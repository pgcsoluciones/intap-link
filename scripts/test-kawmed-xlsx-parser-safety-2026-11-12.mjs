import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const source=readFileSync('app/src/components/admin/sponsored/SponsorKawMed.tsx','utf8')
const checks=[
[/setImportRows\(\[\]\)[\s\S]*?MAX_IMPORT_BYTES=5\*1024\*1024/,'Stale pending import cleared and max size enforced'],
[/file\.size<=0\|\|file\.size>MAX_IMPORT_BYTES/,'Reject empty/large imports before parsing'],
[/\\?\.\(xlsx\|xls\|csv\)\$/,'Existing file types preserved'],
[/XLSX\.read\(buffer,\{type:'array',sheetRows:1001\}\)/,'Cap sheet materialization to 1000 records + header'],
[/const ws=wb\.Sheets\[wb\.SheetNames\[0\]\]/,'First worksheet behavior unchanged'],
[/raw\.slice\(0,1000\)/,'Existing max 1000 rows preserved'],
[/row\.Codigo\|\|row\.codigo\|\|row\.employee_code/,'Employee code fallback preserved'],
[/row\.WhatsApp\|\|row\.whatsapp\|\|row\.Telefono\|\|row\.telefono/,'WhatsApp/phone fallbacks preserved'],
[/apiPost\('\/sponsor\/kawmed\/representatives\/import'/,'Existing API and business import flow retained'],
[/XLSX\.writeFile\(wb,'plantilla-visitadores-kawmed\.xlsx'\)/,'Template download remains unchanged'],
[/apiPost\('\/sponsor\/kawmed\/assign'/,'Assignments remain unchanged']
]
for(const [pattern,label] of checks)assert.match(source,pattern,label)
const lock=JSON.parse(readFileSync('package-lock.json','utf8'))
const pkg=JSON.parse(readFileSync('app/package.json','utf8'))
const spec=String(pkg.dependencies?.xlsx||'')
const resolved=String(lock.packages?.['node_modules/xlsx']?.resolved||'')
const version=String(lock.packages?.['node_modules/xlsx']?.version||'')
assert.match(spec,/^https:\/\/cdn\.sheetjs\.com\/xlsx-0\.20\.3\/xlsx-0\.20\.3\.tgz$/,'Pinned patched SheetJS source required')
assert.match(resolved,/^https:\/\/cdn\.sheetjs\.com\/xlsx-0\.20\.3\/xlsx-0\.20\.3\.tgz$/,'Lockfile must resolve to official patched archive')
assert.equal(version,'0.20.3','Only reviewed patched xlsx 0.20.3 allowed')
const XLSX=await import('xlsx')
assert.equal(XLSX.version,'0.20.3','Runtime module must match patched lock')
const columns=['Codigo','Nombre','Apellido','WhatsApp','Correo','Zona','Territorio']
const input={Codigo:'V001',Nombre:'Carlos',Apellido:'Pérez',WhatsApp:'8095551234',Correo:'carlos@example.com',Zona:'Distrito Nacional',Territorio:'Centro'}
const sheet=XLSX.utils.json_to_sheet([input])
const book=XLSX.utils.book_new()
XLSX.utils.book_append_sheet(book,sheet,'Visitadores')
const bytes=XLSX.write(book,{type:'buffer',bookType:'xlsx'})
const parsed=XLSX.read(bytes,{type:'buffer',sheetRows:1001})
const roundtrip=XLSX.utils.sheet_to_json(parsed.Sheets[parsed.SheetNames[0]],{defval:''})
assert.equal(roundtrip.length,1)
for(const key of columns)assert.equal(String(roundtrip[0][key]),input[key],'Excel field roundtrip '+key)
console.log('PASS: patched SheetJS 0.20.3 locked + visitador import/export roundtrip + bounded parser and unchanged API')
