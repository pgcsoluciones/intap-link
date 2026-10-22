# Kawvo Link — Runbook de promoción QA → Producción
Fecha: 2026-10-22. **Documento operativo, no autorización de ejecución.**

## Baseline observado
- main GitHub y Pages Web/App: `2391896286839528557066968ca4b8abe9831fb9`.
- Worker `intap-api`: última versión desplegada 100% `ce72ba26-95ec-4243-8e9e-fd2e3efcaf6d`. Referencia anterior `4503fb62-0608-4e32-bdac-c357fd82f41e`. No hay equivalencia Git SHA Worker demostrada.
- Pages Web `intap-link`: deployment de SHA productivo `7588f64f.intap-link.pages.dev` en lista, estado Idle; no confundir Idle con confirmación de activo.
- Pages App `intap-web2`: entrada SHA productivo `66e1b98b.intap-web2.pages.dev` con **Failure**. Otra `22418cee.intap-web2.pages.dev` con misma fuente y fecha anterior; determinar cuál es deployment saludable/activo con Dashboard o API antes de rollback.
- API `/api/health` responde HTTP 200 `production` en tres hosts.
- D1 `intap_db`: 11 migraciones KawMed pendientes; ensayo contra backup real: SQL e integridad OK y ninguna violación FK nueva. Una FK heredada de `profile_videos` requiere gestión independiente.
- PR #111 rama `reconcile/kawmed-medical-profile-v1-2026-10-19-v2`, más de 300 commits sobre main; **alcance integral de plataforma**, no solamente KawMed.

## Requisitos innegociables antes de corte
1. Registrar el deployment **actual/funcional** de Pages Web y App en Cloudflare, no usar el `Failure` de App.
2. Confirmar que el rollback del Worker puede promover la versión previa identificada con `wrangler rollback --name intap-api --config api/wrangler.toml`, según comandos disponibles en versión instalada; **no ejecutar rollback ahora**. Revisar la salida de `npx wrangler rollback --help` en entorno local y documentar su alcance.
3. Verificar backup D1 con hash, restauración y compatibilidad hacia atrás (Worker preexistente + esquema ampliado).
4. Revisión de 24 vulnerabilidades del lockfile separando runtime/dev: mitigar materialmente las explotables en entorno productivo, no ignorar una crítica sin justificación reproducible.
5. QA end-to-end de login/magic link, Free, Trial, Sponsored/Team, Agenda, privacidad de datos bancarios, perfiles públicos, KawMed, SuperAdmin y configuración de dominios.
6. Confirmar `main` fijo hasta el corte, builds Vite **production** con `.env.production`, y Worker `api/wrangler.toml` con bindings/secrets productivos presentes; no traspasar credenciales desde QA.

## Orden de corte recomendado (condicionado a verificación)
**0. Congelar versiones, respaldos y ventanas.** Registrar exacto deployment activo Web/App + Worker, salud inicial y puntos de recuperación. Asegurar que repositorio y cuenta Cloudflare sean la misma, no publicar demos QA.

**1. D1 expansión:** aplicar solo las 11 migraciones probadas **si** el Worker anterior sigue compatible. Verificar tabla D1 de migraciones y endpoint health. Si falla, detener sin publicar frontend/Worker. D1 usa plan de recuperación propio: restaurar copia requeriría reconciliar escrituras hechas desde backup, **no usar restauración destructiva automática**.

**2. API compatible:** publicar Worker `intap-api` desde código candidato, usando rutas `/api/*` productivas (no `preview-frontdoor-entry.ts`). Comprobar health, login y flujos críticos con cuentas de prueba dedicadas. Rollback Worker al version ID guardado si falla y esquema sigue compatible.

**3. App:** publicar a Pages `intap-web2` con rama main/artefacto candidate ya validado, y verificar versión efectiva + carga de App y login. Si falla, usar rollback/promoción del deployment productivo previo **confirmado exitoso**.

**4. Web:** publicar Pages `intap-link`, validar home, perfiles públicos, NFC/QR, custom domains (incluido argenisgrullon.com), CTA y API. Rollback hacia deployment Web validado si falla.

**5. Consolidar:** smoke completo de acceso, edición, activación, datos, notificaciones, agenda, KawMed, trial/upgrade/downgrade, patrocinio, Master y multicuenta. En caso de error, detener y preservar logs; no afirmar éxito por HTTP 200 solamente. Reconciliar `main` con release realmente desplegado y registrar versión.

## Observación crítica del script heredado
**NO ejecutar** `scripts/run-production-kawmed-v1-2026-10-22.sh`: está bloqueado y diseñado para KawMed parcial, publica App/Web antes de Worker y no verifica rollback efectivo. No usarlo aunque alguien retire el bloqueo.

## Estado
Runbook documentado. Aún sin evidencias suficientes para desplegar con garantías de no regresión: faltan versión activa exitosa de App, procedimiento rollback Pages comprobado, auditoría runtime, QA E2E y verificación de compatibilidad Worker/esquema. Esto no impide construir el release integral, pero **no se debe intentar un despliegue ciego**.

## Verificación documental de rollback de Cloudflare (2026-10-22)
Fuentes oficiales consultadas:
- https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/
- https://developers.cloudflare.com/workers/wrangler/commands/workers/
- https://developers.cloudflare.com/api/resources/pages/subresources/projects/subresources/deployments/

### Worker `intap-api`
`wrangler rollback <VERSION_ID> --name intap-api --config api/wrangler.toml` publica **inmediatamente** esa versión en el 100% de las rutas. Es una acción mutante y **NO** es paso de preflight. La versión observada anterior al cutover es `ce72ba26-95ec-4243-8e9e-fd2e3efcaf6d`. Guardar confirmación de despliegue activo actual justo antes del corte. **No probar rollback sobre Producción por curiosidad.**

### Pages
Cloudflare publica API oficial `POST /accounts/{account_id}/pages/projects/{project_name}/deployments/{deployment_id}/rollback`, que promueve una implementación **previa exitosa**. No es equivalente a volver a poner `main` en un SHA anterior: el rollback de artefactos de Pages es independiente de Git y no revierte D1 ni Worker. Se requiere cuenta y credencial con permiso Pages Write, que **no deben guardarse en archivos del repositorio ni copiarse en el chat**. Puede hacerse por el Dashboard seleccionando deployment saludable en Deployments. Verificar primero cuál fue exitoso y está disponible; jamás la entrada App `66e1b98b` con Failure.

### Caveats
- No hacer rollback si la versión anterior no comprende el nuevo esquema. Primero comprobar compatibilidad backwards con migraciones aditivas.
- La configuración de cron, bindings y secretos se controla por entorno; no mezclar Preview y Producción.
- El rollback es plan contingente, no argumento suficiente para afirmar que el lanzamiento carecerá de regresiones.

**Resultado:** mecanismos oficiales identificados y documentados; todavía sin validación efectiva de un rollback ni identificación de un deployment Pages App inequívocamente exitoso.
