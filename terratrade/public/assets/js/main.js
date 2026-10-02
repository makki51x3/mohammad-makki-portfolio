// TerraTrade - entry module. Mirrors the portfolio's bootstrap: every initialiser runs in isolation
// (run()), light effects start immediately, heavy scenes (globe, cube) load when their section gets
// close to the viewport. The pinned map loads right after page load so its pin spacing exists before
// anyone uses the nav (otherwise in-page links would land in the wrong place).
import { run, $ } from './core/env.js';
import { loadDict } from './core/i18n.js';
import { theme } from './core/theme.js';
import { nav, progress, sections } from './ui/nav.js';
import { typed, heroLetters, morph, aboutLit, counters, marquee } from './ui/textfx.js';
import { smooth, reveal, depth, tilt, magnetic, spotlight, manifesto } from './ui/motion.js';
import { products, cards } from './ui/products.js';
import { spec } from './ui/spec.js';
import { rfq, copyMail } from './ui/rfq.js';

// A failed dictionary load falls back to the English runtime strings instead of stopping the page.
// hold the hero's orbiting text still until the page has loaded (fx/bubbles-QwdoddG.js starts it): content first
document.getElementById('hbOrbit')?.pauseAnimations?.();
await loadDict().catch(e => console.error('[i18n]', e));

run([reveal, smooth, nav, progress, sections, theme, heroLetters, typed, morph, counters, marquee,
  depth, products, cards, spec, tilt, magnetic, aboutLit, manifesto, spotlight, copyMail, rfq]);

const scene = (sel, loader) => loader().then(m => m.default($(sel))).catch(e => console.error('[scene]', sel, e));
function lazy(sel, loader, margin = '900px 0px') {
  const el = $(sel); if (!el) return;
  if (!('IntersectionObserver' in window)) return scene(sel, loader);
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); scene(sel, loader); } }, { rootMargin: margin });
  io.observe(el);
}
const whenIdle = fn => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 200));
const afterLoad = fn => (document.readyState === 'complete' ? whenIdle(fn) : addEventListener('load', () => whenIdle(fn), { once: true }));
afterLoad(() => scene('#operations', () => import('./scenes/nigeria-map.js')));
lazy('#process', () => import('./scenes/process-cube.js'));
lazy('#markets', () => import('./scenes/globe.js'));
lazy('.site-foot', () => import('./scenes/flora.js'), '400px 0px');
// CodePen adaptations (slot registry) - see assets/js/fx/
import('./fx/registry.js').then(m => m.default()).catch(e => console.error('[fx]', e));

if (window.ScrollTrigger) document.fonts?.ready.then(() => ScrollTrigger.refresh());
