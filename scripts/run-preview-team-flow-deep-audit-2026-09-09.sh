#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawvo-onboarding-product-flow-v1"
DEPLOY_BRANCH="feature-kawvo-onboarding-product-flow-v1"
BASE_SHA="f180d3055395072e62b70de364e75aae714789df"
PRODUCT_SHA="2d608bc4722b438638cb00a02adec5c7d39db8e4"
RUNNER_PATH="scripts/run-preview-team-flow-deep-audit-2026-09-09.sh"
WEB_PROJECT="intap-link"
APP_PROJECT="intap-web2"
WRANGLER_CFG="api/wrangler.preview.toml"
LOG_DIR="$ROOT/.preview-team-flow-deep-audit-2026-09-09-logs"
WEB_LOG="$LOG_DIR/web-pages.log"
APP_LOG="$LOG_DIR/app-pages.log"
WORKER_LOG="$LOG_DIR/worker.log"
D1_AUDIT_LOG="$LOG_DIR/d1-team-source-truth-audit.log"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }
restore_config(){
  if [ -d "$ROOT/.git" ]; then
    git -C "$ROOT" restore -- "$WRANGLER_CFG" >/dev/null 2>&1 || true
  fi
}
trap restore_config EXIT

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" && mkdir -p "$LOG_DIR"

printf '\n============================================================\n'
printf ' KAWVO LINK · TEAM FLOW · DEEP AUDIT · PREVIEW\n'
printf '============================================================\n\n'
printf 'Base Production auditada: %s\n' "$BASE_SHA"
printf 'Producto a probar:        %s\n' "$PRODUCT_SHA"
printf 'Producción:                NO SE TOCA\n'

run git fetch github main "$BRANCH"
run git checkout -B "$BRANCH" "github/$BRANCH"
run git reset --hard "github/$BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Working tree no está limpio"; }

HEAD_SHA="$(git rev-parse HEAD)"
echo "Feature head:             $HEAD_SHA"

# Asegurar que el producto auditado sigue exactamente intacto y que por encima
# solo existe este runner. Esto evita probar una mezcla accidental de cambios.
git merge-base --is-ancestor "$PRODUCT_SHA" HEAD || fail "El SHA de producto ya no es ancestro de la rama"
EXTRA_FILES="$(git diff --name-only "$PRODUCT_SHA"..HEAD | grep -v "^${RUNNER_PATH}$" || true)"
[ -z "$EXTRA_FILES" ] || { echo "$EXTRA_FILES"; fail "Hay cambios de producto posteriores al SHA auditado"; }

CURRENT_MAIN="$(git rev-parse github/main)"
[ "$CURRENT_MAIN" = "$BASE_SHA" ] || fail "main cambió: esperado $BASE_SHA, actual $CURRENT_MAIN. No continuar sin reauditar."

git merge-base --is-ancestor github/main "$PRODUCT_SHA" || fail "El producto no es fast-forward desde main"

run git diff --check "$BASE_SHA...$PRODUCT_SHA"

# Contrato arquitectónico: Team e Independiente no pueden compartir mutación.
run node scripts/audit-team-flow-invariants.mjs

# Builds y tipos de los tres frentes involucrados.
run npm ci
run npm run build:preview -w web
run npm run build:preview -w app
run npx tsc --noEmit -p api/tsconfig.json
run npx esbuild api/src/preview-free-entry.ts --bundle --platform=node --format=esm --target=node20 --external:cloudflare:* --outfile=/tmp/kawvo-team-flow-deep-audit-preview.mjs
run bash -lc 'cd api && npx wrangler deploy --config wrangler.preview.toml --dry-run'

# D1 Preview únicamente. Nunca intap_db de Producción.
echo
echo "▶ Aplicar migraciones D1 Preview"
(
  cd api
  npx wrangler d1 migrations apply intap_db_preview --remote --config wrangler.preview.toml
) || fail "Migraciones D1 Preview"

# Auditoría no destructiva de la fuente de verdad. Se imprime antes del deploy
# para detectar residuos históricos y distinguirlos del flujo nuevo.
echo
echo "▶ Auditar integridad Team en D1 Preview"
{
  echo "--- Team members ↔ artifacts ---"
  (cd api && npx wrangler d1 execute intap_db_preview --remote --config wrangler.preview.toml --command="SELECT COUNT(*) AS broken_member_artifact FROM team_members tm JOIN intap_artifacts a ON a.id=tm.artifact_id WHERE tm.status='active' AND (COALESCE(a.profile_id,'')<>COALESCE(tm.profile_id,'') OR a.status NOT IN('activated','suspended'));" )

  echo "--- Team used codes ↔ members ---"
  (cd api && npx wrangler d1 execute intap_db_preview --remote --config wrangler.preview.toml --command="SELECT COUNT(*) AS broken_used_code FROM team_link_codes tc LEFT JOIN team_members tm ON tm.invite_code_id=tc.id WHERE tc.status='used' AND (tm.id IS NULL OR COALESCE(tc.member_profile_id,'')<>COALESCE(tm.profile_id,'') OR COALESCE(tc.artifact_id,'')<>COALESCE(tm.artifact_id,''));" )

  echo "--- Team profile marker ---"
  (cd api && npx wrangler d1 execute intap_db_preview --remote --config wrangler.preview.toml --command="SELECT COUNT(*) AS missing_team_marker FROM team_members tm JOIN profiles p ON p.id=tm.profile_id WHERE COALESCE(json_extract(p.template_data,'$.team_member'),0)<>1;" )

  echo "--- Legacy real-account member rows (diagnostic only) ---"
  (cd api && npx wrangler d1 execute intap_db_preview --remote --config wrangler.preview.toml --command="SELECT tm.id,tm.admin_role,u.email,p.slug FROM team_members tm JOIN users u ON u.id=tm.user_id JOIN profiles p ON p.id=tm.profile_id WHERE COALESCE(tm.admin_role,'member')='member' AND u.email NOT LIKE '%@team.internal.kawvo' ORDER BY tm.joined_at DESC LIMIT 20;" )
} 2>&1 | tee "$D1_AUDIT_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Auditoría D1 Preview"

# Deploy Web Preview: resolver físico /l/:codigo.
echo
echo "▶ Deploy Web Preview → $WEB_PROJECT"
(npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch "$DEPLOY_BRANCH") 2>&1 | tee "$WEB_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Web Pages Preview"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$WEB_LOG" | tail -1)"
[ -n "$WEB_ORIGIN" ] || fail "No pude identificar WEB_PAGES_ORIGIN"

# Deploy App Preview: autoridad de activación + preparación Master.
echo
echo "▶ Deploy App Preview → $APP_PROJECT"
(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch "$DEPLOY_BRANCH") 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App Pages Preview"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$APP_LOG" | tail -1)"
[ -n "$APP_ORIGIN" ] || fail "No pude identificar APP_PAGES_ORIGIN"

# El front door Preview debe apuntar a deployments inmutables recién creados.
WEB_ORIGIN="$WEB_ORIGIN" APP_ORIGIN="$APP_ORIGIN" python3 - <<'PY' || fail "Fijar origins Preview"
from pathlib import Path
import os,re
p=Path('api/wrangler.preview.toml')
s=p.read_text()
for key,value in (('WEB_PAGES_ORIGIN',os.environ['WEB_ORIGIN']),('APP_PAGES_ORIGIN',os.environ['APP_ORIGIN'])):
    s,n=re.subn(rf'^{key} = ".*"$',f'{key} = "{value}"',s,count=1,flags=re.M)
    if n != 1: raise SystemExit(f'No pude fijar {key}')
p.write_text(s)
print('WEB_PAGES_ORIGIN =',os.environ['WEB_ORIGIN'])
print('APP_PAGES_ORIGIN =',os.environ['APP_ORIGIN'])
PY
run git diff --check -- "$WRANGLER_CFG"

# Worker Preview únicamente.
echo
echo "▶ Deploy Worker Preview → intap-api-preview"
(
  cd api
  npx wrangler deploy --config wrangler.preview.toml
) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Preview"

sleep 4

# Smoke de superficies.
for url in \
  "https://preview.intaprd.com/" \
  "https://app.preview.intaprd.com/admin/login" \
  "https://app.preview.intaprd.com/admin/free/team/assign"; do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
  echo "✓ $url -> HTTP 200"
done

# Smoke API 1: los QA artifacts de Preview deben resolver desde la fuente real.
QA_OK=0
for artifact in QATEAM01A1 QATEAM02B2 QATEAM03C3 QATEAM04D4 QATEAM05E5; do
  body="$(curl -sS -X POST 'https://app.preview.intaprd.com/api/v1/public/artifacts/scan/status' -H 'content-type: application/json' --data "{\"public_code\":\"$artifact\"}")"
  if printf '%s' "$body" | grep -q '"ok":true'; then
    echo "✓ scan/status $artifact responde desde D1 Preview"
    QA_OK=1
    break
  fi
done
[ "$QA_OK" = "1" ] || fail "Ningún QA artifact respondió ok en scan/status"

# Smoke API 2: el camino legacy no puede consumir nada aunque un cliente viejo lo invoque.
JOIN_TMP="$LOG_DIR/legacy-join-response.json"
JOIN_HTTP="$(curl -sS -o "$JOIN_TMP" -w '%{http_code}' -X POST 'https://app.preview.intaprd.com/api/v1/me/team/join' -H 'content-type: application/json' --data '{}')"
[ "$JOIN_HTTP" = "409" ] || { cat "$JOIN_TMP"; fail "Legacy /me/team/join debía responder 409 y respondió $JOIN_HTTP"; }
grep -q 'TEAM_MASTER_PREPARATION_REQUIRED' "$JOIN_TMP" || { cat "$JOIN_TMP"; fail "Legacy join no devolvió el guard de autoridad esperado"; }
echo "✓ legacy /me/team/join bloqueado por autoridad Master"

restore_config
trap - EXIT
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Preview dejó cambios locales inesperados"; }

WORKER_VERSION="$(grep -E 'Current Version ID:' "$WORKER_LOG" | tail -1 | sed -E 's/.*Current Version ID:[[:space:]]*//' || true)"

cat <<EOF

============================================================
✓ TEAM FLOW · DEEP AUDIT · PREVIEW DESPLEGADO
============================================================
Producto probado: $PRODUCT_SHA
Feature head:     $HEAD_SHA
Web Pages:        $WEB_ORIGIN
App Pages:        $APP_ORIGIN
Worker Version:   ${WORKER_VERSION:-ver salida Wrangler}
Web Preview:      https://preview.intaprd.com
App Preview:      https://app.preview.intaprd.com
D1:               intap_db_preview ÚNICAMENTE
Producción:       NO TOCADA
Invariant audit:  APROBADO
Legacy self-join: BLOQUEADO
Source truth:     AUDITADA (ver $D1_AUDIT_LOG)
============================================================
EOF
