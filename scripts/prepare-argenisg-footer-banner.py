#!/usr/bin/env python3
from pathlib import Path
import shutil

ROOT = Path.home() / "Desktop" / "intap-link-universal-bilingual-audit"
SOURCE = Path("/Volumes/backup JL/11977/!Recuperados 2024/recuperados/diseños/argenis grullon/banner-pies-de-pagina-01.png")
DEST = ROOT / "web/public/assets/adonisg/brand/footer-banner.png"
TARGET = ROOT / "web/src/components/profile-templates/IntapProfileAdonisgV1.tsx"

if not SOURCE.is_file():
    raise SystemExit(f"No encontré el banner final de Argenis: {SOURCE}")
if not TARGET.is_file():
    raise SystemExit(f"No encontré el componente de Argenis: {TARGET}")

DEST.parent.mkdir(parents=True, exist_ok=True)
shutil.copy2(SOURCE, DEST)

text = TARGET.read_text(encoding="utf-8")
old = '/assets/adonisg/brand/linkedin-banner.jpg'
new = '/assets/adonisg/brand/footer-banner.png'
if new not in text:
    if old not in text:
        raise SystemExit('No encontré el banner de pie actual para reemplazarlo')
    text = text.replace(old, new, 1)
    TARGET.write_text(text, encoding="utf-8")

print(f"✓ Banner final de Argenis integrado: {SOURCE.name} -> {DEST}")
print("✓ El pie del perfil ahora usa /assets/adonisg/brand/footer-banner.png")
