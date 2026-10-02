#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
REMOTE="github"
BRANCH="fix/free-tour-auto-persistence"
EXPECTED_MAIN_SHA="d390d6fb2a07c0962446b0cbda00c49976b2dcbb"
APP_PROJECT="intap-web2"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"

cat <<EOF
============================================================
KAWVO LINK · RECORRIDO FREE · PERSISTENCIA · PREVIEW
============================================================
- Ya entendí desactiva el auto recorrido permanentemente
- Recorrido manual sigue disponible
- Dashboard espera identidad estable antes de auto iniciar
- Mi cuenta usa email estable antes de auto iniciar
- Team no se modifica
- Producción NO se toca
============================================================
EOF

run git fetch "$REMOTE" main "$BRANCH"
[ "$(git rev-parse "$REMOTE/main")" = "$EXPECTED_MAIN_SHA" ] || fail "main cambió; detener y auditar"
run git switch "$BRANCH"
run git pull --ff-only "$REMOTE" "$BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Árbol local no limpio"; }

git merge-base --is-ancestor "$REMOTE/main" HEAD || fail "main y feature divergieron"
run git diff --check "$REMOTE/main"...HEAD
run npm ci
run node scripts/test-free-tour-persistence.mjs
run npm run build:preview -w app

echo; echo "▶ Deploy App Preview"
npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch "$BRANCH"

cat <<EOF
============================================================
✓ RECORRIDO FREE · PERSISTENCIA LISTA EN PREVIEW
============================================================
Feature SHA: $(git rev-parse HEAD)

QA manual:
1. Inicia sesión y deja que aparezca el recorrido.
2. Pulsa "Ya entendí (no volver a mostrar)".
3. Cierra sesión e inicia sesión nuevamente.
4. El recorrido NO debe abrirse automáticamente.
5. Pulsa "Recorrido" manualmente: debe abrirse normalmente.
============================================================
EOF
