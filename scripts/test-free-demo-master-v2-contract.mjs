import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read=(p)=>readFile(p,'utf8')
const [migration,api,entry,webApp,editor,superAdmin,layout,app,login,claim,types]=await Promise.all([
  read('api/migrations-preview/0088_free_demo_master_v2.sql'),
  read('api/src/free-demo-v2.ts'),
  read('api/src/preview-free-entry.ts'),
  read('web/src/App.tsx'),
  read('web/src/components/free-demo/FreeDemoEditor.tsx'),
  read('app/src/components/admin/SuperAdminFreeDemoV2.tsx'),
  read('app/src/components/admin/SuperAdminLayout.tsx'),
  read('app/src/App.tsx'),
  read('app/src/components/admin/AdminLogin.tsx'),
  read('app/src/components/admin/FreeDemoV2Claim.tsx'),
  read('web/src/components/free-profile/IntapLinkGratis.types.ts'),
])

// Aislamiento estructural.
assert.doesNotMatch(migration,/ALTER TABLE profiles|DROP TABLE profiles|trial_profiles|sponsored_profiles/i,'0088 no altera Free normal ni toca Trial/Sponsored')
assert.doesNotMatch(api,/trial_profiles|sponsored_profiles|sponsored_/i,'API v2 no depende de Trial ni Sponsored')
assert.match(entry,/import '.\/free-demo-v2'/,'Worker registra v2 por composición sin tocar Trial')
assert.doesNotMatch(editor,/\/trial\/|sponsored/i,'editor v2 no navega a Trial/Sponsored')

// Perfil Free canónico + ownership normal intacto.
assert.match(api,/INSERT INTO profiles\(id,user_id,slug,plan_id/,'borrador usa tabla canónica profiles')
assert.match(api,/VALUES\(\?,\?,\?,'free'/,'borrador es plan Free real')
assert.match(api,/synthetic_owner_user_id/,'cada borrador tiene owner interno único')
assert.doesNotMatch(api,/INSERT INTO auth_sessions[\s\S]{0,500}synthetic_owner/i,'editor nunca impersona al owner interno')
assert.match(migration,/profile_id TEXT NOT NULL UNIQUE/,'metadata v2 tiene relación uno a uno con perfil')
assert.match(migration,/synthetic_owner_user_id TEXT NOT NULL UNIQUE/,'owner interno no se comparte entre borradores')

// Fuente única de plantillas: starter existente.
assert.match(api,/resolveFreeStarterContent/,'usa textos del Free Starter existente')
assert.match(api,/FREE_PROFILE_STARTER_ASSETS/,'usa banco gráfico del Free Starter existente')
assert.match(api,/FREE_PROFILE_CATEGORIES/,'catálogo incluye categorías clasificadas por la plataforma')
assert.match(api,/key:'ferreteria'/,'Ferretería tiene base lista')
assert.match(api,/key:'serigrafia-impresion'/,'Serigrafía/impresión tiene base lista')
assert.match(superAdmin,/Usar plantilla base/,'SuperAdmin clona la base directamente')
assert.match(api,/edit_url:webOrigin\(c\)\+'\/free-demo\/edit\/'\+demoId/,'crear borrador entrega URL de edición')

// Sin Servicios y con límites Free reales solicitados.
assert.doesNotMatch(api,/INSERT INTO profile_products|DELETE FROM profile_products/,'Demo v2 nunca materializa Servicios')
assert.match(api,/SELECT COUNT\(\*\) AS n FROM profile_products/,'editor verifica que Servicios permanezca vacío')
assert.match(api,/const MAX_PORTFOLIO=10/,'portafolio v2 respeta límite Free 10')
assert.match(api,/const MAX_QUICK_ACTIONS=3/,'botones rápidos v2 respetan límite Free 3')
assert.match(api,/const MAX_LINKS=3/,'enlaces v2 respetan límite Free 3')
assert.match(types,/maxPortfolioImages: 10/,'límite canónico Free de portafolio sigue en 10')
assert.match(types,/maxQuickActions: 3/,'límite canónico Free de botones sigue en 3')
assert.match(types,/maxCustomLinks: 3/,'límite canónico Free de enlaces sigue en 3')
assert.match(editor,/services:\[\]/,'vista previa v2 no muestra Servicios')

// Horario, Cotizar y Agenda son funciones Free reales.
assert.match(api,/INSERT INTO appointment_settings\(subject_type,subject_id,enabled/,'creación inicializa agenda Free real dentro del mismo batch')
assert.match(api,/VALUES\('free',\?,1,30,120,30/,'agenda nace activa en base Demo')
assert.match(api,/saveAppointmentConfiguration\(c\.env\.DB,'free',profileId/,'editor guarda agenda mediante core Free')
assert.match(api,/free_quote_button_visible:true/,'base trae Cotizar activo')
assert.match(api,/free_schedule_visible:true/,'base trae Horario visible')

// Editor protegido por SuperAdmin, nunca por sesión del owner sintético.
for(const route of [
  /app\.get\('\/api\/v1\/superadmin\/free-demo-v2\/:id\/editor',requireSuperAdmin\('super_admin'\)/,
  /app\.patch\('\/api\/v1\/superadmin\/free-demo-v2\/:id\/profile',requireSuperAdmin\('super_admin'\)/,
  /app\.put\('\/api\/v1\/superadmin\/free-demo-v2\/:id\/portfolio',requireSuperAdmin\('super_admin'\)/,
  /app\.post\('\/api\/v1\/superadmin\/free-demo-v2\/:id\/publish',requireSuperAdmin\('super_admin'\)/,
])assert.match(api,route,'mutación Demo v2 requiere SuperAdmin')
assert.match(webApp,/path="\/free-demo\/edit\/:id"/,'Web expone URL de edición dedicada')
assert.match(editor,/app\.preview\.intaprd\.com/,'editor Preview consulta API autenticada del App')
assert.match(editor,/credentials:'include'/,'editor reusa sesión SuperAdmin sin sustituirla')

// Lifecycle borrador -> slug final -> publicación.
assert.match(api,/is_published,is_active,created_at,updated_at\)[\s\S]*0,1/,'borrador nace no publicado')
assert.match(api,/publishedAt&&requested!==current/,'slug queda bloqueado tras primera publicación')
assert.match(api,/UPDATE profiles SET name=\?,slug=\?,is_published=1/,'publicación usa Free canónico')
assert.match(superAdmin,/Editar borrador/,'SuperAdmin conserva URL de edición')
assert.match(editor,/Finalizar y publicar/,'editor finaliza desde el borrador')
assert.match(editor,/const saved=await save\(\)/,'publicación exige guardar correctamente el borrador')
assert.match(editor,/if\(!saved\)return/,'fallo de guardado bloquea publicación')

// Reclamo final: correo especial + slug + código, hash, ownership definitivo.
assert.match(api,/const CLAIM_EMAIL='intapcard@gmail\.com'/,'correo especial exacto')
assert.match(api,/special_email:CLAIM_EMAIL,slug:String\(\(row as any\)\.slug\),claim_code:raw/,'respuesta del reclamo contiene correo+slug+código')
assert.match(migration,/code_hash TEXT NOT NULL UNIQUE/,'solo hash del código queda persistido')
assert.match(api,/UPDATE profiles SET user_id=\?,template_data=\?/,'claim transfiere ownership del Free real')
assert.match(api,/UPDATE free_demo_v2_claims SET status='used'/,'claim queda consumido')
assert.match(api,/CASE WHEN EXISTS\(SELECT 1 FROM profiles p JOIN free_demo_v2_profiles d/,'transferencia final fuerza rollback transaccional si falla una precondición')
assert.match(login,/free-demo-v2-claim\/login/,'login normal reconoce código de reclamo')
assert.match(login,/auth\/password\/login/,'contraseña real de intapcard conserva fallback')
assert.match(app,/path="\/claim\/free-demo"/,'App expone pantalla de credenciales definitivas')
assert.match(claim,/Tu correo definitivo/,'claim solicita correo definitivo')
assert.match(claim,/Nueva contraseña Kawvo/,'claim solicita contraseña definitiva')

// No reutilizar el mecanismo roto v1.
assert.doesNotMatch(api,/management_sessions|manager_bridge|\/me\/free-demos\/:id\/open/,'v2 no usa bridge ni cambio de sesión')
assert.doesNotMatch(editor,/\/admin\/free\/demos\/edit/,'editor no depende del panel gestor v1')

console.log('Free Demo MASTER v2 forensic contract: OK')
