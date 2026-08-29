from pathlib import Path

p = Path('web/src/components/free-profile/IntapLinkGratisProfile.tsx')
if not p.exists():
    raise SystemExit(f'Missing {p}')

s = p.read_text()
lines = s.splitlines()
replacement = r"    const escapeVCard = (value: string) => String(value || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')"

count = 0
for index, line in enumerate(lines):
    if 'const escapeVCard = (value: string) =>' in line:
        lines[index] = replacement
        count += 1

if count != 1:
    raise SystemExit(f'Se esperaba exactamente 1 escapeVCard; encontrados: {count}')

p.write_text('\n'.join(lines) + ('\n' if s.endswith('\n') else ''))
print('✓ escapeVCard corregido con sintaxis TypeScript válida')
