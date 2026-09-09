#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
EXPECTED_SHA="06aacd670e0519ec1f587f318ca840d21f121352"
LOG_DIR="/tmp/kawvo-team-auth-resume-2026-09-09"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" && mkdir -p "$LOG_DIR"

run git fetch github main
CURRENT="$(git rev-parse github/main)"
git merge-base --is-ancestor "$EXPECTED_SHA" github/main || fail "main no contiene el fix Team auth-resume esperado"

run git checkout --detach "$EXPECTED_SHA"
run git reset --hard "$EXPECTED_SHA"
run git diff --check

grep -Fq "kawvo_team_resume" api/src/team-browser-authority.ts || fail "Falta cookie de handoff Team"
grep -Fq "/api/v1/me/team/browser-resume" api/src/team-browser-authority.ts || fail "Falta endpoint de recuperación Team"
grep -Fq "/me/team/browser-resume" app/src/components/admin/AdminGuard.tsx || fail "AdminGuard no recupera handoff Team"
grep -Fq "saveTeamContext(scanCode, teamCode)" app/src/components/admin/AdminGuard.tsx || fail "AdminGuard no restaura contexto Team"

echo "✓ Handoff Team persistente confirmado"

run npm ci
run npm run build -w app
run npx tsc --noEmit -p api/tsconfig.json
run npx esbuild api/src/preview-free-entry.ts --bundle --platform=node --format=esm --target=node20 --external:cloudflare:* --outfile=/tmp/kawvo-team-auth-resume-prod.mjs
run bash -lc 'cd api && npx wrangler deploy --config wrangler.toml --dry-run'

echo
echo "▶ Deploy Worker Producción"
(cd api && npm run deploy:production) 2>&1 | tee "$LOG_DIR/worker.log"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker"

echo
echo "▶ Deploy App Producción"
npx wrangler pages deploy app/dist --project-name intap-web2 --branch main 2>&1 | tee "$LOG_DIR/app.log"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App"

sleep 5
for url in \
  "https://app.intaprd.com/admin/login" \
  "https://app.intaprd.com/admin"
do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

# Preflight público debe montar ruta y entregar cookie de resume.
curl -sS -D "$LOG_DIR/headers.txt" -o "$LOG_DIR/preflight.json" \
  -X POST 'https://app.intaprd.com/api/v1/public/team/browser-authority' \
  -H 'content-type: application/json' \
  --data '{"public_code":"4BXYMTNSK5","team_code":"TEAM-2X7G-SHPJ"}'
cat "$LOG_DIR/preflight.json"
grep -qi 'set-cookie: kawvo_team_resume=' "$LOG_DIR/headers.txt" || fail "Preflight no emitió cookie de handoff Team"
grep -q '"ok":true' "$LOG_DIR/preflight.json" || fail "Preflight Team no respondió ok"

echo
cat <<EOF
============================================================
✓ TEAM AUTH RESUME · PRODUCCION DESPLEGADA
============================================================
SHA: $EXPECTED_SHA
Worker + App actualizados
Handoff Team persiste durante login
============================================================
EOF
