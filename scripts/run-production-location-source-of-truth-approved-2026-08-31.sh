#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawvo-pwa-install"
APP_PROJECT="intap-link"
WEB_PROJECT="intap-web2"
PRE_INFRA_SHA="b30d9b43b6f7f83add7c2cdfa9d41e30eab59ce4"
LOG_DIR="$ROOT/.production-location-source-of-truth-2026-08-31-logs"
RELEASE_SUFFIX="$(date +%Y%m%d-%H%M%S)"
APP_RELEASE_BRANCH="prod-location-app-$RELEASE_SUFFIX"
WEB_RELEASE_BRANCH="prod-location-web-$RELEASE_SUFFIX"
ROLLBACK_CONFIG="$ROOT/api/.wrangler.location.rollback.toml"
WORKER_DEPLOYED=0

fail() {
  echo ""
  echo "✗ ERROR: $1"
  if [ "$WORKER_DEPLOYED" = "1" ]; then
    echo "▶ Intentando restaurar front door productivo anterior..."
    if git show "$PRE_INFRA_SHA:api/wrangler.toml" > "$ROLLBACK_CONFIG"; then
      (cd "$ROOT/api" && npx wrangler deploy --config .wrangler.location.rollback.toml) || true
      rm -f "$ROLLBACK_CONFIG"
      echo "⚠ Se intentó restaurar el routing productivo anterior. Revisa Wrangler."
    else
      echo "⚠ No se pudo preparar rollback automático."
    fi
  fi
  exit 1
}

run() {
  echo ""
  echo "▶ $*"
  "$@" || fail "$*"
}

cd "$ROOT" || fail "No existe $ROOT"

# Limpia únicamente logs locales generados por releases/preview anteriores.
find . -maxdepth 1 -type d -name '.*-logs' -print -exec rm -rf {} + 2>/dev/null || true
mkdir -p "$LOG_DIR"

[ "$(git branch --show-current)" = "$BRANCH" ] || fail "Rama incorrecta: $(git branch --show-current)"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Working tree no está limpio"; }

run git pull --ff-only github "$BRANCH"

SOURCE_SHA="$(git rev-parse HEAD)"
echo ""
echo "============================================================"
echo "RELEASE PRODUCTIVO APROBADO · UBICACIÓN CANÓNICA"
echo "Branch:      $BRANCH"
echo "Source SHA:  $SOURCE_SHA"
echo "Rollback:    $PRE_INFRA_SHA"
echo "============================================================"

export INTAP_ENFORCE_PRODUCTION_APPROVAL=1
export INTAP_PRODUCTION_APPROVAL="SÍ"
export INTAP_APPROVED_COMMIT="$SOURCE_SHA"
run python3 scripts/production_approval_guard.py
run git diff --check

echo ""
echo "▶ Validando App (production)"
(cd app && npx tsc && npx vite build --mode production) || fail "Build Production de App"

echo ""
echo "▶ Validando Web (production)"
(cd web && npx tsc && npx vite build --mode production) || fail "Build Production de Web"

echo ""
echo "▶ Validando API"
(cd api && npx tsc --noEmit) || fail "TypeScript de API"

echo ""
echo "▶ Estado previo del Worker productivo"
(cd api && npx wrangler deployments list --config wrangler.toml) 2>&1 | tee "$LOG_DIR/worker-before.log" || true

echo ""
echo "▶ Subiendo App a deployment de release"
APP_LOG="$LOG_DIR/app-pages-$RELEASE_SUFFIX.log"
(cd api && npx wrangler pages deploy ../app/dist --project-name "$APP_PROJECT" --branch "$APP_RELEASE_BRANCH") 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy release App Pages"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$APP_LOG" | tail -1)"
[ -n "$APP_ORIGIN" ] || fail "No pude identificar APP_PAGES_ORIGIN"
echo "✓ APP_PAGES_ORIGIN=$APP_ORIGIN"

echo ""
echo "▶ Subiendo Web a deployment de release"
WEB_LOG="$LOG_DIR/web-pages-$RELEASE_SUFFIX.log"
(cd api && npx wrangler pages deploy ../web/dist --project-name "$WEB_PROJECT" --branch "$WEB_RELEASE_BRANCH") 2>&1 | tee "$WEB_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy release Web Pages"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$WEB_LOG" | tail -1)"
[ -n "$WEB_ORIGIN" ] || fail "No pude identificar WEB_PAGES_ORIGIN"
echo "✓ WEB_PAGES_ORIGIN=$WEB_ORIGIN"

APP_ORIGIN="$APP_ORIGIN" WEB_ORIGIN="$WEB_ORIGIN" python3 - <<'PY' || fail "Actualizar origins productivos"
from pathlib import Path
import os, re
p = Path('api/wrangler.toml')
s = p.read_text()
s, n1 = re.subn(r'^APP_PAGES_ORIGIN = ".*"$', f'APP_PAGES_ORIGIN = "{os.environ["APP_ORIGIN"]}"', s, count=1, flags=re.M)
s, n2 = re.subn(r'^WEB_PAGES_ORIGIN = ".*"$', f'WEB_PAGES_ORIGIN = "{os.environ["WEB_ORIGIN"]}"', s, count=1, flags=re.M)
if n1 != 1 or n2 != 1:
    raise SystemExit('No pude fijar APP_PAGES_ORIGIN/WEB_PAGES_ORIGIN productivos')
p.write_text(s)
print('✓ origins productivos fijados')
PY

run git diff --check
run git add api/wrangler.toml
if ! git diff --cached --quiet; then
  run git commit -m "chore(prod): pin approved canonical location origins"
  run git push github "HEAD:$BRANCH"
fi

FINAL_SHA="$(git rev-parse HEAD)"
export INTAP_APPROVED_COMMIT="$FINAL_SHA"
run python3 scripts/production_approval_guard.py

git show "$PRE_INFRA_SHA:api/wrangler.toml" > "$ROLLBACK_CONFIG" || fail "Preparar config de rollback"

echo ""
echo "▶ Desplegando Worker a PRODUCCIÓN"
WORKER_LOG="$LOG_DIR/worker-prod-$RELEASE_SUFFIX.log"
(cd api && npx wrangler deploy --config wrangler.toml) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Producción"
WORKER_DEPLOYED=1
WORKER_VERSION="$(grep -E 'Current Version ID:' "$WORKER_LOG" | tail -1 | sed -E 's/.*Current Version ID:[[:space:]]*//')"

sleep 2

echo ""
echo "▶ Smoke tests de Producción"
HEALTH="$(curl -fsS https://intaprd.com/api/health)" || fail "Health productivo"
echo "✓ Health: $HEALTH"

for url in \
  "https://app.intaprd.com/admin/free" \
  "https://app.intaprd.com/admin/free/location" \
  "https://app.intaprd.com/admin/free/quick-actions" \
  "https://intaprd.com/"; do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
  echo "✓ $url -> HTTP 200"
done

APP_HTML="$LOG_DIR/app-index.html"
WEB_HTML="$LOG_DIR/web-index.html"
curl -fsS https://app.intaprd.com/admin/free/location -o "$APP_HTML" || fail "Descargar HTML App productiva"
curl -fsS https://intaprd.com/ -o "$WEB_HTML" || fail "Descargar HTML Web productiva"
grep -q 'assets/index-' "$APP_HTML" || fail "HTML App productiva no contiene assets esperados"
grep -q 'assets/index-' "$WEB_HTML" || fail "HTML Web productiva no contiene assets esperados"
echo "✓ App y Web productivas sirven assets esperados"

rm -f "$ROLLBACK_CONFIG"
WORKER_DEPLOYED=0

TAG="prod-location-canonical-2026-08-31-$(date +%H%M%S)"
git tag -a "$TAG" -m "Approved canonical location production release $FINAL_SHA" "$FINAL_SHA" || true
git push github "$TAG" || true

HEALTH="$(curl -fsS https://intaprd.com/api/health || true)"

echo ""
echo "============================================================"
echo "✓ UBICACIÓN CANÓNICA · RELEASE A PRODUCCIÓN COMPLETADO"
echo "============================================================"
echo "Branch:          $BRANCH"
echo "Commit:          $FINAL_SHA"
echo "Release tag:     $TAG"
echo "App Pages:       $APP_ORIGIN"
echo "Web Pages:       $WEB_ORIGIN"
echo "Worker Version:  ${WORKER_VERSION:-ver salida Wrangler}"
echo "Panel:           https://app.intaprd.com/admin/free"
echo "Ubicación:       https://app.intaprd.com/admin/free/location"
echo "Botones:         https://app.intaprd.com/admin/free/quick-actions"
echo "Web:             https://intaprd.com"
echo "Health:          $HEALTH"
echo "Logs:            $LOG_DIR"
echo "============================================================"
