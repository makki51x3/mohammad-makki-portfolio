# Self-hosted visitor analytics

First-party analytics for **mohammad-makki-portfolio.netlify.app**.
No cookies, no third-party trackers, no external services: a small beacon posts to a
Netlify Function, which stores each visit in Netlify Blobs. A password-protected
`/admin` page renders the dashboard.

## What gets recorded

Per visit: timestamp (UTC), IP address, and the geo set from Netlify's edge
geolocation (country, region, city, postal code, timezone, coordinates; no external
geo API), plus page URL, referrer, UTM params, screen size, user-agent and language.
Card clicks are recorded as `project_click` events with the card's title as the label.

## Files

| Path                              | Purpose                                              |
|-----------------------------------|------------------------------------------------------|
| `_publish/analytics.js`           | Tracking beacon, served at `/analytics.js`.          |
| `netlify/functions/collect.mjs`   | `/api/collect`: records one visit into Blobs.        |
| `netlify/functions/admin.mjs`     | `/admin`: password-protected dashboard.              |
| `netlify/lib/analytics.mjs`       | Shared logic (records, storage, aggregation, render).|
| `netlify/edge-functions/gate.mjs` | Edge geo-gate, toggled from the dashboard.           |
| `test/analytics.test.mjs`         | Logic tests: `npm run test:analytics`.               |

## What the beacon tracks

The site renders its cards in JS, so the beacon matches on class rather than
requiring data attributes (see `TARGETS` in `_publish/analytics.js`):

| Selector           | Section            | Label source |
|--------------------|--------------------|--------------|
| `.pc-item`         | Selected work deck | `.pc-title`  |
| `.cfront`          | Lab & experiments  | `h3`         |
| `.brandcard`       | Storefronts        | `h4`         |
| `.gentile`         | Generative studio  | `.gcap b`    |
| `.cfcard`          | R&D cover-flow     | `.cflab`     |
| `#moregrid .mcard` | More public builds | `h4`         |

Both `click` and `auxclick` are handled, so middle-click / open-in-new-tab counts.
De-dupe is **per label** (400 ms), so a paired click+auxclick on one card counts once
while two different cards clicked quickly both count.

## How storage works

Netlify Blobs v8 has **no compare-and-swap writes**: `set()` just overwrites. So the
code never does read-modify-write on a shared key. Each visit is written as its **own
blob** under `visits/<YYYY-MM-DD>/<timestamp>-<id>`, which is race-free by
construction. The dashboard lists keys, filters by the date segment, and fetches only
what it needs (batched, capped at 20k records).

## Security

- `/admin` uses HTTP Basic auth and **fails closed** (503) until `ANALYTICS_PASSWORD`
  is set as an environment variable. No credentials live in the code.
- Constant-time password comparison, per-IP login throttling, CSRF protection on
  POST (same-origin check), strict per-request-nonce CSP on the dashboard.
- `/api/collect` accepts GET/POST only, caps body size, rate-limits per IP and drops
  cross-site beacons.

## Configuration

| Variable              | Required | Purpose                          |
|-----------------------|----------|----------------------------------|
| `ANALYTICS_PASSWORD`  | yes      | Dashboard password               |
| `ANALYTICS_USER`      | no       | Dashboard user (default `admin`) |

Functions only pick up environment changes on a new deploy.

## Privacy

The site footer discloses, in English and Arabic, that each visit is recorded with IP
address, approximate location, page and referrer, and that there are no cookies, no
third-party trackers, and no selling or sharing. The beacon sets no cookie, no
third-party script is added, and the data stays in this site's own Blobs store.

## Local testing

`npm run test:analytics` runs the logic checks against a fake store that mirrors the
real Blobs API. Netlify geolocation only populates on the deployed site, so country
and city are blank locally.
