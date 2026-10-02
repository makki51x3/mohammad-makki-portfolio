// Copies the runtime libraries the site uses from node_modules into public/assets/js/vendor/.
// Self-hosting (instead of a CDN) keeps the site working where Google/CDNs are blocked (e.g. mainland China)
// and lets a strict CSP use script-src 'self'.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const nm = join(here, '..', 'node_modules');
const out = join(here, '..', '..', 'public', 'assets', 'js', 'vendor');
mkdirSync(out, { recursive: true });

const files = [
  ['gsap/dist/gsap.min.js', 'gsap.min.js'],
  ['gsap/dist/ScrollTrigger.min.js', 'ScrollTrigger.min.js'],
  ['gsap/dist/DrawSVGPlugin.min.js', 'DrawSVGPlugin.min.js'],
  ['gsap/dist/MotionPathPlugin.min.js', 'MotionPathPlugin.min.js'],
  ['lenis/dist/lenis.min.js', 'lenis.min.js'],
];
for (const [from, to] of files) {
  // Drop the sourceMappingURL comment: maps are not shipped.
  const src = readFileSync(join(nm, from), 'utf8').replace(/\n?\/\/# sourceMappingURL=.*$/m, '');
  writeFileSync(join(out, to), src);
}
const ver = p => JSON.parse(readFileSync(join(nm, p, 'package.json'), 'utf8')).version;
writeFileSync(join(out, 'VERSIONS.txt'),
  `gsap ${ver('gsap')} (GSAP Standard "no charge" license, https://gsap.com/standard-license)\n` +
  `lenis ${ver('lenis')} (MIT, https://github.com/darkroomengineering/lenis)\n`);
console.log('vendored', files.map(f => f[1]).join(', '));
