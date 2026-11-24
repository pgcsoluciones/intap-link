# KAWVO — Contrato operativo de promoción App al Preview oficial

**Contrato:** KAW-PREVIEW-APP-001  
**Fecha de registro:** 2026-11-24  
**Evidencia:** recuperación G7.1 (2026-11-23) y promoción real G8.1 (2026-11-24).  
**Estado:** método **verificado para App en Preview oficial** mediante el recuperador probado G7.1; **no constituye** permiso de Producción, ni certifica QA autenticada o rollback ejecutado.

## 1. Regla normativa

Para que la App pueda probarse con Google Login, cookies host-only, gates del shell y Multicuenta, el destino de QA es **`https://app.preview.intaprd.com`**, no un alias `.pages.dev`. Subir una rama de Pages **no conmuta automáticamente** ese dominio. El frontdoor `intap-api-preview` tiene un binding `APP_PAGES_ORIGIN` que decide qué deployment inmutable de `intap-web2` se sirve.

**Procedimiento obligatorio:** reutilizar el recuperador G7.1 comprobado, `scripts/recover-kawmed-g7-1-search-preview.mjs`, como **plantilla de operaciones y guardas**, nunca ejecutarlo directamente con hashes G7.1 obsoletos. Para G8.1, adaptación concreta auditada: `scripts/recover-kawvo-g8-1-official-preview.mjs` en commit `8144b535ea56c9042dfe22fd4b0f6d79458bf824`. **No reutilizar el archivo G8.1 para releases futuras**, porque sus versiones, URLs y hashes están fijados. Cada promoción requiere un snapshot real nuevo, validación y referencia inmutable.

No fabricar otro uploader alternativo ni sustituir el método validado por multipart. El intento G8.1 de `scripts/promote-kawvo-g8-1-official-preview.mjs` con `POST /workers/workers/intap-api-preview/versions?bindings_inherit=strict` y `multipart/form-data` recibió **HTTP 415/code 10001**. El promotor anterior G7.1 también sufrió una carga ambigua por esa familia de operaciones. **No reintentar un POST ambiguo**; primero reconciliar mediante solo lectura.

## 2. Contrato de seguridad por fases

1. **Congelación y autorización:** aprobar el lote, SHA, proyecto y alcance App-only/Preview; registrar propietario, Worker, URL antigua, origen nuevo y ruta de recuperación. No mezclar Web/API/D1/R2/Producción.
2. **Stage Pages App aislado:** construir desde SHA fijado y subir *una sola vez* el artefacto App con sus Functions al proyecto `intap-web2`, rama no productiva. Conservar URL inmutable real, commit, origen y bundle JS; no reconstruir ni repetir Stage válido. No confundir alias de rama, deployment inmutable ni dominio Google OAuth.
3. **Forense read-only:** GET de `/workers/scripts/intap-api-preview/deployments` y de versión activa con `?include=modules`; confirmar **una sola versión al 100 %**, `ENVIRONMENT=preview`, **35 bindings sin duplicados** (entre ellos D1 `DB` y R2 `BUCKET`), **un módulo** legible, runtime y `APP_PAGES_ORIGIN` antiguo esperado. GET del listado completo de versiones; no suponer que el último upload está activo.
4. **Comparación Web/Pages:** GET del HTML login del Preview oficial y del deployment App inmutable, contrastar los hashes de los bundles conocidos. Si cualquiera difiere de la referencia esperada, **BLOCKED**.
5. **Marcadores privados:** preservar `attempt.json`, `upload-attempt.json` y cualquier respuesta; el recuperador confirma ausencia de `new-version.json`, `activation-attempt.json`, `receipt.json` o `recovery-attempt.json` antes de su primer POST. Los logs contienen metadatos y no deben incluir secretos ni difundirse. Un `ready:false` por **intento existente** en el promotor inicial es esperado después del HTTP 415; no significa permiso para borrar los marcadores.
6. **Recuperación de carga:** una vez reconciliado que no existe versión candidata inesperada, ejecutar **una sola vez** el equivalente aprobado de `--resume`. Guardar `recovery-attempt.json` **antes** del POST. Usar `POST /workers/workers/intap-api-preview/versions?deploy=false` con **JSON**: `main_module`, `modules` originales, runtime/compatibilidad intactos, **34 bindings heredados de la versión activa por ID** y solo `APP_PAGES_ORIGIN` nuevo como `plain_text`. Guardar `recovery-upload-response.json` tanto para éxito como error.
7. **Readback preactivación:** GET de la nueva versión `?include=modules`; verificar SHA-256 de los bytes de todos los módulos, mismo módulo principal, flags/runtime, 35 bindings y **solo** el cambio de origen. Comprobar que el Worker activo y el bundle del dominio oficial todavía son los anteriores. **Nunca activar `latest`**.
8. **Activación explícita:** escribir `activation-attempt.json` y realizar un único `POST /workers/scripts/intap-api-preview/deployments` con `strategy=percentage`, `versions:[{version_id:<ID validado>,percentage:100}]`. Guardar `recovery-activation-response.json`. Si respuesta es ambigua, **NO REPETIR**.
9. **Recibo final:** GET de despliegue/versiones/bindings activos y bundle real de `https://app.preview.intaprd.com/admin/login`. Solo registrar `PASS` si coinciden **ID activo**, **origen esperado** y **bundle esperado**; conservar `receipt.json` con IDs viejo/nuevo y URLs. **PASS de plataforma no equivale a QA autenticada** de Free, Master, Kawmed, Multicuenta ni Graphik Card.
10. **Rollback:** preservar versión anterior y su origen. Ante incidencia, investigar recibo y estado activo; revertir únicamente al ID anterior acreditado, tras autorización y verificación de que la versión nueva sigue activa. Readback obligatorio. El rollback remoto no fue ensayado como parte de esta promoción; nunca afirmar lo contrario.

**Entorno Mac:** usar `nvm use 22.12.0` antes de Wrangler 4.166.0 y cualquier script de recuperación. `wrangler whoami` debe ejecutarse fuera del árbol con `wrangler.toml` legado que contiene `node_compat`; el recuperador probado G8.1 usa `cwd:tmpdir()` únicamente para autenticación. Los scripts ES module leídos con `git show` requieren `node --input-type=module --check` para sintaxis y `node --input-type=module - --check|--resume` para ejecución; `node --check` a secas por stdin los interpreta como CommonJS. La compilación del App puede utilizar la versión de Node indicada por su propio contrato; el requisito Node 22.12 aplica aquí al Wrangler empleado.

## 3. Evidencia G8.1 verificable (no copiar como parámetros para la próxima promoción)

| Campo | Valor recibido del operador |
| --- | --- |
| Repositorio / PR | `pgcsoluciones/intap-link`, [PR #189](https://github.com/pgcsoluciones/intap-link/pull/189) |
| Stage App | `https://612b7245.intap-web2.pages.dev` |
| Bundle antiguo en dominio oficial | `/assets/index-D25-Z3tL.js` |
| Bundle nuevo | `/assets/index-CRNEulvk.js` |
| Worker Preview previo (100 %) | `9c63a559-49be-4617-bf69-2acd6d035589` |
| Origen previo | `https://457b0c1b.intap-web2.pages.dev` |
| Incidente inicial | `HTTP 415` en uploader multipart; marcadores previos preservados |
| Inspección posterior | Worker previo y bundle antiguo intactos; listado sin versión G8.1 inesperada; ausencia de recibo y activación previa |
| Recuperador aplicado | `scripts/recover-kawvo-g8-1-official-preview.mjs`, commit `8144b535ea56c9042dfe22fd4b0f6d79458bf824` |
| `--check` | `ready: true`, `candidateVersions: []` |
| `--resume` | `result: PASS`, `method: PROVEN_G7_1_JSON_RECOVERY` |
| Worker Preview nuevo | `eac200b1-1268-41d4-b651-60a22b1bb076` |
| Dominio oficial comprobado | `https://app.preview.intaprd.com` sirviendo `/assets/index-CRNEulvk.js` |
| Producción | No intervenida por el recuperador; su booleano `productionUntouched` no reemplaza auditoría independiente |
| QA con Google/roles/Graphik | **Pendiente** tras PASS de publicación |

El recibo anterior fue proporcionado por el operador desde su Mac. El documento no certifica por sí solo una consulta remota independiente ni sustituye el recibo local privado `~/intap-release-logs/kawvo-g8-1-preview-app-612b7245/receipt.json`.

## 4. Referencias normativas e histórico

- [Runbook release G8](KAWVO_G8_RELEASE_RUNBOOK_2026-11-23.md), sección 4. Esta sección de G8 estaba redactada antes de la ejecución de G8.1 y debe leerse junto con este contrato posterior.
- [Contrato maestro G8](../architecture/KAWVO_G8_MASTER_RELEASE_UNIFICATION_2026-11-23.md), identidad de cuentas, alcance por fases y no producción.
- `scripts/promote-kawmed-g7-1-search-preview.mjs`: evidencia del intento antiguo y de sus modos de inspección/rollback, **no plantilla de POST para nuevas promociones**.
- `scripts/recover-kawmed-g7-1-search-preview.mjs`: **plantilla canónica de recuperación JSON verificada** (G7.1).
- `scripts/recover-kawvo-g8-1-official-preview.mjs`: instancia histórica aplicada con PASS (G8.1), **no reutilizable sin actualización integral**.
- [Cloudflare Workers Versions API](https://developers.cloudflare.com/api/resources/workers/subresources/beta/subresources/workers/subresources/versions/methods/create/) y [Deployments API](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/deployments/methods/create/). Consultar especificaciones vigentes antes de futuras operaciones; el contrato acreditado es el payload realmente probado, no una inferencia a partir de la documentación.

## 5. Regla de continuidad

Para cada nueva fase escribir **primero** un anexo de preflight con nuevo SHA, URLs/bundles, versión activa real y reversión, validado contra este contrato. **Después** ejecutar lectura `--check`; solo si toda evidencia coincide autorizar `--resume` una vez. Si hay 4xx, 5xx, inconsistencias, upload ambiguo o cambios en el estado remoto: **BLOCKED → inspección read-only → recuperación forense**, jamás borrar marcadores o reintentar en bucle. Mantener siempre la separación entre el PASS técnico de Preview y la aceptación visual/funcional autenticada.
