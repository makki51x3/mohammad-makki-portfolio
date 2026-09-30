// S1 · Custom cursor: an exact amber dot (the hotspot) inside a small TerraTrade bloom that trails it.
// Motion adapted from "Pure CSS cursor tracking" by Andrew Fisher (Andrew-Fisher-the-decoder)
// https://codepen.io/Andrew-Fisher-the-decoder/pen/GgraMzd - MIT. Source: dev/pens/GgraMzd/.
//
// The pen moves an invisible "servo" point with CSS alone: four quadrant hover sensors aim it at a target
// 12000px beyond the viewport, and nested 1800 / 220 / 24 / 2px distance bands swap the left/top transition
// time (1.4s → 8s → 70s → 700s, then a 99999s rest once both axes are inside 2px). So the point rushes in from
// afar, brakes in steps and creeps the last pixels, each axis on its own; its follower trails with a 70ms ease.
// A full-viewport grid of hover sensors can't sit on top of a real page (it would swallow every click), so
// pointer events feed the same controller here: per axis, speed = 12000px ÷ that band's transition time,
// the rest rule is identical, and the follower uses the same 70ms constant. That servo drives the petals.
//
// The system pointer is hidden while this cursor is active, so the click point must never drift:
// - the dot is written straight from each pointer event (clientX/Y into a position:fixed layer), never eased;
// - anything that can move the viewport under a still mouse (resize, zoom, pinch, leaving the window or tab,
//   an open dialog) hands control back to the system pointer until the next real mouse move, which re-snaps;
// - scrolling under a still pointer re-reads what is under it (bloom / text-field state).
// Fine pointers only; off under reduced motion and while paused; text fields keep their I-beam.
import { FINE, REDUCED, isPaused, html } from '../core/env.js';
import { addLoop, removeLoop } from '../core/loop.js';

const REACH = 12000;
/** px/s for a distance on one axis: the pen's band → transition-time table */
const speed = d => REACH / (d > 220 ? 1.4 : d > 24 ? 8 : d > 2 ? 70 : 700);
const FOLLOW = .07 / 3; // ≈ a 70ms ease-out, as an exponential time constant (s)
const TEXT_FIELD = 'input:not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button]):not([type=range]), textarea, select, [contenteditable], iframe';
const CLICKABLE = 'a, button, summary, label, [role=button], [data-spec], .pcard, .mk-btn, .gcard, .sea-gl, canvas';

// the mark's petals as teardrops radiating from the centre: two amber (the top "V"), four green
const PETAL = 'M0 -2.4C3.3 -4.6 3.7 -10.6 0 -14.2C-3.7 -10.6 -3.3 -4.6 0 -2.4Z';
const PETALS = [[-32, 'a'], [32, 'a'], [-98, 'g'], [98, 'g'], [-152, 'g'], [152, 'g']];

export default function customCursor() {
  if (!FINE) return;
  const bloom = document.createElement('div');
  bloom.className = 'tt-cursor'; bloom.dataset.fx = 'cursor'; bloom.setAttribute('aria-hidden', 'true');
  bloom.innerHTML = `<svg viewBox="-17 -17 34 34" focusable="false"><g class="tc-tilt"><g class="tc-bloom">${
    PETALS.map(([r, k], i) => `<path class="tc-p tc-${k}" style="--r:${r}deg;--i:${i}" d="${PETAL}"/>`).join('')
  }</g></g></svg>`;
  const dot = document.createElement('div');
  dot.className = 'tt-dot'; dot.setAttribute('aria-hidden', 'true');
  document.body.append(bloom, dot);

  let tx = 0, ty = 0, px = 0, py = 0, lx = 0, ly = 0, tilt = 0, live = false, running = false, raf = 0;
  const allowed = () => !REDUCED && !isPaused() && !html.classList.contains('dlgopen');
  const placeBloom = () => {
    bloom.style.translate = `${lx.toFixed(2)}px ${ly.toFixed(2)}px`;
    bloom.style.setProperty('--tilt', `${tilt.toFixed(2)}deg`);
  };
  /** hand the pointer back to the system: custom cursor hidden until the next real mouse move re-snaps it */
  const release = () => {
    live = false; if (html.classList.contains('tt-cursor-on')) html.classList.remove('tt-cursor-on');
    bloom.classList.remove('on'); dot.classList.remove('on');
    removeLoop('cursor'); running = false;
  };
  const state = target => { // what is under the pointer: text field → system I-beam; clickable → bloom open
    const t = target && target.closest ? target : null;
    const field = !!t?.closest(TEXT_FIELD);
    bloom.classList.toggle('on', live && !field); dot.classList.toggle('on', live && !field);
    bloom.classList.toggle('bloom', !!t?.closest(CLICKABLE));
  };
  const step = (now, ms) => {
    const dt = ms / 1000, dx = tx - px, dy = ty - py, ax = Math.abs(dx), ay = Math.abs(dy);
    if (ax > 2 || ay > 2) { // the pen's rest state: both axes inside the finest band
      px += Math.sign(dx) * Math.min(ax, speed(ax) * dt);
      py += Math.sign(dy) * Math.min(ay, speed(ay) * dt);
    } else { px = tx; py = ty; } // settle exactly on the pointer (the bloom is centred on the hotspot at rest)
    const k = 1 - Math.exp(-dt / FOLLOW), vx = (px - lx) * k;
    lx += vx; ly += (py - ly) * k;
    tilt += (Math.max(-24, Math.min(24, vx * 1.6)) - tilt) * Math.min(1, dt * 10); // lean into the movement
    placeBloom();
    if (px === tx && py === ty && Math.abs(px - lx) < .05 && Math.abs(py - ly) < .05 && Math.abs(tilt) < .05) {
      lx = px; ly = py; tilt = 0; placeBloom(); removeLoop('cursor'); running = false;
    }
  };

  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    tx = e.clientX; ty = e.clientY;
    dot.style.translate = `${tx}px ${ty}px`; // the hotspot: exact, every event, no easing
    if (!allowed()) { if (live) release(); return; }
    if (!live) { live = true; px = lx = tx; py = ly = ty; tilt = 0; placeBloom(); html.classList.add('tt-cursor-on'); }
    state(e.target);
    if (!running) { running = true; addLoop('cursor', step, { early: true }); }
  }, { passive: true });
  addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') bloom.classList.add('press'); });
  addEventListener('pointerup', () => bloom.classList.remove('press'));
  // content scrolling under a still pointer: re-read what is under it
  addEventListener('scroll', () => {
    if (!live || raf) return;
    raf = requestAnimationFrame(() => { raf = 0; if (live) state(document.elementFromPoint(tx, ty)); });
  }, { passive: true });
  // anything that can shift the viewport under a still mouse → system pointer until the next move
  addEventListener('resize', release);
  window.visualViewport?.addEventListener('resize', release);
  document.documentElement.addEventListener('pointerleave', release);
  addEventListener('blur', release);
  document.addEventListener('visibilitychange', () => { if (document.hidden) release(); });
  addEventListener('tt:motion', () => { if (!allowed()) release(); });
  // the spec dialog lives in the top layer, above this cursor: use the system pointer while it is open
  new MutationObserver(() => { if (live && html.classList.contains('dlgopen')) release(); }).observe(html, { attributes: true, attributeFilter: ['class'] });
}
