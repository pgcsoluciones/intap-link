#!/usr/bin/env python3
from __future__ import annotations

import shutil
import tempfile
import zipfile
from pathlib import Path

from PIL import Image, ImageChops, ImageOps, ImageStat

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


def _corner_luminance(gray: Image.Image) -> float:
    w, h = gray.size
    sw = max(4, min(w // 12, 80))
    sh = max(4, min(h // 12, 80))
    crops = [
        gray.crop((0, 0, sw, sh)),
        gray.crop((w - sw, 0, w, sh)),
        gray.crop((0, h - sh, sw, h)),
        gray.crop((w - sw, h - sh, w, h)),
    ]
    return sum(ImageStat.Stat(c).mean[0] for c in crops) / len(crops)


def make_black_transparent(src: Path, dest: Path) -> None:
    """Extract the contrasting artwork from an opaque source and render it black.

    The official identity exports can arrive as white artwork on black OR black
    artwork on white. We detect the canvas from the corners and build alpha from
    the contrast against that canvas. This avoids both failure modes: an opaque
    black rectangle and an inverted transparent logo.
    """
    dest.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(src) as im:
        rgba = ImageOps.exif_transpose(im).convert("RGBA")
        source_alpha = rgba.getchannel("A")
        gray = ImageOps.grayscale(rgba.convert("RGB"))
        bg = _corner_luminance(gray)

        # Dark background => light artwork: alpha follows luminance.
        # Light background => dark artwork: alpha follows inverted luminance.
        mask = gray if bg < 128 else ImageOps.invert(gray)
        # Remove weak background noise while preserving antialiased edges.
        mask = mask.point(lambda p: 0 if p < 18 else min(255, round((p - 18) * 255 / 237)))
        effective_alpha = ImageChops.multiply(source_alpha, mask)

        bbox = effective_alpha.getbbox()
        if not bbox:
            raise RuntimeError("No se detectó arte útil en el logo fuente")

        # Crop transparent margins so CSS sizes the actual logo, not the old canvas.
        pad = 12
        left = max(0, bbox[0] - pad)
        top = max(0, bbox[1] - pad)
        right = min(rgba.width, bbox[2] + pad)
        bottom = min(rgba.height, bbox[3] + pad)
        effective_alpha = effective_alpha.crop((left, top, right, bottom))

        black = Image.new("RGBA", effective_alpha.size, (0, 0, 0, 0))
        black.putalpha(effective_alpha)
        black.thumbnail((1400, 1400), Image.Resampling.LANCZOS)

        alpha = black.getchannel("A")
        lo, hi = alpha.getextrema()
        bbox2 = alpha.getbbox()
        coverage = 0.0
        if bbox2:
            nz = sum(1 for p in alpha.getdata() if p > 8)
            coverage = nz / (alpha.width * alpha.height)
        if hi == 0 or coverage <= 0.01 or coverage >= 0.92:
            raise RuntimeError(
                f"Extracción de logo inválida (alpha={lo}..{hi}, cobertura={coverage:.1%}, fondo={bg:.1f})"
            )
        black.save(dest, "PNG", optimize=True)
        print(f"✓ Fondo detectado luminancia={bg:.1f} · cobertura útil={coverage:.1%}")


def main() -> None:
    exact = find_named("logo-ngro-debajo-hero-sin-fondo.png")
    if exact:
        TARGET.parent.mkdir(parents=True, exist_ok=True)
        if exact.resolve() != TARGET.resolve():
            shutil.copy2(exact, TARGET)
        print(f"✓ Logo exacto debajo del hero preservado como PNG: {exact}")
        return

    supplied = find_named("logo-ngro-hero-sin-fondo.png", "LOGO NEGRO -sinfondo-01.png")
    if supplied and supplied.resolve() != TARGET.resolve():
        TARGET.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(supplied, TARGET)
        print(f"✓ Logo negro transparente localizado: {supplied}")
        return
    if TARGET.is_file():
        print(f"✓ Logo negro transparente listo: {TARGET}")
        return

    brand_zip = find_brand_zip()
    with tempfile.TemporaryDirectory(prefix="adonisg-logo-") as td:
        tmp = Path(td)
        with zipfile.ZipFile(brand_zip) as zf:
            zf.extractall(tmp)
        # Prefer a real black export if present. If not, extract from white export.
        try:
            source = find_fragment(tmp, "LOGO NEGRO@2x")
        except FileNotFoundError:
            source = find_fragment(tmp, "LOGO BLANCO@2x")
        make_black_transparent(source, TARGET)
    print(f"✓ Logo negro transparente derivado correctamente de identidad oficial: {TARGET}")


if __name__ == "__main__":
    main()
