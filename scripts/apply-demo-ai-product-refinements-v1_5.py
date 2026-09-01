from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    s = p.read_text()
    if old not in s:
        raise SystemExit(f'No encontré patrón esperado en {path}: {old[:100]!r}')
    p.write_text(s.replace(old, new, 1))

# 1) IA: voz editorial sin usar el nombre, siempre 3 servicios sin inventar capacidades.
replace_once(
    'api/src/routes/demo-ai.ts',
    "  'Nunca cambies el nombre dado por la persona. Si professional_title está vacío, propón uno seguro basado únicamente en la actividad y explicación confirmadas.',\n",
    "  'Nunca cambies el nombre dado por la persona. Si professional_title está vacío, propón uno seguro basado únicamente en la actividad y explicación confirmadas.',\n"
    "  'VOZ DEL PERFIL: no uses display_name ni el nombre de la persona o negocio dentro de bio, títulos o descripciones. Redacta en primera persona plural o voz profesional natural: trabajamos, realizamos, ofrecemos, ayudamos, según corresponda. Evita fórmulas como Juan realiza, María ofrece o [nombre] se dedica a.',\n",
)
replace_once(
    'api/src/routes/demo-ai.ts',
    "  'Extrae hasta 3 servicios de lo que la persona dijo que hace. No llenes cupos inventando.',\n",
    "  'Devuelve exactamente 3 servicios. Si el usuario menciona solo una o dos especializaciones, divide y presenta distintos servicios o enfoques que estén directamente contenidos en los hechos confirmados; no agregues una capacidad nueva solo para completar el tercero.',\n",
)
replace_once(
    'api/src/routes/demo-ai.ts',
    "  if (!professionalTitle || !bio || !sectionTitle || services.length < 1) return null\n",
    "  if (!professionalTitle || !bio || !sectionTitle || services.length !== 3) return null\n",
)

# 2) Banco: seleccionado por defecto y explicación mucho más clara.
replace_once(
    'web/src/components/demo/KawvoLinkDemoAi.tsx',
    "  const [includeBankDemo, setIncludeBankDemo] = useState(false)\n",
    "  const [includeBankDemo, setIncludeBankDemo] = useState(true)\n",
)
replace_once(
    'web/src/components/demo/KawvoLinkDemoAi.tsx',
    "          <label className=\"kawvo-demo-ai-check kawvo-demo-ai-bank-option\"><input type=\"checkbox\" checked={includeBankDemo} onChange={(event) => setIncludeBankDemo(event.target.checked)} /><span><strong>Incluir ejemplo de cuentas bancarias</strong><small>Mostraremos una cuenta ficticia para que veas cómo luce esta sección.</small></span></label>",
    "          <label className=\"kawvo-demo-ai-check kawvo-demo-ai-bank-option\"><input type=\"checkbox\" checked={includeBankDemo} onChange={(event) => setIncludeBankDemo(event.target.checked)} /><span><strong>Mostrar cómo se verían tus datos bancarios</strong><small>Incluiremos una cuenta ficticia para que veas este beneficio del Perfil Digital. Puedes quitarla si no quieres mostrar el ejemplo.</small></span></label>",
)

# 3) Demo final/editor: eliminar Ajustar, CTA comercial nuevo.
replace_once(
    'web/src/components/demo/KawvoLinkDemo.tsx',
    "          <button type=\"button\" onClick={() => setStage('edit')}>{isAiGenerated ? 'Ajustar mi demo' : 'Personalizar con mis datos'}</button>",
    "          <button type=\"button\" onClick={() => setStage('edit')}>{isAiGenerated ? 'Personalizar mi demo' : 'Personalizar con mis datos'}</button>",
)
replace_once(
    'web/src/components/demo/KawvoLinkDemo.tsx',
    "            Quiero mi Perfil Digital\n",
    "            Me interesa quiero mi Perfil\n",
)

# 4) Banco visual: solo últimos 4 dígitos visibles y sin aviso en el perfil final.
p = Path('web/src/components/demo/DemoBankAccounts.tsx')
s = p.read_text()
s = s.replace("const DEMO_NUMBER = '123456789'\n", "const DEMO_NUMBER = '123456789'\nconst DEMO_MASKED = `•••• ${DEMO_NUMBER.slice(-4)}`\n")
s = s.replace('<code>{DEMO_NUMBER}</code>', '<code>{DEMO_MASKED}</code>')
s = s.replace('<small>Cédula/RNC de ejemplo · {DEMO_NUMBER}</small>', '<small>Cédula/RNC de ejemplo · {DEMO_MASKED}</small>')
old_note = '''\n      <div className="kawvo-demo-bank-note">\n        <strong>Solo es un ejemplo.</strong>\n        <span>Por razones de seguridad, esta sección no es editable dentro de la Demo.</span>\n      </div>'''
if old_note not in s:
    raise SystemExit('No encontré aviso bancario final para retirar')
s = s.replace(old_note, '')
p.write_text(s)

# 5) Demo compartida: CTA neutro único; IA sigue siendo el destino predeterminado.
replace_once(
    'web/src/components/demo/KawvoLinkDemoShared.tsx',
    "        <button type=\"button\" onClick={() => navigate('/demo/ia')}>Crear mi demo con IA</button>",
    "        <button type=\"button\" onClick={() => navigate('/demo/ia')}>Crear mi demo</button>",
)
replace_once(
    'web/src/components/demo/KawvoLinkDemoShared.tsx',
    "        <button type=\"button\" onClick={startOwnDemo}>Crear mi demo con IA</button>\n        <button type=\"button\" className=\"kawvo-demo-shared-secondary\" onClick={() => navigate(`/demo?manual=1&from=${encodeURIComponent(token)}`)}>Hacerla sin IA</button>\n        <small>Sin registro. Cuéntanos lo esencial y Kawvo prepara una propuesta para ti.</small>",
    "        <button type=\"button\" onClick={startOwnDemo}>Crear mi demo</button>\n        <small>Sin registro. Cuéntanos lo esencial y Kawvo prepara una propuesta para ti.</small>",
)

# 6) Landing IA: alternativa manual discreta y con wording solicitado.
replace_once(
    'web/src/components/demo/KawvoLinkDemoAi.tsx',
    "          <a href=\"/demo?manual=1\" aria-label=\"Volver a la Demo tradicional\">←</a>\n          <span>Demo con IA · Beta</span>",
    "          <a href=\"/demo?manual=1\" className=\"kawvo-demo-ai-manual-link\">Probar sin IA</a>\n          <span>Demo con IA · Beta</span>",
)
replace_once(
    'web/src/components/demo/KawvoLinkDemoAi.tsx',
    ">Continuar sin IA</button>",
    ">Probar sin IA</button>",
)
# second occurrence if present
p = Path('web/src/components/demo/KawvoLinkDemoAi.tsx')
s = p.read_text().replace('>Continuar sin IA</button>', '>Probar sin IA</button>')
p.write_text(s)

with open('web/src/components/demo/KawvoLinkDemoAi.css', 'a') as f:
    f.write("\n/* Demo IA V1.5 */\n.kawvo-demo-ai-manual-link{font-size:11px!important;font-weight:700!important;color:#94a3b8!important;text-decoration:underline;text-underline-offset:3px;white-space:nowrap}\n")

print('✓ Demo IA V1.5: banco visible por defecto, voz correcta, 3 servicios, masking y CTA simplificados')
