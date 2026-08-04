/* corners.js — scroll-scrubbed corner radius, page-wide.
 *
 * Any number of elements per page. The radius of each is its distance from the viewport edge,
 * capped at a max: flush with the top or bottom = square (full-bleed), far from it = full radius.
 * Top and bottom are independent, so a section can be square at the top and round at the bottom
 * mid-scroll.
 *
 * Authoring:
 *   <div data-corners>                          80px desktop, 2.5rem mobile (the defaults)
 *   <div data-corners="120">                    120px desktop, 2.5rem mobile
 *   <div data-corners="120" data-corners-mobile="1.5rem">
 *   <div data-corners="5rem" data-corners-mobile="24px">
 *   <div data-corners="80" data-corners-bp="767">   per-element breakpoint
 *
 * Values take px or rem; a bare number is px. rem resolves against the root font size at the time
 * it is read, so it follows the user's text scaling and any breakpoint that changes it.
 *
 * This is the same module that ships inside stack.js and flow-stack.js. Those copies read the same
 * attribute and compute the same result, so running alongside them is harmless — just redundant.
 * Load this one on pages where neither of those runs, or on all pages to keep the behaviour in one
 * place. It must load AFTER GSAP if GSAP is present; without GSAP it falls back to rAF.
 */
(function () {

  // ---- config ----
  var ATTR        = 'data-corners';
  var ATTR_MOBILE = 'data-corners-mobile';
  var ATTR_BP     = 'data-corners-bp';     // per-element override of MOBILE_BP

  var DEFAULT_MAX    = '80px';    // desktop, when the attribute has no value
  var DEFAULT_MOBILE = '2.5rem';  // at or below MOBILE_BP, when no mobile value is given
  var MOBILE_BP      = 991;       // px

  var SMOOTH  = 0.16;   // per-frame ease toward the target radius; higher = snappier
  var DEBUG   = false;

  var els = [];

  // px from "80" | "80px" | "2.5rem". rem is resolved live, so a root-size change is picked up
  // on the next read rather than being baked in at scan time.
  function toPx(raw, fallback) {
    if (raw == null || raw === '') { return fallback; }
    var n = parseFloat(raw);
    if (!isFinite(n) || n < 0) { return fallback; }
    if (/rem\s*$/i.test(raw)) {
      var root = parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
      return n * root;
    }
    return n;   // px, or a bare number
  }

  // the max radius for one element at the current viewport
  function maxFor(el) {
    var bp = parseFloat(el.getAttribute(ATTR_BP));
    if (!isFinite(bp)) { bp = MOBILE_BP; }
    var desktop = toPx(el.getAttribute(ATTR), toPx(DEFAULT_MAX, 80));
    if (window.innerWidth > bp) { return desktop; }
    // mobile: the element's own value, else the default — but never larger than its desktop max,
    // so a page-wide default cannot accidentally round a corner MORE on a small screen
    var mob = el.getAttribute(ATTR_MOBILE);
    return Math.min(desktop, toPx(mob != null ? mob : DEFAULT_MOBILE, desktop));
  }

  function scan() {
    var found = document.querySelectorAll('[' + ATTR + ']');
    for (var i = 0; i < found.length; i++) {
      var el = found[i], known = false;
      for (var j = 0; j < els.length; j++) { if (els[j].el === el) { known = true; break; } }
      if (!known) { els.push({ el: el, max: maxFor(el), t: -1, b: -1, wt: -1, wb: -1 }); }
    }
    if (DEBUG) { console.log('[corners] tracking', els.length, 'element(s)'); }
  }

  // re-resolve every max — after a breakpoint change, or when an attribute is rewritten
  function refresh() {
    for (var i = 0; i < els.length; i++) { els[i].max = maxFor(els[i].el); }
    if (DEBUG) {
      console.log('[corners] refresh @' + window.innerWidth + 'px:',
        els.map(function (s) { return Math.round(s.max); }).join(','));
    }
  }

  function frame(dt) {
    var vh = window.innerHeight;
    var k  = 1 - Math.pow(1 - SMOOTH, dt);
    for (var i = 0; i < els.length; i++) {
      var s = els[i];
      var r = s.el.getBoundingClientRect();
      if (!r.width && !r.height) { continue; }                 // display:none — nothing to paint
      var tT = Math.max(0, Math.min(s.max, r.top));
      var tB = Math.max(0, Math.min(s.max, vh - r.bottom));
      if (s.t < 0) { s.t = tT; s.b = tB; }                     // first frame: snap, do not ease in
      else {
        s.t += (tT - s.t) * k; if (Math.abs(tT - s.t) < 0.1) { s.t = tT; }
        s.b += (tB - s.b) * k; if (Math.abs(tB - s.b) < 0.1) { s.b = tB; }
      }
      if (s.t === s.wt && s.b === s.wb) { continue; }          // settled — skip the write
      s.wt = s.t; s.wb = s.b;
      s.el.style.setProperty('border-top-left-radius',     s.t + 'px', 'important');
      s.el.style.setProperty('border-top-right-radius',    s.t + 'px', 'important');
      s.el.style.setProperty('border-bottom-left-radius',  s.b + 'px', 'important');
      s.el.style.setProperty('border-bottom-right-radius', s.b + 'px', 'important');
    }
  }

  window.Corners = { scan: scan, refresh: refresh, standalone: true };

  function start() {
    scan();

    // width only: a phone fires resize continuously as the URL bar collapses, and that is a height
    // change — re-resolving on it would run every scroll frame for nothing
    var lastW = window.innerWidth, t = null;
    window.addEventListener('resize', function () {
      if (window.innerWidth === lastW) { return; }
      lastW = window.innerWidth;
      clearTimeout(t);
      t = setTimeout(refresh, 150);
    });

    // late DOM (CMS lists, tabs, modals) — pick up anything added after load
    if (window.MutationObserver) {
      var mo = new MutationObserver(function () { scan(); });
      mo.observe(document.body, { childList: true, subtree: true });
    }

    if (window.gsap) {
      gsap.ticker.add(function () {
        try { frame(gsap.ticker.deltaRatio()); } catch (e) { if (DEBUG) { console.error('[corners]', e); } }
      });
    } else {
      var last = performance.now();
      (function loop(now) {
        var dt = (now - last) / (1000 / 60); last = now;
        try { frame(dt); } catch (e) { if (DEBUG) { console.error('[corners]', e); } }
        requestAnimationFrame(loop);
      }(last));
    }
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', start); }
  else { start(); }

}());
