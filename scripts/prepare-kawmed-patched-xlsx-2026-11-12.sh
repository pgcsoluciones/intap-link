#!/usr/bin/env bash
# Upgrade SheetJS in dedicated branch; protected regression + rollback, no Cloudflare changes.
set -euo pipefail
[[ "$(printenv KAWVO_XLSX_SECURITY_APPROVED 2>/dev/null || true)" == "SI" ]] || { echo "DETENIDO: requiere KAWVO_XLSX_SECURITY_APPROVED=SI"; exit 1; }
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="security/kawmed-xlsx-parser-hardening-2026-11-12"
BASE="fix/sponsored-beneficiary-scan-station-identification-2026-11-11"
PKGURL="https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"
fail(){ echo "DETENIDO: $*" >&2; exit 1; }
cd "$ROOT" || fail "No existe checkout"
[[ -z "$(git status --porcelain)" ]] || fail "Checkout con cambios, no cambiar de rama"
git fetch github "$BASE" "$BRANCH"
git switch "$BRANCH"
git pull --ff-only github "$BRANCH"
git merge-base --is-ancestor "github/$BASE" HEAD || fail "Rama base incorrecta"
git diff --check "github/$BASE"..HEAD
CHANGED="$(git diff --name-only "github/$BASE"..HEAD)"
EXPECTED="$(printf '%s\n' app/src/components/admin/sponsored/SponsorKawMed.tsx scripts/prepare-kawmed-patched-xlsx-2026-11-12.sh scripts/test-kawmed-xlsx-parser-safety-2026-11-12.mjs)"
[[ "$CHANGED" == "$EXPECTED" ]] || { echo "$CHANGED"; fail "Cambios fuera de allowlist"; }
[[ -z "$(git diff --name-only "github/$BASE"..HEAD -- api/ web/ app/src/App.tsx)" ]] || fail "Áreas protegidas modificadas"
mkdir -p "$HOME/intap-release-logs"
LOG="$(mktemp -d "$HOME/intap-release-logs/kawmed-xlsx-security-2026-11-12-XXXXXXXX")"
echo "LOG: $LOG"
cp app/package.json "$LOG/app-package.before.json"
cp package-lock.json "$LOG/package-lock.before.json"
SUCCESS=0
rollback(){ if [[ "$SUCCESS" != "1" ]];then echo "Restaurando manifiestos tras error";git restore -- app/package.json package-lock.json || true;fi; }
trap rollback EXIT
echo "▶ Resolviendo el paquete oficial SheetJS corregido, sin modificar API ni Cloudflare"
npm install --workspace=app --save-exact --package-lock-only --ignore-scripts --no-audit --no-fund "xlsx@$PKGURL" 2>&1 | tee "$LOG/npm-lock.txt"
grep -Fq "$PKGURL" app/package.json || fail "Dependencia no fijada"
grep -Fq "$PKGURL" package-lock.json || fail "Lock no fijado"
echo "▶ Instalación reproducible"
npm ci 2>&1 | tee "$LOG/npm-ci.txt"
node scripts/test-kawmed-xlsx-parser-safety-2026-11-12.mjs
node scripts/test-kawmed-isolation-contract.mjs
node scripts/test-intapcard-active-account-contract.mjs
node scripts/test-kawmed-demo-invitations-contract.mjs
node scripts/test-sponsored-profile-contract.mjs
npx tsc --noEmit -p api/tsconfig.json
npm run app:build:preview 2>&1 | tee "$LOG/app-build.txt"
npm audit --omit=dev --json > "$LOG/npm-runtime-after.json" 2> "$LOG/npm-runtime-error.txt" || true
node - "$LOG/npm-runtime-after.json" <<'NODE'
const fs=require("fs");const a=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
if(a.error)throw Error("npm audit failed: "+JSON.stringify(a.error))
if(a.vulnerabilities?.xlsx)throw Error("xlsx remains vulnerable in npm audit")
console.log("PASS: xlsx remediado según audit; alertas restantes: "+JSON.stringify(a.metadata?.vulnerabilities||{}));
NODE
git diff --check
[[ -z "$(git diff --name-only -- api/ web/ app/src/App.tsx)" ]] || fail "Cambio protegido detectado"
git add -- app/package.json package-lock.json
git commit -m "security(deps): pin patched SheetJS 0.20.3 with reproducible lockfile" 2>&1 | tee "$LOG/commit.txt"
git push github "$BRANCH" 2>&1 | tee "$LOG/push.txt"
SUCCESS=1
echo "PASS: fijación SheetJS 0.20.3 y regresiones; rama GitHub actualizada, sin deploy"
echo "LOG: $LOG"
