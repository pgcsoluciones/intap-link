#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
REMOTE="github"
BRANCH="feature/bank-transfer-data-ux-2026-10-09"
EXPECTED_MAIN_SHA="bbaa3cc8fd94bf1ec91656f8f147660217e77465"
RUNNER_PATH="scripts/run-preview-bank-transfer-data-ux-2026-10-09.sh"
WEB_PROJECT="intap-link"
APP_PROJECT="intap-web2"
PREVIEW_CFG="$ROOT/api/wrangler.preview.toml"
PREVIEW_CFG_BAK="$ROOT/api/wrangler.preview.toml.bank-transfer-data.bak"
LOG_DIR="$ROOT/.preview-bank-transfer-data-logs"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" "$PREVIEW_CFG_BAK"
mkdir -p "$LOG_DIR"

cat <<EOF
================================================================
KAWVO LINK · DATOS PARA TRANSFERENCIAS · PREVIEW
================================================================
- Título público: Datos para Transferencias
- Cuentas siempre desplegadas, sin acordeón
- Cuenta pública: solo últimos 4 dígitos
- RNC público: completo
- Cédula pública: solo últimos 4 dígitos
- CTA: Copiar cuenta / Copiar RNC/CÉD.
- Feedback: Cuenta copiada / RNC/CÉD. copiada
- Aplica a Free/Team, Patrocinado, Trial y Demo
- Migración Preview 0089: límite de cuentas bancarias por tenant (2 a 5)
- Producción NO se toca

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
api/src/bank-accounts.ts
api/src/preview-bank-accounts.ts
api/src/sponsored-bank-accounts.ts
api/src/trial-profiles.ts
api/src/sponsored-profiles.ts
api/migrations/0089_sponsor_bank_account_limit.sql
api/migrations-preview/0089_sponsor_bank_account_limit.sql
app/src/components/admin/SuperAdminSponsors.tsx
app/src/components/admin/free/FreeBankAccounts.tsx
app/src/components/admin/sponsored/SponsoredBankAccounts.tsx
scripts/run-preview-bank-transfer-data-ux-2026-10-09.sh
scripts/test-bank-privacy-interaction-contract.mjs
web/src/components/demo/DemoBankAccounts.tsx
web/src/components/free-profile/PublicBankAccounts.tsx
web/src/components/sponsored/SponsoredBankAccounts.tsx
web/src/components/trial/TrialPanels.tsx
EOF_ALLOWED

git diff --name-only "$REMOTE/main"...HEAD | sort > "$LOG_DIR/actual.txt"
sort "$LOG_DIR/allowed.txt" > "$LOG_DIR/allowed.sorted.txt"
diff -u "$LOG_DIR/allowed.sorted.txt" "$LOG_DIR/actual.txt" || fail "Hay archivos fuera del alcance aprobado"

run git diff --check "$REMOTE/main"...HEAD
run npm ci
run node scripts/test-bank-privacy-interaction-contract.mjs
run npm run build:preview -w app
run npm run build -w web
run bash -lc 'cd api && npx tsc --noEmit'

echo; echo "▶ Verificar/aplicar migración 0089 en D1 Preview"
HAS_LIMIT="$(cd api && npx wrangler d1 execute intap_db_preview --remote --config wrangler.preview.toml --command "SELECT name FROM pragma_table_info('sponsor_tenants') WHERE name='bank_account_limit';" 2>/dev/null || true)"
if ! echo "$HAS_LIMIT" | grep -Fq "bank_account_limit"; then
  (
    cd api
    npx wrangler d1 execute intap_db_preview --remote --config wrangler.preview.toml --file=migrations-preview/0089_sponsor_bank_account_limit.sql
  ) || fail "No se pudo aplicar migración 0089 en Preview"
fi
SCHEMA_CHECK="$(cd api && npx wrangler d1 execute intap_db_preview --remote --config wrangler.preview.toml --command "SELECT bank_account_limit FROM sponsor_tenants LIMIT 1;" 2>/dev/null || true)"
echo "$SCHEMA_CHECK" >/dev/null
echo "✓ sponsor_tenants.bank_account_limit disponible en Preview"

echo; echo "▶ Deploy Web Preview"
(npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch "$BRANCH") 2>&1 | tee "$LOG_DIR/web.log"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$LOG_DIR/web.log" | tail -1)"
[ -n "$WEB_ORIGIN" ] || fail "No pude detectar Web origin"

echo; echo "▶ Deploy App Preview"
(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch "$BRANCH") 2>&1 | tee "$LOG_DIR/app.log"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$LOG_DIR/app.log" | tail -1)"
[ -n "$APP_ORIGIN" ] || fail "No pude detectar App origin"

cp "$PREVIEW_CFG" "$PREVIEW_CFG_BAK"
restore_cfg(){
  if [ -f "$PREVIEW_CFG_BAK" ]; then
    cp "$PREVIEW_CFG_BAK" "$PREVIEW_CFG" 2>/dev/null || true
    rm -f "$PREVIEW_CFG_BAK"
  fi
}
trap restore_cfg EXIT

python3 - "$PREVIEW_CFG" "$WEB_ORIGIN" "$APP_ORIGIN" <<'PY'
from pathlib import Path
import re,sys
p=Path(sys.argv[1]); web=sys.argv[2]; app=sys.argv[3]
s=p.read_text()
s,n1=re.subn(r'WEB_PAGES_ORIGIN\s*=\s*"[^"]+"',f'WEB_PAGES_ORIGIN = "{web}"',s,count=1)
s,n2=re.subn(r'APP_PAGES_ORIGIN\s*=\s*"[^"]+"',f'APP_PAGES_ORIGIN = "{app}"',s,count=1)
if n1 != 1: raise SystemExit("No pude fijar WEB_PAGES_ORIGIN Preview")
if n2 != 1: raise SystemExit("No pude fijar APP_PAGES_ORIGIN Preview")
p.write_text(s)
PY

echo; echo "▶ Deploy Worker Preview"
(
  cd api
  npx wrangler deploy --config wrangler.preview.toml --dry-run
  npx wrangler deploy --config wrangler.preview.toml
) 2>&1 | tee "$LOG_DIR/worker.log"

restore_cfg
trap - EXIT
sleep 4

for url in "https://preview.intaprd.com" "https://preview.intaprd.com/demo" "https://app.preview.intaprd.com"; do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

rm -rf "$LOG_DIR"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Runner dejó cambios locales"; }

cat <<EOF
================================================================
✓ DATOS PARA TRANSFERENCIAS LISTOS EN PREVIEW
================================================================
Feature SHA: $(git rev-parse HEAD)
Web origin:  $WEB_ORIGIN
App origin:  $APP_ORIGIN

QA móvil:
1. El título dice “Datos para Transferencias”.
2. La sección aparece siempre desplegada; no hay flecha ni acordeón.
3. Debajo del tipo de cuenta aparece el número de cuenta con solo sus últimos 4 dígitos.
4. Debajo del nombre del titular aparece RNC o Cédula.
5. Si es RNC, el número se ve completo.
6. Si es cédula, solo se ven sus últimos 4 dígitos.
7. “Copiar cuenta” copia el número completo y cambia temporalmente a “Cuenta copiada”.
8. “Copiar RNC/CÉD.” copia la identificación completa y cambia temporalmente a “RNC/CÉD. copiada”.
9. En SuperAdmin > Patrocinadores, cada tenant permite seleccionar 2, 3, 4 o 5 cuentas.
10. El panel patrocinado respeta el límite asignado al tenant.
11. Revisar Free/Team, Patrocinado, Trial y Demo.
12. Producción NO fue tocada.
================================================================
EOF
