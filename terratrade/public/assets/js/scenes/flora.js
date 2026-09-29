// Low-poly crop row along the footer - the portfolio's lowPolyFlora() (geometric trees that sway)
// remixed into a field of wheat and maize stalks in the brand greens with harvest-amber heads.
// Decorative only (aria-hidden). Sway is a CSS animation, so "Pause animations" and reduced motion stop it.
import { $ } from '../core/env.js';

const GREENS = [['#1E7A2E', '#2E9E3A', '#54BA47'], ['#0A7A33', '#1E9A3A', '#3FAE3F'], ['#2E6B2A', '#3F8F35', '#6DBA4F']];
const HEADS = ['#E8A23A', '#F2B84B', '#D98E24'];
// small deterministic PRNG so the row looks the same on every visit
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function wheat(h, pal, head, r) {
  const w = 30; let s = `<polygon points="${w / 2 - 1.2},${h} ${w / 2 + 1.2},${h} ${w / 2 + .6},${h * .28} ${w / 2 - .6},${h * .28}" fill="${pal[0]}"/>`;
  for (let i = 0; i < 2; i++) { const y = h * (.55 + i * .18), d = i % 2 ? 1 : -1;
    s += `<polygon points="${w / 2},${y} ${w / 2 + d * 13},${y - h * .16} ${w / 2 + d * 3},${y - h * .05}" fill="${pal[1 + (i % 2)]}"/>`; }
  for (let k = 0; k < 6; k++) { const y = h * .3 - k * h * .045, d = k % 2 ? 1 : -1;
    s += `<polygon points="${w / 2},${y} ${w / 2 + d * 4.5},${y - h * .04} ${w / 2},${y - h * .085} ${w / 2 - d * 1},${y - h * .04}" fill="${head}"/>`; }
  s += `<polygon points="${w / 2},${h * .03} ${w / 2 + 1},${h * .02 + 10} ${w / 2 - 1},${h * .02 + 10}" fill="${head}"/>`;
  return [w, s];
}
function maize(h, pal, head, r) {
  const w = 38; let s = `<polygon points="${w / 2 - 2},${h} ${w / 2 + 2},${h} ${w / 2 + 1},${h * .12} ${w / 2 - 1},${h * .12}" fill="${pal[0]}"/>`;
  for (let i = 0; i < 4; i++) { const y = h * (.82 - i * .17), d = i % 2 ? 1 : -1;
    s += `<polygon points="${w / 2},${y} ${w / 2 + d * 18},${y - h * .1} ${w / 2 + d * 16},${y - h * .06} ${w / 2 + d * 2},${y + 2}" fill="${pal[1 + (i % 2)]}"/>`; }
  s += `<polygon points="${w / 2 + 2},${h * .5} ${w / 2 + 8},${h * .44} ${w / 2 + 7},${h * .3} ${w / 2 + 2},${h * .36}" fill="${head}"/>`;
  s += `<polygon points="${w / 2},${h * .12} ${w / 2 + 5},${h * .02} ${w / 2 - 4},${h * .04}" fill="${pal[2]}"/>`;
  return [w, s];
}

export default function flora() {
  const foot = $('.site-foot'); if (!foot || $('.croprow', foot)) return;
  const r = rng(2023);
  const row = document.createElement('div'); row.className = 'croprow'; row.setAttribute('aria-hidden', 'true');
  const n = Math.round(Math.min(64, innerWidth / 22));
  let html = '';
  for (let i = 0; i < n; i++) {
    const h = 46 + r() * 70, pal = GREENS[Math.floor(r() * GREENS.length)], head = HEADS[Math.floor(r() * HEADS.length)];
    const [w, s] = r() < .62 ? wheat(h, pal, head, r) : maize(h, pal, head, r);
    html += `<svg class="stalk" style="--d:${(-r() * 7).toFixed(2)}s;--sw:${(1 + r() * 1.6).toFixed(2)}deg;left:${(i / n * 100 + r() * 1.2).toFixed(2)}%" width="${w}" height="${h.toFixed(0)}" viewBox="0 0 ${w} ${h.toFixed(0)}">${s}</svg>`;
  }
  row.innerHTML = html;
  foot.appendChild(row);
}
