#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = Path(os.environ.get(
    'INTAP_FREE_BUILDER_SOURCE',
    str(REPO_ROOT / 'tmp' / 'free-starter-source' / 'cnstruyendo tu perfil'),
))
DEST_DIR = REPO_ROOT / 'web' / 'public' / 'assets' / 'free-onboarding-builder'
MANIFEST = DEST_DIR / 'manifest.json'
MAX_DIMENSION = 1200
WEBP_QUALITY = 80
IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.webp', '.heic'}


def run(cmd: list[str]) -> None:
    completed = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if completed.returncode != 0:
        raise RuntimeError(f"Falló: {' '.join(cmd)}\n{completed.stdout}\n{completed.stderr}")


def optimize(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='intap-free-builder-') as tmp_dir:
        temp_png = Path(tmp_dir) / 'resized.png'
        run([
            '/usr/bin/sips',
            '--resampleHeightWidthMax', str(MAX_DIMENSION),
            '-s', 'format', 'png',
            str(source),
            '--out', str(temp_png),
        ])
        run([
            '/usr/local/bin/cwebp',
            '-quiet', '-q', str(WEBP_QUALITY), '-m', '6',
            '-metadata', 'none',
            str(temp_png), '-o', str(destination),
        ])


def main() -> int:
    if not SOURCE_DIR.exists():
        print(f'ERROR: no existe la carpeta: {SOURCE_DIR}', file=sys.stderr)
        return 1

    files = sorted(
        p for p in SOURCE_DIR.iterdir()
        if p.is_file() and p.suffix.lower() in IMAGE_EXTS
    )
    if not files:
        print(f'ERROR: no hay imágenes en {SOURCE_DIR}', file=sys.stderr)
        return 1

    if DEST_DIR.exists():
        shutil.rmtree(DEST_DIR)
    DEST_DIR.mkdir(parents=True, exist_ok=True)

    images: list[str] = []
    source_files: list[str] = []
    source_bytes = 0
    output_bytes = 0

    print('=== INTAP LINK · ONBOARDING BUILDER ASSETS ===')
    print(f'Origen: {SOURCE_DIR}')
    print(f'Imágenes encontradas: {len(files)}')
    print()

    for index, source in enumerate(files, start=1):
        name = f'perfil-en-construccion-{index:02d}.webp'
        target = DEST_DIR / name
        optimize(source, target)
        source_bytes += source.stat().st_size
        output_bytes += target.stat().st_size
        public_path = f'/assets/free-onboarding-builder/{name}'
        images.append(public_path)
        source_files.append(source.name)
        print(f'✓ {source.name} -> {name}')

    manifest = {
        'count': len(images),
        'images': images,
        'sourceFiles': source_files,
        'usage': 'Pantalla de espera mientras se construye el starter del perfil Free',
    }
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    print()
    print('=== RESUMEN ===')
    print(f'Imágenes finales: {len(images)}')
    print(f'Peso origen: {source_bytes / 1024 / 1024:.1f} MB')
    print(f'Peso WebP: {output_bytes / 1024 / 1024:.1f} MB')
    if source_bytes:
        print(f'Reducción: {(1 - output_bytes/source_bytes) * 100:.1f}%')
    print(f'Manifest: {MANIFEST.relative_to(REPO_ROOT)}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
