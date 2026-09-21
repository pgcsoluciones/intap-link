#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="hotfix/argenisg-custom-domain-cors"
EXPECTED_MAIN="ac158ad2156e31103dcfeee11b845c9d0573de8f"
APPROVED_SHA="b73a36143e4eac63bee8343bcb009480cd67fc22"
RUNNER="scripts/run-production-argenisg-custom-domain-cors-hotfix-2026-09-20.sh"
LOG_DIR="$ROOT/.production-argenisg-custom-domain-cors-logs"
fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }
cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" && mkdir -p "$LOG_DIR"
git remote get-url github >/dev/null 2>&1 && REMOTE=github || REMOTE=origin
run git fetch "$REMOTE" main "$BRANCH"
CURRENT_MAIN="$(git rev-parse "$REMOTE/main")"
[ "$CURRENT_MAIN" = "$EXPECTED_MAIN" ] || fail "main cambió: esperado $EXPECTED_MAIN actual $CURRENT_MAIN"
run git checkout "$BRANCH"
run git pull --ff-only "$REMOTE" "$BRANCH"
[ -z "$(git status --porcelain)" ] || fail "Árbol local no limpio"
git merge-base --is-ancestor "$EXPECTED_MAIN" HEAD || fail "Hotfix no parte del main actual"
git merge-base --is-ancestor "$APPROVED_SHA" HEAD || fail "SHA aprobado ya no es ancestro"
POST="$(git diff --name-only "$APPROVED_SHA"..HEAD | grep -v "^${RUNNER}$" || true)"
[ -z "$POST" ] || { echo "$POST"; fail "Hay cambios posteriores al QA"; }
run git diff --check "$REMOTE/main"...HEAD

CHANGED="$(git diff --name-only "$REMOTE/main"...HEAD | grep -v "^${RUNNER}$" || true)"
[ "$CHANGED" = "api/src/index.ts" ] || { echo "$CHANGED"; fail "Hotfix fuera de alcance"; }

run npm ci
run npx tsc --noEmit -p api/tsconfig.json
run bash -lc "cd api && npx wrangler deploy --config wrangler.toml --dry-run"

echo "▶ Deploy API Producción"
(cd api && npx wrangler deploy --config wrangler.toml) 2>&1 | tee "$LOG_DIR/api.log"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy API Producción"
sleep 7

echo "▶ QA CORS dominios personalizados"
for origin in https://argenisgrullon.com https://www.argenisgrullon.com https://alestilodeargenis.com https://www.alestilodeargenis.com; do
  curl -sS -D "$LOG_DIR/headers.txt" -o /dev/null -X OPTIONS \
    -H "Origin: $origin" \
    -H "Access-Control-Request-Method: GET" \
    https://api.intaprd.com/api/v1/public/profiles/argenisg
  grep -qi "^access-control-allow-origin: $origin" "$LOG_DIR/headers.txt" || fail "CORS no autorizado para $origin"
  echo "✓ CORS autorizado: $origin"
done

echo "▶ QA API perfil con Origin personalizado"
code="$(curl -sS -o "$LOG_DIR/profile.json" -w '%{http_code}' -H 'Origin: https://argenisgrullon.com' https://api.intaprd.com/api/v1/public/profiles/argenisg)"
[ "$code" = "200" ] || fail "Perfil argenisg respondió HTTP $code"
grep -q '"slug":"argenisg"' "$LOG_DIR/profile.json" || fail "La API no devolvió argenisg"
echo "✓ Perfil argenisg accesible desde custom domain"

echo "▶ Promover hotfix a main"
run git checkout -B main "$REMOTE/main"
run git merge --ff-only "$REMOTE/$BRANCH"
run git push "$REMOTE" main
PROD_SHA="$(git rev-parse HEAD)"
TAG="prod-argenisg-custom-domain-cors-hotfix-2026-09-20-$(date +%H%M%S)"
run git tag -a "$TAG" -m "Argenis custom domain CORS hotfix 2026-09-20"
run git push "$REMOTE" "$TAG"
rm -rf "$LOG_DIR"
echo "============================================================"
echo "✓ CORS DOMINIO ARGENIS EN PRODUCCIÓN"
echo "Production SHA: $PROD_SHA"
echo "Release tag: $TAG"
echo "Solo API fue desplegada."
echo "============================================================"
