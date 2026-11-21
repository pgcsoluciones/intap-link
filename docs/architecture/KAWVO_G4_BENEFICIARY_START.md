# G4 — Inicio: beneficiario patrocinado

Base: `594113eeff8d6bd9cd39e572e953f7af7d2fba95` (PR #176). Rama local: `feat/kawvo-g4-beneficiary-unified`. El propietario confirmó las fases anteriores y solicitó iniciar G4. G3.3/G3.4/G3.5 se toman como confirmados por el propietario; esto no acredita cada prueba individual ni un release productivo.

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
