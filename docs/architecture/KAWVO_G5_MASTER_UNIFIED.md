# KAWVO G5 · Master/patrocinador Link

Base exacta `46cc46d17b6bd17af735a627a12357e1938eeb44` de #177, rama aislada `feat/kawvo-g5-master-unified`. Main observado `6e6bfbb1bd60c91a94e92d36f6cfdd9f91e3d9e2`. Árbol inicial limpio; #177 no fusionado. G3 y G4 confirmados por Juan: sus aprobaciones se conservan; los estados OPEN de sus bitácoras son históricos. G5 es el gate activo, sin iniciar G7.

Fuentes leídas directamente en GitHub: #150 `2f88ea37`, #151 `b089bcdc` (prototipo HTML aprobado), #156 `ab2263a7`, #169/AGENTS `50e74d81`, #172 `2ab9f47a`, U01–U09 comentario 6957519041 en #156 y estado de #177. AGENTS todavía no está integrado en este checkout; se consulta su revisión aprobada sin fusionarla. CLAUDE y bitácoras G3/G4/multicuenta aportan continuidad, no baselines de despliegue actuales.

## Matriz previa de composición

| Destino | Módulo existente / ruta | Lecturas y permisos | Acciones y retorno |
| --- | --- | --- | --- |
| Inicio | SponsorDashboard, `/admin/sponsor` | `/sponsor/me`, cuenta activa, `/sponsor/artifacts`; tenant coincidente, rol vigente | Datos reales del inventario recibido y accesos separados; navegación sin escrituras |
| Mi presentación | SponsoredDashboard `mode=master`, misma ruta | `/me/sponsored-profile?scope=master`; id/perfil y sponsor autorizados | Editor/multimedia/bancos originales; guardado antes de publicación, confirmación y verificación del mismo id; módulo → índice conservando filtro |
| Patrocinios | Inventario SponsorDashboard + SponsorCommercialSellers | config/contact/can_manage y lecturas comerciales originales | Búsqueda, filtros, paginación existente de 5, registro/importación/asignación/revisión actuales; conservar selección/borradores al navegar |
| Más → Identidad | Formulario visual de SponsorDashboard | Tenant y permisos originales; CTA/destino protegidos | Solo logos/banner mediante payloads originales; retorno a Más; refrescos no descartan el borrador |
| Más → Credenciales | FreeCredentials embedded | Sesión y verificaciones originales | Mantener formulario montado, retorno a Más y guard de salida sin inspeccionar secretos |
| Más → Agenda Master | SponsoredAgendaIndex + AppointmentManager existente | `scope=master`, mismo perfil autorizado; solo tras lectura permitida | Solicitudes, confirmadas, disponibilidad, bloqueos y ajustes existentes; detalle → índice Agenda → Más, enlace directo/recarga |
| Multicuenta | IntapcardAccountSelector y guards existentes | POST explícito kind+id, token y tenant del servidor | Entrada canónica G5, retorno verificado del mismo sponsor; otro sponsor limpia contexto; no selección por hints |

La UI no concede capacidades. Un perfil Master no es un beneficiario; la identidad comercial se mantiene separada de la presentación pública. Ni vendedores ni visitadores adquieren facultades Master. Producción/otros hosts conservan legacy; en Preview se conserva fallback explícito. No se inventan disponibles/pendientes si el estado recibido no permite distinguirlos. Las cifras se describen como inventario recibido, no totales server-side inexistentes. G7/paginación API fuera de alcance.

## Allowlist del lote

- `app/src/components/admin/sponsored/SponsorDashboard.tsx`
- `app/src/components/admin/sponsored/SponsoredDashboard.tsx`
- `app/src/components/admin/sponsored/SponsorCommercialSellers.tsx`
- `app/src/components/admin/sponsored/SponsoredUnifiedShell.tsx`
- `app/src/components/admin/sponsored/SponsoredAppointments.tsx`
- `app/src/components/admin/IntapcardAccountSelector.tsx`
- `app/src/components/admin/sponsored/sponsor-shell-navigation.ts` (nuevo)
- `scripts/test-sponsor-g5-shell-contract.mjs` (nuevo)
- `scripts/lib/sponsor-g5-browser.mjs` (nuevo)
- Este documento (nuevo) y cuatro capturas sintéticas `docs/qa/KAWVO_G5/{home-320,home-1280,presentation-390,sponsorship-390}.png`.

Sin cambios API/Web/Worker/D1/R2/OAuth, dependencias, guards, permisos, runners, workflows o configuración. No se realizan despliegues ni auditorías administrativas generales. Checkout y artefactos previos permanecen intactos en el worktree G4; este worktree reutiliza dependencias/CSS locales ya disponibles sin instalar herramientas.

## Validación prevista y recuperación

Contrato ejecutable de allowlist, llamadas/payloads originales, codec cerrado y scopes. Navegador con componentes/router/guard/CSS reales e HTTP interceptado: seis anchuras, roles/tenant, entrada/retorno Multicuenta, módulos, filtros/recarga/back, vacíos/errores, borradores, guardado concurrente/publicación, asignación autorizada/revisión/error, credenciales y fallback. Regresiones G4 por modificar su composición compartida y pruebas concretas de retorno Doctor/Master por modificar el selector; no se repiten suites G3 enteras ni QA aprobada del mismo SHA. TypeScript y builds App Preview/Producción locales, diff-check y CI del SHA final.

QA autenticada del nuevo candidato queda separada para Juan tras una publicación futura autorizada. No se solicita repetir QA G3/G4 aceptada. Rollback UI: fallback explícito; rollback código: revertir únicamente los commits G5 y recuperar la base exacta. Sin migraciones ni datos que revertir. Candidato implementado y validado localmente para revisión; no listo para Producción. G3/G4 siguen confirmados; QA pendiente aquí corresponde exclusivamente al nuevo candidato G5.

## Resultado de implementación y evidencia

El shell Master usa por composición SponsoredUnifiedShell, KawvoProfileIdentity, SponsoredProfileIndex, SponsoredAgendaIndex, AppointmentManager, FreeCredentials, FreeSupportPanel y los módulos originales. Su gate es build Preview + host exacto `app.preview.intaprd.com` + tenant autorizado owner/admin, selección/hint coincidentes. El perfil y Agenda se muestran solo tras verificar el sponsor/id de su respuesta; ninguna pista UI elige una cuenta. Master normal sin Multicuenta conserva su membresía y no requiere fabricar una sesión especial.

Inicio muestra las cifras del inventario recibido, excluyendo el producto Master según el cálculo original; sin porcentajes ni una división ficticia entre disponibles/asignados que el DTO no respalda. Patrocinios separa Dispositivos/Asignaciones: tarjetas móviles y tabla de escritorio usan exactamente `pageItems`, filtros y paginación originales. Las funciones de registro/importación Excel, revisión/asignación/reasignación, activación de vendedor y exportación se mantienen byte a byte. La identidad visual comercial no habilita editar CTA/destino centralizados. El enlace del producto Master, recursos autorizados y soporte siguen accesibles en Más.

Mi presentación conserva un único SponsoredDashboard `mode=master`, su estado, formularios y scope. Índice de módulos, estado persistido, borrador local, vista previa/retorno y publicación explícita usan las funciones originales. El aviso listo mantiene identidad separada `sponsored:master:<id>`, se presenta en Mi presentación y no interfiere con actividad comercial/Agenda. Antes de publicar se guarda y después se verifica estado e id; las funciones de guardado, publicación y medios permanecen byte a byte.

Las secciones permanecen montadas al navegar. El contenedor Master mantiene el mismo tipo de nodo al entrar a Agenda para no remontar credenciales/editor/bancos. Los marcadores de credenciales/soporte son booleanos en refs; no inspeccionan, almacenan aparte ni transportan valores de los formularios. Las salidas/logout/cambio de cuenta y recorridos nativos protegen borradores y operaciones en curso. Los módulos Agenda conservan su guard original. El refresco de inventario no remonta el editor ni descarta identidad comercial; guardar explícitamente adopta el resultado salvo ediciones posteriores al envío. Seriales de carga impiden adoptar respuestas obsoletas. Se conserva una rama legacy real `<SponsoredDashboard mode="master"/>`, sin alterar su contrato estático.

El contexto de navegación usa destinos App cerrados, filtros acotados y tenant verificado. Multicuenta revalida el sponsor de retorno mediante `/sponsor/me` y conserva kind+id/token/POST originales. Mismo sponsor recupera tab/módulo/filtros; otro inicia en Inicio. `sponsor_id` canónico de la selección se conserva junto al contexto UI. La preferencia por tenant recupera el contexto desde un enlace canónico sin hints sin seleccionar otra cuenta. La ruta Agenda legacy con scope master en Preview abre la composición existente; fuera del shell mantiene su retorno anterior. Fallback explícito: `legacy=1` o `kawvo_sponsor_shell=0`; elegirlo con borradores requiere decisión de salida. Producción/otros hosts/roles fuera del gate conservan legacy.

### Validación local

Node **20.20.2**, herramientas y dependencias existentes; sin instalación. Todo HTTP del navegador está interceptado. El recorte se sustituye por un botón de fixture que entrega un PNG de prueba al optimizador original; no acredita recorte, R2 ni persistencia remotos.

- **PASS: 14 grupos G5**, comando `SPONSOR_G5_ARTIFACTS=/tmp/g5-final node scripts/test-sponsor-g5-shell-contract.mjs --browser`; log `/tmp/g5-final.log`. Seis anchuras; módulos/jerarquía/preview; inventario/filtros/página/recarga; borradores y guardado; publicación/error/reintento/id discordante; operaciones comerciales con confirmación/error/busy; marca y guardado concurrente/error; retorno canónico/back cancelado; credenciales cancelación/confirmación; Agenda/guard de ajustes/scope; Multicuenta mismo/otro tenant; membresía normal, pestaña obsoleta, tenant/perfil ajenos, vacíos/permisos; fallback y comparación estricta del DOM Producción con la base exacta.
- **PASS: verificación dirigida posterior de los 6 grupos afectados** por estabilizar el nodo del shell Master y sus avisos: responsive, estado/vista previa, recorrido nativo, credenciales (incluye atravesar módulo Agenda sin perder texto), Agenda y Producción. Comando `SPONSOR_G5_CASE='six widths|presentation status|credentials retained|native back|Master Agenda|Production DOM' SPONSOR_G5_ARTIFACTS=/tmp/g5-final-affected node scripts/test-sponsor-g5-shell-contract.mjs --browser`; log `/tmp/g5-final-affected.log`. Dos regresiones dirigidas adicionales conservadas en `/tmp/g5-final-target.log`; no se cuentan como grupos únicos nuevos.
- **PASS: 19 grupos heredados G4**, biblioteca original byte a byte. Causa concreta de repetirlos sobre el candidato nuevo: se modifican la composición compartida SponsoredDashboard/SponsoredUnifiedShell y el selector. Comando `SPONSORED_G4_ARTIFACTS=/tmp/g5-regressions/g4 node --input-type=module -e "import{runSponsoredG4Browser}from'./scripts/lib/sponsored-g4-browser.mjs';await runSponsoredG4Browser()"`; log `/tmp/g5-g4-regression.log`. Esto no reabre la aceptación anterior ni repite QA real.
- **PASS: 3 grupos heredados de retorno/cuenta**, G3.2 `KAWMED_G32_CASE=account` y G3.4 `KAWMED_G34_CASE='account return preserves'`; log `/tmp/g5-medical-account-regression.log`. No se repiten las suites médicas completas ni se modifica un componente médico.
- **PASS: contrato G5** de allowlist, codec, gates, roles/tenant, URI canónicas, operaciones comerciales y guardado/publicación/medios originales, llamadas/payloads y fuentes protegidas. La comparación de call sites no implica un número idéntico de solicitudes HTTP al mantener módulos montados; únicamente se añade al selector una lectura autorizada de sponsor para el retorno. Fuentes de tests previos, API, guards, Free, médico y backend intactas.
- **PASS: 12 contratos pertinentes existentes**, `test-intapcard-{active-account,multiaccount,kawmed-integrated}-contract.mjs`, `test-kawmed-{isolation,web-preview-route,code-accordion,live-guest,demo-invitations,claim-resume-ux}-contract.mjs`, `test-kawvo-free-g2-qa-corrections-2026-11-15.mjs`, `test-kawvo-g5-publication-navigation-2026-11-15.mjs` y `test-sponsored-g4-shell-gate.mjs`. Log `/tmp/g5-regression-contracts-final.log`.
- **PASS: TypeScript y builds App Producción/Preview locales**, `npm run build -w app`, `npm run build:preview -w app`; logs `/tmp/g5-build-{production,preview}.log`. Avisos Vite/Browserslist/chunks permanecen sin cambiar dependencias/configuración.
- **PASS: 320/360/390/430/768/1280 px**, objetivos 44 × 44, safe-area, foco y sin overflow global; capturas de fixtures versionadas y autorrevisión contra #151. El inventario conserva scroll interno en la tabla de escritorio y tarjetas en móvil. Revisión visual independiente y dispositivos reales pendientes.
- **FAIL históricos reproducidos contra la base exacta `46cc46d1` y candidato**: contrato patrocinado línea 330, «agenda solicita teléfono»; contrato Free/Agenda línea 66, «barra del propietario muestra acceso a Configuración». Logs `/tmp/g5-{base,candidate}-test-{sponsored-profile,free-contact-agenda}-contract.log`. No se relajan esos tests ni se corrige Web ajena al lote. La primera ejecución señaló además un fallo nuevo del literal de composición Master (línea 195): se conservó la rama legacy real original y el test vuelve a avanzar al mismo fallo histórico 330.

Incidencias resueltas durante la prueba: perfil/aviso visible fuera de su tab por un contenedor inicial sin ocultar; buscador de asignaciones comprimido en móvil; atributos de accesibilidad nuevos aplicados inicialmente al DOM legacy; re-render durante captura de input que limpiaba texto de credenciales; cambio de tipo de nodo al entrar a Agenda que podía remontar formularios. Se corrigió el producto y se mantuvieron las aserciones estrictas. Se corrigieron también dos expectativas nuevas de fixture (título real «Contáctanos» y recorrido nativo realmente externo), sin modificar pruebas históricas. La comparación DOM de Producción pasó tras conservar las ramas legacy y acotar los cambios a Preview. Un symlink raíz de dependencias aparecía como archivo no permitido; se reutilizó el contenido de enlaces dentro de un directorio ignorado, sin instalar ni cambiar herramientas.

### Límites y entrega

**Preparado para revisión G5; no aceptado ni publicado.** QA autenticada/visual real del nuevo SHA queda pendiente para Juan tras publicación autorizada. Debe cubrir una membresía Master normal y Multicuenta, dos tenants de prueba, perfil/Agenda propios, medios reales, publicación y reflejo público, búsqueda/asignación/importación autorizadas, credenciales y borradores/logout/cambio de cuenta; exclusivamente datos autorizados de prueba. Se preservan las confirmaciones G3/G4. No se solicita repetir sus recorridos aprobados.

El listado completo sigue siendo el que entrega la API existente: paginación servidor/volumen masivo es G7, fuera de este lote. La deuda histórica #134 y dependencias no se reconcilian aquí. Los marcadores de credenciales/soporte son conservadores por interacción; no sustituyen los procedimientos originales ni guardan secretos. No se certifican D1/R2, correo, OAuth, importación/persistencia o permisos remotos con fixtures. CI se registra por SHA en el Draft PR, separada de la QA.

Rollback: usar fallback explícito con protección de pendientes; para retirar G5, revertir únicamente su commit y recuperar `46cc46d17b6bd17af735a627a12357e1938eeb44`. No hay migraciones/datos que recuperar. Rama, SHA final, enlace del Draft PR y CI se acreditan en su descripción de entrega. #177 y su worktree quedan intactos. Sin merge, deploy, Stage, cambios del alias Preview, Producción, infraestructura, API, Web, permisos ni datos reales.

Cierre visual: se ajustaron bordes suaves y acento del acceso principal al patrón #151, sin tocar la rama legacy. Build Producción/Preview final PASS; repetición dirigida de responsive y DOM Producción PASS en `/tmp/g5-visual-final.log`. Las cuatro capturas versionadas corresponden a esta ejecución final; no se cuentan estos dos grupos repetidos como nuevos. Allowlist exacta de catorce archivos y `git diff --check` PASS. Autorrevisión; detenerse tras abrir el Draft PR y acreditar su CI para revisión independiente.

## Continuidad de #178: entradas y etiquetas solicitadas

Punto de partida verificado antes de editar: `7dd1ccab3fc474c62d2f4d09e1b309e90cb3232b`, rama remota/local `feat/kawvo-g5-master-unified`, árbol limpio. #178 abierto, Draft, sin merge ni auto-merge. Main remoto permanece en `6e6bfbb1bd60c91a94e92d36f6cfdd9f91e3d9e2`. Se mantienen los contratos y las aprobaciones G3/G4; este apartado actualiza el alcance inicial y sus afirmaciones históricas «sin Web».

No hizo falta cambiar el gate ni las rutas de entrada: las pruebas ejecutan las dos vías existentes con router, AdminGuard y componentes reales. La cuenta normal autorizada recibe 403 del endpoint exclusivo Multicuenta y continúa mediante su membresía `/sponsor/me`, sin inventar selección o token. Multicuenta exige la selección explícita `kind=sponsor` + id y conserva el token devuelto. Ambas abren Inicio, acceden a gestión y presentación, conservan el contexto al recargar y permiten elegir/reabrir Panel anterior. Denegación de membresía, sponsor/perfil discordantes, tab obsoleta y capacidades limitadas siguen sin conceder acceso.

**Delta funcional puntual:**

- SponsorDashboard: la pestaña sigue siendo **Patrocinios**; el acceso de Inicio, el selector comercial y su título dicen **Gestión de patrocinio**. No cambia `sm_view=assignments`, ninguna operación ni payload comercial. El título nuevo se limita al shell Preview.
- `web/src/components/appointments/AppointmentOwnerBar.tsx`: únicamente el valor predeterminado de `settingsLabel` cambia a **Editar perfil**. Desktop y menú móvil conservan destinos/handlers, contexto autorizado y permisos originales. Las etiquetas explícitas de médico (`Perfil`) y de otras configuraciones permanecen. No cambia la UI pública de pacientes/visitantes sin permiso.
- Allowlist acumulativa: los catorce archivos originales más **exactamente** el componente Web anterior, `scripts/test-owner-profile-label-browser.mjs` y `docs/qa/KAWVO_G5/ownerbar-390.png`. El contrato compara todo el componente Web con la base admitiendo sólo esa sustitución literal; el resto de Web, Functions, API, guards, dependencias y configuraciones sigue protegido. No se añade runner.

### Pruebas de esta continuación

Node 20.20.2, sin instalar herramientas. **Todo el navegador usa HTTP simulado; cero sesiones autenticadas o datos reales modificados.**

- PASS **6 grupos G5 afectados**: seis tamaños, gestión comercial/pendientes/errores, entrada normal + Multicuenta con recarga y fallback, DOM Producción idéntico a la base, cambio/retorno del mismo u otro sponsor y fallos de identidad/permisos. Logs `/tmp/g5-correction.log` (4) y `/tmp/g5-correction-context.log` (2). Comandos:
  - `SPONSOR_G5_CASE='normal authorized account|commercial draft|six widths|Production DOM' SPONSOR_G5_ARTIFACTS=/tmp/g5-correction node scripts/test-sponsor-g5-shell-contract.mjs --browser`
  - `SPONSOR_G5_CASE='Multicuenta first entry|errors empty inventory' SPONSOR_G5_ARTIFACTS=/tmp/g5-correction-context node scripts/test-sponsor-g5-shell-contract.mjs --browser`
- PASS **72 casos de barra pública**: `node scripts/test-owner-profile-label-browser.mjs`. Preview/Producción local × 320/360/390/430/768/1280 × Master/beneficiario/Free/etiqueta médica/otra configuración/visitante. Comprueba destino real tras pulsar, override del servidor, fallback de ruta, menú móvil, GET sin mutaciones, etiquetas explícitas intactas y ausencia de overflow. Resultados `/tmp/kawvo-g5-owner-label/results.json`, log `/tmp/g5-owner-label.log`; captura nueva y cuatro capturas App actualizadas. La captura de la barra aísla el componente con fixture, no simula un perfil público completo ni QA real.
- PASS **4 regresiones públicas G3.2**: `KAWMED_G32_CASE=public node --input-type=module -e "import{runG32Browser}from'./scripts/lib/kawmed-g3-2-browser.mjs';await runG32Browser()"`; log `/tmp/g5-public-regression.log`. Perfil público → editor unificado → Agenda → retorno, enlaces directos/recarga, hints sin seleccionar otra cuenta y pacientes/Producción sin cambios de navegación.
- PASS **6 contratos existentes**: `test-intapcard-active-account-contract`, `test-intapcard-multiaccount-contract`, `test-intapcard-kawmed-integrated-contract`, `test-kawmed-web-preview-route-contract`, `test-kawvo-g5-publication-navigation-2026-11-15`, `test-sponsored-g4-shell-gate` (todos `.mjs` en scripts); log `/tmp/g5-correction-contracts.log`.
- PASS **TypeScript y cuatro builds locales**: `npm run build -w app`, `npm run build:preview -w app`, `npm run build -w web`, `npm run build:preview -w web`. Logs `/tmp/g5-app-{production,preview}-correction.log` y `/tmp/g5-web-{production,preview}.log`. Avisos Vite/Browserslist/chunks conocidos, sin cambios de dependencias.
- **FAIL históricos**, comparados también con el SHA inicial exacto de esta continuación: `test-sponsored-profile-contract.mjs:330` («agenda solicita teléfono») y `test-free-contact-agenda-contract.mjs:66` (busca literalmente `>Configuración</button>` desde antes de este cambio; el componente ya renderizaba `{settingsLabel}`). Logs `/tmp/g5-start-test-*-contract.mjs.log` y `/tmp/g5-label-{sponsored,free}-historical.log`. No se alteran esos contratos ni se cuentan como PASS. La nueva prueba ejecuta el comportamiento de la etiqueta solicitada.
- PASS contrato G5/allowlist y `git diff --check`. CI del SHA final se registra en #178; los workflows existentes no ejecutan automáticamente todos estos fixtures locales.

**Pendiente:** revisión independiente y QA autenticada del nuevo SHA con una membresía normal y una sesión Multicuenta autorizadas, en el host exacto App Preview, además de comprobar la etiqueta sobre el perfil público real. No se vuelve a abrir la aceptación G3/G4. Sin Stage, despliegue, merge, migraciones, infraestructura ni datos reales. Rollback puntual: revertir sólo el commit de esta continuación para volver a `7dd1ccab`; rollback de todo G5: recuperar la base `46cc46d1` mediante el procedimiento aprobado. Fallback explícito sigue disponible y protege pendientes.

### Comandos reservados para la Mac: Stage y después Preview

Se inspeccionaron completos los dos procedimientos `run-kawvo-{free-production-candidate,g5-publication-navigation}-preview-2026-11-15.sh`, la propuesta #171 y la evidencia de promoción #175 (comentario 7001375084). Se reutiliza **Pages deploy desde la raíz con Functions**, proyecto correcto, ramas Preview independientes y posterior subida de los mismos bytes a la rama propietaria del alias. **No ejecutar los runners históricos completos:** fijan otros SHA, baselines, ramas y encadenan Stage/promoción.

Estos son comandos para revisión, **no autorización ni evidencia de publicación**. Preparar App y Web por separado: sólo App no cambia la barra pública. No hay sesión Cloudflare utilizable en este entorno para acreditar el baseline actual de la Mac. Antes de ejecutar los uploads, el preflight habitual debe conservar:

1. Snapshot actual de ambos Workers (una versión al 100%), bindings efectivos APP/WEB_PAGES_ORIGIN, metadata Pages completa (proyecto, entorno Preview, rama propietaria, SHA, success, alias), App/Web Producción y ambos Preview. No usar el TOML ni un nombre de alias deducido de una rama como prueba efectiva.
2. Respaldo **completo** de cada frontend anterior: dist, `_headers`, `_redirects`, `_routes.json` cuando exista, Functions/contexto/lockfile, procedencia y manifiesto; comparar todos los archivos públicos con dominio, alias y deployment inmutable. Functions compiladas/procedencia se acreditan aparte: un GET público no certifica su bundle remoto. Si falta respaldo o hay 404/discrepancia, promoción BLOCKED; no reconstruir el candidato ni quitar archivos Web para forzar un PASS.
3. Las ramas de promoción resueltas del deployment dueño de cada binding. La rama App `qa-kawmed-guest-current-2026-11-02` y alias `qa-kawmed-guest-current-2026.intap-web2.pages.dev` están acreditados históricamente en #175, **no certificados actuales en esta continuación**. Igual cautela con Web. Si el binding apunta a un origen inmutable u otro proyecto, detenerse; no cambiar Worker/DNS.

Preparación aislada, sin publicar. `G5_SHA` debe ser el SHA exacto entregado en #178; no se toma silenciosamente un HEAD futuro del PR. El checkout y los builds anteriores permanecen intactos:

```bash
bash <<'BASH'
set -euo pipefail
umask 077
: "${G5_SHA:?Exportar el SHA exacto revisado de esta entrega antes del bloque}"
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
cd "$ROOT"
test "$(node --version)" = v20.20.2
test -z "$(git status --porcelain)"
test -x node_modules/.bin/wrangler
git fetch --no-tags https://github.com/pgcsoluciones/intap-link.git refs/pull/178/head
test "$(git rev-parse FETCH_HEAD)" = "$G5_SHA"
git merge-base --is-ancestor 7dd1ccab3fc474c62d2f4d09e1b309e90cb3232b "$G5_SHA"
git diff --check 46cc46d17b6bd17af735a627a12357e1938eeb44 "$G5_SHA"
git diff --quiet HEAD "$G5_SHA" -- package.json package-lock.json app/package.json web/package.json
mkdir -p "$HOME/intap-release-logs"
LOG="$HOME/intap-release-logs/kawvo-g5-$G5_SHA"
mkdir "$LOG" # Si ya existe, detenerse; conservar evidencia y no repetir builds/uploads.
git worktree add -b "qa/kawvo-g5-${G5_SHA:0:12}" "$LOG/source" "$G5_SHA"
cd "$LOG/source"
node - "$ROOT" <<'NODE'
const fs=require('node:fs'),path=require('node:path'),root=process.argv[2];
for(const rel of ['node_modules','app/node_modules','web/node_modules']){
 const src=path.join(root,rel);if(!fs.existsSync(src))continue;
 fs.mkdirSync(rel,{recursive:true});
 for(const name of fs.readdirSync(src))fs.symlinkSync(path.join(src,name),path.join(rel,name));
}
NODE
export WRANGLER_SEND_METRICS=false
npm run app:build:preview > "$LOG/app-build.log" 2>&1
npm run web:build:preview > "$LOG/web-build.log" 2>&1
for target in app web; do
 npx --no-install wrangler pages functions build functions --outfile "$LOG/$target-functions.bundle" --output-routes-path "$LOG/$target-functions-routes.json" --build-output-directory "$target/dist" > "$LOG/$target-functions.log" 2>&1
done
test "$(git rev-parse HEAD)" = "$G5_SHA"
test -z "$(git status --porcelain)"
test -z "$(git -C "$ROOT" status --porcelain)"
printf 'Preparado sin publicar: %s\n' "$LOG"
BASH
```

Operaciones Pages habituales reservadas, **desde `$LOG/source`**, únicamente después del preflight anterior y autorización de cada acción. `APP_PREVIEW_BRANCH` y `WEB_PREVIEW_BRANCH` son las ramas reales obtenidas de la metadata efectiva, **no** el alias truncado ni main. Ningún valor actual se inventa aquí. Estos comandos son el núcleo del procedimiento, no un sustituto del preflight/verificación:

```bash
# Stage aislado: primero App y verificar; después Web y verificar. No encadenar a promoción.
LOG="$HOME/intap-release-logs/kawvo-g5-$G5_SHA"
cd "$LOG/source"
test "$(git rev-parse HEAD)" = "$G5_SHA" && test -z "$(git status --porcelain)"
test ! -e "$LOG/app-stage.log"
npx --no-install wrangler pages deploy app/dist --project-name intap-web2 --branch "qa-kawvo-g5-app-${G5_SHA:0:12}" --commit-hash "$G5_SHA" > "$LOG/app-stage.log" 2>&1
```

Verificar metadata y bytes del Stage App y snapshot sin deriva antes del Stage Web:

```bash
LOG="$HOME/intap-release-logs/kawvo-g5-$G5_SHA"
cd "$LOG/source"
test "$(git rev-parse HEAD)" = "$G5_SHA" && test -z "$(git status --porcelain)"
test ! -e "$LOG/web-stage.log"
npx --no-install wrangler pages deploy web/dist --project-name intap-link --branch "qa-kawvo-g5-web-${G5_SHA:0:12}" --commit-hash "$G5_SHA" > "$LOG/web-stage.log" 2>&1
```

Promoción posterior App; no ejecutar hasta revisar ambos Stage y el respaldo:

```bash
LOG="$HOME/intap-release-logs/kawvo-g5-$G5_SHA"
cd "$LOG/source"
test "$(git rev-parse HEAD)" = "$G5_SHA" && test -z "$(git status --porcelain)"
# Preview: otra acción tras revisar Stage, metadata/bytes, snapshot sin deriva y respaldo completo.
# Exigir variables resueltas por el preflight; no usar nombres por suposición.
: "${APP_PREVIEW_BRANCH:?Falta rama App propietaria verificada}"
: "${WEB_PREVIEW_BRANCH:?Falta rama Web propietaria verificada}"
case "$APP_PREVIEW_BRANCH:$WEB_PREVIEW_BRANCH" in *main*|*production*|*master*) echo 'BLOCKED: rama no Preview'; exit 1;; esac
test ! -e "$LOG/app-preview.log"
npx --no-install wrangler pages deploy app/dist --project-name intap-web2 --branch "$APP_PREVIEW_BRANCH" --commit-hash "$G5_SHA" > "$LOG/app-preview.log" 2>&1
```

Verificar metadata/bytes/host App y snapshot antes de la promoción Web independiente:

```bash
LOG="$HOME/intap-release-logs/kawvo-g5-$G5_SHA"
cd "$LOG/source"
test "$(git rev-parse HEAD)" = "$G5_SHA" && test -z "$(git status --porcelain)"
: "${WEB_PREVIEW_BRANCH:?Falta rama Web propietaria verificada}"
case "$WEB_PREVIEW_BRANCH" in *main*|*production*|*master*) echo 'BLOCKED: rama no Preview'; exit 1;; esac
test ! -e "$LOG/web-preview.log"
npx --no-install wrangler pages deploy web/dist --project-name intap-link --branch "$WEB_PREVIEW_BRANCH" --commit-hash "$G5_SHA" > "$LOG/web-preview.log" 2>&1
```

Antes de **cada** upload: SHA/árbol limpio, manifiesto dist/Functions sin cambios, rama distinta de `production_branch` efectiva, snapshots aún coincidentes y ausencia de intento anterior del mismo upload. Después: obtener URL inmutable del log; confirmar metadata **SHA completo, rama, entorno Preview, success y alias real**, comparar buffers completos de todos los archivos públicos (URL-encode por segmento; admitir espacios/acentos) contra el artefacto conservado, más las rutas SPA pertinentes. No pedir `_headers`, `_redirects` o `_routes.json` como URLs públicas: conservarlos y acreditar su procedencia; no filtrarlos del upload. Ante resultado ambiguo, registrar y detener, no repetir upload. Verificar Workers y Producción contra el snapshot fresco. Stage no debe cambiar los Preview activos. Después de promover, comparar también los custom hosts y aliases; en App se exige `app.preview.intaprd.com` para QA del shell.

Rollback futuro, si se autoriza: desde la copia raíz del respaldo del frontend afectado, subir **su dist original con su SHA anterior y Functions/contexto conservados** al mismo proyecto y rama Preview acreditados, y repetir metadata/bytes/custom host y snapshot protegido. No usar rollback de Producción Pages ni reconstruir sobre el directorio candidato. No se ha ensayado ni autorizado una recuperación en esta continuación. El acceso concreto pendiente para convertir los comandos reservados en una publicación verificada es la sesión Wrangler de la Mac con lectura de versiones/bindings y metadata Pages y los artefactos completos de los Preview vigentes; no se solicitan secretos en el chat.
