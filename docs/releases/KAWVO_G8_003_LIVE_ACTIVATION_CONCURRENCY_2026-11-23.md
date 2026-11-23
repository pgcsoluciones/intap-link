# KAW-G8-003 — Correctivo focal de aceptación LIVE #134

**Candidato aislado; G8 sigue NO-GO.** Referencia exacta `474b52d3b173c40ecda346030acd8e7438e79003` (Draft #182), rama `fix/kawmed-live-activation-concurrency-g8`. El SHA final y el diff se registran en el Draft PR del correctivo. La rama de #182 y main no se modifican. Autorrevisión del mismo agente, pendiente de revisión independiente.

## Alcance y evidencia de causa

En la referencia, `POST /api/v1/me/kawmed/live-access/:token/activate` ignora el resultado del UPDATE condicional. La suite focal original, ejecutada antes de editar con `--race`, reproduce revocación entre SELECT y UPDATE: `changes=0`, HTTP 200, edición denegada. Falla su aserción original `200 !== 403`. Es un defecto preexistente documentado por G8-002, no una pérdida de las aprobaciones G3–G5/G7.1.

Allowlist de este lote:

| Archivo | Cambio |
| --- | --- |
| `api/src/kawmed-demo-invitations.ts:105–120` | Sólo cuerpo del handler de activación LIVE |
| `scripts/test-kawmed-live-pending-g8.mjs` | Conserva aserciones positivas/negativas y exige 403 en la carrera; agrega controles focalizados |
| Este handoff | Compatibilidad, evidencia, limitaciones e incorporación propuesta |

Se exige exactamente una fila actualizada; metadata ausente/cero/múltiples filas produce el rechazo 403 existente. Tras un UPDATE efectivo se reutilizan **sessionActor** y **liveGuestInvitation**: misma cuenta autenticada, correo actual, invitación vigente más reciente, propietario autorizado, grant y relación propietario/médico válidos. Se exige el mismo ID de invitación y médico leído originalmente; no se elige otro perfil. Una lectura final por PK exige estado active y vigencia antes de anunciar éxito.

Los resolutores/guards originales no cambian. El UPDATE, sus parámetros, COALESCE de aceptación, payload de éxito y respuesta de rechazo se conservan. La reentrada active y dos aceptaciones concurrentes autorizadas del mismo médico siguen permitidas. Se añaden tres SELECT acotados tras una actualización efectiva; no hay listados ni cambios de esquema.

## Compatibilidad y límites de concurrencia

- Se conserva el 401 inicial sin sesión y el 403 para invitación no autorizada. Se reutiliza el mismo mensaje de rechazo; no se filtran datos del perfil alternativo.
- Revocación/caducidad antes del UPDATE impide activar y no registra aceptación. Si el UPDATE tuvo efecto pero se pierde autorización después, se rechaza la respuesta; no se intenta deshacer una revocación ni sobrescribir cambios concurrentes.
- Una revocación posterior al último SELECT todavía puede ocurrir; esto no convierte la aceptación en un permiso permanente ni ofrece una transacción global. Cada acceso de edición mantiene sus verificaciones active/email/owner/perfil/vigencia/latest. No se amplía ningún permiso ni se altera el médico asignado.
- Todo el archivo API fuera del handler de activación y la cadena exacta UPDATE/bind se compararon con la referencia: idénticos. App, Web, Functions, shared, migraciones, configuración, dependencias y `kawmed-live-guest.ts` permanecen idénticos.
- Se conservan las 729 rutas registradas y su orden; handlers comerciales, G7.1 y exports scheduled siguen presentes en bundles locales. G6/G7.2 no se incorporan. No se cambia el sandbox ni la Agenda.

## Validación local (Node 20.20.2 y herramientas existentes)

No se instalaron herramientas. SQLite temporal y sesiones/grants sintéticos; se ejecutan los handlers registrados y resolutores reales. No es QA autenticada de Preview, una prueba distribuida de D1 ni un despliegue.

| Comando / comprobación | Resultado |
| --- | --- |
| Suite original `node scripts/test-kawmed-live-pending-g8.mjs --race`, antes del fix | **FAIL reproducido**, HTTP 200 en lugar de 403; log conservado |
| `node scripts/test-kawmed-live-pending-g8.mjs` | **PASS**: pending sólo lectura, aceptación, token/ID, active re-entry y metadata; anónimo, email erróneo, vencida, revocada, owner/perfil discordante, grant ausente, invitación anterior; revocación no revierte cambios guardados |
| `node scripts/test-kawmed-live-pending-g8.mjs --race` | **PASS**: cero filas por revocación/caducidad → 403; después de UPDATE rechaza revocación, caducidad, propietario/email/sesión inválidos, cambio de médico, estado pending y supersesión; metadata ausente/0/2 rechazada; dos aceptaciones válidas conservadas |
| Siete contratos: live-guest, demo-invitations, isolation, active-account, multiaccount, integrated, code-accordion | **PASS**, scripts originales sin modificar; incluye fixture SQLite del SELECT MED |
| `node_modules/.bin/tsc --noEmit -p api/tsconfig.json` | **PASS** |
| esbuild `api/src/preview-frontdoor-entry.ts` y `api/src/preview-free-entry.ts`, bundle Node20/ESM, external cloudflare | **PASS**, sólo compilación local de entradas Preview/Producción en `/tmp`; no publicación |
| Comparación local de rutas/orden con bundle de la referencia y scheduled exports | **PASS**, 729 registros idénticos; no certifica todas sus operaciones |
| Sintaxis del test, `git diff --check`, allowlist exacta y preservación de las capas excluidas | **PASS** |
| `node scripts/test-kawvo-g8-release-contract.mjs` | **FAIL de alcance esperado**: congela API byte a byte frente al snapshot G8-001 y rechaza este cambio funcional autorizado. No se modifica ni debilita su aserción |
| QA autenticada de primera aceptación LIVE y D1 remoto | **BLOCKED / no ejecutada**, requiere publicación y aceptación de prueba bajo autorización separada |

La primera ampliación de fixture detectó que revalidar con el correo del actor leído al inicio era insuficiente (cambio concurrente de correo devolvía 200). Se conservó ese log; releer la sesión y comprobar la misma cuenta corrige el caso sin cambiar resolutores ni relajar la aserción. La ejecución final pasa.

Los 138 grupos de navegador y builds App/Web previos no se repiten: no cambian esas capas. Los otros gates G8-002 (activación productiva, esquemas efectivos, automatismos y recuperación) no se reabren ni se declaran cerrados. La evidencia histórica de G8-002 sigue referida a su SHA y no se reescribe como si hubiese pasado entonces.

El workflow quality sólo se dispara en PR hacia main o push main; un Draft PR focal hacia la rama de #182 no lo dispara. No se cambia el workflow ni se mueve main para generar una CI artificial. Las comprobaciones de este lote son locales; el resultado remoto disponible se registra en GitHub sin atribuirlo a otro SHA.

## Incorporación y rollback propuestos

**Recomendación: incorporar el correctivo a G8 tras revisión independiente.** Reduce el bloqueante local de concurrencia #134 de FAIL a PASS; no cierra la certificación autenticada ni habilita Producción. El PR focal apunta a la rama de #182 para mostrar sólo los tres archivos, sin fusionarlo. No se solicita repetir las aprobaciones funcionales G3–G5/G7.1.

Al aceptar técnicamente su incorporación, reconciliar de forma expresa el manifiesto y las comprobaciones de congelación de G8 con el único delta funcional autorizado y su nueva referencia verificable, conservando la evidencia anterior. No presentar el inspector de G8-002 sobre el nuevo runtime como válido sin esa reconciliación: su propia protección de congelación lo detiene. Antes del release queda la aceptación LIVE de prueba por flujo normal y los demás gates NO-GO, con autorización del SHA exacto y del plan.

Rollback de código: revertir únicamente el commit de este correctivo en su rama; no se necesita ni se propone revertir datos, migraciones o credenciales. Esto reintroduciría el defecto de acuse, por lo que sólo procede como decisión técnica consciente. No se ensaya rollback remoto.

**Sin deploy, merge, migraciones remotas, cambios en Producción, datos reales, secretos, infraestructura o guards aprobados.**

## Manifiesto de evidencia local

Directorio de logs: `/tmp/kawvo-g8-003/`. Los hashes siguientes permiten contrastar la evidencia de esta ejecución; no se copian credenciales ni artefactos privados. El SHA final es el HEAD del PR del correctivo, descendiente directo de la referencia indicada.

| Archivo | Bytes | SHA256 |
| --- | --- | --- |
| `baseline-race.log` | 1184 | `e4eeb9a244f4cbddb492320e8fc4a21bf8aadd78523d7c0e85fa29e1386aa1c5` |
| `fixed-race.log` | 1348 | `ff2c0584a164171635110a028232d483216daaffd4cc8b9b894c11afb7340f61` |
| `fixed-race-final.log` | 1647 | `38f5c9725dae9dcb8cc56e3ff7f0d5128c09cbf6e18473ea32bda64175c98c66` |
| `positive-negative.log` | 612 | `3ca4492427e60c4edc9ebb6495b0b86dc69ddf10227213f8953026b98cc09ba7` |
| `api-contracts.log` | 545 | `4db77319df4c9d5ec4f8391ce82932b8f3d9b4e62c31a97db0f98c123a10aa8d` |
| `api-typescript.log` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `api-preview-build.log` | 75 | `de1571f8f875e40bf4df0e331b418248f25a6e3d7b57546684919a8e52b05a5b` |
| `api-production-local-build.log` | 84 | `a7058da656fab276b05989d635b97a4464c45d19aee83867a3b324585713b99f` |
| `api-compatibility.log` | 160 | `dd74e38e56b536717f9ad4799a99c181169def57033de1c4a482b9c14b7e5311` |
| `scope.log` | 117 | `2d225d2849649f913254c3deabf66c7a2f4bfe490c8fb3bccfd705d2d7bfcd98` |
| `historical-g8-freeze-final.log` | 450 | `53bd8c25251cc2870b19aec09500d038001cc2e95536b030140bb8baedd59045` |
| `api-preview.mjs` | 1741357 | `a5a92de48b2035af609b39398c29473dee2fee9fa9226b0b193ec22f8c6c296d` |
| `api-production-local.mjs` | 1734225 | `87a63991fcefd96ea78434afdbd20eb7a11b9624efe9da5646a39eea88543677` |
