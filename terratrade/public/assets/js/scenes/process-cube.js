// Process cube — the portfolio's scroll-driven CSS-3D cube (gcube), one face per step:
// Source → Aggregate → Verify → Process → Pack → Ship. Driven by the loop registry (only on screen).
// Phones, reduced motion and no-JS get the plain step list instead (.cube-static).
import { $, $$, REDUCED, isAR } from '../core/env.js';
import { addLoop } from '../core/loop.js';

const ICON = ['i-wheat', 'i-insight', 'i-farmer', null, 'i-partnership', 'i-ship'];
const FUNNEL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 4h18l-7 8.5V19l-4 2v-8.5L3 4Z"/></svg>';
const GRAD = [['#013D27', '#0A7A33'], ['#0A7A33', '#1E9A3A'], ['#01502F', '#2E9E3A'], ['#0A7A33', '#54BA47'], ['#1E7A2E', '#6DBA3F'], ['#B86E00', '#FFA612']];

export default function processCube() {
  const section = $('#process'), wrap = $('#cubeWrap'), cube = $('#cube'), dotsEl = $('#cubeDots');
  if (!wrap || !cube) return;
  const steps = $$('.step', section);
  if (REDUCED || matchMedia('(max-width: 900px)').matches) { section.classList.add('cube-static'); return; }
  // Face transforms and stops are the portfolio's (continuous motion: tumble down, spin four sides, tumble).
  const TR = ['rotateX(-90deg)', 'none', 'rotateY(90deg)', 'rotateY(180deg)', 'rotateY(-90deg)', 'rotateX(90deg)'];
  const dir = isAR() ? -1 : 1; // spin the other way in Arabic (reading direction)
  const stops = [{ rx: 90, ry: 0 }, { rx: 0, ry: 0 }, { rx: 0, ry: -90 }, { rx: 0, ry: -180 }, { rx: 0, ry: -270 }, { rx: -90, ry: -360 }].map(s => ({ rx: s.rx, ry: s.ry * dir }));
  const TRd = TR.map(tr => tr.replace(/rotateY\((-?\d+)deg\)/, (_, d) => `rotateY(${d * dir}deg)`));
  cube.innerHTML = steps.map((s, i) => `<div class="face" style="transform:${TRd[i]} translateZ(var(--hz));--fc0:${GRAD[i][0]};--fc1:${GRAD[i][1]}">
    <span class="fnum">${s.querySelector('.snum').textContent}</span>
    <span class="fword">${s.querySelector('h3').textContent}</span>
    ${ICON[i] ? `<svg viewBox="0 0 256 256" aria-hidden="true"><use href="/assets/img/icons.svg#${ICON[i]}"/></svg>` : FUNNEL}</div>`).join('');
  dotsEl.innerHTML = steps.map(() => '<button type="button" tabindex="-1"></button>').join('');
  const setHz = () => cube.style.setProperty('--hz', cube.clientWidth / 2 + 'px'); setHz(); addEventListener('resize', setHz);
  const N = stops.length; let tgt = 0, sm = 0, last = -1;
  const upd = () => { const r = wrap.getBoundingClientRect(); tgt = Math.max(0, Math.min(1, -r.top / Math.max(1, r.height - innerHeight))); };
  addEventListener('scroll', upd, { passive: true }); upd();
  const ease = x => x < .5 ? 2 * x * x : -1 + (4 - 2 * x) * x;
  const render = idx => { steps.forEach((s, k) => s.classList.toggle('on', k === idx)); [...dotsEl.children].forEach((d, k) => d.classList.toggle('on', k === idx)); };
  addLoop('cube', () => {
    sm += (tgt - sm) * .09;
    const tt = Math.max(0, Math.min(1, sm)) * (N - 1), i = Math.min(Math.floor(tt), N - 2), f = ease(tt - i), a = stops[i], b = stops[i + 1];
    cube.style.transform = `rotateX(${a.rx + (b.rx - a.rx) * f}deg) rotateY(${a.ry + (b.ry - a.ry) * f}deg)`;
    const idx = Math.min(N - 1, Math.round(sm * (N - 1))); if (idx !== last) { last = idx; render(idx); }
  }, { el: wrap });
  dotsEl.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const i = [...dotsEl.children].indexOf(b);
    const y = wrap.offsetTop + i / (N - 1) * (wrap.offsetHeight - innerHeight); window.__lenis ? window.__lenis.scrollTo(y, { duration: 1 }) : scrollTo({ top: y, behavior: 'smooth' }); });
  render(0);
}
