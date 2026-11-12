# KAWVO — CONTRATO MAESTRO DE REDISEÑO DE INTERFACES Y RUTA DE EJECUCIÓN
**Versión:** 1.0 · **Fecha de corte:** 2026-11-12 · **Estado:** plan aprobado como referencia de trabajo; NO equivale a despliegue ni a aprobación técnica de cada fase.

> **LECTURA OBLIGATORIA ANTES DE TRABAJAR EN LA UI DE KAWVO.**
> Misión principal: implementar progresivamente la interfaz administrativa unificada *mobile-first* para Kawlink Free, Kawlink pago, Kawmed profesional, patrocinado/beneficiario y Master/patrocinador, **respetando la demostración visual aprobada**. No sustituir esta misión por auditorías de dependencias ni iniciativas ajenas. No asumir que un prototipo o test estático equivale a funcionalidad autenticada.

## 0. Fuentes normativas y orden de precedencia

1. **Referencia visual aprobada por el usuario:** prototipo interactivo original de las cinco vistas, `https://qa-kawvo-shell-1112.intap-link.pages.dev/`; fuente versionada `prototypes/kawvo-mobile-shell-2026-11-12/index.html`, PR #151. Las cinco capturas aportadas el 12/11/2026 confirman el aspecto de Free, pago, Kawmed, patrocinado y Master. Este enlace es QA estático; **no es App autenticada**.
2. **Contrato de arquitectura previo:** `docs/architecture/KAWVO_MOBILE_FIRST_UNIFIED_SHELL_CONTRACT_2026-11-11.md`, PR #150. Sus cláusulas de seguridad C01–C07 y fases A–G siguen vigentes.
3. **Implementación opt-in Free:** PR #152, `feature/kawvo-unified-shell-free-preview-2026-11-12`; `/admin/free/shell-preview?kawvo_shell=1` sólo en dominio App Preview y modo Preview. El panel Free original sigue siendo el origen de verdad.
4. **Contrato de listados:** `docs/architecture/KAWVO_LARGE_LIST_SEARCH_FILTER_PAGINATION_CONTRACT_2026-11-12.md` e issue #153; aplicar filtros y paginación backend para inventarios y datos grandes.
5. **Esta hoja de ruta:** define *orden, gates, alcance, entregas y continuidad*. Ante conflicto funcional o visual, **no improvisar**: registrar divergencia, proponer solución concreta y esperar autorización; prevalecen siempre las restricciones de autorización y privacidad existentes.

**Nomenclatura:** matriz Kawvo; productos **Kawlink** (Free/de pago), **Kawmed**. “Patrocinado/beneficiario” y “Master/patrocinador” son experiencias/roles del ecosistema, no nuevas marcas. No renombrar productos ni inventar nuevas líneas durante este proyecto.

## 1. Invariantes — no negociables

- **Visual:** fondo gris pálido, tarjetas/superficies blancas, azul petróleo/turquesa como acento, bordes suaves, tipografía compacta y legible; en escritorio menú lateral izquierdo, encabezado superior y área principal; en móvil navegación inferior. No sustituir el estilo por otra plantilla ni cambiarlo sin aprobación.
- **Navegación:** Inicio / Perfil / Agenda / Más cuando aplique. Para **Master**, destino **Patrocinios** visible y diferenciado (la demo muestra Inicio / Perfil / Patrocinios / Más); “Mi presentación” propia y “Gestión de patrocinio” nunca se mezclan. Una pestaña sin permiso no aparece; no “simular” capacidades no existentes en el producto real.
- **Responsive:** diseñar y probar 320, 360, 390 y 430 px primero, luego tableta y escritorio; sin desplazamiento horizontal global, sin controles tapados por menú/teclado/safe-area; objetivos táctiles >=44 px; texto legible (base 14–16 px como guía contractual anterior).
- **Aplicación privada solamente.** No modificar Web pública, endpoints, Worker, D1/R2, NFC/QR, dominio canónico, perfiles /m/, /p/, /l/ ni los vínculos y tarjetas. Sin ampliar cookies, scopes, permisos, APIs ni rutas mediante el shell.
- **No regresiones:** FreeDashboard, onboarding, publicaciones, estados, guardado y confirmación; Link pagado editor avanzado; Kawmed especialidades/centros/horarios/seguros/Agenda; beneficiarios; Master; Team; Multicuenta; activación; credenciales, recuperación, PWA, media y notificaciones. Cada pantalla nueva COMPOSICIONA o enlaza módulos existentes, no reimplementa sus reglas.
- **Aislamiento:** sólo la cuenta activa, tenant, kind+id, plan, doctor/sponsor_master, perfil patrocinado y delegaciones autorizadas. UI oculta lo no disponible, guard de ruta y API siguen imponiendo permisos.
- **Entrega:** GitHub rama/PR por fase, diff mínimo, builds/regresiones, QA autenticada y capturas, rollback documentado; Preview primero. Sin merges a main ni producción sin autorización explícita. No ejecutar un `wrangler deploy` del Worker Preview usando orígenes persistidos obsoletos.

## 2. Mapa de experiencia aprobado (pantallas que debemos preservar)

| Área | Inicio | Perfil | Destino adicional | Más |
|---|---|---|---|---|
| **Kawlink Free** | Perfil, estado, progreso, siguiente paso, editar/vista previa/compartir | Identidad, foto/portada, contacto, enlaces, ubicación, portafolio, diseño | Agenda *sólo si habilitada* | Cuenta, credenciales, notificaciones, herramientas elegibles, planes, soporte |
| **Kawlink pago** | Presentación publicada/borrador, acceso a editar, vista previa y herramientas plan | Editor de pago completo: catálogo/productos, bloques, multimedia, links, FAQ, plantillas, apariencia | Agenda *si plan/cuenta dispone* | Cuenta, ajustes, soporte |
| **Kawmed profesional** | Estado, perfil médico, tareas de centros/horarios y citas | Identidad, especialidades, centros, horarios por centro, seguros, multimedia, diseño | Agenda médica de citas y solicitudes conforme a scope | Cuenta, avisos, PWA, suspensión y eliminación protegida |
| **Beneficiario patrocinado** | Perfil patrocinado, estado, faltantes, siguiente acción | Contenido y medios autorizados; cotizar/agendar si habilitado | Agenda *si permisos del perfil* | Recursos de patrocinio permitidos, cuenta, soporte |
| **Master / patrocinador** | Panel de actividad comercial: total/disponibles/por activar/activados, accesos y pendientes | **Mi presentación Master** independiente | **Patrocinios**: dispositivos M/P/L, búsqueda/filtros, responsables, visitadores, beneficiarios, estaciones y asignaciones | Identidad comercial, credenciales, ajustes, soporte; Agenda Master sólo en ruta/scope vigente |
| **Invitado/colaborador** | Resumen limitado al rol delegado | Editor del perfil asignado y permitido | Sólo módulos autorizados | Configuración delegada; nunca privilegios del dueño |

**Estados de UI a probar por rol**: primer acceso/onboarding, borrador incompleto, listo para publicar, publicado, suspendido, cuenta activa distinta, colaborador limitado, ausencia de Agenda, listas vacías, error de red, carga y formulario con cambios sin guardar. Estado mostrado debe derivarse del servidor, no de porcentajes inventados.

**Diseño Master de referencia:** el usuario aprobó explícitamente la vista desktop con estadísticas de dispositivos (Total / Disponibles / Por activar / Activados), cuatro accesos (Patrocinios, Asignaciones, Mi presentación, Agenda Master), lista de atención del día y navegación lateral Inicio/Perfil/Patrocinios/Más. La demo usa datos ficticios; no codificar esos contadores como constantes en producción.

## 3. Ruta ordenada de implementación (sin fechas artificiales)

| Gate | Fase / prioridad | Entrega verificable | Criterio de cierre |
|---|---|---|---|
| **G0** | **Congelar referencia y auditar estado (actual)** | Este contrato versionado, enlace demo aprobado, inventario de PRs/ramas y matriz por rol | Referencias verificadas, no confundir UI con datos reales |
| **G1** | **Free — QA local y autenticada (PR #152)** | Shell Inicio/Perfil/Agenda/Más, mismo aspecto demo, opt-in, rutas y módulos Free existentes | Tests + build + revisión móvil/desktop, usuario Free/Team/Multicuenta, borrador/publicación, retorno y cookies en `app.preview.intaprd.com`; no cambiar tráfico activo sin rollback |
| **G2** | **Free — consolidación** | Ajustes visuales mínimos tras QA; accesos reales, vacíos y errores, accesibilidad y navegación | Comparación de capturas con demo; publicación original intacta; autorización de promover fase |
| **G3** | **Kawmed profesional e invitado/Master** | Shell común ajustado a médico, centros/seguros/horarios/Agenda; separación scopes | Pruebas médico, invitado, Master; edición, publicación, estado y permisos; sin tocar Web pública |
| **G4** | **Patrocinado/beneficiario** | Shell de presentación y acciones permitidas, selector/reanudación correctos | Consentimiento, perfil seleccionado, guardado antes de publicar, cotizar/agendar, medios y delegación; sin escalada de rol |
| **G5** | **Master/patrocinador — prioridad funcional alta** | Panel operativo exactamente en línea con demo; Mi presentación independiente; listados y acciones existentes | Inventario y asignaciones autorizados, búsqueda/estado/paginación, invitado/vendedor/visitador no recibe facultades Master |
| **G6** | **Kawlink pago** | Shell con editor pagado y todas sus herramientas, sin redirigir a Free | Catálogo, productos, bloques, FAQ, multimedia, plantilla, medios, publicación y plan/rol |
| **G7** | **Sistema transversal de grandes listados (#153)** | Búsqueda, filtro, paginación **desde API** donde el volumen lo requiera | Scope tenant/rol validado en servidor, límites, órdenes deterministas, total/has_more, estados vacíos y rendimiento móvil; puede desglosarse por módulo después de G5 sin bloquear UI de listas pequeñas |
| **G8** | **QA cruzada y releases controlados** | Matriz completa por rol/dispositivo, evidencias de ramas/SHAs, plan y prueba de rollback | Aprobación explícita para cada release; nunca publicación masiva, ni main/Prod por implicación |

**Secuencia de trabajo inmediata:** G0 → G1 → G2. No saltar a un componente nuevo de Master sólo porque sea visible en la demo si Free no cerró QA. G3–G6 son integraciones independientes y pueden cambiar de orden únicamente con decisión registrada.

**Dependencia relevante para G1:** el PR #152 se encadena sobre #151 y #150 y no representa por sí solo una rama release reconciliada con avances recientes de la App. Antes de publicar, verificar cuál versión Pages sirve `app.preview.intaprd.com`, confrontar los archivos App frente a los cambios recientes, identificar origen actual, versión del Worker y rollback **sin** desplegar código backend antiguo. Si hay divergencia, STOP y plan de incorporación selectiva. Un test estático no resuelve eso.

## 4. Desglose práctico de cada entrega

Cada fase G1–G6 debe documentar **antes** de tocar código:
1. Rama base y SHA exacto, ámbito y allowlist de archivos; diferencia respecto al App Preview actual; carpeta/rutas afectadas.
2. Matriz de navegación de ese rol: tab → módulo existente → ruta real → guard/permisos → datos GET → acciones de escritura heredadas; rutas no existentes se omiten, nunca se inventan.
3. Prototipo de captura de referencia (móvil y desktop), estados reales a mostrar y decisiones visuales. Verificar que “Mi perfil” no lleva a “Mi cuenta”.
4. Composición de UI sin trasplantar flujos de negocio, sin hacer cambios en el API, sesiones, cookies, D1, Worker o publicación.
5. Pruebas de contrato existentes + TypeScript/build + permisos/aislamiento + manual en navegador **autenticado**; cuatro anchuras móviles y al menos una vista tableta y desktop.
6. Preflight del deployment activo, snapshot de versiones y origen, comprobación funcional post-release, criterio de reversión por fallo de login/ruta/sesión/guard/publicación y registro de SHA/evidencias.
7. Decisión de aceptación: **PASS / BLOCKED / OPEN** con evidencias, no “probado” basándose en HTTP 200 o un screenshot aislado.

**Definición de “DONE” por fase:** PR con diff revisable, sin funcionalidades aprobadas perdidas, capturas comparadas con demo, navegación probada en móvil, test del usuario propietario y del usuario limitado, lectura y escritura autorizadas, rollback preparado, autorización del usuario y release documentado (si se realizó). Si falta algo: “Preparado / QA pendiente”, nunca “implementado en Producción”.

## 5. Flujo de control anti-desviaciones (aplicar en TODOS los siguientes chats)

**Al comenzar cualquier tarea**, responder consultando este archivo y el contrato #150, y dejar registradas cinco piezas:
- **Misión actual** y **gate activo** (p. ej. G1, QA Free).
- **Qué está confirmado** por GitHub, qué proviene de capturas y qué falta de prueba real.
- **Único siguiente cambio** que contribuye directamente a ese gate.
- **Fuera de alcance** y controles protegidos.
- **Criterios PASS/BLOCKED**, rollback y próximo punto de control.

**Antes de crear o modificar código:** justificar explícitamente cómo el cambio mejora la interfaz aprobada; comparar con prototipo; comprobar rama, estado limpio, ref de GitHub y diffs; si no afecta el gate, registrar como *pendiente lateral* y continuar la misión. Para scripts nuevos, validar `bash -n`/sintaxis y pruebas locales ANTES de entregarlos al usuario. Evitar cadenas largas de comandos correctivos; máximo una tarea acotada por iteración.

**Durante la fase:** jamás declarar una prueba real autenticada a partir de fixtures, HTML estático, compilación o HTTP 200. No prometer ni ejecutar publicaciones diferidas ni cambios de Cloudflare sin preflight completo.

**Al terminar cada fase:** actualizar el registro de control (sección 7), registrar commit/PR, evidencias, rutas verificadas, riesgos y siguiente gate. Proponer cambios al contrato en un PR documental separado si hay acuerdos nuevos; no reescribir silenciosamente la referencia aprobada.

## 6. Pendientes laterales que NO deben secuestrar la misión

| Pendiente | Seguimiento | Relación con rediseño |
|---|---|---|
| Importación Excel Kawmed / SheetJS 0.20.3 | Issue #154 y PR #155; fixtures locales validados, **persistencia autenticada/duplicados/aislamiento pendientes** | QA aparte. Sólo bloquear release Kawmed si el cambio de dependencias es parte del artefacto o se toca importador |
| Seguridad runtime: Hono, React Router, Resend/Svix/UUID | Issue #120, auditoría separada | Remediar en ramas pequeñas con tests, sin `npm audit fix --force`; no reemplaza desarrollo de UI |
| Identificación física de estación patrocinada | PR #149 | Requerirá QA funcional; no alterar flujos NFC para dibujar dashboard |
| Búsqueda y paginación grandes listas | Issue #153 | Aplicar a Master cuando toque y por módulo, sin “paginación” sólo cliente de inventarios masivos |
| Problemas previos Multicuenta/Free | PRs específicos; contrato C01 | Bloquean únicamente si regresan en el gate que se está probando |

No interpretar “pendiente” como autorización para desplegar, fusionar o modificar credenciales/datos.

## 7. Registro de control vivo — corte inicial 2026-11-12

| Componente | Evidencia a la fecha | Estado |
|---|---|---|
| Arquitectura móvil | PR #150, doc C01–C07 | Documento creado; PR OPEN, no integrado |
| Demo 5 roles aprobada | PR #151; URL QA; capturas usuario del 12/11 | Referencia visual **APROBADA**; prototipo aislado, no producto |
| Free opt-in | PR #152, rama `feature/kawvo-unified-shell-free-preview-2026-11-12`, HEAD observado `142d26a5` | Código preparado; QA autenticada y reconciliación de Preview pendientes |
| App Free Pages QA aislada | Registro anterior de staging QA sin cambio del dominio activo | No asumir activa en `app.preview.intaprd.com` |
| Kawmed, patrocinado, Master, Link pago | Demostraciones conceptuales en #151 | Integración de shell **NO completada** |
| Motor listas masivas | Contrato #153 | API/paginación server-side pendiente por módulo |
| XLSX Kawmed | PR #155 con fix 0.20.3, fixtures locales PASS | Prueba de importación real sigue pendiente; separada |
| Releases | Ninguna nueva autorización productiva por este contrato | Prod intocada |

### Plantilla breve de bitácora por iteración

```text
Fecha:
Gate:
Rama / HEAD / PR:
Pantalla y rol:
Referencia aprobada (URL/captura):
Archivos modificados (allowlist):
Pruebas automáticas:
QA real (usuario/rol/dispositivo):
Resultados: PASS / BLOCKED / OPEN
Cambio en Preview: NO / SÍ (versión y rollback)
Cambio en Producción: NO / SÍ (autorización explícita)
Pendientes laterales (sin desviar misión):
Siguiente acción única:
```

## 8. Enlaces de consulta permanente

- Contrato preexistente: [Arquitectura unificada, PR #150](https://github.com/pgcsoluciones/intap-link/pull/150)
- [Prototipo aprobado, PR #151](https://github.com/pgcsoluciones/intap-link/pull/151)
- [Demo visual QA](https://qa-kawvo-shell-1112.intap-link.pages.dev/)
- [Free opt-in, PR #152](https://github.com/pgcsoluciones/intap-link/pull/152)
- [Issue #153, listados y paginación](https://github.com/pgcsoluciones/intap-link/issues/153)
- [Issue #154, Excel Kawmed](https://github.com/pgcsoluciones/intap-link/issues/154)
- [PR #155, parser SheetJS](https://github.com/pgcsoluciones/intap-link/pull/155)

**Última regla:** si otra tarea no aproxima el siguiente gate verificable de esta hoja de ruta, se aparca y se regresa a la interfaz. No perder funciones para ganar uniformidad visual. Nunca declarar un gate cerrado sin QA real y autorización.
