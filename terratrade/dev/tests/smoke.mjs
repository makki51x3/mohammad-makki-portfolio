// TerraTrade smoke test — Playwright + axe-core against the Netlify-imitating dev server.
// Matrix: (en, ar) × (light, dark) × (1440×900 desktop, 390×844 touch phone) × (motion, reduced) = 16 runs,
// plus behaviour checks (form, spec dialog, keyboard, mobile menu, redirects), no-JS runs and budgets.
// Usage: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tests/smoke.mjs [--quick]
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { start } from './server.mjs';

const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const QUICK = process.argv.includes('--quick');
const srv = await start(0); const BASE = `http://127.0.0.1:${srv.address().port}`;
const browser = await chromium.launch();
const failures = []; let checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { failures.push(msg); console.log('  ✗ ' + msg); } };
const log = s => console.log(s);

async function newPage({ lang = 'en', theme = 'light', mobile = false, reduced = false, js = true } = {}) {
  const ctx = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: mobile ? 2 : 1,
    hasTouch: mobile, isMobile: mobile, reducedMotion: reduced ? 'reduce' : 'no-preference', javaScriptEnabled: js,
  });
  if (theme === 'dark') await ctx.addInitScript(() => { try { localStorage.setItem('tt-theme', 'dark'); } catch (e) {} });
  await ctx.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI)); });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('requestfailed', r => { if (!/wa\.me|mailto|tel:/.test(r.url())) errs.push('requestfailed: ' + r.url() + ' ' + r.failure()?.errorText); });
  page.on('response', r => { if (r.status() >= 400 && !r.url().includes('/nope')) errs.push(`HTTP ${r.status()} ${r.url()}`); });
  await page.goto(BASE + (lang === 'ar' ? '/ar/' : '/'), { waitUntil: 'networkidle' });
  return { ctx, page, errs };
}
async function scrollThrough(page) {
  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < H; y += 500) { await page.evaluate(v => window.scrollTo(0, v), y); await page.waitForTimeout(QUICK ? 25 : 60); }
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(800);
}

// ---------------- CodePen effects (one block per adapted pen) ----------------
async function fxChecks(page, c, name) {
  // QwdoddG — hero bubbles: the SMIL scene is frozen off-screen (we are at the footer) and under reduced motion,
  // runs at the top otherwise; the orbiting text fits one lap of its path; all four photos decode
  const hb = await page.evaluate(async () => { const svg = document.getElementById('hbScene'), t = svg.querySelector('.hb-orbit-t');
    const imgs = await Promise.all([...svg.querySelectorAll('image')].map(i => new Promise(r => { const im = new Image(); im.onload = () => r(im.naturalWidth > 0); im.onerror = () => r(false); im.src = i.href.baseVal; })));
    return { pausedOff: svg.animationsPaused(), fit: +(t.getComputedTextLength() / svg.querySelector('#hbMainPath').getTotalLength()).toFixed(3), imgs }; });
  ok(hb.pausedOff && hb.fit > .75 && hb.fit <= 1 && hb.imgs.length === 4 && hb.imgs.every(Boolean), `${name}: hero bubbles paused off-screen, orbit text fits, photos load ${JSON.stringify(hb)}`);
  await page.evaluate(() => document.querySelector('[data-fx="bubbles"]').scrollIntoView({ block: 'center' })); await page.waitForTimeout(600);
  const hbRun = await page.evaluate(() => !document.getElementById('hbScene').animationsPaused());
  ok(c.reduced ? !hbRun : hbRun, `${name}: hero bubbles animate only when motion is allowed (running=${hbRun})`);
  // GgraMzd — cursor lens: fine pointers only; follows, then rests (its loop unregisters); never under reduced motion
  if (!c.mobile) {
    await page.mouse.move(400, 400); await page.mouse.move(700, 450, { steps: 3 }); await page.waitForTimeout(800);
    const l = await page.evaluate(() => { const e = document.querySelector('.tt-lens'); if (!e) return null; const [x, y] = e.style.translate.split(' ').map(parseFloat);
      return { on: e.classList.contains('on'), x, y, shown: getComputedStyle(e).display !== 'none', loops: window.__tt.loops() }; });
    if (c.reduced) ok(l && (!l.on || !l.shown) && !l.loops.includes('cursor'), `${name}: no cursor lens under reduced motion ${JSON.stringify(l)}`);
    else ok(l && l.on && Math.abs(l.x - 700) < 3 && Math.abs(l.y - 450) < 3 && !l.loops.includes('cursor'), `${name}: cursor lens follows then rests ${JSON.stringify(l)}`);
  } else ok(await page.evaluate(() => !document.querySelector('.tt-lens')), `${name}: no cursor lens on touch`);
  // NLWdwz — about banners: five banners with counter discs; zig-zag on wide screens only, mirrored in Arabic
  const ib = await page.evaluate(() => [...document.querySelectorAll('[data-fx="banners"] .ib')].map(li => ({
    disc: getComputedStyle(li.querySelector('.ib-card'), '::before').content, tx: parseFloat(getComputedStyle(li).translate) || 0 })));
  ok(ib.length === 5 && ib.every(b => /counter\(ib/.test(b.disc)), `${name}: banners + counter discs ${JSON.stringify(ib)}`);
  if (!c.mobile) ok(ib[0].tx * (c.lang === 'ar' ? -1 : 1) < 0 && ib[1].tx * (c.lang === 'ar' ? -1 : 1) > 0, `${name}: banner zig-zag direction ${ib.map(b => b.tx)}`);
  else ok(ib.every(b => b.tx === 0), `${name}: banners stack without zig-zag on phones ${ib.map(b => b.tx)}`);
  // raMZQNe — chunky squircle buttons: SVG layer behind the live label, the face sinks while pressed;
  // the floating WhatsApp squircle hides over the hero / contact / footer and shows in between
  const ch = await page.evaluate(() => { const q = document.querySelector('.hero [data-chunky]');
    q.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); const down = parseFloat(q.style.getPropertyValue('--sq-dy'));
    q.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); const up = parseFloat(q.style.getPropertyValue('--sq-dy'));
    return { n: document.querySelectorAll('.is-chunky > svg.sq .sq-face[d]').length, down, up, footer: document.querySelector('.wa-float').classList.contains('show') }; });
  ok(ch.n === 3 && ch.down > 0 && ch.up === 0 && !ch.footer, `${name}: chunky buttons render + press, WhatsApp squircle hidden at the footer ${JSON.stringify(ch)}`);
  await page.evaluate(() => document.getElementById('about').scrollIntoView()); await page.waitForTimeout(700);
  ok(await page.evaluate(() => document.querySelector('.wa-float').classList.contains('show')), `${name}: floating WhatsApp squircle shows mid-page`);
  // jEyVvqK — contact glass card: distortion filter wired, drags with the pointer and stays on its photo (desktop only)
  if (!c.mobile) {
    const card = page.locator('[data-fx="glass"]'); await card.scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
    const b0 = await card.boundingBox(), toward = c.lang === 'ar' ? 400 : -400; // drag it far past the photo's top/start corner
    await page.mouse.move(b0.x + 30, b0.y + 30); await page.mouse.down(); await page.mouse.move(b0.x + 30 + toward, b0.y - 900, { steps: 6 }); await page.mouse.up();
    const g = await page.evaluate(() => { const e = document.querySelector('[data-fx="glass"]'), f = e.parentElement;
      return { glass: e.classList.contains('is-glass'), filter: !!document.getElementById('tt-glass-distort'), x: e.offsetLeft, y: e.offsetTop, max: f.clientWidth - e.offsetWidth }; });
    ok(g.glass && g.filter && g.y === 0 && g.x === (c.lang === 'ar' ? g.max : 0), `${name}: glass card drags and stays inside the photo ${JSON.stringify(g)}`);
  } else ok(await page.evaluate(() => !document.querySelector('.gcard-defs')), `${name}: glass card script not loaded on phones`);
  // RwKPapa — product flip cards: hover/focus turns the card on a fine pointer; touch shows front + back stacked
  if (!c.mobile) {
    await page.hover('.pcard[data-id="cashew"]'); await page.waitForTimeout(c.reduced ? 150 : 1500);
    await page.waitForFunction(() => { const r = document.querySelector('.pcard[data-id="cashew"] .pquote').getBoundingClientRect();
      return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('.pquote'); }, null, { timeout: 2000 }).catch(() => {});
    const f = await page.evaluate(() => { const q = document.querySelector('.pcard[data-id="cashew"] .pquote'), r = q.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { turned: getComputedStyle(q.closest('.pcover')).transform !== 'none', hit: !!hit?.closest('.pquote') }; });
    ok(f.turned && f.hit, `${name}: hovered product card turns to its quote button ${JSON.stringify(f)}`);
    await page.mouse.move(2, 2);
  } else {
    const f = await page.evaluate(() => { const b = document.querySelector('.pcard[data-id="cashew"] .pback'); return { pos: getComputedStyle(b).position, tf: getComputedStyle(b.closest('.pcover')).transform, h: b.offsetHeight }; });
    ok(f.pos === 'static' && f.tf === 'none' && f.h > 80, `${name}: product card back is stacked on touch ${JSON.stringify(f)}`);
  }
}

// ---------------- matrix ----------------
const combos = [];
for (const lang of ['en', 'ar']) for (const theme of ['light', 'dark']) for (const mobile of [false, true]) for (const reduced of [false, true]) combos.push({ lang, theme, mobile, reduced });
for (const c of (QUICK ? combos.filter(c => !c.reduced && c.theme === 'light') : combos)) {
  const name = `${c.lang}/${c.theme}/${c.mobile ? 'phone' : 'desktop'}/${c.reduced ? 'reduced' : 'motion'}`;
  log('• ' + name);
  const { ctx, page, errs } = await newPage(c);
  const attrs = await page.evaluate(() => [document.documentElement.lang, document.documentElement.dir, document.documentElement.classList.contains('dark')]);
  ok(attrs[0] === c.lang && attrs[1] === (c.lang === 'ar' ? 'rtl' : 'ltr'), `${name}: lang/dir = ${attrs}`);
  ok(attrs[2] === (c.theme === 'dark'), `${name}: theme class`);
  await scrollThrough(page);
  const over = await page.evaluate(() => {
    const W = document.documentElement.clientWidth; if (document.documentElement.scrollWidth <= W + 1) return [];
    return [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > W + 1 || r.left < -1) && getComputedStyle(e).position !== 'fixed'; }).slice(0, 8).map(e => e.tagName + '.' + e.className);
  });
  ok(!over.length, `${name}: horizontal overflow from ${over.join(', ')}`);
  const badImgs = await page.evaluate(() => [...document.images].filter(i => (i.getAttribute('src') || i.srcset) && i.getClientRects().length && (!i.complete || !i.naturalWidth)).map(i => i.currentSrc || i.src));
  ok(!badImgs.length, `${name}: images not loaded: ${badImgs.join(', ')}`);
  if (c.reduced) { await page.waitForTimeout(1500); const loops = await page.evaluate(() => window.__tt?.loops() || []); ok(!loops.length, `${name}: loops running under reduced motion: ${loops}`); }
  else { const loops = await page.evaluate(() => window.__tt?.loops() || []); ok(!loops.some(l => ['globe', 'cube', 'morph', 'ambient'].includes(l)), `${name}: off-screen loops still running at the footer: ${loops}`); }
  const csp = await page.evaluate(() => window.__csp); ok(!csp.length, `${name}: CSP violations: ${csp.join(' | ')}`);
  await fxChecks(page, c, name);
  // accessibility (axe) at top and bottom of the page
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(400);
  await page.evaluate(AXE); // via DevTools, so the site's CSP (which blocks inline scripts) doesn't stop axe
  const ax = await page.evaluate(async () => { const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] }, resultTypes: ['violations'] });
    return r.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, t: v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' ; ') })); });
  const serious = ax.filter(v => ['serious', 'critical'].includes(v.impact));
  ok(!serious.length, `${name}: axe ${serious.map(v => `${v.id}(${v.impact}×${v.n}: ${v.t})`).join(' | ')}`);
  ax.filter(v => !['serious', 'critical'].includes(v.impact)).forEach(v => log(`    axe note: ${v.id} ${v.impact} ×${v.n}`));
  ok(!errs.length, `${name}: errors: ${errs.join(' | ')}`);
  await ctx.close();
}

// ---------------- static / structural checks ----------------
log('• structure');
{
  const { ctx, page, errs } = await newPage();
  const s = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const anchors = [...document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href')).filter(h => h.length > 1 && !document.getElementById(h.slice(1)));
    const f = q('form[name="rfq"]');
    const hp = f?.getAttribute('netlify-honeypot');
    const ext = [...document.querySelectorAll('a[target="_blank"]')].filter(a => !/noopener/.test(a.rel)).map(a => a.href);
    const tel = [...document.querySelectorAll('a[href^="tel:"]')].every(a => /^tel:\+\d{8,15}$/.test(a.getAttribute('href')));
    const mail = [...document.querySelectorAll('a[href^="mailto:"]')].every(a => /^mailto:[^@\s]+@[^@\s]+\.[a-z]+$/.test(a.getAttribute('href')));
    const wa = [...document.querySelectorAll('a[href*="wa.me"]')].every(a => /^https:\/\/wa\.me\/\d{8,15}(\?text=.*)?$/.test(a.getAttribute('href')));
    const unlabeled = [...f.querySelectorAll('input:not([type=hidden]), select, textarea')].filter(el => !el.closest('.hp') && !(el.labels?.length || el.getAttribute('aria-label')));
    const hreflang = [...document.querySelectorAll('link[rel=alternate][hreflang]')].map(l => l.hreflang + '=' + l.href);
    return { anchors, netlify: f?.hasAttribute('data-netlify'), formName: f?.querySelector('input[name="form-name"]')?.value, hp, hpInput: !!f?.querySelector(`[name="${hp}"]`), action: f?.getAttribute('action'), ext, tel, mail, wa, unlabeled: unlabeled.map(e => e.name), hreflang,
      canonical: q('link[rel=canonical]')?.href, ogImg: q('meta[property="og:image"]')?.content, ogUrl: q('meta[property="og:url"]')?.content, h1: document.querySelectorAll('h1').length, skip: q('a.skip')?.getAttribute('href') };
  });
  ok(!s.anchors.length, `broken in-page anchors: ${s.anchors}`);
  ok(s.netlify && s.formName === 'rfq' && s.hpInput && s.action === '/thanks/', `netlify form markup: ${JSON.stringify([s.netlify, s.formName, s.hp, s.hpInput, s.action])}`);
  ok(!s.ext.length, `target=_blank without noopener: ${s.ext}`);
  ok(s.tel && s.mail && s.wa, `tel/mailto/wa links malformed ${[s.tel, s.mail, s.wa]}`);
  ok(!s.unlabeled.length, `unlabeled form controls: ${s.unlabeled}`);
  ok(s.hreflang.length === 3 && s.canonical === 'https://terratrade.global/' && s.ogUrl === 'https://terratrade.global/' && /og-en\.jpg$/.test(s.ogImg), `EN head tags ${JSON.stringify(s)}`);
  ok(s.h1 === 1 && s.skip === '#main', 'one h1 + skip link');
  // keyboard: first Tab lands on the skip link
  await page.keyboard.press('Tab'); ok(await page.evaluate(() => document.activeElement?.classList.contains('skip')), 'first Tab focuses the skip link');
  // spec dialog: open, Escape, focus return; quote prefill
  // (the Spec-sheet button is on the flip card's back: hover the card first, as a mouse user would)
  const btn = page.locator('[data-spec="sesame"]'); await btn.scrollIntoViewIfNeeded(); await page.hover('.pcard[data-id="sesame"]'); await page.waitForTimeout(1500); await btn.click();
  ok(await page.evaluate(() => document.getElementById('spec').open), 'spec dialog opens');
  ok(await page.evaluate(() => document.querySelectorAll('#specTable tr').length > 2), 'spec table rendered');
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  ok(await page.evaluate(() => !document.getElementById('spec').open && document.activeElement?.dataset.spec === 'sesame'), 'Escape closes the dialog and returns focus');
  await btn.click(); await page.click('#specQuote'); await page.waitForTimeout(1200);
  ok(await page.evaluate(() => document.querySelector('#rfq [name=product]').value === 'sesame' && document.querySelector('#rfq [name=source]').value === 'spec:sesame'), 'spec "request quote" prefills the form');
  // form: invalid submit → status + aria-invalid
  await page.click('#rfq .submit'); await page.waitForTimeout(200);
  ok(await page.evaluate(() => document.querySelectorAll('#rfq [aria-invalid=true]').length >= 3 && document.getElementById('formStatus').textContent.length > 5), 'empty submit flags required fields');
  ok(await page.evaluate(() => [...document.querySelectorAll('#rfq [aria-invalid=true]')].every(f => { const e = document.getElementById(f.getAttribute('aria-describedby')); return e && !e.hidden && e.textContent.length > 3; })), 'each invalid field has a visible, associated error message');
  // form: server error keeps input and shows the error
  await page.fill('#f-name', 'Test Buyer'); await page.fill('#f-email', 'buyer@example.com'); await page.selectOption('#f-country', 'Saudi Arabia'); await page.check('#rfq [name=consent]');
  srv.failNext = true; await page.click('#rfq .submit'); await page.waitForTimeout(500); srv.failNext = false;
  ok(await page.evaluate(() => document.getElementById('formStatus').classList.contains('err') && document.getElementById('f-name').value === 'Test Buyer' && !document.getElementById('rfq').hidden), 'server error shows message and keeps input');
  // form: success
  await page.click('#rfq .submit'); await page.waitForTimeout(600);
  ok(await page.evaluate(() => !document.getElementById('rfqDone').hidden && document.activeElement?.closest('#rfqDone') && getComputedStyle(document.getElementById('rfq')).display === 'none'), 'successful submit hides the form and focuses the thank-you state');
  await page.click('#rfqAgain'); await page.waitForTimeout(200);
  ok(await page.evaluate(() => !document.activeElement?.closest('.hp') && document.activeElement?.id === 'f-name'), '"Send another request" focuses the name field (never the honeypot)');
  ok(srv.lastForm?.['form-name'] === 'rfq' && srv.lastForm?.email === 'buyer@example.com' && srv.lastForm?.product === 'sesame' && srv.lastForm?.lang === 'en', 'posted fields reach the server: ' + JSON.stringify(srv.lastForm));
  await page.evaluate(() => document.querySelector('.pcard[data-id="ginger"] .pquote').click()); await page.waitForTimeout(300);
  ok(await page.evaluate(() => document.querySelector('#rfq [name=product]').value === 'ginger' && document.querySelector('#rfq [name=source]').value === 'card:ginger'), 'card "Request a quote" prefills product + source');
  ok(!errs.filter(e => !/500/.test(e)).length, 'structure run errors: ' + errs.join(' | '));
  await ctx.close();
}
{ // Arabic page head + form language
  const { ctx, page } = await newPage({ lang: 'ar' });
  const s = await page.evaluate(() => ({ canonical: document.querySelector('link[rel=canonical]').href, og: document.querySelector('meta[property="og:image"]').content, locale: document.querySelector('meta[property="og:locale"]').content, lang: document.querySelector('#rfq [name=lang]').value, action: document.querySelector('#rfq').getAttribute('action'), title: document.title, words: JSON.parse(document.getElementById('morphbox').dataset.words)[0] }));
  ok(s.canonical === 'https://terratrade.global/ar/' && /og-ar\.jpg$/.test(s.og) && s.locale === 'ar_AR' && s.lang === 'ar' && s.action === '/ar/thanks/' && /تيرا/.test(s.title) && /[؀-ۿ]/.test(s.words), 'Arabic head/form: ' + JSON.stringify(s));
  // no English prose left in the Arabic page (allow brand names, codes, digits, emails)
  const leftovers = await page.evaluate(() => { const allow = /^(TerraTrade|Terra|Trade|NG|SA|AE|QA|LB|SY|JP|KR|CN|FOB|CFR|CIF|KOR|MT|N|English|info@terratrade\.global|terratrade\.global|[\d\s+·.,%–—/-]+)$/;
    const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) { const t = n.textContent.trim(); if (!t || n.parentElement.closest('script,style,svg,.foot-word,[aria-hidden=true] .ltr,.hp')) continue; if (/[A-Za-z]{3,}/.test(t) && !/[\u0600-\u06FF]/.test(t) && !allow.test(t)) out.push(t.slice(0, 40)); } return out; });
  ok(!leftovers.length, 'English text left on the Arabic page: ' + leftovers.slice(0, 10).join(' | '));
  await ctx.close();
}
{ // mobile menu + redirect + no-JS + budgets
  const { ctx, page } = await newPage({ mobile: true });
  await page.click('#burger'); await page.waitForTimeout(400);
  ok(await page.evaluate(() => !document.getElementById('mnav').hidden && document.getElementById('burger').getAttribute('aria-expanded') === 'true'), 'burger opens the mobile menu');
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  ok(await page.evaluate(() => document.getElementById('mnav').hidden && document.activeElement?.id === 'burger'), 'Escape closes the mobile menu and refocuses the burger');
  // spec sheet scrolls by touch on a short phone (Lenis must not swallow the gesture)
  await page.setViewportSize({ width: 390, height: 700 });
  await page.locator('[data-spec="cashew"]').scrollIntoViewIfNeeded(); await page.click('[data-spec="cashew"]'); await page.waitForTimeout(500);
  const cdp = await ctx.newCDPSession(page);
  const swipe = async () => { const pts = y => [{ x: 200, y }]; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(560) });
    for (let y = 540; y >= 240; y -= 30) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(y) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
  await swipe(); await page.waitForTimeout(500);
  ok(await page.evaluate(() => document.querySelector('.spec-wrap').scrollTop > 0), 'spec sheet scrolls with a touch swipe on a short phone');
  await page.keyboard.press('Escape');
  await page.goto(BASE + '/?lang=ar', { waitUntil: 'domcontentloaded' });
  ok(page.url().endsWith('/ar/'), '?lang=ar redirects to /ar/ (got ' + page.url() + ')');
  await ctx.close();
  for (const lang of ['en', 'ar']) {
    const r = await newPage({ lang, js: false });
    const vis = await r.page.evaluate(() => ({ reveal: [...document.querySelectorAll('.reveal')].every(e => getComputedStyle(e).opacity === '1'), form: !!document.querySelector('form[name=rfq]'), cls: document.documentElement.className }));
    ok(vis.reveal && vis.form && vis.cls.includes('no-js'), `no-JS ${lang}: content visible ${JSON.stringify(vis)}`);
    const before = r.page.url(); await r.page.click('#rfq .submit'); await r.page.waitForTimeout(400);
    ok(r.page.url() === before, `no-JS ${lang}: native validation stops an empty form from posting`);
    await r.ctx.close();
  }
  const b = await newPage();
  const bytes = await b.page.evaluate(() => { const es = performance.getEntriesByType('resource'); const nav = performance.getEntriesByType('navigation')[0];
    const js = es.filter(e => /\/assets\/js\//.test(e.name) && !/vendor|globe-data/.test(e.name)).reduce((a, e) => a + (e.decodedBodySize || 0), 0);
    return { total: es.reduce((a, e) => a + (e.transferSize || e.encodedBodySize || 0), 0) + (nav.transferSize || 0), js }; });
  log(`    initial transfer ${(bytes.total / 1024).toFixed(0)} KB, site JS ${(bytes.js / 1024).toFixed(0)} KB`);
  ok(bytes.total < 1400 * 1024, `initial load budget exceeded: ${(bytes.total / 1024).toFixed(0)} KB`);
  ok(bytes.js < 120 * 1024, `site JS budget exceeded: ${(bytes.js / 1024).toFixed(0)} KB`);
  await b.ctx.close();
}
for (const path of ['/thanks/', '/ar/thanks/', '/privacy/', '/ar/privacy/', '/nope', '/ar/nope']) {
  const ctx = await browser.newContext(); const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && !(path.endsWith('/nope') && /404/.test(m.text())) && errs.push(m.text()));
  const res = await page.goto(BASE + path, { waitUntil: 'networkidle' });
  ok(path.endsWith('/nope') ? res.status() === 404 : res.status() === 200, `${path}: status ${res.status()}`);
  if (path === '/ar/nope') ok(await page.evaluate(() => document.documentElement.lang === 'ar' && document.documentElement.dir === 'rtl'), '/ar/ 404 is the Arabic not-found page');
  ok(!errs.length, `${path}: errors ${errs.join(' | ')}`);
  await ctx.close();
}

await browser.close(); srv.close();
console.log(`\n${checks - failures.length}/${checks} checks passed`);
if (failures.length) { console.log('FAILURES:\n- ' + failures.join('\n- ')); process.exit(1); }
