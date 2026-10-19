#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
REMOTE="github"
FEATURE_BRANCH="release/free-demo-master-v2-production-2026-10-19"
EXPECTED_MAIN_SHA="24ae610e929ae58910c05e19ec27ed7be3c8a8f6"
APPROVED_PREVIEW_SHA="357e97275f376dce769072f0541ec55b98842c37"
RUNNER_PATH="scripts/run-production-free-demo-master-v2-2026-10-19.sh"
WEB_PROJECT="intap-link"
APP_PROJECT="intap-web2"
PROD_DB="intap_db"
LOG_DIR="$ROOT/.production-free-demo-master-v2-2026-10-19"
WEB_LOG="$LOG_DIR/web-pages-production.log"
APP_LOG="$LOG_DIR/app-pages-production.log"
WORKER_LOG="$LOG_DIR/worker-production.log"
MIGRATION_LOG="$LOG_DIR/d1-production-migrations.log"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR"
mkdir -p "$LOG_DIR"

cat <<EOF
================================================================
KAWVO LINK · FREE DEMO MASTER V2 · PRODUCCIÓN
================================================================
Promueve únicamente el contenido aprobado en Preview.

Incluye:
- creación de Free real en borrador desde SuperAdmin
- owner sintético aislado y administración delegada sin impersonación
- publicación con slug permanente
- panel Free real después de publicar
- portafolio 10 / quick actions 3 / links 3 / Servicios 0
- Horario + Cotizar + Agenda sobre el núcleo Free
- banco de demostración y backfill para Demos antiguas
- avatar y portada administrables
- claim de un solo uso + Google / correo seguro
- transferencia final de ownership al usuario Free real
- preserva login/scan, bancos Team, Agenda WhatsApp, Trial y Patrocinado
- migración D1 0088 Free Demo Master V2

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
echo "Release runner HEAD: $HEAD_SHA"

git merge-base --is-ancestor "$APPROVED_PREVIEW_SHA" "$EXPECTED_MAIN_SHA" || fail "El Preview aprobado no es ancestro del main actual"
MAIN_AFTER_PREVIEW="$(git diff --name-only "$APPROVED_PREVIEW_SHA".."$EXPECTED_MAIN_SHA" || true)"
MAIN_AFTER_PREVIEW_PRODUCT="$(printf '%s\n' "$MAIN_AFTER_PREVIEW" | grep -v "^${RUNNER_PATH}$" | sed '/^$/d' || true)"
[ -z "$MAIN_AFTER_PREVIEW_PRODUCT" ] || { echo "$MAIN_AFTER_PREVIEW_PRODUCT"; fail "main contiene cambios de producto posteriores al Preview aprobado"; }
echo "✓ main actual contiene exactamente el producto aprobado; solo cambió el runner de Producción"

git merge-base --is-ancestor "$REMOTE/main" HEAD || fail "La rama de release no desciende del main actual"
POST_MAIN="$(git diff --name-only "$REMOTE/main"...HEAD | grep -v "^${RUNNER_PATH}$" || true)"
[ -z "$POST_MAIN" ] || { echo "$POST_MAIN"; fail "La rama de release contiene cambios fuera del runner"; }

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

echo; echo "▶ Contratos y regresiones"
run npm ci
run node scripts/test-free-demo-master-v2-contract.mjs
run node scripts/test-agenda-phone-normalization-contract.mjs
run node scripts/test-bank-privacy-interaction-contract.mjs
run node scripts/test-login-sponsor-release-hotfix-2026-10-05.mjs

grep -Fq "profileBankAccountLimit" api/src/bank-accounts.ts || fail "Se perdió límite bancario actual 2..5/Team"
grep -Fq "team_members" api/src/bank-accounts.ts || fail "Se perdió herencia bancaria Team"
grep -Fq "applyFreeDemoDelegation" api/src/bank-accounts.ts || fail "Falta delegación Demo en bancos"
grep -Fq "clearScanCode()" app/src/components/admin/AdminGuard.tsx || fail "Se perdió limpieza de scan stale"
if grep -Fq "apiPost('/public/artifacts/scan/start'" app/src/components/admin/AdminGuard.tsx; then
  fail "Regresó la recreación automática del scan stale en AdminGuard"
fi
grep -Fq "activeFreeDemoDelegationId" app/src/components/admin/AdminGuard.tsx || fail "Falta navegación de delegación Demo"
git diff --quiet "$REMOTE/main"...HEAD -- app/public/sw.js || fail "Free Demo no debe alterar el Service Worker actual"

echo; echo "▶ Builds y TypeScript"
run npm run build -w web
run npm run build -w app
grep -R -Fq 'https://api.intaprd.com' web/dist/assets || fail "Bundle Web Producción no apunta al API productivo"
if grep -R -Fq 'https://preview.intaprd.com' web/dist/assets; then fail "Bundle Web Producción contiene referencia Preview"; fi
run bash -lc 'cd api && npx tsc --noEmit'
run bash -lc 'cd api && npx wrangler deploy --config wrangler.toml --dry-run'

echo; echo "▶ Consultar migraciones D1 Producción"
(
  cd api
  npx wrangler d1 migrations list "$PROD_DB" --remote --config wrangler.toml
) 2>&1 | tee "$MIGRATION_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "No pude consultar migraciones D1"

PENDING_FILES="$(grep -Eo '[0-9]{4}_[A-Za-z0-9._-]+\.sql' "$MIGRATION_LOG" | sort -u || true)"
if [ -n "$PENDING_FILES" ]; then
  while IFS= read -r migration; do
    [ -z "$migration" ] && continue
    [ "$migration" = "0088_free_demo_master_v2.sql" ] || fail "Migración pendiente fuera del release: $migration"
  done <<< "$PENDING_FILES"
  echo "✓ Única migración pendiente permitida: 0088_free_demo_master_v2.sql"
  (
    cd api
    npx wrangler d1 migrations apply "$PROD_DB" --remote --config wrangler.toml
  ) 2>&1 | tee -a "$MIGRATION_LOG"
  [ "${PIPESTATUS[0]}" -eq 0 ] || fail "Migración D1 Producción"
else
  echo "✓ No hay migraciones pendientes"
fi

echo; echo "▶ Verificar schema Free Demo en Producción"
SCHEMA="$(
  cd api
  npx wrangler d1 execute "$PROD_DB" --remote --config wrangler.toml --json --command "
    SELECT name FROM sqlite_master
     WHERE type='table'
       AND name IN ('free_demo_v2_profiles','free_demo_v2_claims')
     ORDER BY name;
    SELECT name,sql FROM sqlite_master
     WHERE type='index'
       AND name='idx_profiles_user_unique';
  " 2>/dev/null
)"
python3 - "$SCHEMA" <<'PY'
import json,sys
data=json.loads(sys.argv[1])
rows=[]
for block in data if isinstance(data,list) else []:
    rows.extend(block.get('results') or [])
names={str(r.get('name') or '') for r in rows}
required={'free_demo_v2_profiles','free_demo_v2_claims','idx_profiles_user_unique'}
missing=required-names
if missing:
    raise SystemExit('Falta schema requerido: '+', '.join(sorted(missing)))
print('✓ Schema Free Demo v2 + unique Free disponibles')
PY

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

echo; echo "▶ Smoke Producción"
for url in \
  "https://intaprd.com/" \
  "https://intaprd.com/demo" \
  "https://app.intaprd.com/admin/login" \
  "https://app.intaprd.com/superadmin" \
  "https://app.intaprd.com/superadmin/free-demos" \
  "https://app.intaprd.com/claim/free-demo"
do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

PROTECTED_CODE="$(curl -sS -o "$LOG_DIR/protected.json" -w '%{http_code}' https://api.intaprd.com/api/v1/superadmin/free-demo-v2/templates)"
[ "$PROTECTED_CODE" = "401" ] || fail "API SuperAdmin Free Demo no está protegida: HTTP $PROTECTED_CODE"
echo "✓ API Free Demo v2 protegida sin sesión"

echo; echo "▶ Registrar runner corregido en main después del deploy"
run git switch -C main "$REMOTE/main"
run git merge --ff-only "$REMOTE/$FEATURE_BRANCH"
run git push "$REMOTE" main
PROD_SHA="$(git rev-parse HEAD)"

run git fetch "$REMOTE" main
[ "$(git rev-parse "$REMOTE/main")" = "$PROD_SHA" ] || fail "main remoto no coincide con el SHA desplegado"

TAG="prod-free-demo-master-v2-2026-10-19-$(date +%H%M%S)"
run git tag -a "$TAG" -m "Kawvo Link Free Demo Master V2 production"
run git push "$REMOTE" "$TAG"

rm -rf "$LOG_DIR"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Runner dejó cambios locales"; }

cat <<EOF
================================================================
✓ FREE DEMO MASTER V2 · PRODUCCIÓN DESPLEGADA
================================================================
Production SHA: $PROD_SHA
Release tag:    $TAG
Previous main:  $PREVIOUS_MAIN
Worker Version: ${WORKER_VERSION:-ver salida Wrangler}
App Pages:      ${APP_ORIGIN:-ver salida Pages}
Web Pages:      ${WEB_ORIGIN:-ver salida Pages}

Validación manual final:
1. SuperAdmin → Demos Free.
2. Crear una Demo desde plantilla.
3. Editar y publicar.
4. Entrar a "Administrar panel Free".
5. Confirmar identidad, contacto, portafolio, diseño, horario, Agenda y bancos.
6. Generar claim.
7. Reclamar con usuario real y confirmar transferencia de ownership.
================================================================
EOF
