#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
REMOTE="github"
BRANCH="feature/bank-privacy-collapse-v1"
EXPECTED_MAIN_SHA="d278cc045ad2e0f1ea73681316f8187869a16212"
RUNNER_PATH="scripts/run-preview-bank-privacy-collapse-v1-2026-10-02.sh"
WEB_PROJECT="intap-link"
PREVIEW_CFG="$ROOT/api/wrangler.preview.toml"
PREVIEW_CFG_BAK="$ROOT/api/wrangler.preview.toml.bank-privacy-collapse.bak"
LOG_DIR="$ROOT/.preview-bank-privacy-collapse-logs"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" "$PREVIEW_CFG_BAK"
mkdir -p "$LOG_DIR"

cat <<EOF
================================================================
KAWVO LINK · PRIVACIDAD DE CUENTAS · PREVIEW
================================================================
- Sección bancaria contraída bajo “Cuentas”
- Botones sensibles: Cuenta / RNC / CÉD.
- Sin mensajes ni colores de “copiado”
- Colapso al tocar fuera, hacer scroll, salir de sección o tras 8 s de inactividad
- Aplica a Free/Team/Trial + Patrocinado + Demo
- Solo Web + Worker Preview como front door
- NO toca D1, R2, App ni Producción

Main esperado: $EXPECTED_MAIN_SHA
================================================================
EOF

run git fetch "$REMOTE" main "$BRANCH"
CURRENT_MAIN="$(git rev-parse "$REMOTE/main")"
[ "$CURRENT_MAIN" = "$EXPECTED_MAIN_SHA" ] || fail "main cambió: esperado $EXPECTED_MAIN_SHA, actual $CURRENT_MAIN"

run git switch "$BRANCH"
run git pull --ff-only "$REMOTE" "$BRANCH"

git restore -- "$RUNNER_PATH" 2>/dev/null || true
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Árbol local no limpio"; }
git merge-base --is-ancestor "$REMOTE/main" HEAD || fail "main y feature divergieron"

cat > "$LOG_DIR/allowed.txt" <<'EOF_ALLOWED'
scripts/run-preview-bank-privacy-collapse-v1-2026-10-02.sh
scripts/test-bank-privacy-interaction-contract.mjs
web/src/components/demo/DemoBankAccounts.css
web/src/components/demo/DemoBankAccounts.tsx
web/src/components/free-profile/PublicBankAccounts.tsx
web/src/components/sponsored/SponsoredBankAccounts.tsx
EOF_ALLOWED

git diff --name-only "$REMOTE/main"...HEAD | sort > "$LOG_DIR/actual.txt"
sort "$LOG_DIR/allowed.txt" > "$LOG_DIR/allowed.sorted.txt"
diff -u "$LOG_DIR/allowed.sorted.txt" "$LOG_DIR/actual.txt" || fail "Hay archivos fuera del alcance aprobado"

run git diff --check "$REMOTE/main"...HEAD
run npm ci
run node scripts/test-bank-privacy-interaction-contract.mjs
run npm run build:preview -w web
run bash -lc 'cd api && npx tsc --noEmit'

echo; echo "▶ Deploy Web Preview"
(npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch "$BRANCH") 2>&1 | tee "$LOG_DIR/web.log"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$LOG_DIR/web.log" | tail -1)"
[ -n "$WEB_ORIGIN" ] || fail "No pude detectar Web origin"

cp "$PREVIEW_CFG" "$PREVIEW_CFG_BAK"
restore_cfg(){
  if [ -f "$PREVIEW_CFG_BAK" ]; then
    cp "$PREVIEW_CFG_BAK" "$PREVIEW_CFG" 2>/dev/null || true
    rm -f "$PREVIEW_CFG_BAK"
  fi
}
trap restore_cfg EXIT

python3 - "$PREVIEW_CFG" "$WEB_ORIGIN" <<'PY'
from pathlib import Path
import re,sys
p=Path(sys.argv[1]); web=sys.argv[2]
s=p.read_text()
s,n=re.subn(r'WEB_PAGES_ORIGIN\s*=\s*"[^"]+"',f'WEB_PAGES_ORIGIN = "{web}"',s,count=1)
if n != 1: raise SystemExit("No pude fijar WEB_PAGES_ORIGIN Preview")
p.write_text(s)
PY

echo; echo "▶ Deploy Worker Preview (solo front door hacia nuevo Web origin)"
(
  cd api
  npx wrangler deploy --config wrangler.preview.toml --dry-run
  npx wrangler deploy --config wrangler.preview.toml
) 2>&1 | tee "$LOG_DIR/worker.log"

restore_cfg
trap - EXIT
sleep 4

for url in "https://preview.intaprd.com" "https://preview.intaprd.com/demo"; do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

rm -rf "$LOG_DIR"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Runner dejó cambios locales"; }

cat <<EOF
================================================================
✓ PRIVACIDAD DE CUENTAS LISTA EN PREVIEW
================================================================
Feature SHA: $(git rev-parse HEAD)
Web origin:  $WEB_ORIGIN

QA móvil:
1. “Cuentas” inicia contraído.
2. Flecha abre/cierra sin saltos visuales.
3. Botones muestran solo “Cuenta” y “RNC / CÉD.”.
4. Al pulsar no aparece check, verde ni mensaje de copiado.
5. Solo se percibe el hundimiento del botón.
6. Tras copiar, permanece abierto; se contrae a los 8 s si no hay nueva interacción.
7. Tocar fuera, hacer scroll o pasar a otra sección lo contrae.
8. Sin interacción, se contrae a los 8 s.
9. Enlace directo #bancos abre la sección automáticamente.
10. Revisar Free/Team/Trial, Patrocinado y Demo.
11. Producción NO fue tocada.
================================================================
EOF
