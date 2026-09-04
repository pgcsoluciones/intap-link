#!/usr/bin/env bash
set -euo pipefail

ROOT="${HOME}/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawvo-profile-adonisg-v1"
WEB_PROJECT="intap-link"
PREVIEW_DB="intap_db_preview"
PREVIEW_CONFIG="wrangler.preview.toml"
SEED_FILE="migrations-preview/0044_seed_adonisg_special_profile.sql"
LOG_DIR="$ROOT/.preview-adonisg-v1-logs"

fail(){ echo; echo "✗ ERROR: $1"; echo "Producción NO fue tocada."; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cleanup_assets(){
  for d in brand hero portfolio media certifications og; do
    rm -rf "$ROOT/web/public/assets/adonisg/$d" 2>/dev/null || true
  done
}
trap cleanup_assets EXIT

cd "$ROOT" || fail "No existe $ROOT"
mkdir -p "$LOG_DIR"

printf '\n============================================================\n'
printf ' KAWVO LINK · /adonisg · PREVIEW AISLADO\n'
printf '============================================================\n'

run git fetch github "$BRANCH"
run git checkout -B "$BRANCH" "github/$BRANCH"
run git reset --hard "github/$BRANCH"
run git diff --check

[ "$(git branch --show-current)" != "main" ] || fail "Rama main bloqueada"

# Guardia explícita de aislamiento antes de cualquier operación remota.
if grep -nE 'database_name = "intap_db"|bucket_name = "intap-r2"|name = "intap-api"$' api/wrangler.preview.toml; then
  fail "wrangler.preview.toml contiene referencia productiva"
fi

echo "✓ Rama segura: $(git branch --show-current)"
echo "✓ HEAD: $(git rev-parse HEAD)"
echo "✓ Config Preview aislada comprobada"

printf '\n▶ Preparar y optimizar recursos reales de Argenis\n'
run python3 scripts/prepare-adonisg-assets.py

printf '\n▶ Validar TypeScript y build Web\n'
(cd web && npm run build) || fail "Build Web"

printf '\n▶ Seed específico SOLO D1 Preview · /adonisg\n'
# No ejecuta el árbol completo de migraciones. Solo el lote idempotente 0044.
(cd api && npx wrangler d1 execute "$PREVIEW_DB" --remote --config "$PREVIEW_CONFIG" --file "$SEED_FILE") || fail "Seed D1 Preview /adonisg"

printf '\n▶ Verificar instancia dinámica en D1 Preview\n'
(cd api && npx wrangler d1 execute "$PREVIEW_DB" --remote --config "$PREVIEW_CONFIG" --command "SELECT slug,name,template_id,is_published,is_active FROM profiles WHERE slug='adonisg';") || fail "Verificación D1 /adonisg"

printf '\n▶ Verificar API pública Preview antes del deploy Pages\n'
API_URL='https://intap-api-preview.fliaprince.workers.dev/api/v1/public/profiles/adonisg'
API_CODE="$(curl -sS -L -o /tmp/adonisg-api.json -w '%{http_code}' "$API_URL")"
[ "$API_CODE" = '200' ] || fail "API /adonisg respondió HTTP $API_CODE"
grep -Fq 'personal_brand_adonisg_v1' /tmp/adonisg-api.json || fail "API no devolvió template personal_brand_adonisg_v1"
echo "✓ API /adonisg devuelve template correcto"

printf '\n▶ Deploy Web SOLO a Cloudflare Pages Preview\n'
WEB_LOG="$LOG_DIR/web-pages-$(date +%Y%m%d-%H%M%S).log"
(cd web && npx wrangler pages deploy dist --project-name "$WEB_PROJECT" --branch "$BRANCH") 2>&1 | tee "$WEB_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Web Preview"

WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$WEB_LOG" | tail -1)"
[ -n "$WEB_ORIGIN" ] || fail "No pude identificar WEB_PAGES_ORIGIN"
echo "✓ WEB_PAGES_ORIGIN=$WEB_ORIGIN"

printf '\n▶ Smokes técnicos del perfil y recursos\n'
for url in \
  "$WEB_ORIGIN/adonisg" \
  "$WEB_ORIGIN/adonisg?lang=en" \
  "$WEB_ORIGIN/assets/adonisg/hero/argenis-hero.webp" \
  "$WEB_ORIGIN/assets/adonisg/brand/logo-white.png" \
  "$WEB_ORIGIN/assets/adonisg/portfolio/beauty-fragrance/beauty-cover.webp" \
  "$WEB_ORIGIN/assets/adonisg/media/dlb-dmh-exito.webp" \
  "$WEB_ORIGIN/assets/adonisg/certifications/cert-01.webp" \
  "$WEB_ORIGIN/assets/adonisg/og/adonisg-og.jpg"; do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  [ "$code" = '200' ] || fail "$url respondió HTTP $code"
  echo "✓ $url -> HTTP 200"
done

printf '\n▶ Comprobar contenido HTML/SPA y ausencia de 404 de perfil\n'
PAGE_HTML="$(curl -sS -L "$WEB_ORIGIN/adonisg")"
printf '%s' "$PAGE_HTML" | grep -q '<html' || fail "La respuesta /adonisg no contiene HTML"
# La API ya garantiza existencia/publicación; el render final se valida visualmente en navegador.

echo
printf '============================================================\n'
printf '✓ /adonisg · PREVIEW LISTO PARA QA VISUAL HUMANO\n'
printf '============================================================\n'
echo "Rama:       $BRANCH"
echo "Commit:     $(git rev-parse HEAD)"
echo "ES:         $WEB_ORIGIN/adonisg"
echo "EN:         $WEB_ORIGIN/adonisg?lang=en"
echo "Alias rama: https://feature-kawvo-profile-adonis.intap-link.pages.dev/adonisg"
echo "PR:         https://github.com/pgcsoluciones/intap-link/pull/99"
echo "Producción: NO TOCADA"
echo "============================================================"
