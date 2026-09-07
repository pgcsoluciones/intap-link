#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawvo-onboarding-product-flow-v1"
DEPLOY_BRANCH="feature-kawvo-onboarding-product-flow-v1"
WEB_PROJECT="intap-link"
APP_PROJECT="intap-web2"
LOG_DIR="$ROOT/.preview-onboarding-product-flow-2026-09-07-logs"
WEB_LOG="$LOG_DIR/web-pages.log"
APP_LOG="$LOG_DIR/app-pages.log"
WORKER_LOG="$LOG_DIR/worker.log"
WRANGLER_CFG="api/wrangler.preview.toml"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }
restore_config(){
  if [ -d "$ROOT/.git" ]; then
    git -C "$ROOT" restore -- "$WRANGLER_CFG" >/dev/null 2>&1 || true
  fi
}
trap restore_config EXIT

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR"
mkdir -p "$LOG_DIR"

printf '\n============================================================\n'
printf ' KAWVO LINK · ONBOARDING + PRODUCTOS · PREVIEW\n'
printf '============================================================\n\n'

run git fetch github "$BRANCH"
run git checkout -B "$BRANCH" "github/$BRANCH"
run git reset --hard "github/$BRANCH"

[ -z "$(git status --porcelain)" ] || { git status --short; fail "Working tree no está limpio"; }

BASE_SHA="$(git merge-base HEAD github/main 2>/dev/null || git merge-base HEAD main)"
FEATURE_SHA="$(git rev-parse HEAD)"
echo "Base:    $BASE_SHA"
echo "Feature: $FEATURE_SHA"

run git diff --check "$BASE_SHA...HEAD"

# Validaciones locales del código que sí pertenece a este bloque.
# No se ejecuta el chequeo histórico de functions/profile-discovery.ts porque
# main ya contiene un error de tipos heroUrl/hero_url ajeno a esta rama.
run npm ci
run npm run build:preview -w web
run npm run build:preview -w app
run npx tsc --noEmit -p api/tsconfig.json
run npx esbuild api/src/preview-free-entry.ts --bundle --platform=node --format=esm --target=node20 --external:cloudflare:* --outfile=/tmp/kawvo-onboarding-product-api.mjs
run bash -lc 'cd api && npx wrangler deploy --config wrangler.preview.toml --dry-run'

# Public Web Preview: contiene el resolver /l/:codigo y el redirect directo.
echo
echo "▶ Deploy Web Preview → $WEB_PROJECT"
(npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch "$DEPLOY_BRANCH") 2>&1 | tee "$WEB_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Web Pages Preview"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$WEB_LOG" | tail -1)"
[ -n "$WEB_ORIGIN" ] || fail "No pude identificar WEB_PAGES_ORIGIN"

# Admin App Preview: onboarding, Mis productos y Super Admin promociones.
echo
echo "▶ Deploy App Preview → $APP_PROJECT"
(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch "$DEPLOY_BRANCH") 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App Pages Preview"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$APP_LOG" | tail -1)"
[ -n "$APP_ORIGIN" ] || fail "No pude identificar APP_PAGES_ORIGIN"

# D1 Preview únicamente. Nunca toca intap_db de Producción.
echo
echo "▶ Aplicar migraciones D1 Preview"
(
  cd api
  npx wrangler d1 migrations apply intap_db_preview --remote --config wrangler.preview.toml
) || fail "Migraciones D1 Preview"

# Fijar orígenes inmutables de Pages solo para este deploy del Worker Preview.
WEB_ORIGIN="$WEB_ORIGIN" APP_ORIGIN="$APP_ORIGIN" python3 - <<'PY' || fail "Fijar origins Preview"
from pathlib import Path
import os,re
p=Path('api/wrangler.preview.toml')
s=p.read_text()
for key, value in (
    ('WEB_PAGES_ORIGIN', os.environ['WEB_ORIGIN']),
    ('APP_PAGES_ORIGIN', os.environ['APP_ORIGIN']),
):
    s, n = re.subn(rf'^{key} = ".*"$', f'{key} = "{value}"', s, count=1, flags=re.M)
    if n != 1:
        raise SystemExit(f'No pude fijar {key}')
p.write_text(s)
print('WEB_PAGES_ORIGIN =', os.environ['WEB_ORIGIN'])
print('APP_PAGES_ORIGIN =', os.environ['APP_ORIGIN'])
PY

run git diff --check -- "$WRANGLER_CFG"

echo
echo "▶ Deploy Worker Preview"
(
  cd api
  npx wrangler deploy --config wrangler.preview.toml
) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Preview"

sleep 3

for url in \
  "https://preview.intaprd.com/" \
  "https://app.preview.intaprd.com/admin/login" \
  "https://app.preview.intaprd.com/superadmin/promotions"
do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

restore_config
trap - EXIT
[ -z "$(git status --porcelain)" ] || { git status --short; fail "El deploy terminó pero dejó cambios locales inesperados"; }

WORKER_VERSION="$(grep -E 'Current Version ID:' "$WORKER_LOG" | tail -1 | sed -E 's/.*Current Version ID:[[:space:]]*//' || true)"

cat <<EOF

============================================================
✓ PREVIEW DESPLEGADO · LISTO PARA QA
============================================================
Feature SHA:     $FEATURE_SHA
Web Pages:       $WEB_ORIGIN
App Pages:       $APP_ORIGIN
Worker Version:  ${WORKER_VERSION:-ver salida Wrangler}
Web Preview:     https://preview.intaprd.com
App Preview:     https://app.preview.intaprd.com
Super Admin:     https://app.preview.intaprd.com/superadmin/promotions
Producción:      NO TOCADA
PR Draft:        https://github.com/pgcsoluciones/intap-link/pull/100
============================================================
EOF
