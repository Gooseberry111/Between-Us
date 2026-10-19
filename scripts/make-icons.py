"""
Draws the app icon: the two rings from the sign-in mark,
yours in rose and theirs in plum, overlapping.

  python scripts/make-icons.py

Writes assets/icon.png (iOS and Expo Go), the Android adaptive
foreground and monochrome layers, and the favicon. Drawn at 4x
and scaled down, so the edges are smooth.
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent / "assets"

ROSE = (217, 87, 122)
PLUM = (74, 45, 92)
GROUND = (245, 242, 248)

SCALE = 4


def rings(size, diameter, stroke, ground=None, mono=False):
    big = size * SCALE
    d = diameter * SCALE
    w = stroke * SCALE
    overlap = d * 0.34

    image = Image.new("RGBA", (big, big), ground + (255,) if ground else (0, 0, 0, 0))

    total = 2 * d - overlap
    left = (big - total) / 2
    top = (big - d) / 2

    for index, colour in enumerate((ROSE, PLUM)):
        x = left + index * (d - overlap)
        box = [x, top, x + d, top + d]

        layer = Image.new("RGBA", (big, big), (0, 0, 0, 0))
        draw = ImageDraw.Draw(layer)

        if mono:
            draw.ellipse(box, outline=(255, 255, 255, 255), width=int(w))
        else:
            fill = colour + (36 if index == 0 else 30,)
            draw.ellipse(box, fill=fill)
            draw.ellipse(box, outline=colour + (255,), width=int(w))

        image = Image.alpha_composite(image, layer)

    return image.resize((size, size), Image.LANCZOS)


def main():
    # iOS / Expo Go: full square, the system rounds the corners.
    rings(1024, 400, 40, ground=GROUND).save(ROOT / "icon.png")

    # Android adaptive: rings inside the 66% safe circle, the
    # ground comes from adaptiveIcon.backgroundColor.
    rings(1024, 300, 32).save(ROOT / "android-icon-foreground.png")
    rings(1024, 300, 34, mono=True).save(ROOT / "android-icon-monochrome.png")

    rings(196, 78, 9, ground=GROUND).save(ROOT / "favicon.png")

    print("icons written to", ROOT)


if __name__ == "__main__":
    main()
