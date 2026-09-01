#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawvo-account-center-v1"

fail() {
  echo ""
  echo "✗ ERROR: $1"
  echo "Producción no fue tocada."
  exit 1
}
run() { echo ""; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"

# La ejecución V3 anterior terminó antes del commit y dejó únicamente cambios generados por el runner.
# Recuperamos la rama remota aprobada antes de aplicar V4.
run git fetch github "$BRANCH"
if [ "$(git branch --show-current)" != "$BRANCH" ]; then
  run git checkout -B "$BRANCH" "github/$BRANCH"
fi
run git reset --hard "github/$BRANCH"

run python3 scripts/apply-account-center-v4.py
run git diff --check

echo ""
echo "▶ Validando Account Center v4"
grep -Fq 'label="Enviar enlace de cuentas"' app/src/components/admin/free/FreeAccount.tsx || fail "Falta Enviar enlace de cuentas"
grep -Fq 'label="Instalar app Kawvo"' app/src/components/admin/free/FreeAccount.tsx || fail "Falta Instalar app Kawvo"
grep -Fq 'beforeinstallprompt' app/src/main.tsx || fail "Falta captura del prompt PWA"
grep -Fq 'kawvo:pwa-install-ready' app/src/main.tsx || fail "Falta evento PWA"
grep -Fq 'Agregar a pantalla de inicio' app/src/components/admin/free/FreeAccount.tsx || fail "Faltan instrucciones iOS"
grep -Fq 'Instalar aplicación' app/src/components/admin/free/FreeAccount.tsx || fail "Faltan instrucciones Android"
! grep -Fq 'Dispositivos vinculados' app/src/components/admin/free/FreeAccount.tsx || fail "Dispositivos vinculados sigue visible"
grep -Fq 'Vista previa del código QR' app/src/components/admin/free/FreeAccount.tsx || fail "QR no tiene preview"
grep -Fq 'Mensaje que vas a compartir' app/src/components/admin/free/FreeAccount.tsx || fail "Invitación no tiene preview"
echo "✓ contrato v4 validado"

run git add \
  app/src/main.tsx \
  app/src/components/admin/free/FreePanelUi.tsx \
  app/src/components/admin/free/FreeQuickActions.tsx \
  app/src/components/admin/free/FreeDashboard.tsx \
  app/src/components/admin/free/FreeLinks.tsx \
  app/src/components/admin/free/FreeBankAccounts.tsx \
  app/src/components/admin/free/FreePortfolio.tsx \
  app/src/components/admin/free/FreeProfileDangerZone.tsx \
  app/src/components/admin/free/FreeServices.tsx \
  app/src/components/admin/free/FreeAiProfileAssistant.tsx \
  app/src/components/admin/free/FreeAccount.tsx \
  app/src/components/admin/free/FreeSupportPanel.tsx \
  app/src/components/admin/free/FreeContextHelp.tsx

if ! git diff --cached --quiet; then
  run git commit -m "feat(account): add PWA install and finish account refinements"
  run git push github "HEAD:$BRANCH"
fi

# Reuse the audited V3 build/deploy/smoke runner. V3 application is idempotent over V4.
run bash scripts/run-preview-account-center-v3-2026-09-01.sh

echo ""
echo "============================================================"
echo "✓ ACCOUNT CENTER V4 · PREVIEW LISTO PARA QA"
echo "============================================================"
echo "Mi cuenta: https://app.preview.intaprd.com/admin/free/account"
echo "Producción: NO TOCADA"
echo "QA adicional:"
echo "- Instalar app Kawvo aparece dentro de MI KAWVO cuando no está instalada."
echo "- Chrome/Android usa prompt nativo cuando está disponible."
echo "- iPhone/iPad muestra instrucciones para Agregar a pantalla de inicio."
echo "- Si la PWA ya está instalada, la opción se oculta."
echo "============================================================"
