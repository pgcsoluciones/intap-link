#!/usr/bin/env python3
from pathlib import Path

# 1) Server-authoritative metrics + global daily budget.
p = Path('api/src/routes/demo-ai.ts')
s = p.read_text()
if 'DEMO_AI_DAILY_LIMIT' not in s:
    s = s.replace(
        "  const sessionLimit = numberEnv(c.env.DEMO_AI_SESSION_LIMIT, DEFAULT_SESSION_LIMIT, 1, 20)\n  const ipLimit = numberEnv(c.env.DEMO_AI_IP_LIMIT, DEFAULT_IP_LIMIT, 2, 200)\n  const cooldown = numberEnv(c.env.DEMO_AI_COOLDOWN_SECONDS, DEFAULT_COOLDOWN_SECONDS, 1, 120)\n  const [sessionRow, ipRow] = await Promise.all([",
        "  const sessionLimit = numberEnv(c.env.DEMO_AI_SESSION_LIMIT, DEFAULT_SESSION_LIMIT, 1, 20)\n  const ipLimit = numberEnv(c.env.DEMO_AI_IP_LIMIT, DEFAULT_IP_LIMIT, 2, 500)\n  const dailyLimit = numberEnv(c.env.DEMO_AI_DAILY_LIMIT, 500, 10, 10000)\n  const cooldown = numberEnv(c.env.DEMO_AI_COOLDOWN_SECONDS, DEFAULT_COOLDOWN_SECONDS, 1, 120)\n  const [sessionRow, ipRow, globalRow] = await Promise.all([",
        1,
    )
    s = s.replace(
        "    c.env.DB.prepare(\n      `SELECT COUNT(*) AS total FROM demo_events\n       WHERE source='demo_ai_api' AND event_type='demo_ai_started'\n         AND json_extract(metadata_json,'$.ip_hash')=? AND created_at >= datetime('now','-1 hour')`\n    ).bind(ipHash).first(),\n  ])",
        "    c.env.DB.prepare(\n      `SELECT COUNT(*) AS total FROM demo_events\n       WHERE source='demo_ai_api' AND event_type='demo_ai_started'\n         AND json_extract(metadata_json,'$.ip_hash')=? AND created_at >= datetime('now','-1 hour')`\n    ).bind(ipHash).first(),\n    c.env.DB.prepare(\n      `SELECT COUNT(*) AS total FROM demo_events\n       WHERE source='demo_ai_api' AND event_type='demo_ai_started' AND created_at >= datetime('now','-24 hours')`\n    ).first(),\n  ])",
        1,
    )
    s = s.replace(
        "  const ipTotal = Number((ipRow as any)?.total || 0)\n  if (sessionTotal >= sessionLimit)",
        "  const ipTotal = Number((ipRow as any)?.total || 0)\n  const globalTotal = Number((globalRow as any)?.total || 0)\n  if (globalTotal >= dailyLimit) return { allowed: false, code: 'daily_budget', retryAfter: 3600 }\n  if (sessionTotal >= sessionLimit)",
        1,
    )

# Enforce the deterministic category when the activity is already unambiguous.
needle = """    if (result.status === 'needs_more_info') {\n      if (round >= 2) {"""
if "result.demo.asset_category = deterministic.category" not in s:
    replacement = """    if (result.status === 'ready' && deterministic.category) {\n      result.demo.asset_category = deterministic.category\n    }\n\n    if (result.status === 'needs_more_info') {\n      if (round >= 2) {"""
    if needle not in s:
        raise SystemExit('No encontré bloque de result para fijar categoría determinística')
    s = s.replace(needle, replacement, 1)
p.write_text(s)

# 2) Frontend should not duplicate events the API already owns.
p = Path('web/src/components/demo/KawvoLinkDemoAi.tsx')
s = p.read_text()
for line in [
    "    postEvent('demo_ai_started', sessionKey)\n",
    "        postEvent('demo_ai_needs_more_info', sessionKey, { questions: data.questions.length })\n",
    "      postEvent('demo_ai_generated', sessionKey, { asset_category: data.demo.asset_category })\n",
]:
    s = s.replace(line, '')
p.write_text(s)

# 3) Preview allows repeated QA; Production keeps a tighter IP limit.
preview = Path('api/wrangler.preview.toml')
ps = preview.read_text()
ps = ps.replace('DEMO_AI_IP_LIMIT = "20"', 'DEMO_AI_IP_LIMIT = "100"')
if 'DEMO_AI_DAILY_LIMIT' not in ps:
    ps = ps.replace('DEMO_AI_IP_LIMIT = "100"\n', 'DEMO_AI_IP_LIMIT = "100"\nDEMO_AI_DAILY_LIMIT = "1000"\n', 1)
preview.write_text(ps)

prod = Path('api/wrangler.toml')
ps = prod.read_text()
if 'DEMO_AI_DAILY_LIMIT' not in ps:
    ps = ps.replace('DEMO_AI_IP_LIMIT = "20"\n', 'DEMO_AI_IP_LIMIT = "20"\nDEMO_AI_DAILY_LIMIT = "500"\n', 1)
prod.write_text(ps)

# 4) Strengthen static contract.
p = Path('scripts/test-demo-ai-contract.mjs')
s = p.read_text()
if 'DEMO_AI_DAILY_LIMIT' not in s:
    s = s.replace(
        "assert.match(api, /DEMO_AI_IP_LIMIT/, 'Rate limit por IP')\n",
        "assert.match(api, /DEMO_AI_IP_LIMIT/, 'Rate limit por IP')\nassert.match(api, /DEMO_AI_DAILY_LIMIT/, 'Budget diario / kill guard')\n",
        1,
    )
if "phone: whatsapp" not in s:
    s = s.replace(
        "assert.match(demo, /\\.slice\\(0, 3\\)/, 'Botones rápidos deben respetar máximo 3')\n",
        "assert.match(demo, /\\.slice\\(0, 3\\)/, 'Botones rápidos deben respetar máximo 3')\nassert.match(demo, /phone: whatsapp/, 'CTA principal debe conservar WhatsApp aunque llamadas use otro número')\nassert.match(demo, /tel:\\+\\$\\{callPhone\\}/, 'Botón Llamar usa su número correspondiente')\n",
        1,
    )
p.write_text(s)

print('✓ Demo IA V1.2: métricas sin duplicados, categoría estable y budget diario server-side')
