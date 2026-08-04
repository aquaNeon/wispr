(function () {

  // Testimonials deck — cards travel L→R across the viewport on scroll along a cylindrical curve:
  // the card at centre faces front, the others pitch away on the cylinder (MWG effect 068).
  //
  //   .testiv2_height -> tall scroll-height container (sticky child lives inside)
  //   .testiv2_wrap   -> sticky 3D stage (perspective + overflow:hidden), stuck via CSS
  //   .testiv2_card   -> each card (outer wrapper, NOT the inner data-slider="card")
  //
  // SPACING MODEL (the reason this file exists instead of wave-slider.js): all geometry is derived
  // from the MEASURED card widths, not from vw. Gap, orbit radius and scroll length are ratios of
  // the cards themselves, so a 1280 laptop and a 2560 monitor read the same. x moves LINEARLY —
  // only the rotation is eased — so the gap between neighbours is identical anywhere in the sweep
  // (the old power1.inOut on x made cards clump at the screen edges and spread at centre).

  var SEL_HEIGHT = '.testiv2_height';
  var SEL_TRACK  = '.testiv2_wrap';
  var SEL_CARD   = '.testiv2_card';

  // ---- spacing knobs -------------------------------------------------------------------------
  // Gap between neighbouring card EDGES — same px for every pair:
  //   gap = card% of the median card  +  grow% of every px of viewport past GAP_FROM_PX
  // The card term alone rules every laptop up to GAP_FROM_PX (so a look you approve at 1920 is
  // frozen), and only bigger monitors get the extra air they need for the wave to read.
  var GAP_PCT        = 14;    // % of the MEDIAN card width
  var GAP_GROW_PCT   = 0;     // extra px of gap per px of viewport beyond GAP_FROM_PX. Usually 0:
                              // DECK_SCALE below already opens the gaps up with the cards
  var GAP_FROM_PX    = 1920;  // where that growth starts — at or below this, gap is card-only
  var GAP_PCT_MOBILE = 22;    // portrait needs more air (one card should dominate at a time)
  var GAP_MIN_PX     = 32;    // floor, so tiny cards never touch
  var GAP_MAX_PX     = 160;   // ceiling, so an ultrawide doesn't turn into a sparse conveyor
  var GAP_PER_PAIR   = false; // true = gap is % of each pair's own average width (wide neighbours
                              // get more air). false = one constant gap — reads more even
  // How the 3D depth is accounted for when spacing cards. Rotated cards sit further back, so the
  // browser both moves them towards centre AND draws them smaller (factor f = persp/(persp+depth)).
  //   'gap'   the visible gap stays the same px everywhere (cards still shrink) — most even
  //   'scale' the whole row recedes uniformly: gaps shrink by f like the cards do — natural 3D
  //   'pitch' even centre-to-centre pitch on screen — gaps GROW at the edges (cards shrink)
  //   'off'   raw 3D, no correction — gaps bunch up at the edges
  var SPACING_MODE   = 'pitch';
  var EXIT_PAD_PCT   = 12;    // extra travel past the edge, as % of the widest card — how far
                              // offstage a card goes before its sweep ends
  var SCROLL_RATIO   = 0.85;  // scroll px per px of horizontal card travel. lower = deck moves
                              // faster per scroll (shorter section). 1 = 1:1
  var SET_HEIGHT     = true;  // JS sets .testiv2_height from the real travel distance (keeps the
                              // scroll↔motion ratio identical on every screen). false = CSS owns it

  // ---- 3D look -------------------------------------------------------------------------------
  var ORBIT_CARD_PCT = 65;    // cylinder radius as % of median card width — the card pivots on an
                              // axis this far behind itself, so rotateX sweeps it along the arc
  var ORBIT_MIN_PX   = 220;
  var PERSP_CARD_PCT = 260;   // stage perspective as % of median card width (smaller = harder warp)
  var ROT_IN         = -50;   // deg pitch when folding in (offstage left)
  var ROT_OUT        = 50;    // deg pitch when folding out (offstage right)
  var ROT_EASE       = 'power1.inOut';  // eased rotation = the wave. x stays linear (see above)
  var ROT_SPAN_PCT   = 210;   // distance from centre at which the pitch maxes out, as % of the
                              // median card width. THIS is what keeps the wave readable on a 4K:
                              // spanning the rotation over the full (viewport-sized) travel makes
                              // neighbours differ by only a few degrees on a wide screen, so the
                              // curve flattens. Card-scaled → same arc everywhere. Lower = tighter,
                              // steeper wave; null = old behaviour (rotation spread over the travel)

  // Rem-sized cards keep their px width on a 4K, so they read as small slabs in a big void and the
  // whole deck loses presence. Scaling the cards up past DECK_FROM_PX zooms the WHOLE composition —
  // gap, orbit radius, arc height, rotation window and perspective all derive from the card width,
  // so a 4K ends up looking like 1920, just bigger. GROW is the fraction of full fluidity:
  // 1 = cards keep the same share of the screen (2x at 4K), 0 = never scale.
  var DECK_SCALE_GROW = 0.55;
  var DECK_FROM_PX    = 1920;
  var DECK_SCALE_MAX  = 2;

  var CENTER_VH        = 50;  // vertical anchor (50 = viewport centre). lower = higher on screen
  var CENTER_VH_MOBILE = 50;
  var MIN_W            = 768; // below this width = mobile
  var SCRUB            = 1.5; // desktop scrub catch-up (s) — absorbs discrete-wheel jitter
  var SCRUB_MOBILE     = true;// touch scroll is already continuous; numeric catch-up adds shake
  var LEAD_TRIM        = true;// open AND close on a centred card (no blank lead-in / lead-out)

  // Webflow overrides (on the section or any ancestor): data-gap / data-gap-mobile (GAP_PCT),
  // data-scroll-ratio, data-orbit (ORBIT_CARD_PCT), data-center / data-center-mobile (CENTER_VH).
  function attr(el, name) {
    var host = el.closest('[' + name + ']');
    if (!host) { return null; }
    var v = parseFloat(host.getAttribute(name));
    return isNaN(v) ? null : v;
  }

  function init() {
    if (typeof window.gsap === 'undefined' || typeof window.ScrollTrigger === 'undefined') {
      console.warn('[testimonials] GSAP + ScrollTrigger required before this script.');
      return;
    }
    gsap.registerPlugin(ScrollTrigger);

    // Touch smoothness: momentum scroll isn't render-synced and the address bar resizes the
    // viewport mid-scroll — both make a scrub SHAKE. normalizeScroll frame-syncs touch scrolling.
    if (ScrollTrigger.config) { ScrollTrigger.config({ ignoreMobileResize: true }); }
    if (ScrollTrigger.isTouch && !ScrollTrigger.__wsNormalized) {
      ScrollTrigger.__wsNormalized = true;
      ScrollTrigger.normalizeScroll(true);
    }

    // Global guard: drop ScrollTrigger.refresh() calls made mid-scroll (other page scripts call it
    // per scroll tick, which re-lays-out every trigger and makes sticky sections jump). Once scroll
    // settles, run one refresh ONLY if the page actually changed size.
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

    var wrap  = document.querySelector(SEL_HEIGHT);
    var track = wrap && wrap.querySelector(SEL_TRACK);
    if (!wrap || !track) {
      console.warn('[testimonials] need ' + SEL_HEIGHT + ' with a ' + SEL_TRACK + ' inside');
      return;
    }
    var cards = Array.prototype.slice.call(track.querySelectorAll(SEL_CARD));
    if (!cards.length) {
      console.warn('[testimonials] no ' + SEL_CARD + ' children inside ' + SEL_TRACK);
      return;
    }

    var scrollTween = null;

    function destroy() {
      if (scrollTween) {
        if (scrollTween.scrollTrigger) { scrollTween.scrollTrigger.kill(); }
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

      cards.forEach(function (card) {
        card.style.position           = 'absolute';
        card.style.left               = '50%';            // centre-anchored (xPercent:-50 below)
        card.style.top                = centerVh + 'vh';  // yPercent:-50 centres on this
        card.style.transformStyle     = 'preserve-3d';
        card.style.backfaceVisibility = 'hidden';
        card.style.willChange         = 'transform';
        card.style.margin             = '0';
      });

      // LAYOUT widths — offsetWidth, never getBoundingClientRect: a rotated card's client rect is
      // its projected bounding box (a 416px card measures 475-726px depending on its pitch), so
      // rect-based measuring feeds garbage back in on every rebuild and the spacing drifts per card.
      // Gotcha: a card with width:auto shrink-to-fits once absolute — give .testi_card a real width.
      // Deck zoom for wide screens. Spacing works in DRAWN widths, so scaling the cards scales the
      // gaps, orbit, arc and rotation window with them — one number moves the whole composition.
      var scaleGrow = attr(wrap, 'data-deck-grow');
      if (scaleGrow == null) { scaleGrow = DECK_SCALE_GROW; }
      var deckScale = mobile ? 1 : Math.min(DECK_SCALE_MAX,
        Math.max(1, 1 + (vw / DECK_FROM_PX - 1) * scaleGrow));

      var widths = cards.map(function (c) { return (c.offsetWidth || 1) * deckScale; });
      var maxW   = Math.max.apply(null, widths);
      var sorted = widths.slice().sort(function (a, b) { return a - b; });
      var medW   = sorted[Math.floor(sorted.length / 2)];

      // Train layout: centre-to-centre offsets in px. GAP_PER_PAIR=false gives every pair the same
      // gap (constant px off the median card) — mixed landscape/square cards then read as one rhythm.
      var wideBonus = Math.max(0, vw - GAP_FROM_PX) * gapGrow / 100;
      function gapFor(w) {
        return Math.min(GAP_MAX_PX, Math.max(GAP_MIN_PX, w * gapPct / 100 + wideBonus));
      }
      var gapPx  = gapFor(medW);
      var offsets = [0];
      for (var i = 1; i < cards.length; i++) {
        var pairW = (widths[i - 1] + widths[i]) / 2;
        var gap   = GAP_PER_PAIR ? gapFor(pairW) : gapPx;
        offsets[i] = offsets[i - 1] + pairW + gap;       // pairW keeps the EDGE gap equal, not the pitch
      }
      var spanPx = offsets[offsets.length - 1];           // total train length (card 0 → last card)

      // Travel: fully offstage left → fully offstage right, sized off the widest card so nothing is
      // clipped mid-sweep on any viewport.
      var travelHalf = (vw + maxW) / 2 + maxW * EXIT_PAD_PCT / 100;

      var orbitPx = Math.max(ORBIT_MIN_PX, medW * orbitPct / 100);
      var perspPx = medW * PERSP_CARD_PCT / 100;
      track.style.perspective = perspPx + 'px';
      gsap.set(cards, {
        xPercent: -50, yPercent: -50, scale: deckScale,
        transformOrigin: '50% 50% -' + orbitPx + 'px', force3D: true
      });

      // ---- screen-space spacing map ------------------------------------------------------------
      // The card's pivot sits orbitPx behind it, so rotating pushes its centre back by
      // orbit·(1-cos θ); perspective then draws everything there at f = persp/(persp+depth) —
      // BOTH nearer to centre and smaller. Correcting only the position (x/f) leaves the widths
      // shrinking, which is why gaps grew towards the edges.
      //
      // So we integrate a map S(u): u = distance along the train from the deck head, S = where that
      // lands on screen. dS/du is the local stretch we want:
      //   'gap'   (medW·f + gap) / (medW + gap)   card shrinks, gap doesn't → constant visible gap
      //   'scale' f                               everything shrinks together
      //   else    1                               no correction
      // Written x is then S/f, since the browser scales what we write by f. Integrated once per
      // build (a few hundred 4px Euler steps), then a lookup + lerp per frame.
      var rotEase = gsap.parseEase(ROT_EASE);
      var RAD = Math.PI / 180;
      var raw = (mode === 'off');

      var rotSpanPct = attr(wrap, 'data-rot-span');       // 0 = spread over the whole travel (old)
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
        return 1;                                        // 'pitch' and 'off'
      }

      // Two tables (don't assume symmetry — ROT_IN/ROT_OUT may be lopsided).
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
      function screenAt(u) {                             // train coord → screen x
        var tbl = u >= 0 ? sPos : sNeg;
        var k   = Math.abs(u) / STEP;
        var i0  = Math.floor(k);
        if (i0 >= tbl.length - 1) {                      // past the table: keep the last slope
          var last = tbl.length - 1;
          var slope = (tbl[last] - tbl[last - 1]) / STEP;
          return tbl[last] + (Math.abs(u) - last * STEP) * slope;
        }
        return tbl[i0] + (tbl[i0 + 1] - tbl[i0]) * (k - i0);
      }

      function render(head) {
        for (var j = 0; j < cards.length; j++) {
          var u  = head - offsets[j];
          var sx = raw ? u : screenAt(u);                 // where the card should LOOK like it is
          var rot = rotAt(sx);
          var f   = shrinkAt(sx);
          cards[j]._x = sx;                               // screen centre, drawn scale and pitch —
          cards[j]._f = f;                                // read by test-testimonials.html's HUD
          cards[j]._r = rot;
          gsap.set(cards[j], { x: raw ? u : sx / f, rotateX: rot });
        }
        restack();
      }

      // Live stacking: whichever card is closest to centre sits on top. A baked z-index flip breaks
      // once several cards are near centre at once.
      function restack() {
        var order = cards.slice().sort(function (a, b) { return Math.abs(a._x) - Math.abs(b._x); });
        order.forEach(function (card, rank) { card.style.zIndex = order.length - rank; });
      }

      // LEAD_TRIM: head runs 0 → spanPx, so the section opens on card 0 centred and closes on the
      // last one centred. Otherwise it runs from fully offstage to fully offstage.
      var headStart = LEAD_TRIM ? 0 : -travelHalf;
      var headEnd   = LEAD_TRIM ? Math.max(1, spanPx) : spanPx + travelHalf;
      var proxy     = { h: headStart };
      render(headStart);

      // Scroll distance = the deck's own travel × ratio. Sticky child (CSS) → the scrollable window
      // is wrap.height - track.height, so height = track + distance.
      if (SET_HEIGHT) {
        var trackH = track.offsetHeight || window.innerHeight;
        wrap.style.height = Math.round(trackH + (headEnd - headStart) * scrollRatio) + 'px';
      }

      scrollTween = gsap.to(proxy, {
        h: headEnd, ease: 'none',
        onUpdate: function () { render(proxy.h); },
        scrollTrigger: {
          trigger: wrap,
          start: 'top top',
          end: SET_HEIGHT ? 'bottom bottom' : 'bottom-=15% bottom',
          scrub: scrubVal
        }
      });
      wrap.__testiInfo = { mode: mode, gapPx: Math.round(gapPx), medW: Math.round(medW),
                           orbit: Math.round(orbitPx), scale: deckScale };
    }

    wrap.__testiRebuild = build;                         // test page / console: retune without reload
    build();

    // Rebuild on width change only — every number above is px-derived, and a mobile height change
    // (address bar) must not re-measure mid-scroll.
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
