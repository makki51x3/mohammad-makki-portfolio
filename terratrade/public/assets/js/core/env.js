// Shared environment flags (ported from the portfolio's REDUCED / TOUCH guards).
export const html = document.documentElement;
const RM = matchMedia('(prefers-reduced-motion: reduce)');
export let REDUCED = RM.matches;
export const TOUCH = matchMedia('(hover: none), (pointer: coarse)').matches;
export const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
export const isAR = () => html.lang === 'ar';
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const hasGSAP = () => typeof window.gsap !== 'undefined';
if (REDUCED) html.classList.add('reduced');
// Follow an OS-level change without a reload (effects that already ran keep their final state).
RM.addEventListener?.('change', e => { REDUCED = e.matches; html.classList.toggle('reduced', e.matches); window.dispatchEvent(new CustomEvent('tt:motion')); });

/** User "pause animations" switch (WCAG 2.2.2). Freezes CSS animations (html.paused) and JS loops. */
let paused = false;
try { paused = localStorage.getItem('tt-motion') === 'paused'; } catch (e) { /* storage blocked */ }
html.classList.toggle('paused', paused);
export const isPaused = () => paused;
export function setPaused(v) {
  paused = !!v; html.classList.toggle('paused', paused);
  try { localStorage.setItem('tt-motion', paused ? 'paused' : 'on'); } catch (e) { /* ignore */ }
  window.dispatchEvent(new CustomEvent('tt:motion'));
}

/** Run each initialiser in isolation so one failure can't take down the rest (portfolio run()). */
export function run(fns) {
  for (const fn of fns) { try { fn(); } catch (e) { console.error('[init]', fn.name, e); } }
}
