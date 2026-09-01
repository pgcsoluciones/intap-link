from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    s = p.read_text()
    if old not in s:
        raise SystemExit(f'No encontré patrón esperado en {path}: {old[:120]!r}')
    p.write_text(s.replace(old, new, 1))

# 1) CTA comercial: agregar la coma solicitada.
replace_once(
    'web/src/components/demo/KawvoLinkDemo.tsx',
    'Me interesa quiero mi Perfil',
    'Me interesa, quiero mi Perfil',
)

# 2) La alternativa manual no debe competir visualmente con "Demo con IA · Beta".
# Se retira del encabezado y se deja al final de la experiencia como opción discreta.
replace_once(
    'web/src/components/demo/KawvoLinkDemoAi.tsx',
    '          <a href="/demo?manual=1" className="kawvo-demo-ai-manual-link">Probar sin IA</a>\n          <span>Demo con IA · Beta</span>',
    '          <span>Demo con IA · Beta</span>',
)
replace_once(
    'web/src/components/demo/KawvoLinkDemoAi.tsx',
    '        {error && <div className="kawvo-demo-ai-error" role="alert">{error}</div>}\n        <p className="kawvo-demo-ai-foot">No crea una cuenta ni publica un perfil.</p>',
    '        {error && <div className="kawvo-demo-ai-error" role="alert">{error}</div>}\n        <p className="kawvo-demo-ai-foot">No crea una cuenta ni publica un perfil.</p>\n        <button type="button" className="kawvo-demo-ai-secondary kawvo-demo-ai-manual-bottom" onClick={fallback}>Probar sin IA</button>',
)

print('✓ Demo IA V1.7: coma en CTA comercial y alternativa sin IA movida al final')
