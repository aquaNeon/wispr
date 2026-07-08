(function () {

  var STEP_VH       = 0.7;
  var SNAP          = false;   // magnetic scroll-to-nearest-step; off = free scroll
  var SNAP_DUR      = 0.3;

  var POP_BATCH     = 2;
  var POP_STAGGER   = 0.05;
  var POP_DUR       = 0.34;
  var POP_BUNCH     = 0.55;   // <1 pulls pops earlier & tighter; 1 = original spacing
  var POP_LEAD      = 0.06;   // small scroll lead so the FIRST batch animates in (not pre-popped at p=0)
  var POP_SCALE_X   = 0.35;
  var POP_SCALE_Y   = 0.85;
  var POP_EASE      = 'back.out(2)';

  // fan-out: rows pop in bunched near centre (a fist), then scrolling moves them OUT
  // to their scatter spots. FIST = how tight the start is: 0 = all stacked dead-centre,
  // 0.5 = start half-open (skips the tightest part), 1 = no fist (start at scatter spot).
  var FIST          = 0.5;

  var CHECK_DELAY   = 0.18;
  var CHECK_DUR     = 0.4;
  var CHECK_EASE    = 'back.out(2.4)';

  var GATHER_STAGGER = 0.09;
  var GATHER_DUR     = 0.7;
  var GATHER_EASE    = 'power3.inOut';
  var CARD_FADE      = 0.4;
  var LANDED_BG      = '';        // explicit row colour on landing; '' = read the CSS var below
  var LANDED_BG_VAR  = '--green'; // row bg once gathered, so rows read distinct from the card face

  var HOLD_STEPS    = 0;      // extra held steps after gather before travel begins

  // after assembly the card rises from the bottom to viewport centre, then holds
  // there (pinned) for HOLD_VH — room for future inner-card animations.
  var CARD_TARGET   = 0.5;    // viewport fraction the card centres on (0.5 = dead centre)
  var TRAVEL_VH     = 0.8;    // scroll (viewport heights) for the card to reach centre
  var HOLD_VH       = 3;      // long hold at centre

  // during the hold: the green panel (bg + H2) scrolls up & out while the card
  // stays locked at centre (equal-and-opposite y), revealing what's behind.
  var GREEN_LEAVE    = true;
  var GREEN_LEAVE_VH = 1.4;   // how far (viewport heights) the green panel travels up

  // split colour reveal: during the hold a light layer (light bg + a light-themed
  // clone of the card) rises from the bottom, clipped by a horizontal line, so the
  // card/bg split dark-above / light-below exactly at that line (see figma).
  var LIGHT_REVEAL   = true;
  var LIGHT_BG       = '';            // '' -> read the CSS var below
  var LIGHT_BG_VAR   = '--light-main';
  var LIGHT_CARD_BG  = '#E4E4D0';     // card face in the light theme
  var LIGHT_ROW_BG   = '#FFFDF9';     // task rows in the light theme
  var LIGHT_TEXT     = '#1A1A1A';     // text + check outline in the light theme
  var REVEAL_VH      = 1.2;           // scroll (viewport heights) the light takes to rise through

  var ATTR  = 'data-stack';
  var ORDER = 'data-stack-order';

  function sel(root, name) { return root.querySelectorAll('[' + ATTR + '="' + name + '"]'); }
  function one(root, name) { return root.querySelector('[' + ATTR + '="' + name + '"]'); }
  function smooth(t) { return t < 0 ? 0 : (t > 1 ? 1 : t * t * (3 - 2 * t)); }

  function init() {
    if (typeof window.gsap === 'undefined' || typeof window.ScrollTrigger === 'undefined') {
      console.warn('[stack] GSAP + ScrollTrigger required before this script.');
      return;
    }
    gsap.registerPlugin(ScrollTrigger);

    var section = one(document, 'section');
    if (!section) { console.warn('[stack] no data-stack="section" found'); return; }

    var card  = one(section, 'card');
    var head  = one(section, 'card-head');
    var items = Array.prototype.slice.call(sel(section, 'item'));

    if (!card) { console.warn('[stack] no data-stack="card" inside section'); return; }
    if (items.length < 2) { console.warn('[stack] need 2+ data-stack="item" elements'); return; }

    items.sort(function (a, b) {
      var ao = parseFloat(a.getAttribute(ORDER)); if (isNaN(ao)) { ao = Infinity; }
      var bo = parseFloat(b.getAttribute(ORDER)); if (isNaN(bo)) { bo = Infinity; }
      return ao - bo;
    });

    if (window.getComputedStyle(section).position === 'static') {
      section.style.position = 'relative';
    }

    // scatter context = the items' original parent (.meeting_items in prod, the
    // section in the test harness). Its box is the frame the scatter % live in.
    var scatterCtx = items[0].parentNode;

    // --- FLIP capture: record each item's scattered spot as a fraction of the
    //     scatter frame, BEFORE we touch the DOM ---
    var mi0 = scatterCtx.getBoundingClientRect();
    var frac = items.map(function (it) {
      var r = it.getBoundingClientRect();
      return {
        fx: mi0.width  ? (r.left - mi0.left) / mi0.width  : 0,
        fy: mi0.height ? (r.top  - mi0.top)  / mi0.height : 0
      };
    });

    // pre-hide so reparenting into flow doesn't flash a full-opacity stack
    gsap.set(items, { opacity: 0 });

    // --- reparent tasks into the card as real flex children; neutralise the
    //     Webflow absolute positioning so the card's flex column lays them out ---
    items.forEach(function (it) {
      card.appendChild(it);
      it.style.position   = 'relative';   // relative (not static) so z-index still applies
      it.style.inset      = 'auto';       // overrides the .is-N inset scatter rules
      it.style.margin     = '0';
      it.style.width      = '';           // let the .meeting_item 352px class width stand
      it.style.boxSizing  = 'border-box';
      it.style.whiteSpace = 'nowrap';     // single-line rows -> stable height
      it.style.willChange = 'transform, opacity';
    });

    var checks    = items.map(function (it) { return it.querySelector('[' + ATTR + '="check"], .meeting_check'); });
    var itemTexts = items.map(function (it) { return it.querySelector('.meeting_item_text') || it; });

    // capture the card's painted look, then make the face transparent so the
    // "card" visually arrives during gather (never fade card OPACITY — that would
    // hide the popping children; never SCALE the card — that would corrupt the
    // scatter deltas measured at scale 1).
    var ccs        = window.getComputedStyle(card);
    var origBg     = ccs.backgroundColor;
    var origBorder = ccs.borderColor;
    card.style.boxSizing  = 'border-box';
    card.style.willChange = 'transform';

    var geo = items.map(function () { return { dx: 0, dy: 0 }; });
    var out = items.map(function () { return { ox: 0, oy: 0 }; });   // outward vector (scatter spot -> section centre)

    // read natural (flowed) rects with all transforms cleared, then invert against
    // the scatter fraction to get each item's scatter delta.
    function measureGeo() {
      gsap.set(items, { x: 0, y: 0, scaleX: 1, scaleY: 1 });
      gsap.set(card,  { y: 0 });
      var mi  = scatterCtx.getBoundingClientRect();
      var sr  = section.getBoundingClientRect();
      var scx = sr.left + sr.width  / 2;
      var scy = sr.top  + sr.height / 2;
      var nat = items.map(function (it) { return it.getBoundingClientRect(); });
      for (var s = 0; s < items.length; s++) {
        geo[s].dx = (mi.left + frac[s].fx * mi.width)  - nat[s].left;
        geo[s].dy = (mi.top  + frac[s].fy * mi.height) - nat[s].top;
        // vector from section centre to this row's scatter spot -> drift direction
        out[s].ox = (nat[s].left + geo[s].dx + nat[s].width  / 2) - scx;
        out[s].oy = (nat[s].top  + geo[s].dy + nat[s].height / 2) - scy;
      }
    }

    // how far the card must rise from its assembled (bottom) spot to sit centred.
    // section-relative so it survives refresh regardless of scroll position.
    var cardShiftY = 0;
    function computeCardShift() {
      var prevY = gsap.getProperty(card, 'y');
      gsap.set(card, { y: 0 });
      var cr = card.getBoundingClientRect();
      var sr = section.getBoundingClientRect();
      cardShiftY = window.innerHeight * CARD_TARGET - ((cr.top - sr.top) + cr.height / 2);
      gsap.set(card, { y: prevY });
    }

    // initial scattered + hidden state
    measureGeo();
    items.forEach(function (it, i) {
      gsap.set(it, {
        x: geo[i].dx, y: geo[i].dy,
        scaleX: POP_SCALE_X, scaleY: POP_SCALE_Y,
        opacity: 0, transformOrigin: '50% 50%', zIndex: i + 1
      });
      if (checks[i]) { gsap.set(checks[i], { scale: 0, opacity: 0, transformOrigin: '50% 50%' }); }
    });
    gsap.set(card, { opacity: 1, y: 0, backgroundColor: 'rgba(0,0,0,0)', borderColor: 'rgba(0,0,0,0)' });
    if (head) { gsap.set(head, { opacity: 0 }); }

    // --- pop timelines (batches): reveal only, in place at the scatter spot ---
    var batchCount = Math.ceil(items.length / POP_BATCH);
    var popTls = [];
    var b;
    for (b = 0; b < batchCount; b++) {
      (function (batch) {
        var members     = items.filter(function (it, i) { return Math.floor(i / POP_BATCH) === batch; });
        var memberIdx   = items.map(function (it, i) { return i; }).filter(function (i) { return Math.floor(i / POP_BATCH) === batch; });
        var batchChecks = memberIdx.map(function (i) { return checks[i]; }).filter(Boolean);

        var tl = gsap.timeline({ paused: true });
        tl.to(members, { opacity: 1, scaleX: 1, scaleY: 1, duration: POP_DUR, ease: POP_EASE, stagger: POP_STAGGER }, 0);
        if (batchChecks.length) {
          tl.to(batchChecks, { scale: 1, opacity: 1, duration: CHECK_DUR, ease: CHECK_EASE, stagger: POP_STAGGER }, CHECK_DELAY);
        }
        popTls.push(tl);
      }(b));
    }

    var landedBg = LANDED_BG ||
      window.getComputedStyle(card).getPropertyValue(LANDED_BG_VAR).trim() ||
      window.getComputedStyle(document.documentElement).getPropertyValue(LANDED_BG_VAR).trim();

    // --- gather timeline: card face fades in, items fall into their real slots ---
    var gatherTl = gsap.timeline({ paused: true });
    gatherTl.to(card, { backgroundColor: origBg, borderColor: origBorder, duration: CARD_FADE, ease: 'power2.out' }, 0);
    if (head) { gatherTl.to(head, { opacity: 1, duration: CARD_FADE, ease: 'power2.out' }, 0); }
    items.forEach(function (it, slot) {
      var tween = {
        x: 0, y: 0, duration: GATHER_DUR, ease: GATHER_EASE,
        onStart: function () { it.style.zIndex = 100 + slot; }
      };
      if (landedBg) { tween.backgroundColor = landedBg; }
      gatherTl.to(it, tween, CARD_FADE * 0.5 + slot * GATHER_STAGGER);
    });

    var stepCount = batchCount + 1 + HOLD_STEPS;
    var popPlayed = popTls.map(function () { return false; });
    var gatherOn  = false;

    function thresholdFor(step) { return step / stepCount; }
    var popThresh    = popTls.map(function (_, i) { return POP_LEAD + thresholdFor(i) * POP_BUNCH; });
    var gatherThresh = thresholdFor(batchCount);

    // fan-out grows across the assembly (0 at start of pops -> full just as gather begins)
    function spreadT(ap) {
      if (gatherThresh <= 0) { return 0; }
      return smooth(ap / gatherThresh);
    }

    // drive pop batches + gather off assembly progress (0..1)
    function update(p) {
      var i;
      for (i = 0; i < popTls.length; i++) {
        if (p >= popThresh[i] && !popPlayed[i])      { popTls[i].play();    popPlayed[i] = true;  }
        else if (p < popThresh[i] && popPlayed[i])   { popTls[i].reverse(); popPlayed[i] = false; }
      }
      if (p >= gatherThresh && !gatherOn)            { gatherTl.play();    gatherOn = true;  }
      else if (p < gatherThresh && gatherOn)         { gatherTl.reverse(); gatherOn = false; }
    }

    // re-measure on refresh/resize: landing stays pixel-exact (natural is measured
    // live); only the decorative scatter start reconstructs from the fractions.
    function refresh() {
      measureGeo();
      if (canLeave) { gsap.set(greenPanel, { y: 0 }); }   // neutral for a clean card-shift measure
      computeCardShift();
      if (!gatherOn) {
        items.forEach(function (it, i) {
          var played = popPlayed[Math.floor(i / POP_BATCH)];
          gsap.set(it, {
            x: geo[i].dx, y: geo[i].dy,
            scaleX: played ? 1 : POP_SCALE_X,
            scaleY: played ? 1 : POP_SCALE_Y,
            opacity: played ? 1 : 0
          });
        });
        gatherTl.invalidate();
      } else {
        gsap.set(items, { x: 0, y: 0, scaleX: 1, scaleY: 1, opacity: 1 });
      }
      // re-assert the exact visual state for the current scroll position so a
      // resize/refresh never flashes green defaults over the light zone.
      applyScroll(st ? st.progress : 0);
    }

    // the green panel = the section child that wraps the card (.hero_contain.is-green
    // in prod: carries the green bg + the H2). Translating it up sweeps bg + H2 away.
    var greenPanel = card;
    while (greenPanel.parentNode && greenPanel.parentNode !== section) { greenPanel = greenPanel.parentNode; }
    var canLeave = GREEN_LEAVE && greenPanel !== card;

    // the panel's green is used to cover the dark section as the panel slides up
    // (so no black band shows). We DON'T paint it permanently — that would hide the
    // panel's rounded top corners (green-on-green). The section stays its original
    // dark during assembly (corners read), then goes green only during the leave.
    var origSectionBg  = window.getComputedStyle(section).backgroundColor;
    var greenSectionBg = null;
    if (canLeave) {
      var coverBg = window.getComputedStyle(greenPanel).backgroundColor;
      if (coverBg && coverBg !== 'rgba(0, 0, 0, 0)' && coverBg !== 'transparent') {
        greenSectionBg = coverBg;
      }
    }

    // --- light layer: a fixed, full-viewport light panel holding a light-themed
    //     clone of the card, clipped to reveal from the bottom during the hold ---
    var lightLayer = null, cardClone = null, lightBg = '';
    if (LIGHT_REVEAL) {
      lightBg = LIGHT_BG ||
        window.getComputedStyle(document.documentElement).getPropertyValue(LIGHT_BG_VAR).trim() || '#E4E4D0';

      lightLayer = document.createElement('div');
      lightLayer.setAttribute('data-stack-light', '');
      lightLayer.style.cssText = 'position:fixed;inset:0;z-index:9998;pointer-events:none;' +
        'background:' + lightBg + ';clip-path:inset(100% 0 0 0);will-change:clip-path;';

      cardClone = card.cloneNode(true);
      cardClone.removeAttribute('data-stack');
      cardClone.style.cssText = '';                       // drop the gsap inline (transparent bg etc.)
      cardClone.style.position   = 'absolute';
      cardClone.style.margin     = '0';
      cardClone.style.boxSizing  = 'border-box';
      cardClone.style.background  = LIGHT_CARD_BG;
      cardClone.style.color       = LIGHT_TEXT;
      // reset every descendant's animation inline styles so the clone shows the landed state
      Array.prototype.forEach.call(cardClone.querySelectorAll('*'), function (el) {
        el.style.transform = ''; el.style.opacity = '1';
      });
      Array.prototype.forEach.call(cardClone.querySelectorAll('[data-stack="item"], .meeting_item'), function (el) {
        el.style.backgroundColor = LIGHT_ROW_BG;
      });
      Array.prototype.forEach.call(cardClone.querySelectorAll('.meeting_item_text, [data-stack="card-head"]'), function (el) {
        el.style.color = LIGHT_TEXT;
      });
      Array.prototype.forEach.call(cardClone.querySelectorAll('.meeting_check, [data-stack="check"]'), function (el) {
        el.style.borderColor = LIGHT_TEXT;
      });

      lightLayer.appendChild(cardClone);
      document.body.appendChild(lightLayer);
    }

    // swap the REAL card + section to the light theme once the reveal is complete
    // (invisible behind the fully-covering overlay), so hiding the overlay past the
    // section reveals light reality instead of reverting to green.
    var realLight = false;
    function setRealLight(on) {
      if (!lightLayer || realLight === on) { return; }
      realLight = on;
      gsap.set(card, { backgroundColor: on ? LIGHT_CARD_BG : origBg, borderColor: on ? LIGHT_CARD_BG : origBorder });
      items.forEach(function (it) { gsap.set(it, { backgroundColor: on ? LIGHT_ROW_BG : landedBg }); });
      itemTexts.forEach(function (t) { t.style.color = on ? LIGHT_TEXT : ''; });
      if (head) { head.style.color = on ? LIGHT_TEXT : ''; }
      checks.forEach(function (c) { if (c) { c.style.borderColor = on ? LIGHT_TEXT : ''; } });
    }

    // --- single master pin: assembly -> travel to centre -> long hold ---
    var assemblySteps = STEP_VH * stepCount;
    var totalVH = assemblySteps + TRAVEL_VH + HOLD_VH;
    var pA = TRAVEL_VH > 0 ? assemblySteps / totalVH : 1;                     // assembly ends
    var pB = TRAVEL_VH > 0 ? (assemblySteps + TRAVEL_VH) / totalVH : 1;       // travel ends / hold begins
    var revealSpanP = totalVH > 0 ? REVEAL_VH / totalVH : 1;                  // progress span the light takes to rise

    var snapPoints = [0].concat(popThresh, [gatherThresh])
      .map(function (v) { return v * pA; })
      .concat([pB, 1]);

    // one place that maps scroll progress -> every visual (assembly, rise, green
    // leave, light reveal, theme). Used by both onUpdate and refresh so the state
    // is always self-consistent, even on fast scroll or resize.
    function applyScroll(p) {
      var ap = pA > 0 ? Math.min(1, p / pA) : 1;
      update(ap);

      // fan-out: rows start bunched at centre (a fist) and open OUT to their scatter
      // spots as scroll progresses. gather owns x/y once it turns on.
      if (!gatherOn) {
        var t    = spreadT(ap);              // 0 = tight fist, 1 = full scatter spot
        var pull = (1 - FIST) * (1 - t);     // amount to pull each row back toward centre
        for (var si = 0; si < items.length; si++) {
          gsap.set(items[si], {
            x: geo[si].dx - out[si].ox * pull,
            y: geo[si].dy - out[si].oy * pull
          });
        }
      }

      var lightOn = false;
      if (p <= pA) {                                     // assembling at the bottom
        gsap.set(card, { y: 0 });
        if (canLeave) { gsap.set(greenPanel, { y: 0 }); }
        if (lightLayer) { lightLayer.style.clipPath = 'inset(100% 0 0 0)'; }
      } else {                                           // card rises AND green leaves together
        var t = (pB > pA) ? smooth(Math.min(1, (p - pA) / (pB - pA))) : 1;  // 0 at rise start -> 1 centred
        var gy = canLeave ? -window.innerHeight * GREEN_LEAVE_VH * t : 0;
        if (canLeave) { gsap.set(greenPanel, { y: gy }); }
        gsap.set(card, { y: cardShiftY * t - gy });      // rise to centre + cancel the parent's move

        if (lightLayer) {
          if (p < pB) {                                  // not yet holding: light stays hidden
            lightLayer.style.clipPath = 'inset(100% 0 0 0)';
          } else {                                       // holding: light rises through the card
            var rp = revealSpanP > 0 ? Math.min(1, (p - pB) / revealSpanP) : 1;
            var cr = card.getBoundingClientRect();
            cardClone.style.top   = cr.top + 'px';
            cardClone.style.left  = cr.left + 'px';
            cardClone.style.width = cr.width + 'px';
            lightLayer.style.clipPath = 'inset(' + ((1 - rp) * 100) + '% 0 0 0)';
            lightOn = rp >= 1;                            // once fully revealed, reality is light too
          }
        }
      }
      // section bg by phase: dark during assembly (rounded corners read) -> green
      // during the leave (no black band) -> light once fully revealed.
      if (greenSectionBg) {
        section.style.backgroundColor = (p <= pA) ? origSectionBg : (lightOn ? lightBg : greenSectionBg);
      }
      setRealLight(lightOn);   // single source of truth: light only in the fully-revealed hold
    }

    var st = ScrollTrigger.create({
      trigger: section, start: 'top top',
      end: function () { return '+=' + (window.innerHeight * totalVH); },
      pin: true, invalidateOnRefresh: true,
      onRefreshInit: refresh,
      onUpdate: function (self) { applyScroll(self.progress); },
      onLeave:     function () { if (lightLayer) { lightLayer.style.display = 'none'; } },
      onEnterBack: function () { if (lightLayer) { lightLayer.style.display = ''; } },
      snap: SNAP ? { snapTo: snapPoints, duration: SNAP_DUR, ease: 'power1.inOut', inertia: false } : false
    });

    // re-measure once layout & webfonts settle (avoids sizing off pre-font metrics)
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
