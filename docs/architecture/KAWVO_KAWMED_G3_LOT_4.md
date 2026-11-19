# KAW-G3.4 — Kawmed Master · App

Base exacta: `2e5bfcc5d732d5d3bba3b970ce165a3ea5f7e5a8` (#175, abierto/Draft y no fusionado). Rama: `feat/kawmed-g3-4-master-unified-shell`. Main remoto observado: `6e6bfbb1bd60c91a94e92d36f6cfdd9f91e3d9e2`. El comentario #175/7001896018 registra aceptación funcional global de G3.3; no aporta resultados individuales de QA ni autoriza release. Esta orden autoriza implementación y Draft PR G3.4. Sin deploy, merge ni migraciones.

## Investigación y matriz previas a código

`/admin/sponsor/kawmed` monta SponsorKawMed bajo AdminGuard. Su estado comercial y funciones existentes son independientes del MedicalDashboard embebido con `scope="sponsor_master"`. La Agenda original es `/admin/medical/agenda?scope=sponsor_master`, también bajo AdminGuard. Para multicuenta, éste exige `kind=medical_master` y conserva token de pestaña; para miembros normales la API resuelve el patrocinador por la sesión/contexto existente. `ensureSponsorMasterProfile` exige owner/admin y resuelve el perfil Master de ese patrocinador. No se añaden permisos desde parámetros de UI.

| Pestaña / superficie | Módulo y ruta existentes | Guard / permisos | Lecturas y acciones heredadas | Retorno |
| --- | --- | --- | --- | --- |
| Inicio | SponsorKawMed + presentación MedicalDashboard, `/admin/sponsor/kawmed` | AdminGuard, overview autorizado, rol owner/admin y perfil Master cargado | GET `/sponsor/kawmed/overview`, `/sponsor/accounts`, `/me/intapcard/active-account`; GET médico scoped; estado y confirmación de publicación existentes. Estadísticas sólo de los códigos ya recibidos | Shell Master, sin escritura al navegar |
| Perfil · Mi presentación | MedicalDashboard `scope=sponsor_master`, misma ruta | Resolver Master original; perfil e identidad de patrocinador verificados | Identidad/especialidades, centros, horarios públicos, seguros, apariencia/media, publicación explícita: mismos endpoints con scope original | Perfil intermedio y módulo/filtro; distinto de identidad comercial |
| Agenda Master (acceso Inicio/Más) | KawMedAgendaOverview y MedicalAppointments/AppointmentManager en ruta original | Scope Master; sólo si GET de citas autorizado y mismo perfil | Solicitudes de citas médicas, confirmadas, disponibilidad, bloqueos y motivos, con scope conservado | Superficie intermedia de origen, módulo, perfil y patrocinador; recarga/contexto acotado |
| Patrocinios | Gestión existente `tab=codes` de SponsorKawMed | Membership y operaciones API originales | Códigos MED, lotes/asignación, visitadores/importación y filtros existentes; ninguna función comercial G5 nueva | Patrocinios / Más; estado y filtros retenidos |
| Más → identidad | Identidad de patrocinio `tab=identity` | Programas del mismo patrocinador | Logo/cintillo, CTA, visitador y vademécum, mismos PATCH/upload | Más; borradores retenidos entre pestañas, cambio de programa protegido |
| Más → credenciales | FreeCredentials **existente y sin cambios**, embebido `tab=account` | Sesión y verificación originales de la cuenta, no credenciales de otros perfiles | GET de estado y flujos originales de verificación/email/contraseña; no escribir al navegar | Callback contextual Más; componente retenido mientras se navega internamente |
| Más → cuenta / otras utilidades | Selector `/admin/accounts`, PWA y rutas actuales de patrocinio general cuando ya existan | Selección explícita kind+id; permisos/API intactos | Mismas operaciones existentes, proteger cambios antes de salir | Vuelta al mismo contexto si sigue siendo el mismo medical_master; otra cuenta descarta contexto ajeno |

El shell Master usa la familia visual #151 y navegación Inicio / Perfil / Patrocinios / Más. Agenda no se transforma en patrocinio y conserva su superficie propia bajo accesos autorizados. Se reutilizan Frame, identidad, listas, aviso listo para publicar, editor y Agenda. Formularios se mantienen montados; MedicalDashboard sigue siendo el único propietario de su estado y operaciones. SponsorKawMed mantiene sus propios formularios comerciales. Credenciales se montan al primer acceso y se conservan sin reimplementar su flujo.

Entrada canónica sólo en build Preview y host exacto `app.preview.intaprd.com`, tras cargar autorización Master; las URLs públicas Master existentes (`?tab=profile`, Agenda con scope) pueden volver al shell sin editar Web. `legacy=1` es fallback explícito; Producción y pages.dev mantienen legacy. Doctor e invitado conservan sus gates y codecs originales. URL/hints no seleccionan cuentas ni autorizan operaciones. Contexto Master ligado a patrocinador + perfil, scope y destinos cerrados; no destinos arbitrarios ni credenciales/tokens en query.

## Allowlist prevista y justificación

1. `app/src/components/admin/sponsored/SponsorKawMed.tsx`: composición y navegación Master, conservación del estado de los módulos existentes.
2. `app/src/components/admin/medical/MedicalDashboard.tsx`: host Master optativo y composición sin duplicar estado, formularios o funciones de escritura.
3. `app/src/components/admin/medical/KawMedUnifiedShellFrame.tsx`: navegación genérica del frame y modo de contenido embebido; defaults Doctor/demo intactos.
4. `app/src/components/admin/medical/kawmed-master-shell-navigation.ts`: hints puros y acotados Master, reutilizando codec médico.
5. `app/src/components/admin/medical/useKawMedShellReturn.ts`: revalidación de contexto Master sin cambiar guards/API.
6. `app/src/components/admin/medical/MedicalAppointments.tsx`: retorno Master, entrada canónica intermedia y scope original.
7. `app/src/components/admin/medical/KawMedAgendaOverview.tsx`: query scoped opcional, default Doctor intacto.
8. `app/src/components/admin/IntapcardAccountSelector.tsx`: sólo cálculo del retorno Master; selección y activación existentes intactas.
9. `scripts/test-kawmed-g3-4-master-shell-contract.mjs`: alcance, invariantes, contratos puros y ejecución acumulativa.
10. `scripts/lib/kawmed-g3-4-browser.mjs`: navegador sintético con componentes/guardas reales y API interceptada.
11. Este handoff.
12–17. `docs/qa/KAWMED_G3_4/`: `home-320.png`, `profile-390.png`, `sponsorship-390.png`, `identity-390.png`, `agenda-1280.png`, `home-1280.png`.

No se modifica App.tsx, AdminGuard, FreeCredentials, AppointmentManager, Web, API, Worker, D1/R2, OAuth, permisos, dependencias, lockfiles, workflows, configuración ni runners. Sin capacidades comerciales G5 nuevas, importador/dependencias ni reparación de #134. El inventario comercial grande y su paginación backend siguen pendientes de G5/G7; aquí se conserva el módulo y su tabla con scroll local sin ampliar límites o fingir paginación.

## Validación y punto de control

Contrato nuevo + regresión acumulativa G3.3/G3.2/G3.1.1; contratos Kawmed/MED/MEDM/invitados, multicuenta/cuenta activa, patrocinio y G2/G5 pertinentes. TypeScript App, builds Preview y Producción exclusivamente locales, git diff --check y allowlist exacta. Verificar los seis anchos 320/360/390/430/768/1280, 44×44, foco, safe-area, sin overflow global; guardado/publicación, borradores y navegación de todas las superficies. Fixtures no acreditan QA autenticada ni D1/R2 reales.

Pendientes externos: QA autenticada y comprobación del bundle servido requieren un release/Stage autorizado posterior, no se ejecutan aquí. #134 permanece fuera del lote y pendiente antes de un futuro release API. No reabrir auditorías generales de infraestructura. Revisión actual será autorrevisión; aceptación G3.4 OPEN hasta revisión independiente y QA real. Rollback: revertir exclusivamente el commit G3.4 devuelve el padre #175 exacto; sin datos ni migraciones que revertir.

Fuentes leídas: AGENTS v1 desde `50e74d81c61e3e18c85aec3af8505101f43cde93` (no existe AGENTS en el árbol aceptado), CLAUDE.md, reglas aplicables, contratos #150/#156, referencia #151, adenda #172, U01–U09 y handoff G3.3. La regla histórica de Codespaces se interpreta en el entorno Codex autorizado por esta orden; no implica deploy ni cambio de infraestructura. Main sigue separado del candidato.


### Entradas y fallback de Agenda

La entrada sin contexto `/admin/medical/agenda?scope=sponsor_master` conserva el módulo directo heredado de #174; no se transforma silenciosamente ni exige nuevas lecturas de patrocinio. Su retorno existente a `?tab=profile` sí llega a Perfil unificado en el dominio/build Preview autorizado. Los accesos desde el shell siempre adjuntan contexto acotado con `kawvo_med_shell=1`, perfil y patrocinador; una entrada copiada con ese opt-in puede pasar por la superficie intermedia antes de abrir una sección concreta. `legacy=1` se conserva tanto al entrar como al volver de Agenda. Así se mantienen las pruebas acumulativas de entrada legacy y no se altera Web ni su toolbar. El gate no se amplía a Doctor/invitados/Free.


## Resultados de validación y límites

- Contrato propio estático/puro de alcance, identidad, codec y invariantes **PASS**. Compara las funciones de escritura médicas/comerciales con la base y conserva los módulos/guards/clientes/credenciales compartidos y las suites históricas byte a byte.
- Navegador: **12 grupos Master PASS**, seguidos de **15 grupos G3.3 + 29 escenarios G3.2 + 21 G3.1.1 PASS**. Se ejecutan los archivos acumulativos originales, no copias con aserciones rebajadas. Incluye AdminGuard real, scopes Master, callbacks a Más, perfil/tenant incorrectos, owner/admin y visitante, guardados, error/reintento/publicación confirmada, selección explícita de cuenta propia/otra y retención del token nuevo.
- Móvil **320/360/390/430**, tableta **768** y escritorio **1280**: superficies y los cinco módulos médicos, 44×44, foco visible y sin overflow global **PASS**. La tabla comercial conserva scroll horizontal **local** y su módulo original; no se incorpora paginación G7 ni un modelo comercial G5.
- Once contratos existentes Kawmed, invitados/MED/MEDM, multicuenta/cuenta activa e integración y G2/G5 **11/11 PASS**.
- `test-sponsored-profile-contract.mjs`: **FAIL preexistente**, «agenda solicita teléfono», línea 330 (`Teléfono *` en el formulario público). Se reprodujo el mismo fallo en el checkout base exacto `2e5bfcc5`, sin modificarlo. El formulario público y ese test no forman parte del diff. No se corrige ni se oculta bajo el resultado de los once contratos anteriores.
- TypeScript App, build Preview y build Producción exclusivamente locales **PASS**; Vite conserva su aviso de chunks grandes. No se instalan ni actualizan herramientas/dependencias. CSS Web ya compilado de la base reutilizado en los fixtures acumulativos; Web no se reconstruye localmente para este lote.
- Seis capturas sintéticas versionadas de la allowlist: Inicio 320/1280, Perfil, Patrocinios e Identidad 390 y Agenda 1280. Se revisó visualmente la composición móvil; se conserva la familia de colores, bordes y tipografía del shell aprobado.

Comando acumulativo: `KAWMED_G33_ARTIFACTS=/tmp/g34-g33-evidence KAWMED_G32_ARTIFACTS=/tmp/g34-g32-evidence node scripts/test-kawmed-g3-4-master-shell-contract.mjs --scope --browser`, después del build Preview App. Las capturas nuevas Master se guardan en su directorio de evidencia; las de regresión van fuera del árbol y no modifican evidencias G3.3 anteriores. Comandos App: `npm exec -w app tsc -- --noEmit`, `npm run build -w app`, `npm run build:preview -w app`; alcance: `git diff --check` y contrato propio `--scope`.

Las pruebas de navegador usan componentes, router, guardas y CSS reales con HTTP totalmente interceptado. Los perfiles, programas, códigos y pacientes son ficticios. No se presentan como persistencia D1/R2, credenciales, correo, importación real o QA autenticada. No hay sesión de QA real ni bundle de este candidato publicado, por lo que **QA autenticada está OPEN/BLOCKED**, sin atribuirlo a una avería del servicio. G3.4 sigue OPEN para aceptación independiente.

La ruta Master scoped devuelve el perfil resuelto por el servidor; su DTO no repite sponsor_id. La relación perfil/patrocinador sigue bajo el resolver original y la sesión/token de cuenta activa, y se contrasta con overview/current_sponsor_id y el contexto acotado. No se inventa una asociación desde parámetros de UI. La QA multicuenta debe incluir cambio explícito de patrocinador, pestañas concurrentes y enlaces antiguos. Cualquier necesidad de ampliar metadata/guards API queda fuera de este lote.

Los cambios de credenciales se conservan manteniendo FreeCredentials montado. El wrapper registra sólo que hubo interacción (nunca valores secretos) y protege la salida externa con confirmación conservadora; no reimplementa ni inspecciona su estado interno de verificación. Navegación interna y retorno a Más no guardan ni publican. Cambiar programa con identidad pendiente requiere confirmación; cambiar cuenta/salir con borradores médicos o comerciales queda protegido. `Panel anterior` conserva el marcador legacy en el recorrido Agenda → Volver.

### QA autenticada pendiente para Work

- [ ] Verificar build/hash/host App Preview de un Stage autorizado posterior para el SHA revisado; no asumir que este candidato está servido.
- [ ] Owner/admin Master reales, cuenta medical_master kind+id, token de pestaña, otros patrocinadores y un rol limitado; errores, expiración de sesión y permisos.
- [ ] Mi presentación completa: identidad/especialidades, medios, centros/horarios públicos, seguros/excepciones, apariencia, borrador/publicación/despublicación y persistencia del mismo perfil.
- [ ] Agenda Master: intermedia, cinco módulos, solicitud directa, confirmadas/pendientes, cambios sin guardar, scope y retornos/recarga; no confundir disponibilidad con horarios públicos.
- [ ] Identidad comercial, programas, guardado, logo/cintillo y recursos; gestión de códigos/visitadores/asignaciones e importación por los flujos ya autorizados, sin pacientes reales.
- [ ] Credenciales propias con verificación real, PWA y cierre de sesión; conservación de borradores entre pestañas y cancelación de salida.
- [ ] Móvil físico/teclado/safe-area y desktop; comparación con #151 y revisión independiente. Doctor, invitado, Free y fallback legacy sin regresión.

No se auditó ni cambió Cloudflare en este lote. CI se informará por SHA en el Draft PR y no acredita despliegue o aceptación. #134 permanece pendiente antes de un futuro release API, conforme a la instrucción del propietario; no se vuelve a modificar ni a desplegar API para resolverlo durante G3.4. Siguiente acción única: revisión técnica del candidato y decisión de QA/Stage en una autorización posterior.
