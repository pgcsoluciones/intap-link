# G4 — Beneficiario patrocinado · candidato para revisión

Base: `594113eeff8d6bd9cd39e572e953f7af7d2fba95` (PR #176). Rama local: `feat/kawvo-g4-beneficiary-unified`. El propietario confirmó las fases anteriores y solicitó iniciar G4. G3.3/G3.4/G3.5 se toman como confirmados por el propietario; esto no acredita cada prueba individual ni un release productivo.

> Las secciones iniciales conservan el registro del avance recuperado. El estado de esta continuación, sus pruebas y pendientes se detallan al final; no confundir los resultados históricos con los del candidato final.

## Objetivo y límites

Componer la administración del beneficiario en la interfaz móvil aprobada, conservando el editor y las operaciones actuales. Mantener selección y reanudación, consentimiento, cuenta activa y perfil autorizado; guardar antes de publicar y verificar el estado de ese mismo perfil. Cotizar, Agenda, medios y recursos de patrocinio solo donde correspondan a los permisos existentes. El ámbito es App privada; no cambiar API, Worker, Web, D1/R2, rutas públicas, autenticación, permisos ni migraciones. El módulo de Master comercial es G5.

Fuentes: contrato maestro #156 (gate G4), contrato C01–C07 #150, referencia visual #151, bitácora G3 y código de esta base. La numeración G4 de los lotes internos Free no es este gate maestro.

## Mapa de componentes y operaciones existentes

| Superficie | Código y ruta | Autoridad y acciones que preservar |
| --- | --- | --- |
| Acceso y reanudación | `SponsoredAccessEntry`, `SponsoredResumeGate`; `/admin/sponsored/entry` | Conservar marcadores, login y retorno al producto; no tratar un código como autorización. El escaneo Master tiene flujo separado. |
| Activación/consentimiento | `SponsoredActivation`; `/admin/sponsored/activate` | Aceptación explícita; claim existente con versión de consentimiento; respetar cuenta ya vinculada. |
| Selección | `SponsoredProfileSelector`; `/admin/sponsored/select` | GET de perfiles autorizados; redirección del único perfil o elección del usuario; conservar `profile_id`. |
| Perfil beneficiario | `SponsoredDashboard`; `/admin/sponsored` bajo `AdminGuard` | GET scoped, cabeceras de cuenta activa, estado real, PATCH de guardado y publicación existentes; la respuesta debe confirmar el mismo perfil. |
| Agenda | `SponsoredAppointments`; `/admin/sponsored/agenda` | Preservar `profile_id`, contexto y autorización del servidor; no inferir habilitación por presencia visual. |
| Cuentas y recursos | `SponsoredBankAccounts`, `SponsoredExperienceTools`, `commercial-links` | Preservar alcance, permisos y datos del patrocinador; no ampliar privilegios. |
| Master | `SponsorDashboard` usa `SponsoredDashboard mode="master"` | Mantener comportamiento Master aislado de la nueva experiencia beneficiario. |

## Criterios para la implementación

- Inicio y Perfil reutilizan el estado y formularios originales sin remontar el editor al navegar; Agenda solo se presenta de acuerdo con el acceso efectivo; Más compone recursos ya existentes.
- Activar la interfaz de forma acotada a Preview y rol beneficiario, con fallback legacy; no convertir parámetros de URL en permisos. El servidor sigue siendo autoridad.
- Proteger cambios sin guardar al salir, cambiar cuenta/perfil o navegar a una ruta externa; no alterar efectos, payloads ni reglas de publicación.
- Validar 320/360/390/430/768 y escritorio; foco, controles táctiles y ausencia de desbordamiento global. Cubrir selección, reanudación, consentimiento, errores, 401/403, cuentas ajenas, guardado/publicación, agenda y modo Master. Tests sintéticos no prueban datos o sesiones reales.
- Comparar con prototipo #151 y mantener cada funcionalidad existente, incluidos PWA, notificaciones y multimedia; documentar cualquier limitación.

## Estado y siguiente lote

Este archivo establece el mapa previo; **la interfaz G4 aún no está implementada**. El checkout padre estaba en `2e5bfcc5` aunque su rama se llama G3.4; se creó un worktree limpio desde el SHA exacto del PR para no perder el ajuste móvil aprobado. No se ha ejecutado merge, deploy, migración ni prueba autenticada. El PR #176 consultado permanece abierto y Draft; su descripción contiene un estado de QA anterior a la aceptación comunicada en el chat.

## Primer montaje local (incompleto)

Se inició una composición experimental en `SponsoredDashboard.tsx`, únicamente para beneficiario, host canónico App Preview, modo Preview y opt-in `kawvo_sponsored_shell=1`. El perfil debe haber sido cargado y, si existe `profile_id`, coincidir con el resultado. Inicio y Perfil conservan el editor montado; Panel anterior vuelve al contenido existente sin recargarlo. El modo Master no habilita el montaje. No se cambiaron llamadas ni payloads. Esto no es todavía el shell completo aprobado: faltan navegación y presentación completas, protección de borradores al salir hacia otras rutas, verificación funcional y comparación visual.

Validación local en Node 24.22.3 (no es el Node 20.20.2 usado en la Mac): TypeScript y build App Preview PASS; contratos de cuenta activa y multicuenta PASS. `test-sponsored-profile-contract.mjs` FAIL en «agenda solicita teléfono», el mismo fallo descrito en el PR #176 como reproducido previamente en la base; aquí no se repitió la comparación de base. No se ejecutó navegador ni QA real. `git diff --check` PASS para el archivo rastreado; esta bitácora es nueva y aún no está agregada a Git.

No está listo para revisión final ni promoción. Próximo trabajo: completar el shell y las protecciones, añadir pruebas funcionales y responsive, verificar la referencia visual y ejecutar regresiones pertinentes. No se cambian los permisos ni la API.

## Continuación local

Se añadió la pestaña Más con recursos autorizados ya devueltos por la API, soporte y selección de cuenta existente. Se agregó aviso de salida para cambios detectados, cargas y operaciones pendientes al abrir Agenda/cambiar de cuenta, además del aviso de recarga del navegador. Los cambios de campos, cargas, ubicación y paleta se registran para el gate Preview. No se considera una protección completa: faltan comprobar todas las acciones que modifican el formulario por botón, navegación externa, respuesta del servidor durante edición y el alcance de las rutas hermanas. Agenda aún no está integrada como pestaña propia y el layout desktop no está terminado.

Después de este cambio: build App Preview (incluye TypeScript) PASS y contratos de cuenta activa/multicuenta PASS en Node 24.22.3. Sin pruebas de navegador, QA autenticada ni pruebas nuevas de comportamiento; los resultados de compilación y contratos estáticos no acreditan el flujo completo. Trabajo sin commit ni publicación.

Se añadió después acceso a Agenda cuando la consulta indica que está habilitada, y se impidió que la respuesta de una recarga posterior a guardar sustituya cambios registrados durante el envío. TypeScript PASS tras estas últimas modificaciones; el build anterior no acredita esta versión posterior. Queda pendiente probar estas condiciones en navegador y cubrir las restantes acciones de edición por botón antes de afirmar que el guardado de borradores está protegido.

## Validaciones de continuación

Se cubrieron los cambios por botones de horario, galería y paleta, además de cargas y ubicación; una carga que termina durante el guardado incrementa la revisión. Se incorporó navegación inferior móvil/lateral escritorio y un gate separado con prueba de modo, host, Master, opt-in y coincidencia de perfil. El gate solo decide la interfaz; no autoriza datos. Las pruebas del gate y contratos de cuenta activa, multicuenta, aislamiento Kawmed e integración Intapcard/Kawmed pasaron. Build Preview local PASS con Node 24.22.3.

Los contratos `test-sponsored-profile-contract.mjs` y `test-free-contact-agenda-contract.mjs` fallaron respectivamente en «agenda solicita teléfono» y «barra del propietario muestra acceso a Configuración»; ambos fallos también se reprodujeron en el checkout base anterior `2e5bfcc5`, y sus scripts y archivos Web son idénticos entre esa base y `594113ee`. No se modificaron esos contratos.

Bloqueo de pruebas de navegador: al ejecutar Chromium/Playwright local, Chromium terminó con `socket() failed: Operation not permitted`; no se comprobó navegación real, responsive, comportamiento de guardado concurrente, consentimiento ni aislamiento mediante el componente ejecutado. Por ello G4 permanece OPEN; no preparar despliegue ni afirmar que la prueba de gate sustituye esas pruebas. La compilación local no certifica CI ni QA autenticada. No hay cambios de API, D1, R2, rutas o migraciones.

Continuación: se confirmó que sockets AF_INET están permitidos y AF_UNIX devuelve `Operation not permitted`, coherente con el fallo de Chromium. La despublicación con borrador y un fallo de publicación conservan el formulario local durante la recarga; la búsqueda de ubicación también registra un cambio. La decisión pura de sustituir o conservar el formulario se probó para revisión sin cambios, edición concurrente y conservación explícita. La prueba del gate ampliada y el build Preview local pasaron. La ejecución real del componente y su UI siguen sin verificar; ningún comando de promoción está preparado.

Continuación posterior: `SponsoredExperienceTools.tsx` también forma parte del lote, pues cerrar sesión y desvincular realizaban escrituras antes de la advertencia de salida. Esas dos acciones consultan un evento cancelable antes de llamar a la API; la protección solo registra el listener cuando el montaje Preview tiene cambios u operaciones pendientes. El editor anterior sigue registrando cambios cuando se vuelve a él desde el shell. La prueba del evento cubre aceptación y cancelación, y verifica que la consulta precede a ambas mutaciones. La prueba de gate, contratos de cuenta activa/multicuenta y build Preview (Node 24) pasaron. Siguen pendientes las pruebas de navegador y la revisión visual; sin ellas G4 no se considera listo para Stage.

Revisión del método U01–U09: se detectó que el retorno desde Agenda perdía el contexto del shell. `SponsoredAppointments.tsx` pasa a formar parte del lote: al volver conserva el perfil y opt-in exclusivamente en el host y modo Preview; el comportamiento Master y legacy permanece. El servidor sigue autorizando el perfil, pues el marcador solo determina presentación. La prueba pura incluye retorno Preview, producción, Master y el caso Master con perfil. Aún se requiere prueba del flujo real y revisión independiente antes del Draft listo para Stage.

## Recuperación y contrato del lote de continuación

Se recuperó por `git fetch` el commit `c8aeb4d0bbcd578923a97b918afd3f6cf7d82990`, padre exacto `594113eeff8d6bd9cd39e572e953f7af7d2fba95`. Se revisaron sus seis archivos completos y se creó la rama aislada `feat/kawvo-g4-beneficiary-unified` en un worktree nuevo. Main remoto observado: `6e6bfbb1bd60c91a94e92d36f6cfdd9f91e3d9e2`. Las confirmaciones G3.3/G3.4/G3.5 del propietario se conservan; no se reabren sus gates.

Misión: completar exclusivamente G4 App. Se leen #150, #156, #172 y U01–U09. La composición recuperada necesita Perfil y Agenda intermedios, retornos, protección de cambios en todas las salidas y pruebas del componente real. Abrir Agenda actualmente usa navegación de documento, y Mi cuenta ofrece destinos sin opt-in. La publicación concurrente y la recarga deben conservar las ediciones posteriores y verificar el mismo perfil. La recuperación no acredita QA real ni desplegada.

| Tab/superficie | Módulo/ruta reutilizada | Retorno y guard | Lecturas/acciones |
| --- | --- | --- | --- |
| Inicio | SponsoredDashboard `/admin/sponsored` | Perfil autorizado, host/build Preview, opt-in; fallback explícito separado | Mismos GET de perfil/Agenda, datos guardados y publicación explícita |
| Perfil | Presentación, contacto, ubicación/horarios públicos, galería, apariencia, acciones y bancos existentes | Índice funcional con búsqueda; módulo → índice con filtro, editor retenido | PATCH y cargas originales; mínimos guardados antes de publicar |
| Agenda | Índice con cinco accesos y AppointmentManager existente | Mismo profile_id, retorno explícito al índice; módulo protege sus cambios y no cambia cuenta | GET/operaciones actuales de citas, solicitudes, disponibilidad, bloqueos y motivos |
| Más/cuenta/PWA | Herramientas, credenciales y recursos existentes | Salida externa protegida antes de logout/desvincular; retorno interno no guarda | Sin nuevas operaciones ni privilegios Master |
| Entrada/selección/reanudación | SponsoredAccessEntry/Activation/ProfileSelector/ResumeGate y selector multicuenta | Propagar únicamente pistas UI; consentimiento, selección explícita kind+id y autorización originales | Payloads existentes sin cambios; ninguna activación por navegar |

Allowlist para terminar este lote (los archivos nuevos sólo contienen UI, navegación, pruebas o evidencia):
- `app/src/components/admin/sponsored/SponsoredDashboard.tsx`
- `app/src/components/admin/sponsored/SponsoredAppointments.tsx`
- `app/src/components/admin/sponsored/SponsoredExperienceTools.tsx`
- `app/src/components/admin/sponsored/sponsored-shell-gate.ts`
- `app/src/components/admin/sponsored/SponsoredUnifiedShell.tsx`
- `app/src/components/admin/sponsored/SponsoredProfileSelector.tsx`
- `app/src/components/admin/sponsored/SponsoredResumeGate.tsx`
- `app/src/components/admin/sponsored/SponsoredActivation.tsx`
- `app/src/components/admin/sponsored/SponsoredAccessEntry.tsx`
- `app/src/components/admin/sponsored/SponsoredBankAccounts.tsx`
- `app/src/components/admin/IntapcardAccountSelector.tsx`
- `scripts/test-sponsored-g4-shell-gate.mjs`
- `scripts/test-sponsored-g4-unified-contract.mjs`
- `scripts/lib/sponsored-g4-browser.mjs`
- Este handoff y capturas `docs/qa/KAWVO_G4/{home-320,profile-390,agenda-390,home-1280}.png`.

Se reutilizan KawvoProfileIdentity, KawvoReadyToPublish y el reducer de resumen Free sin modificarlos. No cambia AppointmentManager, AdminGuard, App.tsx, módulos médicos/Free, Web, API, dependencias, configuración ni runners. Permisos/roles, consentimiento y payloads se contrastarán con la base. QA con datos ficticios: seis tamaños, errores/permisos/vacíos, guardado concurrente, publicación, cambios pendientes, retorno y recarga, selección/reanudación y Master legacy. Tests TypeScript/build App Preview/Producción locales y contratos acumulativos pertinentes. Los fallos históricos se compararán contra la base exacta. Rollback: volver al SHA base del lote, sin datos/migraciones. No merge ni deploy.

Se incorpora `app/src/components/admin/sponsored/SponsoredGuidedTour.tsx` a la allowlist: el recorrido existente debe revelar el módulo montado antes de medirlo, pues ahora puede estar oculto por la pestaña. El ajuste sólo se activa al detectar el shell beneficiario y conserva sus pasos; no navega a legacy ni escribe datos.


## Resultado de la continuación

El editor mantiene la propiedad única de sus formularios. Inicio, Perfil y Más cambian la superficie sin remontarlos; Perfil tiene índice con búsqueda, ocho módulos existentes (bancos sólo tras comprobar acceso) y retorno que conserva filtro. Agenda dispone de índice con cinco accesos reales y resumen verificado del mismo perfil; reutiliza el reducer Free y AppointmentManager, sin copiar su lógica. Los módulos de Agenda usan su retorno explícito y protección nativa, mientras el formulario de perfil sigue montado. Durante un módulo de Agenda se vuelve por su botón contextual antes de cambiar cuenta/cerrar sesión, para reutilizar sus protecciones sin inspeccionar ni modificar el componente compartido.

La navegación se refleja en parámetros UI acotados (`sp_tab`, `sp_module`, `sp_section`, `sp_q`, `request`) y conserva `profile_id`. Los enlaces directos de Agenda/solicitudes se normalizan a la misma composición. Las entradas absolutas del propio host Preview también conservan el contexto; otros orígenes no reciben marcadores. Selector, activación y reanudación mantienen sus operaciones y consentimiento originales. Convertir la URL inicial sin ID explícito en la del mismo perfil ya cargado no recarga ni descarta el borrador. Otro ID requiere un contexto limpio y una nueva lectura autorizada.

El gate continúa exigiendo build Preview, host exacto App Preview, opt-in, modo beneficiario y respuesta del perfil coincidente. Una preferencia UI por perfil, guardada sólo tras abrir el shell autorizado, permite recuperar esa misma interfaz al retornar por el enlace público canónico sin marcador; no concede acceso ni selecciona cuentas. Master/otros hosts/Producción permanecen en su comportamiento anterior. El selector multicuenta sólo ofrece retorno tras revalidar el perfil por su API original; selección explícita kind+id y token nuevo se conservan, y otra cuenta descarta los módulos/filtros de origen.

Los campos, botones de horario/galería/apariencia, medios, geolocalización y bancos conservan sus borradores. Guardar el perfil no limpia un formulario bancario independiente. Una operación en curso bloquea la salida; logout/desvincular consultan la protección **antes** de cualquier POST. Una decisión explícita de descarte habilita la salida, pero no se guarda/publica/cambia cuenta al navegar. El guard de retroceso se registra antes de BrowserRouter, reutilizando el patrón de AppointmentManager para evitar desmontar el editor durante una salida cancelada. El onboarding guardado deja de considerarse un borrador pendiente después de verificar su respuesta.

El guardado usa una revisión local para no reemplazar ediciones posteriores con una respuesta atrasada; los envíos se serializan. Publicar conserva PATCH previo, POST y comprobación del estado persistido del mismo perfil. Si el formulario cambia durante el PATCH previo, no se envía el POST de publicación y se solicita nueva confirmación. Un error o una respuesta de otro perfil conserva el formulario y muestra fallo, sin declarar éxito. El error principal de publicación no se sustituye por un fallo secundario de recarga. La despublicación no guarda silenciosamente el borrador.

Se reutilizan el aviso KawvoReadyToPublish (mínimos guardados, Más tarde y CTA persistente por producto/rol/perfil), KawvoProfileIdentity, AppointmentManager, bancos, credenciales, PWA, soporte y recorrido originales. La confirmación de publicación es explícita. Los controles conservan foco y targets de 44px en las superficies probadas. El recorrido revela el módulo correspondiente y mide después su superficie visible; no deriva al panel anterior.

### U01–U09 y evidencia

| Regla | Evidencia específica |
| --- | --- |
| U01 | Navegación habitual, retorno público, entrada, recarga y enlaces de Agenda conservan shell; Panel anterior sólo explícito |
| U02 | Perfil con módulos/búsqueda; Agenda con solicitudes, confirmadas, disponibilidad, bloqueos y configuración reales |
| U03 | Filtro/módulo/solicitud/perfil conservados; retorno desde cuentas sin POST; selección explícita de otra cuenta limpia hints |
| U04 | Etiqueta genérica «Solicitudes de citas» para beneficiarios; denominación médica heredada sin cambios; horario público separado |
| U05 | Utilidades superiores adaptables, identidad y acciones separadas, menú inferior móvil/lateral desktop |
| U06 | Mínimos guardados, aviso y CTA persistentes, confirmación explícita; errores/mismatch sin falso éxito |
| U07 | Reutilización de módulos/codec y reducer Free, componentes compartidos y suite médica intactos |
| U08 | Borradores/operaciones/consentimiento/scopes/credenciales, salida nativa cancelada, fallback, no escrituras por navegación |
| U09 | Matriz anterior, fixtures de roles, seis tamaños, cuatro capturas y checklist real pendiente; no se declara aceptación G4 |

### Validaciones y comandos

- **PASS**: contrato nuevo estático/puro (`--scope`), allowlist exacta de **20 archivos**, codec de destinos cerrados, respuesta de perfil, aislamiento y comparación AST de las llamadas API/payloads/consentimiento originales. App.tsx, AdminGuard, cliente API, AppointmentManager, componentes compartidos, Free/médico, Web/API y aserciones históricas permanecen byte a byte frente a `594113ee` donde corresponde.
- **PASS: 11 grupos G4** en `/tmp/g4-review-browser.log`: seis anchuras, ocho módulos y sus retornos, Agenda intermedia/cinco secciones/deep link de solicitud/recarga, borradores entre pestañas/vista previa, publicación con error/mismatch/reintento, edición concurrente, salida nativa cancelada y cambio de profile_id rechazado, bancos independientes, selector/reanudación/primer borrador/consentimiento, 401/403/perfil equivocado/rol Master, cuenta activa/token, PWA/credenciales/recorrido y fallback. HTTP íntegramente interceptado con datos ficticios.
- **PASS: 80 regresiones heredadas**: 15 grupos G3.4 (`/tmp/g4-validation-final.log`) y 15 G3.3 + 29 G3.2 + 21 G3.1.1 (`/tmp/g4-cumulative-rest.log`). Las bibliotecas originales no se modificaron. Total por suites: **91 grupos/escenarios**; no confundir el total con una única ejecución combinada sin incidencias.
- **PASS 12/12 contratos** en `/tmp/g4-contracts-final.log`: gate G4 recuperado; Kawmed aislamiento/Preview/MED-MEDM/demo/live/claim; cuenta activa/multicuenta/integración Intapcard; regresiones G2/G5.
- **PASS**: App Preview y Producción locales, ambos con TypeScript, en Node **20.20.2** y dependencias existentes sin instalación/actualización. Logs `/tmp/g4-release-build-{production,preview}.log`. Los resultados Node 24 del registro inicial son históricos y no sustituyen esta validación.
- **FAIL históricos comprobados**: `test-sponsored-profile-contract.mjs:330` («agenda solicita teléfono») y `test-free-contact-agenda-contract.mjs:66` («barra del propietario muestra acceso a Configuración»). Los mismos fallos se ejecutaron sobre la base exacta `594113ee` en un worktree limpio y sobre el candidato; scripts y Web están sin cambios. No se relajaron ni se incluyen entre los doce contratos PASS.
- **Incidencia de reproducibilidad**: la primera ejecución acumulativa falló en la prueba G3.4 de identidad del programa B al leer `  B guardada  ` antes del valor normalizado esperado. El caso aislado pasó tanto en la base exacta como en G4; la repetición completa de los 15 grupos Master también pasó. Se conservan los logs `/tmp/g4-cumulative.log`, `/tmp/g4-base-master-flake.log` y `/tmp/g4-master-isolated.log`, sin alterar la prueba ni el módulo médico.
- **Prerequisito resuelto de fixtures**: después de completar G4 y G3.4, el intento combinado se detuvo por ausencia de `web/dist/assets` en este worktree nuevo. Se reutilizó el CSS Web ya existente de G3.4 y se reanudaron las 65 regresiones restantes; no se recompiló Web ni se cambió una aserción. La antigua limitación de Chromium/socket descrita en el WIP no se reprodujo en este entorno: el navegador instalado funciona sin modificar permisos.
- **PASS**: `git diff --check`; cuatro capturas sintéticas y autorrevisión visual móvil/escritorio contra la estructura/paleta de #151. Revisión visual independiente y QA real siguen pendientes.

Comandos del lote: `node scripts/test-sponsored-g4-shell-gate.mjs` y `node scripts/test-sponsored-g4-unified-contract.mjs --scope --browser`. La opción `--cumulative` ejecuta las bibliotecas históricas byte a byte; requieren CSS App y Web ya compilado, como en sus fases anteriores. Se reutilizó únicamente CSS Web del checkout G3.4 como fixture local ignorado por Git; **no se compiló ni modificó Web**. Para reanudar las suites pendientes tras esa preparación: `KAWMED_G33_ARTIFACTS=/tmp/g4-cumulative-final/g33 KAWMED_G32_ARTIFACTS=/tmp/g4-cumulative-final/g32 node --input-type=module -e "import{runG33Browser}from'./scripts/lib/kawmed-g3-3-browser.mjs';import{runG32Browser}from'./scripts/lib/kawmed-g3-2-browser.mjs';await runG33Browser();await runG32Browser()"`.

Builds locales: `npm run build -w app` y `npm run build:preview -w app`; ambos ejecutan TypeScript antes de Vite. Logs del candidato: `/tmp/g4-review-browser.log`, `/tmp/g4-validation-final.log`, `/tmp/g4-cumulative-rest.log`, `/tmp/g4-contracts-final.log`, `/tmp/g4-release-build-production.log`, `/tmp/g4-release-build-preview.log`. Evidencia de base: `/tmp/g4-base-historical.log` y `/tmp/g4-base-master-flake.log`. Las capturas de este lote son `docs/qa/KAWVO_G4/{home-320,profile-390,agenda-390,home-1280}.png`, con datos ficticios.

### Limitaciones y revisión pendiente

- QA autenticada real **OPEN/BLOCKED**: este entorno no dispone de las sesiones/perfiles autorizados ni de un despliegue G4. Los fixtures interceptan todo HTTP; no acreditan escritura D1, medios R2, correo, OAuth, consentimiento remoto, publicación pública o desvinculación real.
- Work debe probar beneficiario normal y multicuenta, cuenta activa y pestañas, selección/reanudación/primer borrador, consentimiento, módulos y medios reales, publicación/error/reintento, Agenda/deep links/solicitudes/guardado y reflejo público, bancos, PWA/credenciales, logout/desvincular cancelados y autorizados; únicamente perfiles y clientes de prueba. Incluir móvil físico/teclado/safe-area y comparación visual independiente con #151.
- Los formularios de credenciales originales se protegen de forma conservadora por interacción; no se inspeccionan secretos ni se sustituye su verificación. Las operaciones ya enviadas se resuelven por sus flujos originales.
- Los avisos de Vite CJS/Browserslist/chunks grandes permanecen sin cambiar herramientas ni dependencias. La deuda #134 continúa fuera del lote antes de un release API; no reabre las confirmaciones G3 del propietario.
- CI y Cloudflare se informan separadamente en el Draft PR por SHA. Un CI verde no certifica QA real, Stage, promoción ni Producción; no se ejecutan auditorías administrativas generales ni se alteran configuraciones.

### Rollback y punto de control

El fallback explícito «Panel anterior» conserva el editor en memoria. Para abrir deliberadamente legacy tras recargar: `/admin/sponsored?profile_id=<id>&kawvo_sponsored_shell=0`; el opt-out explícito no reactiva la preferencia UI. Para retirar completamente el código G4, revertir primero el commit final y después el avance recuperado `c8aeb4d0bbcd578923a97b918afd3f6cf7d82990`, regresando a la base `594113eeff8d6bd9cd39e572e953f7af7d2fba95`. No basta revertir sólo la continuación, pues quedaría el WIP. No hay rollback de datos ni migraciones. Cualquier recuperación de deployment requiere su autorización y evidencia aparte; no se prepara ni ejecuta un runner en G4.

Resultado: candidato para revisión independiente; aceptación G4 permanece **OPEN**. Sin merge, deploy, migración, modificación de main, infraestructura, API, Web pública ni datos reales. Siguiente acción única: revisión técnica del Draft PR y decisión de QA autenticada posterior.

## Correctivo de revisión #177 · Credenciales → Dispositivo

Base exacta: `0fe9e2b3620e68019fd1b9b9f62b536b50741526`, misma rama `feat/kawvo-g4-beneficiary-unified` y mismo Draft PR. Allowlist del correctivo: `SponsoredExperienceTools.tsx`, `scripts/lib/sponsored-g4-browser.mjs` y este handoff. Se mantienen los veinte archivos del lote acumulado, sin ampliar su ámbito.

Reproducción roja con el componente real y fixtures: abrir Mi cuenta, iniciar cambio de contraseña, escribir un código ficticio y pulsar Dispositivo no mostraba confirmación. La aserción `Device transition must ask before unmounting credentials` falló con `0 !== 1` antes de modificar el componente (`/tmp/g4-account-tab-before.log`).

Los dos botones de pestaña usan ahora un único selector. Si la pestaña actual es Credenciales, consulta `canLeaveCredentials()` **antes** de cambiar estado o desmontar FreeCredentials. Cancelar no cambia pestaña, formulario ni indicador de pendientes. Confirmar permite la transición original y limpia únicamente el indicador del formulario de credenciales descartado, evitando otra advertencia al entrar y salir de un formulario nuevo sin editar. Pulsar la pestaña ya seleccionada no descarta ni avisa. Legacy conserva su transición sin una nueva confirmación, porque se reutiliza el gate original de `canLeaveCredentials()`.

No se modifica FreeCredentials ni sus operaciones/validaciones. Tampoco las protecciones de perfil/bancos, logout/desvincular, endpoints, payloads, scopes o permisos. La transición interna no invoca una salida del editor ni guarda sus borradores.

Validación del correctivo:
- **PASS**: regresión específica roja antes y verde después; cancelar/confirmar en 320 y 1280 px, retorno a credenciales nuevas sin aviso residual, borradores de perfil y bancos intactos, sin mutaciones por cambiar pestaña. Legacy Preview con opt-out y build/host Producción simulado mantienen la transición sin aviso nuevo.
- **PASS: 12 grupos G4**, incluidos los once anteriores y el recorrido nuevo, con alcance acumulado exacto y componentes/guards reales bajo HTTP interceptado; log `/tmp/g4-account-tab-suite.log`.
- **PASS 6/6 contratos afectados**: gate G4, cuenta activa, multicuenta, integración Intapcard/Kawmed y regresiones G2/G5. Contrato estático/puro G4 PASS; FreeCredentials, perfiles/bancos y fuentes protegidas no se modifican.
- **PASS**: builds App Preview y Producción exclusivamente locales, ambos con TypeScript, Node 20.20.2 y dependencias existentes. Permanecen los avisos de Vite/chunks/Browserslist, sin cambios de herramientas/configuración.
- **PASS**: `git diff --check` y allowlist puntual de tres archivos. CI del nuevo SHA se registra en #177 separadamente; no se atribuye al correctivo el resultado de CI del padre.

Comandos: `SPONSORED_G4_CASE='account credentials to device' SPONSORED_G4_ARTIFACTS=/tmp/g4-account-tab-corrective node scripts/test-sponsored-g4-unified-contract.mjs --browser` (rojo antes, verde después); `SPONSORED_G4_ARTIFACTS=/tmp/g4-account-tab-suite node scripts/test-sponsored-g4-unified-contract.mjs --scope --browser`; `npm run build -w app`; `npm run build:preview -w app`; `git diff --check`. Logs: `/tmp/g4-account-tab-{before,after,suite,contracts,build-production,build-preview}.log`.

Las bibliotecas y fuentes Free/médicas protegidas no cambian; sus ochenta resultados anteriores corresponden al candidato base y no se presentan como una nueva ejecución. Se verifica todo G4 y las regresiones de cuenta activa/multicuenta/G2/G5 afectadas, conforme a #172. Los dos FAIL históricos ya comparados con la base permanecen documentados y fuera del correctivo, sin relajar pruebas. Las capturas versionadas anteriores se conservan; esta transición no cambia estilos.

QA autenticada continúa pendiente. Los códigos y perfiles del navegador son ficticios y todo HTTP está interceptado; no se enviaron credenciales reales. Work debe repetir cancelar/confirmar sobre un formulario autorizado antes de aceptar el correctivo. Rollback puntual: revertir únicamente su commit vuelve a `0fe9e2b3`, sin datos ni migraciones; retirar todo G4 requiere también los commits anteriores indicados arriba. No Stage, deploy, merge, migración ni cambio de infraestructura. Detenerse para revisión independiente.

## Correctivo móvil Kawmed en #177 · utilidades horizontales

Base del correctivo: `19fd703a4212e6d1d696a2ad4404215db30f7c7b`, misma rama `feat/kawvo-g4-beneficiary-unified`. El propietario solicita aplicar al médico la disposición horizontal ya aprobada para Master, conservando funciones/permisos. Este encargo autoriza una excepción visual acotada a la protección médica original de G4; no reabre G3.3/G3.4/G3.5 ni amplía los permisos del producto.

Allowlist puntual: `app/src/components/admin/medical/MedicalDashboard.tsx`, `scripts/lib/kawvo-g3-1-1-browser.mjs`, `scripts/test-sponsored-g4-unified-contract.mjs` y este handoff. La allowlist acumulada pasa de veinte a veintidós archivos, porque MedicalDashboard y la biblioteca de regresión heredada se incorporan al diff G4; no se añaden archivos nuevos.

El único cambio funcional es `mobileUtilitiesRow={isMaster}` → `mobileUtilitiesRow` en KawvoProfileIdentity. Se reutiliza el componente compartido sin modificarlo: utilidades médicas en una fila bajo la identidad en móvil, con el comportamiento responsive existente de escritorio. Master ya recibía true; Free conserva sus props y disposición. Los handlers de instalación/logout, confirmaciones de cambios pendientes, scopes, publicación y guards permanecen idénticos.

La regresión G3.1.1 comprueba dirección horizontal y flex-wrap en 320/360/390/430 px, misma línea cuando caben y salto seguro cuando no caben; conserva la disposición arriba/derecha en escritorio y la expectativa original de Free. Mantiene objetivos de 44 px, ausencia de overflow y las demás aserciones históricas. Primero falló con el código anterior en `Medical mobile utilities follow identity` (`/tmp/pr177-medical-row-before.log`). El contrato G4 permite exactamente la sustitución de esa prop y de esa expectativa visual; sigue comparando el resto completo de MedicalDashboard y de la biblioteca heredada contra la base. No se elimina una protección general para conseguir PASS.

Validaciones de este correctivo: builds App Preview y Producción locales (ambos incluyen TypeScript) PASS, Node 20.20.2; doce contratos afectados PASS. Logs `/tmp/pr177-medical-row-build-{preview,production}.log` y `/tmp/pr177-medical-row-contracts.log`. Los avisos históricos de Vite/Browserslist/chunks no cambian dependencias/configuración. La evidencia de navegador y el resultado CI del nuevo SHA se registran en la descripción del PR al completar esta entrega.

Navegador: **29 escenarios G3.2 + 21 G3.1.1 + 12 grupos G4 + un grupo responsive invitado G3.3 + un grupo responsive Master G3.4 PASS**. Los grupos responsive comprueban seis anchuras y sus variantes de rol; las bibliotecas G3.2/G3.3/G3.4 permanecen intactas. Se mantienen logout con cancelación de borrador, instalación/PWA, publicación, permisos, cuenta activa, retornos y Credenciales → Dispositivo. Contrato G4 `--scope` PASS con veintidós archivos acumulados; `git diff --check` PASS. Autorrevisión de capturas de 320/390/1280 px, sin overflow global.

La primera ejecución completó los 29 escenarios G3.2 y se detuvo en una aserción nueva demasiado estricta de línea única a 320 px: los botones necesitan 246,75 px y el contenedor dispone de 246 px. Se verificó el comportamiento aprobado `flex-direction: row; flex-wrap: wrap` del componente Master, conservando objetivos de 44 px. La regresión definitiva exige fila, una sola línea cuando caben y salto ordenado cuando no; no permite regresar a flex-col. A partir de esa comprobación se completaron las suites restantes en `/tmp/pr177-medical-row-browser-rest.log`, sin repetir G3.2 ni modificar más código funcional.

Las pruebas de navegador usan componentes, router y CSS reales con HTTP interceptado; no acreditan QA autenticada ni publican cambios. Capturas/evidencias de esta ejecución fuera de Git: `/tmp/pr177-medical-row/`; log `/tmp/pr177-medical-row-browser.log`. El Preview publicado anteriormente sigue correspondiendo a `19fd703a`; esta corrección no se despliega durante la tarea. G4 permanece OPEN.

Rollback puntual: revertir el commit de este correctivo restaura `19fd703a` y sus expectativas anteriores; no requiere datos ni migraciones. Sin Stage/deploy, merge, cambios de main, infraestructura ni API.

## Correctivo #177 · entrada G4 desde Multicuenta

Base exacta: `5caf3f0e26786dcb1448a447e3d287c24439b4db`; misma rama `feat/kawvo-g4-beneficiary-unified` y mismo Draft PR. Antes de editar: HEAD local/remoto coincidentes, árbol limpio y main remoto `6e6bfbb1bd60c91a94e92d36f6cfdd9f91e3d9e2`. Se conservan las aprobaciones G3 y los contratos #150, #156, #169, #172 y U01–U09.

Causa: `IntapcardAccountSelector.choose()` añadía el marcador G4 únicamente si existía `sponsoredReturn`, que se carga al llegar desde una interfaz G4 ya abierta y verificar su perfil. Una entrada inicial a `/admin/accounts` carece de ese contexto. El POST de selección devuelve la ruta canónica `/admin/sponsored` sin marcador; el Dashboard abría correctamente el fallback legacy, aunque el usuario hubiera seleccionado un beneficiario en App Preview. Reproducción roja con componentes/router/guard reales y HTTP interceptado: `Fresh Multicuenta selection must open G4 without a prior opt-in or stored preference`, `0 !== 1`, log `/tmp/pr177-accounts-before.log`.

Allowlist puntual de cinco archivos:
- `app/src/components/admin/IntapcardAccountSelector.tsx`: resolver destino tras la selección existente, conservando el POST `kind+id` y el token de pestaña.
- `app/src/components/admin/sponsored/sponsored-shell-gate.ts`: resolutor cerrado de selección para modo Preview y host exacto `app.preview.intaprd.com`.
- `scripts/test-sponsored-g4-shell-gate.mjs`: contrato del resolutor y destinos rechazados.
- `scripts/lib/sponsored-g4-browser.mjs`: tres grupos acumulativos para entrada, aislamiento y fallback; fixture de respuesta de selección configurable sin nuevas conexiones.
- Este handoff: causa, evidencia y recuperación.

El resolutor exige respuesta de selección con `kind=sponsored`, el mismo id elegido y la ruta relativa canónica de beneficiario. Rechaza ruta externa, destino Master, subrutas, fragmentos y `profile_id` discordante, incluidos parámetros duplicados con otra identidad. Solo entonces construye el destino G4 con el id elegido. `AdminGuard` sigue validando cuenta activa y token; `SponsoredDashboard` exige el perfil autorizado cargado y coincidente antes de renderizar la interfaz. Ningún parámetro UI autoriza ni selecciona otro perfil.

Se inspeccionaron también `SponsoredAccessEntry`, `SponsoredResumeGate` y `SponsoredProfileSelector`: conservan los marcadores de entrada/reanudación, el consentimiento y las rutas existentes. No requieren modificación para corregir esta pérdida inicial. El retorno al mismo perfil reutiliza únicamente la superficie de origen verificada; elegir otro empieza en Inicio sin arrastrar módulo/filtros del anterior. Recargar conserva id y contexto. «Panel anterior» sigue disponible, y `kawvo_sponsored_shell=0`/`sp_legacy=1` explícitos no fuerzan G4. Fuera del modo/host App Preview se mantiene exactamente el destino del servidor. Free, Doctor, invitado y Master conservan sus ramas de selección y retornos; no se cambian guards, endpoints, payloads, permisos, sesiones ni datos.

Validaciones del correctivo, Node 20.20.2 y herramientas/dependencias existentes:
- **PASS: 15 grupos G4**, incluidos los doce anteriores y los tres nuevos; entrada inicial sin preferencias previas, retorno sin mutaciones, selección del mismo/otro perfil, token, recarga, rutas/identidades discordantes, 403, perfil recibido discordante, enlaces antiguos y fallback explícito. Se conserva cancelar/confirmar Credenciales → Dispositivo, borradores de perfil/bancos, guardado concurrente y errores de publicación. Comando `SPONSORED_G4_ARTIFACTS=/tmp/pr177-accounts-suite node scripts/test-sponsored-g4-unified-contract.mjs --scope --browser`; log `/tmp/pr177-accounts-suite.log`. El scope acumulado de veintidós archivos y las fuentes/payloads protegidos pasan sin modificar sus aserciones.
- **PASS: 7 contratos**: gate G4, contrato estático/puro G4, cuenta activa, multicuenta, integración Intapcard/Kawmed y regresiones Free G2/G5. Log `/tmp/pr177-accounts-contracts.log`; ejecución: `for t in test-sponsored-g4-shell-gate test-sponsored-g4-unified-contract test-intapcard-active-account-contract test-intapcard-multiaccount-contract test-intapcard-kawmed-integrated-contract test-kawvo-free-g2-qa-corrections-2026-11-15 test-kawvo-g5-publication-navigation-2026-11-15; do node scripts/$t.mjs || exit; done`.
- **PASS: dos grupos heredados de navegador**, sin modificar sus bibliotecas: `KAWMED_G32_CASE='account explicit back'` con `runG32Browser()` y `KAWMED_G34_CASE='account return preserves'` con `runG34Browser()`. Conservan Doctor, Master, selección kind+id/token y retorno contextual sin escrituras. Log `/tmp/pr177-accounts-regressions.log`.
- **PASS: TypeScript y builds App Producción/Preview locales**, `npm run build -w app` y `npm run build:preview -w app`; logs `/tmp/pr177-accounts-build-{production,preview}.log`. Permanecen los avisos históricos de Vite/Browserslist/chunks, sin cambiar herramientas ni dependencias.
- **PASS: móvil 320/360/390/430 px, tableta 768 y escritorio 1280** en la suite G4; entrada Multicuenta nueva también en 320/1280, sin overflow global y objetivos de 44 px. Autorrevisión de capturas `/tmp/pr177-accounts-suite/multicuenta-selected-{320,1280}.png`, fuera de Git. No se sustituyen las capturas versionadas previas.
- **PASS: `git diff --check` y allowlist puntual exacta de cinco archivos**. Los dos FAIL históricos documentados anteriormente permanecen fuera del correctivo; sus fuentes/pruebas están protegidas e intactas. No se presentan como pruebas nuevas ni se debilita ninguna aserción para obtener PASS. CI se acredita separadamente por SHA en #177.

Rollback puntual: revertir únicamente el commit de este correctivo vuelve a `5caf3f0e`; no requiere migraciones ni recuperación de datos. Las pruebas de navegador son simuladas con HTTP interceptado, no QA autenticada ni validación de permisos en el backend remoto. El Preview ya publicado no se actualiza en esta tarea; QA autenticada y aceptación G4 permanecen OPEN. Sin Stage, deploy, merge, modificación de main, infraestructura, Web, API o datos reales. Detenerse para revisión independiente.
