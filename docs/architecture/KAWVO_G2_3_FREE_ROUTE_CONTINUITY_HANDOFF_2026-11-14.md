# Kawvo G2.3 — continuidad de navegación del Free autenticado
**Corte:** 14/11/2026. **Estado:** cambios de código preparados, sin QA local/build/despliegue ejecutados aún.
**Base exacta:** `8f763f4ad44704f3c27e6d111bc06c3b6b930b5f` (G2.2 / PR #160, desplegado App Preview y pendiente de QA exhaustivo).
**Rama G2.3:** `feature/kawvo-g2-free-route-continuity-2026-11-14`.
**Motivo:** usuario confirma en QA real que Mi perfil y Agenda están listas, pero Credenciales devuelve a Mi cuenta y luego al panel Free anterior; otras rutas también vuelven a pantallas anteriores.

## Auditoría: rutas concretas y causa
1. `FreeCredentials.tsx`: `goBack` llama a `navigate(backTo)`, con `backTo='/admin/free/account'` aunque el acceso real provenga del shell «Más».
2. `FreeAccount.tsx`: botón Credenciales hacía `navigate('/admin/free/credentials')` y perdía `location.state` recibida del shell; sus enlaces internos a IA y Team también perdían origen.
3. `FreeOnboardingIdentity.tsx`: después del `apiPut('/me/profile')`, cuando `editingFromPanel` o Team, enviaba a `/admin/free` con independencia del origen de la visita.
4. `FreeOnboardingContact.tsx`: guardado/no cambios enviaba siempre a `/admin/free`, incluso cuando se accedía desde «Mi perfil» o el editor visual nuevo.
5. `FreeIdentifier.tsx`: guardar username llevaba siempre a Free original.
6. `FreeAiProfileAssistant.tsx`: botones manuales «Volver al panel» y «Ahora no» hacían `navigate('/admin/free')` incluso después de ingresar desde el shell.
7. `FreeNotifications.tsx`: entrada al Centro de ayuda enviaba a Mi cuenta sin el estado de retorno.

## Comportamiento G2.3 esperado
- **Más → Credenciales → Volver:** retorna a pestaña «Más» del shell, con filtro/cuenta preservados, no a «Mi cuenta» ni a Free antiguo.
- **Más → Mi cuenta → Credenciales → Volver:** retorna primero a Mi cuenta; al volver de Mi cuenta, a «Más» con su selección intacta.
- **Mi cuenta → IA o Team:** conserva marcador de visita desde Mi cuenta (Team tiene flujos administrativos internos propios que exigen un QA independiente; no alterar permisos).
- **Mi perfil → Identidad / Contacto → Guardar:** retorna a pestaña Perfil, conserva búsqueda/filtro y resaltado de opción anterior; el API original y sus validaciones permanecen intactos.
- **Mi perfil → Diseño → sección de edición secundaria → Guardar:** vuelve primero al editor visual, después a Perfil del shell.
- **Mi cuenta → Notificaciones → Centro de ayuda → Volver:** preserva el origen del shell.
- **Más → Optimizar con IA → Volver / finalizar:** retorna a Más; si se abrió desde Mi cuenta vuelve a Mi cuenta antes de Más.

Todos los cambios están protegidos por `getKawvoShellReturn` validado, `isKawvoShellPreviewHost` (build Preview + hostname exacto), sin crear permisos, roles ni nuevos endpoints. El shell `/admin/free/shell-preview?kawvo_shell=1` vuelve a consultar `/me` y verifica que coincida el `kawvoShellAccount` antes de restaurar la pestaña. Si se entra desde el panel antiguo **no hay marcador** y conserva los destinos históricos.

## Límites críticos
- Solo `app/src/components/admin/free/**`, `app/src/components/admin/free/onboarding/**`, pruebas/runners/docs. Ninguna modificación a `api/`, `web/`, `app/src/App.tsx`, `FreeDashboard`, `AdminGuard`, permisos, cookies, Worker, D1/R2, OAuth ni Producción.
- Credenciales mantienen sus endpoints y verificación OTP originales; no almacenar ni registrar secretos, contraseñas, tokens ni códigos.
- No reescribir navegación global ni ejecutar redirecciones de ámbito de otros roles.
- Otros recorridos (por ejemplo, módulos Team y Artifacts compartido) pueden tener navegación propia: se validarán por pantalla/ruta real antes de ampliarlos. No afirmar que todas las rutas de Free están migradas.
- Pendientes laterales del programa: «Cambiar cuenta» únicamente para cuentas autorizadas Multicuenta; atajo **Lunes–viernes** en `AppointmentManager`, separado del horario descriptivo, sin cambios en esta fase.

## Validación y rollback
- Contratos G1 / G2.1 / G2.2 / G2.3 + Team/medical/multicuenta, allowlist exacta, `npm ci` y build App Preview en Mac.
- Script local: `scripts/run-kawvo-g2-3-free-route-continuity-local-qa-2026-11-14.sh`; no publica.
- Script App Pages Preview: `scripts/deploy-kawvo-g2-3-free-app-pages-preview-2026-11-14.sh`: debe confirmar alias real `qa-kawmed-guest-current-2026-11-02`, Worker original al 100% con 35 bindings, snapshot inmutable de G2.2 tomado del log verificado `~/intap-release-logs/kawvo-g2-2-pages-ceLD3OD6/publish.log`; stage inmutable de G2.3 antes de alterar el alias; tras despliegue comparar bundle servido byte a byte con `app/dist`; no desplegar Worker ni modificar `APP_PAGES_ORIGIN`.
- Incidente: si falla un gate, **STOP** y no repetir ciegamente. Si se publicó Pages pero falla QA, recuperar G2.2 desde el artefacto inmutable corroborado y mediante procedimiento de Pages-only aprobado, nunca rollback de Worker para arreglar App.
- QA real requerida: publicado/borrador, credenciales directa/desde Cuenta, guardado Identidad/Contacto, editor y retorno, IA, Team con roles autorizados, multicuenta, móvil 320/360/390/430 y desktop.

**Aprobaciones:** el usuario autorizó continuidad de la unificación y reportó el defecto; no equivale a aprobación de Producción. PR Draft, sin merge.
