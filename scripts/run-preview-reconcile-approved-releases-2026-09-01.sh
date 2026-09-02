#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="fix/restore-approved-location-ux-2026-09-02"
APP_PROJECT="intap-web2"
WEB_PROJECT="intap-link"
LOG_DIR="$ROOT/.preview-reconcile-approved-2026-09-02-logs"
WRANGLER_BACKUP=""

fail() { echo ""; echo "✗ ERROR: $1"; echo "Producción NO fue tocada."; exit 1; }
run() { echo ""; echo "▶ $*"; "$@" || fail "$*"; }
cleanup() {
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

run git diff --check

printf '\n▶ Validando contratos reconciliados\n'
grep -Fq 'path="/admin/free/account"' app/src/App.tsx || fail "Falta Mi cuenta"
grep -Fq 'path="/admin/free/notifications"' app/src/App.tsx || fail "Falta Notificaciones"
grep -Fq 'path="/admin/free/home"' app/src/App.tsx || fail "Falta Home PWA"
grep -Fq 'path="/superadmin/resources"' app/src/App.tsx || fail "Falta Recursos SuperAdmin"
grep -Fq 'element={<FreeOnboardingWelcome />}' app/src/App.tsx || fail "Bienvenida no está simplificada"
grep -Fq 'path="/admin/free/onboarding/product" element={<Navigate to="/admin/free/onboarding/welcome" replace />}' app/src/App.tsx || fail "Ruta product legacy no está retirada"
grep -Fq 'path="/admin/free/onboarding/bootstrap" element={<Navigate to="/admin/free/onboarding/welcome" replace />}' app/src/App.tsx || fail "Ruta bootstrap legacy no está retirada"
grep -Fq "apiPost('/me/profile/delete'" app/src/components/admin/free/FreeProfileDangerZone.tsx || fail "Falta eliminación mobile-safe"
grep -Fq 'Verificando la eliminación' app/src/components/admin/free/FreeProfileDangerZone.tsx || fail "Falta verificación posterior a eliminación"
grep -Fq "import './preview-profile-delete-mobile'" api/src/preview-free-entry.ts || fail "Endpoint de eliminación no está ensamblado"
grep -Fq "import './account-center'" api/src/preview-free-entry.ts || fail "Account Center API no está ensamblado"
grep -Fq 'image_url' api/src/preview-support-tickets.ts || fail "API de notificaciones no expone imágenes"
grep -Fq 'isMobileContactFlow' web/src/components/free-profile/IntapLinkGratisProfile.tsx || fail "Falta vCard móvil"
grep -Fq "const realLocation = readString(contact, 'map_url')" web/src/components/free-profile/IntapLinkGratis.adapter.ts || fail "Ubicación no usa mapa canónico"
grep -Fq "apiGet('/me/contact')" app/src/components/admin/free/FreeQuickActions.tsx || fail "Panel no sincroniza ubicación canónica"
grep -Fq "url.pathname === '/invitacion'" functions/_middleware.ts || fail "Falta Graph Card de invitación"
grep -Fq 'share=bancos: social card bancaria' functions/_middleware.ts || fail "Falta Graph Card bancaria server-side"
grep -Fq '?share=bancos#bancos' web/src/components/free-profile/PublicBankAccounts.tsx || fail "El perfil público no activa la Graph Card bancaria al compartir"
grep -Fq 'Enviar por WhatsApp' web/src/components/free-profile/PublicBankAccounts.tsx || fail "Falta compartir cuentas por WhatsApp"
grep -Fq 'Copiar enlace' web/src/components/free-profile/PublicBankAccounts.tsx || fail "Falta copiar enlace de cuentas"
grep -Fq '?share=bancos#bancos' app/src/components/admin/free/FreeAccount.tsx || fail "Mi cuenta no comparte la URL bancaria canónica"
grep -Fq 'getDynamicProfileSeoBundle' functions/_middleware.ts || fail "Falta metadata dinámica de perfiles"
grep -Fq 'path="/demo/ia"' web/src/App.tsx || fail "Demo IA desapareció durante reconciliación"
grep -Fq 'registerDemoAiRoutes(app)' api/src/preview-free-entry.ts || fail "Demo IA API desapareció durante reconciliación"
[ -f app/public/manifest.webmanifest ] || fail "Falta manifest PWA"
[ -f app/public/sw.js ] || fail "Falta service worker PWA"
echo "✓ Contratos de reconciliación presentes"

printf '\n▶ Build App Preview\n'
(cd app && npx tsc && npx vite build --mode preview) || fail "Build App Preview"

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

printf '\n▶ Smoke Preview\n'
for url in \
  "https://app.preview.intaprd.com/admin/free" \
  "https://app.preview.intaprd.com/admin/free/home" \
  "https://app.preview.intaprd.com/admin/free/account" \
  "https://app.preview.intaprd.com/admin/free/notifications" \
  "https://app.preview.intaprd.com/admin/artifacts?from=account" \
  "https://preview.intaprd.com/demo" \
  "https://preview.intaprd.com/demo/ia" \
  "https://preview.intaprd.com/invitacion" \
  "https://preview.intaprd.com/robots.txt" \
  "https://preview.intaprd.com/sitemap.xml" \
  "https://preview.intaprd.com/llms.txt"; do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
  echo "✓ $url -> HTTP 200"
done

INVITE_HTML="$(curl -sS 'https://preview.intaprd.com/invitacion?qa=reconcile')"
printf '%s' "$INVITE_HTML" | grep -Fq 'Te recomiendo Kawvo Link' || fail "Graph Card /invitacion no está activa"
echo "✓ Graph Card invitación activa"

DEMO_HTML="$(curl -sS 'https://preview.intaprd.com/demo/ia?qa=reconcile')"
printf '%s' "$DEMO_HTML" | grep -Fq '/assets/index-' || fail "Demo IA no devuelve shell web"
echo "✓ Demo IA conserva shell web"

cleanup
WRANGLER_BACKUP=""
run git status --short

printf '\n============================================================\n'
printf '✓ AUDITORÍA INTEGRAL · PREVIEW DESPLEGADO\n'
printf '============================================================\n'
echo "Commit rama:    $(git rev-parse HEAD)"
echo "App Pages:      $APP_ORIGIN"
echo "Web Pages:      $WEB_ORIGIN"
echo "Worker Version: ${WORKER_VERSION:-ver salida Wrangler}"
echo "Producción:     NO TOCADA"
echo ""
echo "QA VISUAL/FUNCIONAL PENDIENTE:"
echo "1) Mi cuenta: avatar, plan, QR preview, invitación, bancos, productos, soporte y cerrar sesión."
echo "2) Perfil: compartir perfil y confirmar Graph Card."
echo "3) Bancos: desde perfil y Mi cuenta, compartir por WhatsApp y confirmar Graph Card bancaria."
echo "4) Notificaciones: lista, sin leer, detalle, imagen, ticket inline, marcar y eliminar."
echo "5) Eliminación: SOLO con cuenta/perfil desechable; verificar pantalla final y bienvenida."
echo "6) Ubicación: cambiar Mapa y confirmar que el botón Ubicación usa el mismo destino."
echo "7) Guardar contacto: probar iPhone/Android y escritorio."
echo "8) Scan-to-Claim/onboarding: activar producto de prueba y confirmar continuidad."
echo "9) Editor visual, bancos, servicios, portafolio, imágenes y límites Free."
echo "10) Asistente IA: generar, revisar y aplicar sin publicar ni alterar estructura."
echo "11) Demo IA completa y compartir snapshot."
echo "12) GEO/SEO: robots, sitemap, llms, ai.md/facts.json y perfiles especiales."
echo "============================================================"
