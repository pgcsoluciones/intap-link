#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/account-credentials-panel-v1"
APP_PROJECT="intap-web2"
PAGES_BRANCH="feature-account-credentials-panel-v1"
LOG_DIR="$ROOT/.preview-account-credentials-v1-logs"
APP_LOG="$LOG_DIR/app-pages.log"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" && mkdir -p "$LOG_DIR"

cat <<'EOF'
============================================================
KAWVO LINK · MI CUENTA · CREDENCIALES V1 · PREVIEW
============================================================
- agrega panel Credenciales dentro de Mi cuenta
- muestra correo de acceso
- muestra método de acceso seguro sin contraseña
- permite editar nombre de usuario usando el flujo existente
- muestra y copia el enlace público
- no modifica API, D1, R2 ni Web público
- producción no se toca
============================================================
EOF

run git fetch github main "$BRANCH"
run git checkout "$BRANCH"
run git pull --ff-only github "$BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "El árbol no está limpio"; }

run python3 scripts/apply-account-credentials-panel-v1-2026-09-16.py
run git diff --check

# Contrato funcional mínimo.
grep -Fq 'label="Credenciales"' app/src/components/admin/free/FreeAccount.tsx || fail "No se agregó Credenciales"
grep -Fq 'Correo de acceso' app/src/components/admin/free/FreeAccount.tsx || fail "Falta correo"
grep -Fq 'No requerida' app/src/components/admin/free/FreeAccount.tsx || fail "Falta estado de contraseña"
grep -Fq "navigate('/admin/free/identifier')" app/src/components/admin/free/FreeAccount.tsx || fail "Falta edición de usuario"
grep -Fq 'Copiar enlace' app/src/components/admin/free/FreeAccount.tsx || fail "Falta copiar enlace"

run npm run build:preview -w app

run git add app/src/components/admin/free/FreeAccount.tsx
if ! git diff --cached --quiet; then
  run git commit -m "feat: add basic account credentials panel"
  run git push github "$BRANCH"
fi

(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch "$PAGES_BRANCH") 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Preview Admin App"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$APP_LOG" | tail -1)"

sleep 3
for url in \
  "https://app.preview.intaprd.com/admin/free/account" \
  "https://app.preview.intaprd.com/admin/free/identifier"
do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

[ -z "$(git status --porcelain)" ] || { git status --short; fail "El runner dejó cambios locales"; }

cat <<EOF
============================================================
✓ CREDENCIALES V1 LISTO EN PREVIEW
============================================================
Feature SHA: $(git rev-parse HEAD)
App Pages: ${APP_ORIGIN:-deploy completado}
Prueba: https://app.preview.intaprd.com/admin/free/account

Validar:
- abrir Credenciales
- correo actual visible
- acceso indica que no requiere contraseña
- Editar usuario abre el editor existente
- Copiar enlace funciona

Producción NO tocada
============================================================
EOF
