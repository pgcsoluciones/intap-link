# G8.2 — Auditoría forense del bucle de Vista previa
Fecha: 2026-11-24. Estado: QA funcional BLOCKED; ninguna escritura en API/D1/R2/Worker/Producción durante esta auditoría.

## Evidencias comprobadas
- Deployment Preview técnico de App+Web: commit de producto `2714b46093e80555c3c83feba0ad44304176dbe0`, Worker versión `2fa16f51-8504-4101-9266-ea9fe51e6803`, readback con SHA256 App `354af5c79bf554196536cf33755876b2ee5afa3ed5cc6311bbfd827e6069c103`, Web `ff1b015bc6f497573e134a16bb1cca5ad656a2a568426b542044bf6998715ac0`.
- Captura de operador: al abrir Vista previa para `intap3`, Chrome termina en `app.preview.intaprd.com/api/v1/me/free/profile-preview/intap3?full=1#kawvo_shell=1&tab=profile&slug=intap3` con `ERR_TOO_MANY_REDIRECTS`.
- Captura de operador: `https://preview.intaprd.com/intap3` muestra «Perfil no disponible» sin `preview=1`.
- GET sin autenticación: `app.preview.../api/v1/public/profiles/intap3` HTTP 404; `.../intap3?preview=1` HTTP 403; Producción `api.intaprd.com/api/v1/public/profiles/intap3` HTTP 404. Estos códigos NO distinguen perfil inexistente de perfil no publicado, ni demuestran resultado autenticado.
- GitHub compare G8.1 `d93f78c46e2d8593e82dfacdfb6e2b1266adaa7a` → G8.2 desplegado `2714b460...`: cambiaron **solo** `app/src/components/admin/free/KawvoFreeShellPreview.tsx`, `web/src/components/appointments/AppointmentOwnerBar.tsx`, `web/src/components/free-profile/IntapLinkGratisProfile.tsx` y prueba; NO cambiaron `api/src/free-profile-preview.ts`, `api/src/preview-frontdoor-entry.ts`, migraciones ni backend.

## Circuito exacto existente
1. `KawvoFreeShellPreview.tsx`, `previewHref`: dirige a `/api/v1/me/free/profile-preview/:slug?full=1`, incluso si el perfil está publicado (ruta heredada de G8.1).
2. `api/src/free-profile-preview.ts`: `requireProfileOwner` valida cookie de App y sesión en D1, confirma titular/Team, crea `profile_preview_sessions` con token hash TTL 2 horas, envía HTTP **302 Location = WEB_URL/{slug}?preview=1** y `Set-Cookie: kawvo_preview_session=...; Domain=.preview.intaprd.com; Secure; HttpOnly; SameSite=Lax`.
3. `api/src/preview-frontdoor-entry.ts`: Web `/{slug}?preview=1` consulta `validatePreviewSession()` mediante cookie `kawvo_preview_session` y tabla D1. Si NO valida, `renewPreviewRedirect` responde **302 a App /api/v1/me/free/profile-preview/:slug?full=1**. Al regresar a 2 se genera otro token y se repite la secuencia, sin límite o pantalla terminal. Este es el bucle exacto y explica el salto App → Web → App.
4. Si valida, Web carga `PublicProfile.tsx` que solicita `/api/v1/public/profiles/:slug?preview=1` con `credentials:include`; el frontdoor exige de nuevo sesión temporal, de lo contrario 403.
5. Fuera del modo privado, `/intap3` solicita perfil público; la API devuelve 404 tanto cuando no existe el slug como cuando `is_published` es falso.

## Causalidad
- **Confirmado**: el cambio de dominio App→Web es diseño previo, no bug de G8.2; el bucle infinito resulta del fallback sin límite cuando falla la validación de cookie/token/slug/tabla.
- **Confirmado**: el Stage/Worker G8.2 no alteró esta lógica de API; una causa previa expuesta por QA, no atribuible causalmente al código de G8.2 sin más evidencia.
- **No demostrado**: por qué falla la sesión en el navegador concreto. Hipótesis verificables: cookie no almacenada/enviada, cookies homónimas que se solapan, token temporal desincronizado, base Preview/host equivocados, expiración, slug distinto, sesión activa/propietario del perfil. No borrar cookies antes de documentar la cadena de redirecciones.
- **Importante**: la corrección **no desplegada** en commit `30b328a6fdbcf3a1200cbd784a535a0a20f49153` hace que los perfiles *marcados como publicados por App* abran la URL pública sin pasar por token; **no corrige** la ruta para borradores ni la causa de pérdida del token.
- El script de producción/Stage anterior queda fijado al SHA `2714...`, no se puede reutilizar en `30b...` sin nuevo Stage y contrato.

## Procedimiento de siguiente diagnóstico (sin escrituras de configuración)
1. En sesión real App Preview, mediante requests GET a `/api/v1/me` y `/api/v1/me/intapcard/active-account`, anotar solo `profile_id`, slug, is_published, kind, selected id y respuesta, sin cookies/tokens.
2. En DevTools > Network, preservar el registro de navegación de Vista previa; filtrar status y URLs **sin exportar HAR ni cabeceras de Cookie o Set-Cookie**. Observar repetición 302 App→Web→App. En Application > Cookies, anotar únicamente si existe `kawvo_preview_session`, su dominio y si hay duplicados homónimos; no copiar el valor.
3. Consultar GET no autenticados de perfil público en Preview y confirmar slug/estado con sesión autorizada. Distinguir 404 por inexistencia vs no publicación; nunca modificar publicación para hacer pasar QA.
4. Separar dos correcciones mínimas: (a) la URL pública al estar publicado, ya preparada en rama; (b) romper el ciclo de renovación fallida en `preview-frontdoor-entry.ts` mediante estado terminal explícito/guard de intento, manteniendo autenticación y sesión intactas, sujeto a revisión de contrato y QA.
5. Requiere pruebas de integración completas, y despliegue de API Preview solo por procedimiento existente y previa aprobación; NO ajustar cookies, endpoints o D1 a ciegas.

## Conclusión
**Root cause del bucle, comprobado estáticamente:** renovación de sesión privada entre dos hosts sin condición terminal cuando `validatePreviewSession` sigue devolviendo false. **Motivo exacto del false, pendiente de prueba autenticada de navegador**. Mantener PR #190 Draft y Producción G8.1.
