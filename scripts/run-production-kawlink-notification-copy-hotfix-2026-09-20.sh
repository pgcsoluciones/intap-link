#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="hotfix/kawlink-whatsapp-rd-normalization"
APPROVED_SHA="a327cbf39e0c97b5ffee15b3c2c12901ae6f8768"
EXPECTED_MAIN="3ea20a6cd8f5996f00a923b1cd94fb031c288f39"
RUNNER="scripts/run-production-kawlink-notification-copy-hotfix-2026-09-20.sh"
LOG_DIR="$ROOT/.production-kawlink-notification-copy-hotfix-logs"
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
[ -z "$POST" ] || { echo "$POST"; fail "Hay cambios de producto posteriores al QA"; }
run git diff --check "$REMOTE/main"...HEAD

echo "▶ Verificar alcance exacto"
CHANGED="$(git diff --name-only "$REMOTE/main"...HEAD | grep -v "^${RUNNER}$" || true)"
EXPECTED_FILES="$(printf "%s\n" web/src/components/free-profile/IntapLinkGratisProfile.tsx web/src/components/trial/KawvoTrial.css | sort)"
ACTUAL_FILES="$(printf "%s\n" "$CHANGED" | sort)"
[ "$ACTUAL_FILES" = "$EXPECTED_FILES" ] || { echo "$ACTUAL_FILES"; fail "Hay archivos fuera del alcance"; }

run npm ci
run npm run build -w web
grep -R "Nuevo mensaje en notificaciones" web/dist/assets >/dev/null || fail "Falta aviso de notificación"
grep -R "presentación en KawLink" web/dist/assets >/dev/null || fail "Falta copy WhatsApp KawLink"
grep -R "#dc2626" web/dist/assets >/dev/null || fail "Falta fondo rojo del aviso"

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
TAG="prod-kawlink-notification-copy-hotfix-2026-09-20-$(date +%H%M%S)"
run git tag -a "$TAG" -m "KawLink notification color + WhatsApp copy hotfix 2026-09-20"
run git push "$REMOTE" "$TAG"
rm -rf "$LOG_DIR"
echo "============================================================"
echo "✓ HOTFIX PRODUCCIÓN DESPLEGADO"
echo "Production SHA: $PROD_SHA"
echo "Release tag: $TAG"
echo "Solo Web fue desplegado."
echo "============================================================"
