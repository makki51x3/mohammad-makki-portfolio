// Renders public/assets/img/brand/logo.svg at the source size and compares it with dev/src-assets/logo.png
// colour layer by colour layer (intersection-over-union). Fails below 0.97 per layer.
import { chromium } from 'playwright';
import Jimp from 'jimp';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const svg = readFileSync(join(here, '..', '..', 'public', 'assets', 'img', 'brand', 'logo.svg'), 'utf8');
const parts = JSON.parse(readFileSync(join(here, '..', 'out', 'logo', 'parts.json'), 'utf8'));
const src = await Jimp.read(join(here, '..', 'src-assets', 'logo.png'));
const ox = 145, oy = 389, { w, h } = parts.box;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: w, height: h } });
await page.setContent(`<body style="margin:0;background:#000">${svg.replace('<svg ', `<svg width="${w}" height="${h}" `)}</body>`);
const shot = await Jimp.read(await page.screenshot({ omitBackground: false }));
await browser.close();
const REF = { g: [33, 64, 28], a: [255, 166, 18], w: [255, 255, 255] };
const cls = (d, i, alpha) => { if (alpha && d[i + 3] < 128) return null; const [r, g, b] = [d[i], d[i + 1], d[i + 2]]; if (!alpha && r + g + b < 40) return null;
  return r > 215 && g > 215 && b > 215 ? 'w' : r > 200 && g > 110 && g < 210 && b < 90 ? 'a' : 'g'; };
const stat = { g: [0, 0], a: [0, 0], w: [0, 0] };
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const a = cls(src.bitmap.data, ((y + oy) * src.bitmap.width + x + ox) * 4, true), b = cls(shot.bitmap.data, (y * w + x) * 4, false);
  for (const k of 'gaw') { const A = a === k, B = b === k; if (A && B) stat[k][0]++; if (A || B) stat[k][1]++; }
}
let ok = true;
for (const [k, [i, u]] of Object.entries(stat)) { const iou = i / u; console.log(k, iou.toFixed(4)); if (iou < 0.97) ok = false; }
writeFileSync(join(here, '..', 'out', 'logo', 'render.png'), await shot.getBufferAsync(Jimp.MIME_PNG));
process.exit(ok ? 0 : 1);
