#!/usr/bin/env bash
set -euo pipefail

ROOT="${HOME}/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawvo-profile-adonisg-v1"
WEB_PROJECT="intap-link"
PREVIEW_DB="intap_db_preview"
PREVIEW_CONFIG="wrangler.preview.toml"
LOG_DIR="$ROOT/.preview-argenisg-v1-logs"
VENV_DIR="$ROOT/.venv-adonisg-assets"

fail(){ echo; echo "✗ ERROR: $1"; echo "Producción NO fue tocada."; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }
wait200(){ local u="$1"; local l="$2"; local c=000; for i in $(seq 1 10); do c="$(curl -sS -L --max-time 30 -o /dev/null -w '%{http_code}' "$u" 2>/dev/null || true)"; [ "$c" = 200 ] && { echo "✓ $l -> HTTP 200"; return 0; }; sleep 4; done; fail "$l respondió HTTP $c"; }
cleanup_assets(){ for d in brand hero portraits portfolio media testimonials certifications videos og; do rm -rf "$ROOT/web/public/assets/adonisg/$d" 2>/dev/null || true; done; }
trap cleanup_assets EXIT

cd "$ROOT" || fail "No existe $ROOT"
mkdir -p "$LOG_DIR"
printf '\n============================================================\n KAWVO LINK · /argenisg · PREVIEW AISLADO\n============================================================\n'

run git fetch github "$BRANCH"
run git checkout -B "$BRANCH" "github/$BRANCH"
run git reset --hard "github/$BRANCH"
run git diff --check
[ "$(git branch --show-current)" != main ] || fail "Rama main bloqueada"
grep -Fq 'VITE_API_URL=https://intap-api-preview.fliaprince.workers.dev' web/.env.preview || fail "Web no apunta al API Preview"

echo "✓ Rama segura: $(git branch --show-current)"
echo "✓ HEAD: $(git rev-parse HEAD)"

printf '\n▶ Preparar assets oficiales de Argenis\n'
if [ ! -x "$VENV_DIR/bin/python" ]; then run python3 -m venv "$VENV_DIR"; fi
if ! "$VENV_DIR/bin/python" -c 'import PIL' >/dev/null 2>&1; then run "$VENV_DIR/bin/python" -m pip install --disable-pip-version-check --no-input Pillow; fi
run "$VENV_DIR/bin/python" scripts/ensure-adonisg-black-logo.py
run "$VENV_DIR/bin/python" scripts/prepare-adonisg-assets.py

printf '\n▶ Preparar ruta final /argenisg y canonical host-aware\n'
run python3 scripts/prepare-argenisg-final-route.py
grep -Fq '/argenisg' web/src/components/profile-templates/IntapProfileAdonisgV1.tsx || fail "Ruta /argenisg no quedó aplicada"

printf '\n▶ Preparar última publicación Instagram inline\n'
run python3 scripts/prepare-argenisg-instagram-inline.py
grep -Fq 'InstagramLatestMedia' web/src/components/profile-templates/IntapProfileAdonisgV1.tsx || fail "Viewer Instagram inline no quedó aplicado"

printf '\n▶ Build Web Preview\n'
(cd web && npm run build:preview) || fail "Build Web Preview"
if grep -R -Fq 'https://api.intaprd.com' web/dist/assets; then fail "Bundle Preview contiene API productiva"; fi

printf '\n▶ Consolidar SOLO D1 Preview en /argenisg\n'
(cd api && npx wrangler d1 execute "$PREVIEW_DB" --remote --config "$PREVIEW_CONFIG" --file migrations-preview/0044_seed_adonisg_special_profile.sql) || fail "Seed base"
(cd api && npx wrangler d1 execute "$PREVIEW_DB" --remote --config "$PREVIEW_CONFIG" --file migrations-preview/0045_rename_adonisg_to_argenisg.sql) || fail "Rename /argenisg"
(cd api && npx wrangler d1 execute "$PREVIEW_DB" --remote --config "$PREVIEW_CONFIG" --file migrations-preview/0046_seed_argenisg_special_profile.sql) || fail "Consolidación /argenisg"

CHECK="$(cd api && npx wrangler d1 execute "$PREVIEW_DB" --remote --config "$PREVIEW_CONFIG" --command "SELECT slug,template_id,is_published,is_active FROM profiles WHERE slug='argenisg';" 2>&1)"
printf '%s\n' "$CHECK"
printf '%s' "$CHECK" | grep -Fq 'argenisg' || fail "D1 Preview no contiene /argenisg"

API_URL='https://intap-api-preview.fliaprince.workers.dev/api/v1/public/profiles/argenisg'
API_CODE="$(curl -sS -L -o /tmp/argenisg-api.json -w '%{http_code}' "$API_URL")"
[ "$API_CODE" = 200 ] || fail "API /argenisg respondió HTTP $API_CODE"
grep -Fq 'personal_brand_adonisg_v1' /tmp/argenisg-api.json || fail "Template incorrecto"
grep -Fq 'Argenis Grullón' /tmp/argenisg-api.json || fail "Identidad incorrecta"

echo "✓ API Preview /argenisg correcta"

printf '\n▶ Deploy Pages SOLO Preview\n'
WEB_LOG="$LOG_DIR/web-pages-$(date +%Y%m%d-%H%M%S).log"
npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch "$BRANCH" 2>&1 | tee "$WEB_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Web Preview"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$WEB_LOG" | tail -1)"
[ -n "$WEB_ORIGIN" ] || fail "No pude identificar URL Preview"

wait200 "$WEB_ORIGIN/argenisg" "Perfil /argenisg"
wait200 "$WEB_ORIGIN/argenisg?lang=en" "Perfil /argenisg EN"
wait200 "$WEB_ORIGIN/assets/adonisg/brand/logo-black-transparent.png" "Logo PNG transparente"
wait200 "$WEB_ORIGIN/assets/adonisg/media/appearance-09.webp" "Me has visto en 09"
wait200 "$WEB_ORIGIN/assets/adonisg/videos/video-01.mp4" "Video 01"

CRAWLER_HTML="$(curl -sS -A 'Twitterbot/1.0' "$WEB_ORIGIN/argenisg")"
printf '%s' "$CRAWLER_HTML" | grep -Fq 'Argenis Grullón' || fail "SEO crawler sin identidad"
printf '%s' "$CRAWLER_HTML" | grep -Fq 'rel="canonical"' || fail "SEO crawler sin canonical"

printf '\n============================================================\n✓ /argenisg · PREVIEW LISTO PARA QA\n============================================================\n'
echo "Rama:       $BRANCH"
echo "Commit:     $(git rev-parse HEAD)"
echo "ES:         $WEB_ORIGIN/argenisg"
echo "EN:         $WEB_ORIGIN/argenisg?lang=en"
echo "Producción: NO TOCADA"
echo "============================================================"
