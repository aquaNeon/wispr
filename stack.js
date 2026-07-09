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
  var LIGHT_Z        = 9990;          // clone stacking — above section content, BELOW the nav (9999)
  var LIGHT_TEXT     = '#1A1A1A';     // text + check outline in the light theme
  // NOTE: the white-section H2 is plain Webflow content now (scrolls normally) — not driven here.

  var ATTR  = 'data-stack';
  var ORDER = 'data-stack-order';

  function sel(root, name) { return root.querySelectorAll('[' + ATTR + '="' + name + '"]'); }
  function one(root, name) { return root.querySelector('[' + ATTR + '="' + name + '"]'); }
  function smooth(t) { return t < 0 ? 0 : (t > 1 ? 1 : t * t * (3 - 2 * t)); }

  function init() {
    // desktop-only: below Webflow's tablet breakpoint (991px) we don't pin or animate.
    // the separate static mobile block (stacked, per-tab) takes over via CSS.
    // NOTE: crossing 991px live (e.g. rotating a tablet) needs a reload to switch modes.
    if (!window.matchMedia('(min-width: 992px)').matches) { return; }

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

    // lock the section to one viewport + clip: keeps the green panel viewport-sized (so its
    // corners are on-screen) AND stops the tall natural height from adding empty scroll after
    // the pin. the animation overlays every element into this frame via transforms anyway.
    section.style.height   = window.innerHeight + 'px';
    section.style.overflow = 'hidden';

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
      section.style.height = window.innerHeight + 'px';   // keep the viewport lock integer-exact on resize
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
    if (canLeave && GREEN_RADIUS) { greenPanel.style.setProperty('border-radius', GREEN_RADIUS, 'important'); }

    // the rest of the section below the green panel: the white transition (holds the H2)
    // and the tabs grid. we scroll the WHOLE stack up together (by S) to reveal them.
    var transWrap = section.querySelector('.meeting_transition_wrap');
    var tabsWrap  = section.querySelector('.meeting_tabs_contain');
    var contentEls = [greenPanel, transWrap, tabsWrap].filter(Boolean);

    // card (inside the green panel) must sit ABOVE the H2 text + tabs grid where they
    // overlap. these are all transformed (gsap y) so z-index applies.
    if (greenPanel) { greenPanel.style.zIndex = '5'; }
    if (transWrap)  { transWrap.style.zIndex  = '1'; }
    if (tabsWrap)   { tabsWrap.style.zIndex   = '1'; }

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
    if (LIGHT_REVEAL) {
      cardClone = card.cloneNode(true);
      cardClone.removeAttribute(ATTR);
      cardClone.style.cssText = 'position:fixed;margin:0;box-sizing:border-box;pointer-events:none;' +
        'z-index:' + LIGHT_Z + ';display:none;background:' + LIGHT_CARD_BG + ';color:' + LIGHT_TEXT + ';' +
        'will-change:clip-path,top,left,width;';
      Array.prototype.forEach.call(cardClone.querySelectorAll('*'), function (el) { el.style.transform = ''; el.style.opacity = '1'; });
      Array.prototype.forEach.call(cardClone.querySelectorAll('[data-stack="item"], .meeting_item'), function (el) { el.style.backgroundColor = LIGHT_ROW_BG; });
      Array.prototype.forEach.call(cardClone.querySelectorAll('.meeting_item_text, [data-stack="card-head"]'), function (el) { el.style.color = LIGHT_TEXT; });
      Array.prototype.forEach.call(cardClone.querySelectorAll('.meeting_check, [data-stack="check"]'), function (el) { el.style.borderColor = LIGHT_TEXT; });
      document.body.appendChild(cardClone);
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
      var contentVH = window.innerHeight ? (sCenter / window.innerHeight) : 1;
      // each tab gets a full step to transition through, except the LAST which only
      // holds END_HOLD_VH before release — kills the ~100vh of empty scroll at the end.
      var tabsVH    = (numTabs - 1) * TAB_STEP_VH + END_HOLD_VH;              // sticky tabs phase
      tabSpan = tabsVH / TAB_STEP_VH;   // tabs-phase length in "steps" (last one is short)
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

      // content scroll S: 0 through assembly + green hold, ramps 0 -> sCenter over the
      // content phase, then frozen at sCenter for the sticky hold.
      var S;
      if (p <= pG)         { S = 0; }
      else if (p >= pHold) { S = sCenter; }
      else                 { S = (pHold > pG) ? ((p - pG) / (pHold - pG)) * sCenter : sCenter; }

      // scroll the whole stack (green + transition H2 + tabs) up by S
      for (var ci = 0; ci < contentEls.length; ci++) { gsap.set(contentEls[ci], { y: -S }); }

      // card: held at the bottom (+S cancels the green's -S) until the H2 is above it
      // (S >= sCardStart), then rises in unison to centre, then sticky.
      gsap.set(card, { y: S - Math.min(cardRiseDist, Math.max(0, S - sCardStart)) });

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
          cardClone.style.display  = '';
          cardClone.style.position = 'fixed';   // restore if parked on a prior leave
          cardClone.style.top      = cr.top + 'px';
          cardClone.style.left     = cr.left + 'px';
          cardClone.style.width    = cr.width + 'px';
          cardClone.style.clipPath = 'inset(' + topClip + 'px 0 0 0)';
        }
      }

      // tabs: while the card is sticky at centre [pHold..1], the scroll advances the active
      // tab (equal slice each). before that, tab 0 is the default.
      var tn = 0;
      if (p > pHold && pHold < 1) {
        // map by STEPS (not equal fractions) so the short last-tab hold doesn't shrink
        // every tab's window — tabs 0..n-2 get a full step, the last gets END_HOLD.
        tn = Math.floor((p - pHold) / (1 - pHold) * tabSpan);
        if (tn < 0) { tn = 0; } else if (tn > numTabs - 1) { tn = numTabs - 1; }
      }
      setActiveTab(tn);

      // background lines: publish the target; a lerped ticker eases the actual paint
      // so the draw isn't harshly welded to the raw scroll.
      bgTargetP = (p > pHold && pHold < 1) ? (p - pHold) / (1 - pHold) : 0;
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
      onRefreshInit: refresh,
      onUpdate: function (self) {
        var p = self.progress;
        // lock the scroll at "assembly done" (pG) until the time-based gather finishes, so
        // fast scroll can't outrun it. once complete, normal scrub resumes.
        if (p > pG && gatherOn && gatherTl.progress() < 1) {
          self.scroll(self.start + pG * (self.end - self.start));
          p = pG;
        }
        applyScroll(p);
      },
      // scrolling out the BOTTOM: park the light clone at its doc position so it scrolls away
      // still light (no dark-card flash). the isActive gate stops it re-showing on rescale.
      onLeave: function () {
        if (cardClone) {
          var cr = card.getBoundingClientRect();
          cardClone.style.position = 'absolute';
          cardClone.style.top  = (window.pageYOffset + cr.top) + 'px';
          cardClone.style.left = (window.pageXOffset + cr.left) + 'px';
        }
        restoreTopRadius();
      },
      onLeaveBack: function () { if (cardClone) { cardClone.style.display = 'none'; } restoreTopRadius(); },
      snap: SNAP ? { snapTo: snapPoints, duration: SNAP_DUR, ease: 'power1.inOut', inertia: false } : false
    });

    // ease the bg-line paint toward the scroll target every frame, so lines draw
    // in/out smoothly instead of snapping with the scrollbar. guarded so a hiccup
    // here can never stall GSAP's shared ticker.
    gsap.ticker.add(function () {
      try {
        var diff = bgTargetP - bgCurrentP;
        if (Math.abs(diff) < 0.0005) { return; }
        var dt = gsap.ticker.deltaRatio();                  // frame-rate independent
        bgCurrentP += diff * (1 - Math.pow(1 - BG_SMOOTH, dt));
        drawBg(bgCurrentP);
      } catch (e) { /* never let a paint hiccup break the global ticker */ }
    });

    // click a tab -> jump to the middle of that tab's slice
    tabItems.forEach(function (item, i) {
      item.style.cursor = 'pointer';
      item.addEventListener('click', function () {
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
      });
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
