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

/** Animation pause state: html.paused freezes CSS animations and JS loops check isPaused(). The footer switch that set
 *  it was removed at the client's request (reduced motion still applies); a pause it saved on an earlier visit is
 *  cleared, so nobody is left with a frozen page and no switch to undo it. */
let paused = false;
try { localStorage.removeItem('tt-motion'); } catch (e) { /* storage blocked */ }
export const isPaused = () => paused;
export function setPaused(v) {
  paused = !!v; html.classList.toggle('paused', paused);
  window.dispatchEvent(new CustomEvent('tt:motion'));
}

/** Run each initialiser in isolation so one failure can't take down the rest (portfolio run()). */
export function run(fns) {
  for (const fn of fns) { try { fn(); } catch (e) { console.error('[init]', fn.name, e); } }
}
