// Renders the social-preview images (1200×630) for English and Arabic with Playwright, using the
// site's own fonts, logo and hero photo: public/assets/img/og-en.jpg, og-ar.jpg.
import { chromium } from 'playwright';
import { start } from '../tests/server.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', '..', 'public', 'assets', 'img');
const COPY = {
  en: { dir: 'ltr', k: 'Nigerian agri-commodity exports · Est. 2023', t1: 'Bridging Nigerian agriculture', t2: 'with global markets', chips: ['Sesame', 'Raw cashew', 'Hibiscus', 'Soybean', 'Feed ingredients', 'Charcoal'], url: 'terratrade.global' },
  ar: { dir: 'rtl', k: 'تصدير السلع الزراعية النيجيرية · تأسست 2023', t1: 'نربط الزراعة النيجيرية', t2: 'بالأسواق العالمية', chips: ['السمسم', 'الكاجو الخام', 'الكركديه', 'فول الصويا', 'مكونات الأعلاف', 'الفحم النباتي'], url: 'terratrade.global/ar' },
};
const tpl = c => `<!doctype html><html lang="${c.dir === 'rtl' ? 'ar' : 'en'}" dir="${c.dir}"><head><link rel="stylesheet" href="/assets/css/fonts.css"><style>
*{box-sizing:border-box;margin:0}body{width:1200px;height:630px;overflow:hidden;font-family:${c.dir === 'rtl' ? '"IBM Plex Sans Arabic"' : 'Sora'},sans-serif;color:#EEFAE9;
background:radial-gradient(700px 420px at 90% 10%,rgba(84,186,71,.45),transparent 70%),radial-gradient(500px 360px at 10% 110%,rgba(255,166,18,.28),transparent 70%),linear-gradient(135deg,#013D27,#04150E)}
.wrap{position:absolute;inset:56px 60px;display:grid;grid-template-columns:1fr 360px;gap:48px;align-items:center}
.logo{height:62px;width:auto;--logo-ink:#EEFAE9}
.k{font-family:${c.dir === 'rtl' ? '"IBM Plex Sans Arabic"' : '"Space Mono"'};font-size:17px;letter-spacing:${c.dir === 'rtl' ? 0 : '.14em'};text-transform:uppercase;color:#9BE88C;margin-top:34px}
h1{font-family:${c.dir === 'rtl' ? '"Noto Kufi Arabic"' : 'Lexend'};font-weight:700;font-size:${c.dir === 'rtl' ? 54 : 62}px;line-height:${c.dir === 'rtl' ? 1.45 : 1.05};letter-spacing:${c.dir === 'rtl' ? 0 : '-.03em'};margin-top:14px}
h1 span{display:block;background:linear-gradient(100deg,#9BE88C,#54BA47 40%,#FFA612);-webkit-background-clip:text;background-clip:text;color:transparent}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:28px}.chips b{font-weight:600;font-size:16px;padding:7px 14px;border-radius:999px;border:1px solid rgba(238,250,233,.25);background:rgba(238,250,233,.06)}
.ph{position:relative;height:430px;border-radius:32px;overflow:hidden;border:2px solid rgba(155,232,140,.35);box-shadow:0 40px 80px -30px #000}
.ph img{width:100%;height:100%;object-fit:cover}
.url{position:absolute;bottom:18px;inset-inline-start:18px;font-family:"Space Mono";font-size:15px;background:rgba(1,30,18,.7);padding:6px 12px;border-radius:999px}
</style></head><body><div class="wrap"><div>
<svg class="logo" viewBox="0 0 752 264"><use href="/assets/img/brand/brand.svg#tt-logo"/></svg>
<p class="k">${c.k}</p><h1>${c.t1}<span>${c.t2}</span></h1>
<div class="chips">${c.chips.map(x => `<b>${x}</b>`).join('')}</div></div>
<div class="ph"><img src="/assets/img/photos/contact-880.webp"><span class="url">${c.url}</span></div></div></body></html>`;
const srv = await start(0); const base = `http://127.0.0.1:${srv.address().port}`;
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
for (const [lang, c] of Object.entries(COPY)) {
  await p.goto(base + '/404.html'); await p.setContent(tpl(c), { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: join(OUT, `og-${lang}.jpg`), type: 'jpeg', quality: 86 });
  console.log('wrote og-' + lang + '.jpg');
}
await b.close(); srv.close();
