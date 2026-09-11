#!/usr/bin/env python3
from __future__ import annotations

import tempfile
import zipfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path.home() / 'Desktop' / 'intap-link-universal-bilingual-audit'
BACKUP = Path('/Volumes/backup JL/11977/!Recuperados 2024/recuperados/diseños/argenis grullon')
OUT = ROOT / 'web' / 'public' / 'assets' / 'adonisg' / 'og' / 'adonisg-og-v3.jpg'
ZIP_NAME = 'Argenis fotos.zip'
FRAGMENT = 'PHOTO-2026-07-27-11-34-00 (2)'
W, H = 1200, 630

CREAM = (246, 242, 235)
INK = (18, 18, 18)
MUTED = (93, 89, 84)
WHITE = (255, 255, 255)


def find_zip() -> Path:
    for base in [BACKUP, ROOT, Path.home() / 'Downloads', Path.home() / 'Desktop']:
        if not base.exists():
            continue
        direct = base / ZIP_NAME
        if direct.is_file():
            return direct
        for p in base.glob(f'**/{ZIP_NAME}'):
            if p.is_file():
                return p
    raise FileNotFoundError(ZIP_NAME)


def find_photo(root: Path) -> Path:
    matches = [p for p in root.rglob('*') if p.is_file() and FRAGMENT.lower() in p.name.lower() and p.suffix.lower() in {'.jpg','.jpeg','.png'}]
    if not matches:
        raise FileNotFoundError(FRAGMENT)
    return sorted(matches)[0]


def font(size: int, bold: bool = False, serif: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = []
    if serif:
        candidates += [
            '/System/Library/Fonts/Supplemental/Georgia.ttf',
            '/System/Library/Fonts/Supplemental/Times New Roman.ttf',
        ]
    elif bold:
        candidates += [
            '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
            '/System/Library/Fonts/Helvetica.ttc',
        ]
    else:
        candidates += [
            '/System/Library/Fonts/Supplemental/Arial.ttf',
            '/System/Library/Fonts/Helvetica.ttc',
        ]
    for path in candidates:
        p = Path(path)
        if p.exists():
            try:
                return ImageFont.truetype(str(p), size=size)
            except Exception:
                pass
    return ImageFont.load_default()


def contained(im: Image.Image, box: tuple[int,int]) -> Image.Image:
    out = im.copy()
    out.thumbnail(box, Image.Resampling.LANCZOS)
    return out


def main() -> None:
    zpath = find_zip()
    with tempfile.TemporaryDirectory(prefix='argenisg-og-v3-') as td:
        td = Path(td)
        with zipfile.ZipFile(zpath) as zf:
            zf.extractall(td)
        src = find_photo(td)
        with Image.open(src) as raw:
            photo = ImageOps.exif_transpose(raw).convert('RGB')

        canvas = Image.new('RGB', (W, H), CREAM)
        draw = ImageDraw.Draw(canvas)

        # Editorial split: clean copy zone at left, portrait at right.
        photo_panel = (650, 38, 1160, 592)
        panel_w = photo_panel[2] - photo_panel[0]
        panel_h = photo_panel[3] - photo_panel[1]
        draw.rounded_rectangle(photo_panel, radius=26, fill=(228, 228, 230))

        fg = contained(photo, (panel_w - 26, panel_h - 26))
        x = photo_panel[0] + (panel_w - fg.width) // 2
        y = photo_panel[1] + (panel_h - fg.height) // 2
        canvas.paste(fg, (x, y))

        # Thin editorial frame.
        draw.rounded_rectangle(photo_panel, radius=26, outline=(38,38,38), width=2)

        left = 70
        draw.text((left, 62), 'AL ESTILO DE ARGENIS', font=font(22, bold=True), fill=MUTED)
        draw.line((left, 102, 560, 102), fill=(165,160,153), width=2)

        title_font = font(68, serif=True)
        draw.text((left, 145), 'Argenis', font=title_font, fill=INK)
        draw.text((left, 215), 'Grullón', font=title_font, fill=INK)

        role_font = font(27, bold=True)
        body_font = font(24)
        draw.text((left, 335), 'ASESOR DE IMAGEN', font=role_font, fill=INK)
        draw.text((left, 376), 'ESTILISTA DE MODA', font=role_font, fill=INK)
        draw.text((left, 431), 'Estrategia de marca personal', font=body_font, fill=MUTED)
        draw.text((left, 468), 'Imagen · presencia · posicionamiento', font=body_font, fill=MUTED)

        draw.line((left, 535, 560, 535), fill=(165,160,153), width=1)
        draw.text((left, 552), 'intaprd.com/argenisg', font=font(20), fill=INK)

        OUT.parent.mkdir(parents=True, exist_ok=True)
        canvas.save(OUT, 'JPEG', quality=90, optimize=True, progressive=True)
        print(f'✓ OG V3 editorial {W}x{H}: {OUT}')


if __name__ == '__main__':
    main()
