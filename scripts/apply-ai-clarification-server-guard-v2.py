from pathlib import Path

p = Path('api/src/ai-profile-assistant.ts')
s = p.read_text()

old = """  const asksDefinition = /\\b(que es|que incluye|que comprende|que abarca|que significa|en que consiste|que elementos|que funcionalidades|cuales son sus elementos|cuales son sus funcionalidades)\\b/.test(normalized)\n\n  return asksDefinition && (mentionsKawvo || mentionsKawvoProfile || mentionsKawvoPresentation)\n"""

new = """  const asksDefinition = /\\b(que es|que incluye|que comprende|que abarca|que significa|en que consiste|que elementos|que funcionalidades|cuales son sus elementos|cuales son sus funcionalidades)\\b/.test(normalized)\n  const asksCatalog = /\\b(que|cuales)\\b.{0,50}\\b(productos|servicios|soluciones|herramientas|funciones|funcionalidades|modulos|opciones)\\b/.test(normalized)\n  const asksAvailability = /\\b(productos|servicios|soluciones|herramientas|funciones|funcionalidades|modulos|opciones)\\b.{0,70}\\b(disponibles|ofrece|ofrecen|incluye|incluyen|tiene|maneja)\\b/.test(normalized)\n    || /\\b(disponibles|ofrece|ofrecen|incluye|incluyen|tiene|maneja)\\b.{0,70}\\b(productos|servicios|soluciones|herramientas|funciones|funcionalidades|modulos|opciones)\\b/.test(normalized)\n  const mentionsKawvoProducts = /\\bkawvo (link|qr|flip|ia|nfc|trace|code)\\b/.test(normalized)\n\n  return (asksDefinition || asksCatalog || asksAvailability)\n    && (mentionsKawvo || mentionsKawvoProfile || mentionsKawvoPresentation || mentionsKawvoProducts)\n"""

if old not in s:
    raise SystemExit('No encontré el bloque de guard v1 esperado')

s = s.replace(old, new, 1)
p.write_text(s)

print('✓ guard ampliado: catálogo, disponibilidad y productos/servicios de Kawvo')
