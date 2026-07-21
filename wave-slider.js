(function () {

  // "Images Flowing" — cards travel L→R across the viewport on scroll along a cylindrical curve:
  // the card at centre faces front, the others pitch away on the cylinder (MWG effect 068).
  //
  // reuses the same attribute contract as slider.js so the Webflow HTML is unchanged:
  //   data-slider="wrap"  -> the tall pin-height (provides the scroll distance)
  //   data-slider="track" -> the pinned 3D stage (perspective + overflow:hidden)
  //   data-slider="card"  -> each card
  //
  // slider.js is kept untouched as the known-good fallback.

  var ATTR    = 'data-slider';
  var A_WRAP  = 'wrap';
  var A_TRACK = 'track';
  var A_CARD  = 'card';
  var A_DRAW  = 'draw';       // tag an svg (or a path) data-slider="draw" to draw it behind the deck

  var CARD_W    = null;       // force a card width (e.g. '14vw'); null = keep the Webflow-authored size
  var ORBIT_VW  = 26;         // cylinder radius (vw): the card pivots on an axis this far behind it,
                              // so rotateX sweeps it up/down along the curve. bigger = taller arc
  var PERSP     = '100vw';    // stage perspective — smaller = stronger 3D warp

  var ROT_IN    = -90;        // deg the card is pitched as it folds in (offstage left)
  var ROT_OUT   = 90;         // deg it pitches to as it folds out (offstage right)
  var DUR       = 1.1;        // per-card timeline duration (in master-time units)
  var EASE      = 'power1.inOut';
  var ZFLIP     = 0.55;       // when (from the end of a sweep) a card drops under the next one
  var TRAVEL_VW = 170;        // total horizontal travel as % of viewport width (centre offstage-left →
                              // offstage-right). same for every card → even spacing regardless of width
  var SCROLL_VH = 600;        // pin-height in vh — how long the deck plays
  // card vertical anchor as vh (50 = viewport centre). lower = higher on screen. on mobile 50vh
  // reads a bit low (vh = tall viewport incl. the address bar; a fixed navbar adds to it). override
  // per-page from Webflow with data-center / data-center-mobile on the data-slider="wrap" element.
  var CENTER_VH        = 50;
  var CENTER_VH_MOBILE = 50;
  var MIN_W     = 768;        // below this width = "mobile": uniform narrower cards + wider spacing
  var CARD_W_MOBILE   = '76vw';  // forced card width on mobile (readable + fits, no overlap/overflow)
  var TRAVEL_VW_MOBILE = 300;    // wider sweep on mobile so cards don't pile up (one prominent at a time)
  // background SVG path (tag it data-slider="draw") is drawn SCRUBBED on its own trigger: paints in
  // over the first half, un-paints from the start over the second half. START/END are ScrollTrigger
  // positions — DRAW_START earlier than the pin (section entering) makes it begin sooner.
  var DRAW_START = 'top bottom';   // section top reaches viewport bottom → draw starts (as early as it can)
  var DRAW_END   = 'bottom bottom';// finishes by the deck's pin end
  var SCRUB        = 0.4;     // desktop scrub catch-up (s). eases discrete wheel steps; small tail
  var SCRUB_MOBILE = true;    // mobile: 1:1 with scroll. touch scroll is already continuous, so the
                              // numeric catch-up just adds a settling "shake" at the end of a flick

  function init() {
    if (typeof window.gsap === 'undefined' || typeof window.ScrollTrigger === 'undefined') {
      console.warn('[wave-slider] GSAP + ScrollTrigger required before this script.');
      return;
    }
    gsap.registerPlugin(ScrollTrigger);

    // Mobile smoothness: real phones deliver touch-momentum scroll that isn't synced to the render
    // loop, and the address bar resizes the viewport mid-scroll — both make a pinned scrub SHAKE
    // (even at scrub:true). normalizeScroll frame-syncs touch scrolling (like Lenis, but native) and
    // absorbs the address bar. touch-only, so desktop is untouched. global → set once.
    if (ScrollTrigger.config) { ScrollTrigger.config({ ignoreMobileResize: true }); }
    if (ScrollTrigger.isTouch && !ScrollTrigger.__wsNormalized) {
      ScrollTrigger.__wsNormalized = true;
      ScrollTrigger.normalizeScroll(true);
    }

    // Global guard: keep ScrollTrigger.refresh() from running mid-scroll. Other scripts on the page
    // (e.g. a page ScrollTrigger whose onUpdate calls refresh() every scroll tick) re-lay-out every
    // pin on each refresh, which makes pinned sections jump. Layout can't change during a scroll, so
    // we drop refreshes requested while scrolling and, once scroll settles, run one ONLY if the page
    // actually changed size — pointless per-tick calls become no-ops. Patches the shared instance,
    // so it protects every pin on the page, not just this slider.
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

    var wrap  = document.querySelector('[' + ATTR + '="' + A_WRAP + '"]');
    var track = wrap && wrap.querySelector('[' + ATTR + '="' + A_TRACK + '"]');
    if (!wrap || !track) { console.warn('[wave-slider] need data-slider="wrap" with a data-slider="track" inside'); return; }

    var cards = Array.prototype.slice.call(track.querySelectorAll('[' + ATTR + '="' + A_CARD + '"]'));
    if (!cards.length) { console.warn('[wave-slider] no data-slider="card" children inside the track'); return; }

    // mobile: same effect, but the wide testimonial cards overflowed + overlapped (and rendering
    // huge 3D elements jittered). below MIN_W we force a uniform narrower card width and wider
    // spacing so the cards fit and sweep cleanly.
    var mobile   = window.innerWidth < MIN_W;
    var cardW    = mobile ? CARD_W_MOBILE : CARD_W;
    var travelVw = mobile ? TRAVEL_VW_MOBILE : TRAVEL_VW;
    var scrubVal = mobile ? SCRUB_MOBILE : SCRUB;
    var centerVh = mobile ? CENTER_VH_MOBILE : CENTER_VH;   // vertical anchor; Webflow can override:
    var centerAttr = wrap.getAttribute(mobile ? 'data-center-mobile' : 'data-center');
    if (centerAttr != null && centerAttr !== '' && !isNaN(parseFloat(centerAttr))) { centerVh = parseFloat(centerAttr); }

    // background path(s) — tag the svg or the path itself data-slider="draw". prep each path for a
    // stroke-dashoffset draw; the actual paint is SCRUBBED with the deck's scroll (added to the
    // master timeline below), so it paints IN then OUT as you scroll.
    var drawEls = Array.prototype.slice.call(wrap.querySelectorAll('[' + ATTR + '="' + A_DRAW + '"]'));
    var drawPaths = [];
    drawEls.forEach(function (el) {
      var ps = (el.tagName.toLowerCase() === 'path') ? [el] : el.querySelectorAll('path');
      Array.prototype.forEach.call(ps, function (p) { drawPaths.push(p); });
    });
    drawPaths.forEach(function (p) {
      var len = (p.getTotalLength ? p.getTotalLength() : 0) || 1;
      p._len = len;
      gsap.set(p, { strokeDasharray: len, strokeDashoffset: len });   // start hidden
    });

    // keep the bg SVG FIXED in the viewport (behind the deck) while the section is in view. it was
    // position:absolute inside the section, so it scrolled away with it. we fix its section-level
    // container to the viewport and fade it in/out with the section. (fill the viewport; behind the
    // cards via z-index + DOM order; ignore clicks.)
    var bgWraps = [];
    drawEls.forEach(function (el) {
      var c = el;
      while (c.parentElement && c.parentElement !== wrap) { c = c.parentElement; }
      if (c && c.parentElement === wrap && bgWraps.indexOf(c) === -1) { bgWraps.push(c); }
    });
    bgWraps.forEach(function (c) {
      c.style.position       = 'fixed';
      c.style.inset          = '0';         // fill the viewport
      c.style.display        = 'flex';      // centre the svg strip behind the (centred) cards
      c.style.alignItems     = 'center';
      c.style.justifyContent = 'center';
      c.style.zIndex         = '0';         // behind the cards (they carry z-index 1..n)
      c.style.pointerEvents  = 'none';
      c.style.opacity        = '0';
      ScrollTrigger.create({
        trigger: wrap, start: 'top bottom', end: 'bottom top',
        onToggle: function (self) { gsap.to(c, { opacity: self.isActive ? 1 : 0, duration: 0.3, overwrite: true }); }
      });
    });

    // stage layout (the effect's CSS, applied inline so the Webflow HTML stays as-is)
    wrap.style.height          = SCROLL_VH + 'vh';        // pin-height
    track.style.height         = '100vh';                 // pinned viewport column
    track.style.overflow       = 'hidden';
    track.style.perspective    = PERSP;
    track.style.transformStyle = 'preserve-3d';
    track.style.position       = 'relative';              // anchors the absolute cards
    track.style.padding        = '0';                     // drop any Webflow padding that would offset the cards

    cards.forEach(function (media) {
      if (cardW) { media.style.width = cardW; media.style.height = 'auto'; }
      media.style.position         = 'absolute';
      media.style.left             = '50%';               // centre-anchored (with xPercent:-50 below) so
      media.style.top              = centerVh + 'vh';     // vertical anchor (yPercent:-50 centres on it)
      media.style.transformStyle   = 'preserve-3d';
      media.style.backfaceVisibility = 'hidden';          // keep the flip clean
      media.style.willChange       = 'transform';         // hint a GPU layer so the 3D repaint is smoother
      media.style.margin           = '0';
    });

    // Orbit the whole card: the pivot axis is pushed ORBIT_VW behind it, so rotateX sweeps the card
    // up/down along the cylinder. Done on the card itself (not an inner <img> like the demo) so it
    // works with rich, wrapped cards. yPercent:-50 owns the vertical centre so the scrub can't drop it.
    var orbitPx = window.innerWidth * ORBIT_VW / 100;
    gsap.set(cards, { xPercent: -50, yPercent: -50, transformOrigin: '50% 50% -' + orbitPx + 'px', force3D: true });

    // Pin the track, scrub the deck across the full wrap (cards enter/exit offstage — no framing).
    var master = gsap.timeline({
      scrollTrigger: {
        trigger: track, start: 'top top',
        endTrigger: wrap, end: 'bottom bottom',
        pin: track, pinType: 'transform', scrub: scrubVal
      }
    });
    var isPortrait = window.innerHeight > window.innerWidth;
    var step = (isPortrait ? 1.5 : 1) / cards.length;      // portrait spaces the passes out a bit more
    var travelHalf = window.innerWidth * travelVw / 200;   // centre travels ±this; identical for every card → even spacing
    cards.forEach(function (media, i) {
      var tl = gsap.timeline();
      tl.fromTo(media,
        { x: -travelHalf, rotateX: ROT_IN, zIndex: cards.length - i },
        { x: travelHalf, rotateX: ROT_OUT, ease: EASE, duration: DUR });   // xPercent stays -50 (centre)
      tl.set(media, { zIndex: 0 }, '-=' + ZFLIP);          // drop the stacking order so the next pass sits on top
      master.add(tl, i * step);
    });

    // scrubbed bg draw on its OWN trigger (not the master), so it can start BEFORE the deck pins —
    // it begins as the section scrolls into view (DRAW_START) and runs to DRAW_END. offset len → 0 →
    // -len (linear) = paints IN over the first half, un-paints from the start over the second half.
    if (drawPaths.length) {
      var drawTl = gsap.timeline({
        scrollTrigger: { trigger: wrap, start: DRAW_START, end: DRAW_END, scrub: scrubVal }
      });
      drawPaths.forEach(function (p) {
        drawTl.fromTo(p, { strokeDashoffset: p._len },
          { strokeDashoffset: -p._len, ease: 'none', duration: 1 }, 0);
      });
    }

    // refresh once fonts/images settle so measurements are final
    function relayout() { ScrollTrigger.refresh(); }
    window.addEventListener('load', relayout);
    if (document.fonts && document.fonts.ready) { document.fonts.ready.then(relayout); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());
