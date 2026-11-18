# KAW-G3.3 — Invitado de demostración y delegado Kawmed

Base exacta aceptada por el propietario en Preview: #174, `27a4a003d2cc96afb0edd609dd53ba204aa9b2c6`. Rama: `feat/kawmed-g3-3-guest-unified-shell`. Estado: preparación para revisión; QA autenticada pendiente. Sin merge, despliegues ni nuevos procedimientos operativos.

## Matriz establecida antes de implementar

| Rol verificado | Inicio | Perfil | Agenda | Más / retorno | Escrituras heredadas |
| --- | --- | --- | --- | --- | --- |
| Demo privada | Identidad de la copia, modalidad y caducidad del acceso | Identidad, centros, horarios de demostración, seguros y apariencia; módulos pequeños mediante KawvoPagedList. Sólo si `permissions.edit_profile` | Sólo Agenda ficticia existente, solicitudes/estados y bloqueos de ejemplo; nunca AppointmentManager real | Recursos autorizados de la demo patrocinada e información del acceso; sin cuentas, credenciales ni publicación | PATCH `/me/kawmed/demo/:token`, payload original, guardado explícito |
| Delegado live | Identidad/estado del perfil asignado; utilidades y avisos permitidos | MedicalDashboard conserva formularios y operaciones, especialidades, medios, centros, horarios públicos por centro, seguros y apariencia | Sólo si la lectura autorizada de citas devuelve el mismo perfil; superficie intermedia y AppointmentManager existente | Solicitudes en la Agenda delegada existente, vista publicada, PWA y sesión; regreso por ruta de la invitación | Aceptación original de invitación, operaciones médicas y citas existentes, publicación/despublicación confirmadas mediante API original |
| Doctor | Comportamiento G3.1.1/G3.2/G3.2.1 preservado | Sin cambios de permisos | Sin cambios de permisos | Retornos existentes | Contratos existentes |
| Master | Legacy, no implementado en esta fase | Scope existente intacto | Scope existente intacto | Sin integración G3.4 | Sin cambios |
| Acceso inválido, vencido, revocado, otro correo/perfil | Carga/error/login diferenciados | Ningún editor de otro perfil | Sin datos ni acciones de otra invitación | Retorno seguro al acceso asignado | API conserva autoridad y deniega operaciones |

La demo no publica ni cambia cuentas aunque se alteren parámetros de URL. El delegado live sí conserva la publicación ya permitida por `/me/medical-profile/publication`: no se equipara a propiedad ni habilita los endpoints de suspensión/reactivación/eliminación, credenciales o selector. El servidor valida invitación, correo, caducidad y última concesión; la UI no reemplaza esa autoridad.

Fuentes de permisos: `api/src/kawmed-demo-invitations.ts` (GET/PATCH demo y activación live), `kawmed-live-guest.ts`, `medical-profile-owner.ts`, `medical-appointments.ts`, `sponsored-multiprofile-access.ts`; sólo lectura. El sandbox es una copia sin id de propietario: su contexto usa `invitation_id`. El contexto live usa el id del perfil asignado, contrastado con la concesión y el GET médico delegado.

## Composición y navegación

Se reutilizan KawMedUnifiedShellFrame, KawvoProfileIdentity, KawvoPagedList, KawvoReadyToPublish, MedicalDashboard, KawMedAgendaOverview y AppointmentManager, así como el codec de retorno G3.2 y el patrón de entrada canónica de Free. No se reconstruyen formularios ni motores de permisos.

Las rutas existentes `/admin/medical/demo/:token` y `/agenda` comparten la misma composición de invitación para mantener la aceptación, los borradores y el perfil al ir/volver de Agenda. El estado se reinicia al cambiar de token; nunca se hereda el perfil de otra concesión. Se preserva la secuencia original GET live-access → POST activate, o GET demo, y los headers automáticos existentes. El POST de aceptación es el handshake anterior, no una escritura nueva al alternar pestañas o volver de módulos.

Sólo build Preview y host exacto `app.preview.intaprd.com` habilitan el shell invitado. La entrada canónica de invitación lleva al Perfil intermedio; los enlaces públicos existentes a esa misma ruta permanecen dentro del shell sin cambiar Web. Agenda canónica lleva a la superficie intermedia; un enlace a solicitud/sección se conserva y entra al módulo existente tras verificar el acceso. Doctor sigue con su opt-in original. El fallback explícito usa `legacy=1`; Producción y otros hosts mantienen la experiencia anterior.

Horarios públicos por centro del perfil real y disponibilidad de citas permanecen separados. El sandbox conserva sus horarios de demostración originales; no se inventa una asociación de centro que su API no persiste. Los módulos sin permiso no se abren y la Agenda sin acceso se omite. Un error de permisos no redirige silenciosamente a la vista de propietario ni selecciona otra cuenta.

## Allowlist de G3.3

1. `app/src/App.tsx` — composición de las dos rutas de invitación ya existentes, sin tocar guards ni añadir rutas.
2. `app/src/components/admin/medical/KawMedDemoGuest.tsx`
3. `app/src/components/admin/medical/MedicalDashboard.tsx`
4. `app/src/components/admin/medical/KawMedUnifiedShellFrame.tsx`
5. `app/src/components/admin/medical/kawmed-guest-shell-navigation.ts`
6. `app/src/components/admin/medical/MedicalAppointments.tsx`
7. `app/src/components/admin/medical/useKawMedShellReturn.ts`
8. `scripts/test-kawmed-g3-3-guest-shell-contract.mjs`
9. `scripts/lib/kawmed-g3-3-browser.mjs`
10. Este documento.
11. `docs/qa/KAWMED_G3_3/demo-home-320.png`
12. `docs/qa/KAWMED_G3_3/demo-profile-390.png`
13. `docs/qa/KAWMED_G3_3/demo-agenda-1280.png`
14. `docs/qa/KAWMED_G3_3/delegate-home-320.png`
15. `docs/qa/KAWMED_G3_3/delegate-profile-390.png`
16. `docs/qa/KAWMED_G3_3/delegate-agenda-1280.png`

No API, Web pública, Workers, D1/R2, autenticación, AdminGuard, cliente API/headers, MED/MEDM, dependencias, lockfiles, workflows ni runners. Tampoco se modifica el codec/guard doctor ni las suites históricas para rebajar expectativas.

## Validación prevista

Contrato propio de alcance/permisos/aislamiento; suites acumulativas G3.2/G3.1.1 y contratos pertinentes de invitados, MED/MEDM, multicuenta/G2/G5. Navegación, retorno, recarga, entrada directa y fallback; permisos positivos/negativos, guardado y errores, publicación live confirmada y ausencia de publicación demo. Probar 320/360/390/430/768/1280 en ambos roles, focos, 44 px, sin overflow, formularios retenidos y capturas sintéticas versionadas. TypeScript App y builds Preview/Producción exclusivamente locales. No asumir QA autenticada a partir de fixtures.

## Handoff

Contratos #150, #151 (referencia visual original), #156 y U01–U09, #169 leído desde `50e74d81c61e3e18c85aec3af8505101f43cde93`, #172 y CONTRACT_PRODUCTION_PROFILES.md. El orden G3.4/Master y etapas posteriores permanece fuera del lote. Los estados de GitHub y Cloudflare se reportan por separado; aceptación Preview del padre proviene del propietario.

Rollback: revertir sólo el commit G3.3 vuelve a #174 exacto sin datos ni migraciones que deshacer. Fallback legacy conservado. Próximo punto: revisión técnica y QA autenticada autorizada; no hay autorización de publicación ni aceptación G3 completa.

## Evidencia técnica del candidato

La revisión realizada es autorrevisión. Se conserva como padre exacto `27a4a003d2cc96afb0edd609dd53ba204aa9b2c6`; main remoto sigue en `6e6bfbb1bd60c91a94e92d36f6cfdd9f91e3d9e2` y #174 conserva su SHA. El SHA G3.3 queda identificado por el commit y el Draft PR sucesor; este documento forma parte del mismo árbol validado.

Decisiones verificables en el diff:

- `KawMedDemoGuest.tsx`: conserva GET live-access, POST activate y GET/PATCH sandbox. Comprueba que la respuesta de aceptación corresponda al perfil de la concesión. La key por token descarta estado de la invitación anterior. Los formularios demo siguen bajo el mismo propietario de estado y el payload original; las nuevas superficies sólo los componen.
- `MedicalDashboard.tsx`: la prueba de delegación procede del GET original con `guest_editor`, ligada al id autorizado; no desaparece tras un guardado cuya respuesta omite esa marca. El componente permanece montado mientras su slot muestra MedicalAppointments. No cambia ninguna función de guardado, publicación, centros, horarios, seguros, medios ni lifecycle.
- `kawmed-guest-shell-navigation.ts` reutiliza el codec de Doctor con rutas cerradas, rol y cuenta de origen. No acepta destinos externos, scopes Master, credenciales ni nuevas cuentas. El contexto nunca autoriza operaciones. `useKawMedShellReturn.ts` vuelve a verificar la identidad delegada antes de mostrar Agenda contextual.
- `App.tsx`: única sustitución en rutas, el elemento de la ruta de Agenda invitada existente; paths y guards intactos. No se añade una ruta de notificaciones invitadas: se abre `section=requests` de la Agenda existente.
- `KawMedUnifiedShellFrame.tsx`: variantes de etiqueta y conjunto de pestañas; Doctor mantiene sus valores por defecto. Frame, listas, identidad y aviso de publicación compartidos conservan su jerarquía aprobada.

### Matriz acumulativa U01–U09

| Regla | Evidencia específica G3.3 y regresión heredada |
| --- | --- |
| U01 | Entrada canónica Perfil/Agenda invitada, toolbar público real sin cambios Web, rutas explícitas de módulos y fallback sólo mediante Panel anterior; pruebas negativas Producción/pages.dev. |
| U02 | Perfil intermedio reutilizado; Agenda demo con solicitudes ficticias/bloqueos; Agenda live con cinco módulos existentes y permiso verificado. Horarios del perfil separados de disponibilidad. |
| U03 | Codec acotado con rol/id; retorno a pestaña/módulo/filtro, recarga, enlace copiado, deep link de solicitud, browser back, PWA y vista publicada. Contextos ajenos/malformados rechazados. |
| U04 | «Solicitudes de citas médicas», estados demo pendientes/confirmadas/canceladas y secciones reales de solicitudes/citas confirmadas conservadas. |
| U05 | Identidad/utilidades a la derecha; estado/publicación separados en el componente aprobado, seis anchos y capturas. |
| U06 | Demo sin publicación. Delegado con mínimos guardados, aviso por rol+perfil, Más tarde y CTA persistente; sin publicar al navegar ni al revisar. Confirmación, fallo API visible, reintento y despublicación explícitos. |
| U07 | Reutilización de shell Doctor/Free y suites G3.2/G3.1.1 completas sin cambiar sus archivos ni eliminar aserciones. |
| U08 | Borradores retenidos entre módulos y pestañas; Agenda conserva la protección existente de cambios; errores, vacío, carga y acceso diferenciados. Guardado eco sin guest_editor no habilita cuentas, credenciales ni lifecycle. |
| U09 | Allowlist exacta, contrato propio estático/puro/funcional, once contratos existentes, suites acumuladas, TypeScript y builds locales; QA autenticada separada. |

### Validaciones y comandos

Resultado local: **PASS**, doce grupos G3.3 y **50 escenarios acumulativos** (29 G3.2 + 21 G3.1.1), sin eliminar escenarios ni relajar aserciones históricas.

- `node scripts/test-kawmed-g3-3-guest-shell-contract.mjs --scope --browser`: contrato propio, doce grupos de escenarios G3.3 y ejecución acumulativa de los 29 escenarios G3.2 y 21 G3.1.1. Usa componentes React, router y CSS compilado reales, API totalmente interceptada. El test propio compara las funciones de mutación con el padre y verifica payload demo idéntico.
- Once contratos existentes: `test-kawmed-isolation-contract.mjs`, `test-kawmed-web-preview-route-contract.mjs`, `test-kawmed-code-accordion-contract.mjs`, `test-kawmed-demo-invitations-contract.mjs`, `test-kawmed-live-guest-contract.mjs`, `test-kawmed-claim-resume-ux-contract.mjs`, `test-intapcard-active-account-contract.mjs`, `test-intapcard-multiaccount-contract.mjs`, `test-intapcard-kawmed-integrated-contract.mjs`, `test-kawvo-free-g2-qa-corrections-2026-11-15.mjs`, `test-kawvo-g5-publication-navigation-2026-11-15.mjs`: **11/11 PASS**.
- `npm exec -w app tsc -- --noEmit`: **PASS**.
- `npm run build -w app` y `npm run build:preview -w app`: **PASS**, exclusivamente locales. Aviso Vite sobre tamaño de chunks; no se modifican dependencias ni se amplía el lote para corregirlo.
- CSS Web de la base ya compilada reutilizado en fixtures; Web y sus funciones/configuración permanecen byte a byte iguales al padre. No se recompila ni publica Web para este lote.
- `git diff --check` y `node scripts/test-kawmed-g3-3-guest-shell-contract.mjs --scope`: control de los dieciséis archivos declarados.

La ejecución funcional cubre ambos roles en 320/360/390/430/768/1280 px, superficies y cinco módulos de Perfil, sin overflow global, controles de al menos 44×44 y foco visible mediante teclado. Las seis capturas de la allowlist son sintéticas; datos, paciente y patrocinador son fixtures. Se revisaron visualmente Inicio de ambos roles a 320 px. No se presentan como sesiones reales.

### Límites y QA pendiente para Work

- [ ] Verificar bundle y modo Preview servido en `app.preview.intaprd.com` antes de QA. Esta tarea no ejecuta despliegues ni acredita el estado efectivo de Cloudflare; no se repite su auditoría administrativa.
- [ ] Invitación demo real independiente y patrocinada: correo asignado, caducidad, guardado de copia, recursos, bloqueos ficticios y ausencia de pacientes/publicación reales.
- [ ] Delegación real: aceptación/reanudación, sesión, cuenta activa kind+id y token de pestaña, perfil asignado; revocación, vencimiento, otra cuenta/correo y cambio de invitación.
- [ ] Perfil y medios: especialidades principales/adicionales, centros, horarios públicos por centro, seguros/excepciones, apariencia y R2 existente mediante operaciones autorizadas.
- [ ] Perfil público → Perfil/Agenda/Gestionar agenda → módulos → Volver; solicitudes/deep links, enlaces copiados, recarga, atrás/adelante y PWA con sesión real.
- [ ] Guardado y publicación permitida: error de servidor, mínimos guardados, aviso persistente, confirmación, misma identidad y estado realmente persistido. Demo sin privilegios de propietario; delegado sin cuentas, credenciales ni lifecycle.
- [ ] Agenda real: disponibilidad, bloqueos, motivos, solicitudes y confirmaciones, protección de cambios y aislamiento del perfil. No confundir pendientes con confirmadas.
- [ ] Móvil físico/teclado y safe-area, tableta/escritorio; regresión autenticada Doctor/Free y legacy Master sin integrar G3.4.

**BLOCKED para QA autenticada:** el entorno no dispone de credenciales/sesiones reales de invitados ni acceso autorizado a D1/R2 remoto. El D1 sintético no acredita esas reglas en runtime. No se modifican datos, esquema, permisos o servicios para suplirlo. Las comprobaciones locales son PASS sólo en su alcance; aceptación funcional autenticada y G3 completo siguen OPEN. CI se informa en el Draft PR para su SHA; no sustituye QA ni prueba un despliegue.

Publicación GitHub mediante conector, sin force, con árbol idéntico al validado localmente y padre exacto; no se modifica #174 ni main. Sin merge, migración, runner nuevo o despliegue. La siguiente acción es revisión técnica del candidato y autorización independiente para QA Preview.


## Verificación de continuidad LIVE — criterio del 18/11/2026

Fuentes nuevas: [criterio en #156](https://github.com/pgcsoluciones/intap-link/pull/156#issuecomment-6978928646), [criterio en #175](https://github.com/pgcsoluciones/intap-link/pull/175#issuecomment-6978929391), PR #125 y el **issue #134** (no es un PR), incluidos su diagnóstico, corrección y confirmaciones históricas de QA del propietario. LIVE es la experiencia prioritaria: acceso temporal al perfil real asignado, MedicalDashboard y AppointmentManager originales, guardado real y publicación explícita. El sandbox #116 sigue siendo histórico; este correctivo no le añade funcionalidades.

Base del correctivo: `7538af92a8caaaca13399631f83d75dbf074cc4f`, rama existente de #175. Matriz y allowlist fijadas antes de editar:

| Camino | Criterio | Correctivo permitido |
| --- | --- | --- |
| LIVE con concesión válida | Editor/Agenda originales y misma identidad, persistencia, medios, publicación y recursos existentes | Sin cambiar operaciones ni permisos; pruebas de continuidad |
| LIVE rechazado, activación fallida, caducado/revocado | Error explícito; nunca editor sandbox vacío ni otro perfil | Rechazar respuesta sandbox vacía antes de montarla; no volver a intentar aceptación ni conceder acceso |
| Agenda fuera del gate Preview, incluido legacy explícito | Ruta directa al MedicalAppointments original de #125/#174 | No hacer depender esta ruta de una nueva comprobación/aceptación de invitación en el wrapper |
| Sandbox histórico válido | Editor y PATCH de copia existentes | Preservar payload, capacidades y pruebas |

Allowlist puntual de **tres archivos**: `app/src/components/admin/medical/KawMedDemoGuest.tsx`, `scripts/lib/kawmed-g3-3-browser.mjs` y este handoff. No App routes adicionales, API, configuración, Workers, D1/R2, OAuth, infraestructura, runners ni permisos.

### Reproducción previa y corrección

Sobre el SHA base, un navegador sintético reprodujo dos fallos antes de editar: (1) Agenda legacy efectuaba dos llamadas nuevas de live-access (GET y POST activate), cuando su ruta original montaba MedicalAppointments directamente; (2) rechazo LIVE seguido de GET demo con `profile: {}` no producía error y podía montar la superficie sandbox vacía. Esta última forma corresponde al `sandbox_json='{}'` que la API guarda al crear una concesión LIVE; no es una copia sandbox funcional.

El correctivo devuelve el componente Agenda original directamente fuera del gate y sólo monta una copia histórica si la API devuelve `demo:true` y un objeto de perfil no vacío. No convierte ese indicador en autorización LIVE. La activación válida sigue abriendo el editor real; fallos de activación o de identidad no prueban ni seleccionan otra modalidad. El guardado médico, media, publicación, Agenda, resolver de cuenta y API se conservan sin cambios.

### Discrepancia histórica #134 — BLOCKED independiente

El historial #134 documenta la corrección de `liveGuestInvitation`: admitir `pending` y `active` **para consultar/aceptar**, manteniendo `liveGuestProfile` estrictamente `active` **para editar**. El propietario registró su despliegue y QA en noviembre. Sin embargo, el archivo versionado `api/src/kawmed-live-guest.ts` del padre #174 y del candidato #175 conserva `i.status='active'` en ambas funciones; la creación LIVE inserta una invitación con estado inicial `pending`. El test estático heredado sólo busca `IN ('pending','active')` en cualquier parte del archivo y puede aprobar por `liveGuestBySlug`, sin cubrir la función de aceptación.

Esto es previo a G3.3 y no se altera aquí: el backend queda byte a byte igual. El historial de despliegue no demuestra qué Worker sirve actualmente App Preview. **No certificar la primera aceptación de una invitación nueva ni la continuidad runtime de #134 hasta verificar el Worker efectivo y QA autenticada o reconciliar esa corrección en un lote API expresamente autorizado.** La protección de UI evita la caída silenciosa, pero no resuelve el bloqueo de aceptación `pending` en ese código. No se cambia de estado manualmente ni se amplían permisos para superar el bloqueo.

### Evidencia y límites del correctivo

Se añaden tres grupos obligatorios a la librería acumulativa: fracaso LIVE sin sandbox; Agenda legacy en build Producción, host aislado y `legacy=1`; editor/guardado/recarga sobre perfil asignado, recursos comerciales autorizados y terminación de acceso sin revertir datos. Los grupos previos se conservan. La validación HTTP de estos recorridos está interceptada: persistencia compartida con la presentación pública y revocación son fixtures, no D1/R2 ni sesiones reales.

La QA autenticada y el reflejo real en Web permanecen BLOCKED por ausencia de sesiones y de un perfil de demostración autorizado accesible desde Codex. No se usan pacientes reales, datos clínicos ni perfiles ajenos. No hay Stage, promoción ni despliegue. El SHA nuevo debe revisarse y recibir la autorización que corresponda antes de cualquier Stage; la autorización condicionada al SHA anterior no se traslada al correctivo.


Prueba histórica recuperada sin cambios desde `d42691d8897c5e6fb376522ff9f54ecae74346e7:scripts/test-kawmed-pending-live-invitation-2026-11-02.mjs`, ejecutada fuera del árbol mediante `node /tmp/test-kawmed-pending-live-invitation-134.mjs`: **FAIL preexistente**, primera aserción `una invitación pending puede consultarse para activación` (línea 23). No se relajó ni se incorporó una versión alterada del test para volverlo verde. El blob API `be323ed0e62db80f158ab153278588001133dbfc` es idéntico en main `6e6bfbb1`, #174 `27a4a003`, #175 `7538af92` y el árbol del correctivo. Referencias: `api/src/kawmed-live-guest.ts:33` y `:44`; creación LIVE con sandbox vacío `api/src/kawmed-demo-invitations.ts:37` y estado por defecto `api/migrations/0151_kawmed_demo_invitations.sql`.

También se revisaron los caminos persistentes originales: `resolveOwnedMedicalContext` no usa otro perfil si hay header delegado; `liveGuestProfile` exige sesión/correo, grant, propietario, perfil, vigencia, estado active e invitación más reciente. La revocación sólo cambia la invitación y su eliminación sólo borra invitación/grant; no revierten medical_profiles, centros, horarios, medios ni Agenda. Estas comprobaciones son de código, no una ejecución contra D1 real.


Validaciones del correctivo: TypeScript App y builds App Preview/Producción locales **PASS**; once contratos existentes **11/11 PASS**. Tres grupos nuevos LIVE **PASS**, además de los doce G3.3 previos. El test histórico específico de #134 conserva el resultado **FAIL/BLOCKED** anterior; no se confunde con el contrato estático general live-guest que sí pasa. Las capturas existentes permanecen sin cambios y la evidencia temporal de esta comprobación se genera fuera del árbol versionado. El diff puntual no contiene API, Web, AppointmentManager, permisos, dependencias ni infraestructura.


Cierre de la ejecución acumulativa del correctivo: **15 grupos G3.3 + 50 escenarios heredados PASS** mediante `KAWMED_G33_ARTIFACTS=/tmp/kawmed-live-g33-evidence KAWMED_G32_ARTIFACTS=/tmp/kawmed-live-g32-evidence node scripts/test-kawmed-g3-3-guest-shell-contract.mjs --scope --browser`. La primera ejecución acumulativa terminó en timeout del test heredado «Perfil filters» al esperar el searchbox tras browser back; ese código no forma parte del diff. La repetición aislada del caso y la repetición completa pasaron, sin cambiar las aserciones ni la librería histórica. Se conserva el fallo inicial como limitación de reproducibilidad, separado del FAIL firme de #134. No se presenta ninguna de estas pruebas como QA autenticada.

Resultado de aceptación: **correctivo App PASS en su alcance local; continuidad LIVE completa BLOCKED** hasta resolver/verificar la discrepancia de aceptación pending de #134 y hacer QA autenticada sobre el bundle nuevo. Stage y cualquier despliegue quedan pendientes de revisión y autorización del SHA nuevo. Rollback del correctivo: revertir exclusivamente su commit vuelve al candidato `7538af92` sin tocar datos; no restaura un Worker ni resuelve por sí solo el pendiente backend.
