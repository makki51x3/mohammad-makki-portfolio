/**
 * analytics.mjs — shared, dependency-free logic for the visitor logger.
 *
 * Everything here is pure and testable: it takes a "store" object (Netlify Blobs
 * in production, or a fake in tests) and plain inputs. No imports, no globals
 * beyond standard JS, so test/analytics.test.mjs can exercise it without Netlify.
 */

import { createHash, timingSafeEqual, randomBytes } from 'node:crypto';

// ----------------------------- helpers -----------------------------

/** Random nonce for the dashboard's Content-Security-Policy. */
export function cspNonce() {
  try { return randomBytes(16).toString('base64'); } catch { return ''; }
}

export function clip(s, max) {
  if (s == null) return null;
  s = String(s).trim();
  if (s === '') return null;
  return s.length > max ? s.slice(0, max) : s;
}

// A small non-crypto id so overflow keys and record ids are unique.
export function makeId(now, rand) {
  const t = now.getTime().toString(36);
  const r = Math.floor((rand ?? Math.random()) * 1e9).toString(36);
  return `${t}-${r}`;
}

/**
 * Build one visit record from request inputs. Pure — no network, no store.
 *
 * `geo` is Netlify's context.geo shape:
 *   { city, country:{code,name}, subdivision:{code,name}, postalCode, timezone,
 *     latitude, longitude }
 * We store all of it. IPs are stored in full and deliberately NOT masked —
 * the dashboard's unique-visitor and location numbers are only meaningful on
 * real addresses. The site footer discloses this.
 */
export function buildRecord({ ip, geo, userAgent, lang, body = {}, query = {}, now, type: forcedType, rand }) {
  const pick = (k) => (body && body[k] != null ? body[k] : query[k]);
  const iso = now.toISOString();                 // e.g. 2026-08-27T14:03:22.000Z
  const num = (n) => (typeof n === 'number' && isFinite(n) ? Math.round(n * 1e4) / 1e4 : null);

  // type is "pageview" (default) or "event"; events carry a name + label
  // (e.g. event="project_click", label="Naqua").
  const type = forcedType || (pick('t') === 'event' ? 'event' : 'pageview');

  return {
    id: makeId(now, rand),
    ts: iso.slice(0, 19).replace('T', ' '),      // "2026-08-27 14:03:22" (UTC)
    date: iso.slice(0, 10),                       // "2026-08-27" (bucket key)
    type,
    event: type === 'event' ? clip(pick('e'), 64) : null,
    label: type === 'event' ? clip(pick('l'), 255) : null,
    ip: clip(ip, 64),
    country: clip(geo?.country?.name, 64),
    country_code: clip(geo?.country?.code, 8),
    region: clip(geo?.subdivision?.name, 64),
    region_code: clip(geo?.subdivision?.code, 16),
    city: clip(geo?.city, 64),
    postal: clip(geo?.postalCode, 24),
    timezone: clip(geo?.timezone, 64),
    lat: num(geo?.latitude),
    lon: num(geo?.longitude),
    page: clip(pick('u'), 2048),
    referrer: clip(pick('r'), 2048),
    utm_source: clip(pick('utm_source'), 255),
    utm_medium: clip(pick('utm_medium'), 255),
    utm_campaign: clip(pick('utm_campaign'), 255),
    screen: clip(pick('s'), 32),
    user_agent: clip(userAgent, 512),
    lang: clip(lang, 64),
  };
}

// ----------------------------- storage -----------------------------
//
// Netlify Blobs (v8) has NO conditional/compare-and-swap writes: set() just
// overwrites. So we must never do read-modify-write on a shared key from a
// request handler — concurrent visits (e.g. a page view and a card click fired
// together on one page load) would clobber each other and lose data.
//
// Instead we write ONE blob per visit under a unique, time-sortable key. That
// is race-free by construction. The dashboard lists + reads them back.
//
//   key = visits/<YYYY-MM-DD>/<YYYYMMDDHHMMSS>-<id>
//
// The date segment lets readVisits filter by range while only fetching the
// blobs it needs.

/** Build the unique storage key for a visit record. */
export function visitKey(record) {
  const tsCompact = String(record.ts).replace(/[^0-9]/g, ''); // YYYYMMDDHHMMSS
  return `visits/${record.date}/${tsCompact}-${record.id}`;
}

/**
 * Persist one visit as its own blob. Race-free (unique key), so no retries.
 * `store` must implement: set(key, string) -> Promise<void>
 */
export async function appendVisit(store, record) {
  const key = visitKey(record);
  await store.set(key, JSON.stringify(record), { metadata: { type: record.type } });
  return { ok: true, key };
}

/**
 * Read visit records, newest first. Only fetches blobs whose date is within
 * [from, to] (when given), and caps the number of bodies fetched at `max`.
 *
 * `store` must implement:
 *   list({ prefix, paginate:true }) -> async-iterable of { blobs:[{key}] }
 *   get(key, { type:'json' }) -> the parsed record
 */
export async function readVisits(store, { from, to, max = 20000 } = {}) {
  const inRange = (d) => (!from || d >= from) && (!to || d <= to);

  const keys = [];
  for await (const page of store.list({ prefix: 'visits/', paginate: true })) {
    for (const b of page.blobs || []) {
      const date = b.key.split('/')[1]; // visits/<date>/<...>
      if (date && inRange(date)) keys.push(b.key);
    }
  }

  keys.sort();                 // lexicographic = chronological (date then ts)
  keys.reverse();              // newest first
  const capped = keys.slice(0, max);

  const out = [];
  const BATCH = 50;            // bound concurrent gets
  for (let i = 0; i < capped.length; i += BATCH) {
    const recs = await Promise.all(
      capped.slice(i, i + BATCH).map((k) => store.get(k, { type: 'json' }).catch(() => null))
    );
    for (const r of recs) if (r) out.push(r);
  }
  out.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0)); // newest first
  return out;
}


// ------------------------- access control (geo gate) -------------------------
//
// One small JSON blob: the edge function reads it on every request (cached in
// its own memory for ~60s) and /admin writes it. Unlike visits this is
// single-writer, so the "no compare-and-swap" limitation above doesn't bite.

export const ACCESS_KEY = 'config/access';

export const DEFAULT_ACCESS = {
  enabled: false,
  countries: [],   // ISO 3166-1 alpha-2, upper case
  regions: [],     // subdivision codes, bare ("JL") or qualified ("LB-JL")
  cities: [],      // lower-cased city names
  bypass: '',      // ?letmein=<this> sets a 30-day cookie
  updated: null,
};

/** Coerce whatever the admin form posted (strings OR arrays) into the stored shape. */
export function normalizeAccess(raw = {}) {
  const list = (v, fn) => {
    const src = Array.isArray(v) ? v.join(',') : String(v == null ? '' : v);
    return src.split(/[\n,;]+/).map((x) => fn(x.trim())).filter(Boolean).slice(0, 400);
  };
  const uniq = (a) => [...new Set(a)];
  return {
    enabled: raw.enabled === true || raw.enabled === 'on' || raw.enabled === 'true' || raw.enabled === '1',
    countries: uniq(list(raw.countries, (x) => x.toUpperCase())).filter((x) => /^[A-Z]{2}$/.test(x)),
    regions: uniq(list(raw.regions, (x) => x.toUpperCase())),
    cities: uniq(list(raw.cities, (x) => x.toLowerCase())),
    bypass: clip(raw.bypass, 64) || '',
    updated: raw.updated || null,
  };
}

export async function readAccess(store) {
  try {
    const cfg = await store.get(ACCESS_KEY, { type: 'json' });
    return cfg ? { ...DEFAULT_ACCESS, ...cfg } : { ...DEFAULT_ACCESS };
  } catch {
    return { ...DEFAULT_ACCESS };   // fail open
  }
}

export async function writeAccess(store, cfg) {
  await store.set(ACCESS_KEY, JSON.stringify(cfg));
  return cfg;
}

/**
 * Is this visitor blocked? Pure, so the edge function and the tests agree.
 * `geo` is the Netlify context.geo shape.
 */
export function isBlocked(cfg, geo) {
  if (!cfg || !cfg.enabled) return false;
  const cc = String(geo?.country?.code || '').toUpperCase();
  const sub = String(geo?.subdivision?.code || '').toUpperCase();
  const city = String(geo?.city || '').toLowerCase();
  if (cc && (cfg.countries || []).includes(cc)) return true;
  if (sub && ((cfg.regions || []).includes(sub) || (cfg.regions || []).includes(cc + '-' + sub))) return true;
  if (city && (cfg.cities || []).includes(city)) return true;
  return false;
}

// ---------------------------- aggregation ----------------------------

export function aggregate(visits, { today, from, to } = {}) {
  const todayStr = today ?? new Date().toISOString().slice(0, 10);

  // Inclusive date-range filter. `from`/`to` are "YYYY-MM-DD" or falsy.
  const inRange = (d) => (!from || d >= from) && (!to || d <= to);
  const scoped = visits.filter((v) => inRange(v.date));

  const pageviews = scoped.filter((v) => v.type !== 'event' && v.type !== 'blocked');
  const events = scoped.filter((v) => v.type === 'event');
  const blocked = scoped.filter((v) => v.type === 'blocked');

  const count = (arr, keyFn, extra) => {
    const m = new Map();
    for (const v of arr) {
      const k = keyFn(v);
      if (k == null) continue;
      const cur = m.get(k) || { key: k, c: 0, extra: extra ? extra(v) : null };
      cur.c += 1;
      m.set(k, cur);
    }
    return [...m.values()].sort((a, b) => b.c - a.c);
  };

  const perDayMap = new Map();
  for (const v of pageviews) perDayMap.set(v.date, (perDayMap.get(v.date) || 0) + 1);
  const perDay = [...perDayMap.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, 30)
    .map(([d, c]) => ({ day: d, c }));

  // Newest-first for the recent list (don't assume caller pre-sorted).
  const recent = [...scoped].sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0)).slice(0, 100);

  return {
    range: { from: from || null, to: to || null },
    total: pageviews.length,
    events: events.length,
    blocked: blocked.length,
    uniqueIps: new Set(pageviews.map((v) => v.ip).filter(Boolean)).size,
    today: pageviews.filter((v) => v.date === todayStr).length,
    perDay,
    topPages: count(pageviews, (v) => v.page).slice(0, 15),
    topRefs: count(pageviews, (v) => v.referrer || '(direct)').slice(0, 15),
    topCampaigns: count(
      pageviews,
      (v) => v.utm_campaign || '(none)',
      (v) => `${v.utm_source || '-'} / ${v.utm_medium || '-'}`
    ).slice(0, 15),
    // Country · Region · City, one row per distinct place, with the ISO-2 code
    // carried through so the dashboard can offer a one-click "block this".
    topGeo: count(
      pageviews,
      (v) => [v.country || '(unknown)', v.region, v.city].filter(Boolean).join(' › '),
      (v) => ({ country: v.country || '', cc: v.country_code || '', region: v.region || '', city: v.city || '' })
    ).slice(0, 25),
    topBlocked: count(
      blocked,
      (v) => [v.country || '(unknown)', v.city || ''].filter(Boolean).join(' › ')
    ).slice(0, 15),
    topProjects: count(
      events.filter((v) => v.event === 'project_click'),
      (v) => v.label || '(unknown)'
    ).slice(0, 20),
    recent,
  };
}

/** Validate a "YYYY-MM-DD" string; return it or '' if malformed. */
export function cleanDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

/** Build quick date-range presets relative to `now`, marking the active one. */
export function datePresets(now, range = {}) {
  const iso = (d) => d.toISOString().slice(0, 10);
  const today = iso(now);
  const minus = (n) => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - n);
    return iso(d);
  };
  const defs = [
    { label: 'Last 7d', from: minus(6), to: today },
    { label: 'Last 30d', from: minus(29), to: today },
    { label: 'Last 90d', from: minus(89), to: today },
    { label: 'All time', from: '', to: '' },
  ];
  const curFrom = range.from || '';
  const curTo = range.to || '';
  return defs.map((d) => ({ ...d, active: (d.from || '') === curFrom && (d.to || '') === curTo }));
}

// ------------------------------- auth --------------------------------

/** Constant-time-ish comparison to avoid trivial timing leaks. */
function safeEqual(a, b) {
  // Compare SHA-256 digests, not the raw strings: the digests are always the
  // same length, so neither the timing nor an early return leaks the secret's
  // length. Falls back to a manual constant-time loop if crypto is missing.
  a = String(a);
  b = String(b);
  try {
    const h = (v) => createHash('sha256').update(v, 'utf8').digest();
    return timingSafeEqual(h(a), h(b));
  } catch {
    if (a.length !== b.length) return false;
    let out = 0;
    for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return out === 0;
  }
}

/**
 * Is this request allowed to perform a state-changing POST?
 * Basic-auth credentials ride along on cross-site form submissions, so the
 * password alone does not stop CSRF. Require proof of same-origin instead.
 */
export function isSameOriginPost(req) {
  const site = req.headers.get('sec-fetch-site');
  if (site) return site === 'same-origin';        // modern browsers
  const origin = req.headers.get('origin') || req.headers.get('referer');
  if (!origin) return false;                       // no proof -> refuse
  try {
    return new URL(origin).host === new URL(req.url).host;
  } catch {
    return false;
  }
}

/** Best-effort per-IP throttle. Instance-local, so it slows attacks rather
 *  than promising to stop them; the real defence is a long random password. */
export function makeThrottle({ max = 8, windowMs = 300000 } = {}) {
  const hits = new Map();
  return {
    fail(key, now = Date.now()) {
      const e = hits.get(key);
      if (!e || now - e.first > windowMs) hits.set(key, { n: 1, first: now });
      else e.n++;
      if (hits.size > 5000) hits.clear();          // bound memory
    },
    ok(key) { hits.delete(key); },
    blocked(key, now = Date.now()) {
      const e = hits.get(key);
      if (!e) return false;
      if (now - e.first > windowMs) { hits.delete(key); return false; }
      return e.n >= max;
    },
  };
}

/** Validate an HTTP Basic Auth header against expected user/pass. */
export function checkBasicAuth(authHeader, user, pass) {
  if (!authHeader || !authHeader.startsWith('Basic ')) return false;
  let decoded = '';
  try {
    decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
  } catch {
    return false;
  }
  const idx = decoded.indexOf(':');
  if (idx === -1) return false;
  const u = decoded.slice(0, idx);
  const p = decoded.slice(idx + 1);
  return safeEqual(u, user) && safeEqual(p, pass);
}

// --------------------------- html rendering ---------------------------

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export function renderDashboard(a, opts = {}) {
  const acc = opts.access || DEFAULT_ACCESS;
  const maxDay = Math.max(1, ...a.perDay.map((d) => d.c));
  const rows = (items, cols) => items.map(cols).join('');
  const presets = opts.presets || [];
  const from = a.range?.from || '';
  const to = a.range?.to || '';

  const presetChips = presets
    .map((p) => {
      const href = '/admin' + (p.from || p.to ? `?from=${esc(p.from || '')}&to=${esc(p.to || '')}` : '');
      const cls = p.active ? 'chip active' : 'chip';
      return `<a class="${cls}" href="${href}">${esc(p.label)}</a>`;
    })
    .join('');

  const nonceAttr = opts.nonce ? ` nonce="${esc(opts.nonce)}"` : '';
  const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort((x, y) => x.localeCompare(y));
  const optList = (arr) => arr.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
  const eventOpts = optList(uniq((a.recent || []).filter((r) => r.type === 'event').map((r) => r.event || 'event')));
  const countryOpts = optList(uniq((a.recent || []).map((r) => r.country)));
  const pageOpts = optList(uniq((a.recent || []).map((r) => r.page)));

  const rangeNote = from || to
    ? `Showing ${esc(from || '…')} → ${esc(to || '…')}`
    : 'Showing all time';

  const projectsPanel = `
  <div class="panel"><h2>Top projects clicked</h2><table><tr><th>Project</th><th class="n">Clicks</th></tr>
    ${a.topProjects && a.topProjects.length
      ? rows(a.topProjects, (r) => `<tr><td>${esc(r.key)}</td><td class="n">${r.c}</td></tr>`)
      : `<tr><td class="muted" colspan="2">No project-card clicks in this range yet.</td></tr>`}
  </table></div>`;

  const accPanel = `
  <form class="panel full acc" method="post" action="/admin">
    <h2>Access control</h2>
    <p class="muted small">Blocked visitors get the denial page instead of the site.
      <code>/admin</code> is never blocked, and <code>?letmein=&lt;code&gt;</code> lets you straight back in for 30 days.
      Blocking a row in <b>Top locations</b> also switches the gate on.</p>
    <p class="${acc.enabled ? 'on' : 'off'} small">${acc.enabled
      ? `Gate is <b>ON</b> \u2014 ${acc.countries.length} ${acc.countries.length === 1 ? 'country' : 'countries'}, ${acc.regions.length} ${acc.regions.length === 1 ? 'region' : 'regions'}, ${acc.cities.length} ${acc.cities.length === 1 ? 'city' : 'cities'} blocked`
      : 'Gate is <b>OFF</b> \u2014 rules below are saved but not enforced'}${acc.updated ? ` \u00b7 last saved ${esc(acc.updated)} UTC` : ''}</p>
    <label class="row"><input type="checkbox" name="enabled" value="on"${acc.enabled ? ' checked' : ''}> Enforce the gate</label>
    <div class="accgrid">
      <label>Countries <span class="muted small">ISO-2, e.g. FR, RU</span>
        <textarea name="countries" rows="3" placeholder="FR, RU">${esc((acc.countries || []).join(', '))}</textarea></label>
      <label>Regions <span class="muted small">subdivision codes, e.g. CA or US-CA</span>
        <textarea name="regions" rows="3" placeholder="US-CA">${esc((acc.regions || []).join(', '))}</textarea></label>
      <label>Cities <span class="muted small">names, case-insensitive</span>
        <textarea name="cities" rows="3" placeholder="Paris, Dubai">${esc((acc.cities || []).join(', '))}</textarea></label>
      <label>Bypass code <span class="muted small">visit /?letmein=CODE</span>
        <input type="text" name="bypass" value="${esc(acc.bypass || '')}" placeholder="pick something long"></label>
    </div>
    <button type="submit">Save access rules</button>
  </form>`;

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Analytics — Mohammad Makki portfolio</title>
<style${nonceAttr}>
  :root{color-scheme:dark}
  *{box-sizing:border-box}
  body{font:14px/1.5 -apple-system,system-ui,Segoe UI,Roboto,sans-serif;margin:0;padding:24px;background:#05060a;color:#e6e9ef}
  h1{font-size:20px;margin:0 0 2px}
  a{color:#7aa2ff;text-decoration:none}
  .muted{color:#8a93a6}.small{font-size:12px}
  .cards{display:flex;gap:14px;flex-wrap:wrap;margin:18px 0}
  .card{background:#0e1119;border:1px solid #1d2431;border-radius:14px;padding:14px 18px;min-width:130px}
  .card .n{font-size:26px;font-weight:700}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:18px}
  .panel{background:#0e1119;border:1px solid #1d2431;border-radius:14px;padding:16px;overflow:auto}
  .panel h2{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#8a93a6;margin:0 0 12px}
  table{width:100%;border-collapse:collapse}
  th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #1d2431;vertical-align:top}
  th{color:#8a93a6;font-weight:600}
  td.n,th.n{text-align:right;white-space:nowrap}
  .bar{height:6px;background:linear-gradient(90deg,#7aa2ff,#3b6dff);border-radius:3px}
  code{color:#9fd0ff;word-break:break-all}
  .full{grid-column:1/-1}
  .top{display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px}
  .filter{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:14px 0 4px;background:#0e1119;border:1px solid #1d2431;border-radius:14px;padding:12px 14px}
  .filter input[type=date]{background:#05060a;border:1px solid #1d2431;color:#e6e9ef;border-radius:8px;padding:6px 8px;color-scheme:dark}
  .filter button{background:#3b6dff;border:0;color:#fff;border-radius:8px;padding:7px 14px;font-weight:600;cursor:pointer}
  .chip{display:inline-block;border:1px solid #1d2431;border-radius:999px;padding:5px 12px;font-size:12.5px}
  .chip.active{background:#16233f;border-color:#3b6dff;color:#cfe0ff}
  .pill{display:inline-block;border-radius:6px;padding:1px 7px;font-size:11px;border:1px solid #1d2431}
  .pill.ev{background:#1a2436;border-color:#2a3a5a;color:#9fd0ff}
  .acc label{display:block;margin:10px 0 0}
  .acc label.row{display:flex;align-items:center;gap:8px;margin:12px 0}
  .acc textarea,.acc input[type=text]{width:100%;margin-top:5px;background:#05060a;border:1px solid #1d2431;color:#e6e9ef;border-radius:8px;padding:8px;font:12.5px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;resize:vertical}
  .accgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px}
  .acc button{margin-top:14px;background:#3b6dff;border:0;color:#fff;border-radius:8px;padding:8px 16px;font-weight:600;cursor:pointer}
  .acc p.on{color:#8fd6a8}.acc p.off{color:#8a93a6}
  .blockbtn{background:none;border:1px solid #3a2430;color:#e08a9a;border-radius:6px;padding:1px 8px;font-size:11px;cursor:pointer}
  .blockbtn:hover{background:#2a1a22}
  th.sortable{cursor:pointer;user-select:none;white-space:nowrap}
  th.sortable:hover{color:#cfe0ff}
  th.sortable .arw{opacity:.3;font-size:9px;margin-left:5px;letter-spacing:-1px}
  th.sortable.asc .arw,th.sortable.desc .arw{opacity:1;color:#7aa2ff}
  .tbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:0 0 12px}
  .tbar input[type=search],.tbar select{background:#05060a;border:1px solid #1d2431;color:#e6e9ef;border-radius:8px;padding:6px 9px;font:12.5px/1.4 inherit;color-scheme:dark}
  .tbar input[type=search]{min-width:215px}
  .tbar select{max-width:210px}
  .tbar .fchip{display:inline-flex;align-items:center;gap:6px;border:1px solid #1d2431;border-radius:999px;padding:5px 11px;font-size:12.5px;cursor:pointer}
  .tbar .fchip:has(input:checked){background:#16233f;border-color:#3b6dff;color:#cfe0ff}
  .tbar .fchip input{accent-color:#3b6dff;margin:0}
  .tbar .clr{background:none;border:1px solid #1d2431;color:#8a93a6;border-radius:8px;padding:6px 12px;cursor:pointer;font:12.5px/1.4 inherit}
  .tbar .clr:hover{color:#e6e9ef;border-color:#3b6dff}
  .tbar .cnt{color:#8a93a6;font-size:12px;margin-left:auto}
  #recentTable thead th{position:sticky;top:0;background:#0e1119;z-index:1}
  tr.hide{display:none}
  .nomatch td{color:#8a93a6;padding:14px 8px}
</style></head><body>
<div class="top">
  <div><h1>Mohammad Makki — visitor analytics</h1>
  <div class="muted small">All times UTC · geo is approximate · <a href="/admin">reset</a></div></div>
</div>

<form class="filter" method="get" action="/admin">
  <span class="muted small">Range</span>
  ${presetChips}
  <span class="muted small">·</span>
  <label class="muted small">From <input type="date" name="from" value="${esc(from)}"></label>
  <label class="muted small">To <input type="date" name="to" value="${esc(to)}"></label>
  <button type="submit">Apply</button>
  <span class="muted small">${rangeNote}</span>
</form>

<div class="cards">
  <div class="card"><div class="muted small">Page views</div><div class="n">${a.total}</div></div>
  <div class="card"><div class="muted small">Unique IPs</div><div class="n">${a.uniqueIps}</div></div>
  <div class="card"><div class="muted small">Today</div><div class="n">${a.today}</div></div>
  <div class="card"><div class="muted small">Events</div><div class="n">${a.events ?? 0}</div></div>
  <div class="card"><div class="muted small">Blocked</div><div class="n">${a.blocked ?? 0}</div></div>
</div>
<div class="grid">
  <div class="panel"><h2>Views per day (last 30)</h2><table>
    ${rows(a.perDay, (d) => `<tr><td>${esc(d.day)}</td><td style="width:60%"><div class="bar" style="width:${Math.round(100 * d.c / maxDay)}%"></div></td><td class="n">${d.c}</td></tr>`)}
  </table></div>
  ${projectsPanel}
  ${accPanel}
  <div class="panel"><h2>Top pages</h2><table><tr><th>Page</th><th class="n">Views</th></tr>
    ${rows(a.topPages, (r) => `<tr><td><code>${esc(r.key)}</code></td><td class="n">${r.c}</td></tr>`)}
  </table></div>
  <div class="panel"><h2>Top referrers</h2><table><tr><th>Referrer</th><th class="n">Views</th></tr>
    ${rows(a.topRefs, (r) => `<tr><td><code>${esc(r.key)}</code></td><td class="n">${r.c}</td></tr>`)}
  </table></div>
  <div class="panel"><h2>Campaigns (UTM)</h2><table><tr><th>Campaign</th><th>Source / Medium</th><th class="n">Views</th></tr>
    ${rows(a.topCampaigns, (r) => `<tr><td>${esc(r.key)}</td><td class="muted">${esc(r.extra)}</td><td class="n">${r.c}</td></tr>`)}
  </table></div>
  <div class="panel"><h2>Top locations</h2><table><tr><th>Country</th><th>Region</th><th>City</th><th class="n">Views</th><th></th></tr>
    ${rows(a.topGeo, (r) => {
      const g = r.extra || {};
      const already = (acc.countries || []).includes((g.cc || '').toUpperCase()) || (acc.cities || []).includes((g.city || '').toLowerCase());
      const btn = already
        ? `<span class="muted small">blocked</span>`
        : (g.cc || g.city
          ? `<form method="post" action="/admin" style="display:inline;margin:0">
               <input type="hidden" name="block_cc" value="${esc(g.cc)}">
               <input type="hidden" name="block_city" value="${esc(g.city)}">
               <button class="blockbtn" type="submit" title="Block ${esc(g.city || g.country)}">block</button></form>`
          : '');
      return `<tr><td>${esc(g.country)}</td><td class="muted">${esc(g.region)}</td><td class="muted">${esc(g.city)}</td><td class="n">${r.c}</td><td>${btn}</td></tr>`;
    })}
  </table></div>
  <div class="panel"><h2>Blocked attempts</h2><table><tr><th>Location</th><th class="n">Hits</th></tr>
    ${a.topBlocked && a.topBlocked.length
      ? rows(a.topBlocked, (r) => `<tr><td>${esc(r.key)}</td><td class="n">${r.c}</td></tr>`)
      : `<tr><td class="muted" colspan="2">${acc.enabled ? 'Gate is on; nobody has been turned away in this range.' : 'Gate is off.'}</td></tr>`}
  </table></div>
  <div class="panel full" id="recentPanel"><h2>Recent activity (last 100)</h2>
    <div class="tbar">
      <input type="search" id="rq" placeholder="Search IP, page, referrer, city…" aria-label="Search activity">
      <label class="fchip"><input type="checkbox" id="fView" checked> Views</label>
      <label class="fchip"><input type="checkbox" id="fEvent" checked> Events</label>
      <select id="fEv" aria-label="Filter by event type"><option value="">All events</option>${eventOpts}</select>
      <select id="fCc" aria-label="Filter by country"><option value="">All countries</option>${countryOpts}</select>
      <select id="fPage" aria-label="Filter by page"><option value="">All pages</option>${pageOpts}</select>
      <button type="button" class="clr" id="rClear">Clear</button>
      <span class="cnt" id="rCount"></span>
    </div>
    <table id="recentTable">
    <thead><tr><th>Time (UTC)</th><th>Type</th><th>IP</th><th>Location</th><th>Page / target</th><th>Referrer</th><th>Campaign</th></tr></thead>
    <tbody>
    ${rows(a.recent, (r) => {
      const isEvent = r.type === 'event';
      const typeCell = isEvent
        ? `<span class="pill ev">${esc(r.event || 'event')}${r.label ? ': ' + esc(r.label) : ''}</span>`
        : `<span class="pill">view</span>`;
      const loc = `${esc(r.country)}${r.region ? ' · ' + esc(r.region) : ''}${r.city ? ' · ' + esc(r.city) : ''}`;
      return `<tr data-type="${isEvent ? 'event' : 'view'}" data-ev="${esc(isEvent ? (r.event || 'event') : '')}" data-cc="${esc(r.country || '')}" data-page="${esc(r.page || '')}"><td class="small" data-sort="${esc(r.ts)}">${esc(r.ts)}</td><td class="small">${typeCell}</td><td class="small"><code>${esc(r.ip)}</code></td><td class="small">${loc}</td><td class="small"><code>${esc(r.page)}</code></td><td class="small"><code>${esc(r.referrer || '(direct)')}</code></td><td class="small">${esc(r.utm_campaign)}</td></tr>`;
    })}
    <tr class="nomatch hide"><td colspan="7">No activity matches these filters.</td></tr>
    </tbody></table></div>
</div>
<script${nonceAttr}>
(function () {
  /* Any table with a header row becomes sortable: click a header to toggle. */
  document.querySelectorAll('table').forEach(function (tb) {
    var head = tb.tHead && tb.tHead.rows[0];
    if (!head && tb.rows[0] && tb.rows[0].cells[0] && tb.rows[0].cells[0].tagName === 'TH') head = tb.rows[0];
    if (!head) return;
    var body = tb.tBodies[0];
    if (!body) return;
    [].forEach.call(head.cells, function (th, i) {
      if (!th.textContent.trim()) return;
      th.classList.add('sortable');
      th.insertAdjacentHTML('beforeend', '<span class="arw">\u25B2\u25BC</span>');
      th.addEventListener('click', function () {
        var dir = th.classList.contains('asc') ? -1 : 1;
        [].forEach.call(head.cells, function (o) { o.classList.remove('asc', 'desc'); });
        th.classList.add(dir === 1 ? 'asc' : 'desc');
        var rows = [].slice.call(body.rows).filter(function (r) {
          return !r.classList.contains('nomatch') && r !== head;
        });
        var val = function (r) {
          var c = r.cells[i];
          if (!c) return '';
          return (c.getAttribute('data-sort') || c.textContent || '').trim();
        };
        var num = function (v) {
          if (!/^[\s\d.,+-]+$/.test(v)) return null;
          var n = parseFloat(v.replace(/[^0-9.-]/g, ''));
          return isNaN(n) ? null : n;
        };
        rows.sort(function (x, y) {
          var a = val(x), b = val(y), na = num(a), nb = num(b);
          if (na !== null && nb !== null) return (na - nb) * dir;
          return a.localeCompare(b, undefined, { numeric: true }) * dir;
        });
        rows.forEach(function (r) { body.appendChild(r); });
        var nm = body.querySelector('.nomatch');
        if (nm) body.appendChild(nm);
      });
    });
  });

  /* Recent activity: free-text search, type checkboxes and prebuilt dropdowns. */
  var tbl = document.getElementById('recentTable');
  if (!tbl) return;
  var q = document.getElementById('rq'),
      fView = document.getElementById('fView'),
      fEvent = document.getElementById('fEvent'),
      fEv = document.getElementById('fEv'),
      fCc = document.getElementById('fCc'),
      fPage = document.getElementById('fPage'),
      cnt = document.getElementById('rCount'),
      clr = document.getElementById('rClear'),
      body = tbl.tBodies[0];
  var all = [].slice.call(body.rows).filter(function (r) { return !r.classList.contains('nomatch'); });
  var none = body.querySelector('.nomatch');
  all.forEach(function (r) { r._txt = r.textContent.toLowerCase(); });

  function apply() {
    var term = (q.value || '').trim().toLowerCase();
    var ev = fEv.value, cc = fCc.value, pg = fPage.value, shown = 0;
    all.forEach(function (r) {
      var isView = r.getAttribute('data-type') === 'view';
      var ok = (isView ? fView.checked : fEvent.checked) &&
        (!ev || r.getAttribute('data-ev') === ev) &&
        (!cc || r.getAttribute('data-cc') === cc) &&
        (!pg || r.getAttribute('data-page') === pg) &&
        (!term || r._txt.indexOf(term) > -1);
      r.classList.toggle('hide', !ok);
      if (ok) shown++;
    });
    if (none) none.classList.toggle('hide', shown > 0);
    cnt.textContent = shown === all.length ? all.length + ' rows' : shown + ' of ' + all.length + ' rows';
  }

  q.addEventListener('input', apply);
  [fView, fEvent, fEv, fCc, fPage].forEach(function (el) { el.addEventListener('change', apply); });
  clr.addEventListener('click', function () {
    q.value = '';
    fView.checked = true;
    fEvent.checked = true;
    fEv.value = '';
    fCc.value = '';
    fPage.value = '';
    apply();
  });
  apply();
})();
</script>
</body></html>`;
}
