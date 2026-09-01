#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
FEATURE_BRANCH="feature/kawvo-demo-ai-v1"
APPROVED_PREVIEW_SHA="4e8661ac86697c1f6864e87e56cadabb478a501b"
WEB_PROJECT="intap-web2"
LOG_DIR="$ROOT/.production-demo-ai-v1-2026-09-01-logs"

fail(){ echo ""; echo "✗ ERROR: $1"; exit 1; }
run(){ echo ""; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" && mkdir -p "$LOG_DIR"

# Recuperar estado remoto limpio y confirmar que main no avanzó desde el Preview aprobado.
run git fetch github main "$FEATURE_BRANCH"
run git checkout -B "$FEATURE_BRANCH" "github/$FEATURE_BRANCH"
run git reset --hard "github/$FEATURE_BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Working tree no está limpio"; }

# La rama puede tener únicamente este runner por encima del SHA de Preview aprobado.
if ! git merge-base --is-ancestor "$APPROVED_PREVIEW_SHA" "github/$FEATURE_BRANCH"; then
  fail "El SHA de Preview aprobado ya no es ancestro de la rama"
fi
UNAPPROVED_FILES="$(git diff --name-only "$APPROVED_PREVIEW_SHA".."github/$FEATURE_BRANCH" | grep -v '^scripts/run-production-demo-ai-v1-2026-09-01.sh$' || true)"
[ -z "$UNAPPROVED_FILES" ] || { echo "$UNAPPROVED_FILES"; fail "Hay cambios de producto posteriores al Preview aprobado"; }

# main debe seguir siendo ancestro directo de la feature: nada de merge oculto ni divergencia.
if ! git merge-base --is-ancestor "github/main" "github/$FEATURE_BRANCH"; then
  fail "main y feature divergieron; detener promoción"
fi
if [ "$(git rev-list --count "github/$FEATURE_BRANCH".."github/main")" != "0" ]; then
  fail "La feature está detrás de main"
fi

# Nada de migraciones nuevas para esta entrega.
if git diff --name-only "github/main"..."github/$FEATURE_BRANCH" | grep -E '^api/(migrations|migrations-preview)/' >/dev/null; then
  fail "Apareció una migración inesperada"
fi
echo "✓ Sin migraciones nuevas"

# Gates de contrato ya aprobados en Preview.
run node scripts/test-demo-ai-contract.mjs
run node scripts/test-demo-ai-product-v1_5.mjs
run node scripts/test-demo-ai-product-v1_6.mjs

# Build real de Producción + validación API/Worker antes de tocar main.
echo ""
echo "▶ Build Web Producción"
(cd web && npm run build) || fail "Build Web Producción"

echo ""
echo "▶ TypeScript API Producción"
(cd api && npx tsc --noEmit) || fail "TypeScript API Producción"

echo ""
echo "▶ Dry-run Worker Producción"
(cd api && npx wrangler deploy --config wrangler.toml --dry-run) || fail "Dry-run Worker Producción"

# El Demo IA depende del mismo secreto server-side del asistente real.
echo ""
echo "▶ Verificar OPENAI_API_KEY en Worker Producción"
SECRET_LOG="$LOG_DIR/worker-secrets.log"
(cd api && npx wrangler secret list --config wrangler.toml) 2>&1 | tee "$SECRET_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "No pude consultar secretos de Producción"
grep -q 'OPENAI_API_KEY' "$SECRET_LOG" || fail "Falta OPENAI_API_KEY en Worker Producción"
echo "✓ OPENAI_API_KEY presente"

# Promoción exacta por fast-forward.
echo ""
echo "▶ Promover feature aprobada a main"
run git checkout -B main github/main
run git merge --ff-only "github/$FEATURE_BRANCH"
run git push github main
PROD_SHA="$(git rev-parse HEAD)"

# Primero API, luego Web: evitamos publicar una UI que apunte a un endpoint aún inexistente.
echo ""
echo "▶ Deploy Worker Producción"
WORKER_LOG="$LOG_DIR/worker-production.log"
(cd api && npm run deploy:production) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Producción"
WORKER_VERSION="$(grep -E 'Current Version ID:' "$WORKER_LOG" | tail -1 | sed -E 's/.*Current Version ID:[[:space:]]*//')"

echo ""
echo "▶ Deploy Web Producción"
WEB_LOG="$LOG_DIR/web-pages-production.log"
(npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch main) 2>&1 | tee "$WEB_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Web Producción"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$WEB_LOG" | tail -1)"

sleep 3
for url in \
  "https://intaprd.com/demo" \
  "https://intaprd.com/demo/ia"; do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
  echo "✓ $url -> HTTP 200"
done

# E2E real en Producción con sesiones QA desechables y snapshot temporal.
run env PREVIEW_BASE="https://intaprd.com" node scripts/qa-demo-ai-preview.mjs

# Confirmar copys finales en el bundle que acaba de desplegarse.
grep -R "Me interesa, quiero mi Perfil" web/dist/assets >/dev/null || fail "CTA comercial final no está en bundle"
grep -R "Mostrar cómo se verían tus datos para recibir transferencias" web/dist/assets >/dev/null || fail "CTA bancario final no está en bundle"
if grep -R "Me interesa quiero mi Perfil" web/dist/assets >/dev/null; then fail "Sobrevivió CTA comercial sin coma"; fi

echo "✓ Bundle Producción contiene los copys finales"

# Etiqueta de cierre únicamente después de QA real verde.
TAG="prod-demo-ai-2026-09-01-$(date +%H%M%S)"
run git tag -a "$TAG" -m "Kawvo Link Demo IA production 2026-09-01"
run git push github "$TAG"

cat <<EOF

============================================================
✓ KAWVO LINK · DEMO IA · PRODUCCIÓN CERRADA
============================================================
Production SHA:  $PROD_SHA
Release tag:     $TAG
Web Pages:       ${WEB_ORIGIN:-ver salida Pages}
Worker Version:  ${WORKER_VERSION:-ver salida Wrangler}
Demo:            https://intaprd.com/demo
Demo IA:         https://intaprd.com/demo/ia
QA Producción:   APROBADO
============================================================
EOF
