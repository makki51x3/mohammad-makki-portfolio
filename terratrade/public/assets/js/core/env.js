// Shared environment flags (ported from the portfolio's REDUCED / TOUCH guards).
export const html = document.documentElement;
export const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const TOUCH = matchMedia('(hover: none), (pointer: coarse)').matches;
export const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
export const isAR = () => html.lang === 'ar';
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const hasGSAP = () => typeof window.gsap !== 'undefined';
if (REDUCED) html.classList.add('reduced');
/** Run each initialiser in isolation so one failure can't take down the rest (portfolio run()). */
export function run(fns) {
  for (const fn of fns) { try { fn(); } catch (e) { console.error('[init]', fn.name, e); } }
}
