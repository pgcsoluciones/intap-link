#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import os
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path.home() / "Desktop" / "intap-link-universal-bilingual-audit"
OUT = ROOT / "web" / "public" / "assets" / "adonisg"

ZIP_NAMES = {
    "photos": "Argenis fotos.zip",
    "certs": "certificaciones.zip",
    "brand": "identidad linea grafica.zip",
    "work": "trabajos argenis.zip",
}

SEARCH_DIRS = [
    ROOT,
    ROOT / "assets-source",
    Path.home() / "Downloads",
    Path.home() / "Desktop",
]


def ensure_pillow():
    try:
        from PIL import Image, ImageOps  # noqa
        return
    except Exception:
        print("▶ Pillow no está instalado; instalando dependencia local para optimizar imágenes...")
        subprocess.run([sys.executable, "-m", "pip", "install", "--user", "Pillow"], check=True)


def find_zip(name: str) -> Path:
    for base in SEARCH_DIRS:
        if not base.exists():
            continue
        direct = base / name
        if direct.exists():
            return direct
        for candidate in base.glob(f"**/{name}"):
            if candidate.is_file():
                return candidate
    raise FileNotFoundError(
        f"No encontré {name}. Colócalo en ~/Downloads, ~/Desktop o {ROOT}/assets-source y vuelve a ejecutar."
    )


def first(root: Path, pattern: str) -> Path:
    matches = [p for p in root.rglob(pattern) if p.is_file() and not p.name.startswith("._")]
    if not matches:
        raise FileNotFoundError(f"No encontré recurso: {pattern}")
    return sorted(matches)[0]


def by_fragment(root: Path, fragment: str, suffixes=(".jpg", ".jpeg", ".png")) -> Path:
    frag = fragment.lower()
    matches = [p for p in root.rglob("*") if p.is_file() and p.suffix.lower() in suffixes and frag in p.name.lower() and not p.name.startswith("._")]
    if not matches:
        raise FileNotFoundError(f"No encontré recurso con fragmento: {fragment}")
    return sorted(matches)[0]


def save_webp(src: Path, dest: Path, max_side: int = 1280, quality: int = 76):
    from PIL import Image, ImageOps
    dest.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(src) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")
        im.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
        im.save(dest, "WEBP", quality=quality, method=6)


def save_jpeg(src: Path, dest: Path, width: int = 1200, height: int = 630, quality: int = 82):
    from PIL import Image, ImageOps
    dest.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(src) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")
        ratio = max(width / im.width, height / im.height)
        size = (max(1, round(im.width * ratio)), max(1, round(im.height * ratio)))
        im = im.resize(size, Image.Resampling.LANCZOS)
        left = max(0, (im.width - width) // 2)
        top = max(0, (im.height - height) // 2)
        im = im.crop((left, top, left + width, top + height))
        im.save(dest, "JPEG", quality=quality, optimize=True, progressive=True)


def copy_exact(src: Path, dest: Path):
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:12]


def main():
    ensure_pillow()
    zips = {key: find_zip(name) for key, name in ZIP_NAMES.items()}
    print("▶ ZIPs localizados:")
    for key, path in zips.items():
        print(f"  {key}: {path}")

    with tempfile.TemporaryDirectory(prefix="adonisg-assets-") as td:
        tmp = Path(td)
        roots = {}
        for key, path in zips.items():
            target = tmp / key
            target.mkdir(parents=True, exist_ok=True)
            with zipfile.ZipFile(path) as zf:
                zf.extractall(target)
            roots[key] = target

        # Limpieza únicamente del namespace del perfil especial.
        if OUT.exists():
            for child in OUT.iterdir():
                if child.name not in {"README.md", "asset-manifest.json"}:
                    if child.is_dir(): shutil.rmtree(child)
                    else: child.unlink()

        # Identidad gráfica: COPIA EXACTA, no redibujo ni modificación.
        copy_exact(by_fragment(roots["brand"], "LOGO BLANCO@2x"), OUT / "brand" / "logo-white.png")
        copy_exact(by_fragment(roots["brand"], "REDUCCION BLANCO@2x"), OUT / "brand" / "mark-white.png")

        photos = roots["photos"]
        work = roots["work"]
        certs = roots["certs"]

        hero = by_fragment(photos, "PHOTO-2026-07-27-11-34-00 (2)")
        cowboy = by_fragment(photos, "1.40.00")
        save_webp(hero, OUT / "hero" / "argenis-hero.webp", 1440, 80)
        save_webp(cowboy, OUT / "hero" / "argenis-manifesto.webp", 1280, 78)
        save_webp(cowboy, OUT / "hero" / "argenis-cowboy.webp", 1280, 78)

        # Beauty & fragrance editorial.
        save_webp(by_fragment(work, "13-28-42"), OUT / "portfolio" / "beauty-fragrance" / "beauty-cover.webp")
        save_webp(by_fragment(work, "13-28-32"), OUT / "portfolio" / "beauty-fragrance" / "beauty-02.webp")
        save_webp(by_fragment(work, "13-28-58"), OUT / "portfolio" / "beauty-fragrance" / "beauty-03.webp")
        save_webp(by_fragment(work, "13-29-21"), OUT / "portfolio" / "beauty-fragrance" / "beauty-04.webp")

        # Portadas editoriales: curaduría inicial, no galería infinita.
        save_webp(by_fragment(work, "1.21.51"), OUT / "portfolio" / "red-statement" / "red-cover.webp")
        save_webp(by_fragment(work, "1.16.29"), OUT / "portfolio" / "noir" / "noir-cover.webp")
        save_webp(by_fragment(work, "10-29-36 (2)"), OUT / "portfolio" / "couple-lifestyle" / "couple-cover.webp")
        save_webp(by_fragment(work, "10-48-44.jpg"), OUT / "portfolio" / "evening" / "evening-cover.webp")
        save_webp(by_fragment(work, "08-20-01 (1)"), OUT / "portfolio" / "mens-brand" / "mens-cover.webp")

        # Media / apariciones verificadas en los recursos entregados.
        media_a = by_fragment(photos, "1.39.34")
        media_b = by_fragment(photos, "1.46.11")
        save_webp(media_a, OUT / "media" / "dlb-dmh-exito.webp", 1200, 78)
        save_webp(media_b, OUT / "media" / "bazar-emprendedores.webp", 1200, 78)

        cert_files = sorted([p for p in certs.rglob("*") if p.is_file() and p.suffix.lower() in {".jpg", ".jpeg", ".png"} and not p.name.startswith("._")])
        if len(cert_files) < 5:
            raise RuntimeError(f"Esperaba 5 certificaciones y encontré {len(cert_files)}")
        for idx, src in enumerate(cert_files[:5], start=1):
            save_webp(src, OUT / "certifications" / f"cert-{idx:02d}.webp", 1400, 80)

        save_jpeg(hero, OUT / "og" / "adonisg-og.jpg")

    required = [
        "brand/logo-white.png", "brand/mark-white.png",
        "hero/argenis-hero.webp", "hero/argenis-manifesto.webp", "hero/argenis-cowboy.webp",
        "portfolio/beauty-fragrance/beauty-cover.webp", "portfolio/beauty-fragrance/beauty-02.webp",
        "portfolio/beauty-fragrance/beauty-03.webp", "portfolio/beauty-fragrance/beauty-04.webp",
        "portfolio/red-statement/red-cover.webp", "portfolio/noir/noir-cover.webp",
        "portfolio/couple-lifestyle/couple-cover.webp", "portfolio/evening/evening-cover.webp",
        "portfolio/mens-brand/mens-cover.webp", "media/dlb-dmh-exito.webp", "media/bazar-emprendedores.webp",
        *[f"certifications/cert-{i:02d}.webp" for i in range(1,6)], "og/adonisg-og.jpg",
    ]
    missing = [rel for rel in required if not (OUT / rel).exists()]
    if missing:
        raise RuntimeError("Assets faltantes: " + ", ".join(missing))

    total = sum((OUT / rel).stat().st_size for rel in required)
    print(f"✓ {len(required)} assets finales preparados · {total/1024:.1f} KiB")
    for rel in required:
        p = OUT / rel
        print(f"  ✓ {rel} · {p.stat().st_size/1024:.1f} KiB · sha {sha(p)}")
    print("✓ Logos copiados sin alteración de píxeles.")

if __name__ == "__main__":
    main()
