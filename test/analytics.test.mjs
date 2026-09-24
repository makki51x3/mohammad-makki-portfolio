/**
 * Local test for the analytics logic. No Netlify needed — uses a fake in-memory
 * store that mimics Netlify Blobs' conditional writes (onlyIfNew / onlyIfMatch).
 *
 * Run:  npm run test:analytics
 */
import assert from 'node:assert';
import {
  buildRecord, appendVisit, readVisits, aggregate,
  checkBasicAuth, renderDashboard, normalizeAccess, isBlocked, readAccess, writeAccess,
  cleanDate, datePresets,
} from '../netlify/lib/analytics.mjs';

// ---- Fake Netlify Blobs store (with etag-based optimistic concurrency) ----
// Mimics the real @netlify/blobs v8 Store: set() overwrites and returns void
// (NO conditional writes), get() parses, list({paginate:true}) is async-iterable.
function makeFakeStore() {
  const data = new Map(); // key -> body string
  let seq = 0;

  const store = {
    _data: data,
    async get(key, { type } = {}) {
      if (!data.has(key)) return null;
      const body = data.get(key);
      return type === 'json' ? JSON.parse(body) : body;
    },
    async set(key, body /*, opts */) {
      data.set(key, body); // last write wins; unique keys mean no clobber
      return undefined;    // real API returns Promise<void>
    },
    list({ prefix, paginate } = {}) {
      const blobs = [...data.keys()]
        .filter((k) => !prefix || k.startsWith(prefix))
        .map((k) => ({ key: k, etag: 'e' + ++seq }));
      if (paginate) {
        return (async function* () { yield { blobs, directories: [] }; })();
      }
      return Promise.resolve({ blobs, directories: [] });
    },
  };
  return store;
}

let passed = 0;
function ok(name) { console.log('  ✓ ' + name); passed++; }

// ---------------------------- tests ----------------------------
async function run() {
  console.log('analytics logic tests\n');

  // 1. buildRecord extracts + clips fields, uses Netlify geo shape
  {
    const rec = buildRecord({
      ip: '203.0.113.9',
      geo: { city: 'Beirut', country: { code: 'LB', name: 'Lebanon' } },
      userAgent: 'Mozilla/5.0',
      lang: 'en-US',
      body: { u: 'https://site/', r: 'https://google.com', utm_campaign: 'launch', s: '1920x1080' },
      now: new Date('2026-08-27T14:03:22.500Z'),
    });
    assert.equal(rec.date, '2026-08-27');
    assert.equal(rec.ts, '2026-08-27 14:03:22');
    assert.equal(rec.country, 'Lebanon');
    assert.equal(rec.city, 'Beirut');
    assert.equal(rec.page, 'https://site/');
    assert.equal(rec.utm_campaign, 'launch');
    assert.equal(rec.ip, '203.0.113.9');
    ok('buildRecord maps request + Netlify geo into a record');
  }

  // 2. Full IP + full Netlify geo are stored (deliberately NOT anonymized:
  //    unique-visitor and location numbers are meaningless on masked IPs).
  {
    const rec = buildRecord({
      ip: '203.0.113.9',
      geo: {
        city: 'Tripoli',
        country: { code: 'LB', name: 'Lebanon' },
        subdivision: { code: 'AS', name: 'North Governorate' },
        postalCode: '1300',
        timezone: 'Asia/Beirut',
        latitude: 34.436667,
        longitude: 35.849167,
      },
      body: {},
      now: new Date('2026-01-01T00:00:00Z'),
      rand: 0,
    });
    assert.equal(rec.ip, '203.0.113.9', 'IPv4 is stored in full');
    assert.equal(rec.country_code, 'LB');
    assert.equal(rec.region, 'North Governorate');
    assert.equal(rec.region_code, 'AS');
    assert.equal(rec.postal, '1300');
    assert.equal(rec.timezone, 'Asia/Beirut');
    assert.equal(rec.lat, 34.4367);   // rounded to 4dp
    assert.equal(rec.lon, 35.8492);
    const v6 = buildRecord({ ip: '2001:db8:abcd:1234::1', geo: {}, body: {}, now: new Date('2026-01-01T00:00:00Z'), rand: 0 });
    assert.equal(v6.ip, '2001:db8:abcd:1234::1', 'IPv6 is stored in full');
    assert.equal(v6.region, null, 'missing geo fields degrade to null');
    ok('full IP + country/region/city/postal/timezone/lat/lon are recorded');
  }

  // 2b. `blocked` records are counted separately, never as page views
  {
    const store = makeFakeStore();
    const mk = (type, i) => buildRecord({
      ip: '203.0.113.' + i, geo: { country: { name: 'France', code: 'FR' }, city: 'Paris' },
      body: { u: '/' }, type, now: new Date('2026-08-27T15:00:0' + i + 'Z'), rand: i / 10,
    });
    await appendVisit(store, mk(undefined, 0));
    await appendVisit(store, mk('blocked', 1));
    await appendVisit(store, mk('blocked', 2));
    const a = aggregate(await readVisits(store, {}), { today: '2026-08-27' });
    assert.equal(a.total, 1, 'blocked hits are not page views');
    assert.equal(a.blocked, 2);
    assert.equal(a.topBlocked[0].key, 'France › Paris');
    ok('blocked hits are tallied separately from page views');
  }

  // 3. appendVisit writes one blob per visit (unique keys, race-free)
  {
    const store = makeFakeStore();
    for (let i = 0; i < 3; i++) {
      const rec = buildRecord({ ip: '1.1.1.' + i, geo: {}, body: { u: '/p' + i }, now: new Date('2026-08-27T10:00:0' + i + 'Z'), rand: i / 10 });
      await appendVisit(store, rec);
    }
    assert.equal(store._data.size, 3, 'three distinct blobs written');
    const visits = await readVisits(store, {});
    assert.equal(visits.length, 3);
    ok('appendVisit writes one blob per visit; readVisits returns them all');
  }

  // 4. Concurrency: simultaneous visits must NOT clobber each other.
  // With the real API (no compare-and-swap), safety comes from unique keys —
  // this is the exact pageview+click-on-one-page-load scenario.
  {
    const store = makeFakeStore();
    const mk = (p, ms, r) => buildRecord({ ip: '2.2.2.2', geo: {}, body: p, now: new Date('2026-08-27T11:00:00.00' + ms + 'Z'), rand: r });
    const pageview = mk({ u: '/' }, 0, 0.11);
    const click = mk({ t: 'event', e: 'project_click', l: 'Naqua', u: '/' }, 0, 0.42); // same second!
    await Promise.all([appendVisit(store, pageview), appendVisit(store, click)]);
    const visits = await readVisits(store, {});
    assert.equal(visits.length, 2, 'both the pageview and the click survive');
    assert.ok(visits.find((v) => v.type === 'pageview'));
    assert.ok(visits.find((v) => v.type === 'event' && v.label === 'Naqua'));
    ok('concurrent pageview + click in the same second — no lost writes');
  }

  // 5. readVisits + aggregate
  {
    const store = makeFakeStore();
    const days = ['2026-08-25', '2026-08-26', '2026-08-27'];
    for (const d of days) {
      for (let i = 0; i < 2; i++) {
        const rec = buildRecord({
          ip: '9.9.9.' + i,
          geo: { city: 'Beirut', country: { name: 'Lebanon' } },
          body: { u: '/home', r: i === 0 ? '' : 'https://twitter.com', utm_campaign: i === 0 ? '' : 'aug' },
          now: new Date(d + 'T09:00:0' + i + 'Z'),
          rand: i / 10,
        });
        await appendVisit(store, rec);
      }
    }
    const visits = await readVisits(store, {});
    assert.equal(visits.length, 6);
    const a = aggregate(visits, { today: '2026-08-27' });
    assert.equal(a.total, 6);
    assert.equal(a.uniqueIps, 2);
    assert.equal(a.today, 2);
    assert.equal(a.topPages[0].key, '/home');
    assert.equal(a.topGeo[0].key, 'Lebanon › Beirut');
    assert.ok(a.topRefs.find((r) => r.key === '(direct)'));
    // renders without throwing and escapes
    const html = renderDashboard(a);
    assert.ok(html.includes('visitor analytics'));
    ok('readVisits + aggregate produce correct totals, uniques, tops');
  }

  // 6. Basic auth
  {
    const header = 'Basic ' + Buffer.from('admin:s3cret').toString('base64');
    assert.equal(checkBasicAuth(header, 'admin', 's3cret'), true);
    assert.equal(checkBasicAuth(header, 'admin', 'wrong'), false);
    assert.equal(checkBasicAuth('Basic garbage', 'admin', 's3cret'), false);
    assert.equal(checkBasicAuth(null, 'admin', 's3cret'), false);
    ok('checkBasicAuth accepts correct creds, rejects wrong/missing');
  }

  // 7. HTML escaping (no injection via page/referrer)
  {
    const a = aggregate([
      buildRecord({ ip: '1.2.3.4', geo: {}, body: { u: '/<script>x</script>' }, now: new Date('2026-08-27T00:00:00Z'), rand: 0 }),
    ], { today: '2026-08-27' });
    const html = renderDashboard(a);
    assert.ok(!html.includes('<script>x</script>'));
    assert.ok(html.includes('&lt;script&gt;'));
    ok('renderDashboard escapes untrusted strings');
  }

  // 8. Event records: buildRecord recognizes type=event with name + label
  {
    const rec = buildRecord({
      ip: '5.5.5.5', geo: {},
      body: { t: 'event', e: 'project_click', l: 'Naqua', u: '/#work' },
      now: new Date('2026-08-27T12:00:00Z'), rand: 0,
    });
    assert.equal(rec.type, 'event');
    assert.equal(rec.event, 'project_click');
    assert.equal(rec.label, 'Naqua');
    const pv = buildRecord({ ip: '5.5.5.5', geo: {}, body: { u: '/' }, now: new Date('2026-08-27T12:00:00Z'), rand: 0 });
    assert.equal(pv.type, 'pageview');
    assert.equal(pv.event, null);
    ok('buildRecord distinguishes pageviews from events');
  }

  // 9. aggregate separates pageviews/events and ranks project clicks
  {
    const store = makeFakeStore();
    // 3 pageviews + project clicks (Naqua x2, OMIC-AI x1)
    const recs = [
      { body: { u: '/' } },
      { body: { u: '/#work' } },
      { body: { u: '/#work' } },
      { body: { t: 'event', e: 'project_click', l: 'Naqua', u: '/#work' } },
      { body: { t: 'event', e: 'project_click', l: 'Naqua', u: '/#work' } },
      { body: { t: 'event', e: 'project_click', l: 'OMIC-AI', u: '/#work' } },
    ];
    let s = 0;
    for (const r of recs) {
      await appendVisit(store, buildRecord({ ip: '7.7.7.7', geo: {}, ...r, now: new Date('2026-08-27T13:00:0' + (s++) + 'Z'), rand: s / 10 }));
    }
    const a = aggregate(await readVisits(store, {}), { today: '2026-08-27' });
    assert.equal(a.total, 3, 'page views count excludes events');
    assert.equal(a.events, 3, 'events counted separately');
    assert.equal(a.topProjects[0].key, 'Naqua');
    assert.equal(a.topProjects[0].c, 2);
    assert.equal(a.topProjects[1].key, 'OMIC-AI');
    // dashboard shows the panel + an event pill in recent activity
    const html = renderDashboard(a);
    assert.ok(html.includes('Top projects clicked'));
    assert.ok(html.includes('project_click'));
    ok('aggregate splits pageviews/events and ranks project clicks');
  }

  // 10. Date-range filtering
  {
    const mk = (date) => buildRecord({ ip: '8.8.8.8', geo: {}, body: { u: '/' }, now: new Date(date + 'T09:00:00Z'), rand: 0 });
    const visits = ['2026-08-20', '2026-08-24', '2026-08-25', '2026-08-27'].map(mk);
    const all = aggregate(visits, { today: '2026-08-27' });
    assert.equal(all.total, 4);
    const win = aggregate(visits, { from: '2026-08-24', to: '2026-08-26', today: '2026-08-27' });
    assert.equal(win.total, 2, 'only visits within [from,to] inclusive');
    assert.equal(win.range.from, '2026-08-24');
    assert.equal(win.range.to, '2026-08-26');
    const onlyFrom = aggregate(visits, { from: '2026-08-25', today: '2026-08-27' });
    assert.equal(onlyFrom.total, 2, 'open-ended "from" includes everything on/after');
    ok('aggregate honors inclusive from/to date filtering');
  }

  // 11. cleanDate + datePresets
  {
    assert.equal(cleanDate('2026-08-27'), '2026-08-27');
    assert.equal(cleanDate('not-a-date'), '');
    assert.equal(cleanDate('2026-8-1'), '');
    assert.equal(cleanDate(null), '');
    const now = new Date('2026-08-27T00:00:00Z');
    const presets = datePresets(now, { from: '', to: '' });
    const seven = presets.find((p) => p.label === 'Last 7d');
    assert.equal(seven.to, '2026-08-27');
    assert.equal(seven.from, '2026-08-21');
    assert.ok(presets.find((p) => p.label === 'All time').active, 'no range => All time active');
    const p2 = datePresets(now, { from: '2026-08-21', to: '2026-08-27' });
    assert.ok(p2.find((p) => p.label === 'Last 7d').active, 'matching range marks 7d active');
    ok('cleanDate validates and datePresets computes ranges + active flag');
  }

  // 13. geo gate — rules normalize, match, and default to letting people in
  {
    const cfg = normalizeAccess({
      enabled: 'on',
      countries: 'fr, RU\n lb , fr, xxx, 1',   // dupes, case, junk
      regions: 'us-ca',
      cities: ' Paris ,DUBAI',
      bypass: '  open-sesame  ',
    });
    assert.deepEqual(cfg.countries, ['FR', 'RU', 'LB'], 'ISO-2 only, upper-cased, de-duped');
    assert.deepEqual(cfg.cities, ['paris', 'dubai']);
    assert.deepEqual(cfg.regions, ['US-CA']);
    assert.equal(cfg.bypass, 'open-sesame');

    assert.equal(isBlocked(cfg, { country: { code: 'FR' } }), true, 'country match');
    assert.equal(isBlocked(cfg, { country: { code: 'GB' }, city: 'Paris' }), true, 'city match, any country');
    assert.equal(isBlocked(cfg, { country: { code: 'US' }, subdivision: { code: 'CA' } }), true, 'qualified region match');
    assert.equal(isBlocked(cfg, { country: { code: 'GB' }, city: 'London' }), false, 'no match passes');
    assert.equal(isBlocked({ ...cfg, enabled: false }, { country: { code: 'FR' } }), false, 'disabled gate never blocks');
    assert.equal(isBlocked(cfg, {}), false, 'missing geo passes');
    assert.equal(isBlocked(null, { country: { code: 'FR' } }), false, 'missing config passes');
    ok('geo gate normalizes rules, matches country/region/city, defaults open');
  }

  // 14. access config round-trips, and unreadable storage fails OPEN
  {
    const store = makeFakeStore();
    await writeAccess(store, normalizeAccess({ enabled: 'on', countries: 'FR', bypass: 'k' }));
    const back = await readAccess(store);
    assert.equal(back.enabled, true);
    assert.deepEqual(back.countries, ['FR']);
    assert.equal(back.bypass, 'k');

    const empty = await readAccess(makeFakeStore());
    assert.equal(empty.enabled, false, 'no config yet = gate off');

    const brokenStore = { get() { throw new Error('blobs down'); } };
    const fallback = await readAccess(brokenStore);
    assert.equal(fallback.enabled, false, 'storage failure must fail OPEN, not wall off the site');
    ok('access config round-trips; unreadable storage fails open');
  }

  console.log('\n' + passed + ' checks passed ✅');
}

run().catch((e) => { console.error('\n✗ TEST FAILED:\n', e); process.exit(1); });
