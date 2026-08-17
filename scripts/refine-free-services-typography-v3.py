from pathlib import Path

public_css = Path('web/src/components/free-profile/IntapLinkGratisPublicEnhancements.css')
modal_css = Path('web/src/components/free-profile/IntapLinkGratisRebuilt.css')

s = public_css.read_text()

replacements = {
""".ilx-service-copy {
  width: 100%;
  min-height: 0;
  flex: 1;
  padding: 11px 9px 10px;
  align-items: stretch;
  justify-content: flex-start;
  text-align: left;
}""": """.ilx-service-copy {
  width: 100%;
  min-height: 0;
  flex: 1;
  padding: 11px 9px 10px;
  align-items: stretch;
  justify-content: flex-start;
  text-align: center;
}""",
""".ilx-service-copy h3 {
  display: -webkit-box;
  min-height: 2.5em;
  overflow: hidden;
  color: var(--ilx-text);
  font-size: 14px;
  font-weight: 850;
  line-height: 1.25;
  text-align: left;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}""": """.ilx-service-copy h3 {
  display: -webkit-box;
  min-height: 2.5em;
  overflow: hidden;
  color: var(--ilx-text);
  font-size: 15px;
  font-weight: 850;
  line-height: 1.25;
  text-align: center;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}""",
""".ilx-service-copy p {
  display: -webkit-box;
  min-height: 2.9em;
  margin: 7px 0 10px;
  overflow: hidden;
  color: var(--ilx-muted);
  font-size: 10.5px;
  line-height: 1.45;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}""": """.ilx-service-copy p {
  display: -webkit-box;
  min-height: 2.9em;
  margin: 7px 0 10px;
  overflow: hidden;
  color: var(--ilx-muted);
  font-size: 10.5px;
  line-height: 1.45;
  text-align: center;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}""",
"""  font-size: 10.5px;
  font-weight: 800;
  text-align: center;
}""": """  font-size: 12.5px;
  font-weight: 850;
  text-align: center;
}""",
"""  .ilx-service-copy h3 {
    font-size: 13px;
  }""": """  .ilx-service-copy h3 {
    font-size: 14px;
  }""",
"""  .ilx-service-more {
    min-height: 32px;
    padding-inline: 4px;
    font-size: 10px;
  }""": """  .ilx-service-more {
    min-height: 34px;
    padding-inline: 5px;
    font-size: 12px;
  }""",
}

for old, new in replacements.items():
    if new in s:
        continue
    if old not in s:
        raise SystemExit('Expected public services CSS block not found; patch stopped before write.')
    s = s.replace(old, new, 1)

public_css.write_text(s)

m = modal_css.read_text()
old = """.ilx-modal-body {
  padding: 20px;
}"""
new = """.ilx-modal-body {
  padding: 20px;
  text-align: center;
}"""
if new not in m:
    if old not in m:
        raise SystemExit('Expected modal body CSS block not found; public CSS may need rollback before commit.')
    m = m.replace(old, new, 1)
modal_css.write_text(m)

print('Applied larger centered service titles/CTA and centered modal text.')
