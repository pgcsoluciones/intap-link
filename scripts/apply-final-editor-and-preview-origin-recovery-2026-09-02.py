from pathlib import Path
import subprocess


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

# La pantalla de identidad debe distinguir claramente edición desde el panel.
identity = 'app/src/components/admin/free/onboarding/FreeOnboardingIdentity.tsx'
replace_once(
    identity,
    "  const navigate = useNavigate()\n  const fileRef = useRef<HTMLInputElement>(null)",
    "  const navigate = useNavigate()\n  const editingFromPanel = new URLSearchParams(window.location.search).get('from') === 'panel'\n  const fileRef = useRef<HTMLInputElement>(null)",
    'Presentación reconoce edición desde panel',
)
replace_once(
    identity,
    "      if (result.ok) navigate('/admin/free/onboarding/contact')",
    "      if (result.ok) navigate(editingFromPanel ? '/admin/free' : '/admin/free/onboarding/contact')",
    'Guardar desde panel regresa al panel',
)
replace_once(
    identity,
    "          <div className=\"mb-8 flex gap-2\" aria-label=\"Paso 3 de 4\">\n            {[1, 2, 3, 4].map((step) => <span key={step} className={`h-1.5 flex-1 rounded-full ${step <= 3 ? 'bg-cyan-500' : 'bg-slate-200'}`} />)}\n          </div>\n          <p className=\"mb-2 text-sm font-extrabold uppercase tracking-[0.14em] text-cyan-700\">Paso 3 de 4</p>\n          <h1 className=\"text-[30px] font-black leading-tight tracking-[-0.03em]\">Tu identidad</h1>\n          <p className=\"mt-3 text-base font-medium leading-7 text-slate-700\">Agrega lo esencial para que te encuentren y sepan quién eres.</p>",
    "          {!editingFromPanel && <>\n            <div className=\"mb-8 flex gap-2\" aria-label=\"Paso 3 de 4\">\n              {[1, 2, 3, 4].map((step) => <span key={step} className={`h-1.5 flex-1 rounded-full ${step <= 3 ? 'bg-cyan-500' : 'bg-slate-200'}`} />)}\n            </div>\n            <p className=\"mb-2 text-sm font-extrabold uppercase tracking-[0.14em] text-cyan-700\">Paso 3 de 4</p>\n          </>}\n          <h1 className=\"text-[30px] font-black leading-tight tracking-[-0.03em]\">{editingFromPanel ? 'Edita tu presentación' : 'Tu identidad'}</h1>\n          <p className=\"mt-3 text-base font-medium leading-7 text-slate-700\">{editingFromPanel ? 'Actualiza tu foto, portada y la información principal de tu perfil.' : 'Agrega lo esencial para que te encuentren y sepan quién eres.'}</p>",
    'Presentación usa copy de edición fuera del onboarding',
)
replace_once(
    identity,
    "{saving ? 'Guardando…' : 'Continuar'}</button>",
    "{saving ? 'Guardando…' : editingFromPanel ? 'Guardar cambios' : 'Continuar'}</button>",
    'CTA Guardar cambios en edición',
)

# El runner ya añade explícitamente otros archivos. Dejamos Identity staged aquí
# para que el mismo commit incluya también este cierre.
subprocess.run(['git', 'add', identity], check=True)

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

# La vista previa de Invitación debe mostrar exactamente el mismo enlace
# personalizado que la acción Compartir enviará al contacto.
replace_once(
    'app/src/components/admin/free/FreeAccount.tsx',
    "{webUrl}/invitacion</span>",
    "{invitationUrl}</span>",
    'Vista previa de invitación usa URL personalizada real',
)

print('✓ Recuperación final editor/origins/invitación preparada')
