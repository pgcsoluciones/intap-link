#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/account-access-methods-v1"
LOG="$ROOT/.preview-account-access-forensic-live-v2/worker-tail-full.log"

cd "$ROOT" || exit 1

git fetch github "$BRANCH" >/dev/null 2>&1 || true
git checkout "$BRANCH" >/dev/null 2>&1 || true
git pull --ff-only github "$BRANCH" >/dev/null 2>&1 || true

[ -f "$LOG" ] || { echo "✗ No existe $LOG"; exit 1; }

cat <<'EOF'
============================================================
KAWVO LINK · EXTRACTOR FORENSE V3 · LOG EXISTENTE
============================================================
NO hace otra prueba
NO despliega
NO modifica D1/R2
NO toca Producción

Lee únicamente el worker-tail-full.log ya capturado y extrae:
- evento POST /api/v1/me/account/password
- logs [onError]
- mensaje/stack de la excepción
- outcome/status/cpuTime
- cookies/headers sensibles redactados
============================================================
EOF

python3 - "$LOG" <<'PY'
from pathlib import Path
import json,re,sys

p=Path(sys.argv[1])
text=p.read_text(errors='replace')

# Redacción defensiva de secretos/cookies/authorization.
def redact(s:str)->str:
    s=re.sub(r'(?i)("cookie"\s*:\s*)"[^"]*"', r'\1"[REDACTED]"', s)
    s=re.sub(r'(?i)("authorization"\s*:\s*)"[^"]*"', r'\1"[REDACTED]"', s)
    s=re.sub(r'(?i)(set-cookie[^\n\r]{0,300})', '[SET-COOKIE REDACTED]', s)
    s=re.sub(r'(?i)(re_[A-Za-z0-9_\-]{8,})', 're_[REDACTED]', s)
    return s

print('\n===== CONTEXTO TEXTUAL ALREDEDOR DE /password =====')
lines=text.splitlines()
idxs=[i for i,l in enumerate(lines) if '/api/v1/me/account/password' in l or '[onError]' in l]
if not idxs:
    print('NO_ENCONTRADO')
else:
    ranges=[]
    for i in idxs:
        a=max(0,i-25); b=min(len(lines),i+45)
        if ranges and a<=ranges[-1][1]: ranges[-1]=(ranges[-1][0],max(ranges[-1][1],b))
        else: ranges.append((a,b))
    for n,(a,b) in enumerate(ranges,1):
        print(f'--- BLOQUE {n} líneas {a+1}-{b} ---')
        print(redact('\n'.join(lines[a:b])))

print('\n===== INTENTO DE DECODIFICAR OBJETOS JSON COMPLETOS =====')
# Wrangler tail --format json puede escribir objetos pretty-printed concatenados.
dec=json.JSONDecoder(); pos=0; found=0
while pos < len(text):
    m=re.search(r'[\[{]', text[pos:])
    if not m: break
    start=pos+m.start()
    try:
        obj,end=dec.raw_decode(text,start)
    except Exception:
        pos=start+1
        continue
    pos=end
    raw=json.dumps(obj,ensure_ascii=False,indent=2)
    if '/api/v1/me/account/password' in raw or '[onError]' in raw:
        found+=1
        print(f'--- JSON EVENTO {found} ---')
        print(redact(raw))
if not found:
    print('NO_SE_PUDO_DECODIFICAR_JSON_RELEVANTE')

print('\n===== BÚSQUEDA DE MENSAJES DE ERROR =====')
patterns=['error','exception','stack','pbkdf','derive','crypto','d1','constraint','sql','internal server']
for i,l in enumerate(lines):
    low=l.lower()
    if any(k in low for k in patterns):
        if any('/password' in x.lower() or '[onerror]' in x.lower() for x in lines[max(0,i-20):min(len(lines),i+20)]):
            print(redact(f'{i+1}: {l}'))
PY

cat <<EOF
============================================================
✓ EXTRACCIÓN COMPLETADA
============================================================
Fuente: $LOG
Pásame esta salida completa.
============================================================
EOF
