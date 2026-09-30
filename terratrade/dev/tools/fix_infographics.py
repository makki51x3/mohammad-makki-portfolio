"""Corrects the text errors in the client's generated infographics; tools/images.py applies it before resizing.

Arabic: every corrected word already exists elsewhere on the sheet, in the generator's own face, so the fix moves
those original glyphs (as anti-aliased ink masks on a cleaned patch) rather than re-typesetting them:
  - «آسق آسيا» becomes «شرق آسيا» («شرق» is cut from «الشرق» just after the lam, where the sheen starts), and it
    trades places with «الشرق الأوسط», so the timeline reads Middle East (active) → East Asia → expansion plans,
    as the sheet's own table and the site say;
  - food row: «السمسم» and «الكركديه» sat under each other's icons; swapped;
  - feed row: the garbled «تجروتي» and a misplaced «بذور القطن» become «بذور القطن» / «نخالة القمح» / «كسب الصويا»
    under the cotton / wheat / soybean-pod icons, in two lines (the chart's own «كسب الصويا» label style).
English (new wording, typeset in Roboto, the sheet's own face: Regular for body text, Bold for headings, found by
pixel-matching the original lines, which it re-sets within 1% of their width; size and baseline measured from them):
  - "Exporting oliseeds ..." (a typo, and five of the eight commodities) lists all eight;
  - "ACTIVE MIDDLE EAST & EAST ASIA ROUTES" becomes "MIDDLE EAST TODAY, EAST ASIA NEXT" (East Asia is expansion).
Coordinates are in the 2048 x 2048 originals. Needs Pillow (with raqm) and @fontsource/roboto (a dev dependency).
Preview: python3 tools/fix_infographics.py  (writes dev/out/infographic-{en,ar}-fixed.png)
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROBOTO = str(Path(__file__).resolve().parent.parent / 'node_modules/@fontsource/roboto/files/roboto-latin-{}-normal.woff2')


def bg_of(im, box):
    """median colour of a 3px ring just outside box: the paper the patch has to match"""
    l, t, r, b = box
    ring = [im.getpixel((x, y)) for x in range(l - 3, r + 3, 2) for y in (t - 3, t - 2, b + 1, b + 2)]
    ring += [im.getpixel((x, y)) for y in range(t, b, 2) for x in (l - 3, l - 2, r + 1, r + 2)]
    return tuple(sorted(p[i] for p in ring)[len(ring) // 2] for i in range(3))


def ink_mask(im, box, bg, ink):
    """anti-aliased coverage of dark ink over paper, as an L mask"""
    lb, li = sum(bg) / 3, sum(ink) / 3
    lut = [max(0, min(255, round(255 * (lb - v) / (lb - li)))) for v in range(256)]
    return im.crop(box).convert('L').point(lut)


def trim(mask):
    """cut a mask to its ink columns, keeping its rows (so the baseline stays where it was)"""
    l, _, r, _ = mask.point(lambda v: 255 if v > 60 else 0).getbbox()
    return mask.crop((l, 0, r, mask.height))


def baseline(mask):
    """Arabic sits on a strong horizontal stroke: the row with the most ink"""
    rows = [sum(mask.crop((0, y, mask.width, y + 1)).getdata()) for y in range(mask.height)]
    return rows.index(max(rows))


def cover(im, box):
    col = bg_of(im, box)
    ImageDraw.Draw(im).rectangle((box[0], box[1], box[2] - 1, box[3] - 1), fill=col)


def put(im, mask, x, y, ink):
    im.paste(Image.new('RGB', mask.size, ink), (round(x), round(y)), mask)


def fix_ar(im):
    im = im.copy()
    INK = (3, 2, 0)
    grab = lambda box: trim(ink_mask(im, box, bg_of(im, box), INK))

    # --- markets timeline: labels band y 1390-1446, the parenthetical band y 1446-1492 ---
    LB, PB = (1390, 1446), (1446, 1492)
    sharq_full = grab((1523, LB[0], 1627, LB[1]))    # «الشرق»
    awsat = grab((1390, LB[0], 1515, LB[1]))
    sharq = grab((1523, LB[0], 1602, LB[1]))          # «ال» (alef + lam, x 1602-1627) left behind
    asia = grab((1798, LB[0], 1873, LB[1]))
    paren = grab((1670, PB[0], 1960, PB[1]))
    cover(im, (1385, LB[0], 1966, LB[1]))
    cover(im, (1664, PB[0], 1966, PB[1]))
    gap = 13
    # right slot, right-aligned to the column edge like the original: «الشرق الأوسط»
    x = 1958 - sharq_full.width
    put(im, sharq_full, x, LB[0], INK)
    put(im, awsat, x - gap - awsat.width, LB[0], INK)
    # middle slot, centred under the green dot (x 1510): «شرق آسيا» and its country list
    w = asia.width + gap + sharq.width
    put(im, sharq, 1510 + w / 2 - sharq.width, LB[0], INK)
    put(im, asia, 1510 - w / 2, LB[0], INK)
    put(im, paren, 1510 - paren.width / 2, PB[0], INK)

    # --- food row (band y 894-941): hibiscus icon centre x 1906, sesame seeds icon centre x 1686 ---
    FB = (894, 941)
    karkade, simsim = grab((1628, FB[0], 1737, FB[1])), grab((1845, FB[0], 1960, FB[1]))
    cover(im, (1626, FB[0], 1740, FB[1]))
    cover(im, (1843, FB[0], 1962, FB[1]))
    put(im, karkade, 1906 - karkade.width / 2, FB[0], INK)
    put(im, simsim, 1686 - simsim.width / 2, FB[0], INK)

    # --- feed row (band y 1092-1144) → two lines: cotton x 1912, wheat x 1790, soybean pods x 1660 ---
    RB = (1092, 1144)
    words = {k: grab((l, RB[0], r, RB[1])) for k, (l, r) in
             {'qutn': (1572, 1652), 'buthur': (1655, 1711), 'qamh': (1719, 1795), 'nukhala': (1798, 1861)}.items()}
    base = baseline(words['nukhala'])
    # «كسب» / «الصويا» from the chart label (drawn a touch larger): scaled to the row's letter height
    kasb_m, soya_m = ink_mask(im, (1105, 1044, 1202, 1092), bg_of(im, (1105, 1044, 1202, 1092)), INK), \
        ink_mask(im, (1102, 1094, 1204, 1146), bg_of(im, (1102, 1094, 1204, 1146)), INK)
    k = alef_height(words['qutn']) / alef_height(trim(soya_m))
    kasb, soya = (scale(trim(m), k) for m in (kasb_m, soya_m))
    cover(im, (1566, RB[0], 1964, RB[1]))
    PITCH = 38
    for cx, top, bottom in ((1912, words['buthur'], words['qutn']), (1790, words['nukhala'], words['qamh']), (1660, kasb, soya)):
        for i, m in enumerate((top, bottom)):
            put(im, m, cx - m.width / 2, RB[0] + base - baseline(m) + i * PITCH, INK)
    return im


def alef_height(mask):
    """height from the top of the tallest letter (alef / lam) to the baseline"""
    top = mask.point(lambda v: 255 if v > 60 else 0).getbbox()[1]
    return baseline(mask) - top


def scale(mask, k):
    return mask.resize((max(1, round(mask.width * k)), max(1, round(mask.height * k))), Image.LANCZOS)


def typeset(im, lines, x, base, pitch, weight, size, ink, max_w):
    """set lines in Roboto from a measured first baseline, one pitch apart"""
    font = ImageFont.truetype(ROBOTO.format(weight), size)
    d = ImageDraw.Draw(im)
    for i, line in enumerate(lines):
        w = font.getlength(line)
        assert w <= max_w, f'"{line}" is {w:.0f}px, wider than {max_w}px'
        d.text((x, base + i * pitch), line, font=font, fill=ink, anchor='ls')


def fix_en(im):
    im = im.copy()
    # "8 key commodities" paragraph: Regular 29.4px (cap height 22), baselines 805 / 838 (pitch 33) at x 1308;
    # the orange 8 above ends at y 750, nothing below until the divisions box
    cover(im, (1300, 778, 1968, 905))
    typeset(im, ['Oilseeds, food crops and feed ingredients:',
                 'Sesame, Cashew, Ginger, Hibiscus, Soybean,',
                 'Soybean Meal, Wheat Bran and Cotton Seed.'], 1308, 805, 33, 400, 29.4, (4, 4, 4), 650)
    # markets heading: Bold 46.8px (cap height 35), baselines 1817 / 1868 at x 1345; the shapes above end at y 1744,
    # the text below starts at y 1890
    cover(im, (1335, 1770, 1968, 1880))
    typeset(im, ['MIDDLE EAST TODAY,', 'EAST ASIA NEXT'], 1345, 1817, 51, 700, 46.8, (1, 1, 1), 610)
    return im


def fixed(lang, im):
    return (fix_ar if lang == 'ar' else fix_en)(im.convert('RGB'))


if __name__ == '__main__':
    here = Path(__file__).resolve().parent
    out = here.parent / 'out'
    out.mkdir(exist_ok=True)
    for lang in ('en', 'ar'):
        fixed(lang, Image.open(here.parent / 'src-assets' / f'infographic-{lang}.png')).save(out / f'infographic-{lang}-fixed.png')
        print('wrote', out / f'infographic-{lang}-fixed.png')
