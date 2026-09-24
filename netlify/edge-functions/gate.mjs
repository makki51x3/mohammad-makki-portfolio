/**
 * gate.mjs — country / region / city gate, run at the edge before the static
 * HTML is served. Rules are managed from /admin and stored in Netlify Blobs
 * under `config/access`.
 *
 * Two hard rules, both deliberate:
 *
 *  1. It FAILS OPEN. Any blob error, parse error or unexpected throw serves the
 *     site normally. A storage hiccup must never wall off the whole portfolio.
 *  2. /admin is excluded in netlify.toml, and `?letmein=<code>` sets a 30-day
 *     cookie. Between them, Makki can never lock himself out — including from
 *     inside a blocked country.
 *
 * Enforcement has to live here rather than in _publish/analytics.js: a
 * client-side check is one devtools toggle away from useless, and the edge is
 * the only place that sees geo before the origin responds.
 */
import { getStore } from '@netlify/blobs';

const CONFIG_KEY = 'config/access';
const CACHE_TTL = 60_000;         // don't hit Blobs on every single request
const COOKIE = 'mk-pass';

const DEFAULTS = { enabled: false, countries: [], regions: [], cities: [], bypass: '' };

let cache = { at: 0, cfg: null };
const seen = new Set();           // de-dupes blocked-hit records per ip+day

async function loadConfig() {
  const now = Date.now();
  if (cache.cfg && now - cache.at < CACHE_TTL) return cache.cfg;
  let cfg = DEFAULTS;
  try {
    const stored = await getStore('analytics').get(CONFIG_KEY, { type: 'json' });
    if (stored) cfg = { ...DEFAULTS, ...stored };
  } catch (err) {
    console.error('gate: config read failed, failing open:', err?.message || err);
  }
  cache = { at: now, cfg };
  return cfg;
}

function blocked(cfg, geo) {
  if (!cfg.enabled) return false;
  const cc = String(geo?.country?.code || '').toUpperCase();
  const sub = String(geo?.subdivision?.code || '').toUpperCase();
  const city = String(geo?.city || '').toLowerCase();
  if (cc && cfg.countries.includes(cc)) return true;
  if (sub && (cfg.regions.includes(sub) || cfg.regions.includes(`${cc}-${sub}`))) return true;
  if (city && cfg.cities.includes(city)) return true;
  return false;
}

function cookieValue(header, name) {
  if (!header) return '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return '';
}

/** Record the turn-away so /admin can tell a working gate from a broken one. */
async function record(geo, ip, ua) {
  try {
    const iso = new Date().toISOString();
    const date = iso.slice(0, 10);
    const key = `${date}|${ip}`;
    if (seen.has(key)) return;            // one row per visitor per day
    if (seen.size > 5000) seen.clear();   // bounded; it's only a de-dupe hint
    seen.add(key);
    const id = `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
    const rec = {
      id,
      ts: iso.slice(0, 19).replace('T', ' '),
      date,
      type: 'blocked',
      event: null,
      label: null,
      ip: ip || null,
      country: geo?.country?.name || null,
      country_code: geo?.country?.code || null,
      region: geo?.subdivision?.name || null,
      region_code: geo?.subdivision?.code || null,
      city: geo?.city || null,
      page: null,
      referrer: null,
      user_agent: ua ? String(ua).slice(0, 512) : null,
    };
    const stamp = rec.ts.replace(/[^0-9]/g, '');
    await getStore('analytics').set(`visits/${date}/${stamp}-${id}`, JSON.stringify(rec),
      { metadata: { type: 'blocked' } });
  } catch (err) {
    console.error('gate: could not record blocked hit:', err?.message || err);
  }
}

function denialPage(ar) {
  const copy = ar
    ? {
        lang: 'ar', dir: 'rtl',
        kick: '٤٠٣ · الوصول مغلق',
        title: 'ليس من هنا',
        line: 'آسف.. بس ما بدي ياك تشوف شو في هون 😜',
        sub: 'هذه الصفحة مغلقة من مكانك.',
        back: 'إذا في خطأ، راسلني',
      }
    : {
        lang: 'en', dir: 'ltr',
        kick: '403 · access closed',
        title: 'Not from here',
        line: "sorry.. but I don't want you to see what's in here 😜",
        sub: 'This page is closed from where you are.',
        back: 'If that seems wrong, message me',
      };

  return `<!doctype html>
<html lang="${copy.lang}" dir="${copy.dir}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${copy.title} · Mohammad Makki</title>
<link rel="icon" href="/assets/favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@600;800&family=Sora:wght@400;600&family=Space+Mono&family=Noto+Kufi+Arabic:wght@400;700&display=swap" rel="stylesheet">
<style>
  :root{
    --bg:#05060a; --ink:#edf1fa; --muted:#9aa6bf;
    --accent:#7aa2ff; --cyan:#5ad1c5; --gold:#ffc46b;
    --disp:'Unbounded',system-ui,sans-serif;
    --body:'Sora',system-ui,sans-serif;
    --mono:'Space Mono',ui-monospace,monospace;
  }
  html[dir=rtl] body{font-family:'Noto Kufi Arabic','Sora',system-ui,sans-serif}
  *{box-sizing:border-box}
  html,body{height:100%}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--body);
       display:grid;place-items:center;padding:26px;overflow:hidden}
  /* Starfield: three tiled radial-gradient layers, drifting. No JS, no GSAP. */
  .stars,.stars::before,.stars::after{position:fixed;inset:-50%;content:'';pointer-events:none}
  .stars{background-image:radial-gradient(1.5px 1.5px at 20% 30%,#fff,transparent),radial-gradient(1.5px 1.5px at 70% 60%,#cfe0ff,transparent),radial-gradient(1px 1px at 45% 80%,#fff,transparent);
         background-size:260px 260px;opacity:.5;animation:drift 140s linear infinite}
  .stars::before{background-image:radial-gradient(1px 1px at 10% 15%,#9fd0ff,transparent),radial-gradient(1px 1px at 85% 40%,#fff,transparent);
         background-size:420px 420px;opacity:.4;animation:drift 220s linear infinite reverse}
  .stars::after{background:radial-gradient(60% 50% at 50% 42%,rgba(122,162,255,.20),transparent 70%)}
  @keyframes drift{to{transform:translate3d(-260px,-260px,0)}}
  .card{position:relative;max-width:620px;width:100%;padding:clamp(28px,5vw,52px);
        border-radius:26px;border:1px solid rgba(122,162,255,.28);
        background:linear-gradient(160deg,rgba(18,24,44,.86),rgba(8,11,22,.92));
        box-shadow:0 30px 90px rgba(0,0,0,.6),inset 0 0 60px rgba(122,162,255,.07);
        backdrop-filter:blur(14px);text-align:center}
  .kick{font-family:var(--mono);font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--cyan);margin:0 0 20px}
  h1{font-family:var(--disp);font-weight:800;line-height:1.32;margin:0;
     font-size:clamp(21px,4.1vw,33px);
     background:linear-gradient(100deg,var(--ink) 12%,var(--accent) 58%,var(--cyan));
     -webkit-background-clip:text;background-clip:text;color:transparent}
  p.sub{color:var(--muted);margin:20px 0 0;font-size:15px;line-height:1.65}
  .rule{height:1px;margin:28px 0 22px;background:linear-gradient(90deg,transparent,rgba(122,162,255,.42),transparent)}
  a.cta{display:inline-flex;align-items:center;gap:9px;text-decoration:none;color:var(--ink);
        border:1px solid rgba(122,162,255,.34);border-radius:999px;padding:11px 22px;font-size:14px;
        transition:border-color .25s,background .25s,transform .25s}
  a.cta:hover{border-color:var(--gold);background:rgba(122,162,255,.09);transform:translateY(-2px)}
  .sig{margin-top:26px;font-family:var(--mono);font-size:11px;letter-spacing:.14em;color:#6d7a95;text-transform:uppercase}
  @media (prefers-reduced-motion:reduce){.stars,.stars::before{animation:none}}
</style></head>
<body>
<div class="stars" aria-hidden="true"></div>
<main class="card">
  <p class="kick">${copy.kick}</p>
  <h1>${copy.line}</h1>
  <p class="sub">${copy.sub}</p>
  <div class="rule"></div>
  <a class="cta" href="https://wa.me/96176556037" target="_blank" rel="noopener">${copy.back}</a>
  <p class="sig">Mohammad Makki</p>
</main>
</body></html>`;
}

export default async (req, context) => {
  let cfg;
  try {
    cfg = await loadConfig();
  } catch (err) {
    console.error('gate: unexpected failure, failing open:', err?.message || err);
    return;                                  // serve the site
  }
  if (!cfg.enabled) return;

  const url = new URL(req.url);

  // Bypass link: ?letmein=<code> drops a 30-day cookie and reloads clean.
  if (cfg.bypass && url.searchParams.get('letmein') === cfg.bypass) {
    url.searchParams.delete('letmein');
    return new Response(null, {
      status: 302,
      headers: {
        Location: url.pathname + (url.search || '') + url.hash,
        'Set-Cookie': `${COOKIE}=${encodeURIComponent(cfg.bypass)}; Path=/; Max-Age=2592000; SameSite=Lax; Secure; HttpOnly`,
        'Cache-Control': 'no-store',
      },
    });
  }
  if (cfg.bypass && cookieValue(req.headers.get('cookie'), COOKIE) === cfg.bypass) return;

  if (!blocked(cfg, context.geo)) return;

  await record(context.geo, context.ip, req.headers.get('user-agent'));

  const ar = /^ar\b/i.test(req.headers.get('accept-language') || '');
  return new Response(denialPage(ar), {
    status: 403,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
};
