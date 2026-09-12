#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path.home() / 'Desktop' / 'intap-link-universal-bilingual-audit'
OUT = ROOT / 'web' / 'public' / 'assets' / 'adonisg' / 'og' / 'adonisg-og-v6.png'

# Portada exacta aprobada por el usuario el 2026-09-12.
# Se preserva completa: sin crop, sin resize, sin relleno, sin texto añadido.
NAME_FRAGMENTS = (
    'captura de pantalla 2026-09-12 a la(s) 8.32.09',
    '8.32.09',
)

SEARCH_DIRS = [
    Path.home() / 'Desktop',
    Path.home() / 'Downloads',
    ROOT,
    Path('/Volumes/backup JL/11977/!Recuperados 2024/recuperados/diseños/argenis grullon'),
]


def find_source() -> Path:
    suffixes = {'.png', '.jpg', '.jpeg', '.webp'}
    candidates: list[Path] = []
    for base in SEARCH_DIRS:
        if not base.exists():
            continue
        for p in base.rglob('*'):
            if not p.is_file() or p.suffix.lower() not in suffixes:
                continue
            name = p.name.lower()
            if any(fragment in name for fragment in NAME_FRAGMENTS):
                candidates.append(p)
    if not candidates:
        raise FileNotFoundError(
            'No encontré la portada aprobada del 2026-09-12 8.32.09 en Desktop, Downloads, repo o backup.'
        )
    # Preferir el archivo más reciente, que corresponde a la portada final aprobada.
    return sorted(candidates, key=lambda p: p.stat().st_mtime, reverse=True)[0]


def main() -> None:
    src = find_source()
    with Image.open(src) as raw:
        img = ImageOps.exif_transpose(raw).convert('RGBA')
        original_size = img.size
        OUT.parent.mkdir(parents=True, exist_ok=True)
        # PNG conserva exactamente el lienzo y la relación de aspecto.
        img.save(OUT, 'PNG', optimize=True)

    with Image.open(OUT) as check:
        if check.size != original_size:
            raise RuntimeError(f'La salida cambió de tamaño: {original_size} -> {check.size}')

    print(f'✓ OG V6 usa portada exacta aprobada: {src}')
    print(f'✓ Tamaño preservado sin crop/relleno: {original_size[0]}x{original_size[1]}')
    print(f'✓ Salida: {OUT}')


if __name__ == '__main__':
    main()
