from pathlib import Path

p = Path('api/src/ai-profile-assistant.ts')
s = p.read_text()

# 1) Remove the Kawvo-specific regex guard. The global gate below replaces it.
start = s.find("\nfunction isBlockedKawvoDefinitionQuestion(question: string): boolean {")
if start == -1:
    raise SystemExit('No encontré isBlockedKawvoDefinitionQuestion')
end = s.find("\nasync function ownerContext", start)
if end == -1:
    raise SystemExit('No encontré el final del guard específico')
s = s[:start] + "\n" + s[end:]

# 2) Replace validation so the model must classify every follow-up.
old = '''function validateAssistantResult(raw: unknown, maxServices: number, maxPortfolio: number): AssistantResult | null {
  const value = objectValue(raw)
  if (value.status === 'needs_more_info') {
    if (value.proposal !== null) return null
    const questions = Array.isArray(value.questions)
      ? value.questions.map((q: unknown) => text(q, 180)).filter(Boolean).slice(0, 3)
      : []
    return questions.length ? { status: 'needs_more_info', questions } : null
  }
  if (value.status === 'ready') {
    if (value.questions !== null) return null
    const proposal = validateProposal(value.proposal, maxServices, maxPortfolio)
    return proposal ? { status: 'ready', proposal } : null
  }
  return null
}
'''

new = '''function validateAssistantResult(raw: unknown, maxServices: number, maxPortfolio: number): AssistantResult | null {
  const value = objectValue(raw)
  if (value.status === 'needs_more_info') {
    if (value.proposal !== null) return null
    const rawQuestions = Array.isArray(value.questions) ? value.questions.slice(0, 3) : []
    if (!rawQuestions.length) return null

    const questions = rawQuestions
      .map((item: unknown) => objectValue(item))
      .filter((item) => item.kind === 'user_fact')
      .map((item) => text(item.question, 180))
      .filter(Boolean)

    // An empty array here is intentional: the model asked something, but it was
    // not a fact that only this user can confirm. The generate route will retry
    // internally instead of exposing that question to the user.
    return { status: 'needs_more_info', questions }
  }
  if (value.status === 'ready') {
    if (value.questions !== null) return null
    const proposal = validateProposal(value.proposal, maxServices, maxPortfolio)
    return proposal ? { status: 'ready', proposal } : null
  }
  return null
}
'''

if old not in s:
    raise SystemExit('No encontré validateAssistantResult esperado')
s = s.replace(old, new, 1)

# 3) Structured output now classifies each question globally.
old = """    questions: { anyOf: [{ type: 'array', items: { type: 'string' } }, { type: 'null' }] },"""
new = """    questions: { anyOf: [{
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          question: { type: 'string' },
          kind: { type: 'string', enum: ['user_fact','general_knowledge','platform_knowledge','already_available','strategy'] },
        },
        required: ['question','kind'],
      },
    }, { type: 'null' }] },"""
if old not in s:
    raise SystemExit('No encontré schema questions esperado')
s = s.replace(old, new, 1)

# 4) Add a global rule. This applies to every profile/category, not only Kawvo.
anchor = "  'PREGUNTAS SOLO POR HECHOS DEL USUARIO: una pregunta de seguimiento solo se justifica cuando falta un hecho personal, comercial u operativo que únicamente el usuario puede confirmar y cuya ausencia impide redactar de forma segura. No preguntes al usuario qué significa un concepto general, una categoría comercial, una expresión de marketing, una profesión, un tipo de solución o una funcionalidad que puedas comprender razonablemente usando el perfil, el contexto disponible y conocimiento general.',"
addition = "  'CLASIFICACIÓN OBLIGATORIA DE PREGUNTAS: si status=needs_more_info, cada elemento de questions debe incluir question y kind. Usa user_fact únicamente si la respuesta es un hecho particular de esta persona o negocio que solo ese usuario puede confirmar y que sea realmente necesario para evitar inventar. Usa general_knowledge para conceptos o conocimiento general; platform_knowledge para información sobre Kawvo o la plataforma; already_available si ya está en profile, answers, follow_up_answers o conversation; strategy si estás intentando delegar al usuario una decisión de copy, posicionamiento o jerarquía que debes resolver tú. Solo las preguntas user_fact pueden mostrarse al usuario.',"
if addition not in s:
    if anchor not in s:
        raise SystemExit('No encontré ancla de reglas de preguntas')
    s = s.replace(anchor, anchor + "\n" + addition, 1)

# 5) Make the retry generic and global instead of Kawvo-specific.
old = """      const retryInstruction = internalRetry
        ? '\\nBARRERA SERVER-SIDE: una aclaración anterior intentó pedir al usuario que definiera Kawvo o su propia solución. Esa pregunta fue descartada. No vuelvas a pedir definiciones, componentes, estructura ni funcionalidades de Kawvo. Produce la mejor propuesta posible con los hechos disponibles. Solo devuelve needs_more_info si falta un hecho particular del usuario que únicamente él puede confirmar y que sea esencial para no inventar.'
        : ''"""
new = """      const retryInstruction = internalRetry
        ? '\\nBARRERA SERVER-SIDE GLOBAL: una aclaración anterior fue descartada porque no pedía un hecho particular que solo este usuario pudiera confirmar. No repitas esa clase de pregunta. Usa el perfil, las respuestas, la conversación y conocimiento general para resolver conceptos, estrategia, jerarquía y contexto de plataforma. Produce la mejor propuesta posible. Solo devuelve needs_more_info si falta un user_fact esencial para no inventar.'
        : ''"""
if old not in s:
    raise SystemExit('No encontré retryInstruction específico')
s = s.replace(old, new, 1)

# 6) Replace Kawvo-specific detection with the global classification gate.
old = """    const blockedDefinitionQuestion = result.status === 'needs_more_info'
      && result.questions.some(isBlockedKawvoDefinitionQuestion)

    if (blockedDefinitionQuestion) {"""
new = """    const blockedNonUserFollowUp = result.status === 'needs_more_info'
      && result.questions.length === 0

    if (blockedNonUserFollowUp) {"""
if old not in s:
    raise SystemExit('No encontré blockedDefinitionQuestion')
s = s.replace(old, new, 1)

old = """      if (result.status === 'needs_more_info' && result.questions.some(isBlockedKawvoDefinitionQuestion)) {
        await insertUsage(c,{ userId,profileId:context.profileId,operation:'generate',status:'error',model,inputTokens:totalInputTokens,outputTokens:totalOutputTokens,errorCode:'blocked_kawvo_definition_question' })
        return c.json({ ok:false,error:'Kawvo no necesita que definas su propia solución. Intenta preparar la propuesta nuevamente.' },502)
      }"""
new = """      if (result.status === 'needs_more_info' && result.questions.length === 0) {
        await insertUsage(c,{ userId,profileId:context.profileId,operation:'generate',status:'error',model,inputTokens:totalInputTokens,outputTokens:totalOutputTokens,errorCode:'blocked_non_user_follow_up' })
        return c.json({ ok:false,error:'No pudimos completar la propuesta sin una aclaración válida. Intenta nuevamente; tu perfil no fue modificado.' },502)
      }"""
if old not in s:
    raise SystemExit('No encontré bloqueo final Kawvo específico')
s = s.replace(old, new, 1)

p.write_text(s)
print('✓ guard específico de Kawvo eliminado')
print('✓ clasificación global de follow-ups agregada')
print('✓ solo user_fact puede llegar al usuario')
print('✓ reintento interno global preservado')
print('✓ frontend permanece compatible: recibe string[]')
