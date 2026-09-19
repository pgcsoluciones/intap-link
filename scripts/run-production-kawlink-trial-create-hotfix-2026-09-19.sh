#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
LOG_DIR="$ROOT/.production-kawlink-trial-create-hotfix-logs"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR"
mkdir -p "$LOG_DIR"

cat <<'EOF'
============================================================
KAWVO LINK · HOTFIX CREAR TRIAL · PRODUCCIÓN
============================================================
- corrige únicamente el INSERT de creación de Trial
- NO aplica migraciones
- NO despliega Web ni App
- valida contrato + TypeScript + bundle API
- despliega únicamente Worker/API Producción
============================================================
EOF

run git fetch github main
run git checkout main
run git pull --ff-only github main

DIRTY="$(git status --porcelain | grep -v '^?? web/public/assets/welcome/' | grep -v '^?? .production-kawlink-trial-create-hotfix-logs/' || true)"
[ -z "$DIRTY" ] || {
  printf '%s\n' "$DIRTY"
  fail "El árbol tiene cambios locales no permitidos"
}

LOCAL_SHA="$(git rev-parse HEAD)"
REMOTE_SHA="$(git rev-parse github/main)"
[ "$LOCAL_SHA" = "$REMOTE_SHA" ] || fail "main local no coincide con github/main"
echo "✓ Hotfix SHA: $LOCAL_SHA"

run git diff --check
run npm ci
run node scripts/test-trial-contract.mjs
run bash -lc 'cd api && npx tsc --noEmit'
run bash -lc 'npx esbuild api/src/preview-free-entry.ts --bundle --platform=node --format=esm --target=node20 --external:cloudflare:* --outfile=/tmp/kawvo-trial-create-hotfix-api.mjs'

echo
echo "▶ Confirmar que NO hay migraciones pendientes"
(
  cd api
  npx wrangler d1 migrations list intap_db --remote --config wrangler.toml
) | tee "$LOG_DIR/migrations.log"
grep -q 'No migrations to apply' "$LOG_DIR/migrations.log" || fail "Hay migraciones pendientes; detener hotfix"

echo
echo "▶ Deploy Worker/API Producción"
(
  cd api
  npx wrangler deploy --config wrangler.toml --dry-run
  npx wrangler deploy --config wrangler.toml
)

sleep 5

echo
echo "▶ Smoke API Producción"

code="$(curl -sS -o "$LOG_DIR/master.json" -w '%{http_code}' https://intaprd.com/api/v1/public/trials/master)"
[ "$code" = "200" ] || fail "Trial Master API respondió HTTP $code"
grep -q '"ok":true' "$LOG_DIR/master.json" || fail "Trial Master API no devolvió ok:true"
echo "✓ Trial Master API -> HTTP 200"

code="$(curl -sS -o "$LOG_DIR/create-unauth.json" -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{"duration_hours":72}' https://intaprd.com/api/v1/superadmin/trials)"
[ "$code" = "401" ] || {
  cat "$LOG_DIR/create-unauth.json"
  fail "POST crear Trial sin sesión debe responder 401; respondió $code"
}
echo "✓ POST crear Trial sigue protegido -> HTTP 401"

rm -rf "$LOG_DIR"

DIRTY_END="$(git status --porcelain | grep -v '^?? web/public/assets/welcome/' || true)"
[ -z "$DIRTY_END" ] || {
  printf '%s\n' "$DIRTY_END"
  fail "El hotfix dejó cambios locales no permitidos"
}

cat <<EOF
============================================================
✓ HOTFIX CREAR TRIAL DESPLEGADO EN PRODUCCIÓN
============================================================
SHA: $LOCAL_SHA
Prueba ahora: https://intaprd.com/trial
============================================================
EOF
