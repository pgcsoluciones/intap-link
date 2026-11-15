# G4 — Consolidación funcional Free (candidato Preview)
15/11/2026. Base funcional aprobada: G3.2, PR #165, d510524960ecbc9aec508b9cb34cf92c0841dc81, log kawvo-g3-2-pages-rUalHcxa. Web G2.4 y Worker Preview original se conservan. No autorización para Producción.

## Auditoría de paridad y decisiones
| Recorrido original | Estado de consolidación G4 |
|---|---|
| Entrada /admin/free desde autenticación, PWA gestionar, onboarding terminado y regresos sin estado | El mismo AdminGuard planScope free verifica sesión, cuenta y onboarding. El componente de entrada deriva al shell solo en build y host App Preview. No se cambian callbacks ni rutas del servidor. |
| Publicar, ocultar y estado de perfil | Se comparte una única operación /me/profile con el panel anterior, y notificación profile-published solo después de éxito. Inicio ofrece publicación/ocultación explícita; conserva requisitos de identidad originales y exige readiness del servidor para publicar. Nada se publica al cargar o navegar. Error profile_incomplete conserva mensaje y actualiza readiness, sin asumir éxito. |
| Identidad, contacto, botones, ubicación, enlaces, portafolio, diseño | Editores existentes. Identidad previa obligatoria para el propietario en las funciones que el dashboard original bloqueaba; miembros Team conservan permisos y requisitos propios. |
| Servicios y cuentas bancarias | Accesos G3.1 conservados y verificación real dentro de cada editor. Servicios no altera la plantilla pública; la ausencia de servicios públicos Free sigue siendo contrato existente. |
| Compartir, vista previa y regreso | Flujos G2 preservados; compartir solo publicado. |
| Agenda y horario | Gestor y configuración existentes en Mi cuenta, sin cambio de API, citas, reglas ni horarios. |
| Notificaciones | Campana original reutilizada, vuelve al origen del shell, lista existente. |
| Cuenta, credenciales, PWA, ayuda, QR, recursos, tickets | Mi cuenta conserva funciones y acciones actuales. PWA home sigue siendo su pantalla específica; su gestión de Free llega al nuevo acceso canónico. |
| Multicuenta | G3.2 sigue exigiendo identidad exacta y tab_token válido. Cambiar cuenta solo se ofrece si la selección Multicuenta está verificada, no a propietarios ordinarios, miembros ni demos. |
| Team, NFC/QR vinculados y ajustes anidados | Permanecen en sus pantallas actuales desde Mi cuenta; no se amplían permisos, inventario ni creación de Team. Los regresos al acceso /admin/free convergen en shell. La autorización existente para cada subruta no cambia. |
| Demos delegadas | Mantienen acceso canónico anterior, delegación y regreso SuperAdmin. El shell no añade publicación para demos. |
| Recorrido guiado previo y acceso interno SuperAdmin | Disponibles en panel anterior explícito; no migrar recorrido específico ni paneles administrativos en este lote. |
| Funciones avanzadas, upsell, marca de agua y candados Plus | Pendientes de mejora futura acordada; ninguna clasificación comercial, precio, derecho o permiso nuevo. |

## Alcance y recuperación
En App Preview el acceso canónico /admin/free converge a /admin/free/shell-preview?kawvo_shell=1 tras guard existente. Más > Abrir panel anterior o /admin/free?legacy=1 mantiene salida de respaldo deliberada; fuera del host/build Preview la entrada original permanece. No usar este parámetro para conceder permisos. Demos delegadas siguen su ruta anterior. No modificar App.tsx, AdminGuard, selector Multicuenta, Web público, API, Worker, OAuth, D1/R2, producción, otras categorías, ni CLAUDE.md/README.md. Se ajustan cinco contratos estáticos que exigían deliberadamente opt-in manual/retorno legacy o ubicación anterior de la operación; se conservan y refuerzan sus protecciones y se suma G4.

## QA antes de aceptar G4
1. Usuario Free existente: iniciar sesión sin URL experimental, entrar /admin/free, abrir módulos y retornar, notificaciones, logout y móvil 320px.
2. Perfil de prueba borrador incompleto: requisitos visibles, bloqueos por identidad, compartir/publicar no ofrecidos prematuramente; completar datos y revisar previa.
3. Perfil de prueba listo: publicar por botón explícito, verificar estado y perfil público; ocultar y verificar estado; restaurar estado original de la cuenta de prueba. No modificar perfiles reales sin su titular. Si error de servidor, UI no debe mostrar éxito; no duplicar notificaciones.
4. Multicuenta: Free, Agenda, regreso, cambio a otro tipo y sesión anterior protegida; propietario ordinario no ve Cambiar cuenta.
5. Team, demo delegada y PWA: comprobar permisos y sus recorridos con cuentas de prueba si disponibles; fallback explícito, otros tipos de cuenta sin cambio.
6. Build/preflight App, alias y origen inmutable G3.2, Web G2.4 y Worker intactos. Stage y App Preview únicamente si todos los gates aprueban.
Aún falta ejecución real en Mac y QA. No afirmar que las pruebas estáticas equivalen a E2E.

## Roadmap acordado
Tras validación G4, preparar candidato de Producción aislado de Free, comparando contra main actual y despliegue real de Producción (no promover toda la rama de Preview a ciegas). Se requiere habilitar entrada y retornos en producción de forma acotada, probar flujos, identificar diferencias de Web/App vigentes, plan de recuperación, autorización explícita y QA E2E. No se ha preparado ni publicado ese release todavía. Después, Plus, Patrocinado, Kawmed, Master y consolidación de Multicuenta, por tipos de cuenta y con Preview antes de Producción. No anticipar esas migraciones.
