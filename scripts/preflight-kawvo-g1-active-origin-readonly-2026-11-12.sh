#!/usr/bin/env bash
# Kawvo G1: read-only compatibility and rollback evidence gate.
# NO deploy; NO worker modifications; NO OAuth/cookie or API/data modifications.
set -euo pipefail
[[ "${KAWVO_G1_PREFLIGHT_APPROVED:-}" == "SI" ]] || { echo "DETENIDO: falta KAWVO_G1_PREFLIGHT_APPROVED=SI"; exit 1; }
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
EXPECTED_BRANCH="feature/kawvo-free-g1-current-main-integration-2026-11-12"
EXPECTED_WORKER="23405a5b-e9ca-4247-843d-28cc4f236eaa"
EXPECTED_APP="https://qa-kawmed-guest-current-2026.intap-web2.pages.dev"
EXPECTED_WEB="https://qa-sponsor-scan-1104.intap-link.pages.dev"
fail(){ echo "BLOCKED: $*" >&2; exit 1; }
cd "$ROOT" || fail "No está disponible el checkout"
[[ -z "$(git status --porcelain)" ]] || fail "Hay cambios locales sin guardar"
[[ "$(git branch --show-current)" == "$EXPECTED_BRANCH" ]] || fail "No estás en la rama integración G1"
[[ -f app/dist/index.html ]] || fail "Primero compilar el App Preview de esta rama"
mkdir -p "$HOME/intap-release-logs"
LOG="$(mktemp -d "$HOME/intap-release-logs/kawvo-g1-release-readonly-XXXXXXXX")"
echo "LOG: $LOG"
git rev-parse HEAD > "$LOG/candidate-git-sha.txt"
echo "===== 1/4: Worker Preview activo ====="
npx --no-install wrangler deployments status --name intap-api-preview --json > "$LOG/worker-status.json" 2> "$LOG/worker-status.stderr" || fail "No se pudo consultar estado Worker"
node - "$LOG/worker-status.json" "$EXPECTED_WORKER" <<'NODE' || fail "Versión Worker activa distinta o ambigua"
const fs=require('node:fs');
const [f,expected]=process.argv.slice(2);
const deployment=JSON.parse(fs.readFileSync(f,'utf8'));
const v=deployment.versions||[];
if(v.length!==1 || v[0].version_id!==expected || Number(v[0].percentage)!==100)process.exit(2);
console.log('Worker Preview confirmado:',expected,'(100%)');
NODE
npx --no-install wrangler versions view "$EXPECTED_WORKER" --name intap-api-preview --json > "$LOG/worker-version.json" 2> "$LOG/worker-version.stderr" || fail "No se pudo consultar versión Worker"
node - "$LOG/worker-version.json" "$EXPECTED_APP" "$EXPECTED_WEB" "$LOG/origins.txt" <<'NODE' || fail "Variables Worker cambiaron o no son legibles"
const fs=require('node:fs');
const [f,app,web,out]=process.argv.slice(2);
const v=JSON.parse(fs.readFileSync(f,'utf8'));
const nodes=[];
function visit(x){if(!x||typeof x!=='object')return;if(Array.isArray(x)){x.forEach(visit);return;}if(typeof x.name==='string' && x.name.endsWith('_PAGES_ORIGIN'))nodes.push(x);Object.values(x).forEach(visit)}
visit(v);
function origin(n){const list=nodes.filter(x=>x.name===n);if(list.length!==1)throw Error('No hay un binding único para '+n);return list[0].text}
const currentApp=origin('APP_PAGES_ORIGIN'),currentWeb=origin('WEB_PAGES_ORIGIN');
if(currentApp!==app||currentWeb!==web)throw Error('La configuración del Worker cambió; no promover');
fs.writeFileSync(out,'APP_PAGES_ORIGIN='+currentApp+'\nWEB_PAGES_ORIGIN='+currentWeb+'\n');
console.log('Origen App activo:',currentApp);
console.log('Origen Web activo:',currentWeb);
NODE
echo "===== 2/4: respuestas del App activo y su origen ====="
curl -fsSL --connect-timeout 10 --max-time 40 "https://app.preview.intaprd.com/admin/login" -o "$LOG/active-domain-login.html" || fail "App Preview no responde"
curl -fsSL --connect-timeout 10 --max-time 40 "$EXPECTED_APP/admin/login" -o "$LOG/active-origin-login.html" || fail "Origen App actual no responde"
echo "===== 3/4: huellas del JS de cada origen ====="
node - "$LOG/active-domain-login.html" "$LOG/active-origin-login.html" "app/dist/index.html" "$LOG/asset-paths.tsv" <<'NODE' || fail "No se pudo identificar entry JS"
const fs=require('node:fs');const [domain,active,candidate,out]=process.argv.slice(2);
function asset(file){const html=fs.readFileSync(file,'utf8');const m=html.match(/(?:src|href)=["'](\/assets\/index-[^"']+\.js)["']/);if(!m)throw Error('Falta index JS en '+file);return m[1]}
const a=asset(domain),b=asset(active),c=asset(candidate);
fs.writeFileSync(out,[['domain',a],['active',b],['candidate',c]].map(x=>x.join('\t')).join('\n')+'\n');
console.log('Dominio activo:',a);console.log('Origen activo:',b);console.log('Integración candidata:',c);
if(a!==b)throw Error('El dominio y el origen configurado no sirven la misma referencia JS');
NODE
ACTIVE_ASSET="$(awk -F '\t' '$1=="active"{print $2}' "$LOG/asset-paths.tsv")"
CANDIDATE_ASSET="$(awk -F '\t' '$1=="candidate"{print $2}' "$LOG/asset-paths.tsv")"
curl -fsSL --connect-timeout 10 --max-time 60 "$EXPECTED_APP$ACTIVE_ASSET" -o "$LOG/active-entry.js" || fail "No se pudo conservar entry JS del origen vigente"
[[ -f "app/dist$CANDIDATE_ASSET" ]] || fail "No existe entry JS candidato"
shasum -a 256 "$LOG/active-entry.js" "app/dist$CANDIDATE_ASSET" > "$LOG/entry-sha256.txt"
echo "===== 4/4: evaluación conservadora ====="
cat "$LOG/asset-paths.tsv"
cat "$LOG/entry-sha256.txt"
cat > "$LOG/decision.txt" <<'DECISION'
G1: PRE-FLIGHT READ-ONLY TERMINADO; PROMOCION BLOQUEADA.
Esta captura identifica el Worker, ambos orígenes, el JS activo y la compilación candidata.
No demuestra qué commit generó el bundle activo KawMed Guest ni compatibilidad funcional autenticada.
No autoriza cambiar APP_PAGES_ORIGIN, hacer wrangler deploy ni usar Google OAuth en pages.dev.
El archivo wrangler.preview.toml de GitHub main NO equivale a las vars activas Cloudflare.
Siguiente requisito: reconciliación de código del origen activo + rollback operativo exacto antes de mover tráfico.
DECISION
echo "GUARDADO: $LOG/decision.txt"
echo "GUARDADO: $LOG/entry-sha256.txt"
echo "PASS: evidencia read-only obtenida. BLOQUEADO el despliegue, sin cambios de Cloudflare ni Production."
