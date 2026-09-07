#!/usr/bin/env python3
from pathlib import Path

ROOT = Path.home() / "Desktop" / "intap-link-universal-bilingual-audit"
TARGET = ROOT / "web/src/components/profile-templates/IntapProfileAdonisgV1.tsx"

text = TARGET.read_text(encoding="utf-8")
replacements = {
    "const canonical = `${origin}/adonisg${language === 'en' ? '?lang=en' : ''}`": "const canonical = `${window.location.origin.replace(/\\/$/, '')}/argenisg${language === 'en' ? '?lang=en' : ''}`",
    "'https://nfc.kawvoia.com/adonisg'": "'https://nfc.kawvoia.com/argenisg'",
}
for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f"No encontré patrón esperado para corregir ruta final: {old}")
    text = text.replace(old, new)
TARGET.write_text(text, encoding="utf-8")
print("✓ Ruta cliente/canonical preparada para /argenisg y host actual")
