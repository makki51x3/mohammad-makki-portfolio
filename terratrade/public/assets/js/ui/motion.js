// Motion layer ported from the portfolio: Lenis smooth scroll on the GSAP ticker, reveal-on-scroll,
// hero melt + photo parallax, scroll-velocity skew on the product grid, tilt + cursor glow cards,
// magnetic buttons, contact spotlight, manifesto fallback, Farmer-First "growing stem".
import { $, $$, html, REDUCED, TOUCH, FINE, hasGSAP } from '../core/env.js';

export function smooth() {
  if (!hasGSAP()) return;
  gsap.registerPlugin(ScrollTrigger);
  if (REDUCED || !window.Lenis) return;
  // prevent: let native scrolling happen inside dialogs (Lenis would otherwise swallow wheel/touch there)
  const lenis = new Lenis({ autoRaf: false, lerp: .11, wheelMultiplier: 1, touchMultiplier: 1.6, prevent: n => n.nodeName === 'DIALOG' || n.hasAttribute?.('data-lenis-prevent') });
  window.__lenis = lenis;
  // stop smooth scrolling while a modal is open (portfolio 'dlgopen' observer)
  new MutationObserver(() => html.classList.contains('dlgopen') ? lenis.stop() : lenis.start())
    .observe(html, { attributes: true, attributeFilter: ['class'] });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

export function reveal() {
  html.classList.add('booted'); // cancels the CSS failsafe that would reveal everything if JS never ran
  const els = $$('.reveal'); if (!els.length) return;
  if (REDUCED || !('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
  // once revealed, drop the reveal classes so the long reveal transition stops overriding hover/tilt transitions
  const settle = el => el.addEventListener('transitionend', function f(ev) {
    if (ev.target !== el || ev.propertyName !== 'opacity') return;
    el.removeEventListener('transitionend', f); el.classList.remove('reveal', 'in'); el.style.transitionDelay = '';
  });
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { settle(e.target); e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12, rootMargin: '0px 0px -40px 0px' });
  els.forEach(e => {
    const group = e.closest('.pgrid, .scards, .plogos, .ibanners');
    if (group) e.style.transitionDelay = ([...e.parentElement.children].indexOf(e) % 4) * 70 + 'ms';
    io.observe(e);
  });
}

export function depth() {
  if (!hasGSAP() || REDUCED) return;
  // hero melts away as you scroll past it (portfolio "giana" melt) — keyed to the hero's bottom edge, so on phones,
  // where the bubble scene sits under the copy, it only starts once that scene is on its way out too
  gsap.to('#heroInner', { opacity: 0, filter: 'blur(8px)', y: -60, ease: 'none', scrollTrigger: { trigger: '#top', start: 'bottom 55%', end: 'bottom 5%', scrub: true } });
  // scroll-velocity skew on the product grid
  const grid = $('#pgrid');
  if (grid) {
    const set = gsap.quickSetter(grid, 'skewY', 'deg'); const proxy = { skew: 0 };
    ScrollTrigger.create({ onUpdate(self) {
      const v = gsap.utils.clamp(-4, 4, self.getVelocity() / -420);
      if (Math.abs(v) > Math.abs(proxy.skew)) { proxy.skew = v; gsap.to(proxy, { skew: 0, duration: .7, ease: 'power3', overwrite: true, onUpdate: () => set(proxy.skew) }); }
    } });
  }
}

export function tilt() {
  if (TOUCH) return;
  $$('[data-tilt]').forEach(el => {
    let raf = 0;
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      el.style.setProperty('--mx', px * 100 + '%'); el.style.setProperty('--my', py * 100 + '%');
      if (REDUCED) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { el.style.transform = `perspective(900px) rotateX(${(.5 - py) * 6}deg) rotateY(${(px - .5) * 8}deg) translateY(-4px)`; });
    });
    el.addEventListener('pointerleave', () => { cancelAnimationFrame(raf); el.style.transform = ''; });
  });
}

export function magnetic() {
  if (TOUCH || REDUCED || !hasGSAP()) return;
  $$('[data-magnet]').forEach(el => {
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      const x = gsap.utils.mapRange(r.left, r.right, -r.width / 2, r.width / 2, e.clientX) * .3;
      const y = gsap.utils.mapRange(r.top, r.bottom, -r.height / 2, r.height / 2, e.clientY) * .45;
      gsap.to(el, { x, y, duration: .4, ease: 'power2.out', overwrite: 'auto' });
    });
    el.addEventListener('pointerleave', () => gsap.to(el, { x: 0, y: 0, duration: .7, ease: 'elastic.out(1,.4)', overwrite: 'auto' }));
  });
}

export function spotlight() {
  const card = $('#contactCard'); if (!card || !FINE) return;
  card.addEventListener('pointermove', e => { const r = card.getBoundingClientRect(); card.style.setProperty('--sx', (e.clientX - r.left) + 'px'); card.style.setProperty('--sy', (e.clientY - r.top) + 'px'); });
}

export function manifesto() {
  if (CSS.supports?.('animation-timeline: view()')) return;
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .4 });
  $$('.mline').forEach(el => io.observe(el));
}

/* Farmer-First stem: a green rail grows with scroll; leaves open as it reaches them (portfolio timeline) */
export function stem() {
  const list = $('#stem'), fill = $('#stemFill'); if (!list || !fill) return;
  const items = $$('.stem-item', list);
  if (REDUCED) { items.forEach(i => i.classList.add('in')); fill.style.height = '100%'; return; }
  let tick = false;
  const up = () => {
    tick = false;
    const r = list.getBoundingClientRect(); const pr = Math.max(0, Math.min(1, (innerHeight * .7 - r.top) / r.height));
    fill.style.height = pr * 100 + '%';
    const y = r.top + pr * r.height;
    items.forEach(it => it.classList.toggle('in', it.getBoundingClientRect().top + 12 < y));
  };
  addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(up); } }, { passive: true }); up();
}

