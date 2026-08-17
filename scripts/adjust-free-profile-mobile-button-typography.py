from pathlib import Path

path = Path('web/src/components/free-profile/IntapLinkGratisRebuilt.css')
text = path.read_text()

replacements = [
    (""".ilx-main-cta {\n  width: 100%;\n  min-height: 52px;""", """.ilx-main-cta {\n  width: 100%;\n  min-height: 58px;"""),
    ("""  color:\n    var(--ilx-on-action);\n\n  text-decoration: none;\n\n  font-size: 13px;\n  font-weight: 750;""", """  color: #fff;\n\n  text-decoration: none;\n\n  font-size: 16px;\n  font-weight: 800;"""),
    (""".ilx-main-cta svg {\n  width: 17px;\n  height: 17px;""", """.ilx-main-cta svg {\n  width: 20px;\n  height: 20px;"""),
    (""".ilx-quick a,\n.ilx-quick button {\n  min-width: 0;\n  min-height: 72px;""", """.ilx-quick a,\n.ilx-quick button {\n  min-width: 0;\n  min-height: 76px;"""),
    ("""  font-size: 10px;\n  font-weight: 700;\n}\n\n.ilx-quick a:hover,""", """  font-size: 12px;\n  font-weight: 750;\n}\n\n.ilx-quick a:hover,"""),
    (""".ilx-service-more {\n  margin-top: auto;\n\n  color:\n    var(--ilx-accent);\n\n  font-size: 11px;\n  font-weight: 700;""", """.ilx-service-more {\n  margin-top: auto;\n\n  color:\n    var(--ilx-accent);\n\n  font-size: 13px;\n  font-weight: 750;"""),
    (""".ilx-links-toggle strong {\n  font-size: 15px;\n  font-weight: 800;""", """.ilx-links-toggle strong {\n  font-size: 16px;\n  font-weight: 800;"""),
    ("""  font-size: 12px;\n  font-weight: 650;\n}\n\n\n/* COMPARTIR */""", """  font-size: 14px;\n  font-weight: 700;\n}\n\n\n/* COMPARTIR */"""),
    ("""  font-size: 11px;\n  font-weight: 700;\n}\n\n\n/* FOOTER */""", """  font-size: 13px;\n  font-weight: 750;\n}\n\n\n/* FOOTER */"""),
    (""".ilx-modal-cta {\n  width: 100%;\n  min-height: 50px;""", """.ilx-modal-cta {\n  width: 100%;\n  min-height: 56px;"""),
    ("""  color:\n    var(--ilx-on-action);\n\n  text-decoration: none;\n\n  font-size: 13px;\n  font-weight: 750;""", """  color: #fff;\n\n  text-decoration: none;\n\n  font-size: 16px;\n  font-weight: 800;"""),
    ("""  .ilx-quick a,\n  .ilx-quick button {\n    min-height: 68px;""", """  .ilx-quick a,\n  .ilx-quick button {\n    min-height: 76px;"""),
]

for old, new in replacements:
    if old not in text:
        raise SystemExit(f'Expected CSS block not found:\n{old[:140]}')
    text = text.replace(old, new, 1)

# Explicitly keep WhatsApp text white across every palette, including hover.
if '.ilx-main-cta:hover {' in text and '.ilx-main-cta:hover {\n  color: #fff;' not in text:
    text = text.replace('.ilx-main-cta:hover {', '.ilx-main-cta:hover {\n  color: #fff;', 1)
if '.ilx-modal-cta:hover {' in text and '.ilx-modal-cta:hover {\n  color: #fff;' not in text:
    text = text.replace('.ilx-modal-cta:hover {', '.ilx-modal-cta:hover {\n  color: #fff;', 1)

path.write_text(text)
print('Applied mobile-first button typography + white WhatsApp CTA text.')
