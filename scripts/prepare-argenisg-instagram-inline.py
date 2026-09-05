#!/usr/bin/env python3
from pathlib import Path

ROOT = Path.home() / "Desktop" / "intap-link-universal-bilingual-audit"
TARGET = ROOT / "web/src/components/profile-templates/IntapProfileAdonisgV1.tsx"

text = TARGET.read_text(encoding="utf-8")

old_import = "import './IntapProfileAdonisgV1.css'\n"
new_import = "import './IntapProfileAdonisgV1.css'\nimport InstagramLatestMedia, { type InstagramMediaItem } from './InstagramLatestMedia'\n"
if new_import not in text:
    if old_import not in text:
        raise SystemExit('No encontré import base de IntapProfileAdonisgV1.css')
    text = text.replace(old_import, new_import, 1)

old_type = "type FeedItem = { id: string; media_url?: string; thumbnail_url?: string; permalink?: string; caption?: string }\n"
new_type = "type FeedItem = InstagramMediaItem\n"
if new_type not in text:
    if old_type not in text:
        raise SystemExit('No encontré tipo FeedItem esperado')
    text = text.replace(old_type, new_type, 1)

old_fetch = "setFeed(items.slice(0, 6)); setFeedReady(true)"
new_fetch = "setFeed(items.slice(0, 1)); setFeedReady(true)"
if old_fetch in text:
    text = text.replace(old_fetch, new_fetch, 1)

old_section = "    <section className=\"adonis-instagram\"><h2>{t.latest}</h2><p>{t.latestCopy}</p>{feed.length > 0 ? <div className=\"adonis-feed-grid\">{feed.map((item, i) => <a key={item.id || i} href={item.permalink || instagram} target=\"_blank\" rel=\"noopener noreferrer\"><img src={item.thumbnail_url || item.media_url} alt={item.caption || 'Instagram'} /></a>)}</div> : feedReady && <div className=\"adonis-feed-empty\"><FaInstagram /></div>}<a href={instagram} target=\"_blank\" rel=\"noopener noreferrer\">{t.instagramCta} <FaArrowRight /></a></section>\n"
new_section = "    <section className=\"adonis-instagram\"><h2>{t.latest}</h2><p>{t.latestCopy}</p>{feed.length > 0 ? <InstagramLatestMedia item={feed[0]} /> : feedReady && <div className=\"adonis-feed-empty\"><FaInstagram /></div>}<a href={instagram} target=\"_blank\" rel=\"noopener noreferrer\">{t.instagramCta} <FaArrowRight /></a></section>\n"
if new_section not in text:
    if old_section not in text:
        raise SystemExit('No encontré sección Instagram esperada para convertirla a reproducción inline')
    text = text.replace(old_section, new_section, 1)

TARGET.write_text(text, encoding="utf-8")
print('✓ Instagram latest: una sola publicación, foto/video/reel/carrusel reproducible dentro del perfil')
