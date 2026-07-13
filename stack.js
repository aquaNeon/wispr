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

  // FIST = fan-out tightness. 0.5 = start half-open (bunch near the cloud centre, fan out to
  // the scatter spots) — the original "great" feel. 1 = off (pop in place, no movement).
  var FIST          = 0.5;

  var CHECK_DELAY   = 0.18;
  var CHECK_DUR     = 0.4;
  var CHECK_EASE    = 'back.out(2.4)';

  var GATHER_STAGGER = 0.09;
  var GATHER_DUR     = 0.7;
  var GATHER_EASE    = 'power3.inOut';
  var CARD_FADE      = 0.4;
  var LANDED_BG      = '';        // explicit row colour on landing; '' = read the CSS var below
  var LANDED_BG_VAR  = '--base-color--fathom'; // row bg once gathered, so rows read distinct from the card face

  var HOLD_STEPS    = 0;      // extra held steps after gather before travel begins

  // sequence: assemble (card bottom, green) -> brief green hold (GREEN_HOLD_VH) -> content
  // scroll (green + H2 + tabs scroll up, card rises to centre) -> STICKY TABS: card holds at
  // centre while the scroll steps through the tabs (TAB_STEP_VH each), then the pin releases.
  var CARD_TARGET    = 0.5;   // viewport fraction the card centres on (0.5 = dead centre)
  var GREEN_HOLD_VH  = 0.25;  // brief scroll held in green after assembly, before the scroll-through
  var TAB_STEP_VH    = 1.0;   // scroll length per tab while the tabs section is sticky (card centred) = 100vh/tab
  var END_HOLD_VH    = 0.35;  // short hold on the LAST tab before release (vs a full empty step)
  var BG_SMOOTH      = 0.12;  // 0..1 ease of the bg-line paint toward scroll; lower = softer/laggier draw

  // during the release: the green panel (bg + headline) scrolls up & fully out while the
  // card stays locked at centre (equal-and-opposite y), revealing the cream behind.
  var GREEN_LEAVE    = true;
  var GREEN_CLEAR    = 1.06;   // lift the panel by its OWN measured height x this, so it fully clears
  var GREEN_RADIUS   = '80px'; // forced inline (!important) so it beats the Webflow embed; '' = leave to CSS

  // split colour reveal: during the hold a light layer (light bg + a light-themed
  // clone of the card) rises from the bottom, clipped by a horizontal line, so the
  // card/bg split dark-above / light-below exactly at that line (see figma).
  var LIGHT_REVEAL   = true;
  var LIGHT_BG       = '';            // '' -> read the CSS var below
  var LIGHT_BG_VAR   = '--light-main';
  var LIGHT_CARD_BG  = '#E4E4D0';     // card face in the light theme
  var LIGHT_ROW_BG   = '#FFFDF9';     // task rows in the light theme
  var LIGHT_Z        = 990;           // clone stacking — above section content, BELOW the nav wrapper (999)
  var LIGHT_TEXT     = '#1A1A1A';     // text + check outline in the light theme
  // NOTE: the white-section H2 is plain Webflow content now (scrolls normally) — not driven here.

  var ATTR  = 'data-stack';
  var ORDER = 'data-stack-order';

  // the two content blocks that live INSIDE the pinned section and swap by breakpoint. stack.js
  // owns their show/hide (see the injected stylesheet in init) so a stuck inline display can't
  // beat the breakpoint. mark the WRAPPERS you hide/show in Webflow (class-agnostic):
  //   data-stack="desktop" -> the desktop tabs wrapper (e.g. .padding-large.is-desktop)
  //   data-stack="mobile"  -> the mobile stacked-cards wrapper (e.g. .container-large.is-mobile)
  var DESKTOP_SEL = '[' + ATTR + '="desktop"]';   // desktop-only wrapper (hidden on mobile)
  var MOBILE_SEL  = '[' + ATTR + '="mobile"]';    // mobile-only wrapper  (hidden on desktop)
  // the tabs GRID that the scroll/indicator logic drives (tab items live inside it). falls back
  // to the desktop wrapper if this grid class isn't present.
  var TABS_SEL    = '.meeting_tabs_contain';
  // display value used to FORCE-SHOW a wrapper only when a Webflow *stylesheet* rule (e.g. an
  // `is-desktop` utility class that's display:none by default) still hides it after we've cleared
  // any inline style. 'block' suits a plain padding/container wrapper; set 'flex'/'grid' if yours
  // relies on that. (when nothing hides it, we leave the natural display untouched.)
  var DESKTOP_DISPLAY = 'block';
  var MOBILE_DISPLAY  = 'block';

  var DEBUG = false;  // set true to log the mode swap + choreography measurements to the console.

  function sel(root, name) { return root.querySelectorAll('[' + ATTR + '="' + name + '"]'); }
  function one(root, name) { return root.querySelector('[' + ATTR + '="' + name + '"]'); }
  function smooth(t) { return t < 0 ? 0 : (t > 1 ? 1 : t * t * (3 - 2 * t)); }

  function init() {
    if (typeof window.gsap === 'undefined' || typeof window.ScrollTrigger === 'undefined') {
      console.warn('[stack] GSAP + ScrollTrigger required before this script.');
      return;
    }
    gsap.registerPlugin(ScrollTrigger);

    // mode-based visibility swap for the two blocks that live inside the pinned section (desktop
    // tabs grid vs mobile stacked-cards). Webflow's per-breakpoint display can be overridden by a
    // stuck inline style (IX2, a prior JS state), which is why resizing left "no tabs" / a stray
    // block. we own the swap: stamp the mode on <html> and hide the OFF-mode block with
    // !important. only ever HIDE here (never guess a display type to show, so flex/grid layout is
    // untouched); the IN-mode block gets its inline display cleared in the builder so a stuck
    // inline:none can't keep it hidden. injected once (never per-rebuild).
    if (!document.getElementById('stack-mode-style')) {
      var ms = document.createElement('style');
      ms.id = 'stack-mode-style';
      ms.textContent =
        'html[data-stack-mode="desktop"] ' + MOBILE_SEL  + '{display:none !important;}' +
        'html[data-stack-mode="mobile"] '  + DESKTOP_SEL + '{display:none !important;}';
      document.head.appendChild(ms);
    }

    // RESPONSIVE via gsap.matchMedia: the whole choreography is rebuilt when the viewport
    // crosses 992px. matchMedia auto-reverts everything GSAP created (the ScrollTrigger + its
    // pin-spacers, every gsap.set inline style) when a breakpoint stops matching, then re-runs
    // this builder for the new mode — so `isDesktop` is never stale and the pin math is always
    // measured for the current size. The non-GSAP mutations (DOM reparent, the light clone, the
    // top-cover strip, the bg-paint ticker, tab click listeners, manual .style writes) aren't
    // GSAP's to revert, so we track each one in `teardown` and undo it in the returned cleanup.
    //
    //   DESKTOP (>=992): full choreography — assembly -> card rise -> content scroll -> sticky tabs.
    //   MOBILE  (<=991): assembly ONLY — tasks pop/gather into the card while pinned, then release
    //     into normal scroll (the stacked .mobile_meeting-card block flows below). no tabs, no
    //     content-scroll, no light reveal, no section clip.
    // ANCHOR scroll restoration across a breakpoint cross. Only the stack pin's LENGTH differs
    // between modes; everything below it just shifts by that delta. So we can restore precisely:
    //   above the pin  -> leave scroll unchanged (nothing above it moved)
    //   inside the pin -> snap to the pin's start (clean choreography restart, no half-frame)
    //   below the pin  -> shift by the change in pin length (slider/footer stay put)
    // We must read the scroll + old pin bounds BEFORE gsap.matchMedia reverts the old pin, so this
    // listener is registered FIRST (change listeners fire in registration order) — it runs ahead of
    // gsap's own matchMedia revert. prevStart/prevEnd are kept current by the active pin's onRefresh.
    var prevStart = null, prevEnd = null;
    var anchorY = null, anchorStart = null, anchorEnd = null;
    var bpMQ = window.matchMedia('(min-width: 992px)');
    function captureAnchor() {
      anchorY = window.pageYOffset || window.scrollY || 0;
      anchorStart = prevStart; anchorEnd = prevEnd;
    }
    if (bpMQ.addEventListener) { bpMQ.addEventListener('change', captureAnchor); }
    else if (bpMQ.addListener) { bpMQ.addListener(captureAnchor); }   // older Safari

    var builtOnce = false;   // false only for the initial page-load build; true for every rebuild
    var mm = gsap.matchMedia();
    mm.add({ isDesktop: '(min-width: 992px)', isMobile: '(max-width: 991px)' }, function (ctx) {
      var isDesktop = ctx.conditions.isDesktop;
      var isRebuild = builtOnce; builtOnce = true;   // this run is a breakpoint cross, not first load

      // --- teardown tracking for the non-GSAP mutations (undone on breakpoint change) ---
      var teardown = [];
      // snapshot an element's inline style attribute so we can restore it verbatim (or remove it
      // if there was none) — covers every manual el.style.x = write below in one shot.
      function guardStyle(el) {
        if (!el) { return el; }
        var prev = el.getAttribute('style');
        teardown.push(function () {
          if (prev === null) { el.removeAttribute('style'); }
          else { el.setAttribute('style', prev); }
        });
        return el;
      }

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

      guardStyle(section);
      if (window.getComputedStyle(section).position === 'static') {
        section.style.position = 'relative';
      }

      // DESKTOP only: lock the section to one viewport + clip (keeps the green panel viewport-
      // sized and stops the tall natural height adding empty scroll after the pin). on MOBILE the
      // section must keep its natural height so the stacked cards below can scroll normally.
      if (isDesktop) {
        // +2px: push the pinned section's bottom edge just below the fold so the pin's sub-pixel
        // hairline seam (where it meets the next section) sits off-screen. content is clipped anyway.
        // VIEWPORT-RELATIVE (calc(100vh...), not a px snapshot): the section is ScrollTrigger's pin
        // element, and ST caches the element's ORIGINAL inline height at pin-creation and re-applies
        // it on every refresh — so a px value set here (or in refresh) goes stale on a height resize
        // and overflow:hidden then crops the card/tabs. A vh string is re-applied verbatim by ST and
        // recomputed live by the browser, so the clip always equals the current viewport.
        section.style.height   = 'calc(100vh + 2px)';
        section.style.overflow = 'hidden';
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

      // snapshot each item's ORIGINAL inline style now, before any gsap.set or reparent touches
      // it — so teardown's final restore returns a pristine element (not one frozen at opacity:0).
      items.forEach(function (it) { guardStyle(it); });

      // pre-hide so reparenting into flow doesn't flash a full-opacity stack
      gsap.set(items, { opacity: 0 });

      // --- reparent tasks into the card as real flex children; neutralise the
      //     Webflow absolute positioning so the card's flex column lays them out.
      //     leave a comment placeholder at each item's original spot so teardown can
      //     restore the exact DOM position (siblings shift as items move, so a raw
      //     nextSibling ref wouldn't survive) when the breakpoint flips. ---
      items.forEach(function (it) {
        var ph = document.createComment('stack-item');
        it.parentNode.insertBefore(ph, it);
        teardown.push(function () {
          if (ph.parentNode) { ph.parentNode.insertBefore(it, ph); ph.parentNode.removeChild(ph); }
        });
        guardStyle(it);
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

      // card-head icon(s) (e.g. the ▾ next to TODAY): these live in the card head, NOT inside a
      // task row, so the head's opacity:0 doesn't cover them and they'd show before the card.
      // hide them up front and fade them in with the head on gather. (row icons are excluded —
      // they belong to their rows and pop with them.)
      var headIcons = card
        ? Array.prototype.slice.call(card.querySelectorAll('[' + ATTR + '="icon"]'))
            .filter(function (ic) { return !items.some(function (it) { return it.contains(ic); }); })
        : [];

      // capture the card's painted look, then make the face transparent so the
      // "card" visually arrives during gather (never fade card OPACITY — that would
      // hide the popping children; never SCALE the card — that would corrupt the
      // scatter deltas measured at scale 1).
      var ccs        = window.getComputedStyle(card);
      var origBg     = ccs.backgroundColor;
      var origBorder = ccs.borderColor;
      guardStyle(card);
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
        var nat = items.map(function (it) { return it.getBoundingClientRect(); });
        // fan bunches toward the CENTROID of the scatter spots (the middle of the cloud, around
        // the heading), so it fans out symmetrically in place — never from the section centre
        // (far below on a tall section) or off-screen.
        var spot = [], cx = 0, cy = 0, s;
        for (s = 0; s < items.length; s++) {
          geo[s].dx = (mi.left + frac[s].fx * mi.width)  - nat[s].left;
          geo[s].dy = (mi.top  + frac[s].fy * mi.height) - nat[s].top;
          var scX = nat[s].left + geo[s].dx + nat[s].width  / 2;
          var scY = nat[s].top  + geo[s].dy + nat[s].height / 2;
          spot.push({ x: scX, y: scY });
          cx += scX; cy += scY;
        }
        cx /= items.length; cy /= items.length;
        for (s = 0; s < items.length; s++) {
          out[s].ox = spot[s].x - cx;
          out[s].oy = spot[s].y - cy;
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
      if (headIcons.length) { gsap.set(headIcons, { opacity: 0 }); }

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
      if (headIcons.length) { gatherTl.to(headIcons, { opacity: 1, duration: CARD_FADE, ease: 'power2.out' }, 0); }
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

      // drive pop batches + gather as TRIGGERED time-based timelines (the dynamic feel). the
      // pin locks the scroll at "assembly done" until the gather finishes (see onUpdate), so
      // fast scroll can't outrun them; everything after that scrubs.
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
        // keep the viewport lock on resize: desktop clips the SECTION (viewport-relative so ST's
        // cached pin height can't go stale — see the build-time note), mobile clips the GREEN PANEL
        // in px (it's NOT the pin element, so re-setting it here on refresh does stick).
        if (isDesktop) { section.style.height = 'calc(100vh + 2px)'; }
        else if (canLeave) { greenPanel.style.height = window.innerHeight + 'px'; }
        if (cardClone) { cardClone.style.display = 'none'; }  // hide during re-measure; applyScroll re-shows if active
        contentEls.forEach(function (el) { gsap.set(el, { y: 0 }); });   // neutral for a clean measure
        measureGeo();
        measurePositions();
        computeTiming();
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
        if (activeTab >= 0) { moveIndicator(activeTab); }   // keep the elevator aligned
      }

      // the green panel = the element carrying the green bg + rounded corners. prefer an
      // explicit data-stack="green" (deterministic across projects); otherwise fall back to
      // walking up from the card to the section's direct child (which assumes a fixed nesting).
      var greenPanel = one(section, 'green');
      if (!greenPanel) {
        greenPanel = card;
        while (greenPanel.parentNode && greenPanel.parentNode !== section) { greenPanel = greenPanel.parentNode; }
      }
      var canLeave = greenPanel !== card;
      guardStyle(greenPanel);
      if (canLeave && GREEN_RADIUS) { greenPanel.style.setProperty('border-radius', GREEN_RADIUS, 'important'); }

      // MOBILE: clip the GREEN PANEL to one viewport so its tall internal spacers (the big
      // assembly margins) don't create a super-long green scroll. the stacked cards live OUTSIDE
      // the green panel, so they still scroll freely after. (desktop clips the whole section.)
      if (!isDesktop && canLeave) {
        greenPanel.style.height   = window.innerHeight + 'px';
        greenPanel.style.overflow = 'hidden';
      }

      // top hairline cover: pinning the clipped section lands on a sub-pixel, so the page cream
      // bleeds through ~1px at the very top when the green is docked. we can't cover it from
      // inside the clipped section, so a thin fixed green strip sits at viewport top (below the
      // nav), shown ONLY while the green is docked (never during scroll-in or the light reveal).
      var greenBg  = canLeave ? window.getComputedStyle(greenPanel).backgroundColor : '';
      var topCover = null;
      if (canLeave && greenBg && greenBg !== 'rgba(0, 0, 0, 0)' && greenBg !== 'transparent') {
        topCover = document.createElement('div');
        topCover.setAttribute('aria-hidden', 'true');
        topCover.style.cssText = 'position:fixed;top:0;left:0;right:0;height:3px;pointer-events:none;' +
          'display:none;z-index:' + (LIGHT_Z - 1) + ';background:' + greenBg + ';';
        document.body.appendChild(topCover);
        teardown.push(function () { if (topCover.parentNode) { topCover.parentNode.removeChild(topCover); } });
      }

      // mode swap: stamp <html> so the injected stylesheet hides the OFF-mode block, and clear any
      // stuck inline display on the IN-mode block so it can't stay hidden after a resize. guarded
      // so teardown restores the block's inline style before the other mode rebuilds.
      document.documentElement.setAttribute('data-stack-mode', isDesktop ? 'desktop' : 'mobile');
      // force-show the IN-mode wrapper(s) WHEREVER they live (document-wide, NOT scoped to the
      // pinned section — a visibility wrapper can sit outside it). the OFF-mode block is hidden by
      // the injected stylesheet. we handle every match, not just the first.
      var inSel   = isDesktop ? DESKTOP_SEL : MOBILE_SEL;
      var offSel  = isDesktop ? MOBILE_SEL  : DESKTOP_SEL;
      var inDisp  = isDesktop ? DESKTOP_DISPLAY : MOBILE_DISPLAY;
      var inBlocks = document.querySelectorAll(inSel);
      if (DEBUG) {
        console.log('[stack] build mode=' + (isDesktop ? 'desktop' : 'mobile') +
          ' | in(' + inSel + ')=' + inBlocks.length +
          ' off(' + offSel + ')=' + document.querySelectorAll(offSel).length +
          ' | html[data-stack-mode]=' + document.documentElement.getAttribute('data-stack-mode'));
      }
      Array.prototype.forEach.call(inBlocks, function (el) {
        guardStyle(el);
        el.style.display = '';                                   // 1) drop any stuck inline display
        var afterClear = window.getComputedStyle(el).display;
        if (afterClear === 'none') {                            // 2) a stylesheet rule still hides it
          el.style.setProperty('display', inDisp, 'important');
        }
        if (DEBUG) {
          console.log('[stack]   show <' + (el.tagName.toLowerCase()) + ' class="' + el.className +
            '"> afterClear=' + afterClear + ' -> ' + window.getComputedStyle(el).display);
        }
      });

      // the rest of the section below the green panel: the white transition (holds the H2)
      // and the tabs grid. we scroll the WHOLE stack up together (by S) to reveal them.
      var transWrap = section.querySelector('.meeting_transition_wrap');
      // tabs choreography container: the grid, or the desktop wrapper as a fallback.
      var tabsWrap  = isDesktop ? (section.querySelector(TABS_SEL) || section.querySelector(DESKTOP_SEL)) : null;
      var contentEls = [greenPanel, transWrap, tabsWrap].filter(Boolean);

      // card (inside the green panel) must sit ABOVE the H2 text + tabs grid where they overlap.
      // these are all transformed (gsap y) so z-index applies. green panel is lifted high (but
      // below the 999 nav) so it beats the H2/SVGs whatever their own z, carrying the card with it.
      if (greenPanel) { greenPanel.style.position = 'relative'; greenPanel.style.zIndex = '900'; }
      if (transWrap)  { guardStyle(transWrap); transWrap.style.zIndex = '1'; }
      if (tabsWrap)   { guardStyle(tabsWrap);  tabsWrap.style.zIndex  = '1'; }

      // tabs: left-column items (clickable); the scroll advances the active one while sticky.
      // state is published as `is-active` on the active tab + `data-active-tab="N"` on the tabs
      // container and the section, so Webflow content (card inner + right text) can react to it.
      var tabItems = tabsWrap ? Array.prototype.slice.call(tabsWrap.querySelectorAll('.meeting_tabs_item')) : [];
      var numTabs  = Math.max(1, tabItems.length);
      var tabTexts = section.querySelectorAll('[data-tab-text]');   // right-column text panels (per tab)
      var tabAnims = section.querySelectorAll('[data-tab-anim]');   // centre animation slots (per tab)
      var bgSvgs   = section.querySelectorAll('[data-tab-bg]');     // background line SVGs
      var tabIndicator = tabsWrap ? tabsWrap.querySelector('[data-tab-indicator]') : null; // single orange bar
      var activeTab = -1;
      var bgTargetP = 0, bgCurrentP = 0;   // lerped bg-line paint progress (see ticker below)

      // prep each bg SVG path so we can "draw" it by scrubbing stroke-dashoffset with scroll
      Array.prototype.forEach.call(bgSvgs, function (svg) {
        Array.prototype.forEach.call(svg.querySelectorAll('path'), function (p) {
          guardStyle(p);
          var len = (p.getTotalLength ? p.getTotalLength() : 0) || 1;
          p.style.strokeDasharray  = len;
          p.style.strokeDashoffset = len;                 // start un-drawn
          p._len = len;
        });
      });
      // paint the lines in-then-out across the tabs phase: each SVG owns an equal slice; over
      // its slice it draws IN (first half) then OUT (second half). tp = 0..1 tabs progress.
      function drawBg(tp) {
        var N = bgSvgs.length; if (!N) { return; }
        for (var i = 0; i < N; i++) {
          var local = (tp - i / N) * N;                   // 0..1 within this SVG's slice
          local = local < 0 ? 0 : (local > 1 ? 1 : local);
          var f = (local <= 0.5) ? (1 - local * 2) : (-(local - 0.5) * 2);  // 1->0 (in) then 0->-1 (out)
          Array.prototype.forEach.call(bgSvgs[i].querySelectorAll('path'), function (p) {
            p.style.strokeDashoffset = String(f * p._len);
          });
        }
      }

      function toggleByIndex(list, attr, n) {
        Array.prototype.forEach.call(list, function (el) {
          el.classList.toggle('is-active', parseInt(el.getAttribute(attr), 10) === n);
        });
      }
      // slide the single orange indicator to sit over the active tab (elevator).
      // CSS owns the glide (transition on transform); we just set the target y + height.
      function moveIndicator(n) {
        if (!tabIndicator || !tabItems[n]) { return; }
        // align to the tab's LABEL text (not the whole item) so the bar matches the name height
        var label = tabItems[n].querySelector('.meeting_tabs_text_wrap') || tabItems[n];
        tabIndicator.style.transform = 'translateY(' + label.offsetTop + 'px)';
        tabIndicator.style.height    = label.offsetHeight + 'px';
      }
      function setActiveTab(n) {
        if (n === activeTab) { return; }
        activeTab = n;
        for (var i = 0; i < tabItems.length; i++) { tabItems[i].classList.toggle('is-active', i === n); }
        if (tabsWrap) { tabsWrap.setAttribute('data-active-tab', String(n)); }
        section.setAttribute('data-active-tab', String(n));
        toggleByIndex(tabTexts, 'data-tab-text', n);   // right text
        toggleByIndex(tabAnims, 'data-tab-anim', n);   // centre animation slot
        moveIndicator(n);                              // elevator to the active tab
      }

      // measured each refresh: how far the card rises (bottom -> centre), and how far the
      // content must scroll (S) to bring the tabs-grid centre to screen centre (= where the
      // card lands). sCardStart = the S at which the H2 is above the card and it begins rising.
      var cardRiseDist = 0, sCenter = 0, sCardStart = 0;
      function measurePositions() {
        contentEls.forEach(function (el) { gsap.set(el, { y: 0 }); });
        gsap.set(card, { y: 0 });
        var mid  = window.innerHeight * CARD_TARGET;
        var sTop = section.getBoundingClientRect().top;
        var cr   = card.getBoundingClientRect();
        cardRiseDist = ((cr.top - sTop) + cr.height / 2) - mid;
        if (cardRiseDist < 0) { cardRiseDist = 0; }
        if (tabsWrap) {
          var tr = tabsWrap.getBoundingClientRect();
          sCenter = ((tr.top - sTop) + tr.height / 2) - mid;
        } else {
          sCenter = cardRiseDist;
        }
        if (sCenter < cardRiseDist) { sCenter = cardRiseDist; }
        sCardStart = sCenter - cardRiseDist;
      }

      // dark/light SPLIT: a light-themed clone of the card sits exactly over the real (dark)
      // card, clipped at the green/white boundary (the green panel's bottom edge). So the card
      // reads DARK where it overlaps the green and LIGHT where it overlaps the white — split
      // right on the line. The real card stays dark; the clone supplies the light half.
      var cardClone = null;
      if (LIGHT_REVEAL && isDesktop) {   // light dark/light split is a desktop-only effect
        cardClone = card.cloneNode(true);
        cardClone.removeAttribute(ATTR);
        // clone lives INSIDE the card (absolute, inset:0) so it's pinned to the card by the DOM
        // and inherits every transform — no fixed-position chasing, so no sub-pixel seam / green
        // peek / resize drift. only its clip line changes. z above the rows, below the nav.
        cardClone.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;margin:0;' +
          'box-sizing:border-box;pointer-events:none;overflow:hidden;border-radius:inherit;' +
          'z-index:' + LIGHT_Z + ';display:none;' +
          'background:' + LIGHT_CARD_BG + ';color:' + LIGHT_TEXT + ';will-change:clip-path;';
        Array.prototype.forEach.call(cardClone.querySelectorAll('*'), function (el) { el.style.transform = ''; el.style.opacity = '1'; });
        Array.prototype.forEach.call(cardClone.querySelectorAll('[data-stack="item"], .meeting_item'), function (el) { el.style.backgroundColor = LIGHT_ROW_BG; });
        Array.prototype.forEach.call(cardClone.querySelectorAll('.meeting_item_text, [data-stack="card-head"]'), function (el) { el.style.color = LIGHT_TEXT; });
        Array.prototype.forEach.call(cardClone.querySelectorAll('.meeting_check, [data-stack="check"]'), function (el) { el.style.borderColor = LIGHT_TEXT; });
        // the clone copied the card's (dark) border — recolor it to the light face, and add a
        // light box-shadow ring so any 1px dark anti-alias edge of the real card is masked.
        cardClone.style.borderColor = LIGHT_CARD_BG;
        cardClone.style.boxShadow   = '0 0 0 1.5px ' + LIGHT_CARD_BG;
        // NOTE: no position change on the card — it's always GSAP-transformed (translate), and a
        // transform is a containing block for absolute children, so the clone's inset:0 anchors to
        // the card automatically. (Setting position:relative here dropped the card behind the H2.)
        card.appendChild(cardClone);
        teardown.push(function () { if (cardClone.parentNode) { cardClone.parentNode.removeChild(cardClone); } });
        // icons: recolor ONLY the property each shape actually paints with — stroke for line
        // icons (e.g. the caret: fill:none), fill for solid ones — so a fill never floods a
        // stroked shape. runs post-append so getComputedStyle is valid. mark each data-stack="icon".
        Array.prototype.forEach.call(cardClone.querySelectorAll('[data-stack="icon"]'), function (icon) {
          icon.style.color = LIGHT_TEXT;   // masked-div icons using background:currentColor
          var shapes = icon.querySelectorAll('path, line, polyline, polygon, circle, rect, ellipse');
          Array.prototype.forEach.call(shapes.length ? shapes : [icon], function (p) {
            var cs = window.getComputedStyle(p);
            var none = { 'none': 1, 'rgba(0, 0, 0, 0)': 1, 'transparent': 1 };
            if (cs.fill   && !none[cs.fill])   { p.style.fill   = LIGHT_TEXT; }
            if (cs.stroke && !none[cs.stroke]) { p.style.stroke = LIGHT_TEXT; }
          });
        });
      }

      // --- single master pin: assembly -> green hold -> content scroll (green out, H2 in,
      //     card rises to centre) -> sticky hold at centre. the content-scroll length is the
      //     measured scroll distance (sCenter), so timing is recomputed on refresh. ---
      var assemblySteps = STEP_VH * stepCount;
      var totalVH = 0, pA = 0, pG = 0, pHold = 0, tabSpan = 1;
      var snapPoints = [];
      function computeTiming() {
        // MOBILE: no content-scroll and no tabs — the pin is just assembly (+ green hold), then
        // release into normal scroll. DESKTOP: content-scroll brings the tabs to centre + tabs phase.
        var contentVH = (isDesktop && window.innerHeight) ? (sCenter / window.innerHeight) : 0;
        // each tab gets a full step to transition through, except the LAST which only
        // holds END_HOLD_VH before release — kills the ~100vh of empty scroll at the end.
        var tabsVH    = isDesktop ? ((numTabs - 1) * TAB_STEP_VH + END_HOLD_VH) : 0;   // sticky tabs phase
        tabSpan = tabsVH / TAB_STEP_VH || 1;   // tabs-phase length in "steps" (last one is short)
        totalVH = assemblySteps + GREEN_HOLD_VH + contentVH + tabsVH;
        pA    = assemblySteps / totalVH;                                        // assembly ends
        pG    = (assemblySteps + GREEN_HOLD_VH) / totalVH;                      // green hold ends -> content scroll begins
        pHold = (assemblySteps + GREEN_HOLD_VH + contentVH) / totalVH;          // card centred / tabs phase begins
        snapPoints = [0].concat(popThresh, [gatherThresh]).map(function (v) { return v * pA; }).concat([pG, pHold, 1]);
      }
      computeTiming();

      // one place that maps scroll progress -> every visual (assembly, rise, green
      // leave, light reveal, theme). Used by both onUpdate and refresh so the state
      // is always self-consistent, even on fast scroll or resize.
      function applyScroll(p) {
        var ap = pA > 0 ? Math.min(1, p / pA) : 1;
        update(ap);

        // fan-out: rows start bunched at centre (a fist) and open OUT to their scatter spots as
        // scroll progresses. the gather timeline owns x/y while it is animating in EITHER direction —
        // only take over once it's fully settled at the scattered end (progress 0). otherwise, on a
        // reverse the scrubbed fan-out would snap x/y to the scattered spot while gatherTl.reverse()
        // is still tweening them back = the "jump to place then re-animate" jank.
        if (!gatherOn && gatherTl.progress() === 0) {
          var t    = spreadT(ap);              // 0 = tight fist, 1 = full scatter spot
          var pull = (1 - FIST) * (1 - t);     // amount to pull each row back toward centre
          for (var si = 0; si < items.length; si++) {
            gsap.set(items[si], {
              x: geo[si].dx - out[si].ox * pull,
              y: geo[si].dy - out[si].oy * pull
            });
          }
        }

        // DESKTOP: scroll the stack (green + H2 + tabs) up by S and rise the card to centre.
        // MOBILE: assembly only — nothing scrolls, the card stays where it assembled, and the pin
        // simply releases after (normal scroll then carries the stacked cards up below).
        if (isDesktop) {
          var S;
          if (p <= pG)         { S = 0; }
          else if (p >= pHold) { S = sCenter; }
          else                 { S = (pHold > pG) ? ((p - pG) / (pHold - pG)) * sCenter : sCenter; }
          for (var ci = 0; ci < contentEls.length; ci++) { gsap.set(contentEls[ci], { y: -S }); }
          gsap.set(card, { y: S - Math.min(cardRiseDist, Math.max(0, S - sCardStart)) });
        }

        // green panel corners, PER EDGE: an edge flush to the viewport squares (full-bleed);
        // an edge floating inside the viewport keeps the radius. so docked-at-top -> square top,
        // green bottom sitting mid-screen (cream below) -> rounded bottom.
        if (canLeave && GREEN_RADIUS) {
          var maxR = parseFloat(GREEN_RADIUS) || 0;
          var gr   = greenPanel.getBoundingClientRect();
          var vh   = window.innerHeight;
          var topR = (gr.top    <= 1)      ? 0 : Math.min(maxR, gr.top);
          var botR = (gr.bottom >= vh - 1) ? 0 : Math.min(maxR, vh - gr.bottom);
          greenPanel.style.setProperty('border-top-left-radius',     topR + 'px', 'important');
          greenPanel.style.setProperty('border-top-right-radius',    topR + 'px', 'important');
          greenPanel.style.setProperty('border-bottom-left-radius',  botR + 'px', 'important');
          greenPanel.style.setProperty('border-bottom-right-radius', botR + 'px', 'important');
          // hairline cover: only while the top is docked (squared) AND the green still spans the
          // top edge — never during the rounded scroll-in or once the green has left upward.
          if (topCover) { topCover.style.display = (topR === 0 && gr.bottom > 3) ? 'block' : 'none'; }
        }

        // dark/light SPLIT: keep the light clone exactly over the real (dark) card, clipped at
        // the green/white boundary (green panel's bottom edge) — dark above the line, light below.
        // ONLY while the section is actively pinned — otherwise a refresh/resize would re-show
        // the fixed clone at centre as a stray "duplicate card". When inactive we leave it hidden
        // (or parked by onLeave) and never reposition it.
        if (cardClone && st && st.isActive) {
          var cr = card.getBoundingClientRect();
          var B  = canLeave ? greenPanel.getBoundingClientRect().bottom : -1e9;
          var topClip = Math.max(0, Math.min(cr.height, B - cr.top));   // boundary in card-local px
          if (p >= pHold) { topClip = 0; }   // tabs phase: split complete -> light covers fully
          if (topClip >= cr.height - 0.5) {
            cardClone.style.display = 'none';                 // fully over green -> all dark
          } else {
            // clone is a card child at inset:0 — it already tracks the card, just clip the line
            cardClone.style.display  = '';
            cardClone.style.clipPath = 'inset(' + topClip + 'px 0 0 0)';
          }
        }

        // tabs (DESKTOP only): while the card is sticky at centre [pHold..1], the scroll advances
        // the active tab (step-based). mobile has no tabs.
        if (isDesktop) {
          var tn = 0;
          if (p > pHold && pHold < 1) {
            tn = Math.floor((p - pHold) / (1 - pHold) * tabSpan);
            if (tn < 0) { tn = 0; } else if (tn > numTabs - 1) { tn = numTabs - 1; }
          }
          setActiveTab(tn);
          // background lines: publish the target; a lerped ticker eases the actual paint.
          bgTargetP = (p > pHold && pHold < 1) ? (p - pHold) / (1 - pHold) : 0;
        }
      }

      // restore the panel's rounded top once the section is released (scrolled past either
      // end) — applyScroll only runs while pinned, so the docked 0px would otherwise stick.
      function restoreTopRadius() {
        if (!canLeave || !GREEN_RADIUS) { return; }
        greenPanel.style.setProperty('border-radius', GREEN_RADIUS, 'important');
      }

      var st = ScrollTrigger.create({
        trigger: section, start: 'top top',
        end: function () { return '+=' + (window.innerHeight * totalVH); },
        pin: true, invalidateOnRefresh: true,
        // this pinned section sits ABOVE the slider's pinned section on the page. with multiple
        // pins, ScrollTrigger must refresh top-to-bottom so each pin-spacer is measured against the
        // ones above it. on a matchMedia rebuild this trigger is recreated AFTER the slider exists,
        // so without an explicit priority the slider refreshes first and this section's spacer
        // lands in the wrong place — dropping the tabs BELOW the slider. higher priority = refresh
        // first. (slider.js keeps the default 0.)
        refreshPriority: 1,
        // keep the pin bounds current so captureAnchor (which fires before the next rebuild's
        // revert) has this mode's final start/end to anchor against.
        onRefresh: function (self) { prevStart = self.start; prevEnd = self.end; },
        onRefreshInit: refresh,
        onUpdate: function (self) {
          var p = self.progress;
          // FORWARD lock: hold the scroll at "assembly done" (pG) until the time-based gather finishes
          // playing IN, so fast scroll can't outrun it. once complete, normal scrub resumes.
          var gThreshP = gatherThresh * pA;               // section-progress of the gather boundary
          if (p > pG && gatherOn && gatherTl.progress() < 1) {
            self.scroll(self.start + pG * (self.end - self.start));
            p = pG;
          }
          // REVERSE lock: once the gather has begun playing back OUT (gatherOn cleared, tl not yet at
          // 0), hold the scroll just below the gather boundary until it finishes. this keeps the
          // scrubbed fan-out from racing ahead of the time-based reverse, and leaves the scroll at
          // ~gatherThresh so fan-out resumes exactly at the scattered spot = seamless hand-off.
          else if (p < gThreshP && !gatherOn && gatherTl.progress() > 0) {
            var holdP = Math.max(0, gThreshP - 0.0005);   // a hair below so update() won't re-trigger
            self.scroll(self.start + holdP * (self.end - self.start));
            p = holdP;
          }
          applyScroll(p);
        },
        // clone is a card child now — it scrolls off WITH the card (stays light), no parking needed.
        onLeave:     function () { if (topCover) { topCover.style.display = 'none'; } restoreTopRadius(); },
        onLeaveBack: function () { if (cardClone) { cardClone.style.display = 'none'; } if (topCover) { topCover.style.display = 'none'; } restoreTopRadius(); },
        snap: SNAP ? { snapTo: snapPoints, duration: SNAP_DUR, ease: 'power1.inOut', inertia: false } : false
      });

      function logChoreo(tag) {
        if (!DEBUG) { return; }
        var sr = section.getBoundingClientRect();
        console.log('[stack] choreography(' + tag + ') mode=' + (isDesktop ? 'desktop' : 'mobile') +
          ' rebuild=' + isRebuild + ' tabsWrap=' + !!tabsWrap + ' numTabs=' + numTabs +
          ' totalVH=' + totalVH.toFixed(2) + ' secH=' + section.style.height +
          ' pinLen=' + Math.round(st.end - st.start) +
          ' stStart=' + Math.round(st.start) + ' stEnd=' + Math.round(st.end) +
          // docHeight is the real test: after growing to desktop the pin-spacer must add ~pinLen
          // of scrollable height. if docHeight barely exceeds innerH, the spacer is short and the
          // tabs phase is unreachable — that's the scale-up bug.
          ' docHeight=' + Math.round(document.documentElement.scrollHeight) +
          ' scrollY=' + Math.round(window.scrollY) + ' innerH=' + window.innerHeight);
      }
      logChoreo('build');

      // SCALE-UP FIX: on a breakpoint rebuild, ScrollTrigger's pin-spacer can be created short
      // (it doesn't add the pin's full scroll height until layout settles), so growing mobile ->
      // desktop leaves the page too short to scroll into the tabs phase — the tabs never show.
      // force a refresh on the next frame (rebuild only, so the initial load isn't disturbed) to
      // rebuild the spacer at full height. guarded so it can't fire after this build is torn down.
      if (isRebuild && typeof window.requestAnimationFrame === 'function') {
        var buildAlive = true;
        teardown.push(function () { buildAlive = false; });
        window.requestAnimationFrame(function () {
          if (!buildAlive) { return; }
          window.requestAnimationFrame(function () {
            if (!buildAlive) { return; }
            ScrollTrigger.refresh();
            // ANCHOR restore (after refresh, so st.start/end are final AND refresh's own scroll
            // reset is overridden). map the pre-cross position onto the rebuilt layout.
            if (anchorY != null && anchorStart != null && anchorEnd != null) {
              var target;
              if (anchorY <= anchorStart)    { target = anchorY; }                     // above the pin
              else if (anchorY <= anchorEnd) { target = st.start; }                    // inside -> snap to start
              else                           { target = anchorY + (st.end - anchorEnd); } // below -> shift by delta
              window.scrollTo(0, Math.max(0, Math.round(target)));
              anchorY = anchorStart = anchorEnd = null;   // consume, so it can't reapply
            }
            logChoreo('post-refresh');
          });
        });
      }

      // ease the bg-line paint toward the scroll target every frame, so lines draw
      // in/out smoothly instead of snapping with the scrollbar. guarded so a hiccup
      // here can never stall GSAP's shared ticker. removed on breakpoint teardown so
      // the callbacks don't accumulate across rebuilds.
      var bgTicker = function () {
        try {
          var diff = bgTargetP - bgCurrentP;
          if (Math.abs(diff) < 0.0005) { return; }
          var dt = gsap.ticker.deltaRatio();                  // frame-rate independent
          bgCurrentP += diff * (1 - Math.pow(1 - BG_SMOOTH, dt));
          drawBg(bgCurrentP);
        } catch (e) { /* never let a paint hiccup break the global ticker */ }
      };
      gsap.ticker.add(bgTicker);
      teardown.push(function () { gsap.ticker.remove(bgTicker); });

      // click a tab -> jump to the middle of that tab's slice
      tabItems.forEach(function (item, i) {
        guardStyle(item);
        item.style.cursor = 'pointer';
        var onClick = function () {
          // land in the MIDDLE of this tab's slice using the step-based mapping (the last tab's
          // slice is short — END_HOLD — so uniform math overshot it to the very end / leave).
          var last = numTabs - 1;
          var centerProg = (i < last) ? (i + 0.5) / tabSpan : ((last / tabSpan) + 1) / 2;
          var centreP = pHold + centerProg * (1 - pHold);
          // pre-seed the bg paint at the START of the destination line's slice, so the lerp
          // draws only that line in — instead of cycling every line on the way.
          var N = bgSvgs.length || 1;
          bgCurrentP = Math.min(N - 1, Math.floor(centerProg * N)) / N;
          // jump instantly so the scroll doesn't cross every tab; only the target fires.
          window.scrollTo({ top: st.start + centreP * (st.end - st.start), behavior: 'auto' });
        };
        item.addEventListener('click', onClick);
        teardown.push(function () { item.removeEventListener('click', onClick); });
      });

      // cleanup for this breakpoint: run the tracked undos newest-first so the DOM/style state
      // returns to what the OTHER mode's builder will re-measure against. matchMedia already
      // kills `st` (+ its pin-spacers) and reverts every gsap.set for us.
      return function cleanup() {
        for (var i = teardown.length - 1; i >= 0; i--) {
          try { teardown[i](); } catch (e) { /* keep tearing down the rest */ }
        }
      };
    });

    // re-measure once layout & webfonts settle (avoids sizing off pre-font metrics). added once
    // globally (NOT inside matchMedia) so it doesn't accumulate a listener per rebuild.
    function relayout() { ScrollTrigger.refresh(); }
    window.addEventListener('load', relayout);
    if (document.fonts && document.fonts.ready) { document.fonts.ready.then(relayout); }

    // VIEWPORT-SIZE watchdog: the desktop section is clipped to one viewport via a PIXEL height
    // (innerHeight+2). That height is a one-shot snapshot taken when the build/refresh runs — and a
    // height-only resize (no 992px crossing) doesn't re-fire matchMedia, while a plain 'resize'
    // event doesn't always reach ScrollTrigger in embedded/devtools/mobile contexts. So the height
    // goes stale (e.g. measured at innerH=348 mid-drag, then the window settles at 617) and
    // overflow:hidden crops the card + tabs. A ResizeObserver fires reliably on the real viewport
    // box; when its w/h actually changes we refresh (debounced), which re-runs refresh() and
    // re-asserts the section height at the CURRENT innerHeight. Guarded against feedback: we only
    // act when window.innerWidth/innerHeight themselves change, not on content-driven reflow.
    if (typeof window.ResizeObserver !== 'undefined') {
      var lastVW = window.innerWidth, lastVH = window.innerHeight, roTimer = null;
      var ro = new ResizeObserver(function () {
        if (window.innerWidth === lastVW && window.innerHeight === lastVH) { return; }
        lastVW = window.innerWidth; lastVH = window.innerHeight;
        if (roTimer) { clearTimeout(roTimer); }
        roTimer = setTimeout(function () { ScrollTrigger.refresh(); }, 150);
      });
      ro.observe(document.documentElement);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());
