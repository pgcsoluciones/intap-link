import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read=(p)=>readFile(p,'utf8')
const [migration,api,claimCore,index,entry,webApp,editor,superAdmin,layout,app,login,claim,authCallback,credentials,types,delegationApi,delegationClient,banner,guard,dashboard,identifier,visualEditor,style,teamGuard,pwaBridge,identity,contactOnboarding,account,experience,serviceWorker]=await Promise.all([
  read('api/migrations-preview/0088_free_demo_master_v2.sql'),
  read('api/src/free-demo-v2.ts'),
  read('api/src/free-demo-claim-core.ts'),
  read('api/src/index.ts'),
  read('api/src/preview-free-entry.ts'),
  read('web/src/App.tsx'),
  read('web/src/components/free-demo/FreeDemoEditor.tsx'),
  read('app/src/components/admin/SuperAdminFreeDemoV2.tsx'),
  read('app/src/components/admin/SuperAdminLayout.tsx'),
  read('app/src/App.tsx'),
  read('app/src/components/admin/AdminLogin.tsx'),
  read('app/src/components/admin/FreeDemoV2Claim.tsx'),
  read('app/src/components/admin/AuthCallback.tsx'),
  read('app/src/components/admin/free/FreeCredentials.tsx'),
  read('web/src/components/free-profile/IntapLinkGratis.types.ts'),
  read('api/src/lib/free-demo-delegation.ts'),
  read('app/src/lib/freeDemoDelegation.ts'),
  read('app/src/components/admin/FreeDemoDelegationBanner.tsx'),
  read('app/src/components/admin/AdminGuard.tsx'),
  read('app/src/components/admin/free/FreeDashboard.tsx'),
  read('app/src/components/admin/free/FreeIdentifier.tsx'),
  read('app/src/components/admin/free/FreeVisualEditor.tsx'),
  read('app/src/components/admin/free/FreeStyle.tsx'),
  read('app/src/components/admin/free/TeamPermissionGuard.tsx'),
  read('app/src/components/notifications/PwaNotificationBridge.tsx'),
  read('app/src/components/admin/free/onboarding/FreeOnboardingIdentity.tsx'),
  read('app/src/components/admin/free/onboarding/FreeOnboardingContact.tsx'),
  read('app/src/components/admin/free/FreeAccount.tsx'),
  read('app/src/components/admin/free/FreeExperienceSettings.tsx'),
  read('app/public/sw.js'),
])

// Aislamiento estructural.
assert.doesNotMatch(migration,/ALTER TABLE profiles|DROP TABLE profiles|trial_profiles|sponsored_profiles/i,'0088 no altera Free normal ni toca Trial/Sponsored')
assert.doesNotMatch(api,/trial_profiles|sponsored_profiles|sponsored_/i,'API v2 no depende de Trial ni Sponsored')
assert.match(entry,/import '.\/free-demo-v2'/,'Worker registra v2 por composición sin tocar Trial')
assert.doesNotMatch(editor,/\/trial\/|sponsored/i,'editor v2 no navega a Trial/Sponsored')
for(const route of ['/trial','/trial/edit/:id','/trial/:slug']) assert.ok(webApp.includes(route),'rutas Trial protegidas permanecen registradas')
assert.match(entry,/registerTrialRoutes\(app\)/,'registro Trial permanece en Preview')
assert.ok(entry.indexOf('registerTrialRoutes(app)') < entry.indexOf('registerPreviewAppFallback(app)'),'Trial permanece antes del catch-all Preview')
assert.match(layout,/\{ key: 'trials', label: 'Trials' \}/,'menú Trial permanece en SuperAdmin')
assert.match(app,/path="\/superadmin\/trials"/,'ruta SuperAdmin Trials permanece registrada')

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
assert.match(api,/Banco de demostración/,'cada Demo recibe una cuenta bancaria de ejemplo')
assert.match(api,/promotion:free-demo-v2/,'cuenta bancaria Demo recibe entitlement aislado')
assert.match(claimCore,/Banco de demostración/,'claim elimina la cuenta de ejemplo si nunca fue sustituida')
assert.match(api,/time12\(item\.start_time\).*time12\(item\.end_time\)/,'horario Demo se guarda con AM PM')
assert.match(delegationApi,/normalizeDemoScheduleTemplate/,'delegación Demo repara horarios antiguos sin modificar renderer Free compartido')
assert.match(delegationApi,/to12Hour/,'normalización Demo convierte horarios 24h a AM PM')
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
assert.match(editor,/showOwnerBar=\{false\}/,'vista previa Demo no ejecuta herramientas privadas del dueño Free')
assert.match(editor,/Guardar usuario \/ slug/,'editor permite reservar usuario\/slug antes de publicar')
assert.match(api,/\/superadmin\/free-demo-v2\/:id\/identifier/,'backend reserva slug Demo con control SuperAdmin')
assert.match(editor,/Buscar ubicación/,'editor replica búsqueda de ubicación Free')
assert.match(editor,/Usar mi ubicación actual/,'editor replica geolocalización Free')
assert.match(editor,/fd2-palette-cards/,'editor muestra paletas visuales, no solo un select')
assert.match(editor,/Color personalizado/,'editor conserva color de marca personalizado del Free normal')
assert.match(editor,/credentials:'include'/,'editor reusa sesión SuperAdmin sin sustituirla')

// Lifecycle borrador -> slug final -> publicación.
assert.match(api,/is_published,is_active,created_at,updated_at\)[\s\S]*0,1/,'borrador nace no publicado')
assert.match(api,/publishedAt&&requested!==current/,'slug queda bloqueado tras primera publicación')
assert.match(api,/UPDATE profiles SET name=\?,slug=\?,is_published=1/,'publicación usa Free canónico')
assert.match(superAdmin,/Editar borrador/,'SuperAdmin conserva URL de edición')
assert.match(editor,/Finalizar y publicar/,'editor finaliza desde el borrador')
assert.match(editor,/const saved=await save\(\)/,'publicación exige guardar correctamente el borrador')
assert.match(editor,/if\(!saved\)return/,'fallo de guardado bloquea publicación')
assert.match(editor,/\/admin\/free\?demo_admin=/,'primera publicación entrega inmediatamente el perfil al panel Free normal')

assert.match(superAdmin,/Administrar panel Free/,'después de publicar SuperAdmin ofrece el panel Free normal')
assert.match(superAdmin,/demo_admin=/,'acceso delegado lleva el id de Demo sin crear una sesión del owner interno')
assert.match(delegationClient,/X-Kawvo-Free-Demo-Id/,'cliente adjunta contexto Demo a las APIs Free autorizadas')
assert.match(delegationClient,/normalized==='\/profile\/gallery\/upload'/,'subida canónica de portafolio también conserva la delegación')
assert.match(delegationApi,/admin_users WHERE user_id=\?/,'backend exige rol SuperAdmin para delegación')
assert.match(delegationApi,/d\.published_at IS NOT NULL/,'delegación solo existe después de la primera publicación')
assert.match(delegationApi,/p\.user_id=d\.synthetic_owner_user_id/,'delegación exige ownership interno canónico aún intacto')
assert.match(index,/applyFreeDemoDelegation\(c,actorUserId\)/,'API Free canónica resuelve el owner efectivo desde la sesión SuperAdmin')
assert.match(index,/free_demo_owner_only/,'operaciones exclusivas del propietario quedan bloqueadas durante delegación')
assert.match(index,/slug_locked/,'slug publicado permanece bloqueado también desde el panel Free normal')
assert.match(index,/UPDATE free_demo_v2_claims SET status='revoked'/,'ocultar una Demo desde el panel Free revoca cualquier código de reclamo activo')
assert.match(banner,/panel Free real/,'panel muestra claramente que SuperAdmin administra la Demo sobre el Free real')
assert.match(guard,/delegatedDemoId && location\.pathname\.startsWith\('\/admin\/free'\)/,'AdminGuard mantiene la navegación dentro del árbol Free sin redirigir al home de SuperAdmin')
assert.match(dashboard,/isFreeDemoDelegationActive/,'dashboard Free detecta administración delegada')
assert.match(dashboard,/const baseReady = delegatedDemo \? true/,'Demo publicada no bloquea módulos por contenido starter')
assert.match(dashboard,/const designEditable = delegatedDemo \|\|/,'diseño, plantilla y colores permanecen editables en Demo')
assert.match(dashboard,/const avatarEditable = delegatedDemo \|\|/,'avatar permanece editable en Demo')
assert.match(dashboard,/delegatedDemo \? Promise\.resolve\(\{ ok:true, data:\{ role:'none' \} \}\)/,'dashboard no consulta Team durante Demo')
assert.match(identity,/delegatedDemo \? Promise\.resolve/,'identidad no consulta Team durante Demo')
assert.match(contactOnboarding,/delegatedDemo \? Promise\.resolve/,'contacto no consulta Team durante Demo')
assert.match(dashboard,/<FreeNotificationBell \/>/,'panel Free delegado conserva la campana actual')
assert.match(dashboard,/navigate\('\/admin\/free\/account'\)/,'panel Free delegado conserva Mi cuenta')
assert.doesNotMatch(dashboard,/Agrega tus servicios/,'panel Free actual no reintroduce Servicios')
assert.match(identifier,/Usuario bloqueado después de publicar/,'pantalla de identificador conserva slug bloqueado')
assert.match(identity,/Usuario bloqueado después de la primera publicación/,'pantalla principal de identidad Free bloquea el slug ya publicado')
assert.match(identity,/!delegatedDemo && normalizedSlug/,'identidad no intenta mutar slug durante delegación')
assert.match(visualEditor,/delegatedDemo/,'editor visual Free adapta preview y oculta herramientas no aplicables')
assert.match(style,/delegatedDemo/,'estilo Free conserva edición visual bajo delegación')
assert.match(teamGuard,/isFreeDemoDelegationActive/,'TeamPermissionGuard no consulta ownership Team durante delegación')
assert.match(pwaBridge,/isFreeDemoDelegationActive\(\)\)return/,'PWA push personal no se suscribe durante delegación')
assert.match(account,/Solicitudes y actividad de esta presentación/,'Mi cuenta delegado conserva notificaciones del perfil')
assert.match(account,/<FreeExperienceSettings \/>/,'Mi cuenta conserva Presentación y contacto')
assert.match(account,/Se asignan al propietario cuando reclame esta presentación/,'credenciales continúan protegidas hasta reclamo')
assert.match(experience,/type="time"/,'horario Free usa selectores de hora estructurados')
assert.match(experience,/Configurar disponibilidad de Agenda/,'Mi cuenta conserva acceso a Agenda')
assert.match(experience,/Cotizar \/ información/,'Mi cuenta conserva Cotizar / información')
assert.match(serviceWorker,/kawvo-shell-v3/,'Service Worker invalida shell antiguo del panel Free')
assert.doesNotMatch(delegationApi,/auth_sessions|Set-Cookie|session_hash/,'delegación no crea ni sustituye sesiones')

// Reclamo final: autorización temporal + credenciales normales verificadas.
assert.match(claimCore,/FREE_DEMO_V2_CLAIM_EMAIL='intapcard@gmail\.com'/,'correo especial exacto')
assert.match(api,/special_email:FREE_DEMO_V2_CLAIM_EMAIL,slug:String\(\(row as any\)\.slug\),claim_code:raw/,'respuesta del reclamo contiene correo+slug+código')
assert.match(migration,/code_hash TEXT NOT NULL UNIQUE/,'solo hash del código queda persistido')
assert.match(migration,/claimed_owner_email TEXT/,'histórico conserva snapshot del correo reclamante')
assert.match(login,/free-demo-v2-claim\/login/,'login normal reconoce código de reclamo')
assert.match(login,/auth\/password\/login/,'contraseña real de intapcard conserva fallback')
assert.match(app,/path="\/claim\/free-demo"/,'App expone selección de credencial definitiva')
assert.match(claim,/Continuar con Google/,'claim reutiliza Google existente')
assert.match(claim,/Continuar con correo seguro/,'claim reutiliza correo seguro existente')
assert.match(claim,/magic-link\/start/,'claim inicia el flujo Resend existente')
assert.match(claim,/flow:'free_demo_claim'/,'correo seguro conserva contexto de reclamo')
assert.match(claim,/auth\/google\/start\?flow=free_demo_claim/,'Google conserva contexto de reclamo')
assert.doesNotMatch(claim,/Nueva contraseña Kawvo.*input|type="password"/s,'claim no inventa contraseña paralela')
assert.match(credentials,/Contraseña Kawvo|contraseña/i,'contraseña Kawvo continúa en panel normal de Credenciales')
assert.match(index,/body\?\.flow === 'free_demo_claim'/,'magic-link/start reconoce el flujo de reclamo')
assert.match(index,/c\.req\.query\('flow'\) === 'free_demo_claim'/,'magic-link/verify reconoce el flujo de reclamo')
assert.match(index,/kawvo_free_demo_claim_oauth_flow/,'Google OAuth preserva el flujo de reclamo')
assert.match(index,/finalizeFreeDemoClaimToVerifiedUser/,'Google y correo verifican identidad antes de transferir')
assert.match(authCallback,/authFlow === 'free_demo_claim'/,'callback de correo retoma el reclamo')
assert.match(authCallback,/next_url/,'callback usa la ruta final entregada por backend')
assert.match(claimCore,/UPDATE profiles[\s\S]*SET user_id=\?,template_data=\?/,'claim transfiere ownership del Free real')
assert.match(claimCore,/UPDATE free_demo_v2_claims[\s\S]*SET status='used'/,'claim queda consumido')
assert.match(claimCore,/verified_user_already_has_free_profile/,'se protege el contrato un usuario = un Free')
assert.match(claimCore,/claimed_owner_email=\?/,'claim conserva correo verificado en histórico')
assert.match(claimCore,/cl\.status='active'/,'código permanece activo hasta verificar identidad definitiva')
assert.doesNotMatch(api,/SET status='in_progress' WHERE id=\? AND status='active'/,'login con código no bloquea el reclamo antes de verificar credenciales')
assert.match(superAdmin,/claimed_owner_email/,'histórico SuperAdmin conserva correo del dueño reclamante')

// No reutilizar el mecanismo roto v1.
assert.doesNotMatch(api,/management_sessions|manager_bridge|\/me\/free-demos\/:id\/open/,'v2 no usa bridge ni cambio de sesión')
assert.doesNotMatch(editor,/\/admin\/free\/demos\/edit/,'editor no depende del panel gestor v1')

console.log('Free Demo MASTER v2 forensic contract: OK')
