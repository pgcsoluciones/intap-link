# Kawvo G2.4 — Vista previa Free: «Volver a edición» y «Mi perfil» regresan al shell
**Fecha:** 14 noviembre 2026.
**Base G2.3 publicada:** `f1f998fba3a64514ff3113b3e58a87e80475259a`, PR #161 Draft.
**Rama:** `feature/kawvo-g2-free-preview-return-2026-11-14`.
**Estado:** QA local G2.4 previa positiva; integración Web desde fuente publicada preparada. Pendiente nueva QA App+Web, preflight dual y QA funcional. Sin despliegue G2.4.

## 1. Nueva observación del propietario
Después del PASS técnico de G2.3, el propietario informa que, dentro de **la vista previa pública**, «Regresar a edición» y «Mi perfil» continúan enviando al antiguo `/admin/free`. Las mejoras App-only de G2.1–G2.3 no podían corregir estos enlaces de Web.

**Auditoría del repositorio actual:**
- `web/src/components/free-profile/FreePreviewEditShortcut.tsx` tenía `href={`${appUrl}/admin/free`}`, fijo incluso en `preview.intaprd.com`.
- `web/src/components/free-profile/IntapLinkGratisProfile.tsx` monta `AppointmentOwnerBar` con `settingsPath="/admin/free/account"`; su enlace al panel original sale del sitio Web.
- `api/src/free-profile-preview.ts` (sin modificar) valida propiedad/sesión, emite la sesión privada de Preview y redirige a `https://preview.intaprd.com/{slug}?preview=1`; no recibe ni necesita nuevos parámetros.
- `app/src/free-preview-link-fallback.ts` interceptaba enlaces de la vista previa y abría Web directamente, eludiendo la ruta original que establece la sesión privada (no se elude en G2.4).
- El shell `KawvoFreeShellPreview.tsx` podía regresar por `location.state` desde módulos dentro de la SPA, pero **no** desde una pestaña pública/Web de diferente origen.

## 2. Arreglo: token de navegación no sensible, sin API/Worker
El nuevo `previewHref` usa la misma ruta autenticada, agregando un **fragmento local de navegación**:
`/api/v1/me/free/profile-preview/{slug}?full=1#kawvo_shell=1&tab=profile&slug={slug}`.

Por RFC 9110, sección 10.2.2, un redirect sin fragmento `Location` hereda el fragmento original. El navegador llega a Web Preview con su sesión normal y un marcador de *presentación*, nunca un token de autenticación. **Ningún valor del fragmento concede permisos.**

`freeShellPreviewReturnUrl()` en **Web** sólo acepta el marcador si:
1. Host exacto `preview.intaprd.com` (nunca Web Producción ni otros host QA).
2. `preview=1`, no `embedded=1`.
3. `#kawvo_shell=1&tab=profile&slug={slug}` con slug validado que coincide con la ruta pública actual.

Entonces, y sólo entonces:
- El botón «Volver a edición» apunta a `https://app.preview.intaprd.com/admin/free/shell-preview?kawvo_shell=1&resume=profile&slug={slug}`.
- «Mi perfil» de la barra propietaria Free apunta al mismo destino. Se usa override **opcional**, sin modificar la barra en Kawmed/patrocinadores.
- El shell App recupera Perfil sólo si `resume=profile` y `slug` coincide con el `/me` de la cuenta autenticada; no cambia cuenta activa y sigue protegido por `AdminGuard planScope=free`.
- Enlace **sin marcador**: comportamiento legacy idéntico al actual. El enlace compartido público normal tampoco tiene marcador.
- `app/src/free-preview-link-fallback.ts` deja que estos enlaces marcados sigan la ruta autenticada/redirect, en lugar de abrir Web sin generar sesión privada. Para los demás enlaces conserva el fallback previo.

Este lote **no** cambia `api/src/free-profile-preview.ts`, D1, R2, cookies, autenticación, Worker, permisos, roles, URLs de Producción, otros perfiles ni publicación.

## 3. Alcance y revisión
Cambios funcionales: 2 archivos App y 4 Web (tres componentes de navegación Free y un helper nuevo). Además se restauraron exactamente cinco rutas Web desde el commit Pages activo 529e58ec para preservar Kawmed, patrocinados y estilos móviles. Frente a G2.3 se modifican 19 rutas: App 2, Web 9, tests 4 (incluido contrato Kawmed de barra publicada), auditoría 1, scripts de QA/deploy 2 y esta bitácora 1. Estas restauraciones no modifican la experiencia Web activa fuera de Free.

## 4. Método seguro (doble Pages)
- Runner local `scripts/run-kawvo-g2-4-preview-return-local-qa-2026-11-14.sh`: checkout seguro, base SHA, allowlist, diff, contratos G1–G2.4 y regresiones Free/Agenda, Patrocinado, Kawmed, `npm ci`, build **App y Web** en modo Preview; **sin deploy**.
- `scripts/audit-kawvo-g2-web-pages-alias-readonly-2026-11-14.mjs`: identifica con REST Cloudflare GET la rama real que posee el alias Web Preview `qa-sponsor-scan-1104.intap-link.pages.dev` y su URL inmutable. No asumir que rama = alias.
- Runner protegido `scripts/deploy-kawvo-g2-4-preview-return-pages-2026-11-14.sh`: compara APP activo con el Pages G2.3 inmutable del log `~/intap-release-logs/kawvo-g2-3-pages-Cc1pY2uX/publish.log`; Web activo con Pages Web inmutable identificado por GET; Worker Preview original al 100% con 35 bindings y ambos `*_PAGES_ORIGIN` sin cambios.
- Primero dos **stage aislados** (Web + App) con comparación JS byte a byte con `dist`, sin alterar alias. Reconfirmar aliases originales.
- Gate actualizado: el SHA del deployment Web real debe ser recuperable. Su árbol `web/`, `shared/`, `functions/`, `package.json` y `package-lock.json` debe ser idéntico al nuevo HEAD **excepto** `AppointmentOwnerBar.tsx`, `FreePreviewEditShortcut.tsx`, `IntapLinkGratisProfile.tsx` y el helper nuevo `freeShellPreviewReturn.ts`. Si hay cualquier otra diferencia, **STOP antes de stage**.
- Después publicar Web Pages en **su rama real verificada** (la función nueva está inactiva sin marca), seguido por App Pages en rama real `qa-kawmed-guest-current-2026-11-02`. No usar `wrangler deploy`, ni PATCH Worker, ni `keep_vars`, ni migración, ni Prod.
- Verificar ambos bundles efectivamente servidos por `preview.intaprd.com` y `app.preview.intaprd.com`, y mismo Worker intacto al 100%. Guardar ambos snapshots inmutables para reversión Pages-only ante fallo. **Si algún preflight falla: detenerse y no repetir.**

## 5. QA humana requerida después de PASS de ambos Pages
1. Desde el nuevo shell `https://app.preview.intaprd.com/admin/free/shell-preview?kawvo_shell=1`, pulsar **Vista previa** de Free; comprobar `preview.intaprd.com/{slug}?preview=1#kawvo_shell=1...` y que se visualiza el perfil correcto (publicado o borrador autorizado).
2. En esa página, pulsar **Volver a edición**: debe abrir el shell Kawvo en pestaña **Perfil** y no `/admin/free`.
3. Volver a abrir Vista previa y pulsar **Mi perfil** del menú del propietario: debe regresar al mismo Perfil del shell.
4. Cambiar cuenta autorizada entre abrir vista previa y regresar: debe quedar bajo el guardia de la cuenta activa; no mostrar/editar otra identidad. Pruebas Team/owner, móvil 320/360/390/430 y escritorio.
5. Enlace de vista previa **antiguo** sin marcador sigue llevando al panel antiguo; perfil público regular sin `preview=1` no incluye atajo; Kawmed/patrocinadores no cambian.
6. Si una plataforma/client pierde el fragmento de redirect, registrar URL real antes de proponer fallback; **no** modificar Worker/API para ocultarlo.

**Estado de liberación:** G2.4 en Draft hasta QA local + publicación bilateral segura + pruebas autenticadas. No merge a main ni Producción sin aprobación explícita.

Pendientes ya documentados fuera de lote: «Cambiar cuenta» solo autorización real Multicuenta y atajo operacional «Lunes a viernes» en Agenda (separado).

## 6. Registro de bloqueos de QA local · 14/11/2026

**Segundo intento del propietario:** PASS de contratos G1–G2.4 y Free Contact/Agenda, seguido por `BLOCKED: Regresión patrocinado` en `scripts/test-sponsored-profile-contract.mjs:330`, que esperaba «Teléfono *» y el modal real muestra «Teléfono / WhatsApp *». No se inició `npm ci`, build ni deploy de Pages. App G2.3 y Web Preview permanecen activos.

**Auditoría preventiva:** se revisaron las lecturas del contrato patrocinado frente a los 78 archivos de origen correspondientes; se identificaron comprobaciones literales desfasadas por cambios previos verificables: campo RNC adicional y limpieza completa en cotizaciones, nombre de contacto Agenda, etiqueta parametrizada de barra de propietario, social card de cotización, límite bancario patrocinado configurable de 2 a 5 con predeterminado 3, título público «Datos para Transferencias», enmascaramiento por defecto, y mensajes/copia de enlace bancario. Se conservaron o reforzaron pruebas equivalentes; no se alteraron componentes, rutas, D1 ni API.

**Precaución sobre bancos:** el editor patrocinado actual fija `display_mode:'masked'` y explica que la cuenta publica los últimos cuatro dígitos; el test antiguo refería un selector «Cómo mostrar el número de cuenta» ausente. Se asegura en tests el comportamiento más protector existente; cualquier decisión de volver a mostrar números completos requiere autorización y PR separado, no se infiere como parte de G2.4.

La rama continúa en Draft. El PASS final del contrato patrocinado y la compilación solo se pueden afirmar tras ejecutar el runner local actualizado en el Mac. Ante otro `BLOCKED` mantener STOP y auditar evidencia, no forzar el deploy.

## 7. Bloqueo tras PASS G2.4 local — rama Pages Web histórica (14/11/2026)

El propietario obtuvo `PASS G2.4 LOCAL` con contratos G1–G2.4, aislamiento Free/Kawmed/Patrocinado y builds **App+Web Preview**, log `~/intap-release-logs/kawvo-g2-4-local-5hh4ft6k`.

En el runner de despliegue `~/intap-release-logs/kawvo-g2-4-pages-yjkFGizf`, la auditoría read-only de Cloudflare informó:
- `PASS: rama Web Preview realmente propietaria: qa-sponsor-scan-1104`
- `fatal: couldn't find remote ref qa-sponsor-scan-1104`
- `BLOCKED: No se pudo consultar la rama Web real`

El bloqueo ocurrió **antes de ambos stage y ambas publicaciones**. Los alias de App/Web Preview y Worker no se modificaron. La rama `qa-sponsor-scan-1104` existe como **etiqueta de rama en la metadata del despliegue Pages**, pero la búsqueda de ramas actuales del repositorio `pgcsoluciones/intap-link` no encuentra esa referencia: no hay motivo para exigir que la rama de GitHub exista al publicar mediante `wrangler pages deploy --branch`.

**Corrección conservadora:** se elimina exclusivamente la exigencia `git fetch github "$WEB_BRANCH"`. Se mantiene `WEB_BRANCH` exactamente como la metadata verificada de Cloudflare para la futura publicación Pages. La fuente Web existente se valida con el campo de commit SHA de **ese mismo despliegue** (`WEB_DEPLOY_SHA`) y los siguientes controles:
1. SHA de 40 caracteres hexadecimales; se intenta `git cat-file -e "$WEB_DEPLOY_SHA^{commit}"` en el repositorio local
2. Si no está disponible localmente, se intenta recuperar **solo ese SHA** desde el remoto GitHub mediante `git fetch --no-tags github "$WEB_DEPLOY_SHA"`; si no es recuperable, `BLOCKED` sin stage ni publicación
3. Validación obligatoria `git diff --quiet "$WEB_DEPLOY_SHA" "$BASE" -- web/ shared/ package.json package-lock.json`; si hay cambios ajenos en el código Web activo, `BLOCKED` para no pisar Kawmed/Patrocinado
4. Se conservan sin modificaciones los controles de Worker versión original al 100%/35 bindings, dos alias Pages, ambos inmutables, doble stage, comparación byte por byte y prohibición de Producción/Worker.

Se añadió una regresión estática que impide reintroducir el `git fetch` de la rama Pages ausente y mantiene el control estricto por SHA/árbol. La rama sigue **Draft** y la publicación G2.4 todavía **no ha ocurrido**. Si falla la recuperación del SHA o la paridad de Web, recuperar el reporte `web-alias.txt` / `report.json` sin claves ni tokens y detener el flujo para análisis. No modificar el Worker o sus bindings como atajo.



## 8. Integración segura con la fuente Web efectivamente publicada (14/11/2026)

El propietario verificó que Web Preview usa el commit `529e58ec8ffae587ee02303ecfce2d569726a75d` («fix(release): validate Free public route and expect auth gate for draft ?preview=1»). Su diferencia frente a App G2.3 comprende ocho rutas: ArtifactLinkResolver, CSS móvil del Owner Bar, Owner Bar, FreePreviewEditShortcut, IntapLinkGratisProfile, KawMedProfile, SponsoredAwareArtifactResolver y SponsoredProfile. El preflight inicial bloqueó correctamente en `~/intap-release-logs/kawvo-g2-4-pages-3UeEVKKf`. No hubo stage ni publicación.

Se recuperaron de ese commit los cinco archivos que NO deben cambiar en Web: `ArtifactLinkResolver.tsx`, `AppointmentOwnerBar.mobile.css`, `KawMedProfile.tsx`, `SponsoredAwareArtifactResolver.tsx` y `SponsoredProfile.tsx`. GitHub confirmó **igualdad exacta de los cinco blob SHA** con el Web activo. Los tres componentes relevantes se recuperaron igualmente desde ese commit y solo recibieron la navegación opt-in de Free; `freeShellPreviewReturn.ts` es el cuarto archivo nuevo/diferente. Se conservó la barra activa, incluida su etiqueta «Mi perfil», su menú móvil y CSS asociado. El Web activo y la integración tienen idénticos los blobs de `functions/_middleware.ts`, configuración Vite, dependencias y lockfile.

**QA local obligatoria:** diff exacto de 19 rutas frente a la base App G2.3 y comparación independiente `git diff --name-only 529e58ec8ffae587ee02303ecfce2d569726a75d HEAD -- web/ shared/ functions/ package.json package-lock.json`, que debe contener exactamente los cuatro parches Free autorizados, sin diferencias Kawmed, Patrocinados ni CSS.

**QA prepublicación:** el runner obtiene el commit Web actualmente asociado al alias real Pages. Debe demostrar la misma paridad estricta de cuatro rutas respecto a ese commit dinámico, además del Worker original al 100%, 35 bindings, URL inmutable previa de cada proyecto, dos stages aislados y comparación byte a byte de los bundles. Si el Web activo cambió desde la auditoría o hay divergencias no previstas, **BLOCKED** sin publicar. El nombre histórico de rama Pages no necesita existir como ref de GitHub. No se cambia Worker/API/OAuth/D1/R2/Producción.

**Estado final de esta anotación:** código y controles actualizados en PR #162 Draft; compilación después de integración **aún no ejecutada en el Mac**. App Preview G2.3 y Web Preview histórico siguen intactos.

**Ajuste final de contratos:** `scripts/test-kawmed-isolation-contract.mjs` protegía la etiqueta antigua «Configuración», mientras la barra Web realmente publicada utiliza por defecto «Mi perfil» y su CSS móvil. Se actualizó la prueba para exigir ambas condiciones reales; no se modificó el funcionamiento médico. Este archivo forma parte de la allowlist y debe pasar en la nueva QA local.
