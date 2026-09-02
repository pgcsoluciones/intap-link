#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="fix/restore-approved-location-ux-2026-09-02"
SOURCE_BRANCH="feature/kawvo-pwa-install"
APP_PROJECT="intap-link"
LOG_DIR="$ROOT/.preview-location-ux-2026-09-02-logs"
WRANGLER_BACKUP=""

fail() { echo ""; echo "✗ ERROR: $1"; echo "Producción NO fue tocada."; exit 1; }
cleanup() {
  if [ -n "$WRANGLER_BACKUP" ] && [ -f "$WRANGLER_BACKUP" ]; then
    cp "$WRANGLER_BACKUP" "$ROOT/api/wrangler.preview.toml" || true
    rm -f "$WRANGLER_BACKUP" || true
  fi
}
trap cleanup EXIT

cd "$ROOT" || fail "No existe $ROOT"
mkdir -p "$LOG_DIR"

echo "▶ Sincronizando ramas"
git fetch github "$BRANCH" "$SOURCE_BRANCH" || fail "git fetch"
git checkout -B "$BRANCH" "github/$BRANCH" || fail "checkout rama"
git reset --hard "github/$BRANCH" || fail "reset rama"

printf '\n▶ Restaurando UX de Ubicación aprobada\n'
git show "github/$SOURCE_BRANCH:app/src/components/admin/free/FreeLocation.tsx" > app/src/components/admin/free/FreeLocation.tsx || fail "recuperar FreeLocation"

printf '\n▶ Validando comportamiento aprobado\n'
grep -Fq 'Encuentra tu negocio o dirección sin salir del panel' app/src/components/admin/free/FreeLocation.tsx || fail "Falta búsqueda sin salir del panel"
grep -Fq 'Usar mi ubicación actual' app/src/components/admin/free/FreeLocation.tsx || fail "Falta ubicación actual"
grep -Fq 'navigator.geolocation.getCurrentPosition' app/src/components/admin/free/FreeLocation.tsx || fail "Falta geolocalización del dispositivo"
grep -Fq 'Buscar ubicación' app/src/components/admin/free/FreeLocation.tsx || fail "Falta búsqueda integrada"
grep -Fq 'Usar esta ubicación' app/src/components/admin/free/FreeLocation.tsx || fail "Falta confirmación del mapa"
grep -Fq "apiGet('/me/contact')" app/src/components/admin/free/FreeQuickActions.tsx || fail "Falta sincronización canónica del botón Ubicación"
grep -Fq "const realLocation = readString(contact, 'map_url')" web/src/components/free-profile/IntapLinkGratis.adapter.ts || fail "Perfil público no usa ubicación canónica"
if grep -Fq 'target="_blank"' app/src/components/admin/free/FreeLocation.tsx; then fail "Ubicación todavía abre una pantalla externa"; fi
echo "✓ UX de Ubicación aprobada presente"

git diff --check || fail "git diff --check"
if ! git diff --quiet -- app/src/components/admin/free/FreeLocation.tsx; then
  git add app/src/components/admin/free/FreeLocation.tsx
  git commit -m "fix(location): restore in-panel search and current location" || fail "commit"
  git push github "HEAD:$BRANCH" || fail "push"
fi

printf '\n▶ Build App Preview\n'
(cd app && npx tsc && npx vite build --mode preview) || fail "Build App Preview"

printf '\n▶ Deploy App SOLO Preview\n'
APP_LOG="$LOG_DIR/app-pages-$(date +%Y%m%d-%H%M%S).log"
(cd api && npx wrangler pages deploy ../app/dist --project-name "$APP_PROJECT" --branch "$BRANCH") 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App Preview"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$APP_LOG" | tail -1)"
[ -n "$APP_ORIGIN" ] || fail "No pude identificar APP_PAGES_ORIGIN"
echo "✓ APP_PAGES_ORIGIN=$APP_ORIGIN"

WRANGLER_BACKUP="$(mktemp)"
cp api/wrangler.preview.toml "$WRANGLER_BACKUP"
APP_ORIGIN="$APP_ORIGIN" python3 - <<'PY' || fail "Actualizar APP_PAGES_ORIGIN Preview"
from pathlib import Path
import os,re
p=Path('api/wrangler.preview.toml')
s=p.read_text()
s,n=re.subn(r'^APP_PAGES_ORIGIN = ".*"$', f'APP_PAGES_ORIGIN = "{os.environ["APP_ORIGIN"]}"', s, count=1, flags=re.M)
if n != 1: raise SystemExit('No pude actualizar APP_PAGES_ORIGIN')
p.write_text(s)
PY

printf '\n▶ Deploy Worker SOLO Preview\n'
WORKER_LOG="$LOG_DIR/worker-$(date +%Y%m%d-%H%M%S).log"
(cd api && npx wrangler deploy --config wrangler.preview.toml) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Preview"
WORKER_VERSION="$(grep -E 'Current Version ID:' "$WORKER_LOG" | tail -1 | sed -E 's/.*Current Version ID:[[:space:]]*//')"

printf '\n▶ Smoke Preview\n'
for url in \
  "https://app.preview.intaprd.com/admin/free/location" \
  "https://app.preview.intaprd.com/admin/free/quick-actions" \
  "https://app.preview.intaprd.com/admin/free/account"; do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
  echo "✓ $url -> HTTP 200"
done

cleanup
WRANGLER_BACKUP=""

printf '\n============================================================\n'
printf '✓ UBICACIÓN APROBADA · PREVIEW LISTO PARA QA\n'
printf '============================================================\n'
echo "Commit rama:    $(git rev-parse HEAD)"
echo "App Pages:      $APP_ORIGIN"
echo "Worker Version: ${WORKER_VERSION:-ver salida Wrangler}"
echo "Producción:     NO TOCADA"
echo ""
echo "QA VISUAL:"
echo "1) Abrir Ubicación y buscar una dirección: no debe salir del panel."
echo "2) Confirmar mapa dentro de la misma pantalla y usar 'Usar esta ubicación'."
echo "3) Probar 'Usar mi ubicación actual' y aceptar permiso del navegador."
echo "4) Guardar y verificar que el botón Ubicación del perfil usa el mismo destino."
echo "============================================================"
