# KAW-G8-004 — Integración controlada de #183 en G8

**NO-GO para Producción.** Rama `release/kawvo-g8-unified-candidate`, Draft #182. Main verificado en `6e6bfbb1bd60c91a94e92d36f6cfdd9f91e3d9e2`, sin cambios. Autorrevisión técnica del mismo agente; no segunda aprobación humana independiente.

## Integración y límite exacto

Se verificaron #182 OPEN/Draft en `474b52d3b173c40ecda346030acd8e7438e79003` y #183 OPEN/Draft en `8bc33c1b62d2c11147ffc192119fac98009cd5b5`. El segundo tiene como padre exacto el primero. Diff #183: únicamente handler LIVE, prueba focal y handoff (tres archivos, +128/−5). Se contrastó el handler completo y su UPDATE/parametrización antes de integrar.

Operación local autorizada: `git merge --ff-only 8bc33c1b62d2c11147ffc192119fac98009cd5b5` sobre la rama G8 limpia. Se retiene el commit original una sola vez; no cherry-pick, squash ni merge de PR acumulativos. Después se añade un commit de reconciliación documental/de verificadores. El SHA consolidado exacto es el HEAD publicado y registrado en #182: no se intenta incrustar un hash autorreferente dentro de su propio manifiesto.

**Único delta funcional:** `api/src/kawmed-demo-invitations.ts`, blob completo exacto de #183. No se reescribe el fix al integrarlo. El UPDATE exige una fila modificada y revalida sesión, mismo grant/médico y active/vigencia. Las aserciones de normalidad y rechazo no se reducen; la prueba y el handoff #183 también se conservan byte a byte.

## Congelación reconciliada, no excepción genérica

`scripts/lib/kawvo-g8-freeze.mjs` verifica el parentesco exacto de los commits, la ascendencia del correctivo y que el único delta runtime sea el archivo autorizado, idéntico al blob inmutable #183 (incluido modo de archivo). Rechaza archivos runtime adicionales no versionados. El resto de API/App/Web/Functions/shared/workflows/dependencias se conserva contra las referencias anteriores. Los verificadores G8 mantienen sus aserciones de roles/tenant/cuenta activa, cero escrituras de inventario, Production 404, gobernanza, exclusión de fases y esquemas SELECT-only.

La prueba del inspector añade controles negativos: archivo runtime adicional, handler alterado y ausencia del delta correcto deben fallar. No se permite “cualquier cambio en el handler”. El árbol API nuevo es `6662721e02dfe8e45939f5b89856ed0618c6a5ef`; el resto de árboles runtime mantiene sus hashes originales.

El manifiesto mantiene `historicalSnapshots` fijado a `474b52d3…`, con hashes SHA256 y blobs de los documentos anteriores; el verificador los compara contra Git. **Todos los campos históricos de `KAWVO_G8_VALIDATION.json` se conservan y se verifican**, incluidos FAIL originales; sólo `integrationValidation` contiene los nuevos resultados. Los doce contratos fallidos siguen byte a byte iguales: nueve incompatibilidades de alcance y tres legados; sus resultados anteriores no se convierten en PASS. El FAIL histórico de carrera #134 permanece en la matriz separado de su nuevo resultado local.

`KAWVO_G8_DIFF_MAIN.tsv` identifica las 117 rutas originales de fases más el handler autorizado; usa hashes efectivos cuando existía una normalización documental. No es el inventario de archivos de preparación autorreferentes: el diff completo de esos archivos figura en #182. Los bundles API locales se regeneran y tienen hashes nuevos en el manifiesto; los artefactos App/Web/Functions previos se reutilizan por identidad de fuente, no como respaldo remoto acreditado.

## Matriz vigente de fases (preservación técnica, no nuevas aprobaciones)

| Fase | Estado comprobado en esta integración | Pendiente que se conserva |
| --- | --- | --- |
| G0/G1/G2 | PASS de preservación: contratos, Free y runtime aprobados intactos | Gates generales G8; no repetir aceptación funcional |
| G3.1/G3.2 | PASS de preservación: Doctor, Agenda y retornos intactos | Gates generales G8 |
| G3.3 | PASS local del correctivo de concurrencia, mismo médico/permisos; resto intacto | **BLOCKED** primera aceptación LIVE autenticada del release exacto |
| G3.4/G3.5 | PASS de preservación: Master, invitados/delegados, credenciales y guards intactos | Gates generales G8 |
| G4/G5 | PASS de preservación: beneficiario/patrocinador, Multicuenta, borradores y publicación intactos | Gates de activación productiva no modificados |
| G6 | POSTERGADO; PASS de exclusión de nueva interfaz, legado de pago conservado | No reactivar |
| G7.1 | PASS de preservación: módulo paginado/registro y búsqueda aprobada exactos, mismo aislamiento | API sigue Preview-only; no inferir autorización productiva |
| G7.2 | POSTERGADO; PASS de exclusión de consumidores/endpoints/rutas nuevas | No incorporar #180 |
| G8 | Integración y verificadores locales PASS; **NO-GO** de release | D1, automatismos, respaldos/rollback, LIVE real y autorización final |

## Pruebas del árbol integrado

Node **20.20.2**, dependencias/herramientas existentes; sin instalaciones. Evidencia y SHA256 en `KAWVO_G8_VALIDATION.json → integrationValidation` y matriz; logs `/tmp/kawvo-g8-004/`.

| Comprobación | Resultado / límite |
| --- | --- |
| `node scripts/test-kawmed-live-pending-g8.mjs` | PASS, handlers/resolutores reales con SQLite y sesiones sintéticas; aceptación normal ID/token, reentrada, negativos y metadata |
| Mismo comando `--race` | PASS: revocación/caducidad que deja cero filas devuelve 403; revalidación tras UPDATE, metadata inválida y dos aceptaciones concurrentes autorizadas |
| Contratos originales `test-kawmed-live-guest-contract`, `test-kawmed-demo-invitations-contract`, `test-kawmed-isolation-contract`, `test-intapcard-active-account-contract`, `test-intapcard-multiaccount-contract`, `test-intapcard-kawmed-integrated-contract`, `test-kawmed-code-accordion-contract` | Siete PASS; no se modifican sus aserciones |
| `tsc --noEmit -p api/tsconfig.json` | PASS |
| Bundles esbuild de `api/src/preview-frontdoor-entry.ts` y `api/src/preview-free-entry.ts`, Node20/ESM/external cloudflare | PASS, compilaciones locales Preview/Producción; no paquetes publicados ni backup de Worker activo |
| `node scripts/test-kawvo-g8-release-contract.mjs` | PASS tras reconciliación exacta autorizada; mantiene identidad, roles, paginación, fuente, hashes, migraciones fuera del árbol activo y NO-GO |
| `node scripts/test-kawvo-g8-readonly.mjs` | PASS, inventario/metadata/secretos con mocks, cinco gates puros, negativos de congelación y doce contratos históricos preservados |
| Sintaxis, `git diff --check`, identidad API exacta #183 y resto runtime congelado | PASS |
| CI GitHub del SHA integrado | Resultado y enlace del **mismo SHA** en #182 una vez publicado; si no se dispara, BLOCKED. No se reutiliza la CI de 474b52d3 ni se modifica el workflow |
| QA LIVE autenticada / esquema y configuración remotos | BLOCKED; no hay aceptación remota, consultas D1, despliegues ni prueba productiva en esta tarea |

Los 138 grupos de navegador anteriores son evidencia de fixtures conservada, no nuevas ejecuciones ni QA real de este release API. App/Web/Functions no cambian; sus builds los ejecuta la CI estándar del candidato sin que ello autorice despliegue.

## Bloqueantes, reversión y revisión

Se reduce exclusivamente el FAIL local de concurrencia #134. Continúan BLOCKED: esquema D1 real y reconciliación 0153/0154; automatismos externos de main; inventario completo/retención/rollback; primera aceptación LIVE autenticada; política de activación productiva que conserva los guards actuales; autorización expresa del SHA final y del plan. No se repiten auditorías administrativas ni se solicitan de nuevo las aprobaciones G3–G5/G7.1.

Rollback de preparación, sólo si se decide posteriormente: revertir el commit de reconciliación y el correctivo original de forma trazable, reconciliando otra vez manifiestos; reintroduciría el defecto conocido. No reset/force push ni reversión de datos. Para cualquier publicación futura se exige la recuperación remota real del Worker y frontends con Functions, no usar un TOML o bundle local como respaldo del estado activo. Rollback remoto e igualdad binaria histórica siguen no acreditados.

**Sin deploy, activación de Workers/interfaces, migraciones remotas, cambios D1/R2, secretos, permisos o main. Integrar Git no activa el release. PR #182 permanece Draft y Producción NO autorizada.** Detenerse para revisión independiente del SHA consolidado.
