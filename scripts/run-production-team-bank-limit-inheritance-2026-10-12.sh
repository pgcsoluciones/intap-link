#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
REMOTE="github"
FEATURE_BRANCH="fix/team-bank-limit-inheritance-2026-10-10"
EXPECTED_MAIN_SHA="b8d5951d33b35ea686c64004656f08d53371855c"
APPROVED_PREVIEW_SHA="c2089af8c4868d534839647660ccfadb0fa4e9ac"
RUNNER_PATH="scripts/run-production-team-bank-limit-inheritance-2026-10-12.sh"
WEB_PROJECT="intap-link"
APP_PROJECT="intap-web2"
LOG_DIR="$ROOT/.production-team-bank-limit-inheritance-2026-10-12"
WEB_LOG="$LOG_DIR/web-pages-production.log"
APP_LOG="$LOG_DIR/app-pages-production.log"
WORKER_LOG="$LOG_DIR/worker-production.log"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR"
mkdir -p "$LOG_DIR"

cat <<EOF
================================================================
KAWVO LINK · HERENCIA Y CONTROL DE CUENTAS · PRODUCCIÓN
================================================================
Promueve exactamente el Preview aprobado.

Incluye:
- Free individual: 2, 3, 4 o 5 cuentas
- Team Master: define el límite
- Miembros Team: heredan automáticamente del Master
- Miembro Team: selector bloqueado en SuperAdmin
- Patrocinado: 2 a 5 por tenant
- Trial: 2 a 5 controladas por SuperAdmin
- Owner Trial: ve el límite, pero no puede modificarlo
- Sin migraciones D1

Main esperado:    $EXPECTED_MAIN_SHA
Preview aprobado: $APPROVED_PREVIEW_SHA
================================================================
EOF

run git fetch "$REMOTE" main "$FEATURE_BRANCH"
CURRENT_MAIN="$(git rev-parse "$REMOTE/main")"
[ "$CURRENT_MAIN" = "$EXPECTED_MAIN_SHA" ] || fail "main cambió: esperado $EXPECTED_MAIN_SHA, actual $CURRENT_MAIN. Detener y auditar."

run git switch "$FEATURE_BRANCH"
run git pull --ff-only "$REMOTE" "$FEATURE_BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Árbol local no limpio"; }

HEAD_SHA="$(git rev-parse HEAD)"
echo "Feature HEAD: $HEAD_SHA"
[ "$HEAD_SHA" = "$APPROVED_PREVIEW_SHA" ] || fail "HEAD no coincide con el Preview aprobado"

git merge-base --is-ancestor "$REMOTE/main" HEAD || fail "main y feature divergieron"
[ "$(git rev-list --count HEAD.."$REMOTE/main")" = "0" ] || fail "La feature está detrás de main"

cat > "$LOG_DIR/expected-files.txt" <<'EOF_FILES'
api/src/bank-accounts.ts
api/src/index.ts
api/src/preview-bank-accounts.ts
api/src/trial-online.ts
api/src/trial-profiles.ts
app/src/components/admin/SuperAdminDashboard.tsx
scripts/run-preview-team-bank-limit-inheritance-2026-10-10.sh
scripts/run-production-team-bank-limit-inheritance-2026-10-12.sh
scripts/test-bank-privacy-interaction-contract.mjs
web/src/components/trial/KawvoTrial.tsx
web/src/components/trial/TrialPanels.tsx
EOF_FILES

git diff --name-only "$REMOTE/main"...HEAD | sort > "$LOG_DIR/actual-files.txt"
sort "$LOG_DIR/expected-files.txt" > "$LOG_DIR/expected-files.sorted.txt"
diff -u "$LOG_DIR/expected-files.sorted.txt" "$LOG_DIR/actual-files.txt" || fail "El alcance del release no coincide exactamente con lo aprobado"

run git diff --check "$REMOTE/main"...HEAD

echo; echo "▶ Verificar configuración de Producción"
grep -Fq 'name = "intap-api"' api/wrangler.toml || fail "Worker incorrecto"
grep -Fq 'database_name = "intap_db"' api/wrangler.toml || fail "D1 incorrecta"
grep -Fq 'bucket_name = "intap-r2"' api/wrangler.toml || fail "R2 incorrecto"
grep -Fq 'APP_URL = "https://app.intaprd.com"' api/wrangler.toml || fail "APP_URL incorrecta"
grep -Fq 'WEB_URL = "https://intaprd.com"' api/wrangler.toml || fail "WEB_URL incorrecta"
grep -Fq 'VITE_API_URL=https://api.intaprd.com' web/.env.production || fail "Web API incorrecta"
grep -Fq 'VITE_APP_URL=https://app.intaprd.com' web/.env.production || fail "Web App incorrecta"
grep -Fq 'VITE_API_URL=https://api.intaprd.com' app/.env.production || fail "App API incorrecta"
grep -Fq 'VITE_WEB_URL=https://intaprd.com' app/.env.production || fail "App Web incorrecta"

run npm ci
run node scripts/test-bank-privacy-interaction-contract.mjs
run npm run build -w app
run npm run build -w web
grep -R -Fq 'https://api.intaprd.com' web/dist/assets || fail "Bundle Web Producción no apunta al API productivo"
if grep -R -Fq 'https://preview.intaprd.com' web/dist/assets; then fail "Bundle Web Producción contiene referencia Preview"; fi
run bash -lc 'cd api && npx tsc --noEmit'
run bash -lc 'cd api && npx wrangler deploy --config wrangler.toml --dry-run'

PREVIOUS_MAIN="$CURRENT_MAIN"

echo; echo "▶ Deploy Worker Producción"
(
  cd api
  npm run deploy:production
) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Producción"
WORKER_VERSION="$(grep -E 'Current Version ID:' "$WORKER_LOG" | tail -1 | sed -E 's/.*Current Version ID:[[:space:]]*//' || true)"

echo; echo "▶ Deploy App Producción"
(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch main) 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App Producción"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$APP_LOG" | tail -1 || true)"

echo; echo "▶ Deploy Web Producción"
(npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch main) 2>&1 | tee "$WEB_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Web Producción"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$WEB_LOG" | tail -1 || true)"

sleep 5

echo; echo "▶ Smoke Producción base"
for url in   "https://intaprd.com/"   "https://intaprd.com/demo"   "https://app.intaprd.com/admin/login"   "https://app.intaprd.com/superadmin"
do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

echo; echo "▶ Verificar estructura Team en D1 Producción"
TEAM_SCHEMA="$(
  cd api
  npx wrangler d1 execute intap_db --remote --config wrangler.toml --json --command "
    SELECT name FROM sqlite_master
    WHERE type='table' AND name IN ('team_members','team_workspaces','profile_bank_limits')
    ORDER BY name;
  " 2>/dev/null
)"
python3 - "$TEAM_SCHEMA" <<'PY'
import json,sys
data=json.loads(sys.argv[1])
rows=((data[0].get('results') if isinstance(data,list) and data else []) or [])
names={str(r.get('name') or '') for r in rows}
required={'team_members','team_workspaces','profile_bank_limits'}
missing=required-names
if missing:
    raise SystemExit('Faltan tablas requeridas: '+', '.join(sorted(missing)))
print('✓ Estructura Team y límites Free disponible')
PY

echo; echo "▶ Smoke API SuperAdmin/Team por contrato estático"
grep -Fq 'bank_account_limit_inherited' api/src/index.ts || fail "Falta bandera de herencia Team"
grep -Fq 'Modifica el límite del Master Team' api/src/index.ts || fail "Falta bloqueo de override en miembro Team"
grep -Fq 'Heredado del Master Team' app/src/components/admin/SuperAdminDashboard.tsx || fail "Falta indicador visual de herencia"

echo; echo "▶ Smoke Trial 2..5"
grep -Fq 'Cuentas bancarias permitidas' web/src/components/trial/TrialPanels.tsx || fail "Falta selector Trial"
grep -Fq 'createBankLimit' web/src/components/trial/KawvoTrial.tsx || fail "Falta límite Trial al crear"
grep -Fq 'normalizeTrialBankLimit' api/src/trial-profiles.ts || fail "Falta enforcement Trial"
grep -Fq 'normalizeOwnerTrialBankModule' api/src/trial-online.ts || fail "Owner Trial podría alterar límite"

echo; echo "▶ Promover release validado a main"
run git switch -C main "$REMOTE/main"
run git merge --ff-only "$REMOTE/$FEATURE_BRANCH"
run git push "$REMOTE" main
PROD_SHA="$(git rev-parse HEAD)"

run git fetch "$REMOTE" main
[ "$(git rev-parse "$REMOTE/main")" = "$PROD_SHA" ] || fail "main remoto no coincide con el SHA desplegado"

TAG="prod-team-bank-limit-inheritance-2026-10-12-$(date +%H%M%S)"
run git tag -a "$TAG" -m "Kawvo Link Team bank limit inheritance and Trial controls production"
run git push "$REMOTE" "$TAG"

rm -rf "$LOG_DIR"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Runner dejó cambios locales"; }

cat <<EOF
================================================================
✓ HERENCIA Y CONTROL DE CUENTAS · PRODUCCIÓN DESPLEGADA
================================================================
Production SHA: $PROD_SHA
Release tag:    $TAG
Previous main:  $PREVIOUS_MAIN
Worker Version: ${WORKER_VERSION:-ver salida Wrangler}
App Pages:      ${APP_ORIGIN:-ver salida Pages}
Web Pages:      ${WEB_ORIGIN:-ver salida Pages}

Incluye:
✓ Free individual 2..5
✓ Team Master define límite
✓ miembros Team heredan automáticamente
✓ selector miembro Team bloqueado
✓ Patrocinado 2..5 por tenant
✓ Trial 2..5 por SuperAdmin
✓ owner Trial no puede alterar el límite
================================================================
EOF
