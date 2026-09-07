#!/usr/bin/env bash
set -euo pipefail

ROOT="${HOME}/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawvo-profile-adonisg-v1"
WEB_PROJECT="intap-link"
PREVIEW_DB="intap_db_preview"
PREVIEW_CONFIG="wrangler.preview.toml"
SEED_FILE="migrations-preview/0044_seed_adonisg_special_profile.sql"
LOG_DIR="$ROOT/.preview-adonisg-v1-logs"
VENV_DIR="$ROOT/.venv-adonisg-assets"

fail(){ echo; echo "✗ ERROR: $1"; echo "Producción NO fue tocada."; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cleanup_assets(){
  for d in brand hero portraits portfolio media testimonials certifications videos og; do
    rm -rf "$ROOT/web/public/assets/adonisg/$d" 2>/dev/null || true
  done
}
trap cleanup_assets EXIT

wait_http_200(){
  local url="$1"; local label="$2"; local attempts="${3:-8}"; local delay="${4:-4}"; local code="000"; local i
  for i in $(seq 1 "$attempts"); do
    if [[ "$url" == *\?* ]]; then
      code="$(curl -sS -L --max-time 30 -o /dev/null -w '%{http_code}' "${url}&kawvo_preview_probe=$(date +%s)-$i" 2>/dev/null || true)"
    else
      code="$(curl -sS -L --max-time 30 -o /dev/null -w '%{http_code}' "${url}?kawvo_preview_probe=$(date +%s)-$i" 2>/dev/null || true)"
    fi
    if [ "$code" = "200" ]; then echo "✓ $label -> HTTP 200 (intento $i/$attempts)"; return 0; fi
    echo "… $label -> HTTP $code (intento $i/$attempts); esperando ${delay}s por propagación Pages"; sleep "$delay"
  done
  fail "$label no alcanzó HTTP 200 después de $attempts intentos (último HTTP $code)"
}

cd "$ROOT" || fail "No existe $ROOT"
mkdir -p "$LOG_DIR"
printf '\n============================================================\n KAWVO LINK · /adonisg · PREVIEW AISLADO\n============================================================\n'

run git fetch github "$BRANCH"
run git checkout -B "$BRANCH" "github/$BRANCH"
run git reset --hard "github/$BRANCH"
run git diff --check
[ "$(git branch --show-current)" != "main" ] || fail "Rama main bloqueada"
if grep -nE 'database_name = "intap_db"|bucket_name = "intap-r2"|name = "intap-api"$' api/wrangler.preview.toml; then fail "wrangler.preview.toml contiene referencia productiva"; fi
grep -Fq 'VITE_API_URL=https://intap-api-preview.fliaprince.workers.dev' web/.env.preview || fail "web/.env.preview no apunta al API Preview"
echo "✓ Rama segura: $(git branch --show-current)"
echo "✓ HEAD: $(git rev-parse HEAD)"
echo "✓ Config Preview aislada comprobada"
echo "✓ Web Preview apunta al Worker Preview, no a api.intaprd.com"

printf '\n▶ Preparar entorno Python aislado para optimización de assets\n'
if [ ! -x "$VENV_DIR/bin/python" ]; then run python3 -m venv "$VENV_DIR"; fi
if ! "$VENV_DIR/bin/python" -c 'import PIL' >/dev/null 2>&1; then run "$VENV_DIR/bin/python" -m pip install --disable-pip-version-check --no-input Pillow; fi
"$VENV_DIR/bin/python" -c 'from PIL import Image; print("✓ Pillow disponible en venv:", Image.__version__)' || fail "Pillow no quedó disponible en venv"

printf '\n▶ Preflight de identidad negra transparente\n'
run "$VENV_DIR/bin/python" scripts/ensure-adonisg-black-logo.py

printf '\n▶ Preparar y optimizar recursos reales de Argenis\n'
run "$VENV_DIR/bin/python" scripts/prepare-adonisg-assets.py

printf '\n▶ Validar TypeScript y build Web EN MODO PREVIEW\n'
(cd web && npm run build:preview) || fail "Build Web Preview"
if grep -R -Fq 'https://api.intaprd.com' web/dist/assets; then fail "El bundle Preview contiene api.intaprd.com"; fi
grep -R -Fq 'https://intap-api-preview.fliaprince.workers.dev' web/dist/assets || fail "El bundle Preview no contiene el API Preview"
echo "✓ Bundle Web Preview apunta exclusivamente al backend Preview esperado"

printf '\n▶ Seed específico SOLO D1 Preview · /adonisg\n'
(cd api && npx wrangler d1 execute "$PREVIEW_DB" --remote --config "$PREVIEW_CONFIG" --file "$SEED_FILE") || fail "Seed D1 Preview /adonisg"

printf '\n▶ Verificar instancia dinámica en D1 Preview\n'
(cd api && npx wrangler d1 execute "$PREVIEW_DB" --remote --config "$PREVIEW_CONFIG" --command "SELECT slug,name,category,subcategory,template_id,is_published,is_active FROM profiles WHERE slug='adonisg';") || fail "Verificación D1 /adonisg"

printf '\n▶ Verificar API pública Preview\n'
API_URL='https://intap-api-preview.fliaprince.workers.dev/api/v1/public/profiles/adonisg'
API_CODE="$(curl -sS -L -o /tmp/adonisg-api.json -w '%{http_code}' "$API_URL")"
[ "$API_CODE" = '200' ] || fail "API /adonisg respondió HTTP $API_CODE"
grep -Fq 'personal_brand_adonisg_v1' /tmp/adonisg-api.json || fail "API no devolvió template personal_brand_adonisg_v1"
grep -Fq 'Argenis Grullón' /tmp/adonisg-api.json || fail "API no devolvió identidad de Argenis"
echo "✓ API /adonisg devuelve identidad + template correctos desde D1 Preview"

printf '\n▶ Deploy Web + Pages Functions SOLO Preview\n'
WEB_LOG="$LOG_DIR/web-pages-$(date +%Y%m%d-%H%M%S).log"
npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch "$BRANCH" 2>&1 | tee "$WEB_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Web Preview"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$WEB_LOG" | tail -1)"
[ -n "$WEB_ORIGIN" ] || fail "No pude identificar WEB_PAGES_ORIGIN"
echo "✓ WEB_PAGES_ORIGIN=$WEB_ORIGIN"

printf '\n▶ Esperar propagación real de Pages/Functions\n'
wait_http_200 "$WEB_ORIGIN/" "Web Preview root" 10 4
wait_http_200 "$WEB_ORIGIN/index.html" "Web Preview index.html" 10 4
wait_http_200 "$WEB_ORIGIN/adonisg" "Perfil /adonisg" 10 4

printf '\n▶ Smokes técnicos perfil + assets + discovery\n'
for url in \
  "$WEB_ORIGIN/adonisg?lang=en" \
  "$WEB_ORIGIN/assets/adonisg/hero/argenis-hero.webp" \
  "$WEB_ORIGIN/assets/adonisg/brand/logo-black-transparent.png" \
  "$WEB_ORIGIN/assets/adonisg/brand/logo-white.png" \
  "$WEB_ORIGIN/assets/adonisg/portraits/behind-01.webp" \
  "$WEB_ORIGIN/assets/adonisg/portfolio/beauty-fragrance/beauty-cover.webp" \
  "$WEB_ORIGIN/assets/adonisg/portfolio/red-statement/red-03.webp" \
  "$WEB_ORIGIN/assets/adonisg/media/appearance-01.webp" \
  "$WEB_ORIGIN/assets/adonisg/media/appearance-02.webp" \
  "$WEB_ORIGIN/assets/adonisg/media/appearance-03.webp" \
  "$WEB_ORIGIN/assets/adonisg/testimonials/brachy.webp" \
  "$WEB_ORIGIN/assets/adonisg/testimonials/dr-hugo.webp" \
  "$WEB_ORIGIN/assets/adonisg/testimonials/la-faisa.webp" \
  "$WEB_ORIGIN/assets/adonisg/testimonials/viuda-blanca.webp" \
  "$WEB_ORIGIN/assets/adonisg/certifications/cert-01.webp" \
  "$WEB_ORIGIN/assets/adonisg/videos/video-01.mp4" \
  "$WEB_ORIGIN/assets/adonisg/og/adonisg-og.jpg" \
  "$WEB_ORIGIN/adonisg/ai.md" \
  "$WEB_ORIGIN/adonisg/facts.json" \
  "$WEB_ORIGIN/robots.txt" \
  "$WEB_ORIGIN/sitemap.xml" \
  "$WEB_ORIGIN/llms.txt"; do
  wait_http_200 "$url" "$url" 6 3
done

printf '\n▶ Validar SEO/GEO server-side para crawler\n'
CRAWLER_HTML="$(curl -sS -A 'Twitterbot/1.0' "$WEB_ORIGIN/adonisg?kawvo_crawler_probe=$(date +%s)")"
printf '%s' "$CRAWLER_HTML" | grep -Fq 'Argenis Grullón' || fail "Metadata crawler no contiene Argenis Grullón"
printf '%s' "$CRAWLER_HTML" | grep -Fq 'rel="canonical"' || fail "Falta canonical"
printf '%s' "$CRAWLER_HTML" | grep -Fq 'og:title' || fail "Falta og:title"
printf '%s' "$CRAWLER_HTML" | grep -Fq 'twitter:card' || fail "Falta Twitter Card"
printf '%s' "$CRAWLER_HTML" | grep -Fq 'application/ld+json' || fail "Falta JSON-LD"
echo "✓ SEO/GEO server-side presente"

printf '\n▶ Validar recursos IA del perfil\n'
curl -sS "$WEB_ORIGIN/adonisg/ai.md?kawvo_ai_probe=$(date +%s)" -o /tmp/adonisg-ai.md
grep -Fq 'Argenis Grullón' /tmp/adonisg-ai.md || fail "ai.md no contiene Argenis Grullón"
curl -sS "$WEB_ORIGIN/adonisg/facts.json?kawvo_facts_probe=$(date +%s)" -o /tmp/adonisg-facts.json
python3 - <<'PY'
import json
p=json.load(open('/tmp/adonisg-facts.json'))
text=json.dumps(p, ensure_ascii=False)
assert 'Argenis Grullón' in text
print('✓ facts.json válido y contiene identidad')
PY

printf '\n============================================================\n✓ /adonisg · PREVIEW LISTO PARA QA VISUAL HUMANO\n============================================================\n'
echo "Rama:       $BRANCH"
echo "Commit:     $(git rev-parse HEAD)"
echo "ES:         $WEB_ORIGIN/adonisg"
echo "EN:         $WEB_ORIGIN/adonisg?lang=en"
echo "PR:         https://github.com/pgcsoluciones/intap-link/pull/99"
echo "Producción: NO TOCADA"
echo "============================================================"
