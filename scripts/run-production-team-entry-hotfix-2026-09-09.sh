#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
FEATURE_BRANCH="feature/kawvo-onboarding-product-flow-v1"
PROD_BASE_SHA="d6adbf329310be44ec6b9754b12e48eac3841e91"
APPROVED_PREVIEW_SHA="9603c38d2b3a3597a843b367931785073968e0c9"
APP_PROJECT="intap-web2"
LOG_DIR="$ROOT/.production-team-entry-hotfix-2026-09-09-logs"

fail(){ echo ""; echo "✗ ERROR: $1"; exit 1; }
run(){ echo ""; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" && mkdir -p "$LOG_DIR"

echo "============================================================"
echo " KAWVO LINK · TEAM ENTRY HOTFIX · PRODUCCIÓN"
echo "============================================================"
echo "Preview aprobado: $APPROVED_PREVIEW_SHA"
echo "Producción base:   $PROD_BASE_SHA"

run git fetch github main "$FEATURE_BRANCH"
run git checkout -B "$FEATURE_BRANCH" "github/$FEATURE_BRANCH"
run git reset --hard "github/$FEATURE_BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Working tree no está limpio"; }

CURRENT_HEAD="$(git rev-parse HEAD)"
echo "Feature release:   $CURRENT_HEAD"

# El SHA probado en Preview debe ser ancestro exacto de la rama.
if ! git merge-base --is-ancestor "$APPROVED_PREVIEW_SHA" "github/$FEATURE_BRANCH"; then
  fail "El SHA aprobado en Preview ya no es ancestro de la feature"
fi

# Después del SHA aprobado solo se permite este runner.
UNAPPROVED_FILES="$(git diff --name-only "$APPROVED_PREVIEW_SHA".."github/$FEATURE_BRANCH" | grep -v '^scripts/run-production-team-entry-hotfix-2026-09-09.sh$' || true)"
[ -z "$UNAPPROVED_FILES" ] || { echo "$UNAPPROVED_FILES"; fail "Hay cambios de producto posteriores al Preview aprobado"; }

# main debe seguir exactamente en la producción que acabamos de cerrar.
MAIN_SHA="$(git rev-parse github/main)"
[ "$MAIN_SHA" = "$PROD_BASE_SHA" ] || fail "main cambió: esperado $PROD_BASE_SHA, encontrado $MAIN_SHA"

# Confirmar que el hotfix probado toca solo la entrada Team de App.
HOTFIX_FILES="$(git diff --name-only "$PROD_BASE_SHA".."$APPROVED_PREVIEW_SHA" | sort)"
EXPECTED_FILES="$(printf '%s\n' 'app/src/App.tsx' 'app/src/components/admin/free/FreeTeamEntry.tsx' | sort)"
[ "$HOTFIX_FILES" = "$EXPECTED_FILES" ] || {
  echo "Archivos encontrados:"; echo "$HOTFIX_FILES"
  fail "El hotfix contiene archivos fuera del alcance aprobado"
}
echo "✓ Alcance hotfix verificado: App Team entry únicamente"

# Nada de DB/API/Web para este hotfix.
if git diff --name-only "$PROD_BASE_SHA".."$APPROVED_PREVIEW_SHA" | grep -E '^(api/|web/|functions/)' >/dev/null; then
  fail "El hotfix no debe tocar API, DB, Web ni Functions"
fi
echo "✓ Sin migraciones ni cambios de Worker/Web"

run git diff --check "$PROD_BASE_SHA"..."$APPROVED_PREVIEW_SHA"
run npm ci
run npm run build -w app

# Promoción exacta por fast-forward, incluyendo solo el runner después del SHA probado.
run git checkout -B main github/main
run git merge --ff-only "github/$FEATURE_BRANCH"
run git push github main
PROD_SHA="$(git rev-parse HEAD)"

# Deploy SOLO de App Producción.
echo ""
echo "▶ Deploy App Producción → $APP_PROJECT"
APP_LOG="$LOG_DIR/app-pages-production.log"
(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch main) 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App Producción"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$APP_LOG" | tail -1)"

sleep 3
for url in \
  "https://app.intaprd.com/admin/login" \
  "https://app.intaprd.com/admin/free/team"; do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
  echo "✓ $url -> HTTP 200"
done

run git fetch github main
[ "$(git rev-parse github/main)" = "$PROD_SHA" ] || fail "main remoto no coincide con el SHA desplegado"

TAG="prod-team-entry-hotfix-2026-09-09-$(date +%H%M%S)"
run git tag -a "$TAG" -m "Kawvo Link Team entry hotfix production 2026-09-09"
run git push github "$TAG"

cat <<EOF

============================================================
✓ KAWVO LINK · TEAM ENTRY HOTFIX · PRODUCCIÓN DESPLEGADA
============================================================
Production SHA:  $PROD_SHA
Preview aprobado:$APPROVED_PREVIEW_SHA
Release tag:     $TAG
App Pages:       ${APP_ORIGIN:-ver salida Pages}
App Producción:  https://app.intaprd.com
Worker/API:      SIN CAMBIOS
D1 Producción:   SIN CAMBIOS
Web Producción:  SIN CAMBIOS
Smoke:           APROBADO
============================================================
EOF
