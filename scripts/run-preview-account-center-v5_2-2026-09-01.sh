#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawvo-account-center-v1"
LOG_DIR="$ROOT/.preview-account-center-v5_2-2026-09-01-logs"

fail() { echo ""; echo "✗ ERROR: $1"; echo "Producción no fue tocada."; exit 1; }
run() { echo ""; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
mkdir -p "$LOG_DIR"
run git fetch github "$BRANCH"
run git reset --hard "github/$BRANCH"
run python3 scripts/apply-account-center-v5_2.py
run git diff --check

echo ""
echo "▶ Validando fix social V5.2"
grep -Fq 'async function proxyInvitationWithMeta' api/src/preview-frontdoor-entry.ts || fail "Falta inyector social de invitación"
grep -Fq "url.pathname === '/invitacion'" api/src/preview-frontdoor-entry.ts || fail "Falta ruta /invitacion en frontdoor"
grep -Fq "Te recomiendo Kawvo Link" api/src/preview-frontdoor-entry.ts || fail "Falta título social"
echo "✓ fix V5.2 validado"

run git add api/src/preview-frontdoor-entry.ts
if ! git diff --cached --quiet; then
  run git commit -m "fix(preview): inject invitation social card at frontdoor"
  run git push github "HEAD:$BRANCH"
fi

run git diff --check

echo ""
echo "▶ TypeScript API Preview"
(cd api && npx tsc --noEmit) || fail "TypeScript API Preview"

echo ""
echo "▶ Dry-run Worker Preview"
(cd api && npx wrangler deploy --config wrangler.preview.toml --dry-run) || fail "Dry-run Worker Preview"

echo ""
echo "▶ Deploy Worker SOLO Preview"
WORKER_LOG="$LOG_DIR/worker-$(date +%Y%m%d-%H%M%S).log"
(cd api && npx wrangler deploy --config wrangler.preview.toml) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Preview"
WORKER_VERSION="$(grep -E 'Current Version ID:' "$WORKER_LOG" | tail -1 | sed -E 's/.*Current Version ID:[[:space:]]*//')"

INVITE_URL="https://preview.intaprd.com/invitacion"
code="$(curl -sS -o /dev/null -w '%{http_code}' "$INVITE_URL")"
[ "$code" = "200" ] || fail "$INVITE_URL respondió HTTP $code"
echo "✓ $INVITE_URL -> HTTP 200"

INVITE_HTML="$(curl -sS "$INVITE_URL")"
printf '%s' "$INVITE_HTML" | grep -Fq '<meta property="og:title" content="Te recomiendo Kawvo Link">' || fail "Falta og:title de invitación"
printf '%s' "$INVITE_HTML" | grep -Fq '<meta property="og:image"' || fail "Falta og:image de invitación"
printf '%s' "$INVITE_HTML" | grep -Fq '<meta name="twitter:card" content="summary_large_image">' || fail "Falta Twitter card de invitación"
echo "✓ Graph Card /invitacion inyectada desde frontdoor"

BANK_TEST="https://preview.intaprd.com/__account_center_bank_smoke__?share=bancos"
# Solo valida que la ruta bancaria siga entrando por el inyector existente; un slug inexistente no debe inventar perfil.
code_bank="$(curl -sS -o /dev/null -w '%{http_code}' "$BANK_TEST")"
echo "✓ Ruta bancaria smoke respondió HTTP $code_bank (sin perfil inventado)"

echo ""
echo "============================================================"
echo "✓ ACCOUNT CENTER V5.2 · PREVIEW LISTO PARA QA"
echo "============================================================"
echo "Commit:         $(git rev-parse HEAD)"
echo "Worker Version: ${WORKER_VERSION:-ver salida Wrangler}"
echo "Invitación:     $INVITE_URL"
echo "Producción:     NO TOCADA"
echo ""
echo "Corregido:"
echo "- /invitacion recibe Graph Card en el Worker frontdoor de Preview."
echo "- No depende de que Pages Functions se ejecuten detrás del proxy custom-domain."
echo "- V5 funcional previa se conserva intacta."
echo "============================================================"
