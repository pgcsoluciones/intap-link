from pathlib import Path

p = Path('web/src/components/free-profile/IntapLinkGratisPublicEnhancements.css')
s = p.read_text()

replacements = {
""".ilx-services {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: stretch;
  gap: 8px;
}""": """.ilx-services {
  display: grid;
  grid-template-columns: repeat(var(--ilx-service-count, 1), minmax(0, 1fr));
  align-items: stretch;
  gap: 8px;
}""",
""".ilx-service-copy h3 {
  display: -webkit-box;
  min-height: 2.5em;
  overflow: hidden;
  color: var(--ilx-text);
  font-size: 12px;
  font-weight: 800;
  line-height: 1.25;
  text-align: left;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}""": """.ilx-service-copy h3 {
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
}""",
""".ilx-service-copy p {
  display: -webkit-box;
  min-height: 4.35em;
  margin: 7px 0 10px;
  overflow: hidden;
  color: var(--ilx-muted);
  font-size: 10.5px;
  line-height: 1.45;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}""": """.ilx-service-copy p {
  display: -webkit-box;
  min-height: 2.9em;
  margin: 7px 0 10px;
  overflow: hidden;
  color: var(--ilx-muted);
  font-size: 10.5px;
  line-height: 1.45;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}""",
"""  .ilx-service-copy h3 {
    font-size: 11px;
  }""": """  .ilx-service-copy h3 {
    font-size: 13px;
  }""",
}

for old, new in replacements.items():
    if new in s:
        continue
    if old not in s:
        raise SystemExit('Expected CSS block not found; no partial patch should be committed.')
    s = s.replace(old, new, 1)

p.write_text(s)
print('Applied dynamic 1/2/3 service grid, larger titles, and 2-line card descriptions.')
