# Kawvo Link — Auditoría profunda final del estado aprobado

Fecha: 2026-09-02
Rama auditada: `fix/restore-approved-location-ux-2026-09-02`
Objetivo: reconstruir el último estado aprobado del producto antes de una nueva promoción a Producción y evitar recuperar funciones de forma aislada.

## Método

La auditoría no se limita a PR #89/#91. Se contrastó el estado actual contra PR y ramas históricas que contienen liberaciones aprobadas, incluyendo Account Center/PWA, `fix/free-mobile-ai-bank-share`, editor visual, Scan-to-Claim, Demo viral/IA, social cards, GEO/SEO, perfiles especiales, BioPests y la normalización de arquitectura Cloudflare. Las ramas divergidas se usan como referencia de comportamiento; no se fusionan completas.

## Estado estático consolidado

| Área | Estado | Criterio final |
|---|---|---|
| Arquitectura Cloudflare | PRESENTE | `web → intap-link → intaprd.com`; `app → intap-web2 → app.intaprd.com` |
| Mi cuenta | PRESENTE | avatar, plan, IA, notificaciones, productos, QR, bancos, invitación, recursos, soporte, logout |
| PWA | PRESENTE | Home PWA, manifest, SW, iconos, instalación desde Mi cuenta, URL e instrucciones iOS/Android |
| Componente PWA histórico `FreePwaInstallPrompt` | SUPERSEDIDO | era huérfano en la rama final PWA; no se restaura |
| Notificaciones | PRESENTE | imágenes, todas/sin leer, detalle, marcar, eliminar y ticket inline |
| SuperAdmin Recursos | PRESENTE | ruta y pantalla recuperadas |
| Eliminación de perfil | PRESENTE | endpoint mobile-safe, limpieza y verificación posterior |
| Bienvenida/onboarding simplificado | PRESENTE | rutas legacy retiradas del flujo normal |
| Scan-to-Claim | PRESENTE | continuidad por scan, confirmación sin secreto manual en flujo moderno |
| AdminGuard | PRESENTE | no consulta scan pending en cada recarga si no existe scan guardado |
| Editor visual móvil | PRESENTE | selector `Editar | Vista previa`, preview real, Guardar y actualizar, Abrir perfil completo, retorno al scroll de edición |
| Foto/portada desde editor | PARCHADO PARA PREVIEW FINAL | debe abrir con `?from=panel` y permanecer en edición al guardar |
| Hero independiente | PRESENTE | persistencia por `free-appearance`; avatar y Hero separados |
| Cuentas bancarias | PRESENTE | máximo 3, entitlement, activar/desactivar, copia y enmascarado |
| Compartir cuentas | PRESENTE | URL canónica `?share=bancos#bancos`, WhatsApp/copiar |
| Graph Card bancaria | PRESENTE | middleware server-side |
| Compartir perfil | PRESENTE | Web Share/copia/QR con URL canónica |
| Graph Card de perfil | PRESENTE | metadata dinámica por slug |
| Invitación | PRESENTE + AJUSTE FINAL | URL personalizada `nfc.kawvoia.com/invitacion?de=PrimerNombre`; preview debe mostrar esa misma URL |
| Graph Card invitación | PRESENTE | middleware `/invitacion` |
| QR | PRESENTE | preview antes de descargar en Mi cuenta y QR público |
| vCard móvil | PRESENTE | apertura directa en iOS/Android; descarga tradicional escritorio |
| Ubicación | PRESENTE | búsqueda dentro de Kawvo, mapa inline, Usar esta ubicación, Usar mi ubicación actual |
| Ubicación canónica | PRESENTE | `contact.map_url` alimenta quick action y perfil público |
| Servicios/Portafolio | PRESENTE | edición de textos e imágenes; límites Free preservados |
| Límites Free | PRESENTE | 3 quick actions / 5 portafolio / 3 servicios |
| Asistente IA | PRESENTE | flujo final simplificado, contexto confirmado, retry estructurado, aplicación segura y confirmación final |
| Demo viral | PRESENTE | snapshot compartible y expiración existente |
| Demo IA | PRESENTE | `/demo/ia`, backend separado y QA exige exactamente 3 servicios |
| CTA Demo | PRESENTE | CTA de Demo se dirige a `/demo/ia` |
| GEO/SEO/LLM | PRESENTE | robots, sitemap, llms, ai.md, facts.json, metadata dinámica |
| Plantillas especiales | PRESENTE | Jason, Novi, 1A, Rentao y AyC en registry |
| Marbella/R2 | CÓDIGO PRESENTE · RUNTIME PENDIENTE | enlace del template y endpoint público R2 presentes; falta comprobar objeto remoto en Preview final |
| BioPests/perfiles protegidos | HISTORIA CONSERVADA | no se reemplazan plantillas/perfiles protegidos durante esta reconciliación |
| Assets onboarding Preview | PARCHADO PARA PREVIEW FINAL | eliminar deployment histórico y usar `preview.intaprd.com` |

## Hallazgos finales que sí requerían corrección

1. `Foto y portada` dentro de Diseño y apariencia todavía apuntaba a la ruta de onboarding sin `?from=panel`.
2. `FreeOnboardingBuilder` y `FreeStarterNativePreview` conservaban un deployment Pages Preview histórico hardcodeado.
3. La acción de Invitación compartía correctamente la URL personalizada, pero la ventana de vista previa mostraba otra URL. Deben ser idénticas.

Los tres ajustes están incluidos en `scripts/apply-final-editor-and-preview-origin-recovery-2026-09-02.py` y se consideran bloqueantes para la Preview integral.

## Hallazgos descartados como falsa regresión

- El antiguo `FreePwaInstallPrompt.tsx` no estaba conectado a `main.tsx`, `App.tsx` ni al Dashboard en el estado final de la rama PWA. La instalación aprobada vive en Mi cuenta; restaurar ese componente sería reintroducir UI obsoleta.
- El editor visual histórico que usaba un perfil público embebido fue sustituido posteriormente por `/api/v1/me/free/profile-preview/:slug`, que conserva sesión y `frame-ancestors` permitidos. La implementación autenticada actual es la final y más segura.

## Referencia adicional: rama `fix/free-mobile-ai-bank-share`

Se revisaron las liberaciones de finales de agosto posteriores a PR #87. El estado actual conserva los cambios aprobados relevantes: flujo IA simplificado, retry de Structured Output, confirmación de servicios, aplicación idempotente/segura, perfil canónico al compartir, feedback de medios, notificaciones de ciclo de vida, normalización de contacto y ajustes de Dashboard. La rama sigue divergida y NO debe fusionarse completa.

## Lo que aún NO puede declararse aprobado sin runtime

La siguiente Preview integral debe comprobar como mínimo:

- compilación App/Web/API y dry-run Worker;
- rutas Mi cuenta/PWA/notificaciones/editor/IA;
- PWA manifest/SW/icono;
- Demo IA y contrato exacto de 3 servicios;
- Graph Cards de perfil, bancos e invitación;
- URL personalizada de invitación;
- ubicación inline y ubicación actual en dispositivo;
- vCard móvil;
- Share/QR del perfil;
- Marbella PDF desde R2 con respuesta no vacía;
- Scan-to-Claim con recurso desechable;
- eliminación con cuenta/perfil desechable;
- robots/sitemap/llms/ai.md/facts.json;
- plantillas especiales sin regresión visual.

## Regla de salida

No promover a Producción mientras exista un elemento `PARCHADO PARA PREVIEW FINAL`, `RUNTIME PENDIENTE` o una prueba funcional crítica sin ejecutar. Producción debe recibir un único estado reconciliado, no parches sucesivos por función.
