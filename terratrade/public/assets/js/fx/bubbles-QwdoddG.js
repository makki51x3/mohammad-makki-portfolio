// S3 · Hero liquid-glass bubbles.
// Adapted from "[SVG] [CSS] Marquee Glass Bubble" by Fernando Cohen (designfenix)
// https://codepen.io/designfenix/pen/QwdoddG - MIT. Source: dev/pens/QwdoddG/.
//
// The scene itself is the pen's SVG (inline in index.html): three bubble paths used as clip paths, glass edges,
// sheens and text running round the main bubble. The pen's turbulence/displacement "ripple" filters were removed
// at the client's request, so the photos (and the farmer's face) stay sharp. For speed the bubble shapes are held
// still (the pen morphed and floated them, which redrew every filtered photo each frame) and the scene is split
// into four stacked SVG layers: only the orbiting text (SMIL, #hbOrbit) still animates.
// This module adds what the pen did in JS - the pointer parallax (intensity .5 on a ±180 × ±130 range, eased
// .025 per 60 fps frame, secondary × 1.55, drop × 2.15), now moving whole layers so the compositor does it
// without a repaint - on the shared loop registry, and it freezes the orbit while the hero is off-screen, when
// motion is paused, and under reduced motion.
import { $, FINE, REDUCED, isPaused } from '../core/env.js';
import { addLoop, loadSettled } from '../core/loop.js';

const INTENSITY = .5, SMOOTHNESS = .025, GAIN = [1, 1.55, 2.15];

export default function bubbles() {
  const fig = $('[data-fx="bubbles"]'), svg = fig && $('#hbOrbit', fig); if (!svg) return;

  // main.js pauses the SMIL timeline as soon as it runs; it starts once the page has loaded (see loop.js)
  let onScreen = true, settled = false;
  const sync = () => {
    if (settled && onScreen && !REDUCED && !isPaused()) svg.unpauseAnimations(); else svg.pauseAnimations();
  };
  loadSettled.then(() => { settled = true; sync(); });
  if (REDUCED) { svg.pauseAnimations(); svg.setCurrentTime(0); }
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; sync(); }).observe(fig);
  addEventListener('tt:motion', sync);
  sync();

  if (!FINE || REDUCED) return;
  const layers = ['#hbScene', '#hbOrbit', '#hbSec', '#hbDrop'].map(s => $(s, fig));
  const gain = [GAIN[0], GAIN[0], GAIN[1], GAIN[2]];
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
    // the pen's offsets are in scene units (viewBox 1100 wide): scale them to the rendered size
    const u = fig.clientWidth / 1100;
    layers.forEach((g, i) => { g.style.transform = `translate(${(cx * gain[i] * u).toFixed(2)}px, ${(cy * gain[i] * u).toFixed(2)}px)`; });
  }, { el: fig });
}
