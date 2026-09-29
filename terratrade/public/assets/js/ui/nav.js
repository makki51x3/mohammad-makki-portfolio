// Nav (portfolio liquid-glass nav + burger), active-section tracking, side HUD dots, progress bar,
// Lenis-aware anchor scrolling. Mobile menu: Escape closes it and focus returns to the burger.
import { $, $$, html } from '../core/env.js';
import { t } from '../core/i18n.js';

const OFFSET = 70;
/** Scroll to an element; if the page height changed during the scroll (lazy scenes, pin spacers),
 *  re-target once it settles so the section really lands under the nav. */
export function scrollToEl(el, { duration = 1.1 } = {}) {
  if (!el) return;
  const off = () => Math.abs(el.getBoundingClientRect().top - OFFSET) > 4;
  if (window.__lenis) {
    window.__lenis.scrollTo(el, { offset: -OFFSET, duration, easing: x => 1 - Math.pow(1 - x, 4),
      onComplete: () => { if (off()) window.__lenis.scrollTo(el, { offset: -OFFSET, duration: .5 }); } });
  } else {
    el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    setTimeout(() => { if (off()) el.scrollIntoView({ block: 'start' }); }, 900);
  }
}

export function nav() {
  const bar = $('#nav');
  const onScroll = () => bar.classList.toggle('scrolled', scrollY > 24);
  onScroll(); addEventListener('scroll', onScroll, { passive: true });

  // mobile menu
  const burger = $('#burger'), menu = $('#mnav');
  const setOpen = open => {
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', t(open ? 'nav.menuClose' : 'nav.menu'));
    if (open) { menu.hidden = false; requestAnimationFrame(() => menu.classList.add('is-open')); menu._y = scrollY; }
    else { menu.classList.remove('is-open'); setTimeout(() => { if (!menu.classList.contains('is-open')) menu.hidden = true; }, 300); }
  };
  burger.addEventListener('click', () => setOpen(burger.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', e => { if (e.target.closest('a')) setOpen(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') { setOpen(false); burger.focus(); } });
  addEventListener('scroll', () => { if (menu.classList.contains('is-open') && Math.abs(scrollY - (menu._y || 0)) > 140) setOpen(false); }, { passive: true });

  // deep link on load (#contact etc.): correct the landing once lazy scenes have settled
  if (location.hash.length > 1) {
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target) addEventListener('load', () => setTimeout(() => scrollToEl(target, { duration: .6 }), 300), { once: true });
  }

  // in-page anchors → smooth scroll (Lenis), then move focus for keyboard/screen-reader users
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]'); if (!a) return;
    const id = a.getAttribute('href').slice(1); const target = id ? document.getElementById(id) : null;
    if (!target) return;
    e.preventDefault(); scrollToEl(target);
    history.replaceState(null, '', '#' + id);
    const focusable = target.matches('section, main') ? target.querySelector('h1, h2') || target : target;
    if (!focusable.hasAttribute('tabindex')) focusable.setAttribute('tabindex', '-1');
    setTimeout(() => focusable.focus({ preventScroll: true }), 650);
  });

  // language link keeps the current section
  $$('a[hreflang]').forEach(a => a.addEventListener('click', () => {
    const base = a.getAttribute('href').split('#')[0]; if (location.hash) a.setAttribute('href', base + location.hash);
  }));
}

export function progress() {
  const bar = $('#progress'); if (!bar) return;
  let tick = false;
  const up = () => { tick = false; const max = document.documentElement.scrollHeight - innerHeight; bar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`; };
  addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(up); } }, { passive: true }); up();
}

export function sections() {
  const secs = $$('[data-chapter]');
  const hud = $('#hud');
  if (hud) hud.innerHTML = secs.map(s => `<a href="#${s.id}" aria-label="${s.dataset.chname}"><span>${s.dataset.chname}</span></a>`).join('');
  const links = new Map($$('.links a, #hud a').map(a => [a, a.getAttribute('href').slice(1)]));
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    for (const [a, id] of links) { const on = id === e.target.id; a.classList.toggle('on', on); on ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current'); }
  }), { rootMargin: '-45% 0px -50% 0px' });
  secs.forEach(s => io.observe(s));
}
