#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/account-access-methods-v1"
APP_PROJECT="intap-web2"
LOG_DIR="$ROOT/.preview-account-access-methods-v1-logs"
APP_LOG="$LOG_DIR/app-pages.log"
PREVIEW_CFG="$ROOT/api/wrangler.preview.toml"
PREVIEW_CFG_BAK="$LOG_DIR/wrangler.preview.toml.bak"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" && mkdir -p "$LOG_DIR"

cat <<'EOF'
============================================================
KAWVO LINK · ACCESS METHODS V1 · PREVIEW
============================================================
Mantiene:
- Google OAuth actual
- acceso seguro por correo actual

Agrega:
- contraseña Kawvo independiente
- login correo + contraseña Kawvo
- verificación OTP para cambios sensibles
- cambio de correo: confirma correo actual + correo nuevo
- identidad Google estable aunque cambie el correo principal
- Mi cuenta → Credenciales

SOLO PREVIEW
Producción NO se toca
============================================================
EOF

run git fetch github "$BRANCH" main
run git checkout "$BRANCH"
run git pull --ff-only github "$BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "El árbol de trabajo no está limpio"; }

run python3 scripts/apply-account-access-methods-v1-2026-09-16.py
run git diff --check

# Contratos mínimos antes de compilar.
grep -Fq "import './account-access-methods'" api/src/preview-free-entry.ts || fail "API de credenciales no ensamblada"
grep -Fq "app.post('/api/v1/auth/password/login'" api/src/account-access-methods.ts || fail "Falta login por contraseña"
grep -Fq "app.post('/api/v1/me/account/password'" api/src/account-access-methods.ts || fail "Falta crear/cambiar contraseña"
grep -Fq "app.post('/api/v1/me/account/email/change/confirm'" api/src/account-access-methods.ts || fail "Falta cambio de correo"
grep -Fq "user_auth_identities" api/src/index.ts || fail "Google no quedó vinculado por identidad"
grep -Fq 'path="/admin/free/credentials"' app/src/App.tsx || fail "Falta ruta Credenciales"
grep -Fq "Contraseña Kawvo" app/src/components/admin/AdminLogin.tsx || fail "Login no expone contraseña Kawvo"

echo; echo "▶ Build App Preview"
run npm run build:preview -w app

echo; echo "▶ TypeScript API"
run bash -lc 'cd api && npx tsc --noEmit'

# Commit/push del código aplicado por el runner.
git add \
  api/migrations/0060_account_access_methods.sql \
  api/migrations-preview/0060_account_access_methods.sql \
  api/src/account-access-methods.ts \
  api/src/preview-free-entry.ts \
  api/src/index.ts \
  app/src/components/admin/free/FreeCredentials.tsx \
  app/src/components/admin/free/FreeAccount.tsx \
  app/src/components/admin/AdminLogin.tsx \
  app/src/App.tsx
if ! git diff --cached --quiet; then
  git commit -m "feat: add flexible Kawvo account access methods"
  git push github "$BRANCH"
fi

run git diff --check main...HEAD

echo; echo "▶ Aplicar migraciones SOLO D1 Preview"
(
  cd api
  npx wrangler d1 migrations apply intap_db_preview --remote --config wrangler.preview.toml
) || fail "Migraciones D1 Preview"

# Rebuild después del commit para asegurar HEAD exacto.
run npm run build:preview -w app

(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch feature-account-access-methods-v1) 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App Preview"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$APP_LOG" | tail -1)"
[ -n "$APP_ORIGIN" ] || fail "No pude detectar origin inmutable de App Pages"

echo "✓ App Pages Preview: $APP_ORIGIN"

cp "$PREVIEW_CFG" "$PREVIEW_CFG_BAK"
restore_cfg(){ cp "$PREVIEW_CFG_BAK" "$PREVIEW_CFG" 2>/dev/null || true; }
trap restore_cfg EXIT
python3 - "$PREVIEW_CFG" "$APP_ORIGIN" <<'PY'
from pathlib import Path
import re,sys
p=Path(sys.argv[1]); origin=sys.argv[2]
s=p.read_text()
s2,n=re.subn(r'APP_PAGES_ORIGIN\s*=\s*"[^"]+"',f'APP_PAGES_ORIGIN = "{origin}"',s,count=1)
if n != 1: raise SystemExit('No pude actualizar APP_PAGES_ORIGIN')
p.write_text(s2)
PY

(
  cd api
  npx wrangler deploy --config wrangler.preview.toml --dry-run
  npx wrangler deploy --config wrangler.preview.toml
) || fail "Deploy Worker Preview"
restore_cfg
trap - EXIT

echo; echo "▶ Smoke HTTP Preview"
sleep 4
for url in \
  "https://app.preview.intaprd.com/admin/login" \
  "https://app.preview.intaprd.com/admin/free/account" \
  "https://app.preview.intaprd.com/admin/free/credentials"
do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

[ -z "$(git status --porcelain)" ] || { git status --short; fail "El runner dejó cambios locales"; }

cat <<EOF
============================================================
✓ ACCESS METHODS V1 LISTO EN PREVIEW
============================================================
Feature SHA: $(git rev-parse HEAD)
App Pages: $APP_ORIGIN
Preview: https://app.preview.intaprd.com/admin/free/credentials

Validar:
- Google sigue entrando como antes
- Correo seguro sigue entrando como antes
- Crear contraseña Kawvo con OTP
- Login con correo + contraseña Kawvo
- Cambiar contraseña con OTP
- Cambiar correo: OTP correo actual + OTP correo nuevo
- Después de cambiar correo, Google sigue vinculado al mismo usuario

Producción NO tocada
============================================================
EOF
