#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API = ROOT / 'api/src/ai-profile-assistant.ts'
INTEGRATION = ROOT / 'scripts/test-ai-profile-assistant-integration.mjs'
CONTRACT = ROOT / 'scripts/test-ai-profile-assistant-contract.mjs'


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'ERROR [{label}]: esperaba 1 coincidencia y encontré {count}. No se escribió ningún archivo.')
    return text.replace(old, new, 1)

api = API.read_text()
integration = INTEGRATION.read_text()
contract = CONTRACT.read_text()

old_schema = """const responseSchema = {
  anyOf: [
    { type: 'object', additionalProperties: false, properties: { status: { type: 'string', enum: ['ready'] }, proposal: proposalSchema }, required: ['status','proposal'] },
    { type: 'object', additionalProperties: false, properties: { status: { type: 'string', enum: ['needs_more_info'] }, questions: { type: 'array', items: { type: 'string' } } }, required: ['status','questions'] },
  ],
}
"""
new_schema = """const responseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['ready','needs_more_info'] },
    proposal: { anyOf: [proposalSchema, { type: 'null' }] },
    questions: { anyOf: [{ type: 'array', items: { type: 'string' } }, { type: 'null' }] },
  },
  required: ['status','proposal','questions'],
}
"""
api = replace_once(api, old_schema, new_schema, 'response root schema')

old_validator = """function validateAssistantResult(raw: unknown, maxServices: number): AssistantResult | null {
  const value = objectValue(raw)
  if (value.status === 'needs_more_info') {
    if ('proposal' in value) return null
    const questions = Array.isArray(value.questions)
      ? value.questions.map((q: unknown) => text(q, 180)).filter(Boolean).slice(0, 3)
      : []
    return questions.length ? { status: 'needs_more_info', questions } : null
  }
  if (value.status === 'ready') {
    if ('questions' in value) return null
    const proposal = validateProposal(value.proposal, maxServices)
    return proposal ? { status: 'ready', proposal } : null
  }
  return null
}
"""
new_validator = """function validateAssistantResult(raw: unknown, maxServices: number): AssistantResult | null {
  const value = objectValue(raw)
  if (value.status === 'needs_more_info') {
    if (value.proposal !== null) return null
    const questions = Array.isArray(value.questions)
      ? value.questions.map((q: unknown) => text(q, 180)).filter(Boolean).slice(0, 3)
      : []
    return questions.length ? { status: 'needs_more_info', questions } : null
  }
  if (value.status === 'ready') {
    if (value.questions !== null) return null
    const proposal = validateProposal(value.proposal, maxServices)
    return proposal ? { status: 'ready', proposal } : null
  }
  return null
}
"""
api = replace_once(api, old_validator, new_validator, 'assistant result validator')

api = replace_once(
    api,
    "  'SALIDA: devuelve exclusivamente JSON válido conforme al esquema. No HTML, Markdown, comentarios, explicaciones ni razonamiento interno.',\n",
    "  'SALIDA: devuelve exclusivamente JSON válido conforme al esquema. La raíz siempre contiene status, proposal y questions. Si status=ready, proposal contiene la propuesta y questions=null. Si status=needs_more_info, proposal=null y questions contiene 1 a 3 preguntas. No HTML, Markdown, comentarios, explicaciones ni razonamiento interno.',\n",
    'output instructions',
)

# Update mocked Structured Output responses used by integration tests.
integration = integration.replace(
    "JSON.stringify({ status: 'ready', proposal: BASE_PROPOSAL })",
    "JSON.stringify({ status: 'ready', proposal: BASE_PROPOSAL, questions: null })",
)
integration = integration.replace(
    "JSON.stringify({ status: 'needs_more_info', questions: ['¿Atiendes hogares, negocios o ambos?'] })",
    "JSON.stringify({ status: 'needs_more_info', proposal: null, questions: ['¿Atiendes hogares, negocios o ambos?'] })",
)
integration = integration.replace(
    "JSON.stringify({ status: 'needs_more_info', questions: ['Q1','Q2','Q3','Q4'] })",
    "JSON.stringify({ status: 'needs_more_info', proposal: null, questions: ['Q1','Q2','Q3','Q4'] })",
)
integration = integration.replace(
    "JSON.stringify({ status: 'ready', proposal })",
    "JSON.stringify({ status: 'ready', proposal, questions: null })",
)

anchor = "assert.match(apiSource, /json_schema/, 'OpenAI Structured Outputs must be requested')\n"
extra = """assert.match(apiSource, /const responseSchema = \\{\\s*type: 'object'/, 'Structured Output root schema must be an object')
assert.match(apiSource, /required: \\['status','proposal','questions'\\]/, 'Structured Output root must require all root keys')
assert.doesNotMatch(apiSource, /const responseSchema = \\{\\s*anyOf:/, 'Structured Output root may not be anyOf')
"""
if extra.strip() not in contract:
    contract = replace_once(contract, anchor, anchor + extra, 'contract root schema assertions')

API.write_text(api)
INTEGRATION.write_text(integration)
CONTRACT.write_text(contract)
print('OK: schema raíz estricto corregido; mocks y contrato actualizados.')
