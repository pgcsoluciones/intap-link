import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(path, 'utf8')
const api = read('api/src/index.ts')
const products = read('app/src/components/admin/SuperAdminArtifacts.tsx')
const sponsorsApi = read('api/src/sponsored-profiles.ts')
const sponsors = read('app/src/components/admin/SuperAdminSponsors.tsx')
const master = read('app/src/components/admin/sponsored/SponsorDashboard.tsx')
const generation = read('api/src/sponsored-code-generation.ts')

const inventory = api.slice(api.indexOf('function normalizeSuperAdminArtifact('), api.indexOf("app.patch('/api/v1/superadmin/artifacts/:id/profile'"))
assert.ok(inventory.includes('display_code: row.display_code ?? null'), 'Product API must expose physical ID')
assert.ok(inventory.includes('a.id, a.public_code, di.display_code'), 'Product inventory must select immutable physical ID')
assert.ok(inventory.includes('LEFT JOIN artifact_display_identifiers di ON di.artifact_id = a.id'), 'Product inventory must join on immutable artifact id')
assert.ok(inventory.includes('di.display_code LIKE ?'), 'Product inventory must search physical ID')
assert.ok(inventory.includes('bindings.push(like, like, like, like, like)'), 'Product search placeholders must match bindings')
assert.match(api, /displayCode,'L',physicalSeq/, 'L IDs must remain immutable at creation')
assert.match(api, /display_code: displayCode/, 'L provision response must include generated ID')
assert.match(products, /display_code\?: string \| null/, 'L UI must accept physical ID')
assert.match(products, /label="Identificador físico" value=\{created\.display_code \|\| '—'\}/, 'New product must show physical ID')
assert.match(products, /'Identificador físico': item\.display_code \|\| '—'/, 'L batch Excel must contain physical ID')
assert.match(products, /item\.display_code \|\| '—'/, 'L products inventory must show physical ID')

const sponsorInventory = sponsorsApi.slice(
  sponsorsApi.indexOf("app.get('/api/v1/superadmin/sponsors/:id/artifacts'"),
  sponsorsApi.indexOf("app.patch('/api/v1/superadmin/sponsors/:id/artifacts/:code/banner'")
)
assert.ok(sponsorInventory.includes('di.display_code'), 'P API must return physical ID')
assert.ok(sponsorInventory.includes("UPPER(COALESCE(di.display_code,'')) LIKE ?"), 'P inventory must search physical ID')
assert.ok(sponsorInventory.includes('binds.push(like,like,like,like,like,like)'), 'P search binding count must match placeholders')
assert.match(sponsors, /display_code\?:string\|null/, 'P UI must declare physical ID')
assert.match(sponsors, /Estación \{row\.display_code\}/, 'P persistent list must show physical ID')
assert.match(generation, /item\.displayCode,'P',item\.sequenceNumber/, 'P generation must retain physical ID')
assert.ok(master.includes('item.display_code'), 'P Master must retain its existing physical ID display')

console.log('L/P Super Admin physical ID creation, persistent inventory, search, Excel and Master parity: OK (static contract)')
