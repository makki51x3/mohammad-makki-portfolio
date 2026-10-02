// Screenshot one element (for reviewing a single effect across languages / themes / widths).
// Usage: node tests/elshot.mjs --sel '[data-fx="banners"]' [--lang en|ar] [--theme light|dark] [--w 1440] [--h 900]
//        [--reduced] [--hover selector] [--press] [--margin px] [--wait ms] [--name file]
// --margin clips the page around the element (for effects that hang outside their box, e.g. button extrusions);
// --press holds the mouse down on the element's centre before the shot.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { start } from './server.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true) : d; };
const sel = arg('sel'), lang = arg('lang', 'en'), theme = arg('theme', 'light'), W = +arg('w', 1440), H = +arg('h', 900);
const reduced = !!arg('reduced', false), hover = arg('hover', ''), wait = +arg('wait', 1200);
const name = arg('name', `${String(sel).replace(/[^a-z0-9]+/gi, '_')}-${lang}-${theme}-${W}${reduced ? '-rm' : ''}`);
mkdirSync('out/el', { recursive: true });
const srv = await start(0); const base = `http://127.0.0.1:${srv.address().port}`;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: W < 700, isMobile: W < 700, reducedMotion: reduced ? 'reduce' : 'no-preference' });
if (theme === 'dark') await ctx.addInitScript(() => localStorage.setItem('tt-theme', 'dark'));
const p = await ctx.newPage(); const errs = [];
p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
await p.goto(base + (lang === 'ar' ? '/ar/' : '/'), { waitUntil: 'networkidle' });
const el = p.locator(sel).first();
await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(400);
await p.evaluate(s => { const e = document.querySelector(s); window.scrollBy(0, e.getBoundingClientRect().top - 120); }, sel);
await p.waitForTimeout(wait);
if (hover) { await p.hover(hover); await p.waitForTimeout(+arg('hwait', 1600)); }
const m = +arg('margin', 0);
if (m || arg('press', false)) {
  await el.evaluate(e => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(600);
  const r = await el.boundingBox();
  if (arg('press', false)) { await p.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await p.mouse.down(); await p.waitForTimeout(120); }
  await p.screenshot({ path: `out/el/${name}.png`, clip: { x: Math.max(0, r.x - m), y: Math.max(0, r.y - m), width: r.width + 2 * m, height: r.height + 2 * m } });
} else await el.screenshot({ path: `out/el/${name}.png` });
console.log(`out/el/${name}.png`, errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
await b.close(); srv.close();
