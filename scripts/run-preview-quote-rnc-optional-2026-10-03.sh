#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
REMOTE="github"
BRANCH="feature/quote-rnc-optional-2026-10-03"
EXPECTED_MAIN_SHA="e7936177dc15ff2ab75563903464320b10be07fd"
WEB_PROJECT="intap-link"
PREVIEW_CFG="$ROOT/api/wrangler.preview.toml"
PREVIEW_CFG_BAK="$ROOT/api/wrangler.preview.toml.quote-rnc.bak"
LOG_DIR="$ROOT/.preview-quote-rnc-logs"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" "$PREVIEW_CFG_BAK"
mkdir -p "$LOG_DIR"

cat <<EOF
================================================================
KAWVO LINK · RNC OPCIONAL EN COTIZACIÓN · PREVIEW
================================================================
- agrega campo RNC (opcional)
- Free + Patrocinado
- solo acepta dígitos, máximo 11
- si se completa, viaja en el mensaje de WhatsApp/correo
- si se deja vacío, no aparece en el mensaje
- NO toca D1, R2, App ni Producción

Main esperado: $EXPECTED_MAIN_SHA
================================================================
EOF

run git fetch "$REMOTE" main "$BRANCH"
CURRENT_MAIN="$(git rev-parse "$REMOTE/main")"
[ "$CURRENT_MAIN" = "$EXPECTED_MAIN_SHA" ] || fail "main cambió: esperado $EXPECTED_MAIN_SHA, actual $CURRENT_MAIN"

run git switch "$BRANCH"
run git pull --ff-only "$REMOTE" "$BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Árbol local no limpio"; }
git merge-base --is-ancestor "$REMOTE/main" HEAD || fail "main y feature divergieron"

cat > "$LOG_DIR/allowed.txt" <<'EOF_ALLOWED'
scripts/run-preview-quote-rnc-optional-2026-10-03.sh
scripts/test-quote-rnc-optional-contract.mjs
web/src/components/free-profile/FreeContactActions.tsx
web/src/components/sponsored/SponsoredProfile.tsx
EOF_ALLOWED

git diff --name-only "$REMOTE/main"...HEAD | sort > "$LOG_DIR/actual.txt"
sort "$LOG_DIR/allowed.txt" > "$LOG_DIR/allowed.sorted.txt"
diff -u "$LOG_DIR/allowed.sorted.txt" "$LOG_DIR/actual.txt" || fail "Hay archivos fuera del alcance"

run git diff --check "$REMOTE/main"...HEAD
run npm ci
run node scripts/test-quote-rnc-optional-contract.mjs
run npm run build:preview -w web

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

echo; echo "▶ Deploy Worker Preview (front door)"
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
✓ RNC OPCIONAL EN COTIZACIÓN · PREVIEW LISTO
================================================================
Feature SHA: $(git rev-parse HEAD)
Web origin:  $WEB_ORIGIN

QA:
1. Abrir Cotizar / información.
2. Debajo de Correo debe aparecer RNC (opcional).
3. Dejarlo vacío: la solicitud debe enviarse igual.
4. Completarlo: el mensaje debe incluir “Mi RNC es ...”.
5. Revisar Free y Patrocinado.
6. Producción NO fue tocada.
================================================================
EOF
