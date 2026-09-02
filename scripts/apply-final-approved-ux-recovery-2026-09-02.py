from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        print(f"✓ {label} ya aplicado")
        return text
    if old not in text:
        raise SystemExit(f"✗ No encontré bloque esperado: {label}")
    print(f"✓ aplicando {label}")
    return text.replace(old, new, 1)


# 1) Editor visual móvil: al alternar Editar/Vista previa debe volver al punto
# de edición anterior, en lugar de obligar al usuario a buscarlo otra vez.
path = Path('app/src/components/admin/free/FreeVisualEditor.tsx')
text = path.read_text()

text = replace_once(
    text,
    "import { useEffect, useMemo, useState } from 'react'",
    "import { useEffect, useMemo, useRef, useState } from 'react'",
    'useRef en editor visual',
)
text = replace_once(
    text,
    "export default function FreeVisualEditor() {\n  const navigate = useNavigate()",
    "export default function FreeVisualEditor() {\n  const navigate = useNavigate()\n  const editScrollRef = useRef(0)",
    'memoria de scroll del editor',
)
text = replace_once(
    text,
    "  const refreshPreview = () => setPreviewVersion((value) => value + 1)\n\n  async function saveIdentity()",
    "  const refreshPreview = () => setPreviewVersion((value) => value + 1)\n\n  function showPreview() {\n    editScrollRef.current = window.scrollY\n    setMobileMode('preview')\n    window.scrollTo({ top: 0, behavior: 'auto' })\n  }\n\n  function showEdit() {\n    setMobileMode('edit')\n    window.requestAnimationFrame(() => {\n      window.requestAnimationFrame(() => window.scrollTo({ top: editScrollRef.current, behavior: 'auto' }))\n    })\n  }\n\n  async function saveIdentity()",
    'cambio Editar/Vista previa sin perder posición',
)
text = replace_once(
    text,
    "<button type=\"button\" onClick={() => setMobileMode('edit')} className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-black ${mobileMode === 'edit' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>Editar</button>",
    "<button type=\"button\" onClick={showEdit} className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-black ${mobileMode === 'edit' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>Editar</button>",
    'botón Editar con retorno de scroll',
)
text = replace_once(
    text,
    "<button type=\"button\" onClick={() => setMobileMode('preview')} className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-black ${mobileMode === 'preview' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>Vista previa</button>",
    "<button type=\"button\" onClick={showPreview} className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-black ${mobileMode === 'preview' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>Vista previa</button>",
    'botón Vista previa con memoria de scroll',
)
path.write_text(text)
print('✓ UX móvil aprobada del editor visual restaurada')


# 2) Presentación abierta desde el panel: es edición, no onboarding. Debe guardar
# y permanecer en la pantalla, sin mandar al usuario al paso de Contacto.
path = Path('app/src/components/admin/free/onboarding/FreeOnboardingIdentity.tsx')
text = path.read_text()

text = replace_once(
    text,
    "  const [error, setError] = useState('')\n  const [cropFile, setCropFile] = useState<File | null>(null)",
    "  const [error, setError] = useState('')\n  const [savedMessage, setSavedMessage] = useState('')\n  const [cropFile, setCropFile] = useState<File | null>(null)",
    'confirmación de guardado en presentación',
)
text = replace_once(
    text,
    "  const [cropTarget, setCropTarget] = useState<CropTarget>('avatar')\n\n  useEffect(() => {",
    "  const [cropTarget, setCropTarget] = useState<CropTarget>('avatar')\n  const editingFromPanel = new URLSearchParams(window.location.search).get('from') === 'panel'\n\n  useEffect(() => {",
    'modo edición desde panel',
)
text = replace_once(
    text,
    "    setSaving(true)\n    setError('')\n    try {",
    "    setSaving(true)\n    setError('')\n    setSavedMessage('')\n    try {",
    'limpiar confirmación antes de guardar',
)
text = replace_once(
    text,
    "      const result: any = await apiPut('/me/profile', body)\n      if (result.ok) navigate('/admin/free/onboarding/contact')\n      else setError(result.error || 'No pudimos guardar tus datos.')",
    "      const result: any = await apiPut('/me/profile', body)\n      if (result.ok) {\n        if (editingFromPanel) setSavedMessage('✓ Cambios guardados correctamente.')\n        else navigate('/admin/free/onboarding/contact')\n      } else setError(result.error || 'No pudimos guardar tus datos.')",
    'guardar sin salir cuando se edita desde panel',
)
text = replace_once(
    text,
    "          <div className=\"mb-8 flex gap-2\" aria-label=\"Paso 3 de 4\">\n            {[1, 2, 3, 4].map((step) => <span key={step} className={`h-1.5 flex-1 rounded-full ${step <= 3 ? 'bg-cyan-500' : 'bg-slate-200'}`} />)}\n          </div>\n          <p className=\"mb-2 text-sm font-extrabold uppercase tracking-[0.14em] text-cyan-700\">Paso 3 de 4</p>\n          <h1 className=\"text-[30px] font-black leading-tight tracking-[-0.03em]\">Tu identidad</h1>\n          <p className=\"mt-3 text-base font-medium leading-7 text-slate-700\">Agrega lo esencial para que te encuentren y sepan quién eres.</p>",
    "          {!editingFromPanel && (<>\n            <div className=\"mb-8 flex gap-2\" aria-label=\"Paso 3 de 4\">\n              {[1, 2, 3, 4].map((step) => <span key={step} className={`h-1.5 flex-1 rounded-full ${step <= 3 ? 'bg-cyan-500' : 'bg-slate-200'}`} />)}\n            </div>\n            <p className=\"mb-2 text-sm font-extrabold uppercase tracking-[0.14em] text-cyan-700\">Paso 3 de 4</p>\n          </>)}\n          <h1 className=\"text-[30px] font-black leading-tight tracking-[-0.03em]\">{editingFromPanel ? 'Completa tu presentación' : 'Tu identidad'}</h1>\n          <p className=\"mt-3 text-base font-medium leading-7 text-slate-700\">{editingFromPanel ? 'Actualiza tu foto, portada, nombre y la información principal de tu perfil.' : 'Agrega lo esencial para que te encuentren y sepan quién eres.'}</p>",
    'cabecera correcta al editar desde panel',
)
text = replace_once(
    text,
    "              <div className=\"h-20 w-20 overflow-hidden rounded-full border border-slate-200 bg-slate-100\">{avatarUrl ? <img src={avatarUrl} alt=\"\" className=\"h-full w-full object-cover\" /> : <div className=\"flex h-full w-full items-center justify-center text-3xl text-slate-400\">👤</div>}</div>",
    "              <button type=\"button\" onClick={() => fileRef.current?.click()} disabled={uploading || !profileId} className=\"h-20 w-20 overflow-hidden rounded-full border border-slate-200 bg-slate-100 disabled:opacity-40\" aria-label=\"Cambiar foto de perfil\">{avatarUrl ? <img src={avatarUrl} alt=\"\" className=\"h-full w-full object-cover\" /> : <div className=\"flex h-full w-full items-center justify-center text-3xl text-slate-400\">👤</div>}</button>",
    'foto de perfil tocable',
)
text = replace_once(
    text,
    "                <div className=\"mt-3 aspect-video overflow-hidden rounded-2xl border border-slate-200 bg-slate-100\">\n                  {(pendingHeroPreview || heroUrl) ? <img src={pendingHeroPreview || heroUrl} alt=\"Vista previa de portada\" className=\"h-full w-full object-cover\" /> : <div className=\"flex h-full w-full items-center justify-center px-6 text-center text-sm font-bold text-slate-400\">Agrega una imagen de portada para completar el diseño Impacto.</div>}\n                </div>",
    "                <button type=\"button\" onClick={() => heroFileRef.current?.click()} disabled={uploading || !profileId} className=\"relative mt-3 block aspect-video w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 disabled:opacity-40\" aria-label=\"Cambiar imagen de portada\">\n                  {(pendingHeroPreview || heroUrl) ? <img src={pendingHeroPreview || heroUrl} alt=\"Vista previa de portada\" className=\"h-full w-full object-cover\" /> : <div className=\"flex h-full w-full items-center justify-center px-6 text-center text-sm font-bold text-slate-400\">Agrega una imagen de portada para completar el diseño Impacto.</div>}\n                  <span className=\"absolute bottom-2 right-2 rounded-full bg-slate-950/80 px-3 py-1.5 text-[10px] font-black text-white\">Toca para cambiar</span>\n                </button>",
    'portada tocable',
)
text = replace_once(
    text,
    "            {error && <p className=\"mt-4 rounded-xl bg-rose-50 px-3 py-3 text-sm font-semibold text-rose-700\">{error}</p>}\n            <button type=\"submit\" disabled={saving || uploading} className=\"mt-6 w-full rounded-2xl bg-slate-950 px-4 py-4 text-base font-extrabold text-white transition hover:bg-slate-800 disabled:opacity-35\">{saving ? 'Guardando…' : 'Continuar'}</button>",
    "            {savedMessage && <p className=\"mt-4 rounded-xl bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-700\">{savedMessage}</p>}\n            {error && <p className=\"mt-4 rounded-xl bg-rose-50 px-3 py-3 text-sm font-semibold text-rose-700\">{error}</p>}\n            <button type=\"submit\" disabled={saving || uploading} className=\"mt-6 w-full rounded-2xl bg-slate-950 px-4 py-4 text-base font-extrabold text-white transition hover:bg-slate-800 disabled:opacity-35\">{saving ? 'Guardando…' : editingFromPanel ? 'Guardar cambios' : 'Continuar'}</button>",
    'feedback y CTA de edición',
)
text = replace_once(
    text,
    "          <div className=\"mt-5\"><FreeUpgradeCard compact /></div>\n        </section>",
    "          <div className=\"mt-5\"><FreeUpgradeCard compact /></div>\n          <div className=\"mt-4\"><FreeBackButton onClick={() => navigate('/admin/free')} /></div>\n        </section>",
    'volver al panel al final de presentación',
)

path.write_text(text)
print('✓ edición de presentación desde panel restaurada')
