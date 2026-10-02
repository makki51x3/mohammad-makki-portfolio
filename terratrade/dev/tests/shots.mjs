// Section-by-section screenshots for visual review.
// Usage: node tests/shots.mjs [--lang en|ar] [--theme light|dark] [--w 1440] [--h 900] [--reduced] [--only id,id]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { start } from './server.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true) : d; };
const lang = arg('lang', 'en'), theme = arg('theme', 'light'), W = +arg('w', 1440), H = +arg('h', 900), reduced = !!arg('reduced', false);
const only = arg('only', '') ? String(arg('only')).split(',') : null;
const out = `out/shots/${lang}-${theme}-${W}${reduced ? '-rm' : ''}`; mkdirSync(out, { recursive: true });
const srv = await start(0); const base = `http://127.0.0.1:${srv.address().port}`;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: W < 700, isMobile: W < 700, reducedMotion: reduced ? 'reduce' : 'no-preference' });
if (theme === 'dark') await ctx.addInitScript(() => localStorage.setItem('tt-theme', 'dark'));
const p = await ctx.newPage(); const errs = [];
p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
await p.goto(base + (lang === 'ar' ? '/ar/' : '/'), { waitUntil: 'networkidle' });
await p.waitForTimeout(1200);
const ids = await p.evaluate(() => [...document.querySelectorAll('main > section[id], main > section.manifesto, footer')].map((s, i) => s.id || (s.tagName === 'FOOTER' ? 'footer' : 'manifesto')));
for (const id of ids) {
  if (only && !only.includes(id)) continue;
  // scroll gradually so scroll-driven effects progress naturally
  const y = await p.evaluate(id => { const el = id === 'footer' ? document.querySelector('footer') : id === 'manifesto' ? document.querySelector('.manifesto') : document.getElementById(id); return el.getBoundingClientRect().top + scrollY - 70; }, id);
  const from = await p.evaluate(() => scrollY);
  for (let k = 1; k <= 8; k++) { await p.evaluate(v => window.scrollTo(0, v), from + (y - from) * k / 8); await p.waitForTimeout(60); }
  await p.waitForTimeout(1300);
  await p.screenshot({ path: `${out}/${id}.png` });
  // sticky/pinned sections: also capture mid-way and near the end
  if (['operations', 'process'].includes(id)) {
    const hgt = await p.evaluate(id => document.getElementById(id).offsetHeight, id);
    for (const f of [.35, .7]) { await p.evaluate(v => window.scrollTo(0, v), y + hgt * f); await p.waitForTimeout(1300); await p.screenshot({ path: `${out}/${id}-${Math.round(f * 100)}.png` }); }
  }
}
console.log(out, errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
await b.close(); srv.close();
