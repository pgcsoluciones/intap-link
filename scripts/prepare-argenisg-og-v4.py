#!/usr/bin/env python3
from __future__ import annotations

import tempfile
import zipfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path.home() / 'Desktop' / 'intap-link-universal-bilingual-audit'
BACKUP = Path('/Volumes/backup JL/11977/!Recuperados 2024/recuperados/diseños/argenis grullon')
OUT = ROOT / 'web' / 'public' / 'assets' / 'adonisg' / 'og' / 'adonisg-og-v4.jpg'
ZIP_NAME = 'Argenis fotos.zip'
# Foto oficial indicada por el usuario. Primero se busca como archivo local por el
# fragmento del nombre; si no existe, se usa el original equivalente dentro del ZIP.
LOCAL_FRAGMENTS = ('1.40.18', '1.40.18 a.')
ZIP_FRAGMENT = '1.40.18'
W, H = 1200, 630

CREAM = (247, 244, 238)
INK = (18, 18, 18)
MUTED = (88, 84, 79)
LINE = (179, 173, 164)


def font(size: int, bold: bool = False, serif: bool = False):
    candidates: list[str] = []
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
    for raw in candidates:
        p = Path(raw)
        if p.exists():
            try:
                return ImageFont.truetype(str(p), size=size)
            except Exception:
                pass
    return ImageFont.load_default()


def find_local_official() -> Path | None:
    bases = [ROOT, Path.home() / 'Downloads', Path.home() / 'Desktop', BACKUP]
    suffixes = {'.png', '.jpg', '.jpeg', '.webp'}
    for base in bases:
        if not base.exists():
            continue
        for p in base.rglob('*'):
            if not p.is_file() or p.suffix.lower() not in suffixes:
                continue
            name = p.name.lower()
            if any(fragment.lower() in name for fragment in LOCAL_FRAGMENTS):
                return p
    return None


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


def find_zip_photo(root: Path) -> Path:
    matches = [
        p for p in root.rglob('*')
        if p.is_file()
        and ZIP_FRAGMENT.lower() in p.name.lower()
        and p.suffix.lower() in {'.jpg', '.jpeg', '.png', '.webp'}
        and not p.name.startswith('._')
    ]
    if not matches:
        raise FileNotFoundError(ZIP_FRAGMENT)
    return sorted(matches)[0]


def load_official() -> tuple[Image.Image, str]:
    local = find_local_official()
    if local:
        with Image.open(local) as raw:
            return ImageOps.exif_transpose(raw).convert('RGB'), str(local)

    zpath = find_zip()
    with tempfile.TemporaryDirectory(prefix='argenisg-og-v4-') as td:
        td = Path(td)
        with zipfile.ZipFile(zpath) as zf:
            zf.extractall(td)
        src = find_zip_photo(td)
        with Image.open(src) as raw:
            return ImageOps.exif_transpose(raw).convert('RGB'), f'{zpath}::{src.name}'


def contain(im: Image.Image, box: tuple[int, int]) -> Image.Image:
    out = im.copy()
    out.thumbnail(box, Image.Resampling.LANCZOS)
    return out


def main() -> None:
    photo, source = load_official()

    canvas = Image.new('RGB', (W, H), CREAM)
    draw = ImageDraw.Draw(canvas)

    # Foto oficial como protagonista, contenida para que sombrero y rostro nunca se corten.
    panel = (650, 20, 1180, 610)
    pw = panel[2] - panel[0]
    ph = panel[3] - panel[1]
    fg = contain(photo, (pw, ph))
    px = panel[0] + (pw - fg.width) // 2
    py = panel[1] + (ph - fg.height) // 2
    canvas.paste(fg, (px, py))

    left = 72
    draw.text((left, 70), 'ARGENIS GRULLÓN', font=font(24, bold=True), fill=MUTED)
    draw.line((left, 112, 560, 112), fill=LINE, width=2)

    title_font = font(70, serif=True)
    draw.text((left, 155), 'Argenis', font=title_font, fill=INK)
    draw.text((left, 228), 'Grullón', font=title_font, fill=INK)

    role_font = font(27, bold=True)
    draw.text((left, 365), 'ASESOR DE IMAGEN', font=role_font, fill=INK)
    draw.text((left, 407), 'ESTILISTA DE MODA', font=role_font, fill=INK)

    body_font = font(24)
    draw.text((left, 482), 'Imagen, presencia y', font=body_font, fill=MUTED)
    draw.text((left, 518), 'posicionamiento con intención.', font=body_font, fill=MUTED)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(OUT, 'JPEG', quality=91, optimize=True, progressive=True)
    print(f'✓ OG V4 1200x630 · foto oficial: {source}')
    print(f'✓ Sin dirección web impresa: {OUT}')


if __name__ == '__main__':
    main()
