// S3 · Hero liquid-glass bubbles.
// Adapted from "[SVG] [CSS] Marquee Glass Bubble" by Fernando Cohen (designfenix)
// https://codepen.io/designfenix/pen/QwdoddG — MIT. Source: dev/pens/QwdoddG/.
//
// The scene itself is the pen's SVG (inline in index.html): three SMIL-morphing bubble paths used as clip
// paths, turbulence + displacement "liquid" filters, glass edges, and text running round the main bubble.
// This module adds what the pen did in JS — the pointer parallax (intensity .5 on a ±180 × ±130 range, eased
// .025 per 60 fps frame, secondary × 1.55, drop × 2.15) — on the shared loop registry, and it freezes the
// SMIL timeline while the hero is off-screen, when motion is paused, and under reduced motion.
import { $, FINE, REDUCED, isPaused } from '../core/env.js';
import { addLoop } from '../core/loop.js';

const INTENSITY = .5, SMOOTHNESS = .025, GAIN = [1, 1.55, 2.15];

export default function bubbles() {
  const fig = $('[data-fx="bubbles"]'), svg = fig && $('svg.hb-scene', fig); if (!svg) return;

  let onScreen = true;
  const sync = () => {
    if (onScreen && !REDUCED && !isPaused()) svg.unpauseAnimations(); else svg.pauseAnimations();
  };
  if (REDUCED) { svg.pauseAnimations(); svg.setCurrentTime(0); }
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; sync(); }).observe(fig);
  addEventListener('tt:motion', sync);
  sync();

  if (!FINE || REDUCED) return;
  const layers = ['#hbMainPx', '#hbSecPx', '#hbDropPx'].map(s => $(s, svg));
  let tx = 0, ty = 0, cx = 0, cy = 0;
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    tx = (e.clientX / innerWidth - .5) * 180 * INTENSITY;
    ty = (e.clientY / innerHeight - .5) * 130 * INTENSITY;
  }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => { tx = ty = 0; });
  addLoop('bubbles', (now, dt) => {
    if (Math.abs(tx - cx) < .01 && Math.abs(ty - cy) < .01) return; // settled: nothing to write
    const k = 1 - (1 - SMOOTHNESS) ** (dt / (1000 / 60)); // the pen's per-frame easing, frame-rate independent
    cx += (tx - cx) * k; cy += (ty - cy) * k;
    layers.forEach((g, i) => { g.style.transform = `translate(${(cx * GAIN[i]).toFixed(2)}px, ${(cy * GAIN[i]).toFixed(2)}px)`; });
  }, { el: fig });
}
