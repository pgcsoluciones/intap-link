from pathlib import Path

path = Path('functions/profile-discovery.ts')
text = path.read_text()
needle = "type DynamicPublicProfile = {\n  slug?: string;\n  name?: string;\n  bio?: string;\n  avatarUrl?: string | null;\n"
replacement = "type DynamicPublicProfile = {\n  slug?: string;\n  name?: string;\n  bio?: string;\n  avatarUrl?: string | null;\n  heroUrl?: string | null;\n  hero_url?: string | null;\n"

if replacement in text:
    print('✓ DynamicPublicProfile ya declara heroUrl/hero_url')
elif needle not in text:
    raise SystemExit('No encontré el bloque esperado DynamicPublicProfile; no se modificó nada.')
else:
    path.write_text(text.replace(needle, replacement, 1))
    print('✓ DynamicPublicProfile actualizado con heroUrl/hero_url')
