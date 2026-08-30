from pathlib import Path

path = Path('app/src/components/admin/free/FreeAiProfileAssistant.tsx')
text = path.read_text()


def replace(old: str, new: str, label: str):
    global text
    if old not in text:
        raise SystemExit(f'✗ No encontré patrón: {label}')
    text = text.replace(old, new, 1)
    print(f'✓ {label}')

# 1) La tarjeta inicial de contexto/cuotas solo pertenece a la etapa previa.
replace(
    '{context && <section className="mt-5 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">',
    '{context && !proposal && followUp.length===0 && !success && <section className="mt-5 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">',
    'Ocultar contexto/cuotas después de obtener respuesta de IA',
)

# 2) Simplificar selector inicial.
replace(
    '<p className="text-xs font-black uppercase tracking-[0.12em] text-cyan-700">Contenido existente</p>\n        <h2 className="mt-1 text-xl font-black">¿Cómo quieres que te ayude la IA?</h2>',
    '<p className="text-xs font-black uppercase tracking-[0.12em] text-cyan-700">✨ Elige cómo ayudarte</p>\n        <h2 className="mt-1 text-xl font-black">¿Qué quieres hacer?</h2>',
    'Simplificar encabezado de acción IA',
)
replace(
    '<button type="button" onClick={()=>chooseEditingScope(\'missing_only\')} className={`rounded-2xl border p-4 text-left ${editingScope===\'missing_only\'?\'border-cyan-500 bg-cyan-50\':\'border-slate-200 bg-white\'}`}><p className="font-black">Completar solo lo que falta · Recomendado</p><p className="mt-1 text-sm font-medium leading-5 text-slate-600">Conserva intactos los campos que ya completaste. La IA los usa como contexto y trabaja solo sobre lo pendiente.</p></button>',
    '<button type="button" onClick={()=>chooseEditingScope(\'missing_only\')} className={`rounded-2xl border p-4 text-left ${editingScope===\'missing_only\'?\'border-cyan-500 bg-cyan-50\':\'border-slate-200 bg-white\'}`}><p className="font-black">🧩 Completar lo que falta</p><p className="mt-1 text-sm font-medium leading-5 text-slate-600">Conserva lo que ya completaste.</p></button>',
    'Acortar opción completar faltantes',
)
replace(
    '<button type="button" onClick={()=>chooseEditingScope(\'full_profile\')} className={`rounded-2xl border p-4 text-left ${editingScope===\'full_profile\'?\'border-cyan-500 bg-cyan-50\':\'border-slate-200 bg-white\'}`}><p className="font-black">Revisar y mejorar mi contenido</p><p className="mt-1 text-sm font-medium leading-5 text-slate-600">Puede proponerte mejoras de texto en título, presentación, trabajos y servicios. Tú revisas todo antes de aplicar.</p></button>',
    '<button type="button" onClick={()=>chooseEditingScope(\'full_profile\')} className={`rounded-2xl border p-4 text-left ${editingScope===\'full_profile\'?\'border-cyan-500 bg-cyan-50\':\'border-slate-200 bg-white\'}`}><p className="font-black">✨ Mejorar mi contenido</p><p className="mt-1 text-sm font-medium leading-5 text-slate-600">Recibe una propuesta y decide qué aplicar.</p></button>',
    'Acortar opción mejorar contenido',
)
replace(
    '        <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">Nunca modifica imágenes, enlaces, cuentas bancarias, diseño, plantilla, colores ni orden.</p>\n',
    '',
    'Eliminar nota técnica redundante del selector',
)

# 3) Hacer más visual y breve la etapa de acción.
replace(
    '<div className="rounded-2xl bg-slate-50 px-4 py-3">\n          <p className="text-sm font-black text-slate-800">{editingScope===\'missing_only\'?\'Voy a preguntarte solo por lo que falta.\':\'Voy a revisar tu perfil completo para entender qué conviene mejorar.\'}</p>\n          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">Las preguntas cambian según lo que ya tienes y la opción que elegiste.</p>\n        </div>',
    '<div className="grid grid-cols-3 gap-2">\n          <div className="rounded-2xl bg-slate-50 p-3 text-center"><div className="text-xl">✍️</div><p className="mt-1 text-[11px] font-black text-slate-700">Cuéntanos</p></div>\n          <div className="rounded-2xl bg-cyan-50 p-3 text-center"><div className="text-xl">✨</div><p className="mt-1 text-[11px] font-black text-cyan-800">Kawvo prepara</p></div>\n          <div className="rounded-2xl bg-emerald-50 p-3 text-center"><div className="text-xl">✓</div><p className="mt-1 text-[11px] font-black text-emerald-800">Tú aplicas</p></div>\n        </div>',
    'Convertir explicación en guía visual de 3 pasos',
)
replace(
    'hint="Opcional. Puedes escribirlo como se lo explicarías a una persona. No tienes que definir tu propuesta de valor ni saber de marketing: Kawvo hará ese análisis usando tu perfil y su conocimiento general."',
    'hint="Opcional. Escríbelo con tus propias palabras."',
    'Acortar ayuda del campo libre',
)

# 4) Confirmación de servicios: una sola señal clara, ámbar antes y verde después.
replace(
    "if (selection.services && hasExistingServices && !replaceServices) { setError('Confirma que deseas actualizar el texto de tus servicios actuales.'); return }",
    "if (selection.services && hasExistingServices && !replaceServices) { setError('Confirma el cambio de tus servicios para poder aplicarlo.'); return }",
    'Aclarar siguiente paso al aplicar servicios',
)
replace(
    '<label className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-5 text-amber-900"><input type="checkbox" checked={replaceServices} onChange={(e)=>setReplaceServices(e.target.checked)} className="mt-0.5 accent-amber-700"/><span>Confirmo que quiero actualizar el texto de los servicios propuestos. Kawvo conservará los servicios existentes, sus IDs, imágenes, precios, texto de WhatsApp y estado destacado; no se eliminarán automáticamente.</span></label>',
    '<label className={`mt-4 flex items-start gap-3 rounded-2xl border p-4 text-sm font-bold leading-5 ${replaceServices?\'border-emerald-200 bg-emerald-50 text-emerald-900\':\'border-amber-200 bg-amber-50 text-amber-900\'}`}><input type="checkbox" checked={replaceServices} onChange={(e)=>setReplaceServices(e.target.checked)} className="mt-0.5 accent-emerald-700"/><span>{replaceServices?\'✓ Confirmado. Ya puedes aplicar los cambios.\':\'Confirma este cambio para poder aplicarlo.\'}</span></label>',
    'Confirmación de servicios ámbar→verde y sin texto interno',
)

# 5) Reducir notas de propuesta que explican detalles internos.
replace(
    '<p className="mt-2 text-sm font-medium leading-6 text-slate-500">Máximo 5 trabajos. Kawvo solo puede mejorar títulos o descripciones que tú ya hayas escrito. Los campos vacíos permanecen vacíos y nunca intenta adivinar qué aparece en una foto. Las imágenes no se reemplazan ni se reordenan.</p>',
    '<p className="mt-2 text-sm font-medium leading-6 text-slate-500">🖼️ Revisa los textos sugeridos para tus trabajos.</p>',
    'Acortar nota de portafolio',
)
replace(
    '<div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase text-slate-400">Siguiente acción sugerida</p><p className="mt-2 text-lg font-black">“{proposal.cta.label}”</p><p className="mt-1 text-sm font-medium leading-6 text-slate-500">Es una recomendación de copy. No cambia ni reordena tus Botones rápidos.</p></div>',
    '<div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase text-slate-400">👉 Acción sugerida</p><p className="mt-2 text-lg font-black">“{proposal.cta.label}”</p></div>',
    'Acortar acción sugerida',
)
replace(
    '<p className="mt-2 text-sm font-semibold leading-6 text-violet-900">Son recomendaciones, no imágenes generadas.</p>',
    '<p className="mt-2 text-sm font-semibold leading-6 text-violet-900">💡 Referencias para tus imágenes.</p>',
    'Acortar explicación de imágenes',
)

# 6) Al aplicar, abandonar la propuesta larga y mostrar una sola pantalla final.
anchor = "  if (loading) return <main className=\"min-h-screen bg-[#f7f9fc] grid place-items-center\"><div className=\"loading-spinner\" /></main>"
if anchor not in text:
    raise SystemExit('✗ No encontré patrón: inserción pantalla final')
final_screen = '''  if (success && context) return <main className="min-h-screen bg-[#f7f9fc] px-4 py-8 font-['Inter'] text-slate-950">
    <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[520px] flex-col justify-center">
      <div className="rounded-[30px] border border-emerald-200 bg-white p-6 text-center shadow-sm sm:p-8">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-3xl">✓</div>
        <p className="mt-5 text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Listo</p>
        <h1 className="mt-2 text-2xl font-black tracking-[-0.03em]">Cambios confirmados y aplicados</h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">Tu perfil ya fue actualizado.</p>
        <a href={`/api/v1/me/free/profile-preview/${encodeURIComponent(context.profile.slug)}?full=1`} target="_blank" rel="noopener noreferrer" className="mt-6 flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-4 text-sm font-black text-white">Ver mi perfil</a>
        <button type="button" onClick={()=>navigate('/admin/free')} className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-black text-slate-700">Volver al panel</button>
      </div>
    </section>
  </main>

'''
text = text.replace(anchor, final_screen + anchor, 1)
print('✓ Pantalla final única después de aplicar')

# 7) Añadir salida al panel al final del flujo cuando aún se está trabajando.
replace(
    '      {proposal && context && <section className="mt-5 space-y-5">',
    '      {proposal && context && <section className="mt-5 space-y-5">',
    'Mantener ancla de propuesta',
)
# Inserta el botón antes del cierre de la sección principal usando el cierre final conocido.
old_tail = '''      {proposal && context && <section className="mt-5 space-y-5">'''
# El botón se añade con una sustitución específica del último cierre del componente.
marker = '''      </section>}\n    </section>\n  </main>'''
if marker not in text:
    raise SystemExit('✗ No encontré patrón: botón Volver al panel al final')
text = text.replace(marker, '''      </section>}\n      {!success && <div className="mt-6"><FreeBackButton onClick={()=>navigate('/admin/free')} /></div>}\n    </section>\n  </main>''', 1)
print('✓ Volver al panel al final del scroll')

path.write_text(text)
print('✓ Ajuste de foco UX del Asistente IA aplicado.')
