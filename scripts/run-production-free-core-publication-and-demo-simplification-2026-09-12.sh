#!/usr/bin/env bash
set -euo pipefail
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
APP_PROJECT="intap-web2"
WEB_PROJECT="intap-link"
LOG_DIR="/tmp/kawvo-free-core-20260912"
mkdir -p "$LOG_DIR"
fail(){ echo "✗ ERROR: $*" >&2; exit 1; }
run(){ echo "▶ $*"; "$@"; }
cd "$ROOT"

echo '============================================================'
echo 'KAWVO LINK · FREE CORE + DEMO SIMPLIFICADA'
echo '============================================================'
echo '- publicación: usuario + nombre/cargo + foto + portada'
echo '- contacto/servicios/portafolio ya no bloquean publicación'
echo '- portada editable desde presentación'
echo '- demo IA reducida a actividad, nombre/cargo y contacto'
echo '============================================================'

run git checkout main
run git pull --ff-only github main
[ -z "$(git status --porcelain)" ] || fail 'El árbol de trabajo no está limpio.'

run python3 scripts/apply-free-core-publication-and-demo-simplification-2026-09-12.py
run git diff --check

echo; echo '▶ Build Admin App'
npm run build -w app 2>&1 | tee "$LOG_DIR/app-build.log"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail 'Build App'

echo; echo '▶ Build Web/Demo'
npm run build -w web 2>&1 | tee "$LOG_DIR/web-build.log"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail 'Build Web'

echo; echo '▶ Typecheck API'
npx tsc -p api/tsconfig.json --noEmit 2>&1 | tee "$LOG_DIR/api-tsc.log"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail 'Typecheck API'

run git add \
  api/src/index.ts \
  app/src/components/admin/free/FreeDashboard.tsx \
  app/src/components/admin/free/FreeFirstRunGuide.tsx \
  app/src/components/admin/free/FreeVisualEditor.tsx \
  app/src/components/admin/free/onboarding/FreeOnboardingIdentity.tsx \
  web/src/components/demo/KawvoLinkDemoAi.tsx

if ! git diff --cached --quiet; then
  run git commit -m 'feat: simplify free publishing requirements and demo onboarding'
  run git push github main
fi

echo; echo '▶ Deploy API Producción'
(cd api && npx wrangler deploy --config wrangler.toml) 2>&1 | tee "$LOG_DIR/api-deploy.log"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail 'Deploy API'

echo; echo '▶ Deploy Admin App Producción'
npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch main 2>&1 | tee "$LOG_DIR/app-deploy.log"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail 'Deploy App'

echo; echo '▶ Deploy Web/Demo Producción'
npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch main 2>&1 | tee "$LOG_DIR/web-deploy.log"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail 'Deploy Web'

echo '============================================================'
echo '✓ FREE CORE ACTUALIZADO EN PRODUCCIÓN'
echo '✓ PORTADA RESTAURADA EN EDICIÓN'
echo '✓ PUBLICACIÓN BLOQUEADA SOLO POR DATOS INDISPENSABLES'
echo '✓ DEMO IA REDUCIDA A PREGUNTAS ESENCIALES'
echo '============================================================'
