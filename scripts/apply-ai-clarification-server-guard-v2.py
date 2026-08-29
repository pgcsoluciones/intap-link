from pathlib import Path

p = Path('api/src/ai-profile-assistant.ts')
s = p.read_text()

old = """  const asksDefinition = /\\b(que es|que incluye|que comprende|que abarca|que significa|en que consiste|que elementos|que funcionalidades|cuales son sus elementos|cuales son sus funcionalidades)\\b/.test(normalized)\n\n  return asksDefinition && (mentionsKawvo || mentionsKawvoProfile || mentionsKawvoPresentation)\n"""

new = """  const asksDefinition = /\\b(que es|que incluye|que comprende|que abarca|que significa|en que consiste|que elementos|que funcionalidades|cuales son sus elementos|cuales son sus funcionalidades)\\b/.test(normalized)\n\n  // No bloquear preguntas legítimas sobre decisiones, preferencias o actividad concreta del usuario.\n  const asksUserChoice = /\\b(quieres|deseas|prefieres|preferirias|priorizar|destacar|promocionar|impulsar|enfocar)\\b/.test(normalized)\n  const asksUserSpecificOffering = /\\b(ofreces|vendes|usas|implementas|comercializas|manejas|trabajas con)\\b/.test(normalized)\n  if (asksUserChoice || asksUserSpecificOffering) return false\n\n  const platformCatalogTerms = '(productos|servicios|soluciones|herramientas|funciones|funcionalidades|modulos|opciones)'\n\n  // Preguntas donde el sujeto real es Kawvo/plataforma, no el negocio del usuario.\n  const asksPlatformCatalog = new RegExp(`\\b(que|cuales)\\b.{0,60}\\b${platformCatalogTerms}\\b.{0,90}\\b(de kawvo|kawvo)\\b`).test(normalized)\n    || new RegExp(`\\bkawvo\\b.{0,90}\\b(que|cuales)\\b.{0,60}\\b${platformCatalogTerms}\\b`).test(normalized)\n\n  const asksPlatformAvailability = new RegExp(`\\b${platformCatalogTerms}\\b.{0,100}\\b(de kawvo|kawvo)\\b.{0,100}\\b(disponibles|ofrece|ofrecen|incluye|incluyen|tiene|maneja)\\b`).test(normalized)\n    || new RegExp(`\\b(disponibles|ofrece|ofrecen|incluye|incluyen|tiene|maneja)\\b.{0,100}\\b${platformCatalogTerms}\\b.{0,100}\\b(de kawvo|kawvo)\\b`).test(normalized)\n\n  const mentionsKawvoProducts = /\\bkawvo (link|qr|flip|ia|nfc|trace|code)\\b/.test(normalized)\n  const asksPlatformExpansion = mentionsKawvoProducts && /\\b(ademas de|otros|otras|que otros|que otras|cuales mas|actualmente disponibles)\\b/.test(normalized)\n\n  const platformDefinition = asksDefinition && (mentionsKawvo || mentionsKawvoProfile || mentionsKawvoPresentation)\n\n  return platformDefinition || asksPlatformCatalog || asksPlatformAvailability || asksPlatformExpansion\n"""

if old not in s:
    raise SystemExit('No encontré el bloque de guard v1 esperado')

s = s.replace(old, new, 1)
p.write_text(s)

print('✓ guard afinado: bloquea conocimiento de plataforma Kawvo sin bloquear preferencias ni oferta concreta del usuario')
