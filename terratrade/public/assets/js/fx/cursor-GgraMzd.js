// S1 · Cursor "seed": a small TerraTrade bloom that follows the pointer.
// Motion adapted from "Pure CSS cursor tracking" by Andrew Fisher (Andrew-Fisher-the-decoder)
// https://codepen.io/Andrew-Fisher-the-decoder/pen/GgraMzd - MIT. Source: dev/pens/GgraMzd/.
//
// The pen moves an invisible "servo" point with CSS alone: four quadrant hover sensors aim it at a target
// 12000px beyond the viewport, and nested 1800 / 220 / 24 / 2px distance bands swap the left/top transition
// time (1.4s → 8s → 70s → 700s, then a 99999s rest once both axes are inside 2px). So the point rushes in from
// afar, brakes in steps and creeps the last pixels, each axis on its own; its follower trails with a 70ms ease.
// A full-viewport grid of hover sensors can't sit on top of a real page (it would swallow every click), so
// pointer events feed the same controller here: per axis, speed = 12000px ÷ that band's transition time,
// the rest rule is identical, and the follower uses the same 70ms constant.
// The pen's blurred backdrop lens is replaced (client feedback: too heavy) by the logo's petals: a tiny seed
// that turns slowly, tilts with the movement, blooms open over anything clickable and squeezes on press.
// Fine pointers only; off under reduced motion, while paused, over text fields and outside the window.
import { FINE, REDUCED, isPaused } from '../core/env.js';
import { addLoop, removeLoop } from '../core/loop.js';

const REACH = 12000;
/** px/s for a distance on one axis: the pen's band → transition-time table */
const speed = d => REACH / (d > 220 ? 1.4 : d > 24 ? 8 : d > 2 ? 70 : 700);
const FOLLOW = .07 / 3; // ≈ a 70ms ease-out, as an exponential time constant (s)
const NO_CURSOR = 'input:not([type=checkbox]):not([type=radio]), textarea, select, [contenteditable], iframe';
const CLICKABLE = 'a, button, summary, label, [role=button], [data-spec], .pcard, .mk-btn, .gcard, .sea-gl';

// the mark's petals as teardrops radiating from the centre: two amber (the top "V"), four green
const PETAL = 'M0 -2.4C3.3 -4.6 3.7 -10.6 0 -14.2C-3.7 -10.6 -3.3 -4.6 0 -2.4Z';
const PETALS = [[-32, 'a'], [32, 'a'], [-98, 'g'], [98, 'g'], [-152, 'g'], [152, 'g']];

export default function cursorSeed() {
  if (!FINE) return;
  const el = document.createElement('div');
  el.className = 'tt-cursor'; el.dataset.fx = 'cursor'; el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<svg viewBox="-17 -17 34 34" focusable="false"><g class="tc-tilt"><g class="tc-bloom">${
    PETALS.map(([r, k], i) => `<path class="tc-p tc-${k}" style="--r:${r}deg;--i:${i}" d="${PETAL}"/>`).join('')
  }</g><circle class="tc-seed" r="2.3"/></g></svg>`;
  document.body.append(el);

  let tx = 0, ty = 0, px = 0, py = 0, lx = 0, ly = 0, tilt = 0, seen = false, running = false;
  const place = () => {
    el.style.translate = `${lx.toFixed(2)}px ${ly.toFixed(2)}px`;
    el.style.setProperty('--tilt', `${tilt.toFixed(2)}deg`);
  };
  const step = (now, ms) => {
    const dt = ms / 1000, dx = tx - px, dy = ty - py, ax = Math.abs(dx), ay = Math.abs(dy);
    if (ax > 2 || ay > 2) { // the pen's rest state: both axes inside the finest band
      px += Math.sign(dx) * Math.min(ax, speed(ax) * dt);
      py += Math.sign(dy) * Math.min(ay, speed(ay) * dt);
    }
    const k = 1 - Math.exp(-dt / FOLLOW), vx = (px - lx) * k;
    lx += vx; ly += (py - ly) * k;
    tilt += (Math.max(-24, Math.min(24, vx * 1.6)) - tilt) * Math.min(1, dt * 10); // lean into the movement
    place();
    if (ax <= 2 && ay <= 2 && Math.abs(px - lx) < .05 && Math.abs(py - ly) < .05 && Math.abs(tilt) < .05) {
      tilt = 0; place(); removeLoop('cursor'); running = false;
    }
  };
  const allowed = () => !REDUCED && !isPaused();
  const show = on => el.classList.toggle('on', on && seen && allowed());

  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    tx = e.clientX; ty = e.clientY;
    if (!seen) { seen = true; px = lx = tx; py = ly = ty; place(); } // first sight: appear under the pointer
    const t = e.target.closest ? e.target : null;
    show(!t?.closest(NO_CURSOR));
    el.classList.toggle('bloom', !!t?.closest(CLICKABLE));
    if (!running && allowed()) { running = true; addLoop('cursor', step); }
  }, { passive: true });
  addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') el.classList.add('press'); });
  addEventListener('pointerup', () => el.classList.remove('press'));
  document.documentElement.addEventListener('pointerleave', () => show(false));
  addEventListener('blur', () => show(false));
  addEventListener('tt:motion', () => { if (!allowed()) { show(false); removeLoop('cursor'); running = false; } });
}
