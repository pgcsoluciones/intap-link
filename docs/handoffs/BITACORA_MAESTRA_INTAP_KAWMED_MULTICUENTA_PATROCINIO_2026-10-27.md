# BITÁCORA MAESTRA · INTAP / Kawvo Link / KawMed
## Handoff técnico y funcional — 27 de octubre de 2026

**Repositorio:** `pgcsoluciones/intap-link`. **Zona horaria de operación:** Santo Domingo (UTC-4). **Responsable del siguiente turno:** programador entrante.

> **PRIORIDAD P0, PRÓXIMO PASO SIN EXCEPCIÓN:** corregir y validar aislamiento de patrocinadores DAPSA/MICM. En el directorio multicuenta se ven ambas empresas, pero al elegir MICM el panel `/admin/sponsor` muestra DAPSA; además la sección Identidad de patrocinio del patrocinador muestra la empresa equivocada. **NO PUBLICAR EL PR #123 EN PRODUCCIÓN SIN QA AUTENTICADO** de lecturas, edición, logos/banners, perfil Master y cambio de cuentas. No alterar datos D1 manualmente para ocultar el defecto.

## 1. Resumen ejecutivo de este chat
1. Se encontró error Free en Preview: `/api/v1/me/free/profile-preview/intap3?full=1` devolvía `intap_account_tab_stale` al abrir una vista en enlace/iframe sin encabezado `X-Intap-Account-Tab`. Se corrigió GET de vista previa con comprobación explícita de propietario, usuario y slug seleccionado; otras mutaciones permanecen protegidas.
2. Se completó y fusionó **PR #119** (KawMed + multicuenta + vista previa Free), commit de integración `c9211e277c7643b069541f26732442916cdce49f`; CI exitoso; Production release confirmada en logs de Terminal.
3. Se pactó diseñar Patrocinio Normal con vendedores, catálogo y asignaciones masivas, pero **se pospuso como etapa 2**. No mezclarlo con la estabilización.
4. El usuario reportó en Producción otro error Free: `intap_account_not_selected` con JSON crudo al abrir `/api/v1/me/free/profile-preview/fanny?full=1`. Se creó hotfix con redirección a `/admin/accounts` solo para navegación GET HTML sin cuenta activa; **esto NO convierte una cuenta inactiva en activa**.
5. Se agregó cierre de sesión en directorio Multicuenta; enlace Cambiar cuenta y barra inicial del Patrocinado; paginación de 10 códigos por página en Sponsor; Notificaciones quedó como `Próximamente` sin inventar una ruta inexistente.
6. Hotfix **PR #121** fusionado en `d97168dbab8ddbc30f019361db1b915ff66f1807`. Publicador dedicado **PR #122** fusionado en **`4cf35f9b1fca7e3282621813dbf3a34c3df1444f`**, publicado en Producción con respaldo D1 y sin migraciones.
7. Después, capturas reales mostraron el defecto grave DAPSA/MICM al cambiar de sponsor. Se preparó **PR #123** en rama `hotfix/sponsor-account-isolation-2026-10-27`, todavía **DRAFT, NO FUSIONADO, NO DESPLEGADO A PRODUCCIÓN** en el momento de la redacción. La prioridad del siguiente programador es concluirlo y validarlo en Preview.

## 2. Estado de despliegues confirmados por registros
### Release 1 (26/10/2026)
- PR #119: merged merge-commit (no squash) `c9211e277c7643b069541f26732442916cdce49f`.
- Preview App: `https://app.preview.intaprd.com`; Web `https://preview.intaprd.com`; Worker `intap-api-preview`, D1 `intap_db_preview`, R2 `intap-r2-preview`.
- Producción Worker `intap-api` versión Cloudflare `cd5e4ec9-8e05-4c00-8c81-45a361794ecb`; Web Pages `https://32a87a41.intap-link.pages.dev`; App Pages `https://e82cc2f6.intap-web2.pages.dev`.
- Tag GitHub `prod-intapcard-kawmed-20261026T235029Z`; backup local `~/intap-release-logs/intapcard-kawmed-20261026T234609Z/intap_db_before_release.sql`.
### Release 2, hotfix complementario (27/10/2026)
- PR #121/#122, SHA principal `4cf35f9b1fca7e3282621813dbf3a34c3df1444f`.
- API Cloudflare versión `0614cf60-6c27-4e9a-bd7d-8c49dea93509`; Web Pages `https://322b393c.intap-link.pages.dev`; App Pages `https://ed3ee9ca.intap-web2.pages.dev`.
- Tag `prod-sponsored-free-hotfix-20261027T023035Z`; backup D1 `~/intap-release-logs/sponsored-free-hotfix-20261027T022610Z/intap_db_before_release.sql`.
- Logs verifican bundles reales: Web `/assets/index-C7HLfdQg.js`, App `/assets/index-B0Q6YSUY.js`; no migraciones D1. **Post-release QA de login, selector, Free, dos sponsors, Master, médicos y agenda sigue siendo obligatorio.**
- Último Preview de hotfix en registros: App `https://cc35083c.intap-web2.pages.dev`, Web `https://1ea50149.intap-web2.pages.dev`, Worker `be385db6-41de-4ab5-a71b-1db1953cfdaa`.
- En ambos releases se reportan **7 vulnerabilidades de runtime (4 high, 3 moderate)**: Hono, React Router, uuid y xlsx. `xlsx` reporta sin fix en npm audit. No incluir `npm audit fix --force` indiscriminado en hotfix de aislamiento.

## 3. Archivos principales modificados, creados y por qué
### PR #119: KawMed/Multicuenta/Free
- `api/src/index.ts`: middleware de cuenta activa, bloqueo de pestañas obsoletas y excepción GET para preview Free **solo cuando propietario y slug coinciden**.
- `api/src/intap-active-account.ts` **CREADO**: cookie HttpOnly `kawvo_intap_active_account_v1` con categoría, UUID, huella de sesión, token de pestaña; `readIntapSelection`, `setIntapSelection`, `matchesActiveIntapTab`, `clearIntapSelection`, `requireIntapKind`.
- `api/src/account-home-route.ts`: rutas y directorio de cuentas.
- `app/src/components/admin/IntapcardAccountSelector.tsx` **CREADO**: elegir cuenta existente o activar cuenta nueva; petición POST de selección, token en sessionStorage, navegación por tipo.
- `app/src/components/admin/AdminGuard.tsx`, `AuthCallback.tsx`, `app/src/lib/api.ts`, `app/src/App.tsx`: sesión, guardas, routing y encabezado de pestaña.
- `app/src/components/admin/medical/MedicalDashboard.tsx`, `SuperAdminKawMed.tsx`, `sponsored/SponsorKawMed.tsx`, `sponsored/SponsorDashboard.tsx`, `sponsored/SponsoredDashboard.tsx`, `sponsored/SponsoredResumeGate.tsx`, `KawMedClaim.tsx`.
- `api/src/medical-access-codes.ts`, `medical-appointments.ts`, `medical-profile-owner.ts`, `routes/medical-profile.ts`, `sponsored-account-controls.ts`, `sponsored-appointments.ts`, `sponsored-multiprofile-access.ts`, `sponsored-profile-scope.ts`.
- `web/src/components/medical-profile/types.ts`, `web/src/components/appointments/AppointmentOwnerBar.tsx`, workflow `.github/workflows/quality.yml`.
- **Scripts creados:** `scripts/run-preview-intapcard-kawmed-integrated-2026-10-24.sh`, `run-preview-intapcard-multiaccount-2026-10-24.sh`, `run-preview-kawmed-med-codes-ui-2026-10-23.sh`, `run-preview-kawmed-public-web-2026-10-25.sh`, `run-production-intapcard-kawmed-2026-10-25.sh`.
- **Pruebas creadas:** `scripts/test-intapcard-active-account-contract.mjs`, `test-intapcard-kawmed-integrated-contract.mjs`, `test-intapcard-multiaccount-contract.mjs`, `test-kawmed-code-accordion-contract.mjs`, `test-kawmed-web-preview-route-contract.mjs` y ajustes en test demo invitaciones.
- **Migraciones creadas por PR #119:** **NINGUNA**. Se reutilizaron tablas preexistentes. No se aplicó migración durante releases.

### PR #121/#122: hotfix complementario
- `api/src/index.ts`: redirigir navegación HTML Free GET a selector cuando no hay cuenta Free/Link seleccionada; no mostrar JSON crudo en esa navegación, sin evadir verificación.
- `app/src/components/admin/IntapcardAccountSelector.tsx`: botón **Cerrar sesión** usando `/auth/logout`.
- `app/src/components/admin/sponsored/SponsorDashboard.tsx`: códigos paginados de 10 en 10 con filtros conservados.
- `app/src/components/admin/sponsored/SponsoredDashboard.tsx`: barra inicial «Editar perfil», «Agenda», «Cambiar cuenta», «Notificaciones · Próximamente» (sin endpoint).
- `scripts/test-intapcard-active-account-contract.mjs`: nuevos contratos.
- **Scripts creados:** `scripts/run-preview-sponsored-hotfix-2026-10-27.sh`; `scripts/run-production-sponsored-free-hotfix-2026-10-27.sh`.
- **Migraciones creadas:** **NINGUNA**; tablas nuevas: **NINGUNA**.

### PR #123: hotfix crítico de aislamiento aún pendiente
- Rama `hotfix/sponsor-account-isolation-2026-10-27`; PR: `https://github.com/pgcsoluciones/intap-link/pull/123`.
- `api/src/sponsored-profiles.ts`: usar `resolveSponsorMembership(c,userId)` en `GET /api/v1/sponsor/me`, `GET /api/v1/sponsor/artifacts`, `PATCH /api/v1/sponsor/settings` y al inicializar perfil Master. Antes se seleccionaba primera fila de `sponsor_members` con `LIMIT 1`, provocando que MICM leyera DAPSA.
- `api/src/sponsored-media.ts`: aplicar misma resolución al `POST /api/v1/sponsor/media`; nunca subir logo/banner bajo sponsor equivocado.
- `app/src/components/admin/IntapcardAccountSelector.tsx`: al entrar como sponsor agrega `?sponsor_id=<UUID>` a ruta de navegación (UUID interno, no dato de presentación ni secreto).
- `app/src/components/admin/sponsored/SponsorDashboard.tsx`: limpia datos anteriores al cambiar; compara `sponsor_id` URL, cookie de sesión activa y `tenant.id`; si no coinciden, rechaza visualización (fail closed).
- `scripts/test-intapcard-active-account-contract.mjs`: asserts de resolución por cuenta, media, navegación y rechazo de cruces.
- **Migraciones/tablas nuevas:** NINGUNA. Se usan `sponsor_members`, `sponsor_tenants`, `sponsor_user_context`, `sponsored_profiles`, `sponsor_artifacts`, `intap_artifacts`, `auth_sessions`, `users`.
- **IMPORTANTE:** inspeccionar adicionalmente los componentes *Super Admin > Marca del patrocinador* y sus endpoints: las capturas muestran marcas cruzadas también en administración. No asumir que arreglar `/sponsor/me` cubre los controles del Super Admin.
- En el momento de handoff PR sigue en borrador; verificar el SHA y estado real en GitHub antes de avanzar. La rama pudo recibir commits adicionales.

## 4. Diagnóstico técnico DAPSA/MICM
- Dos cuentas sponsor son visibles para el mismo email de prueba `intapcard@gmail.com`: «DAPSA» y «Ministerio de Industria Comercio y Mipymes (MICM)».
- Al gestionar MICM se renderiza «DAPSA» en header y «Identidad de patrocinio», mientras una tarjeta de perfil ejemplo muestra MICM. Inconsistencia que prueba mezcla de contexto **NO mera caché visual**.
- Causa comprobada por lectura de código: `api/src/sponsored-profiles.ts` y `api/src/sponsored-media.ts` resolvían `sponsor_members` vía `LIMIT 1` sin filtrar `sponsor_id`.
- Resolutor existente `api/src/sponsored-multiprofile-access.ts` → `resolveSponsorMembership` valida activo, membresía de usuario, tenant y `sponsor_user_context`; usar este resolutor compartido, nunca seleccionar primer patrocinador.
- Protección complementaria: token `X-Intap-Account-Tab` en peticiones API, UUID seleccionado en navegación, comprobación de coincidencia en UI; no confiar SOLO en UUID enviado por cliente.
- Prueba mínima: entrar DAPSA → ver nombre/logotipo/banner/códigos DAPSA → cambiar a MICM → nombre, logo, banner, códigos MICM → editar solo MICM → volver DAPSA y verificar sin contaminación; invertir secuencia; realizar en tabs separadas y validar 409 de token obsoleto; confirmar que el perfil Master y apartado «Marca del patrocinador» Super Admin no se cruzan.
- Considerar que `sponsor_user_context` es contexto persistido por usuario y no por pestaña: verificar el comportamiento esperado para múltiples pestañas y, ante discordancia, **denegar** en vez de reasignar automáticamente.

## 5. Método de trabajo aprobado
1. Código remoto en GitHub por herramientas del conector; el operador ejecuta Cloudflare desde iMac. Checkout: `$HOME/Desktop/intap-link-universal-bilingual-audit`; remote `github`; shell Bash; macOS 12.6 (Wrangler advierte que recomienda 13.5+).
2. Para bugs críticos: rama `hotfix/...` desde `main`, PR en **draft**, cambios mínimos. Contratos JS y TypeScript. Validar CI completo.
3. Antes de Preview: hacer `git fetch github ...`, `git switch ...`, `git pull --ff-only`. Runner específico de rama, no ejecutar script antiguo que cambia a otra rama. Preview usa `app.preview.intaprd.com`, `preview.intaprd.com`, D1/R2 de Preview.
4. QA autenticado (no solo HTTP 200) de acciones de lectura/escritura; probar ambos sponsors y alternancia.
5. PR `ready`, merge `merge` **no squash** para preservar ancestros; revisar CI y SHA exacto. Publicador de Producción exige aprobación y QA real. Nunca declarar QA completo sin pruebas.
6. Deploy: test contratos y tipos, build `web` y `app` con `VITE_*_URL` de Producción, `wrangler deploy --dry-run`, SQL **solo lectura** sobre D1, `wrangler d1 export` no destructivo, Worker API primero, Web Pages proyecto `intap-link`, App Pages proyecto `intap-web2`, comprobar que custom domains sirven bundles del SHA aprobado, crear tag release.
7. Post-release QA de cuenta Free, Trial, KawMed, sponsor Master y patrocinados, agenda y notificaciones; guardar logs y backup. Si falla, detener y priorizar recuperación; NO ejecutar migraciones improvisadas.
8. Usuario prefiere acciones reales en repo y **un comando de Terminal listo para pegar**, en vez de diagnósticos largos o preguntas ya respondidas.

## 6. Fases siguientes, priorizadas
**P0 AHORA:** concluir aislamiento DAPSA/MICM del PR #123; confirmar Super Admin Marca del patrocinador; CI; Preview; probar alternancia real, escrituras y R2; solo después Producción y QA post-release.

**P1 después de estabilizar:** completar notificaciones patrocinado con panel real y permisos; revisar barra patrocinador/patrocinado de acuerdo con KawMed. El enlace de notificaciones actual es marcador no funcional.

**P2 ETAPA COMERCIAL NUEVA (otra rama/PR, NO hotfix):**
- Patrocinio normal hereda patrón de KawMed, no sus tablas de médicos: vendedores en lugar de visitadores; catálogo en lugar de vademécum.
- Super Admin decide **contacto** (vendedor, visitador, ninguno) y **documentación** (catálogo, vademécum, ninguno); ocultar botones si no están habilitados.
- Patrocinador registra vendedor individual/importa Excel, zona, sector, territorio, activo/inactivo, con pertenencia estricta a sponsor UUID.
- Crear asignación masiva por lote, código, zona, sector, cantidad y reasignaciones auditadas; patrocinado consulta solo SU vendedor y catálogo del sponsor propio.
- Reutilizar funcionalidad e interfaz de `app/src/components/admin/sponsored/SponsorKawMed.tsx` y endpoints de `api/src/medical-access-codes.ts`; revisar modelos y migraciones antes de definir nuevas tablas, con migración versionada y probada SOLO en Preview.
- Preservar modelos actuales KawMed sin prefijos de sponsor delante del nombre del médico; labels «Usuario», «Presentación (Sobre mí)», paginación MED 7 por página, agenda y reglas de privacidad.

**P3 Seguridad técnica:** dependencias npm Hono/React Router/uuid/xlsx: auditoría separada, test regresión, plan sustitución de xlsx; revisión del tamaño de bundle principal App (>1,7 MB), soporte Wrangler/macOS.

## 7. Contratos e invariantes que NO pueden romperse
- No permitir que las cuentas patrocinadoras compartan logo, banner, códigos, perfiles Master, galerías, edición ni archivos por tener un mismo usuario de login.
- Las URL públicas `/p/:username`, `/m/:slug`, `/l/:public_code` se resuelven por propiedad real del perfil/artefacto, no por la última identidad admin.
- Token de pestaña no es reemplazo de validación DB; cookie HttpOnly no es autorización aislada.
- Nunca resolver sponsor multicuenta con `ORDER BY created_at LIMIT 1` si hay activo explícito.
- `/api/v1/me/free/profile-preview/:slug`: propietario y slug deben coincidir; sin activo, ofrecer ruta guiada sin filtrar datos.
- No publicar archivos en `main` por asumir que merge equivale a deploy. Distinguir integraciones GitHub, Preview y Producción.

## 8. Evidencia de archivos/logs suministrados
- Log Production release 1: `Markdown pegado(20261026-235707).md`.
- Log hotfix Preview: `Markdown pegado(20261027-020159).md`.
- Log Production release 2: `Markdown pegado(20261027-023601).md`.
- Capturas de pantalla 27/10: tarjetas DAPSA/MICM, panel Master mostrando DAPSA tras seleccionar MICM, branding MICM vs DAPSA en Sponsor y Super Admin.
- Historial largo en proyecto: bitácoras INTAP/Kawvo/KawMed cargadas, en particular `BITACORA_MAESTRA_KAWMED_DEMO_HANDOFF_2026-10-23.pdf`. Esta bitácora describe **los cambios ejecutados en esta conversación**, no sustituye todos los handoffs históricos.

## 9. Comando de lectura inmediata para el siguiente desarrollador
```bash
cd "$HOME/Desktop/intap-link-universal-bilingual-audit"
git fetch github main hotfix/sponsor-account-isolation-2026-10-27
git switch hotfix/sponsor-account-isolation-2026-10-27
git pull --ff-only github hotfix/sponsor-account-isolation-2026-10-27
node scripts/test-intapcard-active-account-contract.mjs
```
**No desplegar todavía a Producción**: primero CI completo, revisión del módulo Marca del patrocinador y Preview autenticado.
