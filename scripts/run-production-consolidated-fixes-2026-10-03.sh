#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
REMOTE="github"
BRANCH="preview/consolidated-fixes-2026-10-03"
EXPECTED_MAIN_SHA="e7936177dc15ff2ab75563903464320b10be07fd"
APPROVED_PREVIEW_SHA="2a7fbf0ac8bb3048ae1cdadbf6fa295545a1aa38"
RUNNER_PATH="scripts/run-production-consolidated-fixes-2026-10-03.sh"
WEB_PROJECT="intap-link"
APP_PROJECT="intap-web2"
LOG_DIR="$ROOT/.production-consolidated-fixes-2026-10-03"
WEB_LOG="$LOG_DIR/web-pages-production.log"
APP_LOG="$LOG_DIR/app-pages-production.log"
WORKER_LOG="$LOG_DIR/worker-production.log"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR"
mkdir -p "$LOG_DIR"

cat <<EOF
================================================================
KAWVO LINK · AJUSTES CONSOLIDADOS · PRODUCCIÓN
================================================================
Promueve únicamente el Preview aprobado.

Incluye:
1. RNC/CÉDULA bancaria: copia correcta y privacidad preservada.
2. Agenda: teléfono visible normalizado, ej. 809-705-9802.
3. Recorrido: “Ya entendí” persiste en la cuenta.
4. Cotización: RNC opcional debajo de Nombre.
5. Se elimina “opcional si adjuntas media”.
6. Mensaje de compartir cotización con contexto propio.
7. Social card contextual para cotización.
8. Free/Team + Patrocinado.
9. Sin cambios D1 ni R2.

Main esperado:    $EXPECTED_MAIN_SHA
Preview aprobado: $APPROVED_PREVIEW_SHA
================================================================
EOF

run git fetch "$REMOTE" main "$BRANCH"
CURRENT_MAIN="$(git rev-parse "$REMOTE/main")"
[ "$CURRENT_MAIN" = "$EXPECTED_MAIN_SHA" ] || fail "main cambió: esperado $EXPECTED_MAIN_SHA, actual $CURRENT_MAIN. Detener y auditar."

run git switch "$BRANCH"
run git pull --ff-only "$REMOTE" "$BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Árbol local no limpio"; }

git merge-base --is-ancestor "$APPROVED_PREVIEW_SHA" HEAD || fail "El SHA aprobado ya no es ancestro"
POST_APPROVAL="$(git diff --name-only "$APPROVED_PREVIEW_SHA"..HEAD | grep -v "^$RUNNER_PATH$" || true)"
[ -z "$POST_APPROVAL" ] || { echo "$POST_APPROVAL"; fail "Hay cambios de producto posteriores al Preview aprobado"; }

git merge-base --is-ancestor "$REMOTE/main" HEAD || fail "main y branch divergieron"

cat > "$LOG_DIR/expected-files.txt" <<'EOF_FILES'
api/src/free-appointments.ts
api/src/sponsored-appointments.ts
app/src/components/admin/free/FreeAccountGuidedTour.tsx
app/src/components/admin/free/FreeGuidedTour.tsx
app/src/components/admin/free/FreeTeamGuidedTour.tsx
app/src/components/admin/free/freeTourPersistence.ts
functions/_middleware.ts
scripts/run-preview-consolidated-fixes-2026-10-03.sh
scripts/run-production-consolidated-fixes-2026-10-03.sh
scripts/test-consolidated-fixes-2026-10-03.mjs
web/src/components/free-profile/FreeContactActions.tsx
web/src/components/free-profile/PublicBankAccounts.tsx
web/src/components/sponsored/SponsoredBankAccounts.tsx
web/src/components/sponsored/SponsoredProfile.tsx
EOF_FILES

git diff --name-only "$REMOTE/main"...HEAD | sort > "$LOG_DIR/actual-files.txt"
sort "$LOG_DIR/expected-files.txt" > "$LOG_DIR/expected-files.sorted.txt"
diff -u "$LOG_DIR/expected-files.sorted.txt" "$LOG_DIR/actual-files.txt" || fail "El alcance del release no coincide exactamente con lo aprobado"

run git diff --check "$REMOTE/main"...HEAD

echo; echo "▶ Verificar configuración de Producción"
grep -Fq 'name = "intap-api"' api/wrangler.toml || fail "Worker incorrecto"
grep -Fq 'database_name = "intap_db"' api/wrangler.toml || fail "D1 incorrecta"
grep -Fq 'bucket_name = "intap-r2"' api/wrangler.toml || fail "R2 incorrecto"
grep -Fq 'APP_URL = "https://app.intaprd.com"' api/wrangler.toml || fail "APP_URL incorrecta"
grep -Fq 'WEB_URL = "https://intaprd.com"' api/wrangler.toml || fail "WEB_URL incorrecta"
grep -Fq 'VITE_API_URL=https://api.intaprd.com' web/.env.production || fail "Web API incorrecta"
grep -Fq 'VITE_APP_URL=https://app.intaprd.com' web/.env.production || fail "Web App incorrecta"
grep -Fq 'VITE_API_URL=https://api.intaprd.com' app/.env.production || fail "App API incorrecta"
grep -Fq 'VITE_WEB_URL=https://intaprd.com' app/.env.production || fail "App Web incorrecta"

run npm ci
run node scripts/test-consolidated-fixes-2026-10-03.mjs
run npm run build -w web
run npm run build -w app
run bash -lc 'cd api && npx tsc --noEmit'
run bash -lc 'cd api && npx wrangler deploy --config wrangler.toml --dry-run'

echo; echo "▶ Deploy Worker Producción"
(
  cd api
  npm run deploy:production
) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Producción"
WORKER_VERSION="$(grep -E 'Current Version ID:' "$WORKER_LOG" | tail -1 | sed -E 's/.*Current Version ID:[[:space:]]*//' || true)"

echo; echo "▶ Deploy Web Producción"
(npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch main) 2>&1 | tee "$WEB_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Web Producción"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$WEB_LOG" | tail -1 || true)"

echo; echo "▶ Deploy App Producción"
(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch main) 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App Producción"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$APP_LOG" | tail -1 || true)"

sleep 5

echo; echo "▶ Smoke Producción"
for url in   "https://intaprd.com/"   "https://intaprd.com/jlprince?cotizar=1"   "https://app.intaprd.com/admin/login"   "https://app.intaprd.com/admin/free/account"
do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

echo; echo "▶ Verificar metadata social de cotización"
HTML="$LOG_DIR/jlprince-cotizar.html"
curl -sS "https://intaprd.com/jlprince?cotizar=1" -o "$HTML"
grep -Fq 'Solicita una cotización con Juan Luis Prince' "$HTML" || fail "Título social contextual no apareció"
grep -Fq 'Te comparto el formulario de cotización / información de Juan Luis Prince' "$HTML" || fail "Descripción social contextual no apareció"
echo "✓ Metadata social contextual presente"

echo; echo "▶ Promover release validado a main"
PREVIOUS_MAIN="$CURRENT_MAIN"
run git switch -C main "$REMOTE/main"
run git merge --ff-only "$REMOTE/$BRANCH"
run git push "$REMOTE" main
PROD_SHA="$(git rev-parse HEAD)"

run git fetch "$REMOTE" main
[ "$(git rev-parse "$REMOTE/main")" = "$PROD_SHA" ] || fail "main remoto no coincide con el SHA desplegado"

TAG="prod-consolidated-fixes-2026-10-03-$(date +%H%M%S)"
run git tag -a "$TAG" -m "Kawvo Link consolidated fixes production 2026-10-03"
run git push "$REMOTE" "$TAG"

rm -rf "$LOG_DIR"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Runner dejó cambios locales"; }

cat <<EOF
================================================================
✓ AJUSTES CONSOLIDADOS · PRODUCCIÓN CERRADA
================================================================
Production SHA: $PROD_SHA
Release tag:    $TAG
Previous main:  $PREVIOUS_MAIN
Worker Version: ${WORKER_VERSION:-ver salida Wrangler}
Web Pages:      ${WEB_ORIGIN:-ver salida Pages}
App Pages:      ${APP_ORIGIN:-ver salida Pages}

Incluye:
✓ RNC/CÉD. bancaria corregida
✓ teléfono de agenda normalizado
✓ recorrido “Ya entendí” persistente
✓ RNC opcional en cotización
✓ texto “opcional si adjuntas media” eliminado
✓ compartir cotización con contexto
✓ social card contextual
✓ Free/Team + Patrocinado
✓ sin cambios D1/R2
================================================================
EOF
