from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        print(f"✓ {label} ya aplicado")
        return text
    if old not in text:
        raise SystemExit(f"✗ No encontré bloque esperado: {label}")
    print(f"✓ aplicando {label}")
    return text.replace(old, new, 1)


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
