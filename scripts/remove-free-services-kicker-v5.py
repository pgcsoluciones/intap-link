from pathlib import Path

profile = Path('web/src/components/free-profile/IntapLinkGratisProfile.tsx')
css = Path('web/src/components/free-profile/IntapLinkGratisPublicEnhancements.css')

p = profile.read_text()
old = '                <span className="ilx-services-kicker">Nuestros servicios</span>\n'
if old not in p:
    raise SystemExit('Expected services kicker not found in public profile.')
p = p.replace(old, '', 1)
profile.write_text(p)

s = css.read_text()
block = '''.ilx-services-kicker {\n  display: block;\n  margin-bottom: 7px;\n  color: var(--ilx-accent);\n  font-size: 12px;\n  font-weight: 850;\n  letter-spacing: .02em;\n}\n\n'''
if block in s:
    s = s.replace(block, '', 1)
css.write_text(s)

print('Removed hardcoded services kicker; user-selected section title remains as the only heading.')
