#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/no-profile-activation-entry-v1"
PATCH="scripts/apply-consolidated-qa-fixes-v2-2026-09-15.py"
BASE_RUNNER="scripts/run-preview-no-profile-activation-entry-v1-2026-09-14.sh"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"

cat <<'EOF'
============================================================
KAWVO LINK · QA CONSOLIDADO V2 · PREVIEW
============================================================
Incluye:
- cuenta autenticada sin perfil: nueva entrada de activación NFC/QR
- recorridos automáticos: una sola vez por usuario
- botón para no volver a mostrarlos automáticamente
- Recorrido manual sigue disponible
- notificaciones abiertas dejan de marcarse como pendientes
- badge/campana se actualiza inmediatamente
- producción NO se toca
============================================================
EOF

run git fetch github "$BRANCH" main
run git checkout "$BRANCH"
run git pull --ff-only github "$BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "El árbol de trabajo no está limpio"; }

run python3 "$PATCH"
run git diff --check
run npm run build:preview -w app

run git add \
  app/src/components/admin/free/FreeGuidedTour.tsx \
  app/src/components/admin/free/FreeAccountGuidedTour.tsx \
  app/src/components/admin/free/FreeTeamGuidedTour.tsx \
  app/src/components/admin/free/FreeNotifications.tsx \
  app/src/components/admin/free/FreeNotificationBell.tsx

if ! git diff --cached --quiet; then
  run git commit -m "fix: persist guided tour dismissal and refresh notifications"
  run git push github "$BRANCH"
else
  echo "✓ El parche ya estaba aplicado; no hay commit nuevo"
fi

run bash "$BASE_RUNNER"

cat <<'EOF'
============================================================
✓ QA CONSOLIDADO V2 LISTO EN PREVIEW
============================================================
Prueba en https://app.preview.intaprd.com

Validar:
1. Cuenta logueada sin perfil:
   /admin/free/onboarding/welcome
   - activar dispositivo
   - adquirir dispositivo
   - cerrar sesión

2. Recorridos Dashboard / Mi cuenta / Team:
   - automático solo la primera vez
   - al completar no vuelve a abrirse solo
   - "Ya entendí · no mostrar solo" apaga el automático
   - botón Recorrido lo abre manualmente cuando se quiera

3. Notificaciones:
   - abrir una notificación la marca como leída
   - el punto/contador desaparece sin esperar 30 segundos
   - al salir y volver permanece leída
   - "Marcar todas leídas" actualiza lista y campana

Producción NO tocada
============================================================
EOF
