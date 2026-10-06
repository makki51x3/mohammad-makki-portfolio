// Computes the sha256 of the inline <head> theme-init script (identical on every page) and writes it
// into public/_headers' Content-Security-Policy. Exits 1 if pages disagree on the script.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const PUB = join(here, '..', '..', 'public');
const pages = []; (function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (f !== 'assets') walk(p); } else if (f.endsWith('.html')) pages.push(p); } })(PUB);
const hashes = new Set();
for (const p of pages) {
  const m = readFileSync(p, 'utf8').match(/<script>([\s\S]*?)<\/script>/);
  if (!m) { console.error('no inline head script in', p); process.exit(1); }
  hashes.add(createHash('sha256').update(m[1], 'utf8').digest('base64'));
}
if (hashes.size !== 1) { console.error('Inline head scripts differ between pages:', [...hashes]); process.exit(1); }
const h = [...hashes][0];
const hdr = join(PUB, '_headers');
const next = readFileSync(hdr, 'utf8').replace(/'sha256-[^']*'/, `'sha256-${h}'`);
writeFileSync(hdr, next);
console.log('CSP script hash', h, 'for', pages.length, 'pages');
