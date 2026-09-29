# TerraTrade · website

**Bridging Nigerian agriculture with global markets.** Marketing site for TerraTrade, a Nigerian agri-commodity exporter based in Kano (est. 2023). It is bilingual: English at `/` and Arabic (RTL) at `/ar/`.

The design remixes the [portfolio](../_publish/index.html) design language (glass cards, mono eyebrows, gradient type, grain, blob field, and the motion system) into the TerraTrade brand: forest `#013D27`, logo green `#21401C`, leaf `#00AA01`, sprout `#54BA47`, mint `#E9FFE5` and harvest amber `#FFA612`.

## What's on the page

| Section | Built from |
|---|---|
| **Hero** | Split-letter gradient headline, gooey rotating commodity word, logo "petal bloom", pollen particles, fact counters |
| **Products** | 8 commodities split into 2 divisions, with a filter and character-roll heading. Each card has a spinning conic border and tilt, and opens a spec-sheet dialog (indicative specs, harvest months, packaging, print, "request a quote for this product") |
| **About** | Scroll-lit paragraph, facts, Mission/Vision banners and the three core values, manifesto scroll-fill |
| **Operations** | Pinned Nigeria map story: outline draws, Kano sourcing zone, Lagos and Port Harcourt hubs, cargo moving to the ports, then out to export markets |
| **Process** | Scroll-driven CSS 3D cube: Source → Aggregate → Verify → Process → Pack → Ship |
| **Why TerraTrade** | Three strengths, plus Farmer First "growing stem" |
| **Markets** | The portfolio's dot globe, extended with animated great-circle trade routes. Active markets (KSA, UAE, Qatar, Lebanon, Syria) are solid amber; opening markets (Japan, South Korea, China) are dashed green |
| **Partners** | Partner logo grid |
| **How we trade** | Terms, packaging, documents, samples |
| **Contact** | Quote form (Netlify Forms, AJAX with no-JS fallback), WhatsApp, copy-email |

## Layout

```
terratrade/
  netlify.toml         publish = "public", no build command
  public/              deployed as-is
    index.html         English source of truth (data-i18n keys, inline Nigeria map + logo mark)
    ar/…               GENERATED Arabic pages (do not edit by hand)
    thanks/ privacy/ 404.html  _headers _redirects robots.txt sitemap.xml llms.txt site.webmanifest
    assets/css/        fonts.css (generated) · base.css (tokens, themes, RTL) · site.css · pages.css · fx.css (CodePen adaptations)
    assets/js/         main.js · core/ (env, loop registry, i18n, theme) · ui/ · scenes/ (globe, nigeria-map, process-cube, ambient)
                       i18n/en.js (runtime strings) · i18n/ar.js (all Arabic) · data.js (spec values) · geo/ (generated) · vendor/ (GSAP, Lenis)
    assets/img/        brand/ (logo SVGs, sprite, app icons) · products/ · photos/ · partners/ · icons.svg · og-en.jpg · og-ar.jpg
  dev/                 tooling + tests only; never deployed
    tools/             vendor, fonts, logo, icons, geo, images.py, og, render-ar, csp-hash, logo-check
    tests/             server.mjs (Netlify imitation), smoke.mjs (Playwright + axe matrix), shots.mjs (screenshots)
```

There is no build step at deploy time. The files in `public/` that tools generate are committed. Rerun a tool only when its input changes.

## Run and test

```bash
cd terratrade/dev
npm install                       # dev tools only (Playwright, axe, linkedom, world-atlas, fontsource, gsap, lenis…)
npm run serve                     # http://127.0.0.1:8787, applies _headers/_redirects and accepts form posts
npm run ar && npm run csp         # after editing index.html, ar.js, or any page's inline <head> script
npm test                          # i18n coverage + 16-run matrix: EN/AR × light/dark × desktop/phone × motion/reduced
node tests/shots.mjs --lang ar --theme dark --w 390   # per-section screenshots → dev/out/shots/
```

If Playwright can't find a browser, set `PLAYWRIGHT_BROWSERS_PATH`.

Each tool regenerates one kind of asset:

| Tool | Regenerates |
|---|---|
| `node tools/vendor.mjs` | GSAP / Lenis |
| `node tools/fonts.mjs` | Self-hosted fonts |
| `node tools/geo.mjs` | Globe dots and the inline Nigeria map |
| `node tools/logo.mjs && node tools/logo-check.mjs` | Logo SVGs, checked against the original PNG |
| `node tools/icons.mjs` | Icon sprite and favicons |
| `python3 tools/images.py` | WebP sets (needs Pillow, plus the client originals in `dev/src-assets/`) |
| `node tools/og.mjs` | Social preview images |

## Deploy on Netlify

1. **Create the site.** Add a new site from this repository. Set **Base directory** to `terratrade` and leave the build command empty; `terratrade/netlify.toml` sets `publish = "public"`. It is a separate site from the portfolio; the portfolio's edge "gate" and analytics functions don't apply here.
2. **Turn on forms.** Go to **Forms** and enable form detection, then trigger **Deploys → Trigger deploy → Deploy site**. The `rfq` form is detected from the static HTML. The `ignore` rule in `netlify.toml` never skips a same-commit redeploy.
3. **Set up notifications.** Go to Forms → Notifications and add email notifications to **info@terratrade.global**.
4. **Connect the domain.** Add `terratrade.global` under Domain management. If the domain already has email, only add the web records (A/ALIAS for the apex, CNAME for `www`) and leave the MX/SPF/DKIM records untouched.

## Content to confirm with TerraTrade before launch

- [ ] **Spec values and harvest months** in `public/assets/js/data.js`. They are industry-typical ranges, labelled "indicative" on the page.
- [ ] **Trade terms.** Incoterms, packaging (25/50 kg PP bags, jumbo bags, 80 kg jute for cashew), export documents list, samples policy.
- [ ] **Partner wording and logos.** The deck says "Our partnerships"; confirm each company agrees to be listed, and supply official SVG logos.
- [ ] **Photos.**
  - The deck's "raw cashew" photo shows **shelled kernels**, not in-shell raw cashew nuts; please supply a correct photo.
  - **Ginger:** confirm the export form (e.g. dried split) and supply a matching photo. The deck photo shows fresh root, so the copy currently says just "Nigerian ginger".
  - Confirm the stock-photo licences cover web use.
- [ ] **Registration details.** CAC / NEPC registration numbers and the full Kano address.
- [ ] **Messaging apps.** Is +234 803 444 5888 on WhatsApp? Any WeChat, LINE or KakaoTalk account? WhatsApp is blocked in China.
- [ ] **Arabic.** Native-speaker review of `public/assets/js/i18n/ar.js`, and the Arabic brand name (currently «تيرا تريد»).
- [ ] **Markets.** Confirm that listing Syria and Lebanon as active markets is intended.
- [ ] **Privacy notice.** Legal review of `/privacy/`.

## Credits

See `public/credits.txt`.
