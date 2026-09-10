#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
WEB_PROJECT="intap-link"
APP_PROJECT="intap-web2"
LOG_DIR="/tmp/kawvo-free-copy-brand-close-2026-09-10"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" && mkdir -p "$LOG_DIR"

cat <<'EOF'
============================================================
KAWVO LINK · CIERRE FREE · PRODUCCIÓN
DESCRIPCIONES 180 + PALETA KAWVO + CONTRASTE
============================================================
- Portafolio: descripción 180
- Servicios: descripción 180
- Límites superiores se conservan
- Paleta base Kawvo: azul / blanco / negro
- Botones oscuros: contenido claro por contraste
- Sin migraciones D1
============================================================
EOF

run git checkout main
run git pull --ff-only github main
[ -z "$(git status --porcelain)" ] || fail "El repositorio tiene cambios locales. Guárdalos antes de continuar."

BASE_SHA="$(git rev-parse HEAD)"
echo "Base: $BASE_SHA"

run python3 scripts/finalize-free-description-limits-180-v1.py
run git diff --check

echo
echo "▶ Diff de cierre"
git --no-pager diff -- \
  api/src/ai-profile-assistant.ts \
  app/src/components/admin/free/FreeAiProfileAssistant.tsx \
  scripts/qa-demo-ai-preview.mjs \
  scripts/test-ai-profile-canonical-limits.mjs \
  docs/KAWVO_AI_PROFILE_CANONICAL_FIELDS.md

# Gates de límites finales.
grep -Fq "const DESCRIPTION_LIMIT = 180" app/src/components/admin/free/FreePortfolio.tsx || fail "Portafolio no está en 180"
grep -Fq "const DESCRIPTION_LIMIT = 180" app/src/components/admin/free/FreeServices.tsx || fail "Servicios no está en 180"
grep -Fq "const SECTION_DESCRIPTION_LIMIT = 240" app/src/components/admin/free/FreeServices.tsx || fail "Se alteró el límite superior 240"
grep -Fq "portfolio_description: 180" api/src/ai-profile-assistant.ts || fail "IA portfolio no está en 180"
grep -Fq "service_description: 180" api/src/ai-profile-assistant.ts || fail "IA servicios no está en 180"
grep -Fq "description: clean(item?.description, 180)" api/src/routes/demo-ai.ts || fail "Demo IA no está en 180"
grep -Fq "description: readString(item, 'description').slice(0, 180)" web/src/components/free-profile/IntapLinkGratis.adapter.ts || fail "Adapter portfolio no está en 180"
grep -Fq "description: service.description.slice(0, 180)" web/src/components/free-profile/IntapLinkGratis.adapter.ts || fail "Starter services no está en 180"

# Gates de marca/contraste.
grep -Fq "name: 'Kawvo'" web/src/components/free-profile/IntapLinkGratis.experience.ts || fail "Preset principal no se llama Kawvo"
grep -Fq "accent: '#0B61C9'" web/src/components/free-profile/IntapLinkGratis.experience.ts || fail "Accent Kawvo no es azul"
grep -Fq "button: '#0B61C9'" web/src/components/free-profile/IntapLinkGratis.experience.ts || fail "Botón Kawvo no es azul"
grep -Fq "const onAction = readableText(action)" web/src/components/free-profile/IntapLinkGratisProfile.tsx || fail "Falta contraste dinámico de acciones"
grep -Fq "'--ilx-on-action': onAction" web/src/components/free-profile/IntapLinkGratisProfile.tsx || fail "Falta variable de contraste de acciones"

echo "✓ Gates de producto superados"

# QA estático específico.
run node scripts/test-ai-profile-canonical-limits.mjs

# Builds y dry-run antes de tocar producción.
run npm ci
run npm run build -w web
run npm run build -w app
run npx tsc --noEmit -p api/tsconfig.json
run npx esbuild api/src/preview-free-entry.ts --bundle --platform=node --format=esm --target=node20 --external:cloudflare:* --outfile=/tmp/kawvo-free-copy-brand-close.mjs
run bash -lc 'cd api && npx wrangler deploy --config wrangler.toml --dry-run'

# Commit de las últimas sustituciones hechas por el finalizador.
if [ -n "$(git status --porcelain)" ]; then
  run git add \
    api/src/ai-profile-assistant.ts \
    app/src/components/admin/free/FreeAiProfileAssistant.tsx \
    scripts/qa-demo-ai-preview.mjs \
    scripts/test-ai-profile-canonical-limits.mjs \
    docs/KAWVO_AI_PROFILE_CANONICAL_FIELDS.md
  run git commit -m "fix: finalize free description limits at 180"
  run git push github main
fi

PRODUCT_SHA="$(git rev-parse HEAD)"
echo "Producto a desplegar: $PRODUCT_SHA"

# Producción: API + App + Web porque el lote toca las tres superficies.
echo; echo "▶ Deploy Worker Producción"
(cd api && npm run deploy:production) 2>&1 | tee "$LOG_DIR/worker.log"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker"

echo; echo "▶ Deploy App Producción"
npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch main 2>&1 | tee "$LOG_DIR/app.log"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App"

echo; echo "▶ Deploy Web Producción"
npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch main 2>&1 | tee "$LOG_DIR/web.log"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Web"

sleep 5
for url in \
  "https://intaprd.com/" \
  "https://app.intaprd.com/admin/login" \
  "https://api.intaprd.com/api/health"
do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

TAG="prod-free-copy-brand-close-2026-09-10-$(date +%H%M%S)"
run git tag -a "$TAG" "$PRODUCT_SHA" -m "Free descriptions 180 + Kawvo palette + contrast close"
run git push github "$TAG"

cat <<EOF

============================================================
✓ CIERRE FREE PUBLICADO EN PRODUCCIÓN
============================================================
SHA:  $PRODUCT_SHA
Tag:  $TAG
Web:  https://intaprd.com
App:  https://app.intaprd.com
API:  https://api.intaprd.com
Logs: $LOG_DIR
============================================================
EOF
