// One animation-loop registry for the whole site.
// Every canvas / rAF effect subscribes here instead of running its own requestAnimationFrame forever:
// a loop only runs while its element is near the viewport and the tab is visible; under reduced motion
// it renders a single static frame and never runs. window.__tt.loops() lists what is running (tests use it).
import { REDUCED, isPaused } from './env.js';

const loops = new Map();
let rafId = 0, last = 0;

// Motion waits for the page: loops start once the load event has fired and the main thread has had a moment, so
// content paints first and continuous animation work stays out of the Largest-Contentful-Paint window on slow
// phones. Loops that answer the user directly (the cursor) pass { early: true } and run at once.
let settled = false;
export const loadSettled = new Promise(res => {
  const go = () => { settled = true; res(); wake(); };
  const after = () => ('requestIdleCallback' in window ? requestIdleCallback(go, { timeout: 1200 }) : setTimeout(go, 300));
  if (document.readyState === 'complete') after(); else addEventListener('load', after, { once: true });
});

function running(L) { return L.visible && (settled || L.early) && !document.hidden && !REDUCED && !isPaused(); }
function frame(now) {
  rafId = 0;
  const dt = Math.min(64, now - (last || now)); last = now;
  let any = false;
  for (const L of loops.values()) if (running(L)) { any = true; try { L.fn(now, dt); } catch (e) { console.error('[loop]', L.name, e); L.visible = false; } }
  if (any) rafId = requestAnimationFrame(frame); else last = 0;
}
function wake() { if (!rafId && [...loops.values()].some(running)) rafId = requestAnimationFrame(frame); }

/**
 * @param {string} name
 * @param {(now:number, dt:number) => void} fn
 * @param {{ el?: Element, margin?: string, early?: boolean }} [opts] el = element whose visibility gates the loop;
 *   early = run before the page has settled (only for loops that follow the user's input)
 */
export function addLoop(name, fn, { el, margin = '120px', early = false } = {}) {
  const L = { name, fn, visible: !el, early };
  loops.set(name, L);
  if (REDUCED) { try { fn(performance.now(), 16); } catch (e) { console.error('[loop]', name, e); } return L; }
  if (el) new IntersectionObserver(([e]) => { L.visible = e.isIntersecting; wake(); }, { rootMargin: margin }).observe(el);
  wake();
  return L;
}
export function removeLoop(name) { loops.delete(name); }
/** Nudge a loop to draw once more (e.g. after a theme change while static). */
export function redraw(name) { const L = loops.get(name); if (L) try { L.fn(performance.now(), 16); } catch (e) { console.error(e); } }
document.addEventListener('visibilitychange', wake);
addEventListener('tt:motion', wake);
window.__tt = Object.assign(window.__tt || {}, { loops: () => [...loops.values()].filter(running).map(l => l.name) });
