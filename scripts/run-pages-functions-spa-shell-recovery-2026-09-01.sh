#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
REMOTE="github"
BRANCH="fix/cloudflare-pages-architecture-2026-09-01"
WEB_PROJECT="intap-link"
WEB_DOMAIN="https://intaprd.com"
APP_DOMAIN="https://app.intaprd.com"
LOG_DIR="$ROOT/.pages-spa-shell-recovery-2026-09-01-logs"
mkdir -p "$LOG_DIR"

fail(){ echo "✗ $*" >&2; exit 1; }
pass(){ echo "✓ $*"; }

cd "$ROOT" || exit 1

echo "▶ Sincronizar rama"
git fetch "$REMOTE" main "$BRANCH"
git checkout -B "$BRANCH" "$REMOTE/$BRANCH"
git reset --hard "$REMOTE/$BRANCH"
[ -z "$(git status --porcelain)" ] || fail "El árbol de trabajo no está limpio"

echo "▶ Aplicar corrección estructural SPA en Pages Functions"
python3 scripts/apply-pages-functions-spa-shell-fix-2026-09-01.py
git diff --check

grep -q "ASSETS" functions/_middleware.ts || fail "No quedó binding ASSETS en middleware"
grep -q "fetchSpaShell" functions/_middleware.ts || fail "No quedó helper SPA shell"
grep -q "isHtmlNavigation" functions/_middleware.ts || fail "No quedó fallback de navegación HTML"

echo "▶ Contratos Demo IA"
node scripts/test-demo-ai-contract.mjs
node scripts/test-demo-ai-product-v1_5.mjs
node scripts/test-demo-ai-product-v1_6.mjs

echo "▶ Build WEB"
npm --prefix web run build
WEB_LOCAL_BUNDLE="$(grep -Eo '/assets/index-[A-Za-z0-9_-]+\.js' web/dist/index.html | head -1)"
[ -n "$WEB_LOCAL_BUNDLE" ] || fail "No pude detectar bundle WEB"
grep -q 'rel="icon"' web/dist/index.html || fail "Favicon ausente del build WEB"
pass "WEB bundle local: $WEB_LOCAL_BUNDLE"

echo "▶ Commit de la corrección"
git add functions/_middleware.ts scripts/apply-pages-functions-spa-shell-fix-2026-09-01.py scripts/run-pages-functions-spa-shell-recovery-2026-09-01.sh
if ! git diff --cached --quiet; then
  git commit -m "fix(web): make Pages Functions serve SPA shell explicitly"
  git push "$REMOTE" HEAD:"$BRANCH"
fi
FIX_SHA="$(git rev-parse HEAD)"
pass "Fix SHA: $FIX_SHA"

echo "▶ Promover por fast-forward a main"
git fetch "$REMOTE" main "$BRANCH"
git checkout -B main "$REMOTE/main"
git merge --ff-only "$REMOTE/$BRANCH"
git push "$REMOTE" main
MAIN_SHA="$(git rev-parse HEAD)"
pass "Main SHA: $MAIN_SHA"

echo "▶ Deploy WEB al proyecto propietario: $WEB_PROJECT"
WEB_LOG="$LOG_DIR/web-pages-production.log"
(
  npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch main --commit-dirty=true
) 2>&1 | tee "$WEB_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy WEB Pages"
WEB_IMMUTABLE="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$WEB_LOG" | tail -1)"
[ -n "$WEB_IMMUTABLE" ] || fail "No pude identificar deployment inmutable WEB"

echo "▶ Validar raíz y rutas SPA en deployment inmutable"
IMM_ROOT="$(curl -fsS --max-time 30 "$WEB_IMMUTABLE/?qa=$(date +%s)")"
IMM_DEMO="$(curl -fsS --max-time 30 "$WEB_IMMUTABLE/demo/ia?qa=$(date +%s)")"
IMM_BUNDLE="$(printf '%s' "$IMM_DEMO" | grep -Eo '/assets/index-[A-Za-z0-9_-]+\.js' | head -1)"
[ "$IMM_BUNDLE" = "$WEB_LOCAL_BUNDLE" ] || fail "Bundle inmutable no coincide: remoto=$IMM_BUNDLE local=$WEB_LOCAL_BUNDLE"
printf '%s' "$IMM_DEMO" | grep -q 'rel="icon"' || fail "Favicon ausente en /demo/ia inmutable"
pass "Deployment inmutable sirve /demo/ia correctamente: $WEB_IMMUTABLE"

echo "▶ Esperar promoción de intaprd.com"
WEB_OK=0
for i in $(seq 1 24); do
  HTML="$(curl -fsS --max-time 20 "$WEB_DOMAIN/demo/ia?qa=$(date +%s)-$i" 2>/dev/null || true)"
  REMOTE_BUNDLE="$(printf '%s' "$HTML" | grep -Eo '/assets/index-[A-Za-z0-9_-]+\.js' | head -1 || true)"
  echo "  intento $i/24 · web=$REMOTE_BUNDLE"
  if [ "$REMOTE_BUNDLE" = "$WEB_LOCAL_BUNDLE" ]; then WEB_OK=1; break; fi
  sleep 10
done
[ "$WEB_OK" -eq 1 ] || fail "intaprd.com no sirve el bundle WEB esperado $WEB_LOCAL_BUNDLE"

echo "▶ Smoke + E2E"
for path in / /demo /demo/ia; do
  CODE="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "$WEB_DOMAIN$path")"
  [ "$CODE" = "200" ] || fail "$path respondió HTTP $CODE"
done
APP_CODE="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "$APP_DOMAIN/admin/login")"
[ "$APP_CODE" = "200" ] || fail "APP login respondió HTTP $APP_CODE"
curl -fsS --max-time 20 "$WEB_DOMAIN/demo/ia?favicon=$(date +%s)" | grep -q 'rel="icon"' || fail "Favicon ausente en Producción"
env PREVIEW_BASE="$WEB_DOMAIN" node scripts/qa-demo-ai-preview.mjs

TAG="prod-pages-spa-shell-2026-09-01-$(date +%H%M%S)"
git tag -a "$TAG" -m "Pages SPA shell and ownership normalized 2026-09-01"
git push "$REMOTE" "$TAG"

echo "============================================================"
echo "✓ KAWVO LINK · PAGES + SPA NORMALIZADO"
echo "============================================================"
echo "Main SHA:    $MAIN_SHA"
echo "Release tag: $TAG"
echo "WEB deploy:  $WEB_IMMUTABLE"
echo "WEB domain:  $WEB_DOMAIN"
echo "APP domain:  $APP_DOMAIN"
echo "Demo IA:     $WEB_DOMAIN/demo/ia"
echo "QA:          APROBADO"
echo "============================================================"
