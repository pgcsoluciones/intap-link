#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/free-guided-tour-v1"
DEPLOY_BRANCH="feature-free-guided-tour-v1"
APP_PROJECT="intap-web2"
LOG_DIR="$ROOT/.preview-free-guided-tour-v1-logs"
APP_LOG="$LOG_DIR/app-pages.log"

fail(){ echo; echo "✗ ERROR: $*" >&2; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"

printf '\n============================================================\n'
printf ' KAWVO LINK · RECORRIDO GUIADO FREE · PREVIEW / QA\n'
printf '============================================================\n'
printf ' Producción NO se despliega ni se modifica.\n'
printf ' Solo Admin App Preview en rama aislada.\n'
printf '============================================================\n\n'

[ -z "$(git status --porcelain)" ] || { git status --short; fail "El repositorio tiene cambios locales. Guárdalos antes de continuar."; }

run git fetch github "$BRANCH" main
run git checkout "$BRANCH"
run git pull --ff-only github "$BRANCH"

[ -z "$(git status --porcelain)" ] || { git status --short; fail "La rama Preview no inició limpia."; }

run python3 scripts/apply-free-guided-tour-v1-2026-09-12.py
run git diff --check

printf '\n▶ QA estructural del recorrido\n'
grep -q "import FreeGuidedTour" app/src/components/admin/free/FreeDashboard.tsx || fail "Falta import FreeGuidedTour"
grep -q 'data-tour="profile-summary"' app/src/components/admin/free/FreeDashboard.tsx || fail "Falta spotlight profile-summary"
grep -q 'data-tour="profile-required"' app/src/components/admin/free/FreeDashboard.tsx || fail "Falta spotlight profile-required"
grep -q 'data-tour="publication"' app/src/components/admin/free/FreeDashboard.tsx || fail "Falta spotlight publication"
grep -q 'data-tour="preview-design"' app/src/components/admin/free/FreeDashboard.tsx || fail "Falta spotlight preview-design"
grep -q 'data-tour="content-tools"' app/src/components/admin/free/FreeDashboard.tsx || fail "Falta spotlight content-tools"
grep -q 'data-tour="bank-accounts"' app/src/components/admin/free/FreeDashboard.tsx || fail "Falta spotlight bank-accounts"
grep -q 'data-tour="header-actions"' app/src/components/admin/free/FreeDashboard.tsx || fail "Falta spotlight header-actions"
grep -q 'Ver más tarde' app/src/components/admin/free/FreeGuidedTour.tsx || fail "Falta Ver más tarde"
grep -q "Completado" app/src/components/admin/free/FreeGuidedTour.tsx || fail "Falta Completado"
grep -q "Continuar" app/src/components/admin/free/FreeGuidedTour.tsx || fail "Falta Continuar"
grep -q 'SNOOZE_MS = 24' app/src/components/admin/free/FreeGuidedTour.tsx || fail "Falta snooze 24h"
grep -q "kawvo:free-tour:start" app/src/components/admin/free/FreeGuidedTour.tsx || fail "Falta replay manual"
echo "✓ QA estructural completo"

printf '\n▶ Verificación de no regresión: este bloque no puede tocar API/Web\n'
CHANGED="$(git diff --name-only)"
printf '%s\n' "$CHANGED"
if printf '%s\n' "$CHANGED" | grep -Eq '^(api/|web/|functions/)'; then
  fail "El cambio tocó API/Web/Functions. Se aborta Preview."
fi
if printf '%s\n' "$CHANGED" | grep -Ev '^(app/src/components/admin/free/FreeDashboard\.tsx)$' | grep -q .; then
  fail "El patch dinámico modificó un archivo inesperado."
fi
echo "✓ Lógica/API/Web aprobados permanecen intactos"

run npm run build:preview -w app

run git add app/src/components/admin/free/FreeDashboard.tsx
if ! git diff --cached --quiet; then
  run git commit -m "feat: integrate guided first-use tour in free dashboard"
  run git push github "$BRANCH"
fi

rm -rf "$LOG_DIR"
mkdir -p "$LOG_DIR"

echo
echo "▶ Deploy SOLO Admin App Preview → $APP_PROJECT / $DEPLOY_BRANCH"
(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch "$DEPLOY_BRANCH") 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App Preview"

APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$APP_LOG" | tail -1)"
[ -n "$APP_ORIGIN" ] || fail "No pude identificar la URL de Pages Preview"

CODE="$(curl -sS -L -o /dev/null -w '%{http_code}' "$APP_ORIGIN/admin/free")"
echo "✓ $APP_ORIGIN/admin/free -> HTTP $CODE"
[ "$CODE" = "200" ] || fail "Preview respondió HTTP $CODE"

FEATURE_SHA="$(git rev-parse HEAD)"

cat <<EOF

============================================================
✓ PREVIEW RECORRIDO GUIADO LISTO PARA QA MANUAL
============================================================
Feature SHA:   $FEATURE_SHA
Preview App:   $APP_ORIGIN
Ruta a probar: $APP_ORIGIN/admin/free

PRODUCCIÓN: NO TOCADA
API:        NO TOCADA
WEB:        NO TOCADA
D1/R2:      NO TOCADOS

QA sugerido antes de aprobar:
1. Primer acceso: recorrido inicia solo.
2. Fondo se opaca y solo el área explicada queda destacada.
3. Continuar recorre cada función sin navegar accidentalmente.
4. Ver más tarde cierra y no reaparece por 24 horas.
5. Botón Guía permite abrirlo manualmente otra vez.
6. Último paso muestra Completado y no vuelve a abrir automáticamente.
7. Revisar móvil y escritorio.
8. Confirmar que publicar, vista previa, edición, enlaces y demás botones
   funcionan igual después de cerrar la guía.
============================================================
EOF
