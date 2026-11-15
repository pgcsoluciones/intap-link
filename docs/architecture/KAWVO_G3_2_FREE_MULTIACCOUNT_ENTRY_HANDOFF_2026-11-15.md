# G3.2 — Continuidad del panel Free desde Multicuenta
15/11/2026. Base G3.1 publicada en App Preview (c7b4ccd2330a888118b84e9e0ff38cb00748d25a, log kawvo-g3-1-pages-MyHjnriq). Propietario reporta QA: acceso directo Free llega al nuevo panel; selección Free desde Multicuenta llega al original y los módulos vuelven al original. No se infiere aprobación completa del recorrido Multicuenta.

## Causa y solución
El selector usa la ruta canónica /admin/free devuelta por la selección autenticada. En App Preview exclusivamente, si el servidor confirma kind free e ID exacto elegido, token válido y ruta canónica, el selector usa el opt-in existente /admin/free/shell-preview?kawvo_shell=1. La selección, cookie, token por pestaña, validación de dueño y guard se mantienen. Las demás categorías, activaciones y rutas de producción no cambian. No se selecciona desde un URL ni desde history.state.

El home-route de Multicuenta devuelve el directorio incluso con cuenta seleccionada. Para no perder Agenda, el shell resuelve este caso mediante GET existente /me/intapcard/active-account, exigiendo tab_session_valid, kind free, ruta y mismo ID de /me; si no verifica, muestra error. No hay nueva escritura ni cambio de permisos. Los módulos abiertos desde el nuevo shell ya conservan retorno G2 por estado de navegación y cuenta. El panel original continúa accesible expresamente mediante Panel actual.

## Verificación y límites
Dos componentes de aplicación, pruebas acumulativas, runner App-only y esta nota. Base inmutable G3.1; Web G2.4 y Worker 35 bindings preservados. Sin cambios API, Worker, Web, OAuth, D1/R2, guards, contrato operativo ni Producción. Pendiente build/preflight y QA autenticada: Multicuenta > Free > Perfil > editor > Volver, Agenda, cambiar a otra categoría, acceso directo y salida. Funciones avanzadas y candados Plan Plus siguen diferidos. No merge ni despliegue de producción.
