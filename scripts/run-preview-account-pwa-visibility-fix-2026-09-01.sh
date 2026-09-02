#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="reconcile/approved-releases-2026-09-01"
APP_PROJECT="intap-link"
LOG_DIR="$ROOT/.preview-account-pwa-visibility-2026-09-01-logs"
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

git fetch github "$BRANCH" || fail "git fetch"
git checkout -B "$BRANCH" "github/$BRANCH" || fail "checkout rama"
git reset --hard "github/$BRANCH" || fail "reset rama"

python3 scripts/apply-account-pwa-visibility-fix-2026-09-01.py || fail "aplicar corrección PWA"
git diff --check || fail "git diff --check"

printf '\n▶ Validando contrato PWA en Mi cuenta\n'
grep -Fq 'label={pwaInstalled ? "Kawvo está instalada" : "Instalar app Kawvo"}' app/src/components/admin/free/FreeAccount.tsx || fail "La opción de app Kawvo no queda siempre visible"
! grep -Fq "localStorage.getItem('kawvo_pwa_installed') === '1'" app/src/components/admin/free/FreeAccount.tsx || fail "Mi cuenta todavía oculta la opción por una bandera histórica de localStorage"
grep -Fq "window.matchMedia('(display-mode: standalone)').matches" app/src/components/admin/free/FreeAccount.tsx || fail "Falta detección real de modo app"
grep -Fq 'Agregar a pantalla de inicio' app/src/components/admin/free/FreeAccount.tsx || fail "Faltan instrucciones iPhone/iPad"
grep -Fq 'Instalar aplicación' app/src/components/admin/free/FreeAccount.tsx || fail "Faltan instrucciones Android"
echo "✓ Contrato PWA visible validado"

if ! git diff --quiet -- app/src/components/admin/free/FreeAccount.tsx; then
  git add app/src/components/admin/free/FreeAccount.tsx
  git commit -m "fix(account): keep Kawvo app install entry visible" || fail "commit"
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
APP_ORIGIN="$APP_ORIGIN" python3 - <<'PY' || fail "Actualizar APP_PAGES_ORIGIN temporal"
from pathlib import Path
import os, re
p = Path('api/wrangler.preview.toml')
s = p.read_text()
s, n = re.subn(r'^APP_PAGES_ORIGIN = ".*"$', f'APP_PAGES_ORIGIN = "{os.environ["APP_ORIGIN"]}"', s, count=1, flags=re.M)
if n != 1:
    raise SystemExit('No pude actualizar APP_PAGES_ORIGIN')
p.write_text(s)
PY

printf '\n▶ Deploy Worker SOLO Preview\n'
WORKER_LOG="$LOG_DIR/worker-$(date +%Y%m%d-%H%M%S).log"
(cd api && npx wrangler deploy --config wrangler.preview.toml) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Preview"
WORKER_VERSION="$(grep -E 'Current Version ID:' "$WORKER_LOG" | tail -1 | sed -E 's/.*Current Version ID:[[:space:]]*//')"

code="$(curl -sS -L -o /dev/null -w '%{http_code}' 'https://app.preview.intaprd.com/admin/free/account')"
[ "$code" = "200" ] || fail "Mi cuenta Preview respondió HTTP $code"
echo "✓ https://app.preview.intaprd.com/admin/free/account -> HTTP 200"

cleanup
WRANGLER_BACKUP=""

echo ""
echo "============================================================"
echo "✓ PWA MI CUENTA · PREVIEW LISTO PARA QA VISUAL"
echo "============================================================"
echo "Commit rama:    $(git rev-parse HEAD)"
echo "App Pages:      $APP_ORIGIN"
echo "Worker Version: ${WORKER_VERSION:-ver salida Wrangler}"
echo "Producción:     NO TOCADA"
echo ""
echo "QA VISUAL:"
echo "1) Abrir Mi cuenta desde navegador normal: debe verse Instalar app Kawvo."
echo "2) Si no hay prompt automático: tocarla y comprobar instrucciones iPhone/iPad/Android."
echo "3) Si Kawvo está abierta realmente como PWA: debe verse Kawvo está instalada."
echo "============================================================"
