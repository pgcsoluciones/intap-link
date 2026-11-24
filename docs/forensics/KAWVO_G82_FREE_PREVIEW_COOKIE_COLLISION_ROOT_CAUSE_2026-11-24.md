# KAWVO G8.2 — Forense de la sesión de vista previa Free (24 noviembre 2026)

**Estado:** CAUSA ESTRUCTURAL REPRODUCIDA; confirmación con cookies reales del navegador todavía pendiente. NO publicar en Producción. Corrección de mínimo delta propuesta en rama separada y sin despliegue.

## Síntoma reproducido por operador

- En la misma sesión de Chrome, Producción abrió un Free de Multicuenta como `https://intaprd.com/fanny?preview=1#kawvo_shell=1&tab=profile&slug=fanny`, con «Volver a edición».
- En Preview oficial G8.2, `https://preview.intaprd.com/intap3?preview=1&preview_retry=1#kawvo_shell=1&tab=profile&slug=intap3` devuelve HTTP 403 con «No se pudo validar la vista previa».
- Worker Preview G8.2 activo `16ead1c8-7546-43c8-96c1-457517c2e8ce`, API bundle SHA256 `cc3cf71f6e371cada97d7caf325546f5bd3c95bc83091bc012d1b90734265ace`; App bundle `index-DBVubrbE.js`. El PASS de despliegue no es PASS funcional.

## Hallazgo principal: dos cookies con mismo nombre y alcance superpuesto

1. `api/src/free-profile-preview.ts` crea un token aleatorio, guarda **solo su hash y perfil vinculado** en D1, y responde `Set-Cookie: kawvo_preview_session=...; Domain=.intaprd.com` en Production o `Domain=.preview.intaprd.com` en Preview, TTL 7200s.
2. La cookie de Producción con Domain `.intaprd.com` se envía **también** a `preview.intaprd.com`. La de Preview también. Son cookies distintas con el **mismo nombre y Path** que pueden coexistir si sus Domain difieren.
3. `api/src/preview-frontdoor-entry.ts` hace `parseCookie(Cookie,'kawvo_preview_session')`, toma **solamente la primera coincidencia** y calcula su hash. Exige ese hash y slug en el D1 de Preview.
4. Si la cookie de Producción llega primero, D1 Preview no encuentra ese token/slug. La nueva cookie válida de Preview llega después y es **ignorada**; incluso renovar la cookie no necesariamente cambia cuál se lee primero.
5. G8.2 agregó el límite `preview_retry=1`: por eso la misma condición ahora termina en HTTP 403 en lugar de `ERR_TOO_MANY_REDIRECTS`. La validación incorrecta no fue arreglada.
6. La captura de Producción corresponde a un perfil distinto, poco antes del fallo de Preview, dentro del TTL de 2h: es evidencia circunstancial muy fuerte, **no equivale a inspeccionar el Cookie header de ese navegador**.

**Reproducción determinista sin credenciales:** header `kawvo_preview_session=production-old; kawvo_preview_session=preview-new`. El parser first-match selecciona `production-old` y falla la validación del hash de `preview-new`. Con header `kawvo_preview_session=production-old; kawvo_free_preview_session_v2=preview-new`, el lector aislado obtiene `preview-new`.

**Fuente normativa:** RFC 6265 §5.4 advierte que el servidor no debe depender del orden cuando existen cookies con el mismo nombre y distinto Domain/Path; MDN documenta la coexistencia.

## Historia y bitácoras

- Regresión estructural presente en la implementación original de la sesión privada de agosto, `72e72415f98e` (26/08/2026) y la renovación Frontdoor `9f367ddc699b` (27/08): ambos leen `kawvo_preview_session`. No se introdujo en G8.2.
- La portabilidad a Producción añadió la bifurcación de Domain sin separar el nombre: revisar commits `97d57069469c` y conciliaciones posteriores.
- Bitácora `BITACORA_MAESTRA_KAWVO_FREE_G1_G5_2_HANDOFF_2026-11-15.pdf`, sección G2.4: el retorno «Volver a edición» requiere URL `?preview=1`, fragmento opt-in y slug correspondiente; no resolver quitando `?preview=1`.
- Bitácora `BITACORA_MAESTRA_KAWVO_HANDOFF_2026-11-02.pdf`, sección 2.4: una barra propietaria falló previamente por diferencia **real** de host de cookie/selección entre app y API. Esto refuerza separar autenticación y navegación, pero es un incidente distinto al token privado Free.
- `web/.env.preview` especifica `VITE_API_URL=https://preview.intaprd.com`; el Web `PublicProfile.tsx` solicita `/api/v1/public/profiles/:slug?preview=1` con credenciales. El dominio API Web no parece ser una causa de cookie cross-site en este candidato.

## Corrección mínima investigada (SIN despliegue)

- En `api/src/free-profile-preview.ts`: **Preview exclusivamente** emite `kawvo_free_preview_session_v2` con Domain `.preview.intaprd.com`; Production continúa usando `kawvo_preview_session` con Domain `.intaprd.com`.
- En `api/src/preview-frontdoor-entry.ts`: validar **solo** la cookie Preview aislada.
- No cambios en generación/TTL de token, DB, perfiles, selección Multicuenta, Auth Google, CORS, App, Web, Production o permissions.
- Añadir regresión al test existente para el caso simultáneo Production + Preview.
- **No** borrar cookies del cliente como reparación del producto: una visita anterior a Producción debe coexistir con Preview.

## Condiciones para cerrar

1. CI del SHA aislado pasa, y se verifica que solo dos archivos API + test cambian frente al candidato G8.2 desplegado.
2. Stage del nuevo módulo + deploy=false preservando 35 bindings y orígenes App/Web ya certificados; readback SHA256 y activación de Preview con recibo, por método JSON de un intento; NO re-stage App/Web.
3. QA autenticada: mismo navegador previamente usado en Producción → Multicuenta Free → Vista previa `?preview=1` carga, «Volver a edición» retorna; borrador protegido; visitante sin acceso.
4. **Pista separada pendiente:** barra propietaria en URL pública: `AppointmentOwnerBar` consulta `app.preview.intaprd.com/api/v1/me/free/appointments/public-context` y Free multicuenta exige coincidencia con cuenta seleccionada. Su resultado no está validado por esta corrección de cookie de vista previa; no anunciarlo resuelto sin QA.

**Nunca usar el resultado de CI/Stage técnico como aceptación funcional.**
