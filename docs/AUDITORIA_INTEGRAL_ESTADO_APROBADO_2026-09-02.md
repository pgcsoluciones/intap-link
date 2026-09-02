# Kawvo Link — Auditoría integral de estado aprobado

Fecha: 2026-09-02

Rama de auditoría: `fix/restore-approved-location-ux-2026-09-02`

Base productiva auditada: `main` en `7588f02db0df1d2c2dd9e542d1ec89c3d4af55c9`

## Regla de trabajo

Esta auditoría no toma una sola rama como fuente de verdad. Reconstruye el estado de producto a partir de PRs aprobados, ramas que terminaron en runners/releases autorizados, commits de QA y el `main` actual. No se fusiona una rama lateral completa cuando está divergida: se recupera únicamente el comportamiento aprobado que falte, preservando cambios posteriores válidos.

Producción permanece congelada hasta que esta matriz y el QA integral de Preview estén cerrados.

## Estados

- `PRESENTE`: comportamiento aprobado localizado en el estado actual.
- `RECUPERADO`: regresión confirmada y restaurada en esta rama.
- `REGRESIÓN`: comportamiento aprobado ausente o degradado; requiere recuperación.
- `SUPERSEDIDO`: existe un comportamiento posterior aprobado que reemplaza el anterior.
- `QA`: código presente, pero falta validación de ejecución/visual en Preview.
- `AUDITANDO`: todavía no se cierra la comparación.

## Matriz

| Área | Fuente aprobada principal | Estado | Evidencia / criterio |
|---|---|---|---|
| Arquitectura Pages | PR #92 | PRESENTE | `web → intap-link → intaprd.com`; `app → intap-web2 → app.intaprd.com`. |
| Mi cuenta | PR #91, PR #95 | PRESENTE / QA | Ruta y pantalla recuperadas en main; falta QA integral de esta auditoría. |
| Notificaciones | PR #91, PR #95 | PRESENTE / QA | Centro, media y detalle/ticket recuperados; falta QA integral. |
| Recursos SuperAdmin | PR #91, PR #95 | PRESENTE / QA | Ruta `/superadmin/resources` recuperada. |
| PWA Home/instalación | PR #91, PR #95 | PRESENTE / QA | Home, manifest, SW e iconos recuperados; respetar reverts aprobados posteriores. |
| Eliminación mobile/PWA | PR #89, PR #95 | PRESENTE / QA | Endpoint seguro + verificación posterior recuperados; probar solo con perfil desechable. |
| Bienvenida/onboarding simplificado | PR #89, rama `fix/free-mobile-ai-bank-share` | PRESENTE / QA | Debe convivir con Scan-to-Claim y no reintroducir códigos manuales al cliente. |
| Scan-to-Claim | PR #80 + refinamientos posteriores | PRESENTE / QA | No sustituir con onboarding legacy; probar producto de prueba completo. |
| Editor visual unificado | PR #85, #86 | PRESENTE / QA | Editor, preview embebida, identidad/plantilla/paleta y Hero deben conservarse. |
| Cuentas bancarias | PR #85 | PRESENTE / QA | CRUD, máximo 3, máscara, copia, toggle, entitlement y sección pública. |
| Compartir bancos desde Mi cuenta | PR #91 | PRESENTE / QA | Usa `?share=bancos#bancos`. |
| Graph Card bancaria server-side | rama `fix/free-mobile-ai-bank-share`, PR #91/reconciliación | PRESENTE / QA | Middleware reconoce `share=bancos` y genera metadata específica. |
| Compartir bancos desde perfil público | rama `fix/free-mobile-ai-bank-share` | RECUPERADO | Regresión: main compartía `#bancos` sin `?share=bancos`. Restaurado en commit `f6fc4339e64ff01357fd03287ae63e3cf33a78d0`: WhatsApp + copiar enlace canónico. |
| Compartir perfil / Graph Card normal | PR #78 + frontdoor/SEO dinámico | PRESENTE / QA | Metadata dinámica por slug usa título, bio y hero/galería/avatar; falta smoke real con slug. |
| Invitación / Graph Card | PR #91 | PRESENTE / QA | `/invitacion` y metadata recuperadas. |
| QR perfil | PR #91 | PRESENTE / QA | Preview antes de descarga. |
| vCard móvil | release aprobada + PR #95 | PRESENTE / QA | Apertura directa mobile, descarga desktop. |
| Ubicación canónica | release aprobada + PR #95 + hotfix 2026-09-02 | RECUPERADO / QA | Estado reparado; volver a probar editor → botón público. |
| Demo viral/social cards | PR #81 | PRESENTE / QA | Snapshots 24h y social cards; verificar que Demo IA no lo rompió. |
| Demo IA | release 2026-09-01 + PR #95 | PRESENTE / QA | `/demo/ia` y endpoint independientes; exactitud de 3 servicios queda como guard a fortalecer. |
| Asistente IA de perfil | PR #87 + rama `fix/free-mobile-ai-bank-share` | REGRESIÓN CONFIRMADA / AUDITANDO | Main conserva versión anterior: 1800 output tokens; rama aprobada posterior usa 2400 y retry interno estructurado. También difiere UX final. Recuperar selectivamente tras revisar todo el delta final. |
| Upload imágenes Portafolio/Servicios | rama `fix/free-mobile-ai-bank-share` | PRESENTE | Main ya contiene feedback `Procesando/Subiendo imagen` y cierre del crop; no duplicar. |
| CTA Plan Básico / edición | rama `fix/free-mobile-ai-bank-share` | AUDITANDO | Comparar estado final contra Account Center/Plan Plus posterior antes de restaurar. |
| Lifecycle notifications / first-run | rama `fix/free-mobile-ai-bank-share` | AUDITANDO | Comparar commits Aug 29–30 contra Account Center posterior. |
| GEO/SEO/LLM discovery | PR #78 | PRESENTE / QA | `robots`, `sitemap`, `llms`, `ai.md`, `facts.json`, JSON-LD y fallback semántico; smoke integral pendiente. |
| Perfiles especiales | PR #77, #75 y correcciones BioPests | PRESENTE / QA | Registro de plantillas y perfiles aprobados; QA por slugs pendiente. |
| Marbella/R2 | PR #77 + `fix/restore-social-cards-and-marbella-download` | AUDITANDO | Verificar descarga productiva/preview y no reintroducir asset pesado en Pages. |
| Hero Impacto | PR #82/#83 | PRESENTE / QA | Foto y Hero independientes + persistencia `free-appearance`. |
| Admin reload/scan guard | PR #84 | AUDITANDO | Verificar que main aún evita `/scan/pending` sin código guardado y elimina storage obsoleto. |
| Límites Free | PR #76/#85 | PRESENTE / QA | 3 acciones, 5 imágenes, 3 servicios y requisitos de publicación; validar. |

## Hallazgos que explican la regresión bancaria

La infraestructura server-side de la Graph Card bancaria sí estaba en `main`, y `Mi cuenta` sí producía la URL correcta con `?share=bancos#bancos`. La regresión estaba en el componente público `PublicBankAccounts`: al compartir generaba solo `/{slug}#bancos`, por lo que la condición `share=bancos` nunca se activaba. Se restauró el comportamiento final aprobado desde `fix/free-mobile-ai-bank-share`.

## Hallazgo adicional: Asistente IA posterior a PR #87

La rama `fix/free-mobile-ai-bank-share` termina con runner/orígenes de release aprobados y contiene refinamientos posteriores al merge de PR #87. El `main` actual no contiene al menos estas garantías finales:

- `MAX_OUTPUT_TOKENS = 2400` en lugar de 1800;
- retry interno cuando el Structured Output llega inválido/incompleto;
- error controlado `ai_incomplete_after_retry` después del segundo fallo;
- ajustes posteriores de UX y confirmación.

No se copiará el archivo completo hasta terminar el diff funcional, porque la rama diverge del `main` actual y deben preservarse Demo IA y cambios posteriores.

## Runner Preview

El runner anterior de reconciliación tenía nuevamente invertidos los proyectos Pages. En esta rama quedó corregido:

- App Preview → `intap-web2`;
- Web Preview → `intap-link`;
- se añadió guard estático para exigir `?share=bancos#bancos` en el perfil público;
- se amplió el smoke a `robots.txt`, `sitemap.xml` y `llms.txt`;
- el checklist visual ahora incluye Graph Cards, Scan-to-Claim, editor, IA y discovery.

## Criterio de cierre antes de Producción

1. Cerrar todos los renglones `REGRESIÓN` y `AUDITANDO`.
2. Build App/Web/API y Worker dry-run verdes.
3. D1 Preview sin migraciones inesperadas.
4. Deploy únicamente a Preview con la topología canónica.
5. QA funcional y visual de la matriz completa.
6. Confirmar que Producción no fue tocada durante la auditoría.
7. Solo entonces solicitar una nueva autorización explícita para Producción.
