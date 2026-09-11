#!/usr/bin/env python3
from __future__ import annotations

import tempfile
import zipfile
from pathlib import Path
from PIL import Image, ImageFilter, ImageOps, ImageEnhance

ROOT = Path.home() / 'Desktop' / 'intap-link-universal-bilingual-audit'
BACKUP = Path('/Volumes/backup JL/11977/!Recuperados 2024/recuperados/diseños/argenis grullon')
OUT = ROOT / 'web' / 'public' / 'assets' / 'adonisg' / 'og' / 'adonisg-og-v2.jpg'
ZIP_NAME = 'Argenis fotos.zip'
FRAGMENT = 'PHOTO-2026-07-27-11-34-00 (2)'
W, H = 1200, 630


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


def fit_cover(im: Image.Image, size: tuple[int,int]) -> Image.Image:
    return ImageOps.fit(im, size, method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))


def main() -> None:
    zpath = find_zip()
    with tempfile.TemporaryDirectory(prefix='argenisg-og-v2-') as td:
        td = Path(td)
        with zipfile.ZipFile(zpath) as zf:
            zf.extractall(td)
        src = find_photo(td)
        with Image.open(src) as raw:
            base = ImageOps.exif_transpose(raw).convert('RGB')

            # Background fills 1200x630 but is blurred/dimmed so foreground stays readable.
            bg = fit_cover(base, (W, H)).filter(ImageFilter.GaussianBlur(20))
            bg = ImageEnhance.Brightness(bg).enhance(0.55)

            # Foreground is CONTAINED, never cropped. Leave 8% top/bottom safe margin.
            fg = base.copy()
            max_h = int(H * 0.84)
            max_w = int(W * 0.72)
            fg.thumbnail((max_w, max_h), Image.Resampling.LANCZOS)

            canvas = bg.copy()
            x = (W - fg.width) // 2
            y = (H - fg.height) // 2
            canvas.paste(fg, (x, y))

            OUT.parent.mkdir(parents=True, exist_ok=True)
            canvas.save(OUT, 'JPEG', quality=88, optimize=True, progressive=True)
            print(f'✓ OG V2 {W}x{H} creada sin recorte del sujeto: {OUT}')

if __name__ == '__main__':
    main()
