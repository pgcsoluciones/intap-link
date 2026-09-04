#!/usr/bin/env python3
from __future__ import annotations

import tempfile
import zipfile
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path.home() / "Desktop" / "intap-link-universal-bilingual-audit"
ASSET_SOURCE = ROOT / "assets-source"
BACKUP = Path("/Volumes/backup JL/11977/!Recuperados 2024/recuperados/diseños/argenis grullon")
SEARCH_DIRS = [ROOT, ASSET_SOURCE, Path.home() / "Downloads", Path.home() / "Desktop", BACKUP]
TARGET = ASSET_SOURCE / "logo-ngro-hero-sin-fondo.png"


def find_named(*names: str) -> Path | None:
    wanted = {n.lower() for n in names}
    for base in SEARCH_DIRS:
        if not base.exists():
            continue
        for name in names:
            direct = base / name
            if direct.is_file():
                return direct
        for p in base.glob("**/*"):
            if p.is_file() and p.name.lower() in wanted:
                return p
    return None


def find_brand_zip() -> Path:
    name = "identidad linea grafica.zip"
    for base in SEARCH_DIRS:
        if not base.exists():
            continue
        direct = base / name
        if direct.is_file():
            return direct
        for p in base.glob(f"**/{name}"):
            if p.is_file():
                return p
    raise FileNotFoundError(f"No encontré {name}")


def find_fragment(root: Path, fragment: str) -> Path:
    frag = fragment.lower().replace("\\@", "@")
    matches = [
        p for p in root.rglob("*")
        if p.is_file()
        and p.suffix.lower() in {".png", ".jpg", ".jpeg"}
        and frag in p.name.lower().replace("\\@", "@")
        and not p.name.startswith("._")
    ]
    if not matches:
        raise FileNotFoundError(fragment)
    return sorted(matches)[0]


def make_black_transparent(src: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(src) as im:
        im = ImageOps.exif_transpose(im).convert("RGBA")
        alpha = im.getchannel("A")
        black = Image.new("RGBA", im.size, (0, 0, 0, 0))
        black.putalpha(alpha)
        black.thumbnail((1400, 1400), Image.Resampling.LANCZOS)
        black.save(dest, "PNG", optimize=True)


def main() -> None:
    # Prefer the exact user-supplied transparent black logo when it exists locally.
    supplied = find_named("logo-ngro-hero-sin-fondo.png", "LOGO NEGRO -sinfondo-01.png")
    if supplied and supplied.resolve() != TARGET.resolve():
        TARGET.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(supplied) as im:
            im = ImageOps.exif_transpose(im).convert("RGBA")
            im.thumbnail((1400, 1400), Image.Resampling.LANCZOS)
            im.save(TARGET, "PNG", optimize=True)
        print(f"✓ Logo negro transparente localizado: {supplied}")
        return
    if TARGET.is_file():
        print(f"✓ Logo negro transparente listo: {TARGET}")
        return

    # Fallback: derive black pixels from the official white transparent logo,
    # preserving its exact alpha/silhouette instead of depending on a missing
    # 'LOGO NEGRO@2x' filename inside the historical ZIP.
    brand_zip = find_brand_zip()
    with tempfile.TemporaryDirectory(prefix="adonisg-logo-") as td:
        tmp = Path(td)
        with zipfile.ZipFile(brand_zip) as zf:
            zf.extractall(tmp)
        white = find_fragment(tmp, "LOGO BLANCO@2x")
        make_black_transparent(white, TARGET)
    print(f"✓ Logo negro transparente derivado de identidad oficial: {TARGET}")


if __name__ == "__main__":
    main()
