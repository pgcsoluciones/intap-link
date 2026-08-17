#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
from datetime import datetime
from pathlib import Path

SOURCE_BASE = Path(os.environ.get('INTAP_FREE_STARTER_SOURCE', '/Users/juanluis/Downloads/recursos graficos perfil free'))
REPO_ROOT = Path(__file__).resolve().parents[1]
DEST_ROOT = REPO_ROOT / 'web' / 'public' / 'assets' / 'free-starter'
MANIFEST_JSON = DEST_ROOT / 'manifest.json'
MANIFEST_TS = REPO_ROOT / 'shared' / 'free-profile-starter-assets.ts'
MAX_DIMENSION = 1400
WEBP_QUALITY = 78

# Source folder -> canonical category -> stable asset slug.
MAPPINGS = [
    ('MOda y Accesorios', 'Moda y accesorios', 'moda-accesorios'),
    ('belleza y estetica', 'Belleza y estética', 'belleza-estetica'),
    ('Salud y bienestar', 'Salud y bienestar', 'salud-bienestar'),
    ('GASTRONOMÍA Y ALIMENTOS', 'Gastronomía y alimentos', 'gastronomia-alimentos'),
    ('tecnologia y ser digitales', 'Tecnología y electrónica', 'tecnologia-electronica'),
    ('conmunity manager', 'Marketing y comunicación digital', 'marketing-comunicacion-digital'),
    ('ARTE, DISEÑO Y CREATIVIDAD', 'Arte, diseño y creatividad', 'arte-diseno-creatividad'),
    ('EDUCACIÓN Y FORMACIÓN', 'Educación y formación', 'educacion-formacion'),
    ('construccion y hogar', 'Construcción e ingeniería', 'construccion-ingenieria'),
    ('hogar decoracion', 'Hogar, decoración y mobiliario', 'hogar-decoracion-mobiliario'),
    ('Mantenimiento e instalaciones', 'Mantenimiento e instalaciones técnicas', 'mantenimiento-instalaciones-tecnicas'),
    ('inmobiliaria', 'Inmobiliaria y propiedades', 'inmobiliaria-propiedades'),
    ('automotriz y mecanica', 'Automotriz y mecánica', 'automotriz-mecanica'),
    ('comercio tiendas', 'Comercio, retail y tiendas virtuales', 'comercio-retail-tiendas-virtuales'),
    ('servicios profesionales', 'Servicios profesionales', 'servicios-profesionales'),
    ('Turismo, viaje', 'Turismo, viajes y hospitalidad', 'turismo-viajes-hospitalidad'),
    ('deporte y fitness', 'Deportes y fitness', 'deportes-fitness'),
    ('agropecuaria', 'Agropecuario y jardinería', 'agropecuario-jardineria'),
    ('logistica y mesajeria', 'Logística, mensajería y entregas', 'logistica-mensajeria-entregas'),
    ('eventos y entetenimiento', 'Eventos y entretenimiento', 'eventos-entretenimiento'),
    ('artesania', 'Artesanía y productos hechos a mano', 'artesania-productos-hechos-mano'),
    ('Mascotas animales', 'Mascotas y animales', 'mascotas-animales'),
    ('servicios generales', 'Servicios generales', 'servicios-generales'),
]

IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.webp', '.heic'}
MONTHS = {
    'ene': 1, 'feb': 2, 'mar': 3, 'abr': 4, 'may': 5, 'jun': 6,
    'jul': 7, 'ago': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dic': 12,
}


def normalized(value: str) -> str:
    return ''.join(
        c for c in unicodedata.normalize('NFD', value.strip())
        if unicodedata.category(c) != 'Mn'
    ).lower()


def find_source_folder(requested: str) -> Path:
    wanted = normalized(requested)
    matches = [p for p in SOURCE_BASE.iterdir() if p.is_dir() and normalized(p.name) == wanted]
    if len(matches) != 1:
        raise RuntimeError(f'No se encontró una carpeta única para {requested!r}. Coincidencias: {[p.name for p in matches]}')
    return matches[0]


def filename_datetime(path: Path) -> datetime:
    # Example: ChatGPT Image 17 ago 2026, 02_23_55 a.m. (1).png
    text = normalized(path.stem).replace('_', ':')
    match = re.search(r'(\d{1,2})\s+(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\s+(\d{4}),\s*(\d{1,2}):(\d{2}):(\d{2})\s*([ap])\.m\.', text)
    if not match:
        return datetime.fromtimestamp(path.stat().st_mtime)
    day, month_name, year, hour, minute, second, ap = match.groups()
    hour_i = int(hour)
    if ap == 'p' and hour_i != 12:
        hour_i += 12
    if ap == 'a' and hour_i == 12:
        hour_i = 0
    return datetime(int(year), MONTHS[month_name], int(day), hour_i, int(minute), int(second))


def discover_images(folder: Path) -> list[Path]:
    files = [p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in IMAGE_EXTS]
    return sorted(files, key=lambda p: (filename_datetime(p), p.name))


def select_images(files: list[Path]) -> list[Path]:
    # Agreed bank: 6 images per category; preserve 7 when the source bank itself contains exactly 7.
    # Folders with historical/repeated batches (>7) keep only the newest six.
    if len(files) <= 7:
        return files
    return files[-6:]


def run(cmd: list[str]) -> None:
    completed = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if completed.returncode != 0:
        raise RuntimeError(f"Falló: {' '.join(cmd)}\n{completed.stdout}\n{completed.stderr}")


def optimize_to_webp(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='intap-free-starter-') as tmp_dir:
        temp_png = Path(tmp_dir) / 'resized.png'
        # sips reads PNG/JPEG/HEIC/WebP on macOS and preserves aspect ratio with max dimension.
        run(['/usr/bin/sips', '--resampleHeightWidthMax', str(MAX_DIMENSION), '-s', 'format', 'png', str(source), '--out', str(temp_png)])
        run(['/usr/local/bin/cwebp', '-quiet', '-q', str(WEBP_QUALITY), '-m', '6', '-metadata', 'none', str(temp_png), '-o', str(destination)])


def render_ts(manifest: dict[str, dict]) -> str:
    lines = [
        '// AUTO-GENERATED by scripts/process-free-starter-images-v1.py. Do not edit by hand.',
        '',
        'export const FREE_PROFILE_STARTER_ASSETS = {',
    ]
    for category, item in manifest.items():
        paths = ', '.join(json.dumps(path, ensure_ascii=False) for path in item['images'])
        lines.append(f'  {json.dumps(category, ensure_ascii=False)}: [{paths}],')
    lines += [
        '} as const',
        '',
        'export type FreeProfileStarterAssetCategory = keyof typeof FREE_PROFILE_STARTER_ASSETS',
        '',
        'export function resolveFreeStarterAssets(category?: string | null): readonly string[] {',
        "  if (category && category in FREE_PROFILE_STARTER_ASSETS) return FREE_PROFILE_STARTER_ASSETS[category as FreeProfileStarterAssetCategory]",
        "  return []",
        '}',
        '',
    ]
    return '\n'.join(lines)


def main() -> int:
    if not SOURCE_BASE.exists():
        print(f'ERROR: No existe la carpeta origen: {SOURCE_BASE}', file=sys.stderr)
        return 1
    for required in ('/usr/bin/sips', '/usr/local/bin/cwebp'):
        if not Path(required).exists():
            print(f'ERROR: Falta herramienta requerida: {required}', file=sys.stderr)
            return 1

    DEST_ROOT.mkdir(parents=True, exist_ok=True)
    manifest: dict[str, dict] = {}
    total_source_bytes = 0
    total_output_bytes = 0

    print('=== INTAP LINK · PROCESANDO ASSETS FREE STARTER ===')
    print(f'Origen: {SOURCE_BASE}')
    print(f'Destino: {DEST_ROOT}')
    print()

    for source_folder_name, category, slug in MAPPINGS:
        folder = find_source_folder(source_folder_name)
        files = discover_images(folder)
        selected = select_images(files)
        if len(selected) < 6:
            raise RuntimeError(f'{category}: se esperaban al menos 6 imágenes y solo hay {len(selected)}.')

        target_dir = DEST_ROOT / slug
        if target_dir.exists():
            shutil.rmtree(target_dir)
        target_dir.mkdir(parents=True, exist_ok=True)

        public_paths: list[str] = []
        source_names: list[str] = []
        for index, source in enumerate(selected, start=1):
            target_name = f'{slug}-{index:02d}.webp'
            target = target_dir / target_name
            optimize_to_webp(source, target)
            total_source_bytes += source.stat().st_size
            total_output_bytes += target.stat().st_size
            public_paths.append(f'/assets/free-starter/{slug}/{target_name}')
            source_names.append(source.name)

        manifest[category] = {
            'slug': slug,
            'count': len(public_paths),
            'images': public_paths,
            'sourceFiles': source_names,
        }
        print(f'✓ {category}: {len(files)} origen -> {len(public_paths)} assets')

    # "Otros" intentionally has no source folder yet; keep an explicit empty pool for safe fallback handling.
    manifest['Otros'] = {'slug': 'otros', 'count': 0, 'images': [], 'sourceFiles': []}

    MANIFEST_JSON.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    MANIFEST_TS.write_text(render_ts(manifest), encoding='utf-8')

    print()
    print('=== RESUMEN ===')
    print(f'Categorías procesadas: {len(MAPPINGS)}')
    print(f'Imágenes finales: {sum(item["count"] for item in manifest.values())}')
    print(f'Peso fuentes seleccionadas: {total_source_bytes / 1024 / 1024:.1f} MB')
    print(f'Peso WebP final: {total_output_bytes / 1024 / 1024:.1f} MB')
    if total_source_bytes:
        print(f'Reducción: {(1 - total_output_bytes / total_source_bytes) * 100:.1f}%')
    print(f'Manifest JSON: {MANIFEST_JSON.relative_to(REPO_ROOT)}')
    print(f'Manifest TS: {MANIFEST_TS.relative_to(REPO_ROOT)}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
