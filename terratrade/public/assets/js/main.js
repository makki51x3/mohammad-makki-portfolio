// TerraTrade — entry module. Mirrors the portfolio's bootstrap: every initialiser runs in isolation
// (run()), light effects start immediately, heavy scenes (map, cube, globe) load when their section
// gets close to the viewport.
import { run, $ } from './core/env.js';
import { loadDict } from './core/i18n.js';
import { theme } from './core/theme.js';
import { nav, progress, sections } from './ui/nav.js';
import { typed, heroLetters, morph, aboutLit, counters, marquee } from './ui/textfx.js';
import { smooth, reveal, depth, tilt, magnetic, spotlight, manifesto, stem, bloom } from './ui/motion.js';
import { products } from './ui/products.js';
import { spec } from './ui/spec.js';
import { rfq, copyMail } from './ui/rfq.js';

await loadDict();

run([smooth, nav, progress, sections, theme, bloom, heroLetters, typed, morph, counters, marquee,
  reveal, depth, products, spec, tilt, magnetic, aboutLit, manifesto, stem, spotlight, copyMail, rfq]);

function lazy(sel, loader, margin = '900px 0px') {
  const el = $(sel); if (!el) return;
  const go = () => loader().then(m => m.default(el)).catch(e => console.error('[scene]', sel, e));
  if (!('IntersectionObserver' in window)) return go();
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); go(); } }, { rootMargin: margin });
  io.observe(el);
}
lazy('#operations', () => import('./scenes/nigeria-map.js'));
lazy('#process', () => import('./scenes/process-cube.js'));
lazy('#markets', () => import('./scenes/globe.js'));
lazy('#top', () => import('./scenes/ambient.js'), '0px');
// CodePen adaptations (slot registry) — see assets/js/fx/
import('./fx/registry.js').then(m => m.default()).catch(e => console.error('[fx]', e));

if (window.ScrollTrigger) document.fonts?.ready.then(() => ScrollTrigger.refresh());
