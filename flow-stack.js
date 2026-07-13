(function () {

  // ---- corners: scroll-scrubbed corner radius (same module as stack.js — load ONE of the two scripts per page) ----

  var ATTR        = 'data-corners';
  var DEFAULT_MAX = 80;
  var SMOOTH      = 0.16;  // per-frame ease toward target radius; higher = snappier
  var DEBUG       = false;

  var els = [];

  function scan() {
    var found = document.querySelectorAll('[' + ATTR + ']');
    for (var i = 0; i < found.length; i++) {
      var el = found[i], known = false;
      for (var j = 0; j < els.length; j++) { if (els[j].el === el) { known = true; break; } }
      if (!known) {
        els.push({ el: el, max: parseFloat(el.getAttribute(ATTR)) || DEFAULT_MAX, t: -1, b: -1, wt: -1, wb: -1 });
        if (DEBUG) { console.log('[corners] tracking', el); }
      }
    }
  }
  window.Corners = { scan: scan };

  function frame(dt) {
    var vh = window.innerHeight;
    var k  = 1 - Math.pow(1 - SMOOTH, dt);
    for (var i = 0; i < els.length; i++) {
      var s = els[i];
      var r = s.el.getBoundingClientRect();
      if (!r.width && !r.height) { continue; }                     // display:none
      var tT = Math.max(0, Math.min(s.max, r.top));
      var tB = Math.max(0, Math.min(s.max, vh - r.bottom));
      if (s.t < 0) { s.t = tT; s.b = tB; }                         // first frame: snap
      else {
        s.t += (tT - s.t) * k; if (Math.abs(tT - s.t) < 0.1) { s.t = tT; }
        s.b += (tB - s.b) * k; if (Math.abs(tB - s.b) < 0.1) { s.b = tB; }
      }
      if (s.t === s.wt && s.b === s.wb) { continue; }              // settled
      s.wt = s.t; s.wb = s.b;
      s.el.style.setProperty('border-top-left-radius',     s.t + 'px', 'important');
      s.el.style.setProperty('border-top-right-radius',    s.t + 'px', 'important');
      s.el.style.setProperty('border-bottom-left-radius',  s.b + 'px', 'important');
      s.el.style.setProperty('border-bottom-right-radius', s.b + 'px', 'important');
    }
  }

  function cornersStart() {
    scan();
    if (window.gsap) {
      // register ST first so its pin correction runs before our rect reads each frame
      if (window.ScrollTrigger) { gsap.registerPlugin(ScrollTrigger); }
      gsap.ticker.add(function () { try { frame(gsap.ticker.deltaRatio()); } catch (e) {} });
    } else {
      var last = performance.now();
      (function loop(now) {
        var dt = (now - last) / (1000 / 60); last = now;
        try { frame(dt || 1); } catch (e) {}
        requestAnimationFrame(loop);
      }(last));
    }
    window.addEventListener('load', scan);
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', cornersStart); }
  else { cornersStart(); }

}());

(function () {

  // flow page: pinned green section — marquee scrubs in, photo card grows over the keyboard
  // card, shrinks to its final size, rides down to the tabs, then the tabs phase runs.
  //
  // attributes: data-stack section/card/green/desktop/mobile (as stack.js)
  //             data-flow="stage" (morph area) / "kb" (keyboard card) / "marquee" (svg wrapper)
  //             data-speed="4.9" on a marquee wrapper = drift multiplier

  // ---- config ----
  // pin phases, in viewport-heights of scroll
  var IN_VH        = 0.6;    // P0: slow marquee scrubs in
  var GROW_VH      = 0.8;    // P1: photo card grows right -> left to full stage width
  var FULL_HOLD_VH = 0.25;   // beat at full bleed
  var SHRINK_VH    = 0.7;    // P2: sides shrink in to the final card
  var TAB_STEP_VH  = 1.0;    // scroll length per tab while sticky
  var END_HOLD_VH  = 1.0;    // hold on the last tab before release (its whole dwell time)

  var CARD_TARGET  = 0.5;    // viewport fraction the card centres on during the ride
  var CARD_W       = 400;    // px final card width after the shrink (clamped to stage)
  var CARD_H       = 560;    // px final card height after the shrink (clamped to stage)
  var CARD_DIP     = 70;     // px the card sags below centre mid-ride (0 at start and landing)
  var RADIUS_FULL  = 40;     // px card radius before/at full bleed (matches the Webflow class)
  var RADIUS_END   = 16;     // px card radius after the shrink
  var CARD_GAP     = 0;      // px gap between the two cards while both are visible
  var SNAP_W       = 0.15;   // fraction of the grow travel that snaps at each end (sliver zones)
  var SNAP_S       = 0.05;   // fraction of the grow scroll spent on each snap; smaller = snappier

  // marquee (svg <text> x attribute) — moves ONLY with scroll, scrubbed both directions
  var MQ_DIR       = -1;     // -1 = text streams left on scroll down, 1 = right
  var MQ_SCRUB     = 0.35;   // px of text travel per px of scroll (multiplied by data-speed)
  var MQ_RAMP      = 1.2;    // extra speed at full pin progress (0 = constant)
  var MQ_PAD       = 60;     // extra viewBox units the text starts beyond the right edge
  var MQ_IN_FRAC   = 0.5;    // fraction of P0 by which the kb text has fully entered

  var GREEN_RADIUS = '80px'; // auto-tags the green panel for the corners module. '' = off
  var BG_SMOOTH    = 0.12;
  var SNAP         = false;
  var SNAP_DUR     = 0.3;

  var ATTR  = 'data-stack';
  var FLOW  = 'data-flow';

  var DESKTOP_SEL = '[' + ATTR + '="desktop"]';
  var MOBILE_SEL  = '[' + ATTR + '="mobile"]';
  var TABS_SEL    = '.meeting_tabs_contain';
  var DESKTOP_DISPLAY = 'block';
  var MOBILE_DISPLAY  = 'block';

  var COPY_SEL       = '.tab_copy';
  var COPY_NARROW_BP = 1180;
  var COPY_NARROW_MAXW = '30ch';

  var DEBUG = false;

  // ---- helpers ----
  function one(root, name)  { return root.querySelector('[' + ATTR + '="' + name + '"]'); }
  function oneF(root, name) { return root.querySelector('[' + FLOW + '="' + name + '"]'); }
  function smooth(t) { return t < 0 ? 0 : (t > 1 ? 1 : t * t * (3 - 2 * t)); }
  function phaseT(p, a, b) { return b > a ? smooth((p - a) / (b - a)) : (p >= b ? 1 : 0); }
  // races through the first/last SNAP_W of travel in SNAP_S of the scroll: card slivers
  // never linger at either end of the grow, but everything stays fully scrubbed
  function snapEnds(t) {
    if (t <= 0) { return 0; }
    if (t >= 1) { return 1; }
    if (t < SNAP_S)     { return SNAP_W * (t / SNAP_S); }
    if (t > 1 - SNAP_S) { return 1 - SNAP_W * ((1 - t) / SNAP_S); }
    return SNAP_W + ((t - SNAP_S) / (1 - 2 * SNAP_S)) * (1 - 2 * SNAP_W);
  }

  function init() {
    if (typeof window.gsap === 'undefined' || typeof window.ScrollTrigger === 'undefined') {
      console.warn('[flow-stack] GSAP + ScrollTrigger required before this script.');
      return;
    }
    gsap.registerPlugin(ScrollTrigger);

    // runtime-only CSS (same id/rules as stack.js so the Designer embeds keep working)
    if (!document.getElementById('stack-mode-style')) {
      var ms = document.createElement('style');
      ms.id = 'stack-mode-style';
      ms.textContent =
        'html[data-stack-mode="desktop"] ' + MOBILE_SEL  + '{display:none !important;}' +
        'html[data-stack-mode="mobile"] '  + DESKTOP_SEL + '{display:none !important;}' +
        (COPY_SEL ? ('@media (max-width:' + COPY_NARROW_BP + 'px){' + COPY_SEL +
          '{max-width:' + COPY_NARROW_MAXW + ';}}') : '') +
        '[data-tab-anim],[data-tab-text]{opacity:0;visibility:hidden;transition:opacity .4s ease;}' +
        '[data-tab-anim].is-active,[data-tab-text].is-active{opacity:1;visibility:visible;}' +
        '[data-tab-text] .meeting_tabs_heading,[data-tab-text] .meeting_tabs_paragraph{' +
          'opacity:0;transform:translateY(8px);transition:opacity .5s ease,transform .5s ease;}' +
        '[data-tab-text].is-active .meeting_tabs_heading{opacity:1;transform:none;transition-delay:.06s;}' +
        '[data-tab-text].is-active .meeting_tabs_paragraph{opacity:1;transform:none;transition-delay:.16s;}';
      document.head.appendChild(ms);
    }

    // anchor scroll restoration across a breakpoint cross
    var prevStart = null, prevEnd = null;
    var anchorY = null, anchorStart = null, anchorEnd = null;
    var bpMQ = window.matchMedia('(min-width: 992px)');
    function captureAnchor() {
      anchorY = window.pageYOffset || window.scrollY || 0;
      anchorStart = prevStart; anchorEnd = prevEnd;
    }
    if (bpMQ.addEventListener) { bpMQ.addEventListener('change', captureAnchor); }
    else if (bpMQ.addListener) { bpMQ.addListener(captureAnchor); }

    var builtOnce = false;
    var mm = gsap.matchMedia();
    mm.add({ isDesktop: '(min-width: 992px)', isMobile: '(max-width: 991px)' }, function (ctx) {
      var isDesktop = ctx.conditions.isDesktop;
      var isRebuild = builtOnce; builtOnce = true;

      var teardown = [];
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
      if (!section) { console.warn('[flow-stack] no data-stack="section" found'); return; }

      var card  = one(section, 'card');
      var stage = oneF(section, 'stage');
      var kb    = oneF(section, 'kb');
      if (!card || !stage) { console.warn('[flow-stack] need data-stack="card" and data-flow="stage"'); return; }

      guardStyle(section);
      if (window.getComputedStyle(section).position === 'static') {
        section.style.position = 'relative';
      }
      if (isDesktop) {
        section.style.height   = 'calc(100vh + 2px)';   // bottom seam offscreen while pinned
        section.style.overflow = 'hidden';
      }

      // ---- marquees: drift the svg <text> x attr; loop like the old SMIL animate ----
      // each entry: text el, start x (loop point), data-speed multiplier, current pos
      // each marquee starts fully off-screen right, streams in leftward with scroll, then loops.
      // the authored x attr (e.g. -4000) sets the LOOP PERIOD — how far the text travels
      // before repeating; match it roughly to the length of one repetition of the string.
      var marquees = [];
      Array.prototype.forEach.call(section.querySelectorAll('[' + FLOW + '="marquee"]'), function (wrapEl) {
        var textEl = wrapEl.querySelector('text');
        var svgEl  = wrapEl.querySelector('svg');
        if (!textEl) { return; }
        var period = Math.abs(parseFloat(textEl.getAttribute('x'))) || 4000;
        var vbw    = (svgEl && svgEl.viewBox && svgEl.viewBox.baseVal && svgEl.viewBox.baseVal.width)  || 928;
        var vbh    = (svgEl && svgEl.viewBox && svgEl.viewBox.baseVal && svgEl.viewBox.baseVal.height) || 76;
        marquees.push({
          text: textEl, svg: svgEl, period: period, start: vbw + MQ_PAD,
          vbw: vbw, vbh: vbh, len: 0, travel: 0,
          mult: parseFloat(wrapEl.getAttribute('data-speed')) || 1,
          inKb: !!(kb && kb.contains(wrapEl))   // kb text is fully entered by the end of P0
        });
        textEl.setAttribute('x', String(vbw + MQ_PAD));        // initial paint: off-screen right
      });

      var pinProg = 0;   // overall pin progress, ramps the marquee speed
      var scrubIn = 0;   // 0..1 over P0 — walks the kb text fully in regardless of its speed

      var lastScrollY = window.pageYOffset || 0;
      var mqTicker = function () {
        try {
          var y = window.pageYOffset || 0;
          var dy = y - lastScrollY;
          lastScrollY = y;
          if (!dy) { return; }                                          // no scroll = no movement
          var r = section.getBoundingClientRect();
          if (r.bottom < 0 || r.top > window.innerHeight) { return; }   // offscreen: idle
          var ramp = 1 + MQ_RAMP * pinProg;
          for (var i = 0; i < marquees.length; i++) {
            var m = marquees[i];
            // travel is a pure function of scroll: fully scrubbed, reversible to the empty start
            m.travel = Math.max(0, m.travel - MQ_DIR * MQ_SCRUB * m.mult * ramp * dy);
            var x = m.start - m.travel - (m.inKb ? m.start * scrubIn : 0);
            if (x < 0) {
              var per = m.len > 0 ? Math.min(m.period, Math.max(100, m.len - m.vbw - MQ_PAD)) : m.period;
              x = -((-x) % per);                                        // loop, never exposing the string's end
            }
            m.text.setAttribute('x', String(x));
          }
        } catch (e) { /* keep the shared ticker alive */ }
      };
      gsap.ticker.add(mqTicker);
      teardown.push(function () { gsap.ticker.remove(mqTicker); });

      // ---- morph: both cards are in-flow flex children sharing the stage width; the script
      // splits the 100% between them. real boxes -> class border-radius just works. each
      // marquee is pinned to the full stage width (kb's anchored left, the card's anchored
      // right) so the text never rescales — the cards' overflow crops it into two windows
      // of one continuous line.
      guardStyle(stage);
      stage.style.display = 'block';
      stage.style.width   = '100%';
      if (window.getComputedStyle(stage).position === 'static') { stage.style.position = 'relative'; }
      guardStyle(card);
      card.style.position   = 'absolute';   // coordinates computed directly — no flex packing
      card.style.margin     = '0';
      card.style.overflow   = 'hidden';
      card.style.boxSizing  = 'border-box';
      card.style.willChange = 'width, transform';
      // the photo reveals leftward from a pinned right edge
      Array.prototype.forEach.call(card.querySelectorAll('img'), function (im) {
        guardStyle(im);
        im.style.objectPosition = 'right center';
      });
      if (kb) {
        guardStyle(kb);
        kb.style.margin    = '0';
        kb.style.overflow  = 'hidden';
        kb.style.boxSizing = 'border-box';
      }
      // pin each marquee wrapper to the stage width; kb's sits left, the card's sits right
      var kbMq   = kb   ? kb.querySelector('[' + FLOW + '="marquee"]')   : null;
      var cardMq = card ? card.querySelector('[' + FLOW + '="marquee"]') : null;
      if (kbMq)   { guardStyle(kbMq);   kbMq.style.marginRight = 'auto'; }
      if (cardMq) { guardStyle(cardMq); cardMq.style.position  = 'absolute'; }   // stage-fixed backdrop; left set per frame
      [kbMq, cardMq].forEach(function (mq) {
        if (!mq) { return; }
        var svg = mq.querySelector('svg');
        if (svg) { guardStyle(svg); svg.style.width = '100%'; }
      });

      var stageW = 0, stageH = 0, padL = 0, padT = 0;
      function measureStage() {
        // natural sizes while measuring, so a mid-morph refresh can't feed back
        if (kb) { kb.style.width = ''; kb.style.height = ''; kb.style.visibility = ''; }
        card.style.width = ''; card.style.height = '';
        // the CONTENT box: padding on the stage must not count, or the cards overflow it
        var cs = window.getComputedStyle(stage);
        padL = parseFloat(cs.paddingLeft) || 0;
        padT = parseFloat(cs.paddingTop)  || 0;
        stageW = (stage.clientWidth  - padL - (parseFloat(cs.paddingRight)  || 0)) || 1;
        stageH = (stage.clientHeight - padT - (parseFloat(cs.paddingBottom) || 0)) || 1;
        if (kbMq)   { kbMq.style.width   = stageW + 'px'; }
        if (cardMq) { cardMq.style.width = stageW + 'px'; }
        // size each svg to its viewBox aspect at the stage width: scale is then exactly the
        // width ratio (no meet/slice bands), so text always spans the full width. also
        // re-measure text lengths (webfonts change them) for the loop clamp below.
        for (var mi = 0; mi < marquees.length; mi++) {
          var mm = marquees[mi];
          if (mm.svg) {
            mm.svg.style.width    = stageW + 'px';
            mm.svg.style.height   = (stageW * mm.vbh / mm.vbw) + 'px';
            mm.svg.style.overflow = 'visible';   // wave crests may ride above the viewBox
          }
          try { mm.len = mm.text.getComputedTextLength ? mm.text.getComputedTextLength() : 0; } catch (e) { mm.len = 0; }
        }
      }

      // width split per phase. Lp = where the photo card's left edge sits (px from stage left)
      function applyMorph(p) {
        var cardW, cardH = stageH, kbW = 0;
        if (p < pB) {                        // P0 + P1: photo edge sweeps right -> left
          var gt = (p < pA || pB <= pA) ? 0 : (p - pA) / (pB - pA);
          var Lp = stageW * (1 - snapEnds(gt));
          cardW = stageW - Lp;
          kbW   = Math.max(0, Lp - CARD_GAP);   // gap emerges implicitly between kb's end and the card
        } else if (p < pBh) {                // hold at full bleed
          cardW = stageW;
        } else {                             // P2 + after: shrink to the centred final card
          var t = phaseT(p, pBh, pC);
          cardW = stageW - (stageW - Math.min(CARD_W, stageW)) * t;
          cardH = stageH - (stageH - Math.min(CARD_H, stageH)) * t;
          card.style.borderRadius = (RADIUS_FULL + (RADIUS_END - RADIUS_FULL) * t) + 'px';
        }
        if (p < pBh) { card.style.borderRadius = ''; }   // class radius before the shrink
        if (kb) {
          kb.style.width      = kbW + 'px';
          kb.style.height     = stageH + 'px';    // both cards always full stage height
          kb.style.visibility = kbW < 2 ? 'hidden' : '';
        }
        // grow: right edge fixed at the stage's content-right, growth is leftward only.
        // shrink: centred. (continuous at the boundary — both give left = padL at full width)
        var left = (p < pBh) ? padL + (stageW - cardW) : padL + (stageW - cardW) / 2;
        // card marquee: always centred on the card — the wave's bump sits over the pill at
        // every card size, in every phase (the full-stage-wide wrapper centre = card centre)
        if (cardMq) { cardMq.style.left = ((cardW - stageW) / 2) + 'px'; }
        card.style.left       = left + 'px';
        card.style.top        = (padT + (stageH - cardH) / 2) + 'px';
        card.style.width      = cardW + 'px';
        card.style.height     = cardH + 'px';
        card.style.visibility = cardW < 2 ? 'hidden' : '';
      }

      // ---- green panel / seam cover / mode swap (same as stack.js) ----
      var greenPanel = one(section, 'green');
      if (!greenPanel) {
        greenPanel = card;
        while (greenPanel.parentNode && greenPanel.parentNode !== section) { greenPanel = greenPanel.parentNode; }
      }
      var canLeave = greenPanel !== card;
      guardStyle(greenPanel);
      if (canLeave && GREEN_RADIUS && !greenPanel.hasAttribute('data-corners')) {
        greenPanel.setAttribute('data-corners', String(parseFloat(GREEN_RADIUS) || 80));
        if (window.Corners) { window.Corners.scan(); }
      }

      var greenBg  = canLeave ? window.getComputedStyle(greenPanel).backgroundColor : '';
      var topCover = null;
      if (canLeave && greenBg && greenBg !== 'rgba(0, 0, 0, 0)' && greenBg !== 'transparent') {
        topCover = document.createElement('div');
        topCover.setAttribute('aria-hidden', 'true');
        topCover.style.cssText = 'position:fixed;top:0;left:0;right:0;height:3px;pointer-events:none;' +
          'display:none;z-index:989;background:' + greenBg + ';';
        document.body.appendChild(topCover);
        teardown.push(function () { if (topCover.parentNode) { topCover.parentNode.removeChild(topCover); } });
      }

      document.documentElement.setAttribute('data-stack-mode', isDesktop ? 'desktop' : 'mobile');
      var inSel  = isDesktop ? DESKTOP_SEL : MOBILE_SEL;
      var inDisp = isDesktop ? DESKTOP_DISPLAY : MOBILE_DISPLAY;
      Array.prototype.forEach.call(document.querySelectorAll(inSel), function (el) {
        guardStyle(el);
        el.style.display = '';
        if (window.getComputedStyle(el).display === 'none') { el.style.setProperty('display', inDisp, 'important'); }
      });

      // ---- content ride + tabs (same engine as stack.js) ----
      var transWrap = section.querySelector('.meeting_transition_wrap');
      var tabsWrap  = isDesktop ? (section.querySelector(TABS_SEL) || section.querySelector(DESKTOP_SEL)) : null;
      var contentEls = [greenPanel, transWrap, tabsWrap].filter(Boolean);

      if (greenPanel) { greenPanel.style.position = 'relative'; greenPanel.style.zIndex = '900'; }
      if (transWrap)  { guardStyle(transWrap); transWrap.style.zIndex = '1'; }
      if (tabsWrap)   { guardStyle(tabsWrap);  tabsWrap.style.zIndex  = '1'; }

      var tabItems = tabsWrap ? Array.prototype.slice.call(tabsWrap.querySelectorAll('.meeting_tabs_item')) : [];
      var numTabs  = Math.max(1, tabItems.length);
      var tabTexts = section.querySelectorAll('[data-tab-text]');
      var tabAnims = section.querySelectorAll('[data-tab-anim]');
      var bgSvgs   = section.querySelectorAll('[data-tab-bg]');
      var tabIndicator = tabsWrap ? tabsWrap.querySelector('[data-tab-indicator]') : null;
      var activeTab = -1;
      var bgTargetP = 0, bgCurrentP = 0;

      Array.prototype.forEach.call(bgSvgs, function (svg) {
        Array.prototype.forEach.call(svg.querySelectorAll('path'), function (p) {
          guardStyle(p);
          var len = (p.getTotalLength ? p.getTotalLength() : 0) || 1;
          p.style.strokeDasharray  = len;
          p.style.strokeDashoffset = len;
          p._len = len;
        });
      });
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

      // card rise: the card's final visual box is the centred clip inside the stage, so the
      // stage rect is the measuring stick (card el itself always spans the full stage)
      var cardRiseDist = 0, sCenter = 0, sCardStart = 0;
      function measurePositions() {
        contentEls.forEach(function (el) { gsap.set(el, { y: 0 }); });
        gsap.set(card, { y: 0 });
        var mid  = window.innerHeight * CARD_TARGET;
        var sTop = section.getBoundingClientRect().top;
        var cr   = stage.getBoundingClientRect();
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

      // ---- pin timing ----
      var totalVH = 1, pA = 0, pB = 0, pBh = 0, pC = 0, pHold = 1, tabSpan = 1;
      var snapPoints = [];
      function computeTiming() {
        var contentVH = (isDesktop && window.innerHeight) ? (sCenter / window.innerHeight) : 0;
        var tabsVH    = isDesktop ? ((numTabs - 1) * TAB_STEP_VH + END_HOLD_VH) : 0;
        tabSpan = tabsVH / TAB_STEP_VH || 1;
        totalVH = IN_VH + GROW_VH + FULL_HOLD_VH + SHRINK_VH + contentVH + tabsVH;
        pA    = IN_VH / totalVH;                                           // scrub-in ends, grow begins
        pB    = (IN_VH + GROW_VH) / totalVH;                               // full bleed
        pBh   = (IN_VH + GROW_VH + FULL_HOLD_VH) / totalVH;                // hold ends, shrink begins
        pC    = (IN_VH + GROW_VH + FULL_HOLD_VH + SHRINK_VH) / totalVH;    // final card, ride begins
        pHold = (IN_VH + GROW_VH + FULL_HOLD_VH + SHRINK_VH + contentVH) / totalVH;   // tabs begin
        snapPoints = [0, pA, pB, pC, pHold, 1];
      }
      computeTiming();

      function applyScroll(p) {
        pinProg = p;
        scrubIn = pA > 0 ? smooth(p / (pA * MQ_IN_FRAC)) : 1;
        applyMorph(p);

        if (isDesktop) {
          var S;
          if (p <= pC)         { S = 0; }
          else if (p >= pHold) { S = sCenter; }
          else                 { S = (pHold > pC) ? ((p - pC) / (pHold - pC)) * sCenter : sCenter; }
          for (var ci = 0; ci < contentEls.length; ci++) { gsap.set(contentEls[ci], { y: -S }); }
          // mid-ride the card sags CARD_DIP below centre, easing back to dead centre at landing
          var rideT = (pHold > pC) ? Math.max(0, Math.min(1, (p - pC) / (pHold - pC))) : 1;
          var dip   = CARD_DIP * Math.sin(Math.PI * rideT);
          gsap.set(card, { y: S - Math.min(cardRiseDist, Math.max(0, S - sCardStart)) + dip });
        }

        if (canLeave && topCover) {
          var gr = greenPanel.getBoundingClientRect();
          topCover.style.display = (gr.top <= 1 && gr.bottom > 3) ? 'block' : 'none';
        }

        if (isDesktop) {
          // a tab click owns the active state until its scroll glide arrives, so tabs the
          // glide passes through don't flicker active and restart the animations
          if (clickLockP != null && (Math.abs(p - clickLockP) < 0.005 || Date.now() - clickLockT > 1200)) {
            clickLockP = null;
          }
          if (clickLockP == null) {
            // nothing is active until the card is nearly landed, so tab 0's entrance animates
            var tn = -1;
            if (p >= pHold - 0.02) {
              tn = 0;
              if (p > pHold && pHold < 1) {
                tn = Math.floor((p - pHold) / (1 - pHold) * tabSpan);
                if (tn < 0) { tn = 0; } else if (tn > numTabs - 1) { tn = numTabs - 1; }
              }
            }
            setActiveTab(tn);
          }
          bgTargetP = (p > pHold && pHold < 1) ? (p - pHold) / (1 - pHold) : 0;
        }
      }

      function refresh() {
        if (isDesktop) { section.style.height = 'calc(100vh + 2px)'; }
        contentEls.forEach(function (el) { gsap.set(el, { y: 0 }); });
        measureStage();
        measurePositions();
        computeTiming();
        applyScroll(st ? st.progress : 0);
        if (activeTab >= 0) { moveIndicator(activeTab); }
      }

      var st = null;
      if (isDesktop) {
        st = ScrollTrigger.create({
          trigger: section, start: 'top top',
          end: function () { return '+=' + (window.innerHeight * totalVH); },
          pin: true, anticipatePin: 1, invalidateOnRefresh: true,
          refreshPriority: 1,
          onRefresh: function (self) { prevStart = self.start; prevEnd = self.end; },
          onRefreshInit: refresh,
          onUpdate: function (self) { applyScroll(self.progress); },
          onLeave:     function () { if (topCover) { topCover.style.display = 'none'; } },
          onLeaveBack: function () { if (topCover) { topCover.style.display = 'none'; } },
          snap: SNAP ? { snapTo: snapPoints, duration: SNAP_DUR, ease: 'power1.inOut', inertia: false } : false
        });
      } else {
        // mobile: no pin/morph — show the card in its final centred state, marquees drift
        measureStage();
        applyMorph(1);
      }

      if (DEBUG) {
        console.log('[flow-stack] build mode=' + (isDesktop ? 'desktop' : 'mobile') +
          ' rebuild=' + isRebuild + ' marquees=' + marquees.length +
          ' numTabs=' + numTabs + ' totalVH=' + totalVH.toFixed(2));
      }

      // rebuild only: refresh once layout settles, then anchor scroll onto the rebuilt layout
      if (isRebuild && typeof window.requestAnimationFrame === 'function') {
        var buildAlive = true;
        teardown.push(function () { buildAlive = false; });
        window.requestAnimationFrame(function () {
          if (!buildAlive) { return; }
          window.requestAnimationFrame(function () {
            if (!buildAlive) { return; }
            ScrollTrigger.refresh();
            if (st && anchorY != null && anchorStart != null && anchorEnd != null) {
              var target;
              if (anchorY <= anchorStart)    { target = anchorY; }
              else if (anchorY <= anchorEnd) { target = st.start; }
              else                           { target = anchorY + (st.end - anchorEnd); }
              window.scrollTo(0, Math.max(0, Math.round(target)));
              anchorY = anchorStart = anchorEnd = null;
            }
          });
        });
      }

      // eased bg-line paint (only does work if [data-tab-bg] svgs exist)
      var bgTicker = function () {
        try {
          var diff = bgTargetP - bgCurrentP;
          if (Math.abs(diff) < 0.0005) { return; }
          var dt = gsap.ticker.deltaRatio();
          bgCurrentP += diff * (1 - Math.pow(1 - BG_SMOOTH, dt));
          drawBg(bgCurrentP);
        } catch (e) {}
      };
      gsap.ticker.add(bgTicker);
      teardown.push(function () { gsap.ticker.remove(bgTicker); });

      // click a tab -> activate it NOW, then glide the scroll to its slice (the lock above
      // keeps pass-through tabs from hijacking the active state mid-glide)
      var clickLockP = null, clickLockT = 0;
      tabItems.forEach(function (item, i) {
        guardStyle(item);
        item.style.cursor = 'pointer';
        var onClick = function () {
          if (!st) { return; }
          var last = numTabs - 1;
          var centerProg = (i < last) ? (i + 0.5) / tabSpan : ((last / tabSpan) + 1) / 2;
          var centreP = pHold + centerProg * (1 - pHold);
          var N = bgSvgs.length || 1;
          bgCurrentP = Math.min(N - 1, Math.floor(centerProg * N)) / N;
          clickLockP = centreP; clickLockT = Date.now();
          setActiveTab(i);
          window.scrollTo({ top: st.start + centreP * (st.end - st.start), behavior: 'auto' });
        };
        item.addEventListener('click', onClick);
        teardown.push(function () { item.removeEventListener('click', onClick); });
      });

      return function cleanup() {
        for (var i = teardown.length - 1; i >= 0; i--) {
          try { teardown[i](); } catch (e) {}
        }
      };
    });

    function relayout() { ScrollTrigger.refresh(); }
    window.addEventListener('load', relayout);
    if (document.fonts && document.fonts.ready) { document.fonts.ready.then(relayout); }

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
