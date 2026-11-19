# KAW-G3.2 — Navegación unificada y retornos contextuales

Estado: candidato para revisión técnica. G3 completo y aceptación visual/autenticada permanecen OPEN.

Base exacta: PR #173, `567a028a5a06754910a0335433b403cec806399a`.
Rama sucesora: `feat/kawmed-g3-2-contextual-navigation`. No se modifica #173, #170 ni los runners.

## Contratos y reutilización

Norma acumulativa: [KAW-U-NAV-001, U01–U09](https://github.com/pgcsoluciones/intap-link/pull/156#issuecomment-6957519041).
Conserva [#150](https://github.com/pgcsoluciones/intap-link/pull/150), [#151](https://github.com/pgcsoluciones/intap-link/pull/151), [#156](https://github.com/pgcsoluciones/intap-link/pull/156), [#172](https://github.com/pgcsoluciones/intap-link/pull/172), `CONTRACT_PRODUCTION_PROFILES.md` y G3.1.1/#173. AGENTS v1 consultado desde `50e74d81c61e3e18c85aec3af8505101f43cde93`, sin integrar su rama.

Se reutilizan el contexto acotado por cuenta y los retornos explícitos de `free/KawvoShellReturn.ts` y `free/FreeAppointments.tsx`; `shared/KawvoPagedList.tsx` para las cinco secciones de Perfil; `free/freeAgendaSummaryData.ts` para reducir las últimas solicitudes pendientes; el AppointmentManager existente para todas las operaciones de Agenda. No hay otra implementación de formularios, publicaciones, citas ni permisos.

## Causa reproducida sobre #173

La suite monta MedicalDashboard, MedicalNotifications y MedicalAppointments originales del SHA base. Perfil → Identidad funciona en esa base: no se atribuye al botón raíz un fallo que no se reprodujo. El retorno de Solicitudes enlaza a `/admin/medical` sin opt-in y abandona el shell; Agenda usa `history.back()` sin destino verificable. Los enlaces a Agenda, solicitudes, cuenta y ayuda PWA no conservaban un contexto completo. Agenda solo contenía un puente con un botón. Se conservan la captura anterior y pruebas que demuestran ambas diferencias.

## Matriz pestaña → módulo → retorno → guard

Todas las entradas del shell requieren simultáneamente build Preview, host **exacto** `app.preview.intaprd.com`, opt-in `kawvo_med_shell=1`, scope doctor y perfil autorizado no delegado. Las rutas y AdminGuard originales no cambian.

| Origen | Destino existente | Retorno explícito | Verificación / estado conservado |
| --- | --- | --- | --- |
| Inicio / Perfil | Identidad y especialidades, centros, horarios por centro, seguros, apariencia; inline en MedicalDashboard | Volver al perfil médico → lista de secciones | Mismo propietario del estado; pestaña, submódulo, búsqueda y grupo. Formularios permanecen montados al alternar pestañas |
| Perfil → horarios por centro | `/admin/medical/agenda`, sección disponibilidad | Volver al perfil médico → mismo formulario de horarios | Perfil autorizado y respuesta de Agenda con el mismo id; mantiene filtro de Perfil. No confunde horarios públicos y disponibilidad |
| Agenda | `/admin/medical/agenda`, secciones solicitudes, confirmadas, disponibilidad, bloqueos o configuración/motivos | Volver a Agenda → superficie intermedia funcional | Entrada opcional al AppointmentManager original, foco al encabezado y ninguna escritura por abrir/volver |
| Agenda → resumen pendiente | Mismo gestor, `request` validado y localizado en sus datos autorizados | Volver a Agenda | Paginación y resaltado existentes; id desconocido tiene aviso explícito, nunca consulta otra cuenta |
| Inicio / Más | `/admin/medical/notifications` | Volver a Inicio / Más opciones (o Perfil/Agenda según origen) | Contexto validado contra GET del perfil; respuesta de solicitudes también compara id |
| Solicitudes → detalle de una cita | `/admin/medical/agenda?request=…` | Volver a solicitudes de citas médicas → mismo filtro; segundo retorno al origen | Pendientes, confirmadas e historial separados; URL conserva el filtro tras recarga |
| Cambiar cuenta, acceso existente del propietario habilitado | `/admin/accounts` | Volver al perfil médico → origen | El enlace no cambia cuenta. Solo el POST explícito de selección existente usa kind+id y token canónico; otra cuenta médica empieza en Inicio, sin filtros ajenos |
| Ayuda PWA | Modal existente | Cerrar → misma pestaña; dirección de instalación conserva contexto | No cambia manifest, service worker, permisos ni instalación automática |
| Vista previa / edición inline / confirmaciones | Modales y formularios existentes | Cerrar / Cancelar → mismo propietario del estado | No navega a legacy ni guarda/publica al navegar |
| Ver perfil público | Web existente, nueva pestaña | La pestaña App conserva el origen | Solo perfil publicado; URL y comportamiento Web no se modifican |
| Panel anterior | Fallback explícito en el frame | Legacy temporal existente | Separado de la navegación habitual; no se amplía el shell a invitados/Master |
| Fuera del shell: Agenda doctor / Master / invitado | Rutas legacy existentes | `/admin/medical`, `/admin/sponsor/kawmed?tab=profile`, `/admin/medical/demo/:token`, respectivamente | Destinos deterministas incluso sin historial; scope/headers/guards originales preservados |

El contexto URL es una pista de interfaz, nunca autoridad. Solo acepta rutas fijas, pestañas/secciones enumeradas y textos acotados. No transporta credenciales ni datos de pacientes. Una URL copiada no selecciona una cuenta ni concede permisos. La prueba de perfil se repite en los módulos; un contexto de otra cuenta o delegado se rechaza y permite reintentar. El gestor compara además el id de su propia respuesta antes de mostrar datos.

## Verificación acumulativa U01–U09

| Regla | Aplicación y evidencia automatizada | Estado técnico local |
| --- | --- | --- |
| U01 | Secciones habituales mantienen opt-in; todos los retornos internos son URLs canónicas. Panel anterior sigue explícito | PASS; QA autenticada pendiente |
| U02 | Perfil usa lista funcional filtrable; Agenda ofrece cinco accesos y resumen real de hasta cinco pendientes, con carga/error/permisos/vacío | PASS; ninguna métrica inventada |
| U03 | Pruebas de cada submódulo, filtros, solicitudes/detalle, recarga, enlace copiado, Atrás, cuenta y PWA | PASS sintético; QA móvil real pendiente |
| U04 | «Solicitudes de citas médicas» en accesos, pantalla, textos y retorno del detalle. Confirmadas/historial explícitos | PASS |
| U05 | Componentes de identidad/utilidades y frame aprobados sin cambios; suite G3.1.1 a seis anchos; gestor contextual conserva fuente sans y controles táctiles | PASS sintético; aceptación visual Work OPEN |
| U06 | Avisos, Más tarde, CTA persistente, confirmación explícita y aislamiento por perfil/rol en Kawmed y Free | PASS: se ejecutan las 21 pruebas de G3.1.1 |
| U07 | Componentes anteriores reutilizados; matrices y suites heredadas permanecen disponibles para fases sucesoras | PASS |
| U08 | Mutaciones médicas y de Agenda preservadas, guardas intactas, formularios inline retenidos, salida externa bloqueada si hay borrador; Agenda pide descarte explícito y permite cancelarlo incluso con Atrás | PASS sintético; no habilita invitados/Master |
| U09 | Matriz anterior, pruebas acumulativas y capturas versionadas de móvil/escritorio | PASS automatizado; no constituye aceptación final G3 |

El bloqueo de Atrás de Agenda se registra antes de BrowserRouter: los listeners de `popstate` de Window pueden ejecutarse en orden de registro. La prueba detectó pérdida del borrador con un listener tardío; el guard temprano restaura un recorrido cancelado usando el índice del router. Solo se activa para el editor médico contextual montado. Los retornos siguen usando destinos explícitos, no dependen de `history.back()`. Al refrescar/salir del documento con borradores, el navegador solicita confirmación. Guardar Agenda conserva el PUT original; navegar no lo ejecuta.

## Allowlist de este lote respecto a #173

1. `app/src/components/admin/medical/MedicalDashboard.tsx`
2. `app/src/components/admin/medical/MedicalAppointments.tsx`
3. `app/src/components/admin/medical/MedicalNotifications.tsx`
4. `app/src/components/admin/medical/KawMedShellReturn.ts`
5. `app/src/components/admin/medical/useKawMedShellReturn.ts`
6. `app/src/components/admin/medical/KawMedAgendaOverview.tsx`
7. `app/src/components/admin/IntapcardAccountSelector.tsx` — retorno y selección UI contextual; contrato de activación/token intacto.
8. `app/src/components/appointments/AppointmentManager.tsx` — entradas/retorno opcionales, protección de borradores contextual y accesibilidad; operaciones originales intactas.
9. `scripts/test-kawmed-g3-2-navigation-contract.mjs`
10. `scripts/test-kawvo-g3-1-1-ui-contract.mjs` — extracción reutilizable; conserva las aserciones estáticas del lote anterior.
11. `scripts/lib/kawmed-g3-2-browser.mjs`
12. `scripts/lib/kawvo-g3-1-1-browser.mjs` — conserva todas las aserciones de navegador de #173; añade el retorno explícito a Inicio tras comprobar que Más se restaura en G3.2.
13. `docs/architecture/KAWVO_KAWMED_G3_LOT_2.md`
14. `docs/qa/KAWMED_G3_2/baseline-agenda-390.png`
15. `docs/qa/KAWMED_G3_2/profile-390.png`
16. `docs/qa/KAWMED_G3_2/agenda-390.png`
17. `docs/qa/KAWMED_G3_2/agenda-1280.png`
18. `docs/qa/KAWMED_G3_2/requests-390.png`
19. `docs/qa/KAWMED_G3_2/availability-390.png`

El Draft PR hacia main es acumulativo e incluye #173; su delta de revisión G3.2 se mide exclusivamente contra el SHA base de este documento. No se modifican código Free, API, Web, guards, identidad activa, credenciales, dependencias, workflows, runners ni infraestructura.

## Pruebas y reproducción

Entorno: Node 20.20.2, TypeScript/esbuild/Playwright ya disponibles, Chromium del sistema; no instalación ni actualización de dependencias. Fixtures totalmente sintéticos, sin credenciales ni conexiones reales. Se interceptan todas las peticiones y se rechazan endpoints inesperados. Las comprobaciones de solo navegación exigen cero métodos distintos de GET; selección de cuenta, guardado y publicación se comprueban aparte como acciones explícitas.

```sh
npm exec -w app tsc -- --noEmit
npm run build:preview -w app
node scripts/test-kawmed-g3-2-navigation-contract.mjs --browser --scope
npm run build -w app  # exclusivamente local; no publicación
node scripts/test-kawmed-isolation-contract.mjs
node scripts/test-kawmed-web-preview-route-contract.mjs
node scripts/test-kawmed-code-accordion-contract.mjs
node scripts/test-kawmed-demo-invitations-contract.mjs
node scripts/test-kawmed-live-guest-contract.mjs
node scripts/test-kawmed-claim-resume-ux-contract.mjs
node scripts/test-intapcard-active-account-contract.mjs
node scripts/test-intapcard-multiaccount-contract.mjs
node scripts/test-intapcard-kawmed-integrated-contract.mjs
node scripts/test-kawvo-free-g2-qa-corrections-2026-11-15.mjs
node scripts/test-kawvo-g5-publication-navigation-2026-11-15.mjs
git diff --check
```

**Resultado local final: PASS** — 25 escenarios G3.2 + 21 heredados G3.1.1 = **46 escenarios de navegador**, 11 contratos existentes, TypeScript App y builds App Preview/Producción locales. `git diff --check` y allowlist exacta de 19 archivos: PASS. QA autenticada/aceptación visual final: pendiente.

La suite G3.2 monta los componentes y router reales con CSS compilado. Prueba anchos 320, 360, 390, 430, 768 y 1280, sin desbordamiento horizontal global y con accesos principales/retornos de al menos 44 × 44. Repite las 21 pruebas de navegador G3.1.1 para Kawmed y Free. El guard de allowlist está ligado a esta base exacta. Las fases siguientes deben validar su propia allowlist y reutilizar `runG32Browser()` de `scripts/lib/kawmed-g3-2-browser.mjs`, que también ejecuta la suite G3.1.1, sin eliminar regresiones ni aflojar los contratos estáticos históricos. No se invocan como si fueran del lote nuevo los guards históricos de cinco/seis archivos, que pertenecen a sus candidatos congelados.

Las seis capturas son PNG de viewport real del navegador sintético (900 px de alto), revisables en el PR. [Antes](../qa/KAWMED_G3_2/baseline-agenda-390.png), [Perfil](../qa/KAWMED_G3_2/profile-390.png), [Agenda móvil](../qa/KAWMED_G3_2/agenda-390.png), [Agenda escritorio](../qa/KAWMED_G3_2/agenda-1280.png), [Solicitudes](../qa/KAWMED_G3_2/requests-390.png), [Disponibilidad](../qa/KAWMED_G3_2/availability-390.png). Para regenerarlas: `KAWMED_G32_ARTIFACTS=docs/qa/KAWMED_G3_2 node scripts/test-kawmed-g3-2-navigation-contract.mjs --browser --scope`, después de build Preview. No son capturas de QA autenticada ni de un deployment.

## Evidencias de código
- [app/src/components/admin/medical/MedicalDashboard.tsx:372](../../app/src/components/admin/medical/MedicalDashboard.tsx#L372) — Gate original y restauración del origen en el mismo propietario de formularios.
- [app/src/components/admin/medical/KawMedShellReturn.ts:17](../../app/src/components/admin/medical/KawMedShellReturn.ts#L17) — Parser acotado y destinos canónicos.
- [app/src/components/admin/medical/useKawMedShellReturn.ts:9](../../app/src/components/admin/medical/useKawMedShellReturn.ts#L9) — Prueba del perfil autorizado, delegación y rechazo de cuenta ajena.
- [app/src/components/admin/medical/KawMedAgendaOverview.tsx:6](../../app/src/components/admin/medical/KawMedAgendaOverview.tsx#L6) — Cinco accesos al gestor existente y reducción de solicitudes reales.
- [app/src/components/admin/medical/MedicalAppointments.tsx:6](../../app/src/components/admin/medical/MedicalAppointments.tsx#L6) — Entrada, etiqueta y retorno contextual/legacy.
- [app/src/components/admin/medical/MedicalNotifications.tsx:8](../../app/src/components/admin/medical/MedicalNotifications.tsx#L8) — Solicitudes de citas, filtros, detalle y retorno.
- [app/src/components/admin/IntapcardAccountSelector.tsx:114](../../app/src/components/admin/IntapcardAccountSelector.tsx#L114) — Selección kind+id canónica y retorno de cuenta médica.
- [app/src/components/appointments/AppointmentManager.tsx:17](../../app/src/components/appointments/AppointmentManager.tsx#L17) — Guard temprano de borradores; mutaciones existentes preservadas.
- [scripts/test-kawmed-g3-2-navigation-contract.mjs:7](../../scripts/test-kawmed-g3-2-navigation-contract.mjs#L7) — Base, allowlist e invariantes acumulativos.
- [scripts/lib/kawmed-g3-2-browser.mjs:10](../../scripts/lib/kawmed-g3-2-browser.mjs#L10) — Escenarios de navegación y suites heredadas reutilizables.

## Límites, QA Work y handoff

- [ ] Validar en App Preview exacto con perfil doctor real autorizado, cuenta activa y datos guardados. Stage pages.dev no activa el shell.
- [ ] Perfil → cada módulo → retorno, filtros, cambios sin guardar, atajos de Inicio y recargas/enlaces copiados.
- [ ] Agenda → solicitudes/detalle/confirmadas/disponibilidad/bloqueos/configuración → retorno contextual; comprobar datos y zonas horarias reales.
- [ ] Solicitudes pendientes frente a citas confirmadas e historial; regreso al mismo filtro tras gestionar una cita.
- [ ] Botón Atrás/Adelante y confirmación de descarte nativa en Safari/iOS, Android y escritorio; comprobar cancelación y guardado antes de salir.
- [ ] Selector con varias cuentas reales: mismo perfil conserva origen, otro médico inicia en Inicio; Free/Link/Trial/Master conservan sus rutas y autorizaciones.
- [ ] PWA instalada, ayuda y cierre, safe-area, teclado virtual, foco y zoom; móvil 320/360/390/430 y tableta/escritorio.
- [ ] Avisos de publicación Kawmed y Free: datos mínimos guardados, Más tarde, CTA persistente, cambio de perfil/rol, confirmación y errores de publicación.
- [ ] Invitados/Master/producción/host aislado siguen legacy; comprobar guardas reales sin ampliar permisos.

No hay QA autenticada, D1 real, R2, OAuth ni integración de datos productivos en este entorno. Las pruebas sintéticas no acreditan escrituras reales, publicación efectiva ni permisos de una sesión real. Los avisos conocidos de build (Browserslist/CJS y tamaño de bundle) no se resuelven en esta fase. La CI existente complementa los resultados locales; no se modifica para instalar herramientas nuevas. No se ejecutan despliegues.

Rollback: antes de integrar, cerrar el Draft PR y conservar #173. Si se autorizase una integración futura, revertir únicamente el commit G3.2 completo vuelve a #173 y sus correcciones G3.1.1, sin migraciones ni datos que deshacer. El opt-in sigue siendo exclusivo de App Preview y el fallback explícito Panel anterior permanece disponible. Ninguna aceptación G3 completa se declara aquí.
