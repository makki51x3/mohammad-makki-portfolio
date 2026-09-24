/*
 * analytics.js — visitor tracking beacon for the portfolio.
 * Served at /analytics.js; posts to the /api/collect Netlify Function.
 *
 * Sends a pageview on load, and an event whenever a project/brand/lab card is
 * clicked, so /admin can show which work actually draws interest.
 */
(function () {
  var COLLECT_URL = "/api/collect";

  function qp(name) {
    try { return new URLSearchParams(location.search).get(name) || ""; }
    catch (e) { return ""; }
  }

  function send(data) {
    // Preferred: sendBeacon — non-blocking, survives navigation (e.g. a brand
    // card that opens an external storefront).
    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([JSON.stringify(data)], { type: "application/json" });
        if (navigator.sendBeacon(COLLECT_URL, blob)) return;
      }
    } catch (e) {}
    // Fallback: image beacon with query params.
    try {
      var q = Object.keys(data).map(function (k) {
        return encodeURIComponent(k) + "=" + encodeURIComponent(data[k]);
      }).join("&");
      new Image().src = COLLECT_URL + "?" + q + "&cb=" + Date.now();
    } catch (e) {}
  }

  // --- Page view ---
  send({
    u: location.href,
    r: document.referrer || "",
    utm_source: qp("utm_source"),
    utm_medium: qp("utm_medium"),
    utm_campaign: qp("utm_campaign"),
    s: (window.screen ? screen.width + "x" + screen.height : "")
  });

  // --- Card click events ---
  // Each entry maps a clickable card in the live site to the element holding
  // its human-readable name. Cards are rendered by JS at runtime, so we match
  // on class rather than requiring data attributes in the source.
  var TARGETS = [
    { sel: ".pc-item",   name: ".pc-title", kind: "work" },       // Selected work deck
    { sel: ".cfront",    name: "h3",        kind: "lab" },        // Lab & experiments
    { sel: ".brandcard", name: "h4",        kind: "storefront" }, // Storefronts & brands
    { sel: ".gentile",   name: ".gcap b",   kind: "genai" },      // Generative studio
    { sel: ".cfcard",    name: ".cflab",    kind: "rnd" },        // R&D cover-flow
    // Only the "More public builds" grid — NOT the toolbox cards in #stack,
    // which share the .mcard class but are skill categories, not projects.
    { sel: "#moregrid .mcard", name: "h4",  kind: "more" },
    { sel: "[data-project-id]", name: null, kind: "work" }        // explicit opt-in
  ];

  function labelFor(el, t) {
    var explicit = el.getAttribute("data-project-title") || el.getAttribute("data-project-id");
    if (explicit) return explicit;
    var n = t.name ? el.querySelector(t.name) : null;
    var txt = n ? n.textContent : el.textContent;
    // .mcard titles embed a year chip (<h4>Title<span class="yr">2026</span></h4>);
    // strip it so "ACES · tutoring agency" doesn't become "…agencyco-founder".
    if (n) {
      var yr = n.querySelector(".yr");
      if (yr) txt = txt.replace(yr.textContent, "");
    }
    return (txt || "").replace(/\s+/g, " ").trim().slice(0, 120);
  }

  // Capture phase so the beacon is queued even when the click navigates away.
  // Listen for both `click` (primary button, incl. Ctrl/Cmd-click) and
  // `auxclick` (middle-click "open in background tab") — the latter is a strong
  // interest signal that never fires a `click`. (Right-click → "Open link in
  // new tab" fires neither: inherently untrackable.)
  //
  // De-dupe is per-label, not global: one gesture on a card can emit both a
  // click and an auxclick, but two DIFFERENT cards clicked in quick succession
  // are two real signals and must both count.
  var lastLabel = "", lastAt = 0;
  function onCardClick(ev) {
    if (!ev.target || !ev.target.closest) return;
    for (var i = 0; i < TARGETS.length; i++) {
      var t = TARGETS[i];
      var el = ev.target.closest(t.sel);
      if (!el) continue;
      var label = labelFor(el, t);
      if (!label) return;
      var now = Date.now();
      if (label === lastLabel && now - lastAt < 400) return; // paired click+auxclick
      lastLabel = label;
      lastAt = now;
      send({ t: "event", e: "project_click", l: label, u: location.href });
      return;
    }
  }
  document.addEventListener("click", onCardClick, true);
  document.addEventListener("auxclick", onCardClick, true);
})();
