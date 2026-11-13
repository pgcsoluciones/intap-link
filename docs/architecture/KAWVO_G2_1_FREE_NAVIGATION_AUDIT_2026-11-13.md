# Kawvo — G2.1 · Auditoría y primer enlace directo de navegación Free
**Corte:** 13 de noviembre de 2026
**Contrato obligatorio:** `docs/architecture/KAWVO_UNIFIED_UI_MASTER_ROADMAP_CONTRACT_2026-11-12.md` (PR #156) y `KAWVO_MOBILE_FIRST_UNIFIED_SHELL_CONTRACT_2026-11-11.md` (PR #150).
**Prototipo visual aprobado:** https://qa-kawvo-shell-1112.intap-link.pages.dev/
**Gate:** G2 (consolidación Free), lote G2.1. **Estado:** código preparado para QA local; NO constituye PASS funcional ni release.

## 1. Punto de partida, rama y seguridad
- Repositorio: `pgcsoluciones/intap-link`.
- Base **exacta** de G1: `b7861f9da35ade3cdd7864184a30e79fd5bcf163` (PR #158, abierto/draft, no mergeado al corte).
- Rama de G2.1: `feature/kawvo-g2-free-direct-access-2026-11-13`, nacida del commit exacto de G1.
- Motivo de elección: GitHub `main` se encuentra detrás de la rama G1 y no se ha certificado idéntico al Pages autenticado en Preview; no mezclar ni promocionar automáticamente esa historia.
- Este lote sólo modifica **App** Free (shell opt-in, componente de botón de regreso, adaptador de Agenda), más un test, runner y documentación. Sin cambios de API, Web pública, Worker, D1, R2, OAuth, cookies, role guards, migraciones, `main` o Producción.
- La URL experimental sigue siendo `/admin/free/shell-preview?kawvo_shell=1` con build Preview y host exacto `app.preview.intaprd.com`. El panel original `/admin/free` permanece intacto y disponible.
- User QA G1: capturas auténticas de navegación, Perfil, Agenda y Más; observó que numerosas acciones regresaban al panel anterior. **Las capturas no certifican el funcionamiento de guardado, permisos ni publicación**.
- El propietario autorizó pasar a G2 con la condición de mantener método, alcance y rollback sin desplegar Producción.

## 2. Auditoría de destinos y autoridad

| Entrada nueva | Destino funcional existente | Condición / autoridad | Decisión G2.1 |
| --- | --- | --- | --- |
| Inicio → Administrar (publicado) | Pestaña Perfil del propio shell | Estado leído de `/me` | Ahora cambia de pestaña sin enviar al viejo dashboard |
| Inicio → Continuar configuración (borrador) | `/admin/free/onboarding/identity?from=panel` | `AdminGuard` Free + reglas internas existentes | Acceso directo con marca de retorno opt-in |
| Inicio → Revisar y publicar (listo) | `/admin/free` | `FreeDashboard.togglePublished`, readiness y respuesta de API | **Se conserva aquí**; prohibido duplicar la publicación |
| Inicio → Vista previa | `/api/v1/me/free/profile-preview/:slug?full=1` | Misma ruta privada ya utilizada en `FreeDashboard`; requiere slug | Abre enlace en otra pestaña; sin slug aparece deshabilitado |
| Inicio → Compartir | URL pública de `/me/home-route` con fallback al slug Free | Perfil publicado, URL válida; `navigator.share` o copiar | Acción directa, deshabilitada si es borrador o falta enlace |
| Perfil → Identidad | `/admin/free/onboarding/identity?from=panel` | `AdminGuard` Free; Team conserva restricciones internas | Módulo real sin cambios; marca de retorno |
| Perfil → Contacto / botones / ubicación / enlaces / portafolio / diseño | Rutas `/admin/free/...` existentes en `app/src/App.tsx` | `AdminGuard`, `TeamPermissionGuard` y permisos de servidor | Módulos existentes; no se clonan formularios ni endpoints |
| Más → Cuenta / credenciales / notificaciones / IA | Rutas Free existentes | `FreeOwnerOnly`, `AdminGuard`, `TeamPermissionGuard` | Se mantienen guardas; sólo navegación desde el shell |
| Agenda → Abrir Agenda | `/admin/free/agenda` | Sólo si `/me/home-route` proporciona agenda Free válida; `AdminGuard` | Conserva `AppointmentManager` y permite regresar al shell |
| Panel actual | `/admin/free` | Control de escape/rollback explícito | **Se conserva sin cambios** |

**No todo módulo lleva vuelta al shell al guardar.** Los formularios con un `navigate('/admin/free')` interno al finalizar continúan con su comportamiento histórico; este lote sólo cambia los botones de regreso que usan `FreeBackButton` y el `onBack` de Agenda cuando entran con estado explícito. Debe comprobarse cada guardado real antes de extender este patrón a otros módulos.

## 3. Estado de navegación y regreso
- El shell envía únicamente `navigate(path, {state:{kawvoShellReturn:true}})`, no permisos nuevos.
- `FreeBackButton` y `FreeAppointments` sólo aceptan la ruta de retorno especial cuando coinciden **los tres controles**: build Preview, host exacto App Preview y `location.state.kawvoShellReturn === true`.
- Si no coinciden, el botón conserva el regreso original (dashboard, editor o cuenta según pantalla).
- La ruta experimental nunca se habilita en Producción, incluso si llega un estado de navegación manipulado.
- El botón `Cambiar cuenta` queda como **observación pendiente**, documentada en PR #158: debe mostrarse exclusivamente con autoridad Multicuenta real, no por defecto. **No se ha modificado en G2.1**, siguiendo la orden de no desviar el foco.
- Otros roles (Kawmed, patrocinados, Master, Link de pago) corresponden a G3–G6, no a este lote.

## 4. Pruebas y reversión (obligatorias)
**Locales:** runner `scripts/run-kawvo-g2-free-direct-access-local-qa-2026-11-13.sh`.
Preflight de árbol limpio, commit base G1, allowlist exacta, `git diff --check`, contratos G1/G2, `npm ci`, build App Preview y verificación final de árbol limpio.

**QA autenticada pendiente tras compilar:** en escritorio y móvil 320/360/390/430 px probar shell: publicado → Perfil; borrador → Identidad; listo → panel original de publicación; vista previa privada; compartir deshabilitado para borrador; compartir publicado; módulos Perfil/Más; retorno al shell desde botón de regreso; Agenda; acceso Team limitado; sesión Multicuenta; guardado/retorno y cookies. Verificar que el antiguo panel todavía funciona.

**Criterio PASS:** pruebas automatizadas y build correctos + QA real con autorización y datos de cuentas propias o de QA. **BLOCKED** ante error de guard, mezcla de identidades, redirección errónea de origen, regresión de publicación o caída de sesión.

**Rollback:** cerrar la URL opt-in y seguir usando `/admin/free`; si existe un Pages QA posterior, restaurar la versión App Preview previa con origen inmutable y preflight. **Nunca** ejecutar un despliegue de Worker para "activar" G2.1; el incidente histórico de `APP_PAGES_ORIGIN` exige confirmar el alias Pages consumido antes de cualquier futuro despliegue.

## 5. Fuera del lote y próximo control
No se rehacen servicios, publicación, formularios, funciones comerciales ni APIs. El aspecto visual aprobado se conserva y el pulido de foto/espaciados queda aparte. El siguiente punto de control es la salida del runner de QA local y, sólo si pasa, una propuesta independiente de publicación App-only en Preview con preflight real del alias Pages. No habilitar Producción ni fusionar PRs por implicación.

### Registro mínimo de esta iteración
- Objetivo: eliminar rodeos por el panel original de **Inicio**, manteniendo las rutas/guards; facilitar el retorno desde módulos existentes.
- Evidencias previas: GitHub (archivos fuente y contratos) + capturas G1 del usuario; no se han hecho llamadas autenticadas Cloudflare ni D1 desde esta sesión.
- Test: `scripts/test-kawvo-g2-free-direct-access-contract-2026-11-13.mjs`.
- QA y despliegue: pendientes de ejecución en el equipo del propietario; no declarar PASS antes de logs reales.
