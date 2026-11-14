# Kawvo G2.4 — Vista previa Free: «Volver a edición» y «Mi perfil» regresan al shell
**Fecha:** 14 noviembre 2026.
**Base G2.3 publicada:** `f1f998fba3a64514ff3113b3e58a87e80475259a`, PR #161 Draft.
**Rama:** `feature/kawvo-g2-free-preview-return-2026-11-14`.
**Estado:** desarrollo + QA/runners preparados en GitHub; pendientes `npm ci`, builds App/Web Preview, preflights Cloudflare y QA real. Nada se ha desplegado.

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
6 archivos de frontend estrictos: 2 App (`KawvoFreeShellPreview.tsx`, `free-preview-link-fallback.ts`), 4 Web (`FreePreviewEditShortcut.tsx`, `freeShellPreviewReturn.ts`, `IntapLinkGratisProfile.tsx`, `AppointmentOwnerBar.tsx`). Solo navegación Free con opt-in explícito. Tests estáticos (incluida la actualización de un assert antiguo sobre la etiqueta dinámica del Owner Bar), auditoría Cloudflare de Web Pages, runner local, runner Preview dual y esta bitácora suman 12 archivos desde la base exacta G2.3. Evitar integrar refactors o dependencias.

## 4. Método seguro (doble Pages)
- Runner local `scripts/run-kawvo-g2-4-preview-return-local-qa-2026-11-14.sh`: checkout seguro, base SHA, allowlist, diff, contratos G1–G2.4 y regresiones Free/Agenda, Patrocinado, Kawmed, `npm ci`, build **App y Web** en modo Preview; **sin deploy**.
- `scripts/audit-kawvo-g2-web-pages-alias-readonly-2026-11-14.mjs`: identifica con REST Cloudflare GET la rama real que posee el alias Web Preview `qa-sponsor-scan-1104.intap-link.pages.dev` y su URL inmutable. No asumir que rama = alias.
- Runner protegido `scripts/deploy-kawvo-g2-4-preview-return-pages-2026-11-14.sh`: compara APP activo con el Pages G2.3 inmutable del log `~/intap-release-logs/kawvo-g2-3-pages-Cc1pY2uX/publish.log`; Web activo con Pages Web inmutable identificado por GET; Worker Preview original al 100% con 35 bindings y ambos `*_PAGES_ORIGIN` sin cambios.
- Primero dos **stage aislados** (Web + App) con comparación JS byte a byte con `dist`, sin alterar alias. Reconfirmar aliases originales.
- Exigir además que el **SHA de fuente del deployment Web previo** sea un commit disponible y que su árbol `web/`, `shared/`, `package.json` y `package-lock.json` coincida exactamente con la base G2.3. Si Web Preview contiene correcciones más recientes o ajenas: **STOP antes de stage**, nunca sustituirlas con fuentes antiguas.
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
