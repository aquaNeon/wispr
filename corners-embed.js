/* corners-embed.js — paste inside a Webflow embed. Safe on ANY page.
 *
 * Two jobs, and it decides which to do at window.load, once every other script has registered:
 *
 *   1. ALWAYS: keep each [data-corners] element's attribute set to the right px value for the
 *      current breakpoint. stack.js and flow-stack.js re-read that attribute every frame, so this
 *      alone makes their corner behaviour responsive — no second loop, nothing to fight over.
 *
 *   2. ONLY IF nothing else is driving corners: run the animation loop itself, so a page with
 *      neither stack.js nor flow-stack.js still gets scrubbed corners.
 *
 * Deciding at window.load rather than immediately is what makes load order irrelevant: whether the
 * embed runs before or after the other scripts, by load time window.Corners either exists or does
 * not, and the answer is the same either way.
 *
 * Authoring is the same as corners.js:
 *   <div data-corners>                                80px desktop, 2.5rem mobile
 *   <div data-corners="120">                          120px desktop, 2.5rem mobile
 *   <div data-corners="120" data-corners-mobile="1.5rem">
 *   <div data-corners="80" data-corners-bp="767">
 */
(function () {

  var ATTR        = 'data-corners';
  var ATTR_MOBILE = 'data-corners-mobile';
  var ATTR_BP     = 'data-corners-bp';
  var ATTR_BASE   = 'data-corners-base';   // written once: the authored desktop value, kept so the
                                           // responsive rewrite never reads its own output

  var DEFAULT_MAX    = '80px';
  var DEFAULT_MOBILE = '2.5rem';
  var MOBILE_BP      = 991;
  var SMOOTH         = 0.16;
  var DEBUG          = false;

  var els = [];
  var owning = false;   // are we the one animating, or just setting attributes?

  function toPx(raw, fallback) {
    if (raw == null || raw === '') { return fallback; }
    var n = parseFloat(raw);
    if (!isFinite(n) || n < 0) { return fallback; }
    if (/rem\s*$/i.test(raw)) {
      var root = parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
      return n * root;
    }
    return n;
  }

  function maxFor(el) {
    // the authored value is stashed on first sight; without it the rewrite below would re-read the
    // px number it wrote last time and the desktop value would be lost after one mobile pass
    if (!el.hasAttribute(ATTR_BASE)) {
      el.setAttribute(ATTR_BASE, el.getAttribute(ATTR) || '');
    }
    var bp = parseFloat(el.getAttribute(ATTR_BP));
    if (!isFinite(bp)) { bp = MOBILE_BP; }
    var desktop = toPx(el.getAttribute(ATTR_BASE), toPx(DEFAULT_MAX, 80));
    if (window.innerWidth > bp) { return desktop; }
    var mob = el.getAttribute(ATTR_MOBILE);
    return Math.min(desktop, toPx(mob != null ? mob : DEFAULT_MOBILE, desktop));
  }

  // job 1 — the attribute. whoever is animating reads this live.
  function apply() {
    var found = document.querySelectorAll('[' + ATTR + ']');
    for (var i = 0; i < found.length; i++) {
      var el = found[i], px = Math.round(maxFor(el));
      if (el.getAttribute(ATTR) !== String(px)) { el.setAttribute(ATTR, String(px)); }
      if (owning) {
        var known = false;
        for (var j = 0; j < els.length; j++) { if (els[j].el === el) { known = true; break; } }
        if (!known) { els.push({ el: el, max: px, t: -1, b: -1, wt: -1, wb: -1 }); }
      }
    }
    for (var k = 0; k < els.length; k++) { els[k].max = Math.round(maxFor(els[k].el)); }
    if (window.Corners && window.Corners.scan) { window.Corners.scan(); }   // let them pick up new nodes
  }

  // job 2 — the loop, only when nobody else is running one
  function frame(dt) {
    var vh = window.innerHeight;
    var k  = 1 - Math.pow(1 - SMOOTH, dt);
    for (var i = 0; i < els.length; i++) {
      var s = els[i];
      var r = s.el.getBoundingClientRect();
      if (!r.width && !r.height) { continue; }
      var tT = Math.max(0, Math.min(s.max, r.top));
      var tB = Math.max(0, Math.min(s.max, vh - r.bottom));
      if (s.t < 0) { s.t = tT; s.b = tB; }
      else {
        s.t += (tT - s.t) * k; if (Math.abs(tT - s.t) < 0.1) { s.t = tT; }
        s.b += (tB - s.b) * k; if (Math.abs(tB - s.b) < 0.1) { s.b = tB; }
      }
      if (s.t === s.wt && s.b === s.wb) { continue; }
      s.wt = s.t; s.wb = s.b;
      s.el.style.setProperty('border-top-left-radius',     s.t + 'px', 'important');
      s.el.style.setProperty('border-top-right-radius',    s.t + 'px', 'important');
      s.el.style.setProperty('border-bottom-left-radius',  s.b + 'px', 'important');
      s.el.style.setProperty('border-bottom-right-radius', s.b + 'px', 'important');
    }
  }

  function start() {
    owning = !window.Corners;   // nobody else registered by now, so it is on us
    apply();
    if (DEBUG) {
      console.log('[corners-embed] ' + (owning ? 'animating' : 'attributes only (another module is running)'));
    }

    var lastW = window.innerWidth, t = null;
    window.addEventListener('resize', function () {
      if (window.innerWidth === lastW) { return; }   // width only: phones fire this on URL-bar collapse
      lastW = window.innerWidth;
      clearTimeout(t);
      t = setTimeout(apply, 150);
    });

    if (window.MutationObserver) {
      new MutationObserver(function () { apply(); })
        .observe(document.body, { childList: true, subtree: true });
    }

    if (!owning) { return; }

    if (window.gsap) {
      gsap.ticker.add(function () {
        try { frame(gsap.ticker.deltaRatio()); } catch (e) { if (DEBUG) { console.error('[corners-embed]', e); } }
      });
    } else {
      var last = performance.now();
      (function loop(now) {
        var dt = (now - last) / (1000 / 60); last = now;
        try { frame(dt); } catch (e) { if (DEBUG) { console.error('[corners-embed]', e); } }
        requestAnimationFrame(loop);
      }(last));
    }
  }

  // window.load, not DOMContentLoaded: the decision needs every other script to have registered
  if (document.readyState === 'complete') { start(); }
  else { window.addEventListener('load', start); }

}());
