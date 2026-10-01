#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
REMOTE="github"
BRANCH="feature/owner-bar-settings-link"
EXPECTED_MAIN_SHA="85877fa021e3dab0dbda9ec40280121652beb68e"
RUNNER_PATH="scripts/run-preview-owner-bar-settings-free-portfolio-10-2026-10-01.sh"
APP_PROJECT="intap-web2"
WEB_PROJECT="intap-link"
PREVIEW_CFG="$ROOT/api/wrangler.preview.toml"
PREVIEW_CFG_BAK="$ROOT/api/wrangler.preview.toml.owner-bar-portfolio10.bak"
LOG_DIR="$ROOT/.preview-owner-bar-portfolio10-logs"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" "$PREVIEW_CFG_BAK"
mkdir -p "$LOG_DIR"

cat <<EOF
================================================================
KAWVO LINK · OWNER BAR + PORTAFOLIO FREE 10 · PREVIEW
================================================================
- Mi presentación -> Configuración
- Free Configuración -> /admin/free/account
- Patrocinado Configuración -> /admin/sponsored
- Portafolio Free: 10 imágenes
- Todas las altas/reemplazos pasan por optimización WebP
- D1 Preview Free max_photos = 10
- Producción NO se toca

Main esperado: $EXPECTED_MAIN_SHA
================================================================
EOF

run git fetch "$REMOTE" main "$BRANCH"
CURRENT_MAIN="$(git rev-parse "$REMOTE/main")"
[ "$CURRENT_MAIN" = "$EXPECTED_MAIN_SHA" ] || fail "main cambió: esperado $EXPECTED_MAIN_SHA, actual $CURRENT_MAIN"

run git switch "$BRANCH"
run git pull --ff-only "$REMOTE" "$BRANCH"

git restore -- "$RUNNER_PATH" 2>/dev/null || true
rm -rf "$ROOT/.preview-free-contact-agenda-logs" "$ROOT/.production-free-contact-agenda-2026-10-01-logs"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Árbol local no limpio"; }
git merge-base --is-ancestor "$REMOTE/main" HEAD || fail "main y feature divergieron"

cat > "$LOG_DIR/allowed.txt" <<'EOF_ALLOWED'
api/migrations-preview/0084_free_portfolio_limit_10.sql
api/migrations/0084_free_portfolio_limit_10.sql
api/src/ai-profile-assistant.ts
app/src/components/admin/free/FreeDashboard.tsx
app/src/components/admin/free/FreePortfolio.tsx
scripts/run-preview-owner-bar-settings-free-portfolio-10-2026-10-01.sh
scripts/test-ai-profile-canonical-limits.mjs
scripts/test-free-contact-agenda-contract.mjs
scripts/test-sponsored-profile-contract.mjs
web/src/components/appointments/AppointmentOwnerBar.tsx
web/src/components/free-profile/IntapLinkGratis.types.ts
web/src/components/free-profile/IntapLinkGratisProfile.tsx
web/src/components/sponsored/SponsoredProfile.tsx
EOF_ALLOWED

git diff --name-only "$REMOTE/main"...HEAD | sort > "$LOG_DIR/actual.txt"
sort "$LOG_DIR/allowed.txt" > "$LOG_DIR/allowed.sorted.txt"
diff -u "$LOG_DIR/allowed.sorted.txt" "$LOG_DIR/actual.txt" || fail "Hay archivos fuera del alcance aprobado"

run git diff --check "$REMOTE/main"...HEAD
run npm ci
run node scripts/test-sponsored-profile-contract.mjs
run node scripts/test-free-contact-agenda-contract.mjs
run node scripts/test-ai-profile-canonical-limits.mjs
run npm run build:preview -w app
run npm run build:preview -w web
run bash -lc 'cd api && npx tsc --noEmit'

echo; echo "▶ Migración Preview permitida"
(
  cd api
  npx wrangler d1 migrations list intap_db_preview --remote --config wrangler.preview.toml
) 2>&1 | tee "$LOG_DIR/migrations-before.log"
PENDING="$(grep -Eo '[0-9]{4}_[A-Za-z0-9._-]+\.sql' "$LOG_DIR/migrations-before.log" | sort -u || true)"
if [ -n "$PENDING" ]; then
  while IFS= read -r m; do
    [ -z "$m" ] && continue
    [ "$m" = "0084_free_portfolio_limit_10.sql" ] || fail "Migración Preview fuera del alcance: $m"
  done <<< "$PENDING"
  (
    cd api
    npx wrangler d1 migrations apply intap_db_preview --remote --config wrangler.preview.toml
  ) || fail "No se pudo aplicar 0084 en Preview"
fi

LIMIT="$(cd api && npx wrangler d1 execute intap_db_preview --remote --config wrangler.preview.toml --json --command "SELECT max_photos FROM plan_limits WHERE plan_id='free' LIMIT 1;" 2>/dev/null | python3 -c "import json,sys;d=json.load(sys.stdin);r=((d[0].get('results') if isinstance(d,list) and d else []) or []);print((r[0].get('max_photos') if r else '') or '')")"
[ "$LIMIT" = "10" ] || fail "D1 Preview Free max_photos esperado 10, actual $LIMIT"
echo "✓ D1 Preview Free max_photos = 10"

echo; echo "▶ Deploy App Preview"
(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch "$BRANCH") 2>&1 | tee "$LOG_DIR/app.log"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$LOG_DIR/app.log" | tail -1)"
[ -n "$APP_ORIGIN" ] || fail "No pude detectar App origin"

echo; echo "▶ Deploy Web Preview"
(npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch "$BRANCH") 2>&1 | tee "$LOG_DIR/web.log"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$LOG_DIR/web.log" | tail -1)"
[ -n "$WEB_ORIGIN" ] || fail "No pude detectar Web origin"

cp "$PREVIEW_CFG" "$PREVIEW_CFG_BAK"
restore_cfg(){
  if [ -f "$PREVIEW_CFG_BAK" ]; then
    cp "$PREVIEW_CFG_BAK" "$PREVIEW_CFG" 2>/dev/null || true
    rm -f "$PREVIEW_CFG_BAK"
  fi
}
trap restore_cfg EXIT

python3 - "$PREVIEW_CFG" "$APP_ORIGIN" "$WEB_ORIGIN" <<'PY'
from pathlib import Path
import re,sys
p=Path(sys.argv[1]); app=sys.argv[2]; web=sys.argv[3]
s=p.read_text()
s,n1=re.subn(r'APP_PAGES_ORIGIN\s*=\s*"[^"]+"',f'APP_PAGES_ORIGIN = "{app}"',s,count=1)
s,n2=re.subn(r'WEB_PAGES_ORIGIN\s*=\s*"[^"]+"',f'WEB_PAGES_ORIGIN = "{web}"',s,count=1)
if n1 != 1 or n2 != 1: raise SystemExit("No pude fijar origins Preview")
p.write_text(s)
PY

echo; echo "▶ Deploy Worker Preview"
(
  cd api
  npx wrangler deploy --config wrangler.preview.toml --dry-run
  npx wrangler deploy --config wrangler.preview.toml
) 2>&1 | tee "$LOG_DIR/worker.log"

restore_cfg
trap - EXIT
sleep 4

for url in "https://app.preview.intaprd.com/admin/login" "https://preview.intaprd.com"; do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

rm -rf "$LOG_DIR"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Runner dejó cambios locales"; }

cat <<EOF
================================================================
✓ OWNER BAR + PORTAFOLIO FREE 10 LISTO EN PREVIEW
================================================================
Feature SHA: $(git rev-parse HEAD)
App origin:  $APP_ORIGIN
Web origin:  $WEB_ORIGIN

QA:
1. Barra logueada muestra Configuración en lugar de Mi presentación.
2. Free abre /admin/free/account.
3. Patrocinado abre /admin/sponsored.
4. Portafolio Free muestra límite 10.
5. Agregar/reemplazar imagen pasa por recorte + optimización WebP.
6. D1 Preview reporta max_photos = 10.
7. Producción NO fue tocada.
================================================================
EOF
