#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
WEB_PROJECT="intap-web2"
PRODUCTION_BRANCH="main"
PROD_BASE="https://intaprd.com"
LOG_DIR="$ROOT/.production-demo-pages-recovery-2026-09-01-logs"
mkdir -p "$LOG_DIR"

fail(){ echo "✗ ERROR: $*" >&2; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || exit 1

echo "▶ Sincronizar main"
git fetch github main
git checkout -B main github/main
git reset --hard github/main

# El hotfix anterior ya debe estar integrado.
grep -q '/demo/\*' web/public/_headers || fail "Falta regla no-cache para /demo/*"
grep -q 'rel="icon"' web/index.html || fail "Falta favicon en web/index.html"
grep -q 'path="/demo/ia"' web/src/App.tsx || fail "Falta ruta /demo/ia en App.tsx"

run git diff --check

echo
echo "▶ Contratos Demo IA"
node scripts/test-demo-ai-contract.mjs
node scripts/test-demo-ai-product-v1_5.mjs
node scripts/test-demo-ai-product-v1_6.mjs

echo
echo "▶ Build Web Producción"
(
  cd web
  npm run build
)

LOCAL_ASSET="$(grep -Eo '/assets/index-[A-Za-z0-9_-]+\.js' web/dist/index.html | head -1)"
[ -n "$LOCAL_ASSET" ] || fail "No pude identificar bundle principal local"

echo "✓ Bundle local: $LOCAL_ASSET"

echo
echo "▶ Deploy Web forzado a rama de Producción: $PRODUCTION_BRANCH"
WEB_LOG="$LOG_DIR/pages-deploy.log"
(
  cd web
  npx wrangler pages deploy dist \
    --project-name="$WEB_PROJECT" \
    --branch="$PRODUCTION_BRANCH" \
    --commit-hash="$(git rev-parse HEAD)" \
    --commit-dirty=true
) 2>&1 | tee "$WEB_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Web Pages Producción"

IMMUTABLE="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$WEB_LOG" | tail -1)"
[ -n "$IMMUTABLE" ] || fail "No pude identificar URL inmutable del deploy"
echo "✓ Deploy inmutable: $IMMUTABLE"

fetch_html(){
  local url="$1"
  curl -fsSL -H 'Cache-Control: no-cache' -H 'Pragma: no-cache' "${url}?kawvo_hotfix=$(date +%s%N)"
}

# Primero validamos que el deploy recién creado sí contiene exactamente el build esperado.
echo
echo "▶ Verificar deploy inmutable"
IMM_HTML="$(fetch_html "$IMMUTABLE/demo/ia")"
echo "$IMM_HTML" | grep -Fq "$LOCAL_ASSET" || fail "El deploy inmutable no contiene el bundle local $LOCAL_ASSET"
echo "$IMM_HTML" | grep -q 'rel="icon"' || fail "El deploy inmutable no contiene favicon"
echo "✓ Deploy inmutable contiene bundle y favicon correctos"

# Cloudflare puede tardar algunos segundos en mover el dominio custom a la producción nueva.
echo
echo "▶ Esperar promoción real de intaprd.com"
MATCHED=0
REMOTE_ASSET=""
for attempt in $(seq 1 18); do
  HTML="$(fetch_html "$PROD_BASE/demo/ia" || true)"
  REMOTE_ASSET="$(printf '%s' "$HTML" | grep -Eo '/assets/index-[A-Za-z0-9_-]+\.js' | head -1 || true)"
  if [ "$REMOTE_ASSET" = "$LOCAL_ASSET" ]; then
    MATCHED=1
    break
  fi
  echo "  intento $attempt/18 · remoto=${REMOTE_ASSET:-sin-bundle} · esperado=$LOCAL_ASSET"
  sleep 5
done

[ "$MATCHED" -eq 1 ] || {
  echo >&2
  echo "✗ El deploy nuevo existe y es correcto en $IMMUTABLE," >&2
  echo "  pero intaprd.com sigue apuntando a otro deployment ($REMOTE_ASSET)." >&2
  echo "  Esto confirma un problema de Production Branch / dominio custom de Cloudflare Pages," >&2
  echo "  no del código React ni del build." >&2
  exit 1
}

echo "✓ intaprd.com ya sirve el bundle nuevo: $LOCAL_ASSET"

for path in /demo /demo/ia; do
  STATUS="$(curl -sS -o /dev/null -w '%{http_code}' -H 'Cache-Control: no-cache' "$PROD_BASE$path?kawvo_hotfix=$(date +%s%N)")"
  [ "$STATUS" = "200" ] || fail "$PROD_BASE$path respondió HTTP $STATUS"
  echo "✓ $PROD_BASE$path -> HTTP 200"
done

PROD_HTML="$(fetch_html "$PROD_BASE/demo/ia")"
echo "$PROD_HTML" | grep -q 'rel="icon"' || fail "Favicon no presente en HTML de Producción"

HEADERS="$(curl -fsSI -H 'Cache-Control: no-cache' "$PROD_BASE/demo/ia?kawvo_hotfix=$(date +%s%N)")"
echo "$HEADERS" | grep -Eqi 'cache-control:.*no-cache|cache-control:.*no-store' || fail "Falta política no-cache/no-store en /demo/ia"

echo
echo "▶ E2E real en Producción"
env PREVIEW_BASE="$PROD_BASE" node scripts/qa-demo-ai-preview.mjs

echo
echo "▶ Cerrar release"
TAG="prod-demo-ai-route-favicon-recovery-2026-09-01-$(date +%H%M%S)"
git tag -a "$TAG" -m "Kawvo Demo IA Pages production route recovery 2026-09-01"
git push github "$TAG"

cat <<EOF
============================================================
✓ KAWVO LINK · DEMO IA · DOMINIO PRODUCCIÓN RECUPERADO
============================================================
Main SHA:        $(git rev-parse HEAD)
Release tag:     $TAG
Web inmutable:   $IMMUTABLE
Bundle activo:   $LOCAL_ASSET
Demo:            $PROD_BASE/demo
Demo IA:         $PROD_BASE/demo/ia
Favicon:         VERIFICADO
QA Producción:   APROBADO
============================================================
EOF
