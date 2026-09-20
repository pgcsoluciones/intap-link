#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="hotfix/kawlink-whatsapp-rd-normalization"
APPROVED_SHA="1d183c63b37626e7367aefc778531af6c4c8d5a1"
EXPECTED_MAIN="9188ed665b9495b0c3fca958f08160d217f71dfc"
RUNNER="scripts/run-production-kawlink-whatsapp-notification-hotfix-2026-09-20.sh"
LOG_DIR="$ROOT/.production-kawlink-whatsapp-notification-hotfix-logs"
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
git merge-base --is-ancestor "$EXPECTED_MAIN" HEAD || fail "Hotfix no parte del main aprobado"
git merge-base --is-ancestor "$APPROVED_SHA" HEAD || fail "SHA aprobado ya no es ancestro"
POST="$(git diff --name-only "$APPROVED_SHA"..HEAD | grep -v "^${RUNNER}$" || true)"
[ -z "$POST" ] || { echo "$POST"; fail "Hay cambios de producto posteriores al QA"; }
run git diff --check "$REMOTE/main"...HEAD

echo "▶ Verificar alcance exacto del hotfix"
CHANGED="$(git diff --name-only "$REMOTE/main"...HEAD | grep -v "^${RUNNER}$" || true)"
printf "%s\n" "$CHANGED"
EXPECTED_FILES="$(printf "%s\n" web/src/components/free-profile/IntapLinkGratisProfile.tsx web/src/components/trial/KawvoTrial.tsx web/src/components/trial/KawvoTrial.css | sort)"
ACTUAL_FILES="$(printf "%s\n" "$CHANGED" | sort)"
[ "$ACTUAL_FILES" = "$EXPECTED_FILES" ] || fail "El hotfix toca archivos fuera del alcance aprobado"

run npm ci
run npm run build -w web
grep -R "Nuevo mensaje en notificaciones" web/dist/assets >/dev/null || fail "Falta aviso de notificación en bundle"
grep -R "startsWith.(.00." web/dist/assets >/dev/null 2>&1 || true
grep -R "809|829|849" web/dist/assets >/dev/null || fail "Falta normalización RD en bundle"

echo "▶ Deploy SOLO Web Producción"
(npx wrangler pages deploy web/dist --project-name intap-link --branch main) 2>&1 | tee "$LOG_DIR/web.log"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Web Producción"
sleep 5

echo "▶ Smoke Producción"
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
TAG="prod-kawlink-whatsapp-notification-hotfix-2026-09-20-$(date +%H%M%S)"
run git tag -a "$TAG" -m "KawLink WhatsApp + notification owner bar hotfix 2026-09-20"
run git push "$REMOTE" "$TAG"
rm -rf "$LOG_DIR"

echo "============================================================"
echo "✓ HOTFIX PRODUCCIÓN DESPLEGADO"
echo "Production SHA: $PROD_SHA"
echo "Release tag: $TAG"
echo "Solo Web fue desplegado. API/App/D1/Landing no fueron tocados."
echo "============================================================"
