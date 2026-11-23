# G7.1 — Stage API fijado al snapshot activo

Auxiliar operativo separado: no cambia el candidato funcional/PR #179 `e9b1aa11189fe43e928ba26802e2f5f34fd5baa4` ni repite su CI. G3–G5 confirmados, G6 pospuesto, G7 OPEN.

## Datos y alcance

- Activa verificada: `23405a5b-e9ca-4247-843d-28cc4f236eaa`, 100 %.
- Última subida `d0f6a4b9-a01b-4900-a904-ec82a5a44d92`: nunca se hereda desde ella por defecto ni se activa.
- Snapshot Mac ya obtenido: `~/intap-release-logs/g7-pinned-read-ofwQf8Wa/active-version.private.json`, 35 bindings y un módulo. No se vuelve a descargar ni se pide transportar el archivo.
- Se reutiliza exclusivamente el lector/autenticación #171 de `fefa9180…`, ya presente junto al snapshot. Se verifica su blob Git `bc33561fbcd906172502bc558df427d952ea6fab`. No se ejecuta su runner histórico.
- Se usa [Create Worker Version](https://developers.cloudflare.com/api/resources/workers/subresources/beta/subresources/workers/subresources/versions/methods/create/): `POST /accounts/{account}/workers/workers/intap-api-preview/versions?deploy=false`. Cada binding lleva `type:inherit, version_id:23405a5b…`; no se usa el endpoint antiguo scripts/versions, que sólo hereda de latest. No se exportan ni imprimen valores secretos.

## Procedimiento

`scripts/stage-kawvo-g7-api-pinned.mjs` prepara localmente por defecto; sólo `--stage` hace el POST de Stage. No contiene activación de tráfico, rollback, Pages, rutas/cron/settings globales, migraciones ni escrituras de datos.

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
