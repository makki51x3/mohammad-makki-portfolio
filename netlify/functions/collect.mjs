/**
 * collect.mjs — Netlify Function that records one visit per call.
 * Route: /api/collect  (see `config.path` below)
 *
 * Uses Netlify's built-in geolocation (context.geo) and client IP (context.ip),
 * so there is no external geo API call. Stores into Netlify Blobs.
 *
 * IPs and full geo (country/region/city/postal/timezone/coords) are recorded
 * unmasked, with visitor disclosure in the site footer. Masking was removed in
 * v34: a zeroed last octet makes unique-visitor counts and location data wrong.
 */
import { getStore } from '@netlify/blobs';
import { buildRecord, appendVisit, makeThrottle } from '../lib/analytics.mjs';

// The beacon is public by necessity, so bound what one address can write.
const writes = makeThrottle({ max: 120, windowMs: 60 * 1000 });

/** Reject beacons fired from someone else's page (junk data, storage cost). */
function sameSite(req) {
  const site = req.headers.get('sec-fetch-site');
  if (site) return site === 'same-origin' || site === 'same-site' || site === 'none';
  const origin = req.headers.get('origin') || req.headers.get('referer');
  if (!origin) return true;              // plain GET beacons may send neither
  try {
    return new URL(origin).host === new URL(req.url).host;
  } catch {
    return false;
  }
}

const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

export default async (req, context) => {
  const gif = () => new Response(GIF, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });

  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method not allowed.', { status: 405, headers: { Allow: 'GET, POST' } });
  }

  // Always hand back the pixel — a visitor must never see an analytics error —
  // but drop cross-site and over-rate writes instead of storing them.
  const ip = context?.ip || req.headers.get('x-nf-client-connection-ip') || 'unknown';
  if (!sameSite(req) || writes.blocked(ip)) return gif();
  writes.fail(ip);

  let body = {};
  if (req.method === 'POST') {
    try {
      const raw = await req.text();
      if (raw.length <= 8192) body = JSON.parse(raw);   // cap the payload
    } catch { body = {}; }
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) body = {};
  const query = Object.fromEntries(new URL(req.url).searchParams);

  const record = buildRecord({
    ip: context.ip,
    geo: context.geo,
    userAgent: req.headers.get('user-agent'),
    lang: req.headers.get('accept-language'),
    body,
    query,
    now: new Date(),
  });

  try {
    const store = getStore('analytics');
    await appendVisit(store, record);
  } catch (err) {
    // A logging failure must never affect the visitor.
    console.error('collect error:', err?.message || err);
  }

  return gif();
};

export const config = { path: '/api/collect' };
