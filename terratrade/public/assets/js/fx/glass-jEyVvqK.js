// Contact · draggable liquid-glass business card.
// Adapted from a liquid-glass GitHub profile card by Abdughafur Khujzoda (Abdughafur-Khujzoda)
// https://codepen.io/Abdughafur-Khujzoda/pen/jEyVvqK - MIT. Source: dev/pens/jEyVvqK/.
//
// Kept from the pen: the SVG displacement filter (fractal-noise turbulence .012, seed 92, 2 octaves,
// blurred 2, displacement scale 85 on R/G) applied over a 3px backdrop blur, the 28px-radius glass with its
// hairline rim and inner highlight, the avatar ring, stats row and pill button, the lift on hover and the
// scale-up while dragging. Changed: it's TerraTrade's card (mark, domain, facts, WhatsApp) sitting on the
// contact photo (starting centred on it), dragging uses pointer events with capture and is kept inside the photo, the zoom buttons
// are gone, and the filter is only referenced once this script has added it (no dangling url(#…)).
import { $ } from '../core/env.js';

const FILTER = `<svg class="gcard-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>
  <filter id="tt-glass-distort" x="0%" y="0%" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.012 0.012" numOctaves="2" seed="92" result="noise"/>
    <feGaussianBlur in="noise" stdDeviation="2" result="blurred"/>
    <feDisplacementMap in="SourceGraphic" in2="blurred" scale="85" xChannelSelector="R" yChannelSelector="G"/>
  </filter></defs></svg>`;
const clamp = (v, a, b) => Math.min(Math.max(v, a), Math.max(a, b));

export default function glassCard() {
  const card = $('[data-fx="glass"]'); if (!card) return;
  const stage = card.parentElement;
  card.insertAdjacentHTML('beforebegin', FILTER);
  card.classList.add('is-glass');

  let drag = null;
  const place = (x, y) => {
    const s = stage.getBoundingClientRect();
    x = clamp(x, 0, s.width - card.offsetWidth); y = clamp(y, 0, s.height - card.offsetHeight);
    Object.assign(card.style, { translate: 'none', left: x + 'px', top: y + 'px' }); // from now on the drag positions it
  };
  card.addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.target.closest('a, button')) return;
    const r = card.getBoundingClientRect();
    drag = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top };
    card.setPointerCapture(e.pointerId); card.classList.add('dragging');
    e.preventDefault(); // no text selection / image ghost-drag
  });
  card.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const s = stage.getBoundingClientRect();
    place(e.clientX - s.left - drag.dx, e.clientY - s.top - drag.dy);
  });
  const end = e => { if (drag && e.pointerId === drag.id) { drag = null; card.classList.remove('dragging'); } };
  card.addEventListener('pointerup', end); card.addEventListener('pointercancel', end);
  // keep it inside the photo when the layout changes (until it's dragged, CSS keeps it centred)
  new ResizeObserver(() => { if (card.style.left) place(card.offsetLeft, card.offsetTop); }).observe(stage);
}
