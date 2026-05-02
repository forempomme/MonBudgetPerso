#!/usr/bin/env python3
"""
Génère tous les PNG nécessaires pour le PWA manifest et Android
depuis public/icon.svg

Usage:
  pip install cairosvg pillow
  python generate_icons.py
"""
import os
import sys

SIZES = [72, 96, 128, 144, 152, 192, 384, 512]
SVG_PATH  = "public/icon.svg"
OUT_DIR   = "public/icons"

def main():
    # Check deps
    try:
        import cairosvg
        from PIL import Image
    except ImportError:
        print("Installation des dépendances...")
        os.system(f"{sys.executable} -m pip install cairosvg pillow --quiet")
        import cairosvg
        from PIL import Image

    os.makedirs(OUT_DIR, exist_ok=True)

    for size in SIZES:
        out_path = f"{OUT_DIR}/icon-{size}.png"
        cairosvg.svg2png(
            url=SVG_PATH,
            write_to=out_path,
            output_width=size,
            output_height=size,
        )
        print(f"✓ {out_path} ({size}x{size})")

    # Also generate Android adaptive icon background (plain dark)
    from PIL import Image, ImageDraw
    bg = Image.new("RGBA", (512, 512), (8, 12, 18, 255))
    bg.save(f"{OUT_DIR}/ic_launcher_background.png")
    print(f"✓ ic_launcher_background.png")

    print("\nTous les icônes générés dans", OUT_DIR)

if __name__ == "__main__":
    main()
