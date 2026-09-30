#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/sponsored-banner-per-code"
EXPECTED_MAIN_SHA="a68416bed8a136f2cc96d500453df6ab4d415e06"
APPROVED_PRODUCT_SHA="85f4d673741e6e2377229a2f7b001495957b62cc"
RUNNER_PATH="scripts/run-production-sponsored-banner-quote-2026-09-29.sh"
WEB_PROJECT="intap-link"
LOG_DIR="$ROOT/.production-sponsored-actions-hotfix-logs"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" && mkdir -p "$LOG_DIR"

cat <<EOF
===============================================================
KAWVO LINK · ACCIONES PATROCINADAS · HOTFIX PRODUCCIÓN
===============================================================
Incluye únicamente el ajuste aprobado en Preview:
- Cotizar / información y Agendar con la misma altura visual
- texto Cotizar / información fijo en dos líneas
- ícono de cotización más próximo al texto
- contrato actualizado para preservar el diseño

Main esperado:     $EXPECTED_MAIN_SHA
Preview aprobado:  $APPROVED_PRODUCT_SHA
===============================================================
EOF

run git fetch github main "$BRANCH"

CURRENT_MAIN="$(git rev-parse github/main)"
[ "$CURRENT_MAIN" = "$EXPECTED_MAIN_SHA" ] || fail "main cambió: esperado $EXPECTED_MAIN_SHA, actual $CURRENT_MAIN. Detener y auditar."

run git switch "$BRANCH"
run git pull --ff-only github "$BRANCH"

git restore -- "$RUNNER_PATH" 2>/dev/null || true
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Árbol local no limpio"; }

git merge-base --is-ancestor "$APPROVED_PRODUCT_SHA" HEAD || fail "El SHA aprobado de Preview ya no es ancestro de la rama"
POST_FILES="$(git diff --name-only "$APPROVED_PRODUCT_SHA"..HEAD | grep -v "^$RUNNER_PATH$" || true)"
[ -z "$POST_FILES" ] || { echo "$POST_FILES"; fail "Hay cambios de producto posteriores al SHA aprobado"; }

git merge-base --is-ancestor github/main HEAD || fail "main y feature divergieron; no es seguro promover por fast-forward"

ALLOWED='^(scripts/run-preview-sponsored-quote-media-ux-2026-09-29\.sh|scripts/run-production-sponsored-banner-quote-2026-09-29\.sh|scripts/test-sponsored-profile-contract\.mjs|web/src/components/sponsored/SponsoredProfile\.tsx)$'
UNEXPECTED="$(git diff --name-only github/main...HEAD | grep -Ev "$ALLOWED" || true)"
[ -z "$UNEXPECTED" ] || { echo "$UNEXPECTED"; fail "Hay archivos fuera del hotfix aprobado"; }

EXPECTED_FILES="$(printf '%s\n' \
  'scripts/run-preview-sponsored-quote-media-ux-2026-09-29.sh' \
  'scripts/run-production-sponsored-banner-quote-2026-09-29.sh' \
  'scripts/test-sponsored-profile-contract.mjs' \
  'web/src/components/sponsored/SponsoredProfile.tsx' | sort)"
ACTUAL_FILES="$(git diff --name-only github/main...HEAD | sort)"
[ "$ACTUAL_FILES" = "$EXPECTED_FILES" ] || {
  echo "Archivos detectados:"
  echo "$ACTUAL_FILES"
  echo
  echo "Archivos esperados:"
  echo "$EXPECTED_FILES"
  fail "El alcance del hotfix no coincide con lo aprobado"
}

run git diff --check github/main...HEAD
run npm ci
run node scripts/test-sponsored-profile-contract.mjs
run npm run build -w web

echo; echo "▶ Confirmar que Producción no requiere migraciones para este hotfix"
(
  cd api
  npx wrangler d1 migrations list intap_db --remote --config wrangler.toml
) 2>&1 | tee "$LOG_DIR/prod-migrations.log"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "No se pudieron listar migraciones Producción"
if grep -Eq '[0-9]{4}_[A-Za-z0-9._-]+\.sql' "$LOG_DIR/prod-migrations.log"; then
  cat "$LOG_DIR/prod-migrations.log"
  fail "Hay migraciones pendientes no relacionadas con este hotfix; detener antes de desplegar"
fi
echo "✓ Sin migraciones pendientes"

echo; echo "▶ Deploy Web Producción"
(npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch main) 2>&1 | tee "$LOG_DIR/web.log"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Web Producción"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$LOG_DIR/web.log" | tail -1 || true)"

sleep 4
echo; echo "▶ Smoke Producción"
for url in \
  "https://intaprd.com/" \
  "https://intaprd.com/p/kawvo-release-smoke-no-existe"
do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  if [ "$url" = "https://intaprd.com/" ]; then
    [ "$code" = "200" ] || fail "$url respondió HTTP $code"
  else
    [ "$code" = "200" ] || [ "$code" = "404" ] || fail "$url respondió HTTP $code"
  fi
done

echo; echo "▶ Promover hotfix aprobado a main"
run git switch -C main github/main
run git merge --ff-only "github/$BRANCH"
run git push github main
PROD_SHA="$(git rev-parse HEAD)"
run git fetch github main
[ "$(git rev-parse github/main)" = "$PROD_SHA" ] || fail "main remoto no coincide con lo desplegado"

TAG="prod-sponsored-actions-visual-2026-09-30-$(date +%H%M%S)"
run git tag -a "$TAG" -m "Sponsored actions visual hotfix production 2026-09-30"
run git push github "$TAG"

rm -rf "$LOG_DIR"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Runner dejó cambios locales"; }

cat <<EOF
===============================================================
✓ HOTFIX VISUAL PATROCINADO DESPLEGADO EN PRODUCCIÓN
===============================================================
Production SHA: $PROD_SHA
Release tag:    $TAG
Web Pages:      $WEB_ORIGIN

Incluye:
✓ Cotizar / información y Agendar igualados visualmente
✓ Cotizar / información fijo en dos líneas
✓ Ícono de cotización más próximo al texto
✓ Contrato actualizado
✓ main promovido y release etiquetado
===============================================================
EOF
