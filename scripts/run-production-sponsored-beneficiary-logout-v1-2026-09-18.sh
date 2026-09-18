#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/sponsored-beneficiary-logout-v1"
EXPECTED_MAIN_SHA="3b175f2b84c60ea605d53ed65f29813a5c1ce5e1"
APPROVED_PRODUCT_SHA="14eb7df4ecd9371b875c063b97d15f5ea9a9abae"
APP_PROJECT="intap-web2"
LOG_DIR="$ROOT/.production-sponsored-beneficiary-logout-v1-logs"
APP_LOG="$LOG_DIR/app-pages.log"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR"
mkdir -p "$LOG_DIR"

cat <<EOF
============================================================
KAWVO LINK · CERRAR SESIÓN PERFIL PATROCINADO · PRODUCCIÓN
============================================================
- agrega Cerrar sesión en cabecera del panel patrocinado
- usa el mismo endpoint de logout aprobado
- limpia reanudación local del panel patrocinado
- no toca Master, Free, Plus ni Team
- no toca D1
- no despliega Worker/API
- despliega únicamente App
============================================================
Main esperado:     $EXPECTED_MAIN_SHA
Producto aprobado: $APPROVED_PRODUCT_SHA
============================================================
EOF

run git fetch github main "$BRANCH"
[ "$(git rev-parse github/main)" = "$EXPECTED_MAIN_SHA" ] || fail "main cambió; detener y auditar"

run git switch "$BRANCH"
run git pull --ff-only github "$BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Árbol local no limpio"; }

git merge-base --is-ancestor "$APPROVED_PRODUCT_SHA" HEAD || fail "Producto aprobado ya no es ancestro"
POST_FILES="$(git diff --name-only "$APPROVED_PRODUCT_SHA"..HEAD | grep -Ev '^scripts/run-production-sponsored-beneficiary-logout-v1-2026-09-18\.sh$' || true)"
[ -z "$POST_FILES" ] || { echo "$POST_FILES"; fail "Hay cambios posteriores al producto aprobado"; }

ALLOWED='^(app/src/components/admin/sponsored/SponsoredExperienceTools\.tsx|scripts/test-sponsored-profile-contract\.mjs|scripts/run-production-sponsored-beneficiary-logout-v1-2026-09-18\.sh)$'
UNEXPECTED="$(git diff --name-only github/main...HEAD | grep -Ev "$ALLOWED" || true)"
[ -z "$UNEXPECTED" ] || { echo "$UNEXPECTED"; fail "Hay archivos fuera del alcance"; }

run git diff --check github/main...HEAD
run npm ci
run node scripts/test-sponsored-profile-contract.mjs
run npm run build -w app

echo
echo "▶ Deploy App Producción"
(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch main) 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App Producción"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$APP_LOG" | tail -1 || true)"

sleep 4

echo
echo "▶ Smoke Producción"
for url in \
  "https://app.intaprd.com/admin/login" \
  "https://app.intaprd.com/admin/sponsored"
do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

echo
echo "▶ Promover release a main"
run git switch -C main github/main
run git merge --ff-only "github/$BRANCH"
run git push github main
PROD_SHA="$(git rev-parse HEAD)"
run git fetch github main
[ "$(git rev-parse github/main)" = "$PROD_SHA" ] || fail "main remoto no coincide con lo desplegado"

TAG="prod-sponsored-beneficiary-logout-v1-2026-09-18-$(date +%H%M%S)"
run git tag -a "$TAG" -m "Sponsored beneficiary logout V1 production 2026-09-18"
run git push github "$TAG"

rm -rf "$LOG_DIR"

cat <<EOF
============================================================
✓ CERRAR SESIÓN PATROCINADO DESPLEGADO EN PRODUCCIÓN
============================================================
Production SHA: $PROD_SHA
Release tag:    $TAG
App Pages:      ${APP_ORIGIN:-ver salida Pages}
D1:             NO TOCADO
Worker/API:     NO TOCADO
============================================================
EOF
