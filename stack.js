(function () {

  // ── tune these ────────────────────────────────────────────────
  // Motion is TRIGGERED by scroll, not scrubbed. Crossing a threshold
  // plays a self-eased tween (real seconds). Each "step" = one scroll
  // instance. STEP_VH = how much scroll separates steps.
  var STEP_VH       = 0.7;    // scroll distance per step, in viewport heights
  var SNAP          = true;   // snap scroll to each step (discrete feel)
  var SNAP_DUR      = 0.3;    // seconds for the snap glide

  // POP — items appear at their scattered positions, "growing out"
  // sideways (scaled more on width than height).
  var POP_BATCH     = 2;      // how many pop together per step (1 = one-by-one)
  var POP_STAGGER   = 0.08;   // seconds between items inside a batch
  var POP_DUR       = 0.55;   // seconds each item takes to appear
  var POP_SCALE_X   = 0.35;   // start horizontal scale (lower = more grow-out)
  var POP_SCALE_Y   = 0.85;   // start vertical scale
  var POP_Y         = 18;     // start y offset (px)
  var POP_EASE      = 'back.out(1.6)';

  // CHECKBOX — optional [data-stack="check"] inside each task, popped in
  // just after its task.
  var CHECK_DELAY   = 0.18;   // seconds after the task starts
  var CHECK_DUR     = 0.4;    // seconds
  var CHECK_EASE    = 'back.out(2.4)';

  // GATHER — after all pops, one more scroll step flies them into the card
  var GATHER_STAGGER = 0.09;  // seconds between each item landing
  var GATHER_DUR     = 0.7;   // seconds each item takes to land
  var GATHER_EASE    = 'power3.inOut';
  var CARD_FADE      = 0.4;   // seconds for card frame to fade in
  // Background each task fades to as it lands in the card. '' = read the
  // --green CSS variable; or set any color string.
  var LANDED_BG      = '';
  var LANDED_BG_VAR  = '--green';

  // Card stack layout — tasks become UNIFORM width so rows look even,
  // and the card box is pre-sized to hug them (grows based on task width).
  var CARD_ITEM_W   = 352;    // uniform task width in px. 0 = auto (widest task)
  var MATCH_HEIGHT  = true;   // also make every row the same height
  var ROW_H         = 0;      // forced row height px; 0 = tallest task
  var ROW_GAP       = 8;      // px gap between stacked rows
  var HEAD_GAP      = 18;     // px gap under card-head before first row
  var STACK_TOP     = 0;      // extra px above first row (works even if the
                              // title isn't tagged data-stack="card-head")
  var CARD_GROW     = 0.92;   // card scale it "grows" from as it fades in

  // Extra pinned steps AFTER the card is built, so it "follows" down
  // through the next section before releasing.
  var HOLD_STEPS    = 2;
  // ─────────────────────────────────────────────────────────────

  var ATTR    = 'data-stack';
  var ORDER   = 'data-stack-order';

  function sel(root, name) {
    return root.querySelectorAll('[' + ATTR + '="' + name + '"]');
  }
  function one(root, name) {
    return root.querySelector('[' + ATTR + '="' + name + '"]');
  }

  function init() {
    if (typeof window.gsap === 'undefined' || typeof window.ScrollTrigger === 'undefined') {
      console.warn('[stack] GSAP + ScrollTrigger required. Add both to the project before this script.');
      return;
    }
    gsap.registerPlugin(ScrollTrigger);

    var section = one(document, 'section');
    if (!section) {
      console.warn('[stack] no element with data-stack="section" found');
      return;
    }

    var card  = one(section, 'card');
    var head  = one(section, 'card-head');
    var items = Array.prototype.slice.call(sel(section, 'item'));

    if (!card) { console.warn('[stack] no data-stack="card" inside section'); return; }
    if (items.length < 2) { console.warn('[stack] need 2+ data-stack="item" elements'); return; }

    // pop order — explicit data-stack-order wins, else DOM order
    items.sort(function (a, b) {
      var ao = parseFloat(a.getAttribute(ORDER));
      var bo = parseFloat(b.getAttribute(ORDER));
      if (isNaN(ao)) { ao = Infinity; }
      if (isNaN(bo)) { bo = Infinity; }
      return ao - bo;
    });

    // Decouple items from normal flow. If they're laid out in flow, then
    // animating one item's width reflows its neighbours and breaks the
    // transform-based targeting (widest task shoves the next one). Freeze
    // each flow item to position:absolute at its current spot so width
    // changes never move anyone. (Already-absolute items are left alone.)
    if (window.getComputedStyle(section).position === 'static') {
      section.style.position = 'relative';
    }
    var sr0   = section.getBoundingClientRect();
    var rect0 = items.map(function (it) { return it.getBoundingClientRect(); });
    items.forEach(function (it, i) {
      var pos = window.getComputedStyle(it).position;
      var converted = false;
      if (pos === 'static' || pos === 'relative') {
        it.style.position = 'absolute';
        it.style.margin   = '0';
        it.style.left     = (rect0[i].left - sr0.left) + 'px';
        it.style.top      = (rect0[i].top  - sr0.top)  + 'px';
        converted = true;
      }
      if (window.STACK_DEBUG === true) {
        console.log('[stack] decouple #' + i,
          JSON.stringify((it.textContent || '').trim().slice(0, 16)),
          '| was pos=', pos, '| converted=', converted,
          '| parent=', it.parentElement ? it.parentElement.className : '?');
      }
    });

    // baseline: hidden, own stacking (newest pops on top), no residual
    // transform. nowrap = every task is one line so widths are comparable
    // and the uniform width never forces a wrap; border-box = exact sizing.
    var checks = items.map(function (it) { return one(it, 'check'); });
    items.forEach(function (it, i) {
      gsap.set(it, { opacity: 0, scaleX: POP_SCALE_X, scaleY: POP_SCALE_Y, y: POP_Y, x: 0, zIndex: i + 1, transformOrigin: '50% 50%' });
      it.style.willChange = 'transform, opacity, width, height';
      it.style.whiteSpace = 'nowrap';
      it.style.boxSizing  = 'border-box';
      if (checks[i]) { gsap.set(checks[i], { scale: 0, opacity: 0, transformOrigin: '50% 50%' }); }
    });
    // card frame sits behind the flying items, hidden + shrunk until gather
    gsap.set(card, { autoAlpha: 0, zIndex: 0, scale: CARD_GROW, transformOrigin: '50% 50%' });
    card.style.boxSizing = 'border-box';

    // ── target geometry ──────────────────────────────────────────
    // Per-item landing target {dx,dy,w,h}, recomputed on every refresh.
    // We neutralize each item's transform/size to read true natural
    // dimensions, then PRE-SIZE the card box to hug the uniform rows and
    // place slots from the card's real final rect (anchor-agnostic).
    var geo = items.map(function () { return { dx: 0, dy: 0, w: 0, h: 0 }; });

    function measure() {
      var savedT = items.map(function (it) { return it.style.transform; });
      var savedW = items.map(function (it) { return it.style.width; });
      var savedH = items.map(function (it) { return it.style.height; });
      items.forEach(function (it) {
        it.style.transform = 'none';
        it.style.width  = '';
        it.style.height = '';
      });

      // natural sizes → uniform target dimensions
      var nats = items.map(function (it) { return it.getBoundingClientRect(); });
      var uniformW = CARD_ITEM_W;
      var rowH     = ROW_H;
      if (uniformW <= 0) {
        uniformW = 0;
        nats.forEach(function (r) { if (r.width  > uniformW) { uniformW = r.width; } });
      }
      if (rowH <= 0) {
        rowH = 0;
        nats.forEach(function (r) { if (r.height > rowH) { rowH = r.height; } });
      }
      if (!MATCH_HEIGHT) { rowH = 0; } // 0 sentinel → keep per-item height below

      var cs   = window.getComputedStyle(card);
      var padL = parseFloat(cs.paddingLeft)   || 0;
      var padT = parseFloat(cs.paddingTop)    || 0;
      var padR = parseFloat(cs.paddingRight)  || 0;
      var padB = parseFloat(cs.paddingBottom) || 0;
      var headH = (head ? head.offsetHeight + HEAD_GAP : 0) + STACK_TOP;

      // uniform row height for slot spacing (falls back to tallest when
      // MATCH_HEIGHT is off so rows still don't overlap)
      var slotH = rowH > 0 ? rowH : (function () {
        var m = 0; nats.forEach(function (r) { if (r.height > m) { m = r.height; } }); return m;
      }());

      // pre-size the card to fit the stack, then read its true final rect
      // (clear the card's scale transform first so the rect is unscaled)
      var rowsBlock = items.length * (slotH + ROW_GAP) - ROW_GAP;
      card.style.width  = (uniformW + padL + padR) + 'px';
      card.style.height = (padT + headH + rowsBlock + padB) + 'px';

      var savedCT = card.style.transform;
      card.style.transform = 'none';
      var cRect = card.getBoundingClientRect();
      card.style.transform = savedCT || '';

      var left  = cRect.left + padL;                 // content is uniformW wide = centered
      var top   = cRect.top + padT + headH;

      // Second pass: apply the FINAL size, then measure position. An item
      // anchored by anything other than pure `left` (centered, right-
      // anchored) shifts its edges when the width changes, so we must
      // compute dx/dy from where it actually sits at uniform size.
      items.forEach(function (it) {
        it.style.width = uniformW + 'px';
        if (rowH > 0) { it.style.height = rowH + 'px'; }
      });
      var fin = items.map(function (it) { return it.getBoundingClientRect(); });

      for (var s = 0; s < items.length; s++) {
        geo[s] = {
          dx : left - fin[s].left,
          dy : (top + s * (slotH + ROW_GAP)) - fin[s].top,
          w  : uniformW,
          h  : rowH > 0 ? rowH : fin[s].height
        };
      }

      if (window.STACK_DEBUG === true && !measure._logged) {
        measure._logged = true;
        console.log('[stack] targetLeft=', Math.round(left), 'uniformW=', Math.round(uniformW),
          'cardLeft=', Math.round(cRect.left), 'cardW=', Math.round(cRect.width),
          'items=', items.length);
        items.forEach(function (it, s) {
          console.log('[stack]  #' + s,
            JSON.stringify((it.textContent || '').trim().slice(0, 18)),
            '| nat.left=', Math.round(nats[s].left),
            'nat.w=', Math.round(nats[s].width),
            '| dx=', Math.round(geo[s].dx),
            'pos=', window.getComputedStyle(it).position,
            'parent=', it.parentElement ? it.parentElement.className : '?');
        });
      }

      items.forEach(function (it, i) {
        it.style.transform = savedT[i] || '';
        it.style.width  = savedW[i] || '';
        it.style.height = savedH[i] || '';
      });
    }

    // ── build the step timelines (paused; played on threshold crossing) ──
    // One POP timeline per batch, plus one GATHER timeline. Each plays
    // itself with real easing when its scroll threshold is crossed, and
    // reverses when scrolled back past it.
    var batchCount = Math.ceil(items.length / POP_BATCH);

    var popTls = [];
    var b;
    for (b = 0; b < batchCount; b++) {
      (function (batch) {
        var members     = items.filter(function (it, i) { return Math.floor(i / POP_BATCH) === batch; });
        var memberIdx   = items.map(function (it, i) { return i; }).filter(function (i) { return Math.floor(i / POP_BATCH) === batch; });
        var batchChecks = memberIdx.map(function (i) { return checks[i]; }).filter(Boolean);

        var tl = gsap.timeline({ paused: true });
        tl.to(members, {
          opacity  : 1,
          scaleX   : 1,
          scaleY   : 1,
          y        : 0,
          duration : POP_DUR,
          ease     : POP_EASE,
          stagger  : POP_STAGGER
        }, 0);
        if (batchChecks.length) {
          tl.to(batchChecks, {
            scale    : 1,
            opacity  : 1,
            duration : CHECK_DUR,
            ease     : CHECK_EASE,
            stagger  : POP_STAGGER
          }, CHECK_DELAY);
        }
        popTls.push(tl);
      }(b));
    }

    // landed background — resolve the --green CSS var (or explicit color).
    // Read off the card so scoped/inherited vars resolve, falling back to
    // :root if the card doesn't see it.
    var landedBg = LANDED_BG ||
      window.getComputedStyle(card).getPropertyValue(LANDED_BG_VAR).trim() ||
      window.getComputedStyle(document.documentElement).getPropertyValue(LANDED_BG_VAR).trim();

    // GATHER timeline — card fades + grows in, items fly to their stacked
    // slots and resize to a uniform width/height. Function-based values
    // read the freshest geo on play (recomputed on refresh).
    var gatherTl = gsap.timeline({ paused: true });
    gatherTl.to(card, { autoAlpha: 1, scale: 1, duration: CARD_FADE, ease: 'power2.out' }, 0);
    items.forEach(function (it, slot) {
      var tween = {
        x        : function () { return geo[slot].dx; },
        y        : function () { return geo[slot].dy; },
        width    : function () { return geo[slot].w; },
        height   : function () { return geo[slot].h; },
        duration : GATHER_DUR,
        ease     : GATHER_EASE,
        onStart  : function () { it.style.zIndex = 100 + slot; }
      };
      if (landedBg) { tween.backgroundColor = landedBg; }
      gatherTl.to(it, tween, CARD_FADE * 0.5 + slot * GATHER_STAGGER);
    });

    // ── threshold state machine ───────────────────────────────────
    // steps: one per batch, one for gather, plus HOLD_STEPS trailing.
    var stepCount   = batchCount + 1 + HOLD_STEPS;
    var popPlayed   = popTls.map(function () { return false; });
    var gatherOn    = false;

    // progress threshold at which step N fires (leave the last HOLD_STEPS empty)
    function thresholdFor(step) { return (step + 1) / stepCount; }

    var popThresh    = popTls.map(function (_, i) { return thresholdFor(i); });
    var gatherThresh = thresholdFor(batchCount);

    function update(p) {
      var i;
      for (i = 0; i < popTls.length; i++) {
        if (p >= popThresh[i] && !popPlayed[i]) { popTls[i].play();    popPlayed[i] = true;  }
        else if (p < popThresh[i] && popPlayed[i]) { popTls[i].reverse(); popPlayed[i] = false; }
      }
      if (p >= gatherThresh && !gatherOn)      { gatherTl.play();    gatherOn = true;  }
      else if (p < gatherThresh && gatherOn)   { gatherTl.reverse(); gatherOn = false; }
    }

    // snap points: every step threshold + the two endpoints
    var snapPoints = [0].concat(popThresh, [gatherThresh, 1]);

    ScrollTrigger.create({
      trigger : section,
      start   : 'top top',
      end     : function () { return '+=' + (window.innerHeight * STEP_VH * stepCount); },
      pin     : true,
      invalidateOnRefresh : true,
      onRefreshInit : function () {
        measure();
        // let the gather tween pick up fresh deltas (only when not landed,
        // so we don't yank a settled card on resize)
        if (!gatherOn) { gatherTl.invalidate(); }
      },
      onUpdate : function (self) { update(self.progress); },
      snap : SNAP ? {
        snapTo      : snapPoints,
        duration    : SNAP_DUR,
        ease        : 'power1.inOut',
        inertia     : false
      } : false
    });

    measure();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());
