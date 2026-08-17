from pathlib import Path

rebuilt = Path('web/src/components/free-profile/IntapLinkGratisRebuilt.css')
public = Path('web/src/components/free-profile/IntapLinkGratisPublicEnhancements.css')

r = rebuilt.read_text()
p = public.read_text()

replacements_r = {
    '  font-size: 16px;\n  font-weight: 800;': '  font-size: 18px;\n  font-weight: 820;',
    '  font-size: 12px;\n  font-weight: 750;': '  font-size: 14px;\n  font-weight: 780;',
}
for old, new in replacements_r.items():
    if old not in r:
        raise SystemExit(f'Missing expected rebuilt pattern: {old!r}')
    r = r.replace(old, new, 1)

replacements_p = {
    '  min-height: 50px;': '  min-height: 56px;',
    '  font-size: 12px;\n  font-weight: 760;': '  font-size: 16px;\n  font-weight: 800;',
    '  font-size: 17px;': '  font-size: 20px;',
    '  font-size: 10px !important;\n  font-weight: 650 !important;\n  opacity: .72;': "  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  min-height: 34px;\n  padding: 7px 14px;\n  border: 1px solid var(--ilx-border);\n  border-radius: 999px;\n  background: var(--ilx-surface);\n  color: var(--ilx-primary) !important;\n  font-size: 12px !important;\n  font-weight: 760 !important;\n  line-height: 1;\n  opacity: .88;",
}
for old, new in replacements_p.items():
    if old not in p:
        raise SystemExit(f'Missing expected public pattern: {old!r}')
    p = p.replace(old, new, 1)

rebuilt.write_text(r)
public.write_text(p)
print('Applied larger mobile button labels + pill login treatment.')
