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
