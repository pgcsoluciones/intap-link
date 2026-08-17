from pathlib import Path

profile = Path('web/src/components/free-profile/IntapLinkGratisProfile.tsx')
css = Path('web/src/components/free-profile/IntapLinkGratisPublicEnhancements.css')

p = profile.read_text()
old = "<div className=\"ilx-services\" style={{ '--ilx-service-count': Math.max(1, services.length) } as CSSProperties}>"
new = "<div className=\"ilx-services\" data-service-count={Math.max(1, services.length)} style={{ '--ilx-service-count': Math.max(1, services.length) } as CSSProperties}>"
if new not in p:
    if old not in p:
        raise SystemExit('Expected services wrapper not found in profile TSX.')
    p = p.replace(old, new, 1)
profile.write_text(p)

s = css.read_text()
marker = '/* INTAP LINK GRATIS · SERVICES COUNT-RESPONSIVE TYPE V4 */'
if marker not in s:
    s += r'''

/* INTAP LINK GRATIS · SERVICES COUNT-RESPONSIVE TYPE V4 */
.ilx-services[data-service-count="1"] .ilx-service-copy {
  padding: 16px 18px 14px;
}

.ilx-services[data-service-count="1"] .ilx-service-copy h3 {
  font-size: 19px;
  line-height: 1.22;
}

.ilx-services[data-service-count="1"] .ilx-service-copy p {
  margin-top: 9px;
  font-size: 14.5px;
  line-height: 1.5;
}

.ilx-services[data-service-count="1"] .ilx-service-more {
  min-height: 42px;
  font-size: 15.5px;
  padding-inline: 16px;
}

.ilx-services[data-service-count="2"] .ilx-service-copy {
  padding: 13px 11px 11px;
}

.ilx-services[data-service-count="2"] .ilx-service-copy h3 {
  font-size: 17px;
}

.ilx-services[data-service-count="2"] .ilx-service-copy p {
  font-size: 14px;
  line-height: 1.48;
}

.ilx-services[data-service-count="2"] .ilx-service-more {
  min-height: 38px;
  font-size: 14.5px;
}

.ilx-services[data-service-count="3"] .ilx-service-copy h3 {
  font-size: 15.5px;
}

.ilx-services[data-service-count="3"] .ilx-service-copy p {
  font-size: 13.5px;
  line-height: 1.45;
}

.ilx-services[data-service-count="3"] .ilx-service-more {
  min-height: 36px;
  font-size: 14px;
}

@media (max-width: 560px) {
  .ilx-services[data-service-count="1"] .ilx-service-copy {
    padding: 15px 16px 13px;
  }

  .ilx-services[data-service-count="1"] .ilx-service-copy h3 {
    font-size: 19px;
  }

  .ilx-services[data-service-count="1"] .ilx-service-copy p {
    font-size: 14.5px;
  }

  .ilx-services[data-service-count="1"] .ilx-service-more {
    min-height: 42px;
    font-size: 15.5px;
  }

  .ilx-services[data-service-count="2"] .ilx-service-copy h3 {
    font-size: 16.5px;
  }

  .ilx-services[data-service-count="2"] .ilx-service-copy p {
    font-size: 13.5px;
  }

  .ilx-services[data-service-count="2"] .ilx-service-more {
    min-height: 38px;
    font-size: 14px;
  }

  .ilx-services[data-service-count="3"] .ilx-service-copy h3 {
    font-size: 15px;
  }

  .ilx-services[data-service-count="3"] .ilx-service-copy p {
    font-size: 13px;
  }

  .ilx-services[data-service-count="3"] .ilx-service-more {
    min-height: 36px;
    font-size: 13.5px;
  }
}
'''
css.write_text(s)
print('Applied service-count responsive typography for 1, 2, and 3 cards.')
