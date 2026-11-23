import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const file='app/src/components/admin/sponsored/SponsorKawMed.tsx'
const s=readFileSync(file,'utf8')
const parsed=ts.createSourceFile(file,s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
assert.equal(parsed.parseDiagnostics.length,0,'G7.1 Kawmed TSX syntax')
const from=s.indexOf('function normalizeKawmedSearch(')
const to=s.indexOf('function appOrigin()',from)
assert.ok(from>0&&to>from)
const helpers=s.slice(from,to)
const js=ts.transpileModule(helpers,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText
const ctx=vm.createContext({})
vm.runInContext(js,ctx)
const match=vm.runInContext('matchesKawmedCodeSearch',ctx)
const c={code:'MED-A77-P8S',display_code:'M0A1',station_number:1,batch_name:'Lote de Prueba',medical_name:'Carmen Jiménez Díaz',medical_specialty:'Medicina General',representative_first_name:'Erika',representative_last_name:'Espinal',representative_zone:'Centro',status:'claimed',representative_id:'v-1'}
assert.equal(match(c,'carmen jimenez'),true)
assert.equal(match(c,'erika general'),true)
assert.equal(match(c,'m0a1 activado'),true)
assert.equal(match(c,'med-a77 prueba'),true)
assert.equal(match(c,'jimenez pediatria'),false)
assert.equal(match(c,''),true)
assert.match(s,/return matchesKawmedCodeSearch\(c,query\)/)
assert.match(s,/filtered.length\} de \{codes.length\} estaciones encontradas/)
assert.match(s,/updateCodeFilters\(\{codeQuery:'',codeStatus:'all',codeRep:'all'\}\)/)
assert.match(s,/function selectFiltered\(\)\{setSelected\(filtered.map\(c=>c.id\)\)\}/)
assert.match(s,/apiPost\('\/sponsor\/kawmed\/assign'/)
assert.doesNotMatch(s,/SponsorCommercialPages|sm_commercial_page|\/sponsor\/commercial\/sellers\/page/)
console.log('PASS G7.1 Kawmed launch search: accent, multiple words, station, filters, selection and existing assignments; NO deploy')
