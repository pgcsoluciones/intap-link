import fs from 'node:fs'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'

const source=fs.readFileSync('app/src/components/admin/SuperAdminKawMed.tsx','utf8')
const api=fs.readFileSync('api/src/medical-access-codes.ts','utf8')

assert.match(source,/const MED_PAGE_SIZE=7\b/,'Both MED code lists must use seven items per page')
assert.match(source,/type MedGroup='sponsored'\|'independent'/,'The two MED code categories must be explicit')
assert.match(source,/filtered\.filter\(row=>Boolean\(row\.program_id\)\)/,'Sponsored grouping must use the authoritative program id')
assert.match(source,/filtered\.filter\(row=>!row\.program_id\)/,'Independent grouping must exclude sponsored codes')
const listRoute=api.slice(api.indexOf("app.get('/api/v1/superadmin/kawmed/codes',"),api.indexOf("app.get('/api/v1/superadmin/kawmed/profiles',"))
assert.match(listRoute,/requireSuperAdmin\('viewer'\)/,'MED list retains the existing server authorization')
const select=listRoute.match(/\.prepare\(`(SELECT[\s\S]*?)`\)\.bind\(\.\.\.binds\)\.all\(\)/)?.[1]
assert.ok(select,'Exercise the SELECT actually executed by the MED list handler')
assert.match(select,/SELECT\s+mac\.\*,/,'MED classification keeps every authoritative medical_access_codes field')
assert.match(select,/\bmdi\.display_code\b/,'Recovered immutable station label must remain available')
assert.match(select,/\bb\.name AS batch_name\b/,'Batch name must remain available without requiring adjacent SELECT fields')
assert.match(select,/LEFT JOIN medical_display_identifiers mdi ON mdi\.medical_code_id=mac\.id/,'Station labels join by the exact medical code identity without excluding unlabelled codes')
const sql=select.replace("${where.join(' AND ')}",'1=1')
assert.doesNotMatch(sql,/\$\{/,'No unresolved dynamic SQL in the local fixture')
const queries=[sql,select.replace("${where.join(' AND ')}",'mac.program_id=?'),sql.replace('mac.*','mac.id,mac.code'),sql.replace('mdi.medical_code_id=mac.id',"mdi.medical_code_id='missing-fixture-code'")]
const results=JSON.parse(execFileSync('python3',['-c',`
import sqlite3,json,sys
db=sqlite3.connect(':memory:');db.row_factory=sqlite3.Row
db.executescript("""
CREATE TABLE medical_access_codes(id TEXT,code TEXT,program_id TEXT,batch_id TEXT,claimed_by_user_id TEXT,medical_profile_id TEXT,current_representative_id TEXT,created_at TEXT);
CREATE TABLE medical_display_identifiers(medical_code_id TEXT,display_code TEXT);
CREATE TABLE medical_code_batches(id TEXT,name TEXT);
CREATE TABLE medical_sponsor_programs(id TEXT,name TEXT,sponsor_id TEXT);
CREATE TABLE sponsor_tenants(id TEXT,name TEXT);
CREATE TABLE users(id TEXT,email TEXT);
CREATE TABLE medical_profiles(id TEXT,name TEXT,slug TEXT,specialty TEXT,whatsapp TEXT,phone TEXT,email TEXT);
CREATE TABLE medical_representatives(id TEXT,first_name TEXT,last_name TEXT,whatsapp TEXT,zone TEXT);
INSERT INTO medical_code_batches VALUES('fixture-batch','Fixture batch');
INSERT INTO sponsor_tenants VALUES('fixture-sponsor','Fixture sponsor');
INSERT INTO medical_sponsor_programs VALUES('fixture-program','Fixture program','fixture-sponsor');
INSERT INTO medical_access_codes VALUES('independent','MED-FIXTURE-I',NULL,'fixture-batch',NULL,NULL,NULL,'2026-01-03');
INSERT INTO medical_access_codes VALUES('sponsored','MED-FIXTURE-S','fixture-program','fixture-batch',NULL,NULL,NULL,'2026-01-02');
INSERT INTO medical_access_codes VALUES('unlabelled','MED-FIXTURE-U',NULL,NULL,NULL,NULL,NULL,'2026-01-01');
INSERT INTO medical_display_identifiers VALUES('independent','M001');
INSERT INTO medical_display_identifiers VALUES('sponsored','M002');
""")
queries=json.load(sys.stdin)
print(json.dumps([[dict(row) for row in db.execute(query,['fixture-program'] if i==1 else [])] for i,query in enumerate(queries)]))
`],{input:JSON.stringify(queries),encoding:'utf8'}))
function verifyClassification(rows){
 assert.equal(rows.length,3,'Label joins must preserve all fixture codes')
 for(const row of rows)assert.ok(Object.hasOwn(row,'program_id'),'Each row exposes the authoritative program_id, including null')
 assert.deepEqual(rows.filter(row=>Boolean(row.program_id)).map(row=>row.code),['MED-FIXTURE-S'])
 assert.deepEqual(rows.filter(row=>!row.program_id).map(row=>row.code),['MED-FIXTURE-I','MED-FIXTURE-U'])
 assert.deepEqual(rows.map(row=>row.display_code),['M001','M002',null])
 assert.equal(rows[1].program_name,'Fixture program');assert.equal(rows[1].sponsor_name,'Fixture sponsor')
 assert.equal(rows[1].batch_name,'Fixture batch')
}
verifyClassification(results[0])
assert.deepEqual(results[1].map(row=>row.code),['MED-FIXTURE-S'],'Server-side program filter remains effective')
assert.throws(()=>verifyClassification(results[2]),assert.AssertionError,'Removing program_id must still fail this contract')
assert.throws(()=>verifyClassification(results[3]),assert.AssertionError,'Breaking station label identity must fail this contract')
assert.match(source,/rows\.slice\(\(current-1\)\*MED_PAGE_SIZE,current\*MED_PAGE_SIZE\)/,'MED accordion must paginate before rendering')
assert.match(source,/group="sponsored" title="Códigos patrocinados"/,'Sponsored accordion missing')
assert.match(source,/group="independent" title="Códigos independientes"/,'Independent accordion missing')
assert.match(source,/onPageChange=\{value=>setMedPages\(p=>\(\{\.\.\.p,sponsored:value\}\)\)\}/,'Sponsored page must be independent')
assert.match(source,/onPageChange=\{value=>setMedPages\(p=>\(\{\.\.\.p,independent:value\}\)\)\}/,'Independent page must be independent')
assert.match(source,/aria-expanded=\{expanded\}/,'Accordion toggle must expose accessible state')
assert.match(source,/setMedPages\(\{sponsored:1,independent:1\}\)/,'Filters must reset both pages')
assert.match(source,/Códigos creados \(\{generated\.length\}\)/,'Recently generated codes must have a separate accordion')
assert.match(source,/generated\.slice\(/,'Recently generated codes must be paginated')
assert.match(source,/MedPagination page=\{generatedPage\}/,'Recently generated codes must have pagination controls')
assert.match(source,/Copiar listado completo/,'Copy all generated codes must be retained')
assert.match(source,/toggleCode=\{toggleCode\}/,'MED status control must be retained')
assert.match(source,/copyCodeClaimUrl=\{copyCodeClaimUrl\}/,'MED activation link copy must be retained')
assert.doesNotMatch(source,/filtered\.map\(row=>/,'Legacy mixed table must no longer render all rows')
console.log('KawMed MED-code grouped accordions and 7-item pagination: OK')
console.log('PASS MED SELECT: local SQLite sponsored/independent/unlabelled codes, program filter and two negative controls; fixtures only')
