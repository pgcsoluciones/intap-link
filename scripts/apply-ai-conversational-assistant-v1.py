#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API = ROOT / 'api/src/ai-profile-assistant.ts'
APP = ROOT / 'app/src/components/admin/free/FreeAiProfileAssistant.tsx'
CONTRACT = ROOT / 'scripts/test-ai-profile-assistant-contract.mjs'
INTEGRATION = ROOT / 'scripts/test-ai-profile-assistant-integration.mjs'


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'ERROR [{label}]: esperaba 1 coincidencia y encontré {count}. No se escribió ningún archivo.')
    return text.replace(old, new, 1)

api = API.read_text()
app = APP.read_text()
contract = CONTRACT.read_text()
integration = INTEGRATION.read_text()

# ---------------- API: conversation + model autonomy ----------------

api = replace_once(
    api,
    "function buildInput(answers: Record<string, string>, followUp: Array<{ question: string; answer: string }>, context: any, limits: PlanLimits, editingScope: EditingScope) {",
    "function buildInput(answers: Record<string, string>, followUp: Array<{ question: string; answer: string }>, conversation: Array<{ role: 'user' | 'assistant'; content: string }>, context: any, limits: PlanLimits, editingScope: EditingScope, mustFinalize: boolean) {",
    'buildInput signature',
)
api = replace_once(
    api,
    "    answers,\n    follow_up_answers: followUp,\n  })",
    "    answers,\n    follow_up_answers: followUp,\n    conversation,\n    must_finalize: mustFinalize,\n  })",
    'buildInput conversation payload',
)

api = replace_once(
    api,
    "  const followUp: FollowUpAnswer[] = Array.isArray(body?.follow_up_answers)\n    ? body.follow_up_answers.slice(0, 3).map((item: any) => ({ question: text(item?.question, 180), answer: text(item?.answer, MAX_ANSWER_LENGTH) })).filter((item: FollowUpAnswer) => item.question && item.answer)\n    : []\n  const totalLength = Object.values(answers).reduce((sum: number, value: string) => sum + value.length, 0) + followUp.reduce((sum: number, value: FollowUpAnswer) => sum + value.question.length + value.answer.length, 0)",
    "  const followUp: FollowUpAnswer[] = Array.isArray(body?.follow_up_answers)\n    ? body.follow_up_answers.slice(0, 3).map((item: any) => ({ question: text(item?.question, 180), answer: text(item?.answer, MAX_ANSWER_LENGTH) })).filter((item: FollowUpAnswer) => item.question && item.answer)\n    : []\n  const conversation: Array<{ role: 'user' | 'assistant'; content: string }> = Array.isArray(body?.conversation)\n    ? body.conversation.slice(-12).map((item: any) => ({ role: item?.role === 'assistant' ? 'assistant' as const : 'user' as const, content: text(item?.content, 700) })).filter((item: any) => item.content)\n    : []\n  const totalLength = Object.values(answers).reduce((sum: number, value: string) => sum + value.length, 0) + followUp.reduce((sum: number, value: FollowUpAnswer) => sum + value.question.length + value.answer.length, 0) + conversation.reduce((sum: number, value) => sum + value.content.length, 0)",
    'conversation parsing',
)

preflight = """  if (editingScope === 'full_profile' && context.configuredChannels.length > 1 && !answers.preferred_contact && !followUp.some((item: FollowUpAnswer) => /contact|whatsapp|llamada|correo/i.test(item.question))) {
    return c.json({ ok: true, data: { status: 'needs_more_info', questions: ['¿Cómo prefieres que te contacten principalmente?'], options: context.configuredChannels, round } })
  }

"""
api = replace_once(api, preflight, '', 'remove deterministic contact preflight')

api = replace_once(
    api,
    "        input: buildInput(answers, followUp, context, limits, editingScope),",
    "        input: buildInput(answers, followUp, conversation, context, limits, editingScope, round >= limits.ai_max_rounds),",
    'buildInput call',
)

api = replace_once(
    api,
    "  'SUFICIENCIA: antes de redactar decide si existe información suficiente para producir una presentación específica y creíble. No preguntes para completar una plantilla mental. Si falta información verdaderamente esencial, devuelve needs_more_info con 1 a 3 preguntas de alto valor informativo. No preguntes lo ya guardado, ya respondido o inferible de forma segura.',",
    "  'SUFICIENCIA Y AUTONOMÍA: analiza primero todo el perfil, respuestas y conversación. Si puedes producir una propuesta útil, específica y creíble, hazlo sin pedir permiso adicional. No preguntes para completar una plantilla mental. Solo devuelve needs_more_info cuando avanzar obligaría a inventar un hecho importante o cuando una aclaración pueda cambiar materialmente la propuesta. Normalmente haz una sola pregunta; usa hasta tres solo si son realmente imprescindibles. Nunca repitas algo ya guardado, ya respondido o inferible de forma razonable.',\n  'CONOCIMIENTO GENERAL: puedes usar libremente tu conocimiento general sobre profesiones, industrias, servicios, marketing, comportamiento del cliente, comunicación y buenas prácticas de copy para comprender el contexto, escoger vocabulario natural del sector, identificar beneficios razonablemente derivados y mejorar la presentación. Ese conocimiento sirve para interpretar y redactar; nunca lo conviertas en un hecho particular del usuario sin respaldo.',\n  'NO DELEGUES LA ESTRATEGIA: no preguntes al usuario qué valor quiere reflejar, qué beneficio quiere comunicar, cómo quiere posicionarse, qué mensaje debería transmitir ni qué lo hace diferente cuando eso pueda deducirse razonablemente del perfil y de sus respuestas. El usuario aporta hechos, contexto y preferencias básicas; tú haces el trabajo de análisis, posicionamiento, jerarquía y copy.',\n  'CONVERSACIÓN: conversation contiene el hilo de esta sesión. Úsalo como memoria de trabajo. Integra todas las respuestas previas y nunca vuelvas a preguntar lo ya respondido. follow_up_answers contiene las respuestas de la pantalla actual y también debe considerarse contexto confirmado.',\n  'ÚLTIMA RONDA: si must_finalize=true, produce la mejor propuesta posible con la información disponible. No devuelvas needs_more_info salvo que hacerlo implique inventar un hecho esencial que haga insegura o engañosa la propuesta.',",
    'editorial autonomy prompt',
)

api = replace_once(
    api,
    "  'CTA Y CANALES: configured_channels solo informa qué canales existen. Si hay varias alternativas razonables y el usuario no indicó preferencia, no elijas arbitrariamente: devuelve needs_more_info. Los canales no determinan por sí solos la intención. No sugieras una acción incompatible con canales existentes.',",
    "  'CTA Y CANALES: configured_channels informa qué canales existen, pero no obliga a elegir uno. Redacta un CTA compatible con la intención y con los canales disponibles. Si no hace falta un canal concreto, usa una acción genérica y útil como solicitar cotización, reservar o contactar. Pregunta por preferencia de canal solo si esa elección cambia materialmente la propuesta y no puede resolverse de forma segura con el contexto.',",
    'channel autonomy prompt',
)

# ---------------- APP: free-text conversational intake ----------------

app = replace_once(
    app,
    "type FollowUp = { question: string; answer: string }\n",
    "type FollowUp = { question: string; answer: string }\ntype ConversationTurn = { role: 'user' | 'assistant'; content: string }\n",
    'conversation type',
)
app = replace_once(
    app,
    "  const [followUp,setFollowUp] = useState<FollowUp[]>([])\n",
    "  const [followUp,setFollowUp] = useState<FollowUp[]>([])\n  const [conversation,setConversation] = useState<ConversationTurn[]>([])\n",
    'conversation state',
)
app = replace_once(
    app,
    "  const enoughInformation = editingScope === 'missing_only' ? (!hasMissingEditorialContent || missingOnlyAnswerLength >= 4) : totalAnswerLength >= 8\n",
    "  const enoughInformation = hasExistingContent || totalAnswerLength >= 4\n",
    'allow model to work from context',
)
app = replace_once(
    app,
    "    setFollowUp([])\n    setProposal(null)\n",
    "    setFollowUp([])\n    setConversation([])\n    setProposal(null)\n",
    'reset conversation on scope change',
)

app = replace_once(
    app,
    "      const json:any = await apiPost('/me/ai-profile-assistant/generate',{ answers, follow_up_answers:followUp, round:nextRound, editing_scope:editingScope })",
    "      const answeredTurns: ConversationTurn[] = followUp.flatMap((item)=>item.answer.trim() ? [{ role:'assistant' as const, content:item.question }, { role:'user' as const, content:item.answer.trim() }] : [])\n      const conversationPayload = [...conversation, ...answeredTurns]\n      const json:any = await apiPost('/me/ai-profile-assistant/generate',{ answers, follow_up_answers:followUp, conversation:conversationPayload, round:nextRound, editing_scope:editingScope })",
    'send conversation',
)
app = replace_once(
    app,
    "        const questions = (json.data.questions || []).slice(0,3)\n        const isContactPreflight = Array.isArray(json.data?.options) && json.data.options.length > 0\n\n        if (!isContactPreflight && nextRound >= context.plan.limits.ai_max_rounds) {\n          setFollowUp([])\n          setProposal(null)\n          setError('Con la información disponible todavía no pudimos preparar una propuesta suficientemente específica. Revisa tus respuestas e inténtalo nuevamente.')\n          return\n        }\n\n        setFollowUp(questions.map((q:string)=>({ question:q, answer:'' })))\n\n        if (!isContactPreflight) {\n          setRound(Math.min(nextRound + 1, context.plan.limits.ai_max_rounds))\n        }\n",
    "        const questions = (json.data.questions || []).slice(0,3)\n        setConversation(conversationPayload)\n        setFollowUp(questions.map((q:string)=>({ question:q, answer:'' })))\n        setRound(Math.min(nextRound + 1, context.plan.limits.ai_max_rounds))\n",
    'simplify conversational follow-up',
)
app = replace_once(
    app,
    "        setProposal(json.data.proposal as Proposal)\n        setSuggestedProposal(json.data.proposal as Proposal)\n        setFollowUp([])\n",
    "        setConversation(conversationPayload)\n        setProposal(json.data.proposal as Proposal)\n        setSuggestedProposal(json.data.proposal as Proposal)\n        setFollowUp([])\n",
    'persist completed conversation',
)

old_planner = """        {editingScope==='missing_only' ? <>
          {!hasMissingEditorialContent && <div className=\"rounded-2xl border border-emerald-200 bg-emerald-50 p-4\"><p className=\"font-black text-emerald-800\">No encontré campos de texto pendientes.</p><p className=\"mt-1 text-sm font-semibold leading-6 text-emerald-700\">Si quieres que Kawvo proponga mejoras sobre lo que ya tienes, selecciona “Revisar y mejorar mi contenido”.</p></div>}
          {missingTitle && <Question label=\"¿Cómo quieres que aparezca tu título, puesto u oficio?\" hint={examples.activity} value={answers.activity_details} onChange={(v)=>setAnswers((a)=>({...a,activity_details:v}))} />}
          {missingBio && <Question label=\"¿Qué debería entender una persona sobre ti o tu negocio en pocos segundos?\" hint=\"Cuéntame a quién ayudas, qué haces y qué valor práctico ofreces.\" value={answers.clients} onChange={(v)=>setAnswers((a)=>({...a,clients:v}))} />}
          {missingServices ? <Question label=\"¿Cuáles son los servicios reales que quieres mostrar?\" hint={`Menciona hasta ${context.plan.limits.max_services}. Kawvo no inventará servicios para completar espacios.`} value={answers.services_details} onChange={(v)=>setAnswers((a)=>({...a,services_details:v}))} /> : missingServicesSectionCopy ? <Question label=\"¿Cómo quieres presentar los servicios que ya tienes?\" hint=\"Cuéntame qué tienen en común, qué necesidad resuelven o qué debería entender el visitante antes de leerlos. Kawvo redactará solo el título o introducción que falte.\" value={answers.services_details} onChange={(v)=>setAnswers((a)=>({...a,services_details:v}))} /> : null}
          {missingPortfolioCopy && <Question label={`Hay ${incompletePortfolio.length} trabajo${incompletePortfolio.length===1?'':'s'} con texto incompleto. ¿Qué muestra${incompletePortfolio.length===1?'':'n'}?`} hint=\"Descríbelos brevemente en el mismo orden de tus fotos. La IA solo completará títulos o descripciones vacías.\" value={answers.extra_context} onChange={(v)=>setAnswers((a)=>({...a,extra_context:v}))} />}
        </> : <>
          <Question label=\"¿A qué tipo de cliente quieres hablarle principalmente?\" hint={examples.clients} value={answers.clients} onChange={(v)=>setAnswers((a)=>({...a,clients:v}))} />
          <Question label=\"¿Qué quieres que destaque o mejore de tu presentación actual?\" hint=\"Por ejemplo: explicar mejor tu valor, sonar más profesional, enfocarte en cierto cliente o destacar una especialidad, servicio o trabajo. Kawvo tomará tus respuestas como información, no como copy literal.\" value={answers.extra_context} onChange={(v)=>setAnswers((a)=>({...a,extra_context:v}))} />
          <Question label=\"¿Qué quieres que una persona haga después de entender tu perfil?\" hint={examples.action} value={answers.next_action} onChange={(v)=>setAnswers((a)=>({...a,next_action:v}))} />
        </>}

        {editingScope==='full_profile' && channels.length>1 && <div className=\"rounded-2xl border border-slate-200 bg-slate-50 p-4\"><p className=\"text-sm font-black text-slate-800\">El canal principal se definirá solo si hace falta</p><p className=\"mt-1 text-xs font-semibold leading-5 text-slate-500\">Kawvo conoce tus canales configurados. Si necesita elegir uno para redactar una recomendación de acción, te preguntará en la siguiente ronda. No cambia tus Botones rápidos.</p></div>}

        {hasMissingEditorialContent || editingScope==='full_profile' ? <button type=\"button\" onClick={()=>void generate(1)} disabled={!enoughInformation || generating || cooldownSeconds>0} className=\"w-full rounded-2xl bg-slate-950 px-5 py-4 text-base font-black text-white disabled:opacity-35\">{generating?'Preparando…':cooldownSeconds>0?`Disponible en ${cooldownSeconds} s`:'✦ Preparar mi propuesta'}</button> : null}
        <p className=\"text-center text-[11px] font-semibold leading-5 text-slate-400\">Kawvo usa lo que ya existe como contexto y evita pedirte lo mismo dos veces.</p>
"""
new_planner = """        {editingScope==='missing_only' && !hasMissingEditorialContent ? <div className=\"rounded-2xl border border-emerald-200 bg-emerald-50 p-4\"><p className=\"font-black text-emerald-800\">No encontré campos de texto pendientes.</p><p className=\"mt-1 text-sm font-semibold leading-6 text-emerald-700\">Si quieres que Kawvo proponga mejoras sobre lo que ya tienes, selecciona “Revisar y mejorar mi contenido”.</p></div> : <>
          <Question label=\"¿Hay algo que quieras contarle a Kawvo antes de trabajar tu perfil?\" hint=\"Opcional. Puedes escribirlo como se lo explicarías a una persona. No tienes que definir tu propuesta de valor ni saber de marketing: Kawvo hará ese análisis usando tu perfil y su conocimiento general.\" value={answers.extra_context} onChange={(v)=>setAnswers((a)=>({...a,extra_context:v}))} rows={4} />
          <div className=\"rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4 text-sm font-semibold leading-6 text-cyan-900\">Kawvo ya conoce el contenido de tu perfil. Si tiene suficiente información, preparará la propuesta directamente. Si falta un hecho importante, te preguntará solo lo mínimo necesario.</div>
        </>}

        {hasMissingEditorialContent || editingScope==='full_profile' ? <button type=\"button\" onClick={()=>void generate(1)} disabled={!enoughInformation || generating || cooldownSeconds>0} className=\"w-full rounded-2xl bg-slate-950 px-5 py-4 text-base font-black text-white disabled:opacity-35\">{generating?'Analizando tu perfil…':cooldownSeconds>0?`Disponible en ${cooldownSeconds} s`:answers.extra_context.trim()?'✦ Preparar mi propuesta':'✦ Mejorar con lo que ya sabes'}</button> : null}
        <p className=\"text-center text-[11px] font-semibold leading-5 text-slate-400\">La IA usa el perfil completo como contexto, interpreta tus respuestas y solo pregunta cuando realmente necesita confirmar un hecho.</p>
"""
app = replace_once(app, old_planner, new_planner, 'replace deterministic planner UI')

app = replace_once(
    app,
    "        <p className=\"text-xs font-black uppercase tracking-[0.12em] text-cyan-700\">Nos falta un dato</p><h2 className=\"mt-2 text-xl font-black\">Para hacer la propuesta más específica</h2><p className=\"mt-2 text-sm font-medium leading-6 text-slate-600\">Solo te preguntamos lo que realmente hace falta.</p>",
    "        <p className=\"text-xs font-black uppercase tracking-[0.12em] text-cyan-700\">Kawvo necesita confirmar algo</p><h2 className=\"mt-2 text-xl font-black\">Una aclaración antes de preparar tu propuesta</h2><p className=\"mt-2 text-sm font-medium leading-6 text-slate-600\">La IA ya revisó tu perfil. Responde solo este dato y continuará con todo el contexto anterior.</p>",
    'conversational follow-up heading',
)

# ---------------- Contract tests ----------------
contract = replace_once(
    contract,
    "assert.match(apiSource, /editingScope === 'full_profile'.*configuredChannels.length > 1/s, 'Missing-only must not be blocked by contact preference')\n",
    "assert.doesNotMatch(apiSource, /editingScope === 'full_profile'.*configuredChannels.length > 1.*needs_more_info/s, 'Contact preference must not be a deterministic preflight')\nassert.match(apiSource, /CONOCIMIENTO GENERAL/i, 'Model may use general professional and sector knowledge for interpretation')\nassert.match(apiSource, /NO DELEGUES LA ESTRATEGIA/i, 'Assistant must not delegate marketing strategy back to the user')\nassert.match(apiSource, /conversation,|conversation:/, 'Conversation context must be sent to the model')\nassert.match(apiSource, /must_finalize/, 'Final model round must be explicitly instructed to produce the best possible proposal')\n",
    'backend conversational contract',
)
contract = replace_once(
    contract,
    "assert.match(appSource, /Voy a preguntarte solo por lo que falta/, 'Missing-only mode must have its own question planner')\nassert.match(appSource, /Voy a revisar tu perfil completo/, 'Full-profile mode must have its own strategic question planner')\n",
    "assert.match(appSource, /Mejorar con lo que ya sabes/, 'UI must allow the model to work directly from existing profile context')\nassert.match(appSource, /No tienes que definir tu propuesta de valor ni saber de marketing/i, 'UI must not delegate positioning work to the user')\nassert.match(appSource, /conversation:conversationPayload/, 'Frontend must send conversational session context')\n",
    'frontend conversational contract',
)
contract = replace_once(
    contract,
    "assert.match(appSource, /canal principal se definirá solo si hace falta/i, 'Full-profile contact preference must be deferred until actually needed')\n",
    "",
    'remove old contact UI contract',
)

# ---------------- Integration: channels go to model, not preflight ----------------
old_c = """  // C: full-profile review does not prioritize multiple configured channels arbitrarily.
  {
    let upstreamCalled = false
    globalThis.fetch = async () => { upstreamCalled = true; throw new Error('must not run') }
    const db = new FakeDB({ channels: ['whatsapp','phone','email'] })
    const result = await call('/api/v1/me/ai-profile-assistant/generate', {
      answers: { activity_details: 'Soy electricista.', clients: 'hogares' },
      round: 1,
      editing_scope: 'full_profile',
    }, {}, db)
    assert.equal(result.status, 200)
    assert.equal(result.body.data.status, 'needs_more_info')
    assert.deepEqual(result.body.data.options, ['whatsapp','phone','email'])
    assert.equal(upstreamCalled, false)
  }
"""
new_c = """  // C: multiple configured channels are context for the model, not a deterministic preflight.
  {
    let upstreamCalled = false
    globalThis.fetch = async (_url, init) => {
      upstreamCalled = true
      const payload = JSON.parse(init.body)
      assert.match(payload.input, /\"configured_channels\":\[\"whatsapp\",\"phone\",\"email\"\]/)
      assert.match(payload.instructions, /no obliga a elegir uno|Pregunta por preferencia de canal solo si/i)
      return { ok: true, status: 200, json: async () => ({ status: 'completed', output_text: JSON.stringify({ status: 'ready', proposal: BASE_PROPOSAL, questions: null }), usage: {} }) }
    }
    const db = new FakeDB({ channels: ['whatsapp','phone','email'] })
    const result = await call('/api/v1/me/ai-profile-assistant/generate', {
      answers: { extra_context: 'Haz que mi perfil se presente mejor.' },
      round: 1,
      editing_scope: 'full_profile',
    }, {}, db)
    assert.equal(result.status, 200)
    assert.equal(result.body.data.status, 'ready')
    assert.equal(upstreamCalled, true)
  }
"""
integration = replace_once(integration, old_c, new_c, 'integration multiple channels')

# Add conversation assertion to existing D mock.
integration = replace_once(
    integration,
    "      assert.match(payload.input, /\"editing_scope\":\"missing_only\"/)\n      assert.match(payload.instructions, /nunca inventes/i)\n",
    "      assert.match(payload.input, /\"editing_scope\":\"missing_only\"/)\n      assert.match(payload.input, /\"conversation\":/)\n      assert.match(payload.input, /\"must_finalize\":/)\n      assert.match(payload.instructions, /nunca inventes/i)\n      assert.match(payload.instructions, /NO DELEGUES LA ESTRATEGIA/i)\n",
    'integration conversational payload',
)

API.write_text(api)
APP.write_text(app)
CONTRACT.write_text(contract)
INTEGRATION.write_text(integration)
print('OK: asistente conversacional aplicado; el modelo usa contexto + conocimiento general y pregunta solo hechos esenciales.')
