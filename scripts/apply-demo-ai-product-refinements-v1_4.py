from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    s = p.read_text()
    if old not in s:
        raise SystemExit(f'No encontré patrón esperado en {path}: {old[:90]!r}')
    s = s.replace(old, new, 1)
    p.write_text(s)

# 1) Copy más creativo sin inventar hechos.
replace_once(
    'api/src/routes/demo-ai.ts',
    "  'Extrae hasta 3 servicios de lo que la persona dijo que hace. No llenes cupos inventando.',\n",
    "  'Extrae hasta 3 servicios de lo que la persona dijo que hace. No llenes cupos inventando.',\n"
    "  'REDACCIÓN DE SERVICIOS: no copies ni parafrasees mecánicamente la frase del usuario. Usa conocimiento general del sector para transformar el hecho confirmado en una presentación más atractiva, concreta y orientada al cliente, sin agregar capacidades no mencionadas.',\n"
    "  'Cada descripción de servicio debe explicar para qué le sirve al cliente, qué situación atiende o qué valor práctico aporta. Debe sentirse redactada, no transcrita. Evita repetir el título del servicio o las mismas palabras de work_description cuando puedas expresarlo mejor sin cambiar el hecho.',\n"
    "  'Puedes aportar variedad de vocabulario, ritmo y enfoque comercial a partir de hechos confirmados. Creatividad editorial sí; hechos nuevos, promesas o servicios nuevos no.',\n"
)

# 2) Wizard: normalización RD + banco demo + continuidad viral.
replace_once(
    'web/src/components/demo/KawvoLinkDemoAi.tsx',
    "function normalizePhone(value: string) {\n  return value.replace(/\\D/g, '').slice(0, 15)\n}\n",
    "function normalizePhone(value: string) {\n  const digits = value.replace(/\\D/g, '').slice(0, 15)\n  if (digits.length === 10) return `1${digits}`\n  if (digits.length === 11 && digits.startsWith('1')) return digits\n  return digits\n}\n",
)
replace_once(
    'web/src/components/demo/KawvoLinkDemoAi.tsx',
    "  contact: ContactForm\n}) {",
    "  contact: ContactForm\n  includeBankDemo: boolean\n}) {",
)
replace_once(
    'web/src/components/demo/KawvoLinkDemoAi.tsx',
    "    assetCategory: data.asset_category,\n    portrait: imageAt(1),",
    "    assetCategory: data.asset_category,\n    bankDemo: input.includeBankDemo,\n    portrait: imageAt(1),",
)
replace_once(
    'web/src/components/demo/KawvoLinkDemoAi.tsx',
    "  const [consent, setConsent] = useState(false)\n",
    "  const [consent, setConsent] = useState(false)\n  const [includeBankDemo, setIncludeBankDemo] = useState(false)\n",
)
replace_once(
    'web/src/components/demo/KawvoLinkDemoAi.tsx',
    "      const draft = buildDraft(data.demo, { name, activity, role, contact })\n      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))\n      window.location.assign('/demo?ai=1')",
    "      const draft = buildDraft(data.demo, { name, activity, role, contact, includeBankDemo })\n      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))\n      const from = new URLSearchParams(window.location.search).get('from')\n      window.location.assign(`/demo?ai=1${from ? `&from=${encodeURIComponent(from)}` : ''}`)",
)
replace_once(
    'web/src/components/demo/KawvoLinkDemoAi.tsx',
    "    window.location.assign('/demo?manual=1')\n",
    "    const from = new URLSearchParams(window.location.search).get('from')\n    window.location.assign(`/demo?manual=1${from ? `&from=${encodeURIComponent(from)}` : ''}`)\n",
)
replace_once(
    'web/src/components/demo/KawvoLinkDemoAi.tsx',
    "          <label><span>WhatsApp</span><input inputMode=\"tel\" maxLength={20} value={contact.whatsapp} onChange={(event) => setContact({ ...contact, whatsapp: event.target.value })} placeholder=\"809-000-0000\" /></label>",
    "          <label><span>WhatsApp</span><input inputMode=\"tel\" maxLength={20} value={contact.whatsapp} onChange={(event) => setContact({ ...contact, whatsapp: event.target.value })} placeholder=\"809-000-0000\" /><small>Lo mostraremos con el código +1.</small></label>",
)
replace_once(
    'web/src/components/demo/KawvoLinkDemoAi.tsx',
    "          <label><span>Correo <small>Opcional</small></span><input type=\"email\" maxLength={120} value={contact.email} onChange={(event) => setContact({ ...contact, email: event.target.value })} placeholder=\"correo@dominio.com\" /></label>\n\n          <div className=\"kawvo-demo-ai-consent\">",
    "          <label><span>Correo <small>Opcional</small></span><input type=\"email\" maxLength={120} value={contact.email} onChange={(event) => setContact({ ...contact, email: event.target.value })} placeholder=\"correo@dominio.com\" /></label>\n\n          <label className=\"kawvo-demo-ai-check kawvo-demo-ai-bank-option\"><input type=\"checkbox\" checked={includeBankDemo} onChange={(event) => setIncludeBankDemo(event.target.checked)} /><span><strong>Incluir ejemplo de cuentas bancarias</strong><small>Mostraremos una cuenta ficticia para que veas cómo luce esta sección.</small></span></label>\n\n          <div className=\"kawvo-demo-ai-consent\">",
)

# 3) Demo editor: IA predeterminada, textos, banco ejemplo y CTA flotante.
replace_once(
    'web/src/components/demo/KawvoLinkDemo.tsx',
    "import IntapLinkGratisProfile from '../free-profile/IntapLinkGratisProfile'\n",
    "import IntapLinkGratisProfile from '../free-profile/IntapLinkGratisProfile'\nimport DemoBankAccounts from './DemoBankAccounts'\n",
)
replace_once(
    'web/src/components/demo/KawvoLinkDemo.tsx',
    "  const [isAiGenerated, setIsAiGenerated] = useState(false)\n",
    "  const [isAiGenerated, setIsAiGenerated] = useState(false)\n  const [showBankDemo, setShowBankDemo] = useState(false)\n",
)
replace_once(
    'web/src/components/demo/KawvoLinkDemo.tsx',
    "    const params = new URLSearchParams(window.location.search)\n    if (params.get('ai') === '1') {",
    "    const params = new URLSearchParams(window.location.search)\n    if (params.get('ai') !== '1' && params.get('manual') !== '1') {\n      const from = params.get('from')\n      window.location.replace(`/demo/ia${from ? `?from=${encodeURIComponent(from)}` : ''}`)\n      return\n    }\n    if (params.get('ai') === '1') {",
)
replace_once(
    'web/src/components/demo/KawvoLinkDemo.tsx',
    "          setCurrentSector(String(draft.assetCategory || 'demo-ai'))\n          setIsAiGenerated(true)\n",
    "          setCurrentSector(String(draft.assetCategory || 'demo-ai'))\n          setShowBankDemo(draft.bankDemo === true)\n          setIsAiGenerated(true)\n",
)
replace_once(
    'web/src/components/demo/KawvoLinkDemo.tsx',
    "    setCurrentSector(null)\n    setIsAiGenerated(false)\n    try { window.sessionStorage.removeItem('kawvo_demo_ai_draft_v1') } catch {}\n    setShareStatus('idle')",
    "    setCurrentSector(null)\n    setIsAiGenerated(false)\n    setShowBankDemo(false)\n    try { window.sessionStorage.removeItem('kawvo_demo_ai_draft_v1') } catch {}\n    setShareStatus('idle')",
)
replace_once(
    'web/src/components/demo/KawvoLinkDemo.tsx',
    "        colors: PALETTES[form.palette],\n      }",
    "        colors: PALETTES[form.palette],\n        bankDemo: showBankDemo,\n      }",
)
replace_once(
    'web/src/components/demo/KawvoLinkDemo.tsx',
    "      <IntapLinkGratisProfile profile={profile} layout={form.layout} colors={PALETTES[form.palette]} />\n    </div>",
    "      <IntapLinkGratisProfile profile={profile} layout={form.layout} colors={PALETTES[form.palette]} />\n      {showBankDemo && <DemoBankAccounts holderName={form.name.trim() || 'Tu nombre'} />}\n    </div>",
)
for old, new in [
    ('Pruébalo con tus datos', 'Personalizar con mis datos'),
    ('Personalízalo en vivo', 'Edita tu Perfil Demo'),
    ('Seguir probando', 'Personalizar mi demo'),
]:
    p = Path('web/src/components/demo/KawvoLinkDemo.tsx')
    s = p.read_text()
    if old not in s: raise SystemExit(f'No encontré copy {old}')
    p.write_text(s.replace(old, new))
replace_once(
    'web/src/components/demo/KawvoLinkDemo.tsx',
    "          <button type=\"button\" className=\"kawvo-demo-finish\" onClick={finishDemo}>Ver cómo quedó</button>",
    "          <button type=\"button\" className=\"kawvo-demo-finish kawvo-demo-finish-floating\" onClick={finishDemo}>Ver cómo quedó</button>",
)

# 4) Demo compartida: CTA principal entra directo a IA; alternativa manual explícita; banco persiste.
replace_once(
    'web/src/components/demo/KawvoLinkDemoShared.tsx',
    "import IntapLinkGratisProfile from '../free-profile/IntapLinkGratisProfile'\n",
    "import IntapLinkGratisProfile from '../free-profile/IntapLinkGratisProfile'\nimport DemoBankAccounts from './DemoBankAccounts'\n",
)
replace_once(
    'web/src/components/demo/KawvoLinkDemoShared.tsx',
    "    colors?: FreeProfileAppearanceColors\n  }",
    "    colors?: FreeProfileAppearanceColors\n    bankDemo?: boolean\n  }",
)
replace_once(
    'web/src/components/demo/KawvoLinkDemoShared.tsx',
    "    navigate(`/demo?from=${encodeURIComponent(token)}`)\n",
    "    navigate(`/demo/ia?from=${encodeURIComponent(token)}`)\n",
)
replace_once(
    'web/src/components/demo/KawvoLinkDemoShared.tsx',
    "        <IntapLinkGratisProfile\n          profile={profile}\n          layout={data.snapshot.layout}\n          colors={data.snapshot.colors}\n        />",
    "        <IntapLinkGratisProfile\n          profile={profile}\n          layout={data.snapshot.layout}\n          colors={data.snapshot.colors}\n        />\n        {data.snapshot.bankDemo && <DemoBankAccounts holderName={profile.name || 'Perfil Demo'} />}",
)
replace_once(
    'web/src/components/demo/KawvoLinkDemoShared.tsx',
    "        <button type=\"button\" onClick={startOwnDemo}>Haz tu propia demo</button>\n        <small>Sin registro. Elige tu profesión, personalízalo y mira el resultado al instante.</small>",
    "        <button type=\"button\" onClick={startOwnDemo}>Crear mi demo con IA</button>\n        <button type=\"button\" className=\"kawvo-demo-shared-secondary\" onClick={() => navigate(`/demo?manual=1&from=${encodeURIComponent(token)}`)}>Hacerla sin IA</button>\n        <small>Sin registro. Cuéntanos lo esencial y Kawvo prepara una propuesta para ti.</small>",
)
replace_once(
    'web/src/components/demo/KawvoLinkDemoShared.tsx',
    "        <button type=\"button\" onClick={() => navigate('/demo')}>Probar con mi profesión</button>",
    "        <button type=\"button\" onClick={() => navigate('/demo/ia')}>Crear mi demo con IA</button>",
)

# 5) CSS: botón flotante, opción bancaria y secundaria compartida.
with open('web/src/components/demo/KawvoLinkDemo.css', 'a') as f:
    f.write("\n/* Demo IA V1.4 */\n.kawvo-demo-finish-floating{position:fixed!important;right:18px;bottom:18px;z-index:80;box-shadow:0 16px 36px rgba(15,23,42,.22);width:auto!important;min-width:170px}\n@media(max-width:720px){.kawvo-demo-finish-floating{left:16px;right:16px;bottom:14px;width:calc(100% - 32px)!important}}\n")
with open('web/src/components/demo/KawvoLinkDemoAi.css', 'a') as f:
    f.write("\n.kawvo-demo-ai-bank-option{align-items:flex-start!important;padding:14px;border:1px solid #dbe4ee;border-radius:16px;background:#f8fafc}.kawvo-demo-ai-bank-option span{display:grid;gap:3px}.kawvo-demo-ai-bank-option small{font-weight:600;color:#64748b;line-height:1.35}\n")
with open('web/src/components/demo/KawvoLinkDemoShared.css', 'a') as f:
    f.write("\n.kawvo-demo-shared-cta .kawvo-demo-shared-secondary{margin-top:8px;background:#fff;color:#334155;border:1px solid #cbd5e1}\n")

print('✓ Demo IA V1.4: copy más creativo, CTA flotante, +1, IA predeterminada y banco demo')
