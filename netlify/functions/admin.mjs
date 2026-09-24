/**
 * admin.mjs — password-protected analytics dashboard.
 * Route: /admin  (see `config.path` below)
 *
 * Protected by HTTP Basic Auth. Set these in Netlify → Site settings →
 * Environment variables (do NOT hardcode a real password):
 *   ANALYTICS_USER      (optional, default "admin")
 *   ANALYTICS_PASSWORD  (required)
 *
 * GET renders the dashboard; POST saves the geo-gate rules that
 * netlify/edge-functions/gate.mjs enforces.
 */
import { getStore } from '@netlify/blobs';
import {
  readVisits, aggregate, checkBasicAuth, renderDashboard, cleanDate, datePresets,
  readAccess, writeAccess, normalizeAccess, isSameOriginPost, makeThrottle, cspNonce,
} from '../lib/analytics.mjs';

// Slows repeated password guesses from one address (per function instance).
const throttle = makeThrottle({ max: 8, windowMs: 5 * 60 * 1000 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Headers every /admin response carries. `nonce` locks inline script down. */
function secureHeaders(nonce, extra = {}) {
  return {
    'Cache-Control': 'no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), interest-cohort=()',
    'Content-Security-Policy': [
      "default-src 'none'",
      "img-src 'self' data:",
      `script-src 'nonce-${nonce}'`,
      `style-src 'nonce-${nonce}'`,
      "style-src-attr 'unsafe-inline'",
      "form-action 'self'",
      "base-uri 'none'",
      "frame-ancestors 'none'",
    ].join('; '),
    ...extra,
  };
}

export default async (req, context) => {
  const user = process.env.ANALYTICS_USER || 'admin';
  const pass = process.env.ANALYTICS_PASSWORD || '';
  const nonce = cspNonce();
  const who = context?.ip || req.headers.get('x-nf-client-connection-ip') || 'unknown';

  // Only these two verbs exist here; anything else is refused outright.
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'POST') {
    return new Response('Method not allowed.', {
      status: 405,
      headers: secureHeaders(nonce, { 'Content-Type': 'text/plain', Allow: 'GET, POST' }),
    });
  }

  // If no password is configured, refuse rather than exposing data.
  if (!pass) {
    return new Response(
      'Analytics dashboard is not configured. Set the ANALYTICS_PASSWORD environment variable in Netlify.',
      { status: 503, headers: secureHeaders(nonce, { 'Content-Type': 'text/plain' }) }
    );
  }

  // Too many recent failures from this address: stop answering for a while.
  if (throttle.blocked(who)) {
    return new Response('Too many attempts. Try again in a few minutes.', {
      status: 429,
      headers: secureHeaders(nonce, { 'Content-Type': 'text/plain', 'Retry-After': '300' }),
    });
  }

  if (!checkBasicAuth(req.headers.get('authorization'), user, pass)) {
    throttle.fail(who);
    await sleep(400);                    // flat cost per wrong guess
    return new Response('Authentication required.', {
      status: 401,
      headers: secureHeaders(nonce, {
        'WWW-Authenticate': 'Basic realm="Analytics"',
        'Content-Type': 'text/plain',
      }),
    });
  }
  throttle.ok(who);

  // --- POST: save the geo-gate rules, then redirect back (POST/redirect/GET,
  // so a refresh doesn't re-submit). Auth above has already passed.
  if (req.method === 'POST') {
    // Browsers attach cached Basic credentials to cross-site form posts, so a
    // hostile page could otherwise flip the gate on. Demand same-origin proof.
    if (!isSameOriginPost(req)) {
      return new Response('Cross-site form submissions are refused.', {
        status: 403, headers: secureHeaders(nonce, { 'Content-Type': 'text/plain' }),
      });
    }
    try {
      const store = getStore('analytics');
      const raw = await req.text();
      if (raw.length > 20000) {
        return new Response('Payload too large.', {
          status: 413, headers: secureHeaders(nonce, { 'Content-Type': 'text/plain' }),
        });
      }
      const form = new URLSearchParams(raw);
      const cur = await readAccess(store);
      let next;
      if (form.has('block_cc') || form.has('block_city')) {
        // One-click block from a Top-locations row. Clicking "block" plainly
        // means "enforce this", so it switches the gate on too.
        const cc = (form.get('block_cc') || '').toUpperCase();
        const city = (form.get('block_city') || '').toLowerCase();
        next = normalizeAccess({
          ...cur,
          enabled: true,
          countries: cc ? [...cur.countries, cc] : cur.countries,
          cities: city ? [...cur.cities, city] : cur.cities,
        });
      } else {
        next = normalizeAccess({
          enabled: form.get('enabled'),
          countries: form.get('countries'),
          regions: form.get('regions'),
          cities: form.get('cities'),
          bypass: form.get('bypass'),
        });
      }
      next.updated = new Date().toISOString().slice(0, 19).replace('T', ' ');
      await writeAccess(store, next);
    } catch (err) {
      console.error('admin save error:', err?.message || err);
      return new Response('Could not save access rules.', {
        status: 500, headers: secureHeaders(nonce, { 'Content-Type': 'text/plain' }),
      });
    }
    return new Response(null, { status: 303, headers: secureHeaders(nonce, { Location: '/admin' }) });
  }

  let html;
  try {
    const url = new URL(req.url);
    const from = cleanDate(url.searchParams.get('from'));
    const to = cleanDate(url.searchParams.get('to'));

    const store = getStore('analytics');
    const visits = await readVisits(store, { from, to });
    const now = new Date();
    const agg = aggregate(visits, { from, to, today: now.toISOString().slice(0, 10) });
    const access = await readAccess(store);
    html = renderDashboard(agg, { presets: datePresets(now, { from, to }), access, nonce });
  } catch (err) {
    console.error('admin error:', err?.message || err);
    return new Response('Error loading analytics.', {
      status: 500,
      headers: secureHeaders(nonce, { 'Content-Type': 'text/plain' }),
    });
  }

  return new Response(html, {
    status: 200,
    headers: secureHeaders(nonce, { 'Content-Type': 'text/html; charset=utf-8' }),
  });
};

export const config = { path: '/admin' };
