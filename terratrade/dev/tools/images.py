"""Builds the site's raster images from the client's originals in dev/src-assets/ (gitignored).

Sources were extracted from the TerraTrade company-profile PDF. Output goes to public/assets/img/.
Requires Pillow (pip install pillow). Run: python3 tools/images.py  [--infographics: only the infographics]
"""
from pathlib import Path
from PIL import Image, ImageOps

HERE = Path(__file__).resolve().parent
SRC = HERE.parent / 'src-assets'
OUT = HERE.parent.parent / 'public' / 'assets' / 'img'
Q = 78

PRODUCTS = {  # id -> source file (PDF page/xref)
    'wheat-bran': 'p4_x43.png', 'soybean-meal': 'p4_x42.png', 'cotton-seed': 'p4_x41.png',
    'sesame': 'p5_x54.png', 'cashew': 'p5_x53.png', 'ginger': 'p5_x52.png',
    'soybean': 'p5_x55.png', 'hibiscus': 'p5_x51.png',
}
PHOTOS = {'hero': 'p1_x8.png', 'seedling': 'p9_x113.png', 'farmer': 'p11_x142.png'}
PARTNERS = {'nepc': 'p10_x128.png', 'dufil': 'p10_x129.png', 'fmn': 'p10_x126.png', 'olam-agri': 'p10_x127.png', 'bua-foods': 'p10_x125.png'}
# the client's own infographics (2048 x 2048 PNG, one per language) for the "At a glance" section
INFOGRAPHICS = {'en': 'infographic-en.png', 'ar': 'infographic-ar.png'}
INFOGRAPHIC_CROP = (48, 48, 2000, 2000)  # left, top, right, bottom


def opaque_crop(im):
    """Crop away the rounded corners baked into the PDF images: inset the opaque bbox until all 4 corners are solid."""
    if im.mode != 'RGBA':
        return im.convert('RGB')
    a = im.getchannel('A')
    l, t, r, b = a.point(lambda v: 255 if v >= 250 else 0).getbbox()
    r -= 1; b -= 1
    while r - l > 20 and b - t > 20 and min(a.getpixel(p) for p in ((l, t), (r, t), (l, b), (r, b))) < 250:
        l += 1; t += 1; r -= 1; b -= 1
    # one extra pixel to drop antialiased edge fringes
    return im.crop((l + 1, t + 1, r, b)).convert('RGB')


def save_set(im, name, widths, folder):
    (OUT / folder).mkdir(parents=True, exist_ok=True)
    made = []
    for w in widths:
        if w > im.width:
            continue
        h = round(im.height * w / im.width)
        im.resize((w, h), Image.LANCZOS).save(OUT / folder / f'{name}-{w}.webp', 'WEBP', quality=Q, method=6)
        made.append((w, h))
    if im.width not in [w for w, _ in made] and (not made or im.width < max(widths)):
        im.save(OUT / folder / f'{name}-{im.width}.webp', 'WEBP', quality=Q, method=6)
        made.append((im.width, im.height))
    print(f'{folder}/{name}:', ', '.join(f'{w}x{h}' for w, h in made))


def main():
    for pid, f in PRODUCTS.items():
        im = opaque_crop(Image.open(SRC / f))
        # square-ish centre crop so every card has the same 1:1 frame
        s = min(im.size)
        im = ImageOps.fit(im, (s, s), Image.LANCZOS)
        save_set(im, pid, [400, 750], 'products')

    for name, f in PHOTOS.items():
        im = opaque_crop(Image.open(SRC / f))
        widths = {'hero': [640, 1024, 1600, 2360], 'seedling': [480, 816], 'farmer': [480, 960, 1400]}[name]
        save_set(im, name, widths, 'photos')
        if name == 'hero':
            # phone crop: square around the farmer's hands (right-centre of the panorama)
            h = im.height
            cx = int(im.width * 0.53)
            sq = im.crop((cx - h // 2, 0, cx + h // 2, h))
            save_set(sq, 'hero-sq', [480, 690], 'photos')

    # Partner logos: trim transparent margins, pad onto a uniform transparent canvas, keep alpha (PNG + WebP).
    (OUT / 'partners').mkdir(parents=True, exist_ok=True)
    for name, f in PARTNERS.items():
        im = Image.open(SRC / f).convert('RGBA')
        bbox = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
        im = im.crop(bbox)
        H = 120
        im = im.resize((round(im.width * H / im.height), H), Image.LANCZOS)
        im.save(OUT / 'partners' / f'{name}.webp', 'WEBP', quality=88, method=6)
        print('partner', name, im.size)

    infographics()


def infographics():
    # Infographics: the generator stamps its name in the bottom-right corner (y 2025-2036 of 2048; the lowest
    # content ends at y 1963). Cropping a centred 1952px square drops that strip and keeps every element with a
    # 32-56px margin. Higher quality than the photos keeps the small print crisp; "-full" is the full-size link.
    (OUT / 'infographic').mkdir(parents=True, exist_ok=True)
    for old in (OUT / 'infographic').glob('*.webp'):
        old.unlink()
    for lang, f in INFOGRAPHICS.items():
        im = Image.open(SRC / f).crop(INFOGRAPHIC_CROP).convert('RGB')
        for w in (800, 1200, 1600):
            im.resize((w, round(im.height * w / im.width)), Image.LANCZOS).save(OUT / 'infographic' / f'{lang}-{w}.webp', 'WEBP', quality=84, method=6)
        im.save(OUT / 'infographic' / f'{lang}-full.webp', 'WEBP', quality=84, method=6)
        print('infographic', lang, im.size)


if __name__ == '__main__':
    import sys
    infographics() if '--infographics' in sys.argv else main()
