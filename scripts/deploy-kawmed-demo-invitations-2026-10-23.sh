#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
fail(){ echo "ERROR: $*" >&2; exit 1; }
run(){ echo "▶ $*"; "$@"; }
REMOTE=github
BRANCH=feature/kawmed-demo-invitations-2026-10-23
BASE=2dea1527e157fc8a434d83a749415b15d006890a
echo "KawMed demo: lanzamiento controlado API + App + D1 (0151)"
[ -z "$(git status --porcelain)" ] || fail "Hay cambios locales sin guardar. No se publica."
run git fetch "$REMOTE" main "$BRANCH"
[ "$(git rev-parse "$REMOTE/main")" = "$BASE" ] || fail "main cambió. No se publica sin reconciliar."
run git switch "$BRANCH"
run git pull --ff-only "$REMOTE" "$BRANCH"
[ "$(git merge-base "$REMOTE/main" HEAD)" = "$BASE" ] || fail "La rama ya no coincide con main."
run git diff --check "$REMOTE/main...HEAD"
for path in $(git diff --name-only "$REMOTE/main...HEAD"); do
  case "$path" in
    .github/workflows/quality.yml|api/migrations/0151_kawmed_demo_invitations.sql|api/src/kawmed-demo-invitations.ts|api/src/preview-free-entry.ts|app/src/App.tsx|app/src/components/admin/AdminLogin.tsx|app/src/components/admin/AuthCallback.tsx|app/src/components/admin/SuperAdminKawMed.tsx|app/src/components/admin/medical/KawMedDemoGuest.tsx|scripts/test-kawmed-demo-invitations-contract.mjs|scripts/deploy-kawmed-demo-invitations-2026-10-23.sh) ;;
    *) fail "Archivo fuera de alcance: $path" ;;
  esac
done
run npm ci
run node scripts/test-kawmed-demo-invitations-contract.mjs
run node scripts/test-kawmed-isolation-contract.mjs
run npx tsc --noEmit -p api/tsconfig.json
run npm run build -w app
run npx esbuild api/src/preview-free-entry.ts --bundle --platform=node --format=esm --target=node20 --external:cloudflare:* --outfile=/tmp/kawmed-demo-api.mjs
echo "▶ Comprobando sesión Cloudflare y respaldando D1 ANTES de cambiar la base"
mkdir -p "$HOME/kawmed-db-production-backups"
BACKUP="$HOME/kawmed-db-production-backups/intap_db_before_demo_$(date -u +%Y%m%dT%H%M%SZ).sql"
(cd api && npx wrangler d1 export intap_db --remote --output="$BACKUP" --config wrangler.toml)
[ -s "$BACKUP" ] || fail "El respaldo D1 no se generó."
echo "✓ Respaldo: $BACKUP"
echo "▶ Aplicando SOLO la migración nueva 0151 en la BD remota"
(cd api && npx wrangler d1 execute intap_db --remote --config wrangler.toml --file=migrations/0151_kawmed_demo_invitations.sql)
echo "▶ Publicando Worker API"
(cd api && npx wrangler deploy --config wrangler.toml)
HEALTH="$(curl -sSL -o /tmp/kawmed-demo-health.json -w '%{http_code}' https://api.intaprd.com/api/health)"
[ "$HEALTH" = 200 ] && grep -q '"ok":true' /tmp/kawmed-demo-health.json || fail "La API no respondió correctamente."
UNAUTH="$(curl -sSL -o /dev/null -w '%{http_code}' https://api.intaprd.com/api/v1/me/kawmed/demo/$(printf '0%.0s' {1..64}) || true)"
[ "$UNAUTH" = 401 ] || fail "La invitación demo no exige sesión: HTTP $UNAUTH"
ADMIN="$(curl -sSL -o /dev/null -w '%{http_code}' -X POST https://api.intaprd.com/api/v1/superadmin/kawmed/demo-invitations -H 'Content-Type: application/json' --data '{}' || true)"
[ "$ADMIN" = 401 ] || fail "Crear invitación no exige SuperAdmin: HTTP $ADMIN"
echo "▶ Publicando App"
run npx wrangler pages deploy app/dist --project-name intap-web2 --branch main
for url in https://app.intaprd.com/admin/login https://app.intaprd.com/superadmin/kawmed; do
  code="$(curl -sSL -o /dev/null -w '%{http_code}' "$url")"
  [ "$code" = 200 ] || fail "App no respondió: $url ($code)"
done
[ "$(git ls-remote "$REMOTE" refs/heads/main | cut -f1)" = "$BASE" ] || fail "main cambió antes de integrar."
run git push "$REMOTE" HEAD:main
TAG="prod-kawmed-demo-invitations-$(date -u +%Y%m%dT%H%M%SZ)"
run git tag "$TAG"
run git push "$REMOTE" "$TAG"
echo "✓ Lanzamiento finalizado: $(git rev-parse HEAD) / tag: $TAG"
echo "✓ Respaldo D1: $BACKUP"
echo "PRUEBAS MANUALES OBLIGATORIAS: invitado correcto, correo incorrecto, revocación, copia aislada, WhatsApp Mi visitador, independiente y patrocinado."
