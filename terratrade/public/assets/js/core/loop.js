// One animation-loop registry for the whole site.
// Every canvas / rAF effect subscribes here instead of running its own requestAnimationFrame forever:
// a loop only runs while its element is near the viewport and the tab is visible; under reduced motion
// it renders a single static frame and never runs. window.__tt.loops() lists what is running (tests use it).
import { REDUCED } from './env.js';

const loops = new Map();
let rafId = 0, last = 0;

function running(L) { return L.visible && !document.hidden && !REDUCED; }
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
 * @param {{ el?: Element, margin?: string }} [opts] el = element whose visibility gates the loop
 */
export function addLoop(name, fn, { el, margin = '120px' } = {}) {
  const L = { name, fn, visible: !el };
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
window.__tt = Object.assign(window.__tt || {}, { loops: () => [...loops.values()].filter(running).map(l => l.name) });
