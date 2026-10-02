// Switch the site's public address everywhere it is written out (see ../site.mjs).
// Usage: npm run origin -- https://terratrade-global.netlify.app   (later: npm run origin -- https://terratrade.global)
// Link previews (WhatsApp, LinkedIn, X) only show the image when og:image is on a host that really serves this
// site, so this must always name the address the site is live on: the Netlify URL until the custom domain is
// connected in Netlify, then the domain. Rewrites public/ (html, xml, txt, webmanifest) and site.mjs; run
// `npm run ar && npm run csp` afterwards is not needed (the Arabic pages are rewritten too) but harmless.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE } from '../site.mjs';

const next = (process.argv[2] || '').replace(/\/+$/, '');
if (!/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}$/i.test(next)) { console.error('usage: npm run origin -- https://host.tld'); process.exit(1); }
const HERE = dirname(fileURLToPath(import.meta.url)), PUB = join(HERE, '..', '..', 'public');
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// only the origin as a URL prefix (followed by "/", a quote, "#", whitespace or the end): e-mail addresses on the
// same domain (info@terratrade.global) are never touched
const re = new RegExp(esc(SITE) + '(?=[/"\'#<\\s]|$)', 'gm');
let files = 0, hits = 0;
(function walk(dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (!/\.(html|xml|txt|webmanifest|json)$/.test(n)) continue;
    const s = readFileSync(p, 'utf8'), m = s.match(re);
    if (!m) continue;
    writeFileSync(p, s.replace(re, next)); files++; hits += m.length;
  }
})(PUB);
const sitePath = join(HERE, '..', 'site.mjs');
writeFileSync(sitePath, readFileSync(sitePath, 'utf8').replace(`'${SITE}'`, `'${next}'`));
console.log(`origin ${SITE} -> ${next}: ${hits} URLs in ${files} files`);
