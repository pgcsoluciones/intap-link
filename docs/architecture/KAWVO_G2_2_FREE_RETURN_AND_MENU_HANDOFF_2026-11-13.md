# Kawvo G2.2 — conservar contexto de edición y mostrar menú Free completo

**Fecha:** 13/11/2026. **Estado:** implementación en rama aislada; QA local/build y Preview autenticado pendientes.
**Base exacta:** `690c56d7fcab95f89e964844da5be8567065141c` del PR #159 G2.1, que el propietario probó y publicó con éxito en App Preview.
**Rama:** `feature/kawvo-g2-free-return-list-2026-11-13`.
**Fuentes:** contratos #150/#156; demo #151; QA del propietario (13/11) en PR #159.

## Decisión del propietario
QA de G2.1 **positiva** para las acciones solicitadas, con excepciones anotadas: algunas acciones «Volver a edición»/«Mi perfil» seguían mandando al panel original; «Volver al espacio Kawvo» llevaba a Inicio en vez de la sección de edición anterior; el menú Perfil mostraba 7 funciones en páginas 1/2; en Agenda falta el atajo L–V.

**No declarar PASS total de UX G2 ni cerrar QA de roles.** Este lote resuelve de forma acotada el **retorno de navegación** y la **lista de opciones**. La agenda L–V se mantiene como trabajo siguiente independiente, sin editar disponibilidad ni el API.

## 1. Flujo implementado
- El shell Free sigue restringido a `import.meta.env.MODE === 'preview'`, host exacto `app.preview.intaprd.com` y query `kawvo_shell=1` con `AdminGuard planScope=free`.
- Al abrir cada módulo existente desde Perfil/Más, se envía por `react-router location.state` únicamente la pestaña, identificador de perfil activo, búsqueda/filtro y elemento elegido. No se añade permiso, usuario, endpoint ni sesión.
- El validador `getKawvoShellReturn` comprueba esquema y límites de datos recibidos. El shell **solo restaura** contexto si el identificador coincide con la cuenta obtenida de nuevo de `/me`; cambios de cuenta o estado mal formado comienzan en Inicio.
- `FreeBackButton`, Agenda, Mi cuenta y Notificaciones retornan con ese contexto **solo** en App Preview y con marca explícita. De otro modo conservan rutas anteriores. Desde el Editor visual, los submódulos regresan primero a «edición», después al shell con la pestaña origen.
- En Perfil (7 módulos estáticos), `KawvoPagedList` usa `paginated={false}`: muestra todas las funciones con scroll vertical natural, sin botón Siguiente/Anterior ni página 1/2. Al volver se rehidratan búsqueda y filtro; la última fila abierta se centra automáticamente. «Más» y otros consumidores conservan su comportamiento original.
- El propio `FreeDashboard`, acciones de publicación, guards, componentes médicos/sponsor, cookies/OAuth y API se mantienen **sin cambios**.

## 2. Archivos permitidos de este lote
App Free: `KawvoFreeShellPreview.tsx`, `KawvoShellReturn.ts` (nuevo), `FreePanelUi.tsx`, `FreeVisualEditor.tsx`, `FreeAppointments.tsx`, `FreeAccount.tsx`, `FreeNotifications.tsx`; componente compartido de listas pequeñas `KawvoPagedList.tsx`.
Pruebas/bitácora: adaptación a contrato G2.1 para la nueva estructura de retorno, test nuevo G2.2, runner QA local G2.2, este documento.

No `api/`, `web/`, `app/src/App.tsx`, `AdminGuard`, `FreeDashboard`, `AppointmentManager`, `package*.json`, configuraciones de Cloudflare, funciones de publicación ni Prod.

## 3. Pruebas
Automatizadas: G1 opt-in, G1 desktop/móvil, aislamiento Multicuenta, G2.1 contratos de compartir/publicar/volver, G2.2 contexto, `npm ci`, `npm run app:build:preview`, diff/allowlist/branch exactos, árbol limpio. Los tests de G2.1 se adaptan al nuevo **validador** de estado, sin eliminar controles existentes.

QA real tras **futuro** Pages App Preview (no despliegue en este lote):
1. Inicio → Editar perfil → Perfil → filtro «Contenido» / búsqueda → Enlaces → Volver: reaparece **Perfil**, filtro y fila Enlaces. Desplazarse y abrir Portafolio sin página 2.
2. Perfil → Diseño → módulo secundario → «Regresar a edición» (vuelve al Editor) → «Volver al espacio Kawvo» (vuelve a Perfil).
3. Más → Mi cuenta → Volver: vuelve a **Más**; Notificaciones → Volver: a Más; Mi cuenta → Notificaciones → Volver: a Mi cuenta → Más.
4. Agenda → Abrir → Volver: pestaña **Agenda**; si la Agenda no está habilitada no debe inventarse.
5. Usuario Free borrador/publicado, Team limitado, cambio de cuenta, móvil 320/360/390/430 y escritorio. Confirmar que usuarios sin marcador siguen el retorno original.
6. Guardados internos que todavía llaman por diseño a `navigate('/admin/free')` pueden seguir llevando al panel anterior: registrar **módulo/ruta exactos** para un lote posterior, no aplicar redirecciones globales inseguras.

## 4. Seguridad, reversión y estado
- Este PR se apila sobre #159, sin merge a `main` ni despliegue Prod.
- Runner local: `scripts/run-kawvo-g2-free-return-list-local-qa-2026-11-13.sh`, ejecuta solo pruebas y compila; **sin Cloudflare**.
- Los snapshots actuales de G2.1 en App Preview permanecen intactos hasta que se diseñe un runner **App Pages-only** nuevo con el alias real y el bundle previo verificado; nunca reutilizar el runner G2.1 de hash fijo para un build nuevo.
- No ejecutar `wrangler deploy` ni reconfigurar `APP_PAGES_ORIGIN`; el riesgo conocido afecta servicios médicos/sponsor.
- Si una prueba falla: STOP, mantener G2.1 operativo. Si más adelante se despliega Pages, retener referencia al artefacto inmutable para poder reconstruir/republicar el estado anterior.

**Pendiente lateral:** «Lunes a viernes» existía como horario descriptivo en `FreeExperienceSettings.tsx`, pero el módulo operativo `AppointmentManager.tsx` modela `weekday:number` y muestra días aislados; no copiar valores de texto al API. Diseñar un atajo L–V que expanda cinco días y valide solapamientos tras resolver el retorno de G2.2.
