#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INTEGRATION = ROOT / 'scripts/test-ai-profile-assistant-integration.mjs'
CONTRACT = ROOT / 'scripts/test-ai-profile-assistant-contract.mjs'


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'ERROR [{label}]: esperaba 1 coincidencia y encontré {count}. No se escribió ningún archivo.')
    return text.replace(old, new, 1)

integration = INTEGRATION.read_text()
contract = CONTRACT.read_text()

integration = replace_once(
    integration,
    "  services: [\n    { title: 'Instalaciones eléctricas', description: 'Instalación de luminarias, abanicos, tomas y cableado para espacios residenciales o comerciales.' },\n    { title: 'Reparación de averías', description: 'Diagnóstico y corrección de cortos y fallas para recuperar el funcionamiento de la instalación.' },\n  ],\n  cta:",
    "  services: [\n    { title: 'Instalaciones eléctricas', description: 'Instalación de luminarias, abanicos, tomas y cableado para hogares o negocios.' },\n    { title: 'Reparación de averías', description: 'Diagnóstico y corrección de cortos y fallas para recuperar el funcionamiento.' },\n  ],\n  portfolio: [],\n  cta:",
    'integration base proposal',
)

integration = replace_once(
    integration,
    "    assert.equal(payload.text.format.type, 'json_schema')\n      assert.match(payload.instructions, /carta de presentación digital|primera impresión/i)",
    "    assert.equal(payload.text.format.type, 'json_schema')\n      assert.match(payload.instructions, /carta de presentación digital|primera impresión/i)\n      assert.match(payload.instructions, /editing_scope|ALCANCE DE EDICIÓN/i)\n      assert.match(payload.instructions, /portafolio/i)\n      assert.match(payload.input, /\"editing_scope\":\"missing_only\"/)",
    'integration scope assertions',
)

# The client can explicitly request full-profile review; server forwards that scope to the model input.
insert_anchor = "  // B: the model can request only high-value missing information.\n"
insert_block = """  // Editing scope is explicit and defaults to safe missing_only.\n  {\n    globalThis.fetch = async (_url, init) => {\n      const payload = JSON.parse(init.body)\n      assert.match(payload.input, /\\\"editing_scope\\\":\\\"full_profile\\\"/)\n      return { ok: true, status: 200, json: async () => ({ status: 'completed', output_text: JSON.stringify({ status: 'ready', proposal: BASE_PROPOSAL }), usage: {} }) }\n    }\n    const result = await call('/api/v1/me/ai-profile-assistant/generate', { answers: { activity_details: 'Soy electricista.', preferred_contact: 'whatsapp' }, round: 1, editing_scope: 'full_profile' })\n    assert.equal(result.status, 200)\n    assert.equal(result.body.data.status, 'ready')\n  }\n\n"""
if integration.count(insert_anchor) != 1:
    raise SystemExit('ERROR [integration insert]: anchor no único; no se escribió ningún archivo.')
integration = integration.replace(insert_anchor, insert_block + insert_anchor, 1)

contract = replace_once(
    contract,
    "assert.match(apiSource, /FREE_MAX_SERVICES/, 'Free service cap must come from backend configuration')\n",
    "assert.match(apiSource, /FREE_MAX_SERVICES/, 'Free service cap must come from backend configuration')\nassert.match(apiSource, /FREE_MAX_PORTFOLIO/, 'Free portfolio cap must come from backend configuration')\nassert.match(apiSource, /editing_scope/, 'Editing scope must be enforced server-side and sent as model context')\nassert.match(apiSource, /profile_gallery/, 'Assistant must understand portfolio metadata without modifying images')\nassert.match(apiSource, /UPDATE profile_gallery SET title = \\?, description = \\?/, 'Portfolio apply may update text metadata only')\n",
    'contract backend scope',
)

contract = replace_once(
    contract,
    "assert.doesNotMatch(apiSource, /DELETE\\s+FROM\\s+profile_products/i, 'AI may not delete existing services')\n",
    "assert.doesNotMatch(apiSource, /DELETE\\s+FROM\\s+profile_products/i, 'AI may not delete existing services')\nassert.doesNotMatch(apiSource, /DELETE\\s+FROM\\s+profile_gallery/i, 'AI may not delete portfolio images')\n",
    'contract no gallery delete',
)

contract = replace_once(
    contract,
    "assert.match(appSource, /conservará los servicios existentes/i, 'UI must accurately explain non-destructive service updates')\n",
    "assert.match(appSource, /conservará los servicios existentes/i, 'UI must accurately explain non-destructive service updates')\nassert.match(appSource, /Completar solo lo que falta/, 'UI must offer safe missing-only scope')\nassert.match(appSource, /Revisar y mejorar mi contenido/, 'UI must offer full-profile editorial review')\nassert.match(appSource, /Puedes generar otra propuesta en/, 'Cooldown must be presented as normal waiting state')\nassert.match(appSource, /Mis trabajos/, 'Portfolio copy review must be visible')\n",
    'contract ui scope',
)

INTEGRATION.write_text(integration)
CONTRACT.write_text(contract)
print('OK: pruebas actualizadas para alcance canónico, portafolio y límites.')
