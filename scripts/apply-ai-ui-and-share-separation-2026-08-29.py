from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str):
    p = Path(path)
    s = p.read_text()
    if old not in s:
        raise SystemExit(f'✗ No encontré ancla para: {label}')
    s = s.replace(old, new, 1)
    p.write_text(s)
    print(f'✓ {label}')

# 1) Compartir general del perfil siempre usa URL canónica limpia.
p = Path('web/src/components/free-profile/IntapLinkGratisProfile.tsx')
s = p.read_text()
anchor = "  async function downloadVCard() {\n"
if anchor not in s:
    raise SystemExit('✗ No encontré ancla canonicalProfileUrl')
s = s.replace(anchor, "  function canonicalProfileUrl() {\n    return `${window.location.origin}${window.location.pathname}`\n  }\n\n" + anchor, 1)
s = s.replace("await navigator.clipboard.writeText(window.location.href)", "await navigator.clipboard.writeText(canonicalProfileUrl())")
s = s.replace("QRCode.toDataURL(window.location.href", "QRCode.toDataURL(canonicalProfileUrl()")
s = s.replace("`Conoce el perfil de ${profile.name} en Kawvo Link:\\n${window.location.href}`", "`Conoce el perfil de ${profile.name} en Kawvo Link:\\n${canonicalProfileUrl()}`")
s = s.replace("url: window.location.href", "url: canonicalProfileUrl()")
p.write_text(s)
print('✓ Compartir general separado del enlace bancario')

# 2) IA: más margen de salida para reducir respuestas truncadas.
replace_once(
    'api/src/ai-profile-assistant.ts',
    'const MAX_OUTPUT_TOKENS = 1800',
    'const MAX_OUTPUT_TOKENS = 2400',
    'IA: mayor margen de salida estructurada',
)

# 3) IA: si la salida estructurada es inválida, reintentar una sola vez server-side.
p = Path('api/src/ai-profile-assistant.ts')
s = p.read_text()
old = """    let result = validateAssistantResult(parsed, limits.max_services, limits.max_portfolio)\n\n    if (!result) {\n      await insertUsage(c,{ userId,profileId:context.profileId,operation:'generate',status:'error',model,inputTokens:totalInputTokens,outputTokens:totalOutputTokens,errorCode:'invalid_structured_output' })\n      return c.json({ ok:false,error:'La respuesta de IA llegó incompleta. Tu perfil sigue sin cambios.' },502)\n    }\n\n    const blockedNonUserFollowUp = result.status === 'needs_more_info'\n      && result.questions.length === 0\n\n    if (blockedNonUserFollowUp) {\n"""
new = """    let result = validateAssistantResult(parsed, limits.max_services, limits.max_portfolio)\n    let internalRetryUsed = false\n\n    if (!result) {\n      internalRetryUsed = true\n      ;({ response, payload } = await callAssistant(true, true))\n      usage = payload?.usage || {}\n      totalInputTokens += Number(usage.input_tokens || 0)\n      totalOutputTokens += Number(usage.output_tokens || 0)\n      parsed = null\n      try { parsed = JSON.parse(responseText(payload)) } catch {}\n      result = validateAssistantResult(parsed, limits.max_services, limits.max_portfolio)\n\n      if (!result) {\n        await insertUsage(c,{ userId,profileId:context.profileId,operation:'generate',status:'error',model,inputTokens:totalInputTokens,outputTokens:totalOutputTokens,errorCode:'invalid_structured_output_after_retry' })\n        return c.json({ ok:false,code:'ai_incomplete_after_retry',error:'No pudimos completar la propuesta ahora. Inténtalo más tarde.' },502)\n      }\n    }\n\n    const blockedNonUserFollowUp = result.status === 'needs_more_info'\n      && result.questions.length === 0\n\n    if (blockedNonUserFollowUp) {\n      if (internalRetryUsed) {\n        await insertUsage(c,{ userId,profileId:context.profileId,operation:'generate',status:'error',model,inputTokens:totalInputTokens,outputTokens:totalOutputTokens,errorCode:'blocked_non_user_follow_up_after_retry' })\n        return c.json({ ok:false,code:'ai_incomplete_after_retry',error:'No pudimos completar la propuesta ahora. Inténtalo más tarde.' },502)\n      }\n      internalRetryUsed = true\n"""
if old not in s:
    raise SystemExit('✗ No encontré bloque de validación/reintento IA')
s = s.replace(old, new, 1)
p.write_text(s)
print('✓ IA: máximo dos intentos internos ante respuesta incompleta')

# 4) Interfaz IA: reducir texto redundante y usar señales visuales breves.
p = Path('app/src/components/admin/free/FreeAiProfileAssistant.tsx')
s = p.read_text()
repls = [
    (
        "<p className=\"mt-2 text-base font-medium leading-7 text-slate-600\">Kawvo usa lo que ya sabe de tu perfil y solo te pide lo necesario. <strong className=\"text-slate-800\">Tú revisas y decides qué aplicar.</strong></p>\n        <div className=\"mt-4 rounded-2xl bg-white/80 px-4 py-3 text-sm font-semibold leading-6 text-slate-600 ring-1 ring-cyan-100\">La IA no publica, no cambia tu diseño, plantilla, colores, botones ni orden de secciones.</div>",
        "<p className=\"mt-2 text-base font-medium leading-7 text-slate-600\">✨ Kawvo prepara una propuesta con la información de tu perfil. <strong className=\"text-slate-800\">Tú decides qué aplicar.</strong></p>",
    ),
    (
        "<div className=\"rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4 text-sm font-semibold leading-6 text-cyan-900\">Kawvo ya conoce el contenido de tu perfil. Si tiene suficiente información, preparará la propuesta directamente. Si falta un hecho importante, te preguntará solo lo mínimo necesario.</div>",
        "<div className=\"rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4 text-sm font-semibold leading-6 text-cyan-900\">✨ Usaremos lo que ya completaste.</div>",
    ),
    (
        "<p className=\"text-center text-[11px] font-semibold leading-5 text-slate-400\">La IA usa el perfil completo como contexto, interpreta tus respuestas y solo pregunta cuando realmente necesita confirmar un hecho.</p>",
        "{generating && <div className=\"flex items-center justify-center gap-2 rounded-2xl bg-cyan-50 px-4 py-3 text-sm font-black text-cyan-800\"><span className=\"animate-pulse\">✨</span><span>Preparando tu propuesta…</span></div>}",
    ),
    (
        "<p className=\"text-xs font-black uppercase tracking-[0.12em] text-cyan-700\">Kawvo necesita confirmar algo</p><h2 className=\"mt-2 text-xl font-black\">Una aclaración antes de preparar tu propuesta</h2><p className=\"mt-2 text-sm font-medium leading-6 text-slate-600\">La IA ya revisó tu perfil. Responde solo este dato y continuará con todo el contexto anterior.</p>",
        "<p className=\"text-xs font-black uppercase tracking-[0.12em] text-cyan-700\">❓ Falta un dato</p><h2 className=\"mt-2 text-xl font-black\">Confirma esto para continuar</h2>",
    ),
    (
        "<div className=\"rounded-[24px] border border-cyan-200 bg-cyan-50 p-4\"><p className=\"font-black text-cyan-900\">Propuesta lista para revisar</p><p className=\"mt-1 text-sm font-semibold leading-6 text-cyan-800\">Revisa la propuesta antes de aplicarla. Tú decides qué contenido utilizar. Nada se aplicará hasta que pulses <strong>Aplicar a mi perfil</strong>.</p></div>",
        "<div className=\"rounded-[24px] border border-cyan-200 bg-cyan-50 p-4\"><p className=\"font-black text-cyan-900\">✓ Propuesta lista</p><p className=\"mt-1 text-sm font-semibold leading-6 text-cyan-800\">Revísala y aplica solo lo que quieras.</p></div>",
    ),
]
for old, new in repls:
    if old not in s:
        raise SystemExit('✗ No encontré uno de los bloques de copy IA a simplificar')
    s = s.replace(old, new, 1)
p.write_text(s)
print('✓ IA: interfaz simplificada y menos texto redundante')

print('✓ Patch listo. Ejecuta TypeScript/build antes de commit o deploy.')
