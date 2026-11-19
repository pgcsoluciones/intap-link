# KAW-G3-002 — G3.1 Kawmed Doctor

Estado: candidato en el [Draft PR #170](https://github.com/pgcsoluciones/intap-link/pull/170), en corrección para revisión técnica. G3 completo y QA visual/autenticada permanecen OPEN. Sin merge ni despliegue manual/productivo.

## Base, referencias y alcance

- Base autorizada: `6e6bfbb1bd60c91a94e92d36f6cfdd9f91e3d9e2`, comprobada contra `main` remoto antes de implementar.
- Rama: `feat/kawmed-g3-1-unified-doctor-shell`, creada directamente desde esa base. No incorpora la rama documental ni ramas históricas.
- AGENTS.md consultado mediante `git show 50e74d81c61e3e18c85aec3af8505101f43cde93:AGENTS.md`; PR #169 sigue separado.
- Contratos: [arquitectura #150](https://github.com/pgcsoluciones/intap-link/pull/150), [prototipo #151](https://github.com/pgcsoluciones/intap-link/pull/151), [roadmap #156](https://github.com/pgcsoluciones/intap-link/pull/156), [Free G2 #168](https://github.com/pgcsoluciones/intap-link/pull/168), [gobernanza #169](https://github.com/pgcsoluciones/intap-link/pull/169) y [Producción](../../CONTRACT_PRODUCTION_PROFILES.md).
- Referencia visual: [demostración aprobada](https://qa-kawvo-shell-1112.intap-link.pages.dev/), código del prototipo consultado en el SHA `b089bcdc1c82dce9c4e87e08ddee003503e0bd0c` de #151. Las capturas locales con fixtures no sustituyen la comparación visual de Work.

La orden actual acepta G0–G2 funcionalmente. Este lote solo desarrolla la presentación administrativa del médico profesional. No adapta invitados, Master, credenciales ni el interior de Agenda.

## Activación y fallback

Entrada: `/admin/medical?kawvo_med_shell=1`. Deben coincidir simultáneamente:

1. `import.meta.env.MODE === 'preview'`.
2. Host exacto `app.preview.intaprd.com`.
3. Path exacto `/admin/medical` y parámetro opt-in `kawvo_med_shell=1`.
4. Scope `doctor` y perfil cargado por la operación autorizada existente, con ID no vacío.
5. Ausencia de ruta de invitado y de `guest_editor` en la respuesta.

Estos controles seleccionan UI; no autentican ni conceden permisos. AdminGuard, propiedad, cuenta activa kind+id, scopes, cookies y token de pestaña siguen siendo los existentes. No hay llamadas adicionales para elegir cuenta ni cambios en sus guards.

Todos los demás casos conservan el modo legacy: Producción, otros hosts/builds, ausencia de opt-in, invitado y Master. Antes de cargar el perfil no se monta el shell; la solicitud Preview muestra carga o un resultado de acceso/error/vacío. «Panel anterior» desactiva el shell en la instancia actual sin recargar ni borrar los formularios del padre. Al recargar, la URL vuelve a determinar el opt-in; quitar el parámetro conserva el fallback legacy en visitas siguientes.

## Composición y conservación de estado

`MedicalDashboard.tsx` conserva la propiedad única de datos, formularios, carga, autoguardado, operaciones, confirmaciones y modales. `KawMedUnifiedShellFrame.tsx` recibe props de presentación y no usa API, almacenamiento ni permisos propios.

| Vista | Comportamiento |
| --- | --- |
| Inicio | Datos actuales del perfil, acciones existentes y requisitos de publicación. El progreso recomendado 5/5 y los tres requisitos obligatorios siguen separados, sin porcentajes inventados. |
| Perfil | Catálogo de identidad/especialidades, centros, horarios públicos por centro, seguros/excepciones y apariencia. Las secciones existentes permanecen montadas mientras el shell está activo; alternar navegación no recarga ni guarda. |
| Agenda | Explica la separación respecto de los horarios públicos y abre `/admin/medical/agenda` mediante la acción existente. No monta ni modifica AppointmentManager. |
| Más | Solicitudes médicas, instalación PWA, salida y controles existentes de ciclo de vida del doctor. No incorpora credenciales Free. |

Las salidas a Agenda, solicitudes y directorio de cuentas se bloquean en el shell cuando existe una operación pendiente o un borrador detectado. El aviso permite volver al formulario y guardar o cancelar su edición. Navegar entre las vistas no escribe, publica ni cambia cuenta. El autoguardado de especialidades adicional ya existente permanece intacto; su temporizador depende de la edición, no de una acción de navegación.

Ambos botones «Cerrar sesión» usan la misma protección solo con el shell activo. Si hay borradores u operaciones pendientes, una confirmación nativa exige autorizar expresamente el descarte local; cancelarla conserva la sesión y los formularios, sin llamar a logout. Confirmarla permite salir incluso si una operación tarda indefinidamente; el aviso aclara que las operaciones ya enviadas podrían completarse. Un estado limpio sale directamente. La implementación de logout, su endpoint y el flujo legacy (incluido «Panel anterior») no cambian.

La detección incluye `selectedDays`, comparado sin importar el orden con la selección inicial lunes–viernes o la preferencia reconocida al completar exitosamente el último lote de horarios. Cambiar solo los días, incluso limpiarlos sin escoger centro, cuenta como borrador. Restaurar esa selección cancela el cambio. Solo al terminar todos los POST exitosamente se actualiza la referencia de días; no se borran las preferencias conservadas por el editor ni se produce un falso bloqueo tras guardar. Un fallo parcial mantiene la referencia anterior, las solicitudes originales y el borrador restante; no se reintenta automáticamente ni se altera el manejo existente de errores/readback.

La publicación mantiene sus funciones y confirmación junto a los botones del encabezado. Los accesos «Completar» e «Ir a los datos del perfil» abren el módulo existente; «Revisar publicación» lleva al encabezado sin enviar la mutación. El modal PWA se compone fuera del encabezado ocultable para poder abrirse también desde Más.

El frame aplica navegación inferior móvil, lateral en tableta/escritorio, safe-area, foco visible, tipografía con fallback sans-serif y objetivos táctiles mínimos de 44 px. La cuadrícula de días de horarios se adapta al espacio disponible junto al lateral solo en el shell; legacy mantiene sus clases originales. No se oculta overflow global para disimular errores de diseño.

## Allowlist exacta

```text
app/src/components/admin/medical/MedicalDashboard.tsx
app/src/components/admin/medical/KawMedUnifiedShellFrame.tsx
app/src/components/admin/medical/kawmed-shell-navigation.ts
scripts/test-kawmed-shell-navigation-contract.mjs
docs/architecture/KAWVO_KAWMED_G3_LOT_1.md
```

Sin cambios en App.tsx, Free/Team, componentes compartidos, API, Web, Workers, D1/R2, OAuth, NFC/QR, SEO/GEO, configuración, workflows, dependencias, lockfiles ni migraciones. No se ejecutan runners de Preview/Producción.

## Validación local

Toolchain final: Node 20.20.2 y npm 10.8.2 ya disponibles, alineados con la versión mayor de CI. No se instalaron dependencias ni navegadores. Chromium del sistema se usa únicamente para pruebas locales.

Comandos de verificación del candidato (desde la raíz; no publican):

```bash
node scripts/test-kawmed-shell-navigation-contract.mjs --browser
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
node node_modules/typescript/bin/tsc --noEmit -p app/tsconfig.json
npm run build:preview -w app
npm run build -w app
git diff --check
```

El contrato nuevo compara 29 funciones originales de operación y todos los efectos con la base exacta. Para `addSchedule`, exige exactamente una nueva instrucción de reconocimiento de días después del bucle completo exitoso y comprueba que al retirar únicamente esa instrucción el cuerpo sea idéntico al original; no se permite cambiar escrituras, reset ni manejo de guardado parcial. Ejecuta el helper real y verifica restricciones de activación y detección de borradores/días. Su modo `--browser` necesita Playwright disponible y CSS App compilado; admite `KAWMED_TEST_BROWSER` para un Chromium instalado. Si faltan, falla como BLOCKED, sin descargar herramientas. `KAWMED_TEST_ARTIFACTS` es opcional para capturas en una carpeta de trabajo fuera del repositorio.

El navegador monta el MedicalDashboard real mediante React y esbuild, con CSS compilado. Todas las solicitudes se interceptan y responden en memoria. Verifica seis anchos (320/360/390/430/768/1280), las cinco secciones, objetivos táctiles, overflow, acceso al último control sobre la barra inferior, formularios persistentes, una sola carga del perfil, bloqueo de salidas, fallback, estados de acceso/error/vacío, foco, PWA, confirmación de publicación y URL de Agenda. No ejecuta autenticación, datos remotos ni operaciones D1/R2/OAuth reales.

Resultados consolidados sobre el contenido del candidato:

| Comprobación | Resultado |
| --- | --- |
| Contrato nuevo: activación, aislamiento, borradores y operaciones/efectos originales | PASS |
| Navegador: seis anchos y cinco secciones, targets 44 × 44, overflow y último control accesible sobre la barra inferior | PASS con fixtures |
| Navegador: formularios persistentes, bloqueo de salidas, fallback, requisitos/publicación, PWA/foco, estados y URL Agenda | PASS con fixtures |
| Corrección: ambos botones de logout, cancelación, descarte explícito, salida limpia y legacy/Panel anterior | PASS con fixtures |
| Corrección: operación retenida sin resolver, cancelación o salida explícita sin bloqueo indefinido y salida limpia tras completarse | PASS con fixtures |
| Corrección: días sin centro, restauración/cancelación, lote completo sin falso bloqueo y fallo parcial con días pendientes | PASS con fixtures |
| Contratos existentes Kawmed, invitaciones, MED/MEDM, multicuenta/cuenta activa y G2/G5.2 | PASS, 11/11 |
| TypeScript App, build App Preview y build App Producción exclusivamente local | PASS |
| Diff check e inventario exacto de los cinco archivos permitidos | PASS |

El SHA candidato se identifica en el commit local y en la entrega. Las pruebas comparativas requieren que esté disponible el objeto Git de la base indicada. Los warnings de Vite CJS, antigüedad de Browserslist y tamaño de chunk permanecen registrados sin cambiar dependencias ni umbrales.

## QA pendiente de Work y límites

- [ ] Verificar el SHA candidato y el origen efectivo de cualquier Preview automático aislado de esta rama, autorizado por el propietario junto con push y Draft PR. Las integraciones externas no se volvieron a auditar; no se autoriza despliegue manual, Stage ni Producción por esta corrección.
- [ ] Comparar con el prototipo aprobado y Free a 320/360/390/430, tableta y escritorio, incluyendo nombres/datos largos y listas reales.
- [ ] Login doctor y multicuenta, cambio de cuenta/pestaña obsoleta, respuestas 401/403/409 y ausencia de contaminación de perfil.
- [ ] Borrador incompleto/listo/publicado/inactivo; requisitos, confirmación y errores de publicación/despublicación, preservando ID y retorno.
- [ ] Especialidades principales/adicionales y autoguardado; centros, ubicación, horarios por centro y guardado parcial de días; seguros/excepciones y medios/apariencia.
- [ ] Mantener borradores al alternar vistas; bloqueo de salidas, días pendientes, cancelación/descarte al cerrar sesión en ambos botones, operaciones lentas y fallback Panel anterior en sesión real.
- [ ] Agenda existente: solicitudes, citas, disponibilidad, bloqueos y retorno actual. Deep links/retornos mejorados permanecen en G3.2.
- [ ] PWA y teclado físico/virtual, safe-area real, foco, lector de pantalla, errores de red y controles sin cubrir.
- [ ] Smoke legacy de invitado, copia demo y Master sin opt-in; regresión Free/Team y otras modalidades. Su adaptación queda en G3.3–G3.5.

QA autenticada Preview y comparación visual de aceptación: OPEN; requieren sesión/datos y acceso al entorno publicado no disponibles en las pruebas sintéticas. La CI 43915716316 fue SUCCESS sobre el candidato anterior `3f3d2e4ab43d553ef7758bd1ec1d58bfd4fa0cb8`, según la revisión técnica; no valida estas correcciones. La CI del nuevo SHA se comprobará tras actualizar el mismo Draft PR y se registrará en su handoff. QA productivo: no ejecutado ni autorizado. No se certifica el estado efectivo de Cloudflare.

## Corrección solicitada en PR #170

Orden: [revisión técnica, comentario 6923563395](https://github.com/pgcsoluciones/intap-link/pull/170#issuecomment-6923563395). Padre de la corrección: `3f3d2e4ab43d553ef7758bd1ec1d58bfd4fa0cb8`; se conserva la rama y la base original, sin integrar otras ramas. El nuevo SHA se identifica en Git y en la entrega del PR.

Se corrigieron exclusivamente la salida de sesión del shell y la detección de días pendientes. Se añadieron pruebas con confirmación aceptada/cancelada, estado limpio, fallback legacy, respuesta de guardado retenida sin timeout, restauración de días, lote completo y fallo parcial. Contrato nuevo (incluido navegador sintético), las 11 regresiones indicadas, TypeScript App y builds App Preview/Producción locales se ejecutaron sobre el contenido corregido; resultados en la tabla anterior. La allowlist total sigue siendo exactamente de cinco archivos y no cambian contratos #150/#151/#156, guards, infraestructura ni workflows.

La primera ejecución del navegador ampliado falló por el selector exacto de la etiqueta «Centro» del test nuevo: el nombre accesible del select incluye sus opciones. Se corrigió el selector para identificar el combobox de Centro, sin cambiar la UI ni reducir las aserciones, y la ejecución completa posterior terminó PASS. Los comandos no instalaron dependencias ni navegadores. Permanecen los warnings de build ya indicados.

## Rollback y handoff

Fallback inmediato de UI: «Panel anterior», conservando estado padre, o nueva visita sin `kawvo_med_shell=1`. Un build Producción no puede habilitar el shell.

No se ejecutó despliegue manual en este lote. Ante rechazo técnico, corregir el mismo Draft PR; cualquier reversión Git posterior debe preparar un cambio inverso revisable, sin reset destructivo. La autorización de Preview automático aislado no acredita su estado efectivo ni autoriza promociones. Un futuro release requerirá aprobación de SHA, origen/rollback inmutable y QA independientes conforme al contrato productivo.

Siguiente punto de control: revisión del nuevo SHA G3.1 y su CI por el director técnico. No avanzar de lote, fusionar ni desplegar manualmente; Producción sigue sin autorización.
