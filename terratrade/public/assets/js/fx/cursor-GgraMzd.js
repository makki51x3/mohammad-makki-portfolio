// S1 · Custom cursor: an exact amber dot (the hotspot) inside a small TerraTrade bloom that trails it.
// Motion adapted from "Pure CSS cursor tracking" by Andrew Fisher (Andrew-Fisher-the-decoder)
// https://codepen.io/Andrew-Fisher-the-decoder/pen/GgraMzd - MIT. Source: dev/pens/GgraMzd/.
//
// The pen moves an invisible "servo" point with CSS alone: four quadrant hover sensors aim it at a target
// 12000px beyond the viewport, and nested distance bands swap the transition time so the point rushes in from
// afar, brakes in steps and creeps the last pixels. A full-viewport grid of hover sensors can't sit on top of a
// real page (it would swallow every click), so pointer events drive the cursor here. The pen's braking bands
// made the bloom crawl over the last 24px (about 170 px/s) and the client found the cursor slow, so the bloom now
// follows the pointer with a single short exponential ease (~28 ms time constant: it settles within ~0.2 s) and
// leans into the movement; the hotspot dot is never eased at all.
//
// The system pointer is hidden while this cursor is active, so the click point must never drift:
// - the dot is written straight from each pointer event (clientX/Y into a position:fixed layer), never eased;
// - anything that can move the viewport under a still mouse (resize, zoom, pinch, leaving the window or tab,
//   an open dialog) hands control back to the system pointer until the next real mouse move, which re-snaps;
// - scrolling under a still pointer re-reads what is under it (bloom / text-field state).
// Fine pointers only; off under reduced motion and while paused; text fields keep their I-beam.
import { FINE, REDUCED, isPaused, html } from '../core/env.js';
import { addLoop, removeLoop } from '../core/loop.js';

const FOLLOW = .028; // the bloom's ease toward the pointer, as an exponential time constant (s)
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

  let tx = 0, ty = 0, lx = 0, ly = 0, tilt = 0, live = false, running = false, raf = 0;
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
    const dt = Math.min(ms, 50) / 1000; // a long frame (tab switch, GC) must not fling the bloom
    const k = 1 - Math.exp(-dt / FOLLOW), vx = (tx - lx) * k;
    lx += vx; ly += (ty - ly) * k;
    tilt += (Math.max(-24, Math.min(24, vx * 1.6)) - tilt) * Math.min(1, dt * 14); // lean into the movement
    placeBloom();
    if (Math.abs(tx - lx) < .1 && Math.abs(ty - ly) < .1 && Math.abs(tilt) < .1) { // settled exactly on the hotspot
      lx = tx; ly = ty; tilt = 0; placeBloom(); removeLoop('cursor'); running = false;
    }
  };

  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    tx = e.clientX; ty = e.clientY;
    dot.style.translate = `${tx}px ${ty}px`; // the hotspot: exact, every event, no easing
    if (!allowed()) { if (live) release(); return; }
    if (!live) { live = true; lx = tx; ly = ty; tilt = 0; placeBloom(); html.classList.add('tt-cursor-on'); }
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
