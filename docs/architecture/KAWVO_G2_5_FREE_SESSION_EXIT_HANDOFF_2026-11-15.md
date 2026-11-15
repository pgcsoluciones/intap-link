# G2.5 — Cerrar sesión desde el panel Kawvo Free (15/11/2026)

## Alcance y origen
G2.4 App+Web Preview está publicado según el log `~/intap-release-logs/kawvo-g2-4-pages-A6GfUYz0` (commit 8e7b95e26c7ed4561d6c7d459327259d9ac7edfe). La auditoría posterior 15/15 PASS y QA local PASS corresponde a la base de trabajo 0760f72e093866d488cc73e92ab99b57ca56aadb; los árboles de código de aplicación son iguales. El propietario observó el nuevo panel y solicitó una salida de sesión visible. No se da por acreditada la totalidad de QA funcional de G2.4.

## Cambio
- Escritorio: botón Cerrar sesión al pie del menú lateral, siempre accesible; sidebar con scroll vertical si falta altura.
- Móvil: mismo componente dentro de Más, sin añadir otro botón a la navegación inferior.
- Reutiliza el endpoint existente POST /auth/logout y /admin/login. Únicamente por clic explícito; el backend existente revoca su sesión. Espera respuesta ok antes de redirigir; si falla, muestra aviso e invita a reintentar.
- Demo Free delegada: usa clearFreeDemoDelegation y retorna a /superadmin/free-demos sin cerrar la sesión de SuperAdmin, igual que FreeAccount.
- No se alteran FreeAccount, AdminGuard, OAuth, rutas, API, D1, R2, bindings, Web público ni Producción. La única escritura funcional es la revocación de sesión por el endpoint existente cuando el usuario decide salir; no hay nuevas escrituras de perfil ni migraciones.

## Método
Rama independiente G2.5 desde G2.4; PR Draft. Exactamente cinco archivos nuevos/modificados frente a esa base. CLAUDE.md, README.md y contrato operativo sin cambios. Asistente prepara y versiona, propietario ejecuta build/credenciales/QA. Contratos acumulativos existentes + contrato de salida; compilación solo App. Runner preflight por defecto, sin stages ni publicaciones. Verificación de inmutables App/Web G2.4, Worker y 35 bindings. Publicación App Preview solo en modo explícitamente autorizado; Web no se despliega. Si falla cualquier control, detener. Tras publicación: verificar escritorio, móvil, acceso tras volver a login y demo delegada si está disponible; revisar regresión de navegación G2.4. No hay merge ni autorización de Producción.

## Estado
Código preparado, pendiente ejecutar QA/build y preflight real en Mac. G2.4 permanece activo hasta publicación expresa de G2.5.

## Recuperación del Stage existente — 15/11/2026
Preflight 15/15 PASS y contrato G2.5, build, Worker y snapshots PASS (`kawvo-g2-5-pages-BIrGzZCE`). Primera publicación autorizada alcanzó Stage pero devolvió HTTP 404 antes de tocar el alias activo (`kawvo-g2-5-pages-lYm3H6w1`). Diagnóstico posterior del propietario: Wrangler confirmó deployment completo en `https://fa6fde1d.intap-web2.pages.dev` y alias aislado `https://qa-kawvo-g2-5-session-1115.intap-web2.pages.dev`; raíz y /admin/login ahora HTTP 200. Compatible con disponibilidad temporal, no prueba concluyente de causa interna. Advertencias de macOS y wrangler.toml no impidieron el upload. El 200 solo no basta. El runner permite reanudar mediante KAWVO_G2_5_REUSE_STAGE=SI, fijando SHA original a8974afc3d913d33903f815c079f6dd2acc85283 y log/URL evidenciados; exige árbol de aplicación idéntico, reejecuta auditoría, build, comprobaciones de Worker, alias, snapshots y coincidencia exacta del JS remoto con build local. Verifica alias Stage y conserva App/Web G2.4 antes de publicar. Reintentos HTTP acotados para futuros stages. No se vuelve a subir Stage en modo reutilización. Solo se podrá publicar App Preview con autorización explícita y todos los gates PASS. G2.4 todavía activo según evidencia; QA funcional G2.5 pendiente. Solo scripts y documentación modificados; contrato operativo intacto.
