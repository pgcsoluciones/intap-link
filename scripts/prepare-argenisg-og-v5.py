#!/usr/bin/env python3
from __future__ import annotations

import tempfile
import zipfile
from pathlib import Path
from PIL import Image, ImageFilter, ImageOps

ROOT = Path.home() / 'Desktop' / 'intap-link-universal-bilingual-audit'
BACKUP = Path('/Volumes/backup JL/11977/!Recuperados 2024/recuperados/diseños/argenis grullon')
OUT = ROOT / 'web' / 'public' / 'assets' / 'adonisg' / 'og' / 'adonisg-og-v5.jpg'
ZIP_NAME = 'Argenis fotos.zip'
LOCAL_FRAGMENTS = ('1.40.18', '1.40.18 a.')
ZIP_FRAGMENT = '1.40.18'
W, H = 1200, 630


def find_local_official() -> Path | None:
    suffixes = {'.png', '.jpg', '.jpeg', '.webp'}
    for base in [ROOT, Path.home() / 'Downloads', Path.home() / 'Desktop', BACKUP]:
        if not base.exists():
            continue
        for p in base.rglob('*'):
            if p.is_file() and p.suffix.lower() in suffixes:
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
    with tempfile.TemporaryDirectory(prefix='argenisg-og-v5-') as td:
        td = Path(td)
        with zipfile.ZipFile(zpath) as zf:
            zf.extractall(td)
        src = find_zip_photo(td)
        with Image.open(src) as raw:
            return ImageOps.exif_transpose(raw).convert('RGB'), f'{zpath}::{src.name}'


def main() -> None:
    photo, source = load_official()

    # Fondo horizontal derivado de la misma foto para llenar 1200x630 sin barras.
    bg = ImageOps.fit(photo, (W, H), method=Image.Resampling.LANCZOS, centering=(0.52, 0.40))
    bg = bg.filter(ImageFilter.GaussianBlur(18))

    # Foto oficial contenida completa: sin texto, sin URL y sin cortar sombrero/rostro.
    fg = photo.copy()
    fg.thumbnail((W - 80, H - 24), Image.Resampling.LANCZOS)

    canvas = bg.copy()
    x = (W - fg.width) // 2
    y = (H - fg.height) // 2
    canvas.paste(fg, (x, y))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(OUT, 'JPEG', quality=92, optimize=True, progressive=True)
    print(f'✓ OG V5 1200x630 · SOLO FOTO OFICIAL: {source}')
    print(f'✓ Sin texto · sin nombre · sin URL impresa: {OUT}')


if __name__ == '__main__':
    main()
