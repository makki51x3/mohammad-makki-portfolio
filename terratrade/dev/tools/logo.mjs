// Vectorises the TerraTrade logo (dev/src-assets/logo.png, 1042px, extracted from the company profile PDF)
// into clean SVGs: the tile is rebuilt as a true rounded rect, petals and wordmark are traced with potrace.
// Each petal becomes its own <path class="petal"> so the site can animate them.
// Output: public/assets/img/brand/{logo.svg, mark.svg} and dev/out/logo/parts.json (for inline use).
import Jimp from 'jimp';
import potrace from 'potrace';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, '..', 'src-assets', 'logo.png');
const OUT = join(here, '..', '..', 'public', 'assets', 'img', 'brand');
const TMP = join(here, '..', 'out', 'logo');
mkdirSync(OUT, { recursive: true }); mkdirSync(TMP, { recursive: true });

export const COLORS = { green: '#21401C', amber: '#FFA612', white: '#FFFFFF' };
const REF = { g: [33, 64, 28], a: [255, 166, 18], w: [255, 255, 255] };
const S = 4; // trace at 3x for smoother curves

const img = await Jimp.read(SRC);
const { width: W, height: H } = img.bitmap;
const masks = Object.fromEntries(['g', 'a', 'w'].map(k => [k, new Jimp(W, H, 0xffffffff)]));
img.scan(0, 0, W, H, (x, y, i) => {
  const d = img.bitmap.data; if (d[i + 3] < 128) return;
  // Strict rules so antialiased green/white blends never read as amber (keeps the thin gaps between petals green).
  const [r, g, b] = [d[i], d[i + 1], d[i + 2]];
  const k = r > 215 && g > 215 && b > 215 ? 'w' : r > 200 && g > 110 && g < 210 && b < 90 ? 'a' : 'g';
  masks[k].setPixelColor(0x000000ff, x, y);
});
// Tile bounds from the green mask left of the wordmark.
let tl = [W, H, 0, 0];
masks.g.scan(0, 0, 430, H, (x, y, i) => { if (masks.g.bitmap.data[i] === 0) { tl = [Math.min(tl[0], x), Math.min(tl[1], y), Math.max(tl[2], x), Math.max(tl[3], y)]; } });
const tile = { x: tl[0], y: tl[1], w: tl[2] - tl[0] + 1, h: tl[3] - tl[1] + 1 };
// Wordmark = green pixels right of the tile.
const word = masks.g.clone(); word.scan(0, 0, 430, H, (x, y, i) => word.bitmap.data.fill(255, i, i + 3));

async function trace(j, name, blur = 0) {
  const f = join(TMP, `${name}.png`);
  // Blurring before the threshold smooths pixel stair-steps (much smaller paths); only used for the large wordmark
  // shapes — the thin gaps between petals would close up.
  const up = j.clone().resize(W * S, H * S, blur ? Jimp.RESIZE_BILINEAR : Jimp.RESIZE_BICUBIC);
  await (blur ? up.blur(blur).threshold({ max: 128 }) : up.threshold({ max: 160 })).writeAsync(f);
  return new Promise((res, rej) => {
    const p = new potrace.Potrace();
    p.setParameters({ turdSize: 80, optTolerance: 0.4, alphaMax: 1, threshold: 128, blackOnWhite: true });
    p.loadImage(f, e => (e ? rej(e) : res(p.getPathTag().match(/ d="([^"]+)"/)[1])));
  });
}
// Rescale path numbers to 1x, shift into the given origin, round to 0.1.
const norm = (d, ox, oy) => { let n = 0; return d.replace(/-?\d+(\.\d+)?/g, v => { const r = (+v / S) - (n++ % 2 ? oy : ox); return (Math.round(r * 10) / 10).toString(); }).replace(/\s*,\s*/g, ' ').replace(/\s+/g, ' ').trim(); };
const split = d => d.split(/(?=M)/).map(s => s.trim()).filter(Boolean);

const [dWord, dAmber, dWhite] = [await trace(word, 'word', 3), await trace(masks.a, 'amber'), await trace(masks.w, 'white')];
const R = Math.round(tile.w * 0.115);
const ox = tile.x, oy = Math.min(tile.y, 389);
const box = { w: 897 - ox, h: 653 - oy };
const parts = {
  tile: { x: 0, y: tile.y - oy, w: tile.w, h: tile.h, r: R },
  amber: split(norm(dAmber, ox, oy)),
  white: split(norm(dWhite, ox, oy)),
  word: norm(dWord, ox, oy),
  box,
};
const petals = (arr, fill) => arr.map(d => `<path class="petal" fill="${fill}" d="${d}"/>`).join('');
const tileRect = `<rect x="${parts.tile.x}" y="${parts.tile.y}" width="${parts.tile.w}" height="${parts.tile.h}" rx="${R}" fill="${COLORS.green}"/>`;
const markInner = `${tileRect}${petals(parts.amber, COLORS.amber)}${petals(parts.white, COLORS.white)}`;

writeFileSync(join(OUT, 'logo.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box.w} ${box.h}" role="img" aria-label="TerraTrade"><title>TerraTrade</title>${markInner}<path fill="${COLORS.green}" fill-rule="evenodd" d="${parts.word}"/></svg>\n`);
writeFileSync(join(OUT, 'mark.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${parts.tile.y} ${tile.w} ${tile.h}" role="img" aria-label="TerraTrade"><title>TerraTrade</title>${markInner}</svg>\n`);
// Sprite for <use>: the wordmark and tile read CSS custom properties so the page can re-ink them per theme.
writeFileSync(join(OUT, 'brand.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg">` +
  `<symbol id="tt-logo" viewBox="0 0 ${box.w} ${box.h}">${tileRect.replace(`fill="${COLORS.green}"`, `style="fill:var(--logo-tile,${COLORS.green})"`)}${petals(parts.amber, COLORS.amber)}${petals(parts.white, COLORS.white)}<path style="fill:var(--logo-ink,${COLORS.green})" fill-rule="evenodd" d="${parts.word}"/></symbol>` +
  `<symbol id="tt-mark" viewBox="0 ${parts.tile.y} ${tile.w} ${tile.h}">${tileRect.replace(`fill="${COLORS.green}"`, `style="fill:var(--logo-tile,${COLORS.green})"`)}${petals(parts.amber, COLORS.amber)}${petals(parts.white, COLORS.white)}</symbol>` +
  `</svg>\n`);
writeFileSync(join(TMP, 'parts.json'), JSON.stringify(parts));
// Inline-ready mark with one element per petal, for the hero "bloom" (dev/out/logo/mark-inline.svg).
writeFileSync(join(TMP, 'mark-inline.svg'),
  `<svg class="bloom-svg" viewBox="0 ${parts.tile.y} ${tile.w} ${tile.h}" aria-hidden="true" focusable="false">` +
  `<rect class="bloom-tile" x="0" y="${parts.tile.y}" width="${tile.w}" height="${tile.h}" rx="${R}"/>` +
  parts.amber.map((d, i) => `<path class="petal petal-a" style="--i:${i}" d="${d}"/>`).join('') +
  parts.white.map((d, i) => `<path class="petal petal-w" style="--i:${i + 2}" d="${d}"/>`).join('') + `</svg>`);
// Inject the inline mark between <!-- BLOOM --> markers, if a page has them (the hero no longer does: its
// logo bloom was replaced by the liquid-glass bubbles — the output file stays available for reuse).
const idx = join(here, '..', '..', 'public', 'index.html');
try {
  const html = readFileSync(idx, 'utf8');
  const inline = readFileSync(join(TMP, 'mark-inline.svg'), 'utf8');
  const next = html.replace(/<!-- BLOOM -->[\s\S]*?<!-- \/BLOOM -->/, `<!-- BLOOM -->${inline}<!-- /BLOOM -->`);
  if (next !== html) { writeFileSync(idx, next); console.log('injected bloom mark into index.html'); }
} catch (e) { if (e.code !== 'ENOENT') throw e; }
console.log('tile', tile, 'radius', R, 'box', box, 'petals', parts.amber.length, '+', parts.white.length, 'word bytes', parts.word.length);
