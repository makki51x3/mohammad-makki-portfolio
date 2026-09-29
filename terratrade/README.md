# TerraTrade · website

**Bridging Nigerian agriculture with global markets.** Marketing site for TerraTrade, a Nigerian agri-commodity exporter based in Kano (est. 2023). It is bilingual: English at `/` and Arabic (RTL) at `/ar/`.

The design remixes the [portfolio](../_publish/index.html) design language (glass cards, mono eyebrows, gradient type, grain, blob field, and the motion system) into the TerraTrade brand: forest `#013D27`, logo green `#21401C`, leaf `#00AA01`, sprout `#54BA47`, mint `#E9FFE5` and harvest amber `#FFA612`.

## What's on the page

| Section | Built from |
|---|---|
| **Hero** | Split-letter gradient headline, gooey rotating commodity word, fact counters, and a liquid-glass bubble scene (farmer / sesame / hibiscus) with the commodity list orbiting the main bubble ✦ |
| **Products** | 8 commodities split into 2 divisions, with a filter and character-roll heading. Each card is a 3D flip card ✦: the framed photo turns to reveal "Request a quote" and "Spec sheet". The spec-sheet dialog shows indicative specs, harvest months and packaging, prints, and has "request a quote for this product" |
| **About** | Scroll-lit paragraph, facts, mission / vision / three core values as zig-zag infographic banners ✦, manifesto scroll-fill |
| **Operations** | Pinned Nigeria map story: outline draws, Kano sourcing zone, Lagos and Port Harcourt hubs, cargo moving to the ports, then out to export markets |
| **Process** | Scroll-driven CSS 3D cube: Source → Aggregate → Verify → Process → Pack → Ship |
| **Why TerraTrade** | Three strengths, plus Farmer First "growing stem" |
| **Markets** | The portfolio's dot globe, extended with animated great-circle trade routes. Active markets (KSA, UAE, Qatar, Lebanon, Syria) are solid amber; opening markets (Japan, South Korea, China) are dashed green |
| **Partners** | Partner logo grid |
| **Site-wide** | Cursor lens ✦ (fine pointers), floating WhatsApp squircle ✦, pause-animations switch, light/dark themes |
| **How we trade** | Terms, packaging, documents, samples, plus an interactive WebGL harbour-water panel ✦ with the mark on the seabed |
| **Contact** | Quote form (Netlify Forms, AJAX with no-JS fallback) with a chunky squircle submit ✦, WhatsApp, copy-email, and a draggable liquid-glass business card on the photo ✦ |

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
    assets/js/         main.js · core/ (env, loop registry, i18n, theme) · ui/ · scenes/ (globe, nigeria-map, process-cube, ambient)
                       fx/ (CodePen adaptations + registry.js) · i18n/en.js (runtime strings) · i18n/ar.js (all Arabic)
                       data.js (spec values) · geo/ (generated) · vendor/ (GSAP, Lenis, three.js subset)
    assets/img/        brand/ (logo SVGs, sprite, app icons) · products/ · photos/ · partners/ · icons.svg · og-en.jpg · og-ar.jpg
  dev/                 tooling + tests only; never deployed
    tools/             vendor, fonts, logo, icons, geo, images.py, og, render-ar, csp-hash, logo-check
    tests/             server.mjs (Netlify imitation), smoke.mjs (Playwright + axe matrix), shots.mjs / elshot.mjs (screenshots)
    pens/<id>/         the seven CodePen sources as supplied (promo popups removed) + meta.json (title, author, URL)
```

There is no build step at deploy time. The files in `public/` that tools generate are committed. Rerun a tool only when its input changes.

## Run and test

```bash
cd terratrade/dev
npm install                       # dev tools only (Playwright, axe, linkedom, world-atlas, fontsource, gsap, lenis…)
npm run serve                     # http://127.0.0.1:8787, applies _headers/_redirects and accepts form posts
npm run ar && npm run csp         # after editing index.html, ar.js, or any page's inline <head> script
npm test                          # i18n coverage + 16-run matrix: EN/AR × light/dark × desktop/phone × motion/reduced (incl. a check per CodePen effect)
node tests/shots.mjs --lang ar --theme dark --w 390   # per-section screenshots → dev/out/shots/
node tests/elshot.mjs --sel '[data-fx="flip"]' --hover '.pcard' --margin 20   # one element → dev/out/el/
```

If Playwright can't find a browser, set `PLAYWRIGHT_BROWSERS_PATH`.

Each tool regenerates one kind of asset:

| Tool | Regenerates |
|---|---|
| `node tools/vendor.mjs` | GSAP / Lenis, and the tree-shaken three.js subset (`tools/three-entry.mjs`, bundled with esbuild) |
| `node tools/fonts.mjs` | Self-hosted fonts |
| `node tools/geo.mjs` | Globe dots and the inline Nigeria map |
| `node tools/logo.mjs && node tools/logo-check.mjs` | Logo SVGs, checked against the original PNG |
| `node tools/icons.mjs` | Icon sprite and favicons |
| `python3 tools/images.py` | WebP sets (needs Pillow, plus the client originals in `dev/src-assets/`) |
| `node tools/og.mjs` | Social preview images |

## Deploy on Netlify

1. **Create the site.** The Netlify project **`terratrade-global`** already exists (https://app.netlify.com/projects/terratrade-global), with Forms enabled. Link it to this repository under *Project configuration → Build & deploy → Link repository*, or add a new site from this repository. Set **Base directory** to `terratrade` and leave the build command empty; `terratrade/netlify.toml` sets `publish = "public"`. It is a separate site from the portfolio; the portfolio's edge "gate" and analytics functions don't apply here.
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

## CodePen effects

Each pen is kept as supplied in `dev/pens/<id>/`, adapted to the brand, fonts, i18n, RTL, themes and motion rules, and credited in its code header and in `public/credits.txt`. CSS lives in `assets/css/fx.css` under `[data-fx="…"]`; JS modules are in `assets/js/fx/`, loaded on demand by `fx/registry.js`. All JS runs on the shared loop registry, so it pauses off-screen, with the pause switch, and under reduced motion.

| Pen | Where | Notes |
|---|---|---|
| [designfenix/QwdoddG](https://codepen.io/designfenix/pen/QwdoddG) — Marquee Glass Bubble | Hero visual | The pen's SVG scene (generated from its markup) with TerraTrade photos. The orbit text is translatable (EN/AR). SMIL is frozen off-screen, when paused and under reduced motion. Pointer parallax on fine pointers. |
| [designfenix/RwKPapa](https://codepen.io/designfenix/pen/RwKPapa) — 3D perspective cards | Product cards | Flips on hover or keyboard focus, mirrored in Arabic. Touch gets front and back stacked. The quote link prefills the form (`source=card:<id>`). |
| [thebabydino/NLWdwz](https://codepen.io/thebabydino/pen/NLWdwz) — infographic banners | About: mission, vision, values | Brand gradients with contrast-checked ink. Zig-zag on wide screens, stacked on phones. |
| [Andrew-Fisher/raMZQNe](https://codepen.io/Andrew-Fisher-the-decoder/pen/raMZQNe) — Chunky 3D Buttons | Hero quote, form submit, floating WhatsApp | The SVG squircle is an aria-hidden layer behind the real button, so the label stays live text. The floating button hides over the hero, contact and footer. |
| [Abdughafur-Khujzoda/jEyVvqK](https://codepen.io/Abdughafur-Khujzoda/pen/jEyVvqK) — liquid-glass card | Contact photo | Draggable (kept inside the photo). Only on screens ≥ 961px, where the photo shows. |
| [Andrew-Fisher/GgraMzd](https://codepen.io/Andrew-Fisher-the-decoder/pen/GgraMzd) — pure-CSS cursor tracking | Site cursor | The pen's speed bands drive a JS servo (a CSS hover grid would block clicks). Fine pointers only; the text under the pointer stays sharp. |
| [tmpl/YPZQxeN](https://codepen.io/tmpl/pen/YPZQxeN) — Interactive Pool Water | How we trade | three.js subset (~125 KB gzipped), loaded only on screens ≥ 961px with motion allowed. Sand seabed with the mark, quay walls. Anything else shows a still CSS panel. |

## Credits

See `public/credits.txt`.
