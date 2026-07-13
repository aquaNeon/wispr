(function () {

  // ---- config ----
  var STEP_VH       = 0.7;
  var SNAP          = false;   // magnetic scroll-to-nearest-step
  var SNAP_DUR      = 0.3;

  var POP_BATCH     = 2;
  var POP_STAGGER   = 0.05;
  var POP_DUR       = 0.34;
  var POP_BUNCH     = 0.55;    // <1 pulls pops earlier & tighter
  var POP_LEAD      = 0.06;    // scroll lead so the first batch animates in (not pre-popped)
  var POP_SCALE_X   = 0.35;
  var POP_SCALE_Y   = 0.85;
  var POP_EASE      = 'back.out(2)';
  var FIST          = 0.5;     // fan-out tightness: 0.5 = start half-open, 1 = pop in place

  var CHECK_DELAY   = 0.18;
  var CHECK_DUR     = 0.4;
  var CHECK_EASE    = 'back.out(2.4)';

  var GATHER_STAGGER = 0.09;
  var GATHER_DUR     = 0.7;
  var GATHER_EASE    = 'power3.inOut';
  var CARD_FADE      = 0.4;
  var LANDED_BG      = '';                      // '' = read LANDED_BG_VAR
  var LANDED_BG_VAR  = '--base-color--fathom';  // row bg once gathered

  var HOLD_STEPS    = 0;

  // pin sequence: assemble -> green hold -> content scroll (card rises to centre) -> sticky tabs
  var CARD_TARGET    = 0.5;    // viewport fraction the card centres on
  var GREEN_HOLD_VH  = 0.25;
  var TAB_STEP_VH    = 1.0;    // scroll length per tab while sticky
  var END_HOLD_VH    = 0.35;   // short hold on the last tab before release
  var BG_SMOOTH      = 0.12;   // ease of the bg-line paint toward scroll

  var GREEN_RADIUS   = '80px'; // forced inline (!important); '' = leave to CSS

  // dark/light split reveal (desktop only)
  var LIGHT_REVEAL   = true;
  var LIGHT_CARD_BG  = '#E4E4D0';
  var LIGHT_ROW_BG   = '#FFFDF9';
  var LIGHT_Z        = 990;    // above section content, below the nav (999)
  var LIGHT_TEXT     = '#1A1A1A';

  var ATTR  = 'data-stack';
  var ORDER = 'data-stack-order';

  // wrappers that swap by breakpoint (mark in Webflow, class-agnostic):
  //   data-stack="desktop" = tabs wrapper, data-stack="mobile" = stacked-cards wrapper
  var DESKTOP_SEL = '[' + ATTR + '="desktop"]';
  var MOBILE_SEL  = '[' + ATTR + '="mobile"]';
  var TABS_SEL    = '.meeting_tabs_contain';   // tabs grid; falls back to the desktop wrapper
  var DESKTOP_DISPLAY = 'block';   // forced only if a stylesheet rule still hides the shown wrapper
  var MOBILE_DISPLAY  = 'block';

  // narrow the tabs copy below this width so it can't collide with the fixed-width card
  var COPY_SEL       = '.tab_copy';
  var COPY_NARROW_BP = 1180;
  var COPY_NARROW_MAXW = '30ch';

  var DEBUG = false;   // logs the mode swap + choreography measurements to the console

  // ---- helpers ----
  function sel(root, name) { return root.querySelectorAll('[' + ATTR + '="' + name + '"]'); }
  function one(root, name) { return root.querySelector('[' + ATTR + '="' + name + '"]'); }
  function smooth(t) { return t < 0 ? 0 : (t > 1 ? 1 : t * t * (3 - 2 * t)); }

  function init() {
    if (typeof window.gsap === 'undefined' || typeof window.ScrollTrigger === 'undefined') {
      console.warn('[stack] GSAP + ScrollTrigger required before this script.');
      return;
    }
    gsap.registerPlugin(ScrollTrigger);

    // injected once: hide the off-mode block per data-stack-mode, and narrow the tabs copy
    if (!document.getElementById('stack-mode-style')) {
      var ms = document.createElement('style');
      ms.id = 'stack-mode-style';
      ms.textContent =
        'html[data-stack-mode="desktop"] ' + MOBILE_SEL  + '{display:none !important;}' +
        'html[data-stack-mode="mobile"] '  + DESKTOP_SEL + '{display:none !important;}' +
        (COPY_SEL ? ('@media (max-width:' + COPY_NARROW_BP + 'px){' + COPY_SEL +
          '{max-width:' + COPY_NARROW_MAXW + ';}}') : '');
      document.head.appendChild(ms);
    }

    // anchor scroll restoration across a breakpoint cross: registered BEFORE gsap.matchMedia so it
    // captures the scroll + pin bounds ahead of the revert. only the stack pin's length differs.
    var prevStart = null, prevEnd = null;
    var anchorY = null, anchorStart = null, anchorEnd = null;
    var bpMQ = window.matchMedia('(min-width: 992px)');
    function captureAnchor() {
      anchorY = window.pageYOffset || window.scrollY || 0;
      anchorStart = prevStart; anchorEnd = prevEnd;
    }
    if (bpMQ.addEventListener) { bpMQ.addEventListener('change', captureAnchor); }
    else if (bpMQ.addListener) { bpMQ.addListener(captureAnchor); }

    // desktop (>=992) = full choreography; mobile (<=991) = assembly only. rebuilt on each cross;
    // matchMedia auto-reverts the ScrollTrigger + gsap.sets, teardown[] undoes the rest.
    var builtOnce = false;   // false only for the initial build
    var mm = gsap.matchMedia();
    mm.add({ isDesktop: '(min-width: 992px)', isMobile: '(max-width: 991px)' }, function (ctx) {
      var isDesktop = ctx.conditions.isDesktop;
      var isRebuild = builtOnce; builtOnce = true;

      var teardown = [];
      // snapshot + restore an element's inline style attribute (undoes every manual .style write)
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

      // desktop: clip the section to one viewport. calc(100vh) (not a px snapshot) so ST's cached
      // pin height can't go stale on a height resize. mobile keeps natural height for the stack below.
      if (isDesktop) {
        section.style.height   = 'calc(100vh + 2px)';
        section.style.overflow = 'hidden';
      }

      // FLIP: record each item's scattered spot as a fraction of its frame, before touching the DOM
      var scatterCtx = items[0].parentNode;
      var mi0 = scatterCtx.getBoundingClientRect();
      var frac = items.map(function (it) {
        var r = it.getBoundingClientRect();
        return {
          fx: mi0.width  ? (r.left - mi0.left) / mi0.width  : 0,
          fy: mi0.height ? (r.top  - mi0.top)  / mi0.height : 0
        };
      });

      items.forEach(function (it) { guardStyle(it); });   // snapshot pristine style before any gsap.set
      gsap.set(items, { opacity: 0 });

      // reparent tasks into the card as flex children; a comment placeholder marks the original spot
      items.forEach(function (it) {
        var ph = document.createComment('stack-item');
        it.parentNode.insertBefore(ph, it);
        teardown.push(function () {
          if (ph.parentNode) { ph.parentNode.insertBefore(it, ph); ph.parentNode.removeChild(ph); }
        });
        guardStyle(it);
        card.appendChild(it);
        it.style.position   = 'relative';
        it.style.inset      = 'auto';
        it.style.margin     = '0';
        it.style.width      = '';
        it.style.boxSizing  = 'border-box';
        it.style.whiteSpace = 'nowrap';
        it.style.willChange = 'transform, opacity';
      });

      var checks = items.map(function (it) { return it.querySelector('[' + ATTR + '="check"], .meeting_check'); });

      // card-head icons (not inside a row): hidden up front, faded in with the head on gather
      var headIcons = card
        ? Array.prototype.slice.call(card.querySelectorAll('[' + ATTR + '="icon"]'))
            .filter(function (ic) { return !items.some(function (it) { return it.contains(ic); }); })
        : [];

      // capture the card's painted look, then make its face transparent (fades in during gather)
      var ccs        = window.getComputedStyle(card);
      var origBg     = ccs.backgroundColor;
      var origBorder = ccs.borderColor;
      var origShadow = ccs.boxShadow;
      guardStyle(card);
      card.style.boxSizing  = 'border-box';
      card.style.willChange = 'transform';

      var geo = items.map(function () { return { dx: 0, dy: 0 }; });
      var out = items.map(function () { return { ox: 0, oy: 0 }; });   // scatter-spot -> centroid vector

      // scatter deltas: read natural rects (transforms cleared), invert against the scatter fractions
      function measureGeo() {
        gsap.set(items, { x: 0, y: 0, scaleX: 1, scaleY: 1 });
        gsap.set(card,  { y: 0 });
        var mi  = scatterCtx.getBoundingClientRect();
        var nat = items.map(function (it) { return it.getBoundingClientRect(); });
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

      // pop timelines (batches): reveal in place at the scatter spot
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

      // gather timeline: card face fades in, items fall into their real slots
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

      function spreadT(ap) {   // fan-out growth: 0 at start of pops -> full as gather begins
        if (gatherThresh <= 0) { return 0; }
        return smooth(ap / gatherThresh);
      }

      // play/reverse the pop batches + gather as triggered, time-based timelines
      function update(p) {
        var i;
        for (i = 0; i < popTls.length; i++) {
          if (p >= popThresh[i] && !popPlayed[i])      { popTls[i].play();    popPlayed[i] = true;  }
          else if (p < popThresh[i] && popPlayed[i])   { popTls[i].reverse(); popPlayed[i] = false; }
        }
        if (p >= gatherThresh && !gatherOn)            { gatherTl.play();    gatherOn = true;  }
        else if (p < gatherThresh && gatherOn)         { gatherTl.reverse(); gatherOn = false; }
      }

      // re-measure on refresh/resize; then re-assert the visual state for the current scroll
      function refresh() {
        if (isDesktop) { section.style.height = 'calc(100vh + 2px)'; }
        else if (canLeave) { greenPanel.style.height = window.innerHeight + 'px'; }
        if (cardClone) { cardClone.style.display = 'none'; }
        contentEls.forEach(function (el) { gsap.set(el, { y: 0 }); });
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
        applyScroll(st ? st.progress : 0);
        if (activeTab >= 0) { moveIndicator(activeTab); }
      }

      // green panel = element carrying the green bg + rounded corners (data-stack="green", else walk up)
      var greenPanel = one(section, 'green');
      if (!greenPanel) {
        greenPanel = card;
        while (greenPanel.parentNode && greenPanel.parentNode !== section) { greenPanel = greenPanel.parentNode; }
      }
      var canLeave = greenPanel !== card;
      guardStyle(greenPanel);
      if (canLeave && GREEN_RADIUS) { greenPanel.style.setProperty('border-radius', GREEN_RADIUS, 'important'); }

      // mobile: clip the green panel to one viewport (stack below stays free to scroll)
      if (!isDesktop && canLeave) {
        greenPanel.style.height   = window.innerHeight + 'px';
        greenPanel.style.overflow = 'hidden';
      }

      // fixed strip at viewport top covering the sub-pixel cream seam while the green is docked
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

      // mode swap: stamp <html> (injected sheet hides the off-mode block), and force-show the
      // in-mode block anywhere in the DOM (clear stuck inline display; force one only if a
      // stylesheet rule still hides it).
      document.documentElement.setAttribute('data-stack-mode', isDesktop ? 'desktop' : 'mobile');
      var inSel   = isDesktop ? DESKTOP_SEL : MOBILE_SEL;
      var offSel  = isDesktop ? MOBILE_SEL  : DESKTOP_SEL;
      var inDisp  = isDesktop ? DESKTOP_DISPLAY : MOBILE_DISPLAY;
      var inBlocks = document.querySelectorAll(inSel);
      if (DEBUG) {
        console.log('[stack] build mode=' + (isDesktop ? 'desktop' : 'mobile') +
          ' | in(' + inSel + ')=' + inBlocks.length + ' off(' + offSel + ')=' + document.querySelectorAll(offSel).length);
      }
      Array.prototype.forEach.call(inBlocks, function (el) {
        guardStyle(el);
        el.style.display = '';
        if (window.getComputedStyle(el).display === 'none') { el.style.setProperty('display', inDisp, 'important'); }
      });

      // content stack scrolled up together (by S) to reveal the H2 + tabs
      var transWrap = section.querySelector('.meeting_transition_wrap');
      var tabsWrap  = isDesktop ? (section.querySelector(TABS_SEL) || section.querySelector(DESKTOP_SEL)) : null;
      var contentEls = [greenPanel, transWrap, tabsWrap].filter(Boolean);

      // card must sit above the H2 + tabs grid where they overlap
      if (greenPanel) { greenPanel.style.position = 'relative'; greenPanel.style.zIndex = '900'; }
      if (transWrap)  { guardStyle(transWrap); transWrap.style.zIndex = '1'; }
      if (tabsWrap)   { guardStyle(tabsWrap);  tabsWrap.style.zIndex  = '1'; }

      // tabs: left-column items; scroll advances the active one while sticky. state published as
      // is-active + data-active-tab="N" on the tabs container + section for Webflow content to react.
      var tabItems = tabsWrap ? Array.prototype.slice.call(tabsWrap.querySelectorAll('.meeting_tabs_item')) : [];
      var numTabs  = Math.max(1, tabItems.length);
      var tabTexts = section.querySelectorAll('[data-tab-text]');
      var tabAnims = section.querySelectorAll('[data-tab-anim]');
      var bgSvgs   = section.querySelectorAll('[data-tab-bg]');
      var tabIndicator = tabsWrap ? tabsWrap.querySelector('[data-tab-indicator]') : null;
      var activeTab = -1;
      var bgTargetP = 0, bgCurrentP = 0;   // lerped bg-line paint progress

      // prep each bg SVG path so it can be "drawn" by scrubbing stroke-dashoffset
      Array.prototype.forEach.call(bgSvgs, function (svg) {
        Array.prototype.forEach.call(svg.querySelectorAll('path'), function (p) {
          guardStyle(p);
          var len = (p.getTotalLength ? p.getTotalLength() : 0) || 1;
          p.style.strokeDasharray  = len;
          p.style.strokeDashoffset = len;
          p._len = len;
        });
      });
      // draw each SVG in (first half of its slice) then out (second half). tp = 0..1 tabs progress
      function drawBg(tp) {
        var N = bgSvgs.length; if (!N) { return; }
        for (var i = 0; i < N; i++) {
          var local = (tp - i / N) * N;
          local = local < 0 ? 0 : (local > 1 ? 1 : local);
          var f = (local <= 0.5) ? (1 - local * 2) : (-(local - 0.5) * 2);
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
      // slide the orange indicator over the active tab's label (CSS owns the glide)
      function moveIndicator(n) {
        if (!tabIndicator || !tabItems[n]) { return; }
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
        toggleByIndex(tabTexts, 'data-tab-text', n);
        toggleByIndex(tabAnims, 'data-tab-anim', n);
        moveIndicator(n);
      }

      // measured each refresh: card rise distance, and S to bring the tabs-grid centre to screen centre
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

      // light clone: a light-themed copy of the card, absolute inset:0 inside the card, clipped at
      // the green/white boundary so the card reads dark above the line and light below.
      var cardClone = null;
      if (LIGHT_REVEAL && isDesktop) {
        cardClone = card.cloneNode(true);
        cardClone.removeAttribute(ATTR);
        cardClone.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;margin:0;' +
          'box-sizing:border-box;pointer-events:none;overflow:hidden;border-radius:inherit;' +
          'z-index:' + LIGHT_Z + ';display:none;' +
          'background:' + LIGHT_CARD_BG + ';color:' + LIGHT_TEXT + ';will-change:clip-path;';
        Array.prototype.forEach.call(cardClone.querySelectorAll('*'), function (el) { el.style.transform = ''; el.style.opacity = '1'; });
        Array.prototype.forEach.call(cardClone.querySelectorAll('[data-stack="item"], .meeting_item'), function (el) { el.style.backgroundColor = LIGHT_ROW_BG; });
        Array.prototype.forEach.call(cardClone.querySelectorAll('.meeting_item_text, [data-stack="card-head"]'), function (el) { el.style.color = LIGHT_TEXT; });
        Array.prototype.forEach.call(cardClone.querySelectorAll('.meeting_check, [data-stack="check"]'), function (el) { el.style.borderColor = LIGHT_TEXT; });
        cardClone.style.borderColor = LIGHT_CARD_BG;
        cardClone.style.boxShadow   = '0 0 0 2px ' + LIGHT_CARD_BG;   // outer ring masks the dark card edge
        card.appendChild(cardClone);
        teardown.push(function () { if (cardClone.parentNode) { cardClone.parentNode.removeChild(cardClone); } });
        // recolor icons on the property each shape actually paints with (stroke vs fill)
        Array.prototype.forEach.call(cardClone.querySelectorAll('[data-stack="icon"]'), function (icon) {
          icon.style.color = LIGHT_TEXT;
          var shapes = icon.querySelectorAll('path, line, polyline, polygon, circle, rect, ellipse');
          Array.prototype.forEach.call(shapes.length ? shapes : [icon], function (p) {
            var cs = window.getComputedStyle(p);
            var none = { 'none': 1, 'rgba(0, 0, 0, 0)': 1, 'transparent': 1 };
            if (cs.fill   && !none[cs.fill])   { p.style.fill   = LIGHT_TEXT; }
            if (cs.stroke && !none[cs.stroke]) { p.style.stroke = LIGHT_TEXT; }
          });
        });
      }

      var cardLightOn = false;   // real card flipped to the light theme in the full-light phase

      // pin timing (recomputed on refresh)
      var assemblySteps = STEP_VH * stepCount;
      var totalVH = 0, pA = 0, pG = 0, pHold = 0, tabSpan = 1;
      var snapPoints = [];
      function computeTiming() {
        var contentVH = (isDesktop && window.innerHeight) ? (sCenter / window.innerHeight) : 0;
        var tabsVH    = isDesktop ? ((numTabs - 1) * TAB_STEP_VH + END_HOLD_VH) : 0;
        tabSpan = tabsVH / TAB_STEP_VH || 1;
        totalVH = assemblySteps + GREEN_HOLD_VH + contentVH + tabsVH;
        pA    = assemblySteps / totalVH;                                 // assembly ends
        pG    = (assemblySteps + GREEN_HOLD_VH) / totalVH;               // green hold ends
        pHold = (assemblySteps + GREEN_HOLD_VH + contentVH) / totalVH;   // card centred / tabs phase begins
        snapPoints = [0].concat(popThresh, [gatherThresh]).map(function (v) { return v * pA; }).concat([pG, pHold, 1]);
      }
      computeTiming();

      // maps scroll progress -> every visual; used by both onUpdate and refresh
      function applyScroll(p) {
        var ap = pA > 0 ? Math.min(1, p / pA) : 1;
        update(ap);

        // fan-out: rows open from a fist to their scatter spots. only drive x/y once gather is fully
        // settled at the scattered end, else it fights gatherTl mid-reverse.
        if (!gatherOn && gatherTl.progress() === 0) {
          var t    = spreadT(ap);
          var pull = (1 - FIST) * (1 - t);
          for (var si = 0; si < items.length; si++) {
            gsap.set(items[si], {
              x: geo[si].dx - out[si].ox * pull,
              y: geo[si].dy - out[si].oy * pull
            });
          }
        }

        // desktop: scroll the stack up by S and rise the card to centre. mobile: nothing scrolls.
        if (isDesktop) {
          var S;
          if (p <= pG)         { S = 0; }
          else if (p >= pHold) { S = sCenter; }
          else                 { S = (pHold > pG) ? ((p - pG) / (pHold - pG)) * sCenter : sCenter; }
          for (var ci = 0; ci < contentEls.length; ci++) { gsap.set(contentEls[ci], { y: -S }); }
          gsap.set(card, { y: S - Math.min(cardRiseDist, Math.max(0, S - sCardStart)) });
        }

        // green panel corners per edge: flush to the viewport = square, floating inside = rounded
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
          if (topCover) { topCover.style.display = (topR === 0 && gr.bottom > 3) ? 'block' : 'none'; }
        }

        // light split: clip the clone at the green/white boundary; recolor the real card to light
        // once fully in the white zone so no green hairline peeks around the clone.
        if (cardClone && st && st.isActive) {
          var cr = card.getBoundingClientRect();
          var B  = canLeave ? greenPanel.getBoundingClientRect().bottom : -1e9;
          var topClip = Math.max(0, Math.min(cr.height, B - cr.top));
          if (p >= pHold) { topClip = 0; }
          if (topClip >= cr.height - 0.5) {
            cardClone.style.display = 'none';
          } else {
            cardClone.style.display  = '';
            cardClone.style.clipPath = 'inset(' + topClip + 'px 0 0 0)';
          }
          var wantLight = (p >= pHold);
          if (wantLight && !cardLightOn) {
            gsap.set(card, { backgroundColor: LIGHT_CARD_BG, borderColor: LIGHT_CARD_BG, boxShadow: 'none' });
            cardLightOn = true;
          } else if (!wantLight && cardLightOn) {
            gsap.set(card, { backgroundColor: origBg, borderColor: origBorder, boxShadow: origShadow });
            cardLightOn = false;
          }
        }

        // tabs (desktop): advance the active tab while sticky; publish bg-line paint target
        if (isDesktop) {
          var tn = 0;
          if (p > pHold && pHold < 1) {
            tn = Math.floor((p - pHold) / (1 - pHold) * tabSpan);
            if (tn < 0) { tn = 0; } else if (tn > numTabs - 1) { tn = numTabs - 1; }
          }
          setActiveTab(tn);
          bgTargetP = (p > pHold && pHold < 1) ? (p - pHold) / (1 - pHold) : 0;
        }
      }

      // restore the rounded top once released (applyScroll only runs while pinned)
      function restoreTopRadius() {
        if (!canLeave || !GREEN_RADIUS) { return; }
        greenPanel.style.setProperty('border-radius', GREEN_RADIUS, 'important');
      }

      var st = ScrollTrigger.create({
        trigger: section, start: 'top top',
        end: function () { return '+=' + (window.innerHeight * totalVH); },
        pin: true, invalidateOnRefresh: true,
        refreshPriority: 1,   // this pin sits above the slider pin; refresh it first (slider stays 0)
        onRefresh: function (self) { prevStart = self.start; prevEnd = self.end; },
        onRefreshInit: refresh,
        onUpdate: function (self) {
          var p = self.progress;
          // forward lock: hold at pG until the time-based gather finishes playing in
          var gThreshP = gatherThresh * pA;
          if (p > pG && gatherOn && gatherTl.progress() < 1) {
            self.scroll(self.start + pG * (self.end - self.start));
            p = pG;
          }
          // reverse lock: hold just below the gather boundary until the reverse finishes
          else if (p < gThreshP && !gatherOn && gatherTl.progress() > 0) {
            var holdP = Math.max(0, gThreshP - 0.0005);
            self.scroll(self.start + holdP * (self.end - self.start));
            p = holdP;
          }
          applyScroll(p);
        },
        onLeave:     function () { if (topCover) { topCover.style.display = 'none'; } restoreTopRadius(); },
        onLeaveBack: function () { if (cardClone) { cardClone.style.display = 'none'; } if (topCover) { topCover.style.display = 'none'; } restoreTopRadius(); },
        snap: SNAP ? { snapTo: snapPoints, duration: SNAP_DUR, ease: 'power1.inOut', inertia: false } : false
      });

      function logChoreo(tag) {
        if (!DEBUG) { return; }
        console.log('[stack] choreography(' + tag + ') mode=' + (isDesktop ? 'desktop' : 'mobile') +
          ' rebuild=' + isRebuild + ' tabsWrap=' + !!tabsWrap + ' numTabs=' + numTabs +
          ' totalVH=' + totalVH.toFixed(2) + ' secH=' + section.style.height +
          ' pinLen=' + Math.round(st.end - st.start) +
          ' docHeight=' + Math.round(document.documentElement.scrollHeight) +
          ' scrollY=' + Math.round(window.scrollY) + ' innerH=' + window.innerHeight);
      }
      logChoreo('build');

      // rebuild only: the pin-spacer can be created short (page too short to reach the tabs phase),
      // so refresh once layout settles, then anchor the scroll onto the rebuilt layout.
      if (isRebuild && typeof window.requestAnimationFrame === 'function') {
        var buildAlive = true;
        teardown.push(function () { buildAlive = false; });
        window.requestAnimationFrame(function () {
          if (!buildAlive) { return; }
          window.requestAnimationFrame(function () {
            if (!buildAlive) { return; }
            ScrollTrigger.refresh();
            if (anchorY != null && anchorStart != null && anchorEnd != null) {
              var target;
              if (anchorY <= anchorStart)    { target = anchorY; }                        // above the pin
              else if (anchorY <= anchorEnd) { target = st.start; }                        // inside -> snap to start
              else                           { target = anchorY + (st.end - anchorEnd); }  // below -> shift by delta
              window.scrollTo(0, Math.max(0, Math.round(target)));
              anchorY = anchorStart = anchorEnd = null;
            }
            logChoreo('post-refresh');
          });
        });
      }

      // ease the bg-line paint toward the scroll target each frame (removed on teardown)
      var bgTicker = function () {
        try {
          var diff = bgTargetP - bgCurrentP;
          if (Math.abs(diff) < 0.0005) { return; }
          var dt = gsap.ticker.deltaRatio();
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
          var last = numTabs - 1;
          var centerProg = (i < last) ? (i + 0.5) / tabSpan : ((last / tabSpan) + 1) / 2;
          var centreP = pHold + centerProg * (1 - pHold);
          var N = bgSvgs.length || 1;
          bgCurrentP = Math.min(N - 1, Math.floor(centerProg * N)) / N;   // pre-seed so only the target line draws
          window.scrollTo({ top: st.start + centreP * (st.end - st.start), behavior: 'auto' });
        };
        item.addEventListener('click', onClick);
        teardown.push(function () { item.removeEventListener('click', onClick); });
      });

      // undo the tracked mutations newest-first (matchMedia kills st + reverts gsap.sets itself)
      return function cleanup() {
        for (var i = teardown.length - 1; i >= 0; i--) {
          try { teardown[i](); } catch (e) { /* keep tearing down the rest */ }
        }
      };
    });

    // re-measure once layout & webfonts settle (added once, not per-rebuild)
    function relayout() { ScrollTrigger.refresh(); }
    window.addEventListener('load', relayout);
    if (document.fonts && document.fonts.ready) { document.fonts.ready.then(relayout); }

    // viewport-size watchdog: refresh on real viewport changes (a height-only resize doesn't cross
    // 992px and a plain resize event doesn't always reach ScrollTrigger in embedded contexts).
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
