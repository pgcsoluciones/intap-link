# KAW-G8-001 — Release y reversión para revisión

Estado: **NO-GO para Producción**. Preparación, no autorización. No se ejecutaron publicaciones Cloudflare, activaciones, migraciones remotas ni merges a main. La integración Git de #183 en la rama G8 sí fue autorizada y se realizó por fast-forward; no publica el producto. G6 y G7.2 permanecen fuera. Contrato: [G8](../architecture/KAWVO_G8_MASTER_RELEASE_UNIFICATION_2026-11-23.md), #150/#151/#156/#169/#172, KAW-U-NAV-001 y [Producción](../../CONTRACT_PRODUCTION_PROFILES.md).

## 1. Identidades y paquete

- Rama: `release/kawvo-g8-unified-candidate`; SHA final en el Draft PR, no el HEAD futuro de otra rama. Fuente auditada `fae4ced6966a5bfda5bb8f7b298dc8a22bfc5d99`; runtime App igual a `f42bccf2b8248b61603090a97ab56c9258400b58`. API igual a #179 **salvo el handler LIVE exacto de #183** `8bc33c1b62d2c11147ffc192119fac98009cd5b5`, integrado por fast-forward bajo KAW-G8-004. Manifiesto/API bundles reconciliados; el snapshot `474b52d3…` y artefactos previos permanecen referenciados, no son paquetes del nuevo Worker.
- El manifiesto versionado identifica árboles Git, blobs y SHA256 del delta. `KAWVO_G8_VALIDATION.json` recoge resultados y hashes locales de artefactos. El SHA del commit que contiene el manifiesto se registra externamente en el PR para evitar una autorreferencia imposible.
- Cada build se prepara en un checkout/directorio aislado del SHA exacto, Node 20.20.2 y lockfile congelado. No instalar/actualizar dependencias por rutina. Guardar `app/dist`, `web/dist`, `_headers`, `_redirects`, `_routes.json` si existe, Functions fuente y compiladas, rutas Functions, shared, contexto, lockfile y manifiestos. App y Web se conservan en carpetas separadas. No recompilar después de validar Stage.
- Los artefactos locales Codex están en `/tmp/kawvo-g8-validation/artifacts/` y son evidencia técnica; no son respaldos remotos de Producción ni están acreditados como disponibles en la Mac. El runbook no exige transportar esos archivos: preparar el paquete desde Git mediante el método habitual cuando se autorice.

## 2. Resolver bloqueantes antes de cualquier publicación

| Gate | Resultado requerido | Estado en esta preparación |
| --- | --- | --- |
| Activación de interfaces | Decisión técnica explícita y lote acotado para permitir shells G3/G4/G5 y API G7.1 en Producción, manteniendo scopes, opt-out y permisos | BLOCKED: las implementaciones actuales exigen modo/host Preview; G7.1 API devuelve 404 en Producción. No quitar guards para lograr verde |
| Esquema | Comparar metadata real de D1 Preview/Producción con tablas/columnas/índices requeridos | BLOCKED: falta acceso desde Codex; 0153/0154 no están en el árbol activo de migraciones |
| #134 | Certificar primera aceptación pending→active en el release exacto con invitación LIVE de prueba, mismo médico y edición active-only | OPEN: fuente histórica reconciliada; no acreditada esa QA en este candidato |
| Seguridad de integración | Revisión independiente del delta y de automatismos de `main`/Workers Builds/Pages antes de merge | PENDING: el CI GitHub no controla todos los automatismos externos |
| Recuperación | Captura actual de versiones, módulos, bindings/runtime y ajustes no versionados; respaldos App/Web/Functions verificados y versiones retenidas | BLOCKED: no verificados remotamente ni ensayados en esta preparación |
| Aprobación final | Propietario aprueba SHA exacto, alcance por capa, plan y secuencia | NO concedida |

No reabrir las aceptaciones funcionales G3–G5 ni la búsqueda G7.1 de Juan. La QA adicional se limita a diferencias del release, primera aceptación LIVE pendiente, activación productiva futura y comprobaciones cruzadas no acreditadas.

### Integración controlada G8-004

El correctivo #183 no se despliega por integrarse en Git. Ejecutar sobre el SHA integrado `node scripts/test-kawmed-live-pending-g8.mjs --race`, la suite normal y los verificadores G8; comprobar CI de ese mismo SHA. El inspector sólo admite el blob exacto autorizado como excepción a la congelación: modificar cualquier otro runtime o el handler nuevamente lo bloquea. La carrera histórica HTTP 200/cero filas queda conservada como evidencia anterior; sólo su prueba local puede cerrarse aquí, no la certificación LIVE remota.

Rollback de **preparación Git**, si se decide: retirar el correctivo como commit independiente y reconciliar el manifiesto de vuelta al snapshot; no usar reset/force push, no restaurar D1 ni credenciales. Reintroduciría el defecto. Ningún revert preventivo o rollback remoto está autorizado ni ensayado. Para un futuro Worker autorizado se requiere el respaldo/versiones activos reales: no usar el bundle local ni TOML histórico como copia del Worker anterior.

### Esquema y propuesta concreta

`KAWVO_G8_SCHEMA_READONLY.sql` contiene exclusivamente SELECT de metadata, sin IDs, correos, tokens ni datos de pacientes. Se prepara para una consulta de lectura autorizada mediante la sesión normal de la Mac, separando D1 Preview y D1 Producción; no se ejecutó remotamente aquí. Cero filas para una tabla requerida bloquea su handler: no equivale a permiso para crearla.

Las propuestas `kawvo-g8-proposed-migrations/0153_sponsor_sales_representatives.sql` y `0154_artifact_display_identifiers.sql` son copias byte a byte de la fuente Worker documentada `2286c937…`. Se validaron sólo sobre SQLite en memoria. Están fuera de `api/migrations`/`api/migrations-preview`: ningún comando habitual las aplicará automáticamente. Tras comparar esquema e historial reales, decidir si sólo falta reconciliar archivos versionados o si hace falta una migración nueva, con respaldo, revisión e identificación de tablas exactas. Nunca ejecutar `d1 migrations apply --remote` como reparación general; ninguna modificación remota de esquema está autorizada por G8.

## 3. Captura y aislamiento, antes de Stage

1. Registrar SHA/árbol de `main`, candidato y PR. Confirmar que `main` no cambió desde la revisión; si cambia, comparar y revalidar el delta. Los PR #175–#181 son acumulativos: no fusionarlos individualmente.
2. Con lectura Cloudflare autorizada, identificar versiones **activas y porcentajes** de ambos Workers; no confundir latest upload con activa. Retener la versión efectiva para rollback y guardar módulos/configuración versionada en evidencia privada; no imprimir ni transportar valores secretos. Conservar cron/rutas, D1/R2, OAuth, variables, límites, flags y settings no versionados. Los TOML históricos no son un respaldo de runtime.
3. Resolver los orígenes efectivos y su ownership desde bindings/metadata. App → Pages `intap-web2`; Web → `intap-link`; API → Worker. No inventar una rama a partir de un alias truncado. El G7.1 documentado usa App Preview `457b0c1b` a través del Worker `9c63a559…`; es un dato histórico, no una consulta actual.
4. Respaldar todos los artefactos anteriores y Functions, registrar SHA, deployment ID, rama, entorno, alias, runtime y hashes. Comparar todos los archivos públicos contra el inmutable y dominio efectivo, codificando cada segmento de ruta. No solicitar `_headers`/`_redirects` como archivos públicos, no eliminar `_routes.json`, espacios ni acentos legítimos de Web. Functions requieren comprobación independiente; un nombre JS coincidente no prueba igualdad binaria.
5. Rechazar 404, metadata ambigua, discrepancias de bytes, credenciales insuficientes o versiones no retenidas. No repetir uploads ambiguos ni borrar marcadores/evidencias.

## 4. Secuencia Preview, reservada a autorización posterior

Se reutiliza el procedimiento G7.1 ya demostrado; no crear otro sistema de publicación ni ejecutar ahora los scripts históricos con baselines antiguos.

1. **Stage API:** compilar entrada correcta del Worker en entorno aislado, heredar bindings de la versión activa verificada por ID explícito, preservar runtime/settings y subir versión con `deploy=false`, sin tráfico. Verificar módulos byte a byte, handlers comerciales, scheduled, identidad, tenant y ausencia de rutas G7.2. La creación de una versión no acredita activación ni permisos sobre datos.
2. **Stage App y Stage Web:** publicar cada artefacto en rama Preview aislada de su proyecto correcto, desde la raíz con el contexto Pages Functions aplicable. Verificar SHA completo, rama, entorno, success, alias real, todos los bytes públicos y huellas protegidas intactas. La rama QA `.pages.dev` no hereda cookies host-only ni activa gates que exigen App Preview.
3. **Preview API:** tras revisar Stage, activar exclusivamente su ID validado, preservando todos los bindings y funciones vigentes. Nunca activar latest ni sincronizar settings con un TOML antiguo.
4. **Preview App/Web:** publicar exactamente los bytes Stage y sus Functions al origen/alias propietario acreditado, o aplicar únicamente el cambio de origen ya revisado mediante el mecanismo probado si ése es el estado efectivo. No suponer que subir cualquier alias actualiza el dominio. Cada capa requiere acción y autorización separadas, verificación posterior y recibo; detener si falta rollback o cambia el baseline.
5. Verificar dominios canónicos, metadata y hashes completos; realizar sólo la QA autenticada adicional autorizada con cuentas y pacientes de prueba. Mantener el Preview G7.1 confirmado intacto hasta autorizar expresamente esta secuencia.

## 5. Producción, bloqueada en este candidato

1. Cerrar los gates de la sección 2, incluida la decisión sobre activación de shells/API fuera de Preview. Volver a generar candidato y validaciones si hay cualquier cambio funcional. La aprobación anterior no se extiende a un SHA nuevo.
2. Revisar Draft G8 integral. El propietario debe aprobar **SHA exacto y plan de release**, alcance de capas y automatismos. No habilitar auto-merge ni fusionar PR acumulativos por separado.
3. Si se autoriza merge, controlar antes los triggers externos para impedir un despliegue accidental. Registrar el SHA resultante de `main`: un merge commit puede tener SHA distinto del revisado. Comprobar igualdad de árboles relevantes y obtener la aprobación exacta exigida por `production_approval_guard.py` para el SHA que se vaya a publicar. No eludir el guard ni publicar una feature como Producción.
4. Preparar desde ese `main` aprobado los artefactos de modo Producción. Los dominios/proyectos continúan siendo `app.intaprd.com` → `intap-web2`, `intaprd.com` → `intap-link`, API → `intap-api`. No copiar orígenes Preview/OAuth/D1/R2 a Producción ni introducir un frontdoor productivo para compensar un proyecto equivocado.
5. Publicar en el orden API compatible → App → Web sólo según el plan exacto autorizado, conservando compatibilidad con los clientes anteriores y checkpoints entre capas. Cambios de datos/esquema, si finalmente resultaran necesarios, constituyen otra operación expresamente aprobada; no están autorizados aquí.
6. Verificar metadata/bytes/dominio, login/cookies, Multicuenta, roles, publicación explícita del mismo perfil, Agenda, enlaces públicos, PWA, SEO/GEO y alias histórico `link.avanxy.com` con ruta/query. Un HTTP 200 o CI verde no cierra release.

No se entregan comandos de despliegue productivo listos para ejecutar mientras permanezcan estos bloqueantes. Los scripts `promote-kawmed-g7-1-search-preview.mjs` y `recover-kawmed-g7-1-search-preview.mjs` están fijados a Preview/SHAs/hashes antiguos, hacen POST/activaciones y no son runners G8 de Producción. Sus booleanos `productionUntouched`/`productionUnchanged` no sustituyen una lectura independiente de las superficies productivas.

## 6. Reversión por capa, sin ejecutar

| Incidente | Acción reservada al operador autorizado | Evidencia requerida |
| --- | --- | --- |
| UI nueva falla, backend compatible | Usar «Panel anterior» explícito con protección de borradores; restaurar App o Web anterior completo, con Functions, en su proyecto y rama propietaria | Deployment/SHA anterior y manifiesto verificado, misma cuenta y rutas, bytes del dominio recuperados |
| API/identidad/permisos fallan | Detener escrituras/QA; activar exclusivamente la versión previa retenida del Worker afectado con sus bindings/runtime preservados | Versión/porcentaje previos, módulos y bindings, settings no versionados sin deriva, 401/403 y recorridos autorizados recuperados |
| Frontdoor Preview apunta al App nuevo | Restaurar la versión Preview anterior validada que conserva el origen anterior, sin cambiar el Worker productivo | Recibo anterior y readback de versión, origen, Functions y bytes del host |
| Upload/activación ambiguos | Sólo inspección de intentos, metadata/versiones y tráfico antes de decidir; no repetir POST a ciegas | Markers exclusivos y recibos, incluso en errores |
| Datos modificados por un usuario | Tratar como incidente de datos separado; rollback de código no revierte D1/R2 ni acciones guardadas | Respaldo y autorización específica; no borrar datos ni aplicar rollback de esquema por implicación |

El rollback del Preview de búsqueda tiene asociación documental `9c63a559…` → `ebf507f7…`; el snapshot original adicional conserva `23405a5b…`. Esos IDs no son un rollback productivo acreditado ni se debe sustituir uno por otro sin leer su contexto efectivo. **Rollback remoto NO ensayado; igualdad binaria histórica NO acreditada.** Retención de versiones y disponibilidad de Functions/backups deben verificarse antes de cada release.

Rollback de la preparación documental G8-001/002: revertir únicamente esos cambios de documentos/pruebas/gobernanza no altera el runtime. La incorporación funcional G8-004 necesita la decisión de revertir específicamente #183 y reconciliar manifiestos, como se indica arriba; reintroduciría el defecto de acuse. No hay datos ni migraciones remotas que revertir por esta integración Git.


## Inspección posterior KAW-G8-002

Antes de cualquier gate de escritura, usar únicamente el [inspector de lectura y matriz](KAWVO_G8_BLOCKERS_2026-11-23.md). En G8-002 la prueba estable #134 no cerraba el defecto de acuse; ese FAIL histórico se conserva. G8-004 integra #183 y vuelve a ejecutar la carrera, sin acreditar por ello aceptación autenticada. Los scripts de inspección no implementan deploy, activación, restore ni migración. No usar los modos de scripts históricos para solucionar un BLOCKED de lectura.
