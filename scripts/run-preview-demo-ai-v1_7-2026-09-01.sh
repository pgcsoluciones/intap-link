#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawvo-demo-ai-v1"
WEB_PROJECT="intap-web2"
WEB_DEPLOY_BRANCH="feature-kawvo-demo-ai-v1"
LOG_DIR="$ROOT/.preview-demo-ai-v1_7-2026-09-01-logs"

fail(){ echo ""; echo "✗ ERROR: $1"; exit 1; }
run(){ echo ""; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf .preview-demo-ai-v1_*-2026-09-01-logs "$LOG_DIR"
mkdir -p "$LOG_DIR"

run git fetch github "$BRANCH"
run git checkout -B "$BRANCH" "github/$BRANCH"
run git reset --hard "github/$BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Working tree no está limpio"; }

run python3 scripts/apply-demo-ai-final-copy-v1_7.py
run git diff --check
run node scripts/test-demo-ai-contract.mjs
run node scripts/test-demo-ai-product-v1_5.mjs
run node scripts/test-demo-ai-product-v1_6.mjs

grep -q "Me interesa, quiero mi Perfil" web/src/components/demo/KawvoLinkDemo.tsx || fail "Falta coma en CTA comercial"
if grep -A3 'kawvo-demo-ai-top' web/src/components/demo/KawvoLinkDemoAi.tsx | grep -q 'Probar sin IA'; then fail "Probar sin IA todavía está en el encabezado"; fi
grep -q 'kawvo-demo-ai-manual-bottom' web/src/components/demo/KawvoLinkDemoAi.tsx || fail "Alternativa manual no quedó al final"

echo "▶ Build Web Preview"
(cd web && npm run build:preview) || fail "Build Web Preview"

echo "▶ TypeScript API Preview"
(cd api && npx tsc --noEmit) || fail "TypeScript API Preview"

echo "▶ Dry-run Worker Preview"
(cd api && npx wrangler deploy --config wrangler.preview.toml --dry-run) || fail "Dry-run Worker Preview"

run git add web/src/components/demo/KawvoLinkDemo.tsx web/src/components/demo/KawvoLinkDemoAi.tsx scripts/apply-demo-ai-final-copy-v1_7.py scripts/run-preview-demo-ai-v1_7-2026-09-01.sh
if ! git diff --cached --quiet; then
  run git commit -m "fix(demo): polish final CTA copy and manual fallback placement"
  run git push github "HEAD:$BRANCH"
fi
FEATURE_SHA="$(git rev-parse HEAD)"

WEB_LOG="$LOG_DIR/web-pages.log"
(npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch "$WEB_DEPLOY_BRANCH") 2>&1 | tee "$WEB_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Web Pages Preview"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$WEB_LOG" | tail -1)"
[ -n "$WEB_ORIGIN" ] || fail "No pude identificar WEB_PAGES_ORIGIN"

WEB_ORIGIN="$WEB_ORIGIN" python3 - <<'PY' || fail "Fijar WEB_PAGES_ORIGIN Preview"
from pathlib import Path
import os,re
p=Path('api/wrangler.preview.toml')
s=p.read_text()
s,n=re.subn(r'^WEB_PAGES_ORIGIN = ".*"$',f'WEB_PAGES_ORIGIN = "{os.environ["WEB_ORIGIN"]}"',s,count=1,flags=re.M)
if n != 1: raise SystemExit('No pude fijar WEB_PAGES_ORIGIN')
p.write_text(s)
PY
run git diff --check
run git add api/wrangler.preview.toml
if ! git diff --cached --quiet; then
  run git commit -m "chore(preview): pin Demo AI v1.7 web origin"
  run git push github "HEAD:$BRANCH"
fi
FINAL_SHA="$(git rev-parse HEAD)"

WORKER_LOG="$LOG_DIR/worker-preview.log"
(cd api && npx wrangler deploy --config wrangler.preview.toml) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Preview"
WORKER_VERSION="$(grep -E 'Current Version ID:' "$WORKER_LOG" | tail -1 | sed -E 's/.*Current Version ID:[[:space:]]*//')"
sleep 2

for url in "https://preview.intaprd.com/demo" "https://preview.intaprd.com/demo/ia"; do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
  echo "✓ $url -> HTTP 200"
done

run env PREVIEW_BASE="https://preview.intaprd.com" node scripts/qa-demo-ai-preview.mjs

grep -R "Me interesa, quiero mi Perfil" web/dist/assets >/dev/null || fail "CTA final no llegó al bundle"
grep -R "kawvo-demo-ai-manual-bottom" web/dist/assets >/dev/null || fail "Nueva posición de Probar sin IA no llegó al bundle"

cat <<EOF

============================================================
✓ KAWVO LINK · DEMO IA V1.7 · PREVIEW FINAL APROBADO
============================================================
Feature SHA:     $FEATURE_SHA
Final SHA:       $FINAL_SHA
Web Pages:       $WEB_ORIGIN
Worker Version:  ${WORKER_VERSION:-ver salida Wrangler}
Demo IA:         https://preview.intaprd.com/demo/ia
Producción:      AÚN NO TOCADA

Últimos dos cambios:
- CTA: "Me interesa, quiero mi Perfil";
- "Probar sin IA" retirado del encabezado y dejado discreto al final.
============================================================
EOF
