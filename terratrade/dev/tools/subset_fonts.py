"""Trim the Arabic web fonts to standard Arabic (speed: they are the largest files on the Arabic pages).

Fontsource's "arabic" subsets carry the whole Arabic script: Persian/Urdu/Sindhi letters, Qur'anic marks and the
presentation-form blocks, ~43-47 KB each. The site (and anyone typing into its form) needs Modern Standard Arabic:
the base letters, diacritics, Arabic punctuation and digits, tatweel, ZWNJ/ZWJ. The subset keeps every OpenType
layout feature, so contextual letter forms (init/medi/fina), ligatures (lam-alef) and mark positioning are
pulled in by closure and joining is unaffected. Glyphs outside the set fall back to the system Arabic font.

Always subsets from the untouched originals in node_modules (idempotent), writes into public/assets/fonts.
Usage (needs fonttools + brotli):  python3 tools/subset_fonts.py
"""
import os
from fontTools import subset

HERE = os.path.dirname(os.path.abspath(__file__))
NM = os.path.join(HERE, '..', 'node_modules', '@fontsource')
OUT = os.path.join(HERE, '..', '..', 'public', 'assets', 'fonts')
FONTS = [
    ('noto-kufi-arabic', 'noto-kufi-arabic-arabic-500-normal.woff2'),
    ('noto-kufi-arabic', 'noto-kufi-arabic-arabic-700-normal.woff2'),
    ('ibm-plex-sans-arabic', 'ibm-plex-sans-arabic-arabic-400-normal.woff2'),
    ('ibm-plex-sans-arabic', 'ibm-plex-sans-arabic-arabic-600-normal.woff2'),
]
UNICODES = [
    *range(0x0600, 0x0660),   # Arabic: punctuation (، ؛ ؟), letters, tatweel, harakat, hamza forms
    *range(0x0660, 0x066E),   # Arabic-Indic digits, percent / decimal / thousands signs
    0x0670, 0x0671, 0x06CC,   # superscript alef, alef wasla, Farsi yeh (common in pasted text)
    0x200C, 0x200D, 0x200E, 0x200F,  # ZWNJ, ZWJ, LRM, RLM
    0x0020, 0x00A0, 0x002E, 0x002C, 0x003A, 0x0028, 0x0029, 0x00AB, 0x00BB,  # space, dots, brackets, « »
]

for pkg, name in FONTS:
    src = os.path.join(NM, pkg, 'files', name)
    dst = os.path.join(OUT, name)
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['*']      # keep every shaping feature (joining forms, ligatures, marks)
    opts.name_IDs = ['*']
    opts.notdef_outline = True
    opts.drop_tables += ['DSIG']
    font = subset.load_font(src, opts)
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=UNICODES)
    sub.subset(font)
    subset.save_font(font, dst, opts)
    print(f'{name}: {os.path.getsize(src) // 1024} KB -> {os.path.getsize(dst) // 1024} KB')
