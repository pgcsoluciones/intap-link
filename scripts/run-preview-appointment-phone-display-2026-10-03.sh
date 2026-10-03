#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
REMOTE="github"
BRANCH="hotfix/appointment-phone-display-2026-10-03"
EXPECTED_MAIN_SHA="e7936177dc15ff2ab75563903464320b10be07fd"
LOG_DIR="$ROOT/.preview-appointment-phone-display-logs"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR"
mkdir -p "$LOG_DIR"

cat <<EOF
================================================================
KAWVO LINK · TELÉFONO NORMALIZADO EN AGENDA · PREVIEW
================================================================
- Corrige solo el texto generado de WhatsApp para solicitudes de agenda
- RD: 8097059802 / 18097059802 -> 809-705-9802
- Conserva el número almacenado/canónico para enlaces y lógica interna
- Free + Patrocinado
- Solo API Worker Preview
- NO toca D1, R2, App, Web ni Producción

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
api/src/sponsored-appointments.ts
scripts/run-preview-appointment-phone-display-2026-10-03.sh
scripts/test-appointment-phone-display-contract.mjs
EOF_ALLOWED

git diff --name-only "$REMOTE/main"...HEAD | sort > "$LOG_DIR/actual.txt"
sort "$LOG_DIR/allowed.txt" > "$LOG_DIR/allowed.sorted.txt"
diff -u "$LOG_DIR/allowed.sorted.txt" "$LOG_DIR/actual.txt" || fail "Hay archivos fuera del alcance del hotfix"

run git diff --check "$REMOTE/main"...HEAD
run node scripts/test-appointment-phone-display-contract.mjs
run bash -lc 'cd api && npx tsc --noEmit'

echo; echo "▶ Deploy Worker Preview"
(
  cd api
  npx wrangler deploy --config wrangler.preview.toml --dry-run
  npx wrangler deploy --config wrangler.preview.toml
) 2>&1 | tee "$LOG_DIR/worker.log"

sleep 4
for url in "https://preview.intaprd.com" "https://app.preview.intaprd.com"; do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

rm -rf "$LOG_DIR"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Runner dejó cambios locales"; }

cat <<EOF
================================================================
✓ TELÉFONO NORMALIZADO EN AGENDA · PREVIEW LISTO
================================================================
Feature SHA: $(git rev-parse HEAD)

QA:
1. Envía una nueva solicitud de agenda con 8097059802.
2. En WhatsApp debe leerse: Mi teléfono es 809-705-9802.
3. El enlace telefónico/WhatsApp debe seguir funcionando.
4. Repetir en Free y, si aplica, Patrocinado.
5. Producción NO fue tocada.
================================================================
EOF
