"""Runtime copies of the big PNG sprite sheets: python3 tools/build-webp.py

The PNGs in assets/sprites/ stay the masters (the build tools write them and the tests read
them); the game loads these lossless WebP copies instead, pixel for pixel the same and about
45% smaller, so the game is ready to play sooner. tools/build-personality.py and
tools/build-mishap.py run this after they rebuild a sheet, and tests/loading.py checks every
copy still matches its PNG.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SHEETS = ['popo-personality', 'popo-mishap', 'swiftee-personality', 'swiftee-front-personality']


def build(names=SHEETS):
    for name in names:
        png = ROOT / 'assets/sprites' / f'{name}.png'
        webp = png.with_suffix('.webp')
        Image.open(png).convert('RGBA').save(webp, 'WEBP', lossless=True, quality=100, method=6, exact=True)
        print(f'{webp.relative_to(ROOT)}: {png.stat().st_size // 1024} KB PNG -> {webp.stat().st_size // 1024} KB', flush=True)


if __name__ == '__main__':
    build()
