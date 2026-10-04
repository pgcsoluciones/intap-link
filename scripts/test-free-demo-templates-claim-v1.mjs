import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read=(p)=>readFile(p,'utf8')
const [migration,core,routes,scan,entry,app,guard,login,activation,superAdmin,layout,manager,claim]=await Promise.all([
  read('api/migrations-preview/0085_free_demo_templates_claim.sql'),
  read('api/src/free-demo-core.ts'),
  read('api/src/free-demo-routes.ts'),
  read('api/src/scan-to-claim.ts'),
  read('api/src/preview-free-entry.ts'),
  read('app/src/App.tsx'),
  read('app/src/components/admin/AdminGuard.tsx'),
  read('app/src/components/admin/AdminLogin.tsx'),
  read('app/src/components/admin/free/onboarding/FreeArtifactActivation.tsx'),
  read('app/src/components/admin/SuperAdminFreeDemos.tsx'),
  read('app/src/components/admin/SuperAdminLayout.tsx'),
  read('app/src/components/admin/free/FreeDemoManager.tsx'),
  read('app/src/components/admin/FreeDemoClaim.tsx'),
])

// Aislamiento: nada de Trial.
for(const [name,source] of [['core',core],['routes',routes],['manager',manager],['claim',claim]]){
  assert.doesNotMatch(source,/trial_profiles|\/trial\/|trial_leads|registerTrial/i, `${name}: Free Demo no debe mezclarse con Trial`)
}

// Regla normal Free intacta + excepción exacta.
assert.match(core,/FREE_DEMO_MANAGER_EMAIL='intapcard@gmail\.com'/,'correo especial exacto')
assert.match(scan,/createManagedFreeDemoFromArtifact/,'scan-to-claim reconoce excepción aislada')
assert.match(scan,/Usuarios normales conservan exactamente el flujo histórico de un perfil por cuenta/,'flujo normal documentado e intacto')
assert.match(core,/synthetic_owner_user_id/,'cada Demo usa owner sintético independiente')
assert.match(core,/plan_id.*'free'/s,'las Demos son perfiles Free canónicos')
assert.match(migration,/free_demo_profiles/,'metadata Demo aislada')
assert.match(migration,/free_demo_claims/,'claims aislados')
assert.doesNotMatch(migration,/ALTER TABLE profiles|DROP TABLE profiles/,'la migración no altera la tabla profiles')

// Plantillas por rubro reutilizando presets Demo y funciones Free nuevas.
assert.match(core,/hardware:snapshot/,'preset Ferretería presente')
assert.match(core,/free_quote_button_visible:true/,'Cotizar activo en plantilla')
assert.match(core,/free_schedule_visible:true/,'Horario visible en plantilla')
assert.match(core,/free_schedule_configured:true/,'Horario configurado en plantilla')
assert.match(core,/ensureAppointmentSubject\(db,'free',profileId\)/,'Agenda usa núcleo canónico Free')
assert.match(core,/UPDATE appointment_settings SET enabled=1/,'Agenda activa en nueva Demo')
assert.match(superAdmin,/Plantillas Demo Free/,'módulo SuperAdmin presente')
assert.match(superAdmin,/Generar Demo/,'SuperAdmin genera Demos')
assert.match(superAdmin,/Publicar/,'flujo borrador → publicar disponible')
assert.match(layout,/freeDemos/,'navegación SuperAdmin incluye Plantillas Demo Free')

// Reclamo: triple vínculo, código de un solo uso y credenciales definitivas.
assert.match(routes,/special_email:FREE_DEMO_MANAGER_EMAIL,slug:String\(\(row as any\)\.slug\),claim_code:raw/,'SuperAdmin entrega correo especial + slug + código')
assert.match(migration,/status IN \('active','in_progress','used','revoked','expired'\)/,'claim contempla bloqueo de uso')
assert.match(routes,/status='in_progress'/,'código se bloquea al primer login válido')
assert.match(routes,/meta\?\.changes/,'login comprueba adquisición exclusiva del claim')
assert.match(login,/free-demo-claim\/login/,'login reconoce código como contraseña temporal')
assert.match(claim,/Tu correo definitivo/,'primera pantalla solicita correo definitivo')
assert.match(claim,/Nueva contraseña Kawvo/,'primera pantalla solicita contraseña')
assert.match(routes,/delete cleanTemplate\.free_demo_profile/,'reclamo elimina marca Demo')
assert.match(routes,/UPDATE profiles SET user_id=\?,template_data=\?/,'ownership se transfiere al nuevo usuario')
assert.match(routes,/UPDATE intap_artifacts SET owner_user_id=\?/,'artículo asociado también se transfiere')
assert.match(routes,/status='used'/,'claim queda usado')
assert.match(manager,/d\.status<>'claimed'|reclamados salen automáticamente/s,'reclamados salen del grupo Demo')

// Seguridad de navegación y activación.
assert.match(guard,/insideFreeDemoManager/,'AdminGuard permite selector especial sin romper otros roles')
assert.match(activation,/result\.data\?\.free_demo/,'activación dirige al grupo Demo')
assert.match(entry,/import '.\/free-demo-routes'/,'rutas registradas en Worker')
assert.match(app,/\/superadmin\/free-demos/,'ruta SuperAdmin registrada')
assert.match(app,/\/admin\/free\/demos/,'ruta gestor registrada')
assert.match(app,/\/claim\/free-demo/,'ruta reclamo registrada')

// Activación física mantiene recibo atómico y limpia un race/fallo.
assert.match(core,/artifact_activation_claims/,'activación especial conserva receipt existente')
assert.match(core,/CASE WHEN EXISTS/,'receipt valida estado final')
assert.match(core,/DELETE FROM free_demo_profiles/,'fallo de activación limpia shell Demo')

console.log('Free Demo templates + claim v1 contract: OK')
