from pathlib import Path

path = Path('app/src/components/admin/free/FreeDashboard.tsx')
text = path.read_text()
old = 'aria-label="Abrir recorrido guiado">Guía</button>'
new = 'aria-label="Abrir recorrido guiado">Recorrido</button>'
if old not in text:
    raise SystemExit('No se encontró el botón Guía esperado en FreeDashboard.tsx')
path.write_text(text.replace(old, new, 1))
print('✓ botón principal renombrado de Guía a Recorrido')
