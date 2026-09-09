#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
PRODUCT_SHA="8dccba3d27b82445e0caa7667593405f01387db8"
RUNNER_PATH="scripts/run-production-team-browser-authority-2026-09-09.sh"
WEB_PROJECT="intap-link"
APP_PROJECT="intap-web2"
LOG_DIR="/tmp/kawvo-team-browser-authority-production-2026-09-09"
WORKER_LOG="$LOG_DIR/worker.log"
WEB_LOG="$LOG_DIR/web.log"
APP_LOG="$LOG_DIR/app.log"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" && mkdir -p "$LOG_DIR"

cat <<EOF
============================================================
KAWVO LINK · TEAM MASTER · BROWSER AUTHORITY · PRODUCCION
============================================================
Producto a desplegar: $PRODUCT_SHA
Objetivo: validar la sesión Master del navegador antes de preparar Team.
============================================================
EOF

run git fetch github main
MAIN_SHA="$(git rev-parse github/main)"
git merge-base --is-ancestor "$PRODUCT_SHA" "$MAIN_SHA" || fail "El producto aprobado no es ancestro de main"
EXTRA_FILES="$(git diff --name-only "$PRODUCT_SHA..$MAIN_SHA" | grep -v "^${RUNNER_PATH}$" || true)"
[ -z "$EXTRA_FILES" ] || { echo "$EXTRA_FILES"; fail "Hay cambios posteriores al producto que no pertenecen al runner"; }

# No borrar archivos locales del usuario. Solo exigir un árbol limpio.
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Working tree no está limpio"; }

run git checkout --detach "$PRODUCT_SHA"
run git diff --check 2d608bc4722b438638cb00a02adec5c7d39db8e4..."$PRODUCT_SHA"
run node scripts/audit-team-browser-authority.mjs
run node scripts/audit-team-flow-invariants.mjs
run npm ci
run npm run build -w web
run npm run build -w app
run npx tsc --noEmit -p api/tsconfig.json
run npx esbuild api/src/preview-free-entry.ts --bundle --platform=node --format=esm --target=node20 --external:cloudflare:* --outfile=/tmp/kawvo-team-browser-authority-prod.mjs
run bash -lc 'cd api && npx wrangler deploy --config wrangler.toml --dry-run'

echo
echo "▶ D1 Producción · integridad pre-deploy (solo lectura)"
D1_PRE="$(cd api && npx wrangler d1 execute intap_db --remote --config wrangler.toml --command="SELECT (SELECT COUNT(*) FROM team_members tm JOIN intap_artifacts a ON a.id=tm.artifact_id WHERE tm.status='active' AND (COALESCE(a.profile_id,'')<>COALESCE(tm.profile_id,'') OR a.status NOT IN('activated','suspended'))) AS broken_member_artifact, (SELECT COUNT(*) FROM team_link_codes tc LEFT JOIN team_members tm ON tm.invite_code_id=tc.id WHERE tc.status='used' AND (tm.id IS NULL OR COALESCE(tc.member_profile_id,'')<>COALESCE(tm.profile_id,'') OR COALESCE(tc.artifact_id,'')<>COALESCE(tm.artifact_id,''))) AS broken_used_code;")"
printf '%s\n' "$D1_PRE"
printf '%s' "$D1_PRE" | grep -Eq 'broken_member_artifact[^0-9]*0' || fail "D1 tiene relaciones Team rotas"
printf '%s' "$D1_PRE" | grep -Eq 'broken_used_code[^0-9]*0' || fail "D1 tiene códigos Team inconsistentes"

echo
echo "▶ Deploy Worker Producción"
(cd api && npm run deploy:production) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker"
WORKER_VERSION="$(grep -E 'Current Version ID:' "$WORKER_LOG" | tail -1 | sed -E 's/.*Current Version ID:[[:space:]]*//' || true)"

echo
echo "▶ Deploy Web Producción"
(npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch main) 2>&1 | tee "$WEB_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Web"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$WEB_LOG" | tail -1 || true)"

echo
echo "▶ Deploy App Producción"
(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch main) 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$APP_LOG" | tail -1 || true)"

sleep 5
for url in \
  "https://intaprd.com/" \
  "https://app.intaprd.com/admin/login" \
  "https://app.intaprd.com/activate-product/ABCDEFGH" \
  "https://api.intaprd.com/api/health"
do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

# El preflight público debe existir. Payload inválido debe ser rechazado por validación,
# no por 404/500; esto confirma que la ruta nueva está montada sin tocar D1.
AUTH_TMP="$LOG_DIR/browser-authority.json"
AUTH_HTTP="$(curl -sS -o "$AUTH_TMP" -w '%{http_code}' -X POST 'https://app.intaprd.com/api/v1/public/team/browser-authority' -H 'content-type: application/json' --data '{"public_code":"BAD","team_code":"BAD"}')"
[ "$AUTH_HTTP" = "400" ] || { cat "$AUTH_TMP"; fail "browser-authority debía responder 400 de validación y respondió $AUTH_HTTP"; }
echo "✓ browser-authority montado y validando entrada (HTTP 400 esperado)"

echo
echo "▶ D1 Producción · integridad post-deploy (solo lectura)"
D1_POST="$(cd api && npx wrangler d1 execute intap_db --remote --config wrangler.toml --command="SELECT (SELECT COUNT(*) FROM team_members tm JOIN intap_artifacts a ON a.id=tm.artifact_id WHERE tm.status='active' AND (COALESCE(a.profile_id,'')<>COALESCE(tm.profile_id,'') OR a.status NOT IN('activated','suspended'))) AS broken_member_artifact, (SELECT COUNT(*) FROM team_link_codes tc LEFT JOIN team_members tm ON tm.invite_code_id=tc.id WHERE tc.status='used' AND (tm.id IS NULL OR COALESCE(tc.member_profile_id,'')<>COALESCE(tm.profile_id,'') OR COALESCE(tc.artifact_id,'')<>COALESCE(tm.artifact_id,''))) AS broken_used_code;")"
printf '%s\n' "$D1_POST"
printf '%s' "$D1_POST" | grep -Eq 'broken_member_artifact[^0-9]*0' || fail "Post-deploy: relaciones Team rotas"
printf '%s' "$D1_POST" | grep -Eq 'broken_used_code[^0-9]*0' || fail "Post-deploy: códigos Team inconsistentes"

TAG="prod-team-browser-authority-2026-09-09-$(date +%H%M%S)"
run git tag -a "$TAG" "$PRODUCT_SHA" -m "Kawvo Team browser Master authority 2026-09-09"
run git push github "$TAG"
run git checkout -B main github/main

cat <<EOF

============================================================
✓ TEAM MASTER · BROWSER AUTHORITY · PRODUCCION DESPLEGADA
============================================================
Product SHA:    $PRODUCT_SHA
Release tag:    $TAG
Worker Version: ${WORKER_VERSION:-ver log}
Web Pages:      ${WEB_ORIGIN:-ver log}
App Pages:      ${APP_ORIGIN:-ver log}
D1:             solo lectura; sin migraciones
Browser gate:   ACTIVO
============================================================
EOF
