from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    p = Path(path)
    text = p.read_text()
    if new in text:
        print(f"✓ {label} ya aplicado")
        return
    if old not in text:
        raise SystemExit(f"✗ No encontré bloque esperado: {label}")
    p.write_text(text.replace(old, new, 1))
    print(f"✓ {label}")


# El acceso Foto y portada desde Diseño y apariencia debe abrirse como edición,
# no como paso del onboarding.
replace_once(
    'app/src/components/admin/free/FreeVisualEditor.tsx',
    "to: '/admin/free/onboarding/identity', icon: '◉', readinessKey: 'identity'",
    "to: '/admin/free/onboarding/identity?from=panel', icon: '◉', readinessKey: 'identity'",
    'Foto y portada abre en modo edición desde el editor visual',
)

# Nunca depender de un deployment Pages histórico para imágenes del onboarding.
# En Preview se usa el frente canónico; en Producción VITE_WEB_URL/intaprd.com.
for path in (
    'app/src/components/admin/free/onboarding/FreeStarterNativePreview.tsx',
    'app/src/components/admin/free/onboarding/FreeOnboardingBuilder.tsx',
):
    replace_once(
        path,
        "'https://feature-intap-link-approved-v9ix.intap-link.pages.dev'",
        "'https://preview.intaprd.com'",
        f'{path}: origin Preview canónico',
    )

print('✓ Recuperación final editor/origins preparada')
