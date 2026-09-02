#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="reconcile/approved-releases-2026-09-01"
WEB_PROJECT="intap-web2"
APP_ORIGIN="https://e08097aa.intap-link.pages.dev"
LOG_DIR="$ROOT/.preview-demo-ia-cta-2026-09-01-logs"
WRANGLER_BACKUP=""

fail() { echo ""; echo "✗ ERROR: $1"; echo "Producción NO fue tocada."; exit 1; }
cleanup() {
  if [ -n "$WRANGLER_BACKUP" ] && [ -f "$WRANGLER_BACKUP" ]; then
    cp "$WRANGLER_BACKUP" "$ROOT/api/wrangler.preview.toml" || true
    rm -f "$WRANGLER_BACKUP" || true
  fi
}
trap cleanup EXIT

cd "$ROOT" || fail "No existe $ROOT"
mkdir -p "$LOG_DIR"

git fetch github "$BRANCH" || fail "git fetch"
git checkout -B "$BRANCH" "github/$BRANCH" || fail "checkout"
git reset --hard "github/$BRANCH" || fail "reset"

python3 scripts/apply-demo-ia-cta-route-2026-09-01.py || fail "aplicar CTA Demo IA"
git diff --check || fail "git diff --check"

echo "▶ Validando CTA de Demo"
! grep -Fq 'href="#demo"' web/src/components/marketing/MarketingLanding.tsx || fail "Quedó algún CTA apuntando a #demo"
grep -Fq '<a href="/demo/ia" onClick={() => setMenuOpen(false)}>Demo</a>' web/src/components/marketing/MarketingLanding.tsx || fail "Menú Demo no apunta a /demo/ia"
grep -Fq 'className="intap-header-cta" href="/demo/ia"' web/src/components/marketing/MarketingLanding.tsx || fail "CTA superior no apunta a /demo/ia"
grep -Fq 'className="btn-primary" href="/demo/ia"' web/src/components/marketing/MarketingLanding.tsx || fail "CTA principal no apunta a /demo/ia"
grep -Fq 'className="btn-primary full" href="/demo/ia"' web/src/components/marketing/MarketingLanding.tsx || fail "CTA de sección Demo no apunta a /demo/ia"
grep -Fq 'className="btn-primary light" href="/demo/ia"' web/src/components/marketing/MarketingLanding.tsx || fail "CTA final no apunta a /demo/ia"
echo "✓ Todos los CTA de Demo apuntan a /demo/ia"

git add web/src/components/marketing/MarketingLanding.tsx
if ! git diff --cached --quiet; then
  git commit -m "fix(marketing): point all Demo CTAs to Demo IA" || fail "commit CTA"
  git push github "HEAD:$BRANCH" || fail "push CTA"
fi

(cd web && npm run build) || fail "Build Web Preview"

WEB_LOG="$LOG_DIR/web-pages-$(date +%Y%m%d-%H%M%S).log"
(cd web && npx wrangler pages deploy dist --project-name "$WEB_PROJECT" --branch "$BRANCH") 2>&1 | tee "$WEB_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Web Preview"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$WEB_LOG" | tail -1)"
[ -n "$WEB_ORIGIN" ] || fail "No pude identificar WEB_PAGES_ORIGIN"
echo "✓ WEB_PAGES_ORIGIN=$WEB_ORIGIN"

WRANGLER_BACKUP="$(mktemp)"
cp api/wrangler.preview.toml "$WRANGLER_BACKUP"
APP_ORIGIN="$APP_ORIGIN" WEB_ORIGIN="$WEB_ORIGIN" python3 - <<'PY' || fail "Actualizar origins temporales Preview"
from pathlib import Path
import os, re
p = Path('api/wrangler.preview.toml')
s = p.read_text()
s, a = re.subn(r'^APP_PAGES_ORIGIN = ".*"$', f'APP_PAGES_ORIGIN = "{os.environ["APP_ORIGIN"]}"', s, count=1, flags=re.M)
s, w = re.subn(r'^WEB_PAGES_ORIGIN = ".*"$', f'WEB_PAGES_ORIGIN = "{os.environ["WEB_ORIGIN"]}"', s, count=1, flags=re.M)
if a != 1 or w != 1: raise SystemExit('No pude actualizar origins Preview')
p.write_text(s)
PY

WORKER_LOG="$LOG_DIR/worker-$(date +%Y%m%d-%H%M%S).log"
(cd api && npx wrangler deploy --config wrangler.preview.toml) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Preview"
WORKER_VERSION="$(grep -E 'Current Version ID:' "$WORKER_LOG" | tail -1 | sed -E 's/.*Current Version ID:[[:space:]]*//')"

for url in \
  "https://preview.intaprd.com/" \
  "https://preview.intaprd.com/demo/ia" \
  "https://app.preview.intaprd.com/admin/free/account"; do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
  echo "✓ $url -> HTTP 200"
done

HTML="$(curl -sS 'https://preview.intaprd.com/?qa=demo-ia-cta')"
COUNT="$(printf '%s' "$HTML" | grep -o 'href="/demo/ia"' | wc -l | tr -d ' ')"
[ "$COUNT" -ge 5 ] || fail "La landing Preview no expone suficientes CTA hacia /demo/ia (detectados: $COUNT)"
echo "✓ Landing Preview expone $COUNT CTA hacia /demo/ia"

cleanup
WRANGLER_BACKUP=""

echo ""
echo "============================================================"
echo "✓ CTA DEMO IA · PREVIEW APROBADO TÉCNICAMENTE"
echo "============================================================"
echo "Commit:         $(git rev-parse HEAD)"
echo "Web Pages:      $WEB_ORIGIN"
echo "Worker Version: ${WORKER_VERSION:-ver salida Wrangler}"
echo "Producción:     NO TOCADA"
echo "============================================================"
