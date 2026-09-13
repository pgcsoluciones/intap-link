#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/free-guided-tour-v1"
PATCH="scripts/apply-free-panel-brand-image-optimization-v5-2026-09-13.py"
AUTH_RUNNER="scripts/run-preview-free-guided-tour-v1-auth-2026-09-12.sh"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"

cat <<'EOF'
============================================================
KAWVO LINK · PANELES · LOGO + IMÁGENES OPTIMIZADAS · PREVIEW V5
============================================================
- corrige logo Kawvo cuando el asset remoto no carga
- fallback local ligero para paneles
- optimiza avatar/portada/fotos Team en el navegador
- limita dimensiones antes de subir a R2
- intenta WebP y usa JPEG como fallback
- producción NO se toca
============================================================
EOF

run git fetch github "$BRANCH" main
run git checkout "$BRANCH"
run git pull --ff-only github "$BRANCH"

[ -z "$(git status --porcelain)" ] || { git status --short; fail "El árbol de trabajo no está limpio"; }

run python3 "$PATCH"
run git diff --check

# QA estructural: branding y optimización en todos los puntos de imagen del panel Free.
grep -Fq "logo.onerror = () =>" app/src/kawvo-brand.ts || fail "Falta fallback del logo"
grep -Fq "optimizeImageBlobForUpload" app/src/components/admin/free/FreeDashboard.tsx || fail "Dashboard no optimiza imágenes"
grep -Fq "optimizeImageBlobForUpload" app/src/components/admin/free/FreeAccount.tsx || fail "Mi cuenta no optimiza imágenes"
grep -Fq "maxDimension:1200" app/src/components/admin/free/onboarding/FreeOnboardingIdentity.tsx || fail "Portada no limita dimensiones"
grep -Fq "optimizeImageBlobForUpload" app/src/components/admin/free/FreeTeamAssign.tsx || fail "Team Assign no optimiza foto"
grep -Fq "optimizeImageBlobForUpload" app/src/components/admin/free/FreeTeamMemberEdit.tsx || fail "Team Edit no optimiza foto"

run npm run build:preview -w app

run git add \
  app/src/kawvo-brand.ts \
  app/src/lib/imageUploadOptimization.ts \
  app/src/components/admin/free/FreeDashboard.tsx \
  app/src/components/admin/free/FreeAccount.tsx \
  app/src/components/admin/free/onboarding/FreeOnboardingIdentity.tsx \
  app/src/components/admin/free/FreeTeamAssign.tsx \
  app/src/components/admin/free/FreeTeamMemberEdit.tsx

if ! git diff --cached --quiet; then
  run git commit -m "fix: restore panel branding and optimize image uploads"
  run git push github "$BRANCH"
fi

run bash "$AUTH_RUNNER"

cat <<'EOF'
============================================================
✓ PREVIEW V5 LISTO PARA QA
============================================================
Prueba:
https://app.preview.intaprd.com/admin/free

Revisa especialmente:
- logo Kawvo visible en Mi panel, Mi cuenta y Team
- cambio de avatar
- cambio de portada
- foto de miembro Team
- carga y velocidad después de subir imágenes

Producción NO tocada
============================================================
EOF
