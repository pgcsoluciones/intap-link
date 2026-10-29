# Reconciliación patrocinado — publicación (2026-10-29)

Estado: **diagnóstico de código**, no validación funcional en navegador. No se desplegaron cambios.

## Evidencia
- `app/src/components/admin/sponsored/SponsoredDashboard.tsx` envía PATCH para guardar y POST publish/unpublish. Si POST responde ok, muestra éxito y recarga sin comparar de manera explícita `GET /me/sponsored-profile` con el perfil objetivo y estado esperado.
- La rama `fix/sponsored-confirm-publish-2026-10-29` contiene validación de GET e identidad y **no fue aprobada para Producción**; no promover automáticamente.
- `api/src/sponsored-profiles.ts` usa `resolveOwnedSponsoredProfile(c,userId,sponsoredProfileScope(c))` en las rutas POST publish y unpublish. La función de `api/src/sponsored-profile-scope.ts` distingue Master (scope=master), beneficiario normal y multicuenta según selección activa.
- `api/src/sponsored-owner-flow.ts` contiene otra implementación de ruta publish; verificar importación/orden de rutas antes de atribuir la ejecución a una u otra.

## QA real pendiente (sin activar ni borrar productos)
1. Entrar al beneficiario concreto en Producción y registrar nombre o ID del perfil y estado inicial.
2. Pulsar Publicar una sola vez, registrar mensaje y estado de la misma cuenta tras recarga y retorno al panel; verificar URL pública en otra ventana.
3. Si permanece borrador, capturar pestaña Network para POST publish y GET sponsored-profile (sin cookies ni tokens), incluyendo códigos HTTP, respuesta ok/status/id, query scope/profile_id, ocultando emails.
4. Si pasó a publicado, probar despublicar y republicar el mismo perfil; repetir verificación y revisar que otros perfiles no cambian.
5. Contrastar secuencia y UX con Preview aprobado antes de cambiar API o interfaz.

## Restricciones
No rediseño, no nuevos datos, no cambios en D1, no reutilización de IDs. El mensaje \"publicado\" no es evidencia suficiente; exigir GET del mismo ID y estado real.
