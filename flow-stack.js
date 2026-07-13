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
  var END_HOLD_VH  = 0.35;   // hold on the last tab before release

  var CARD_TARGET  = 0.5;    // viewport fraction the card centres on during the ride
  var CARD_W       = 400;    // px final card width after the shrink (clamped to stage)
  var CARD_H       = 560;    // px final card height after the shrink (clamped to stage)
  var CARD_DIP     = 40;     // px the card sags below centre mid-ride (0 at start and landing)
  var RADIUS_FULL  = 40;     // px card radius before/at full bleed (matches the Webflow class)
  var RADIUS_END   = 16;     // px card radius after the shrink
  var CARD_GAP     = 0;      // px gap between the two cards while both are visible

  // marquee drift (svg <text> x attribute, like the old SMIL animate but scroll-aware)
  var MQ_DIR       = -1;     // -1 = text streams left (ticker style), 1 = right
  var MQ_SPEED     = 0.6;    // base px per frame at 60fps (multiplied by data-speed)
  var MQ_RAMP      = 1.2;    // extra speed at full pin progress (0 = constant speed)
  var IN_DIST      = 1200;   // px the slow marquee travels during the P0 scrub-in

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
      var marquees = [];
      Array.prototype.forEach.call(section.querySelectorAll('[' + FLOW + '="marquee"]'), function (wrapEl) {
        var textEl = wrapEl.querySelector('text');
        if (!textEl) { return; }
        var x0 = parseFloat(textEl.getAttribute('x'));
        if (isNaN(x0) || x0 >= 0) { x0 = -4000; }
        marquees.push({
          text: textEl, x0: x0, pos: x0,
          mult: parseFloat(wrapEl.getAttribute('data-speed')) || 1,
          inKb: !!(kb && kb.contains(wrapEl))                  // the slow one gets the P0 scrub-in
        });
      });

      var scrubIn = 0;   // 0..1, P0 progress — adds IN_DIST of travel to the kb marquee
      var pinProg = 0;   // overall pin progress, ramps the drift speed

      // position always lives in [x0, 0]; wrapped so the repeated text loops seamlessly
      function wrapPos(x, x0) {
        var span = -x0 || 1;
        return -(((-x % span) + span) % span);
      }

      var mqTicker = function () {
        try {
          var r = section.getBoundingClientRect();
          if (r.bottom < 0 || r.top > window.innerHeight) { return; }   // offscreen: idle
          var dt   = gsap.ticker.deltaRatio();
          var ramp = 1 + MQ_RAMP * pinProg;
          for (var i = 0; i < marquees.length; i++) {
            var m = marquees[i];
            m.pos = wrapPos(m.pos + MQ_DIR * MQ_SPEED * m.mult * ramp * dt, m.x0);
            var x = m.pos + (m.inKb ? MQ_DIR * IN_DIST * scrubIn : 0);  // scrub-in travels the same direction
            m.text.setAttribute('x', String(wrapPos(x, m.x0)));
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
      stage.style.display        = 'flex';
      stage.style.alignItems     = 'center';
      stage.style.justifyContent = 'center';
      stage.style.width          = '100%';
      guardStyle(card);
      card.style.flex      = '0 0 auto';
      card.style.minWidth  = '0';
      card.style.margin    = '0';
      card.style.overflow  = 'hidden';
      card.style.boxSizing = 'border-box';
      card.style.willChange = 'width, transform';
      if (window.getComputedStyle(card).position === 'static') { card.style.position = 'relative'; }
      if (kb) {
        guardStyle(kb);
        kb.style.flex      = '0 0 auto';
        kb.style.minWidth  = '0';
        kb.style.margin    = '0';
        kb.style.overflow  = 'hidden';
        kb.style.boxSizing = 'border-box';
      }
      // pin each marquee wrapper to the stage width; kb's sits left, the card's sits right
      var kbMq   = kb   ? kb.querySelector('[' + FLOW + '="marquee"]')   : null;
      var cardMq = card ? card.querySelector('[' + FLOW + '="marquee"]') : null;
      if (kbMq)   { guardStyle(kbMq);   kbMq.style.marginRight  = 'auto'; }
      if (cardMq) { guardStyle(cardMq); cardMq.style.marginLeft = 'auto'; }
      [kbMq, cardMq].forEach(function (mq) {
        if (!mq) { return; }
        var svg = mq.querySelector('svg');
        if (svg) { guardStyle(svg); svg.style.width = '100%'; }
      });

      var stageW = 0, stageH = 0;
      function measureStage() {
        // natural sizes while measuring, so a mid-morph refresh can't feed back
        if (kb) { kb.style.width = ''; kb.style.height = ''; kb.style.visibility = ''; }
        card.style.width = ''; card.style.height = '';
        var r = stage.getBoundingClientRect();
        stageW = r.width  || 1;
        stageH = r.height || 1;
        if (kbMq)   { kbMq.style.width   = stageW + 'px'; }
        if (cardMq) { cardMq.style.width = stageW + 'px'; }
      }

      // width split per phase. Lp = where the photo card's left edge sits (px from stage left)
      function applyMorph(p) {
        var cardW, cardH = stageH, kbW = 0, gap = 0;
        if (p < pB) {                        // P0 + P1: photo edge sweeps right -> left
          var Lp = stageW * (p < pA ? 1 : 1 - phaseT(p, pA, pB));
          cardW = stageW - Lp;
          kbW   = Math.max(0, Lp - CARD_GAP);
          gap   = Lp - kbW;                  // shrinks to 0 with the kb card: no end-of-phase jump
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
          kb.style.width       = kbW + 'px';
          kb.style.height      = stageH + 'px';   // both cards always full stage height
          kb.style.marginRight = gap + 'px';
          kb.style.visibility  = kbW < 2 ? 'hidden' : '';
        }
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
        scrubIn = pA > 0 ? Math.min(1, p / pA) : 1;
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
          var tn = 0;
          if (p > pHold && pHold < 1) {
            tn = Math.floor((p - pHold) / (1 - pHold) * tabSpan);
            if (tn < 0) { tn = 0; } else if (tn > numTabs - 1) { tn = numTabs - 1; }
          }
          setActiveTab(tn);
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

      // click a tab -> jump to the middle of that tab's slice
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
