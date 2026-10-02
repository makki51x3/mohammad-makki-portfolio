// Product filter: the divisions are the tabs (portfolio tab + character-roll heading).
// Product cards: a card turns over when it is clicked, tapped or activated from the keyboard, and only then
// shows "Request a quote" and "Spec sheet" (RwKPapa flip, CSS in fx.css [data-fx="flip"]). One card is turned at
// a time; Escape, the back's "back to the photo" control or a click elsewhere turns it back. The hidden face is
// inert, so the keyboard never lands on buttons you can't see.
import { $, $$, REDUCED, hasGSAP } from '../core/env.js';
import { roll } from './textfx.js';

let turned = null;
const face = (c, sel) => c.querySelector(sel);
function turn(c, on, focus) {
  if (on && turned && turned !== c) turn(turned, false);
  c.classList.toggle('is-flipped', on);
  face(c, '.pturn').setAttribute('aria-expanded', String(on));
  face(c, '.pback').inert = !on; face(c, '.pfront').inert = on;
  if (on) turned = c; else if (turned === c) turned = null;
  if (!focus) return;
  // the side coming round is visibility:hidden until the card is edge-on (fx.css), and hidden elements can't take
  // focus: move it as soon as the target itself is visible (it inherits the swap, and under reduced motion the
  // global 1 ms transition still holds it hidden for a frame)
  const target = face(c, on ? '.pquote' : '.pturn');
  let frames = 0;
  const go = () => {
    if (c.classList.contains('is-flipped') !== on) return; // turned again meanwhile
    if (getComputedStyle(target).visibility !== 'visible' && frames++ < 120) return requestAnimationFrame(go);
    target.focus({ preventScroll: true });
  };
  go();
}

export function cards() {
  const grid = $('#pgrid'); if (!grid) return;
  const all = $$('.pcard', grid);
  all.forEach(c => turn(c, false));
  grid.classList.add('flip-ready');
  grid.addEventListener('click', e => {
    const c = e.target.closest('.pcard'); if (!c) return;
    // e.detail === 0: activated from the keyboard, so focus follows to the side that's now showing
    if (e.target.closest('.pturn')) turn(c, true, e.detail === 0);
    else if (e.target.closest('.punturn')) turn(c, false, true);
  });
  addEventListener('keydown', e => { if (e.key === 'Escape' && turned && !document.querySelector('dialog[open]')) turn(turned, false, true); });
  document.addEventListener('click', e => { if (turned && !turned.contains(e.target) && !e.target.closest('dialog')) turn(turned, false); });
}

export function products() {
  const bar = $('.filter'), head = $('#panelH'); if (!bar) return;
  const live = $('#panelHsr', head), vis = $('.roll', head) || head;
  const cards = $$('.pcard');
  let busy = false;
  bar.addEventListener('click', async e => {
    const b = e.target.closest('[data-filter]'); if (!b || busy || b.classList.contains('active')) return;
    busy = true;
    if (turned) turn(turned, false);
    const f = b.dataset.filter;
    $$('[data-filter]', bar).forEach(x => { const on = x === b; x.classList.toggle('active', on); x.setAttribute('aria-pressed', String(on)); });
    const show = cards.filter(c => f === 'all' || c.dataset.div === f);
    const hide = cards.filter(c => !show.includes(c));
    const text = head.dataset['h' + f[0].toUpperCase() + f.slice(1)] || head.textContent;
    const anim = hasGSAP() && !REDUCED;
    if (live) live.textContent = text; // announced once, as a whole sentence
    const headDone = roll(vis, text);
    if (anim) await new Promise(res => gsap.to(cards.filter(c => !c.hidden), { opacity: 0, y: 14, scale: .97, duration: .22, stagger: .02, ease: 'power2.in', onComplete: res }));
    hide.forEach(c => { c.hidden = true; });
    show.forEach(c => { c.hidden = false; c.classList.add('in'); });
    if (anim) gsap.fromTo(show, { opacity: 0, y: 18, scale: .97 }, { opacity: 1, y: 0, scale: 1, duration: .5, stagger: .05, ease: 'power3.out', clearProps: 'transform,opacity' });
    if (window.ScrollTrigger) ScrollTrigger.refresh();
    await headDone; busy = false;
  });
}
