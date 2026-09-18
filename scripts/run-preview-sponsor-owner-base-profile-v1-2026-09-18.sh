#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/sponsor-owner-base-profile-v1"
EXPECTED_MAIN_SHA="c61ca9e3bab8d65de75820f40e8959b5dc7c12ee"
APP_PROJECT="intap-web2"
LOG_DIR="$ROOT/.preview-sponsor-owner-base-profile-v1-logs"
APP_LOG="$LOG_DIR/app-pages.log"
WORKER_LOG="$LOG_DIR/worker-preview.log"
PREVIEW_CFG="$ROOT/api/wrangler.preview.toml"
PREVIEW_CFG_BAK="$LOG_DIR/wrangler.preview.toml.bak"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" && mkdir -p "$LOG_DIR"

cat <<EOF
============================================================
KAWVO LINK · BASE PERFIL PATROCINADOR · PREVIEW
============================================================
- NO toca Producción
- NO toca D1 ni aplica migraciones
- modifica solo flujo Master/patrocinador
- beneficiario conserva su starter actual
- compila App + API y contrato patrocinado
- despliega App Preview + Worker Preview
============================================================
EOF

run git fetch github main "$BRANCH"
[ "$(git rev-parse github/main)" = "$EXPECTED_MAIN_SHA" ] || fail "main cambió; detener y auditar antes de Preview"
run git switch "$BRANCH"
run git pull --ff-only github "$BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Árbol local no limpio"; }

ALLOWED='^(api/src/sponsored-owner-profile-seed\.ts|api/src/sponsored-scan\.ts|api/src/sponsored-profiles\.ts|api/src/sponsored-starter\.ts|app/src/components/admin/sponsored/SponsoredStarterOnboarding\.tsx|app/src/components/admin/sponsored/SponsoredDashboard\.tsx|scripts/test-sponsored-profile-contract\.mjs|scripts/run-preview-sponsor-owner-base-profile-v1-2026-09-18\.sh)$'
UNEXPECTED="$(git diff --name-only github/main...HEAD | grep -Ev "$ALLOWED" || true)"
[ -z "$UNEXPECTED" ] || { echo "$UNEXPECTED"; fail "Hay archivos fuera del alcance aprobado"; }

run git diff --check github/main...HEAD
run npm ci
run node scripts/test-sponsored-profile-contract.mjs
run npm run build:preview -w app
run bash -lc 'cd api && npx tsc --noEmit'
run bash -lc 'npx esbuild api/src/preview-free-entry.ts --bundle --platform=node --format=esm --target=node20 --external:cloudflare:* --outfile=/tmp/kawvo-sponsor-owner-base-preview-api.mjs'

echo; echo "▶ Deploy App Pages Preview"
(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch "$BRANCH") 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App Preview"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$APP_LOG" | tail -1)"
[ -n "$APP_ORIGIN" ] || fail "No pude detectar origin App Preview"
echo "✓ App Preview: $APP_ORIGIN"

cp "$PREVIEW_CFG" "$PREVIEW_CFG_BAK"
restore_cfg(){ cp "$PREVIEW_CFG_BAK" "$PREVIEW_CFG" 2>/dev/null || true; }
trap restore_cfg EXIT
python3 - "$PREVIEW_CFG" "$APP_ORIGIN" <<'PY'
from pathlib import Path
import re,sys
p=Path(sys.argv[1]); app=sys.argv[2]
s=p.read_text()
s,n=re.subn(r'APP_PAGES_ORIGIN\s*=\s*"[^"]+"',f'APP_PAGES_ORIGIN = "{app}"',s,count=1)
if n != 1: raise SystemExit("No pude actualizar APP_PAGES_ORIGIN")
p.write_text(s)
PY

echo; echo "▶ Deploy Worker Preview"
(
  cd api
  npx wrangler deploy --config wrangler.preview.toml --dry-run
  npx wrangler deploy --config wrangler.preview.toml
) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Preview"
restore_cfg
trap - EXIT

sleep 4
echo; echo "▶ Smoke Preview"
for url in \
  "https://app.preview.intaprd.com/admin/login" \
  "https://app.preview.intaprd.com/admin/sponsor"
do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done
api_code="$(curl -sS -o "$LOG_DIR/sponsor-me.json" -w '%{http_code}' https://app.preview.intaprd.com/api/v1/sponsor/me)"
echo "✓ /api/v1/sponsor/me sin sesión -> HTTP $api_code"
[ "$api_code" = "401" ] || fail "sponsor/me sin sesión no respondió 401"

rm -rf "$LOG_DIR"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Runner dejó cambios locales"; }

cat <<EOF
============================================================
✓ BASE PERFIL PATROCINADOR DESPLEGADA EN PREVIEW
============================================================
Feature SHA: $(git rev-parse HEAD)
App origin:  $APP_ORIGIN

QA:
- https://app.preview.intaprd.com/admin/sponsor
- abrir Mi presentación
- si no tiene username: solo debe pedir username
- nombre/contacto/logo/banner disponibles deben aparecer como base
- campos ya editados NO deben sobrescribirse
- beneficiario patrocinado debe conservar onboarding por actividad

Producción NO tocada
============================================================
EOF
