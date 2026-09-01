#!/usr/bin/env python3
from pathlib import Path


def replace_once(path: str, old: str, new: str):
    p = Path(path)
    s = p.read_text()
    if new in s:
        return
    if old not in s:
        raise SystemExit(f'No encontré marcador en {path}: {old[:90]!r}')
    p.write_text(s.replace(old, new, 1))


def ensure_after(path: str, marker: str, addition: str):
    p = Path(path)
    s = p.read_text()
    if addition.strip() in s:
        return
    if marker not in s:
        raise SystemExit(f'No encontré marcador en {path}: {marker!r}')
    p.write_text(s.replace(marker, marker + addition, 1))

# API registration
replace_once(
    'api/src/index.ts',
    "import { registerDemoViralRoutes } from './routes/demo-viral'\n",
    "import { registerDemoViralRoutes } from './routes/demo-viral'\nimport { registerDemoAiRoutes } from './routes/demo-ai'\n",
)
replace_once(
    'api/src/index.ts',
    'registerDemoViralRoutes(app)\n',
    'registerDemoViralRoutes(app)\nregisterDemoAiRoutes(app)\n',
)

# Demo AI metrics must be accepted by the existing event endpoint too.
replace_once(
    'api/src/routes/demo-viral.ts',
    "  'recipient_demo_completed',\n])",
    "  'recipient_demo_completed',\n  'demo_ai_started',\n  'demo_ai_generated',\n  'demo_ai_needs_more_info',\n  'demo_ai_failed',\n  'demo_ai_completed',\n  'demo_ai_fallback',\n])",
)

# Clarification round should not be blocked by the cooldown created by the first generation.
replace_once(
    'api/src/routes/demo-ai.ts',
    'async function rateLimit(c: any, sessionKey: string, ipHash: string) {',
    'async function rateLimit(c: any, sessionKey: string, ipHash: string, round: number) {',
)
replace_once(
    'api/src/routes/demo-ai.ts',
    "  if (last) {\n    const elapsed = Math.floor((Date.now() - Date.parse(`${last.replace(' ', 'T')}Z`)) / 1000)\n    if (Number.isFinite(elapsed) && elapsed < cooldown) return { allowed: false, code: 'cooldown', retryAfter: cooldown - elapsed }\n  }",
    "  if (last && round <= 1) {\n    const elapsed = Math.floor((Date.now() - Date.parse(`${last.replace(' ', 'T')}Z`)) / 1000)\n    if (Number.isFinite(elapsed) && elapsed < cooldown) return { allowed: false, code: 'cooldown', retryAfter: cooldown - elapsed }\n  }",
)
replace_once(
    'api/src/routes/demo-ai.ts',
    'const limit = await rateLimit(c, sessionKey, ipHash).catch(() => ({ allowed: false, code: \'rate_unavailable\', retryAfter: 60 }))',
    'const limit = await rateLimit(c, sessionKey, ipHash, round).catch(() => ({ allowed: false, code: \'rate_unavailable\', retryAfter: 60 }))',
)
replace_once(
    'api/src/routes/demo-ai.ts',
    "      await insertAiEvent(c, 'demo_ai_started', sessionKey, { ip_hash: ipHash, consent_version: consentVersion, preflight: true })\n      await insertAiEvent(c, 'demo_ai_needs_more_info', sessionKey, { reason: 'deterministic_ambiguity' })",
    "      await insertAiEvent(c, 'demo_ai_needs_more_info', sessionKey, { reason: 'deterministic_ambiguity', consent_version: consentVersion })",
)

# Web route
replace_once(
    'web/src/App.tsx',
    "const KawvoLinkDemo = lazy(\n  () => import('./components/demo/KawvoLinkDemo'),\n)\n",
    "const KawvoLinkDemo = lazy(\n  () => import('./components/demo/KawvoLinkDemo'),\n)\n\nconst KawvoLinkDemoAi = lazy(\n  () => import('./components/demo/KawvoLinkDemoAi'),\n)\n",
)
replace_once(
    'web/src/App.tsx',
    "          <Route\n            path=\"/demo\"\n            element={<KawvoLinkDemo />}\n          />\n",
    "          <Route\n            path=\"/demo\"\n            element={<KawvoLinkDemo />}\n          />\n\n          <Route\n            path=\"/demo/ia\"\n            element={<KawvoLinkDemoAi />}\n          />\n",
)

# Manual demo gains an AI draft bridge but remains the same editor/renderer/share engine.
p = Path('web/src/components/demo/KawvoLinkDemo.tsx')
s = p.read_text()
if 'kawvo_demo_ai_draft_v1' not in s:
    s = s.replace(
        "type DemoForm = {\n  name: string\n  role: string\n  bio: string\n  whatsapp: string\n  instagram: string\n",
        "type DemoForm = {\n  name: string\n  role: string\n  bio: string\n  whatsapp: string\n  phone?: string\n  samePhoneAsWhatsapp?: boolean\n  instagram: string\n  email?: string\n  servicesTitle?: string\n  servicesDescription?: string\n",
        1,
    )
    s = s.replace("  const [stage, setStage] = useState<DemoStage>('sector')", "  const [stage, setStage] = useState<DemoStage>('sector')\n  const [isAiGenerated, setIsAiGenerated] = useState(false)", 1)
    s = s.replace("  const [currentSector, setCurrentSector] = useState<DemoSectorKey | null>(null)", "  const [currentSector, setCurrentSector] = useState<string | null>(null)", 1)
    marker = "    fromTokenRef.current = new URLSearchParams(window.location.search).get('from')\n"
    addition = """    const params = new URLSearchParams(window.location.search)\n    if (params.get('ai') === '1') {\n      try {\n        const raw = window.sessionStorage.getItem('kawvo_demo_ai_draft_v1')\n        const draft = raw ? JSON.parse(raw) : null\n        if (draft?.form && draft?.portrait && draft?.hero) {\n          setForm(draft.form)\n          setPortrait(draft.portrait)\n          setHero(draft.hero)\n          setCurrentSector(String(draft.assetCategory || 'demo-ai'))\n          setIsAiGenerated(true)\n          setStage('welcome')\n        }\n      } catch { /* fallback to the manual demo */ }\n    }\n"""
    if marker not in s:
        raise SystemExit('No encontré useEffect inicial de Demo')
    s = s.replace(marker, marker + addition, 1)

    old_profile = """    const instagram = normalizeInstagram(form.instagram)\n    const phone = normalizePhone(form.whatsapp)\n    return {\n      id: 'demo-local-only', slug: 'demo',\n      name: form.name.trim() || 'Tu nombre', role: form.role.trim() || 'Tu puesto / cargo',\n      personalBadge: 'Demo Kawvo Link', aboutTitle: 'Sobre mí', portfolioTitle: 'Mis trabajos',\n      servicesTitle: 'Mis servicios', servicesDescription: 'Una muestra de lo que puedo hacer por ti.',\n      bio: form.bio.trim() || 'Aquí aparecerá una descripción breve sobre ti o tu negocio.', phone,\n      whatsappGreetingName: form.name.trim() || 'Hola', whatsappCtaLabel: 'Hablar por WhatsApp', instagram,\n      location: DEFAULT_LOCATION, portrait, hero, heroPositionX: 50, heroPositionY: 50, heroZoom: 1,\n      category: 'Demo', vcardFileName: 'kawvo-demo.vcf',\n      quickActions: [\n        ...(phone ? [{ type: 'call' as const, label: 'Llamar', url: `tel:+${phone}` }] : []),\n        ...(instagram ? [{ type: 'instagram' as const, label: 'Instagram', url: `https://instagram.com/${instagram}` }] : []),\n        { type: 'location' as const, label: 'Ubicación', url: DEFAULT_MAP_URL },\n      ],\n      services: form.services, portfolio: form.portfolio, customLinks: [],\n    }\n  }, [form, portrait, hero])"""
    new_profile = """    const instagram = normalizeInstagram(form.instagram)\n    const whatsapp = normalizePhone(form.whatsapp)\n    const phone = isAiGenerated\n      ? normalizePhone(form.samePhoneAsWhatsapp === false ? (form.phone || '') : form.whatsapp)\n      : normalizePhone(form.whatsapp)\n    const email = String(form.email || '').trim().slice(0, 120)\n    const quickActions = [\n      ...(phone ? [{ type: 'call' as const, label: 'Llamar', url: `tel:+${phone}` }] : []),\n      ...(instagram ? [{ type: 'instagram' as const, label: 'Instagram', url: `https://instagram.com/${instagram}` }] : []),\n      ...(email ? [{ type: 'email' as const, label: 'Correo', url: `mailto:${email}` }] : []),\n      ...(!isAiGenerated ? [{ type: 'location' as const, label: 'Ubicación', url: DEFAULT_MAP_URL }] : []),\n    ].slice(0, 3)\n    return {\n      id: 'demo-local-only', slug: 'demo',\n      name: form.name.trim() || 'Tu nombre', role: form.role.trim() || 'Tu puesto / cargo',\n      personalBadge: 'Demo Kawvo Link', aboutTitle: 'Sobre mí', portfolioTitle: 'Mis trabajos',\n      servicesTitle: form.servicesTitle?.trim() || 'Mis servicios', servicesDescription: form.servicesDescription?.trim() || 'Una muestra de lo que puedo hacer por ti.',\n      bio: form.bio.trim() || 'Aquí aparecerá una descripción breve sobre ti o tu negocio.', phone: phone || whatsapp,\n      whatsappGreetingName: form.name.trim() || 'Hola', whatsappCtaLabel: 'Hablar por WhatsApp', instagram,\n      location: isAiGenerated ? '' : DEFAULT_LOCATION, portrait, hero, heroPositionX: 50, heroPositionY: 50, heroZoom: 1,\n      category: isAiGenerated ? (currentSector || 'Demo') : 'Demo', vcardFileName: 'kawvo-demo.vcf',\n      quickActions,\n      services: form.services, portfolio: form.portfolio, customLinks: [],\n    }\n  }, [form, portrait, hero, isAiGenerated, currentSector])"""
    if old_profile not in s:
        raise SystemExit('No encontré construcción original del profile Demo')
    s = s.replace(old_profile, new_profile, 1)

    s = s.replace(
        "    setCurrentSector(null)\n    setShareStatus('idle')",
        "    setCurrentSector(null)\n    setIsAiGenerated(false)\n    try { window.sessionStorage.removeItem('kawvo_demo_ai_draft_v1') } catch {}\n    setShareStatus('idle')",
        1,
    )
    s = s.replace(
        "      postDemoEvent({ event_type: 'demo_completed', ...baseEvent })\n      if (fromTokenRef.current)",
        "      postDemoEvent({ event_type: 'demo_completed', ...baseEvent })\n      if (isAiGenerated) postDemoEvent({ event_type: 'demo_ai_completed', ...baseEvent })\n      if (fromTokenRef.current)",
        1,
    )
    s = s.replace(
        "          <span className=\"kawvo-demo-pill\">ELIGE UN EJEMPLO</span>",
        "          <a href=\"/demo/ia\" className=\"kawvo-demo-ai-entry\">✨ Crear mi demo con IA</a>\n          <span className=\"kawvo-demo-pill\">O ELIGE UN EJEMPLO</span>",
        1,
    )
    s = s.replace(
        "          <button type=\"button\" onClick={() => setStage('edit')}>Pruébalo con tus datos</button>",
        "          <button type=\"button\" onClick={() => setStage('edit')}>{isAiGenerated ? 'Ajustar mi demo' : 'Pruébalo con tus datos'}</button>",
        1,
    )
    s = s.replace(
        "          <label><span>WhatsApp</span><input inputMode=\"tel\" maxLength={20} value={form.whatsapp} onChange={(event) => update('whatsapp', event.target.value)} /></label>\n          <label><span>Instagram</span><input maxLength={50} value={form.instagram} onChange={(event) => update('instagram', event.target.value)} /></label>",
        "          <label><span>WhatsApp</span><input inputMode=\"tel\" maxLength={20} value={form.whatsapp} onChange={(event) => update('whatsapp', event.target.value)} /></label>\n          {isAiGenerated && <label className=\"kawvo-demo-inline-check\"><input type=\"checkbox\" checked={form.samePhoneAsWhatsapp !== false} onChange={(event) => update('samePhoneAsWhatsapp', event.target.checked)} /><span>Usar este mismo número para llamadas</span></label>}\n          {isAiGenerated && form.samePhoneAsWhatsapp === false && <label><span>Teléfono para llamadas</span><input inputMode=\"tel\" maxLength={20} value={form.phone || ''} onChange={(event) => update('phone', event.target.value)} /></label>}\n          <label><span>Instagram</span><input maxLength={50} value={form.instagram} onChange={(event) => update('instagram', event.target.value)} /></label>\n          {isAiGenerated && <label><span>Correo</span><input type=\"email\" maxLength={120} value={form.email || ''} onChange={(event) => update('email', event.target.value)} /></label>}",
        1,
    )
    p.write_text(s)

# Demo CSS entry CTA and inline checkbox.
css = Path('web/src/components/demo/KawvoLinkDemo.css')
css_text = css.read_text()
addition = """\n.kawvo-demo-ai-entry{display:block;text-decoration:none;text-align:center;background:linear-gradient(135deg,#0f172a,#155e75);color:#fff;border-radius:18px;padding:16px 18px;margin:0 0 18px;font-weight:900;font-size:16px;box-shadow:0 14px 30px rgba(15,23,42,.16)}\n.kawvo-demo-inline-check{display:flex!important;align-items:center;gap:9px}.kawvo-demo-inline-check input{width:18px!important;height:18px}.kawvo-demo-inline-check span{margin:0!important}\n"""
if '.kawvo-demo-ai-entry{' not in css_text:
    css.write_text(css_text + addition)

# Social card recognizes /demo/ia without changing existing /demo card.
mid = Path('functions/_middleware.ts')
mid_text = mid.read_text()
if "url.pathname === '/demo/ia'" not in mid_text:
    marker = "  // Card específica de la demo interactiva.\n"
    card = """  if (url.pathname === '/demo/ia' || url.pathname === '/demo/ia/') {\n    return injectSimpleSocialCard({\n      title: 'Crea una Demo personalizada con IA | Kawvo Link',\n      description: 'Dinos a qué te dedicas y Kawvo prepara en segundos una propuesta de cómo podría verse tu Perfil Digital.',\n      image: `${url.origin}/assets/og/kawvo-link-og.png`,\n      canonicalUrl: `${url.origin}/demo/ia`,\n    })\n  }\n\n"""
    if marker not in mid_text:
        raise SystemExit('No encontré marcador de social card Demo')
    mid.write_text(mid_text.replace(marker, card + marker, 1))

# Configurable, non-secret guardrails. Merely committed; Production is not deployed by this work.
for config in ['api/wrangler.preview.toml', 'api/wrangler.toml']:
    cp = Path(config)
    text = cp.read_text()
    if 'DEMO_AI_ENABLED' not in text:
        marker = 'AI_PROFILE_COOLDOWN_SECONDS = "20"\n'
        values = 'DEMO_AI_ENABLED = "1"\nDEMO_AI_SESSION_LIMIT = "3"\nDEMO_AI_IP_LIMIT = "20"\nDEMO_AI_COOLDOWN_SECONDS = "12"\nDEMO_AI_TIMEOUT_MS = "20000"\n'
        if marker not in text:
            raise SystemExit(f'No encontré variables IA en {config}')
        cp.write_text(text.replace(marker, marker + values, 1))

print('✓ Demo IA integrada: endpoint público protegido + wizard + renderer/editor/viralidad existentes')
print('✓ Sin migración nueva: límites y métricas reutilizan demo_events; snapshots reutilizan infraestructura existente')
