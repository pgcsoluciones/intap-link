#!/usr/bin/env bash
set -euo pipefail

ROOT="${HOME}/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawvo-profile-adonisg-v1"
WEB_PROJECT="intap-link"
PREVIEW_DB="intap_db_preview"
PREVIEW_CONFIG="wrangler.preview.toml"
LOG_DIR="$ROOT/.preview-adonisg-v1-logs"

fail(){ echo; echo "✗ ERROR: $1"; echo "Producción NO fue tocada."; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
mkdir -p "$LOG_DIR"

run git fetch github "$BRANCH"
run git checkout -B "$BRANCH" "github/$BRANCH"
run git reset --hard "github/$BRANCH"
run git diff --check

if [ "$(git branch --show-current)" = "main" ]; then fail "Rama main bloqueada"; fi

printf '\n▶ TypeScript + build Web\n'
(cd web && npx tsc && npm run build) || fail "Build Web"

printf '\n▶ Aplicar migraciones SOLO D1 Preview\n'
(cd api && npx wrangler d1 migrations apply "$PREVIEW_DB" --remote --config "$PREVIEW_CONFIG") || fail "Migraciones D1 Preview"

printf '\n▶ Verificar seed /adonisg en D1 Preview\n'
(cd api && npx wrangler d1 execute "$PREVIEW_DB" --remote --config "$PREVIEW_CONFIG" --command "SELECT slug,name,template_id,is_published,is_active FROM profiles WHERE slug='adonisg';") || fail "Verificación D1 /adonisg"

printf '\n▶ Deploy Web SOLO Preview\n'
WEB_LOG="$LOG_DIR/web-pages-$(date +%Y%m%d-%H%M%S).log"
(cd web && npx wrangler pages deploy dist --project-name "$WEB_PROJECT" --branch "$BRANCH") 2>&1 | tee "$WEB_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Web Preview"

WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$WEB_LOG" | tail -1)"
[ -n "$WEB_ORIGIN" ] || fail "No pude identificar WEB_PAGES_ORIGIN"

echo "✓ WEB_PAGES_ORIGIN=$WEB_ORIGIN"

printf '\n▶ Smokes /adonisg\n'
for url in \
  "$WEB_ORIGIN/adonisg" \
  "$WEB_ORIGIN/adonisg?lang=en" \
  "$WEB_ORIGIN/assets/adonisg/hero/argenis-hero.webp" \
  "$WEB_ORIGIN/assets/adonisg/portfolio/beauty-fragrance/beauty-cover.webp" \
  "$WEB_ORIGIN/assets/adonisg/media/dlb-dmh-exito.webp" \
  "$WEB_ORIGIN/assets/adonisg/og/adonisg-og.jpg"; do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  [ "$code" = '200' ] || fail "$url respondió HTTP $code"
  echo "✓ $url -> HTTP 200"
done

printf '\n▶ API pública Preview\n'
API_URL='https://intap-api-preview.fliaprince.workers.dev/api/v1/public/profiles/adonisg'
API_CODE="$(curl -sS -L -o /tmp/adonisg-api.json -w '%{http_code}' "$API_URL")"
[ "$API_CODE" = '200' ] || fail "API /adonisg respondió HTTP $API_CODE"
grep -Fq 'personal_brand_adonisg_v1' /tmp/adonisg-api.json || fail "API no devolvió template personal_brand_adonisg_v1"
echo "✓ API /adonisg devuelve template correcto"

printf '\n============================================================\n'
printf '✓ /adonisg · PREVIEW LISTO PARA QA HUMANO\n'
printf '============================================================\n'
echo "Rama:      $BRANCH"
echo "Commit:    $(git rev-parse HEAD)"
echo "ES:        $WEB_ORIGIN/adonisg"
echo "EN:        $WEB_ORIGIN/adonisg?lang=en"
echo "Producción: NO TOCADA"
echo "============================================================"
