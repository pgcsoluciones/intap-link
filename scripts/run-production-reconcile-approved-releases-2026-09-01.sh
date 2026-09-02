#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
APP_PROJECT="intap-web2"
WEB_PROJECT="intap-link"
LOG_DIR="$ROOT/.production-reconcile-approved-2026-09-01-logs"
EXPECTED_MAIN_HEAD="__EXPECTED_MAIN_HEAD__"

fail() { echo ""; echo "✗ ERROR: $1"; exit 1; }
run() { echo ""; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
mkdir -p "$LOG_DIR"

printf '\n▶ Sincronizando main autorizado\n'
run git fetch github main
run git checkout main
run git reset --hard github/main

CURRENT_HEAD="$(git rev-parse HEAD)"
if [ "$EXPECTED_MAIN_HEAD" != "__EXPECTED_MAIN_HEAD__" ] && [ "$CURRENT_HEAD" != "$EXPECTED_MAIN_HEAD" ]; then
  fail "main cambió después de autorizar Producción. Esperado $EXPECTED_MAIN_HEAD, actual $CURRENT_HEAD"
fi

[ -z "$(git status --porcelain)" ] || fail "El árbol de trabajo no está limpio"

printf '\n▶ Validando contratos críticos antes de Producción\n'
grep -Fq 'path="/admin/free/account"' app/src/App.tsx || fail "Falta Mi cuenta"
grep -Fq 'path="/admin/free/notifications"' app/src/App.tsx || fail "Falta Notificaciones"
grep -Fq 'path="/admin/free/home"' app/src/App.tsx || fail "Falta Home PWA"
grep -Fq 'path="/superadmin/resources"' app/src/App.tsx || fail "Falta Recursos SuperAdmin"
grep -Fq "apiPost('/me/profile/delete'" app/src/components/admin/free/FreeProfileDangerZone.tsx || fail "Falta eliminación mobile-safe"
grep -Fq 'isMobileContactFlow' web/src/components/free-profile/IntapLinkGratisProfile.tsx || fail "Falta vCard móvil"
grep -Fq "const realLocation = readString(contact, 'map_url')" web/src/components/free-profile/IntapLinkGratis.adapter.ts || fail "Falta ubicación canónica"
grep -Fq 'path="/demo/ia"' web/src/App.tsx || fail "Falta Demo IA"
grep -Fq 'href="/demo/ia"' web/src/components/marketing/MarketingLanding.tsx || fail "CTA de Demo no apunta a /demo/ia"
if grep -Fq 'href="#demo"' web/src/components/marketing/MarketingLanding.tsx; then fail "Quedan CTA de Demo apuntando a #demo"; fi
[ -f app/public/manifest.webmanifest ] || fail "Falta manifest PWA"
[ -f app/public/sw.js ] || fail "Falta service worker PWA"
[ -f app/public/kawvo-icon-192.png ] || fail "Falta icono PWA"
grep -Fq 'rel="manifest" href="/manifest.webmanifest"' app/index.html || fail "App no enlaza manifest"
grep -Fq 'app.intaprd.com/admin/free/home' app/src/components/admin/free/FreeAccount.tsx || true

echo "✓ Contratos críticos presentes"

printf '\n▶ Build App Producción\n'
(cd app && npx tsc && npx vite build --mode production) || fail "Build App Producción"

printf '\n▶ Build Web Producción\n'
(cd web && npm run build) || fail "Build Web Producción"

printf '\n▶ TypeScript API Producción\n'
(cd api && npx tsc --noEmit) || fail "TypeScript API Producción"

printf '\n▶ Validando artefactos PWA en build\n'
[ -f app/dist/manifest.webmanifest ] || fail "manifest no llegó a dist"
[ -f app/dist/sw.js ] || fail "sw.js no llegó a dist"
[ -f app/dist/kawvo-icon-192.png ] || fail "icono PWA no llegó a dist"
echo "✓ Artefactos PWA presentes"

printf '\n▶ Migraciones D1 Producción\n'
(cd api && npx wrangler d1 migrations apply intap_db --remote --config wrangler.toml) || fail "Migraciones D1 Producción"

printf '\n▶ Dry-run Worker Producción\n'
(cd api && npx wrangler deploy --config wrangler.toml --dry-run) || fail "Dry-run Worker Producción"

printf '\n▶ Deploy App Producción → intap-web2\n'
APP_LOG="$LOG_DIR/app-pages-$(date +%Y%m%d-%H%M%S).log"
(cd api && npx wrangler pages deploy ../app/dist --project-name "$APP_PROJECT" --branch main) 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App Producción"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$APP_LOG" | tail -1)"
[ -n "$APP_ORIGIN" ] || fail "No pude identificar App Pages Producción"
echo "✓ App Pages Producción=$APP_ORIGIN"

printf '\n▶ Deploy Web Producción → intap-link\n'
WEB_LOG="$LOG_DIR/web-pages-$(date +%Y%m%d-%H%M%S).log"
(cd web && npx wrangler pages deploy dist --project-name "$WEB_PROJECT" --branch main) 2>&1 | tee "$WEB_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Web Producción"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$WEB_LOG" | tail -1)"
[ -n "$WEB_ORIGIN" ] || fail "No pude identificar Web Pages Producción"
echo "✓ Web Pages Producción=$WEB_ORIGIN"

printf '\n▶ Deploy Worker Producción\n'
WORKER_LOG="$LOG_DIR/worker-$(date +%Y%m%d-%H%M%S).log"
(cd api && npx wrangler deploy --config wrangler.toml) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Producción"
WORKER_VERSION="$(grep -E 'Current Version ID:' "$WORKER_LOG" | tail -1 | sed -E 's/.*Current Version ID:[[:space:]]*//')"

printf '\n▶ Smoke Producción\n'
for url in \
  "https://app.intaprd.com/admin/free" \
  "https://app.intaprd.com/admin/free/home" \
  "https://app.intaprd.com/admin/free/account" \
  "https://app.intaprd.com/admin/free/notifications" \
  "https://app.intaprd.com/manifest.webmanifest" \
  "https://app.intaprd.com/sw.js" \
  "https://app.intaprd.com/kawvo-icon-192.png" \
  "https://intaprd.com/" \
  "https://intaprd.com/demo/ia" \
  "https://intaprd.com/invitacion"; do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
  echo "✓ $url -> HTTP 200"
done

MANIFEST="$(curl -sS https://app.intaprd.com/manifest.webmanifest)"
printf '%s' "$MANIFEST" | grep -Fq '"start_url": "/admin/free/home?source=pwa"' || fail "Manifest productivo no tiene start_url esperado"
echo "✓ Manifest productivo correcto"

HOME_HTML="$(curl -sS https://intaprd.com/)"
printf '%s' "$HOME_HTML" | grep -Fq '/assets/index-' || fail "Landing productiva no devuelve shell web"
DEMO_HTML="$(curl -sS https://intaprd.com/demo/ia)"
printf '%s' "$DEMO_HTML" | grep -Fq '/assets/index-' || fail "Demo IA productiva no devuelve shell web"
echo "✓ Landing y Demo IA conservan shell web"

TAG="prod-reconcile-approved-$(date +%Y-%m-%d-%H%M%S)"
run git tag "$TAG"
run git push github "$TAG"

printf '\n============================================================\n'
printf '✓ RECONCILIACIÓN APROBADA · PRODUCCIÓN DESPLEGADA\n'
printf '============================================================\n'
echo "Main SHA:       $CURRENT_HEAD"
echo "Tag:            $TAG"
echo "App Pages:      $APP_ORIGIN"
echo "Web Pages:      $WEB_ORIGIN"
echo "Worker Version: ${WORKER_VERSION:-ver salida Wrangler}"
echo ""
echo "VALIDAR AHORA:"
echo "1) Mi cuenta y Notificaciones."
echo "2) Instalar app Kawvo desde https://app.intaprd.com/admin/free/home"
echo "3) Abrir icono instalado y confirmar /admin/free/home?source=pwa."
echo "4) Landing: CTA Demo → https://intaprd.com/demo/ia"
echo "5) Demo IA completa."
echo "============================================================"
