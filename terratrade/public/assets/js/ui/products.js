// Product filter: the two divisions are the tabs (portfolio tab + character-roll heading).
import { $, $$, REDUCED, hasGSAP } from '../core/env.js';
import { roll } from './textfx.js';

export function products() {
  const bar = $('.filter'), head = $('#panelH'); if (!bar) return;
  const cards = $$('.pcard');
  let busy = false;
  bar.addEventListener('click', async e => {
    const b = e.target.closest('[data-filter]'); if (!b || busy || b.classList.contains('active')) return;
    busy = true;
    const f = b.dataset.filter;
    $$('[data-filter]', bar).forEach(x => { const on = x === b; x.classList.toggle('active', on); x.setAttribute('aria-pressed', String(on)); });
    const show = cards.filter(c => f === 'all' || c.dataset.div === f);
    const hide = cards.filter(c => !show.includes(c));
    const text = head.dataset['h' + f[0].toUpperCase() + f.slice(1)] || head.textContent;
    const anim = hasGSAP() && !REDUCED;
    const headDone = roll(head, text);
    if (anim) await new Promise(res => gsap.to(cards.filter(c => !c.hidden), { opacity: 0, y: 14, scale: .97, duration: .22, stagger: .02, ease: 'power2.in', onComplete: res }));
    hide.forEach(c => { c.hidden = true; });
    show.forEach(c => { c.hidden = false; c.classList.add('in'); });
    if (anim) gsap.fromTo(show, { opacity: 0, y: 18, scale: .97 }, { opacity: 1, y: 0, scale: 1, duration: .5, stagger: .05, ease: 'power3.out', clearProps: 'transform,opacity' });
    if (window.ScrollTrigger) ScrollTrigger.refresh();
    await headDone; busy = false;
  });
}
