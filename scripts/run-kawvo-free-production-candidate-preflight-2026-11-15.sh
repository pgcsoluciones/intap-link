#!/usr/bin/env bash
# G5: local validation only. No wrangler deploy, no merge, no remote mutation.
set -euo pipefail
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="release/kawvo-free-production-preparation-2026-11-15"
MAIN="76babd4dd26faf7d502910c0fc65989c3b16f36a"
LIVE="bd1b99ac3462ed772ad36dfdaa667f1da5fbb93e"
QA="af5d915e982b125d0984bc6938bac5e58d876ca2"
BASELINE="$HOME/intap-release-logs/kawvo-free-production-baseline-2CU621/report.json"
fail(){ echo "BLOCKED: $*" >&2; exit 1; }
cd "$ROOT"
[[ "$(git branch --show-current)" == "$BRANCH" ]] || fail "Rama de preparación incorrecta"
[[ -z "$(git status --porcelain)" ]] || fail "Cambios locales sin guardar"
git fetch github main "$BRANCH" || fail "GitHub no disponible"
[[ "$(git rev-parse HEAD)" == "$(git rev-parse "github/$BRANCH")" ]] || fail "Candidato local diferente al remoto"
[[ "$(git rev-parse github/main)" == "$MAIN" ]] || fail "main avanzó, revisar antes de continuar"
for ref in "$LIVE" "$QA"; do
 git cat-file -e "$ref^{commit}" 2>/dev/null || git fetch github "$ref" || fail "Commit de referencia no disponible"
done
git diff --check "$MAIN" HEAD || fail "Diff inválido"
git diff --quiet "$MAIN" HEAD -- api web shared package.json package-lock.json .github || fail "Superficie protegida modificada"
git diff --quiet "$LIVE" HEAD -- shared package.json package-lock.json || fail "Dependencias de App productivo distintas"
mkdir -p "$HOME/intap-release-logs"
LOG="$(mktemp -d "$HOME/intap-release-logs/kawvo-free-production-candidate-XXXXXXXX")"
echo "LOG: $LOG"
node --input-type=module - "$BASELINE" "$MAIN" "$LIVE" "$QA" <<'NODE'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
const [report,main,live,qa]=process.argv.slice(2)
const r=JSON.parse(readFileSync(report,'utf8'))
assert.equal(r.current_main,main);assert.equal(r.approved_preview,qa);assert.equal(r.errors.length,0)
const a=r.projects.find(x=>x.project==='intap-web2'),w=r.projects.find(x=>x.project==='intap-link')
assert.ok(a?.verified&&w?.verified)
assert.equal(a.commit,live);assert.equal(a.immutable_url,'https://f9f7fa23.intap-web2.pages.dev')
assert.equal(a.sha256,'7ea2e8f6c75c5c79b7599566d87355f7fc6a4bd2cc89fffec4f1c9f25ab0f917')
assert.equal(w.commit,'31d4a6614c8e33aad04efe89fc8d683b2c1c203c')
assert.equal(w.sha256,'36bd90be36587c28baadb12b3fc564ea2c5c837397c621f6300be37712ee4c3b')
console.log('PASS: reporte G5 original y commits de Producción identificados')
for(const p of [a,w])console.log('Pages '+p.project+': auto-deploy producción='+String(p.production_auto_deploy)+'; commit_dirty='+String(p.commit_dirty))
const free='app/src/components/admin/free/'
const expected=['app/src/App.tsx','app/src/components/admin/IntapcardAccountSelector.tsx','app/src/components/admin/shared/KawvoPagedList.tsx','app/src/free-preview-link-fallback.ts',...['FreeAccount','FreeAiProfileAssistant','FreeAppointments','FreeCredentials','FreeDashboard','FreeIdentifier','FreeNotificationBell','FreeNotifications','FreePanelUi','FreePublicationActions','FreeShellSessionExit','FreeVisualEditor','KawvoFreeShellPreview','KawvoShellReturn','onboarding/FreeOnboardingContact','onboarding/FreeOnboardingIdentity'].map(n=>free+n+'.tsx').map(p=>p.replace('/KawvoShellReturn.tsx','/KawvoShellReturn.ts'))].sort()
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim()
const changed=git('diff','--name-only',live,'HEAD','--','app/').split('\n').filter(Boolean).sort()
assert.deepEqual(changed,expected,'App candidate must differ from live App only in the 20 reviewed paths')
const adapted=new Set(['FreeAppointments.tsx','FreeDashboard.tsx','KawvoFreeShellPreview.tsx','KawvoShellReturn.ts'].map(n=>free+n))
for(const p of expected.filter(p=>!adapted.has(p)))assert.equal(git('rev-parse','HEAD:'+p),git('rev-parse',qa+':'+p),p)
const read=p=>readFileSync(p,'utf8')
const helper=read(free+'KawvoShellReturn.ts'),shell=read(free+'KawvoFreeShellPreview.tsx'),dashboard=read(free+'FreeDashboard.tsx'),agenda=read(free+'FreeAppointments.tsx')
assert.ok(helper.includes("import.meta.env.MODE === 'preview' && host === 'app.preview.intaprd.com'"))
assert.ok(helper.includes("import.meta.env.MODE === 'production' && host === 'app.intaprd.com'"))
assert.ok(shell.includes("const enabled=isKawvoShellPreviewHost()&&new URLSearchParams(window.location.search).get('kawvo_shell')==='1'"))
assert.ok(shell.includes("'production'?'https://intaprd.com':'https://preview.intaprd.com'"))
assert.ok(shell.includes("hasSuperAdminAccess=!delegatedDemo&&Boolean(verifiedProfileId)&&superAdminProfileId===verifiedProfileId"))
assert.ok(dashboard.includes("isKawvoShellPreviewHost()&&!isFreeDemoDelegationActive()&&new URLSearchParams(location.search).get('legacy')!=='1'"))
assert.ok(dashboard.includes('readyPromptDismissed'))
assert.ok(dashboard.includes('await submitFreePublication(next === 1)'))
assert.ok(agenda.includes('getKawvoShellReturn(location.state)'))
assert.ok(agenda.includes('apiBase="/me/free/appointments"'))
assert.ok(read('app/src/App.tsx').includes('<Route path="/admin/free/shell-preview" element={<AdminGuard planScope="free"><KawvoFreeShellPreview/></AdminGuard>}/>'))
assert.equal(git('rev-parse','HEAD:app/src/components/admin/AdminGuard.tsx'),git('rev-parse',live+':app/src/components/admin/AdminGuard.tsx'))
assert.equal(git('rev-parse','HEAD:app/src/components/admin/SuperAdminGuard.tsx'),git('rev-parse',live+':app/src/components/admin/SuperAdminGuard.tsx'))
console.log('PASS: delta Free 20 archivos; 16 idénticos a QA, 4 adaptados; resto App productivo preservado')
NODE
# Reuse installed dependencies only; do not edit env or install anything.
[[ -d node_modules ]] || fail "Dependencias locales no disponibles"
WORK="$LOG/live-source"
cleanup(){ if [[ -d "$WORK" ]]; then git worktree remove --force "$WORK" >/dev/null 2>&1 || echo "AVISO: worktree temporal conservado $WORK"; fi; }
trap cleanup EXIT
git worktree add --detach "$WORK" "$LIVE" > "$LOG/worktree.txt" 2>&1 || { tail -20 "$LOG/worktree.txt"; fail "No se pudo preparar baseline local"; }
ln -s "$ROOT/node_modules" "$WORK/node_modules"
if [[ -d "$ROOT/app/node_modules" && ! -e "$WORK/app/node_modules" ]]; then ln -s "$ROOT/app/node_modules" "$WORK/app/node_modules"; fi
BASELINE_OK=0
if (cd "$WORK" && npm run app:build) > "$LOG/build-live.txt" 2>&1; then
  if node --input-type=module - "$WORK" "$BASELINE" <<'NODE'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
const [root,report]=process.argv.slice(2),r=JSON.parse(readFileSync(report,'utf8')),p=r.projects.find(x=>x.project==='intap-web2')
const html=readFileSync(root+'/app/dist/index.html','utf8'),asset=html.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0]
if(!asset)throw Error('No se identificó el bundle local')
const hash=createHash('sha256').update(readFileSync(root+'/app/dist'+asset)).digest('hex')
console.log('Baseline App local: '+asset+' sha256='+hash)
if(asset!==p.bundle||hash!==p.sha256){console.error('AVISO: no reproducido byte a byte; no autorizar Producción hasta resolver origen de diferencia');process.exitCode=1}
else console.log('PASS: build del commit App publicado reproduce el bundle productivo')
NODE
  then BASELINE_OK=1; fi
else
  tail -35 "$LOG/build-live.txt"
  echo "AVISO: build de referencia no reproducido; conservar diagnóstico"
fi
cleanup
trap - EXIT
npm run app:build > "$LOG/build-production.txt" 2>&1 || { tail -50 "$LOG/build-production.txt"; fail "Build candidato Producción"; }
[[ -f app/dist/index.html ]] || fail "Artefacto candidato productivo faltante"
node --input-type=module - <<'NODE'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
const a=readFileSync('app/dist/index.html','utf8').match(/\/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0]
if(!a)throw Error('Bundle candidato faltante')
console.log('PASS: build candidato Producción (no publicado) '+a+' sha256='+createHash('sha256').update(readFileSync('app/dist'+a)).digest('hex'))
NODE
npm run app:build:preview > "$LOG/build-preview.txt" 2>&1 || { tail -50 "$LOG/build-preview.txt"; fail "Build candidato Preview"; }
echo "PASS: build candidato Preview (no publicado)"
[[ -z "$(git status --porcelain)" ]] || fail "Build dejó cambios versionados"
echo "SIN DEPLOY NI MERGE. LOG: $LOG"
[[ "$BASELINE_OK" == 1 ]] || fail "Build productivo histórico no reproducido; comparar evidencia antes de autorizar"
echo "PASS G5 CANDIDATE PREFLIGHT: candidato App aislado compilado; pendiente QA Preview y evaluación de auto-deploy antes de autorizar merge"
