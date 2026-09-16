#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
APP_PROJECT="intap-web2"
RELEASE_BASE="0fbda47f6efe737056dff599dc3c7c363e17f2a7"
EXPECTED_FEATURE="7de0a8906a6a45acc4ecb051418179b87ecbd829"
LOG_DIR="$ROOT/.production-consolidated-qa-v4-logs"
APP_LOG="$LOG_DIR/app-pages.log"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" && mkdir -p "$LOG_DIR"

cat <<'EOF'
============================================================
KAWVO LINK · RELEASE PRODUCCIÓN · QA CONSOLIDADO V4
============================================================
Incluye únicamente Admin App:
- cuenta autenticada sin perfil: entrada moderna NFC/QR
- recorridos automáticos persistentes + modo manual
- copy "Ya entendí" / "(no volver a mostrar)"
- notificaciones leídas + badge inmediato
- volver desde Notificaciones al origen correcto

NO despliega API
NO despliega Web público
NO modifica D1
NO modifica R2
============================================================
EOF

run git fetch github main
run git checkout main
run git pull --ff-only github main
[ -z "$(git status --porcelain)" ] || { git status --short; fail "El árbol de trabajo no está limpio"; }

HEAD_SHA="$(git rev-parse HEAD)"
run git merge-base --is-ancestor "$EXPECTED_FEATURE" "$HEAD_SHA"
run git diff --check "$RELEASE_BASE...HEAD"

echo; echo "▶ Verificación estricta de alcance de producción"
CHANGED="$(git diff --name-only "$RELEASE_BASE...HEAD")"
echo "$CHANGED"

if echo "$CHANGED" | grep -Eq '^(api/|web/|functions/)'; then
  fail "Detecté cambios en API, Web público o Functions. Se cancela producción."
fi

UNEXPECTED="$(echo "$CHANGED" | grep -Ev '^(app/src/components/admin/free/|scripts/)' || true)"
if [ -n "$UNEXPECTED" ]; then
  echo "$UNEXPECTED"
  fail "Detecté archivos fuera del alcance aprobado."
fi

# Invariantes clave contra regresiones.
grep -Fq 'Ya entendí' app/src/components/admin/free/FreeGuidedTour.tsx || fail "Falta copy Ya entendí en Dashboard"
grep -Fq '(no volver a mostrar)' app/src/components/admin/free/FreeGuidedTour.tsx || fail "Falta copy de no volver a mostrar"
grep -Fq 'tour-auto-disabled:account' app/src/components/admin/free/FreeAccountGuidedTour.tsx || fail "Falta persistencia Mi cuenta"
grep -Fq 'tour-auto-disabled:team' app/src/components/admin/free/FreeTeamGuidedTour.tsx || fail "Falta persistencia Team"
grep -Fq 'kawvo:notifications-changed' app/src/components/admin/free/FreeNotifications.tsx || fail "Falta refresco de notificaciones"
grep -Fq "new URLSearchParams(location.search).get('from') === 'account'" app/src/components/admin/free/FreeNotifications.tsx || fail "Falta detección de origen de Notificaciones"
grep -Fq "const backPath = fromAccount ? '/admin/free/account' : '/admin/free'" app/src/components/admin/free/FreeNotifications.tsx || fail "Falta retorno dinámico de Notificaciones"
grep -Fq '/admin/artifacts?profile_deleted=1' app/src/components/admin/free/onboarding/FreeOnboardingWelcome.tsx || fail "Falta flujo posterior a eliminar perfil"
grep -Fq '/admin/artifacts/activate?start=1' app/src/components/admin/free/onboarding/FreeOnboardingWelcome.tsx || fail "Falta entrada moderna de activación"

echo "✓ Alcance e invariantes verificados"

run npm run build -w app

(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch main) 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Admin App producción"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$APP_LOG" | tail -1)"

sleep 4
for url in \
  "https://app.intaprd.com/admin/login" \
  "https://app.intaprd.com/admin/free" \
  "https://app.intaprd.com/admin/free/account" \
  "https://app.intaprd.com/admin/free/team" \
  "https://app.intaprd.com/admin/free/notifications" \
  "https://app.intaprd.com/admin/free/onboarding/welcome" \
  "https://app.intaprd.com/admin/artifacts/activate"
do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

[ -z "$(git status --porcelain)" ] || { git status --short; fail "El runner dejó cambios locales"; }

cat <<EOF
============================================================
✓ RELEASE PRODUCCIÓN V4 COMPLETADO
============================================================
Main SHA: $(git rev-parse HEAD)
Admin App Pages: ${APP_ORIGIN:-deploy completado}
Producción: https://app.intaprd.com/admin/free

API: NO desplegada
Web público: NO desplegado
D1: NO modificado
R2: NO modificado
============================================================
EOF
