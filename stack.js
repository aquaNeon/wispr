(function () {

  var STEP_VH       = 0.7;
  var SNAP          = true;
  var SNAP_DUR      = 0.3;

  var POP_BATCH     = 2;
  var POP_STAGGER   = 0.08;
  var POP_DUR       = 0.55;
  var POP_SCALE_X   = 0.35;
  var POP_SCALE_Y   = 0.85;
  var POP_Y         = 18;
  var POP_EASE      = 'back.out(1.6)';

  var CHECK_DELAY   = 0.18;
  var CHECK_DUR     = 0.4;
  var CHECK_EASE    = 'back.out(2.4)';

  var GATHER_STAGGER = 0.09;
  var GATHER_DUR     = 0.7;
  var GATHER_EASE    = 'power3.inOut';
  var CARD_FADE      = 0.4;
  var LANDED_BG      = '';
  var LANDED_BG_VAR  = '--green';

  var CARD_ITEM_W   = 352;
  var MATCH_HEIGHT  = true;
  var ROW_H         = 0;
  var ROW_GAP       = 8;
  var HEAD_GAP      = 18;
  var STACK_TOP     = 0;
  var CARD_GROW     = 0.92;

  var HOLD_STEPS    = 2;

  var CARD_FOLLOW   = false;
  var FOLLOW_VH     = 1.3;

  var ATTR  = 'data-stack';
  var ORDER = 'data-stack-order';

  function sel(root, name) { return root.querySelectorAll('[' + ATTR + '="' + name + '"]'); }
  function one(root, name) { return root.querySelector('[' + ATTR + '="' + name + '"]'); }

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
    var sr0   = section.getBoundingClientRect();
    var rect0 = items.map(function (it) { return it.getBoundingClientRect(); });
    items.forEach(function (it, i) {
      var pos = window.getComputedStyle(it).position;
      if (pos === 'static' || pos === 'relative') {
        it.style.position = 'absolute';
        it.style.margin   = '0';
        it.style.left     = (rect0[i].left - sr0.left) + 'px';
        it.style.top      = (rect0[i].top  - sr0.top)  + 'px';
      }
    });

    var checks = items.map(function (it) { return one(it, 'check'); });
    items.forEach(function (it, i) {
      gsap.set(it, { opacity: 0, scaleX: POP_SCALE_X, scaleY: POP_SCALE_Y, y: POP_Y, x: 0, zIndex: i + 1, transformOrigin: '50% 50%' });
      it.style.willChange = 'transform, opacity, width, height';
      it.style.whiteSpace = 'nowrap';
      it.style.boxSizing  = 'border-box';
      if (checks[i]) { gsap.set(checks[i], { scale: 0, opacity: 0, transformOrigin: '50% 50%' }); }
    });
    gsap.set(card, { autoAlpha: 0, zIndex: 0, scale: CARD_GROW, transformOrigin: '50% 50%' });
    card.style.boxSizing = 'border-box';

    var geo = items.map(function () { return { dx: 0, dy: 0, w: 0, h: 0 }; });

    function measure() {
      var savedT = items.map(function (it) { return it.style.transform; });
      var savedW = items.map(function (it) { return it.style.width; });
      var savedH = items.map(function (it) { return it.style.height; });
      items.forEach(function (it) { it.style.transform = 'none'; it.style.width = ''; it.style.height = ''; });

      var nats = items.map(function (it) { return it.getBoundingClientRect(); });
      var uniformW = CARD_ITEM_W;
      var rowH     = ROW_H;
      if (uniformW <= 0) { uniformW = 0; nats.forEach(function (r) { if (r.width  > uniformW) { uniformW = r.width; } }); }
      if (rowH     <= 0) { rowH     = 0; nats.forEach(function (r) { if (r.height > rowH)     { rowH     = r.height; } }); }
      if (!MATCH_HEIGHT) { rowH = 0; }

      var cs    = window.getComputedStyle(card);
      var padL  = parseFloat(cs.paddingLeft)   || 0;
      var padT  = parseFloat(cs.paddingTop)    || 0;
      var padR  = parseFloat(cs.paddingRight)  || 0;
      var padB  = parseFloat(cs.paddingBottom) || 0;
      var headH = (head ? head.offsetHeight + HEAD_GAP : 0) + STACK_TOP;

      var slotH = rowH > 0 ? rowH : (function () {
        var m = 0; nats.forEach(function (r) { if (r.height > m) { m = r.height; } }); return m;
      }());

      var rowsBlock = items.length * (slotH + ROW_GAP) - ROW_GAP;
      card.style.width  = (uniformW + padL + padR) + 'px';
      card.style.height = (padT + headH + rowsBlock + padB) + 'px';

      var savedCT = card.style.transform;
      card.style.transform = 'none';
      var cRect = card.getBoundingClientRect();
      card.style.transform = savedCT || '';

      var left = cRect.left + padL;
      var top  = cRect.top + padT + headH;

      items.forEach(function (it) { it.style.width = uniformW + 'px'; if (rowH > 0) { it.style.height = rowH + 'px'; } });
      var fin = items.map(function (it) { return it.getBoundingClientRect(); });

      for (var s = 0; s < items.length; s++) {
        geo[s] = {
          dx : left - fin[s].left,
          dy : (top + s * (slotH + ROW_GAP)) - fin[s].top,
          w  : uniformW,
          h  : rowH > 0 ? rowH : fin[s].height
        };
      }

      items.forEach(function (it, i) {
        it.style.transform = savedT[i] || '';
        it.style.width  = savedW[i] || '';
        it.style.height = savedH[i] || '';
      });
    }

    var batchCount = Math.ceil(items.length / POP_BATCH);
    var popTls = [];
    var b;
    for (b = 0; b < batchCount; b++) {
      (function (batch) {
        var members     = items.filter(function (it, i) { return Math.floor(i / POP_BATCH) === batch; });
        var memberIdx   = items.map(function (it, i) { return i; }).filter(function (i) { return Math.floor(i / POP_BATCH) === batch; });
        var batchChecks = memberIdx.map(function (i) { return checks[i]; }).filter(Boolean);

        var tl = gsap.timeline({ paused: true });
        tl.to(members, { opacity: 1, scaleX: 1, scaleY: 1, y: 0, duration: POP_DUR, ease: POP_EASE, stagger: POP_STAGGER }, 0);
        if (batchChecks.length) {
          tl.to(batchChecks, { scale: 1, opacity: 1, duration: CHECK_DUR, ease: CHECK_EASE, stagger: POP_STAGGER }, CHECK_DELAY);
        }
        popTls.push(tl);
      }(b));
    }

    var landedBg = LANDED_BG ||
      window.getComputedStyle(card).getPropertyValue(LANDED_BG_VAR).trim() ||
      window.getComputedStyle(document.documentElement).getPropertyValue(LANDED_BG_VAR).trim();

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

    var stepCount = batchCount + 1 + HOLD_STEPS;
    var popPlayed = popTls.map(function () { return false; });
    var gatherOn  = false;

    function thresholdFor(step) { return (step + 1) / stepCount; }
    var popThresh    = popTls.map(function (_, i) { return thresholdFor(i); });
    var gatherThresh = thresholdFor(batchCount);

    function update(p) {
      var i;
      for (i = 0; i < popTls.length; i++) {
        if (p >= popThresh[i] && !popPlayed[i])      { popTls[i].play();    popPlayed[i] = true;  }
        else if (p < popThresh[i] && popPlayed[i])   { popTls[i].reverse(); popPlayed[i] = false; }
      }
      if (p >= gatherThresh && !gatherOn)            { gatherTl.play();    gatherOn = true;  }
      else if (p < gatherThresh && gatherOn)         { gatherTl.reverse(); gatherOn = false; }
    }

    var snapPoints = [0].concat(popThresh, [gatherThresh, 1]);
    var stage = one(section, 'stage');
    var hold  = one(section, 'hold');
    var refresh = function () { measure(); if (!gatherOn) { gatherTl.invalidate(); } };

    if (CARD_FOLLOW && stage) {
      var assemblySteps = STEP_VH * stepCount;
      var pA = assemblySteps / (assemblySteps + FOLLOW_VH);

      if (hold) {
        ScrollTrigger.create({
          trigger: section, start: 'top top',
          end: function () { return '+=' + (window.innerHeight * assemblySteps); },
          pin: hold, pinSpacing: false, refreshPriority: 1, invalidateOnRefresh: true
        });
      }

      ScrollTrigger.create({
        trigger: section, start: 'top top',
        end: function () { return '+=' + (window.innerHeight * (assemblySteps + FOLLOW_VH)); },
        pin: stage, pinSpacing: true, invalidateOnRefresh: true,
        onRefreshInit: refresh,
        onUpdate: function (self) { update(Math.min(1, self.progress / pA)); },
        snap: SNAP ? { snapTo: snapPoints.map(function (v) { return v * pA; }).concat([1]), duration: SNAP_DUR, ease: 'power1.inOut', inertia: false } : false
      });

    } else {
      ScrollTrigger.create({
        trigger: section, start: 'top top',
        end: function () { return '+=' + (window.innerHeight * STEP_VH * stepCount); },
        pin: true, invalidateOnRefresh: true,
        onRefreshInit: refresh,
        onUpdate: function (self) { update(self.progress); },
        snap: SNAP ? { snapTo: snapPoints, duration: SNAP_DUR, ease: 'power1.inOut', inertia: false } : false
      });
    }

    measure();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());
