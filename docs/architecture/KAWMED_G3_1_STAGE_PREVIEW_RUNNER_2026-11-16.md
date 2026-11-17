# KAW-G3-003 — Runner independiente de Stage y App Preview

Estado: propuesta operativa para revisión técnica. Esta preparación no ejecuta preflight Cloudflare, Stage, promoción, rollback, migraciones ni despliegues. No modifica el PR #170 ni su candidato.

## Identidad y alcance

- Base: `6e6bfbb1bd60c91a94e92d36f6cfdd9f91e3d9e2`, main remoto verificado.
- PR funcional: [#170](https://github.com/pgcsoluciones/intap-link/pull/170).
- Candidato inmutable: `34d57a4bfebc9e59b0347d0497a159ca3f46ce7e`.
- Rama funcional: `feat/kawmed-g3-1-unified-doctor-shell`.
- Rama operativa independiente desde main: `ops/kawmed-g3-1-stage-preview-runner`.
- Proyecto de escritura único: Pages `intap-web2`; Stage propuesto `qa-kawmed-g3-1-1116`.
- Contratos: [#150](https://github.com/pgcsoluciones/intap-link/pull/150), [#151](https://github.com/pgcsoluciones/intap-link/pull/151), [#156](https://github.com/pgcsoluciones/intap-link/pull/156), [Producción](../../CONTRACT_PRODUCTION_PROFILES.md) y [topología Pages](../CLOUDFLARE_PAGES_ARCHITECTURE.md). AGENTS.md de #169 consultado desde `50e74d81c61e3e18c85aec3af8505101f43cde93`, sin integrarlo.

Archivos de esta propuesta: wrapper Bash, helper Node, contrato ejecutable del runner y este documento. Sin cambios en App funcional, Web, API, Workers, D1, R2, OAuth, configuración, permisos, dependencias, lockfiles ni workflows.

El runner valida la allowlist exacta del candidato respecto a la base:

```text
app/src/components/admin/medical/MedicalDashboard.tsx
app/src/components/admin/medical/KawMedUnifiedShellFrame.tsx
app/src/components/admin/medical/kawmed-shell-navigation.ts
scripts/test-kawmed-shell-navigation-contract.mjs
docs/architecture/KAWVO_KAWMED_G3_LOT_1.md
```

No toma HEAD de la rama operativa como candidato. Usa `git archive` del SHA funcional exacto, dependencias ya existentes y `npm run build:preview -w app` en una copia fuera del checkout. Conserva allí el build y su manifiesto; Stage/promoción reutilizan esos mismos bytes sin recompilar ni cambiar ramas.

## Procedimientos inspeccionados

Se leyeron íntegros antes de adaptar:

- `scripts/run-kawvo-free-production-candidate-preview-2026-11-15.sh` (262 líneas).
- `scripts/run-kawvo-g5-publication-navigation-preview-2026-11-15.sh` (274 líneas).

Se conserva su metodología de candidato exacto, build Preview, metadata Pages, deployment inmutable, alias real, comparación de bytes y comprobación de superficies protegidas. Se corrigen sus limitaciones para este lote: valores históricos fijados, logs particulares de la Mac, conteo fijo de bindings y Stage/promoción encadenados. No se reutilizan sus SHA de aplicación, hashes productivos anteriores al cierre G2 de #168, versiones Worker, aliases, ramas activas ni baselines.

## Tres acciones separadas

| Acción | Efectos y condiciones |
| --- | --- |
| `preflight` (predeterminada) | Solo GET Cloudflare/HTTP y operaciones locales de lectura Git, build y evidencia. Descubre orígenes actuales y registra baseline/rollback. No sube archivos. |
| `stage` | Invocación posterior con `--approve-stage` igual al SHA candidato y evidencia PASS. Una sola subida App a `qa-kawmed-g3-1-1116`; verifica metadata, alias real y todos los archivos públicos del artefacto byte a byte. App Preview activo y todas las superficies protegidas deben seguir iguales. Termina sin promoción. |
| `promote` | Otra invocación posterior, autorización exacta `--approve-promote`, revisión explícita del artefacto `--stage-reviewed`, Stage PASS y rollback disponible. Sube los mismos bytes exclusivamente a la rama propietaria del alias App Preview existente. No cambia el Worker ni su binding. |

Los argumentos de autorización son gates técnicos; no sustituyen la autorización humana de cada publicación. Esta orden solo autoriza preparar/publicar el runner para revisión, no ejecutar esas acciones de despliegue.

Cada intento Stage/promoción reserva un directorio de forma atómica antes de comprobar/publicar, conserva logs y comprueba superficies después incluso si falla el upload. Una reserva existente impide repetir, sobrescribir evidencia o iniciar dos uploads simultáneos. Los reintentos acotados solo repiten lecturas/verificación; nunca el upload. Ante resultado ambiguo: BLOCKED, inspección de evidencia y nueva decisión técnica; no rollback automático.

## Fuente de verdad efectiva y baseline actual

1. Git remoto confirma main/base, rama y SHA funcional; el checkout debe estar limpio. No se usa el estado de GitHub como prueba de despliegue.
2. Se leen las versiones efectivas de `intap-api` e `intap-api-preview` con Wrangler existente, exigiendo una única versión al 100% en cada Worker. Se guarda ID y huella de bindings, sin copiar valores de secretos ni datos de D1/R2.
3. Se extraen exclusivamente `APP_PAGES_ORIGIN` y `WEB_PAGES_ORIGIN` del Worker Preview efectivo. El TOML versionado no sustituye esa lectura. No se exige un conteo histórico de bindings.
4. GET de los proyectos Pages y sus deployments identifica el alias App existente y su deployment inmutable, rama, SHA completo, entorno Preview y estado success. No se inventa ni trunca un alias a partir de la rama. Si el origen App es inmutable, ajeno, ambiguo o corresponde a Producción/Stage, BLOCKED; no se cambia el Worker para resolverlo.
5. Se comparan HTML y JS/CSS iniciales de App Preview custom, alias y deployment inmutable. El baseline de App/Web Producción se obtiene de sus deployments canónicos actuales y de los dominios activos; Web Preview se contrasta con su origen efectivo. Se conserva metadata y copia de los bytes leídos.
6. Se repite el snapshot al terminar preflight y antes/después de cada acción. Stage exige igualdad total; promoción permite exclusivamente el cambio previsto de App Preview. App/Web Producción, Web Preview, ambas versiones Worker y sus huellas de bindings deben permanecer iguales.

Todas las llamadas API explícitas son GET y se limitan a proyectos Pages/metadata del alcance; no se auditan Webhooks, usuarios, permisos, secretos ni configuración administrativa general. No hay comandos de deploy/rollback Worker, D1, R2, OAuth o Web, ni un comando Pages a rama productiva. La escritura se concentra en una única función Pages con proyecto constante y rechazo de la rama productiva efectiva y de `main`/`production`/`master`.

## Evidencia, bytes y rollback

El directorio nuevo `~/intap-release-logs/kawmed-g3-1-*` queda fuera del árbol Git y el wrapper usa umask 077. Contiene snapshots, HTML/bundles anteriores, metadata sanitizada, archivo Git del candidato, fuente de build, log, copia `candidate-app`, manifiesto SHA256 y receipts. Los receipts vinculan base, candidato y huella de ambos archivos del runner; modificar el runner o artefacto invalida la evidencia.

La comprobación del artefacto compara buffers completos del HTML de ruta y de todos sus archivos públicos, incluidos chunks diferidos, CSS, imágenes y archivos públicos raíz. `_headers` y `_redirects` se conservan en el manifiesto/copia, pero no se consultan como URLs públicas. No se admiten Worker/Functions, configuraciones, dependencias, credenciales, symlinks o referencias JS/CSS a chunks locales ausentes. El éxito de metadata o un HTTP 200 aislado no sustituye la comparación de bytes.

Preflight siempre conserva la identidad inmutable anterior y sus bytes iniciales para investigación/rollback. Para poder promover, necesita además `--rollback-artifact DIR`: el directorio completo App dist del deployment anterior, conservado en los logs/artefactos de la Mac. No usar el App dist recién compilado para el candidato. El runner contrasta todos sus archivos públicos contra el origen anterior y copia el artefacto y su manifiesto a `rollback-app`. La procedencia de `_headers`/`_redirects`, no recuperables como archivos públicos, debe corresponder a ese build anterior y revisarse con su evidencia de release.

Un preflight sin ese directorio puede terminar PASS de lectura e identificar el origen anterior, pero declara rollback pendiente y la promoción queda BLOCKED. Si se quiere llegar a promoción, realizar después un preflight nuevo con el artefacto anterior antes de autorizar Stage. Stage aislado puede revisarse sin rollback completo, pero ese ciclo no habilitará promoción: no editar receipts ni copiar evidencia de otro ciclo para saltar el gate.

El runner no ejecuta rollback. Si una promoción futura requiere revertirse, detener nuevas escrituras, conservar el intento y revisar la copia `rollback-app`, metadata/SHA/rama previos y snapshots. La recuperación propuesta será una nueva subida del artefacto anterior a la misma rama Preview, con autorización separada, verificación posterior de metadata/bytes y sin tocar Worker ni usar rollback productivo de Pages. El deployment anterior inmutable permite contrastar la recuperación; no se presupone que el alias pueda revertirse mediante una operación productiva.

## Mac del propietario

Directorio fijo: `$HOME/Desktop/intap-link-universal-bilingual-audit`. Requisitos existentes: checkout limpio con remoto origin/github del repositorio, Node 20, npm, Git, tar, dependencias locales con Wrangler y sesión actual de Cloudflare (o token ya autorizado). El runner no instala herramientas, inicia login, refresca credenciales mediante código propio ni amplía permisos. Las lecturas de metadata/versiones deben estar ya autorizadas; HTTP 401/403 o datos incompletos producen BLOCKED.

La descripción del Draft PR operativo contiene un único bloque listo para copiar con su SHA operativo concreto. Extrae solo los dos archivos del runner fuera del repositorio sin cambiar HEAD. Ejecuta exclusivamente preflight por defecto y define funciones separadas para las dos acciones futuras; no las llama. `--help` enumera los argumentos. Conservar el valor `EVIDENCE` que imprima el preflight; solo ese directorio PASS pertenece al ciclo.

La función futura Stage exige SHA autorizado y evidencia como argumentos. La de promoción exige además la revisión del artefacto Stage y comprueba rollback. Cada acción necesita su aprobación posterior, vinculada al SHA funcional, origen y evidencia del ciclo. Publicar/mergear el PR operativo no ejecuta el runner.

## Stage no acredita activación del shell

El shell exige simultáneamente build Preview, host exacto `app.preview.intaprd.com`, opt-in, scope doctor, perfil autorizado cargado y ausencia de delegación. Stage `pages.dev` permite comprobar artefacto, metadata, bytes y fallback/aislamiento; el shell debe permanecer desactivado allí. Ni el HTML servido por el dominio custom ni este runner prueban una sesión médica.

Solo tras promoción autorizada podrá Work hacer QA autenticada en `https://app.preview.intaprd.com/admin/medical?kawvo_med_shell=1`, con la matriz del PR #170: roles/cuentas, formularios y borradores, logout confirmado, días completos/parciales, publicación, Agenda y QA móvil. Las pruebas de Stage son distintas del QA Preview; ninguna equivale a QA productivo ni a aceptación de G3 completo.

## Validaciones de esta preparación

- PASS `bash -n scripts/run-kawmed-g3-1-stage-preview-2026-11-16.sh`.
- PASS `node --check scripts/kawmed-g3-1-pages.mjs` y contrato del runner.
- PASS `node scripts/test-kawmed-g3-1-pages-runner.mjs`: 17 grupos de contratos con HTTP/CLI Cloudflare simulados. Incluyen los 13 originales de lectura/gates/aislamiento y cuatro nuevos de paginación y diagnóstico API descritos a continuación.
- PASS integración real de la validación Git contra main/candidato remoto y árbol limpio.
- PASS build Preview local del candidato exacto mediante `Runner.build`/git archive fuera del checkout: 14 archivos. No cambia HEAD, rama ni archivos funcionales. No se instaló nada. Permanecen warnings de Vite CJS, Browserslist y tamaño de chunk.
- PASS ayuda/argumentos sin conectar a Cloudflare; diff check e inventario operativo antes de publicar.
- El primer ensayo de fixtures detectó un lookup incorrecto del SHA en el simulador: la verificación real de bytes lo rechazó. Se corrigió el fixture y la suite completa pasó; no se relajaron los checks del runner. El manifiesto se ajustó para no tratar una referencia de directorio runtime como un archivo JS/CSS ausente y se comprobó sobre el artefacto real.

Preflight Cloudflare real, origen App Preview actual, rollback anterior efectivo, Stage, promoción y QA autenticada: **BLOCKED/pendientes de la Mac**, sin afirmar PASS remoto. En este entorno no hay token/account Cloudflare en las variables usadas ni configuración de sesión Wrangler en las ubicaciones estándar; tampoco hay conector Cloudflare disponible. No se solicitaron credenciales ni permisos nuevos. CI del PR operativo, cuando se ejecute, valida sus workflows existentes y no incorpora automáticamente el contrato nuevo, al mantenerse los workflows intactos.

No existe una transacción atómica que bloquee cambios externos mientras se publica: el runner detecta deriva antes/después y detiene el procedimiento, pero no deshace automáticamente una escritura si otro operador modifica el entorno al mismo tiempo. Conservar los intentos y coordinar el ciclo revisado; no declarar integraciones externas o QA real verificadas mediante fixtures.

## Corrección del HTTP 400 / código 8000024 reportado desde la Mac

El propietario reportó que el preflight de la versión operativa `6e10c4bf30e2360c093fcc78fbecf4bceca11437` falla con HTTP 400 y código Cloudflare 8000024. La consulta de deployments enviaba `per_page=100`. Se retira ese parámetro y se conserva `page`, usando el tamaño predeterminado del endpoint en lugar de asumir un límite numérico. [La API oficial documenta `per_page` como opcional](https://developers.cloudflare.com/api/resources/pages/subresources/projects/subresources/deployments/methods/list/); el comando de listado de Pages del Wrangler local también omite ese parámetro. No se afirma un máximo no verificado ni se prueban automáticamente otros tamaños contra Cloudflare.

La versión anterior limitaba el recorrido a 25 páginas. El diagnóstico real posterior confirmó 206 páginas App y 212 Web con la consulta sin filtro. La revisión siguiente usa el filtro documentado `env=preview`, termina al encontrar la coincidencia exacta del origen, valida de nuevo ID, URL, entorno, alias y éxito mediante el detalle, y conserva la comparación de las superficies activas con los bytes inmutables. No afirma unicidad exhaustiva histórica: confía en la semántica de alias activo de Pages, rechaza coincidencias múltiples en la página, IDs repetidos, metadata inconsistente y búsquedas sin coincidencia. Límite defensivo de 500 páginas, usando `total_pages` si existe. No se modifican gates de rollback, autorización, integridad de artefacto ni aislamiento.

El diagnóstico ahora conserva endpoint sin ID de cuenta, página/tamaño predeterminado, HTTP, códigos y mensajes API breves, incluidos errores anidados de primer nivel. Solo inspecciona campos de error permitidos; elimina credenciales conocidas, Bearer/tokens, identificadores, correos, URLs y controles de terminal; limita cantidad y longitud. No vuelca headers, cuerpos completos, env_vars, secretos ni respuesta HTML. Los fallos de red/timeout y las respuestas JSON inválidas o errores malformados producen mensajes sanitizados identificables.

PASS de los 17 grupos: reproducen el 400/8000024 para el parámetro anterior, resuelven el origen con paginación predeterminada, recorren varias páginas con/sin metadata, rechazan duplicados y límites incompletos, y comprueban diagnóstico útil sin fugas para errores API/red/JSON. Los 13 grupos originales pasan sin reducir sus aserciones. PASS syntax Bash/Node, ayuda y diff check. No se repite el build funcional porque no se cambia App ni el procedimiento de build; la CI del nuevo SHA se revisa en el mismo PR operativo.

La reproducción es simulada: esta corrección no repite el preflight Cloudflare real de la Mac ni ejecuta despliegues. La descripción del PR actualiza el SHA operativo del bloque Mac. Como cambia la huella del runner, debe crearse un preflight nuevo; los receipts de la versión anterior no autorizan Stage/promoción con la nueva. El candidato funcional `34d57a4bfebc9e59b0347d0497a159ca3f46ce7e` y PR #170 permanecen intactos.

Siguiente punto de control: revisión técnica del Draft PR operativo. Sin merge ni publicaciones Cloudflare durante esta preparación. **APROBACIÓN EXPLÍCITA DE PRODUCCIÓN: NO.**

### Diagnóstico real 16/11/2026 y segunda corrección

Cloudflare devolvió 5,138 deployments App y 5,276 Web, 25 por página. El runner anterior agotaba su límite de 25 páginas. Fuente API: https://developers.cloudflare.com/api/resources/pages/subresources/projects/subresources/deployments/methods/list/ (filtros documentados `env`, `page`, `per_page`; no filtro de rama). Nueva prueba cubre coincidencia temprana, página 26, duplicidad local, cambio de alias entre lista y detalle, páginas repetidas, ausencia y límite defensivo. La ejecución de las pruebas de esta revisión y el preflight real quedan pendientes hasta obtener evidencia del SHA corregido. No se efectuaron despliegues por esta revisión.

### Tercera corrección: HTML Web dependiente del dominio

Preflight real: 17 pruebas PASS, CI 43991400949 SUCCESS. El diagnóstico local confirmó JS y CSS idénticos en Web productiva y deployment canónico 1672b41a; las diferencias HTML observadas se limitan a canonical, og:url, og:image, og:image:secure_url y twitter:image con el dominio de consulta. Se normaliza únicamente el prefijo de origen exacto de esas etiquetas en las comparaciones Web, conservando ruta, resto del HTML y hashes de assets. App y artefactos de publicación/rollback conservan igualdad estricta. Se conserva HTML original en evidencia. Prueba adicional de equivalencia y rechazo de cambios sustantivos; validación pendiente del nuevo SHA. Sin despliegues.
