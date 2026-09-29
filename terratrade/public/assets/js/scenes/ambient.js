// Ambient background - the portfolio starfield remixed into drifting pollen / seed motes:
// dark theme = warm amber "fireflies" with a soft glow, light theme = faint green & amber specks.
// Runs only while the hero is on screen (the fixed canvas fades out below it).
import { $, TOUCH } from '../core/env.js';
import { addLoop, redraw } from '../core/loop.js';
import { isDark } from '../core/theme.js';

export default function ambient() {
  const cv = $('#ambient'), hero = $('#top'); if (!cv || !hero) return;
  const ctx = cv.getContext('2d');
  const D = Math.min(devicePixelRatio || 1, TOUCH ? 1.5 : 1.75);
  let w = 0, h = 0, motes = [], mx = 0, my = 0;
  const make = () => ({ x: Math.random(), y: Math.random(), z: Math.random() * .8 + .2, s: Math.random() * 6.28, v: Math.random() * .6 + .4, hue: Math.random() < .7 ? 0 : 1 });
  function size() {
    w = cv.width = Math.round(innerWidth * D); h = cv.height = Math.round(innerHeight * D);
    const n = TOUCH ? 34 : Math.min(90, Math.round(innerWidth / 16));
    while (motes.length < n) motes.push(make()); motes.length = n;
  }
  size(); addEventListener('resize', () => { size(); redraw('ambient'); });
  if (!TOUCH) addEventListener('pointermove', e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; }, { passive: true });
  let dark = isDark();
  addEventListener('tt:theme', e => { dark = e.detail.dark; redraw('ambient'); });
  const io = new IntersectionObserver(([e]) => cv.style.opacity = e.isIntersecting ? '1' : '0', { rootMargin: '0px 0px -30% 0px' });
  io.observe(hero); cv.style.transition = 'opacity .8s';
  addLoop('ambient', (now, dt) => {
    ctx.clearRect(0, 0, w, h);
    const k = dt / 16;
    for (const m of motes) {
      m.y -= .00045 * m.v * k * (1.2 - m.z); m.s += .012 * k;
      m.x += Math.sin(m.s) * .00035 * k;
      if (m.y < -.05) { Object.assign(m, make(), { y: 1.05 }); }
      const px = (m.x - mx * .03 * m.z) * w, py = (m.y - my * .03 * m.z) * h;
      const r = (1.1 + m.z * 2.2) * D;
      const tw = .55 + .45 * Math.sin(m.s * 1.7);
      if (dark) {
        const col = m.hue ? '160,230,140' : '255,190,80';
        const g = ctx.createRadialGradient(px, py, 0, px, py, r * 4);
        g.addColorStop(0, `rgba(${col},${.75 * tw * m.z})`); g.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, r * 4, 0, 6.3); ctx.fill();
      } else {
        ctx.fillStyle = m.hue ? `rgba(255,166,18,${.35 * tw * m.z})` : `rgba(10,122,51,${.28 * tw * m.z})`;
        ctx.beginPath(); ctx.ellipse(px, py, r, r * .7, m.s, 0, 6.3); ctx.fill();
      }
    }
  }, { el: hero, margin: '0px' });
}
