#!/usr/bin/env bash
# G1: branch determined by Cloudflare Pages deployment history (2026-11-13).
# Alias currently used by Worker: qa-kawmed-guest-current-2026.intap-web2.pages.dev
# Its REAL Pages branch: qa-kawmed-guest-current-2026-11-02
# Never modify Worker, bindings, OAuth, D1/R2, web or Production.

# G1 Preview: deploy App UI through existing Pages branch alias only. Never touch Worker.
set -euo pipefail
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawvo-free-g1-current-main-integration-2026-11-12"
UI_COMMIT="790c46e11340be81e802edb4e6a6c60e0c459736"
WORKER="intap-api-preview"
VERSION="23405a5b-e9ca-4247-843d-28cc4f236eaa"
ALIAS="https://qa-kawmed-guest-current-2026.intap-web2.pages.dev"
WEB="https://qa-sponsor-scan-1104.intap-link.pages.dev"
STAGE="https://d1451e86.intap-web2.pages.dev"
HOST="https://app.preview.intaprd.com"
PAGES_BRANCH="qa-kawmed-guest-current-2026-11-02"
stop(){ echo "DETENIDO: $*" >&2; exit 1; }
[[ "$(printenv KAWVO_G1_PAGES_APPROVED 2>/dev/null || true)" == "SI" ]] || stop "Requiere autorización KAWVO_G1_PAGES_APPROVED=SI"
cd "$ROOT" || stop "Checkout no disponible"
[[ "$(git branch --show-current)" == "$BRANCH" ]] || stop "Rama incorrecta"
[[ -z "$(git status --porcelain)" ]] || stop "Hay modificaciones locales"
git merge-base --is-ancestor "$UI_COMMIT" HEAD || stop "No incluye commit de UI"
git diff --exit-code "$UI_COMMIT" HEAD -- app/ >/dev/null || stop "App difiere del QA aprobado"
[[ -f app/dist/index.html ]] || stop "Falta compilación QA"
node scripts/test-kawvo-free-shell-preview-isolation-2026-11-12.mjs || stop "Test aislamiento"
node scripts/test-kawvo-free-shell-desktop-parity-2026-11-12.mjs || stop "Test UI"
node scripts/test-kawmed-demo-invitations-contract.mjs || stop "Test KawMed Guest"
node scripts/test-kawmed-isolation-contract.mjs || stop "Test KawMed aislamiento"

mkdir -p "$HOME/intap-release-logs"
LOG="$(mktemp -d "$HOME/intap-release-logs/kawvo-g1-pages-alias-XXXXXXXX")"
echo "LOG: $LOG"
npx --no-install wrangler deployments status --name "$WORKER" --json > "$LOG/status-before.json" 2> "$LOG/status-before.err" || stop "Sin estado Worker"
npx --no-install wrangler versions view "$VERSION" --name "$WORKER" --json > "$LOG/version-before.json" 2> "$LOG/version-before.err" || stop "Sin versión Worker original"
node - "$LOG/status-before.json" "$LOG/version-before.json" "$VERSION" "$ALIAS" "$WEB" <<'NODE' || stop "Rollback del Worker NO confirmado; no se publica Pages"
const fs=require('fs')
const [sf,vf,id,app,web]=process.argv.slice(2)
const status=JSON.parse(fs.readFileSync(sf,'utf8'))
if(!Array.isArray(status.versions)||status.versions.length!==1||status.versions[0].version_id!==id||Number(status.versions[0].percentage)!==100)throw Error('Worker anterior no está al 100%')
const version=JSON.parse(fs.readFileSync(vf,'utf8')),groups=[]
function walk(o){if(!o||typeof o!=='object')return;if(Array.isArray(o)){o.forEach(walk);return}if(Array.isArray(o.bindings))groups.push(o.bindings);Object.values(o).forEach(walk)}
walk(version)
const bs=groups.find(a=>a.some(x=>x.name==='APP_PAGES_ORIGIN'))
if(!bs||bs.length!==35||new Set(bs.map(x=>x.name)).size!==35)throw Error('Versión Worker no conserva 35 bindings')
for(const [name,val] of [['APP_PAGES_ORIGIN',app],['WEB_PAGES_ORIGIN',web]]){const b=bs.filter(x=>x.name===name&&x.type==='plain_text');if(b.length!==1||b[0].text!==val)throw Error('Origen incorrecto '+name)}
for(const [name,type] of [['DB','d1'],['BUCKET','r2_bucket'],['GOOGLE_CLIENT_SECRET','secret_text']])if(!bs.some(x=>x.name===name&&x.type===type))throw Error('Falta '+name)
console.log('PASS: rollback Worker al 100%, 35 bindings y orígenes correctos')
NODE
asset(){ grep -Eo '/assets/index-[A-Za-z0-9_-]+\.js' "$1" | head -1; }
JS="$(asset app/dist/index.html)"
[[ -n "$JS" && -f "app/dist$JS" ]] || stop "No hay JS compilado"
curl -fsSL --connect-timeout 10 --max-time 35 "$STAGE/admin/login" -o "$LOG/stage.html" || stop "QA Pages no responde"
[[ "$(asset "$LOG/stage.html")" == "$JS" ]] || stop "QA Pages tiene otro JS"
curl -fsSL --connect-timeout 10 --max-time 35 "$STAGE$JS" -o "$LOG/stage.js" || stop "No existe JS QA"
cmp -s "app/dist$JS" "$LOG/stage.js" || stop "JS QA difiere de local"
curl -fsSL --connect-timeout 10 --max-time 35 "$ALIAS/admin/login" -o "$LOG/old-alias.html" || stop "Alias no responde"
curl -fsSL --connect-timeout 10 --max-time 35 "$HOST/admin/login" -o "$LOG/old-domain.html" || stop "App Preview no responde"
OLD_JS="$(asset "$LOG/old-alias.html")"
[[ -n "$OLD_JS" && "$(asset "$LOG/old-domain.html")" == "$OLD_JS" ]] || stop "App Preview no sirve alias esperado"

if [[ "$OLD_JS" == "$JS" ]]; then
  echo "PASS: alias ya contiene G1; se omite deploy"
else
  echo "▶ Publicando SOLO Pages en la rama asociada a App Preview; Worker no se toca"
  npx --no-install wrangler pages deploy app/dist --project-name intap-web2 --branch "$PAGES_BRANCH" --commit-hash "$UI_COMMIT" 2>&1 | tee "$LOG/pages-deploy.log" || stop "Falló Pages"
  grep -Fq "$ALIAS" "$LOG/pages-deploy.log" || stop "Pages no confirmó el alias esperado. NO desplegar otra vez; revisar log."
fi
OK=0
for i in 1 2 3 4 5 6; do
  if curl -fsSL --connect-timeout 10 --max-time 35 "$HOST/admin/free/shell-preview?kawvo_shell=1" -o "$LOG/qa.html" \
    && [[ "$(asset "$LOG/qa.html")" == "$JS" ]] \
    && curl -fsSL --connect-timeout 10 --max-time 35 "$HOST$JS" -o "$LOG/qa.js" \
    && cmp -s "$LOG/qa.js" "app/dist$JS"; then OK=1; break; fi
  sleep 3
done
npx --no-install wrangler deployments status --name "$WORKER" --json > "$LOG/status-after.json" 2> "$LOG/status-after.err" || stop "Sin estado Worker tras Pages"
node - "$LOG/status-after.json" "$VERSION" <<'NODE' || stop "Worker cambió inesperadamente"
const fs=require('fs'),[file,id]=process.argv.slice(2),x=JSON.parse(fs.readFileSync(file,'utf8'))
if(!Array.isArray(x.versions)||x.versions.length!==1||x.versions[0].version_id!==id||Number(x.versions[0].percentage)!==100)throw Error('Worker no quedó en versión original')
NODE
[[ "$OK" == 1 ]] || stop "Pages publicado pero dominio no sirve el bundle G1; NO reintentar a ciegas"
echo "PASS: APP PREVIEW ACTUALIZADO mediante la rama real qa-kawmed-guest-current-2026-11-02"
echo "PASS: WORKER ORIGINAL INTACTO al 100%, sin PATCH ni redeploy"
echo "PASS: bundle del dominio autenticado idéntico al QA aprobado"
echo "QA: $HOST/admin/free/shell-preview?kawvo_shell=1"
echo "LOG: $LOG"
echo "Sin cambios en Worker, OAuth, API, D1/R2 ni Producción."
