#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="reconcile/approved-releases-2026-09-01"
SOURCE_BRANCH="feature/kawvo-pwa-install"
APP_PROJECT="intap-link"
LOG_DIR="$ROOT/.preview-pwa-complete-recovery-2026-09-01-logs"
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
git checkout -B "$BRANCH" "github/$BRANCH" || fail "checkout reconciliación"
git reset --hard "github/$BRANCH" || fail "reset reconciliación"

echo "▶ Recuperando paquete PWA aprobado"
git checkout "github/$SOURCE_BRANCH" -- \
  app/index.html \
  app/public/manifest.webmanifest \
  app/public/sw.js \
  app/public/kawvo-icon.svg \
  app/public/kawvo-icon-192.png \
  app/public/kawvo-apple-touch-icon.svg \
  app/public/kawvo-apple-touch-icon.png || fail "recuperar archivos PWA"

python3 scripts/apply-pwa-install-guidance-2026-09-01.py || fail "aplicar instrucciones PWA"
git diff --check || fail "git diff --check"

echo ""
echo "▶ Validando contrato PWA completo"
grep -Fq '<link rel="manifest" href="/manifest.webmanifest"' app/index.html || fail "index.html no enlaza manifest"
grep -Fq '"name": "Kawvo"' app/public/manifest.webmanifest || fail "manifest no corresponde a Kawvo"
grep -Fq '"start_url": "/admin/free/home?source=pwa"' app/public/manifest.webmanifest || fail "start_url PWA incorrecto"
grep -Fq "navigator.serviceWorker.register('/sw.js'" app/src/main.tsx || fail "service worker no se registra"
test -s app/public/sw.js || fail "sw.js ausente"
test -s app/public/kawvo-icon-192.png || fail "icono PWA 192 ausente"
test -s app/public/kawvo-apple-touch-icon.png || fail "apple touch icon ausente"
grep -Fq 'const pwaInstallUrl = `${window.location.origin}/admin/free/home`' app/src/components/admin/free/FreeAccount.tsx || fail "Mi cuenta no muestra URL dinámica de instalación"
grep -Fq 'cuadrado con una flecha hacia arriba' app/src/components/admin/free/FreeAccount.tsx || fail "Falta explicación visual de Compartir en Safari"
grep -Fq 'tres puntos (⋮)' app/src/components/admin/free/FreeAccount.tsx || fail "Falta explicación del menú Chrome"
echo "✓ Paquete PWA + URL + instrucciones validados"

if ! git diff --quiet; then
  git add \
    app/index.html \
    app/public/manifest.webmanifest \
    app/public/sw.js \
    app/public/kawvo-icon.svg \
    app/public/kawvo-icon-192.png \
    app/public/kawvo-apple-touch-icon.svg \
    app/public/kawvo-apple-touch-icon.png \
    app/src/components/admin/free/FreeAccount.tsx
  git commit -m "fix(pwa): restore install package and guided installation" || fail "commit PWA"
  git push github "HEAD:$BRANCH" || fail "push PWA"
fi

echo ""
echo "▶ Build App Preview"
(cd app && npx tsc && npx vite build --mode preview) || fail "Build App Preview"

echo ""
echo "▶ Validando artefactos en dist"
test -s app/dist/manifest.webmanifest || fail "manifest no llegó a dist"
test -s app/dist/sw.js || fail "sw.js no llegó a dist"
test -s app/dist/kawvo-icon-192.png || fail "icono PWA no llegó a dist"
grep -Fq '/manifest.webmanifest' app/dist/index.html || fail "dist/index.html no enlaza manifest"
echo "✓ Artefactos PWA presentes en build"

echo ""
echo "▶ Deploy App SOLO Preview"
APP_LOG="$LOG_DIR/app-pages-$(date +%Y%m%d-%H%M%S).log"
(cd api && npx wrangler pages deploy ../app/dist --project-name "$APP_PROJECT" --branch "$BRANCH") 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App Preview"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$APP_LOG" | tail -1)"
[ -n "$APP_ORIGIN" ] || fail "No pude identificar APP_PAGES_ORIGIN"
echo "✓ APP_PAGES_ORIGIN=$APP_ORIGIN"

WRANGLER_BACKUP="$(mktemp)"
cp api/wrangler.preview.toml "$WRANGLER_BACKUP"
APP_ORIGIN="$APP_ORIGIN" python3 - <<'PY' || fail "Actualizar APP_PAGES_ORIGIN temporal"
from pathlib import Path
import os, re
p = Path('api/wrangler.preview.toml')
s = p.read_text()
s, n = re.subn(r'^APP_PAGES_ORIGIN = ".*"$', f'APP_PAGES_ORIGIN = "{os.environ["APP_ORIGIN"]}"', s, count=1, flags=re.M)
if n != 1: raise SystemExit('No pude actualizar APP_PAGES_ORIGIN')
p.write_text(s)
PY

echo ""
echo "▶ Deploy Worker SOLO Preview"
WORKER_LOG="$LOG_DIR/worker-$(date +%Y%m%d-%H%M%S).log"
(cd api && npx wrangler deploy --config wrangler.preview.toml) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Preview"
WORKER_VERSION="$(grep -E 'Current Version ID:' "$WORKER_LOG" | tail -1 | sed -E 's/.*Current Version ID:[[:space:]]*//')"

echo ""
echo "▶ Smoke PWA Preview"
for url in \
  "https://app.preview.intaprd.com/admin/free/account" \
  "https://app.preview.intaprd.com/admin/free/home" \
  "https://app.preview.intaprd.com/manifest.webmanifest" \
  "https://app.preview.intaprd.com/sw.js" \
  "https://app.preview.intaprd.com/kawvo-icon-192.png"; do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
  echo "✓ $url -> HTTP 200"
done

MANIFEST="$(curl -sS https://app.preview.intaprd.com/manifest.webmanifest)"
printf '%s' "$MANIFEST" | grep -Fq '"start_url": "/admin/free/home?source=pwa"' || fail "manifest remoto no tiene start_url aprobado"
echo "✓ Manifest remoto PWA correcto"

cleanup
WRANGLER_BACKUP=""

echo ""
echo "============================================================"
echo "✓ KAWVO PWA COMPLETA · PREVIEW LISTO PARA QA"
echo "============================================================"
echo "Commit rama:    $(git rev-parse HEAD)"
echo "App Pages:      $APP_ORIGIN"
echo "Worker Version: ${WORKER_VERSION:-ver salida Wrangler}"
echo "Producción:     NO TOCADA"
echo ""
echo "QA VISUAL:"
echo "1) Mi cuenta -> Instalar app Kawvo."
echo "2) Debe mostrar URL del dispositivo actual: https://app.preview.intaprd.com/admin/free/home"
echo "3) iPhone/iPad: explica Safari -> Compartir (cuadrado + flecha) -> Agregar a pantalla de inicio -> Agregar."
echo "4) Android: explica Chrome -> tres puntos (⋮) -> Instalar aplicación/Agregar a pantalla principal -> confirmar."
echo "5) Verificar instalación real y apertura en /admin/free/home?source=pwa."
echo "============================================================"
