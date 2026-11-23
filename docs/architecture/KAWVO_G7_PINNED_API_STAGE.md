# G7.1 — Stage API fijado al snapshot activo

Auxiliar operativo separado: no cambia el candidato funcional/PR #179 `e9b1aa11189fe43e928ba26802e2f5f34fd5baa4` ni repite su CI. G3–G5 confirmados, G6 pospuesto, G7 OPEN.

## Datos y alcance

- Activa verificada: `23405a5b-e9ca-4247-843d-28cc4f236eaa`, 100 %.
- Última subida `d0f6a4b9-a01b-4900-a904-ec82a5a44d92`: nunca se hereda desde ella por defecto ni se activa.
- Snapshot Mac ya obtenido: `~/intap-release-logs/g7-pinned-read-ofwQf8Wa/active-version.private.json`, 35 bindings y un módulo. No se vuelve a descargar ni se pide transportar el archivo.
- Se reutiliza exclusivamente el lector/autenticación #171 de `fefa9180…`, ya presente junto al snapshot. Se verifica su blob Git `bc33561fbcd906172502bc558df427d952ea6fab`. No se ejecuta su runner histórico.
- Se usa [Create Worker Version](https://developers.cloudflare.com/api/resources/workers/subresources/beta/subresources/workers/subresources/versions/methods/create/): `POST /accounts/{account}/workers/workers/intap-api-preview/versions?deploy=false`. Cada binding lleva `type:inherit, version_id:23405a5b…`; no se usa el endpoint antiguo scripts/versions, que sólo hereda de latest. No se exportan ni imprimen valores secretos.

## Procedimiento

`scripts/stage-kawvo-g7-api-pinned.mjs` prepara localmente por defecto; `--check-auth` exige y reutiliza el paquete ya preparado, comprueba hashes y hace sólo el GET de tráfico; sólo `--stage` hace el POST de Stage. No contiene activación de tráfico, rollback, Pages, rutas/cron/settings globales, migraciones ni escrituras de datos.

Comprueba Node 20.20.2, checkout limpio, objeto Git exacto y dependencias versionadas coincidentes. Exporta sólo las fuentes API/shared del candidato a una carpeta privada fuera del checkout; conserva el build/checkout G5. Reutiliza el empaquetado instalado de Wrangler con `versions upload --dry-run` y un JSON de compilación mínimo, nunca el TOML histórico. Extrae los módulos reales del multipart generado. No instala herramientas ni ejecuta tests/builds de App.

Prepara el request con los 35 nombres de bindings fijados a la activa y conserva compatibilidad, flags, límites, placement, cache y exports worker existentes. Rechaza assets, containers, migraciones o exports con lifecycle/DO adicionales que requieran otro alcance. El código de todos los handlers y scheduled procede de la entrada frontdoor exacta del candidato.

Con `--stage`: consulta únicamente el estado de tráfico mutable, exige la activa al 100 %, reserva un intento persistente antes del POST y no reintenta automáticamente. Guarda respuesta y versión Stage en privado, verifica por GET los módulos byte a byte, el SHA anotado, bindings resueltos/runtime y tráfico sin cambios. Esa comprobación de la versión nueva no repite la lectura del snapshot original. Ante HTTP ambiguo, timeout o discrepancia, detiene sin activar ni borrar el intento.

Evidencia: junto al snapshot, `stage-api-e9b1aa11189f/`; `stage-pass.json` contiene ID Stage, SHA del candidato, hashes de módulos y tráfico sin cambios. No compartir `*.private.*`. Un `stage-attempt.json` existente exige revisión: no borrar el marcador ni repetir el upload a ciegas.

La versión puede tener o no URL propia; no se habilitan previews ni dominios para crearla. Stage no es sandbox de datos: no ejercitar escrituras autenticadas sobre recursos reales. Este auxiliar sólo sube código; no llama a handlers de negocio.

## Validación y límites

`node scripts/test-stage-kawvo-g7-api-pinned.mjs` con Node 20.20.2 existente: simulaciones de éxito, HTTP 400, timeout, bytes/bindings/runtime/SHA discordantes y deriva de tráfico antes/después; verifica un único POST y rechazo de segundo intento. Preparación local real con Wrangler dry-run y reutilización de artefacto sin recompilar. Los clientes HTTP del Stage están simulados: Codex no sube versiones ni cambia tráfico. El test usa el checkout limpio actual por defecto; `G7_TEST_SOURCE_ROOT` permite señalar otro checkout limpio de las mismas dependencias.

Se mantienen las evidencias funcionales/CI PASS del candidato. Igualdad binaria entre la API activa y fuente documental #147/2286c937 no acreditada; rollback remoto no ensayado. Stage PASS, si Juan lo obtiene, sólo acreditará esta nueva versión, no esas equivalencias históricas ni QA real. No se presenta el auxiliar como release productivo.

## Orden posterior

Tras Stage API PASS, detenerse para revisar ID/recibo y continuar Stage App en intap-web2. Preview API y Preview App son otras acciones y no están en este auxiliar. No sustituir los bindings activos por el TOML, no activar latest y no modificar el candidato funcional para publicar esta herramienta. Juan ejecuta los comandos y hace la QA real en el host exacto App Preview cuando corresponda.

## Correctivo de autenticación previo al upload

Evidencia de la Mac: GET previo con HTTP 401/código 10000; no existe `stage-attempt.json`. No hubo POST desde ese intento. El paquete, `prepared.json` y hashes siguen disponibles: no borrar ni recompilar.

Se reprodujo con el lector #171 exacto: `credentials()` captura el token OAuth antes de `wrangler whoami`. Wrangler 3.114.17 puede renovar la sesión durante las consultas de `whoami` (`performApiFetch` → `requireLoggedIn` → `refreshToken`), escribiendo un token nuevo; el header del lector conserva el anterior. La simulación da 401 con ese header y PASS al releer la misma sesión después de `whoami`. Esto demuestra el defecto; la renovación concreta durante el intento original de la Mac no puede acreditarse sólo con el 401.

El correctivo conserva el lector histórico y su hash, la validación de cuenta y el token de entorno si lo hubiera. Relee únicamente la misma sesión OAuth después de `credentials()`; no hace login, solicita permisos ni cambia identidad. La próxima acción es `--check-auth`, separada de Stage: no contiene POST, no crea `stage-attempt.json` ni `traffic-before.json`, no recompila y conserva el error privado anterior. Sólo añade un recibo `auth-check-*.json` sin valores sensibles; `sessionReloaded` indica si el token fue renovado durante ese `whoami`. Un nuevo 401/403 detiene sin reintentos; PASS acredita autenticación de lectura y activa al 100 %, todavía no un upload.

Validación local del correctivo: lector #171 real con sesión sintética renovada, token de entorno, 401/403 sin reintentos, error de autenticación previo sin POST/marcador, flujo completo `--check-auth` con un GET simulado y preservación byte a byte/mtime del paquete y error anterior. Suite operativa PASS con Node 20.20.2; no se repitió la CI funcional de `e9b1aa11…`. No hubo llamadas Cloudflare reales, upload, activación, merge ni migraciones desde Codex. QA real y autenticación en Mac permanecen pendientes.

## Continuación — Stage App tras Stage API PASS

Juan confirma Stage API **PASS** para `e9b1aa11189fe43e928ba26802e2f5f34fd5baa4`: versión `ebf507f7-325f-44c1-9849-2f93ae8ded0d`, tráfico previo sin cambios y 35 bindings conservados. Recibo existente `~/intap-release-logs/g7-pinned-read-ofwQf8Wa/stage-api-e9b1aa11189f/stage-pass.json`. No repetir la operación ni solicitar de nuevo esas comprobaciones.

Se continúa en el mismo auxiliar operativo con una acción explícita **`--stage-app`**, separada de `--stage` API. Reutiliza el procedimiento Pages inspeccionado en #171/G5: lector autenticado corregido, snapshot de aislamiento actual, `pages deploy app/dist` desde la raíz con `functions/`, proyecto exclusivo `intap-web2`, validación de ownership y comparación de todos los archivos públicos en URL inmutable y alias real. No se ejecutan runners históricos completos ni se cambian sus SHA/constantes para publicarlos.

Controles:

- Node 20.20.2, checkout original limpio, objeto candidato exacto y dependencias versionadas coincidentes; conserva HEAD, rama y builds existentes. La nueva carpeta privada `stage-app-e9b1aa11189f/source/` recibe una exportación completa de ese SHA. Sólo compila App Preview allí y Pages Functions localmente, usando dependencias ya instaladas, sin instalar herramientas ni tocar API. Si existe preparación válida, reutiliza bytes/manifiesto/contexto; si está incompleta, detiene y conserva evidencias.
- Lee únicamente el recibo Stage API local como prerrequisito. No llama a endpoints de upload ni verificación de la versión Stage API. Los snapshots de aislamiento leen los Workers activos y las superficies App/Web existentes antes/después del Stage App; no activan versiones.
- Rama Pages aislada `qa-kawvo-g7-1-e9b1aa11189f`, nunca la rama propietaria del alias App Preview ni production_branch. Guarda el snapshot actual, sin usar hashes productivos históricos. Conserva las Pages Functions del candidato, shared, lockfile, headers, redirects y el manifiesto completo del dist.
- Reserva `stage-attempt.json` antes del único `pages deploy`; comprueba commit completo, rama, Preview, success, alias real distinto del compartido y bytes de todos los archivos públicos. Los headers/redirects quedan en el manifiesto local y el envío convencional de Wrangler; no se solicitan como archivos públicos. El log privado debe acreditar el envío de Functions. Verifica las superficies protegidas incluso después de un upload fallido/ambiguo. Ante discrepancia, no reintenta uploads ni elimina evidencia.
- `stage-pass.json` acredita artefacto App/metadata e aislamiento. La compilación Functions local y su fuente/contexto quedan archivadas con SHA256; la igualdad binaria remota de Functions no se acredita mediante GET de archivos públicos (`functionsRemoteBinaryEquality:false`). No se activa el shell ni se hace QA autenticada en pages.dev, porque exige el host exacto App Preview y la API G7 activada posteriormente.

**Validación Codex:** `node scripts/test-stage-kawvo-g7-app-pinned.mjs` con Node 20.20.2: 17 escenarios simulados (éxito; SHA/rama/entorno/alias/bytes incorrectos; Functions no acreditadas; error ambiguo; deriva de superficies/Worker; colisión; cambios de artefacto/contexto/bundle; preflight anterior) con métodos reales de ownership, manifiesto y comparación de bytes del lector #171. Un upload simulado como máximo, ningún reintento; App API PASS sólo se lee localmente. Además compilación Functions real desde el candidato exacto con Wrangler ya instalado, reutilizando el dist App previo y sin repetir su build/CI funcional. Evidencia `/tmp/g7-stage-app-tests.log`; compilación `/tmp/g7-app-functions-local-ZiQzS3/`. Son fixtures/simulación, no QA real ni publicación Cloudflare.

**Pendiente tras Stage App:** revisión del recibo y luego Preview API → Preview App como acciones separadas. El snapshot Stage captura metadata y huellas de superficies; no sustituye un respaldo completo del App Preview actual con dist/Functions verificados para la promoción y rollback. No se ofrece promoción en esta acción. Mantener limitaciones de igualdad binaria histórica y rollback remoto no ensayado. G3–G5 confirmados, G6 pospuesto, G7 OPEN.
