# KAW-G8-002 — Evidencia y cierre parcial de bloqueantes

**NO-GO mantenido.** Base obligatoria `836d422cc76ba5c96ef9cdfd5f7efe11b8d5d438`, Draft [#182](https://github.com/pgcsoluciones/intap-link/pull/182), rama `release/kawvo-g8-unified-candidate`. HEAD local/remoto de partida y árbol limpio verificados; main observado `6e6bfbb1bd60c91a94e92d36f6cfdd9f91e3d9e2`. No se modifica lógica del producto, fases aprobadas, guards, permisos, dependencias, configuración ni workflows.

Revisión crítica de fuentes sobre SHA congelado por el mismo agente que preparó G8-001; no es una segunda aprobación humana independiente. Las aprobaciones G3–G5/G7.1 se conservan. G6/G7.2 siguen postergados. Este informe complementa la [auditoría G8-001](KAWVO_G8_AUDIT_2026-11-23.md), el [runbook](KAWVO_G8_RELEASE_RUNBOOK_2026-11-23.md) y el contrato G8; no los sustituye.

## 1. Activación: interfaz unificada frente a producto legacy

**PASS de identificación y pruebas puras; BLOCKED de activación productiva.** No se ha retirado ni activado ningún guard. Los tests llaman predicados con datos sintéticos; no montan ni activan interfaces.

| Área | Guard exacto, en la base auditada | Condiciones que deben preservarse |
| --- | --- | --- |
| G3 Doctor | `app/src/components/admin/medical/kawmed-shell-navigation.ts:21–34` | `mode==='preview'`, host exacto App Preview, `/admin/medical`, `kawvo_med_shell=1`, scope doctor, sin delegación, perfil autorizado cargado y no guest |
| G3 invitado/delegado | `medical/kawmed-guest-shell-navigation.ts:11–21`, `KawMedDemoGuest.tsx:14,38` | Preview/host, ruta de invitación válida, sin scope arbitrario, opt-out legacy; assignedId=verifiedId=profileId, doctor. El enlace no concede permiso |
| G3 Master médico | `medical/kawmed-master-shell-navigation.ts:12–18`, `SponsorKawMed.tsx:44,110–116`, `MedicalDashboard.tsx:140–148,389–397` | Preview/host, ruta/scope sponsor_master, propietario/admin, tenant y cuenta activa medical_master correctos, perfil verificado; publicar requiere autorización existente |
| G4 beneficiario | `sponsored/sponsored-shell-gate.ts:11–19,52–54,82–94` | Preview/host, flag explícito, no Master/scope, sin fallback legacy, profile_id coincidente. Conserva selección kind+id y reanudación |
| G5 patrocinador | `sponsored/sponsor-shell-navigation.ts:7–11`, `SponsorDashboard.tsx:24–26` | Preview/host, sin opt-out, owner/admin, tenant y cuenta activa sponsor coincidentes |
| G7.1-A | `api/src/sponsor-inventory-page.ts:79–81`, `SponsorDashboard.tsx:24–26` | Servidor `ENVIRONMENT=preview` antes de requireUser; en Producción devuelve 404. UI requiere contexto/flag de inventario y shell autorizado; buscar no asigna códigos |
| Entradas/retornos | `IntapcardAccountSelector.tsx:139–154`, `medical/KawMedShellReturn.ts`, `web/src/components/appointments/kawmedOwnerShellLinks.ts` | La promoción de entradas y retornos también exige el host/mode autorizado. No basta cambiar un solo frame; la futura política debe mantener URLs acotadas y el mismo perfil |

Los prefijos abreviados `medical/` y `sponsored/` son relativos a `app/src/components/admin/`. El inspector imprime archivo, línea y SHA256 de la fuente Git inmutable, más las referencias de entrada. Los cinco predicados reales permiten sus fixtures Preview y rechazan modo Producción y host productivo, sin cambiar código.

**Distinción G7.1-B:** `matchesKawmedCodeSearch`, contador y reset en `SponsorKawMed.tsx` no tienen un guard propio de búsqueda limitado a Preview; se componen también en el panel Master legacy. Lo que sigue bloqueado en Producción es la activación del shell y de la API paginada G7.1-A, además del release. No afirmar que el filtro B es inutilizable en código productivo ni que ya esté desplegado allí. Free G1/G2 consolidado y los módulos legacy no se desactivan por estos gates.

La evidencia de Preview aprobado continúa siendo #181 [7094624920](https://github.com/pgcsoluciones/intap-link/pull/181#issuecomment-7094624920), Worker `9c63a559…`/Pages `457b0c1b`; no se vuelve a certificar su estado remoto actual sin una lectura autorizada.

## 2. Esquemas D1: comprobación preparada, sin datos personales

Inspector: `scripts/inspect-kawvo-g8-readonly.mjs --cloudflare`. **PASS local/simulado; BLOCKED remoto en Codex:** no existe sesión Wrangler autorizada utilizable. No se solicita token, contraseña ni archivo privado.

1. Lee el deployment **activo** de `intap-api-preview` e `intap-api`, exige una versión al 100%, entorno correcto, DB/R2 inequívocos y 35 bindings en Preview cuando aplica. No hereda latest ni usa IDs del TOML como fuente efectiva.
2. Resuelve DB desde esa versión y exige IDs distintos antes de consultar D1. No enumera bases ni pide UUID manualmente.
3. Ejecuta cuatro **SELECT fijos de metadata** por base: sqlite_master, pragma_table_info, pragma_index_list/index_info y pragma_foreign_key_list. No lee filas de usuarios, perfiles, médicos, pacientes, invitaciones o credenciales.
4. Contrasta las cinco tablas y cuatro índices nombrados de 0153/0154, columnas/tipos/defaults/notnull/PK, claves únicas, FK y CHECK contra las propuestas documentadas exactas. Faltantes o divergencias dan FAIL; 401/403/metadata no disponible dan BLOCKED, nunca una migración automática.
5. El API D1 transporta las consultas por **POST `/d1/database/:id/query`**. Este POST no es una escritura SQL: sólo se admiten esas cuatro cadenas SELECT exactas. Todos los demás POST/PATCH/DELETE, SELECT de negocio, SQL añadido, endpoints de secrets/deployment y workers/proyectos ajenos se rechazan antes de enviar. Si D1 informa writes/changes inesperados, el inspector detiene toda la colección y no declara cero escrituras.

La comparación ocurre en memoria y sólo guarda el diagnóstico/estructura necesaria. No persiste SQL/filas de respuesta crudas, tokens, valores secretos ni variables plain_text no autorizadas. La metadata que contiene un nombre de columna `email` no contiene direcciones de personas.

**PASS de pruebas:** SQLite con los DDL exactos; diez controles negativos (tabla, tipo, nullabilidad, default, PK, índice, orden, unique, FK, CHECK); separación DB; SQL fuera de allowlist; estado de escritura inesperado; errores sanitizados; cero reintentos de escritura. No se ejecutó ningún D1 remoto desde Codex.

## 3. Inventario reproducible de recuperación

El mismo modo `--cloudflare` prepara un JSON de lectura con:

- IDs activos/porcentajes antes y después, entrypoint, hashes/tamaños de módulos (no copia de código), nombres/tipos de bindings, huellas de recursos D1/R2 y parámetros runtime conocidos; **sin valores secretos ni comparación de esos valores**. Producción no está obligada artificialmente a tener 35 bindings: la prueba usa 32 como fixture y el inspector registra la cantidad efectiva.
- Settings no versionados proyectados, cron y rutas de la zona intaprd.com, sólo para los dos Workers autorizados. Lecturas denegadas permanecen BLOCKED; un TOML no sustituye el snapshot.
- Metadata Pages `intap-web2`/`intap-link`: canonical Production, ownership del origen Preview efectivo, SHA/rama/entorno/success, aliases reales, `uses_functions`, rama productiva y configuración Git/auto-deploy disponible. No copia env_vars o deployment_configs crudos.
- Hashes de HTML/JS/CSS principales del dominio y deployment/alias efectivos, comparados por buffers/hash, sin enviar autorización a hosts públicos. Esas huellas **no son un respaldo completo** ni prueba binaria de Functions.
- Búsqueda local acotada a artefactos ya documentados en `~/intap-release-logs/g7-1-search-shared-f42bccf2b824/source/app/dist` y `~/intap-release-logs/g7-pinned-read-ofwQf8Wa/stage-app-e9b1aa11189f/source/app/dist`. No busca indiscriminadamente, no reconstruye ni copia archivos. Si existen, conserva manifiesto, contexto/lockfile y hash de Functions compiladas cuando ya esté archivado. Sólo compara con el deployment cuyo SHA coincide; no adivina un rollback por parecido de hashes.
- Para un artefacto coincidente verifica **todos** sus archivos públicos, codificando espacios/acentos por segmento. `_headers`, `_redirects`, `_routes.json` y Worker/Functions se conservan como controles locales y no se solicitan como URLs públicas.

**BLOCKED de recuperación completa:** disponibilidad/retención de versiones anteriores, artefactos productivos completos, configuración no versionada íntegra y bundle Functions remoto no están acreditados por este entorno. `uses_functions=true`, contexto fuente o hash JS no certifican Functions compiladas. El inspector no contiene métodos de restore/rollback ni puede ensayarlo. Para cerrar el gate faltan esos respaldos y su cotejo; no basta un `report.json` ni recompilar un supuesto equivalente.

## 4. #134: prueba focal y defecto preexistente reproducido

**PASS fuente y transición estable local:** `kawmed-live-guest.ts` coincide con el fix histórico `d42691d8…`. `liveGuestInvitation` permite pending/active con email/grant/owner/perfil/vigencia/latest intactos; `liveGuestProfile` exige active. `scripts/test-kawmed-live-pending-g8.mjs` usa los handlers GET/activate originales y SQLite temporal: pending se lee pero no edita; la aceptación activa únicamente el perfil asignado; reentrada active es válida; correo erróneo, caducidad, revocación, grant ausente, owner/perfil discordantes e invitación anterior se rechazan. Revocar no revierte cambios guardados. No se enviaron cookies reales ni POST de aplicación remotos.

**FAIL, acuse de activación en carrera:** modo `--race` revoca el grant en el fixture justo después del SELECT y antes del UPDATE original. El UPDATE condicional modifica **cero filas**; el handler devuelve **HTTP 200**. La lectura de edición posterior devuelve null y no abre acceso a otro médico. La aserción exige 403 y falla con `200 !== 403`; el fallo se conserva, no se modifica el test para aceptar 200.

Evidencia exacta: `api/src/kawmed-demo-invitations.ts:105–112`, blob `7ee75d493f21b7402f9abf0e019ed14f99b33353`, idéntico en main y la base G8. No es una regresión introducida por G8. La ruta no inspecciona `meta.changes` del UPDATE. Propuesta puntual para otro lote técnico: comprobar el resultado condicional y validar nuevamente el mismo grant activo antes de responder éxito, conservando email, owner, perfil, vigencia, latest y edición active-only. **No se aplica esa modificación en esta orden de inspección.**

**BLOCKED de certificación autenticada del release:** la aceptación normal hace una escritura de estado y este encargo la prohíbe. Prueba controlada propuesta, no ejecutada:

1. Perfil médico de demostración y cuenta invitada de prueba autorizados, mediante invitación nueva del flujo normal; sin generar sesión por D1 ni transportar cookies/tokens. Registrar sólo un alias sintético del caso, no datos clínicos.
2. Antes de aceptar: verificar en sesión invitada que sólo se anuncia el perfil asignado y no permite editar por un grant pending. No usar sandbox como sustituto LIVE.
3. Bajo una orden posterior que autorice esa aceptación de prueba, usar el flujo normal en App Preview; comprobar activación y MedicalDashboard/Agenda del mismo ID. Las comprobaciones incorrectas se hacen con perfiles sintéticos separados, nunca con médicos reales ajenos.
4. Probar el rechazo ante revocación/caducidad durante aceptación y las restricciones de credenciales/lifecycle. No revocar/crear/modificar invitaciones remotas en esta auditoría. No reabrir la aceptación global G3; es un gate específico de release API.

## 5. Automatismos al integrar main

| Comprobación | Estado | Evidencia / alcance |
| --- | --- | --- |
| Actions quality | PASS | `.github/workflows/quality.yml`: PR hacia main y push main; sin paths-ignore documental, sin deploy. Guard productivo corre en push main **después del merge**; no es un firewall de integraciones externas |
| Dos deploy workflows | PASS de identificación | `deploy-adonisg-preview.yml` y `deploy-sponsored-preview.yml`: sólo workflow_dispatch, ramas Preview fijadas. Incluyen publicaciones y el segundo aplica migraciones Preview. **No ejecutados ni autorizados aquí** |
| Variables INTAP y hooks actuales | BLOCKED | Conector: HTTP 400 por endpoint fuera de allowlist; intento CLI `gh api --method GET` también devuelve Forbidden desde este entorno. No demuestra ausencia ni estado administrativo real |
| Pages auto-deploy actual | BLOCKED | #167 documenta desactivación histórica App/Web; no certifica hoy. El inspector lee source.config/production_branch de cada proyecto, sin cambiarlos |
| Workers Builds actual | BLOCKED, riesgo confirmado históricamente | [#167, 6904506879](https://github.com/pgcsoluciones/intap-link/pull/167#issuecomment-6904506879): merge `67cd49e2…` disparó `Workers Builds: intap-api` y cambió versión productiva fuera de Actions/Pages. [6904743013](https://github.com/pgcsoluciones/intap-link/pull/167#issuecomment-6904743013) documenta recuperación y cambio histórico a versions upload, no builds deshabilitados |

El modo `--github` lee main actual, check-runs, dos variables públicas de aprobación y hooks mediante la sesión gh existente; no consulta secrets, cambia variables ni dispara workflows. Un listado hooks vacío **no** excluye GitHub Apps ni Workers Builds.

Acceso mínimo faltante: sesión Mac Wrangler ya autorizada para lecturas de versiones/settings/rutas/Pages y metadata D1; sesión gh con lectura de las variables/hooks solicitados; lectura de **Cloudflare → Workers & Pages → intap-api e intap-api-preview → Settings → Builds** para rama/triggers/comandos actuales. También GitHub Repository Settings → Webhooks / Installed GitHub Apps para integración externa. No se pide ampliar permisos ni entregar credenciales; si esos accesos no existen, mantener BLOCKED e identificarlo en el reporte. `workers/triggered_by=version_upload`, fechas, ETag o check-runs no prueban por sí solos el commit/binario desplegado ni que no haya automatismos.

## 6. Los doce contratos fallidos

[Matriz individual](KAWVO_G8_BLOCKER_MATRIX.json): archivo, línea de aserción, blob idéntico a 836d422c, clasificación y evidencia. **Ninguna de esas doce suites fue modificada.** Sus FAIL originales siguen registrados.

- **9 incompatibilidades de alcance:** ocho allowlists de lotes históricos G3.1.1/G3.2/retorno/G3.3/G3.4/G4/G5/G7.1, más la identidad estricta de `load()` del G3.1 anterior al soporte delegado/Master aprobado. No requieren retirar funcionalidades para lograr verde; se preserva el verificador acumulativo y las regresiones G8-001.
- **3 legados confirmados:** literal `Configuración` ya ausente también en main frente al componente que renderiza settingsLabel; tres textos Team también ausentes en main con AdminLogin idéntico; ubicación antigua del publish Master en sponsored-owner-flow. En este último caso la condición sigue en la ruta efectiva `sponsored-profiles.ts:44`, el owner-flow recuperado coincide con 2286c937 y tampoco tiene el duplicado. El test completo de main falla más adelante en otra aserción: no se presenta como el mismo síntoma.
- **0 regresiones reales establecidas por esos doce fallos**. Esto no certifica runtime real. El FAIL de carrera #134 es un hallazgo funcional preexistente **separado**, no uno de los doce ni una revocación de aprobaciones anteriores.

## 7. Validación, matriz y siguiente acción

PASS locales: sintaxis de los tres scripts; inspector con mocks completos (GET/inventario, D1 SELECT-only, bytes/encoding/control files, ausencia de secretos en reportes, separación de DB y stop de escritura inesperada); cinco gates puros Preview/Producción; doce scripts originales congelados; prueba #134 estable y contrato LIVE existente. **FAIL conservado:** `test-kawmed-live-pending-g8.mjs --race` con el resultado descrito. Logs y hashes en `KAWVO_G8_BLOCKER_MATRIX.json`. No se repiten los 138 grupos G8-001 ni builds de producto sin cambios; sólo se revalida lo afectado y CI del nuevo SHA.

Estados por gate en la matriz: PASS identifica comprobación de fuente/herramienta o fixture; BLOCKED requiere evidencia remota/acceso/operación expresamente no ejecutada; FAIL identifica la carrera reproducida. La ampliación de allowlist del verificador de preparación G8 permite exclusivamente estos scripts y dos documentos; no amplía scope funcional ni modifica las doce aserciones históricas.

Ejecutar desde un checkout limpio del nuevo SHA de #182, con Node 20.20.2 y herramientas existentes:

```bash
node scripts/inspect-kawvo-g8-readonly.mjs --local
node scripts/inspect-kawvo-g8-readonly.mjs --cloudflare
node scripts/inspect-kawvo-g8-readonly.mjs --github
```

Son acciones separadas de lectura. En un worktree nuevo sin node_modules, `KAWVO_READONLY_TOOL_ROOT` puede señalar el checkout Mac habitual; el inspector verifica que su lockfile coincide y sólo reutiliza Wrangler para whoami. `KAWVO_READONLY_EVIDENCE_PARENT` permite guardar reportes fuera de ambos checkouts, por ejemplo en el directorio habitual intap-release-logs. Por defecto usa un temporal privado. No instalar herramientas, crear sesiones D1, recompilar ni publicar. Cualquier solicitud fuera de la allowlist se detiene antes de enviar.

Siguiente paso: revisión técnica del defecto de acuse #134 y ejecución de las inspecciones de lectura con los accesos existentes que aquí faltan. **NO-GO hasta cerrar todos los gates, verificar recuperación y recibir autorización expresa del SHA exacto y plan.** Nada de este informe autoriza escribir remotamente ni pide repetir aprobaciones funcionales.
