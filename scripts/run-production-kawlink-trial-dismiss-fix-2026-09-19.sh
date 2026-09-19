#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
LOG_DIR="$ROOT/.production-kawlink-trial-dismiss-fix-logs"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR"
mkdir -p "$LOG_DIR"

cat <<'EOF'
============================================================
KAWVO LINK · CIERRE MODAL TRIAL · PRODUCCIÓN
============================================================
- corrige cierre por X
- corrige cierre al hacer clic fuera del cuadro
- fuerza regreso confiable a /trial
- NO toca D1
- NO despliega App ni Worker/API
- despliega únicamente Web Producción
============================================================
EOF

run git fetch github main
run git checkout main
run git pull --ff-only github main

DIRTY="$(git status --porcelain | grep -v '^?? web/public/assets/welcome/' | grep -v '^?? .production-kawlink-trial-logs/' | grep -v '^?? .production-kawlink-trial-dismiss-fix-logs/' || true)"
[ -z "$DIRTY" ] || { printf '%s\n' "$DIRTY"; fail "El árbol tiene cambios locales no permitidos"; }

LOCAL_SHA="$(git rev-parse HEAD)"
REMOTE_SHA="$(git rev-parse github/main)"
[ "$LOCAL_SHA" = "$REMOTE_SHA" ] || fail "main local no coincide con github/main"
echo "✓ Release SHA: $LOCAL_SHA"

run git diff --check
run npm ci
run node scripts/test-trial-contract.mjs
run npm run build -w web

echo
echo "▶ Deploy Web Producción"
npx wrangler pages deploy web/dist --project-name intap-link --branch main

sleep 5

echo
echo "▶ Smoke Web Producción"
code="$(curl -sS -L -o /dev/null -w '%{http_code}' https://intaprd.com/trial)"
[ "$code" = "200" ] || fail "https://intaprd.com/trial respondió HTTP $code"
echo "✓ https://intaprd.com/trial -> HTTP 200"

rm -rf "$LOG_DIR"

DIRTY_END="$(git status --porcelain | grep -v '^?? web/public/assets/welcome/' | grep -v '^?? .production-kawlink-trial-logs/' || true)"
[ -z "$DIRTY_END" ] || { printf '%s\n' "$DIRTY_END"; fail "El runner dejó cambios locales no permitidos"; }

cat <<EOF
============================================================
✓ CIERRE MODAL TRIAL CORREGIDO EN PRODUCCIÓN
============================================================
SHA: $LOCAL_SHA
Prueba: https://intaprd.com/trial
============================================================
EOF
