import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read=(p)=>readFile(p,'utf8')
const [migration,managementMigration,templateCodeMigration,core,routes,scan,entry,home,app,guard,login,activation,superAdmin,layout,manager,editEntry,bridge,claim]=await Promise.all([
  read('api/migrations-preview/0085_free_demo_templates_claim.sql'),
  read('api/migrations-preview/0086_free_demo_management_sessions.sql'),
  read('api/migrations-preview/0087_free_demo_template_codes.sql'),
  read('api/src/free-demo-core.ts'),
  read('api/src/free-demo-routes.ts'),
  read('api/src/scan-to-claim.ts'),
  read('api/src/preview-free-entry.ts'),
  read('api/src/account-home-route.ts'),
  read('app/src/App.tsx'),
  read('app/src/components/admin/AdminGuard.tsx'),
  read('app/src/components/admin/AdminLogin.tsx'),
  read('app/src/components/admin/free/onboarding/FreeArtifactActivation.tsx'),
  read('app/src/components/admin/SuperAdminFreeDemos.tsx'),
  read('app/src/components/admin/SuperAdminLayout.tsx'),
  read('app/src/components/admin/free/FreeDemoManager.tsx'),
  read('app/src/components/admin/free/FreeDemoEditEntry.tsx'),
  read('app/src/components/admin/free/FreeDemoManagementBridge.tsx'),
  read('app/src/components/admin/FreeDemoClaim.tsx'),
])

// Aislamiento: Free Demo nunca depende de Trial.
for(const [name,source] of [['core',core],['routes',routes],['manager',manager],['bridge',bridge],['claim',claim]]){
  assert.doesNotMatch(source,/trial_profiles|\/trial\/|trial_leads|registerTrial/i, `${name}: Free Demo no debe mezclarse con Trial`)
}

// Regla normal Free intacta + excepción exacta.
assert.match(core,/FREE_DEMO_MANAGER_EMAIL='intapcard@gmail\.com'/,'correo especial exacto')
assert.match(scan,/createManagedFreeDemoFromArtifact/,'scan-to-claim reconoce excepción aislada')
assert.match(scan,/Usuarios normales conservan exactamente el flujo histórico de un perfil por cuenta/,'flujo normal documentado e intacto')
assert.match(core,/synthetic_owner_user_id/,'cada Demo usa owner sintético independiente')
assert.match(core,/VALUES\(\?,\?,\?,'free'/,'las Demos son perfiles Free canónicos')
assert.match(migration,/free_demo_profiles/,'metadata Demo aislada')
assert.match(migration,/free_demo_claims/,'claims aislados')
assert.doesNotMatch(migration,/ALTER TABLE profiles|DROP TABLE profiles/,'la migración no altera profiles')
assert.match(managementMigration,/free_demo_management_sessions/,'bridge de edición tiene tabla aislada')
assert.doesNotMatch(managementMigration,/ALTER TABLE profiles|DROP TABLE profiles/,'bridge tampoco altera profiles')
assert.match(templateCodeMigration,/free_demo_template_codes/,'códigos Demo de plantilla tienen almacenamiento aislado')
assert.match(templateCodeMigration,/published_at/,'primera publicación fija el slug definitivo')
assert.doesNotMatch(templateCodeMigration,/ALTER TABLE profiles|DROP TABLE profiles/,'códigos Demo no alteran schema Free')

// Plantillas precargadas reutilizan el starter Free aprobado y no assets inventados.
assert.match(core,/resolveFreeStarterContent/,'reutiliza textos canónicos Free Starter')
assert.match(core,/FREE_PROFILE_STARTER_ASSETS/,'reutiliza banco gráfico canónico Free Starter')
assert.match(core,/key:'hardware',label:'Ferretería'/,'Ferretería precargada')
assert.match(core,/key:'printing',label:'Diseño \/ Serigrafía \/ Impresión'/,'Serigrafía/impresión precargada')
assert.match(core,/key:'auto',label:'Taller automotriz \/ Mecánica'/,'Automotriz precargada')
assert.doesNotMatch(core,/profile_products/,'las plantillas Demo no materializan Servicios')
assert.doesNotMatch(core,/services_section_title|services_section_description/,'las plantillas Demo no inyectan Servicios')
assert.match(core,/free_quote_button_visible:true/,'Cotizar activo')
assert.match(core,/free_schedule_visible:true/,'Horario visible')
assert.match(core,/free_schedule_configured:true/,'Horario configurado')
assert.match(core,/ensureAppointmentSubject\(db,'free',input\.profileId\)/,'Agenda usa núcleo canónico Free')
assert.match(core,/UPDATE appointment_settings SET enabled=1/,'Agenda activa')
assert.match(superAdmin,/Plantillas base/,'SuperAdmin muestra catálogo MASTER')
assert.match(superAdmin,/Generar código Demo/,'cada MASTER genera código Demo')
assert.match(routes,/\/superadmin\/free-demo\/catalog\/:presetKey\/code/,'backend genera código ligado al preset')
assert.match(routes,/free_demo_template_codes/,'backend persiste códigos Demo')
assert.match(routes,/status='redeeming'/,'código Demo se bloquea al consumirlo')
assert.match(routes,/\/me\/free-demos\/redeem-code/,'intapcard canjea código Demo')
assert.match(routes,/demo-draft-/,'canje crea slug interno no público')
assert.doesNotMatch(routes,/app\.post\('\/api\/v1\/me\/free-demos',requireDemoManager/,'no existe creación directa saltándose el código')
assert.match(manager,/Usar código Demo/,'cuenta especial crea borrador solo por código')
assert.match(manager,/Finalizar y publicar/,'borrador se finaliza después de editar')
assert.match(manager,/nombre y el slug definitivos se fijan al publicar por primera vez/,'publicación replica lifecycle Trial')
assert.match(routes,/published_at&&requestedSlug!==currentSlug/,'slug queda bloqueado tras primera publicación')
assert.match(superAdmin,/Generar código de reclamo/,'SuperAdmin conserva reclamo final separado')
assert.match(layout,/freeDemos/,'navegación SuperAdmin conserva módulo Demos Free')

// Edición segura del Demo: sesión sintética, puente restringido y retorno al manager.
assert.match(routes,/free_demo_management_sessions/,'rutas usan bridge aislado')
assert.match(routes,/synthetic_owner_user_id/,'editor entra como owner sintético del Demo')
assert.match(routes,/\/me\/free-demos\/:id\/open/,'endpoint abre Demo específico')
assert.match(routes,/\/me\/free-demo-management\/context/,'editor detecta contexto Demo')
assert.match(routes,/\/me\/free-demo-management\/return/,'retorno restaura cuenta gestora')
assert.match(bridge,/Volver a Mis Demos/,'UI permite salir del perfil gestionado')
assert.match(app,/FreeDemoManagementBridge/,'bridge está montado globalmente')
assert.match(home,/free_demo_manager/,'intapcard aterriza en grupo Demo')

// Reclamo: triple vínculo, código de un solo uso y credenciales definitivas.
assert.match(routes,/special_email:FREE_DEMO_MANAGER_EMAIL,slug:String\(\(row as any\)\.slug\),claim_code:raw/,'SuperAdmin entrega correo especial + slug + código')
assert.match(migration,/status IN \('active','in_progress','used','revoked','expired'\)/,'claim contempla bloqueo de uso')
assert.match(routes,/status='in_progress'/,'código se bloquea al primer login válido')
assert.match(routes,/meta\?\.changes/,'login comprueba adquisición exclusiva del claim')
assert.match(login,/free-demo-claim\/login/,'login reconoce código como contraseña temporal')
assert.match(claim,/Tu correo definitivo/,'primera pantalla solicita correo definitivo')
assert.match(claim,/Nueva contraseña Kawvo/,'primera pantalla solicita contraseña')
assert.match(routes,/delete cleanTemplate\.free_demo_profile/,'reclamo elimina marca Demo')
assert.match(routes,/UPDATE profiles SET user_id=\?,template_data=\?/,'ownership se transfiere')
assert.match(routes,/UPDATE intap_artifacts SET owner_user_id=\?/,'artículo se transfiere')
assert.match(routes,/status='used'/,'claim queda usado')

// Activación física especial y flujo normal separados.
assert.match(guard,/insideFreeDemoManager/,'AdminGuard mantiene selector especial')
assert.match(activation,/result\.data\?\.free_demo/,'activación especial vuelve al grupo Demo')
assert.match(entry,/import '.\/free-demo-routes'/,'rutas registradas')
assert.match(app,/\/superadmin\/free-demos/,'ruta SuperAdmin')
assert.match(app,/\/admin\/free\/demos/,'ruta gestor')
assert.match(app,/\/admin\/free\/demos\/edit\/:id/,'ruta explícita de edición tipo Trial')
assert.match(editEntry,/\/me\/free-demos\//,'ruta edit llama al namespace Demo')
assert.match(editEntry,/\/open/,'ruta edit abre el borrador específico')
assert.match(app,/\/claim\/free-demo/,'ruta reclamo')
assert.match(core,/artifact_activation_claims/,'activación especial conserva receipt')
assert.match(core,/CASE WHEN EXISTS/,'receipt valida estado final')
assert.match(core,/DELETE FROM free_demo_profiles/,'race/fallo limpia shell Demo')

console.log('Free Demo MASTER -> code -> draft -> edit -> publish -> claim contract: OK')
