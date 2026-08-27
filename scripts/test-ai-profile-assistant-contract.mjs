import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const apiSource = await readFile(join(root, 'api/src/ai-profile-assistant.ts'), 'utf8')
const appSource = await readFile(join(root, 'app/src/components/admin/free/FreeAiProfileAssistant.tsx'), 'utf8')
const appRoutes = await readFile(join(root, 'app/src/App.tsx'), 'utf8')
const usageProd = await readFile(join(root, 'api/migrations/0039_ai_profile_assistant_usage.sql'), 'utf8')
const usagePreview = await readFile(join(root, 'api/migrations-preview/0039_ai_profile_assistant_usage.sql'), 'utf8')
const consentProd = await readFile(join(root, 'api/migrations/0040_ai_assistant_terms_acceptances.sql'), 'utf8')
const consentPreview = await readFile(join(root, 'api/migrations-preview/0040_ai_assistant_terms_acceptances.sql'), 'utf8')

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
function sqlBody(source) { return source.split('\n').filter((line)=>!line.trim().startsWith('--')).join('\n').trim() }

assert.match(apiSource, /https:\/\/api\.openai\.com\/v1\/responses/, 'Responses API must remain server-side')
assert.match(apiSource, /OPENAI_API_KEY/, 'OpenAI key must be Worker secret')
assert.match(apiSource, /store:\s*false/, 'OpenAI response storage must be disabled')
assert.match(apiSource, /safety_identifier/, 'Privacy-preserving safety identifier required')
assert.match(apiSource, /type:\s*'json_schema'/, 'Strict Structured Outputs required')
assert.match(apiSource, /strict:\s*true/, 'Structured output must be strict')
assert.match(apiSource, /status:\s*'needs_more_info'/, 'Guided flow must support needs_more_info')
assert.match(apiSource, /status:\s*'ready'/, 'Guided flow must support ready')
assert.match(apiSource, /questions\.map|slice\(0, 3\)/, 'Follow-up questions must be capped at three')
assert.match(apiSource, /ai_assistant_terms_acceptances/, 'Generation must use versioned AI terms consent')
assert.match(apiSource, /consent_required/, 'Missing consent must block model use')
assert.match(apiSource, /AI_TERMS_VERSION/, 'Terms version must be configurable')
assert.match(apiSource, /AI_PROFILE_MONTHLY_LIMIT/, 'Monthly quota must be backend-configurable')
assert.match(apiSource, /AI_PROFILE_MAX_ROUNDS/, 'Guided rounds must be backend-configurable')
assert.match(apiSource, /FREE_MAX_SERVICES/, 'Free service cap must come from backend configuration')
assert.match(apiSource, /FREE_MAX_PORTFOLIO/, 'Free portfolio cap must come from backend configuration')
assert.match(apiSource, /editing_scope/, 'Editing scope must be enforced server-side and sent as model context')
assert.match(apiSource, /profile_gallery/, 'Assistant must understand portfolio metadata without modifying images')
assert.match(apiSource, /UPDATE profile_gallery SET title = \?, description = \?/, 'Portfolio apply may update text metadata only')
assert.match(apiSource, /configuredChannels/, 'Configured quick-contact channels must be contextual input')
assert.match(apiSource, /image_suggestions/, 'Model may return textual image suggestions')
assert.match(apiSource, /nunca generación ni modificación/i, 'Prompt must forbid image generation/modification')
assert.match(apiSource, /Nunca inventes/i, 'Editorial brain must explicitly forbid invented facts/services')
assert.match(apiSource, /carta de presentación digital|primera impresión/i, 'Editorial brain must encode Kawvo first-impression mission')
assert.match(apiSource, /published:false|published:\s*false/, 'Apply endpoint must explicitly remain unpublished')
assert.match(apiSource, /replace_services_confirmation_required/, 'Existing service copy update requires explicit confirmation')
assert.match(apiSource, /validateProposal\(body\?\.proposal/, 'Apply must validate proposal again server-side')
assert.match(apiSource, /DB\.batch\(statements\)/, 'Apply must group writes')
assert.doesNotMatch(apiSource, /DELETE\s+FROM\s+profile_products/i, 'AI may not delete existing services')
assert.doesNotMatch(apiSource, /DELETE\s+FROM\s+profile_gallery/i, 'AI may not delete portfolio images')

assert.doesNotMatch(usageProd, /answers|prompt|proposal|conversation/i, 'Usage table must not store conversation content')
assert.equal(sqlBody(usageProd), sqlBody(usagePreview), 'Usage migrations must match')
assert.equal(sqlBody(consentProd), sqlBody(consentPreview), 'Consent/access-control migrations must match')
assert.match(consentProd, /terms_version/, 'Consent must be versioned')
assert.match(consentProd, /accepted_at/, 'Consent timestamp required')
assert.match(consentProd, /locale/, 'Consent locale required')
assert.match(consentProd, /source/, 'Consent source required')
assert.match(consentProd, /ai_assistant_access_controls/, 'Abuse suspension scaffold must be separate from usage quota')

assert.match(appRoutes, /lazy\(\(\) => import\('\.\/components\/admin\/free\/FreeAiProfileAssistant'\)\)/, 'Assistant route must stay lazy-loaded')
assert.match(appSource, /Asistente IA de Kawvo · Beta/, 'Beta status must be visible')
assert.match(appSource, /He leído y acepto las condiciones/, 'Consent checkbox must be explicit and unchecked by default')
assert.match(appSource, /Aceptar y continuar/, 'Consent requires affirmative action')
assert.match(appSource, /Ahora no/, 'Consent must offer refusal')
assert.match(appSource, /needs_more_info/, 'UI must render guided follow-up state')
assert.match(appSource, /Aplicar a mi perfil/, 'Review must require explicit apply')
assert.match(appSource, /Nada se aplicará/, 'UI must explain no automatic changes')
assert.match(appSource, /no fue publicado automáticamente/i, 'Apply success must distinguish apply from publish')
assert.match(appSource, /Solicitar Plan Básico/, 'Free-plan limit notice must reuse existing Basic upgrade path')
assert.match(appSource, /Son recomendaciones, no imágenes generadas/, 'Image suggestions must remain textual')
assert.match(appSource, /No cambia tus Botones rápidos/, 'Channel preference must not mutate quick actions')
assert.match(appSource, /conservará los servicios existentes/i, 'UI must accurately explain non-destructive service updates')
assert.match(appSource, /Completar solo lo que falta/, 'UI must offer safe missing-only scope')
assert.match(appSource, /Revisar y mejorar mi contenido/, 'UI must offer full-profile editorial review')
assert.match(appSource, /Puedes generar otra propuesta en/, 'Cooldown must be presented as normal waiting state')
assert.match(appSource, /Mis trabajos/, 'Portfolio copy review must be visible')

for (const area of ['app','web']) {
  for (const file of await collectFiles(join(root, area))) {
    if (!/\.(ts|tsx|js|jsx|css|html)$/.test(file)) continue
    const source = await readFile(file,'utf8')
    assert.doesNotMatch(source, /OPENAI_API_KEY|api\.openai\.com\/v1\/responses/, `OpenAI secret/API leaked into frontend: ${file}`)
  }
}

console.log('AI profile assistant contract checks: OK')
