#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import shutil
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
    "videos": "videos.zip",
}

ARGENIS_BACKUP_DIR = Path("/Volumes/backup JL/11977/!Recuperados 2024/recuperados/diseños/argenis grullon")
SEARCH_DIRS = [ARGENIS_BACKUP_DIR, ROOT, ROOT / "assets-source", Path.home() / "Downloads", Path.home() / "Desktop"]


def ensure_pillow():
    try:
        from PIL import Image, ImageOps  # noqa
    except Exception as exc:
        raise RuntimeError("Pillow no está disponible. Usa scripts/run-preview-adonisg-v1.sh.") from exc


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
    raise FileNotFoundError(f"No encontré {name}. También se buscó en {ARGENIS_BACKUP_DIR}.")


def by_fragment(root: Path, fragment: str, suffixes=(".jpg", ".jpeg", ".png")) -> Path:
    frag = fragment.lower()
    matches = [p for p in root.rglob("*") if p.is_file() and p.suffix.lower() in suffixes and frag in p.name.lower() and not p.name.startswith("._") and p.name != ".DS_Store"]
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
        im = im.resize((max(1, round(im.width * ratio)), max(1, round(im.height * ratio))), Image.Resampling.LANCZOS)
        left = max(0, (im.width - width) // 2); top = max(0, (im.height - height) // 2)
        im.crop((left, top, left + width, top + height)).save(dest, "JPEG", quality=quality, optimize=True, progressive=True)


def copy_exact(src: Path, dest: Path):
    dest.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(src, dest)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:12]


def write_series(root: Path, folder: str, items: list[tuple[str, str]], quality=76):
    for fragment, name in items:
        save_webp(by_fragment(root, fragment), OUT / "portfolio" / folder / name, 1280, quality)


def main():
    ensure_pillow()
    zips = {key: find_zip(name) for key, name in ZIP_NAMES.items()}
    print("▶ ZIPs localizados:")
    for key, path in zips.items(): print(f"  {key}: {path}")

    with tempfile.TemporaryDirectory(prefix="adonisg-assets-") as td:
        tmp = Path(td); roots = {}
        for key, path in zips.items():
            target = tmp / key; target.mkdir(parents=True, exist_ok=True)
            with zipfile.ZipFile(path) as zf: zf.extractall(target)
            roots[key] = target

        if OUT.exists():
            for child in OUT.iterdir():
                if child.name not in {"README.md", "asset-manifest.json"}:
                    shutil.rmtree(child) if child.is_dir() else child.unlink()

        copy_exact(by_fragment(roots["brand"], "LOGO BLANCO@2x"), OUT / "brand" / "logo-white.png")
        copy_exact(by_fragment(roots["brand"], "REDUCCION BLANCO@2x"), OUT / "brand" / "mark-white.png")

        photos, work, certs = roots["photos"], roots["work"], roots["certs"]
        hero = by_fragment(photos, "PHOTO-2026-07-27-11-34-00 (2)")
        cowboy = by_fragment(photos, "1.40.00")
        save_webp(hero, OUT / "hero" / "argenis-hero.webp", 1440, 80)
        save_webp(cowboy, OUT / "hero" / "argenis-manifesto.webp", 1280, 78)
        save_webp(cowboy, OUT / "hero" / "argenis-cowboy.webp", 1280, 78)

        # Galería propia de Argenis + slider inmersivo.
        portrait_items = [
            ("PHOTO-2026-07-27-11-34-00 (1)", "argenis-01.webp"),
            ("PHOTO-2026-07-27-11-34-00 (2)", "argenis-02.webp"),
            ("PHOTO-2026-07-27-11-34-00 (3)", "argenis-03.webp"),
            ("PHOTO-2026-07-27-11-34-00 (4)", "argenis-04.webp"),
            ("1.28.47", "argenis-05.webp"),
            ("1.40.10", "argenis-06.webp"),
        ]
        for fragment, name in portrait_items:
            save_webp(by_fragment(photos, fragment), OUT / "portraits" / name, 1280, 78)

        write_series(work, "beauty-fragrance", [("13-28-42","beauty-cover.webp"),("13-28-32","beauty-02.webp"),("13-28-58","beauty-03.webp"),("13-29-21","beauty-04.webp"),("13-33-22 (1)","beauty-05.webp")])
        write_series(work, "red-statement", [("1.21.51","red-cover.webp"),("1.21.22","red-02.webp"),("1.21.29","red-03.webp"),("1.21.37","red-04.webp"),("1.22.14","red-05.webp")])
        write_series(work, "noir", [("1.16.29","noir-cover.webp"),("1.16.44","noir-02.webp"),("1.16.53","noir-03.webp"),("1.17.00","noir-04.webp")])
        write_series(work, "couple-lifestyle", [("10-29-36 (2)","couple-cover.webp"),("10-29-36 (3)","couple-02.webp"),("10-29-36 (4)","couple-03.webp"),("10-29-36 (7)","couple-04.webp")])
        write_series(work, "evening", [("10-48-44.jpg","evening-cover.webp"),("10-48-44 (1)","evening-02.webp"),("10-48-44 (2)","evening-03.webp"),("10-48-44 (4)","evening-04.webp"),("10-48-44 (6)","evening-05.webp")])
        write_series(work, "mens-brand", [("08-20-01 (1)","mens-cover.webp"),("08-20-01 (2)","mens-02.webp"),("08-20-01.jpg","mens-03.webp"),("08-20-02","mens-04.webp")])

        # Prensa / apariciones verificables y materiales recibidos.
        save_webp(by_fragment(photos, "1.39.34"), OUT / "media" / "dlb-dmh-exito.webp", 1200, 78)
        save_webp(by_fragment(photos, "1.46.11"), OUT / "media" / "bazar-emprendedores.webp", 1200, 78)
        save_webp(by_fragment(work, "1.23.17"), OUT / "media" / "la-vitrina.webp", 1200, 78)
        save_webp(by_fragment(work, "1.41.47"), OUT / "media" / "el-janis.webp", 1200, 78)

        # Testimonio real recibido como captura de Instagram.
        save_webp(by_fragment(work, "1.37.50"), OUT / "testimonials" / "dr-hugo-maria.webp", 1400, 80)

        cert_files = sorted([p for p in certs.rglob("*") if p.is_file() and p.suffix.lower() in {".jpg", ".jpeg", ".png"} and not p.name.startswith("._") and p.name != ".DS_Store"])
        if len(cert_files) < 5: raise RuntimeError(f"Esperaba 5 certificaciones y encontré {len(cert_files)}")
        for idx, src in enumerate(cert_files[:5], start=1): save_webp(src, OUT / "certifications" / f"cert-{idx:02d}.webp", 1400, 80)

        save_jpeg(hero, OUT / "og" / "adonisg-og.jpg")

        video_files = sorted([p for p in roots["videos"].rglob("*") if p.is_file() and p.suffix.lower() in {".mp4", ".mov", ".m4v"} and not p.name.startswith("._")])
        for idx, src in enumerate(video_files[:3], start=1):
            copy_exact(src, OUT / "videos" / f"video-{idx:02d}{src.suffix.lower()}")
        print(f"▶ Videos fuente localizados: {len(video_files)} · integrados bajo demanda: {min(3,len(video_files))}")

    required = sorted([p.relative_to(OUT).as_posix() for p in OUT.rglob("*") if p.is_file() and p.name not in {"README.md", "asset-manifest.json"}])
    must_have = {"brand/logo-white.png","brand/mark-white.png","hero/argenis-hero.webp","portraits/argenis-01.webp","portraits/argenis-06.webp","portfolio/beauty-fragrance/beauty-cover.webp","portfolio/red-statement/red-cover.webp","portfolio/noir/noir-cover.webp","portfolio/couple-lifestyle/couple-cover.webp","portfolio/evening/evening-cover.webp","portfolio/mens-brand/mens-cover.webp","media/dlb-dmh-exito.webp","media/la-vitrina.webp","testimonials/dr-hugo-maria.webp","certifications/cert-01.webp","og/adonisg-og.jpg","videos/video-01.mp4"}
    missing = sorted(must_have.difference(required))
    if missing: raise RuntimeError("Assets faltantes: " + ", ".join(missing))

    total = sum((OUT / rel).stat().st_size for rel in required)
    print(f"✓ {len(required)} assets finales preparados · {total/1024/1024:.2f} MiB")
    for rel in required:
        p = OUT / rel; print(f"  ✓ {rel} · {p.stat().st_size/1024:.1f} KiB · sha {sha(p)}")
    print("✓ Logos originales copiados sin alteración de píxeles.")


if __name__ == "__main__": main()
