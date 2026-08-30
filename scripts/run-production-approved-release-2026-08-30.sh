#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="fix/free-mobile-ai-bank-share"
APP_PROJECT="intap-link"
WEB_PROJECT="intap-web2"
PRE_INFRA_SHA="4a252cd20cae27c383345f54076aac65acd2b48c"
LOG_DIR="$ROOT/.production-release-2026-08-30-logs"
RELEASE_BRANCH="prod-release-20260830-$(date +%H%M%S)"
WORKER_DEPLOYED=0
ROLLBACK_CONFIG="$ROOT/api/.wrangler.rollback.toml"

fail() {
  echo ""
  echo "✗ ERROR: $1"
  if [ "$WORKER_DEPLOYED" = "1" ]; then
    echo "▶ Restaurando front door anterior de Producción..."
    if git show "$PRE_INFRA_SHA:api/wrangler.toml" > "$ROLLBACK_CONFIG"; then
      (cd "$ROOT/api" && npx wrangler deploy --config .wrangler.rollback.toml) || true
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
echo "RELEASE PRODUCTIVO APROBADO"
echo "Branch: $BRANCH"
echo "Source SHA: $SOURCE_SHA"
echo "============================================================"

# La aprobación explícita fue dada en conversación para pasar este lote a Producción.
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

if [ -f scripts/test-ai-profile-assistant-contract.mjs ]; then
  run node scripts/test-ai-profile-assistant-contract.mjs
fi
if [ -f scripts/test-ai-profile-canonical-limits.mjs ]; then
  run node scripts/test-ai-profile-canonical-limits.mjs
fi

# Registrar estado previo del Worker sin cambiar nada.
echo ""
echo "▶ Estado previo del Worker productivo"
(cd api && npx wrangler deployments list --config wrangler.toml) 2>&1 | tee "$LOG_DIR/worker-before.log" || true

# Publicar los builds a deployments de Pages aislados. No se usa main todavía:
# Producción comenzará a servirlos solo cuando el front door productivo se despliegue.
echo ""
echo "▶ Subiendo App a deployment de release (sin mover custom domain todavía)"
APP_LOG="$LOG_DIR/app-pages-$(date +%Y%m%d-%H%M%S).log"
(cd api && npx wrangler pages deploy ../app/dist --project-name "$APP_PROJECT" --branch "$RELEASE_BRANCH") 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy release App Pages"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$APP_LOG" | tail -1)"
[ -n "$APP_ORIGIN" ] || fail "No pude identificar APP_PAGES_ORIGIN"
echo "✓ APP_PAGES_ORIGIN=$APP_ORIGIN"

echo ""
echo "▶ Subiendo Web a deployment de release (sin mover custom domain todavía)"
WEB_LOG="$LOG_DIR/web-pages-$(date +%Y%m%d-%H%M%S).log"
(cd api && npx wrangler pages deploy ../web/dist --project-name "$WEB_PROJECT" --branch "$RELEASE_BRANCH") 2>&1 | tee "$WEB_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy release Web Pages"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$WEB_LOG" | tail -1)"
[ -n "$WEB_ORIGIN" ] || fail "No pude identificar WEB_PAGES_ORIGIN"
echo "✓ WEB_PAGES_ORIGIN=$WEB_ORIGIN"

# Fijar origins inmutables en el config productivo y dejar trazabilidad en Git.
APP_ORIGIN="$APP_ORIGIN" WEB_ORIGIN="$WEB_ORIGIN" python3 - <<'PY' || fail "Actualizar origins productivos"
from pathlib import Path
import os, re
p = Path('api/wrangler.toml')
s = p.read_text()
s, n1 = re.subn(r'^APP_PAGES_ORIGIN = ".*"$', f'APP_PAGES_ORIGIN = "{os.environ["APP_ORIGIN"]}"', s, count=1, flags=re.M)
s, n2 = re.subn(r'^WEB_PAGES_ORIGIN = ".*"$', f'WEB_PAGES_ORIGIN = "{os.environ["WEB_ORIGIN"]}"', s, count=1, flags=re.M)
if n1 != 1 or n2 != 1:
    raise SystemExit('No pude fijar origins productivos')
p.write_text(s)
print('✓ origins productivos fijados')
PY

run git diff --check
run git add api/wrangler.toml
if ! git diff --cached --quiet; then
  run git commit -m "chore(prod): pin approved release origins"
  run git push github "HEAD:$BRANCH"
fi

FINAL_SHA="$(git rev-parse HEAD)"
export INTAP_APPROVED_COMMIT="$FINAL_SHA"
run python3 scripts/production_approval_guard.py

# Preparar rollback de routing ANTES de tocar el Worker.
git show "$PRE_INFRA_SHA:api/wrangler.toml" > "$ROLLBACK_CONFIG" || fail "Preparar config de rollback"

echo ""
echo "▶ Desplegando Worker a PRODUCCIÓN"
WORKER_LOG="$LOG_DIR/worker-prod-$(date +%Y%m%d-%H%M%S).log"
(cd api && npx wrangler deploy --config wrangler.toml) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Producción"
WORKER_DEPLOYED=1
WORKER_VERSION="$(grep -E 'Current Version ID:' "$WORKER_LOG" | tail -1 | sed -E 's/.*Current Version ID:[[:space:]]*//')"

# Smoke tests de infraestructura y rutas principales.
echo ""
echo "▶ Smoke tests de Producción"
curl -fsS https://intaprd.com/api/health | tee "$LOG_DIR/health.json" >/dev/null || fail "Health productivo"
curl -fsS -o /dev/null https://app.intaprd.com/admin/free || fail "App /admin/free"
curl -fsS -o /dev/null https://intaprd.com/ || fail "Web raíz"

# Verificar que una URL de perfil publicada entrega OG dinámico. Si 1aeventos no
# existe/publicado, no bloquea el release; sí deja diagnóstico en logs.
SOCIAL_LOG="$LOG_DIR/social-meta-1aeventos.html"
if curl -fsS "https://intaprd.com/1aeventos?share=bancos" -o "$SOCIAL_LOG"; then
  if grep -qi 'property="og:title"' "$SOCIAL_LOG" && grep -qi 'datos bancarios para transferencias' "$SOCIAL_LOG"; then
    echo "✓ Social meta bancario dinámico visible"
  else
    echo "⚠ No se pudo confirmar meta bancario con /1aeventos; revisar manualmente otro perfil publicado."
  fi
fi

rm -f "$ROLLBACK_CONFIG"
WORKER_DEPLOYED=0

# Marcar release productivo en Git para trazabilidad.
TAG="prod-2026-08-30-$(date +%H%M%S)"
git tag -a "$TAG" -m "Approved production release $FINAL_SHA" "$FINAL_SHA" || true
git push github "$TAG" || true

# Verificación final del health visible.
HEALTH="$(curl -fsS https://intaprd.com/api/health || true)"

echo ""
echo "============================================================"
echo "✓ RELEASE A PRODUCCIÓN COMPLETADO"
echo "============================================================"
echo "Branch:          $BRANCH"
echo "Commit:          $FINAL_SHA"
echo "Release tag:     $TAG"
echo "App Pages:       $APP_ORIGIN"
echo "Web Pages:       $WEB_ORIGIN"
echo "Worker Version:  ${WORKER_VERSION:-ver salida Wrangler}"
echo "App:             https://app.intaprd.com/admin/free"
echo "Web:             https://intaprd.com"
echo "Health:          $HEALTH"
echo "Logs:            $LOG_DIR"
echo "============================================================"
