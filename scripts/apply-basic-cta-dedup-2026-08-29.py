from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str):
    p = Path(path)
    s = p.read_text()
    if old not in s:
        raise SystemExit(f'No encontré patrón para {label}: {path}')
    s2 = s.replace(old, new, 1)
    p.write_text(s2)
    print(f'✓ {label}')

# 1) Plan Básico: corona ilustrada, sin badge Premium.
replace_once(
    'app/src/components/admin/free/FreePanelUi.tsx',
    '''        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-xl" aria-hidden="true">🏅</span>\n        <div className="min-w-0 flex-1">\n          <div className="flex flex-wrap items-center gap-2"><p className="text-base font-black text-slate-900">Amplía tu alcance</p><span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-800">Premium</span></div>''',
    '''        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-amber-500" aria-hidden="true">\n          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">\n            <path d="M3.5 8.5 7.5 12l4.5-7 4.5 7 4-3.5-1.5 9H5z" />\n            <path d="M6 20h12" />\n          </svg>\n        </span>\n        <div className="min-w-0 flex-1">\n          <p className="text-base font-black text-slate-900">Amplía tu alcance</p>''',
    'CTA Plan Básico: corona sin Premium',
)

# 2) Completa tu presentación desde panel: guardar sin salir; mostrar confirmación.
p = Path('app/src/components/admin/free/onboarding/FreeOnboardingIdentity.tsx')
s = p.read_text()
if "const [savedMessage, setSavedMessage]" not in s:
    marker = "  const [error, setError] = useState('')\n"
    if marker not in s:
        raise SystemExit('No encontré estado error en Identity')
    s = s.replace(marker, marker + "  const [savedMessage, setSavedMessage] = useState('')\n", 1)

old = "    setSaving(true)\n    setError('')\n    try {"
new = "    setSaving(true)\n    setError('')\n    setSavedMessage('')\n    try {"
# only change inside handleSubmit: use rfind before result block to avoid earlier functions
idx = s.find('  const handleSubmit = async')
if idx < 0:
    raise SystemExit('No encontré handleSubmit')
head, tail = s[:idx], s[idx:]
if old not in tail:
    raise SystemExit('No encontré inicio de guardado en handleSubmit')
tail = tail.replace(old, new, 1)
old_result = "      if (result.ok) navigate(editingFromPanel ? '/admin/free' : '/admin/free/onboarding/contact')\n      else setError(result.error || 'No pudimos guardar tus datos.')"
new_result = "      if (result.ok) {\n        if (editingFromPanel) setSavedMessage('✓ Cambios guardados correctamente.')\n        else navigate('/admin/free/onboarding/contact')\n      } else setError(result.error || 'No pudimos guardar tus datos.')"
if old_result not in tail:
    raise SystemExit('No encontré navegación post-save en Identity')
tail = tail.replace(old_result, new_result, 1)
s = head + tail
old_render = "            {error && <p className=\"mt-4 rounded-xl bg-rose-50 px-3 py-3 text-sm font-semibold text-rose-700\">{error}</p>}\n            <button type=\"submit\""
new_render = "            {savedMessage && <p className=\"mt-4 rounded-xl bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-700\">{savedMessage}</p>}\n            {error && <p className=\"mt-4 rounded-xl bg-rose-50 px-3 py-3 text-sm font-semibold text-rose-700\">{error}</p>}\n            <button type=\"submit\""
if old_render not in s:
    raise SystemExit('No encontré render de error/CTA en Identity')
s = s.replace(old_render, new_render, 1)
p.write_text(s)
print('✓ Completa tu presentación: guardar sin salir')

# 3) Evitar CTA genérico cuando ya está visible el CTA específico de límite.
replacements = [
    ('app/src/components/admin/free/FreePortfolio.tsx',
     '<div className="mt-5"><FreeUpgradeCard compact /></div>',
     '{photos.length < MAX_PHOTOS && <div className="mt-5"><FreeUpgradeCard compact /></div>}',
     'Portafolio: sin CTA Básico duplicado al alcanzar límite'),
    ('app/src/components/admin/free/FreeServices.tsx',
     '<div className="mt-5"><FreeUpgradeCard compact /></div>',
     '{items.length < MAX_SERVICES && <div className="mt-5"><FreeUpgradeCard compact /></div>}',
     'Servicios: sin CTA Básico duplicado al alcanzar límite'),
    ('app/src/components/admin/free/FreeQuickActions.tsx',
     '<div className="mt-5"><FreeUpgradeCard compact /></div>',
     '{selected.length < MAX_SELECTED && <div className="mt-5"><FreeUpgradeCard compact /></div>}',
     'Botones de contacto: sin CTA Básico duplicado al alcanzar límite'),
    ('app/src/components/admin/free/FreeLinks.tsx',
     '<div className="mt-5"><FreeUpgradeCard compact /></div>',
     '{canAdd && <div className="mt-5"><FreeUpgradeCard compact /></div>}',
     'Enlaces: sin CTA Básico duplicado al alcanzar límite'),
]
for path, old, new, label in replacements:
    replace_once(path, old, new, label)

# Auditoría informativa: listar pantallas Free que usan CTA del Plan Básico.
root = Path('app/src/components/admin/free')
print('\nAuditoría CTA Plan Básico (archivos con helpers/cards):')
for f in sorted(root.rglob('*.tsx')):
    text = f.read_text()
    tokens = []
    if 'FreeUpgradeCard' in text: tokens.append('FreeUpgradeCard')
    if 'FreeLimitUpgradeCard' in text: tokens.append('FreeLimitUpgradeCard')
    if 'basicPlanWhatsAppUrl' in text: tokens.append('basicPlanWhatsAppUrl')
    if tokens:
        print(f"- {f}: {', '.join(tokens)}")

print('\n✓ Ajustes y auditoría de CTA completados.')
