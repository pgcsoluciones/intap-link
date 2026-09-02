#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="fix/restore-approved-location-ux-2026-09-02"
APP_PROJECT="intap-web2"
WEB_PROJECT="intap-link"
LOG_DIR="$ROOT/.preview-deep-final-2026-09-02-logs"
WRANGLER_BACKUP=""

fail(){ echo; echo "✗ ERROR: $1"; echo "Producción NO fue tocada."; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }
cleanup(){
  if [ -n "$WRANGLER_BACKUP" ] && [ -f "$WRANGLER_BACKUP" ]; then
    cp "$WRANGLER_BACKUP" "$ROOT/api/wrangler.preview.toml" || true
    rm -f "$WRANGLER_BACKUP" || true
  fi
}
trap cleanup EXIT

cd "$ROOT" || fail "No existe $ROOT"
mkdir -p "$LOG_DIR"

run git fetch github "$BRANCH"
run git checkout -B "$BRANCH" "github/$BRANCH"
run git reset --hard "github/$BRANCH"

printf '\n▶ Aplicando últimos hallazgos de auditoría\n'
python3 scripts/apply-final-editor-and-preview-origin-recovery-2026-09-02.py || fail "Aplicar últimos hallazgos"

if [ -n "$(git status --porcelain)" ]; then
  run git add app/src/components/admin/free/FreeVisualEditor.tsx app/src/components/admin/free/FreeAccount.tsx app/src/components/admin/free/onboarding/FreeStarterNativePreview.tsx app/src/components/admin/free/onboarding/FreeOnboardingBuilder.tsx
  run git commit -m "fix(audit): close final approved-state regressions"
  run git push github HEAD:"$BRANCH"
fi

run git diff --check
run bash scripts/audit-approved-recovery-ui-2026-09-02.sh
run bash scripts/audit-approved-recovery-deep-final-2026-09-02.sh

printf '\n▶ Pruebas de contratos IA\n'
run node scripts/test-ai-profile-assistant-contract.mjs
run node scripts/test-ai-profile-assistant-integration.mjs

printf '\n▶ Pruebas de contratos Demo IA\n'
run node scripts/test-demo-ai-contract.mjs
run node scripts/test-demo-ai-product-v1_4.mjs
run node scripts/test-demo-ai-product-v1_5.mjs
run node scripts/test-demo-ai-product-v1_6.mjs

printf '\n▶ Build App Preview\n'
(cd app && npx tsc && npx vite build --mode preview) || fail "Build App Preview"

printf '\n▶ Validando paquete PWA en dist\n'
[ -f app/dist/manifest.webmanifest ] || fail "manifest.webmanifest no llegó al build"
[ -f app/dist/sw.js ] || fail "sw.js no llegó al build"
[ -f app/dist/kawvo-icon-192.png ] || fail "icono PWA no llegó al build"

grep -Fq '"start_url": "/admin/free/home?source=pwa"' app/dist/manifest.webmanifest || fail "Manifest build start_url incorrecto"

printf '\n▶ Build Web Preview\n'
(cd web && npm run build) || fail "Build Web Preview"

printf '\n▶ TypeScript API Preview\n'
(cd api && npx tsc --noEmit) || fail "TypeScript API Preview"

printf '\n▶ Migraciones D1 SOLO Preview\n'
(cd api && npx wrangler d1 migrations apply intap_db_preview --remote --config wrangler.preview.toml) || fail "Migraciones D1 Preview"

printf '\n▶ Dry-run Worker Preview\n'
(cd api && npx wrangler deploy --config wrangler.preview.toml --dry-run) || fail "Dry-run Worker Preview"

printf '\n▶ Deploy App SOLO Preview → intap-web2\n'
APP_LOG="$LOG_DIR/app-pages-$(date +%Y%m%d-%H%M%S).log"
(cd api && npx wrangler pages deploy ../app/dist --project-name "$APP_PROJECT" --branch "$BRANCH") 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App Preview"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$APP_LOG" | tail -1)"
[ -n "$APP_ORIGIN" ] || fail "No pude identificar APP_PAGES_ORIGIN"
echo "✓ APP_PAGES_ORIGIN=$APP_ORIGIN"

printf '\n▶ Deploy Web SOLO Preview → intap-link\n'
WEB_LOG="$LOG_DIR/web-pages-$(date +%Y%m%d-%H%M%S).log"
(cd web && npx wrangler pages deploy dist --project-name "$WEB_PROJECT" --branch "$BRANCH") 2>&1 | tee "$WEB_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Web Preview"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$WEB_LOG" | tail -1)"
[ -n "$WEB_ORIGIN" ] || fail "No pude identificar WEB_PAGES_ORIGIN"
echo "✓ WEB_PAGES_ORIGIN=$WEB_ORIGIN"

WRANGLER_BACKUP="$(mktemp)"
cp api/wrangler.preview.toml "$WRANGLER_BACKUP"
APP_ORIGIN="$APP_ORIGIN" WEB_ORIGIN="$WEB_ORIGIN" python3 - <<'PY' || fail "Actualizar origins temporales Preview"
from pathlib import Path
import os, re
p = Path('api/wrangler.preview.toml')
s = p.read_text()
s, a = re.subn(r'^APP_PAGES_ORIGIN = ".*"$', f'APP_PAGES_ORIGIN = "{os.environ["APP_ORIGIN"]}"', s, count=1, flags=re.M)
s, w = re.subn(r'^WEB_PAGES_ORIGIN = ".*"$', f'WEB_PAGES_ORIGIN = "{os.environ["WEB_ORIGIN"]}"', s, count=1, flags=re.M)
if a != 1 or w != 1:
    raise SystemExit('No pude actualizar APP_PAGES_ORIGIN/WEB_PAGES_ORIGIN')
p.write_text(s)
PY

printf '\n▶ Deploy Worker SOLO Preview\n'
WORKER_LOG="$LOG_DIR/worker-$(date +%Y%m%d-%H%M%S).log"
(cd api && npx wrangler deploy --config wrangler.preview.toml) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Preview"
WORKER_VERSION="$(grep -E 'Current Version ID:' "$WORKER_LOG" | tail -1 | sed -E 's/.*Current Version ID:[[:space:]]*//')"

printf '\n▶ Smokes integrales Preview\n'
for url in \
  'https://app.preview.intaprd.com/admin/free' \
  'https://app.preview.intaprd.com/admin/free/home' \
  'https://app.preview.intaprd.com/admin/free/account' \
  'https://app.preview.intaprd.com/admin/free/notifications' \
  'https://app.preview.intaprd.com/admin/free/editor' \
  'https://app.preview.intaprd.com/admin/free/ai-profile' \
  'https://app.preview.intaprd.com/admin/free/location' \
  'https://app.preview.intaprd.com/admin/free/bank-accounts' \
  'https://app.preview.intaprd.com/manifest.webmanifest' \
  'https://app.preview.intaprd.com/sw.js' \
  'https://app.preview.intaprd.com/kawvo-icon-192.png' \
  'https://preview.intaprd.com/' \
  'https://preview.intaprd.com/demo' \
  'https://preview.intaprd.com/demo/ia' \
  'https://preview.intaprd.com/invitacion' \
  'https://preview.intaprd.com/robots.txt' \
  'https://preview.intaprd.com/sitemap.xml' \
  'https://preview.intaprd.com/llms.txt' \
  'https://preview.intaprd.com/ai.md' \
  'https://preview.intaprd.com/facts.json'; do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  [ "$code" = '200' ] || fail "$url respondió HTTP $code"
  echo "✓ $url -> HTTP 200"
done

printf '\n▶ Validando manifest remoto\n'
curl -sS 'https://app.preview.intaprd.com/manifest.webmanifest' | grep -Fq '"start_url": "/admin/free/home?source=pwa"' || fail "Manifest remoto incorrecto"
echo '✓ Manifest remoto PWA correcto'

printf '\n▶ Validando Graph Card invitación\n'
INVITE_HTML="$(curl -sS 'https://preview.intaprd.com/invitacion?de=QA')"
printf '%s' "$INVITE_HTML" | grep -Fq 'Te recomiendo Kawvo Link' || fail "Graph Card invitación no está activa"
echo '✓ Graph Card invitación activa'

printf '\n▶ Validando Marbella/R2\n'
PDF_URL='https://preview.intaprd.com/api/v1/public/assets/rentaord/MARBELLA-BOAT.pdf'
PDF_HEADERS="$LOG_DIR/marbella-headers.txt"
PDF_FILE="$LOG_DIR/MARBELLA-BOAT.pdf"
curl -sS -L -D "$PDF_HEADERS" -o "$PDF_FILE" "$PDF_URL" || fail "Descargar Marbella desde R2"
PDF_CODE="$(awk 'toupper($1) ~ /^HTTP\// {code=$2} END{print code}' "$PDF_HEADERS")"
[ "$PDF_CODE" = '200' ] || fail "Marbella respondió HTTP ${PDF_CODE:-desconocido}"
PDF_SIZE="$(wc -c < "$PDF_FILE" | tr -d ' ')"
[ "$PDF_SIZE" -gt 1000 ] || fail "Marbella llegó vacío o incompleto ($PDF_SIZE bytes)"
head -c 4 "$PDF_FILE" | grep -Fq '%PDF' || fail "Marbella no parece PDF"
echo "✓ Marbella/R2 -> HTTP 200 · $PDF_SIZE bytes · PDF válido"

printf '\n▶ QA E2E Demo IA sobre Preview custom domain\n'
PREVIEW_BASE='https://preview.intaprd.com' node scripts/qa-demo-ai-preview.mjs || fail "QA E2E Demo IA"

cleanup
WRANGLER_BACKUP=""
run git status --short

printf '\n============================================================\n'
printf '✓ AUDITORÍA PROFUNDA FINAL · PREVIEW TÉCNICO APROBADO\n'
printf '============================================================\n'
echo "Commit rama:    $(git rev-parse HEAD)"
echo "App Pages:      $APP_ORIGIN"
echo "Web Pages:      $WEB_ORIGIN"
echo "Worker Version: ${WORKER_VERSION:-ver salida Wrangler}"
echo "Producción:     NO TOCADA"
echo
echo 'PENDIENTE SOLO QA VISUAL/FUNCIONAL HUMANO:'
echo '1) Mi cuenta: PWA, invitación personalizada, QR, bancos, productos, soporte, logout.'
echo '2) Editor móvil: Editar ↔ Vista previa y retorno exacto al punto de edición.'
echo '3) Foto y portada desde editor: guardar y permanecer en modo edición.'
echo '4) Ubicación: búsqueda inline, usar ubicación actual y guardar destino.'
echo '5) Compartir perfil/bancos/invitación desde un teléfono real.'
echo '6) vCard móvil.'
echo '7) Scan-to-Claim SOLO con producto desechable.'
echo '8) Eliminación SOLO con perfil/cuenta desechable.'
echo '9) Plantillas especiales: inspección visual de perfiles protegidos.'
echo '============================================================'
