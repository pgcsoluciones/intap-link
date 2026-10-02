#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
REMOTE="github"
BRANCH="hotfix/bank-holder-id-copy-2026-10-02"
EXPECTED_MAIN_SHA="e7936177dc15ff2ab75563903464320b10be07fd"
APPROVED_PREVIEW_SHA="6295a0404f9276da68f158485895ec96e43793f8"
RUNNER_PATH="scripts/run-production-bank-holder-id-copy-2026-10-02.sh"
WEB_PROJECT="intap-link"
LOG_DIR="$ROOT/.production-bank-holder-id-copy-logs"
WEB_LOG="$LOG_DIR/web-pages-production.log"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR"
mkdir -p "$LOG_DIR"

cat <<EOF
================================================================
KAWVO LINK · HOTFIX COPIA RNC/CÉDULA · PRODUCCIÓN
================================================================
Promueve únicamente el Preview aprobado:
- Cuenta conserva copia del número de cuenta
- RNC / CÉD. copia la identidad configurada
- preserva el gesto del usuario mediante ClipboardItem
- fallback compatible
- identidad NO se muestra en pantalla
- Free/Team/Trial + Patrocinado
- sin cambios D1, R2, App ni API

Main esperado:    $EXPECTED_MAIN_SHA
Preview aprobado: $APPROVED_PREVIEW_SHA
================================================================
EOF

run git fetch "$REMOTE" main "$BRANCH"
CURRENT_MAIN="$(git rev-parse "$REMOTE/main")"
[ "$CURRENT_MAIN" = "$EXPECTED_MAIN_SHA" ] || fail "main cambió: esperado $EXPECTED_MAIN_SHA, actual $CURRENT_MAIN. Detener y auditar."

run git switch "$BRANCH"
run git pull --ff-only "$REMOTE" "$BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Árbol local no limpio"; }

git merge-base --is-ancestor "$APPROVED_PREVIEW_SHA" HEAD || fail "El Preview aprobado ya no es ancestro"
POST_APPROVAL="$(git diff --name-only "$APPROVED_PREVIEW_SHA"..HEAD | grep -v "^scripts/run-production-bank-holder-id-copy-2026-10-02.sh$" || true)"
[ -z "$POST_APPROVAL" ] || { echo "$POST_APPROVAL"; fail "Hay cambios de producto posteriores al Preview aprobado"; }

git merge-base --is-ancestor "$REMOTE/main" HEAD || fail "main y hotfix divergieron"

cat > "$LOG_DIR/expected-files.txt" <<'EOF_FILES'
scripts/run-preview-bank-holder-id-copy-2026-10-02.sh
scripts/run-production-bank-holder-id-copy-2026-10-02.sh
scripts/test-bank-holder-id-copy-contract.mjs
web/src/components/free-profile/PublicBankAccounts.tsx
web/src/components/sponsored/SponsoredBankAccounts.tsx
EOF_FILES

git diff --name-only "$REMOTE/main"...HEAD | sort > "$LOG_DIR/actual-files.txt"
sort "$LOG_DIR/expected-files.txt" > "$LOG_DIR/expected-files.sorted.txt"
diff -u "$LOG_DIR/expected-files.sorted.txt" "$LOG_DIR/actual-files.txt" || fail "El alcance no coincide con el Preview aprobado"

run git diff --check "$REMOTE/main"...HEAD
run npm ci
run node scripts/test-bank-holder-id-copy-contract.mjs
run npm run build -w web
run bash -lc 'cd api && npx tsc --noEmit'

echo; echo "▶ Deploy Web Producción"
(npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch main) 2>&1 | tee "$WEB_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Web Producción"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$WEB_LOG" | tail -1 || true)"

sleep 5

echo; echo "▶ Smoke Producción"
for url in "https://intaprd.com/" "https://intaprd.com/jlprince"; do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

echo; echo "▶ Promover hotfix validado a main"
PREVIOUS_MAIN="$CURRENT_MAIN"
run git switch -C main "$REMOTE/main"
run git merge --ff-only "$REMOTE/$BRANCH"
run git push "$REMOTE" main
PROD_SHA="$(git rev-parse HEAD)"

run git fetch "$REMOTE" main
[ "$(git rev-parse "$REMOTE/main")" = "$PROD_SHA" ] || fail "main remoto no coincide con el SHA desplegado"

TAG="prod-bank-holder-id-copy-2026-10-02-$(date +%H%M%S)"
run git tag -a "$TAG" -m "Kawvo Link holder id clipboard hotfix production"
run git push "$REMOTE" "$TAG"

rm -rf "$LOG_DIR"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Runner dejó cambios locales"; }

cat <<EOF
================================================================
✓ HOTFIX COPIA RNC/CÉDULA · PRODUCCIÓN CERRADA
================================================================
Production SHA: $PROD_SHA
Release tag:    $TAG
Previous main:  $PREVIOUS_MAIN
Web Pages:      ${WEB_ORIGIN:-ver salida Pages}

Incluye:
✓ Cuenta copia número de cuenta
✓ RNC / CÉD. copia identidad configurada
✓ ClipboardItem preserva gesto del usuario
✓ fallback compatible
✓ identidad sigue oculta visualmente
✓ Free/Team/Trial + Patrocinado
================================================================
EOF
