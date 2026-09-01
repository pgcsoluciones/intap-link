#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawvo-demo-ai-v1"
WEB_PROJECT="intap-web2"
WEB_DEPLOY_BRANCH="feature-kawvo-demo-ai-v1"
LOG_DIR="$ROOT/.preview-demo-ai-v1_5-2026-09-01-logs"

fail(){ echo ""; echo "✗ ERROR: $1"; exit 1; }
run(){ echo ""; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf .preview-demo-ai-v1_*-2026-09-01-logs "$LOG_DIR"
mkdir -p "$LOG_DIR"

run git fetch github "$BRANCH"
run git checkout -B "$BRANCH" "github/$BRANCH"
run git reset --hard "github/$BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Working tree no está limpio"; }

run python3 scripts/apply-demo-ai-product-refinements-v1_5.py
run git diff --check
run node scripts/test-demo-ai-contract.mjs
run node scripts/test-demo-ai-product-v1_4.mjs
run node scripts/test-demo-ai-product-v1_5.mjs

if git status --short | grep -E 'api/(migrations|migrations-preview)/' >/dev/null; then
  fail "Apareció una migración inesperada"
fi
echo "✓ Sin migración nueva"

echo ""
echo "▶ Build Web Preview"
(cd web && npm run build:preview) || fail "Build Web Preview"

echo ""
echo "▶ TypeScript API Preview"
(cd api && npx tsc --noEmit) || fail "TypeScript API Preview"

echo ""
echo "▶ Dry-run Worker Preview"
(cd api && npx wrangler deploy --config wrangler.preview.toml --dry-run) || fail "Dry-run Worker Preview"

run git add \
  api/src/routes/demo-ai.ts \
  web/src/components/demo/KawvoLinkDemoAi.tsx \
  web/src/components/demo/KawvoLinkDemoAi.css \
  web/src/components/demo/KawvoLinkDemo.tsx \
  web/src/components/demo/KawvoLinkDemoShared.tsx \
  web/src/components/demo/DemoBankAccounts.tsx \
  scripts/apply-demo-ai-product-refinements-v1_5.py \
  scripts/test-demo-ai-product-v1_5.mjs \
  scripts/run-preview-demo-ai-v1_5-2026-09-01.sh

if ! git diff --cached --quiet; then
  run git commit -m "feat(demo): refine bank preview and shared demo flow"
  run git push github "HEAD:$BRANCH"
fi
FEATURE_SHA="$(git rev-parse HEAD)"

echo ""
echo "▶ Deploy Web SOLO Preview con Pages Functions"
WEB_LOG="$LOG_DIR/web-pages.log"
(npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch "$WEB_DEPLOY_BRANCH") 2>&1 | tee "$WEB_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Web Pages Preview"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$WEB_LOG" | tail -1)"
[ -n "$WEB_ORIGIN" ] || fail "No pude identificar WEB_PAGES_ORIGIN"
echo "✓ WEB_PAGES_ORIGIN=$WEB_ORIGIN"

WEB_ORIGIN="$WEB_ORIGIN" python3 - <<'PY' || fail "Fijar WEB_PAGES_ORIGIN Preview"
from pathlib import Path
import os,re
p=Path('api/wrangler.preview.toml')
s=p.read_text()
s,n=re.subn(r'^WEB_PAGES_ORIGIN = ".*"$',f'WEB_PAGES_ORIGIN = "{os.environ["WEB_ORIGIN"]}"',s,count=1,flags=re.M)
if n != 1: raise SystemExit('No pude fijar WEB_PAGES_ORIGIN')
p.write_text(s)
print('✓ Web origin Preview fijado')
PY
run git diff --check
run git add api/wrangler.preview.toml
if ! git diff --cached --quiet; then
  run git commit -m "chore(preview): pin Demo AI v1.5 web origin"
  run git push github "HEAD:$BRANCH"
fi
FINAL_SHA="$(git rev-parse HEAD)"

echo ""
echo "▶ Deploy Worker SOLO Preview"
WORKER_LOG="$LOG_DIR/worker-preview.log"
(cd api && npx wrangler deploy --config wrangler.preview.toml) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Preview"
WORKER_VERSION="$(grep -E 'Current Version ID:' "$WORKER_LOG" | tail -1 | sed -E 's/.*Current Version ID:[[:space:]]*//')"
sleep 2

for url in \
  "https://preview.intaprd.com/demo" \
  "https://preview.intaprd.com/demo/ia"; do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
  echo "✓ $url -> HTTP 200"
done

run env PREVIEW_BASE="https://preview.intaprd.com" node scripts/qa-demo-ai-preview.mjs

# Delivered-bundle checks for the requested experience.
grep -R "Mostrar cómo se verían tus datos bancarios" web/dist/assets >/dev/null || fail "Copy bancario claro no llegó al build"
grep -R "Personalizar mi demo" web/dist/assets >/dev/null || fail "CTA Personalizar mi demo no llegó al build"
grep -R "Me interesa quiero mi Perfil" web/dist/assets >/dev/null || fail "CTA comercial no llegó al build"
grep -R "Crear mi demo" web/dist/assets >/dev/null || fail "CTA neutro compartido no llegó al build"
if grep -R "Ajustar mi demo" web/dist/assets >/dev/null; then fail "Todavía existe Ajustar mi demo"; fi
if grep -R "Hacerla sin IA" web/dist/assets >/dev/null; then fail "Demo compartida todavía expone elección IA/no IA"; fi

echo "✓ refinamientos V1.5 presentes en bundle Preview"

cat <<EOF

============================================================
✓ KAWVO LINK · DEMO IA V1.5 · PREVIEW LISTO PARA QA VISUAL
============================================================
Feature SHA:     $FEATURE_SHA
Final SHA:       $FINAL_SHA
Web Pages:       $WEB_ORIGIN
Worker Version:  ${WORKER_VERSION:-ver salida Wrangler}
Demo IA:         https://preview.intaprd.com/demo/ia
Demo manual:     https://preview.intaprd.com/demo?manual=1
Producción:      NO TOCADA

Incluido:
- ejemplo bancario seleccionado por defecto y explicado como beneficio;
- usuario puede quitar el ejemplo bancario;
- cuenta y cédula/RNC muestran solo últimos 4 dígitos;
- aviso bancario retirado del Perfil Demo final;
- bio/copy no usa el nombre del usuario dentro de la descripción;
- IA exige exactamente 3 servicios derivados de hechos confirmados;
- eliminado "Ajustar mi demo";
- CTA comercial: "Me interesa quiero mi Perfil";
- demo compartida muestra solo "Crear mi demo" y entra al flujo IA;
- alternativa manual queda discreta dentro de la landing Demo IA;
- QA E2E anterior reejecutado.
============================================================
EOF
