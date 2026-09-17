#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="main"
APP_PROJECT="intap-web2"
API_CFG="wrangler.toml"
EXPECTED_MIN_MAIN="4a838a3c91c6388eb302a510a7c7c7fdf4ffb26f"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }
check_url(){ local url="$1"; local code; code="$(curl -L -sS -o /dev/null -w '%{http_code}' "$url")"; [ "$code" = "200" ] || fail "$url respondió HTTP $code"; echo "✓ $url -> HTTP 200"; }

cd "$ROOT" || fail "No existe $ROOT"

cat <<'EOF'
============================================================
KAWVO LINK · REANUDAR RELEASE PRODUCCIÓN · CREDENCIALES V1
============================================================
Este runner continúa DESPUÉS de que D1 ya aplicó migraciones.

NO vuelve a aplicar migraciones.
Primero verifica:
- 0060 y 0061 registradas en d1_migrations
- tablas de Credenciales presentes
- session_id presente
- RESEND_API_KEY presente

Luego despliega:
- API producción
- Admin App producción

NO despliega Web público
NO modifica R2
============================================================
EOF

run git fetch github main
run git checkout "$BRANCH"
run git pull --ff-only github main

# Permitir únicamente artefactos locales .preview-* no versionados.
TRACKED_DIRTY="$(git status --porcelain --untracked-files=no)"
[ -z "$TRACKED_DIRTY" ] || { printf '%s\n' "$TRACKED_DIRTY"; fail "Hay cambios versionados locales"; }
OTHER_UNTRACKED="$(git ls-files --others --exclude-standard | grep -Ev '^\.preview-[^/]+/' || true)"
[ -z "$OTHER_UNTRACKED" ] || { printf '%s\n' "$OTHER_UNTRACKED"; fail "Hay archivos locales no reconocidos"; }
if git ls-files --others --exclude-standard | grep -Eq '^\.preview-[^/]+/'; then
  echo "✓ Artefactos locales .preview-* detectados e ignorados de forma segura"
fi

HEAD_SHA="$(git rev-parse HEAD)"
run git merge-base --is-ancestor "$EXPECTED_MIN_MAIN" "$HEAD_SHA"
run git diff --check

# Invariantes del código aprobado.
grep -Fq 'const KDF_ITERATIONS = 100000' api/src/account-access-methods.ts || fail "KDF no está fijado en 100000"
grep -Fq "app.post('/api/v1/auth/password/login'" api/src/account-access-methods.ts || fail "Falta login por contraseña"
grep -Fq "app.post('/api/v1/auth/password/reset/start'" api/src/account-access-methods.ts || fail "Falta recuperación de contraseña"
grep -Fq "app.post('/api/v1/auth/password/reset/confirm'" api/src/account-access-methods.ts || fail "Falta confirmación de recuperación"
grep -Fq "Olvidé mi contraseña" app/src/components/admin/AdminLogin.tsx || fail "Falta enlace Olvidé mi contraseña"
grep -Fq "import './account-access-methods'" api/src/preview-free-entry.ts || fail "Producción no ensambla account-access-methods"
if grep -Fq 'APP_PAGES_ORIGIN' api/wrangler.toml; then fail "Producción no debe usar APP_PAGES_ORIGIN"; fi

echo
echo "▶ Verificando RESEND_API_KEY en producción"
SECRET_LIST="$(cd api && npx wrangler secret list --config "$API_CFG" 2>/dev/null || true)"
printf '%s\n' "$SECRET_LIST" | grep -Fq 'RESEND_API_KEY' || fail "RESEND_API_KEY no está configurado en intap-api producción"
echo "✓ RESEND_API_KEY presente"

# Verificar D1 sin volver a modificarlo.
echo
echo "▶ Verificando migraciones y esquema D1 producción"
D1_CHECK_FILE="$(mktemp)"
trap 'rm -f "$D1_CHECK_FILE" /tmp/kawvo-reset-prod-check.json' EXIT
(
  cd api
  npx wrangler d1 execute intap_db --remote --config "$API_CFG" --command "SELECT COUNT(*) AS migrations_ok FROM d1_migrations WHERE name IN ('0060_account_access_methods.sql','0061_account_verified_actions_session.sql'); SELECT COUNT(*) AS tables_ok FROM sqlite_master WHERE type='table' AND name IN ('user_auth_identities','user_password_credentials','account_verification_challenges','account_verified_actions'); SELECT COUNT(*) AS session_col FROM pragma_table_info('account_verified_actions') WHERE name='session_id';"
) 2>&1 | tee "$D1_CHECK_FILE"

grep -Eq '"migrations_ok"[[:space:]]*:[[:space:]]*2' "$D1_CHECK_FILE" || fail "0060/0061 no figuran aplicadas en d1_migrations"
grep -Eq '"tables_ok"[[:space:]]*:[[:space:]]*4' "$D1_CHECK_FILE" || fail "Faltan tablas de Credenciales"
grep -Eq '"session_col"[[:space:]]*:[[:space:]]*1' "$D1_CHECK_FILE" || fail "Falta session_id en account_verified_actions"
echo "✓ D1 verificado; no se aplicaron migraciones nuevas"

# Compilar nuevamente desde el HEAD exacto que se va a desplegar.
run npm run build -w app
run bash -lc "cd api && npx tsc --noEmit"

# API primero: la App nueva depende de estos endpoints.
run bash -lc "cd api && npx wrangler deploy --config '$API_CFG'"

# Admin App producción.
run npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch main

# QA canónico.
echo
echo "▶ QA canónico producción"
check_url "https://app.intaprd.com/admin/login"
check_url "https://app.intaprd.com/admin/free"
check_url "https://app.intaprd.com/admin/free/account"
check_url "https://app.intaprd.com/admin/free/credentials"

RESET_CODE="$(curl -sS -o /tmp/kawvo-reset-prod-check.json -w '%{http_code}' \
  -H 'Content-Type: application/json' \
  -X POST 'https://app.intaprd.com/api/v1/auth/password/reset/start' \
  --data '{"email":"release-check-do-not-create@example.invalid"}')"
[ "$RESET_CODE" = "200" ] || { cat /tmp/kawvo-reset-prod-check.json || true; fail "Password reset público respondió HTTP $RESET_CODE"; }
echo "✓ Recuperación pública activa y anti-enumeración (HTTP 200 genérico)"

cat <<EOF
============================================================
✓ RELEASE PRODUCCIÓN · CREDENCIALES V1 COMPLETADO
============================================================
Main SHA: $HEAD_SHA
Producción App: https://app.intaprd.com/admin/login
Credenciales:   https://app.intaprd.com/admin/free/credentials
API: desplegada
D1: 0060/0061 verificadas; sin nuevas migraciones en esta reanudación
Web público: NO desplegado
R2: NO modificado
============================================================
EOF
