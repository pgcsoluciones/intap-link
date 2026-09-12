#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path.home() / 'Desktop' / 'intap-link-universal-bilingual-audit'
BACKUP = Path('/Volumes/backup JL/11977/!Recuperados 2024/recuperados/diseños/argenis grullon')
OUT = ROOT / 'web' / 'public' / 'assets' / 'adonisg' / 'og' / 'adonisg-og-v6.png'

# Portada final aprobada por el usuario: 750x826.
# Si el archivo 8.32.09 existe localmente, se usa tal cual.
# Si no existe (la imagen fue adjuntada en ChatGPT pero no está guardada en el Mac),
# se reconstruye el mismo encuadre desde la foto oficial 1.40.18 ya disponible en backup.
APPROVED_FRAGMENTS = (
    'captura de pantalla 2026-09-12 a la(s) 8.32.09',
    '8.32.09',
)
OFFICIAL_FRAGMENTS = (
    'captura de pantalla 2026-09-04 a la(s) 1.40.18',
    '1.40.18',
)
SEARCH_DIRS = [
    Path.home() / 'Desktop',
    Path.home() / 'Downloads',
    ROOT,
    BACKUP,
]
TARGET_W, TARGET_H = 750, 826


def find_by_fragments(fragments: tuple[str, ...]) -> Path | None:
    suffixes = {'.png', '.jpg', '.jpeg', '.webp'}
    candidates: list[Path] = []
    for base in SEARCH_DIRS:
        if not base.exists():
            continue
        for p in base.rglob('*'):
            if not p.is_file() or p.suffix.lower() not in suffixes:
                continue
            name = p.name.lower()
            if any(fragment in name for fragment in fragments):
                candidates.append(p)
    if not candidates:
        return None
    return sorted(candidates, key=lambda p: p.stat().st_mtime, reverse=True)[0]


def load_approved() -> tuple[Image.Image, str]:
    exact = find_by_fragments(APPROVED_FRAGMENTS)
    if exact:
        with Image.open(exact) as raw:
            img = ImageOps.exif_transpose(raw).convert('RGBA')
        return img, f'exact:{exact}'

    official = find_by_fragments(OFFICIAL_FRAGMENTS)
    if not official:
        raise FileNotFoundError(
            'No encontré ni la portada 8.32.09 ni la foto oficial 1.40.18 para reconstruirla.'
        )

    with Image.open(official) as raw:
        src = ImageOps.exif_transpose(raw).convert('RGBA')

    # La portada aprobada enviada en chat mide 750x826. El original oficial mide
    # 808x1141; se escala a 750 px de ancho y se toma el encuadre vertical exacto
    # correspondiente al aprobado (offset superior 99 px tras el escalado).
    scale = TARGET_W / src.width
    scaled_h = round(src.height * scale)
    scaled = src.resize((TARGET_W, scaled_h), Image.Resampling.LANCZOS)
    top = 99
    if top + TARGET_H > scaled.height:
        top = max(0, scaled.height - TARGET_H)
    img = scaled.crop((0, top, TARGET_W, top + TARGET_H))
    return img, f'reconstructed-from:{official}'


def main() -> None:
    img, source = load_approved()
    if img.size != (TARGET_W, TARGET_H):
        raise RuntimeError(f'La portada resultante no coincide con 750x826: {img.size}')

    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT, 'PNG', optimize=True)

    with Image.open(OUT) as check:
        if check.size != (TARGET_W, TARGET_H):
            raise RuntimeError(f'La salida cambió de tamaño: {check.size}')

    print(f'✓ OG V6 preparada desde portada aprobada: {source}')
    print(f'✓ Formato exacto final: {TARGET_W}x{TARGET_H}')
    print('✓ Sin relleno, sin texto, sin canvas horizontal')
    print(f'✓ Salida: {OUT}')


if __name__ == '__main__':
    main()
