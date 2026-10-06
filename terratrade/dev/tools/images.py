"""Builds the site's raster images from the client's originals in dev/src-assets/ (gitignored).

Sources were extracted from the TerraTrade company-profile PDF; the charcoal, in-shell cashew and contact photos come
from the client's October 2026 revision notes, upscaled 4x with Real-ESRGAN (see README, "Photos"); wheat bran, sesame,
soybean and hibiscus are the photos from the client's final comments (October 2026). Output goes to
public/assets/img/.
Requires Pillow (pip install pillow). Run: python3 tools/images.py [name ...]  (names: only rebuild those, e.g. charcoal contact)
"""
from pathlib import Path
from PIL import Image, ImageOps

HERE = Path(__file__).resolve().parent
SRC = HERE.parent / 'src-assets'
OUT = HERE.parent.parent / 'public' / 'assets' / 'img'
Q = 78

PRODUCTS = {  # output name -> source file (PDF page/xref, or the upscaled revision photos)
    'wheat-bran': 'wheat-bran.png', 'sesame': 'sesame.png', 'soybean': 'soybean.png', 'hibiscus': 'hibiscus.png',
    'cashew-raw': 'cashew-inshell.png', 'charcoal': 'charcoal.png',
}
PHOTOS = {'hero': 'p1_x8.png', 'farmer': 'p11_x142.png', 'contact': 'contact.png'}
PARTNERS = {'nepc': 'p10_x128.png', 'dufil': 'p10_x129.png', 'fmn': 'p10_x126.png', 'olam-agri': 'p10_x127.png', 'bua-foods': 'p10_x125.png'}


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


def main(only=()):
    want = lambda n: not only or n in only
    for pid, f in PRODUCTS.items():
        if not want(pid):
            continue
        im = opaque_crop(Image.open(SRC / f))
        # square-ish centre crop so every card has the same 1:1 frame
        s = min(im.size)
        im = ImageOps.fit(im, (s, s), Image.LANCZOS)
        save_set(im, pid, [400, 800], 'products')

    for name, f in PHOTOS.items():
        if not want(name):
            continue
        im = opaque_crop(Image.open(SRC / f))
        widths = {'hero': [640, 1024, 1600, 2360], 'farmer': [480, 960, 1400], 'contact': [480, 880, 1200]}[name]
        save_set(im, name, widths, 'photos')

    # Partner logos: trim transparent margins, pad onto a uniform transparent canvas, keep alpha (PNG + WebP).
    (OUT / 'partners').mkdir(parents=True, exist_ok=True)
    for name, f in PARTNERS.items():
        if not want(name):
            continue
        im = Image.open(SRC / f).convert('RGBA')
        bbox = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
        im = im.crop(bbox)
        H = 120
        im = im.resize((round(im.width * H / im.height), H), Image.LANCZOS)
        im.save(OUT / 'partners' / f'{name}.webp', 'WEBP', quality=88, method=6)
        print('partner', name, im.size)


if __name__ == '__main__':
    import sys
    main(set(sys.argv[1:]))
