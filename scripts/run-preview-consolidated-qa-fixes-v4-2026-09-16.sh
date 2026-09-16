#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/no-profile-activation-entry-v1"
DEPLOY_BRANCH="feature-no-profile-activation-entry-v1"
APP_PROJECT="intap-web2"
WRANGLER_CFG="api/wrangler.preview.toml"
LOG_DIR="$ROOT/.preview-consolidated-qa-v4-logs"
APP_LOG="$LOG_DIR/app-pages.log"
WORKER_LOG="$LOG_DIR/worker-preview.log"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }
restore_config(){ if [ -d "$ROOT/.git" ]; then git -C "$ROOT" restore -- "$WRANGLER_CFG" >/dev/null 2>&1 || true; fi; }
trap restore_config EXIT

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" && mkdir -p "$LOG_DIR"

cat <<'EOF'
============================================================
KAWVO LINK · QA CONSOLIDADO V4 · PREVIEW
============================================================
- ajusta copy: Ya entendí / (no volver a mostrar)
- aumenta jerarquía visual de Ya entendí
- Notificaciones vuelve al origen correcto
- conserva todas las correcciones V3
- producción NO se toca
============================================================
EOF

run git fetch github "$BRANCH" main
run git checkout "$BRANCH"
run git pull --ff-only github "$BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "El árbol de trabajo no está limpio"; }

run python3 scripts/apply-qa-copy-navigation-v4-2026-09-16.py
run git diff --check
run npm run build:preview -w app

run git add \
  app/src/components/admin/free/FreeGuidedTour.tsx \
  app/src/components/admin/free/FreeAccountGuidedTour.tsx \
  app/src/components/admin/free/FreeTeamGuidedTour.tsx \
  app/src/components/admin/free/FreeNotifications.tsx

if ! git diff --cached --quiet; then
  run git commit -m "fix: refine tour dismissal copy and notification back navigation"
  run git push github "$BRANCH"
fi

BASE_SHA="$(git merge-base HEAD github/main)"
FEATURE_SHA="$(git rev-parse HEAD)"
run git diff --check "$BASE_SHA...HEAD"

CHANGED="$(git diff --name-only "$BASE_SHA...HEAD")"
echo; echo "▶ Alcance"
echo "$CHANGED"
if echo "$CHANGED" | grep -Eq '^(web/src/|functions/)'; then
  fail "Hay cambios no esperados en Web público o Functions"
fi

# Invariantes de esta ronda y de V3.
grep -Fq 'Ya entendí <span className="block text-[11px] font-bold text-slate-400">(no volver a mostrar)</span>' app/src/components/admin/free/FreeGuidedTour.tsx || fail "Copy Dashboard no aplicado"
grep -Fq 'Ya entendí <span className="block text-[11px] font-bold text-slate-400">(no volver a mostrar)</span>' app/src/components/admin/free/FreeAccountGuidedTour.tsx || fail "Copy Mi cuenta no aplicado"
grep -Fq 'Ya entendí <span className="block text-[11px] font-bold text-slate-400">(no volver a mostrar)</span>' app/src/components/admin/free/FreeTeamGuidedTour.tsx || fail "Copy Team no aplicado"
grep -Fq "const backPath = fromAccount ? '/admin/free/account' : '/admin/free'" app/src/components/admin/free/FreeNotifications.tsx || fail "Navegación de regreso no dinámica"
grep -Fq "new URLSearchParams(location.search).get('from') === 'account'" app/src/components/admin/free/FreeNotifications.tsx || fail "No se conserva origen de Mi cuenta"
grep -Fq "navigate('/admin/artifacts', { replace: true })" app/src/components/admin/free/onboarding/FreeOnboardingWelcome.tsx || fail "Regresión en flujo post-eliminación"
grep -Fq "localStorage.getItem(autoKey)==='1'" app/src/components/admin/free/FreeAccountGuidedTour.tsx || fail "Persistencia recorrido Mi cuenta perdida"
grep -Fq "localStorage.getItem(autoKey)==='1'" app/src/components/admin/free/FreeTeamGuidedTour.tsx || fail "Persistencia recorrido Team perdida"
grep -Fq "localStorage.getItem(autoKey) === '1'" app/src/components/admin/free/FreeGuidedTour.tsx || fail "Persistencia recorrido Dashboard perdida"
grep -Fq "kawvo:notifications-changed" app/src/components/admin/free/FreeNotificationBell.tsx || fail "Actualización reactiva de campana perdida"

echo "✓ Invariantes V4 verificadas"

run npm run build:preview -w app

(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch "$DEPLOY_BRANCH") 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App Pages Preview"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$APP_LOG" | tail -1)"
[ -n "$APP_ORIGIN" ] || fail "No pude identificar App Pages origin"

APP_ORIGIN="$APP_ORIGIN" python3 - <<'PY'
from pathlib import Path
import os,re
p=Path('api/wrangler.preview.toml')
s=p.read_text()
s,n=re.subn(r'^APP_PAGES_ORIGIN = ".*"$', f'APP_PAGES_ORIGIN = "{os.environ["APP_ORIGIN"]}"', s, count=1, flags=re.M)
if n != 1: raise SystemExit('No encontré APP_PAGES_ORIGIN')
p.write_text(s)
PY

(
  cd api
  npx wrangler deploy --config wrangler.preview.toml --dry-run
  npx wrangler deploy --config wrangler.preview.toml
) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Preview"

sleep 4
for url in \
  "https://app.preview.intaprd.com/admin/free" \
  "https://app.preview.intaprd.com/admin/free/account" \
  "https://app.preview.intaprd.com/admin/free/team" \
  "https://app.preview.intaprd.com/admin/free/notifications" \
  "https://app.preview.intaprd.com/admin/free/notifications?from=account"
do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

restore_config
trap - EXIT
[ -z "$(git status --porcelain)" ] || { git status --short; fail "El runner dejó cambios locales"; }

cat <<EOF
============================================================
✓ QA CONSOLIDADO V4 LISTO EN PREVIEW
============================================================
Feature SHA: $FEATURE_SHA
App Pages: $APP_ORIGIN

Validar:
- Recorridos: "Ya entendí" más visible + "(no volver a mostrar)"
- Notificaciones desde Dashboard: Volver → Dashboard
- Notificaciones desde Mi cuenta: Volver → Mi cuenta
- Persistencia de leídas y auto-recorridos sigue intacta

Producción NO tocada
============================================================
EOF
