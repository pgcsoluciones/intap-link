#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
REMOTE="github"
FEATURE_BRANCH="fix/free-tour-auto-persistence"
EXPECTED_MAIN_SHA="d390d6fb2a07c0962446b0cbda00c49976b2dcbb"
APPROVED_PREVIEW_SHA="d1a6a0ad826ca9fd36822eba347d1f7149d50b5a"
RUNNER_PATH="scripts/run-production-free-tour-persistence-2026-10-01.sh"
APP_PROJECT="intap-web2"
LOG_DIR="$ROOT/.production-free-tour-persistence-logs"
APP_LOG="$LOG_DIR/app-pages-production.log"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" "$ROOT/.preview-free-tour-persistence-logs"
mkdir -p "$LOG_DIR"

cat <<EOF
============================================================
KAWVO LINK · RECORRIDO FREE · PERSISTENCIA · PRODUCCIÓN
============================================================
Promueve únicamente el Preview aprobado:
- "Ya entendí" desactiva el recorrido automático
- el bloqueo persiste entre cierres e inicios de sesión
- Recorrido manual sigue disponible
- Dashboard espera identidad estable
- Mi cuenta usa identidad estable
- Team no se modifica
- API / Web público / D1 / R2 no se despliegan

Main esperado:    $EXPECTED_MAIN_SHA
Preview aprobado: $APPROVED_PREVIEW_SHA
============================================================
EOF

run git fetch "$REMOTE" main "$FEATURE_BRANCH"
CURRENT_MAIN="$(git rev-parse "$REMOTE/main")"
[ "$CURRENT_MAIN" = "$EXPECTED_MAIN_SHA" ] || fail "main cambió: esperado $EXPECTED_MAIN_SHA, actual $CURRENT_MAIN. Detener y auditar."

run git switch "$FEATURE_BRANCH"
run git pull --ff-only "$REMOTE" "$FEATURE_BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Árbol local no limpio"; }

FEATURE_SHA="$(git rev-parse HEAD)"
echo "Feature release: $FEATURE_SHA"

git merge-base --is-ancestor "$APPROVED_PREVIEW_SHA" HEAD || fail "El SHA aprobado ya no es ancestro"
POST_APPROVAL="$(git diff --name-only "$APPROVED_PREVIEW_SHA"..HEAD | grep -v "^${RUNNER_PATH}$" || true)"
[ -z "$POST_APPROVAL" ] || { echo "$POST_APPROVAL"; fail "Hay cambios de producto posteriores al Preview aprobado"; }

git merge-base --is-ancestor "$REMOTE/main" HEAD || fail "main y feature divergieron"
[ "$(git rev-list --count HEAD.."$REMOTE/main")" = "0" ] || fail "La feature está detrás de main"

cat > "$LOG_DIR/expected-files.txt" <<'EOF_FILES'
app/src/components/admin/free/FreeAccount.tsx
app/src/components/admin/free/FreeDashboard.tsx
scripts/run-preview-free-tour-persistence-2026-10-01.sh
scripts/run-production-free-tour-persistence-2026-10-01.sh
scripts/test-free-tour-persistence.mjs
EOF_FILES

git diff --name-only "$REMOTE/main"...HEAD | sort > "$LOG_DIR/actual-files.txt"
sort "$LOG_DIR/expected-files.txt" > "$LOG_DIR/expected-files.sorted.txt"
diff -u "$LOG_DIR/expected-files.sorted.txt" "$LOG_DIR/actual-files.txt" || fail "El alcance no coincide exactamente con el Preview aprobado"

run git diff --check "$REMOTE/main"...HEAD

echo; echo "▶ Verificar configuración App Producción"
grep -Fq 'VITE_API_URL=https://api.intaprd.com' app/.env.production || fail "App API incorrecta"
grep -Fq 'VITE_WEB_URL=https://intaprd.com' app/.env.production || fail "App Web incorrecta"

run npm ci
run node scripts/test-free-tour-persistence.mjs
run npm run build -w app

PREVIOUS_MAIN="$CURRENT_MAIN"

echo; echo "▶ Deploy App Producción"
(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch main) 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App Producción"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$APP_LOG" | tail -1 || true)"

sleep 5

echo; echo "▶ Smoke Producción"
for url in   "https://app.intaprd.com/admin/login"   "https://app.intaprd.com/admin/free"   "https://app.intaprd.com/admin/free/account"
do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

echo; echo "▶ Promover release validado a main"
run git switch -C main "$REMOTE/main"
run git merge --ff-only "$REMOTE/$FEATURE_BRANCH"
run git push "$REMOTE" main
PROD_SHA="$(git rev-parse HEAD)"

run git fetch "$REMOTE" main
[ "$(git rev-parse "$REMOTE/main")" = "$PROD_SHA" ] || fail "main remoto no coincide con el SHA desplegado"

TAG="prod-free-tour-persistence-2026-10-01-$(date +%H%M%S)"
run git tag -a "$TAG" -m "Kawvo Link Free guided tour persistence production"
run git push "$REMOTE" "$TAG"

rm -rf "$LOG_DIR"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Runner dejó cambios locales"; }

cat <<EOF
============================================================
✓ RECORRIDO FREE · PERSISTENCIA · PRODUCCIÓN DESPLEGADA
============================================================
Production SHA: $PROD_SHA
Release tag:    $TAG
Previous main:  $PREVIOUS_MAIN
App Pages:      ${APP_ORIGIN:-ver salida Pages}

Incluye:
✓ "Ya entendí" desactiva el auto-recorrido
✓ persiste entre sesiones
✓ Recorrido manual sigue disponible
✓ Dashboard espera identidad estable
✓ Mi cuenta usa identidad estable
✓ Team no fue modificado
✓ API / Web público / D1 / R2 no fueron desplegados
============================================================
EOF
