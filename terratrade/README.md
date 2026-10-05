# TerraTrade · website

**Bridging Nigerian agriculture with global markets.** Marketing site for TerraTrade, a Nigerian agri-commodity and charcoal exporter based in Kano (est. 2023), selling to the Middle East and Asia. It is bilingual: English at `/` and Arabic (RTL) at `/ar/`.

The design remixes the [portfolio](../_publish/index.html) design language (glass cards, mono eyebrows, gradient type, grain, blob field, and the motion system) into the TerraTrade brand: forest `#013D27`, logo green `#21401C`, leaf `#00AA01`, sprout `#54BA47`, mint `#E9FFE5` and harvest amber `#FFA612`.

## What's on the page

| Section | Built from |
|---|---|
| **Menu** | About us · Products · Operations · Contact us (header, mobile menu and footer), plus the language link, theme switch and "Request a quote" |
| **Hero** | Split-letter gradient headline, rotating commodity word, fact figures (founded 2023, 6 commodities, 5,000+ MT annual capacity, 8 export markets), a green chunky "Request a quote" ✦, and a liquid-glass bubble scene (farmer / sesame / hibiscus) with the commodity list orbiting the main bubble ✦ |
| **About us** | Scroll-lit paragraph, facts, mission and vision as zig-zag infographic banners ✦, then **Why TerraTrade** straight after: Farmers first, Effective partnerships, Deep local & global insight (client's final comments; core values removed) |
| **Products** | 6 commodities in 3 divisions, animal feed first (wheat bran; then sesame, raw cashew, hibiscus, soybean; then hardwood charcoal), with a filter and character-roll heading. Each card is a 3D flip card ✦: clicking (or tapping, or Enter) turns the photo over to "Request a quote" and "Spec sheet". The spec-sheet dialog shows indicative specs, harvest months and packaging, prints, and has "request a quote for this product" |
| **Operations** | Pinned Nigeria map story: outline draws, "Sourcing zone · Kano", the Lagos hub, cargo moving to the port, then out to export markets |
| **Process** | Scroll-driven CSS 3D cube: Source → Aggregate → Verify → Process → Pack → Ship |
| **Why TerraTrade** | Two strengths: effective partnerships, and local + Middle East / Asia market insight |
| **Markets** | The portfolio's dot globe, extended with animated great-circle export routes: Middle East (KSA, UAE, Qatar, Lebanon, Syria) in amber and Asia (Japan, South Korea, China) in green |
| **Partners** | Partner logo grid |
| **Contact us** | Quote form (Netlify Forms, AJAX with no-JS fallback) asking only for name, company, email and a message (no contact boxes beside it; client's final comments), with a chunky squircle submit ✦; WhatsApp, copy-email, and a draggable liquid-glass business card ✦ that starts centred on a high-resolution photo |
| **Site-wide** | System pointer and native scrolling on every device (the custom cursor ✦ and Lenis eased scrolling were retired for speed at the client's request), floating WhatsApp squircle ✦, light/dark themes. Built for smooth scrolling on mid-range laptops: the background glow, headline gradient and bubble shapes are still, cards have no live blur, and only small composited motion runs continuously. Motion follows the OS reduced-motion setting (the footer pause switch was removed at the client's request); the footer keeps only the privacy notice |

✦ = adapted from a CodePen (see [CodePen effects](#codepen-effects)).

## Layout

```
terratrade/
  netlify.toml         publish = "public", no build command
  public/              deployed as-is
    index.html         English source of truth (data-i18n keys, inline Nigeria map + logo mark)
    ar/…               GENERATED Arabic pages (do not edit by hand)
    thanks/ privacy/ 404.html  _headers _redirects robots.txt sitemap.xml llms.txt site.webmanifest
    assets/css/        fonts.css (generated) · base.css (tokens, themes, RTL) · site.css · pages.css · fx.css (CodePen adaptations)
    assets/js/         main.js · core/ (env, loop registry, i18n, theme) · ui/ · scenes/ (globe, nigeria-map, process-cube, flora)
                       fx/ (CodePen adaptations + registry.js) · i18n/en.js (runtime strings) · i18n/ar.js (all Arabic)
                       data.js (spec values) · geo/ (generated) · vendor/ (GSAP, Lenis)
    assets/img/        brand/ (logo SVGs, sprite, app icons) · products/ · photos/ · partners/ · icons.svg · og-en.jpg · og-ar.jpg
  dev/                 tooling + tests only; never deployed
    tools/             vendor, fonts, logo, icons, geo, images.py, og, render-ar, csp-hash, logo-check
    tests/             server.mjs (Netlify imitation), smoke.mjs (Playwright + axe matrix), shots.mjs / elshot.mjs (screenshots)
    pens/<id>/         the CodePen sources in use, as supplied (promo popups removed) + meta.json (title, author, URL)
```

There is no build step at deploy time. The files in `public/` that tools generate are committed. Rerun a tool only when its input changes.

## Run and test

```bash
cd terratrade/dev
npm install                       # dev tools only (Playwright, axe, linkedom, world-atlas, fontsource, gsap, lenis…)
npm run serve                     # http://127.0.0.1:8787, applies _headers/_redirects and accepts form posts
npm run ar && npm run csp         # after editing index.html, ar.js, or any page's inline <head> script
npm run origin -- https://host    # switch the public address in every absolute URL (see "Connect the domain")
npm test                          # i18n coverage + 16-run matrix: EN/AR × light/dark × desktop/phone × motion/reduced (incl. a check per CodePen effect)
node tests/shots.mjs --lang ar --theme dark --w 390   # per-section screenshots → dev/out/shots/
node tests/elshot.mjs --sel '[data-fx="flip"]' --margin 20   # one element → dev/out/el/
node tests/lighthouse.mjs                              # Lighthouse, EN/AR × mobile/desktop (the dev server compresses like Netlify)
```

If Playwright can't find a browser, set `PLAYWRIGHT_BROWSERS_PATH`.

Each tool regenerates one kind of asset:

| Tool | Regenerates |
|---|---|
| `node tools/vendor.mjs` | GSAP / Lenis |
| `node tools/fonts.mjs` then `python3 tools/subset_fonts.py` | Self-hosted fonts; the second step trims the Arabic faces to standard Arabic (173 KB → 58 KB, all shaping features kept; needs `fonttools` + `brotli`) |
| `node tools/geo.mjs` | Globe dots and the inline Nigeria map |
| `node tools/logo.mjs && node tools/logo-check.mjs` | Logo SVGs, checked against the original PNG |
| `node tools/icons.mjs` | Icon sprite and favicons |
| `python3 tools/images.py [name …]` | WebP sets (needs Pillow, plus the client originals in `dev/src-assets/`); names rebuild only those outputs, e.g. `charcoal contact`. Images are cached for a week, so a changed photo gets a new file name |
| `node tools/og.mjs` | Social preview images |

## Deploy on Netlify

1. **Create the site.** The Netlify project **`terratrade-global`** already exists (https://app.netlify.com/projects/terratrade-global), with Forms enabled. Link it to this repository under *Project configuration → Build & deploy → Link repository*, or add a new site from this repository. Set **Base directory** to `terratrade` and leave the build command empty; `terratrade/netlify.toml` sets `publish = "public"`. It is a separate site from the portfolio; the portfolio's edge "gate" and analytics functions don't apply here.
2. **Turn on forms.** Go to **Forms** and enable form detection, then trigger **Deploys → Trigger deploy → Deploy site**. The `rfq` form is detected from the static HTML. The `ignore` rule in `netlify.toml` never skips a same-commit redeploy.
3. **Set up notifications.** Go to Forms → Notifications and add email notifications to **info@terratrade.global**.
4. **Connect the domain.** Add `terratrade.global` under Domain management. If the domain already has email, only add the web records (A/ALIAS for the apex, CNAME for `www`) and leave the MX/SPF/DKIM records untouched. Then switch the site's public address to the domain: `cd dev && npm run origin -- https://terratrade.global`, commit and push. Until that switch, every absolute URL (canonical, hreflang, link-preview image, sitemap, JSON-LD) uses `https://terratrade-global.netlify.app`: link previews in WhatsApp and elsewhere only show the image when it is on the host that actually serves the site (today terratrade.global points somewhere else).

## Content to confirm with TerraTrade before launch

- [ ] **Spec values and harvest months** in `public/assets/js/data.js`. They are industry-typical ranges, labelled "indicative" on the page (charcoal: fixed carbon, ash, volatiles, lump size, calorific value, packaging).
- [ ] **Partner wording and logos.** The deck says "Our partnerships"; confirm each company agrees to be listed, and supply official SVG logos.
- [ ] **Photos.**
  - The in-shell cashew, charcoal and contact-card photos are the examples from the revision notes, upscaled 4× with Real-ESRGAN (stock-photo sites are not reachable from the build environment). Original high-resolution files, if TerraTrade has them, would be better still.
  - Confirm the photo licences cover web use.
- [ ] **Registration details.** CAC / NEPC registration numbers and the full Kano address.
- [ ] **Messaging apps.** Is +234 803 444 5888 on WhatsApp? Any WeChat, LINE or KakaoTalk account? WhatsApp is blocked in China.
- [ ] **Arabic.** Native-speaker review of `public/assets/js/i18n/ar.js`, and the Arabic brand name (currently «تيرا تريد»).
- [ ] **Markets.** Confirm that listing Syria and Lebanon as active markets is intended.
- [ ] **Privacy notice.** Legal review of `/privacy/`.

## CodePen effects

Each pen is kept as supplied in `dev/pens/<id>/`, adapted to the brand, fonts, i18n, RTL, themes and motion rules, and credited in its code header and in `public/credits.txt`. CSS lives in `assets/css/fx.css` under `[data-fx="…"]`; JS modules are in `assets/js/fx/`, loaded on demand by `fx/registry.js`. All JS runs on the shared loop registry, so it pauses off-screen and under reduced motion.

| Pen | Where | Notes |
|---|---|---|
| [designfenix/QwdoddG](https://codepen.io/designfenix/pen/QwdoddG) — Marquee Glass Bubble | Hero visual | The pen's SVG scene (generated from its markup) with TerraTrade photos. The ripple/displacement filters are removed so faces stay sharp. For speed the bubble shapes are held still and the scene is split into stacked layers, so only the orbiting text redraws. The orbit text is translatable (EN/AR) and frozen off-screen and under reduced motion. Pointer parallax on fine pointers moves whole layers (no repaint). |
| [designfenix/RwKPapa](https://codepen.io/designfenix/pen/RwKPapa) — 3D perspective cards | Product cards | Turns over only when clicked, tapped or activated from the keyboard (never on hover), mirrored in Arabic; the hidden face is invisible and inert, so nothing shows through. Escape, a "back to the photo" button or a click elsewhere turns it back. The quote link records the product and starts the message (`source=card:<id>`). |
| [thebabydino/NLWdwz](https://codepen.io/thebabydino/pen/NLWdwz) — infographic banners | About: mission, vision | Brand gradients with contrast-checked ink. Zig-zag on wide screens, stacked on phones. |
| [Andrew-Fisher/raMZQNe](https://codepen.io/Andrew-Fisher-the-decoder/pen/raMZQNe) — Chunky 3D Buttons | Hero quote, form submit, floating WhatsApp | The SVG squircle is an aria-hidden layer behind the real button, so the label stays live text. The floating button hides over the hero, contact and footer. |
| [Abdughafur-Khujzoda/jEyVvqK](https://codepen.io/Abdughafur-Khujzoda/pen/jEyVvqK) — liquid-glass card | Contact photo | Starts centred on the photo, draggable (kept inside it). Only on screens ≥ 961px, where the photo shows. |
| [Andrew-Fisher/GgraMzd](https://codepen.io/Andrew-Fisher-the-decoder/pen/GgraMzd) — pure-CSS cursor tracking | Site cursor | Pointer events drive the motion (the pen's CSS hover grid would block clicks): the seed follows the pointer with a short exponential ease (about 30 ms) and tilts with its speed, then stops its loop once settled. The visual is a small seed made of the logo's petals that opens into a ring over clickable things (the blurred lens was too heavy). Fine pointers only. |

## Credits

See `public/credits.txt`.
