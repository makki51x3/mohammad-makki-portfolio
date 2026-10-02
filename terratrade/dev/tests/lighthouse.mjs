// Lighthouse audit (performance, SEO, accessibility, best practices) against the local Netlify imitation.
// Usage: node tests/lighthouse.mjs [--only /,/ar/] [--form mobile|desktop|both]
// Prints category scores, Core Web Vitals lab values and every failing audit; full JSON → dev/out/lighthouse/.
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import { mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { start } from './server.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const paths = arg('only', '/,/ar/').split(',');
const forms = { both: ['mobile', 'desktop'], mobile: ['mobile'], desktop: ['desktop'] }[arg('form', 'both')];
const chromePath = process.env.CHROME_PATH || (() => {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  const dir = readdirSync(root).find(d => /^chromium-\d+$/.test(d));
  return `${root}/${dir}/chrome-linux/chrome`;
})();

mkdirSync('out/lighthouse', { recursive: true });
const srv = await start(0); const base = `http://127.0.0.1:${srv.address().port}`;
const chrome = await chromeLauncher.launch({ chromePath, chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'] });
let worst = 100;
for (const form of forms) for (const p of paths) {
  const config = { extends: 'lighthouse:default', settings: form === 'desktop'
    ? { formFactor: 'desktop', screenEmulation: { mobile: false, width: 1440, height: 900, deviceScaleFactor: 1, disabled: false }, throttling: { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1 } }
    : { formFactor: 'mobile' } };
  const { lhr } = await lighthouse(base + p, { port: chrome.port, output: 'json', logLevel: 'error' }, config);
  writeFileSync(`out/lighthouse/${form}${p.replace(/\//g, '_') || '_'}.json`, JSON.stringify(lhr));
  const cats = Object.values(lhr.categories).map(c => `${c.id} ${Math.round(c.score * 100)}`).join(' · ');
  const m = id => lhr.audits[id]?.displayValue || '-';
  console.log(`\n${form} ${p}: ${cats}`);
  console.log(`  LCP ${m('largest-contentful-paint')} · FCP ${m('first-contentful-paint')} · TBT ${m('total-blocking-time')} · CLS ${m('cumulative-layout-shift')} · SI ${m('speed-index')}`);
  for (const c of Object.values(lhr.categories)) {
    worst = Math.min(worst, Math.round(c.score * 100));
    for (const ref of c.auditRefs) {
      const a = lhr.audits[ref.id];
      if (!a || a.score === null || a.score >= 0.9 || a.scoreDisplayMode === 'informative' || a.scoreDisplayMode === 'notApplicable' || a.scoreDisplayMode === 'manual') continue;
      console.log(`  ✗ [${c.id}] ${a.id}: ${a.title}${a.displayValue ? ' (' + a.displayValue + ')' : ''}`);
    }
  }
}
await chrome.kill(); srv.close();
console.log(`\nlowest category score: ${worst}`);
