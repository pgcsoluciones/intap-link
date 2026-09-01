#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
REMOTE="github"
BRANCH="fix/cloudflare-pages-architecture-2026-09-01"
WEB_PROJECT="intap-link"
APP_PROJECT="intap-web2"
WEB_DOMAIN="https://intaprd.com"
APP_DOMAIN="https://app.intaprd.com"
LOG_DIR="$ROOT/.cloudflare-pages-normalization-2026-09-01-logs"
mkdir -p "$LOG_DIR"

fail() { echo "✗ $*" >&2; exit 1; }
pass() { echo "✓ $*"; }

cd "$ROOT" || exit 1

echo "▶ Sincronizar rama de normalización"
git fetch "$REMOTE" main "$BRANCH"
git checkout -B "$BRANCH" "$REMOTE/$BRANCH"
git reset --hard "$REMOTE/$BRANCH"
[ -z "$(git status --porcelain)" ] || fail "El árbol de trabajo no está limpio"

echo "▶ Verificar mapa Cloudflare Pages"
PROJECTS_LOG="$LOG_DIR/pages-projects.txt"
(
  cd web
  npx wrangler pages project list
) 2>&1 | tee "$PROJECTS_LOG"
grep -q 'intap-link' "$PROJECTS_LOG" || fail "No aparece el proyecto intap-link"
grep -q 'intaprd.com' "$PROJECTS_LOG" || fail "No aparece intaprd.com en el inventario Pages"
grep -q 'intap-web2' "$PROJECTS_LOG" || fail "No aparece el proyecto intap-web2"
grep -q 'app.intaprd.com' "$PROJECTS_LOG" || fail "No aparece app.intaprd.com en el inventario Pages"
pass "Inventario Pages contiene los proyectos y dominios esperados"

echo "▶ Validaciones de Demo IA"
node scripts/test-demo-ai-contract.mjs
node scripts/test-demo-ai-product-v1_5.mjs
node scripts/test-demo-ai-product-v1_6.mjs

echo "▶ Build APP"
npm --prefix app run build
APP_LOCAL_BUNDLE="$(grep -Eo '/assets/index-[A-Za-z0-9_-]+\.js' app/dist/index.html | head -1)"
[ -n "$APP_LOCAL_BUNDLE" ] || fail "No pude detectar bundle principal de app"
pass "APP bundle local: $APP_LOCAL_BUNDLE"

echo "▶ Build WEB"
npm --prefix web run build
WEB_LOCAL_BUNDLE="$(grep -Eo '/assets/index-[A-Za-z0-9_-]+\.js' web/dist/index.html | head -1)"
[ -n "$WEB_LOCAL_BUNDLE" ] || fail "No pude detectar bundle principal de web"
grep -q 'rel="icon"' web/dist/index.html || fail "El build web no contiene favicon"
pass "WEB bundle local: $WEB_LOCAL_BUNDLE"

echo "▶ Promover normalización a main"
git fetch "$REMOTE" main "$BRANCH"
git checkout -B main "$REMOTE/main"
git merge --ff-only "$REMOTE/$BRANCH"
git push "$REMOTE" main
MAIN_SHA="$(git rev-parse HEAD)"
pass "main normalizado: $MAIN_SHA"

echo "▶ Restaurar APP en su proyecto propietario: $APP_PROJECT"
APP_DEPLOY_LOG="$LOG_DIR/app-pages-production.log"
(
  npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch main --commit-dirty=true
) 2>&1 | tee "$APP_DEPLOY_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy APP Pages"
APP_IMMUTABLE="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$APP_DEPLOY_LOG" | tail -1)"
[ -n "$APP_IMMUTABLE" ] || fail "No pude identificar deployment inmutable de APP"
APP_IMMUTABLE_BUNDLE="$(curl -fsS --max-time 30 "$APP_IMMUTABLE/admin/login?qa=$(date +%s)" | grep -Eo '/assets/index-[A-Za-z0-9_-]+\.js' | head -1)"
[ "$APP_IMMUTABLE_BUNDLE" = "$APP_LOCAL_BUNDLE" ] || fail "APP inmutable no coincide: remoto=$APP_IMMUTABLE_BUNDLE local=$APP_LOCAL_BUNDLE"
pass "APP inmutable correcto: $APP_IMMUTABLE"

echo "▶ Publicar WEB en su proyecto propietario: $WEB_PROJECT"
WEB_DEPLOY_LOG="$LOG_DIR/web-pages-production.log"
(
  npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch main --commit-dirty=true
) 2>&1 | tee "$WEB_DEPLOY_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy WEB Pages"
WEB_IMMUTABLE="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$WEB_DEPLOY_LOG" | tail -1)"
[ -n "$WEB_IMMUTABLE" ] || fail "No pude identificar deployment inmutable de WEB"
WEB_IMMUTABLE_BUNDLE="$(curl -fsS --max-time 30 "$WEB_IMMUTABLE/demo/ia?qa=$(date +%s)" | grep -Eo '/assets/index-[A-Za-z0-9_-]+\.js' | head -1)"
[ "$WEB_IMMUTABLE_BUNDLE" = "$WEB_LOCAL_BUNDLE" ] || fail "WEB inmutable no coincide: remoto=$WEB_IMMUTABLE_BUNDLE local=$WEB_LOCAL_BUNDLE"
pass "WEB inmutable correcto: $WEB_IMMUTABLE"

echo "▶ Esperar dominios custom con los bundles correctos"
APP_OK=0
WEB_OK=0
for i in $(seq 1 24); do
  APP_REMOTE_BUNDLE="$(curl -fsS --max-time 20 "$APP_DOMAIN/admin/login?qa=$(date +%s)-$i" 2>/dev/null | grep -Eo '/assets/index-[A-Za-z0-9_-]+\.js' | head -1 || true)"
  WEB_REMOTE_BUNDLE="$(curl -fsS --max-time 20 "$WEB_DOMAIN/demo/ia?qa=$(date +%s)-$i" 2>/dev/null | grep -Eo '/assets/index-[A-Za-z0-9_-]+\.js' | head -1 || true)"
  [ "$APP_REMOTE_BUNDLE" = "$APP_LOCAL_BUNDLE" ] && APP_OK=1 || true
  [ "$WEB_REMOTE_BUNDLE" = "$WEB_LOCAL_BUNDLE" ] && WEB_OK=1 || true
  echo "  intento $i/24 · app=$APP_REMOTE_BUNDLE · web=$WEB_REMOTE_BUNDLE"
  if [ "$APP_OK" -eq 1 ] && [ "$WEB_OK" -eq 1 ]; then break; fi
  sleep 10
done
[ "$APP_OK" -eq 1 ] || fail "app.intaprd.com no promovió el bundle APP esperado $APP_LOCAL_BUNDLE"
[ "$WEB_OK" -eq 1 ] || fail "intaprd.com no promovió el bundle WEB esperado $WEB_LOCAL_BUNDLE"
pass "Ambos dominios sirven sus builds propietarios"

echo "▶ Smoke tests de dominios"
[ "$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "$WEB_DOMAIN/")" = "200" ] || fail "Root WEB no responde 200"
[ "$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "$WEB_DOMAIN/demo")" = "200" ] || fail "/demo no responde 200"
[ "$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "$WEB_DOMAIN/demo/ia")" = "200" ] || fail "/demo/ia no responde 200"
[ "$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "$APP_DOMAIN/admin/login")" = "200" ] || fail "APP login no responde 200"
curl -fsS --max-time 20 "$WEB_DOMAIN/demo/ia?favicon=$(date +%s)" | grep -q 'rel="icon"' || fail "Favicon no está presente en HTML productivo"
pass "Rutas y favicon aprobados"

echo "▶ E2E Demo IA contra Producción"
env PREVIEW_BASE="$WEB_DOMAIN" node scripts/qa-demo-ai-preview.mjs

echo "▶ Verificar que la API sigue separada"
API_STATUS="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 https://api.intaprd.com/ || true)"
[ "$API_STATUS" != "000" ] || fail "api.intaprd.com no responde"
pass "API alcanzable (HTTP $API_STATUS); no fue redeployada por este runner"

TAG="prod-pages-architecture-normalized-2026-09-01-$(date +%H%M%S)"
git tag -a "$TAG" -m "Normalize Kawvo Link Pages ownership 2026-09-01"
git push "$REMOTE" "$TAG"

echo "============================================================"
echo "✓ KAWVO LINK · ARQUITECTURA PAGES NORMALIZADA"
echo "============================================================"
echo "Main SHA:       $MAIN_SHA"
echo "Release tag:    $TAG"
echo "WEB project:    $WEB_PROJECT"
echo "WEB deploy:     $WEB_IMMUTABLE"
echo "WEB domain:     $WEB_DOMAIN"
echo "APP project:    $APP_PROJECT"
echo "APP deploy:     $APP_IMMUTABLE"
echo "APP domain:     $APP_DOMAIN"
echo "Demo IA:        $WEB_DOMAIN/demo/ia"
echo "QA:             APROBADO"
echo "============================================================"
