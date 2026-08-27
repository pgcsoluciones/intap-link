#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
V1 = ROOT / 'scripts/apply-ai-editorial-review-ux-v1.py'

source = V1.read_text()

# Adapt the v1 patcher to the exact service SQL currently present on the feature branch.
replacements = [
    (
        "UPDATE profile_products SET title = ?, description = ?, sort_order = ?, updated_at = datetime('now') WHERE id = ? AND profile_id = ?",
        "UPDATE profile_products SET title = ?, description = ?, sort_order = ? WHERE id = ? AND profile_id = ?",
    ),
    (
        "UPDATE profile_products SET title = ?, description = ?, updated_at = datetime('now') WHERE id = ? AND profile_id = ?",
        "UPDATE profile_products SET title = ?, description = ? WHERE id = ? AND profile_id = ?",
    ),
    (
        ".bind(next.title, next.description, index, existing.id, context.profileId)",
        ".bind(service.title,service.description,index,existing.id,context.profileId)",
    ),
    (
        ".bind(next.title, next.description, existing.id, context.profileId)",
        ".bind(service.title,service.description,existing.id,context.profileId)",
    ),
]

for old, new in replacements:
    if source.count(old) != 1:
        raise SystemExit(f'ERROR [v3 service patcher source]: esperaba 1 coincidencia para {old!r} y encontré {source.count(old)}.')
    source = source.replace(old, new, 1)

# Make the contact-preflight edit resilient to formatting/type-annotation differences.
old_call = '''api = replace_once(\n    api,\n    "  if (context.configuredChannels.length > 1 && !answers.preferred_contact && !followUp.some((item: FollowUpAnswer) => /contact|whatsapp|llamada|correo/i.test(item.question))) {",\n    "  if (editingScope === 'full_profile' && context.configuredChannels.length > 1 && !answers.preferred_contact && !followUp.some((item: FollowUpAnswer) => /contact|whatsapp|llamada|correo/i.test(item.question))) {",\n    'contact preflight by scope',\n)'''
new_call = '''api = replace_once(\n    api,\n    "  if (context.configuredChannels.length > 1",\n    "  if (editingScope === 'full_profile' && context.configuredChannels.length > 1",\n    'contact preflight by scope',\n)'''
if source.count(old_call) != 1:
    raise SystemExit(f'ERROR [v3 contact patcher source]: esperaba 1 bloque y encontré {source.count(old_call)}.')
source = source.replace(old_call, new_call, 1)

exec(compile(source, str(V1), 'exec'), {'__name__': '__main__', '__file__': str(V1)})
