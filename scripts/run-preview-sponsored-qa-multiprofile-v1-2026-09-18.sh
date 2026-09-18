#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/sponsored-qa-multiprofile-v1"
EXPECTED_MAIN_SHA="aa4805f3ee1030e41812346c5f6fbba61fbeb2d5"
APPROVED_PRODUCT_SHA="33e3d58ad3e48dddfc51e3b8a74924b3be33b111"
APP_PROJECT="intap-web2"
PREVIEW_DB="intap_db_preview"
LOG_DIR="$ROOT/.preview-sponsored-qa-multiprofile-v1-logs"
APP_LOG="$LOG_DIR/app-pages.log"
WORKER_LOG="$LOG_DIR/worker-preview.log"
PREVIEW_CFG="$ROOT/api/wrangler.preview.toml"
PREVIEW_CFG_BAK="$LOG_DIR/wrangler.preview.toml.bak"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR"
mkdir -p "$LOG_DIR"

cat <<EOF
============================================================
KAWVO LINK · CUENTA AUTORIZADA MULTIPERFIL · PREVIEW
============================================================
- excepción solo para intapcard@gmail.com
- perfiles públicos conservan flujo y apariencia normal
- cada código conserva patrocinador, URL, username y configuración
- selector aparece solo para la cuenta autorizada con varios perfiles
- credenciales permiten cambiar entre perfiles asociados
- cuentas normales conservan 1 perfil patrocinado máximo
- aplica migración 0069 SOLO en D1 Preview
- Producción NO se toca
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
POST_FILES="$(git diff --name-only "$APPROVED_PRODUCT_SHA"..HEAD | grep -Ev '^scripts/run-(preview|production)-sponsored-qa-multiprofile-v1-2026-09-18\.sh$' || true)"
[ -z "$POST_FILES" ] || { echo "$POST_FILES"; fail "Hay cambios posteriores al producto aprobado"; }

git merge-base --is-ancestor github/main HEAD || fail "main y feature divergieron"

ALLOWED='^(api/migrations(-preview)?/0069_sponsored_authorized_multiprofile\.sql|api/src/(account-home-route|sponsored-account-controls|sponsored-consent-claim|sponsored-multiprofile-access|sponsored-profile-scope|sponsored-scan)\.ts|app/src/App\.tsx|app/src/components/admin/sponsored/(SponsoredActivation|SponsoredBankAccounts|SponsoredDashboard|SponsoredExperienceTools|SponsoredProfileSelector|SponsoredResumeGate|SponsoredStarterOnboarding)\.tsx|scripts/test-sponsored-profile-contract\.mjs|scripts/run-(preview|production)-sponsored-qa-multiprofile-v1-2026-09-18\.sh)$'
UNEXPECTED="$(git diff --name-only github/main...HEAD | grep -Ev "$ALLOWED" || true)"
[ -z "$UNEXPECTED" ] || { echo "$UNEXPECTED"; fail "Hay archivos fuera del alcance"; }

run git diff --check github/main...HEAD
run npm ci
run node scripts/test-sponsored-profile-contract.mjs
run npm run build:preview -w app
run bash -lc "cd api && npx tsc --noEmit"
run bash -lc "cd api && npx wrangler deploy --config wrangler.preview.toml --dry-run"

echo
echo "▶ Migraciones pendientes D1 Preview"
(
  cd api
  npx wrangler d1 migrations list "$PREVIEW_DB" --remote --config wrangler.preview.toml
) || fail "No se pudieron listar migraciones Preview"

echo
echo "▶ Aplicar migraciones D1 Preview"
(
  cd api
  npx wrangler d1 migrations apply "$PREVIEW_DB" --remote --config wrangler.preview.toml
) || fail "Migraciones D1 Preview"

echo
echo "▶ Deploy App Pages Preview"
(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch "$BRANCH") 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App Preview"

APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$APP_LOG" | tail -1 || true)"
[ -n "$APP_ORIGIN" ] || fail "No pude detectar origin App Preview"

cp "$PREVIEW_CFG" "$PREVIEW_CFG_BAK"
restore_cfg(){ cp "$PREVIEW_CFG_BAK" "$PREVIEW_CFG" 2>/dev/null || true; }
trap restore_cfg EXIT

python3 - "$PREVIEW_CFG" "$APP_ORIGIN" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
app_origin = sys.argv[2]
text = path.read_text()
text, count = re.subn(
    r'APP_PAGES_ORIGIN\s*=\s*"[^"]+"',
    f'APP_PAGES_ORIGIN = "{app_origin}"',
    text,
    count=1,
)
if count != 1:
    raise SystemExit("No pude actualizar APP_PAGES_ORIGIN")
path.write_text(text)
PY

echo
echo "▶ Deploy Worker Preview"
(
  cd api
  npx wrangler deploy --config wrangler.preview.toml --dry-run
  npx wrangler deploy --config wrangler.preview.toml
) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Preview"

restore_cfg
trap - EXIT

sleep 5

echo
echo "▶ Smoke Preview"
for url in \
  "https://app.preview.intaprd.com/admin/login" \
  "https://app.preview.intaprd.com/admin/sponsored/select" \
  "https://app.preview.intaprd.com/admin/sponsored"
do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

code="$(curl -sS -o /dev/null -w '%{http_code}' "https://app.preview.intaprd.com/api/v1/me/sponsored-profiles")"
echo "✓ /api/v1/me/sponsored-profiles sin sesión -> HTTP $code"
[ "$code" = "401" ] || fail "Endpoint multiperfil no protegió autenticación"

rm -rf "$LOG_DIR"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Runner dejó cambios locales"; }

cat <<EOF
============================================================
✓ MULTIPERFIL AUTORIZADO DESPLEGADO EN PREVIEW
============================================================
Feature SHA: $(git rev-parse HEAD)
App origin:  $APP_ORIGIN
QA: https://app.preview.intaprd.com/admin/login
D1 Preview: migración 0069 aplicada
Producción: NO TOCADA
============================================================
EOF
