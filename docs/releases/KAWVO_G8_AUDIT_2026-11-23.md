# KAW-G8-001 — Candidato integral y auditoría de preparación

**Decisión: NO-GO para Producción.** El candidato integral está preparado para revisión, preserva el runtime aprobado y excluye G6/G7.2. No se ejecutaron deploys, activaciones, migraciones remotas ni merges. Las aceptaciones G3–G5 y la búsqueda G7.1 del propietario se conservan; G8 no concede otras aprobaciones.

## Identidad, alcance y fuentes

- Referencia solicitada y fuente auditada: `fae4ced6966a5bfda5bb8f7b298dc8a22bfc5d99`, HEAD observado del Draft #181. Su padre `cf663d99323affb3b6b7a32374924b808289bb05` contiene la cadena acumulativa. La UI aprobada procede de `f42bccf2b8248b61603090a97ab56c9258400b58`.
- Rama nueva: `release/kawvo-g8-unified-candidate`; no existía en las referencias locales/remotas consultadas. Checkout aislado `/workspace/intap-link-kaw-g8`. Otros worktrees/ramas conservados; `main` remoto observado `6e6bfbb1bd60c91a94e92d36f6cfdd9f91e3d9e2`, sin modificar.
- SHA final del candidato: registrado en el Draft G8. Los hashes del runtime y su referencia inmutable están en [el manifiesto](KAWVO_G8_RELEASE_MANIFEST.json); no se intenta incluir el hash de un commit dentro de sí mismo.
- Alcance nuevo G8: `AGENTS.md` canónico #169, este informe, manifiesto/inventario/resultados, runbook, SELECT de metadata, dos propuestas SQL históricas fuera de migraciones activas y dos archivos de regresión G8. Se normalizan además cuatro hard-breaks Markdown del encabezado del contrato G8 a líneas en blanco, sin cambiar su texto normativo. **Ningún archivo funcional, dependencia, workflow, configuración o migración activa cambia respecto a fae4ced6.**
- No se necesitó cambiar runtime: las diferencias respecto a `main` ya pertenecen a las fases acumuladas y a la recuperación API documentada. Las incompatibilidades de salida productiva requieren decisión de activación/esquema, no retirar permisos o sustituir módulos para que pasen pruebas.

Lecturas normativas: [G8 completo](../architecture/KAWVO_G8_MASTER_RELEASE_UNIFICATION_2026-11-23.md); [#150](https://github.com/pgcsoluciones/intap-link/pull/150) en `2f88ea37…`; [#151](https://github.com/pgcsoluciones/intap-link/pull/151) y su prototipo; [#156](https://github.com/pgcsoluciones/intap-link/pull/156) en `ab2263a7…`; [#169](https://github.com/pgcsoluciones/intap-link/pull/169) en `50e74d81…`; [#172](https://github.com/pgcsoluciones/intap-link/pull/172) en `2ab9f47a…`; [U01–U09](https://github.com/pgcsoluciones/intap-link/pull/156#issuecomment-6957519041); `CLAUDE.md`, `.agent/rules/reglasclaras.md`, `CONTRACT_PRODUCTION_PROFILES.md`, workflows y handoffs G2/G3/G4/G5/G7. Se leyó la automatización completa de #181 sin ejecutarla. Las reglas históricas de entorno se aplican con la orden actual y #172; no se solicitan aprobaciones de fases ya otorgadas.

## Matriz de fases, aprobación y regresión

La aceptación es la registrada por el propietario/contrato, no una conclusión de fixtures. “PASS local” no significa QA autenticada ni Producción.

| Fase | Funcionalidad / contrato | Fuente / SHA | Aprobación preservada | Evidencia G8 y pendiente |
| --- | --- | --- | --- | --- |
| G0 | C01–C07, roles, identidad, mobile-first y referencia visual | #150/#151/#156, prototipo `b089bcdc…` | Referencia aprobada; no App real | Cadena/guards/roles verificados; fixtures de seis anchos; no nueva aceptación visual del propietario |
| G1 | Free, Inicio/Perfil/Agenda/Más, cuenta, estado y publicación | #152 y consolidación #167 `67cd49e2…`; incluido en main | G0/G1 completados según #156 y contrato G8 | Suite Doctor/Free, Team, publicación explícita, borrador y retorno; no se reabre QA histórica |
| G2 | Free publicado, correcciones de navegación/PWA/cuenta | #168, main `6e6bfbb1…`; [handoff](../architecture/KAWVO_FREE_G2_QA_CORRECTIONS_2026-11-15.md) | Aceptación general en [#156](https://github.com/pgcsoluciones/intap-link/pull/156#issuecomment-6908211757); detalles por dispositivo no inventados | Contratos Free G2/G5 y 21 escenarios Doctor/Free; guardados/confirmaciones conservados |
| G3.1 / G3.1.1 | Doctor, editor único, centros, horarios públicos, seguros, apariencia, avisos/publicación | #170 `34d57a4b…`, #173 `567a028a…`; [lote 1](../architecture/KAWVO_KAWMED_G3_LOT_1.md), [UI](../architecture/KAWVO_G3_1_1_UI_PUBLICATION_2026-11-17.md) | G3 confirmado globalmente por el propietario; no extenderlo a escenarios no acreditados | Componentes reales con fixtures; capacidades y guards preservados. La compilación productiva mantiene gate Preview |
| G3.2 | Perfil y Agenda intermedios, solicitudes, U01–U09, retorno público/contextual | #174 `27a4a003d2cc96afb0edd609dd53ba204aa9b2c6`; [lote 2](../architecture/KAWVO_KAWMED_G3_LOT_2.md), [retorno](../architecture/KAWVO_KAWMED_G3_LOT_2_PUBLIC_RETURN.md) | Aceptación Preview conservada | 29 escenarios de navegación más regresión Free/Doctor; horarios de centros y disponibilidad de Agenda siguen separados |
| G3.3 | Invitado/delegado LIVE sobre el mismo médico, editor/Agenda originales; sandbox histórico | #175 `2e5bfcc5d732d5d3bba3b970ce165a3ea5f7e5a8`; [lote 3](../architecture/KAWVO_KAWMED_G3_LOT_3.md) | [Aceptación funcional](https://github.com/pgcsoluciones/intap-link/pull/175#issuecomment-7001896018), sin inventar detalle individual | 15 grupos browser, contratos LIVE/demo/MED; #134 permanece pendiente de certificación de primera aceptación en release API |
| G3.4 | Master médico, presentación separada de patrocinio, borradores, programas/visitadores/estaciones | #176 `594113eeff8d6bd9cd39e572e953f7af7d2fba95`; [lote 4](../architecture/KAWVO_KAWMED_G3_LOT_4.md) | Confirmación del propietario conservada por continuidad y contrato G8; PR mantiene texto histórico OPEN | 15 grupos browser: cambios pendientes, recarga comercial, identidad guardada, contexto sponsor/programa, cuenta y permisos |
| G3.5 | Credenciales y alcance delegado, continuidad Team | Módulos heredados de main/G3, `594113ee…` y `46cc46d1…`; #150 C01/C04/C07 | Confirmación global conservada; no se encontró un PR/SHA autónomo G3.5 para afirmar una entrega separada | Credenciales Master/delegado/beneficiario en suites; Team limitado y autorizado en fixtures; detalle de QA real no añadido |
| G4 | Beneficiario, selección/reanudación, consentimiento, guardar antes de publicar, Agenda y Multicuenta | #177 `46cc46d17b6bd17af735a627a12357e1938eeb44`; [handoff](../architecture/KAWVO_G4_BENEFICIARY_START.md) | Confirmado por Juan, preservado por contrato G8 y orden actual | Suite G4 acumulativa actual: perfil/tenant, credenciales→dispositivo cancelar/confirmar, pendientes, errores/publicación y entradas médicas |
| G5 | Master Link: Inicio/Mi presentación/Patrocinios/Más, gestión comercial y CTA Publicar explícito | #178 `b97a2f01672eaa14df04f74aa6ad882f9b4cd256`; [handoff](../architecture/KAWVO_G5_MASTER_UNIFIED.md) | Confirmado por Juan; no interpretar el texto antiguo OPEN del PR como revocación | Suite G5 y API comercial; cuenta normal/Multicuenta, borradores y misma identidad; «Publicar» abre confirmación y no publica al navegar |
| G6 | Nueva unificación del editor de pago | Base G5; nuevo lote expresamente pospuesto | **POSTERGADO, no aprobado ni implementado por G8** | Editores originales Products/FAQ/Videos, guards y rutas congelados contra main; fixtures de acceso por plan. No reactivar shell G6 |
| G7.1-A | Inventario Master API/D1 read-only, búsqueda/filtros/paginación acotada por tenant | #179 `e9b1aa11189fe43e928ba26802e2f5f34fd5baa4`; [handoff](../architecture/KAWVO_G7_1_SPONSOR_INVENTORY.md) | Incluido por contrato G8 en cadena aprobada; no atribuir a la aceptación específica B una QA exhaustiva de A | Nueve grupos API/SQLite y compatibilidad sobre árbol API idéntico, smoke G8 sobre candidato y browser G7; **API sigue excluida de Producción (404)** |
| G7.1-B | Búsqueda Master médico sin acentos, multitérmino, estación/especialidad/médico, contador y reset | #181 fuente UI `f42bccf2…`, fuente acumulativa `cf663d99…` | [«listo aprobado», 23/11/2026](https://github.com/pgcsoluciones/intap-link/pull/181#issuecomment-7094624920) | Contrato de búsqueda PASS y 6 tamaños browser adicionales; App Preview local genera `index-D25-Z3tL.js`, mismo nombre reportado. Igualdad de bytes remotos no verificada aquí |
| G7.2 | Lecturas comerciales genéricas | #180 `3886ee87…`, rama separada | **POSTERGADO**; rollback de rutas Stage documentado en #181 | No contiene consumidores ni endpoints `/commercial/sellers/page` o `/assignments/page`; API idéntica a #179. No se consultaron/modificaron rutas remotas |
| G8 | Consolidación, regresión por rol, manifiesto y preparación de recuperación | Rama actual desde `fae4ced6…` | Preparación autorizada; **sin aprobación de Producción** | Runtime congelado, pruebas/evidencia adjuntas; revisión independiente, gates productivos y QA adicional pendientes |

## Cadena acumulativa y diferencias con main

`git merge-base --is-ancestor` verifica cada eslabón, no se infiere por títulos:

`#175 2e5bfcc5… → #176 594113ee… → #177 46cc46d1… → #178 b97a2f01… → #179 e9b1aa11… → #181 cf663d99… → fae4ced6…`.

Todos los PR consultados están OPEN/Draft; no se fusionó ninguno. #181 apunta a la rama #179; #179 y G3–G5 apuntan a main. Main es ancestro de la referencia. El contenido de esos PR ya está acumulado: fusionarlos uno por uno duplicaría decisiones de integración. No existe conflicto Git por el mero hecho de compartir archivos.

Delta de main a la referencia: **117 archivos, +6309/−264**, de los cuales **14 API, 33 App, 3 Web, 0 Functions, 31 capturas QA, 10 documentos y 26 tests/operaciones**. [Inventario completo](KAWVO_G8_DIFF_MAIN.tsv) y [manifiesto](KAWVO_G8_RELEASE_MANIFEST.json) incluyen status, blobs y SHA256. El `diff --check` integral detectó cuatro espacios finales heredados en el contrato G8; se corrigió sólo su formato y una aserción exige que el contenido sea idéntico tras esa normalización. El incremento propio de G8 se limita a los archivos de preparación indicados arriba; no altera ese runtime.

- **API:** recupera la fuente documentada `2286c937…` (#147), preserva handlers comerciales/scheduled, owner-context Free, selección y reanudación, identificadores físicos y el correctivo pending LIVE; añade únicamente el módulo read-only de inventario G7 y su registro frente a esa fuente. La API G8 completa es idéntica a #179. No usar main como representación suficiente del Worker activo ni afirmar que un commit parecido fue desplegado.
- **App:** composición por roles, estado único y módulos existentes, credenciales, guardado/publicación, entradas de Multicuenta y retornos; el único cambio funcional de #181 frente a #179 es `SponsorKawMed.tsx` (búsqueda y controles). El App completo coincide con la fuente UI aprobada f42bccf2.
- **Web:** tres archivos de retornos privados de Kawmed/ownerbar y etiqueta «Editar perfil». Sin trasplante de Web completa, ni nuevo diseño para pacientes. Las rutas públicas/SEO/GEO se preservan y requieren gates de release.
- **Functions/shared/configuración/lockfiles/dependencias/workflows/migraciones activas:** sin diferencias respecto a main. Eso no demuestra equivalencia entre esquema/bindings remotos y Git.
- **Automatización #181:** dos scripts históricos que hacen uploads/activaciones Preview con SHA/orígenes/hashes fijados. Su sintaxis se verifica sin ejecutarlos. `--apply`, `--resume` y `--rollback` no son un procedimiento productivo G8. El TOML Preview versionado todavía apunta a `feature-account-access-metho…`, distinto del origen documentado en #181: no debe sincronizarse como configuración activa. La recuperación usa el endpoint JSON probado, pero sus comprobaciones del frontend extraen el **nombre** JS; no prueban todos los bytes remotos. Los booleanos de Producción de sus recibos no son auditorías independientes.

## Evidencias de validación

Resultados y comandos exactos en [KAWVO_G8_VALIDATION.json](KAWVO_G8_VALIDATION.json). Logs locales `/tmp/kawvo-g8-validation/`; se conserva SHA256 de logs/artefactos. Los screenshots browser son fixtures sintéticos y no contienen pacientes reales. El informe no presenta los tests estáticos como QA autenticada.

- TypeScript App/API; builds App y Web en modos Preview/Producción; compilación local de Pages Functions: **PASS**. Se archivaron artefactos separados y hashes de todos los archivos. La compilación productiva no implica activación de shells Preview.
- Contratos actuales de identidad, Multicuenta, aislamiento, MED/MEDM, LIVE/demo, Free G2, publicación/retorno G5 y búsqueda G7.1: **PASS**, con detalle individual en JSON.
- Regresiones browser sobre componentes/router/guards/CSS reales actuales, interceptando HTTP: G3.2/Doctor/Free, G3.3, G3.4, G4, G5 y G7.1; se incluyen 320/360/390/430/768/1280 px, guardados, cancelaciones, contexto, errores y fallback. Resultado final: **138 grupos distintos PASS**, incluidos 16 G5 completados mediante ejecución inicial y recorridos dirigidos. Detalle por suite en JSON. La suite adicional G8 ejecuta 12 grupos (búsqueda en seis anchos, tres módulos de pago originales, rechazo Free y dos permisos Team).
- API: suites G7/compatibilidad se ejecutan en el checkout limpio #179, cuyo **árbol `api/src`, shared, manifiestos de dependencias y fuentes de prueba son idénticos a los del candidato**; no se altera su scope histórico para aceptar G8. Prueban volumen 1001/10001, límites, cursores estables, tenants/roles y composición comercial/scheduled. El smoke API G8 se ejecuta directamente en el candidato con SQLite temporal y verifica la misma separación y cero escrituras G7.
- `test-kawvo-g8-release-contract.mjs`: cadena, blobs/hashes, runtime congelado, gobernanza exacta, legacy pago/Team, ausencia G6/G7.2, módulo G7 idéntico, #134 reconciliado, API local y propuestas de esquema: **PASS**.
- Lecturas App Preview/Producción: **BLOCKED** por proxy `CONNECT 403`, HTTP del destino no obtenido. Sin acceso Cloudflare autenticado. No se repitió preparación/publicación G7 ni se pidió la sesión del propietario.
- CI del SHA final: se registra en el Draft G8 cuando GitHub termine; el PASS de #179 no se presenta como CI de G8.

### Incidencia de navegador conservada

La ejecución inicial G5 pasó nueve grupos y falló por timeout de 12 segundos al cargar el destino fixture `/other`. El caso se repitió sin cambiar código, aserciones ni límite y pasó; también pasaron los seis grupos que no habían llegado a ejecutarse. Se conservan el FAIL original y los logs dirigidos. No se atribuye una causa funcional no demostrada ni se cuenta la repetición como cobertura adicional.

### Fallos originales conservados, sin debilitar tests

La ejecución inicial sobre fae4ced6 obtuvo **16 PASS / 12 FAIL** en 28 contratos/auditorías. No se borraron, relajaron ni modificaron sus pruebas para obtener verde:

1. Ocho contratos de alcance de fases G3.1.1/G3.2/retorno/G3.3/G3.4/G4/G5/G7.1 rechazan la rama sucesora por sus allowlists locales históricas. No son contratos globales de release. Sus helpers browser acumulativos sí se ejecutan sobre G8; el nuevo verificador congela todo el runtime aprobado con hashes y allowlist de preparación exacta.
2. G3.1 original exige `load()` idéntico al panel main anterior a las operaciones delegadas G3 posteriores. No se revierte la delegación aprobada para satisfacer esa comparación. Se mantienen regresiones funcionales acumulativas Doctor/delegado/Master.
3. Free contacto/Agenda exige el literal antiguo «Configuración»; falla igual en main. La etiqueta y destinos vigentes se prueban en suites actuales.
4. `test-sponsored-profile-contract` busca la publicación Master en `sponsored-owner-flow.ts`, donde la fuente recuperada eliminó el handler duplicado. Main también falla, pero más adelante, en «agenda solicita teléfono»: no se afirma que sea el mismo fallo. La ruta/middleware efectiva, mismos permisos y publicación se cubren con suites actuales; el test histórico requiere reconciliación posterior sin restaurar un duplicado inseguro.
5. `audit-team-browser-authority` exige tres textos de login ausentes también en main. Su auditoría funcional de flujo Team pasa, y los guards se prueban con permisos reales simulados; estos tres asserts permanecen FAIL, sin concluir que todo Team fue certificado.

Los 12 fallos preexisten a los cambios propios G8; no se ocultan como PASS ni se cuentan como 12 defectos nuevos de producto. El verificador G8 no sustituye QA de usuario ni exonera bloqueantes productivos.

## Bloqueantes y riesgos priorizados

| Prioridad | Hallazgo comprobado / limitación | Acción concreta requerida |
| --- | --- | --- |
| P0 | G3/G4/G5 requieren host/modo Preview y G7.1 API rechaza Producción con 404 | Revisar y autorizar política de activación productiva, preparar lote de gates con las mismas pruebas de identidad/roles/fallback; no retirar guards silenciosamente |
| P0 | API usa tablas de 0153/0154 ausentes del árbol de migraciones; esquema productivo real no consultado | Ejecutar metadata SELECT autorizada, contrastar tablas/columnas/índices e historial; revisar propuestas históricas exactas fuera de migraciones activas. No ejecutar migraciones por implicación |
| P0 | No se acreditó baseline productivo actual ni respaldo completo App/Web/Functions/Worker/bindings/settings | Preflight de lectura con sesión autorizada y respaldo byte a byte; fijar IDs efectivos y disponibilidad de rollback antes de publicar |
| P0 | Falta aprobación del SHA final y plan; automatismos externos de main no certificados aquí | Revisión independiente, CI del candidato, decisión del propietario y guard exacto antes de merge/publicación |
| P1 | #134: source pending/active ya reconciliado, certificación de primera aceptación LIVE no aportada para el release | Mantener pendiente y ejecutar sólo ese recorrido adicional con invitación/perfil/paciente de prueba autorizados, sin ampliar permisos |
| P1 | Aprobación de búsqueda G7.1 es específica; no prueba todos los escenarios ni igualdad binaria remota | Conservar aprobación, completar únicamente QA cruzada/bytes pendientes del candidato cuando se autorice el entorno |
| P1 | Rollback remoto no ensayado; copias/retención/versiones efectivas no accesibles | Verificar lectura/retención y ensayar recuperación aislada bajo autorización, sin usar un TOML antiguo como respaldo |
| P2 | Contratos estáticos de fase no aplican globalmente; tres auditorías históricas tienen expectativas obsoletas | Reconciliación separada de contratos con pruebas de comportamiento, preservando cada protección original |

Las advertencias Vite de chunks grandes y del API CJS son limitaciones de build conocidas, no nuevas dependencias ni errores ocultados. Este lote no hace remediación de seguridad/dependencias paralela; CI mantiene sus gates originales.

## Conclusión y punto de control

Integración Git/documental **preparada para revisión**; runtime G0–G5/G7.1 conservado; G6 y G7.2 fuera; pruebas y fallos explícitos. **NO-GO de Producción**, incluso si CI resulta verde, por los gates anteriores. [Plan de publicación/rollback](KAWVO_G8_RELEASE_RUNBOOK_2026-11-23.md) preparado y no ejecutado.

Se necesita revisión técnica del Draft, resolver activación/esquema/recuperación y pendientes concretos, y después autorización expresa del propietario para el **SHA exacto y plan de release**. Ninguna aceptación histórica ni el push/Draft de esta preparación autoriza merge, despliegue o migración.
