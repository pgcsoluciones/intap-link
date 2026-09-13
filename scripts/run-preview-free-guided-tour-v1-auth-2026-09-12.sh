#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/free-guided-tour-v1"
DEPLOY_BRANCH="feature-free-guided-tour-v1"
APP_PROJECT="intap-web2"
WRANGLER_CFG="api/wrangler.preview.toml"
LOG_DIR="$ROOT/.preview-free-guided-tour-auth-logs"
APP_LOG="$LOG_DIR/app-pages.log"
WORKER_LOG="$LOG_DIR/worker-preview.log"

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

cat <<'EOF'

============================================================
 KAWVO LINK · RECORRIDO GUIADO FREE · PREVIEW AUTH
============================================================
 Corrige el acceso OAuth del Preview usando el dominio autorizado:
 https://app.preview.intaprd.com

 Producción NO se toca.
 D1/R2 de Producción NO se tocan.
============================================================
EOF

run git fetch github "$BRANCH" main
run git checkout "$BRANCH"
run git pull --ff-only github "$BRANCH"

[ -z "$(git status --porcelain)" ] || { git status --short; fail "El árbol de trabajo no está limpio"; }

BASE_SHA="$(git merge-base HEAD github/main)"
FEATURE_SHA="$(git rev-parse HEAD)"
echo "Base:    $BASE_SHA"
echo "Feature: $FEATURE_SHA"

run git diff --check "$BASE_SHA...HEAD"

echo
echo "▶ Verificación de alcance"
CHANGED="$(git diff --name-only "$BASE_SHA...HEAD")"
echo "$CHANGED"
if echo "$CHANGED" | grep -Eq '^(api/src/|web/src/|functions/)'; then
  fail "La rama contiene cambios fuera del Admin App; se cancela para evitar regresión"
fi

echo
echo "▶ Build Admin App Preview"
run npm run build:preview -w app

echo
echo "▶ Deploy Admin App Preview aislado"
(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch "$DEPLOY_BRANCH") 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App Pages Preview"

APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$APP_LOG" | tail -1)"
[ -n "$APP_ORIGIN" ] || fail "No pude identificar el origin inmutable del App Preview"
echo "✓ App Pages origin: $APP_ORIGIN"

# El OAuth de Google calcula redirect_uri desde el origin de la petición.
# Por eso el usuario NO debe autenticarse contra *.pages.dev.
# app.preview.intaprd.com ya es el dominio estable del entorno Preview y el
# Worker Preview sirve /api/* + proxea el App Pages origin generado arriba.
APP_ORIGIN="$APP_ORIGIN" python3 - <<'PY' || fail "Actualizar APP_PAGES_ORIGIN temporalmente"
from pathlib import Path
import os,re
p=Path('api/wrangler.preview.toml')
s=p.read_text()
origin=os.environ['APP_ORIGIN']
s,n=re.subn(r'^APP_PAGES_ORIGIN = ".*"$', f'APP_PAGES_ORIGIN = "{origin}"', s, count=1, flags=re.M)
if n != 1:
    raise SystemExit('No encontré APP_PAGES_ORIGIN en api/wrangler.preview.toml')
p.write_text(s)
print('✓ APP_PAGES_ORIGIN temporal =', origin)
PY

run git diff --check -- "$WRANGLER_CFG"

echo
echo "▶ Dry-run Worker Preview"
(
  cd api
  npx wrangler deploy --config wrangler.preview.toml --dry-run
) || fail "Dry-run Worker Preview"

echo
echo "▶ Deploy Worker SOLO Preview → app.preview.intaprd.com"
(
  cd api
  npx wrangler deploy --config wrangler.preview.toml
) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Preview"

sleep 4

for url in \
  "https://app.preview.intaprd.com/admin/login" \
  "https://app.preview.intaprd.com/admin/free"
do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

# Verifica que el inicio OAuth use el dominio preview autorizado y no Pages.
OAUTH_LOCATION="$(curl -sS -I 'https://app.preview.intaprd.com/api/v1/auth/google/start' | awk 'BEGIN{IGNORECASE=1} /^location:/{sub(/\r$/,""); print substr($0,11)}' | tail -1)"
[ -n "$OAUTH_LOCATION" ] || fail "No pude leer redirect OAuth"

echo "✓ OAuth redirect detectado"
case "$OAUTH_LOCATION" in
  *"redirect_uri=https%3A%2F%2Fapp.preview.intaprd.com%2Fapi%2Fv1%2Fauth%2Fgoogle%2Fcallback"*)
    echo "✓ redirect_uri OAuth correcto: app.preview.intaprd.com"
    ;;
  *)
    echo "$OAUTH_LOCATION"
    fail "OAuth sigue apuntando a un redirect_uri no autorizado"
    ;;
esac

restore_config
trap - EXIT
[ -z "$(git status --porcelain)" ] || { git status --short; fail "El runner dejó cambios locales inesperados"; }

WORKER_VERSION="$(grep -E 'Current Version ID:' "$WORKER_LOG" | tail -1 | sed -E 's/.*Current Version ID:[[:space:]]*//' || true)"

cat <<EOF

============================================================
✓ PREVIEW AUTENTICABLE LISTO PARA QA
============================================================
Feature SHA:     $FEATURE_SHA
App Pages:       $APP_ORIGIN
Worker Preview:  ${WORKER_VERSION:-ver salida Wrangler}

ENTRA POR ESTA URL:
https://app.preview.intaprd.com/admin/free

NO uses la URL *.pages.dev para iniciar sesión con Google.

Producción: NO TOCADA
DB Producción: NO TOCADA
R2 Producción: NO TOCADO
============================================================
EOF
