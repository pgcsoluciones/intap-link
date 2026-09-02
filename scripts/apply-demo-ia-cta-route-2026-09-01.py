#!/usr/bin/env python3
from pathlib import Path

path = Path('web/src/components/marketing/MarketingLanding.tsx')
text = path.read_text()

replacements = [
    ('<a href="#demo" onClick={() => setMenuOpen(false)}>Demo</a>', '<a href="/demo/ia" onClick={() => setMenuOpen(false)}>Demo</a>'),
    ('<a className="intap-header-cta" href={whatsappUrl} target="_blank" rel="noreferrer">\n          Solicitar demo\n        </a>', '<a className="intap-header-cta" href="/demo/ia">\n          Solicitar demo\n        </a>'),
    ('<a className="btn-primary" href="#demo">\n              Solicita una demo gratis\n            </a>', '<a className="btn-primary" href="/demo/ia">\n              Solicita una demo gratis\n            </a>'),
    ('<a className="btn-primary" href="#demo">Solicitar demo</a>', '<a className="btn-primary" href="/demo/ia">Solicitar demo</a>'),
    ('<a className="btn-primary full" href={whatsappUrl} target="_blank" rel="noreferrer">\n            Solicitar demo por WhatsApp\n          </a>', '<a className="btn-primary full" href="/demo/ia">\n            Crear mi demo con IA\n          </a>'),
    ('<a className="btn-primary light" href="#demo">\n          Quiero mi demo\n        </a>', '<a className="btn-primary light" href="/demo/ia">\n          Quiero mi demo\n        </a>'),
]

for old, new in replacements:
    if old not in text:
        raise SystemExit(f'CTA esperado no encontrado: {old[:80]}')
    text = text.replace(old, new, 1)

if 'href="#demo"' in text:
    raise SystemExit('Quedaron CTA internos apuntando a #demo')

path.write_text(text)
print('✓ Todos los CTA de Demo apuntan a /demo/ia')
