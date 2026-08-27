#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API = ROOT / 'api/src/ai-profile-assistant.ts'
APP = ROOT / 'app/src/components/admin/free/FreeAiProfileAssistant.tsx'
CONTRACT = ROOT / 'scripts/test-ai-profile-assistant-contract.mjs'


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'ERROR [{label}]: esperaba 1 coincidencia y encontré {count}. No se escribió ningún archivo.')
    return text.replace(old, new, 1)

api = API.read_text()
app = APP.read_text()
contract = CONTRACT.read_text()

# 1) Editorial brain: answers are source facts, not final copy.
anchor = "  'HECHOS E INFERENCIAS: distingue hechos confirmados, inferencias razonables y redacción comercial. Puedes inferir beneficios directos y evidentes, pero nunca convertir una posibilidad en una promesa. Nunca inventes certificaciones, experiencia, años, precios, ubicaciones, clientes, marcas, garantías, capacidades, resultados, ventajas competitivas, servicios, disponibilidad ni tiempos de entrega.',\n"
extra = anchor + "  'INTERPRETACIÓN EDITORIAL: las respuestas del usuario son materia prima factual, no texto final para copiar. NO INVENTAR no significa transcribir literalmente. Reformula, condensa y conecta los hechos para convertir respuestas coloquiales, genéricas o descriptivas en copy natural, comercial y convincente, sin añadir hechos nuevos. Si el usuario dice algo como público en general, conserva la amplitud de audiencia pero exprésala desde el valor, la necesidad o la situación del cliente cuando el contexto lo permita; evita repetir la frase mecánicamente.',\n"
api = replace_once(api, anchor, extra, 'editorial interpretation')

# 2) A contact preference is strategic and must never block missing-only completion.
api = replace_once(
    api,
    "  if (context.configuredChannels.length > 1 && !answers.preferred_contact && !followUp.some((item: FollowUpAnswer) => /contact|whatsapp|llamada|correo/i.test(item.question))) {",
    "  if (editingScope === 'full_profile' && context.configuredChannels.length > 1 && !answers.preferred_contact && !followUp.some((item: FollowUpAnswer) => /contact|whatsapp|llamada|correo/i.test(item.question))) {",
    'contact preflight by scope',
)

# 3) Preserve existing service visual/order semantics: copy update must not rewrite sort_order.
api = replace_once(
    api,
    "UPDATE profile_products SET title = ?, description = ?, sort_order = ?, updated_at = datetime('now') WHERE id = ? AND profile_id = ?",
    "UPDATE profile_products SET title = ?, description = ?, updated_at = datetime('now') WHERE id = ? AND profile_id = ?",
    'service update sql',
)
api = replace_once(
    api,
    ".bind(next.title, next.description, index, existing.id, context.profileId)",
    ".bind(next.title, next.description, existing.id, context.profileId)",
    'service update bind',
)

# 4) Detect services-section copy as a real missing editorial block.
app = replace_once(
    app,
    "  const missingServices = Boolean(context && context.profile.services.length === 0)\n  const incompletePortfolio = context?.profile.portfolio?.filter((item)=>!item.title.trim() || !item.description.trim()) || []\n  const missingPortfolioCopy = incompletePortfolio.length > 0\n  const hasMissingEditorialContent = missingTitle || missingBio || missingServices || missingPortfolioCopy\n",
    "  const missingServices = Boolean(context && context.profile.services.length === 0)\n  const missingServicesSectionTitle = Boolean(context && !(context.profile.services_section_title || '').trim())\n  const missingServicesSectionDescription = Boolean(context && !(context.profile.services_section_description || '').trim())\n  const missingServicesSectionCopy = missingServicesSectionTitle || missingServicesSectionDescription\n  const incompletePortfolio = context?.profile.portfolio?.filter((item)=>!item.title.trim() || !item.description.trim()) || []\n  const missingPortfolioCopy = incompletePortfolio.length > 0\n  const hasMissingEditorialContent = missingTitle || missingBio || missingServices || missingServicesSectionCopy || missingPortfolioCopy\n",
    'missing services section detection',
)
app = replace_once(
    app,
    "    missingServices ? answers.services_details : '',\n",
    "    (missingServices || missingServicesSectionCopy) ? answers.services_details : '',\n",
    'missing-only service answer weight',
)

# 5) Keep full-profile intake to 3 high-value questions and make copy transformation explicit.
app = replace_once(
    app,
    "          <Question label=\"¿Qué quieres que destaque o mejore de tu presentación actual?\" hint=\"Por ejemplo: explicar mejor tu valor, sonar más profesional, enfocarte en cierto cliente o destacar una especialidad.\" value={answers.extra_context} onChange={(v)=>setAnswers((a)=>({...a,extra_context:v}))} />\n          {(hasExistingServices || hasExistingPortfolio) && <Question label=\"¿Qué servicio o trabajo te interesa que tenga mayor protagonismo?\" hint=\"Opcional. Menciona lo que más te interesa posicionar; no cambia el orden visual del perfil.\" value={answers.services_details} onChange={(v)=>setAnswers((a)=>({...a,services_details:v}))} />}\n",
    "          <Question label=\"¿Qué quieres que destaque o mejore de tu presentación actual?\" hint=\"Por ejemplo: explicar mejor tu valor, sonar más profesional, enfocarte en cierto cliente o destacar una especialidad, servicio o trabajo. Kawvo tomará tus respuestas como información, no como copy literal.\" value={answers.extra_context} onChange={(v)=>setAnswers((a)=>({...a,extra_context:v}))} />\n",
    'full profile max three questions',
)

# 6) If services exist but their section heading/intro is missing, ask for presentation context instead of pretending nothing is missing.
app = replace_once(
    app,
    "          {missingServices && <Question label=\"¿Cuáles son los servicios reales que quieres mostrar?\" hint={`Menciona hasta ${context.plan.limits.max_services}. Kawvo no inventará servicios para completar espacios.`} value={answers.services_details} onChange={(v)=>setAnswers((a)=>({...a,services_details:v}))} />}\n",
    "          {missingServices ? <Question label=\"¿Cuáles son los servicios reales que quieres mostrar?\" hint={`Menciona hasta ${context.plan.limits.max_services}. Kawvo no inventará servicios para completar espacios.`} value={answers.services_details} onChange={(v)=>setAnswers((a)=>({...a,services_details:v}))} /> : missingServicesSectionCopy ? <Question label=\"¿Cómo quieres presentar los servicios que ya tienes?\" hint=\"Cuéntame qué tienen en común, qué necesidad resuelven o qué debería entender el visitante antes de leerlos. Kawvo redactará solo el título o introducción que falte.\" value={answers.services_details} onChange={(v)=>setAnswers((a)=>({...a,services_details:v}))} /> : null}\n",
    'services section missing question',
)

# 7) Add immutable AI suggestion snapshot to support explicit keep/use decisions.
app = replace_once(
    app,
    "  const [proposal,setProposal] = useState<Proposal|null>(null)\n",
    "  const [proposal,setProposal] = useState<Proposal|null>(null)\n  const [suggestedProposal,setSuggestedProposal] = useState<Proposal|null>(null)\n",
    'suggestion snapshot state',
)
app = replace_once(
    app,
    "    setProposal(null)\n    setRound(1)\n",
    "    setProposal(null)\n    setSuggestedProposal(null)\n    setRound(1)\n",
    'reset suggestion snapshot',
)
app = replace_once(
    app,
    "        setProposal(json.data.proposal as Proposal)\n        setFollowUp([])\n",
    "        setProposal(json.data.proposal as Proposal)\n        setSuggestedProposal(json.data.proposal as Proposal)\n        setFollowUp([])\n",
    'save suggestion snapshot',
)

# 8) Current vs suggested review for existing title and bio in full-profile mode.
old_identity = """        <div className=\"rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm\">\n          <div className=\"flex justify-between gap-3\"><div><p className=\"text-xs font-black uppercase tracking-[0.12em] text-cyan-700\">Identidad</p><h2 className=\"mt-1 text-xl font-black\">Cómo te presentas</h2></div><label className=\"text-xs font-black\"><input type=\"checkbox\" checked={selection.identity} onChange={(e)=>setSelection((s)=>({...s,identity:e.target.checked}))} className=\"mr-2 accent-cyan-700\"/>Aplicar</label></div>\n          <input value={editingScope==='missing_only'&&context.profile.professional_title?context.profile.professional_title:proposal.professional_title} disabled={editingScope==='missing_only'&&Boolean(context.profile.professional_title)} onChange={(e)=>updateProposal('professional_title',e.target.value.slice(0,80))} className=\"mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-black\" />\n        </div>\n        <div className=\"rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm\"><div className=\"flex justify-between\"><h2 className=\"text-xl font-black\">Sobre ti o tu negocio</h2><label className=\"text-xs font-black\"><input type=\"checkbox\" checked={selection.bio} onChange={(e)=>setSelection((s)=>({...s,bio:e.target.checked}))} className=\"mr-2 accent-cyan-700\"/>Aplicar</label></div><textarea value={editingScope==='missing_only'&&context.profile.bio?context.profile.bio:proposal.bio} disabled={editingScope==='missing_only'&&Boolean(context.profile.bio)} onChange={(e)=>updateProposal('bio',e.target.value.slice(0,300))} maxLength={300} rows={5} className=\"mt-4 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 leading-6\" /></div>\n"""
new_identity = """        <div className=\"rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm\">\n          <div><p className=\"text-xs font-black uppercase tracking-[0.12em] text-cyan-700\">Identidad</p><h2 className=\"mt-1 text-xl font-black\">Cómo te presentas</h2></div>\n          {editingScope==='full_profile' && context.profile.professional_title ? <div className=\"mt-4 space-y-3\"><div className=\"rounded-2xl bg-slate-50 p-4\"><p className=\"text-[11px] font-black uppercase text-slate-400\">Tu texto actual</p><p className=\"mt-2 font-bold text-slate-700\">{context.profile.professional_title}</p></div><div className=\"rounded-2xl border border-cyan-200 bg-cyan-50/50 p-4\"><p className=\"text-[11px] font-black uppercase text-cyan-700\">Sugerencia de Kawvo</p><input value={proposal.professional_title} onChange={(e)=>updateProposal('professional_title',e.target.value.slice(0,80))} className=\"mt-2 w-full rounded-xl border border-cyan-200 bg-white px-3 py-3 font-black\"/></div><div className=\"grid grid-cols-2 gap-2\"><button type=\"button\" onClick={()=>{updateProposal('professional_title',context.profile.professional_title);setSelection((s)=>({...s,identity:false}))}} className={`rounded-xl px-3 py-3 text-sm font-black ${!selection.identity?'bg-slate-900 text-white':'bg-slate-100 text-slate-700'}`}>Mantener mi texto</button><button type=\"button\" onClick={()=>{if(suggestedProposal)updateProposal('professional_title',suggestedProposal.professional_title);setSelection((s)=>({...s,identity:true}))}} className={`rounded-xl px-3 py-3 text-sm font-black ${selection.identity?'bg-cyan-700 text-white':'bg-cyan-50 text-cyan-800'}`}>Usar texto sugerido</button></div></div> : <input value={editingScope==='missing_only'&&context.profile.professional_title?context.profile.professional_title:proposal.professional_title} disabled={editingScope==='missing_only'&&Boolean(context.profile.professional_title)} onChange={(e)=>updateProposal('professional_title',e.target.value.slice(0,80))} className=\"mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-black\" />}\n        </div>\n        <div className=\"rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm\"><h2 className=\"text-xl font-black\">Sobre ti o tu negocio</h2>{editingScope==='full_profile' && context.profile.bio ? <div className=\"mt-4 space-y-3\"><div className=\"rounded-2xl bg-slate-50 p-4\"><p className=\"text-[11px] font-black uppercase text-slate-400\">Tu texto actual</p><p className=\"mt-2 whitespace-pre-wrap text-sm font-medium leading-6 text-slate-700\">{context.profile.bio}</p></div><div className=\"rounded-2xl border border-cyan-200 bg-cyan-50/50 p-4\"><p className=\"text-[11px] font-black uppercase text-cyan-700\">Sugerencia de Kawvo</p><textarea value={proposal.bio} onChange={(e)=>updateProposal('bio',e.target.value.slice(0,300))} maxLength={300} rows={5} className=\"mt-2 w-full resize-none rounded-xl border border-cyan-200 bg-white px-4 py-3.5 leading-6\"/></div><div className=\"grid grid-cols-2 gap-2\"><button type=\"button\" onClick={()=>{updateProposal('bio',context.profile.bio);setSelection((s)=>({...s,bio:false}))}} className={`rounded-xl px-3 py-3 text-sm font-black ${!selection.bio?'bg-slate-900 text-white':'bg-slate-100 text-slate-700'}`}>Mantener mi texto</button><button type=\"button\" onClick={()=>{if(suggestedProposal)updateProposal('bio',suggestedProposal.bio);setSelection((s)=>({...s,bio:true}))}} className={`rounded-xl px-3 py-3 text-sm font-black ${selection.bio?'bg-cyan-700 text-white':'bg-cyan-50 text-cyan-800'}`}>Usar texto sugerido</button></div></div> : <textarea value={editingScope==='missing_only'&&context.profile.bio?context.profile.bio:proposal.bio} disabled={editingScope==='missing_only'&&Boolean(context.profile.bio)} onChange={(e)=>updateProposal('bio',e.target.value.slice(0,300))} maxLength={300} rows={5} className=\"mt-4 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 leading-6\" />}</div>\n"""
app = replace_once(app, old_identity, new_identity, 'identity and bio review choices')

# Contract coverage for new behaviors.
contract_anchor = "assert.match(apiSource, /Nunca inventes/i, 'Editorial brain must explicitly forbid invented facts/services')\n"
contract_extra = contract_anchor + "assert.match(apiSource, /NO INVENTAR no significa transcribir literalmente|INTERPRETACIÓN EDITORIAL/i, 'Editorial brain must transform grounded answers into copy instead of mirroring them')\nassert.match(apiSource, /editingScope === 'full_profile'.*configuredChannels.length > 1/s, 'Missing-only must not be blocked by contact preference')\nassert.doesNotMatch(apiSource, /UPDATE profile_products SET title = \\?, description = \\?, sort_order = \\?/, 'AI service copy updates must preserve service order')\n"
contract = replace_once(contract, contract_anchor, contract_extra, 'backend editorial contract')
contract_anchor2 = "assert.match(appSource, /canal principal se definirá solo si hace falta/i, 'Full-profile contact preference must be deferred until actually needed')\n"
contract_extra2 = contract_anchor2 + "assert.match(appSource, /Mantener mi texto/, 'Full-profile review must let the user keep existing copy')\nassert.match(appSource, /Usar texto sugerido/, 'Full-profile review must let the user choose AI copy explicitly')\nassert.match(appSource, /Sugerencia de Kawvo/, 'Existing copy must be shown alongside the AI suggestion')\nassert.match(appSource, /missingServicesSectionCopy/, 'Missing-only planner must detect services-section title or intro')\n"
contract = replace_once(contract, contract_anchor2, contract_extra2, 'review UX contract')

API.write_text(api)
APP.write_text(app)
CONTRACT.write_text(contract)
print('OK: criterio editorial + comparación texto actual/sugerido + planner refinado aplicados.')
