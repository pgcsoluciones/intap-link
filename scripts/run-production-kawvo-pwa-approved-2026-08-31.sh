#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawvo-pwa-install"
APP_PROJECT="intap-link"
PREVIOUS_PROD_SHA="a70cdf31056c1e1ef5e6ee179a4f1ca45e18a75d"
LOG_DIR="$ROOT/.production-kawvo-pwa-2026-08-31-logs"
RELEASE_BRANCH="prod-kawvo-pwa-20260831-$(date +%H%M%S)"
ROLLBACK_CONFIG="$ROOT/api/.wrangler.rollback-kawvo-pwa.toml"
WORKER_DEPLOYED=0

fail() {
  echo ""
  echo "✗ ERROR: $1"
  if [ "$WORKER_DEPLOYED" = "1" ]; then
    echo "▶ Intentando restaurar el front door productivo anterior..."
    if git show "$PREVIOUS_PROD_SHA:api/wrangler.toml" > "$ROLLBACK_CONFIG"; then
      (cd "$ROOT/api" && npx wrangler deploy --config .wrangler.rollback-kawvo-pwa.toml) || true
      rm -f "$ROLLBACK_CONFIG"
      echo "⚠ Se intentó restaurar el routing productivo anterior. Revisa la salida de Wrangler."
    else
      echo "⚠ No pude preparar rollback automático."
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
mkdir -p "$LOG_DIR"

[ "$(git branch --show-current)" = "$BRANCH" ] || fail "Rama incorrecta: $(git branch --show-current)"
[ -z "$(git status --porcelain)" ] || fail "Working tree no está limpio"

run git pull --ff-only github "$BRANCH"

SOURCE_SHA="$(git rev-parse HEAD)"
echo ""
echo "============================================================"
echo "RELEASE PRODUCTIVO APROBADO · KAWVO PWA"
echo "Branch:     $BRANCH"
echo "Source SHA: $SOURCE_SHA"
echo "Rollback:   $PREVIOUS_PROD_SHA"
echo "============================================================"

export INTAP_ENFORCE_PRODUCTION_APPROVAL=1
export INTAP_PRODUCTION_APPROVAL="SÍ"
export INTAP_APPROVED_COMMIT="$SOURCE_SHA"
run python3 scripts/production_approval_guard.py
run git diff --check

echo ""
echo "▶ Validando App (production)"
(cd app && npx tsc && npx vite build --mode production) || fail "Build Production de App"

# La PWA modifica la App. La API se valida porque el Worker productivo es el front door.
echo ""
echo "▶ Validando API"
(cd api && npx tsc --noEmit) || fail "TypeScript de API"

for asset in \
  app/dist/manifest.webmanifest \
  app/dist/sw.js \
  app/dist/kawvo-icon.svg \
  app/dist/kawvo-icon-192.png \
  app/dist/kawvo-apple-touch-icon.png; do
  [ -f "$asset" ] || fail "Falta asset PWA: $asset"
done

echo ""
echo "▶ Estado previo del Worker productivo"
(cd api && npx wrangler deployments list --config wrangler.toml) 2>&1 | tee "$LOG_DIR/worker-before.log" || true

# Publicar App en un deployment aislado. El custom domain no cambia hasta desplegar el front door.
echo ""
echo "▶ Subiendo App a deployment de release"
APP_LOG="$LOG_DIR/app-pages-$(date +%Y%m%d-%H%M%S).log"
(cd api && npx wrangler pages deploy ../app/dist --project-name "$APP_PROJECT" --branch "$RELEASE_BRANCH") 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy release App Pages"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$APP_LOG" | tail -1)"
[ -n "$APP_ORIGIN" ] || fail "No pude identificar APP_PAGES_ORIGIN"
echo "✓ APP_PAGES_ORIGIN=$APP_ORIGIN"

# Mantener exactamente el Web origin productivo ya aprobado; solo cambia App Pages.
APP_ORIGIN="$APP_ORIGIN" python3 - <<'PY' || fail "Actualizar APP_PAGES_ORIGIN productivo"
from pathlib import Path
import os, re
p = Path('api/wrangler.toml')
s = p.read_text()
s, n = re.subn(r'^APP_PAGES_ORIGIN = ".*"$', f'APP_PAGES_ORIGIN = "{os.environ["APP_ORIGIN"]}"', s, count=1, flags=re.M)
if n != 1:
    raise SystemExit('No pude fijar APP_PAGES_ORIGIN productivo')
p.write_text(s)
print('✓ APP_PAGES_ORIGIN productivo fijado')
PY

run git diff --check
run git add api/wrangler.toml
if ! git diff --cached --quiet; then
  run git commit -m "chore(prod): pin approved Kawvo PWA app origin"
  run git push github "HEAD:$BRANCH"
fi

FINAL_SHA="$(git rev-parse HEAD)"
export INTAP_APPROVED_COMMIT="$FINAL_SHA"
run python3 scripts/production_approval_guard.py

git show "$PREVIOUS_PROD_SHA:api/wrangler.toml" > "$ROLLBACK_CONFIG" || fail "Preparar config de rollback"

echo ""
echo "▶ Desplegando Worker a PRODUCCIÓN"
WORKER_LOG="$LOG_DIR/worker-prod-$(date +%Y%m%d-%H%M%S).log"
(cd api && npx wrangler deploy --config wrangler.toml) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Producción"
WORKER_DEPLOYED=1
WORKER_VERSION="$(grep -E 'Current Version ID:' "$WORKER_LOG" | tail -1 | sed -E 's/.*Current Version ID:[[:space:]]*//')"

echo ""
echo "▶ Smoke tests de Producción"
curl -fsS https://intaprd.com/api/health | tee "$LOG_DIR/health.json" >/dev/null || fail "Health productivo"
for url in \
  https://app.intaprd.com/admin/free \
  https://app.intaprd.com/admin/free/home?source=pwa \
  https://app.intaprd.com/manifest.webmanifest \
  https://app.intaprd.com/sw.js \
  https://app.intaprd.com/kawvo-icon.svg \
  https://app.intaprd.com/kawvo-icon-192.png \
  https://app.intaprd.com/kawvo-apple-touch-icon.png; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' "$url")"
  [ "$code" = "200" ] || fail "$url -> HTTP $code"
  echo "✓ $url -> HTTP 200"
done

# Confirmar que el Web productivo continúa disponible y no fue cambiado de origin.
curl -fsS -o /dev/null https://intaprd.com/ || fail "Web raíz productiva"

rm -f "$ROLLBACK_CONFIG"
WORKER_DEPLOYED=0

TAG="prod-kawvo-pwa-2026-08-31-$(date +%H%M%S)"
git tag -a "$TAG" -m "Approved Kawvo PWA production release $FINAL_SHA" "$FINAL_SHA" || true
git push github "$TAG" || true

HEALTH="$(curl -fsS https://intaprd.com/api/health || true)"

echo ""
echo "============================================================"
echo "✓ KAWVO PWA · RELEASE A PRODUCCIÓN COMPLETADO"
echo "============================================================"
echo "Branch:          $BRANCH"
echo "Commit:          $FINAL_SHA"
echo "Release tag:     $TAG"
echo "App Pages:       $APP_ORIGIN"
echo "Worker Version:  ${WORKER_VERSION:-ver salida Wrangler}"
echo "App:             https://app.intaprd.com/admin/free"
echo "PWA Home:        https://app.intaprd.com/admin/free/home?source=pwa"
echo "Health:          $HEALTH"
echo "Logs:            $LOG_DIR"
echo "============================================================"
