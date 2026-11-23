# KAWVO G8 — Revisión integral para publicación directa y cierre del Stage API

**Fecha:** 2026-11-23. **Objetivo:** completar G8 en Producción, no reabrir las fases aprobadas.
**Autoridad:** propietario (autorización de publicar ya consignada), contratos de unificación PR #150/#151/#156/#169/#172, bitácora maestra 23/11, #179/#181/#182/#183, main y evidencia real de Terminal.
**Estado de publicación:** **NO ACREDITADA**; ninguna herramienta creada en este lote activa tráfico.

## 1. Producto: fuente exacta, scope y QA

- Código fuente aprobado e integrado: `71dd92b870482427d8576e68d89c3167bcfe8f12`.
- Último main operativo comprobado: `c846d0e5e1b9dec310f5a037bf91a400791b7267`; los cuatro commits siguientes a fuente añaden/modifican solo `.github/workflows/kawvo-g8-api-stage.yml` (no runtime).
- PR #182, #183 y #179 figuran **fusionados** en GitHub (la indicación histórica "Draft/NO-GO" en documentos es fotografía de la preparación, no el estado actual del PR).
- PR #183 contiene el fix LIVE de primera aceptación médica: `api/src/kawmed-demo-invitations.ts`; concurrencia de UPDATE sin filas afectadas ya no da falso 200. No retocar.
- Delta funcional de activación productiva, exactamente ocho rutas: `api/src/sponsor-inventory-page.ts`, `app/src/components/admin/kawvo-release-host.ts`, `app/src/components/admin/medical/KawMedShellReturn.ts`, `app/src/components/admin/medical/kawmed-guest-shell-navigation.ts`, `app/src/components/admin/medical/kawmed-master-shell-navigation.ts`, `app/src/components/admin/medical/kawmed-shell-navigation.ts`, `app/src/components/admin/sponsored/sponsor-shell-navigation.ts` y `app/src/components/admin/sponsored/sponsored-shell-gate.ts`.
- Los host gates permiten solamente los pares correctos Preview/Producción. Los permisos reales permanecen en backend: doctor/guest/Master/beneficiario/comercial, scope delegado, rol y cuenta activa `kind+id`.
- La entrada API `api/src/preview-free-entry.ts` importa `sponsored-profiles.ts`, que registra `registerSponsorInventoryPage`; por tanto, no falta la ruta G7.1 por omisión del import.
- G7.1: inventario Master de lectura, búsqueda con acentos/palabras, filtros y cursor, sin asignar/editar por la consulta. QA de propietario en dos rondas + aprobación posterior de búsqueda, conservadas en la bitácora.
- G0–G5/G7.1 incluidas. Nuevas UX G6 y G7.2 **fuera**; Kawlink pago/Team actuales se preservan.
- 138 grupos de fixtures y contratos focales previos PASS según #182/bitácora. `quality.yml` CI `45239371896` SUCCESS: builds App/Web, tests, TypeScript y guard; **no sustituye QA autenticada de Producción**. Contratos G8 específicos incluyen `test-kawvo-g8-final-cutover-contract.mjs`, `test-kawvo-g8-production-activation.mjs`, `test-kawvo-g8-production-delta.mjs` y `test-kawmed-live-pending-g8.mjs`.
- El dueño declaró QA de invitado satisfactoria, pero no inventar un log E2E externo del candidato final.

## 2. D1, Cloudflare y reversión

- API Prod: Worker `intap-api`; Preview: `intap-api-preview`; App Pages: `intap-web2`; Web Pages: `intap-link`.
- D1 Prod `intap_db`; Preview `intap_db_preview`. La metadata del esquema G8.5 pasó, pero eso **no implica migraciones nuevas**.
- Las propuestas `0153`/`0154` están en `docs/releases/kawvo-g8-proposed-migrations/`, no se ejecutan ni importan a `api/migrations/` por este despliegue.
- G8.6: manifiesto privado retenido en `~/intap-release-logs/kawvo-g8-backup-udfewy/`, SHA256 `ed2a628ccc59a737c447dd3bf835d0d2df7cdfed5539eceef5fa859f1d10e21c`, API anterior `3d4973e4-e344-493a-a065-93f199b00359`. Elegibilidad nativa API/App/Web PASS; rollback remoto no ensayado.
- Source de API G8 usa `esbuild --bundle --platform=node --format=esm --target=node20 --external:cloudflare:*`; hash exacto obtenido en Mac: `f465c714f3a5b4b3627d58797be32621c674e7056e27ff4c36fbf8e09e96fbd6`.
- La sesión Cloudflare de la Mac lee la cuenta y las versiones sin exponer tokens. GitHub Actions Stage falló GET 403 con token CI; no debe repetirse ni cambiarse el secreto por intuición.
- No alterar triggers, routes, secretos, Projects, D1/R2 ni el origen Preview por un error del uploader.

## 3. Incidente original y causa técnica real del bloqueo operativo

1. Version activa real: `3d4973e4-e344-493a-a065-93f199b00359` al 100%.
2. Última versión existente: `1972228c-4dd7-4ede-9d94-8338132b3b20`, código NO idéntico al G8. Los nombres/tipos de bindings y configuración visibles coinciden con la activa; **los valores secretos no son exportables/comparables**.
3. Uploader inicial bloqueó indebidamente por exigir que *latest* fuera la versión *activa*. Ese supuesto no es válido en el modelo de versiones de Cloudflare.
4. El intento posterior usó la **Beta Workers Versions API** (el endpoint correcto para heredar desde ID específico), hizo preflight PASS y una única solicitud POST que devolvió **HTTP 400**. El ejecutor descartó el código/puntero de error de Cloudflare; no hay prueba para atribuir una causa única a ese 400. Guardó recibo privado antes del POST. **No borrar ese recibo ni reejecutar el mismo POST.**
5. Análisis de contrato oficial: la Beta API crea versiones por JSON `main_module`, `modules[{name,content_type,content_base64}]`, `bindings[{name,type:"inherit",version_id:<UUID>}]` y `deploy=false` (no promoción). `placement` en CREATE no admite arbitrariamente todos los valores devueltos en GET; por ejemplo `mode:"off"` no es una opción documentada de creación. Exportaciones/metadata de lectura también pueden incluir atributos de estado que deben normalizarse. El ejecutor anterior copiaba la configuración GET sin validar cada forma de escritura; **es una discrepancia comprobada del código con el contrato, pero no prueba definitiva de la causa del HTTP 400**.
6. La API antigua `POST /workers/scripts/{name}/versions` usa multipart y `bindings_inherit=strict`, pero su `inherit` solo puede apuntar a *latest*, no a la versión activa seleccionada. Elegirla silenciosamente podría copiar secretos diferentes, aunque sus nombres sean iguales. Por ello se excluye ese atajo.

Fuentes del contrato: https://developers.cloudflare.com/api/resources/workers/subresources/beta/subresources/workers/subresources/versions/methods/create/ ; https://developers.cloudflare.com/workers/observability/errors/ ; https://developers.cloudflare.com/changelog/post/2025-09-03-new-workers-api/ .

## 4. Única corrección operativa preparada

`scripts/release-kawvo-g8-api-p0-once.mjs`:
- Se entrega por SHA de **rama operativa no fusionada**; no toca producto G8 o `main`.
- Concilia el recibo del POST 400 anterior, la cuenta, el SHA G8, aprobación/CI de main, manifiesto privado, versión activa @100%, último ID listado y hash de código exacto.
- Rechaza cualquier actualización remota o recibo final existente antes de escribir.
- Convierte las opciones GET a las formas CREATE admitidas, valida campos y **bloquea los desconocidos**. Omite `placement=off` en vez de enviarlo como valor de CREATE; normaliza las exportaciones sin campos de lifecycle read-only.
- Todos los bindings, incluidos secretos, heredan del **UUID G8.6 exacto**, no del último upload. No se leen ni escriben valores secretos.
- Escribe nuevo recibo privado separado ANTES de una única solicitud `POST .../workers/workers/intap-api/versions?deploy=false`. Ante error conserva código numérico y puntero sanitizados, reconcilia GET de versiones y **no reintenta**.
- Ante éxito exige ID nuevo, readback de módulos/hashes/configuración/bindings y confirma que el tráfico **sigue en G8.6 al 100%**.
- Tests sin red: self-test y simulaciones positivas/negativas de `placement=off`, herencia exacta, deduplicación, metadatos y errores sanitizados; además parseo JS. **No hay prueba contra Cloudflare del nuevo POST** hasta la ejecución autorizada.

Este es el último intento permitido por este ejecutor; si falla por rechazo de API, el código/puntero del error reemplaza las conjeturas y no habrá bucles de nuevas subidas.

## 5. Cutover único, por capas y sin nueva obra

1. **API Stage**: recibo `PASS_STAGED_INACTIVE_VERIFIED` y UUID nuevo. Si BLOCKED, detenerse.
2. **API activar**: acción separada con ID exacto, módulo/bindings/readback; conservar `3d4973e4...` para rollback. Smoke de login, cuenta activa, permisos, invitados, rutas G7.1 y compatibilidad de la UI antigua.
3. **App Pages intap-web2**: build productivo del SHA aprobado, publicar Functions conjuntamente, verificar deployment Production/host exacto, rutas, assets y sesión.
4. **Web Pages intap-link**: mismo criterio, preservar perfiles públicos/retornos, Functions y assets.
5. **QA focal**: Free, médico, invitado, Master, beneficiario, comercial, Team/pago, móvil. Registrar versiones/deployments y rollback disponible.
6. Sin migraciones, seeds o cambios R2 por implicación. G6 y G7.2 permanecen pospuestos. No se repetirán las aprobaciones de etapas ni los 138 fixtures en ausencia de regresión.

**Estado final de esta revisión:** se corrigió y verificó estáticamente el contrato de carga; **NO afirmar que G8 ya sirve Producción** sin los recibos de las cuatro etapas.
