# KAW-G8-FINAL — Informe ejecutivo y secuencia de publicación

**Decisión técnica: NO-GO; todavía no está preparado un cutover unificado ejecutable con este runtime.** Partida #182 `06e28d7fa88552a05edeef8879c6ea7a44c50020`, main `6e6bfbb1bd60c91a94e92d36f6cfdd9f91e3d9e2`, ambos verificados. Sin cambios del producto en este lote. El SHA final de preparación y su CI se registran en #182, evitando autorreferencia. Revisión crítica del mismo agente; no segunda aprobación humana independiente.

## Fases y evidencias conservadas

G0/G1/G2, G3.1–G3.5, G4/G5 y G7.1 están acumulados con sus aceptaciones y pruebas anteriores; no se reabren. Pago y Team existentes se conservan; nuevas interfaces G6 y G7.2 siguen excluidas. Integración aprobada y QA Preview no significan que todos los shells estén activados en Producción.

Se reutilizan D1 PASS de G8.5 y las desactivaciones confirmadas de Workers Builds intap-api y auto-deploy de ambos Pages. CI de la partida **PASS**, [45207418485](https://github.com/pgcsoluciones/intap-link/actions/runs/45207418485). No se repiten auditorías D1/Builds ni los 138 grupos browser/builds locales aprobados. La CI automática de un nuevo SHA de herramientas, si se genera, se identifica por separado.

**Nuevo recibo efectivo recuperado:** [G8.6, comentario 7106078811](https://github.com/pgcsoluciones/intap-link/pull/182#issuecomment-7106078811): worktree exacto de partida, preflight/integridad PASS, API captura PASS, cero escrituras. Respaldo privado `~/intap-release-logs/kawvo-g8-backup-udfewy`, manifiesto SHA256 `ed2a628ccc59a737c447dd3bf835d0d2df7cdfed5539eceef5fa859f1d10e21c`. No se recaptura, transporta ni reconstruye. Los BLOCKED App/Web del recibo original pertenecen al criterio de exportación completa; se admite ahora la vía nativa definida abajo.

## Recuperación por capa

| Capa | Evidencia efectiva | Resultado actual |
| --- | --- | --- |
| API intap-api | Captura nativa y configuración con integridad PASS por G8.6 | **BLOCKED de verificación actual de retención:** falta acceso Mac a los IDs privados; no se pide otra captura |
| App intap-web2 | Metadata/target en respaldo G8.6; se acepta rollback nativo del deployment completo | **BLOCKED de lectura actual:** comprobar ID retenido, Production/success, identidad y pertenencia Functions |
| Web intap-link | Mismo mecanismo, proyecto separado | **BLOCKED de lectura actual**, no se exige recompilar ni exportar Functions por separado |

La nueva opción `--verify-native` del auxiliar existente valida primero el respaldo contra el hash **literal** del recibo G8.6. Hace como máximo cuatro GET Cloudflare: versión API retenida con módulos + tráfico activo, y los dos deployments Pages fijados. Compara los bytes/config API con la captura y la identidad/SHA/Functions Pages; no consulta D1, vuelve a descargar assets ni repite Builds. Un cambio de baseline/bytes, target borrado, Preview, metadata incompleta o acceso denegado deja BLOCKED.

Un PASS de ese comprobador significa **elegibilidad leída para recuperación nativa**, no un restore ejecutado. Para Pages la unidad recuperada es el deployment completo, incluidas las Functions que pertenezcan a él: no se exige un nuevo build o respaldo binario local adicional. Si no se expone su pertenencia, no se inventa. Recursos/secretos deben continuar disponibles y la configuración no versionada no se sobrescribe por implicación. [Rollbacks Pages](https://developers.cloudflare.com/pages/configuration/rollbacks/) sólo admiten deployments productivos exitosos y no borrados; [Workers](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/) exige compatibilidad con recursos vigentes.

El resultado se escribe en una carpeta privada **nueva**, adyacente al respaldo, sin modificar su manifiesto. El resumen es seguro para revisión; no contiene secretos. Ningún modo restaura, sube versiones o activa tráfico. No se ha ejecutado contra Producción desde Codex.

## Aceptación LIVE: resultado auténtico

**BLOCKED; 0 aceptaciones autenticadas ejecutadas.** Se utilizó la habilidad cloud-desktop y el navegador disponible; abrir `https://app.preview.intaprd.com/admin/login` falla en la herramienta con **`Browser Use could not read requirements`**, antes de cargar el sitio. No prueba caída de Preview ni credenciales inválidas. No hay una sesión de prueba ni invitación autorizada identificadas y utilizables en esta superficie. No se fabrican mediante D1 ni se piden cookies/tokens en el chat.

Acceso indispensable: navegador controlable con acceso al host y sesiones normales de operador/invitado de prueba, más una invitación LIVE nueva autorizada. El Preview debe servir el API/artefacto pertinente al candidato, algo no acreditado por la captura productiva. No se certifica el release con fixtures ni con una aceptación de otro Worker.

Prueba focal pendiente, ya autorizada para **recursos de prueba**: operador verifica pending y médico asignado; invitado acepta por flujo normal; se comprueba active, mismo ID/editor/Agenda y ausencia de acceso a otro perfil; credenciales/lifecycle propietario siguen prohibidos; operador revoca sólo esa invitación de prueba y el acceso delegado termina sin revertir guardados. No se toca invitación/paciente real. Las pruebas sintéticas ya PASS de #134 se conservan, pero no sustituyen esta certificación.

## Bloqueante funcional de cutover, comprobado en código

No basta con publicar estos bundles en los dominios productivos. Los siguientes guards permanecen deliberadamente intactos:

| Código | Resultado con modo/host Producción |
| --- | --- |
| `medical/kawmed-shell-navigation.ts:22–23` | Doctor requiere modo preview y app.preview.intaprd.com |
| `medical/kawmed-guest-shell-navigation.ts:13`, `kawmed-master-shell-navigation.ts:14` | Invitado/Master también limitados a Preview |
| `sponsored/sponsored-shell-gate.ts:15–16,54,84`, `sponsor-shell-navigation.ts:7` | Beneficiario y patrocinador excluyen Producción; entradas/retornos mantienen esos gates |
| `api/src/sponsor-inventory-page.ts:80` | G7.1 devuelve **404** fuera de ENVIRONMENT preview |

Son un **bloqueante real**, no falta de una auditoría. Cambiar nombre de alias o compilar Preview para Producción no los resuelve; poner ENVIRONMENT preview en el Worker productivo pondría en riesgo cookies/aislamiento. Se requiere un delta de activación de release y su contrato: hosts/modos productivos exactos, mismas autorizaciones/cuenta activa/delegación, entradas/retornos y fallback. No se retiran guards ni se cambian las aserciones Production 404/Preview-only para simular GO. Esto no solicita reaprobar fases funcionales: es el requisito técnico pendiente de habilitarlas en Producción.

## Automatismos restantes

PASS de fuente conservada: quality en PR/main y push/main ejecuta tests/builds/guard, sin deploy; los otros dos workflows son workflow_dispatch Preview (uno puede migrar si se invoca manualmente), no triggers de merge. Pages y Workers Builds productivos desactivados se aceptan de G8.5; no se reauditan.

No se detecta un nuevo trigger de publicación en las fuentes versionadas, congeladas contra la revisión anterior. Se reutiliza la revisión externa aportada por el propietario; no se abre otra auditoría administrativa ni se exige gh o un inventario global de Apps sin evidencia de otro deployer. El conector no administra esas integraciones: esto delimita el alcance, no convierte una revisión aprobada en un nuevo BLOCKED. Antes de un merge futuro, cualquier cambio real de workflows/integraciones respecto al baseline detiene la publicación. El guard quality posterior al merge no controla por sí solo integraciones externas.

## Secuencia de Producción, con paradas obligatorias

**No hay todavía una secuencia de escritura definitiva ejecutable para este SHA.** Ofrecer `npm run deploy:production` o sincronizar el TOML histórico incumpliría la conservación del runtime efectivo. Los comandos siguientes son referencias de las etapas futuras, **no autorización** ni instrucciones para ejecutarlas ahora.

0. **STOP actual:** resolver activación de código y QA LIVE, cerrar lectura de retención/automatismos y aprobar SHA/plan. Después del merge autorizado futuro (no realizado aquí), registrar el SHA resultante de main y obtener su aprobación exacta. Un merge commit puede diferir del candidato. No publicar features como main ni autoaprobar variables.
1. **Paquete local API/App/Web:** desde checkout limpio del SHA realmente aprobado, preservar snapshot productivo privado y lockfile. Generar bundles separados en modo Producción y Functions desde el contexto raíz; manifestar hashes. Para App/Web los comandos canónicos son `npm run app:build` y `npm run web:build`. Para revisar API local: `node_modules/.bin/esbuild api/src/preview-free-entry.ts --bundle --platform=node --format=esm --target=node20 --external:cloudflare:* --outfile="$KAW_RELEASE/api.mjs"`. No repetir esos builds ahora: sólo corresponde tras el delta de activación y su nueva QA.
2. **STOP API antes de subir:** preparar/revisar la versión nueva con el mecanismo nativo ya probado, heredando configuración/bindings del snapshot **productivo efectivo**, secretos por referencia y scheduled intacto. El paquete productivo nativo aún no está materializado ni comparado; no existe un comando de upload acreditado para ese paquete en esta entrega. Los helpers Preview están fijados a otro Worker y no se reutilizan como uploader productivo. Subir una versión también es escritura y requiere autorización posterior. No activar latest ni una versión Preview.
3. **API primero, sólo después de verificar la nueva versión:** con su ID productivo exacto, hashes/configuración/runtime y smoke aprobados. Sintaxis contrastada sólo mediante `--help` del cliente instalado, sin despliegue:

   ```bash
   set -euo pipefail
   git fetch origin main
   test "$(git rev-parse origin/main)" = "$INTAP_APPROVED_COMMIT"
   INTAP_ENFORCE_PRODUCTION_APPROVAL=1 python3 scripts/production_approval_guard.py
   test "$(git rev-parse HEAD)" = "$INTAP_APPROVED_COMMIT"
   test -z "$(git status --porcelain)"
   : "${KAW_API_VERSION:?STOP: falta ID nuevo productivo ya verificado, nunca latest/Preview}"
   [[ "$KAW_API_VERSION" =~ ^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$ ]]
   npx --no-install wrangler versions deploy "$KAW_API_VERSION@100%" --name intap-api --yes
   ```

   La variable no se rellena con un ID inventado ni con la versión anterior de rollback. Este bloque no resuelve el STOP de paquete/upload de la etapa 2 ni está autorizado para ejecución. Tras activarla: tráfico único, módulos/configuración por bytes, login/cuenta/roles/tenant y compatibilidad con frontends anteriores. **STOP** ante deriva/error; rollback al ID productivo retenido del recibo, bajo la autorización correspondiente.
4. **App después de API PASS**, mismos bytes del paquete validado y Functions/contexto raíz. Ejemplo canónico reservado:

   ```bash
   set -euo pipefail
   git fetch origin main
   test "$(git rev-parse origin/main)" = "$INTAP_APPROVED_COMMIT"
   INTAP_ENFORCE_PRODUCTION_APPROVAL=1 python3 scripts/production_approval_guard.py
   test "$(git rev-parse HEAD)" = "$INTAP_APPROVED_COMMIT"
   test -z "$(git status --porcelain)"
   npx --no-install wrangler pages deploy app/dist --project-name intap-web2 --branch main --commit-hash "$INTAP_APPROVED_COMMIT"
   ```

   Las variables deben existir por autorización real: no se asigna SÍ en el ejemplo. Requiere ejecución desde main aprobado, no esta rama, y que production_branch del proyecto coincida con main según configuración efectiva; si no coincide, STOP, no cambiar configuración para acomodar el comando. Verificar metadata Production, SHA, Functions y todos los bytes/dominio; QA cruzada aprobada. **STOP** si difiere; no continuar Web para ocultar un fallo App.
5. **Web al final**, mismo checkout, después del checkpoint App. Bloque reservado desde raíz, preservando Functions, _routes.json, headers/redirects y rutas con espacios/acentos:

   ```bash
   set -euo pipefail
   git fetch origin main
   test "$(git rev-parse origin/main)" = "$INTAP_APPROVED_COMMIT"
   INTAP_ENFORCE_PRODUCTION_APPROVAL=1 python3 scripts/production_approval_guard.py
   test "$(git rev-parse HEAD)" = "$INTAP_APPROVED_COMMIT"
   test -z "$(git status --porcelain)"
   npx --no-install wrangler pages deploy web/dist --project-name intap-link --branch main --commit-hash "$INTAP_APPROVED_COMMIT"
   ```

   Verificar dominio, assets, Functions, perfiles autorizados y retornos; **STOP** ante discrepancia. Sin migraciones ni cambios R2 por implicación.
6. **Cierre:** sólo tras readback por capa y aceptación de QA productiva autorizada. Si hay incidente, restaurar únicamente la capa afectada con target nativo fijado; no reconstruir a ciegas, no revertir D1/R2. Registrar los IDs/hash/tiempos sin secretos.

## Única instrucción pendiente para la Mac y límites de la entrega

El bloque listo para copiar se publica con SHA literal en #182: fetch/worktree aislado y `node scripts/prepare-kawvo-g8-backup.mjs --verify-native "$HOME/intap-release-logs/kawvo-g8-backup-udfewy" --sha SHA_FINAL`. Reutiliza Wrangler autenticado. No requiere gh, recaptura, instalación, compilación ni cambio de permisos/configuración; escribe sólo el nuevo recibo privado de lectura. No puede reparar el navegador cloud ni crear una sesión/invitación de prueba autorizadas.

Validación nueva limitada a ese modo con fixtures: targets nativos/Functions, hash anclado, retención, drift/bytes, Preview/no metadata/404 y cero escrituras; se mantienen sin reducir todas las pruebas anteriores. **Sin merge, deploy, activación productiva, migraciones, cambios D1/R2, secretos o permisos.** Se entregan bloqueantes reales y comandos condicionados, no un GO artificial ni una falsa aceptación LIVE.
