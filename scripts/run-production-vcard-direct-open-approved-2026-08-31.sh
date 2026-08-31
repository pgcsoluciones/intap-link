#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawvo-pwa-install"
WEB_PROJECT="intap-web2"
PRE_INFRA_SHA="06457a50d23ab2e4f7075ea38e83ccfe6f5843c5"
LOG_DIR="$ROOT/.production-vcard-direct-open-2026-08-31-logs"
RELEASE_BRANCH="prod-vcard-direct-20260831-$(date +%H%M%S)"
ROLLBACK_CONFIG="$ROOT/api/.wrangler.vcard.rollback.toml"
WORKER_DEPLOYED=0

fail() {
  echo ""
  echo "✗ ERROR: $1"
  if [ "$WORKER_DEPLOYED" = "1" ]; then
    echo "▶ Intentando restaurar front door productivo anterior..."
    if git show "$PRE_INFRA_SHA:api/wrangler.toml" > "$ROLLBACK_CONFIG"; then
      (cd "$ROOT/api" && npx wrangler deploy --config .wrangler.vcard.rollback.toml) || true
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

# Los runners generan logs locales que no forman parte del producto.
rm -rf .preview-vcard-direct-open-logs .production-vcard-direct-open-2026-08-31-logs
mkdir -p "$LOG_DIR"

[ "$(git branch --show-current)" = "$BRANCH" ] || fail "Rama incorrecta: $(git branch --show-current)"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Working tree no está limpio"; }

run git pull --ff-only github "$BRANCH"

SOURCE_SHA="$(git rev-parse HEAD)"
echo ""
echo "============================================================"
echo "RELEASE PRODUCTIVO APROBADO · VCARD DIRECT OPEN"
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
echo "▶ Validando Web (production)"
(cd web && npx tsc && npx vite build --mode production) || fail "Build Production de Web"

echo ""
echo "▶ Validando API"
(cd api && npx tsc --noEmit) || fail "TypeScript de API"

echo ""
echo "▶ Estado previo del Worker productivo"
(cd api && npx wrangler deployments list --config wrangler.toml) 2>&1 | tee "$LOG_DIR/worker-before.log" || true

echo ""
echo "▶ Subiendo Web a deployment de release"
WEB_LOG="$LOG_DIR/web-pages-$(date +%Y%m%d-%H%M%S).log"
(cd api && npx wrangler pages deploy ../web/dist --project-name "$WEB_PROJECT" --branch "$RELEASE_BRANCH") 2>&1 | tee "$WEB_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy release Web Pages"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$WEB_LOG" | tail -1)"
[ -n "$WEB_ORIGIN" ] || fail "No pude identificar WEB_PAGES_ORIGIN"
echo "✓ WEB_PAGES_ORIGIN=$WEB_ORIGIN"

WEB_ORIGIN="$WEB_ORIGIN" python3 - <<'PY' || fail "Actualizar WEB_PAGES_ORIGIN productivo"
from pathlib import Path
import os, re
p = Path('api/wrangler.toml')
s = p.read_text()
s, n = re.subn(r'^WEB_PAGES_ORIGIN = ".*"$', f'WEB_PAGES_ORIGIN = "{os.environ["WEB_ORIGIN"]}"', s, count=1, flags=re.M)
if n != 1:
    raise SystemExit('No pude fijar WEB_PAGES_ORIGIN productivo')
p.write_text(s)
print('✓ WEB_PAGES_ORIGIN productivo fijado')
PY

run git diff --check
run git add api/wrangler.toml
if ! git diff --cached --quiet; then
  run git commit -m "chore(prod): pin approved vCard web origin"
  run git push github "HEAD:$BRANCH"
fi

FINAL_SHA="$(git rev-parse HEAD)"
export INTAP_APPROVED_COMMIT="$FINAL_SHA"
run python3 scripts/production_approval_guard.py

git show "$PRE_INFRA_SHA:api/wrangler.toml" > "$ROLLBACK_CONFIG" || fail "Preparar config de rollback"

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
STATUS_ROOT="$(curl -sS -o /dev/null -w '%{http_code}' https://intaprd.com/)"
[ "$STATUS_ROOT" = "200" ] || fail "Web raíz HTTP $STATUS_ROOT"
echo "✓ https://intaprd.com -> HTTP 200"

# Confirmar que el HTML productivo apunta al build nuevo del Web.
INDEX_HTML="$LOG_DIR/index.html"
curl -fsS https://intaprd.com/ -o "$INDEX_HTML" || fail "Descargar HTML productivo"
if ! grep -q 'assets/index-' "$INDEX_HTML"; then
  fail "HTML productivo no contiene assets esperados"
fi

echo "✓ HTML productivo servido correctamente"

rm -f "$ROLLBACK_CONFIG"
WORKER_DEPLOYED=0

TAG="prod-vcard-direct-2026-08-31-$(date +%H%M%S)"
git tag -a "$TAG" -m "Approved vCard direct-open production release $FINAL_SHA" "$FINAL_SHA" || true
git push github "$TAG" || true

HEALTH="$(curl -fsS https://intaprd.com/api/health || true)"

echo ""
echo "============================================================"
echo "✓ VCARD DIRECT OPEN · RELEASE A PRODUCCIÓN COMPLETADO"
echo "============================================================"
echo "Branch:          $BRANCH"
echo "Commit:          $FINAL_SHA"
echo "Release tag:     $TAG"
echo "Web Pages:       $WEB_ORIGIN"
echo "Worker Version:  ${WORKER_VERSION:-ver salida Wrangler}"
echo "Web:             https://intaprd.com"
echo "Health:          $HEALTH"
echo "Logs:            $LOG_DIR"
echo "============================================================"
