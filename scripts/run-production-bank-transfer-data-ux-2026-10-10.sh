#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
REMOTE="github"
FEATURE_BRANCH="feature/bank-transfer-data-ux-2026-10-09"
EXPECTED_MAIN_SHA="bbaa3cc8fd94bf1ec91656f8f147660217e77465"
APPROVED_PREVIEW_SHA="a471799fcd7e44fdda2278d72a4122422e2a3f2e"
RUNNER_PATH="scripts/run-production-bank-transfer-data-ux-2026-10-10.sh"
WEB_PROJECT="intap-link"
APP_PROJECT="intap-web2"
PROD_DB="intap_db"
LOG_DIR="$ROOT/.production-bank-transfer-data-ux-2026-10-10"
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
KAWVO LINK · DATOS PARA TRANSFERENCIAS · PRODUCCIÓN
================================================================
Promueve únicamente el Preview aprobado.

Incluye:
- título “Datos para Transferencias”
- sección bancaria siempre desplegada
- cuenta pública: solo últimos 4 dígitos
- RNC público completo
- cédula pública: solo últimos 4 dígitos
- jerarquía: tipo -> cuenta / titular -> RNC o cédula
- CTA “Copiar cuenta” / “Copiar RNC/CÉD.”
- feedback temporal de copiado
- límite de cuentas Free configurable por usuario/perfil: 2, 3, 4 o 5
- límite patrocinado configurable por tenant: 2, 3, 4 o 5
- Free/Team + Patrocinado + Trial + Demo
- migración D1 0089

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

FEATURE_SHA="$(git rev-parse HEAD)"
echo "Feature release: $FEATURE_SHA"

git merge-base --is-ancestor "$APPROVED_PREVIEW_SHA" HEAD || fail "El Preview aprobado ya no es ancestro"
POST_APPROVAL="$(git diff --name-only "$APPROVED_PREVIEW_SHA"..HEAD | grep -v "^${RUNNER_PATH}$" || true)"
[ -z "$POST_APPROVAL" ] || { echo "$POST_APPROVAL"; fail "Hay cambios de producto posteriores al Preview aprobado"; }

git merge-base --is-ancestor "$REMOTE/main" HEAD || fail "main y feature divergieron"
[ "$(git rev-list --count HEAD.."$REMOTE/main")" = "0" ] || fail "La feature está detrás de main"

cat > "$LOG_DIR/expected-files.txt" <<'EOF_FILES'
api/migrations-preview/0089_sponsor_bank_account_limit.sql
api/migrations/0089_sponsor_bank_account_limit.sql
api/src/bank-accounts.ts
api/src/index.ts
api/src/preview-bank-accounts.ts
api/src/sponsored-bank-accounts.ts
api/src/sponsored-profiles.ts
api/src/trial-profiles.ts
app/src/components/admin/SuperAdminDashboard.tsx
app/src/components/admin/SuperAdminSponsors.tsx
app/src/components/admin/free/FreeBankAccounts.tsx
app/src/components/admin/sponsored/SponsoredBankAccounts.tsx
scripts/run-preview-bank-transfer-data-ux-2026-10-09.sh
scripts/run-production-bank-transfer-data-ux-2026-10-10.sh
scripts/test-bank-privacy-interaction-contract.mjs
web/src/components/demo/DemoBankAccounts.tsx
web/src/components/free-profile/PublicBankAccounts.tsx
web/src/components/sponsored/SponsoredBankAccounts.tsx
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
    [ "$migration" = "0089_sponsor_bank_account_limit.sql" ] || fail "Migración pendiente fuera del release: $migration"
  done <<< "$PENDING_FILES"
  echo "✓ Única migración pendiente permitida: 0089_sponsor_bank_account_limit.sql"
  (
    cd api
    npx wrangler d1 migrations apply "$PROD_DB" --remote --config wrangler.toml
  ) 2>&1 | tee -a "$MIGRATION_LOG"
  [ "${PIPESTATUS[0]}" -eq 0 ] || fail "Migración D1 Producción"
else
  echo "✓ No hay migraciones pendientes"
fi

echo; echo "▶ Verificar tablas de límites bancarios en Producción"
TABLES="$(
  cd api
  npx wrangler d1 execute "$PROD_DB" --remote --config wrangler.toml --json --command "
    SELECT name FROM sqlite_master
     WHERE type='table'
       AND name IN ('profile_bank_limits','sponsor_bank_limits')
     ORDER BY name;
  " 2>/dev/null
)"
python3 - "$TABLES" <<'PY'
import json,sys
data=json.loads(sys.argv[1])
rows=((data[0].get('results') if isinstance(data,list) and data else []) or [])
names={str(r.get('name') or '') for r in rows}
required={'profile_bank_limits','sponsor_bank_limits'}
missing=required-names
if missing:
    raise SystemExit('Faltan tablas: '+', '.join(sorted(missing)))
print('✓ profile_bank_limits y sponsor_bank_limits disponibles')
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

echo; echo "▶ Smoke Producción base"
for url in   "https://intaprd.com/"   "https://intaprd.com/demo"   "https://app.intaprd.com/admin/login"   "https://app.intaprd.com/superadmin"
do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

echo; echo "▶ Smoke API bancaria Free real"
FREE_BANK_SLUG="$(
  cd api
  npx wrangler d1 execute "$PROD_DB" --remote --config wrangler.toml --json --command "
    SELECT p.slug
      FROM profiles p
      JOIN profile_bank_accounts b ON b.profile_id=p.id AND b.is_active=1
      LEFT JOIN profile_bank_settings s ON s.profile_id=p.id
     WHERE p.is_active=1
       AND p.is_published=1
       AND COALESCE(s.is_enabled,1)=1
       AND NULLIF(TRIM(p.slug),'') IS NOT NULL
     GROUP BY p.id,p.slug,p.updated_at
     ORDER BY CASE WHEN lower(p.slug)='jlprince' THEN 0 ELSE 1 END, p.updated_at DESC
     LIMIT 1;
  " 2>/dev/null |
  python3 -c "import json,sys;d=json.load(sys.stdin);r=((d[0].get('results') if isinstance(d,list) and d else []) or []);print((r[0].get('slug') if r else '') or '')"
)"
[ -n "$FREE_BANK_SLUG" ] || fail "No existe perfil publicado con cuentas bancarias para smoke"

BANK_JSON="$LOG_DIR/free-bank-api.json"
curl -sS "https://api.intaprd.com/api/v1/public/profiles/$FREE_BANK_SLUG/bank-accounts" -o "$BANK_JSON"
python3 - "$BANK_JSON" <<'PY'
import json,re,sys
data=json.load(open(sys.argv[1],encoding='utf-8'))
if data.get('ok') is not True:
    raise SystemExit('API bancaria no respondió ok=true')
payload=data.get('data') or {}
if payload.get('enabled') is not True:
    raise SystemExit('Sección bancaria no está habilitada')
items=payload.get('items') or []
if not items:
    raise SystemExit('API bancaria no devolvió cuentas')
for item in items:
    number=str(item.get('display_number') or '')
    if not re.fullmatch(r'••••\s*.{4}',number):
        raise SystemExit('Número de cuenta público no conserva solo últimos 4')
    id_type=str(item.get('holder_id_type') or '').lower()
    id_display=str(item.get('holder_id_display') or '')
    if id_type=='cedula' and not re.fullmatch(r'••••\s*\d{4}',id_display):
        raise SystemExit('Cédula pública no conserva solo últimos 4')
    if id_type=='rnc' and not re.fullmatch(r'\d{9,20}',id_display):
        raise SystemExit('RNC público no está completo')
print(f"✓ API bancaria validada con {len(items)} cuenta(s)")
PY
echo "✓ Perfil bancario validado: /$FREE_BANK_SLUG"

echo; echo "▶ Smoke límites configurables en D1"
LIMIT_SCHEMA="$(
  cd api
  npx wrangler d1 execute "$PROD_DB" --remote --config wrangler.toml --json --command "
    SELECT 'free' AS scope, sql FROM sqlite_master WHERE type='table' AND name='profile_bank_limits'
    UNION ALL
    SELECT 'sponsored' AS scope, sql FROM sqlite_master WHERE type='table' AND name='sponsor_bank_limits';
  " 2>/dev/null
)"
python3 - "$LIMIT_SCHEMA" <<'PY'
import json,sys
data=json.loads(sys.argv[1])
rows=((data[0].get('results') if isinstance(data,list) and data else []) or [])
if len(rows)!=2:
    raise SystemExit('No se encontraron ambas tablas de límites')
for row in rows:
    sql=str(row.get('sql') or '')
    if 'BETWEEN 2 AND 5' not in sql:
        raise SystemExit('El límite no está restringido entre 2 y 5')
print('✓ Límites Free y Patrocinado restringidos a 2..5')
PY

echo; echo "▶ Promover release validado a main"
run git switch -C main "$REMOTE/main"
run git merge --ff-only "$REMOTE/$FEATURE_BRANCH"
run git push "$REMOTE" main
PROD_SHA="$(git rev-parse HEAD)"

run git fetch "$REMOTE" main
[ "$(git rev-parse "$REMOTE/main")" = "$PROD_SHA" ] || fail "main remoto no coincide con el SHA desplegado"

TAG="prod-bank-transfer-data-ux-2026-10-10-$(date +%H%M%S)"
run git tag -a "$TAG" -m "Kawvo Link transfer data UX and configurable bank limits production"
run git push "$REMOTE" "$TAG"

rm -rf "$LOG_DIR"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Runner dejó cambios locales"; }

cat <<EOF
================================================================
✓ DATOS PARA TRANSFERENCIAS · PRODUCCIÓN DESPLEGADA
================================================================
Production SHA: $PROD_SHA
Release tag:    $TAG
Previous main:  $PREVIOUS_MAIN
Worker Version: ${WORKER_VERSION:-ver salida Wrangler}
App Pages:      ${APP_ORIGIN:-ver salida Pages}
Web Pages:      ${WEB_ORIGIN:-ver salida Pages}

Incluye:
✓ “Datos para Transferencias”
✓ cuentas siempre desplegadas
✓ cuenta pública: últimos 4
✓ RNC completo / cédula últimos 4
✓ orden visual corregido
✓ CTA y feedback de copiado
✓ Free configurable 2..5 por usuario/perfil
✓ Patrocinado configurable 2..5 por tenant
✓ Free/Team + Patrocinado + Trial + Demo
================================================================
EOF
