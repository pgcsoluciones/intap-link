# G7.1 — Inventario de dispositivos del patrocinador

Gate G7 activo por decisión del propietario; G6 pospuesto. G3/G4/G5 confirmados por Juan en Preview; no se reabren sus aprobaciones. Base aislada: `b97a2f01672eaa14df04f74aa6ad882f9b4cd256`, HEAD de #178 abierto/Draft y no fusionado. Main observado `6e6bfbb1bd60c91a94e92d36f6cfdd9f91e3d9e2`. Rama `feat/kawvo-g7-1-sponsor-inventory`. El worktree G6 conserva sólo preparación local, sin cambios funcionales, commit ni PR; se mantiene pospuesto.

Fuentes: #150/C01–C07, mapa/contrato #156, contrato de listados #153 en #152, #172, AGENTS aprobado de #169 sin integrarlo, U01–U09 comentario 6957519041, CLAUDE y bitácoras G3/G4/G5. Estado Git/PR contrastado antes de modificar. No repetir auditorías administrativas ni QA real ya aceptada.

## Elección y matriz previa

Primer candidato: **lectura del inventario Master**, menor riesgo que asignación masiva, activación, reclamación, publicación o Agenda. `api/src/sponsored-profiles.ts:103` devuelve todo `/sponsor/artifacts`; SponsorDashboard carga ese array, filtra con `useMemo` y hace `slice` en páginas de cinco. La consulta es de lectura y ya usa membresía; no necesita nuevas reglas de asignación ni migración para acotar resultados. Los índices existentes por sponsor/rol/estado permiten delimitar el tenant; la ordenación usa fecha+artifact_id, sin inventar un identificador.

| Superficie | Módulo/ruta | Autorización/lecturas | Acciones/retorno |
| --- | --- | --- | --- |
| Inicio G5 | SponsorDashboard `/admin/sponsor`, opt-in `sm_inventory=1` | Membresía, cuenta activa y resumen agregado del inventario autorizado | Estadísticas reales, Master acotado; ningún listado completo por entrar |
| Patrocinios → Dispositivos G7.1 | Nuevo SponsorInventory en la misma ruta | GET paginado nuevo, Preview, owner/admin, tenant resuelto en servidor, token de pestaña | Buscar/estado, limpiar, anterior/siguiente, recarga; conservar contexto URL/sesión al pasar por Perfil/Más/Multicuenta |
| Gestión de patrocinio | SponsorCommercialSellers G5 original | Config y operaciones existentes; listado completo sólo al entrar explícitamente a esa superficie excluida | Borradores y confirmaciones originales, sin implementar su paginación en este lote |
| Fallback inventario | Flag desactivado explícitamente | Listado G5 original | Preserva la alternativa aprobada; no presentar su paginación local como G7 |

**Límite comprobado:** las llamadas App `/sponsor/commercial/*` y su DTO de asignaciones existen, pero sus handlers/tablas no aparecen en el árbol Git de esta base. No inventar tablas comerciales ni anunciar filtro server-side de responsable/asignación. El opt-in G7.1 consulta códigos, producto, comercio, correo, username, teléfono, lote/ciudad/zona y estado respaldados por el esquema. Un filtro comercial previo no se ignora: se ofrece volver explícitamente a G5 o limpiarlo. El inventario G5 y sus operaciones comerciales permanecen disponibles sin cambios de permisos. La reconciliación del Worker efectivo es un gate previo a cualquier publicación API; el SHA de App no demuestra qué código de backend está desplegado.

## Allowlist prevista

- `api/src/sponsored-profiles.ts`: registrar lectura nueva con la autenticación existente; rutas previas intactas.
- `api/src/sponsor-inventory-page.ts`: autorización estricta y consultas SELECT limitadas/cursor/resumen.
- `app/src/components/admin/sponsored/SponsorDashboard.tsx`: composición opt-in, resumen acotado y carga comercial diferida; no alterar formularios/operaciones.
- `app/src/components/admin/sponsored/SponsorInventory.tsx`: interfaz móvil/desktop de lectura, debounce/cancelación/estado y codec de respuesta.
- `app/src/components/admin/sponsored/sponsor-shell-navigation.ts`: transportar flag/cursor, conservando los destinos y filtros anteriores.
- `scripts/test-sponsor-inventory-g7-contract.mjs`, `scripts/lib/sponsor-inventory-g7-browser.mjs`, `scripts/lib/sponsor-inventory-g7-sqlite.py`: fixtures/contratos/API con SQLite local, volumen y aislamiento; sin D1 remoto ni crear sesiones reales.
- Esta bitácora y capturas `docs/qa/KAWVO_G7/`.

Fuera de alcance: G6, otros listados, migraciones, esquema, auth/guards globales, permisos, operaciones comerciales, API de publicación, Web, Workers/configuración, D1/R2 remoto, dependencias, runners y workflows. Ningún despliegue, merge o dato remoto. G7 permanece OPEN hasta QA/confirmación de Juan.

## Criterios y validación prevista

SELECT por tenant, rol y kind+id/token, límites 10 predeterminado/25 máximo, parámetros validados y ligados, orden estable con cursor ligado al scope/filtros, búsqueda Unicode acotada y literal. 0/1/10/11/miles, filtros, nueva primera página, cambios concurrentes y cursor ajeno/inválido, scopes cruzados y respuestas obsoletas. Navegador con fixtures: 320/360/390/430/768/1280, contexto/recarga/retornos, vacíos/carga/error/reintento, sin escrituras al consultar ni pérdida de borradores. Regresión G5 original con flag apagado y scopes/operaciones intactos. App TypeScript/builds Preview/Producción; API TypeScript/bundle y pruebas SQL reales locales; diff-check y allowlist. CI por SHA y QA autenticada separada para Juan.

## Contrato implementado de lectura

`GET /api/v1/sponsor/artifacts/page`, registrado con el `requireUser` existente. Las rutas anteriores de sponsored-profiles permanecen byte a byte; sólo se añade import/registro. Endpoint disponible exclusivamente con `ENVIRONMENT=preview` (404 fuera). Sesión autenticada; membresía activa en tenant activo y rol owner/admin. Multicuenta requiere kind sponsor, cookie ligada a la sesión, token de pestaña coincidente y sponsor_user_context coincidente. El endpoint vuelve a verificar estos requisitos además del middleware global intacto. No acepta tenant/rol/perfil proporcionados por el cliente.

| Parámetro | Contrato |
| --- | --- |
| `q` | Hasta 160 caracteres/12 términos; consulta NFKD, minúsculas, espacios normalizados; SQL pliega tildes/ñ y marcas combinadas españolas; términos AND, campos OR concatenados. `%`, `_` y barra invertida se buscan literalmente, siempre con binds |
| `status` | all/available/activated/published/inactive; publicado se refiere a sp.status, sin inferir activación |
| `limit` | 10 predeterminado; entero entre 1 y 25; App solicita 10 |
| `cursor` | Base64url acotado (2.048 caracteres), versión/tenant/huella de filtros/límite/ancla/clave/dirección validados; no concede autorización ni sustituye la membresía |
| `summary=1` | Totales agregados reales y a lo sumo un artefacto Master; no acepta cursor ni filtros de registros |

Parámetros desconocidos/duplicados/inválidos: 400. Sin sesión: 401. Rol/tenant/cuenta no permitidos: 403; token de pestaña obsoleto: 409; error de consulta: 503 sanitizado, sin SQL. Respuestas privadas `Cache-Control: no-store`. No hay INSERT, UPDATE, DELETE, activación, reclamación, asignación, publicación ni creación de sesiones en esta lectura.

Respuesta paginada: `{ok:true,data:{version:'g7.1',tenant_id,items,total,limit,from,to,next_cursor,previous_cursor,reset_required}}`. Resumen: `{ok:true,data:{version:'g7.1',tenant_id,totals:{total,active,pending,published},master}}`. Beneficiarios excluyen Master. Joins de perfiles/lotes incluyen el sponsor y la relación del artefacto, evitando cruzar datos por una FK discordante.

Orden estable `sa.created_at DESC, sa.artifact_id DESC`. Cursor de siguiente/anterior por clave, nunca offset controlado por el cliente. Ancla de primera página evita introducir registros nuevos más recientes en mitad del recorrido; Actualizar reinicia el recorrido. El rango y total los calcula D1; sm_page se conserva como contexto compatible, no se usa para autorizar ni consultar offsets. Borrados/última página sin registros con resultados restantes producen reset_required y vuelta explícita a primera página; no un vacío ficticio. Datos vivos y filtros se reevalúan; no se promete una instantánea histórica de estados.

El plan local de la consulta real usa los índices existentes por sponsor; no se necesita ni ejecuta migración para este lote. Búsqueda por subcadena y conteo requieren trabajo dentro del tenant, no se presenta como búsqueda FTS ni rendimiento remoto certificado. Si el volumen real lo exige, evaluar aparte el índice `(sponsor_id, created_at DESC, artifact_id DESC)` y benchmarks D1; no se añade ni aplica aquí.

## Composición App y aislamiento

Opt-in: `/admin/sponsor?kawvo_sponsor_shell=1&sm_inventory=1&sm_tab=sponsorship` en **build Preview + host exacto app.preview.intaprd.com + sponsor owner/admin autorizado**. Sin flag, Producción, pages.dev, viewer o fallback global: comportamiento G5 existente. «Inventario anterior» desactiva únicamente este listado, manteniendo el shell y las operaciones aprobadas.

Modo G7: resumen agregado inicial y una página cuando Dispositivos está activo; no se consulta el inventario completo ni asignaciones comerciales al entrar, buscar o paginar. Búsqueda tiene debounce 300 ms, AbortController y serial de respuesta; al cambiar filtros/cuenta se invalidan respuestas obsoletas. URL/sesión conservan consulta/estado/cursor al navegar, recargar, volver desde la presentación pública canónica o entrar por Multicuenta. Otro sponsor conserva sólo el opt-in y reinicia filtros/cursor; servidor vuelve a autorizar cada petición.

La superficie comercial G5 queda expresamente excluida de la paginación: su array completo sólo se obtiene al abrir Gestión de patrocinio o elegir Inventario anterior. No se cambia su componente, selección, payloads o permisos. Su estado permanece montado al alternar/fallback/back, y se conservan las lecturas autorizadas de asignaciones del fallback. No afirmar que G7.1 resuelve ese listado. Un filtro comercial guardado muestra un aviso y permite usar la vista anterior o limpiar; no se ignora ni se aplica sólo al subconjunto paginado.

Errores de API/404 no JSON se distinguen de ausencia de patrocinador: conservan la identidad verificada y permiten fallback explícito. Una página con tenant discordante se rechaza y no muestra registros. Un fallo de resumen obsoleto no puede invalidar una carga nueva ni borrar su borrador. Los formularios, publicación «Publicar», cuenta activa, entradas, etiquetas y guards G3–G5 siguen originales.

## Resultados y evidencia

Pruebas en Node 20.20.2 con dependencias/Chromium existentes, sin instalaciones:

- **PASS 9 grupos API + SQLite real local**: `node scripts/test-sponsor-inventory-g7-contract.mjs --scope`; log `/tmp/g7-api-complete.log`, evidencia `/tmp/kawvo-g7-LHktfT/`. Se ejecuta el bundle Hono real de preview-free-entry con autenticación/middleware/resolutores reales contra SQLite efímero. El esquema de la fixture se crea a partir del SQL versionado y sus sesiones son exclusivamente ficticias, nunca D1 remoto. Incluye 0/1/10/11, recorrido completo de 1.001 sin duplicados/omisiones, 10.001 sin descargar todos (respuesta de 25 <24 KB), filtros, acentos NFC/NFD, comodines literales/inyección, límites, parámetros/cursor inválidos, dueño/admin/viewer/externo, sesión ausente, kind/id/token/contexto, otro tenant, altas concurrentes/borrados/reset, plan de consulta real y cero escrituras API. El adaptador rechaza cualquier run/batch mutante.
- **PASS 11 grupos de navegador G7** (10 completos + aislamiento adicional): ejecución completa del flujo con App/router/guard/CSS y **API nueva + SQL reales locales**, interceptando HTTP y usando sesiones de fixture. Log final `/tmp/g7-browser-final.log`; caso adicional de aislamiento `/tmp/g7-isolation-final.log`. Se cubren seis anchuras (320/360/390/430/768/1280), respuesta acotada sin descargas legacy, normal/Multicuenta, consulta/cursor/recarga/retorno canónico, Más/Perfil, debounce/respuesta obsoleta, estado vacío/error/reintento, tenant discordante, filtro comercial explícito, cambio de sponsor, borradores de presentación/comerciales, fallback/back, fallo obsoleto de resumen, API ausente y revocación. **No es QA autenticada real**: las otras lecturas/operaciones G5 siguen simuladas y no acreditan que los endpoints comerciales ausentes estén desplegados o versionados.
- **PASS 16 grupos G5 originales** con flag apagado: `node --input-type=module -e "import{runSponsorG5Browser}from'./scripts/lib/sponsor-g5-browser.mjs';await runSponsorG5Browser()"`; log `/tmp/g7-g5-regression.log`. Incluye publicaciones/errores/verificación, borradores, sesiones, entradas/retornos, credenciales, Agenda y DOM Producción byte a byte contra su base. Dos casos dirigidos posteriores (comercial y Producción) PASS, `/tmp/g7-g5-affected-final.log`; no se cuentan como grupos nuevos. No se repite QA real aprobada.
- **PASS 7 contratos existentes** de aislamiento médico, origen Web, cuenta activa/Multicuenta, integración médica, navegación/publicación Free y gate G4; `/tmp/g7-existing-contracts.log`. No se reejecutan fallos históricos sin relación con el diff.
- **PASS App TypeScript/builds locales Producción y Preview**: `npm run build -w app`, `npm run build:preview -w app`; logs finales `/tmp/g7-final-build-{production,preview}.log`. Avisos Vite/Browserslist/chunks conocidos, sin tocar dependencias.
- **PASS API TypeScript y bundle Preview**: `npx --no-install tsc --noEmit -p api/tsconfig.json`; esbuild de `api/src/preview-frontdoor-entry.ts`, target node20, ESM, external cloudflare:*; logs `/tmp/g7-api-types-final.log`, `/tmp/g7-api-bundle.log`. El bundle local no certifica equivalencia con el Worker remoto.
- **PASS diff-check/allowlist**, fuentes protegidas y igualdad de todos los call sites de escritura/payloads/headers del SponsorDashboard anterior. Rutas API previas, auth/guards/globales, Web, Functions, G3/G4/G5, dependencias y configuración congeladas. Capturas finales de fixture en `docs/qa/KAWVO_G7/inventory-{320,1280}.png`, autorrevisión de jerarquía/touch/foco/overflow; no aceptación visual independiente.

Pruebas que detectaron ajustes durante el lote: una expectativa de texto duplicado se corrigió para contar el visible (sin quitar la aserción); el mock de tenant discordante se acotó a la página para probar ese guard sin invalidar el resumen; el borrador comercial perdido al hacer fallback/back se reprodujo RED `/tmp/g7-draft-red.log` y pasó tras conservar el componente/caché (`/tmp/g7-browser-final-target.log`); se añadió defensa y prueba contra fallo obsoleto de resumen. Los tests originales no se relajan. El workflow actual valida sus contratos/builds/tipos habituales, pero no ejecuta automáticamente el contrato G7 local; CI final se acredita por SHA en el Draft PR.

## Estado, límites y rollback

**Candidato para revisión; G7 OPEN.** Juan hará QA real autorizada después de disponer del backend y App correctos: normal y Multicuenta, dos sponsors de prueba, búsqueda/estado/cursor/recarga/retornos, cero activaciones/asignaciones al consultar, borradores y fallback. Latencia/coste D1 y datos remotos no certificados por SQLite. No pedir a Codex sesión real ni repetir recorridos G3/G4/G5 aprobados.

**Publicación API BLOCKED hasta reconciliar baseline efectivo:** este checkout no acredita la fuente exacta del Worker activo y carece de los handlers comerciales consumidos por el G5 confirmado; además permanece la discrepancia histórica #134 anterior a un futuro release API. Un deploy completo de api/wrangler.preview.toml podría regresar código o bindings. No basta la CI verde ni que App b97a2f01 esté confirmado. No se ejecuta ni se entrega como listo un comando de publicación del Worker desde este árbol. Siguiente paso acotado: guardar versión/bindings activos mediante la sesión Wrangler de la Mac, localizar en GitHub el source/commit asociado a esa versión o su respaldo acreditado y preparar la incorporación de **sólo esta lectura** sobre ese baseline con revisión técnica. No inventar una API paralela, tabla comercial, Worker o runner; no modificar la configuración para resolverlo.

Rollback UI inmediato: Inventario anterior, sin sm_inventory=1, conservando G5. Rollback de código: revertir el único commit G7 para regresar a b97a2f01. No hay cambios de datos/esquema que revertir. Recuperación de una publicación futura exige los artefactos/Functions y versión Worker **efectivamente anteriores**, acreditados y autorizados; este documento no afirma que b97a2f01 sea el source de la API publicada. Sin deploy, Stage, merge, migraciones D1, infraestructura o datos remotos en este trabajo. #178 y G6 permanecen intactos.

## TERMINAL — preparación aislada y lectura API, sin publicar

`G7_SHA` es el SHA exacto entregado en el Draft PR. No cambia el checkout/build G5 existente. Usa Node 20.20.2, dependencias y sesión Wrangler ya disponibles; no instala herramientas ni pide secretos. El bloque sólo prepara artefactos locales y registra metadata de lectura; **no equivale a preflight completo ni habilita publicación API**.

```bash
bash <<'BASH'
set -euo pipefail
umask 077
: "${G7_SHA:?Exportar el SHA exacto revisado del candidato G7}"
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
cd "$ROOT"
test "$(node --version)" = v20.20.2
test -z "$(git status --porcelain)"
test -x node_modules/.bin/wrangler
git fetch --no-tags https://github.com/pgcsoluciones/intap-link.git refs/heads/feat/kawvo-g7-1-sponsor-inventory
test "$(git rev-parse FETCH_HEAD)" = "$G7_SHA"
git merge-base --is-ancestor b97a2f01672eaa14df04f74aa6ad882f9b4cd256 "$G7_SHA"
git diff --check b97a2f01672eaa14df04f74aa6ad882f9b4cd256 "$G7_SHA"
git diff --quiet HEAD "$G7_SHA" -- package.json package-lock.json app/package.json api/package.json
mkdir -p "$HOME/intap-release-logs"
LOG="$HOME/intap-release-logs/kawvo-g7-1-$G7_SHA"
mkdir "$LOG" # Si existe, conservar evidencia y detener; no repetir builds/uploads.
git worktree add -b "qa/kawvo-g7-1-${G7_SHA:0:12}" "$LOG/source" "$G7_SHA"
cd "$LOG/source"
node - "$ROOT" <<'NODE'
const fs=require('node:fs'),path=require('node:path'),root=process.argv[2];
for(const rel of ['node_modules','app/node_modules','api/node_modules']){
 const src=path.join(root,rel);if(!fs.existsSync(src))continue;
 fs.mkdirSync(rel,{recursive:true});
 for(const name of fs.readdirSync(src))fs.symlinkSync(path.join(src,name),path.join(rel,name));
}
NODE
export WRANGLER_SEND_METRICS=false
npm run app:build:preview > "$LOG/app-preview-build.log" 2>&1
npx --no-install wrangler pages functions build functions --outfile "$LOG/app-functions.bundle" --output-routes-path "$LOG/app-functions-routes.json" --build-output-directory app/dist > "$LOG/app-functions.log" 2>&1
npx --no-install esbuild api/src/preview-frontdoor-entry.ts --bundle --platform=node --format=esm --target=node20 '--external:cloudflare:*' --outfile="$LOG/api-review.mjs" > "$LOG/api-review-build.log" 2>&1
npx --no-install wrangler deployments status --name intap-api-preview --json > "$LOG/worker-status.json"
VERSION="$(node - "$LOG/worker-status.json" <<'NODE'
const fs=require('node:fs'),s=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
if(s.versions?.length!==1||Number(s.versions[0].percentage)!==100)throw Error('BLOCKED: versión Worker no inequívoca');
console.log(s.versions[0].version_id);
NODE
)"
npx --no-install wrangler versions view "$VERSION" --name intap-api-preview --json > "$LOG/worker-version.json"
test "$(git rev-parse HEAD)" = "$G7_SHA"
test -z "$(git status --porcelain)"
test -z "$(git -C "$ROOT" status --porcelain)"
printf 'Preparado sin publicar. Evidencia privada: %s\nAPI: reconciliar source efectivo antes de cualquier upload de Worker.\n' "$LOG"
BASH
```

Antes de Stage App, reutilizar el preflight de Pages habitual (#171 y los procedimientos inspeccionados en G5), con valores **actuales**, sin ejecutar runners históricos completos. Resolver el APP_PAGES_ORIGIN activo, deployment/alias/rama/SHA, proyecto/entorno y production_branch; respaldar dist completo, _headers/_redirects/Functions/contexto/manifiesto; comparar bytes públicos y conservar baseline App/Web Producción, Web Preview y ambos Workers. No usar una URL Pages vieja o el alias truncado como rama. Si falta un control, detener antes de upload.

## TERMINAL — Stage App aislado (acción separada)

Reservado tras el preflight anterior y autorización específica. Proyecto único intap-web2, Stage distinto de production_branch efectivo; desde la raíz para conservar Functions. Stage pages.dev comprueba metadata/artefacto/aislamiento, **no** activación ni QA funcional G7 en el host exacto.

```bash
set -euo pipefail
: "${G7_SHA:?Falta SHA G7 exacto}"
LOG="$HOME/intap-release-logs/kawvo-g7-1-$G7_SHA"
cd "$LOG/source"
test "$(node --version)" = v20.20.2
test "$(git rev-parse HEAD)" = "$G7_SHA"
test -z "$(git status --porcelain)"
test -s app/dist/index.html && test -s "$LOG/app-functions.bundle"
test ! -e "$LOG/app-stage.log"
npx --no-install wrangler pages deploy app/dist --project-name intap-web2 --branch "qa-kawvo-g7-1-${G7_SHA:0:12}" --commit-hash "$G7_SHA" > "$LOG/app-stage.log" 2>&1
```

Guardar URL inmutable y verificar metadata Cloudflare (SHA completo, rama, Preview, success, alias real), todos los archivos públicos contra el manifiesto byte a byte (URL-encode por segmento), headers/routes/Functions y snapshot protegido intacto. No consultar _headers/_redirects como archivos públicos ni eliminar configuraciones legítimas. Un resultado ambiguo no autoriza repetir upload. No recompilar después de validar Stage.

## TERMINAL — Preview App posterior (otra acción)

**Pendiente**, no ejecutar hasta reconciliar/publicar de forma autorizada la API correspondiente sobre su baseline efectivo, revisar Stage, conservar respaldo anterior verificado y acreditar snapshot sin deriva. No se ofrece un deploy API a ciegas. `APP_PREVIEW_BRANCH` se obtiene de la metadata del deployment propietario del binding efectivo; no se fija por su nombre histórico.

```bash
set -euo pipefail
: "${G7_SHA:?Falta SHA G7 exacto}"
: "${APP_PREVIEW_BRANCH:?Falta rama App Preview propietaria verificada}"
case "$APP_PREVIEW_BRANCH" in *main*|*master*|*production*) echo 'BLOCKED: rama no Preview'; exit 1;; esac
LOG="$HOME/intap-release-logs/kawvo-g7-1-$G7_SHA"
cd "$LOG/source"
test "$(node --version)" = v20.20.2
test "$(git rev-parse HEAD)" = "$G7_SHA"
test -z "$(git status --porcelain)"
test -s "$LOG/app-stage.log" && test -s "$LOG/app-functions.bundle"
test ! -e "$LOG/app-preview.log"
npx --no-install wrangler pages deploy app/dist --project-name intap-web2 --branch "$APP_PREVIEW_BRANCH" --commit-hash "$G7_SHA" > "$LOG/app-preview.log" 2>&1
```

Verificar otra vez metadata/bytes en deployment, alias y app.preview.intaprd.com, ambos Workers según la versión API que se haya revisado/autorizado y las superficies protegidas; después Juan hará QA con el opt-in. No cambia Worker/DNS/bindings/Web/Producción mediante estos bloques App. Los comandos están preparados para revisión, no ejecutados; sintaxis validada con bash -n. La sesión Wrangler y los respaldos efectivos de la Mac no están accesibles desde Codex; no se solicitan credenciales en el chat ni una sesión real para que Codex pruebe el lote.

Cierre local: las capturas definitivas usan el CSS compilado actual y mensajes sin identificadores de fase en la UI; responsive repetido PASS en `/tmp/g7-visual-final.log`. Compilación Preview posterior PASS en `/tmp/g7-preview-last.log`; se conserva la normalización del enlace NFC original (trim/uppercase). La suite completa final G7 pasa 10 grupos y el caso adicional de Producción/pages.dev/viewer pasa por separado (11 únicos); no se cuentan las repeticiones dirigidas como grupos nuevos. La API está cubierta por nueve grupos; no hay nuevas funcionalidades después de estas validaciones, sólo esta evidencia documental. CI por SHA exacto, comparación puntual, rama y enlace de revisión se registran en el Draft PR. Detenerse en revisión; G7 OPEN.
