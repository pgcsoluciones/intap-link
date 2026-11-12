#!/usr/bin/env bash
# Publish only the OFFLINE Kawvo UX prototype to an ISOLATED Cloudflare Pages QA branch.
# No App, API, Worker, D1, R2, Web Production/Preview custom-domain deployments.
set -euo pipefail
[[ "$(printenv KAWVO_SHELL_PROTO_QA_APPROVED 2>/dev/null || true)" == "SI" ]] || {
  echo "DETENIDO: requiere KAWVO_SHELL_PROTO_QA_APPROVED=SI"
  exit 1
}
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="design/kawvo-mobile-shell-prototype-2026-11-12"
BASE="2f88ea37ff6bb27cb61422613e188544770b9cb7"
SOURCE="prototypes/kawvo-mobile-shell-2026-11-12"
QA_BRANCH="qa-kawvo-shell-1112"
fail(){ echo "DETENIDO: $*" >&2; exit 1; }
cd "$ROOT" || fail "No se encuentra el repositorio"
[[ -z "$(git status --porcelain)" ]] || fail "Checkout con cambios; no se cambiará la rama"
git fetch github "$BRANCH"
git switch "$BRANCH"
git pull --ff-only github "$BRANCH"
git merge-base --is-ancestor "$BASE" HEAD || fail "Rama base incorrecta"
git diff --check "$BASE"..HEAD
CHANGED="$(git diff --name-only "$BASE"..HEAD)"
EXPECTED="$(printf '%s\n' \
 prototypes/kawvo-mobile-shell-2026-11-12/index.html \
 scripts/run-preview-kawvo-mobile-shell-prototype-2026-11-12.sh)"
[[ "$CHANGED" == "$EXPECTED" ]] || {
  printf '%s\n' "$CHANGED"
  fail "Archivos fuera de la allowlist (sólo prototipo + runner)"
}
[[ -f "$SOURCE/index.html" ]] || fail "Prototipo no encontrado"
grep -Fq 'PROTOTIPO INTERACTIVO' "$SOURCE/index.html" || fail "Falta aviso de demostración"
grep -Fq 'var roles={' "$SOURCE/index.html" || fail "Falta selector de roles"
grep -Fq 'var tabs=' "$SOURCE/index.html" || fail "Falta navegación común"
grep -Fq 'data-state=' "$SOURCE/index.html" || fail "Faltan estados visuales"
! grep -Eiq 'fetch\(|XMLHttpRequest|sendBeacon|apiPost\(|apiGet\(|localStorage|sessionStorage|window\.location\.assign|window\.location\.replace' "$SOURCE/index.html" || fail "Prototipo no debe contener API, persistencia o navegación real"
[[ -z "$(git status --porcelain)" ]] || fail "Hay cambios inesperados"
mkdir -p "$HOME/intap-release-logs"
LOG="$(mktemp -d "$HOME/intap-release-logs/kawvo-mobile-shell-qa-2026-11-12-XXXXXXXX")"
echo "LOG: $LOG"
git rev-parse HEAD > "$LOG/source-commit.txt"
echo "===== Subiendo solamente la maqueta estática a Pages QA independiente ====="
npx --no-install wrangler pages deploy "$SOURCE" --project-name intap-link --branch "$QA_BRANCH" --commit-hash "$(git rev-parse HEAD)" 2>&1 | tee "$LOG/pages-qa-deploy.txt"
URL="$(grep -Eo 'https://[a-z0-9]{8,}\.intap-link\.pages\.dev' "$LOG/pages-qa-deploy.txt" | tail -n1 || true)"
[[ -n "$URL" ]] || fail "Puede haberse publicado; verificar log, NO repetir automáticamente"
printf '%s\n' "$URL" > "$LOG/qa-url.txt"
CODE="$(curl -sS -L --max-time 30 -o /dev/null -w '%{http_code}' "$URL/" || true)"
[[ "$CODE" == "200" ]] || fail "La URL respondió HTTP $CODE; no repetir sin revisar log"
echo
echo "PASS: prototipo móvil Kawvo disponible en $URL (HTTP 200)"
echo "Alias: https://$QA_BRANCH.intap-link.pages.dev"
echo "Contiene únicamente HTML/CSS/JS demostrativo, sin conexión a API."
echo "Web principal, Preview de producto, App, Workers, D1 y R2 intactos."
echo "LOG: $LOG"
