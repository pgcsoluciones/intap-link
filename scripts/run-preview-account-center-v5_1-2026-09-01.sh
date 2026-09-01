#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawvo-account-center-v1"
WEB_PROJECT="intap-web2"
LOG_DIR="$ROOT/.preview-account-center-v5_1-2026-09-01-logs"

fail() { echo ""; echo "✗ ERROR: $1"; echo "Producción no fue tocada."; exit 1; }
run() { echo ""; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
mkdir -p "$LOG_DIR"
run git fetch github "$BRANCH"
run git reset --hard "github/$BRANCH"

# La V5 ya dejó App/API/migración listas. Este recovery corrige únicamente
# el despliegue Web para que Cloudflare Pages incluya /functions del repo raíz.

echo ""
echo "▶ Verificando Graph Cards en código"
grep -Fq "url.pathname === '/invitacion'" functions/_middleware.ts || fail "Falta Graph Card /invitacion en middleware"
grep -Fq 'share=bancos: social card bancaria' functions/_middleware.ts || fail "Falta Graph Card bancaria en middleware"
echo "✓ middleware social presente"

run git diff --check

# Reconstruimos Web para asegurar que el dist corresponde al HEAD actual.
echo ""
echo "▶ Build Web Preview"
(cd web && npm run build) || fail "Build Web Preview"

# IMPORTANTE: ejecutar wrangler desde la raíz del repo. Así Pages detecta
# ROOT/functions y compila el middleware edge junto al contenido de web/dist.
echo ""
echo "▶ Deploy Web Preview con Pages Functions"
WEB_LOG="$LOG_DIR/web-pages-$(date +%Y%m%d-%H%M%S).log"
(npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch "$BRANCH") 2>&1 | tee "$WEB_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Web Preview con Functions"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$WEB_LOG" | tail -1)"
[ -n "$WEB_ORIGIN" ] || fail "No pude identificar WEB_PAGES_ORIGIN"
echo "✓ WEB_PAGES_ORIGIN=$WEB_ORIGIN"

# Debe verse evidencia de compilación/subida de Functions. Si Wrangler cambia
# el copy, la validación HTTP de abajo sigue siendo la fuente de verdad.

WEB_ORIGIN="$WEB_ORIGIN" python3 - <<'PY' || fail "Pin WEB_PAGES_ORIGIN Preview"
from pathlib import Path
import os, re
p = Path('api/wrangler.preview.toml')
s = p.read_text()
s, n = re.subn(r'^WEB_PAGES_ORIGIN = ".*"$', f'WEB_PAGES_ORIGIN = "{os.environ["WEB_ORIGIN"]}"', s, count=1, flags=re.M)
if n != 1:
    raise SystemExit('No pude actualizar WEB_PAGES_ORIGIN')
p.write_text(s)
PY
run git add api/wrangler.preview.toml
if ! git diff --cached --quiet; then
  run git commit -m "fix(preview): deploy web social cards with Pages Functions"
  run git push github "HEAD:$BRANCH"
fi

# Re-pin Worker para que preview.intaprd.com use el nuevo Web Pages origin.
echo ""
echo "▶ Deploy Worker SOLO Preview"
WORKER_LOG="$LOG_DIR/worker-$(date +%Y%m%d-%H%M%S).log"
(cd api && npx wrangler deploy --config wrangler.preview.toml) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Preview"
WORKER_VERSION="$(grep -E 'Current Version ID:' "$WORKER_LOG" | tail -1 | sed -E 's/.*Current Version ID:[[:space:]]*//')"

for url in \
  "https://preview.intaprd.com/invitacion" \
  "https://app.preview.intaprd.com/admin/free/account" \
  "https://app.preview.intaprd.com/admin/free/notifications"; do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
  echo "✓ $url -> HTTP 200"
done

INVITE_HTML="$(curl -sS https://preview.intaprd.com/invitacion)"
printf '%s' "$INVITE_HTML" | grep -Fq 'Te recomiendo Kawvo Link' || fail "Graph Card /invitacion sigue sin inyectarse"
printf '%s' "$INVITE_HTML" | grep -Fq 'og:image' || fail "Graph Card /invitacion no incluye imagen social"
echo "✓ Graph Card /invitacion inyectada"

# La Graph Card bancaria es dinámica por slug. Se valida la ruta middleware en código;
# la prueba física final se hace compartiendo un perfil real desde Mi cuenta.

echo ""
echo "============================================================"
echo "✓ ACCOUNT CENTER V5.1 · GRAPH CARDS PREVIEW CORREGIDAS"
echo "============================================================"
echo "Commit:         $(git rev-parse HEAD)"
echo "Web Pages:      $WEB_ORIGIN"
echo "Worker Version: ${WORKER_VERSION:-ver salida Wrangler}"
echo "Invitación:     https://preview.intaprd.com/invitacion"
echo "Mi cuenta:      https://app.preview.intaprd.com/admin/free/account"
echo "Notificaciones: https://app.preview.intaprd.com/admin/free/notifications"
echo "Producción:     NO TOCADA"
echo ""
echo "QA FÍSICO:"
echo "1) Compartir /invitacion en WhatsApp y confirmar título/imagen social."
echo "2) Desde Mi cuenta compartir Enviar enlace de cuentas y confirmar Graph Card bancaria."
echo "3) Abrir Notificaciones y Mis productos y confirmar regreso a Mi cuenta."
echo "============================================================"
