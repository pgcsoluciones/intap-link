# BITÁCORA MAESTRA DE HANDOFF · Kawvo Link / Intap · patrocinio, NFC, despliegue productivo y regresiones
**Corte:** 29 de octubre de 2026. **Alcance:** conversación completa de esta etapa, desde la trazabilidad y los cambios comerciales de patrocinados (28/oct) hasta la auditoría forense y correcciones iniciadas (29/oct). **Destinatario:** siguiente programador/agente técnico. **Prioridad siguiente:** P0, corrección integral de regresiones de publicación, vista previa y multicuenta en Free, patrocinados y KawMed.
**Estado crítico:** hubo despliegue EFECTIVO a Producción del commit `0994d9e5` el 29/oct; los cambios posteriores en la rama **NO deben darse por desplegados**. No reejecutar el runner de Producción a ciegas. No fusionar el PR sin nueva aprobación.

## 0. Identificación y reglas de operación

- Proyecto: Kawvo Link (antes Intap Link); empresa madre Kawvo, perfiles Link/Free, patrocinados y KawMed.
- Repo privado GitHub: `pgcsoluciones/intap-link`; remoto local `github`.
- Working copy en iMac: `$HOME/Desktop/intap-link-universal-bilingual-audit`.
- Rama de trabajo: `feature/kawvo-sponsor-commercial-controls-2026-10-27`; PR **#126**, abierto y en borrador al consultar el 29/oct. No se hizo merge a `main`.
- Verificar la última SHA antes de actuar: en la auditoría de este handoff el PR apuntaba a `946d7d1230ef81f4d3494b102ae687f4057096c8` y había **99 commits por delante de main**; esos datos pueden cambiar.
- **Arquitectura canónica de Producción** (`docs/CLOUDFLARE_PAGES_ARCHITECTURE.md`): web pública `web/` → Pages `intap-link` → `https://intaprd.com`; app/panel `app/` → Pages `intap-web2` → `https://app.intaprd.com`; API `api/` → Worker `intap-api`, rutas `intaprd.com/api/*`, `app.intaprd.com/api/*`, custom domain `api.intaprd.com`.
- **Preview:** `intap-api-preview`, D1 `intap_db_preview`, R2 `intap-r2-preview`, dominios `app.preview.intaprd.com` y `preview.intaprd.com`. El runner de Preview implementado durante esta etapa desplegó temporalmente web y app en ramas del proyecto Pages `intap-web2` y el Worker Preview los sirvió como proxy. **Esto NO equivale al mapeo canónico de Producción**; el runner productivo sí usa proyectos separados.
- D1 Producción: `intap_db`, ID `3a2d724d-5938-4777-a63e-423bb41862c0`. AGENTS_DB: `intap_agents_db`. R2 prod: `intap-r2`. **Jamás confundir con Preview**: `intap_db_preview`, ID `e9f46214-623f-48da-af13-74198e12b222`.
- Regla fundamental: no renumerar códigos físicos impresos, ni hacer backfill a etiquetas antiguas; ninguna restauración D1 indiscriminada que borre cambios recientes de clientes; no alterar la separación de dominios ni confundir roles master, beneficiario, Free y KawMed.

## 1. Cronología verificable: todo lo realizado

### 28/oct · patrocinio comercial, trazabilidad y correcciones visuales
1. Partíamos de funcionalidades comerciales ya preparadas en Preview: vendedores por empresa patrocinadora, importación Excel, asignación y reasignación de códigos/lotes, histórico y filtro por cliente. Un error en SQL de la tabla `Códigos, clientes y comercios` había impedido mostrar registros: se corrigió la unión a `artifact_display_identifiers`, commit histórico `fcbead70`. La captura posterior confirmó que los códigos reaparecieron en `Asignar por lote / cantidad`.
2. Requisito del usuario: visualizar el **teléfono del cliente patrocinado**, NO confundir con WhatsApp del vendedor ni con el identificador del llavero. Se transportaron `business_phone`, `business_whatsapp`, `email` desde la API/tabla principal al componente comercial, mostrándolos debajo del nombre del cliente en `Cliente o comercio`; se amplió la búsqueda. Commit `bdb57290`. Ejemplo visual: perfil `/p/manuel`; campo `Tel.` mostrado; email separado.
3. El usuario mostró redundancia de URL pública y tabla comprimida en dos columnas. Se eliminó URL larga repetida, conservando **un único enlace “Ver perfil”** en cliente/comercio y botón `Copiar enlace NFC` junto al `public_code`. Se sustituyó diseño comercial `xl:grid-cols-2` por secciones verticales a ancho completo; tablas con más anchura y mejor área de scroll. Archivos `SponsorDashboard.tsx`, `SponsorCommercialSellers.tsx`, `test-sponsor-commercial-contract.mjs`; commits `2731c783`, `bac2572f`, `075b4f8f`.
4. Preview 28/oct: usuario ejecutó script y envió salida. Tests y build OK, D1 backup, migraciones 0153/0154, Pages/Worker Preview. Deployment app `https://0c95e5b1.intap-web2.pages.dev`, web escaneo `https://b325db4f.intap-web2.pages.dev`; Worker versión `25d13db4-aaf1-407d-9769-db28b9bea69a`. Respaldo `~/intap-release-logs/sponsor-commercial-preview-20261028T183253Z/intap_db_preview_before_sponsor_commercial.sql`.

### 28–29/oct · preparación técnica para lanzamiento
5. El usuario pidió pasar a Producción. Se comparó rama contra `main` (84 commits en aquel momento), y se evidenció que CI era correcto pero sin revisión del PR. Se documentó inicialmente gate de aceptación y rollback; el criterio diferenciaba pruebas de contrato de pruebas reales de flujo.
6. Se creó `scripts/test-nfc-physical-identifier-release.mjs`: pruebas estáticas del alfabeto, 32.767 correlativos únicos por prefijo M/L/P, ejemplo `M0A1`/`L0A1`/`P0A1`, migración no destructiva y presencia de referencias en escaneo/trazabilidad. **Prueba de contrato/estática, NO demostración de concurrencia real ni prueba E2E autenticada**.
7. Se integró la prueba al runner de Preview `scripts/run-preview-sponsor-commercial-2026-10-27.sh`, junto a tests de sponsor, aislamiento, KawMed y Link. Se creó `docs/handoffs/KAWVO_RELEASE_GATE_SPONSOR_NFC_2026-10-28.md`: gate, casos funcionales, backup, orden de migraciones, rollback seguro, riesgo de asignación por MAX(sequence_number) concurrente. Commits `cb88c3ac`, `c977c469`, `3f5f7b7f`, `42d9703d`.
8. Preview 29/oct: usuario ejecutó scripts y reportó TODOS los tests y las compilaciones OK; respaldo `~/intap-release-logs/sponsor-commercial-preview-20261029T025634Z/intap_db_preview_before_sponsor_commercial.sql`. Web `https://c365b4d4.intap-web2.pages.dev`; app `https://c69f43cd.intap-web2.pages.dev`; Worker API Preview versión `7f816e74-e763-44fb-aa68-ae48c4a5f01a`. Migraciones Preview procesadas sin errores. Los avisos de Wrangler desactualizado y macOS 12.6 no bloquearon.
9. Se creó `scripts/audit-production-sponsor-release-readonly-2026-10-29.sh`: valida rama/config prod, corre tests y ejecuta consultas SELECT sobre sqlite_master y conteos en D1 prod, sin writes. Commits `831d8d17`, última referencia `779e3e64`. El primer intento de conectar tuvo timeout de refresh OAuth; el navegador completó login y las consultas terminaron correctamente. **Estado antes del release:** `intap_artifacts=440`, `sponsor_artifacts=30`, `medical_access_codes=8`. Tablas nuevas de 0153/0154 ausentes antes del release. Los 30 patrocinados podrían ser subconjunto de 440 artefactos; no sumar como total de productos distintos.
10. Se localizó mapeo canónico Pages (importante por incidente histórico web en proyecto equivocado); se creó el script `scripts/run-production-sponsor-nfc-release-2026-10-29.sh` con guard `KAWVO_RELEASE_PRODUCTION=APROBADO`, pruebas, builds prod, export D1, migraciones, Worker dry-run/deploy, web/app al proyecto propietario, comparación SHA256 de JS descargado por dominio, HTTP smoke y logs. Commits `912f7c5f` y `7b0eb2b2`.
11. **Error del primer intento productivo:** `APPROVED_BASE: unbound variable` en línea 15; ocurrió ANTES del backup y de cualquier modificación. Causa: se renombró la variable referida en el script pero no la declaración. Se corrigió definiendo `APPROVED_BASE` en `scripts/run-production-sponsor-nfc-release-2026-10-29.sh`, commit `0994d9e5`.
12. **Segundo intento productivo REAL del 29/oct:**
    - Tests y `tsc` + `vite build` web/app OK.
    - Backup **D1 PRODUCCIÓN** exportado a `/Users/juanluis/intap-release-logs/kawvo-production-20261029T050318Z/intap_db_before_release.sql`; archivo no vacío, contiene CREATE TABLE; verificación SHA256 generada en `backup.sha256`.
    - `0153` aplicada a `intap_db`: 6 queries, 12 rows written informados por Wrangler.
    - `0154` aplicada a `intap_db`: 3 queries, 11 rows written informados.
    - Worker `intap-api` publicado con versión `7708f331-a575-40eb-82a7-a491a5a25e22`, bindings D1 `intap_db`, AGENTS_DB y R2 prod.
    - Web prod proyecto `intap-link` deployment `https://a85441d9.intap-link.pages.dev`; App prod proyecto `intap-web2` deployment `https://7c8a5eab.intap-web2.pages.dev`.
    - SHA de bundle web servido desde `https://intaprd.com/assets/index-DLC-1pX1.js` coincidió con build local; SHA app `https://app.intaprd.com/assets/index-BQfvMZ-s.js` también coincidió. Ambas home/login HTTP 200.
    - Al final, chequeo `https://api.intaprd.com/` devolvió HTTP 503, con lo cual runner salió con error **DESPUÉS DE HABER PUBLICADO todo**. NO ejecutar de nuevo todo el runner: no es transaccional.
13. Diagnóstico posterior: se probaron `/api/v1/health` y dieron 404 porque **la ruta real es `/api/health`** (en `api/src/index.ts`). El usuario comprobó posteriormente **HTTP 200** y JSON `{"ok":true,"status":"healthy","environment":"production","worker":"intap-api",...}` desde:
    - `https://intaprd.com/api/health`
    - `https://app.intaprd.com/api/health`
    - `https://api.intaprd.com/api/health`.
    Esto confirma salud de las rutas de la API, no funcionamiento integral autenticado.
14. **Importante:** el release de Producción se hizo desde la feature branch con HEAD **`0994d9e5`**, NO hubo merge a main. La rama continuó recibiendo commits posteriormente. Conciliar PR/main antes de releases futuros; no asumir que una publicación desde main contiene los cambios de este lanzamiento.

### 29/oct · nuevas incidencias reales y auditoría forense
15. Captura del sponsor `DAPSA`: 5 llaveros comprados, 2 activos, 3 pendientes, 1 perfil publicado, 0 asignados, trazabilidad visible con ejemplos de clientes activos y pendientes. **Es evidencia visual del módulo, no una validación de los errores de multicuenta del usuario**.
16. Usuario reporta:
    - KawMed independiente sin popup/aviso de perfil listo para publicar.
    - KawMed no ofrece vista previa visible en modo borrador; botón `Vista previa` junto a `Cambiar cuenta` aparenta no funcionar.
    - Denominaciones deben decir `Centros de atención` y `Horarios de atención`.
    - Patrocinado muestra aviso de “requisitos completos” aunque faltan foto/portada (o datos que se perciben como necesarios).
    - Patrocinado multicuenta con requisitos listos no publica; tras publicar→despublicar vuelve a borrador y no permite republicar; barra de acciones ausente en sesión admin.
    - En patrocinado figura `Notificaciones · Próximamente`.
    - Free sin aviso proactivo “listo para publicar”.
    - Solicita auditoría forense de ramas aprobadas Preview, código realmente desplegado y posibles regresiones. Prohíbe asumir causas.
17. **Hallazgos CONFIRMADOS por inspección de código (no E2E autenticado)**:
    - `app/src/components/admin/sponsored/SponsoredDashboard.tsx` tiene dos checklists diferentes: `essentials` exige nombre, cargo/especialización, username, avatar, hero; `canPublishNow` usa username, business_name, specialization, what_we_do y phone/whatsapp. El backend `api/src/sponsored-profiles.ts` exige exactamente los segundos, **no obliga a foto/portada**. Se debe presentar “obligatorios” vs “recomendados” honestamente, sin decir que faltan obligatorios si es fotografía no requerida.
    - La navegación multicuenta del patrocinado depende de GET `/me/intapcard/active-account` y `active.kind==='sponsored'`; si falla, estado inicial false y `Cambiar cuenta` desaparece. El panel además distingue `isMaster` y beneficiario, y puede recibir `profile_id`. **Causa probable pero no probada** para la barra faltante.
    - `api/src/sponsored-profiles.ts` implementa POST `/api/v1/me/sponsored-profile/publish` y `/unpublish`, con estado `published`/`draft` y `missing[]` 422. El código simple no explica por sí solo la imposibilidad de republicar; hay que inspeccionar resolución de `sponsoredProfileScope(c)`, active account, cookies y respuesta real al POST. NO cambiar valores D1 manualmente para “arreglar” estados.
    - `app/src/components/admin/medical/MedicalDashboard.tsx` ya contenía `setPreviewOpen(true)` y vista privada de datos guardados, pero la insertaba hacia final del layout; por ello podría estar fuera del viewport. No se requiere publicar para activar la vista privada.
    - KawMed publica por ruta `/me/medical-profile/publication` con nombre, especialidad y slug obligatorios; “5/5” visual incluye recomendaciones, no es contrato mínimo.
    - Free `FreeDashboard.tsx` tenía botón de publicación y validaciones, pero no el popup proactivo.
    - `Notificaciones · Próximamente` era marcador de función futura en patrocinado (también documentado en bitácora 27/oct), no prueba de regresión de un módulo entregado.
    - No se ha completado reconciliación exhaustiva de **todas** las ramas históricas aprobadas. La comparación main→branch solamente muestra diff de rama, NO prueba que todos los hitos históricos estén presentes.
18. **Trabajo iniciado tras “dale” del usuario, exclusivamente en rama GitHub; NO desplegado a Preview/Producción en este chat**:
    - `app/src/components/admin/sponsored/SponsoredDashboard.tsx`: endurecimiento `canPublishNow` con `trim()` para campos; mensaje del popup distingue obligatorios guardados de foto/portada recomendadas; detección multicuenta incluye `selectedProfileId` explícito como fallback y dependencia en effect. Commit `edefc90d`. **Esto NO resuelve demostrado el fallo de republicación**.
    - `app/src/components/admin/medical/MedicalDashboard.tsx`: vista previa transformada en overlay `fixed inset-0 z-[90]`, abierta en borrador; aviso de listo para publicar si `publicationReadiness.canPublish`, con “Revisar publicación” y “Más tarde”, sin auto-publicación. Commit `6d10e5b1`. Pendiente QA foco/scroll/móvil y sincronización guardados.
    - Se observaron además nuevos cambios en la propia rama antes de cerrar la bitácora: `app/src/components/admin/free/FreeDashboard.tsx` ya contiene popup `Perfil Free listo para publicar` con `readyPromptDismissed`, botón publicar/más tarde; se añadió `scripts/test-kawvo-publication-regression-contract.mjs` con aserciones estáticas; SHA del PR consultado: `946d7d1230ef81f4d3494b102ae687f4057096c8`. **No se atribuye a estos dos cambios una comprobación E2E ni un despliegue, aunque estén en rama. Verificar git log para autoría/orden exacto**.
19. El usuario detuvo trabajo correctivo para solicitar **esta bitácora completa**, con instrucción explícita: dejar correcciones forenses como **próximo paso pendiente prioritario**. No confundir “se empezó la corrección” con “se concluyó y aprobó”.

## 2. Inventario de archivos creados/modificados en esta etapa

### API
- **CREADO** `api/migrations/0153_sponsor_sales_representatives.sql`: tablas comerciales, índices, FK.
- **CREADO** `api/migrations/0154_artifact_display_identifiers.sql`: identificadores físicos de cuatro caracteres; sin backfill.
- **CREADO** `api/src/sponsor-commercial-sales.ts`: auth de sponsor owner/admin, permiso commercial_seller/visitor, CRUD/import/export comercial, asignaciones y rastreo.
- **MODIFICADO** `api/src/index.ts`: generación normal Link con número físico, endpoints y/o integración; ruta health real `/api/health`.
- **MODIFICADO** `api/src/medical-access-codes.ts`: numeración física M y manejo de lotes KawMed.
- **MODIFICADO** `api/src/sponsored-code-generation.ts`: generación patrocinado con prefijo P y persistencia.
- **MODIFICADO** `api/src/sponsored-profiles.ts`: trazabilidad sponsor, joins, teléfono/WhatsApp/email cliente; rutas publicar y despublicar verificadas.
- **MODIFICADO** `api/src/scan-status.ts`: lectura de display_code en scan.
- **MODIFICADO** `api/src/sponsored-scan.ts`: números de patrocinio / scan.
- **MODIFICADO** `api/src/preview-free-entry.ts`: registro/import de rutas del módulo comercial.
- **DEPENDENCIAS CLAVE** no necesariamente modificadas en este tramo: `api/src/sponsored-profile-scope.ts` para resolver active profile con `profile_id`; `api/src/sponsored-multiprofile-access.ts`; `api/src/medical-profile-owner.ts` y `api/src/lib/cookies.ts`. Revisar antes de tocar permisos.

### Panel / App
- **MODIFICADO** `app/src/components/admin/SuperAdminSponsors.tsx`: controles maestros de patrocinio y recursos comerciales.
- **CREADO/MODIFICADO EN ETAPA** `app/src/components/admin/sponsored/SponsorCommercialSellers.tsx`: vendedores, Excel, lote/cantidad, búsqueda, selección, reasignación/histórico; UI de ancho completo y cliente contactable.
- **MODIFICADO** `app/src/components/admin/sponsored/SponsorDashboard.tsx`: códigos, clientes y comercios, display_code o “Anterior”, copiar NFC, `Ver perfil`, teléfono/email del cliente, unión y tabla.
- **MODIFICADO** `app/src/components/admin/sponsored/SponsoredDashboard.tsx`: avisos publicación, scope multicuenta, barra condicional, preview, botones.
- **MODIFICADO POST-PROD (NO DESPLEGADO)** `app/src/components/admin/medical/MedicalDashboard.tsx`: overlay vista previa y prompt de publicación; revisar textos de centros/horarios.
- **MODIFICADO POST-PROD (NO DESPLEGADO)** `app/src/components/admin/free/FreeDashboard.tsx`: popup publicar Free (verificar requisitos reales).
- **ARCHIVO DE CONTEXTO** `app/src/components/admin/IntapcardAccountSelector.tsx`: navegación/selección de cuenta; inspeccionar botón Vista previa en flujo multicuenta y credenciales administrativas.
- **CONTEXTOS ADICIONALES** `app/src/App.tsx`, `app/src/components/admin/medical/MedicalDashboard.tsx`, `app/src/components/admin/free/FreeNotificationBell.tsx`.

### Web pública
- **MODIFICADO** `web/src/components/ArtifactLinkResolver.tsx`: muestra display_code para artefactos nuevos pendientes de reclamar; conservar redirección de productos ya publicados.
- **CONTEXTOS** `web/src/components/medical-profile/KawMedProfile.tsx` (textos centros, vista pública), `web/src/components/PublicProfile...` según route; no asumir cambios aquí sin diff.

### Scripts, pruebas y documentación
- **CREADO** `scripts/test-nfc-physical-identifier-release.mjs`.
- **CREADO/MODIFICADO** `scripts/test-sponsor-commercial-contract.mjs`.
- **MODIFICADO** `scripts/test-intapcard-active-account-contract.mjs`.
- **CREADO POST-PROD** `scripts/test-kawvo-publication-regression-contract.mjs`, aserciones estáticas.
- **MODIFICADO** `scripts/run-preview-sponsor-commercial-2026-10-27.sh` (guard de archivos permitidos, pruebas, backup, migraciones, despliegue Preview).
- **CREADO** `scripts/audit-production-sponsor-release-readonly-2026-10-29.sh`.
- **CREADO** `scripts/run-production-sponsor-nfc-release-2026-10-29.sh` (ejecutado en producción; error variable corregido).
- **CREADO** `docs/handoffs/KAWVO_RELEASE_GATE_SPONSOR_NFC_2026-10-28.md`.
- **ESTE DOCUMENTO** `docs/handoffs/BITACORA_MAESTRA_CHAT_SPONSOR_PRODUCCION_REGRESIONES_2026-10-29.md`.
- **FUENTE TÉCNICA DE ARQUITECTURA** `docs/CLOUDFLARE_PAGES_ARCHITECTURE.md`.
- **BITÁCORA DE CONTEXTO** `docs/handoffs/BITACORA_MAESTRA_INTAP_KAWMED_MULTICUENTA_PATROCINIO_2026-10-27.md` (si el path exacto difiere, buscar por nombre).

## 3. Migraciones / esquema / modelo de datos

### 0153 · comercio patrocinador
Tabla `sponsor_sales_representatives`:
`id` PK, `sponsor_id` FK → sponsor_tenants, `employee_code`, `first_name`, `last_name`, `whatsapp`, `email`, `zone`, `territory`, `active`, `created_at`, `updated_at`. Índice por sponsor/active.
Tabla `sponsor_sales_assignments`:
`id`, `sponsor_id`, `artifact_id`, `representative_id`, `group_label`, `assigned_by_user_id`, `assigned_at`, `ended_at`, `active`. Índices por sponsor/artifact/active y sponsor/representative/active. Reasignación debe conservar historial (no borrar eventos anteriores).
Tabla `sponsor_commercial_resources`:
`sponsor_id` PK/FK, `resource_url`, `resource_label`, `updated_at`; recurso comercial privado elegido por SuperAdmin; no exposición pública por defecto.
Guard de acceso en API valida sesión auth, membership de sponsor owner/admin y concesión `sponsor_module_grants` para `commercial_seller` o `commercial_visitor`. Cada sponsor ve exclusivamente los suyos. Importación Excel y módulos comerciales fueron implementados sin mezclar con visitadores KawMed.

### 0154 · identificación física
`artifact_display_identifiers`:
`artifact_id` PK/FK a `intap_artifacts(id)`, `display_code` UNIQUE 4 chars, `product_line` IN ('M','L','P'), `sequence_number` entre 1 y 32767, `created_at`, UNIQUE(product_line,sequence_number), índice product_line/sequence_number.
`medical_display_identifiers`:
`medical_code_id` PK/FK a `medical_access_codes(id)`, `display_code` UNIQUE 4 chars empezando M, `sequence_number` UNIQUE 1..32767, `created_at`.
- Nueva línea Link `L0A1`, sponsor `P0A1`, KawMed `M0A1`, siguientes consecutivos. No reemplazar `public_code` largo, que sigue siendo clave NFC/URL. `display_code` corto es etiqueta física, NO teléfono y NO código de activación.
- Existencias antiguas NO tienen display_code. UI muestra **“Anterior”** y conserva numeración física impresa; nunca asignarles nueva etiqueta ficticia.
- Migrations aditivas ya aplicadas a D1 prod una vez. **NO volver a aplicar por automatismo sin inspección**. Un nuevo release de UI no debe obligar a recrear tablas.
- Riesgo abierto: generación usa `SELECT MAX(sequence_number)` y luego `INSERT`; constraint UNIQUE protege integridad pero solicitudes simultáneas pueden colisionar. Resolver con reserva de secuencia transaccional/serialización o retry seguro; no considerar cerrado por pruebas de unicidad puramente algorítmica.

## 4. Interfaces/paneles y criterios de aceptación

### Patrocinador master: Gestión de patrocinio
- Navegación: `Mi presentación`, `Identidad de patrocinio`, `Gestión de patrocinio`, `Credenciales`.
- Métricas: comprados, activos, pendientes, publicados, asignados.
- Tabla `Códigos, clientes y comercios`: código NFC largo, tipo (p. ej. `keychain`), estado, colaborador/sublote, nombre del cliente, teléfono/WhatsApp del **cliente**, correo, fecha activación, lote/zona; botón copiar código y copiar enlace NFC; **una sola acción `Ver perfil`** y NO volver a imprimir URLs bajo el nombre.
- Los registros pendientes muestran `Comercio pendiente de registrar`/perfil pendiente.
- Secciones comerciales en ancho completo, una debajo de otra: formulario vendedor, Excel importación/plantilla/listado; luego asignación con vendedor, lote, cantidad, búsqueda por llavero/código/cliente, seleccionar visibles, selección próximos sin asignar, revisión confirmada, histórico.
- Ejemplos comprobados en capturas: sponsor `Ferretería Beato`, perfil `/p/manuel`; vendedor Víctor. Sponsor `DAPSA`: datos citados más arriba. No repetir información personal/códigos de clientes innecesariamente en depuración.

### Beneficiario patrocinado y multicuenta — P0
- Confirmar `profile_id` exacto, `active.kind`, sesión/cookie/tab header y sponsor, en GET y POST.
- Si cuenta activa patrocinada, navbar privado debe mostrar `Editar perfil`, `Agenda`, `Cambiar cuenta`; `Notificaciones · Próximamente` es placeholder NO notificaciones listas. NO mostrar barra de un sponsor distinto; evitar privilegios cruzados.
- Diferenciar 5/5 de presentación recomendada del mínimo obligatorio API (username, nombre, especialización, descripción, contacto). Mostrar razones de bloqueo reales, sin falso popup de “listo”.
- Hacer prueba completa **draft→published→draft→published**, en sesión normal y con cuenta administradora multicuenta. Capturar GET/POST, status HTTP, `missing[]`, identidad, scope y persistencia. Nunca diagnosticar con un ejemplo de cuenta distinta.
- Comprobar que acciones de cambio de cuenta mantengan identidad seleccionada sin redirecciones a cuenta equivocada.

### KawMed — P0/P1
- Independiente vs sponsor master vs invitado demo vs multicuenta: verificar scopes separadamente.
- Vista previa PRIVADA, también draft, abrir modal visible inmediatamente (nuevo código de overlay todavía no desplegado). Debe permitir cerrar, enfocarse correctamente y no exponer datos a usuarios sin permiso.
- Popup proactivo si campos mínimos **guardados**: nombre profesional, especialidad y slug. Foto, centros y horarios como recomendaciones salvo política contractual distinta.
- Textos pedidos: **`Centros de atención`** y **`Horarios de atención`** consistentes en menú, panel, editor, preview y web. Confirmar cuáles quedaron efectivamente modificados; no marcar completado solo por verlos en un checklist.
- Corregir “Vista previa” junto a “Cambiar cuenta” en multicuenta y confirmar con QA que no hace falta estado publicado.
- Verificar `/me/medical-profile/publication` y permisos de scopes.

### Free — P1
- Popup proactivo de publicación cuando `effectivePublishReady`, no publicado, perfil real y no demo delegado; ofrecer `Publicar ahora`/`Más tarde` sin forzar publicación.
- Requisitos Free definidos en código: nombre, cargo, usuario, foto y portada, con matiz para miembros Team. La validación de backend prevalece; probar fotos starter y guardado.
- Confirmar que popup no reaparezca intrusivamente por recarga, cambio de tab o acciones; un recordatorio por entrada/cuenta según UX aprobada. Este comportamiento exacto no se validó.

## 5. Errores corregidos vs pendientes: no confundir

**Corregidos y desplegados en Producción en el release 0994d9e5:**
- Unión SQL faltante que vaciaba tabla de trazabilidad.
- Paso de datos de teléfono/WhatsApp/email del cliente al módulo comercial.
- Redundancia URL/perfil y layout de vendedor/asignación comprimido.
- Nuevas numeraciones físicas M/L/P para nuevas unidades; soporte tablas/scan.
- Error del runner shell `APPROVED_BASE unbound variable`.
- Mapeo correcto de Pages prod; web y panel bundle verificados.
- Diagnóstico falso: probar `/api/v1/health` en vez de la ruta real `/api/health`; health 200 en 3 dominios.

**Pendientes o parcialmente corregidos SOLO en rama NO desplegada:**
- Falta modal proactivo KawMed y Free en Producción (nuevo código en rama).
- Vista previa KawMed draft/no se ve (nuevo overlay, probar).
- Barra multicuenta patrocinado (fallback parcial, NO causa raíz cerrada).
- “Completos” patrocinado vs estado real y publicación fallida (mensaje/trim corregidos parcialmente, NO probada API).
- Ciclo publicar→despublicar→publicar patrocinado falla en caso reportado; **sigue P0**.
- Botón Vista previa en selector multicuenta; no confirmado cierre.
- Texto uniforme centros/horarios, notificaciones patrocinado (placeholder) y auditoría histórica completa; pendientes.
- Concurrencia de correlativos M/L/P; pendiente.
- Reconciliación PR #126 y main; pendiente.

## 6. Método correcto de trabajo para siguiente programador
1. Recuperar este documento y **todas** las bitácoras relevantes de `docs/handoffs/`, más `docs/CLOUDFLARE_PAGES_ARCHITECTURE.md`. Antes de modificar código ejecutar `git fetch github main <rama>`, comprobar `git status`, `git log`, comparar SHA de `main` y feature. Recordar que el prod desplegado fue `0994d9e5` pero HEAD feature ya avanzó.
2. Reproducir errores con una cuenta de QA y perfil adecuado, sin utilizar credenciales ni cookies de usuarios en logs públicos. Anotar request/response sanitizado, HTTP status, `active.kind`, `profile_id`, estado y datos mínimos **sin datos sensibles**. Limitar cambios a los componentes propios; no tocar otras líneas ni R2/D1 prod.
3. Revisar diferenciales exactos: `git diff 0994d9e5..HEAD -- app/src/components/admin/{free/FreeDashboard.tsx,medical/MedicalDashboard.tsx,sponsored/SponsoredDashboard.tsx}`; API scope `sponsored-profile-scope.ts`, route publish `sponsored-profiles.ts` y selección cuentas.
4. Priorizar arreglar causa raíz de republicación/ownership; incorporar tests E2E de ciclo de publicación y aislamiento multicuenta; complementar los contratos estáticos existentes.
5. Compilar y verificar: `node scripts/test-kawvo-publication-regression-contract.mjs`, `node scripts/test-sponsor-commercial-contract.mjs`, `node scripts/test-intapcard-active-account-contract.mjs`, `node scripts/test-intapcard-kawmed-integrated-contract.mjs`, `npx tsc --noEmit -p api/tsconfig.json`, `npm run build:preview -w app`, `npm run build:preview -w web`. Revisar otros tests específicos de medical/notifications según áreas tocadas. **Tests estáticos no equivalen a QA real**.
6. Crear PR o continuar PR #126 bajo control, usar Preview aislado y validar Free, sponsor normal/multicuenta, KawMed independiente/multicuenta/borrador. **Nunca utilizar el runner productivo del 29/oct para publicar solo un bugfix**; ese runner vuelve a ejecutar migraciones y podría afectar datos. Para hotfix, preparar procedimiento acotado con backup/guard y rutas canónicas, sin repetir 0153/0154.
7. Exigir evidencia de contrato de aceptación y capturas antes de Production; luego release explícito aprobado, checksum de bundles, smoke health real `/api/health`, prueba funcional de publicación, monitorización y rollback del Worker/Pages sin restaurar D1 indiscriminadamente.
8. Mantener bitácora incremental: SHA, autor, fecha, scripts usados, páginas/Workers version ID, DB changes, estado del PR y pendientes verificables.

## 7. Plan prioritario desde este handoff (mapa de ruta)

**P0 — PRÓXIMO PASO INMEDIATO, NO POSPONER: AUDITORÍA + CORRECCIÓN DE REGRESIONES MULTICUENTA/PUBLICACIÓN**
- [ ] Verificar si `946d7d12` o HEAD posterior contiene cambios desde `6d10e5b1` y qué tests pasaron; mirar CI actual.
- [ ] Reproducir patrocinado master/beneficiario y multicuenta con administrador: resolver cuenta/identidad, navegar y ciclo draft→publish→draft→publish. Corregir routing/scope/api/error; conservar aislamiento.
- [ ] Hacer que las barras privadas y botones Vista previa se vean y funcionen para perfil correcto, sin privilegios cruzados.
- [ ] QA overlay KawMed (draft y published) y popup con mínimos guardados.
- [ ] QA popup Free, límites de repetición y requisitos.
- [ ] Unificar textos centros/horarios; clasificar `Notificaciones · Próximamente` como backlog producto independiente.
- [ ] Preparar y correr E2E/contratos con evidencia, Preview, NO Prod; confirmar regresiones reales frente a versiones aprobadas.

**P1 — reconciliación**
- [ ] Inventario exhaustivo de PRs/ramas aprobadas Preview (consultar bitácoras, SHA de aprobación, deployments), matriz aprobado / presente en HEAD / desplegado prod / probado funcional. No asumir que la rama más nueva hereda todos los aprobados.
- [ ] Fusionar PR únicamente con control de diff y gobernanza de main, evitando revertir el deployment productivo.
- [ ] Resolver reserva concurrente de etiquetas físicas y logs transaccionales de asignación.
- [ ] Confirmar UX y entrega de notificaciones patrocinadas; definir alcance con producto.

**P2 — calidad preventiva**
- [ ] Suite E2E con identidades separadas y tests de publicación/despublicación/republicación.
- [ ] Mejorar guard prod: no verificar raíz `api.intaprd.com/` como salud obligatoria; usar `/api/health`. No repetir migraciones automáticamente.
- [ ] Evitar dependencia de Wrangler antiguo/macOS no soportado y warning de archivo `~/Desktop/wrangler.toml` fuera de repo; actualizar herramientas solo en cambio independiente probado.
- [ ] Comparar checksum bundle, rutas canónicas y logs de fallos desde la aplicación, más D1 row-counts seguros.

## 8. Evidencias y limitaciones epistemológicas
- Las bitácoras y logs de Terminal enviados por usuario sostienen backups/deploys/health de este tramo. El acceso a DB prod fue mediante terminal del usuario; el asistente **no leyó directamente registros privados individuales** ni autenticó un flujo completo de perfil patrocinado.
- Estado HTTP 200 de `/api/health` no prueba POST de publicación, permisos ni multiaccount.
- La captura DAPSA muestra panel comercial, no causa de publicación.
- Contratos `node` que analizan código por regex no son pruebas con tráfico real ni garantía de ausencia de regresiones.
- No se demostró que un rollback inmediato sea necesario; no ejecutarlo.
- El usuario pidió que el siguiente equipo no invente ni asuma causas: toda hipótesis va etiquetada y debe verificarse.

## 9. Checklist de arranque para próximo programador
```bash
cd "$HOME/Desktop/intap-link-universal-bilingual-audit" || exit 1
git fetch github main feature/kawvo-sponsor-commercial-controls-2026-10-27
git switch feature/kawvo-sponsor-commercial-controls-2026-10-27
git status --short
git log --oneline -12
git diff --name-status 0994d9e5..HEAD
node scripts/test-kawvo-publication-regression-contract.mjs
node scripts/test-sponsor-commercial-contract.mjs
node scripts/test-intapcard-active-account-contract.mjs
npx tsc --noEmit -p api/tsconfig.json
npm run build:preview -w app
```
**No hay instrucciones de despliegue productivo aquí deliberadamente.** Primero resolver P0, aislar Preview y obtener aceptación técnica real.


## 10. ACTUALIZACIÓN FINAL DEL HANDOFF · Solicitud del 29/oct, 03:53–04:00 RD

### Respuesta inequívoca: ¿se subieron al repositorio las correcciones posteriores al despliegue?
**Sí.** Los cambios de UX de patrocinado, KawMed y Free ya aparecen en la rama remota de GitHub, junto con la prueba `scripts/test-kawvo-publication-regression-contract.mjs` y otros informes forenses. **No equivalen a despliegue productivo**. En la última comparación consultada en esta conversación, la rama tenía **102 commits de ventaja sobre `main` y ninguno por detrás**, y la lista de archivos cambiados incluía las tres pantallas. Ese contador es variable: no fijarlo como valor permanente.

### Documento rector y documentos complementarios existentes en el repo
1. Este archivo `docs/handoffs/BITACORA_MAESTRA_CHAT_SPONSOR_PRODUCCION_REGRESIONES_2026-10-29.md`: inventario del chat, cronología y ejecución histórica.
2. `docs/handoffs/BITACORA_FORENSE_KAWVO_MULTICUENTA_PUBLICACION_2026-10-29.md`: hipótesis fundamentadas, rutas y pendientes de reproducción.
3. `docs/handoffs/BITACORA_FORENSE_KAWVO_LINK_PUBLICACION_MULTICUENTA_2026-10-29.md`: informe forense complementario; contrastar antes de duplicar arreglos.
4. `docs/handoffs/KAWVO_RELEASE_GATE_SPONSOR_NFC_2026-10-28.md`: checklist previo a release, precauciones de numeración y rollback.
5. `docs/CLOUDFLARE_PAGES_ARCHITECTURE.md`: arquitectura vinculante para las rutas de Pages y Worker.
6. `scripts/test-kawvo-publication-regression-contract.mjs`: **prueba contractual estática**, NO E2E auténtico con sesión ni prueba de todos los casos indicados por el usuario.

### Cambios post-Producción registrados en el repo (NO afirmarlos resueltos en vivo)
- `app/src/components/admin/sponsored/SponsoredDashboard.tsx`: normaliza con `trim()` la comprobación del recordatorio; la navegación detecta también `selectedProfileId` explícito y maneja error de detección multicuenta; el aviso diferencia requisitos obligatorios de foto/portada recomendadas. **Limitación:** aún hace falta demostrar con respuesta autenticada del backend la transición publicado → borrador → publicado y el ámbito real de la cuenta activa.
- `app/src/components/admin/medical/MedicalDashboard.tsx`: añade aviso «Tu perfil médico está listo para publicar», con «Revisar publicación»/«Más tarde»; convierte la vista previa de borrador de un panel ubicado al final de la página a una superposición `fixed`, visible sin publicar. No interpretar la existencia de JSX como confirmación de flujo E2E.
- `app/src/components/admin/free/FreeDashboard.tsx`: la rama registra modificaciones posteriores al release para aviso de perfil Free listo para publicar. La condición deberá seguir la preparación real guardada en el backend y no repetirse hasta cerrar una sesión.
- `scripts/test-kawvo-publication-regression-contract.mjs`: contiene aserciones sobre texto, avisos y guardias de cuenta, pero no reproduce pulsaciones en navegador ni cambios reales en D1.
- Registro de commits post-Producción vinculados en esta conversación: `edefc90d` patrocinado y `6d10e5b1` KawMed. Hay commits adicionales en la rama que se deben inspeccionar con `git log`; no declarar esos commits desplegados.

### P0 — PASO PRÓXIMO OBLIGATORIO (pedido explícito del usuario)
**Cerrar la auditoría forense y las regresiones de publicación y multicuenta antes de cualquier otro despliegue productivo.**

Criterios de aceptación, por separado para cada categoría:
1. **Patrocinado beneficiario**: iniciar con sesión propia y también con cuenta patrocinada seleccionada desde administrador; el `profile_id` resuelto debe mantenerse idéntico al de editar/guardar/publicar/despublicar. Demostrar transición `draft → published → draft → published`, con respuesta real API y persistencia; cuando falle, registrar código HTTP y campo `missing`. No tocar el perfil de otra cuenta.
2. **Patrocinado master**: comprobar que barra/menú y roles funcionan sin mezclar datos del sponsor ni mostrar opciones destinadas al beneficiario. El aviso no puede afirmar «completo» si faltan requisitos realmente obligatorios.
3. **KawMed independiente**: comprobar que aparece el recordatorio al guardar nombre, especialidad y slug; que «Más tarde» conserva borrador y que la vista previa privada funciona sin publicar. Verificar botón «Vista previa» junto a «Cambiar cuenta» en multicuenta. Alinear textos de centros y horarios en todos los puntos visibles, incluidos plural/singular correctos.
4. **Free**: completar los requisitos verdaderos (incluida identidad confirmada, fotografía real y portada según reglas existentes), probar aviso de publicación, «Más tarde», publicación y despublicación; no confundir delegación Demo/Team con cuenta Free normal.
5. **Notificaciones patrocinadas**: `Notificaciones · Próximamente` es placeholder documentado, no funcionalidad completada. Investigar implementación aprobada histórica antes de sustituir o declarar regresión.
6. **Reconciliación de ramas**: comparar PRs y bitácoras de Preview históricamente aprobadas con `main`, HEAD del PR #126, commit efectivamente desplegado `0994d9e5` y las dos Pages productivas; elaborar matriz «aprobado / integrado en rama / publicado / comprobado en UI» para cada módulo. No asumir que HTTP 200 prueba comportamiento de publicación.
7. **Cierre**: un release exclusivo de hotfix de regresiones, con respaldo verificado, build/test, Preview correcto y aceptación funcional. No volver a correr migraciones 0153/0154 salvo investigación que lo justifique; ya se aplicaron a D1 Producción.

### Evidencia temporal de Producción que debe preservarse
- Auditoría D1 previo al release: `intap_artifacts=440`, `sponsor_artifacts=30`, `medical_access_codes=8` (no sumar como entidades distintas sin reconciliar).
- Backup anterior a la modificación: `~/intap-release-logs/kawvo-production-20261029T050318Z/intap_db_before_release.sql`. Nunca subir ese SQL con datos personales a GitHub.
- Migración `0153` ejecutó 6 consultas y `0154` 3 consultas; ambos comandos completaron en Producción.
- Worker versión productiva `7708f331-a575-40eb-82a7-a491a5a25e22`; web `https://a85441d9.intap-link.pages.dev`; app `https://7c8a5eab.intap-web2.pages.dev`.
- Hashes de bundles publicados verificados contra locales: Web `index-DLC-1pX1.js`, App `index-BQfvMZ-s.js`. La ruta raíz `api.intaprd.com/` devolvió 503 en el script y lo detuvo después de publicar todo; los **endpoints verdaderos `/api/health` devolvieron HTTP 200 y `status=healthy`** en los tres dominios. No confundir `/api/v1/health` (404) con ruta válida.
- Las vistas de Perfil/Free/Medical que fallan son reportes de usuario posteriores al despliegue; ninguna sonda de salud certifica que esas operaciones funcionen.

### Instrucciones de seguridad del próximo programador
- Trabajar en PR #126 o subrama explícitamente segregada; registrar cambios antes de continuar.
- **No fusionar ni desplegar automáticamente** por petición antigua: la prioridad actual es terminar las regresiones y presentar evidencia, no repetir publicación.
- Antes de modificar el backend de scopes, inspeccionar `api/src/sponsored-profile-scope.ts`, `api/src/sponsored-profiles.ts`, `api/src/index.ts`, `app/src/components/admin/IntapcardAccountSelector.tsx`, `app/src/lib/api.ts` y los encabezados de cuenta activa.
- Para la UI revisar `SponsoredDashboard.tsx`, `MedicalDashboard.tsx`, `FreeDashboard.tsx`, `SponsorDashboard.tsx` y `SponsorCommercialSellers.tsx`; nunca hacer edición a ciegas de textos que expresan reglas backend diferentes.
- Registrar cualquier anomalía como **confirmada**, **hipótesis** o **pendiente de QA**; separar siempre commit GitHub, prueba CI, Preview desplegado, Producción desplegada y aceptación humana.
