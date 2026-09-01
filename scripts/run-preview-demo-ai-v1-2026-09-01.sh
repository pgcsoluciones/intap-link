#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawvo-demo-ai-v1"
WEB_PROJECT="intap-web2"
WEB_DEPLOY_BRANCH="feature-kawvo-demo-ai-v1"
LOG_DIR="$ROOT/.preview-demo-ai-v1-2026-09-01-logs"

fail() { echo ""; echo "✗ ERROR: $1"; exit 1; }
run() { echo ""; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR"
mkdir -p "$LOG_DIR"

run git fetch github main "$BRANCH"
run git checkout -B "$BRANCH" "github/$BRANCH"
run git reset --hard "github/$BRANCH"

[ -z "$(git status --porcelain)" ] || { git status --short; fail "Working tree no está limpio antes de aplicar Demo IA"; }

run python3 scripts/apply-demo-ai-integration-v1.py
run python3 scripts/apply-demo-ai-integration-v1_1.py
run git diff --check

run node scripts/test-demo-ai-contract.mjs

echo ""
echo "▶ Verificando que no se agregó migración"
if git status --short | grep -E 'api/(migrations|migrations-preview)/' >/dev/null; then
  fail "Demo IA V1 no necesita migración; apareció un cambio de migración inesperado"
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
  api/src/index.ts \
  api/src/routes/demo-viral.ts \
  api/src/routes/demo-ai.ts \
  api/src/lib/openai-structured.ts \
  api/wrangler.preview.toml \
  api/wrangler.toml \
  web/src/App.tsx \
  web/src/components/demo/KawvoLinkDemo.tsx \
  web/src/components/demo/KawvoLinkDemo.css \
  web/src/components/demo/KawvoLinkDemoAi.tsx \
  web/src/components/demo/KawvoLinkDemoAi.css \
  functions/_middleware.ts \
  scripts/apply-demo-ai-integration-v1.py \
  scripts/apply-demo-ai-integration-v1_1.py \
  scripts/test-demo-ai-contract.mjs \
  scripts/qa-demo-ai-preview.mjs \
  scripts/run-preview-demo-ai-v1-2026-09-01.sh

if ! git diff --cached --quiet; then
  run git commit -m "feat(demo): add AI personalized demo preview"
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
import os, re
p = Path('api/wrangler.preview.toml')
s = p.read_text()
s, n = re.subn(r'^WEB_PAGES_ORIGIN = ".*"$', f'WEB_PAGES_ORIGIN = "{os.environ["WEB_ORIGIN"]}"', s, count=1, flags=re.M)
if n != 1:
    raise SystemExit('No pude fijar WEB_PAGES_ORIGIN en Preview')
p.write_text(s)
print('✓ Web origin Preview fijado')
PY

run git diff --check
run git add api/wrangler.preview.toml
if ! git diff --cached --quiet; then
  run git commit -m "chore(preview): pin Demo AI web origin"
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
echo "▶ Smoke Preview"
for url in \
  "https://preview.intaprd.com/demo" \
  "https://preview.intaprd.com/demo/ia"; do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
  echo "✓ $url -> HTTP 200"
done

CONSENT_CODE="$(curl -sS -o /dev/null -w '%{http_code}' -X POST \
  -H 'content-type: application/json' \
  --data '{"session_key":"qa-consent-123456789","consent":{"accepted":false,"version":"demo-ai-v1.0"},"activity":"Mecánico","name":"QA","work_description":"Mantenimiento y frenos"}' \
  https://preview.intaprd.com/api/v1/public/demo/ai/generate)"
[ "$CONSENT_CODE" = "428" ] || fail "Consent guard respondió HTTP $CONSENT_CODE en lugar de 428"
echo "✓ consentimiento server-side -> HTTP 428 sin aceptación"

run env PREVIEW_BASE="https://preview.intaprd.com" node scripts/qa-demo-ai-preview.mjs

echo ""
echo "▶ Verificando Graph Card /demo/ia en Pages origin"
AI_HTML="$LOG_DIR/demo-ai.html"
curl -fsS "$WEB_ORIGIN/demo/ia" -o "$AI_HTML" || fail "Descargar /demo/ia del Pages origin"
grep -q 'Crea una Demo personalizada con IA' "$AI_HTML" || fail "Graph Card /demo/ia no contiene título esperado"
grep -q 'og:image' "$AI_HTML" || fail "Graph Card /demo/ia no contiene og:image"
echo "✓ Graph Card /demo/ia"

cat <<EOF

============================================================
✓ KAWVO LINK · DEMO IA V1 · PREVIEW LISTO PARA QA FÍSICO
============================================================
Branch:          $BRANCH
Feature SHA:     $FEATURE_SHA
Final SHA:       $FINAL_SHA
Web Pages:       $WEB_ORIGIN
Worker Version:  ${WORKER_VERSION:-ver salida Wrangler}
Demo manual:     https://preview.intaprd.com/demo
Demo IA:         https://preview.intaprd.com/demo/ia
Producción:      NO TOCADA

Validado automáticamente:
- Demo manual preservada + entrada IA.
- 4 pantallas cortas + consentimiento.
- A/B/C/D/F clasificación esperada.
- Técnico ambiguo -> una aclaración.
- Nombre obligatorio.
- límites de copy y máximo 3 servicios.
- cooldown/rate-limit 429 con fallback.
- OpenAI solo server-side, store:false y Structured Outputs.
- WhatsApp CTA y teléfono de llamadas separados correctamente.
- sin ubicación ficticia en Demo IA.
- renderer/editor Demo existente reutilizado.
- compartir WhatsApp/snapshot existente preservado.
- snapshot temporal ~24 h y /demo/s/{token} abre.
- ninguna migración nueva.
- Producción no tocada.

QA físico recomendado antes del PR final:
1) móvil: recorrer /demo/ia completo y revisar que no se sienta como formulario largo;
2) resultado: confirmar que abre el mismo perfil/editor de Demo y las fotos stock corresponden al sector;
3) cambiar una foto y un texto;
4) compartir por WhatsApp y abrir el enlace recibido;
5) escritorio: repetir una generación y revisar jerarquía/legibilidad.
============================================================
EOF
