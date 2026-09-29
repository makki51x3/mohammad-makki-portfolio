// CodePen effect slots. Each adapted pen lives in its own module (fx/<slot>-<pen>.js), credited in its header,
// in /credits.txt and in README.md; CSS-only adaptations live in assets/css/fx.css under [data-fx="…"].
// Modules load on demand, only where they apply.
import { FINE, REDUCED } from '../core/env.js';

/** resolves once `sel` comes within `margin` of the viewport */
const near = (sel, margin = '600px 0px') => new Promise(res => {
  const el = document.querySelector(sel); if (!el) return;
  if (!('IntersectionObserver' in window)) return res(el);
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); res(el); } }, { rootMargin: margin });
  io.observe(el);
});

const SLOTS = [
  // S3 hero liquid-glass bubbles - Fernando Cohen, "[SVG] [CSS] Marquee Glass Bubble"
  ['bubbles', () => document.querySelector('[data-fx="bubbles"]') && import('./bubbles-QwdoddG.js')],
  // S1 cursor lens - Andrew Fisher, "Pure CSS cursor tracking" (fine pointers only)
  ['cursor', () => FINE && import('./cursor-GgraMzd.js')],
  // Contact glass card - Abdughafur Khujzoda, liquid-glass profile card (the photo it sits on shows ≥ 961px)
  ['glass', () => document.querySelector('[data-fx="glass"]') && matchMedia('(min-width: 961px)').matches && import('./glass-jEyVvqK.js')],
  // S12 chunky squircle buttons + floating WhatsApp - Andrew Fisher, "Chunky 3D Buttons"
  ['chunky', () => document.querySelector('[data-chunky]') && import('./chunky-raMZQNe.js')],
  // How we trade - Temple, "Realistic Interactive Pool Water" (three.js; wide screens with motion allowed, loaded when near)
  ['water', () => !REDUCED && matchMedia('(min-width: 961px)').matches &&
    near('[data-fx="water"]').then(el => import('./water-YPZQxeN.js').then(m => ({ default: () => m.default(el) })))],
];

export default function fx() {
  for (const [name, load] of SLOTS) {
    Promise.resolve(load()).then(m => m?.default?.()).catch(e => console.error('[fx]', name, e));
  }
}
