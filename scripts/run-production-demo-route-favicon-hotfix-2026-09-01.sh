#!/usr/bin/env bash
set -euo pipefail

BRANCH="hotfix/demo-ai-route-favicon-2026-09-01"
REPO="github"
PROJECT="intap-web2"
BASE="https://intaprd.com"

echo "▶ Sincronizar hotfix"
git fetch "$REPO" main "$BRANCH"
git checkout -B "$BRANCH" "$REPO/$BRANCH"
git reset --hard "$REPO/$BRANCH"

echo "▶ Aplicar hotfix de rutas Demo + favicon"
python3 scripts/apply-demo-route-cache-favicon-hotfix.py

echo "▶ Validaciones estáticas"
git diff --check
grep -q 'path="/demo/ia"' web/src/App.tsx
grep -q '^/demo/\*$' web/public/_headers
grep -q '^/demo$' web/public/_headers
grep -q 'rel="icon" type="image/png" href="/assets/og/kawvo-link-og.png"' web/index.html

echo "▶ Contratos Demo IA"
node scripts/test-demo-ai-contract.mjs
node scripts/test-demo-ai-product-v1_5.mjs
node scripts/test-demo-ai-product-v1_6.mjs

echo "▶ Build Web Producción"
(cd web && npm run build)

LOCAL_BUNDLE=$(grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' web/dist/index.html | head -1)
test -n "$LOCAL_BUNDLE"
grep -q '/assets/og/kawvo-link-og.png' web/dist/index.html

echo "▶ Commit hotfix"
git add web/public/_headers web/index.html scripts/apply-demo-route-cache-favicon-hotfix.py scripts/run-production-demo-route-favicon-hotfix-2026-09-01.sh
if ! git diff --cached --quiet; then
  git commit -m "hotfix(web): refresh demo SPA routes and Kawvo favicon"
  git push "$REPO" HEAD:"$BRANCH"
fi

HOTFIX_SHA=$(git rev-parse HEAD)

echo "▶ Promover hotfix a main"
git fetch "$REPO" main "$BRANCH"
git checkout -B main "$REPO/main"
git merge --ff-only "$REPO/$BRANCH"
git push "$REPO" main

echo "▶ Deploy Web Producción"
npx wrangler pages deploy web/dist --project-name "$PROJECT" --branch main

echo "▶ Verificar rutas, bundle y favicon en Producción"
for path in /demo /demo/ia; do
  code=$(curl -sS -o /tmp/kawvo-demo-page.html -w '%{http_code}' "$BASE$path?release=$HOTFIX_SHA")
  test "$code" = "200"
  REMOTE_BUNDLE=$(grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' /tmp/kawvo-demo-page.html | head -1)
  if [ "$REMOTE_BUNDLE" != "$LOCAL_BUNDLE" ]; then
    echo "✗ Bundle remoto no coincide en $path: remoto=$REMOTE_BUNDLE local=$LOCAL_BUNDLE" >&2
    exit 1
  fi
  grep -q '/assets/og/kawvo-link-og.png' /tmp/kawvo-demo-page.html
  echo "✓ $BASE$path -> 200 y bundle actual"
done

HEADERS=$(curl -sSI "$BASE/demo/ia?release=$HOTFIX_SHA")
echo "$HEADERS" | grep -qi 'cache-control:.*no-cache'
echo "$HEADERS" | grep -qi 'cache-control:.*no-store'

FAVICON_CODE=$(curl -sS -o /dev/null -w '%{http_code}' "$BASE/assets/og/kawvo-link-og.png")
test "$FAVICON_CODE" = "200"

echo "▶ QA funcional Demo IA Producción"
env PREVIEW_BASE="$BASE" node scripts/qa-demo-ai-preview.mjs

TAG="prod-demo-route-favicon-hotfix-$(date +%Y-%m-%d-%H%M%S)"
git tag -a "$TAG" -m "Kawvo Demo route + favicon hotfix 2026-09-01"
git push "$REPO" "$TAG"

echo "============================================================"
echo "✓ KAWVO · HOTFIX DEMO IA + FAVICON · PRODUCCIÓN CERRADA"
echo "============================================================"
echo "Production SHA: $(git rev-parse HEAD)"
echo "Release tag:    $TAG"
echo "Bundle:         $LOCAL_BUNDLE"
echo "Demo:           $BASE/demo"
echo "Demo IA:        $BASE/demo/ia"
echo "Favicon:        $BASE/assets/og/kawvo-link-og.png"
echo "============================================================"
