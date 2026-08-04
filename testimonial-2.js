(function () {

  var ATTR    = 'data-slider';
  var A_WRAP  = 'wrap';
  var A_TRACK = 'track';
  var A_CARD  = 'card';

  var GAP_PCT        = 14;
  var GAP_GROW_PCT   = 0;
  var GAP_FROM_PX    = 1920;
  var GAP_PCT_MOBILE = 22;
  var GAP_MIN_PX     = 32;
  var GAP_MAX_PX     = 160;
  var GAP_PER_PAIR   = false;
  var SPACING_MODE   = 'pitch';
  var EXIT_PAD_PCT   = 12;
  var SCROLL_RATIO   = 0.85;

  var ORBIT_CARD_PCT = 65;
  var ORBIT_MIN_PX   = 220;
  var PERSP_CARD_PCT = 260;
  var ROT_IN         = -50;
  var ROT_OUT        = 50;
  var ROT_EASE       = 'power1.inOut';
  var ROT_SPAN_PCT   = 210;

  var DECK_SCALE_GROW = 0.55;
  var DECK_FROM_PX    = 1920;
  var DECK_SCALE_MAX  = 2;

  var CENTER_VH        = 50;
  var CENTER_VH_MOBILE = 50;
  var MIN_W            = 768;
  var SCRUB            = 1.5;
  var SCRUB_MOBILE     = true;
  var LEAD_TRIM        = true;

  function sel(name) { return '[' + ATTR + '="' + name + '"]'; }

  function attr(el, name) {
    var host = el.closest('[' + name + ']');
    if (!host) { return null; }
    var v = parseFloat(host.getAttribute(name));
    return isNaN(v) ? null : v;
  }

  function init() {
    if (typeof window.gsap === 'undefined' || typeof window.ScrollTrigger === 'undefined') {
      console.warn('[testimonial-2] GSAP + ScrollTrigger required before this script.');
      return;
    }
    gsap.registerPlugin(ScrollTrigger);

    if (ScrollTrigger.config) { ScrollTrigger.config({ ignoreMobileResize: true }); }
    if (ScrollTrigger.isTouch && !ScrollTrigger.__wsNormalized) {
      ScrollTrigger.__wsNormalized = true;
      ScrollTrigger.normalizeScroll(true);
    }

    if (!ScrollTrigger.__refreshGuarded) {
      ScrollTrigger.__refreshGuarded = true;
      var origRefresh = ScrollTrigger.refresh.bind(ScrollTrigger);
      var IDLE = 400, lastScroll = 0, timer = null, lastDocH = -1, lastVW = -1;
      var changed = function () { return document.documentElement.scrollHeight !== lastDocH || window.innerWidth !== lastVW; };
      var stamp   = function () { lastDocH = document.documentElement.scrollHeight; lastVW = window.innerWidth; };
      window.addEventListener('scroll', function () { lastScroll = Date.now(); }, { passive: true });
      var settle = function () {
        var wait = IDLE - (Date.now() - lastScroll);
        if (wait > 0) { timer = setTimeout(settle, wait); return; }
        timer = null;
        if (changed()) { stamp(); origRefresh(); }
      };
      ScrollTrigger.refresh = function () {
        if (Date.now() - lastScroll < IDLE) { if (!timer) { timer = setTimeout(settle, IDLE); } return; }
        stamp();
        return origRefresh.apply(ScrollTrigger, arguments);
      };
    }

    var wrap  = document.querySelector(sel(A_WRAP));
    var track = wrap && wrap.querySelector(sel(A_TRACK));
    if (!wrap || !track) {
      console.warn('[testimonial-2] need ' + sel(A_WRAP) + ' with a ' + sel(A_TRACK) + ' inside');
      return;
    }
    var cards = Array.prototype.slice.call(track.querySelectorAll(sel(A_CARD)));
    if (!cards.length) {
      console.warn('[testimonial-2] no ' + sel(A_CARD) + ' inside ' + sel(A_TRACK));
      return;
    }

    var scrollTween = null;

    function destroy() {
      if (scrollTween) {
        if (scrollTween.scrollTrigger) { scrollTween.scrollTrigger.kill(true); }
        scrollTween.kill();
        scrollTween = null;
      }
    }

    function build() {
      destroy();

      var vw       = window.innerWidth;
      var mobile   = vw < MIN_W;
      var scrubVal = mobile ? SCRUB_MOBILE : SCRUB;
      var gapPct   = attr(wrap, mobile ? 'data-gap-mobile' : 'data-gap');
      if (gapPct == null) { gapPct = mobile ? GAP_PCT_MOBILE : GAP_PCT; }
      var gapGrow  = attr(wrap, 'data-gap-grow');
      if (gapGrow == null) { gapGrow = GAP_GROW_PCT; }
      var centerVh = attr(wrap, mobile ? 'data-center-mobile' : 'data-center');
      if (centerVh == null) { centerVh = mobile ? CENTER_VH_MOBILE : CENTER_VH; }
      var scrollRatio = attr(wrap, 'data-scroll-ratio');
      if (scrollRatio == null) { scrollRatio = SCROLL_RATIO; }
      var orbitPct = attr(wrap, 'data-orbit');
      if (orbitPct == null) { orbitPct = ORBIT_CARD_PCT; }
      var modeHost = wrap.closest('[data-spacing]');
      var mode     = modeHost ? modeHost.getAttribute('data-spacing') : SPACING_MODE;

      track.style.height   = '100vh';
      track.style.overflow = 'hidden';
      track.style.position = 'relative';
      track.style.padding  = '0';

      cards.forEach(function (card) {
        card.style.position           = 'absolute';
        card.style.left               = '50%';
        card.style.top                = centerVh + 'vh';
        card.style.transformStyle     = 'preserve-3d';
        card.style.backfaceVisibility = 'hidden';
        card.style.willChange         = 'transform';
        card.style.margin             = '0';
      });

      var scaleGrow = attr(wrap, 'data-deck-grow');
      if (scaleGrow == null) { scaleGrow = DECK_SCALE_GROW; }
      var deckScale = mobile ? 1 : Math.min(DECK_SCALE_MAX,
        Math.max(1, 1 + (vw / DECK_FROM_PX - 1) * scaleGrow));

      // offsetWidth, not getBoundingClientRect: a rotated card's rect is its projected bbox.
      var widths = cards.map(function (c) { return (c.offsetWidth || 1) * deckScale; });
      var maxW   = Math.max.apply(null, widths);
      var sorted = widths.slice().sort(function (a, b) { return a - b; });
      var medW   = sorted[Math.floor(sorted.length / 2)];

      var wideBonus = Math.max(0, vw - GAP_FROM_PX) * gapGrow / 100;
      function gapFor(w) {
        return Math.min(GAP_MAX_PX, Math.max(GAP_MIN_PX, w * gapPct / 100 + wideBonus));
      }
      var gapPx  = gapFor(medW);
      var offsets = [0];
      for (var i = 1; i < cards.length; i++) {
        var pairW = (widths[i - 1] + widths[i]) / 2;
        var gap   = GAP_PER_PAIR ? gapFor(pairW) : gapPx;
        offsets[i] = offsets[i - 1] + pairW + gap;
      }
      var spanPx = offsets[offsets.length - 1];

      var travelHalf = (vw + maxW) / 2 + maxW * EXIT_PAD_PCT / 100;

      var orbitPx = Math.max(ORBIT_MIN_PX, medW * orbitPct / 100);
      var perspPx = medW * PERSP_CARD_PCT / 100;
      track.style.perspective = perspPx + 'px';
      gsap.set(cards, {
        xPercent: -50, yPercent: -50, scale: deckScale,
        transformOrigin: '50% 50% -' + orbitPx + 'px', force3D: true
      });

      var rotEase = gsap.parseEase(ROT_EASE);
      var RAD = Math.PI / 180;
      var raw = (mode === 'off');

      var rotSpanPct = attr(wrap, 'data-rot-span');
      if (rotSpanPct == null) { rotSpanPct = ROT_SPAN_PCT; }
      var rotHalf = rotSpanPct ? medW * rotSpanPct / 100 : travelHalf;
      function rotAt(sx) {
        var p = (sx + rotHalf) / (rotHalf * 2);
        p = p < 0 ? 0 : (p > 1 ? 1 : p);
        return ROT_IN + (ROT_OUT - ROT_IN) * rotEase(p);
      }
      function shrinkAt(sx) {
        var depth = orbitPx * (1 - Math.cos(rotAt(sx) * RAD));
        return perspPx / (perspPx + depth);
      }
      function stretchAt(sx) {
        var f = shrinkAt(sx);
        if (mode === 'gap')   { return (medW * f + gapPx) / (medW + gapPx); }
        if (mode === 'scale') { return f; }
        return 1;
      }

      var STEP  = 4;
      var LIMIT = travelHalf * 1.2;
      function integrate(dir) {
        var tbl = [0], s = 0, guard = 0;
        while (Math.abs(s) < LIMIT && guard++ < 20000) {
          s += dir * STEP * stretchAt(s);
          tbl.push(s);
        }
        return tbl;
      }
      var sPos = integrate(1);
      var sNeg = integrate(-1);
      function screenAt(u) {
        var tbl = u >= 0 ? sPos : sNeg;
        var k   = Math.abs(u) / STEP;
        var i0  = Math.floor(k);
        if (i0 >= tbl.length - 1) {
          var last = tbl.length - 1;
          var slope = (tbl[last] - tbl[last - 1]) / STEP;
          return tbl[last] + (Math.abs(u) - last * STEP) * slope;
        }
        return tbl[i0] + (tbl[i0 + 1] - tbl[i0]) * (k - i0);
      }

      function render(head) {
        for (var j = 0; j < cards.length; j++) {
          var u  = head - offsets[j];
          var sx = raw ? u : screenAt(u);
          var rot = rotAt(sx);
          var f   = shrinkAt(sx);
          cards[j]._x = sx;
          cards[j]._f = f;
          cards[j]._r = rot;
          gsap.set(cards[j], { x: raw ? u : sx / f, rotateX: rot });
        }
        restack();
      }

      function restack() {
        var order = cards.slice().sort(function (a, b) { return Math.abs(a._x) - Math.abs(b._x); });
        order.forEach(function (card, rank) { card.style.zIndex = order.length - rank; });
      }

      var headStart = LEAD_TRIM ? 0 : -travelHalf;
      var headEnd   = LEAD_TRIM ? Math.max(1, spanPx) : spanPx + travelHalf;
      var proxy     = { h: headStart };
      render(headStart);

      // Pinned, not sticky: the section holds a heading above the deck and Webflow owns its height,
      // so the pin's own spacer provides the scroll distance.
      var dist = Math.round((headEnd - headStart) * scrollRatio);

      scrollTween = gsap.to(proxy, {
        h: headEnd, ease: 'none',
        onUpdate: function () { render(proxy.h); },
        scrollTrigger: {
          trigger: track,
          start: 'top top',
          end: '+=' + dist,
          pin: track,
          pinType: 'transform',
          pinSpacing: true,
          anticipatePin: 1,
          scrub: scrubVal
        }
      });
      wrap.__testiInfo = { mode: mode, gapPx: Math.round(gapPx), medW: Math.round(medW),
                           orbit: Math.round(orbitPx), scale: deckScale, dist: dist };
    }

    wrap.__testiRebuild = build;
    build();

    var lastW = window.innerWidth, rebuildTimer = null;
    window.addEventListener('resize', function () {
      if (window.innerWidth === lastW) { return; }
      lastW = window.innerWidth;
      clearTimeout(rebuildTimer);
      rebuildTimer = setTimeout(function () { build(); ScrollTrigger.refresh(); }, 200);
    });

    function relayout() { build(); ScrollTrigger.refresh(); }
    window.addEventListener('load', relayout);
    if (document.fonts && document.fonts.ready) { document.fonts.ready.then(relayout); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());
