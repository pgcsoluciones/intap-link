#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
EXPECTED_PRODUCT_SHA="f45fbac212f3bb361349c88a63740da1dcce3ff3"
LAST_PROD_SHA="2d608bc4722b438638cb00a02adec5c7d39db8e4"
RUNNER_PATH="scripts/run-production-team-browser-and-seat-compat-2026-09-09.sh"
LOG_DIR="/tmp/kawvo-team-browser-seat-compat-2026-09-09"
WEB_PROJECT="intap-link"
APP_PROJECT="intap-web2"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" && mkdir -p "$LOG_DIR"

cat <<EOF
============================================================
KAWVO TEAM · BROWSER AUTHORITY + SEAT SCHEMA COMPAT · PROD
============================================================
Último release: $LAST_PROD_SHA
Producto objetivo: $EXPECTED_PRODUCT_SHA
Sin migraciones D1. Deploy controlado de código.
============================================================
EOF

run git fetch github main
CURRENT_MAIN="$(git rev-parse github/main)"

# main puede contener commits operativos posteriores al producto (este runner),
# pero el binario desplegable queda fijado exactamente a EXPECTED_PRODUCT_SHA.
git merge-base --is-ancestor "$EXPECTED_PRODUCT_SHA" "$CURRENT_MAIN" || fail "El producto objetivo ya no es ancestro de github/main"
EXTRA_FILES="$(git diff --name-only "$EXPECTED_PRODUCT_SHA..$CURRENT_MAIN")"
if [ -n "$EXTRA_FILES" ]; then
  while IFS= read -r path; do
    [ "$path" = "$RUNNER_PATH" ] || fail "github/main contiene cambios posteriores no operativos al producto: $path"
  done <<< "$EXTRA_FILES"
fi

echo "✓ main contiene el producto objetivo; cambios posteriores permitidos: solo runner operativo"
run git checkout --detach "$EXPECTED_PRODUCT_SHA"
run git reset --hard "$EXPECTED_PRODUCT_SHA"

run git diff --check "$LAST_PROD_SHA...$EXPECTED_PRODUCT_SHA"

# Confirmar causa y fix exactos antes de desplegar.
grep -Fq 'INSERT INTO users(id,email) VALUES(?,?)' api/src/team-corporate.ts || fail "No está el fix portable del seat user"
if grep -Fq 'INSERT INTO users(id,email,created_at)' api/src/team-corporate.ts; then fail "Sigue presente el INSERT incompatible con Producción"; fi
grep -Fq '/public/team/browser-authority' api/src/team-browser-authority.ts || fail "Falta preflight de autoridad del navegador"
grep -Fq 'TeamActivationAuthorityGate' app/src/components/admin/ActivationAuthorityEntry.tsx || fail "Falta gate visual de autoridad Master"

echo "✓ Fix seat-user compatible confirmado"
echo "✓ Browser authority gate confirmado"

run npm ci
run npm run build -w web
run npm run build -w app
run npx tsc --noEmit -p api/tsconfig.json
run npx esbuild api/src/preview-free-entry.ts --bundle --platform=node --format=esm --target=node20 --external:cloudflare:* --outfile=/tmp/kawvo-team-browser-seat-prod.mjs
run bash -lc 'cd api && npx wrangler deploy --config wrangler.toml --dry-run'

# Caso real debe seguir intacto antes del deploy.
echo
echo "▶ D1 Producción · caso real intacto antes del deploy"
CASE_BEFORE="$(cd api && npx wrangler d1 execute intap_db --remote --config wrangler.toml --command="SELECT a.public_code,a.status artifact_status,a.owner_user_id,a.profile_id,tc.code team_code,tc.status team_code_status,tc.used_at,ac.status activation_status FROM intap_artifacts a JOIN team_link_codes tc ON tc.code='TEAM-2X7G-SHPJ' LEFT JOIN artifact_activation_codes ac ON ac.artifact_id=a.id AND ac.status='active' WHERE a.public_code='4BXYMTNSK5' LIMIT 1;")"
printf '%s\n' "$CASE_BEFORE"
printf '%s' "$CASE_BEFORE" | grep -q 'available' || fail "El artifact de prueba ya no está available"
printf '%s' "$CASE_BEFORE" | grep -q 'TEAM-2X7G-SHPJ' || fail "No aparece el Team code esperado"
printf '%s' "$CASE_BEFORE" | grep -q 'active' || fail "El código/activation ya no está activo"

# Deploy API + superficies desde EXACTAMENTE el SHA de producto.
echo
echo "▶ Deploy Worker Producción"
(cd api && npm run deploy:production) 2>&1 | tee "$LOG_DIR/worker.log"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker"

echo
echo "▶ Deploy Web Producción"
npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch main 2>&1 | tee "$LOG_DIR/web.log"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Web"

echo
echo "▶ Deploy App Producción"
npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch main 2>&1 | tee "$LOG_DIR/app.log"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App"

sleep 5
for url in \
  "https://intaprd.com/" \
  "https://app.intaprd.com/admin/login" \
  "https://app.intaprd.com/admin/free/team/assign" \
  "https://api.intaprd.com/api/health"
do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

# Preflight público no autenticado: debe ser invocable y devolver JSON, no 404.
AUTH_HTTP="$(curl -sS -o "$LOG_DIR/browser-authority.json" -w '%{http_code}' -X POST 'https://app.intaprd.com/api/v1/public/team/browser-authority' -H 'content-type: application/json' --data '{"public_code":"4BXYMTNSK5","team_code":"TEAM-2X7G-SHPJ"}')"
echo "browser-authority -> HTTP $AUTH_HTTP"
[ "$AUTH_HTTP" != "404" ] || fail "browser-authority no está montado en Producción"
cat "$LOG_DIR/browser-authority.json"

# Confirmar que el preflight no consumió nada.
echo
echo "▶ D1 Producción · caso real intacto después del preflight"
CASE_AFTER="$(cd api && npx wrangler d1 execute intap_db --remote --config wrangler.toml --command="SELECT a.public_code,a.status artifact_status,a.owner_user_id,a.profile_id,tc.code team_code,tc.status team_code_status,tc.used_at,ac.status activation_status FROM intap_artifacts a JOIN team_link_codes tc ON tc.code='TEAM-2X7G-SHPJ' LEFT JOIN artifact_activation_codes ac ON ac.artifact_id=a.id AND ac.status='active' WHERE a.public_code='4BXYMTNSK5' LIMIT 1;")"
printf '%s\n' "$CASE_AFTER"
printf '%s' "$CASE_AFTER" | grep -q 'available' || fail "Preflight cambió el artifact"
printf '%s' "$CASE_AFTER" | grep -q 'active' || fail "Preflight consumió código/activation"

TAG="prod-team-browser-seat-compat-2026-09-09-$(date +%H%M%S)"
run git tag -a "$TAG" "$EXPECTED_PRODUCT_SHA" -m "Team browser authority + production seat schema compatibility"
run git push github "$TAG"

cat <<EOF

============================================================
✓ TEAM BROWSER + SEAT COMPAT · PRODUCCION DESPLEGADA
============================================================
SHA:  $EXPECTED_PRODUCT_SHA
Tag:  $TAG
D1:   sin migraciones; caso 4BXYMTNSK5 permanece sin consumir
Logs: $LOG_DIR
============================================================
EOF
