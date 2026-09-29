// Tiny static server that imitates the parts of Netlify the site relies on:
//  - serves public/ with directory index.html, 404.html for misses
//  - applies public/_headers (path globs with *, exact paths)
//  - applies public/_redirects rules of the form "/path  key=value  /target  302"
//  - accepts Netlify Forms posts: POST / → 200 (or 500 when the form was posted with ?fail / field fail=1);
//    non-AJAX posts get a 303 to the form's action page.
// Usage: node tests/server.mjs [port]   (exports start() for tests)
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(here, '..', '..', 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json', '.pdf': 'application/pdf' };

function parseHeaders() {
  const f = join(ROOT, '_headers'); if (!existsSync(f)) return [];
  const rules = []; let cur = null;
  for (const raw of readFileSync(f, 'utf8').split('\n')) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    if (!/^\s/.test(raw)) { cur = { path: raw.trim(), headers: [] }; rules.push(cur); continue; }
    const i = raw.indexOf(':'); if (cur && i > 0) cur.headers.push([raw.slice(0, i).trim(), raw.slice(i + 1).trim()]);
  }
  return rules;
}
function parseRedirects() {
  const f = join(ROOT, '_redirects'); if (!existsSync(f)) return [];
  return readFileSync(f, 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')).map(l => {
    const parts = l.split(/\s+/); const from = parts.shift();
    const st = /^\d{3}!?$/.test(parts.at(-1)) ? parts.pop() : '301';
    const to = parts.pop(); const query = Object.fromEntries(parts.map(p => p.split('=')));
    return { from, to, status: parseInt(st, 10), force: st.endsWith('!'), query };
  });
}
// Netlify semantics: a non-forced rule only applies when no static file exists at the path.
function staticExists(path) {
  const f = normalize(join(ROOT, decodeURIComponent(path)));
  if (!f.startsWith(ROOT) || !existsSync(f)) return false;
  return statSync(f).isDirectory() ? existsSync(join(f, 'index.html')) : true;
}
const globToRe = g => new RegExp('^' + g.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');

export function start(port = 0) {
  return new Promise(resolve => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, 'http://x');
      let path = decodeURIComponent(url.pathname);
      let rewrite404 = null;
      for (const r of parseRedirects()) {
        const wild = r.from.endsWith('/*');
        const hit = wild ? path.startsWith(r.from.slice(0, -1)) : r.from === path;
        if (!hit) continue;
        if (!r.force && staticExists(path)) continue;
        if (!Object.entries(r.query).every(([k, v]) => url.searchParams.get(k) === v || (v.startsWith(':') && url.searchParams.has(k)))) continue;
        if (r.status === 404) { rewrite404 = r.to; break; }       // custom not-found page for this subtree
        res.writeHead(r.status, { Location: r.to }); return res.end();
      }
      if (req.method === 'POST') {
        let body = ''; req.on('data', c => (body += c)); req.on('end', () => {
          const p = new URLSearchParams(body); server.lastForm = Object.fromEntries(p); server.forms = (server.forms || []).concat([server.lastForm]);
          const fail = url.searchParams.has('fail') || p.get('fail') === '1' || server.failNext;
          if (fail) { res.writeHead(500, { 'Content-Type': 'text/plain' }); return res.end('error'); }
          const ajax = (req.headers['accept'] || '').includes('application/json') || req.headers['x-requested-with'] === 'fetch';
          if (!ajax && p.get('_action')) { res.writeHead(303, { Location: p.get('_action') }); return res.end(); }
          if (!ajax && req.headers['content-type']?.includes('form') && !req.headers['sec-fetch-mode']?.includes('cors') && req.headers['sec-fetch-mode'] === 'navigate') {
            const action = req.headers.referer?.includes('/ar/') ? '/ar/thanks/' : '/thanks/';
            res.writeHead(303, { Location: action }); return res.end();
          }
          res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok');
        });
        return;
      }
      let file = normalize(join(ROOT, path));
      if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      if (existsSync(file) && statSync(file).isDirectory()) {
        if (!path.endsWith('/')) { res.writeHead(301, { Location: path + '/' + url.search }); return res.end(); }
        file = join(file, 'index.html');
      }
      let status = 200;
      if (!existsSync(file)) { status = 404; file = join(ROOT, (rewrite404 || '/404.html').slice(1)); if (!existsSync(file)) { res.writeHead(404); return res.end('not found'); } }
      const headers = { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' };
      for (const rule of parseHeaders()) if (globToRe(rule.path).test(path)) for (const [k, v] of rule.headers) headers[k] = v;
      res.writeHead(status, headers); res.end(readFileSync(file));
    });
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const s = await start(parseInt(process.argv[2] || '8787'));
  console.log(`TerraTrade dev server → http://127.0.0.1:${s.address().port}/`);
}
