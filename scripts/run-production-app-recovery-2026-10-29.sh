#!/usr/bin/env bash
# Kawvo · recuperación controlada de App, 29/oct/2026. No D1, R2, Worker ni Web.
set -euo pipefail
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawvo-sponsor-commercial-controls-2026-10-27"
BASE="0994d9e5463c3f05588ff782b8fdac07299cbab8"
APP_ORIGIN="https://app.intaprd.com"
LOG="$HOME/intap-release-logs/kawvo-app-recovery-$(date -u +%Y%m%dT%H%M%SZ)"
fail(){ echo "DETENIDO: $*" >&2; exit 1; }
[[ "${KAWVO_APP_PROD_APPROVED:-}" == "SI" ]] || fail "Requiere aprobación explícita KAWVO_APP_PROD_APPROVED=SI"
cd "$ROOT" || fail "No se encontró el checkout"
[[ -z "$(git status --porcelain)" ]] || fail "Árbol local modificado: no se realiza despliegue"
git fetch github main "$BRANCH"
git switch "$BRANCH"
git pull --ff-only github "$BRANCH"
[[ -z "$(git status --porcelain)" ]] || fail "Árbol no limpio tras actualizar"
git merge-base --is-ancestor "$BASE" HEAD || fail "El release productivo 0994d9e5 no es ancestro"
[[ "$(git rev-parse github/main)" == "76babd4dd26faf7d502910c0fc65989c3b16f36a" ]] || fail "main cambió desde auditoría: reconciliar antes"
git diff --check "$BASE"..HEAD
# Del release aprobado a este candidato: solo 3 componentes App; scripts y documentación de auditoría.
while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  case "$file" in
    app/src/components/admin/free/FreeDashboard.tsx|app/src/components/admin/medical/MedicalDashboard.tsx|app/src/components/admin/sponsored/SponsoredDashboard.tsx|docs/handoffs/BITACORA_FORENSE_KAWVO_LINK_PUBLICACION_MULTICUENTA_2026-10-29.md|docs/handoffs/BITACORA_FORENSE_KAWVO_MULTICUENTA_PUBLICACION_2026-10-29.md|docs/handoffs/BITACORA_MAESTRA_CHAT_SPONSOR_PRODUCCION_REGRESIONES_2026-10-29.md|scripts/run-preview-sponsor-commercial-2026-10-27.sh|scripts/run-preview-sponsored-publication-2026-10-29.sh|scripts/test-kawvo-publication-regression-contract.mjs|scripts/audit-kawvo-approved-vs-production-2026-10-29.sh|scripts/run-production-app-recovery-2026-10-29.sh) ;;
    *) fail "Ruta inesperada después del release: $file" ;;
  esac
done < <(git diff --name-only "$BASE"..HEAD)
mkdir -p "$LOG"
git rev-parse HEAD | tee "$LOG/candidate-sha.txt"
git diff --name-status "$BASE"..HEAD > "$LOG/scope.txt"
echo "▶ Contratos y compilación"
node scripts/test-kawvo-publication-regression-contract.mjs
node scripts/test-intapcard-active-account-contract.mjs
node scripts/test-sponsor-commercial-contract.mjs
node scripts/test-intapcard-kawmed-integrated-contract.mjs
npx tsc --noEmit -p api/tsconfig.json
npm run build -w app
# No publicar Web pública: solo App Pages.
[[ -f app/dist/index.html ]] || fail "Falta app/dist/index.html"
APP_ASSET="$(grep -Eo '/assets/index-[^"]+\.js' app/dist/index.html | head -1)"
[[ -n "$APP_ASSET" && -f "app/dist${APP_ASSET}" ]] || fail "No se pudo determinar JS principal de App"
shasum -a 256 "app/dist${APP_ASSET}" > "$LOG/app-bundle-local.sha256"
echo "▶ Snapshot documental del frontend actualmente publicado"
curl -fsSL --max-time 30 "$APP_ORIGIN/" -o "$LOG/production-before-index.html" || fail "No responde App Producción"
grep -Eo '/assets/index-[^"]+\.js' "$LOG/production-before-index.html" | head -1 > "$LOG/production-before-bundle.txt" || true
echo "Previo: $(cat "$LOG/production-before-bundle.txt")"
echo "Nuevo: $APP_ASSET"
[[ "${KAWVO_APP_PROD_APPROVED}" == "SI" ]] || fail "Confirmación no presente"
echo "▶ Único deploy permitido: App Pages / intap-web2 / main"
npx wrangler pages deploy app/dist --project-name intap-web2 --branch main 2>&1 | tee "$LOG/app-pages-deploy.log"
echo "▶ Confirmación del bundle en dominio productivo (documento y bytes)"
EXPECTED="$(shasum -a 256 "app/dist${APP_ASSET}" | awk '{print $1}')"
VERIFIED=0
for i in 1 2 3 4 5 6; do
  if curl -fsSL --max-time 30 "$APP_ORIGIN/" -o "$LOG/production-after-index.html"; then
    REMOTE_ASSET="$(grep -Eo '/assets/index-[^"]+\.js' "$LOG/production-after-index.html" | head -1 || true)"
    if [[ "$REMOTE_ASSET" == "$APP_ASSET" ]]; then
      REMOTE_SHA="$(curl -fsSL --max-time 30 "$APP_ORIGIN$APP_ASSET" | shasum -a 256 | awk '{print $1}')" || REMOTE_SHA=""
      if [[ "$REMOTE_SHA" == "$EXPECTED" ]]; then VERIFIED=1; break; fi
    fi
  fi
  sleep 5
done
[[ "$VERIFIED" == 1 ]] || fail "No se verificó el nuevo bundle. Revisar Pages, no repetir despliegue a ciegas. Logs: $LOG"
for url in "$APP_ORIGIN/admin/login" "$APP_ORIGIN/api/health"; do
  CODE="$(curl -sSL --max-time 30 -o /dev/null -w '%{http_code}' "$url" || true)"
  printf '%s HTTP %s\n' "$url" "$CODE" | tee -a "$LOG/smoke.txt"
  [[ "$CODE" == 200 ]] || fail "Smoke falló: $url; no ejecutar otro release"
done
echo "✓ App desplegada; bundle idéntico y smokes HTTP correctos."
echo "IMPORTANTE: sigue pendiente QA autenticada (Free/KawMed/patrocinado y republicación)."
echo "Referencia del deployment anterior documentado: https://7c8a5eab.intap-web2.pages.dev"
echo "Logs y manifest: $LOG"
