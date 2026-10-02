// Markets globe - the portfolio's 2D-canvas dot globe (tglobe) extended with animated great-circle
// trade routes from Nigeria. Routes, regions and labels are read from the HTML market list, so the
// Arabic page needs no extra data. TerraTrade exports to both regions: Middle East routes amber, Asia routes green.
// Portfolio fixes: no touch-action:none (vertical swipes scroll the page), loop only runs on screen,
// colours are cached per theme instead of getComputedStyle every frame, HTML tooltips (translatable).
import { DOTS, TAGS } from '../geo/globe-data.js';
import { $, $$, REDUCED, TOUCH } from '../core/env.js';
import { addLoop, redraw } from '../core/loop.js';
import { t } from '../core/i18n.js';
import { isDark } from '../core/theme.js';

const RAD = Math.PI / 180;
const V = (la, lo) => [Math.cos(la * RAD) * Math.cos(lo * RAD), Math.sin(la * RAD), Math.cos(la * RAD) * Math.sin(lo * RAD)];
const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const toLatLon = v => [Math.asin(v[1]) / RAD, Math.atan2(v[2], v[0]) / RAD];

/** great-circle arc lifted off the surface (slerp + sine lift) */
function arc(A, B, n = 72) {
  const w = Math.acos(Math.min(1, Math.max(-1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2]))), s = Math.sin(w), h = .05 + .2 * w / Math.PI;
  return Array.from({ length: n + 1 }, (_, i) => {
    const tt = i / n, a = Math.sin((1 - tt) * w) / s, b = Math.sin(tt * w) / s, r = 1 + h * Math.sin(Math.PI * tt);
    return [(a * A[0] + b * B[0]) * r, (a * A[1] + b * B[1]) * r, (a * A[2] + b * B[2]) * r];
  });
}

const PALETTE = {
  light: { dot: '1,61,39', dotA: .5, ng: '#1E9A3A', active: '#F29900', activeDot: '#E08A00', asia: '#1F8F3A', sphere0: 'rgba(233,255,229,.9)', sphere1: 'rgba(190,230,200,.55)', rim: 'rgba(1,61,39,.18)', tagActive: '#F5A21B', tagAsia: '#7BC96B' },
  dark: { dot: '170,230,160', dotA: .55, ng: '#6FDB5E', active: '#FFB938', activeDot: '#FFB938', asia: '#7ED957', sphere0: 'rgba(20,70,45,.55)', sphere1: 'rgba(3,20,12,.75)', rim: 'rgba(160,230,150,.22)', tagActive: '#FFB938', tagAsia: '#9BE88C' },
};

export default function globe() {
  const cv = $('#globe'), box = cv?.parentElement, tip = $('#globeTip'); if (!cv) return;
  const ctx = cv.getContext('2d');
  const D = Math.min(devicePixelRatio || 1, TOUCH ? 1.5 : 2);
  let S = 0;
  const resize = () => { S = Math.round(cv.clientWidth * D); cv.width = S; cv.height = S; redraw('globe'); };

  // ---- data ----
  const bin = atob(DOTS), N = bin.length / 5, dv = new DataView(Uint8Array.from(bin, c => c.charCodeAt(0)).buffer);
  const dots = []; for (let i = 0; i < N; i++) { const la = dv.getInt16(i * 5, true) / 10, lo = dv.getInt16(i * 5 + 2, true) / 10; dots.push({ p: V(la, lo), tag: TAGS[dv.getUint8(i * 5 + 4) - 1] || '' }); }
  const originEl = $('[data-origin]');
  const O = V(+originEl.dataset.lat, +originEl.dataset.lon);
  const REGION_OF = { SA: 'me', AE: 'me', QA: 'me', LB: 'me', SY: 'me', JP: 'asia', KR: 'asia', CN: 'asia' };
  const markets = $$('[data-market]').map((li, k) => {
    const p = V(+li.dataset.lat, +li.dataset.lon);
    return { li, id: li.dataset.market, region: li.dataset.region, name: li.querySelector('[data-i18n]')?.textContent.trim() || li.textContent.trim(), p, pts: arc(O, p), phase: k * .17 };
  });

  // ---- view state ----
  let rot = 0, tilt = 0, target = null, region = 'all', focus = null, hover = null, idleUntil = 0, autoFlip = performance.now() + 6000, flip = false;
  const viewFor = r => { const ms = markets.filter(m => r === 'all' || m.region === r); const v = norm(ms.reduce((a, m) => [a[0] + m.p[0], a[1] + m.p[1], a[2] + m.p[2]], [...O].map(x => x * ms.length * .6))); return toLatLon(v); };
  const goto = ([lat, lon], now = false) => {
    let tr = Math.PI / 2 - lon * RAD; while (tr - rot > Math.PI) tr -= 2 * Math.PI; while (rot - tr > Math.PI) tr += 2 * Math.PI;
    const tt = Math.max(-1.1, Math.min(1.1, lat * RAD));
    if (now || REDUCED) { rot = tr; tilt = tt; target = null; redraw('globe'); } else target = { r: tr, t: tt };
  };
  const views = { me: viewFor('me'), asia: viewFor('asia') };
  goto(views.me, true);

  // ---- colours (cached per theme) ----
  let C = isDark() ? PALETTE.dark : PALETTE.light;
  addEventListener('tt:theme', e => { C = e.detail.dark ? PALETTE.dark : PALETTE.light; redraw('globe'); });

  // ---- projection (portfolio P) ----
  let cosr, sinr, cost, sint, R, CX;
  const P = v => { const x = v[0] * cosr - v[2] * sinr, z0 = v[0] * sinr + v[2] * cosr; return [x, v[1] * cost - z0 * sint, v[1] * sint + z0 * cost]; };
  // screen x is mirrored so east is to the right (the portfolio globe rendered the world mirrored)
  const scr = q => [CX - q[0] * R, CX - q[1] * R];
  const visible = q => q[2] >= 0 || Math.hypot(q[0], q[1]) > 1;

  function draw(now) {
    if (!S) return;
    if (target) { rot += (target.r - rot) * .08; tilt += (target.t - tilt) * .08; if (Math.abs(target.r - rot) < .004 && Math.abs(target.t - tilt) < .004) target = null; }
    else if (!drag && !REDUCED && now > idleUntil) {
      if (region === 'all') { if (now > autoFlip && !focus) { autoFlip = now + 7000; flip = !flip; goto(flip ? views.asia : views.me); } }
      else rot -= .0006;
    }
    cosr = Math.cos(rot); sinr = Math.sin(rot); cost = Math.cos(tilt); sint = Math.sin(tilt);
    R = S * .4; CX = S / 2;
    ctx.clearRect(0, 0, S, S);
    // sphere
    const g = ctx.createRadialGradient(CX - R * .35, CX - R * .4, R * .1, CX, CX, R);
    g.addColorStop(0, C.sphere0); g.addColorStop(1, C.sphere1);
    ctx.beginPath(); ctx.arc(CX, CX, R, 0, 6.2832); ctx.fillStyle = g; ctx.fill();
    // dots
    for (const d of dots) {
      const q = P(d.p); if (q[2] < -.05) continue;
      const [px, py] = scr(q), depth = (q[2] + .05) / 1.05;
      const inRegion = region === 'all' || !REGION_OF[d.tag] || REGION_OF[d.tag] === region;
      let col = `rgba(${C.dot},${(.12 + depth * C.dotA) * (inRegion ? 1 : .5)})`, r = Math.max(.6, 1.15 * D * (q[2] * .45 + .7));
      if (d.tag === 'NG') { col = C.ng; r *= 1.35; }
      else if (d.tag && inRegion) { col = REGION_OF[d.tag] === 'asia' ? C.tagAsia : C.tagActive; r *= 1.3; }
      ctx.beginPath(); ctx.arc(px, py, r, 0, 6.2832); ctx.fillStyle = col; ctx.fill();
    }
    // routes
    const secs = now / 1000;
    for (const m of markets) {
      const on = region === 'all' || m.region === region, hi = focus === m || hover === m;
      const alpha = on ? (hi ? 1 : .9) : .12;
      const asia = m.region === 'asia', col = asia ? C.asia : C.active;
      const Q = m.pts.map(P);
      ctx.lineWidth = (hi ? 3 : 2) * D; ctx.lineCap = 'round';
      ctx.strokeStyle = col; ctx.globalAlpha = alpha * .35;
      ctx.beginPath(); let pen = false;
      for (const q of Q) { if (!visible(q)) { pen = false; continue; } const [x, y] = scr(q); if (!pen) { ctx.moveTo(x, y); pen = true; } else ctx.lineTo(x, y); }
      ctx.stroke();
      // comet
      if (on) {
        const head = REDUCED ? 1 : ((secs / (asia ? 4.6 : 3.4) + m.phase) % 1.3);
        const tail = REDUCED ? 0 : Math.max(0, head - .3), end = Math.min(1, head);
        if (end > tail) {
          const i0 = Math.floor(tail * (Q.length - 1)), i1 = Math.floor(end * (Q.length - 1));
          for (let i = i0; i < i1; i++) {
            const a = Q[i], b = Q[i + 1]; if (!visible(a) || !visible(b)) continue;
            const [x0, y0] = scr(a), [x1, y1] = scr(b);
            ctx.globalAlpha = alpha * (REDUCED ? .9 : Math.pow((i - i0) / Math.max(1, i1 - i0), 1.6));
            ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
          }
        }
        // landing pulse
        const land = head > 1 && head < 1.3 ? (head - 1) / .3 : REDUCED ? .4 : -1;
        const qd = Q[Q.length - 1];
        if (land >= 0 && visible(qd)) { const [x, y] = scr(qd); ctx.globalAlpha = alpha * (1 - land); ctx.lineWidth = 1.5 * D; ctx.beginPath(); ctx.arc(x, y, (4 + land * 14) * D, 0, 6.2832); ctx.stroke(); }
      }
      ctx.globalAlpha = 1;
      // destination marker
      const qd = P(m.p);
      if (qd[2] >= 0) { const [x, y] = scr(qd); ctx.globalAlpha = on ? 1 : .35; ctx.beginPath(); ctx.arc(x, y, (hi ? 5 : 3.8) * D, 0, 6.2832); ctx.fillStyle = asia ? C.asia : C.activeDot; ctx.fill(); ctx.globalAlpha = 1; m.sx = x / D; m.sy = y / D; m.vis = true; } else m.vis = false;
    }
    // origin
    const qo = P(O);
    if (qo[2] >= 0) {
      const [x, y] = scr(qo), pulse = REDUCED ? .5 : .5 + .5 * Math.sin(now * .004);
      originMark.vis = true; originMark.sx = x / D; originMark.sy = y / D;
      ctx.beginPath(); ctx.arc(x, y, 6 * D, 0, 6.2832); ctx.fillStyle = C.ng; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, (8 + pulse * 10) * D, 0, 6.2832); ctx.strokeStyle = C.ng; ctx.globalAlpha = .7 - pulse * .55; ctx.lineWidth = 1.5 * D; ctx.stroke(); ctx.globalAlpha = 1;
    }
    // rim
    if (qo[2] < 0) originMark.vis = false;
    ctx.beginPath(); ctx.arc(CX, CX, R + 1.5 * D, 0, 6.2832); ctx.strokeStyle = C.rim; ctx.lineWidth = D; ctx.stroke();
    if (tip && !tip.hidden && tip._m) placeTip(tip._m);
  }

  // ---- tooltip ----
  function placeTip(m) {
    if (!m.vis) { tip.hidden = true; return; }
    tip.style.left = m.sx + 'px'; tip.style.top = m.sy + 'px';
  }
  function showTip(m) {
    if (!m) { tip.hidden = true; tip._m = null; return; }
    tip.textContent = m.origin ? t('markets.tipOrigin') : `${m.name} · ${t('markets.tipExport')}`;
    tip._m = m; tip.hidden = false; placeTip(m);
  }
  // the origin behaves like a marker for hover/tap tooltips
  const originMark = { origin: true, vis: false, sx: 0, sy: 0 };
  const hittable = () => markets.concat(originMark).filter(m => m.vis);

  // ---- interaction ----
  let drag = null;
  cv.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    if (e.pointerType === 'mouse') cv.setPointerCapture?.(e.pointerId); // touch keeps native vertical scrolling (touch-action: pan-y)
    drag = { x: e.clientX, y: e.clientY, rot, tilt, moved: false }; target = null; idleUntil = performance.now() + 6000;
  });
  const endDrag = () => { drag = null; };
  cv.addEventListener('pointercancel', endDrag);
  cv.addEventListener('lostpointercapture', endDrag);
  addEventListener('pointercancel', endDrag);
  addEventListener('pointermove', e => {
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) > 3) drag.moved = true;
      rot = drag.rot + dx * .006;
      if (e.pointerType === 'mouse') tilt = Math.max(-1.1, Math.min(1.1, drag.tilt + dy * .005));
      if (REDUCED) redraw('globe');
      return;
    }
    if (e.target !== cv || e.pointerType !== 'mouse') return;
    const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    const near = hittable().map(m => [m, Math.hypot(m.sx - mx, m.sy - my)]).sort((a, b) => a[1] - b[1])[0];
    const m = near && near[1] < 18 ? near[0] : null;
    if (m !== hover) { hover = m && !m.origin ? m : null; showTip(m); markets.forEach(x => x.li.classList.toggle('on', x === hover || x === focus)); if (REDUCED) redraw('globe'); }
  }, { passive: true });
  addEventListener('pointerup', e => {
    if (drag && !drag.moved && e.target === cv) { // tap → nearest marker
      const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
      const near = hittable().map(m => [m, Math.hypot(m.sx - mx, m.sy - my)]).sort((a, b) => a[1] - b[1])[0];
      showTip(near && near[1] < 28 ? near[0] : null);
    }
    drag = null;
  });
  cv.addEventListener('pointerleave', () => { if (!drag) { hover = null; showTip(focus); } });

  // region buttons
  $$('[data-region]').forEach(b => { if (b.tagName !== 'BUTTON') return; b.addEventListener('click', () => {
    region = b.dataset.region; focus = null;
    $$('button[data-region]').forEach(x => { const on = x === b; x.classList.toggle('active', on); x.setAttribute('aria-pressed', String(on)); });
    markets.forEach(m => { m.li.classList.toggle('dim', region !== 'all' && m.region !== region); m.li.classList.remove('on'); m.li.querySelector('button')?.setAttribute('aria-pressed', 'false'); });
    showTip(null); idleUntil = 0; autoFlip = performance.now() + 7000; flip = false;
    goto(region === 'all' ? views.me : views[region]);
  }); });
  // market list: click/hover highlights a route
  markets.forEach(m => {
    const btn = m.li.querySelector('button') || m.li;
    btn.setAttribute('aria-pressed', 'false');
    const pick = () => { focus = m; idleUntil = performance.now() + 8000; markets.forEach(x => { x.li.classList.toggle('on', x === m); x.li.querySelector('button')?.setAttribute('aria-pressed', String(x === m)); }); goto(toLatLon(norm([O[0] + m.p[0] * 1.4, O[1] + m.p[1] * 1.4, O[2] + m.p[2] * 1.4]))); setTimeout(() => showTip(m), REDUCED ? 0 : 700); };
    btn.addEventListener('click', pick);
    m.li.addEventListener('pointerenter', () => { hover = m; if (REDUCED) redraw('globe'); });
    m.li.addEventListener('pointerleave', () => { hover = null; if (REDUCED) redraw('globe'); });
  });

  new ResizeObserver(resize).observe(box); resize();
  addLoop('globe', draw, { el: cv });
}
