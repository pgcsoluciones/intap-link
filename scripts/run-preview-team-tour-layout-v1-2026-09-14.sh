#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/team-tour-layout-v1"
DEPLOY_BRANCH="feature-team-tour-layout-v1"
APP_PROJECT="intap-web2"
WRANGLER_CFG="api/wrangler.preview.toml"
LOG_DIR="$ROOT/.preview-team-tour-layout-v1-logs"
APP_LOG="$LOG_DIR/app-pages.log"
WORKER_LOG="$LOG_DIR/worker-preview.log"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }
restore_config(){ if [ -d "$ROOT/.git" ]; then git -C "$ROOT" restore -- "$WRANGLER_CFG" >/dev/null 2>&1 || true; fi; }
trap restore_config EXIT

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" && mkdir -p "$LOG_DIR"

cat <<'EOF'
============================================================
KAWVO LINK · TEAM · BARRA SUPERIOR + RECORRIDO SIN SUPERPOSICIÓN
PREVIEW V1
============================================================
- mueve Recorrido a barra superior sticky de Team
- corrige superposición de pasos 3/9, 4/9, 5/9 y 6/9
- producción NO se toca
============================================================
EOF

run git fetch github "$BRANCH" main
run git checkout "$BRANCH"
run git pull --ff-only github "$BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "El árbol de trabajo no está limpio"; }

run python3 scripts/apply-team-tour-layout-v1-2026-09-14.py
run git diff --check
run npm run build:preview -w app

run git add app/src/components/admin/free/FreeTeamCorporate.tsx app/src/components/admin/free/FreeTeamGuidedTour.tsx
run git commit -m "fix: improve Team tour layout and header"
run git push github "$BRANCH"

BASE_SHA="$(git merge-base HEAD github/main)"
FEATURE_SHA="$(git rev-parse HEAD)"
run git diff --check "$BASE_SHA...HEAD"
CHANGED="$(git diff --name-only "$BASE_SHA...HEAD")"
echo; echo "▶ Alcance"; echo "$CHANGED"
if echo "$CHANGED" | grep -Eq '^(api/src/|web/src/|functions/)'; then fail "Cambios fuera del Admin App"; fi

run npm run build:preview -w app
(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch "$DEPLOY_BRANCH") 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App Pages Preview"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$APP_LOG" | tail -1)"
[ -n "$APP_ORIGIN" ] || fail "No pude identificar App Pages origin"

APP_ORIGIN="$APP_ORIGIN" python3 - <<'PY' || fail "Actualizar APP_PAGES_ORIGIN temporal"
from pathlib import Path
import os,re
p=Path('api/wrangler.preview.toml')
s=p.read_text()
s,n=re.subn(r'^APP_PAGES_ORIGIN = ".*"$', f'APP_PAGES_ORIGIN = "{os.environ["APP_ORIGIN"]}"', s, count=1, flags=re.M)
if n!=1: raise SystemExit('APP_PAGES_ORIGIN no encontrado')
p.write_text(s)
PY

(
  cd api
  npx wrangler deploy --config wrangler.preview.toml --dry-run
  npx wrangler deploy --config wrangler.preview.toml
) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Preview"

sleep 4
for url in "https://app.preview.intaprd.com/admin/login" "https://app.preview.intaprd.com/admin/free/team"; do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

restore_config
trap - EXIT
[ -z "$(git status --porcelain)" ] || { git status --short; fail "El runner dejó cambios locales"; }

cat <<EOF
============================================================
✓ TEAM TOUR LAYOUT V1 LISTO EN PREVIEW
============================================================
Feature SHA: $FEATURE_SHA
Prueba: https://app.preview.intaprd.com/admin/free/team
Revisa especialmente:
- Recorrido en barra superior
- 3/9 Nombre del Team
- 4/9 Empresa
- 5/9 Cuentas bancarias
- 6/9 Data variable
Producción NO tocada
============================================================
EOF
