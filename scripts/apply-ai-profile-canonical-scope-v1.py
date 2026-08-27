#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API = ROOT / 'api/src/ai-profile-assistant.ts'
UI = ROOT / 'app/src/components/admin/free/FreeAiProfileAssistant.tsx'


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'ERROR [{label}]: esperaba 1 coincidencia y encontré {count}. No se escribió ningún archivo.')
    return text.replace(old, new, 1)

api = API.read_text()
ui = UI.read_text()

# ---------- API: canonical limits + portfolio + editing scope ----------
api = replace_once(api,
"const FREE_MAX_SERVICES = 3\nconst COOLDOWN_SECONDS = 20",
"const FREE_MAX_SERVICES = 3\nconst FREE_MAX_PORTFOLIO = 5\nconst COOLDOWN_SECONDS = 20",
"api constants")

api = replace_once(api,
"type ImageSuggestion = { purpose: string; suggestion: string }\ntype AssistantProposal = {\n  professional_title: string\n  bio: string\n  services_section_title: string\n  services_section_description: string\n  services: Array<{ title: string; description: string }>\n  cta:",
"type ImageSuggestion = { purpose: string; suggestion: string }\ntype PortfolioProposal = { id: string; title: string; description: string }\ntype EditingScope = 'missing_only' | 'full_profile'\ntype AssistantProposal = {\n  professional_title: string\n  bio: string\n  services_section_title: string\n  services_section_description: string\n  services: Array<{ title: string; description: string }>\n  portfolio: PortfolioProposal[]\n  cta:",
"api proposal types")

api = replace_once(api,
"type ExistingService = { id: string; title: string; description: string; has_image: boolean }\n\ntype PlanLimits = {\n  max_services: number",
"type ExistingService = { id: string; title: string; description: string; has_image: boolean }\ntype ExistingPortfolio = { id: string; title: string; description: string }\n\ntype PlanLimits = {\n  max_services: number\n  max_portfolio: number",
"api plan types")

api = replace_once(api,
"    max_services: free ? numericEnv(c.env.FREE_MAX_SERVICES, FREE_MAX_SERVICES, 1, 20) : numericEnv(c.env.PAID_MAX_SERVICES, 20, 1, 100),\n    ai_daily_generations:",
"    max_services: free ? numericEnv(c.env.FREE_MAX_SERVICES, FREE_MAX_SERVICES, 1, 20) : numericEnv(c.env.PAID_MAX_SERVICES, 20, 1, 100),\n    max_portfolio: free ? numericEnv(c.env.FREE_MAX_PORTFOLIO, FREE_MAX_PORTFOLIO, 1, 20) : numericEnv(c.env.PAID_MAX_PORTFOLIO, 20, 1, 100),\n    ai_daily_generations:",
"api plan limits")

# Real editor limit is 90, not 110.
api = api.replace("description: text(item?.description, 110)", "description: text(item?.description, 90)")
api = api.replace("description: text(row.description, 110)", "description: text(row.description, 90)")

api = replace_once(api,
"  const imageSuggestions = Array.isArray(value.image_suggestions)\n    ? value.image_suggestions.slice(0, 4).map((item: any) => ({",
"  const portfolio = Array.isArray(value.portfolio)\n    ? value.portfolio.slice(0, FREE_MAX_PORTFOLIO).map((item: any) => ({\n        id: text(item?.id, 80), title: text(item?.title, 80), description: text(item?.description, 90),\n      })).filter((item: PortfolioProposal) => item.id)\n    : []\n  const imageSuggestions = Array.isArray(value.image_suggestions)\n    ? value.image_suggestions.slice(0, 4).map((item: any) => ({",
"api portfolio validation")

api = replace_once(api,
"    services,\n    cta: { label:",
"    services,\n    portfolio,\n    cta: { label:",
"api proposal portfolio")

api = replace_once(api,
"  const [servicesResult, contact] = await Promise.all([\n    c.env.DB.prepare(`SELECT id, title, description, image_url, sort_order FROM profile_products WHERE profile_id = ? ORDER BY sort_order ASC, created_at ASC LIMIT 20`).bind(profileId).all(),\n    c.env.DB.prepare(`SELECT whatsapp, email, phone, address FROM profile_contact WHERE profile_id = ? LIMIT 1`).bind(profileId).first(),\n  ])",
"  const [servicesResult, portfolioResult, contact] = await Promise.all([\n    c.env.DB.prepare(`SELECT id, title, description, image_url, sort_order FROM profile_products WHERE profile_id = ? ORDER BY sort_order ASC, created_at ASC LIMIT 20`).bind(profileId).all(),\n    c.env.DB.prepare(`SELECT id, title, description FROM profile_gallery WHERE profile_id = ? ORDER BY sort_order ASC, created_at ASC LIMIT 5`).bind(profileId).all(),\n    c.env.DB.prepare(`SELECT whatsapp, email, phone, address FROM profile_contact WHERE profile_id = ? LIMIT 1`).bind(profileId).first(),\n  ])",
"api portfolio query")

api = replace_once(api,
"  const contactData = {",
"  const portfolio: ExistingPortfolio[] = (portfolioResult.results as any[]).map((row) => ({\n    id: String(row.id), title: text(row.title, 80), description: text(row.description, 90),\n  }))\n  const contactData = {",
"api portfolio map")

api = replace_once(api,
"    services,\n    contact: contactData,",
"    services,\n    portfolio,\n    contact: contactData,",
"api context portfolio")

api = replace_once(api,
"    existing_services: context.services.map((s: ExistingService) => ({ title: s.title, description: s.description, has_image: s.has_image })),\n  }",
"    existing_services: context.services.map((s: ExistingService) => ({ title: s.title, description: s.description, has_image: s.has_image })),\n    portfolio: context.portfolio.map((item: ExistingPortfolio, index: number) => ({ index: index + 1, id: item.id, title: item.title, description: item.description })),\n  }",
"api input portfolio")

api = replace_once(api,
"function buildInput(answers: Record<string, string>, followUp: Array<{ question: string; answer: string }>, context: any, limits: PlanLimits) {",
"function buildInput(answers: Record<string, string>, followUp: Array<{ question: string; answer: string }>, context: any, limits: PlanLimits, editingScope: EditingScope) {",
"api buildInput signature")

api = replace_once(api,
"    plan: { code: context.planId, limits },\n    answers,",
"    plan: { code: context.planId, limits },\n    editing_scope: editingScope,\n    field_limits: { name: 80, professional_title: 80, bio: 300, portfolio_max: limits.max_portfolio, portfolio_title: 80, portfolio_description: 90, services_max: limits.max_services, service_title: 60, service_description: 90, services_section_title: 60, services_section_description: 240 },\n    answers,",
"api input limits")

api = replace_once(api,
"    services: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { title: { type: 'string' }, description: { type: 'string' } }, required: ['title','description'] } },\n    cta:",
"    services: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { title: { type: 'string' }, description: { type: 'string' } }, required: ['title','description'] } },\n    portfolio: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { id: { type: 'string' }, title: { type: 'string' }, description: { type: 'string' } }, required: ['id','title','description'] } },\n    cta:",
"api schema portfolio")

api = replace_once(api,
"  required: ['professional_title','bio','services_section_title','services_section_description','services','cta','image_suggestions'],",
"  required: ['professional_title','bio','services_section_title','services_section_description','services','portfolio','cta','image_suggestions'],",
"api schema required")

api = replace_once(api,
"  'SERVICIOS: propone únicamente servicios reales y respeta plan.limits.max_services. Cada título debe ser concreto y escaneable; cada descripción debe expresar utilidad, beneficio o problema que resuelve. No inventes servicios para llenar cupos ni escribas definiciones de diccionario.',",
"  'LÍMITES REALES: respeta field_limits exactamente. Nombre y título/puesto 80; bio 300; portafolio máximo 5, título 80 y descripción 90; servicios máximo 3, título 60 y descripción 90; título de sección de servicios 60 y descripción general 240. No escribas texto que luego deba ser truncado por el editor.',\n  'ALCANCE DE EDICIÓN: editing_scope=missing_only significa conservar todo campo ya completado y proponer contenido únicamente para vacíos; puedes usar lo existente como contexto. editing_scope=full_profile permite proponer mejoras de texto, pero nunca modifica imágenes, URLs, canales, cuentas bancarias, diseño ni orden. El nombre no se cambia por IA en ningún alcance.',\n  'TRABAJOS/PORTAFOLIO: portfolio contiene hasta 5 fotos existentes y solo sus metadatos textuales. No inventes lo que muestra una foto si título y descripción no permiten saberlo; en ese caso usa needs_more_info con una pregunta mínima que permita describirla. Nunca propongas eliminar, reemplazar o reordenar fotos. portfolio de salida debe conservar los id recibidos.',\n  'SERVICIOS: propone únicamente servicios reales y respeta plan.limits.max_services. Cada título debe ser concreto y escaneable; cada descripción debe expresar utilidad, beneficio o problema que resuelve. No inventes servicios para llenar cupos ni escribas definiciones de diccionario.',",
"api prompt scope")

api = replace_once(api,
"  const round = numericEnv(body?.round, 1, 1, 99)\n  const limits = planLimits(c, context.planId)",
"  const round = numericEnv(body?.round, 1, 1, 99)\n  const editingScope: EditingScope = body?.editing_scope === 'full_profile' ? 'full_profile' : 'missing_only'\n  const limits = planLimits(c, context.planId)",
"api generate scope")

api = replace_once(api,
"        input: buildInput(answers, followUp, context, limits),",
"        input: buildInput(answers, followUp, context, limits, editingScope),",
"api call scope")

api = replace_once(api,
"      services: context.services, contact: context.contact,\n      configured_channels: context.configuredChannels,",
"      services: context.services, portfolio: context.portfolio, contact: context.contact,\n      configured_channels: context.configuredChannels,",
"api context response portfolio")

# Apply: scope + portfolio selection + server-side preservation.
api = replace_once(api,
"  const limits = planLimits(c,context.planId)\n  const proposal = validateProposal(body?.proposal, limits.max_services)",
"  const limits = planLimits(c,context.planId)\n  const editingScope: EditingScope = body?.editing_scope === 'full_profile' ? 'full_profile' : 'missing_only'\n  const proposal = validateProposal(body?.proposal, limits.max_services)",
"api apply scope")

api = replace_once(api,
"  const applyServices = Boolean(apply.services)\n  const confirmExistingServicesUpdate = body?.replace_existing_services === true\n  if (!applyIdentity && !applyBio && !applyServicesSection && !applyServices)",
"  const applyServices = Boolean(apply.services)\n  const applyPortfolio = Boolean(apply.portfolio)\n  const confirmExistingServicesUpdate = body?.replace_existing_services === true\n  if (!applyIdentity && !applyBio && !applyServicesSection && !applyServices && !applyPortfolio)",
"api apply portfolio selection")

api = replace_once(api,
"  if (applyServices && context.services.length > 0 && !confirmExistingServicesUpdate) return c.json({ ok:false,error:'Confirma explícitamente si deseas actualizar el texto de tus servicios actuales.',code:'replace_services_confirmation_required' },409)\n\n  const nextTemplateData",
"  if (editingScope === 'full_profile' && applyServices && context.services.length > 0 && !confirmExistingServicesUpdate) return c.json({ ok:false,error:'Confirma explícitamente si deseas actualizar el texto de tus servicios actuales.',code:'replace_services_confirmation_required' },409)\n\n  const effectiveIdentity = applyIdentity && (editingScope === 'full_profile' || !context.professionalTitle)\n  const effectiveBio = applyBio && (editingScope === 'full_profile' || !context.bio)\n  const effectiveServices = applyServices && (editingScope === 'full_profile' || context.services.length === 0)\n\n  const nextTemplateData",
"api effective scope")

api = replace_once(api,
"  if (applyIdentity) { nextTemplateData.role = proposal.professional_title; nextTemplateData.free_identity_confirmed = true }\n  if (applyServicesSection) { nextTemplateData.services_section_title = proposal.services_section_title; nextTemplateData.services_section_description = proposal.services_section_description }\n  const statements:any[] = []\n  if (applyIdentity || applyBio || applyServicesSection) {\n    statements.push(c.env.DB.prepare(`UPDATE profiles SET bio = CASE WHEN ? = 1 THEN ? ELSE bio END, template_data = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`).bind(applyBio?1:0,proposal.bio,JSON.stringify(nextTemplateData),context.profileId,userId))\n  }\n  if (applyServices) {",
"  if (effectiveIdentity) { nextTemplateData.role = proposal.professional_title; nextTemplateData.free_identity_confirmed = true }\n  if (applyServicesSection) {\n    if (editingScope === 'full_profile' || !context.servicesSectionTitle) nextTemplateData.services_section_title = proposal.services_section_title\n    if (editingScope === 'full_profile' || !context.servicesSectionDescription) nextTemplateData.services_section_description = proposal.services_section_description\n  }\n  const statements:any[] = []\n  if (effectiveIdentity || effectiveBio || applyServicesSection) {\n    statements.push(c.env.DB.prepare(`UPDATE profiles SET bio = CASE WHEN ? = 1 THEN ? ELSE bio END, template_data = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`).bind(effectiveBio?1:0,proposal.bio,JSON.stringify(nextTemplateData),context.profileId,userId))\n  }\n  if (effectiveServices) {",
"api preserve existing")

api = replace_once(api,
"  try { if (statements.length) await c.env.DB.batch(statements) } catch {",
"  if (applyPortfolio) {\n    const portfolioById = new Map(context.portfolio.map((item: ExistingPortfolio) => [item.id, item]))\n    for (const item of proposal.portfolio.slice(0, limits.max_portfolio)) {\n      const existing = portfolioById.get(item.id)\n      if (!existing) continue\n      const nextTitle = editingScope === 'full_profile' || !existing.title ? item.title : existing.title\n      const nextDescription = editingScope === 'full_profile' || !existing.description ? item.description : existing.description\n      if (nextTitle !== existing.title || nextDescription !== existing.description) {\n        statements.push(c.env.DB.prepare(`UPDATE profile_gallery SET title = ?, description = ? WHERE id = ? AND profile_id = ?`).bind(nextTitle,nextDescription,existing.id,context.profileId))\n      }\n    }\n  }\n  try { if (statements.length) await c.env.DB.batch(statements) } catch {",
"api portfolio apply")

api = replace_once(api,
"  return c.json({ ok:true,data:{ applied:{ identity:applyIdentity,bio:applyBio,services_section:applyServicesSection,services:applyServices }, published:false, services_preserved:applyServices && context.services.length>0, note:",
"  return c.json({ ok:true,data:{ applied:{ identity:effectiveIdentity,bio:effectiveBio,services_section:applyServicesSection,services:effectiveServices,portfolio:applyPortfolio }, editing_scope:editingScope, published:false, services_preserved:effectiveServices && context.services.length>0, note:",
"api apply response")

# ---------- UI: editing scope + portfolio + cooldown countdown ----------
ui = replace_once(ui,
"type Service = { id?: string; title: string; description: string; has_image?: boolean }\ntype ImageSuggestion",
"type Service = { id?: string; title: string; description: string; has_image?: boolean }\ntype PortfolioItem = { id: string; title: string; description: string }\ntype EditingScope = 'missing_only' | 'full_profile'\ntype ImageSuggestion",
"ui types")

ui = replace_once(ui,
"  services: Array<{ title: string; description: string }>\n  cta:",
"  services: Array<{ title: string; description: string }>\n  portfolio: PortfolioItem[]\n  cta:",
"ui proposal portfolio")

ui = replace_once(ui,
"type Limits = { max_services: number; ai_daily_generations: number; ai_monthly_generations: number; ai_max_rounds: number }",
"type Limits = { max_services: number; max_portfolio: number; ai_daily_generations: number; ai_monthly_generations: number; ai_max_rounds: number }",
"ui limits")

ui = replace_once(ui,
"    services: Service[]\n    contact:",
"    services: Service[]\n    portfolio: PortfolioItem[]\n    contact:",
"ui context portfolio")

ui = replace_once(ui,
"type ApplySelection = { identity: boolean; bio: boolean; services_section: boolean; services: boolean }",
"type ApplySelection = { identity: boolean; bio: boolean; services_section: boolean; services: boolean; portfolio: boolean }",
"ui selection type")

ui = replace_once(ui,
"  const [selection,setSelection] = useState<ApplySelection>({ identity:true,bio:true,services_section:true,services:true })\n  const [replaceServices,setReplaceServices]",
"  const [selection,setSelection] = useState<ApplySelection>({ identity:true,bio:true,services_section:true,services:true,portfolio:true })\n  const [editingScope,setEditingScope] = useState<EditingScope>('missing_only')\n  const [cooldownSeconds,setCooldownSeconds] = useState(0)\n  const [replaceServices,setReplaceServices]",
"ui state")

ui = replace_once(ui,
"    setContext(data)\n    setSelection((s)=>({ ...s, services:(data.profile.services || []).length === 0 }))",
"    setContext(data)",
"ui load selection")

ui = replace_once(ui,
"  const hasExistingServices = Boolean(context?.profile.services?.length)\n  const channels",
"  const hasExistingServices = Boolean(context?.profile.services?.length)\n  const hasExistingPortfolio = Boolean(context?.profile.portfolio?.length)\n  const hasExistingContent = Boolean(context?.profile.professional_title || context?.profile.bio || context?.profile.services?.length || context?.profile.portfolio?.some((x)=>x.title || x.description))\n  const channels",
"ui existing content")

ui = replace_once(ui,
"  const atServiceLimit = Boolean(context && context.profile.services.length >= context.plan.limits.max_services)\n\n  async function acceptTerms()",
"  const atServiceLimit = Boolean(context && context.profile.services.length >= context.plan.limits.max_services)\n\n  useEffect(()=>{\n    if (!context) return\n    if (editingScope === 'full_profile') {\n      setSelection({ identity:true,bio:true,services_section:true,services:true,portfolio:context.profile.portfolio.length>0 })\n    } else {\n      setSelection({\n        identity:!context.profile.professional_title,\n        bio:!context.profile.bio,\n        services_section:!(context.profile.services_section_title && context.profile.services_section_description),\n        services:context.profile.services.length===0,\n        portfolio:context.profile.portfolio.some((item)=>!item.title || !item.description),\n      })\n    }\n  },[editingScope,context])\n\n  useEffect(()=>{\n    if (cooldownSeconds <= 0) return\n    const timer = window.setInterval(()=>setCooldownSeconds((value)=>Math.max(0,value-1)),1000)\n    return ()=>window.clearInterval(timer)\n  },[cooldownSeconds])\n\n  async function acceptTerms()",
"ui effects")

ui = replace_once(ui,
"      const json:any = await apiPost('/me/ai-profile-assistant/generate',{ answers, follow_up_answers:followUp, round:nextRound })\n      if (!json?.ok) { setError(json?.error || 'No pudimos preparar tu propuesta. Tu perfil no fue modificado.'); return }",
"      const json:any = await apiPost('/me/ai-profile-assistant/generate',{ answers, follow_up_answers:followUp, round:nextRound, editing_scope:editingScope })\n      if (!json?.ok) {\n        if (json?.code === 'cooldown') { setCooldownSeconds(Number(json.retry_after_seconds || 20)); setError(''); return }\n        setError(json?.error || 'No pudimos preparar tu propuesta. Tu perfil no fue modificado.'); return\n      }",
"ui generate scope cooldown")

ui = replace_once(ui,
"  function updateService(index:number,key:'title'|'description',value:string) { setProposal((p)=>p ? { ...p,services:p.services.map((s,i)=>i===index?{...s,[key]:value}:s) }:p) }\n\n  async function applyProposal()",
"  function updateService(index:number,key:'title'|'description',value:string) { setProposal((p)=>p ? { ...p,services:p.services.map((s,i)=>i===index?{...s,[key]:value}:s) }:p) }\n  function updatePortfolio(index:number,key:'title'|'description',value:string) { setProposal((p)=>p ? { ...p,portfolio:p.portfolio.map((item,i)=>i===index?{...item,[key]:value}:item) }:p) }\n\n  async function applyProposal()",
"ui portfolio update")

ui = replace_once(ui,
"      const json:any = await apiPost('/me/ai-profile-assistant/apply',{ proposal,apply:selection,replace_existing_services:replaceServices })",
"      const json:any = await apiPost('/me/ai-profile-assistant/apply',{ proposal,apply:selection,replace_existing_services:replaceServices,editing_scope:editingScope })",
"ui apply scope")

scope_block = """      {hasExistingContent && !proposal && followUp.length===0 && context && <section className=\"mt-5 rounded-[24px] border border-cyan-200 bg-white p-5 shadow-sm\">\n        <p className=\"text-xs font-black uppercase tracking-[0.12em] text-cyan-700\">Contenido existente</p>\n        <h2 className=\"mt-1 text-xl font-black\">¿Cómo quieres que te ayude la IA?</h2>\n        <div className=\"mt-4 grid gap-3\">\n          <button type=\"button\" onClick={()=>setEditingScope('missing_only')} className={`rounded-2xl border p-4 text-left ${editingScope==='missing_only'?'border-cyan-500 bg-cyan-50':'border-slate-200 bg-white'}`}><p className=\"font-black\">Completar solo lo que falta · Recomendado</p><p className=\"mt-1 text-sm font-medium leading-5 text-slate-600\">Conserva intactos los campos que ya completaste. La IA los usa como contexto y trabaja solo sobre lo pendiente.</p></button>\n          <button type=\"button\" onClick={()=>setEditingScope('full_profile')} className={`rounded-2xl border p-4 text-left ${editingScope==='full_profile'?'border-cyan-500 bg-cyan-50':'border-slate-200 bg-white'}`}><p className=\"font-black\">Revisar y mejorar mi contenido</p><p className=\"mt-1 text-sm font-medium leading-5 text-slate-600\">Puede proponerte mejoras de texto en título, presentación, trabajos y servicios. Tú revisas todo antes de aplicar.</p></button>\n        </div>\n        <p className=\"mt-3 text-xs font-semibold leading-5 text-slate-500\">Nunca modifica imágenes, enlaces, cuentas bancarias, diseño, plantilla, colores ni orden.</p>\n      </section>}\n\n"""
anchor = "      {!proposal && followUp.length===0 && context && <section className=\"mt-5 space-y-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6\">"
if ui.count(anchor) != 1:
    raise SystemExit('ERROR [ui scope block]: anchor no único; no se escribió ningún archivo.')
ui = ui.replace(anchor, scope_block + anchor, 1)

# Canonical service description editor limit in proposal review.
ui = ui.replace("e.target.value.slice(0,110)", "e.target.value.slice(0,90)")

# Add portfolio review before CTA card.
portfolio_anchor = "        <div className=\"rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm\"><p className=\"text-xs font-black uppercase text-slate-400\">Siguiente acción sugerida</p>"
portfolio_block = """        {proposal.portfolio?.length>0 && <div className=\"rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm\">\n          <div className=\"flex justify-between gap-3\"><div><p className=\"text-xs font-black uppercase tracking-[0.12em] text-cyan-700\">Mis trabajos</p><h2 className=\"mt-1 text-xl font-black\">Textos de tus fotos</h2></div><label className=\"text-xs font-black\"><input type=\"checkbox\" checked={selection.portfolio} onChange={(e)=>setSelection((s)=>({...s,portfolio:e.target.checked}))} className=\"mr-2 accent-cyan-700\"/>Aplicar</label></div>\n          <p className=\"mt-2 text-sm font-medium leading-6 text-slate-500\">Máximo 5 trabajos. Título 80 caracteres y descripción 90. Las imágenes no se reemplazan ni se reordenan.</p>\n          <div className=\"mt-4 space-y-3\">{proposal.portfolio.map((item,index)=>{ const current=context.profile.portfolio.find((x)=>x.id===item.id); const lockTitle=editingScope==='missing_only'&&Boolean(current?.title); const lockDescription=editingScope==='missing_only'&&Boolean(current?.description); return <div key={item.id} className=\"rounded-2xl border border-slate-200 bg-slate-50 p-4\"><p className=\"text-[11px] font-black uppercase text-slate-400\">Trabajo {index+1}</p><input value={lockTitle?(current?.title||''):item.title} disabled={lockTitle} onChange={(e)=>updatePortfolio(index,'title',e.target.value.slice(0,80))} maxLength={80} className=\"mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-black disabled:bg-slate-100 disabled:text-slate-500\"/>{lockTitle&&<p className=\"mt-1 text-[11px] font-bold text-emerald-700\">✓ Ya completado · se conservará</p>}<textarea value={lockDescription?(current?.description||''):item.description} disabled={lockDescription} onChange={(e)=>updatePortfolio(index,'description',e.target.value.slice(0,90))} maxLength={90} rows={2} className=\"mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 disabled:bg-slate-100 disabled:text-slate-500\"/>{lockDescription&&<p className=\"mt-1 text-[11px] font-bold text-emerald-700\">✓ Ya completado · se conservará</p>}</div>})}</div>\n        </div>}\n"""
if ui.count(portfolio_anchor) != 1:
    raise SystemExit('ERROR [ui portfolio block]: anchor no único; no se escribió ningún archivo.')
ui = ui.replace(portfolio_anchor, portfolio_block + portfolio_anchor, 1)

# Normal cooldown UI and button gating.
ui = replace_once(ui,
"      {error && <div className=\"mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold leading-6 text-rose-700\">{error}</div>}",
"      {error && <div className=\"mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold leading-6 text-rose-700\">{error}</div>}\n      {cooldownSeconds>0 && <div className=\"mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-800\">Puedes generar otra propuesta en {cooldownSeconds} s.</div>}",
"ui cooldown banner")

ui = ui.replace("disabled={generating || !enoughInformation}", "disabled={generating || !enoughInformation || cooldownSeconds>0}")
ui = ui.replace("{generating?'Preparando…':'Crear mi propuesta con IA'}", "{generating?'Preparando…':cooldownSeconds>0?`Disponible en ${cooldownSeconds} s`:'Crear mi propuesta con IA'}")
ui = ui.replace("disabled={generating} className=\"rounded-xl bg-slate-100", "disabled={generating || cooldownSeconds>0} className=\"rounded-xl bg-slate-100")
ui = ui.replace("{generating?'Generando…':'Generar otra'}", "{generating?'Generando…':cooldownSeconds>0?`Disponible en ${cooldownSeconds} s`:'Generar otra'}")

# Missing-only lock visual for identity and bio inputs in review.
ui = ui.replace("<input value={proposal.professional_title} onChange=", "<input value={editingScope==='missing_only'&&context.profile.professional_title?context.profile.professional_title:proposal.professional_title} disabled={editingScope==='missing_only'&&Boolean(context.profile.professional_title)} onChange=")
ui = ui.replace("<textarea value={proposal.bio} onChange=", "<textarea value={editingScope==='missing_only'&&context.profile.bio?context.profile.bio:proposal.bio} disabled={editingScope==='missing_only'&&Boolean(context.profile.bio)} onChange=")

# Final integrity guards.
for needle, label in [
    ("description: text(item?.description, 90)", 'service desc 90'),
    ("max_portfolio: number", 'portfolio plan limit'),
    ("editing_scope: editingScope", 'scope in model input'),
    ("UPDATE profile_gallery SET title = ?, description = ?", 'portfolio apply'),
    ("Completar solo lo que falta · Recomendado", 'scope UI'),
    ("Puedes generar otra propuesta en {cooldownSeconds} s.", 'cooldown UI'),
]:
    hay = (needle in api) or (needle in ui)
    if not hay:
        raise SystemExit(f'ERROR [integrity]: falta {label}. No se escribió ningún archivo.')

API.write_text(api)
UI.write_text(ui)
print('OK: alcance canónico, portafolio, límites y cooldown aplicados.')
print('Archivos modificados:')
print(f' - {API.relative_to(ROOT)}')
print(f' - {UI.relative_to(ROOT)}')
