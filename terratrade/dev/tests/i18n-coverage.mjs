// i18n guard rails:
//  1) every data-i18n / data-i18n-attr / data-i18n-list key in the English pages exists in ar.js
//  2) every t('…') key used in JS exists in en.js (and in ar.js)
//  3) the committed /ar/ pages are up to date (re-render into memory and compare)
//  4) no Latin-only alt / aria-label / placeholder / title / meta content left on /ar/ pages
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseHTML } from 'linkedom';
const here = dirname(fileURLToPath(import.meta.url));
const PUB = join(here, '..', '..', 'public');
const AR = (await import(pathToFileURL(join(PUB, 'assets/js/i18n/ar.js')).href)).default;
const EN = (await import(pathToFileURL(join(PUB, 'assets/js/i18n/en.js')).href)).default;
const fails = [];
// 1
for (const page of ['index.html', 'thanks/index.html', 'privacy/index.html', '404.html']) {
  const { document } = parseHTML(readFileSync(join(PUB, page), 'utf8'));
  const keys = [...document.querySelectorAll('[data-i18n]')].map(e => e.getAttribute('data-i18n'))
    .concat([...document.querySelectorAll('[data-i18n-list]')].map(e => e.getAttribute('data-i18n-list')))
    .concat([...document.querySelectorAll('[data-i18n-attr]')].flatMap(e => e.getAttribute('data-i18n-attr').split(';').map(p => p.split('=')[1])));
  for (const k of new Set(keys)) if (!(k in AR)) fails.push(`${page}: key "${k}" missing from ar.js`);
}
// 2
const jsFiles = []; (function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (!['vendor', 'i18n', 'geo'].includes(f)) walk(p); } else if (f.endsWith('.js')) jsFiles.push(p); } })(join(PUB, 'assets/js'));
const data = readFileSync(join(PUB, 'assets/js/data.js'), 'utf8');
const used = new Set();
for (const f of jsFiles) for (const m of readFileSync(f, 'utf8').matchAll(/\bt\('([\w.]+)'/g)) used.add(m[1]);
for (const m of data.matchAll(/'((?:spec|pack)\.[\w.]+)'/g)) used.add(m[1]);
for (const k of used) { if (!(k in EN)) fails.push(`JS key "${k}" missing from en.js`); if (!(k in AR)) fails.push(`JS key "${k}" missing from ar.js`); }
// 3
const before = Object.fromEntries(['ar/index.html', 'ar/thanks/index.html', 'ar/privacy/index.html', 'ar/404.html'].map(p => [p, readFileSync(join(PUB, p), 'utf8')]));
execFileSync(process.execPath, [join(here, '..', 'tools', 'render-ar.mjs')], { stdio: 'pipe' });
for (const [p, html] of Object.entries(before)) if (readFileSync(join(PUB, p), 'utf8') !== html) fails.push(`${p} was stale — re-rendered it; commit the regenerated file`);
// 4
const allow = /^(TerraTrade|FOB|CFR|CIF|KOR|NEPC|FMN|BUA|Netlify|info@terratrade\.global|[\d\s+·.,%–—/()-]+)$/;
for (const p of Object.keys(before)) {
  const { document } = parseHTML(readFileSync(join(PUB, p), 'utf8'));
  for (const el of document.querySelectorAll('[alt],[aria-label],[placeholder],[title],meta[content]')) {
    for (const a of ['alt', 'aria-label', 'placeholder', 'title', 'content']) {
      const v = el.getAttribute(a); if (!v || (el.tagName === 'META' && !/description|title|og:image:alt/.test(el.getAttribute('name') + el.getAttribute('property')))) continue;
      if (/[A-Za-z]{3,}/.test(v) && !/[؀-ۿ]/.test(v) && !allow.test(v.trim())) fails.push(`${p}: <${el.tagName.toLowerCase()} ${a}="${v.slice(0, 50)}"> is not translated`);
    }
  }
}
console.log(fails.length ? 'i18n FAIL:\n- ' + fails.join('\n- ') : `i18n OK (${used.size} runtime keys, ${Object.keys(AR).length} Arabic keys)`);
process.exit(fails.length ? 1 : 0);
