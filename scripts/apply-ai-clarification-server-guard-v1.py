from pathlib import Path

PATH = Path('api/src/ai-profile-assistant.ts')
s = PATH.read_text()

HELPER = r'''
function isBlockedKawvoDefinitionQuestion(question: string): boolean {
  const normalized = String(question || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[“”"'¿?¡!]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!normalized) return false

  const mentionsKawvo = /\bkawvo\b/.test(normalized)
  const mentionsKawvoProfile = /\bperfil digital\b/.test(normalized) && /\b(kawvo|plataforma|solucion)\b/.test(normalized)
  const mentionsKawvoPresentation = /\bpresentacion digital\b/.test(normalized) && /\b(kawvo|ofrece kawvo|de kawvo)\b/.test(normalized)
  const asksDefinition = /\b(que es|que incluye|que comprende|que abarca|que significa|en que consiste|que elementos|que funcionalidades|cuales son sus elementos|cuales son sus funcionalidades)\b/.test(normalized)

  return asksDefinition && (mentionsKawvo || mentionsKawvoProfile || mentionsKawvoPresentation)
}
'''

OWNER_ANCHOR = "\nasync function ownerContext(c: any, userId: string) {"
if 'function isBlockedKawvoDefinitionQuestion' not in s:
    if OWNER_ANCHOR not in s:
        raise SystemExit('ERROR: ownerContext anchor not found')
    s = s.replace(OWNER_ANCHOR, '\n' + HELPER + OWNER_ANCHOR, 1)

s = s.replace(
    "  const timeout = setTimeout(() => controller.abort(), 25_000)",
    "  const timeout = setTimeout(() => controller.abort(), 40_000)",
    1,
)

START = "  try {\n    const response = await fetch('https://api.openai.com/v1/responses', {"
END = "  } catch (error:any) {"
start = s.find(START)
end = s.find(END, start)
if start == -1 or end == -1:
    raise SystemExit('ERROR: generate OpenAI try block anchors not found')

NEW_TRY = r'''  try {
    const callAssistant = async (forceFinalize: boolean, internalRetry = false) => {
      const retryInstruction = internalRetry
        ? '\nBARRERA SERVER-SIDE: una aclaración anterior intentó pedir al usuario que definiera Kawvo o su propia solución. Esa pregunta fue descartada. No vuelvas a pedir definiciones, componentes, estructura ni funcionalidades de Kawvo. Produce la mejor propuesta posible con los hechos disponibles. Solo devuelve needs_more_info si falta un hecho particular del usuario que únicamente él puede confirmar y que sea esencial para no inventar.'
        : ''

      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { Authorization: `Bearer ${c.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model, store: false, safety_identifier: safetyIdentifier, max_output_tokens: MAX_OUTPUT_TOKENS,
          reasoning: { effort: 'none' },
          text: { verbosity: 'medium', format: { type: 'json_schema', name: 'kawvo_profile_assistant_result', strict: true, schema: responseSchema } },
          instructions: EDITORIAL_INSTRUCTIONS + retryInstruction,
          input: buildInput(answers, followUp, conversation, context, limits, editingScope, forceFinalize),
        }),
      })

      const payload: any = await response.json().catch(() => ({}))
      return { response, payload }
    }

    let totalInputTokens = 0
    let totalOutputTokens = 0

    let { response, payload } = await callAssistant(round >= limits.ai_max_rounds)
    let usage = payload?.usage || {}
    totalInputTokens += Number(usage.input_tokens || 0)
    totalOutputTokens += Number(usage.output_tokens || 0)

    if (!response.ok) {
      const errorCode = text(payload?.error?.code || `openai_${response.status}`,80)
      await insertUsage(c,{ userId,profileId:context.profileId,operation:'generate',status:'error',model,inputTokens:totalInputTokens,outputTokens:totalOutputTokens,errorCode })
      if (response.status === 429) return c.json({ ok:false,error:'La IA está recibiendo muchas solicitudes. Intenta nuevamente en un momento.' },503)
      return c.json({ ok:false,error:'No pudimos preparar la propuesta con IA. Tu perfil no fue modificado.' },502)
    }
    if (payload?.status && payload.status !== 'completed') {
      await insertUsage(c,{ userId,profileId:context.profileId,operation:'generate',status:'error',model,inputTokens:totalInputTokens,outputTokens:totalOutputTokens,errorCode:`response_${text(payload.status,40)}` })
      return c.json({ ok:false,error:'La propuesta no pudo completarse. Tu perfil sigue sin cambios.' },502)
    }

    let parsed: any = null
    try { parsed = JSON.parse(responseText(payload)) } catch {}
    let result = validateAssistantResult(parsed, limits.max_services, limits.max_portfolio)

    if (!result) {
      await insertUsage(c,{ userId,profileId:context.profileId,operation:'generate',status:'error',model,inputTokens:totalInputTokens,outputTokens:totalOutputTokens,errorCode:'invalid_structured_output' })
      return c.json({ ok:false,error:'La respuesta de IA llegó incompleta. Tu perfil sigue sin cambios.' },502)
    }

    const blockedDefinitionQuestion = result.status === 'needs_more_info'
      && result.questions.some(isBlockedKawvoDefinitionQuestion)

    if (blockedDefinitionQuestion) {
      ;({ response, payload } = await callAssistant(true, true))
      usage = payload?.usage || {}
      totalInputTokens += Number(usage.input_tokens || 0)
      totalOutputTokens += Number(usage.output_tokens || 0)

      if (!response.ok) {
        const errorCode = `clarification_retry_${text(payload?.error?.code || `openai_${response.status}`,60)}`
        await insertUsage(c,{ userId,profileId:context.profileId,operation:'generate',status:'error',model,inputTokens:totalInputTokens,outputTokens:totalOutputTokens,errorCode })
        return c.json({ ok:false,error:'No pudimos terminar la propuesta con la información disponible. Tu perfil no fue modificado.' },502)
      }
      if (payload?.status && payload.status !== 'completed') {
        await insertUsage(c,{ userId,profileId:context.profileId,operation:'generate',status:'error',model,inputTokens:totalInputTokens,outputTokens:totalOutputTokens,errorCode:`clarification_retry_response_${text(payload.status,40)}` })
        return c.json({ ok:false,error:'No pudimos terminar la propuesta con la información disponible. Tu perfil no fue modificado.' },502)
      }

      parsed = null
      try { parsed = JSON.parse(responseText(payload)) } catch {}
      result = validateAssistantResult(parsed, limits.max_services, limits.max_portfolio)

      if (!result) {
        await insertUsage(c,{ userId,profileId:context.profileId,operation:'generate',status:'error',model,inputTokens:totalInputTokens,outputTokens:totalOutputTokens,errorCode:'clarification_retry_invalid_output' })
        return c.json({ ok:false,error:'No pudimos terminar la propuesta con la información disponible. Tu perfil no fue modificado.' },502)
      }

      if (result.status === 'needs_more_info' && result.questions.some(isBlockedKawvoDefinitionQuestion)) {
        await insertUsage(c,{ userId,profileId:context.profileId,operation:'generate',status:'error',model,inputTokens:totalInputTokens,outputTokens:totalOutputTokens,errorCode:'blocked_kawvo_definition_question' })
        return c.json({ ok:false,error:'Kawvo no necesita que definas su propia solución. Intenta preparar la propuesta nuevamente.' },502)
      }
    }

    const estimatedCost = await insertUsage(c,{ userId,profileId:context.profileId,operation:'generate',status:'success',model,inputTokens:totalInputTokens,outputTokens:totalOutputTokens })
    return c.json({ ok:true,data:{ ...result, round, usage:{ model,input_tokens:totalInputTokens,output_tokens:totalOutputTokens,estimated_cost_usd:estimatedCost }, plan:{ code:context.planId, limits } } })
'''

s = s[:start] + NEW_TRY + s[end:]

required = [
    'function isBlockedKawvoDefinitionQuestion',
    'BARRERA SERVER-SIDE',
    'blocked_kawvo_definition_question',
    'callAssistant(true, true)',
    'totalInputTokens',
    '40_000',
]
for marker in required:
    if marker not in s:
        raise SystemExit(f'ERROR: missing marker after patch: {marker}')

PATH.write_text(s)
print('✓ server-side clarification guard applied')
print('✓ one internal retry with must_finalize=true')
print('✓ Kawvo-definition questions are never exposed after retry')
print('✓ token usage combines both internal calls')
