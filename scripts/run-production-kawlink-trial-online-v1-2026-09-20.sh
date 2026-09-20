#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
FEATURE_BRANCH="feature/kawlink-trial-online-v1"
APPROVED_SHA="1154fd2d8d363823b54ab8ba73e485684888e295"
EXPECTED_MAIN="e63a1bb71d661ca8799cbd2bb26a04dc38d95f24"
RUNNER="scripts/run-production-kawlink-trial-online-v1-2026-09-20.sh"
PROD_DB="intap_db"
LOG_DIR="$ROOT/.production-kawlink-trial-online-v1-logs"
fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }
cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" && mkdir -p "$LOG_DIR"
git remote get-url github >/dev/null 2>&1 && REMOTE=github || REMOTE=origin
run git fetch "$REMOTE" main "$FEATURE_BRANCH"
CURRENT_MAIN="$(git rev-parse "$REMOTE/main")"
[ "$CURRENT_MAIN" = "$EXPECTED_MAIN" ] || fail "main cambió: esperado $EXPECTED_MAIN actual $CURRENT_MAIN"
run git checkout "$FEATURE_BRANCH"
run git pull --ff-only "$REMOTE" "$FEATURE_BRANCH"
[ -z "$(git status --porcelain)" ] || fail "Árbol local no limpio"
git merge-base --is-ancestor "$APPROVED_SHA" HEAD || fail "Preview aprobado ya no es ancestro"
POST="$(git diff --name-only "$APPROVED_SHA"..HEAD | grep -v "^${RUNNER}$" || true)"
[ -z "$POST" ] || { echo "$POST"; fail "Hay cambios de producto posteriores al Preview aprobado"; }
git merge-base --is-ancestor "$REMOTE/main" HEAD || fail "main y feature divergieron"
run git diff --check "$REMOTE/main"...HEAD

echo "▶ Verificar configuración de Producción"
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
run npm run build -w web
run npm run build -w app
run bash -lc 'cd api && npx tsc --noEmit'
run bash -lc 'npx esbuild api/src/preview-free-entry.ts --bundle --platform=node --format=esm --target=node20 --external:cloudflare:* --outfile=/tmp/kawvo-trial-prod.mjs'
run bash -lc 'cd api && npx wrangler deploy --config wrangler.toml --dry-run'
grep -R "KAWLINK · PRUEBA FULL · 4 DÍAS GRATIS" app/dist/assets >/dev/null || fail "Copy final no está en App"
grep -R "Usa el mismo correo que colocaste en el formulario" app/dist/assets >/dev/null || fail "Regla de correo no está en App"

echo "▶ Consultar y aplicar migraciones D1 Producción"
(cd api && npx wrangler d1 execute "$PROD_DB" --remote --config wrangler.toml --command "SELECT COUNT(*) AS n FROM trial_profiles;") || fail "Precheck D1"
(cd api && npx wrangler d1 migrations list "$PROD_DB" --remote --config wrangler.toml) || fail "Listar migraciones"
(cd api && npx wrangler d1 migrations apply "$PROD_DB" --remote --config wrangler.toml) || fail "Aplicar migraciones"
(cd api && npx wrangler d1 execute "$PROD_DB" --remote --config wrangler.toml --command "SELECT COUNT(*) AS n FROM trial_leads;") || fail "Postcheck D1"

echo "▶ Deploy API Producción"
(cd api && npm run deploy:production) 2>&1 | tee "$LOG_DIR/worker.log"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy API"

echo "▶ Smoke API + CORS antes de UI"
code="$(curl -sS -o "$LOG_DIR/master.json" -w '%{http_code}' https://intaprd.com/api/v1/public/trials/master)"
[ "$code" = "200" ] || fail "Master API HTTP $code"
code="$(curl -sS -o /dev/null -w '%{http_code}' https://app.intaprd.com/api/v1/me/trials/online)"
[ "$code" = "401" ] || fail "Owner sin sesión esperaba 401, recibió $code"
curl -sS -D "$LOG_DIR/cors.headers" -o /dev/null -X OPTIONS -H 'Origin: https://nfc.kawvoia.com' -H 'Access-Control-Request-Method: POST' -H 'Access-Control-Request-Headers: content-type' https://intaprd.com/api/v1/public/trial-leads
grep -qi '^access-control-allow-origin: https://nfc.kawvoia.com' "$LOG_DIR/cors.headers" || fail "CORS Landing no autorizado"
code="$(curl -sS -o /dev/null -w '%{http_code}' -H 'Origin: https://nfc.kawvoia.com' -H 'Content-Type: application/json' -d '{}' https://intaprd.com/api/v1/public/trial-leads)"
[ "$code" = "422" ] || fail "trial-leads esperaba 422, recibió $code"

echo "▶ Deploy Web Producción"
(npx wrangler pages deploy web/dist --project-name intap-link --branch main) 2>&1 | tee "$LOG_DIR/web.log"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Web"
echo "▶ Deploy App Producción"
(npx wrangler pages deploy app/dist --project-name intap-web2 --branch main) 2>&1 | tee "$LOG_DIR/app.log"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App"
sleep 5

for url in https://intaprd.com/trial https://intaprd.com/trial/login https://app.intaprd.com/trial/login https://app.intaprd.com/superadmin/trials; do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

echo "▶ Promover release ya validado a main"
run git checkout -B main "$REMOTE/main"
run git merge --ff-only "$REMOTE/$FEATURE_BRANCH"
run git push "$REMOTE" main
PROD_SHA="$(git rev-parse HEAD)"
TAG="prod-kawlink-trial-online-v1-2026-09-20-$(date +%H%M%S)"
run git tag -a "$TAG" -m "KawLink Prueba Full Online V1 production 2026-09-20"
run git push "$REMOTE" "$TAG"
rm -rf "$LOG_DIR"

echo "============================================================"
echo "✓ PRODUCCIÓN DESPLEGADA"
echo "Production SHA: $PROD_SHA"
echo "Release tag: $TAG"
echo "Landing debe usar:"
echo "VITE_TRIAL_LEAD_ENDPOINT=https://intaprd.com/api/v1/public/trial-leads"
echo "VITE_TRIAL_LOGIN_URL=https://intaprd.com/trial/login"
echo "============================================================"
