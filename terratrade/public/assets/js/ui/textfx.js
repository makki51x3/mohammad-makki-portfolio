// Text effects ported from the portfolio: typed/scrambled eyebrows, split-letter gradient headline,
// gooey morph word, character-roll heading, scroll-lit paragraph, counters, marquee.
// Every effect reads its text from the DOM (so the generated Arabic page just works) and has an
// Arabic-safe mode: words, never letters (splitting Arabic letters breaks their joining).
// Screen readers always get the final text: animated copies are aria-hidden.
import { $, $$, REDUCED, isAR, hasGSAP } from '../core/env.js';
import { addLoop } from '../core/loop.js';

const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* typed + glitch eyebrows (portfolio "typed") */
export function typed() {
  const els = $$('[data-typed]'); if (!els.length || REDUCED) return;
  const SYM = '!<>-_\\/[]{}=+*^?#▓▒░';
  const io = new IntersectionObserver(es => es.forEach(en => {
    if (!en.isIntersecting) return; io.unobserve(en.target);
    const el = en.target, txt = el.textContent.trim();
    el.style.minHeight = el.offsetHeight + 'px'; // no layout shift while it types
    el.innerHTML = `<span class="sr-only">${esc(txt)}</span><span class="tt" aria-hidden="true"></span>`;
    const tt = el.querySelector('.tt');
    const caret = document.createElement('span'); caret.className = 'tcaret'; caret.textContent = '▍'; caret.setAttribute('aria-hidden', 'true');
    const done = () => setTimeout(() => { caret.remove(); el.style.minHeight = ''; }, 1100);
    if (isAR()) { // word-by-word reveal
      const words = txt.split(/\s+/); let i = 0;
      (function step() { tt.textContent = words.slice(0, ++i).join(' '); tt.appendChild(caret); if (i < words.length) setTimeout(step, 90); else done(); })();
      return;
    }
    const out = []; let idx = 0;
    (function step() {
      if (idx >= txt.length) { done(); return; }
      let cycles = Math.random() < .35 ? 2 : 0;
      (function glitch() {
        if (cycles-- > 0) { out[idx] = SYM[Math.floor(Math.random() * SYM.length)]; tt.textContent = out.join(''); tt.appendChild(caret); setTimeout(glitch, 30); }
        else { out[idx] = txt[idx]; tt.textContent = out.join(''); tt.appendChild(caret); idx++; setTimeout(step, 22); }
      })();
    })();
  }), { threshold: .6 });
  els.forEach(el => io.observe(el));
}

/* split-letter flowing gradient on the accent line of the H1 (the full sentence stays in aria-label) */
export function heroLetters() {
  const el = $('#heroAccent'); if (!el) return;
  const txt = el.textContent.trim();
  el.classList.add('split');
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = isAR()
    ? txt.split(/\s+/).map(w => `<span class="ltr">${esc(w)}</span>`).join(' ')
    : txt.split(' ').map(w => `<span class="nowrap">${[...w].map(ch => `<span class="ltr">${esc(ch)}</span>`).join('')}</span>`).join(' ');
}

/* gooey morph word (portfolio morph, driven by the loop registry instead of a 40ms setInterval) */
export function morph() {
  const box = $('#morphbox'); if (!box) return;
  let words; try { words = JSON.parse(box.dataset.words || '[]'); } catch (e) { words = []; }
  if (words.length < 2 || REDUCED) return;
  // screen readers get the full list once; the animated words are decorative
  const sr = document.createElement('span'); sr.className = 'sr-only'; sr.textContent = words.join(', '); box.before(sr);
  box.setAttribute('aria-hidden', 'true');
  box.innerHTML = words.map(w => `<span class="mword">${esc(w)}</span>`).join('');
  const spans = [...box.children]; let i = 0, frac = 0;
  spans[0].style.opacity = 1;
  // size the box to the longest word so the line doesn't jump
  box.style.minWidth = Math.max(...spans.map(s => s.getBoundingClientRect().width)) + 'px';
  addLoop('morph', (_, dt) => {
    frac += dt / 1000; if (frac >= 2.6) { frac = 0; i = (i + 1) % spans.length; }
    const cur = spans[i], nxt = spans[(i + 1) % spans.length], f = Math.min(1, Math.max(0, frac - 1.6));
    for (const s of spans) if (s !== cur && s !== nxt) s.style.opacity = 0;
    cur.style.opacity = Math.max(0, 1 - f * 1.6); cur.style.filter = `blur(${Math.min(20, 8 / Math.max(.0001, 1 - f) - 8)}px)`;
    nxt.style.opacity = Math.max(0, f * 1.4 - .1); nxt.style.filter = `blur(${Math.min(20, 8 / Math.max(.0001, f) - 8)}px)`;
  }, { el: box });
}

/* character roll (portfolio tabs) — used by the product filter heading. Letters are grouped per word
   (nowrap) so lines only ever break between words. */
export function chars(txt) {
  if (isAR()) return txt.split(' ').map(w => `<span class="ch">${esc(w)}</span>`).join(' ');
  return txt.split(' ').map(w => `<span class="nowrap">${[...w].map(c => `<span class="ch">${esc(c)}</span>`).join('')}</span>`).join(' ');
}
export function roll(el, txt) {
  if (!hasGSAP() || REDUCED) { el.textContent = txt; return Promise.resolve(); }
  return new Promise(res => {
    const old = el.querySelectorAll('.ch').length ? [...el.querySelectorAll('.ch')] : (el.innerHTML = chars(el.textContent), [...el.querySelectorAll('.ch')]);
    const tl = gsap.timeline();
    tl.to(old, { yPercent: -110, stagger: .012, duration: .4, ease: 'expo.in' });
    tl.add(() => { el.innerHTML = chars(txt); gsap.set(el.querySelectorAll('.ch'), { yPercent: 110 }); });
    tl.add(() => gsap.to(el.querySelectorAll('.ch'), { yPercent: 0, stagger: .012, duration: .55, ease: 'expo.out',
      onComplete: () => { el.textContent = txt; res(); } })); // settle back to plain text (clean wrapping)
  });
}

/* about paragraph: words light up with scroll (portfolio about) */
export function aboutLit() {
  const p = $('#aboutText'); if (!p) return;
  const acc = (p.dataset.accent || '').split('|').filter(Boolean).map(s => s.toLowerCase());
  const words = p.textContent.trim().split(/\s+/);
  p.innerHTML = words.map(w => { const bare = w.replace(/[^\p{L}\p{N}-]/gu, '').toLowerCase(); const a = acc.some(x => bare.includes(x)); return `<span class="w${a ? ' accent' : ''}">${esc(w)}</span>`; }).join(' ');
  const ws = [...p.querySelectorAll('.w')];
  if (REDUCED || matchMedia('(max-width: 700px)').matches) { ws.forEach(w => w.classList.add('lit')); return; }
  let tick = false;
  const up = () => { tick = false; const r = p.getBoundingClientRect(); const pr = (innerHeight * .85 - r.top) / (r.height + innerHeight * .25); const lit = Math.round(Math.max(0, Math.min(1, pr)) * ws.length); ws.forEach((w, i) => w.classList.toggle('lit', i < lit)); };
  addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(up); } }, { passive: true }); up();
}

/* counters (portfolio nums): the real number stays in the DOM for assistive tech; an aria-hidden copy counts up */
export function counters() {
  const els = $$('[data-count]'); if (!els.length || REDUCED) return;
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return; io.unobserve(e.target);
    const el = e.target, n = parseInt(el.dataset.count, 10), vis = el.querySelector('[aria-hidden]'), t0 = performance.now(), dur = 1200;
    (function tick(now) { const pr = Math.min(1, (now - t0) / dur); vis.textContent = Math.round(n * (1 - Math.pow(1 - pr, 3))); if (pr < 1) requestAnimationFrame(tick); })(t0);
  }), { threshold: .6 });
  els.forEach(el => { const n = el.dataset.count; el.innerHTML = `<span class="sr-only">${esc(n)}</span><span aria-hidden="true">0</span>`; io.observe(el); });
}

/* marquee rows built from the data-words list (doubled for a seamless loop) */
export function marquee() {
  $$('.marquee[data-words]').forEach(ul => {
    let words; try { words = JSON.parse(ul.dataset.words); } catch (e) { return; }
    ul.innerHTML = words.concat(words).map(w => `<li>${esc(w)}</li>`).join('');
  });
}
