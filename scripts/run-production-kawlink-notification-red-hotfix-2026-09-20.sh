#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="hotfix/kawlink-notification-red-specificity"
APPROVED_SHA="4974b273e3b2ddc713199c046aadab349d6f8936"
EXPECTED_MAIN="4cb86da66afcef7b8093e4cd3183a11eaa701062"
RUNNER="scripts/run-production-kawlink-notification-red-hotfix-2026-09-20.sh"
LOG_DIR="$ROOT/.production-kawlink-notification-red-hotfix-logs"
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
[ "$CHANGED" = "web/src/components/trial/KawvoTrial.css" ] || { echo "$CHANGED"; fail "Hotfix fuera de alcance"; }

run npm ci
run npm run build -w web
grep -R "#dc2626" web/dist/assets >/dev/null || fail "Falta rojo de notificación"
grep -R "trial-owner-new-message" web/dist/assets >/dev/null || fail "Falta clase de notificación"

echo "▶ Deploy SOLO Web Producción"
(npx wrangler pages deploy web/dist --project-name intap-link --branch main) 2>&1 | tee "$LOG_DIR/web.log"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Web Producción"
sleep 5
for url in https://intaprd.com/trial https://intaprd.com/trial/juanp; do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

echo "▶ Promover hotfix a main"
run git checkout -B main "$REMOTE/main"
run git merge --ff-only "$REMOTE/$BRANCH"
run git push "$REMOTE" main
PROD_SHA="$(git rev-parse HEAD)"
TAG="prod-kawlink-notification-red-hotfix-2026-09-20-$(date +%H%M%S)"
run git tag -a "$TAG" -m "KawLink red notification hotfix 2026-09-20"
run git push "$REMOTE" "$TAG"
rm -rf "$LOG_DIR"
echo "============================================================"
echo "✓ HOTFIX ROJO PRODUCCIÓN DESPLEGADO"
echo "Production SHA: $PROD_SHA"
echo "Release tag: $TAG"
echo "Solo Web fue desplegado."
echo "============================================================"
