import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {build} from 'esbuild'

const config=readFileSync('api/wrangler.g7-2a-stage.toml','utf8')
const entry=readFileSync('api/src/g7-2a-stage-entry.ts','utf8')
const official=readFileSync('api/wrangler.preview.toml','utf8')

assert.match(config,/^name\s*=\s*"kawvo-g7-2a-readonly-stage"\s*$/m)
assert.match(config,/^main\s*=\s*"src\/g7-2a-stage-entry.ts"\s*$/m)
assert.match(config,/^ENVIRONMENT\s*=\s*"preview"\s*$/m)
assert.match(config,/^database_name\s*=\s*"intap_db_preview"\s*$/m)
assert.match(config,/^database_id\s*=\s*"e9f46214-623f-48da-af13-74198e12b222"\s*$/m)
assert.doesNotMatch(config,/^\s*(?:routes|crons|APP_PAGES_ORIGIN|WEB_PAGES_ORIGIN|zone_name|custom_domain|bucket_name)\s*=/m)
assert.doesNotMatch(config,/^\s*\[\[\s*(?:routes|r2_buckets)\s*\]\]\s*$/m)
assert.doesNotMatch(config,/^\s*\[\s*triggers\s*\]\s*$/m)
assert.doesNotMatch(config,/intap_db"\s*$|intap-r2"|intap-api-preview"|intap-api"/m)
assert.match(official,/^name\s*=\s*"intap-api-preview"\s*$/m)
assert.match(entry,/app\.all\('\*'/)
// Inspect executable import statements, not explanatory comments.
const executable=entry.split('\n').filter(line=>!/^\s*\/\//.test(line)).join('\n')
assert.doesNotMatch(executable,/^\s*(?:import|export)\b[^\n]*\b(?:preview-frontdoor-entry|preview-free-entry|sponsor-commercial-sales)\b/m)
assert.doesNotMatch(executable,/\.run\s*\(|\.batch\s*\(/)
const endpoints=[...entry.matchAll(/app\.get\(/g)]
assert.equal(endpoints.length,1,'Only the two endpoints in an explicit resource allowlist loop')
assert.match(entry,/for\(const resource of \['sellers','assignments'\] as const\)/)
const result=await build({entryPoints:['api/src/g7-2a-stage-entry.ts'],bundle:true,write:false,platform:'browser',format:'esm',target:'es2022',logLevel:'silent'})
assert.ok(result.outputFiles[0].contents.length>0)
console.log('PASS G7.2-A isolated Stage static contract and bundle; NO deploy')
