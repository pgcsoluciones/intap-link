from pathlib import Path

OLD = 'https://feature-intap-link-approved-v9ix.intap-link.pages.dev'
NEW = 'https://preview.intaprd.com'

paths = [
    Path('app/src/components/admin/free/onboarding/FreeStarterNativePreview.tsx'),
    Path('app/src/components/admin/free/onboarding/FreeOnboardingBuilder.tsx'),
]

for path in paths:
    text = path.read_text()
    if OLD in text:
        path.write_text(text.replace(OLD, NEW))
        print(f'✓ {path}: Preview media usa preview.intaprd.com')
    elif NEW in text:
        print(f'✓ {path}: origen Preview ya normalizado')
    else:
        raise SystemExit(f'✗ No encontré origen Preview esperado en {path}')
