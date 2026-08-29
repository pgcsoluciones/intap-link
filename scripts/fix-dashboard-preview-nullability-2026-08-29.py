from pathlib import Path

p = Path('app/src/components/admin/free/FreeDashboard.tsx')
if not p.exists():
    raise SystemExit('Missing app/src/components/admin/free/FreeDashboard.tsx')

before = p.read_text()
old = "encodeURIComponent(me.slug || '')"
new = "encodeURIComponent(me?.slug || '')"

if old in before:
    p.write_text(before.replace(old, new, 1))
    print('✓ dashboard preview slug nullability corregida')
elif new in before:
    print('· dashboard preview slug ya estaba protegido')
else:
    raise SystemExit('No encontré el enlace de preview esperado para corregir')
