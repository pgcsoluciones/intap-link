#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
fail(){ echo "ERROR: $*" >&2; exit 1; }
run(){ echo "▶ $*"; "$@"; }
REMOTE=github
BRANCH=feature/kawmed-demo-invitations-2026-10-23
BASE=2dea1527e157fc8a434d83a749415b15d006890a
HEAD_EXPECTED=5e97eeb408e1c2f43ce6388f6f8c114e09c6dd97
echo "KawMed Invitaciones Demo — PREPARACION CONTROLADA, NO DESPLIEGA"
[ -z "$(git status --porcelain)" ] || fail "Existen cambios locales sin guardar."
run git fetch "$REMOTE" main "$BRANCH"
[ "$(git rev-parse "$REMOTE/main")" = "$BASE" ] || fail "Main cambió; hace falta reconciliar."
run git switch "$BRANCH"
run git pull --ff-only "$REMOTE" "$BRANCH"
[ "$(git rev-parse HEAD)" = "$HEAD_EXPECTED" ] || fail "La rama cambió; revisar cambios antes del despliegue."
[ "$(git merge-base "$REMOTE/main" HEAD)" = "$BASE" ] || fail "Base incorrecta"
run git diff --check "$REMOTE/main...HEAD"
for p in $(git diff --name-only "$REMOTE/main...HEAD"); do
 case "$p" in
  api/migrations/0151_kawmed_demo_invitations.sql|api/src/kawmed-demo-invitations.ts|api/src/preview-free-entry.ts|app/src/App.tsx|app/src/components/admin/medical/KawMedDemoGuest.tsx|app/src/components/admin/AdminLogin.tsx|app/src/components/admin/AuthCallback.tsx|app/src/components/admin/SuperAdminKawMed.tsx|scripts/test-kawmed-demo-invitations-contract.mjs|.github/workflows/quality.yml|scripts/prepare-kawmed-demo-2026-10-23.sh) ;;
  *) fail "Archivo fuera de alcance: $p" ;;
 esac
done
run node scripts/test-kawmed-demo-invitations-contract.mjs
run node scripts/test-kawmed-isolation-contract.mjs
run npx tsc --noEmit -p api/tsconfig.json
run npm run build -w app
run npx esbuild api/src/preview-free-entry.ts --bundle --platform=node --format=esm --target=node20 --external:cloudflare:* --outfile=/tmp/kawmed-demo-api-check.mjs
echo "✓ PREPARACION APROBADA. No se han aplicado migraciones ni publicado servicios."
echo "ATENCION: el editor demo todavia no reproduce toda la interfaz administrativa de KawMed."
