import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const apiPath = join(root, 'api/src/ai-profile-assistant.ts')
const apiSource = await readFile(apiPath, 'utf8')
const appSource = await readFile(join(root, 'app/src/components/admin/free/FreeAiProfileAssistant.tsx'), 'utf8')
const appRoutes = await readFile(join(root, 'app/src/App.tsx'), 'utf8')
const productionMigration = await readFile(join(root, 'api/migrations/0039_ai_profile_assistant_usage.sql'), 'utf8')
const previewMigration = await readFile(join(root, 'api/migrations-preview/0039_ai_profile_assistant_usage.sql'), 'utf8')

async function collectFiles(dir) {
  const result = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === 'dist' || entry.name === 'node_modules') continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) result.push(...await collectFiles(path))
    else result.push(path)
  }
  return result
}

function sqlBody(source) {
  return source.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n').trim()
}

assert.match(apiSource, /https:\/\/api\.openai\.com\/v1\/responses/, 'Responses API must be used server-side')
assert.match(apiSource, /OPENAI_API_KEY/, 'Worker must read the OpenAI secret from environment')
assert.match(apiSource, /store:\s*false/, 'Responses must disable OpenAI response storage')
assert.match(apiSource, /safety_identifier/, 'Requests should use a privacy-preserving safety identifier')
assert.match(apiSource, /type:\s*'json_schema'/, 'Structured Outputs JSON Schema is required')
assert.match(apiSource, /strict:\s*true/, 'Structured Outputs must be strict')
assert.match(apiSource, /MAX_TOTAL_INPUT_LENGTH/, 'Input size guard is required')
assert.match(apiSource, /MAX_GENERATIONS_PER_DAY/, 'Daily generation limit is required')
assert.match(apiSource, /COOLDOWN_SECONDS/, 'Cooldown is required')
assert.match(apiSource, /requireAssistantAuth/, 'Assistant endpoints must require authentication')
assert.match(apiSource, /replace_services_confirmation_required/, 'Updating existing services must require explicit confirmation')
assert.match(apiSource, /validateProposal\(body\?\.proposal\)/, 'Apply endpoint must validate AI proposal again')
assert.match(apiSource, /DB\.batch\(statements\)/, 'Apply operation must group database writes')
assert.doesNotMatch(apiSource, /DELETE\s+FROM\s+profile_products/i, 'AI must not destructively delete existing services')
assert.doesNotMatch(productionMigration, /answers|prompt|proposal|conversation/i, 'Usage table must not store user conversation text')
assert.equal(sqlBody(productionMigration), sqlBody(previewMigration), 'Production and preview usage schemas must remain equivalent')
assert.match(appRoutes, /lazy\(\(\) => import\('\.\/components\/admin\/free\/FreeAiProfileAssistant'\)\)/, 'Assistant route should be code-split for mobile performance')
assert.match(appRoutes, /\/admin\/free\/ai-profile/, 'Assistant must be reachable from authenticated Free routes')
assert.match(appSource, /Aplicar a mi perfil/, 'Review must require an explicit apply action')
assert.match(appSource, /Nada se aplicará/, 'UI must explain that generated content is not auto-applied')
assert.match(appSource, /replaceServices/, 'UI must expose confirmation before AI updates existing services')

for (const area of ['app', 'web']) {
  for (const file of await collectFiles(join(root, area))) {
    if (!/\.(ts|tsx|js|jsx|css|html)$/.test(file)) continue
    const source = await readFile(file, 'utf8')
    assert.doesNotMatch(source, /OPENAI_API_KEY|api\.openai\.com\/v1\/responses/, `OpenAI secret/API call leaked into frontend: ${file}`)
  }
}

console.log('AI profile assistant contract checks: OK')
