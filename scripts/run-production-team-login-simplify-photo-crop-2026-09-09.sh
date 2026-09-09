#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
LAST_PROD_SHA="38d0683c35f95fd3fca7fc3111574d200551734f"
PRODUCT_SHA="d7b5f2b32e977e3a1970be0e87dc7aa322263607"
APP_PROJECT="intap-web2"
LOG_DIR="/tmp/kawvo-team-login-photo-crop-2026-09-09"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" && mkdir -p "$LOG_DIR"

cat <<EOF
============================================================
KAWVO TEAM · UI PRODUCCION
LOGIN SIMPLE + AJUSTE DE FOTO DE MIEMBRO
============================================================
Último release: $LAST_PROD_SHA
Producto:       $PRODUCT_SHA
Solo App. Sin cambios API, Web ni D1.
============================================================
EOF

run git fetch github main
CURRENT_MAIN="$(git rev-parse github/main)"
git merge-base --is-ancestor "$PRODUCT_SHA" "$CURRENT_MAIN" || fail "github/main no contiene el producto objetivo"

run git checkout --detach "$PRODUCT_SHA"
run git reset --hard "$PRODUCT_SHA"
run git diff --check "$LAST_PROD_SHA...$PRODUCT_SHA"

grep -Fq "Confirma tu acceso" app/src/components/admin/AdminLogin.tsx || fail "Falta login simplificado"
grep -Fq "Administrador: {teamIdentity.master_name}" app/src/components/admin/AdminLogin.tsx || fail "Falta identificación simple del Master"
if grep -Fq "Producto {scanCode}" app/src/components/admin/AdminLogin.tsx; then fail "El login aún expone el código interno del producto"; fi
if grep -Fq "Estado: este navegador necesita confirmar" app/src/components/admin/AdminLogin.tsx; then fail "El login aún muestra texto técnico de sesión"; fi

grep -Fq "import ImageCropModal from '../ImageCropModal'" app/src/components/admin/free/FreeTeamAssign.tsx || fail "Falta ImageCropModal en Team Assign"
grep -Fq "<ImageCropModal file={cropFile} aspectRatio={1} outputWidth={400}" app/src/components/admin/free/FreeTeamAssign.tsx || fail "Falta crop 1:1 de avatar Team"
grep -Fq "Podrás mover, ampliar y recortar antes de guardar." app/src/components/admin/free/FreeTeamAssign.tsx || fail "Falta UX de ajuste de foto"
grep -Fq "form.append('file', photo, 'avatar.jpg')" app/src/components/admin/free/FreeTeamAssign.tsx || fail "El avatar ajustado no llega al upload Team"

echo "✓ Login Team simplificado"
echo "✓ Ajuste de foto Team reutiliza el mismo crop 1:1 del perfil independiente"

run npm ci
run npm run build -w app

# Deploy App exacta.
echo
echo "▶ Deploy App Producción"
npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch main 2>&1 | tee "$LOG_DIR/app.log"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App"

sleep 5
for url in \
  "https://app.intaprd.com/admin/login" \
  "https://app.intaprd.com/admin/free/team/assign"
do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

TAG="prod-team-login-photo-crop-2026-09-09-$(date +%H%M%S)"
run git tag -a "$TAG" "$PRODUCT_SHA" -m "Simplify Team login and add member photo crop control"
run git push github "$TAG"

cat <<EOF

============================================================
✓ TEAM UI · PRODUCCION DESPLEGADA
============================================================
SHA: $PRODUCT_SHA
Tag: $TAG
App: login Team simplificado + crop de foto de miembro activo
D1:  sin cambios
Logs: $LOG_DIR
============================================================
EOF
