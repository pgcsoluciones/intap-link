# BITÁCORA FORENSE · KAWVO LINK / KAWMED / FREE / PATROCINADO
Fecha: 2026-10-29 · Estado: diagnóstico parcialmente confirmado; correcciones parciales en rama, NO desplegadas.
Repositorio: pgcsoluciones/intap-link
Rama de trabajo: feature/kawvo-sponsor-commercial-controls-2026-10-27
PR: #126 (NO fusionado a main).
Producción: 2026-10-29 se desplegó commit 0994d9e5 y Worker intap-api versión 7708f331-a575-40eb-82a7-a491a5a25e22. Frontends publicados en los proyectos canónicos: web=intap-link, app=intap-web2.
Respaldo D1 previo a la release: ~/intap-release-logs/kawvo-production-20261029T050318Z/intap_db_before_release.sql. Migraciones 0153 y 0154 aplicadas a D1 Producción. /api/health devolvió 200 con status=healthy, environment=production, worker=intap-api en intaprd.com, app.intaprd.com y api.intaprd.com. La raíz api.intaprd.com/ devolvió HTTP 503, pero no es la ruta de salud efectiva. Verificar cada comportamiento real con sesión.

## Reportes del usuario (no declarar arreglados sin validación)
1. Perfil KawMed independiente sin recordatorio de publicar.
2. Perfil KawMed en borrador sin vista previa visible.
3. «Vista previa» junto a «Cambiar cuenta» en multicuenta no responde perceptiblemente.
4. Textos médicos deben decir «Centros de atención» y «Horario de atención» de forma coherente.
5. Perfil patrocinado muestra aviso de que puede publicarse pese a que el usuario observa información pendiente.
6. Patrocinado en multicuenta no permite publicar aun con requisitos mínimos completos.
7. «Notificaciones · Próximamente» aparece en patrocinado.
8. Barra de navegación patrocinada falta para sesión de administrador multicuenta.
9. Perfil patrocinado pasa publicado→borrador, pero no vuelve a publicarse.
10. Free no tiene aviso automático de publicación al completar mínimos.
11. Auditoría de regresión e integración histórica de ramas aprobadas Preview vs lo efectivamente publicado en Producción.

## Hallazgos basados en código (29 octubre)
- `app/src/components/admin/sponsored/SponsoredDashboard.tsx`: `essentials` exige nombre/cargo/usuario/foto/portada; `canPublishNow` mira username/business_name/specialization/what_we_do/contacto. No representan idéntico significado de «completo». La API `api/src/sponsored-profiles.ts` exige usuario, nombre, especialización, qué hacemos y contacto para publicar (HTTP 422 con `missing`).
- Mismo dashboard: navegación «Cambiar cuenta» condicionada a respuesta exitosa de `/me/intapcard/active-account` tipo sponsored, y a no ser master. En contexto de `profile_id` explícito, puede ocultar la navegación si falla la detección.
- `togglePublish` llama `/me/sponsored-profile/publish|unpublish` con `profileScopeQuery`. No existe prohibición explícita de volver a publicar en el handler; requiere reproducir fallo con sesión, `profile_id`, estado de guardado y respuesta HTTP exacta. NO inventar causa ni modificar registros para “probar”.
- `app/src/components/admin/medical/MedicalDashboard.tsx`: vista privada existe con estado `previewOpen`; estaba renderizada al final de la página y no como ventana superpuesta, haciendo posible que el clic no produzca cambio visible. La API médica exige nombre/especialidad/slug para publicar. El checklist ampliado 5/5 contiene recomendaciones y no debe presentarse como bloqueo.
- `app/src/components/admin/free/FreeDashboard.tsx`: ya hay requisitos para publicación, control manual y advertencia de campos faltantes, pero no recordatorio automático equivalente.
- «Notificaciones · Próximamente» en patrocinado es marcador literal presente en el código y bitácora previa; no hay evidencia de que una función previamente operativa se haya roto.
- Comparación main frente a rama comercial arrojó ~93 commits adicionales en la rama a la fecha de auditoría; NO equivale a auditoría histórica exhaustiva de cada PR. Release productiva fue por rama directamente, sin integrar todavía a main. Riesgo de regresión en próximo deploy desde main.

## Trabajo realizado en la rama DESPUÉS del despliegue productivo
- Commit `edefc90d`: en SponsoredDashboard se alinea la detección de mínimos guardados con campos requeridos por la API, se conserva «Cambiar cuenta» si hay `profile_id` explícito y se aclara la naturaleza de datos obligatorios frente a foto/portada recomendadas. **NO certifica el ciclo de publicación multicuenta.**
- Commit `6d10e5b1`: MedicalDashboard pasa vista previa a superposición visible y añade aviso de preparación de publicación para scope doctor, con «Revisar publicación» y «Más tarde». **Pendiente de compilación/prueba de UX**.
- Ninguna de estas correcciones posteriores está verificada en Producción; NO desplegar hasta completar QA.
- Free: aviso equivalente **pendiente de implementación**. Textos médicos: auditoría completa de cadenas **pendiente**. Multicuenta publicación/despublicación: diagnóstico autenticado **pendiente**.

## Plan de corrección y aceptación
1. Ejecutar TypeScript, compilaciones, pruebas de contrato y QA visual en Preview para los commits nuevos; corregir cualquier fallo.
2. Trazar en sesión autorizada la cuenta activa `kind`, `profile_id`, peticiones publish/unpublish y respuestas de API, sin exponer cookies/tokens ni datos de terceros.
3. Probar patrocinado (incluyendo sesión de administrador y beneficiario) borrador→publicado→borrador→publicado, barra visible, estado del perfil correcto, requisitos sincronizados y mensajes específicos.
4. Probar KawMed independiente y multicuenta: vista previa de borrador, aviso al cumplir 3 mínimos, «Más tarde», publicación/despublicación; verificar centros y horarios.
5. Añadir aviso Free basado en `effectivePublishReady` y estado guardado, no repetirlo en bucle; probar ciclos de publicación y aislamiento entre cuentas.
6. Reconciliar inventario de PR/ramas Preview aprobadas con main, rama activa y despliegues productivos; clasificar cada diferencia como aprobado/pendiente/no integrado. No fusionar ramas enteras indiscriminadamente.
7. Solo tras aprobación formal, respaldo D1 Producción y release incremental aislada; comprobar que bundles reales coincidan con deploy y API funcional. Evitar nueva migración 0153/0154 sin necesidad.
8. Registrar commits finales, enlaces Preview, resultados de QA, versión Worker y respaldo al cerrar.

## Política operativa
No hacer deploy productivo, mutación D1, merge PR ni declarar «resuelto» por pasar build. Distinguir código implementado, pruebas aprobadas, despliegue y pruebas funcionales reales.
