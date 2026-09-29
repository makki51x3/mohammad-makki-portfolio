// S1 · Cursor lens.
// Adapted from "Pure CSS cursor tracking" by Andrew Fisher (Andrew-Fisher-the-decoder)
// https://codepen.io/Andrew-Fisher-the-decoder/pen/GgraMzd — MIT. Source: dev/pens/GgraMzd/.
//
// The pen moves an invisible "servo" point with CSS alone: four quadrant hover sensors aim it at a target
// 12000px beyond the viewport, and nested 1800 / 220 / 24 / 2px distance bands swap the left/top transition
// time (1.4s → 8s → 70s → 700s, then a 99999s rest once both axes are inside 2px). So the point rushes in from
// afar, brakes in steps and creeps the last pixels, each axis on its own; a lens trails it with a 70ms ease.
// A full-viewport grid of hover sensors can't sit on top of a real page (it would swallow every click), so
// here pointer events feed the same controller: per axis, speed = 12000px ÷ that band's transition time,
// the rest rule is identical, and the lens follows with the same 70ms constant.
// Fine pointers only; off under reduced motion, while paused, over form fields and outside the window.
import { FINE, REDUCED, isPaused } from '../core/env.js';
import { addLoop, removeLoop } from '../core/loop.js';

const REACH = 12000;
/** px/s for a distance on one axis — the pen's band → transition-time table */
const speed = d => REACH / (d > 220 ? 1.4 : d > 24 ? 8 : d > 2 ? 70 : 700);
const FOLLOW = .07 / 3; // ≈ a 70ms ease-out, as an exponential time constant (s)
const NO_LENS = 'input, textarea, select, [contenteditable], iframe';

export default function cursorLens() {
  if (!FINE) return;
  const lens = document.createElement('div');
  lens.className = 'tt-lens'; lens.dataset.fx = 'cursor'; lens.setAttribute('aria-hidden', 'true');
  document.body.append(lens);

  let tx = 0, ty = 0, px = 0, py = 0, lx = 0, ly = 0, seen = false, running = false;
  const place = () => { lens.style.translate = `${lx.toFixed(2)}px ${ly.toFixed(2)}px`; };
  const step = (now, ms) => {
    const dt = ms / 1000, dx = tx - px, dy = ty - py, ax = Math.abs(dx), ay = Math.abs(dy);
    if (ax > 2 || ay > 2) { // the pen's rest state: both axes inside the finest band
      px += Math.sign(dx) * Math.min(ax, speed(ax) * dt);
      py += Math.sign(dy) * Math.min(ay, speed(ay) * dt);
    }
    const k = 1 - Math.exp(-dt / FOLLOW);
    lx += (px - lx) * k; ly += (py - ly) * k; place();
    if (ax <= 2 && ay <= 2 && Math.abs(px - lx) < .05 && Math.abs(py - ly) < .05) { removeLoop('cursor'); running = false; }
  };
  const allowed = () => !REDUCED && !isPaused();
  const show = on => lens.classList.toggle('on', on && seen && allowed());

  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    tx = e.clientX; ty = e.clientY;
    if (!seen) { seen = true; px = lx = tx; py = ly = ty; place(); } // first sight: appear under the pointer
    show(!e.target.closest?.(NO_LENS));
    if (!running && allowed()) { running = true; addLoop('cursor', step); }
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => show(false));
  addEventListener('blur', () => show(false));
  addEventListener('tt:motion', () => { if (!allowed()) { show(false); removeLoop('cursor'); running = false; } });
}
