#!/usr/bin/env bash
# KAW-R4-001: explicitly approved additive Preview schema only.
set -euo pipefail
umask 077
fail(){ printf 'BLOCKED: %s\n' "$*" >&2; exit 1; }
[[ "$#" == 2 ]] || fail "SHA exacto y autorización explícita requeridos"
SHA="$1"
[[ "$2" == "AUTORIZO R4 D1 PREVIEW" ]] || fail "Migración no autorizada"
[[ "$SHA" =~ ^[a-f0-9]{40}$ ]] || fail "SHA inválido"
cd "$(git rev-parse --show-toplevel)"
ROOT="$PWD"
REMOTE='https://github.com/pgcsoluciones/intap-link.git'
BRANCH='feature/kawvo-r4-reviews-2026-11-25'
[[ "$(git ls-remote "$REMOTE" "refs/heads/$BRANCH" | cut -f1)" == "$SHA" ]] || fail "La rama cambió; revisar CI"
CONFIG=api/wrangler.preview.toml
git show "$SHA:$CONFIG" | cmp - "$CONFIG" || fail "Config local distinta del SHA"
grep -Fxq 'name = "intap-api-preview"' "$CONFIG" || fail "Worker incorrecto"
grep -Fxq 'database_name = "intap_db_preview"' "$CONFIG" || fail "D1 incorrecta"
grep -Fxq 'database_id = "e9f46214-623f-48da-af13-74198e12b222"' "$CONFIG" || fail "ID D1 incorrecto"
command -v node >/dev/null || fail "Node no disponible"
WRANGLER="$ROOT/node_modules/.bin/wrangler"
[[ -x "$WRANGLER" ]] || fail "Wrangler instalado requerido"
export WRANGLER_SEND_METRICS=false
mkdir -p "$HOME/intap-release-logs"
LOG="$(mktemp -d "$HOME/intap-release-logs/kawvo-r4-preview-schema-XXXXXXXX")"
chmod 700 "$LOG"
SQL="$LOG/review-settings.sql"
git show "$SHA:docs/releases/kawvo-r4-proposed-migrations/review-settings.sql" > "$SQL"
[[ -s "$SQL" ]] || fail "SQL ausente"
shasum -a 256 "$SQL" > "$LOG/sql.sha256"
printf '%s\n' "$SHA" > "$LOG/candidate.sha"
d1(){ "$WRANGLER" d1 execute intap_db_preview --remote --config "$CONFIG" --json "$@"; }
CHECK="
SELECT name FROM sqlite_master WHERE type='table' AND name IN ('profiles','users','plans','plan_limits','profile_modules','modules','analytics','profile_plan_overrides','team_workspaces','team_members','free_demo_v2_profiles','profile_review_settings') ORDER BY name;
SELECT id,name FROM plans WHERE id IN ('free','basic') ORDER BY id;
SELECT plan_id FROM plan_limits WHERE plan_id IN ('free','basic') ORDER BY plan_id;
SELECT code,name,effects_json,is_active FROM modules WHERE code='reviews_google';
SELECT name FROM pragma_table_info('modules') WHERE name='is_active';
"
d1 --command "$CHECK" > "$LOG/before.json"
node - "$LOG/before.json" <<'NODE'
const fs=require('node:fs'),assert=require('node:assert/strict')
const r=JSON.parse(fs.readFileSync(process.argv[2],'utf8'))
assert.equal(r.length,5)
for(const x of r){assert.equal(x.success,true);assert.equal(x.meta.changed_db,false);assert.equal(Number(x.meta.rows_written),0);assert.equal(Number(x.meta.changes),0)}
assert.deepEqual(r[0].results.map(x=>x.name).sort(),['analytics','free_demo_v2_profiles','modules','plan_limits','plans','profile_modules','profile_plan_overrides','profiles','team_members','team_workspaces','users'].sort(),'tabla ausente o schema R4 ya existe')
assert.deepEqual(r[1].results.map(x=>x.id),['basic','free'])
assert.deepEqual(r[2].results.map(x=>x.plan_id),['basic','free'])
assert.equal(r[3].results.length,0,'módulo ya existe: no repetir')
assert.deepEqual(r[4].results,[{name:'is_active'}])
console.log('PASS: preflight exacto D1 Preview, Free/Plus, sin schema R4 previo')
NODE
echo "Candidato: $SHA"
echo "Único cambio: crear profile_review_settings y registrar reviews_google para free/basic."
echo "Sin alterar perfiles existentes; sin desplegar Worker/App/Web; sin tocar Producción."
echo 'Autorización explícita R4 D1 PREVIEW recibida por argumento.'
printf '%s\n' "$2" > "$LOG/approval.txt"
BACKUP="$LOG/intap_db_preview.before.sql"
"$WRANGLER" d1 export intap_db_preview --remote --config "$CONFIG" --output "$BACKUP"
[[ -s "$BACKUP" ]] || fail "Respaldo ausente o vacío"
chmod 600 "$BACKUP"
shasum -a 256 "$BACKUP" > "$LOG/backup.sha256"
d1 --command "$CHECK" > "$LOG/recheck.json"
node - "$LOG/before.json" "$LOG/recheck.json" <<'NODE'
const fs=require('node:fs'),assert=require('node:assert/strict')
const a=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),b=JSON.parse(fs.readFileSync(process.argv[3],'utf8'))
assert.equal(a.length,b.length)
for(let i=0;i<b.length;i++){assert.equal(b[i].success,true);assert.equal(b[i].meta.changed_db,false);assert.equal(Number(b[i].meta.rows_written),0);assert.equal(Number(b[i].meta.changes),0);assert.deepEqual(b[i].results,a[i].results)}
NODE
if ! d1 --file "$SQL" --yes </dev/null > "$LOG/apply.json"; then
  fail "Aplicación ambigua o fallida. NO repetir; revisar $LOG"
fi
d1 --command "
SELECT name,type,\"notnull\",pk FROM pragma_table_info('profile_review_settings') ORDER BY cid;
SELECT \"table\",\"from\",\"to\",on_delete FROM pragma_foreign_key_list('profile_review_settings');
SELECT code,name,effects_json,is_active FROM modules WHERE code='reviews_google';
SELECT COUNT(*) AS n FROM profile_review_settings;
" > "$LOG/after.json"
node - "$LOG/after.json" <<'NODE'
const fs=require('node:fs'),assert=require('node:assert/strict')
const r=JSON.parse(fs.readFileSync(process.argv[2],'utf8'))
assert.equal(r.length,4)
for(const x of r){assert.equal(x.success,true);assert.equal(x.meta.changed_db,false);assert.equal(Number(x.meta.rows_written),0)}
assert.deepEqual(r[0].results.map(x=>x.name),['profile_id','enabled','google_review_url','updated_at'])
assert.equal(r[0].results[0].pk,1)
assert.deepEqual(r[1].results,[{table:'profiles',from:'profile_id',to:'id',on_delete:'CASCADE'}])
assert.equal(r[2].results.length,1)
const m=r[2].results[0]
assert.equal(m.code,'reviews_google');assert.equal(m.is_active,1)
assert.deepEqual(JSON.parse(m.effects_json).includedPlans,['free','basic'])
assert.equal(r[3].results[0].n,0)
console.log('PASS: schema R4 Preview, FK, catálogo Free/Plus, cero configuraciones de reseñas')
NODE
printf 'R4_SCHEMA_PREVIEW_PASS sha=%s\n' "$SHA"
printf 'Recibos privados en: %s\n' "$LOG"
printf 'No se desplegó API, App ni Web. No compartir el backup.\n'
