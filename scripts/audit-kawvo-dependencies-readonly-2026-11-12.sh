#!/usr/bin/env bash
# Read-only npm dependency audit; stores JSON in personal logs, never changes lock or installs fixes.
set -euo pipefail
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
cd "$ROOT"
mkdir -p "$HOME/intap-release-logs"
LOG="$(mktemp -d "$HOME/intap-release-logs/kawvo-dependency-audit-2026-11-12-XXXXXXXX")"
printf 'LOG: %s\n' "$LOG"
echo "1/3 Auditing all dependencies (including dev tools)"
npm audit --json > "$LOG/full-audit.json" 2> "$LOG/full-stderr.log" || true
echo "2/3 Auditing runtime dependencies only"
npm audit --omit=dev --json > "$LOG/runtime-audit.json" 2> "$LOG/runtime-stderr.log" || true
echo "3/3 Checking deprecated versions and bundle size (no modifications)"
node - "$LOG" <<'NODE'
const fs=require('fs'),p=require('path'),base=process.argv[2];
for(const [name,file] of [['all','full-audit.json'],['runtime','runtime-audit.json']]){
 const f=p.join(base,file);let a;
 try{a=JSON.parse(fs.readFileSync(f,'utf8'))}catch(e){console.log('ERROR: could not parse '+f+': '+e.message);process.exitCode=1;continue}
 if(a.error){console.log('ERROR: audit request failed: '+JSON.stringify(a.error));process.exitCode=1;continue}
 console.log('\nAUDIT '+name.toUpperCase()+' / counts: '+JSON.stringify(a.metadata?.vulnerabilities||{}));
 const entries=Object.entries(a.vulnerabilities||{}).sort((a,b)=>({critical:0,high:1,moderate:2,low:3,info:4}[a[1].severity]??5)-({critical:0,high:1,moderate:2,low:3,info:4}[b[1].severity]??5));
 const tab=entries.map(([pkg,v])=>({name:pkg,severity:v.severity,isDirect:!!v.isDirect,range:v.range,via:(v.via||[]).map(x=>typeof x==='string'?x:{name:x.name,title:x.title,url:x.url,range:x.range}).slice(0,8),effects:v.effects,fixAvailable:v.fixAvailable}));
 fs.writeFileSync(p.join(base,name+'-summary.json'),JSON.stringify({counts:a.metadata?.vulnerabilities,packages:tab},null,2));
 for(const x of tab)console.log(' - '+x.severity.toUpperCase()+' '+x.name+' '+(x.isDirect?'DIRECT':'transitive')+' '+JSON.stringify(x.fixAvailable).slice(0,140));
}
const l=JSON.parse(fs.readFileSync('package-lock.json','utf8'));for(const n of ['xlsx','vite','wrangler','esbuild','rollup','hono','react-router-dom','resend']){const x=l.packages?.['node_modules/'+n];if(x)console.log('PINNED '+n+': '+x.version+' ('+(x.dev?'dev':'runtime')+')')}
NODE
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || { echo "AVISO: existen modificaciones locales versionadas"; exit 1; }
echo "Resultado: $LOG"
echo "No se modificó ninguna dependencia, paquete ni configuración."
