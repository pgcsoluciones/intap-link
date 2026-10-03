#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
REMOTE="github"
BRANCH="hotfix/free-tour-server-persistence-2026-10-03"
EXPECTED_MAIN_SHA="e7936177dc15ff2ab75563903464320b10be07fd"
APP_PROJECT="intap-web2"
LOG_DIR="$ROOT/.preview-free-tour-server-persistence-logs"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR"
mkdir -p "$LOG_DIR"

cat <<EOF
================================================================
KAWVO LINK · RECORRIDO AUTOMÁTICO · PERSISTENCIA REAL · PREVIEW
================================================================
- “Ya entendí” se guarda ahora en la cuenta, no solo en localStorage
- Dashboard, Mi cuenta y Team consultan la misma preferencia
- cerrar sesión / volver a entrar no reactiva el recorrido automático
- cambiar de navegador/dispositivo conserva la preferencia al iniciar sesión
- botón manual “Recorrido” sigue disponible
- Solo App + Worker Preview
- NO toca D1, R2, Web público ni Producción

Main esperado: $EXPECTED_MAIN_SHA
================================================================
EOF

run git fetch "$REMOTE" main "$BRANCH"
CURRENT_MAIN="$(git rev-parse "$REMOTE/main")"
[ "$CURRENT_MAIN" = "$EXPECTED_MAIN_SHA" ] || fail "main cambió: esperado $EXPECTED_MAIN_SHA, actual $CURRENT_MAIN"

run git switch "$BRANCH"
run git pull --ff-only "$REMOTE" "$BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Árbol local no limpio"; }
git merge-base --is-ancestor "$REMOTE/main" HEAD || fail "main y hotfix divergieron"

cat > "$LOG_DIR/allowed.txt" <<'EOF_ALLOWED'
api/src/free-appointments.ts
app/src/components/admin/free/FreeGuidedTour.tsx
app/src/components/admin/free/FreeAccountGuidedTour.tsx
app/src/components/admin/free/FreeTeamGuidedTour.tsx
app/src/components/admin/free/freeTourPersistence.ts
scripts/run-preview-free-tour-server-persistence-2026-10-03.sh
scripts/test-free-tour-server-persistence.mjs
EOF_ALLOWED

git diff --name-only "$REMOTE/main"...HEAD | sort > "$LOG_DIR/actual.txt"
sort "$LOG_DIR/allowed.txt" > "$LOG_DIR/allowed.sorted.txt"
diff -u "$LOG_DIR/allowed.sorted.txt" "$LOG_DIR/actual.txt" || fail "Hay archivos fuera del alcance del hotfix"

run git diff --check "$REMOTE/main"...HEAD
run npm ci
run node scripts/test-free-tour-server-persistence.mjs
run npm run build:preview -w app
run bash -lc 'cd api && npx tsc --noEmit'

echo; echo "▶ Deploy App Preview"
(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch "$BRANCH") 2>&1 | tee "$LOG_DIR/app.log"

echo; echo "▶ Deploy Worker Preview"
(
  cd api
  npx wrangler deploy --config wrangler.preview.toml --dry-run
  npx wrangler deploy --config wrangler.preview.toml
) 2>&1 | tee "$LOG_DIR/worker.log"

sleep 4
for url in "https://app.preview.intaprd.com/admin/login" "https://app.preview.intaprd.com/admin/free"; do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

rm -rf "$LOG_DIR"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Runner dejó cambios locales"; }

cat <<EOF
================================================================
✓ RECORRIDO AUTOMÁTICO · PERSISTENCIA REAL LISTA EN PREVIEW
================================================================
Feature SHA: $(git rev-parse HEAD)

QA:
1. Entra a /admin/free y pulsa “Ya entendí”.
2. Cierra sesión.
3. Vuelve a iniciar sesión: NO debe abrirse automáticamente.
4. Entra a Mi cuenta: NO debe abrirse automáticamente.
5. Si tienes Team, entra: tampoco debe autoabrirse.
6. Pulsa manualmente “Recorrido”: debe abrir normalmente.
7. Producción NO fue tocada.
================================================================
EOF
