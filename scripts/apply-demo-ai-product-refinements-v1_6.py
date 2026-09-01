from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    s = p.read_text()
    if old not in s:
        raise SystemExit(f'No encontré patrón esperado en {path}: {old[:120]!r}')
    p.write_text(s.replace(old, new, 1))

# 1) CTA bancario: explicar claramente que se trata de datos para recibir transferencias.
replace_once(
    'web/src/components/demo/KawvoLinkDemoAi.tsx',
    '<strong>Mostrar cómo se verían tus datos bancarios</strong><small>Incluiremos una cuenta ficticia para que veas este beneficio del Perfil Digital. Puedes quitarla si no quieres mostrar el ejemplo.</small>',
    '<strong>Mostrar cómo se verían tus datos para recibir transferencias</strong><small>Incluiremos un ejemplo ficticio de cuenta bancaria y cédula/RNC para que veas cómo tus clientes podrían consultar los datos necesarios para pagarte. Puedes quitar este ejemplo si no quieres mostrarlo.</small>',
)

# 2) Demo propia: Compartir / Copiar enlace / Código QR deben verse, pero no ejecutar acciones.
replace_once(
    'web/src/components/demo/KawvoLinkDemo.tsx',
    "  function blockDemoFooterNavigation(event: React.MouseEvent<HTMLDivElement>) {\n    const target = event.target as HTMLElement\n    if (target.closest('.ilx-footer a')) {\n      event.preventDefault()\n      event.stopPropagation()\n    }\n  }",
    "  function blockDemoFooterNavigation(event: React.MouseEvent<HTMLDivElement>) {\n    const target = event.target as HTMLElement\n    if (target.closest('.ilx-footer a') || target.closest('.ilx-share button')) {\n      event.preventDefault()\n      event.stopPropagation()\n    }\n  }",
)
replace_once(
    'web/src/components/demo/KawvoLinkDemo.tsx',
    "      <style>{`.kawvo-demo-preview .ilx-footer a { pointer-events: none; cursor: default; opacity: .72; }`}</style>",
    "      <style>{`.kawvo-demo-preview .ilx-footer a { pointer-events: none; cursor: default; opacity: .72; } .kawvo-demo-preview .ilx-share button { pointer-events: none; cursor: default; opacity: .58; }`}</style>",
)

# 3) Demo recibida: los mismos controles siguen siendo solo demostrativos.
replace_once(
    'web/src/components/demo/KawvoLinkDemoShared.tsx',
    "        const anchor = target.closest('a[href]') as HTMLAnchorElement | null\n\n        if (!anchor) return\n\n        const href = (anchor.getAttribute('href') || '').trim()\n\n        if (href && !href.startsWith('#') && !href.startsWith('/')) {\n          event.preventDefault()\n          event.stopPropagation()\n        }",
    "        const shareButton = target.closest('.ilx-share button')\n        if (shareButton) {\n          event.preventDefault()\n          event.stopPropagation()\n          return\n        }\n\n        const anchor = target.closest('a[href]') as HTMLAnchorElement | null\n        if (!anchor) return\n\n        const href = (anchor.getAttribute('href') || '').trim()\n\n        if (href && !href.startsWith('#') && !href.startsWith('/')) {\n          event.preventDefault()\n          event.stopPropagation()\n        }",
)
replace_once(
    'web/src/components/demo/KawvoLinkDemoShared.tsx',
    '<div className="kawvo-demo-shared-preview" onClickCapture={(event) => {',
    '<div className="kawvo-demo-shared-preview" style={{ [\'--demo-share-opacity\' as string]: .58 }} onClickCapture={(event) => {',
)

with open('web/src/components/demo/KawvoLinkDemoShared.css', 'a') as f:
    f.write("\n/* Demo V1.6: controles de compartir visibles solo como demostración */\n.kawvo-demo-shared-preview .ilx-share button{pointer-events:none!important;cursor:default!important;opacity:var(--demo-share-opacity,.58)!important}\n")

print('✓ Demo IA V1.6: compartir/QR/copiar enlace quedan solo demostrativos y CTA bancario aclarado')
