// S12 · Chunky squircle buttons.
// Adapted from "Chunky 3D Buttons" (a squircle button system) by Andrew Fisher (Andrew-Fisher-the-decoder)
// https://codepen.io/Andrew-Fisher-the-decoder/pen/raMZQNe — MIT. Source: dev/pens/raMZQNe/.
//
// Kept from the pen: the superellipse path S() (four 31-point quarter arcs, |cos|^.6 · |sin|^.6, r = 18 in a
// 40-unit-tall face), the stack of a drop-shadowed footprint, a darker base at y = 12, one gradient slice per
// unit of extrusion and the face on top at y = 4 — which sinks to y = 9 while pressed — plus the floating
// variant's deeper, softer shadow and lit base rim. Changed: the SVG is an aria-hidden layer behind a real
// <a>/<button> (the label stays live text for screen readers, translation and form states), colours come from
// CSS custom properties (brand amber / green, in fx.css) instead of hex pairs, it re-renders on resize (label
// changes like "Sending…" included), and no Tailwind / Material Icons (the site's own icons are used).
import { $$, $ } from '../core/env.js';

const NS = 'http://www.w3.org/2000/svg';
const S = (w, h, r, x, y) => {
  let p = '';
  for (let j = 0; j < 4; j++) for (let i = 0; i < 31; i++) {
    const q = ((j + i / 30) * Math.PI) / 2, c = Math.cos(q), s = Math.sin(q);
    p += (j || i ? 'L' : 'M') +
      (x + (c > 0 ? w - r : r) + Math.sign(c) * Math.abs(c) ** .6 * r).toFixed(2) + ' ' +
      (y + (s > 0 ? h - r : r) + Math.sign(s) * Math.abs(s) ** .6 * r).toFixed(2);
  }
  return p + 'Z';
};
let uid = 0;

function chunky(el) {
  const floating = el.dataset.chunky === 'float', u = 'sq' + ++uid;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'sq'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.innerHTML = `<defs><filter id="${u}f" x="-100%" y="-100%" width="300%" height="300%"><feDropShadow class="sq-drop"/></filter>` +
    `<linearGradient id="${u}g"><stop class="sq-e" offset="0"/><stop class="sq-m"/><stop class="sq-m"/><stop class="sq-e" offset="1"/></linearGradient></defs>` +
    `<path class="sq-shadow" filter="url(#${u}f)"/><path class="sq-base"/><g class="sq-slices" fill="url(#${u}g)"></g><path class="sq-face"/>`;
  el.prepend(svg);
  el.classList.add('is-chunky');
  const [drop] = svg.getElementsByTagName('feDropShadow'), stops = svg.getElementsByTagName('stop');
  const shadow = $('.sq-shadow', svg), base = $('.sq-base', svg), slices = $('.sq-slices', svg), face = $('.sq-face', svg);
  let p = 0, w = 0;

  const render = () => {
    const h = el.offsetHeight || 40, scale = h / 40;
    w = Math.max(40, el.offsetWidth / scale);
    const faceY = 4 + p * 5, baseY = 12, z = Math.min(.5, 20 / w);
    svg.setAttribute('viewBox', `0 0 ${(w + 10).toFixed(2)} 60`);
    stops[1].setAttribute('offset', z); stops[2].setAttribute('offset', 1 - z);
    drop.setAttribute('dy', floating ? 24 - p * 12 : 4 - p * 2);
    drop.setAttribute('stdDeviation', floating ? 12 - p * 6 : 3 - p * 1.5);
    const foot = S(w, 40, 18, 5, baseY);
    shadow.setAttribute('d', foot); base.setAttribute('d', foot);
    slices.innerHTML = Array.from({ length: Math.max(0, baseY - faceY) }, (_, k) => `<path d="${S(w, 40, 18, 5, faceY + 1 + k)}"/>`).join('');
    face.setAttribute('d', S(w, 40, 18, 5, faceY));
    svg.style.cssText = `left:${-5 * scale}px;top:${-4 * scale}px;width:${el.offsetWidth + 10 * scale}px;height:${60 * scale}px`;
    el.style.setProperty('--sq-dy', `${(p * 5 * scale).toFixed(2)}px`); // the label rides the face down
  };
  const press = v => { if (p !== v) { p = v; render(); } };
  el.addEventListener('pointerdown', () => press(1));
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel', 'blur']) el.addEventListener(ev, () => press(0));
  el.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') press(1); });
  el.addEventListener('keyup', () => press(0));
  new ResizeObserver(render).observe(el);
  render();
}

// the floating WhatsApp button shows once the hero has scrolled away, and steps aside for the contact
// section and footer (which carry their own WhatsApp links)
function floatingWa() {
  const btn = $('.wa-float'); if (!btn || !('IntersectionObserver' in window)) return;
  const seen = new Map();
  const io = new IntersectionObserver(es => {
    es.forEach(e => seen.set(e.target, e.isIntersecting));
    btn.classList.toggle('show', ![...seen.values()].some(Boolean));
  });
  ['#top', '#contact', '.site-foot'].forEach(s => { const t = $(s); if (t) { seen.set(t, true); io.observe(t); } });
}

export default function chunkyButtons() {
  $$('[data-chunky]').forEach(chunky);
  floatingWa();
}
