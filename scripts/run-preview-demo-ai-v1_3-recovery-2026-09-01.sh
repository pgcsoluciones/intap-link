#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawvo-demo-ai-v1"
LOG_DIR="$ROOT/.preview-demo-ai-v1_3-recovery-2026-09-01-logs"

fail() { echo ""; echo "✗ ERROR: $1"; exit 1; }
run() { echo ""; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR"
mkdir -p "$LOG_DIR"

run git fetch github "$BRANCH"
run git checkout -B "$BRANCH" "github/$BRANCH"
run git reset --hard "github/$BRANCH"

[ -z "$(git status --porcelain)" ] || { git status --short; fail "Working tree no está limpio"; }

run python3 scripts/apply-demo-ai-preview-route-v1_3.py
run git diff --check

echo ""
echo "▶ Validando registro de ruta Preview"
grep -q "registerDemoAiRoutes(app)" api/src/preview-free-entry.ts || fail "La ruta Demo IA no quedó registrada en Preview"
echo "✓ registro Preview presente"

run node scripts/test-demo-ai-contract.mjs

echo ""
echo "▶ TypeScript API Preview"
(cd api && npx tsc --noEmit) || fail "TypeScript API Preview"

echo ""
echo "▶ Dry-run Worker Preview"
(cd api && npx wrangler deploy --config wrangler.preview.toml --dry-run) || fail "Dry-run Worker Preview"

run git add api/src/preview-free-entry.ts scripts/apply-demo-ai-preview-route-v1_3.py scripts/run-preview-demo-ai-v1_3-recovery-2026-09-01.sh
if ! git diff --cached --quiet; then
  run git commit -m "fix(preview): expose Demo AI endpoint through final preview app"
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

echo ""
echo "▶ Verificando endpoint Demo IA real"
CONSENT_BODY="$LOG_DIR/consent.json"
CONSENT_CODE="$(curl -sS -o "$CONSENT_BODY" -w '%{http_code}' -X POST \
  -H 'content-type: application/json' \
  --data '{"session_key":"qa-consent-v13-123456789","consent":{"accepted":false,"version":"demo-ai-v1.0"},"activity":"Mecánico","name":"QA","work_description":"Mantenimiento y frenos"}' \
  https://preview.intaprd.com/api/v1/public/demo/ai/generate)"
[ "$CONSENT_CODE" = "428" ] || { cat "$CONSENT_BODY" || true; fail "Consent guard respondió HTTP $CONSENT_CODE en lugar de 428"; }
grep -q 'consent_required' "$CONSENT_BODY" || fail "Respuesta 428 no contiene consent_required"
echo "✓ endpoint Demo IA alcanzable + consentimiento server-side HTTP 428"

run env PREVIEW_BASE="https://preview.intaprd.com" node scripts/qa-demo-ai-preview.mjs

for url in "https://preview.intaprd.com/demo" "https://preview.intaprd.com/demo/ia"; do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
  echo "✓ $url -> HTTP 200"
done

cat <<EOF

============================================================
✓ KAWVO LINK · DEMO IA V1.3 · PREVIEW RECUPERADO
============================================================
Branch:          $BRANCH
Final SHA:       $FINAL_SHA
Worker Version:  ${WORKER_VERSION:-ver salida Wrangler}
Demo manual:     https://preview.intaprd.com/demo
Demo IA:         https://preview.intaprd.com/demo/ia
Producción:      NO TOCADA

Corregido:
- El endpoint público Demo IA queda registrado sobre el app final del Worker Preview.
- Consentimiento sin aceptar responde 428 + consent_required.
- Se vuelve a ejecutar el QA automatizado de clasificación, límites, fallback y snapshots.
============================================================
EOF
