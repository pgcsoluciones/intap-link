# KAW-G8-006 — Respaldos privados y recuperación por capas

**NO-GO mantenido.** Preparación sobre #182 `f14cb0180f964d65daaa9b3c69dceccc6011ab24`, rama `release/kawvo-g8-unified-candidate`; SHA final/CI en #182. No cambia runtime respecto a esa referencia. Sólo scripts de captura/verificación, pruebas, allowlist documental y documentación. Autorrevisión del mismo agente; revisión independiente pendiente.

## Evidencia G8.5 reutilizada, sin repetir la auditoría

El propietario acredita desde su Mac: esquemas D1 Preview/Producción 0153/0154 PASS; Workers inspeccionados; Pages App/Web auto-deploy desactivado; Workers Builds de **intap-api** desactivado y confirmado visualmente; main intacto y cero escrituras remotas. Informes originales en `~/intap-release-logs/kawvo-g8-readonly-*/report.json`. Este entorno no accede a esos archivos: se registra la procedencia del propietario, sin atribuir a Codex una nueva comprobación remota. No se presupone el estado de Builds de intap-api-preview ni de otros hooks/variables.

El inspector anterior guarda hashes/resúmenes, no módulos nativos completos ni Functions compiladas. Sus JS/CSS principales son huellas parciales. No demuestra que un checkout o compilación histórica sea igual al producto desplegado. Se conserva toda la evidencia G8-001/004 y la congelación exacta #183.

## Herramienta implementada

`scripts/prepare-kawvo-g8-backup.mjs`, Node **20.20.2**, sin paquetes ni herramientas nuevos. Reutiliza autenticación Wrangler y Reader del inspector existente; añade únicamente GET de Worker custom domains a su allowlist. No usa TOML como respaldo, latest upload como versión activa ni runners de despliegue históricos.

| Modo | Operación y límite |
| --- | --- |
| `--preflight --sha SHA` (también modo implícito con `--sha SHA`) | Sólo local: Mac, Node, SHA exacto, checkout limpio, ascendencia y runtime congelado. Comprueba propiedad/tipo/permisos de las evidencias y elige el informe G8.5 válido más reciente. No red, D1 ni login nuevo |
| `--capture --sha SHA` | Sólo en Mac. GET de versión **activa** productiva, módulos, ajustes, cron, rutas/custom domains y proyectos/deployments Pages. Escribe exclusivamente evidencias locales nuevas; no modifica permisos existentes. Reutiliza el informe G8.5; no consulta D1 ni vuelve a auditar auto-deploy/Builds |
| `--verify DIRECTORIO --sha SHA` | Offline: verifica manifiesto/SHA256, cada archivo, módulos nativos e identidad Pages; propietario/permisos, archivos extra y symlinks. PASS significa integridad de lo capturado, no recuperación completa |
| `--plan DIRECTORIO --sha SHA` | Mismas comprobaciones offline; valida el plan privado **no ejecutable**. Nunca envía las solicitudes futuras descritas |

`--restore`, `--deploy`, `--upload` y `--activate` son rechazados antes de autenticación/red. La herramienta de captura sólo dispone de GET; tampoco ejecuta el POST de consultas D1 admitido por el inspector antiguo. Un fallo no provoca reintentos de escritura ni borra evidencia. La autorización efectiva de lectura se comprueba mediante las respuestas de cada GET; no se amplían scopes. Un 401/403 deja BLOCKED con diagnóstico sanitizado y endpoint sin identificadores en el archivo privado.

El preflight no necesita copiar el informe de la Mac: selecciona carpetas con el prefijo exacto indicado, exige esquema PASS y Worker Production inequívoco. El ID activo leído para captura debe coincidir con ese informe; si cambió, se detiene, no cambia el baseline automáticamente. Comprobar estabilidad antes/después de capturar es necesario para el respaldo, no una repetición de la auditoría G8.5.

## Manifiesto e inventario de respaldo

Destino nuevo por ejecución: `~/intap-release-logs/kawvo-g8-backup-*/`, fuera de los checkouts. Directorios 0700, archivos 0600; no sobreescribe respaldos. **Sólo Mac para datos reales.** Las pruebas Codex usan fixtures sintéticos en `/tmp/kawvo-g8-backup-*`/directorios de fixture, no respaldos reales.

| Artefacto local privado | Contenido y comprobación |
| --- | --- |
| `manifest.private.json` + `manifest.sha256` | SHA herramienta/base, instante, versión/deployment por capa, estado/pendientes, lista exacta de archivos con bytes/SHA256. Su hash se muestra como huella segura; no es una firma ni prueba de restauración |
| `api/version.private.json`, `api/modules/N.bin` | Versión nativa completa y bytes de **todos** sus módulos, nombre original/tipo/main-module y hash individual. Segundo GET del mismo ID comprueba retención/igualdad; tráfico único 100% se verifica antes/después |
| `api/settings.private.json`, `cron.private.json`, `routes.private.json`, `domains.private.json` | Configuración/bindings y ajustes accesibles, sin valores de bindings secret_text. Rutas de intaprd.com y respuesta de custom domains del servicio intap-api; no exportación global de todas las zonas/cuentas. Denegación o respuesta incompleta queda BLOCKED, sin impedir capturas independientes de Pages |
| `app/` y `web/`: `project.private.json`, `deployment.private.json`, `entry/{custom,immutable}/` | Proyecto y deployment canónico **Production**, SHA/branch, aliases/configuración y uses_functions, retenido y success. Compara por bytes los JS/CSS declarados del login/landing en dominio e inmutable. **No** copia perfiles/pacientes ni consulta endpoints de negocio |
| `prior-audit-receipt.json`, `read-ledger.private.json` | Procedencia/hash del informe G8.5 y ledger de GET sanitizados; cero consultas D1/escrituras Cloudflare |
| `rollback-plan.private.json` | Targets fijados por capa, precondiciones y descriptores POST futuros para revisión; `executable:false`. El script no tiene código para enviarlos |
| `incomplete.private.json` si falla la captura | Causa sanitizada y evidencia parcial conservada; no habilita restore |

Configuración plain_text y código pueden ser sensibles: permanecen **sólo en el directorio privado de la Mac**, nunca se imprimen ni se suben a GitHub. Los valores de secret_text se omiten incluso si una respuesta los incluyera; sólo se conservan nombres/tipos. La continuidad de los secretos en plataforma sigue por acreditar sin exportar valores. Un hash de datos privados no autoriza publicar el archivo. No hay backup de filas D1, objetos R2, sesiones o credenciales en este lote.

## Estado real por capa y condiciones de cierre

| Capa | Estado en Codex | Qué produce la captura en la Mac | Qué falta para afirmar recuperación |
| --- | --- | --- | --- |
| API intap-api | **BLOCKED**, respaldo real no disponible aquí | PASS de integridad/captura si módulos/version/configuración accesibles coinciden; BLOCKED si ajustes faltan | Retención al momento del incidente, configuración no versionada sin deriva, recursos referenciados y secretos disponibles; revisión del plan y ensayo autorizado |
| App intap-web2 | **BLOCKED** | ID de Production retenido + metadata/huellas parciales verificables; no se marca recuperable | Paquete original completo acreditado (dist, controles y Functions compiladas/contexto) o prueba suficiente de recuperación nativa del deployment retenido; no se ha ensayado |
| Web intap-link | **BLOCKED** | Igual, separada de App; no usa el validador restrictivo de App | Mismo gate, incluyendo rutas, `_routes.json`, `_headers`, `_redirects`, espacios/acentos y Functions; no reconstruir un supuesto respaldo equivalente |

La API Pages documentada usada aquí no entrega un archivo completo dist/Functions; `uses_functions=true` no acredita sus bytes. No se inventa un endpoint de descarga ni se crea un deployment para obtenerlos. **No hay un paquete original App/Web productivo acreditado en este entorno o en la evidencia entregada.** Si existe en la Mac, debe vincularse mediante el recibo original al deployment/SHA y manifiesto de subida, comparar todos sus archivos públicos y acreditar las Functions originales; una reconstrucción de Git no sustituye ese respaldo. No se afirma que no exista en la Mac: no tenemos acceso a ese inventario.

## Rollback reservado, no ejecutado

1. **Antes de cualquier escritura:** autorización del propietario para incidencia, capa, versión/deployment y plan exactos. `--verify` del respaldo debe pasar. Releer targets retenidos y estado activo para detectar deriva; comprobar compatibilidad con clientes/datos actuales. D1/R2 no se revierten por implicación.
2. **API:** activar únicamente el ID retenido fijado en el manifiesto mediante el mecanismo nativo de deployments ya utilizado por el proyecto, al 100%. Nunca latest ni upload del TOML histórico. Comparar módulos/bindings/configuración exactos y ajustes no versionados antes/después; cualquier diferencia requiere decisión, no sobrescritura automática. Si falta el ID o un recurso/secreto, BLOCKED; los módulos locales no convierten la recreación en una operación autorizada.
3. **App:** rollback nativo del deployment Production de intap-web2, sin nuevo build/upload ni cambio de Worker/origen. Se conserva el deployment como unidad (assets/Functions); cotejar dominio, entry bytes, configuración y rutas Functions autorizadas. Proyecto/env distintos o target borrado bloquean la operación.
4. **Web:** misma operación únicamente en intap-link. No promover Preview ni sustituir por App. La reversión del deployment no prueba por sí sola restauración de configuración global: comparar snapshot privado.
5. Elegir capas/orden según la incidencia: UI aislada → su Pages; API incompatible → detener escrituras y revertir API, luego sólo frontends necesarios. Checkpoint y recibo de cada acción; ante ambigüedad, lectura y parada, nunca POST a ciegas.

La [documentación oficial Pages](https://developers.cloudflare.com/pages/configuration/rollbacks/) exige deployment productivo exitoso y no borrado; Preview no sirve como target. Hay retención/limpieza, por lo que se relee el ID antes de restaurar. El [endpoint nativo de rollback](https://developers.cloudflare.com/api/resources/pages/subresources/projects/subresources/deployments/methods/rollback/) se incluye sólo como descriptor privado. Para API, [Workers rollbacks](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/) advierte de recursos/bindings/datos incompatibles. No se ensaya ninguna de esas operaciones ahora.

## Ejecución y validación

Desde un checkout aislado del **SHA final publicado en #182**, con `KAWVO_READONLY_TOOL_ROOT` apuntando al checkout Mac habitual que ya tiene Wrangler instalado:

```bash
node scripts/prepare-kawvo-g8-backup.mjs --preflight --sha "$SHA"
node scripts/prepare-kawvo-g8-backup.mjs --capture --sha "$SHA"
```

El bloque final listo para la Mac se registra con SHA literal en #182 para evitar autorreferencia del commit. No se pide instalar herramientas, transportar archivos privados, identificar UUID ni editar código. El resumen terminal contiene estados, ruta local del respaldo y hash del manifiesto; no credenciales/configuración. Opcionalmente volver a verificar offline con `--verify`/`--plan` y el directorio mostrado, sin red.

Pruebas locales: `node scripts/test-kawvo-g8-backup.mjs` (captura sintética multi-módulo/wasm, archivos privados, secretos omitidos, getters sólo lectura, drift/401/403 simulados, Pages inválido, independencia por capa, corrupción/permisos/symlinks/manifiesto alterado y modos prohibidos); regresión del inspector, verificador G8, sintaxis JS/Bash y diff/scope. Se conservó el log inicial de una expectativa de diagnóstico que pedía el texto crudo del error; se sustituyó por comprobar que el error se sanitiza y no filtra ese texto, reforzando la protección. Nuevos resultados/hashes en `KAWVO_G8_VALIDATION.json.backupPreparation`, CI del nuevo SHA en #182.

**Sin captura productiva desde Codex, restore, deploy, merge, activación, migraciones ni cambios de secretos/Producción.** Continúan NO-GO la recuperación completa, LIVE real pendiente, activación productiva y autorización final. D1 y auto-deploy completados por G8.5 se conservan como evidencia aportada, no se repiten.
