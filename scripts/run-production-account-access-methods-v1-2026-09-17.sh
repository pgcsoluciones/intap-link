#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="main"
RELEASE_BASE="cc95950ef03894d7298ba6de0cf0bd09093a3f94"
APP_PROJECT="intap-web2"
API_CFG="wrangler.toml"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }
check_url(){ local url="$1"; local code; code="$(curl -L -sS -o /dev/null -w '%{http_code}' "$url")"; [ "$code" = "200" ] || fail "$url respondió HTTP $code"; echo "✓ $url -> HTTP 200"; }

cd "$ROOT" || fail "No existe $ROOT"

cat <<'EOF'
============================================================
KAWVO LINK · RELEASE PRODUCCIÓN · CREDENCIALES V1
============================================================
Incluye:
- Google existente sin cambios funcionales de acceso
- Correo seguro / OTP existente
- Contraseña Kawvo independiente
- Crear y cambiar contraseña con OTP
- Cambio de correo con doble verificación
- "Olvidé mi contraseña" con OTP
- PBKDF2-SHA256 · 100000 iteraciones
- bloqueo tras intentos fallidos
- autorización sensible de un solo uso
- recuperación con respuesta anti-enumeración

DESPLIEGA:
- Admin App (intap-web2)
- API producción (intap-api)
- migraciones D1 0060/0061 mediante Wrangler migrations

NO despliega Web público
NO modifica R2
============================================================
EOF

run git fetch github main
run git checkout "$BRANCH"
run git pull --ff-only github main
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Árbol local con cambios"; }

HEAD_SHA="$(git rev-parse HEAD)"
run git merge-base --is-ancestor "$RELEASE_BASE" "$HEAD_SHA"
run git diff --check "$RELEASE_BASE...HEAD"

echo
echo "▶ Verificación estricta de alcance"
CHANGED="$(git diff --name-only "$RELEASE_BASE...HEAD")"
printf '%s\n' "$CHANGED"

# No se permite tocar Web público ni infraestructura R2.
if printf '%s\n' "$CHANGED" | grep -Eq '^(web/|functions/)'; then
  fail "El release contiene cambios fuera de Admin/API permitidos"
fi

# Producto permitido: credenciales/autenticación + ensamblaje API + migraciones + scripts.
BAD="$(printf '%s\n' "$CHANGED" | grep -Ev '^(api/migrations(-preview)?/006[01]_account_|api/src/account-access-methods\.ts$|api/src/index\.ts$|api/src/preview-free-entry\.ts$|api/wrangler\.preview\.toml$|app/src/App\.tsx$|app/src/components/admin/AdminLogin\.tsx$|app/src/components/admin/free/FreeAccount\.tsx$|app/src/components/admin/free/FreeCredentials\.tsx$|scripts/)' || true)"
[ -z "$BAD" ] || { echo "$BAD"; fail "Archivos no autorizados en el alcance"; }

# Invariantes de seguridad y producto.
grep -Fq 'const KDF_ITERATIONS = 100000' api/src/account-access-methods.ts || fail "KDF no está fijado en 100000"
grep -Fq "app.post('/api/v1/auth/password/login'" api/src/account-access-methods.ts || fail "Falta login por contraseña"
grep -Fq "app.post('/api/v1/auth/password/reset/start'" api/src/account-access-methods.ts || fail "Falta inicio de recuperación"
grep -Fq "app.post('/api/v1/auth/password/reset/confirm'" api/src/account-access-methods.ts || fail "Falta confirmación de recuperación"
grep -Fq "Olvidé mi contraseña" app/src/components/admin/AdminLogin.tsx || fail "Falta enlace Olvidé mi contraseña"
grep -Fq "import './account-access-methods'" api/src/preview-free-entry.ts || fail "Producción no ensambla account-access-methods"
grep -Fq 'main = "src/preview-free-entry.ts"' api/wrangler.toml || fail "Entry point de producción inesperado"
if grep -Fq 'APP_PAGES_ORIGIN' api/wrangler.toml; then fail "Producción no debe usar APP_PAGES_ORIGIN"; fi

echo "✓ Alcance e invariantes verificados"

# Secret requerido para OTP / recuperación.
echo
echo "▶ Verificando RESEND_API_KEY en Worker producción"
SECRET_LIST="$(cd api && npx wrangler secret list --config "$API_CFG" 2>/dev/null || true)"
printf '%s\n' "$SECRET_LIST" | grep -Fq 'RESEND_API_KEY' || fail "RESEND_API_KEY no está configurado en intap-api producción"
echo "✓ RESEND_API_KEY presente"

# Builds antes de tocar producción.
run npm run build -w app
run bash -lc "cd api && npx tsc --noEmit"

# Migraciones oficiales D1: Wrangler aplica únicamente pendientes y registra historial.
echo
echo "▶ Migraciones pendientes D1 producción"
(
  cd api
  npx wrangler d1 migrations list intap_db --remote --config "$API_CFG"
) || fail "No se pudieron listar migraciones"

run bash -lc "cd api && npx wrangler d1 migrations apply intap_db --remote --config '$API_CFG'"

# Validar esquema exacto después de migraciones.
echo
echo "▶ Validando esquema de Credenciales en D1 producción"
SCHEMA_CHECK="$(cd api && npx wrangler d1 execute intap_db --remote --config "$API_CFG" --command \"SELECT COUNT(*) AS tables_ok FROM sqlite_master WHERE type='table' AND name IN ('user_auth_identities','user_password_credentials','account_verification_challenges','account_verified_actions'); SELECT COUNT(*) AS session_col FROM pragma_table_info('account_verified_actions') WHERE name='session_id';\" 2>&1)"
printf '%s\n' "$SCHEMA_CHECK"
printf '%s\n' "$SCHEMA_CHECK" | grep -Eq '"tables_ok"[[:space:]]*:[[:space:]]*4' || fail "Faltan tablas de Credenciales"
printf '%s\n' "$SCHEMA_CHECK" | grep -Eq '"session_col"[[:space:]]*:[[:space:]]*1' || fail "Falta session_id en account_verified_actions"
echo "✓ Esquema D1 validado"

# API primero: la App nueva depende de estos endpoints.
run bash -lc "cd api && npx wrangler deploy --config '$API_CFG'"

# Admin App producción.
run npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch main

# QA HTTP canónico.
echo
echo "▶ QA canónico producción"
check_url "https://app.intaprd.com/admin/login"
check_url "https://app.intaprd.com/admin/free"
check_url "https://app.intaprd.com/admin/free/account"
check_url "https://app.intaprd.com/admin/free/credentials"

# Endpoint público de recuperación debe ser anti-enumeración: correo inexistente => 200 genérico.
RESET_CODE="$(curl -sS -o /tmp/kawvo-reset-prod-check.json -w '%{http_code}' \
  -H 'Content-Type: application/json' \
  -X POST 'https://app.intaprd.com/api/v1/auth/password/reset/start' \
  --data '{\"email\":\"release-check-do-not-create@example.invalid\"}')"
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
D1: migraciones de Credenciales aplicadas y verificadas
Web público: NO desplegado
R2: NO modificado
============================================================
EOF
