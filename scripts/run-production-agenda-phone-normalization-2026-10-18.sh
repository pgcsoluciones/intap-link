#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
REMOTE="github"
FEATURE_BRANCH="fix/agenda-phone-normalization-2026-10-18"
EXPECTED_MAIN_SHA="477e6be240e83af8cfffbb395af676134810e0e8"
APPROVED_PREVIEW_SHA="4d6e9320ae13d9a1131488faccd13888ad2e9eeb"
RUNNER_PATH="scripts/run-production-agenda-phone-normalization-2026-10-18.sh"
WEB_PROJECT="intap-link"
APP_PROJECT="intap-web2"
LOG_DIR="$ROOT/.production-agenda-phone-normalization-2026-10-18"
WEB_LOG="$LOG_DIR/web-pages-production.log"
APP_LOG="$LOG_DIR/app-pages-production.log"
WORKER_LOG="$LOG_DIR/worker-production.log"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR"
mkdir -p "$LOG_DIR"

cat <<EOF
================================================================
KAWVO LINK · AGENDA · RESPUESTA WHATSAPP · PRODUCCIÓN
================================================================
Promueve exactamente el Preview aprobado.

Objetivo principal:
- Gestión de Agenda recibe el número del cliente que solicitó la cita.
- Al confirmar y pulsar "Responder por WhatsApp", el destino debe ser
  el número real del cliente normalizado, sin @ ni símbolos.
- Números RD 809/829/849 se convierten a formato internacional 1XXXXXXXXXX.
- Solicitudes históricas se normalizan al leerlas.
- Aplica a Agenda Free y Patrocinada.
- Sin migraciones D1.

Main esperado:    $EXPECTED_MAIN_SHA
Preview aprobado: $APPROVED_PREVIEW_SHA
================================================================
EOF

run git fetch "$REMOTE" main "$FEATURE_BRANCH"
CURRENT_MAIN="$(git rev-parse "$REMOTE/main")"
[ "$CURRENT_MAIN" = "$EXPECTED_MAIN_SHA" ] || fail "main cambió: esperado $EXPECTED_MAIN_SHA, actual $CURRENT_MAIN. Detener y auditar."

run git switch "$FEATURE_BRANCH"
run git pull --ff-only "$REMOTE" "$FEATURE_BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Árbol local no limpio"; }

HEAD_SHA="$(git rev-parse HEAD)"
echo "Feature HEAD: $HEAD_SHA"
git merge-base --is-ancestor "$APPROVED_PREVIEW_SHA" HEAD || fail "El Preview aprobado ya no es ancestro"
POST_APPROVAL="$(git diff --name-only "$APPROVED_PREVIEW_SHA"..HEAD | grep -v "^\${RUNNER_PATH}$" || true)"
[ -z "$POST_APPROVAL" ] || { echo "$POST_APPROVAL"; fail "Hay cambios de producto posteriores al Preview aprobado"; }

git merge-base --is-ancestor "$REMOTE/main" HEAD || fail "main y feature divergieron"
[ "$(git rev-list --count HEAD.."$REMOTE/main")" = "0" ] || fail "La feature está detrás de main"

cat > "$LOG_DIR/expected-files.txt" <<'EOF_FILES'
api/src/appointments-core.ts
app/src/components/appointments/AppointmentManager.tsx
scripts/run-preview-agenda-phone-normalization-2026-10-18.sh
scripts/run-production-agenda-phone-normalization-2026-10-18.sh
scripts/test-agenda-phone-normalization-contract.mjs
web/src/components/appointments/AppointmentRequestModal.tsx
EOF_FILES

git diff --name-only "$REMOTE/main"...HEAD | sort > "$LOG_DIR/actual-files.txt"
sort "$LOG_DIR/expected-files.txt" > "$LOG_DIR/expected-files.sorted.txt"
diff -u "$LOG_DIR/expected-files.sorted.txt" "$LOG_DIR/actual-files.txt" || fail "El alcance del release no coincide exactamente con lo aprobado"

run git diff --check "$REMOTE/main"...HEAD

echo; echo "▶ Verificar configuración de Producción"
grep -Fq 'name = "intap-api"' api/wrangler.toml || fail "Worker incorrecto"
grep -Fq 'database_name = "intap_db"' api/wrangler.toml || fail "D1 incorrecta"
grep -Fq 'bucket_name = "intap-r2"' api/wrangler.toml || fail "R2 incorrecto"
grep -Fq 'APP_URL = "https://app.intaprd.com"' api/wrangler.toml || fail "APP_URL incorrecta"
grep -Fq 'WEB_URL = "https://intaprd.com"' api/wrangler.toml || fail "WEB_URL incorrecta"
grep -Fq 'VITE_API_URL=https://api.intaprd.com' web/.env.production || fail "Web API incorrecta"
grep -Fq 'VITE_APP_URL=https://app.intaprd.com' web/.env.production || fail "Web App incorrecta"
grep -Fq 'VITE_API_URL=https://api.intaprd.com' app/.env.production || fail "App API incorrecta"
grep -Fq 'VITE_WEB_URL=https://intaprd.com' app/.env.production || fail "App Web incorrecta"

run npm ci
run node scripts/test-agenda-phone-normalization-contract.mjs
run npm run build -w app
run npm run build -w web
grep -R -Fq 'https://api.intaprd.com' web/dist/assets || fail "Bundle Web Producción no apunta al API productivo"
if grep -R -Fq 'https://preview.intaprd.com' web/dist/assets; then fail "Bundle Web Producción contiene referencia Preview"; fi
run bash -lc 'cd api && npx tsc --noEmit'
run bash -lc 'cd api && npx wrangler deploy --config wrangler.toml --dry-run'

echo; echo "▶ Verificar cadena exacta de confirmación WhatsApp"
grep -Fq "phone=normalizeAppointmentPhone(body?.phone)" api/src/appointments-core.ts || fail "Nueva solicitud no normaliza teléfono"
grep -Fq "customer_phone:normalizeAppointmentPhone(row.customer_phone)" api/src/appointments-core.ts || fail "Solicitudes históricas no se normalizan al leer"
grep -Fq "'https://wa.me/'+waPhone(item.customer_phone)" app/src/components/appointments/AppointmentManager.tsx || fail "Responder por WhatsApp no usa teléfono del cliente normalizado"
grep -Fq "displayPhone(item.customer_phone)" app/src/components/appointments/AppointmentManager.tsx || fail "Gestión de Agenda no muestra teléfono limpio"

PREVIOUS_MAIN="$CURRENT_MAIN"

echo; echo "▶ Deploy Worker Producción"
(
  cd api
  npm run deploy:production
) 2>&1 | tee "$WORKER_LOG"
[ "\${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Producción"
WORKER_VERSION="$(grep -E 'Current Version ID:' "$WORKER_LOG" | tail -1 | sed -E 's/.*Current Version ID:[[:space:]]*//' || true)"

echo; echo "▶ Deploy App Producción"
(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch main) 2>&1 | tee "$APP_LOG"
[ "\${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App Producción"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$APP_LOG" | tail -1 || true)"

echo; echo "▶ Deploy Web Producción"
(npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch main) 2>&1 | tee "$WEB_LOG"
[ "\${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Web Producción"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$WEB_LOG" | tail -1 || true)"

sleep 5

echo; echo "▶ Smoke Producción base"
for url in   "https://intaprd.com/"   "https://intaprd.com/demo"   "https://app.intaprd.com/admin/login"   "https://app.intaprd.com/superadmin"
do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

echo; echo "▶ Promover release validado a main"
run git switch -C main "$REMOTE/main"
run git merge --ff-only "$REMOTE/$FEATURE_BRANCH"
run git push "$REMOTE" main
PROD_SHA="$(git rev-parse HEAD)"

run git fetch "$REMOTE" main
[ "$(git rev-parse "$REMOTE/main")" = "$PROD_SHA" ] || fail "main remoto no coincide con el SHA desplegado"

TAG="prod-agenda-phone-normalization-2026-10-18-$(date +%H%M%S)"
run git tag -a "$TAG" -m "Kawvo Link agenda WhatsApp reply phone normalization production"
run git push "$REMOTE" "$TAG"

rm -rf "$LOG_DIR"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Runner dejó cambios locales"; }

cat <<EOF
================================================================
✓ AGENDA · RESPUESTA WHATSAPP · PRODUCCIÓN DESPLEGADA
================================================================
Production SHA: $PROD_SHA
Release tag:    $TAG
Previous main:  $PREVIOUS_MAIN
Worker Version: \${WORKER_VERSION:-ver salida Wrangler}
App Pages:      \${APP_ORIGIN:-ver salida Pages}
Web Pages:      \${WEB_ORIGIN:-ver salida Pages}

Validar en Producción:
1. Cliente solicita una cita con número RD.
2. Abrir Gestión de Agenda.
3. Confirmar la cita.
4. Pulsar "Responder por WhatsApp".
5. Debe abrir el cliente correcto, sin @.
6. Ejemplo 809-555-1234 -> wa.me/18095551234.
================================================================
EOF
