#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DISCOVERY = ROOT / 'functions' / 'profile-discovery.ts'
MIDDLEWARE = ROOT / 'functions' / '_middleware.ts'


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding='utf-8')
    count = text.count(old)
    if count == 0:
        if new in text:
            print(f'✓ {path.relative_to(ROOT)}: cambio ya aplicado')
            return
        raise SystemExit(f'{path.relative_to(ROOT)}: no encontré el bloque esperado')
    if count != 1:
        raise SystemExit(f'{path.relative_to(ROOT)}: esperaba 1 ocurrencia y encontré {count}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')
    print(f'✓ {path.relative_to(ROOT)}: 1 reemplazo')


replace_once(
    DISCOVERY,
    """  const titleSource = role\n    ? `${name} | ${role}`\n    : (\n        company &&\n        company.toLowerCase() !==\n          name.toLowerCase()\n      )\n      ? `${name} | ${company}`\n      : name\n\n  const descriptionSource =\n    compactText(profile.bio) ||\n    dynamicTemplateText(\n      profile,\n      'shortDescription',\n      'companyHeadline',\n      'companyAbout'\n    ) ||\n    `Perfil digital de ${name} en INTAP LINK`\n""",
    """  const isArgenisg = slug === 'argenisg'\n\n  const titleSource = isArgenisg\n    ? 'Argenis Grullón | Asesor de Imagen y Estilista de Moda'\n    : role\n      ? `${name} | ${role}`\n      : (\n          company &&\n          company.toLowerCase() !==\n            name.toLowerCase()\n        )\n        ? `${name} | ${company}`\n        : name\n\n  const descriptionSource = isArgenisg\n    ? 'Argenis Grullón, asesor de imagen, estilista de moda y estratega de marca personal. Imagen, presencia y posicionamiento con intención.'\n    : compactText(profile.bio) ||\n      dynamicTemplateText(\n        profile,\n        'shortDescription',\n        'companyHeadline',\n        'companyAbout'\n      ) ||\n      `Perfil digital de ${name} en INTAP LINK`\n""",
)

replace_once(
    DISCOVERY,
    """  const image =\n    heroImage ||\n    galleryImage ||\n    avatarImage ||\n    `${runtime.baseUrl}/favicon.ico`\n\n  const twitterCard:\n    'summary' | 'summary_large_image' =\n      (\n        heroImage ||\n        galleryImage\n      )\n        ? 'summary_large_image'\n        : 'summary'\n""",
    """  const image = isArgenisg\n    ? `${runtime.baseUrl}/assets/adonisg/og/adonisg-og.jpg`\n    : heroImage ||\n      galleryImage ||\n      avatarImage ||\n      `${runtime.baseUrl}/favicon.ico`\n\n  const twitterCard:\n    'summary' | 'summary_large_image' =\n      isArgenisg || heroImage || galleryImage\n        ? 'summary_large_image'\n        : 'summary'\n""",
)

replace_once(
    DISCOVERY,
    """    siteName:\n      company || name,\n""",
    """    siteName:\n      isArgenisg ? 'Argenis Grullón' : company || name,\n""",
)

replace_once(
    MIDDLEWARE,
    """  const profileShareImage = (profile: any): string => {\n    const templateData = profile?.templateData && typeof profile.templateData === 'object'\n      ? profile.templateData\n      : {};\n""",
    """  const profileShareImage = (profile: any): string => {\n    const profileSlug = typeof profile?.slug === 'string' ? profile.slug.trim().toLowerCase() : '';\n    if (profileSlug === 'argenisg') {\n      return `${url.origin}/assets/adonisg/og/adonisg-og.jpg`;\n    }\n    const templateData = profile?.templateData && typeof profile.templateData === 'object'\n      ? profile.templateData\n      : {};\n""",
)

# Final assertions: social metadata for /argenisg must be explicit server-side.
discovery = DISCOVERY.read_text(encoding='utf-8')
middleware = MIDDLEWARE.read_text(encoding='utf-8')
checks = [
    ("slug === 'argenisg'", discovery),
    ('Argenis Grullón | Asesor de Imagen y Estilista de Moda', discovery),
    ('/assets/adonisg/og/adonisg-og.jpg', discovery),
    ('/assets/adonisg/og/adonisg-og.jpg', middleware),
]
for needle, haystack in checks:
    if needle not in haystack:
        raise SystemExit(f'Validación falló: falta {needle}')

print('✓ /argenisg: título, descripción, imagen OG y Twitter Card quedan fijados server-side.')
