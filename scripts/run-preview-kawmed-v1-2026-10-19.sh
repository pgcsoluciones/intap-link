#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
REMOTE="github"
BRANCH="reconcile/kawmed-medical-profile-v1-2026-10-19-v2"
EXPECTED_MAIN_SHA="2391896286839528557066968ca4b8abe9831fb9"
WEB_PROJECT="intap-link"
PREVIEW_DB="intap_db_preview"
LOG_DIR="$ROOT/.preview-kawmed-v1-2026-10-19"
WEB_LOG="$LOG_DIR/web-pages.log"
WORKER_LOG="$LOG_DIR/worker-preview.log"
MIGRATION_LOG="$LOG_DIR/migrations.log"
PREVIEW_CFG="$ROOT/api/wrangler.preview.toml"
PREVIEW_CFG_BAK="$LOG_DIR/wrangler.preview.toml.bak"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR"
mkdir -p "$LOG_DIR"

cat <<EOF
================================================================
KAWMED · PERFIL MÉDICO V1 · RECONCILIACIÓN PREVIEW
================================================================
Base segura: current main
Main esperado: $EXPECTED_MAIN_SHA
Rama: $BRANCH

- NO toca Producción
- NO hace merge a main
- migra SOLO intap_db_preview
- despliega SOLO Web Preview + Worker Preview
- mantiene App Preview actual
- ruta QA: https://preview.intaprd.com/m/lauramendez
================================================================
EOF

[ -z "$(git status --porcelain)" ] || { git status --short; fail "Hay cambios locales; no cambio de rama"; }

run git fetch "$REMOTE" main "$BRANCH"
CURRENT_MAIN="$(git rev-parse "$REMOTE/main")"
[ "$CURRENT_MAIN" = "$EXPECTED_MAIN_SHA" ] || fail "main cambió: esperado $EXPECTED_MAIN_SHA, actual $CURRENT_MAIN. Detener y reconciliar."

run git switch "$BRANCH"
run git pull --ff-only "$REMOTE" "$BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Árbol local no limpio"; }

git merge-base --is-ancestor "$REMOTE/main" HEAD || fail "La rama KawMed no desciende del main actual"
[ "$(git rev-list --count HEAD.."$REMOTE/main")" = "0" ] || fail "La rama está detrás de main"

cat > "$LOG_DIR/expected-files.txt" <<'EOF_FILES'
api/migrations-preview/0090_kawmed_medical_profiles_v1.sql
api/migrations-preview/0091_kawmed_insurance_exclusions.sql
api/migrations/0090_kawmed_medical_profiles_v1.sql
api/migrations/0091_kawmed_insurance_exclusions.sql
api/src/index.ts
api/src/routes/medical-profile.ts
scripts/run-preview-kawmed-v1-2026-10-19.sh
scripts/test-kawmed-medical-profile-v1-contract.mjs
web/public/assets/kawmed/demo-doctor-reference.jpg
web/public/assets/kawmed/laura-mendez-hero.jpg
web/src/App.tsx
web/src/components/medical-profile/KawMedAppointmentModal.tsx
web/src/components/medical-profile/KawMedModal.tsx
web/src/components/medical-profile/KawMedProfile.css
web/src/components/medical-profile/KawMedProfile.tsx
web/src/components/medical-profile/types.ts
EOF_FILES

git diff --name-only "$REMOTE/main"...HEAD | sort > "$LOG_DIR/actual-files.txt"
sort "$LOG_DIR/expected-files.txt" > "$LOG_DIR/expected-files.sorted.txt"
diff -u "$LOG_DIR/expected-files.sorted.txt" "$LOG_DIR/actual-files.txt" || fail "El alcance KawMed no coincide exactamente con lo esperado"

run git diff --check "$REMOTE/main"...HEAD

echo; echo "▶ Contrato KawMed"
run npm ci
run node scripts/test-kawmed-medical-profile-v1-contract.mjs

echo; echo "▶ Build Web + API"
run npm run build:preview -w web
run bash -lc 'cd api && npx tsc --noEmit'
run bash -lc 'npx esbuild api/src/preview-frontdoor-entry.ts --bundle --platform=node --format=esm --target=node20 --external:cloudflare:* --outfile=/tmp/kawmed-preview-frontdoor.mjs'

echo; echo "▶ Verificar configuración Preview"
grep -Fq 'name = "intap-api-preview"' api/wrangler.preview.toml || fail "Worker Preview incorrecto"
grep -Fq 'database_name = "intap_db_preview"' api/wrangler.preview.toml || fail "D1 Preview incorrecta"
grep -Fq 'bucket_name = "intap-r2-preview"' api/wrangler.preview.toml || fail "R2 Preview incorrecto"
grep -Fq 'VITE_API_URL=https://preview.intaprd.com' web/.env.preview || fail "Web Preview no apunta al API Preview"

echo; echo "▶ Migraciones D1 Preview"
(
  cd api
  npx wrangler d1 migrations list "$PREVIEW_DB" --remote --config wrangler.preview.toml
) 2>&1 | tee "$MIGRATION_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "No pude consultar migraciones Preview"

PENDING_FILES="$(grep -Eo '[0-9]{4}_[A-Za-z0-9._-]+\.sql' "$MIGRATION_LOG" | sort -u || true)"
if [ -n "$PENDING_FILES" ]; then
  while IFS= read -r migration; do
    [ -z "$migration" ] && continue
    case "$migration" in
      0090_kawmed_medical_profiles_v1.sql|0091_kawmed_insurance_exclusions.sql) ;;
      *) fail "Migración Preview pendiente fuera de KawMed: $migration" ;;
    esac
  done <<< "$PENDING_FILES"
  (
    cd api
    npx wrangler d1 migrations apply "$PREVIEW_DB" --remote --config wrangler.preview.toml
  ) 2>&1 | tee -a "$MIGRATION_LOG"
  [ "${PIPESTATUS[0]}" -eq 0 ] || fail "Migraciones KawMed Preview"
else
  echo "✓ No hay migraciones pendientes"
fi

echo; echo "▶ Verificar schema y demo KawMed"
SCHEMA_JSON="$(
  cd api
  npx wrangler d1 execute "$PREVIEW_DB" --remote --config wrangler.preview.toml --json --command "
    SELECT name FROM sqlite_master
     WHERE type='table' AND name IN (
       'medical_profiles',
       'medical_profile_centers',
       'medical_profile_schedules',
       'medical_profile_services',
       'medical_profile_insurance_exclusions'
     )
     ORDER BY name;
    SELECT slug,status FROM medical_profiles WHERE slug='lauramendez' LIMIT 1;
  " 2>/dev/null
)"
python3 - "$SCHEMA_JSON" <<'PY'
import json,sys
data=json.loads(sys.argv[1]); rows=[]
for block in data if isinstance(data,list) else []: rows.extend(block.get('results') or [])
names={str(r.get('name') or '') for r in rows if r.get('name')}
required={'medical_profiles','medical_profile_centers','medical_profile_schedules','medical_profile_services','medical_profile_insurance_exclusions'}
missing=required-names
if missing: raise SystemExit('Faltan tablas KawMed: '+', '.join(sorted(missing)))
demo=[r for r in rows if r.get('slug')=='lauramendez']
if not demo or str(demo[0].get('status'))!='active': raise SystemExit('Demo lauramendez no está activo')
print('✓ Schema KawMed + demo Laura Méndez disponibles')
PY

echo; echo "▶ Deploy Web Pages Preview"
(npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch "$BRANCH") 2>&1 | tee "$WEB_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Web Preview"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$WEB_LOG" | tail -1 || true)"
[ -n "$WEB_ORIGIN" ] || fail "No pude detectar origin Web Preview"

cp "$PREVIEW_CFG" "$PREVIEW_CFG_BAK"
restore_cfg(){ cp "$PREVIEW_CFG_BAK" "$PREVIEW_CFG" 2>/dev/null || true; }
trap restore_cfg EXIT

python3 - "$PREVIEW_CFG" "$WEB_ORIGIN" <<'PY'
from pathlib import Path
import re,sys
p=Path(sys.argv[1]); web=sys.argv[2]
s=p.read_text()
s,n=re.subn(r'WEB_PAGES_ORIGIN\s*=\s*"[^"]+"',f'WEB_PAGES_ORIGIN = "{web}"',s,count=1)
if n != 1: raise SystemExit('No pude actualizar WEB_PAGES_ORIGIN temporal')
p.write_text(s)
PY

echo; echo "▶ Deploy Worker Preview / front door"
(
  cd api
  npx wrangler deploy --config wrangler.preview.toml --dry-run
  npx wrangler deploy --config wrangler.preview.toml
) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Preview"
restore_cfg
trap - EXIT
sleep 5

echo; echo "▶ Smoke KawMed Preview"
API_JSON="$LOG_DIR/kawmed-api.json"
code="$(curl -sS -o "$API_JSON" -w '%{http_code}' https://preview.intaprd.com/api/v1/public/medical-profiles/lauramendez)"
[ "$code" = "200" ] || { cat "$API_JSON"; fail "API KawMed HTTP $code"; }
python3 - "$API_JSON" <<'PY'
import json,sys
d=json.load(open(sys.argv[1],encoding='utf-8'))
assert d.get('ok') is True
p=d.get('data') or {}
assert p.get('slug')=='lauramendez'
assert p.get('status')=='active'
assert len(p.get('centers') or []) >= 1
assert len(p.get('schedules') or []) >= 1
assert len(p.get('services') or []) >= 1
assert isinstance((p.get('insurance_policy') or {}).get('excluded'),list)
print('✓ API KawMed responde perfil, centros, horarios, servicios y seguros')
PY

for url in \
  "https://preview.intaprd.com/m/lauramendez" \
  "https://preview.intaprd.com/demo" \
  "https://preview.intaprd.com/trial" \
  "https://app.preview.intaprd.com/superadmin"
do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

rm -rf "$LOG_DIR"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Runner dejó cambios locales"; }

cat <<EOF
================================================================
✓ KAWMED V1 RECONCILIADO Y DESPLEGADO EN PREVIEW
================================================================
Feature SHA: $(git rev-parse HEAD)
Web Pages:   $WEB_ORIGIN

Perfil demo:
https://preview.intaprd.com/m/lauramendez

API:
https://preview.intaprd.com/api/v1/public/medical-profiles/lauramendez

Producción NO tocada.
================================================================
EOF
