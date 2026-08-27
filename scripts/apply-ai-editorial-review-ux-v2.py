#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
V1 = ROOT / 'scripts/apply-ai-editorial-review-ux-v1.py'

source = V1.read_text()

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
        raise SystemExit(f'ERROR [v2 patcher source]: esperaba 1 coincidencia para {old!r} y encontré {source.count(old)}.')
    source = source.replace(old, new, 1)

exec(compile(source, str(V1), 'exec'), {'__name__': '__main__', '__file__': str(V1)})
