(function () {

  // corners: scroll-scrubbed border-radius on any [data-corners] element.
  // NB both flow-stack.js and stack.js carry a copy of this module — each runs its own ticker.
  // the max is re-read from the attribute every frame, so a later value is not ignored.
  var ATTR        = 'data-corners';
  var DEFAULT_MAX = 80;
  var SMOOTH      = 0.16;
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
      var live = parseFloat(s.el.getAttribute(ATTR));
      if (isFinite(live) && live > 0) { s.max = live; }
      var r = s.el.getBoundingClientRect();
      if (!r.width && !r.height) { continue; }
      var tT = Math.max(0, Math.min(s.max, r.top));
      var tB = Math.max(0, Math.min(s.max, vh - r.bottom));
      if (s.t < 0) { s.t = tT; s.b = tB; }
      else {
        s.t += (tT - s.t) * k; if (Math.abs(tT - s.t) < 0.1) { s.t = tT; }
        s.b += (tB - s.b) * k; if (Math.abs(tB - s.b) < 0.1) { s.b = tB; }
      }
      if (s.t === s.wt && s.b === s.wb) { continue; }
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

  var IN_VH        = 0.25;
  var GROW_VH      = 0.8;
  var FULL_HOLD_VH = 0.25;
  var SHRINK_VH    = 0.7;
  var TAB_STEP_VH  = 1.0;
  var END_HOLD_VH  = 1.0;

  var CH_VH        = [1.0, 1.0, 1.2];
  var TYPE_END     = 0.9;

  var AUTOPLAY        = true;
  var AUTOPLAY_MS     = [9500, 6200, 6800];
  var AUTOPLAY_REPLAY = true;
  var AUTOPLAY_LOOP   = false;
  var AUTOPLAY_LOOP_TABS = [2];
  var LOOP_GAP_MS     = 400;

  var FAN_EXIT    = 2;
  var FAN_EXIT_AT = 0.78;
  var FAN_IN_T    = 0.10;

  var MOBILE_CH_MS        = [4000, 5200, 6800];

  var MOBILE_IO_MARGIN    = '-15%';

  var MOBILE_MSG_TRIM     = 0;

  var MOBILE_PILL_AT      = 0.06;
  var MOBILE_PILL_Y       = 0;

  var MOBILE_WPM          = true;
  var MOBILE_WPM_LAYOUT   = true;
  var MOBILE_WPM_AUTO_H   = true;
  var MOBILE_WPM_GAP      = 0;
  var MOBILE_WPM_PAD      = 12;

  var MOBILE_WPM_TEXT_PX  = 13;
  // marquee text size in RENDERED px per breakpoint. the authored size is in viewBox units and
  // scales with the card, so it can never hold steady. 0 = leave the authored size alone.
  // NB desktop must stay 0: sizing it inside the measure pass moves the pin start mid-scroll.
  var MQ_TEXT_BP = [
    { min: 992, px: 0 },
    { min: 768, px: 15 },
    { min: 0,   px: 16 }
  ];

  var MOBILE_WPM_MQ_TOP   = 60;
  var MOBILE_MQ_PLACE       = true;
  var MOBILE_MQ_TOP_PX      = 0;
  var MOBILE_MQ_TOP_PX_FLOW = 0;

  var MOBILE_HEAD_PIN     = true;
  var MOBILE_WPM_HEAD_TOP = 38;
  var MOBILE_HEAD_TOP_PX  = 50;
  var MOBILE_HEAD_TOP_BP  = [
    { min: 768, px: 80 },
    { min: 0,   px: 50 }
  ];
  var MOBILE_MQ_TOP_BP    = [];

  var TAB_FADE_MS  = 220;
  var INDICATOR_MS = 500;

  var BOX_OUT_POW   = 4;
  var MSG_BLEED     = true;
  var MSG_BLEED_X   = -1;
  var MSG_BORDER    = true;
  var POLISH_GRAD   = [0.0, 0.46];
  var POLISH_RAWOUT = [0.46, 0.55];
  var POLISH_DROP   = [0.52, 0.66];

  var PLACEHOLDER_OUT = 6.0;
  var POLISH_BAND   = 0.22;
  var POLISH_GAP    = 0.12;
  var POLISH_RISE   = 16;
  var GRAD_WORD_MS  = 350;

  var GLOW_EDGE     = true;
  var GLOW_BAND     = 0.14;
  var GLOW_MAX      = 12;
  var GLOW_COLOR    = '255,255,240';

  var GLOW_DIAG     = 0.35;

  // background-clip:text on the transcript cannot paint a glyph inside a TRANSFORMED child —
  // the transform composites it out of the ancestor's clip and the word renders as nothing.
  // so each word carries its own copy of the gradient. required for WAVE_MOTION.
  var WORD_GRAD     = true;
  var GRAD_SPAN     = 2.2;
  var GRAD_SHIFT_MS = 3200;
  var POLISH_GRAD_CSS = 'linear-gradient(100deg,#F0D7FF 0%,#FFA946 23%,#FF6C4C 39%,#FFBCF2 67%,#7232A6 91%)';
  var WAVE_MOTION   = true;
  var WAVE_AMP      = 7;
  var WAVE_SCALE    = 0.05;
  var WAVE_ROT      = 0;
  var WAVE_BAND     = 0.18;

  var RAW_OUT_WAVE  = true;
  var RAW_OUT_SOFT  = 30;

  var POLISH_WAVE   = true;
  var POLISH_AMP    = 12;

  var PASTE_MODE        = true;
  var RAW_PUSH_Y        = 90;
  var RAW_PUSH_SCALE    = 1;

  var RAW_FADE_FAST     = 1.12;
  var BOX_GROW_FAST     = 2.6;

  var CARD_WIGGLE       = [0.53, 0.72];
  var CARD_WIGGLE_Y     = 14;
  var CARD_WIGGLE_X     = 0;
  var CARD_WIGGLE_ROT   = 0.6;
  var CARD_WIGGLE_CYCLES = 2.2;
  var POLISH_FAST       = 1.7;

  var INTRO_FADE_MS   = 250;
  var MSG_FADE_MS     = 450;
  var BG_FADE_MS      = 700;

  var MELT_INTENSITY  = 0.35;
  var MELT_NOISE      = 3.0;
  var MSG_BOX_GUARD   = true;
  var MSG_HEIGHT_RETRY = false;
  var MSG_TRIGGER     = 0.8;

  var BAR_COLOR = '#FFFFEB';
  var BAR_W      = 3;
  var BAR_GAP    = 3;
  var BAR_MIN    = 3;
  var BAR_MAX    = 14;
  var PILL_PAD_Y = 5;

  var DOTS_PAD_Y = 2;
  var MOBILE_DOTS_PAD_X = 12;
  var MOBILE_DOTS_PAD_Y = 4;
  var PILL_WAVE_PADX = 16;

  var PILL_WAVE_W = 72;
  var PILL_OUT_MS = 240;
  var BULLET_MS  = 300;
  var BAR_SHAPE  = [0.16, 0.42, 0.7, 0.92, 1, 0.88, 0.66, 0.46, 0.28, 0.14];

  var BARS_W        = BAR_SHAPE.length * BAR_W + (BAR_SHAPE.length - 1) * BAR_GAP;
  var PILL_WAVE_PAD_X = PILL_WAVE_W ? Math.max(0, (PILL_WAVE_W - BARS_W) / 2) : PILL_WAVE_PADX;

  var PILL_DOTS_AT = 0.46;
  var DOT_W        = 2.25;
  var DOT_GAP      = 2;
  var DOT_COLOR    = 'rgba(255,255,255,0.4)';
  var DOTS_W       = BAR_SHAPE.length * DOT_W + (BAR_SHAPE.length - 1) * DOT_GAP;
  var DOTS_PAD_X   = PILL_WAVE_W ? Math.max(0, (PILL_WAVE_W - DOTS_W) / 2) : PILL_WAVE_PADX;

  var PILL_REC_SCALE = 1.8;

  var PILL_REC_VH    = 0.22;
  var PILL_REC_Y_MAX = 200;
  var PILL_ICONS_AT  = 0.55;
  var PILL_ICON_SIZE = 18;
  var PILL_LERP      = 0.16;
  var POLISH_PILL_Y  = 25;

  var PILL_ANCHOR    = true;

  var FAN_ANGLE = 45;
  var FAN_TX    = 300;
  var FAN_TX_MOBILE = 460;
  var FAN_SCALE = 1;
  var FAN_CARD_SCALE = 1;

  var FAN_FIT_BOX = true;
  var FAN_FIT_SLACK = true;
  var FAN_BOX_PAD = 0;
  var FAN_STRIP_BR = true;
  var FAN_PIVOT = '50% 100%';
  var FAN_FADE  = 0.6;
  var FAN_CENTER_NUDGE = 0;

  var FAN_CENTER_BY   = '[data-flow="msg-grow"]';

  var FAN_CARD_NUDGE  = -30;
  var FAN_LIFT_END = 0.15;

  var FAN_HOLD     = 0.6;

  var FAN_LERP     = 0.12;

  var POLISH_LERP  = 0.32;
  var SLACK_PAD    = 6;
  var LOGO_ROT     = 90;
  var LOGO_FADE    = 1;
  var LOGO_SCALE   = 0.6;

  var LOGO_SIZE    = { gmail: 34 };
  var LOGO_TOP     = 48;

  var CARD_TARGET  = 0.5;
  var CARD_W       = 400;
  var CARD_H       = 'auto';
  var CARD_H_FALLBACK = 560;
  var CARD_H_MAX   = 0.92;
  var CARD_PAD_BOTTOM = 42;
  var HEAD_TOP     = 0.16;

  var HEAD_TOP_VH  = 0.05;
  var MQ_TOP       = 0.48;
  var MQ_NUDGE_KB   = 0;
  var MQ_NUDGE_CARD = -35;

  var MQ_CARD_CENTER = true;

  var MQ_CARD_W    = 1;

  var MQ_PATH_W    = 0.85;

  var MQ_PATH_TAILS = true;
  var MQ_PATH_OVER  = 0;
  var CARD_DIP     = 70;
  var RADIUS_FULL  = 40;
  var RADIUS_END   = 16;
  var CARD_GAP     = 0;

  var CARD_MIN_W   = 0.20;

  var SPLIT_START  = 0.28;

  var FILL_AT      = 0.80;
  var FILL_OFF     = 0.68;
  var FILL_MS      = 340;
  var SNAP_W       = 0.15;
  var SNAP_S       = 0.05;

  var MQ_DIR       = -1;
  var MQ_TRAVEL    = 10000;

  var MQ_PAD       = 60;
  var MQ_FLOW_FILL = true;

  var MQ_AUTOPLAY  = true;

  var MQ_DUR       = 30;
  var MQ_DUR_KB    = 100;

  var AUDIO_SEL    = '[data-anim="audio"]';
  var AUDIO_MIN    = 0.24;
  var AUDIO_MAX    = 0.98;
  var AUDIO_CYCLES = 8;
  var AUDIO_ENV    = 0.22;
  var AUDIO_SPEED  = 2.4;
  var AUDIO_WAVE   = 0.72;
  var AUDIO_WAVE_SPAN = 1.7;

  var SCRUB_LERP   = 0.18;

  var GREEN_RADIUS = '80px';
  var GREEN_RADIUS_VAR = '--_spacing---section-radius--large';
  var GREEN_RADIUS_BP = [
    { min: 768, px: 80 },
    { min: 0,   rem: 2.5 }
  ];
  var BG_SMOOTH    = 0.12;
  var BG_TRIGGER   = true;
  var BG_DRAW_MS   = 900;
  var BG_DRAW_EASE = 'cubic-bezier(.4,0,.2,1)';
  var SNAP         = true;
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

  function one(root, name)  { return root.querySelector('[' + ATTR + '="' + name + '"]'); }
  function oneF(root, name) { return root.querySelector('[' + FLOW + '="' + name + '"]'); }
  function smooth(t) { return t < 0 ? 0 : (t > 1 ? 1 : t * t * (3 - 2 * t)); }
  function phaseT(p, a, b) { return b > a ? smooth((p - a) / (b - a)) : (p >= b ? 1 : 0); }

  function snapEnds(t) {
    if (t <= 0) { return 0; }
    if (t >= 1) { return 1; }
    if (t < SNAP_S)     { return SNAP_W * (t / SNAP_S); }
    if (t > 1 - SNAP_S) { return 1 - SNAP_W * ((1 - t) / SNAP_S); }
    return SNAP_W + ((t - SNAP_S) / (1 - 2 * SNAP_S)) * (1 - 2 * SNAP_W);
  }

  function fanStep(t, count) {
    if (count <= 1) { return 0; }
    var wH = FAN_HOLD / count;
    var wT = (1 - FAN_HOLD) / (count - 1);
    var x = 0;
    for (var i = 0; i < count; i++) {
      if (t <= x + wH) { return i; }
      x += wH;
      if (i < count - 1) {
        if (t <= x + wT) { return i + smooth((t - x) / wT); }
        x += wT;
      }
    }
    return count - 1;
  }

  // the embed styles #marquee-text-* — those are the <textPath> elements, and an id selector
  // there beats an inline size on the parent <text>. so write both.
  function setMqFont(m, px) {
    if (!m || !m.text) { return; }
    var tp = m.text.querySelector('textPath');
    if (!px) {
      m.text.style.fontSize = '';
      if (tp) { tp.style.removeProperty('font-size'); }
      return;
    }
    m.text.style.fontSize = px + 'px';
    if (tp) { tp.style.setProperty('font-size', px + 'px', 'important'); }
  }

  // SAFARI: `x` on a <text> that carries a <textPath> child does nothing there — SVG says x/y are
  // ignored for text on a path, and only Blink/Gecko bend that into "treat it as the start offset",
  // which is what every marquee below was riding on. startOffset is the spec'd control and reads the
  // same in all three, so drive that whenever there IS a textPath.
  // WebKit re-shapes EVERY glyph on the path on each write, so a redundant one is not free the way it
  // is in Blink. Round to a tenth and skip writes that land on the same value.
  function setTextOffset(textEl, tp, v) {
    if (!textEl) { return; }
    var host = tp || textEl;
    var s = String(Math.round(v * 10) / 10);
    if (host._off === s) { return; }
    host._off = s;
    if (tp) { tp.setAttribute('startOffset', s); }
    else { textEl.setAttribute('x', s); }
  }

  // SAFARI: getComputedTextLength() on the wrapping <text> comes back 0 there, which collapsed every
  // loop length to the fallback. Ask the textPath itself, then a plain off-path copy.
  function textLen(textEl, tp) {
    var n = 0;
    if (!textEl) { return 0; }
    try { n = textEl.getComputedTextLength ? textEl.getComputedTextLength() : 0; } catch (e) { n = 0; }
    if (n > 0) { return n; }
    if (tp) {
      try { n = tp.getComputedTextLength ? tp.getComputedTextLength() : 0; } catch (e2) { n = 0; }
      if (n > 0) { return n; }
      var s = tp.textContent || '';
      try { n = (tp.getSubStringLength && s.length) ? tp.getSubStringLength(0, s.length) : 0; } catch (e3) { n = 0; }
      if (n > 0) { return n; }
    }
    return measureOffPath(textEl, tp);
  }

  // last resort — a hidden copy of the <text> with the path link dropped. Same font, same string, no
  // textPath, so getComputedTextLength answers everywhere.
  function measureOffPath(textEl, tp) {
    var svg = textEl.ownerSVGElement;
    if (!svg) { return 0; }
    var probe = textEl.cloneNode(true), n = 0;
    var inner = probe.querySelector('textPath');
    if (inner) { inner.parentNode.replaceChild(document.createTextNode(inner.textContent || ''), inner); }
    probe.removeAttribute('id');
    probe.setAttribute('x', '0'); probe.setAttribute('y', '0');
    probe.style.visibility = 'hidden';
    // the copy drops the id the embed's CSS sizes it by, so carry over the size that actually rendered
    if (tp) { probe.style.fontSize = window.getComputedStyle(tp).fontSize; }
    svg.appendChild(probe);
    try { n = probe.getComputedTextLength ? probe.getComputedTextLength() : 0; } catch (e4) { n = 0; }
    if (probe.parentNode) { probe.parentNode.removeChild(probe); }
    return n;
  }

  function pickBP(list) {
    if (!list || !list.length) { return 0; }
    var w = window.innerWidth;
    for (var i = 0; i < list.length; i++) {
      if (w >= list[i].min) { return list[i].px || 0; }
    }
    return 0;
  }

  function fanTx() {
    return (window.innerWidth < 992 && FAN_TX_MOBILE > 0) ? FAN_TX_MOBILE : FAN_TX;
  }

  function mqTextPx() {
    if (!MQ_TEXT_BP || !MQ_TEXT_BP.length) { return 0; }
    var w = window.innerWidth;
    for (var i = 0; i < MQ_TEXT_BP.length; i++) {
      if (w >= MQ_TEXT_BP[i].min) { return MQ_TEXT_BP[i].px || 0; }
    }
    return 0;
  }

  function resolveRadius(el) {
    var fallback = parseFloat(GREEN_RADIUS) || 80;
    if (GREEN_RADIUS_BP && GREEN_RADIUS_BP.length) {
      var w = window.innerWidth, rootPx = parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
      for (var b = 0; b < GREEN_RADIUS_BP.length; b++) {
        if (w >= GREEN_RADIUS_BP[b].min) {
          var v = GREEN_RADIUS_BP[b];
          return Math.round(v.rem != null ? v.rem * rootPx : v.px);
        }
      }
    }
    if (!GREEN_RADIUS_VAR || !el) { return fallback; }
    var raw = '';
    try { raw = window.getComputedStyle(el).getPropertyValue(GREEN_RADIUS_VAR).trim(); } catch (e) {}
    if (!raw) {
      try { raw = window.getComputedStyle(document.documentElement).getPropertyValue(GREEN_RADIUS_VAR).trim(); } catch (e2) {}
    }
    if (!raw) {
      try { raw = window.getComputedStyle(el).borderTopLeftRadius; } catch (e3) {}
    }
    var n = parseFloat(raw);
    if (!isFinite(n) || n <= 0) { return fallback; }
    if (/rem\s*$/.test(raw)) {
      n *= parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
    } else if (/em\s*$/.test(raw)) {
      n *= parseFloat(window.getComputedStyle(el).fontSize) || 16;
    }
    return Math.round(n);
  }

  function init() {
    if (typeof window.gsap === 'undefined' || typeof window.ScrollTrigger === 'undefined') {
      console.warn('[flow-stack] GSAP + ScrollTrigger required before this script.');
      return;
    }
    gsap.registerPlugin(ScrollTrigger);

    if (ScrollTrigger.config) { ScrollTrigger.config({ ignoreMobileResize: true }); }

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
        '[data-tab-text].is-active .meeting_tabs_paragraph{opacity:1;transform:none;transition-delay:.16s;}' +

        '[data-tab-indicator]{transition:transform ' + INDICATOR_MS + 'ms cubic-bezier(.4,0,.2,1),' +
          'height ' + INDICATOR_MS + 'ms cubic-bezier(.4,0,.2,1);}' +
        '.flow_w{transition:opacity .12s linear;}' +

        ((WAVE_MOTION || POLISH_WAVE)
          ? '.flow_w,.flow_pw{display:inline-block;vertical-align:baseline;will-change:transform;}'
          : '') +

        '[data-pill]{opacity:0;transform:scaleX(0);transform-origin:center;' +
          'transition:transform .3s cubic-bezier(.34,1.56,.64,1),opacity .18s ease;}' +
        '[data-pill].is-on{opacity:1;transform:scaleX(1);}' +
        '[data-pill] .pill-ch{display:inline-block;opacity:0;transform:translateY(.4em);' +
          'transition:opacity .2s ease,transform .28s cubic-bezier(.34,1.56,.64,1);}' +
        '[data-pill].is-on .pill-ch{opacity:1;transform:none;}' +

        '[data-flow="spinner"]{box-sizing:border-box;display:inline-flex;align-items:center;' +
          'justify-content:center;flex:0 0 auto;width:1em;height:1em;color:#71716e;' +
          'animation:flowSpin 1.6s linear infinite;}' +
        '[data-flow="spinner"] svg{width:100%;height:100%;display:block;}' +
        '@keyframes flowSpin{to{transform:rotate(360deg);}}' +
        '@media (prefers-reduced-motion:reduce){[data-flow="spinner"]{animation-duration:4s;}}' +

        '@property --flowang{syntax:"<angle>";inherits:false;initial-value:0deg;}' +

        '[data-pill="polishing"] .flow_pill-polish_wrap,[data-pill="polishing"]{position:relative;}' +

        '[data-pill="polishing"]{align-self:center;}' +
        '[data-pill="polishing"] .flow_pill-polish_wrap::before,' +
        '[data-pill="polishing"]:not(:has(.flow_pill-polish_wrap))::before{' +
          'content:"";position:absolute;inset:0;border-radius:inherit;padding:2px;' +
          'background:conic-gradient(from var(--flowang),transparent 0deg,#FF6C4C 90deg,#FFA946 170deg,#FFBCF2 250deg,#7232A6 320deg,transparent 360deg);' +
          '-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;' +
          'mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);mask-composite:exclude;' +
          'animation:flowBorder 2.2s linear infinite;pointer-events:none;z-index:2;}' +

        '[data-pill="polishing"] .flow_pill-polish_wrap>*,[data-pill="polishing"]>*{position:relative;z-index:1;}' +
        '@keyframes flowBorder{to{--flowang:360deg;}}' +
        '@media (prefers-reduced-motion:reduce){[data-pill="polishing"] .flow_pill-polish_wrap::before,[data-pill="polishing"]::before{animation:none;}}' +

        '[data-pill="polishing"].is-done .flow_pill-polish_wrap::before,' +
        '[data-pill="polishing"].is-done:not(:has(.flow_pill-polish_wrap))::before{' +
          'background:conic-gradient(from var(--flowang),#EEEBE3 0deg,#FFFFEB 120deg,#EEEBE3 240deg,#FFFFEB 360deg);}' +

        '[data-pill="polishing"] .flow_pill-polish_wrap>*:not(.flow_pill-dots),' +
        '[data-pill="polishing"]:not(:has(.flow_pill-polish_wrap))>*:not(.flow_pill-dots){' +
          'transition:opacity .24s ease,transform .24s ease;transform-origin:center;}' +
        '[data-pill="polishing"].is-done .flow_pill-polish_wrap>*:not(.flow_pill-dots),' +
        '[data-pill="polishing"].is-done:not(:has(.flow_pill-polish_wrap))>*:not(.flow_pill-dots){' +
          'opacity:0;transform:scale(.4);}' +

        '[data-pill="polishing"].is-in .flow_pill-polish_wrap>*:not(.flow_pill-dots),' +
        '[data-pill="polishing"].is-in:not(:has(.flow_pill-polish_wrap))>*:not(.flow_pill-dots){display:none;}' +

        '.flow_pill-dots{display:none;align-items:center;justify-content:center;box-sizing:content-box;' +
          'height:' + BAR_MAX + 'px;padding:' + DOTS_PAD_Y + 'px 0;' +
          'gap:' + BAR_GAP + 'px;pointer-events:none;position:relative;z-index:1;}' +

        '[data-pill="polishing"].is-in{padding:0 !important;}' +
        '[data-pill="polishing"].is-in .flow_pill-polish_wrap{padding:' + PILL_PAD_Y + 'px ' + PILL_WAVE_PAD_X + 'px !important;}' +

        '[data-pill="polishing"].is-in .flow_pill-dots{display:flex;}' +

        '.flow_pill-dot{width:' + BAR_W + 'px;height:0;border-radius:999px;background:' + BAR_COLOR + ';' +
          'opacity:0;flex:0 0 auto;transform:translateY(4px) scale(.6);transform-origin:center;' +
          'transition:opacity .22s ease,transform .38s cubic-bezier(.34,1.56,.64,1),height .45s cubic-bezier(.34,1.56,.64,1);}' +

        '[data-pill="polishing"].is-in .flow_pill-dot{opacity:1;transform:none;height:' + BAR_W + 'px;}' +

        '[data-pill="polishing"].is-in:not(.is-wave) .flow_pill-dots{gap:' + DOT_GAP + 'px;}' +
        '[data-pill="polishing"].is-in:not(.is-wave) .flow_pill-dot{width:' + DOT_W + 'px;height:' +
          DOT_W + 'px;background:' + DOT_COLOR + ';}' +
        '[data-pill="polishing"].is-in:not(.is-wave) .flow_pill-polish_wrap{padding:' + PILL_PAD_Y +
          'px ' + DOTS_PAD_X + 'px !important;}' +

        '[data-pill="polishing"].is-in.is-wave .flow_pill-dot{height:var(--h);}' +
        '@media (prefers-reduced-motion:reduce){[data-pill="polishing"].is-in .flow_pill-dots{animation:none;}}' +
        '@media (prefers-reduced-motion:reduce){[data-pill="polishing"].is-done .flow_pill-dot{transition-duration:.01ms;}}' +

        '[data-flow="intro"]{transition:opacity ' + INTRO_FADE_MS + 'ms ease;}' +
        '[data-flow="intro"]{white-space:nowrap;}' +
        '[data-flow="intro"] [data-flow="marquee"]{white-space:normal;}' +
        '[data-flow="kb"]{white-space:nowrap;overflow:hidden;}' +
        '[data-flow="kb"] [data-flow="marquee"]{white-space:normal;}' +

        '[data-flow="screen"],[data-flow="composer"]{transition:opacity ' + MSG_FADE_MS + 'ms ease;}' +
        '[data-flow="pill-audio"]{transition:opacity .3s ease;}' +

        '[data-type="raw"].is-polishing{background-image:' + POLISH_GRAD_CSS + ';background-size:220% 100%;' +
          '-webkit-background-clip:text;background-clip:text;' +
          'animation:flowPolish 3.2s ease-in-out infinite alternate;}' +

        '[data-type="raw"].is-polishing.is-wordgrad{background-image:none;animation:none;}' +

        '[data-type="raw"].is-polishing .flow_w{transition:color ' + GRAD_WORD_MS + 'ms ease;}' +
        '@keyframes flowPolish{0%{background-position:0% 0;}100%{background-position:100% 0;}}' +
        '@media (prefers-reduced-motion:reduce){[data-type="raw"].is-polishing{animation:none;}' +
          '[data-type="raw"].is-polishing .flow_w{transition:none;}}';
      document.head.appendChild(ms);
    }

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
        section.style.height   = 'calc(100vh + 2px)';
        section.style.overflow = 'hidden';
      }

      function narrowPath(pathEl, vbw, k) {
        if (!pathEl || !k || k >= 1) { return; }
        var d0 = pathEl._d0 || (pathEl._d0 = pathEl.getAttribute('d') || '');
        if (!d0) { return; }
        if (/[aAhHvV]/.test(d0)) {
          console.warn('[flow-stack] MQ_PATH_W: path uses A/H/V commands — left alone', pathEl);
          return;
        }
        var cx = vbw / 2, n = -1;
        var d1 = d0.replace(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi, function (num) {
          n++;
          if (n % 2) { return num; }
          return String(Math.round((cx + (parseFloat(num) - cx) * k) * 1000) / 1000);
        });

        if (MQ_PATH_TAILS) {
          var head = /^\s*M\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/.exec(d1);
          var nums = d1.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi);
          if (head && nums && nums.length >= 2) {
            var y0 = head[2], yN = nums[nums.length - 1];
            d1 = 'M' + (-MQ_PATH_OVER) + ' ' + y0 + ' L' + head[1] + ' ' + y0 +
                 d1.slice(head[0].length) +
                 ' L' + (vbw + MQ_PATH_OVER) + ' ' + yN;
          }
        }
        pathEl.setAttribute('d', d1);
        teardown.push(function () { pathEl.setAttribute('d', d0); });
      }
      var marquees = [];
      Array.prototype.forEach.call(section.querySelectorAll('[' + FLOW + '="marquee"]'), function (wrapEl) {
        var textEl = wrapEl.querySelector('text');
        var svgEl  = wrapEl.querySelector('svg');
        if (!textEl) { return; }
        var tpEl   = textEl.querySelector('textPath');
        var period = Math.abs(parseFloat(textEl.getAttribute('x'))) || 4000;
        var vbw    = (svgEl && svgEl.viewBox && svgEl.viewBox.baseVal && svgEl.viewBox.baseVal.width)  || 928;
        var vbh    = (svgEl && svgEl.viewBox && svgEl.viewBox.baseVal && svgEl.viewBox.baseVal.height) || 76;

        var isKb   = !!(kb && kb.contains(wrapEl));
        if (!isKb) { narrowPath(wrapEl.querySelector('path'), vbw, MQ_PATH_W); }
        var startX = (isKb || MQ_FLOW_FILL) ? 0 : (vbw + MQ_PAD);
        marquees.push({
          text: textEl, tp: tpEl, svg: svgEl, period: period, start: startX, isKb: isKb,
          vbw: vbw, vbh: vbh, len: 0,
          rand: Math.random(),
          mult: parseFloat(wrapEl.getAttribute('data-speed')) || 1
        });
        // the authored x would stack on top of the startOffset we drive from here on
        if (tpEl) { textEl.setAttribute('x', '0'); }
        setTextOffset(textEl, tpEl, startX);
      });

      var mqClock = 0;
      // perf bisect: flowMq(false) in the console freezes the marquees without touching the rest of
      // the rig, so their share of a slow frame can be read straight off the fps meter
      var mqOff = false;
      window.flowMq = function (on) { mqOff = (on === false); return !mqOff; };
      function updateMarquees(p) {
        if (mqOff) { return; }
        for (var i = 0; i < marquees.length; i++) {
          var m = marquees[i];
          if (MQ_AUTOPLAY) {

            // data-speed (m.mult) applies here too, not just on the scroll-tied path
            var dur = (m.isKb ? MQ_DUR_KB : MQ_DUR) / (m.mult || 1);
            var frac = ((mqClock / dur) % 1 + 1) % 1;
            var loopLen = (m.len > m.vbw) ? Math.min(m.period, m.len - m.vbw) : m.period;
            setTextOffset(m.text, m.tp, -loopLen * (1 - frac));
            continue;
          }

          var svgW  = m.svg ? m.svg.getBoundingClientRect().width : 0;
          if (svgW <= 0) { continue; }
          var scale = svgW / m.vbw;
          var travel = -MQ_DIR * p * (MQ_TRAVEL * m.mult) / scale;
          var x = m.start - travel;
          if (x < 0) {
            var per = m.len > 0 ? Math.min(m.period, Math.max(100, m.len - m.vbw - MQ_PAD)) : m.period;
            var xx = -x;
            x = -((xx + Math.min(xx, per) * m.rand) % per);
          }
          setTextOffset(m.text, m.tp, x);
        }
      }

      var audioBars = [];
      (function collectAudio() {

        // every audio svg, not just the first — the mobile card carries its own copy
        var hosts = section.querySelectorAll(AUDIO_SEL);
        if (!hosts.length) { hosts = document.querySelectorAll(AUDIO_SEL); }
        if (!hosts.length) { hosts = section.querySelectorAll('.flow_svg-inner'); }
        if (!hosts.length) { hosts = document.querySelectorAll('.flow_svg-inner'); }
        if (!hosts.length) { if (DEBUG) { console.warn('[flow-stack] no audio svg found'); } return; }
        Array.prototype.forEach.call(hosts, function (host) {
          var svg  = (host.tagName && host.tagName.toLowerCase() === 'svg') ? host : host.querySelector('svg');
          var vbh  = (svg && svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.height) || 33;
          Array.prototype.forEach.call(host.querySelectorAll('rect'), function (r) {
            var y = parseFloat(r.getAttribute('y')) || 0;
            var h = parseFloat(r.getAttribute('height')) || parseFloat(window.getComputedStyle(r).height) || 0;
            audioBars.push({
              el: r, cy: y + h / 2, vbh: vbh,
              ceil: AUDIO_MIN + (AUDIO_MAX - AUDIO_MIN) * (0.82 + 0.18 * Math.random()),
              f1: 0.8 + Math.random() * 1.5, f2: 2.0 + Math.random() * 3.0,
              ph1: Math.random() * 6.2832, ph2: Math.random() * 6.2832
            });
          });
        });
        if (DEBUG) { console.log('[flow-stack] audio bars:', audioBars.length, 'from', hosts.length, 'svg(s)'); }
      }());

      var envPh1 = Math.random() * 6.2832, envPh2 = Math.random() * 6.2832;
      var audioClock = 0;

      function updateAudio(p) {
        var TWO_PI = Math.PI * 2;
        var t = p * AUDIO_CYCLES + audioClock * AUDIO_SPEED;

        var e = (0.5 + 0.5 * Math.sin(t * TWO_PI * 0.9 + envPh1)) *
                (0.5 + 0.5 * Math.sin(t * TWO_PI * 2.3 + envPh2));
        var n = audioBars.length;
        for (var i = 0; i < n; i++) {
          var b = audioBars[i];

          var v = 0.55 * Math.sin(t * TWO_PI * b.f1 + b.ph1) +
                  0.45 * Math.sin(t * TWO_PI * b.f2 + b.ph2);
          var sJag = (0.5 + 0.5 * v) * (AUDIO_ENV * e + (1 - AUDIO_ENV));

          var xi = n > 1 ? i / (n - 1) : 0.5;
          var wave = 0.6 * Math.sin((xi * AUDIO_WAVE_SPAN - t) * TWO_PI) +
                     0.4 * Math.sin((xi * AUDIO_WAVE_SPAN * 0.5 - t * 0.6) * TWO_PI + 1.7);
          var sWav = (0.5 + 0.5 * wave) * (0.7 + 0.3 * Math.sin(xi * Math.PI));
          var s = AUDIO_WAVE * sWav + (1 - AUDIO_WAVE) * sJag;
          var h = (AUDIO_MIN + (b.ceil - AUDIO_MIN) * s) * b.vbh;
          var y = b.cy - h / 2;

          b.el.style.setProperty('height', h + 'px');
          b.el.style.setProperty('y', y + 'px');
          b.el.setAttribute('height', String(h));
          b.el.setAttribute('y', String(y));
        }
      }

      guardStyle(stage);
      stage.style.display = 'block';
      stage.style.width   = '100%';
      if (window.getComputedStyle(stage).position === 'static') { stage.style.position = 'relative'; }
      guardStyle(card);
      card.style.position   = 'absolute';
      card.style.margin     = '0';
      card.style.overflow   = 'hidden';
      card.style.boxSizing  = 'border-box';
      card.style.willChange = 'width, transform';

      var cardImgs = [];
      Array.prototype.forEach.call(card.querySelectorAll('img'), function (im) {
        guardStyle(im);
        im.style.objectPosition = 'right center';
        cardImgs.push(im);
      });

      var bgImgs = Array.prototype.slice.call(card.querySelectorAll('[data-bg]')).sort(function (a, b) {
        return (parseInt(a.getAttribute('data-bg'), 10) || 0) - (parseInt(b.getAttribute('data-bg'), 10) || 0);
      });
      bgImgs.forEach(function (im, k) {
        guardStyle(im);

        im.style.setProperty('display', 'block', 'important');
        im.style.setProperty('visibility', 'visible', 'important');
        im.style.position = 'absolute';
        im.style.top = '0'; im.style.left = '0';
        im.style.width = '100%'; im.style.height = '100%';
        im.style.objectFit = 'cover';
        im.style.zIndex = '0';
        im.style.pointerEvents = 'none';
        im.style.opacity = k === 0 ? '1' : '0';
      });

      var bgWrap = null;
      if (bgImgs.length) {
        bgWrap = card.querySelector('.flow-bg-layer');
        if (!bgWrap) {
          bgWrap = document.createElement('div');
          bgWrap.className = 'flow-bg-layer';
          card.insertBefore(bgWrap, card.firstChild);
        }
        bgWrap.style.cssText = 'position:absolute;inset:0;overflow:hidden;border-radius:inherit;' +
          'z-index:0;pointer-events:none;';
        bgImgs.forEach(function (im) { bgWrap.appendChild(im); });
      }

      var meltGL = null;
      (function initMeltGL() {
        if (!bgWrap || bgImgs.length < 2 || MELT_INTENSITY <= 0) { return; }
        var canvas = document.createElement('canvas');
        canvas.className = 'flow-melt-canvas';
        canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;opacity:0;pointer-events:none;z-index:1;';
        bgWrap.appendChild(canvas);
        var gl = null;
        try { gl = canvas.getContext('webgl', { premultipliedAlpha: false, alpha: true }) || canvas.getContext('experimental-webgl'); } catch (e) {}
        if (!gl) { if (canvas.parentNode) { canvas.parentNode.removeChild(canvas); } return; }

        var VS = 'attribute vec2 aPos;varying vec2 vUv;void main(){vUv=aPos*0.5+0.5;gl_Position=vec4(aPos,0.,1.);}';
        var FS = [
          'precision mediump float;',
          'uniform sampler2D uFrom;uniform sampler2D uTo;',
          'uniform float uDisp;uniform float uIntensity;uniform float uNoise;',
          'uniform vec4 uCoverFrom;uniform vec4 uCoverTo;varying vec2 vUv;',
          'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}',
          'float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);float a=hash(i),b=hash(i+vec2(1.,0.)),c=hash(i+vec2(0.,1.)),d=hash(i+vec2(1.,1.));vec2 u=f*f*(3.-2.*f);return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);}',
          'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*vnoise(p);p*=2.;a*=.5;}return v;}',
          'void main(){',
          ' float n=fbm(vUv*uNoise);float amt=n*uIntensity;',
          ' vec2 uF=clamp(vUv+vec2(amt*uDisp,0.0),0.,1.)*uCoverFrom.xy+uCoverFrom.zw;',
          ' vec2 uT=clamp(vUv-vec2(amt*(1.0-uDisp),0.0),0.,1.)*uCoverTo.xy+uCoverTo.zw;',
          ' gl_FragColor=mix(texture2D(uFrom,uF),texture2D(uTo,uT),uDisp);',
          '}'
        ].join('\n');

        function sh(t, src) { var s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s);
          if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn('[melt] shader', gl.getShaderInfoLog(s)); } return s; }
        var prog = gl.createProgram();
        gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
        gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn('[melt] link', gl.getProgramInfoLog(prog)); if (canvas.parentNode) { canvas.parentNode.removeChild(canvas); } return; }
        gl.useProgram(prog);

        var buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        var aPos = gl.getAttribLocation(prog, 'aPos');
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

        var uFrom = gl.getUniformLocation(prog, 'uFrom'), uTo = gl.getUniformLocation(prog, 'uTo'),
            uDisp = gl.getUniformLocation(prog, 'uDisp'), uInt = gl.getUniformLocation(prog, 'uIntensity'),
            uNoi = gl.getUniformLocation(prog, 'uNoise'),
            uCF = gl.getUniformLocation(prog, 'uCoverFrom'), uCT = gl.getUniformLocation(prog, 'uCoverTo');
        gl.uniform1i(uFrom, 0); gl.uniform1i(uTo, 1);
        gl.uniform1f(uInt, MELT_INTENSITY); gl.uniform1f(uNoi, MELT_NOISE);

        function mkTex() { var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([20, 20, 20, 255]));
          return t; }
        var meta = bgImgs.map(function (im) {
          var m = { tex: mkTex(), w: 1, h: 1, ready: false };
          var ld = new Image(); ld.crossOrigin = 'anonymous';
          ld.onload = function () {
            try {
              gl.bindTexture(gl.TEXTURE_2D, m.tex);
              gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
              gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ld);
              m.w = ld.naturalWidth || 1; m.h = ld.naturalHeight || 1; m.ready = true;
            } catch (e) { console.warn('[melt] texture upload failed (CORS?) — plain crossfade fallback', e); }
          };
          ld.onerror = function () {};
          ld.src = im.currentSrc || im.src;
          return m;
        });

        function cover(m) {
          var cw = canvas.width || 1, ch = canvas.height || 1;
          var ca = cw / ch, ia = m.w / m.h, sx, sy;
          if (ia > ca) { sx = ca / ia; sy = 1; } else { sx = 1; sy = ia / ca; }
          return [sx, sy, (1 - sx) / 2, (1 - sy) / 2];
        }
        function resize() {
          var r = canvas.getBoundingClientRect();
          var dpr = Math.min(window.devicePixelRatio || 1, 2);
          var w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
          if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
          gl.viewport(0, 0, canvas.width, canvas.height);
        }
        meltGL = {
          ready: function (a, b) { return meta[a] && meta[b] && meta[a].ready && meta[b].ready; },
          show: function (on) { canvas.style.opacity = on ? '1' : '0'; },
          render: function (a, b, disp) {
            resize();
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, meta[a].tex);
            gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, meta[b].tex);
            var cf = cover(meta[a]), ct = cover(meta[b]);
            gl.uniform4f(uCF, cf[0], cf[1], cf[2], cf[3]);
            gl.uniform4f(uCT, ct[0], ct[1], ct[2], ct[3]);
            gl.uniform1f(uDisp, disp);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          }
        };
        teardown.push(function () { if (canvas.parentNode) { canvas.parentNode.removeChild(canvas); } });
      }());

      var bgShown = 0, bgMeltTween = null;
      function setBgChapter(idx) {
        if (bgImgs.length < 2) { return; }
        var want = idx < 1 ? 0 : Math.min(idx, bgImgs.length - 1);
        if (want === bgShown) { return; }
        var prev = bgShown;
        bgShown = want;
        if (bgMeltTween) { bgMeltTween.kill(); bgMeltTween = null; }
        if (meltGL && meltGL.ready(prev, want)) {
          meltGL.render(prev, want, 0);
          meltGL.show(true);
          bgImgs[prev].style.opacity = '0'; bgImgs[want].style.opacity = '0';
          var proxy = { p: 0 };
          bgMeltTween = gsap.to(proxy, {
            p: 1, duration: BG_FADE_MS / 1000, ease: 'power1.inOut',
            onUpdate: function () { meltGL.render(prev, want, proxy.p); },
            onComplete: function () {
              bgImgs[want].style.opacity = '1';
              meltGL.show(false);
              for (var b = 0; b < bgImgs.length; b++) { if (b !== want) { bgImgs[b].style.opacity = '0'; } }
              bgMeltTween = null;
            }
          });
        } else {
          for (var b = 0; b < bgImgs.length; b++) { bgImgs[b].style.opacity = b === want ? '1' : '0'; }
        }
      }
      teardown.push(function () { if (bgMeltTween) { bgMeltTween.kill(); } });
      if (kb) {
        guardStyle(kb);
        kb.style.margin    = '0';
        kb.style.overflow  = 'hidden';
        kb.style.boxSizing = 'border-box';
      }

      var kbMq   = kb   ? kb.querySelector('[' + FLOW + '="marquee"]')   : null;
      var cardMq = card ? card.querySelector('[' + FLOW + '="marquee"]') : null;
      if (kbMq)   { guardStyle(kbMq);   kbMq.style.marginRight = 'auto'; }
      if (cardMq) { guardStyle(cardMq); cardMq.style.position  = 'absolute'; }

      [[kb, kbMq], [card, cardMq]].forEach(function (pair) {
        var c = pair[0], mq = pair[1];
        if (!c || !mq) { return; }
        guardStyle(mq);
        if (mq.parentElement && mq.parentElement !== c) {
          guardStyle(mq.parentElement);
          mq.parentElement.style.position = 'static';
        }
        mq.style.position = 'absolute';
      });
      if (kbMq) { kbMq.style.left = '0'; }
      [kbMq, cardMq].forEach(function (mq) {
        if (!mq) { return; }
        var svg = mq.querySelector('svg');
        if (svg) { guardStyle(svg); svg.style.width = '100%'; }
      });

      var headEls = [];
      [kb, card].forEach(function (c) {
        if (!c) { return; }
        var head = c.querySelector('.flow_heading-wrap');
        if (!head) { return; }
        guardStyle(head);
        if (window.getComputedStyle(c).position === 'static') { c.style.position = 'relative'; }
        if (head.parentElement && head.parentElement !== c) {
          guardStyle(head.parentElement);
          head.parentElement.style.position = 'static';
        }
        head.style.position  = 'absolute';
        head.style.left      = '0';
        head.style.right     = '0';
        head.style.margin    = '0';
        head.style.textAlign = 'center';
        headEls.push(head);
      });
      function alignHeads() {
        if (!isDesktop) {
          for (var hm = 0; hm < headEls.length; hm++) { headEls[hm].style.top = ''; }
          return;
        }

        var headPx = (HEAD_TOP_VH ? (window.innerHeight * HEAD_TOP_VH) : (HEAD_TOP * stageH)) + 'px';
        for (var hi = 0; hi < headEls.length; hi++) { headEls[hi].style.top = headPx; }
        var mqBase = MQ_TOP * stageH;
        if (kbMq)   { kbMq.style.top   = (mqBase + MQ_NUDGE_KB)   + 'px'; }
        if (cardMq) { cardMq.style.top = (mqBase + MQ_NUDGE_CARD) + 'px'; }
      }

      var stageW = 0, stageH = 0, padL = 0, padT = 0, cardHpx = CARD_H_FALLBACK, msgCollapsedH = 0, msgExpandedH = 0, msgContainBaseH = 0, transcriptH = 0;
      var refreshing = false;
      var heightsOK = false, heightsRetryT = 0, heightsTries = 0;
      var cardMqW = 0;
      var pillRecY = -180;
      function measureStage() {

        if (kb) { kb.style.width = ''; kb.style.height = ''; kb.style.visibility = ''; }
        card.style.width = ''; card.style.height = '';

        if (transcriptEl) { transcriptEl.style.height = ''; transcriptEl.style.transform = ''; transcriptEl.style.opacity = ''; }
        if (msgGrowEl)    { msgGrowEl.style.height = ''; msgGrowEl.style.marginTop = '0px'; }
        if (msgContainEl) { msgContainEl.style.height = ''; msgContainEl.style.marginTop = '0px'; }
        if (polishedEl)   { polishedEl.style.display = ''; }

        var cs = window.getComputedStyle(stage);
        padL = parseFloat(cs.paddingLeft) || 0;
        padT = parseFloat(cs.paddingTop)  || 0;
        stageW = (stage.clientWidth  - padL - (parseFloat(cs.paddingRight)  || 0)) || 1;
        stageH = (stage.clientHeight - padT - (parseFloat(cs.paddingBottom) || 0)) || 1;
        cardMqW = stageW * MQ_CARD_W;
        if (kbMq)   { kbMq.style.width   = stageW + 'px'; }
        if (cardMq) { cardMq.style.width = cardMqW + 'px'; }

        for (var mi = 0; mi < marquees.length; mi++) {
          var mm = marquees[mi];
          if (mm.svg) {
            var mw = mm.isKb ? stageW : cardMqW;
            mm.svg.style.width    = mw + 'px';
            mm.svg.style.height   = (mw * mm.vbh / mm.vbw) + 'px';
            mm.svg.style.overflow = 'visible';
            var mqPx = mqTextPx();
            if (mm.text) { setMqFont(mm, (mqPx > 0 && mw > 0) ? (mqPx * mm.vbw / mw).toFixed(1) : 0); }
          }
          mm.len = textLen(mm.text, mm.tp);
        }

        if (CARD_H === 'auto' && screenEl) {
          var saved = screenEl.style.cssText;
          screenEl.style.position = 'static';
          screenEl.style.height   = 'auto';
          screenEl.style.width    = Math.min(CARD_W, stageW) + 'px';
          screenEl.style.opacity  = '0';

          transcriptH = transcriptEl ? transcriptEl.offsetHeight : 0;

          if (msgGrowEl) {
            var mv = msgGrowEl.style.cssText;
            var mcv = msgContainEl ? msgContainEl.style.cssText : null;
            msgGrowEl.style.height = 'auto'; msgGrowEl.style.maxHeight = 'none'; msgGrowEl.style.overflow = 'visible';
            if (polishedEl) { polishedEl.style.display = 'none'; }
            msgCollapsedH = msgGrowEl.offsetHeight;
            if (msgContainEl) { msgContainEl.style.height = 'auto'; msgContainBaseH = msgContainEl.offsetHeight; }
            if (polishedEl) { polishedEl.style.display = ''; }
            msgExpandedH = msgGrowEl.offsetHeight;
            msgGrowEl.style.cssText = mv; msgGrowEl.style.overflow = 'hidden';
            if (msgContainEl && mcv != null) { msgContainEl.style.cssText = mcv; }

            // a measurement taken before layout comes back 0, and every height write below would
            // then pin the box to 0px with overflow:hidden — the message UI silently disappears
            heightsOK = msgCollapsedH > 0;
            if (heightsOK) { heightsTries = 0; }
          }

          var mgh = msgGrowEl ? msgGrowEl.style.cssText : null;
          if (msgGrowEl) { msgGrowEl.style.height = msgCollapsedH + 'px'; msgGrowEl.style.overflow = 'hidden'; }
          var screenBase = screenEl.offsetHeight;
          if (msgGrowEl && mgh != null) { msgGrowEl.style.cssText = mgh; }

          screenEl.style.cssText = saved;

          cardHpx = (screenBase > 0 ? screenBase : CARD_H_FALLBACK) + CARD_PAD_BOTTOM;
        } else {
          cardHpx = (typeof CARD_H === 'number') ? CARD_H : CARD_H_FALLBACK;
        }

        cardHpx = Math.min(cardHpx, (window.innerHeight || 900) * CARD_H_MAX);

        pillRecY = -Math.min(PILL_REC_Y_MAX, Math.round(stageH * PILL_REC_VH));
      }

      var fillA = { v: 0 }, fillLatched = false, lastMorphP = 0;
      function triggerFill(on) {
        gsap.to(fillA, { v: on ? 1 : 0, duration: FILL_MS / 1000, ease: 'power3.out',
          overwrite: true, onUpdate: function () { applyMorph(lastMorphP); } });
      }

      function applyMorph(p) {
        lastMorphP = p;

        var pinnedPhoto = (p < pBh);
        for (var im = 0; im < bgImgs.length; im++) {
          var bi = bgImgs[im];
          if (pinnedPhoto) {
            bi.style.width  = stageW + 'px'; bi.style.height = stageH + 'px';
            bi.style.left   = 'auto';        bi.style.right  = '0';
          } else {
            bi.style.width  = '100%';        bi.style.height = '100%';
            bi.style.left   = '0';           bi.style.right  = 'auto';
          }
          bi.style.objectPosition = '50% center';
        }
        var cardW, cardH = stageH, kbW = 0;
        if (p < pB) {
          var gt = (p < pA || pB <= pA) ? 0 : (p - pA) / (pB - pA);

          if (!fillLatched && gt >= FILL_AT)      { fillLatched = true;  triggerFill(true); }
          else if (fillLatched && gt < FILL_OFF)  { fillLatched = false; triggerFill(false); }
          var Lp = stageW * SPLIT_START * (1 - snapEnds(gt));

          var lpFrac = Lp / stageW;
          if (lpFrac < CARD_MIN_W) { Lp *= smooth(lpFrac / CARD_MIN_W); }
          Lp *= (1 - fillA.v);
          cardW = stageW - Lp;
          kbW   = Math.max(0, Lp - CARD_GAP);
        } else if (p < pBh) {
          cardW = stageW;
        } else {
          var t = phaseT(p, pBh, pC);
          cardW = stageW - (stageW - Math.min(CARD_W, stageW)) * t;
          cardH = stageH + (cardHpx - stageH) * t;
          card.style.borderRadius = (RADIUS_FULL + (RADIUS_END - RADIUS_FULL) * t) + 'px';
        }
        if (p < pBh) { card.style.borderRadius = ''; }
        if (kb) {
          kb.style.width      = kbW + 'px';
          kb.style.height     = stageH + 'px';
          kb.style.visibility = kbW < 2 ? 'hidden' : '';
        }

        var left = (p < pBh) ? padL + (stageW - cardW) : padL + (stageW - cardW) / 2;

        if (cardMq) {
          var ca = MQ_CARD_CENTER ? 1 : phaseT(p, pBh, pC);
          cardMq.style.left = (ca * (cardW - cardMqW) / 2) + 'px';
        }
        card.style.left       = left + 'px';
        card.style.top        = (padT + (stageH - cardH) / 2) + 'px';
        card.style.width      = cardW + 'px';
        card.style.height     = cardH + 'px';
        card.style.visibility = cardW < 2 ? 'hidden' : '';
      }

      var greenPanel = one(section, 'green');
      if (!greenPanel) {
        greenPanel = card;
        while (greenPanel.parentNode && greenPanel.parentNode !== section) { greenPanel = greenPanel.parentNode; }
      }
      var canLeave = greenPanel !== card;
      guardStyle(greenPanel);
      if (canLeave && (GREEN_RADIUS || (GREEN_RADIUS_BP && GREEN_RADIUS_BP.length))) {
        var setGreenRadius = function () {
          var v = String(resolveRadius(greenPanel));
          if (greenPanel.getAttribute('data-corners') !== v) {
            greenPanel.setAttribute('data-corners', v);
            if (DEBUG) { console.log('[flow-stack] green radius ' + v + 'px at ' + window.innerWidth + 'px'); }
          }
        };
        setGreenRadius();
        window.addEventListener('resize', setGreenRadius);
        teardown.push(function () { window.removeEventListener('resize', setGreenRadius); });
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
      var autoTp = 0, autoPlaying = false, autoDur = 2000, autoDone = {}, sceneLastP = 0;
      var loopWaitT = 0;
      function tabLoops(n) {
        return AUTOPLAY_LOOP || (n >= 0 && AUTOPLAY_LOOP_TABS.indexOf(n) !== -1);
      }
      var bgTargetP = 0, bgCurrentP = 0;

      var introEl      = oneF(section, 'intro');
      if (introEl) { introEl.style.opacity = '0'; }
      var screenEl     = oneF(section, 'screen');
      var composerEl   = oneF(section, 'composer');
      var pillAudioEl  = oneF(section, 'pill-audio');
      var pillExtras   = pillAudioEl ? Array.prototype.slice.call(pillAudioEl.querySelectorAll('[data-pill-extra]')) : [];
      if (pillAudioEl) { guardStyle(pillAudioEl); pillAudioEl.style.transformOrigin = '50% 50%'; }

      pillExtras.forEach(function (el) {
        guardStyle(el);
        el.style.flex = '0 0 auto';
        el.style.overflow = 'hidden';
        el.style.opacity = '0';
        el.style.width = '0px';
        el.style.height = '0px';
        el.style.display = 'none';
      });
      var transcriptEl = card ? card.querySelector('[data-type="raw"]') : null;

      // the raw-out mask goes on the WRAPPER: masking the same element that has
      // background-clip:text fights it on Blink/WebKit
      var rawWrap = (transcriptEl && transcriptEl.parentNode) ? transcriptEl.parentNode : transcriptEl;
      var polishedEl   = card ? card.querySelector('[data-type="polished"]') : null;
      var destWrap     = card ? card.querySelector('.flow_icons-destination') : null;

      var fanScope   = screenEl || section;
      var fanLayer   = oneF(section, 'fan') || fanScope.querySelector('[data-flow="fan"]');

      var destLogos  = destWrap ? Array.prototype.slice.call(destWrap.querySelectorAll('[data-dest]')) : [];

      var destExtra  = Array.prototype.slice.call(fanScope.querySelectorAll('[data-dest]')).filter(function (el) {
        if (destWrap && destWrap.contains(el)) { return false; }
        return (el.getAttribute('data-dest') || '').trim().toLowerCase() !== 'slack';
      });

      var DEST_ORDER = { claude: 1, gmail: 2 };
      destExtra.sort(function (a, b) {
        return (DEST_ORDER[a.getAttribute('data-dest')] || 9) - (DEST_ORDER[b.getAttribute('data-dest')] || 9);
      });
      var slackCenterY = 0;
      var fanPositioned = false;
      var fanWasShown = false, fanPlacedAt = 0;

      // don't touch screenEl's position — it's an absolute cover, and overriding it drops the
      // transcript + note out of view. it already anchors the cards.
      if (fanLayer) { guardStyle(fanLayer); fanLayer.style.position = 'absolute'; fanLayer.style.opacity = '0'; }
      destExtra.forEach(function (el) {
        guardStyle(el);
        el.style.position = 'absolute';
        el.style.willChange = 'transform,opacity';
        el.style.transformOrigin = FAN_PIVOT;
        el.style.backfaceVisibility = 'hidden';
        el.style.opacity = '0';
      });
      destLogos.forEach(function (el) {
        guardStyle(el); el.style.transformOrigin = '50% 50%'; el.style.opacity = '0';
        var lk = (el.getAttribute('data-dest') || '').trim().toLowerCase();
        if (LOGO_SIZE[lk]) { el.style.width = LOGO_SIZE[lk] + 'px'; el.style.height = 'auto'; }
      });

      function stripTrailingBr(root) {
        if (!FAN_STRIP_BR || !root) { return; }
        var hosts = [root].concat(Array.prototype.slice.call(root.querySelectorAll('*')));
        hosts.forEach(function (h) {
          var n = h.lastChild, removed = [];
          while (n) {
            var prev = n.previousSibling;
            if (n.nodeType === 3 && !(n.nodeValue || '').trim()) { removed.push(n); }
            else if (n.nodeType === 1 && n.tagName === 'BR')     { removed.push(n); }
            else { break; }
            n = prev;
          }
          if (!removed.length) { return; }
          removed.forEach(function (node) { h.removeChild(node); });
          teardown.push(function () {
            for (var i = removed.length - 1; i >= 0; i--) { h.appendChild(removed[i]); }
          });
        });
      }

      // the composer's box keeps a FIXED height in ch3 (msgExpandedH, measured at build with the
      // placeholder and polished block in it). clamp it to its own last line instead, the way the
      // fan copies are clamped, so SLACK_PAD is the only space under the text.
      var slackFitCache = 0;
      function fitSlackH() {
        if (!FAN_FIT_SLACK || !msgGrowEl) { return msgExpandedH; }
        if (slackFitCache > 0) { return slackFitCache; }
        var sv = msgGrowEl.style.cssText;
        msgGrowEl.style.height = 'auto'; msgGrowEl.style.maxHeight = 'none'; msgGrowEl.style.overflow = 'visible';
        var bottom = mobileTextBottom(msgGrowEl);
        var fit = bottom ? Math.round(bottom - msgGrowEl.getBoundingClientRect().top +
          (parseFloat(window.getComputedStyle(msgGrowEl).paddingBottom) || 0)) : 0;
        msgGrowEl.style.cssText = sv;
        slackFitCache = (fit > 0 && fit < msgExpandedH) ? fit : msgExpandedH;
        if (DEBUG) { console.log('[flow-stack] slack box: expanded=' + msgExpandedH + ' fitted=' + slackFitCache); }
        return slackFitCache;
      }

      function fitFanBox(el) {
        if (!el) { return; }
        stripTrailingBr(el);
        if (!FAN_FIT_BOX) { return; }
        var mg = el.querySelector('[' + FLOW + '="msg-grow"]');
        if (!mg) { return; }
        var sv = mg.style.cssText;
        mg.style.height = 'auto'; mg.style.maxHeight = 'none'; mg.style.overflow = 'visible';
        var bottom = mobileTextBottom(mg);
        var fit = bottom ? Math.round(bottom - mg.getBoundingClientRect().top +
          (parseFloat(window.getComputedStyle(mg).paddingBottom) || 0)) : null;
        mg.style.cssText = sv;
        if (fit && fit > 0) {
          guardStyle(mg);
          mg.style.height = Math.max(0, fit + FAN_BOX_PAD) + 'px';
          mg.style.overflow = 'hidden';
        }
      }

      // placed by RECT, not offsetTop: the extra cards don't share the composer's offsetParent.
      // returns false when the geometry isn't trustworthy yet, so the caller retries instead of
      // latching a bad placement. do NOT re-trigger this on frame-height change — placing the
      // cards clamps their boxes, which changes that height, which loops.
      function positionFanCards() {
        if (!composerEl) { return false; }
        var scr = screenEl || composerEl.offsetParent;
        var sr  = scr ? scr.getBoundingClientRect() : { top: 0, left: 0, height: 0 };
        var cr  = composerEl.getBoundingClientRect();
        var scH = sr.height || (scr ? scr.clientHeight : 0);

        if (!scH || !cr.width || !cr.height) { return false; }

        composerEl._fanCY = Math.round(scH / 2 - ((cr.top - sr.top) + cr.height / 2));
        for (var i = 0; i < destExtra.length; i++) {
          var el = destExtra[i];
          var prevT = el.style.transform;
          el.style.transform = 'none';
          el.style.width = cr.width + 'px';
          fitFanBox(el);
          var er   = el.getBoundingClientRect();
          var curT = parseFloat(el.style.top)  || 0;
          var curL = parseFloat(el.style.left) || 0;
          el.style.top  = (curT + (cr.top  - er.top))  + 'px';
          el.style.left = (curL + (cr.left - er.left)) + 'px';

          el.style.transform = prevT;
          var bx = (FAN_CENTER_BY && el.querySelector(FAN_CENTER_BY)) || el;
          var br = bx.getBoundingClientRect();
          fanMeasure(el, sr, scH);
          watchFanBox(el, bx);
          if (DEBUG) {
            console.log('[fan] ' + (el.getAttribute('data-dest') || '?') +
              ' wrapper=' + Math.round(er.height) + 'h box=' + Math.round(br.height) + 'h' +
              ' boxTopInScreen=' + Math.round(br.top - sr.top) +
              ' centreTarget=' + Math.round(scH / 2) + ' cy=' + el._fanCY +
              ' boxIsWrapper=' + (bx === el));
          }
        }
        if (DEBUG) {
          console.log('[fan] screen=' + Math.round(sr.height) + 'h (' + (screenEl ? 'screenEl' : 'offsetParent') +
            ') composer=' + Math.round(cr.height) + 'h topInScreen=' + Math.round(cr.top - sr.top) +
            ' cy=' + composerEl._fanCY);
        }
        placeLogoRow();
        fanPlacedAt = sr.height;

        if (DEBUG) {

          window.fanNudge = function (px) {
            FAN_CARD_NUDGE = px;
            var s = fanFrame(); if (!s) { return; }
            for (var i = 0; i < destExtra.length; i++) { fanMeasure(destExtra[i], s, s.height); }
            fanRender(fanFCur, fanLiftCur, fanShownState);
            console.log('[fan] FAN_CARD_NUDGE = ' + px + 'px (same baseline as page load)');
          };
          window.fanBoxes = function () {
            var s = (screenEl || composerEl.offsetParent).getBoundingClientRect();
            [composerEl].concat(destExtra).forEach(function (el) {
              var b = ((FAN_CENTER_BY && el.querySelector(FAN_CENTER_BY)) || el).getBoundingClientRect();
              console.log('[fanBox] ' + (el.getAttribute('data-dest') || 'slack') +
                ' top=' + Math.round(b.top - s.top) + ' bottom=' + Math.round(s.bottom - b.bottom) +
                ' h=' + Math.round(b.height) + ' centre=' + Math.round(b.top - s.top + b.height / 2) +
                ' (frame centre ' + Math.round(s.height / 2) + ')' +
                ' cy=' + el._fanCY + ' transform=' + (el.style.transform || 'none'));
            });
          };
        }
        return true;
      }

      function fanFrame() {
        var scr = screenEl || (composerEl && composerEl.offsetParent);
        return scr ? scr.getBoundingClientRect() : null;
      }
      function fanMeasure(el, sr, scH) {
        var prev = el.style.transform;
        el.style.transform = 'none';
        var bx = (FAN_CENTER_BY && el.querySelector(FAN_CENTER_BY)) || el;
        var b  = bx.getBoundingClientRect();
        el._fanBoxTop = b.top - sr.top;
        el._fanBoxH   = b.height;
        el._fanScH    = scH;
        el._fanCY     = Math.round(scH / 2 - (el._fanBoxTop + b.height / 2)) + FAN_CARD_NUDGE;
        el.style.transform = prev;
        return el._fanCY;
      }
      var fanRO = null;
      function watchFanBox(card3, box) {
        if (typeof ResizeObserver !== 'function' || box._fanWatched) { return; }
        box._fanWatched = true;
        box._fanOwner = card3;
        if (!fanRO) {
          fanRO = new ResizeObserver(function (entries) {
            for (var i = 0; i < entries.length; i++) {
              var b = entries[i].target, owner = b._fanOwner;
              if (!owner || owner._fanScH == null) { continue; }
              var sr = fanFrame(); if (!sr) { continue; }
              var was = owner._fanCY;
              var next = fanMeasure(owner, sr, sr.height || owner._fanScH);
              if (next !== was) {
                if (DEBUG) {
                  console.log('[fan] ' + (owner.getAttribute('data-dest') || '?') +
                    ' box settled — cy ' + was + ' → ' + next);
                }
                fanRender(fanFCur, fanLiftCur, fanShownState);
              }
            }
          });
          teardown.push(function () { fanRO.disconnect(); fanRO = null; });
        }
        fanRO.observe(box);
      }

      function placeLogoRow() {
        if (!destWrap || !LOGO_TOP || !card) { return; }
        var cr = card.getBoundingClientRect(), wr = destWrap.getBoundingClientRect();
        if (!cr.height || !wr.height) { return; }
        var m = parseFloat(window.getComputedStyle(destWrap).marginTop) || 0;
        destWrap.style.marginTop = (m + (LOGO_TOP - (wr.top - cr.top))) + 'px';
      }
      var pillEls      = Array.prototype.slice.call(section.querySelectorAll('[data-pill]'));
      var pillMap = {};

      // pillMap must never bind a MOBILE clone: last-in-DOM would win, and on desktop the mobile
      // wrap is display:none, so the desktop pill would silently never light up
      var mobRoot = section.querySelector(MOBILE_SEL);
      pillEls.forEach(function (el) {
        guardStyle(el);
        var key = (el.getAttribute('data-pill') || '').trim().toLowerCase();
        if (key && !(mobRoot && mobRoot.contains(el))) { pillMap[key] = el; }

        var txt = el.querySelector('.flow_text-type');
        if (!txt) {
          var cand = el.querySelectorAll('*');
          for (var qi = 0; qi < cand.length; qi++) {
            if (cand[qi].children.length === 0 && (cand[qi].textContent || '').trim()) { txt = cand[qi]; break; }
          }
        }
        if (txt && !txt.querySelector('.pill-ch')) {
          var s = txt.textContent; txt.textContent = '';
          for (var ci = 0; ci < s.length; ci++) {
            var ch = document.createElement('span');
            ch.className = 'pill-ch';
            ch.textContent = s.charAt(ci) === ' ' ? ' ' : s.charAt(ci);
            ch.style.transitionDelay = (0.16 + ci * 0.018) + 's';
            txt.appendChild(ch);
          }
        }
      });

      if (PILL_ANCHOR && pillEls.length) {
        var pillParents = [];
        pillEls.forEach(function (el) {
          var pp = el.parentNode;
          if (pp && pp.nodeType === 1 && pillParents.indexOf(pp) < 0) { pillParents.push(pp); }
        });
        var anchored = 0;
        pillParents.forEach(function (pp) {
          var kids = Array.prototype.filter.call(pp.childNodes, function (k) { return k.nodeType === 1; });
          var mine = kids.filter(function (k) { return k.hasAttribute('data-pill'); });
          if (mine.length < 2) { return; }
          if (mine.length !== kids.length) {
            if (DEBUG) { console.warn('[flow-stack] pill anchor skipped — parent holds non-pill children', pp); }
            return;
          }
          guardStyle(pp);

          var ai = window.getComputedStyle(pp).alignItems;
          pp.style.display = 'grid';
          pp.style.gridTemplateColumns = 'auto';
          pp.style.gridTemplateRows    = 'auto';
          pp.style.justifyItems = (ai === 'center') ? 'center'
            : ((ai === 'end' || ai === 'flex-end') ? 'end' : 'start');
          pp.style.alignItems = 'center';
          pp.style.gap = '0px';
          mine.forEach(function (k) { guardStyle(k); k.style.gridArea = '1 / 1'; });
          anchored++;
        });
        if (DEBUG) {
          console.log('[flow-stack] pill anchor: ' + anchored + '/' + pillParents.length +
            ' parent(s) stacked, pills=' + pillEls.length);
        }
      }

      Array.prototype.forEach.call(section.querySelectorAll('[' + FLOW + '="spinner"]'), function (sp) {
        if (sp.querySelector('svg')) { return; }
        sp.innerHTML = '<svg viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">' +
          '<path d="M7.53991 0.363512L8.60385 2.9853C9.04863 4.08175 9.91825 4.95137 11.0147 5.39615L13.6365 ' +
          '6.46009C14.1212 6.65699 14.1212 7.34338 13.6365 7.53991L11.0147 8.60385C9.91825 9.04863 9.04863 ' +
          '9.91825 8.60385 11.0147L7.53991 13.6365C7.34301 14.1212 6.65662 14.1212 6.46009 13.6365L5.39615 ' +
          '11.0147C4.95137 9.91825 4.08175 9.04863 2.9853 8.60385L0.363512 7.53991C-0.121171 7.34301 ' +
          '-0.121171 6.65662 0.363512 6.46009L2.9853 5.39615C4.08175 4.95137 4.95137 4.08175 5.39615 ' +
          '2.9853L6.46009 0.363512C6.65662 -0.121171 7.34301 -0.121171 7.53991 0.363512Z" fill="currentColor"/></svg>';
      });

      var polishPill = pillMap.polishing || null;
      if (!polishPill && isDesktop) {
        console.warn('[flow-stack] no [data-pill="polishing"] in the DESKTOP card (mobile clones do not count)');
      }
      // the mobile clones are copied from the card and may predate this injection, so any pill can
      // ask for its own row rather than assuming the desktop one seeded it
      function ensureDots(pill) {
        if (!pill) { return null; }
        var wrap = pill.querySelector('.flow_pill-polish_wrap') || pill;
        var row = wrap.querySelector('.flow_pill-dots');
        if (row) { return row; }
        row = document.createElement('div'); row.className = 'flow_pill-dots';
        for (var di = 0; di < BAR_SHAPE.length; di++) {
          var bar = document.createElement('span'); bar.className = 'flow_pill-dot';
          bar.style.setProperty('--h', (BAR_MIN + BAR_SHAPE[di] * (BAR_MAX - BAR_MIN)) + 'px');
          bar.style.transitionDelay = (di * 0.03) + 's';
          row.appendChild(bar);
        }
        wrap.appendChild(row);
        return row;
      }

      if (polishPill) {
        ensureDots(polishPill);

        polishPill.style.setProperty('align-self', 'center', 'important');
        polishPill.style.setProperty('flex', '0 0 auto', 'important');
        polishPill.style.setProperty('width', 'fit-content', 'important');
        polishPill.style.setProperty('min-width', '0', 'important');
        polishPill.style.setProperty('max-width', '100%', 'important');

        if (POLISH_PILL_Y) { polishPill.style.position = 'relative'; polishPill.style.top = POLISH_PILL_Y + 'px'; }
      }

      var voiceDots = polishPill ? Array.prototype.slice.call(polishPill.querySelectorAll('.flow_pill-dot')) : [];
      var voiceLive = false;
      function setVoiceLive(on) {
        voiceLive = on;
        for (var vd = 0; vd < voiceDots.length; vd++) {
          if (on) { voiceDots[vd].style.transition = 'none'; }
          else { voiceDots[vd].style.transition = ''; voiceDots[vd].style.height = ''; }
        }
      }

      var pillDoneOn = false, pillWave = false, pillCalls = [], pillOffCall = null, voiceLatched = false;
      function killPillCalls() { for (var c = 0; c < pillCalls.length; c++) { pillCalls[c].kill(); } pillCalls = []; }

      // idempotent: the dots stage must exist before is-wave, whether we arrive slowly (ch2 dots
      // then ch3) or in one scroll. without it the pill renders empty and oversized.
      function pillStageIn() { pillDotsIn(polishPill); }
      function pillDotsIn(pill) {
        if (!pill || pill.classList.contains('is-in')) { return; }
        pill.classList.add('is-in');
        var row = pill.querySelector('.flow_pill-dots');
        if (row) {
          row.style.transition = 'none';
          row.style.height = '0px';
          void row.offsetHeight;
          row.style.transition = 'height .5s cubic-bezier(.34,1.56,.64,1)';
          row.style.height = BAR_MAX + 'px';
        }
      }
      function setPillDone(on, wave) {
        if (!polishPill) { return; }
        wave = !!wave;
        if (on) {
          if (pillOffCall) { pillOffCall.kill(); pillOffCall = null; }
          if (pillDoneOn && pillWave === wave) { return; }
          if (pillDoneOn && wave && !pillWave) {
            pillWave = true;
            killPillCalls();
            pillStageIn();
            polishPill.classList.add('is-wave');
            pillCalls.push(gsap.delayedCall(0.5, function () { setVoiceLive(true); }));
            return;
          }
          if (pillDoneOn && !wave && pillWave) {
            pillWave = false;
            killPillCalls();
            setVoiceLive(false);
            polishPill.classList.remove('is-wave');
            return;
          }
          pillDoneOn = true; pillWave = wave;
          killPillCalls();
          polishPill.classList.add('is-done');
          pillCalls.push(gsap.delayedCall(PILL_OUT_MS / 1000, pillStageIn));
          if (wave) {
            pillCalls.push(gsap.delayedCall((PILL_OUT_MS + BULLET_MS) / 1000, function () {
              polishPill.classList.add('is-wave');
            }));
            pillCalls.push(gsap.delayedCall((PILL_OUT_MS + BULLET_MS + 500) / 1000, function () {
              setVoiceLive(true);
            }));
          }
        } else {
          if (!pillDoneOn || pillOffCall) { return; }

          pillOffCall = gsap.delayedCall(0.2, function () {
            pillOffCall = null; pillDoneOn = false; pillWave = false; killPillCalls();
            setVoiceLive(false);
            polishPill.classList.remove('is-wave');
            polishPill.classList.remove('is-in');
            polishPill.classList.remove('is-done');
          });
        }
      }
      teardown.push(function () { killPillCalls(); if (pillOffCall) { pillOffCall.kill(); } });

      var words = [];
      (function buildTranscript() {
        if (!transcriptEl) { return; }
        function catOf(el) {
          var m = el && el.className ? /(?:^|\s)flow_type-([a-z]+)/.exec(el.className) : null;
          return m ? m[1] : null;
        }

        if (transcriptEl.querySelector('.flow_w')) {
          Array.prototype.forEach.call(transcriptEl.querySelectorAll('.flow_w'), function (w) {
            w.style.opacity = '0';
            words.push({ el: w, cat: catOf(w.parentNode) });
          });
          return;
        }
        function wrapWords(container, cat) {
          var raw = container.textContent;
          container.textContent = '';
          raw.split(/(\s+)/).forEach(function (chunk) {
            if (chunk === '') { return; }
            if (/^\s+$/.test(chunk)) { container.appendChild(document.createTextNode(chunk)); return; }
            var w = document.createElement('span');
            w.className = 'flow_w';
            w.textContent = chunk;
            w.style.opacity = '0';
            container.appendChild(w);
            words.push({ el: w, cat: cat });
          });
        }
        var nodes = Array.prototype.slice.call(transcriptEl.childNodes);
        nodes.forEach(function (node) {
          if (node.nodeType === 3) {
            var frag = document.createElement('span');
            transcriptEl.replaceChild(frag, node);
            frag.style.display = 'contents';
            frag.textContent = node.textContent;
            wrapWords(frag, null);
          } else if (node.nodeType === 1) {
            wrapWords(node, catOf(node));
          }
        });
      }());

      var diagMeasured = false;

      var wordEls = [], gradW = 0, gradReady = false;
      function measureWordDiag() {
        if (!transcriptEl || !words.length) { return; }
        var base = transcriptEl.getBoundingClientRect();
        var W = base.width || 1, H = base.height || 1, i, r, v, mn = Infinity, mx = -Infinity;
        for (i = 0; i < words.length; i++) {
          r = words[i].el.getBoundingClientRect();
          v = ((r.top + r.height / 2 - base.top) / H) + ((r.left + r.width / 2 - base.left) / W) * GLOW_DIAG;
          words[i]._v = v;
          if (v < mn) { mn = v; }
          if (v > mx) { mx = v; }
        }
        var span = (mx - mn) || 1;
        for (i = 0; i < words.length; i++) { words[i].diag = (words[i]._v - mn) / span; }
      }

      var pwords = [];
      (function buildPolished() {
        if (!polishedEl) { return; }
        guardStyle(polishedEl);

        polishedEl.style.position = 'relative';
        polishedEl.style.overflow = 'visible';
        polishedEl.style.opacity = '1';
        polishedEl.style.height = 'auto';

        polishedEl.style.transform = 'translateY(-' + POLISH_RISE + 'px)';
        if (polishedEl.querySelector('.flow_pw')) {
          Array.prototype.forEach.call(polishedEl.querySelectorAll('.flow_pw'), function (w) { w.style.opacity = '0'; pwords.push(w); });
          return;
        }
        var raw = polishedEl.textContent; polishedEl.textContent = '';
        raw.split(/(\s+)/).forEach(function (chunk) {
          if (chunk === '') { return; }
          if (/^\s+$/.test(chunk)) { polishedEl.appendChild(document.createTextNode(chunk)); return; }
          var w = document.createElement('span'); w.className = 'flow_pw'; w.textContent = chunk; w.style.opacity = '0';
          polishedEl.appendChild(w); pwords.push(w);
        });
      }());
      var placeholderEl = (composerEl && composerEl.querySelector('.flow_message-placeholder')) ||
                          section.querySelector('.flow_message-placeholder');
      if (placeholderEl) { guardStyle(placeholderEl); }
      var msgGrowEl = oneF(section, 'msg-grow');

      var msgPadL = 0, msgPadR = 0, msgBorderL = '', msgBorderR = '', msgBorderT = '';
      var msgContainEl = msgGrowEl ? msgGrowEl.parentNode : null;
      if (!(msgContainEl && msgContainEl.nodeType === 1)) { msgContainEl = null; }
      if (msgGrowEl) {
        guardStyle(msgGrowEl);
        msgGrowEl.style.overflow = 'hidden';

        if (msgContainEl) {
          var ccs = window.getComputedStyle(msgContainEl);
          if (ccs.backgroundColor && ccs.backgroundColor !== 'rgba(0, 0, 0, 0)') {
            msgGrowEl.style.backgroundColor    = ccs.backgroundColor;
          }
          msgGrowEl.style.borderTopLeftRadius  = ccs.borderTopLeftRadius;
          msgGrowEl.style.borderTopRightRadius = ccs.borderTopRightRadius;
          msgPadL = (parseFloat(ccs.paddingLeft) || 0) + (parseFloat(ccs.borderLeftWidth) || 0);
          msgPadR = (parseFloat(ccs.paddingRight) || 0) + (parseFloat(ccs.borderRightWidth) || 0);
          if ((parseFloat(ccs.borderLeftWidth) || 0) > 0 && ccs.borderLeftStyle !== 'none') {
            msgBorderL = ccs.borderLeftWidth + ' ' + ccs.borderLeftStyle + ' ' + ccs.borderLeftColor;
            msgBorderR = ccs.borderRightWidth + ' ' + ccs.borderRightStyle + ' ' + ccs.borderRightColor;
            msgBorderT = ccs.borderTopWidth + ' ' + ccs.borderTopStyle + ' ' + ccs.borderTopColor;
          }
        }
      }

      if (msgContainEl) { guardStyle(msgContainEl); msgContainEl.style.overflow = 'visible'; }

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
      function paintBg(n) {
        var N = bgSvgs.length; if (!N) { return; }
        for (var i = 0; i < N; i++) {
          var on = (i === n);
          Array.prototype.forEach.call(bgSvgs[i].querySelectorAll('path'), function (p) {
            p.style.transition = 'stroke-dashoffset ' + BG_DRAW_MS + 'ms ' + BG_DRAW_EASE;
            p.style.strokeDashoffset = on ? '0' : String(p._len);
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
        if (BG_TRIGGER) { paintBg(n); }
        startAutoplay(n);
      }

      function startAutoplay(n) {
        if (!AUTOPLAY || !isDesktop || n < 0) { autoPlaying = false; return; }
        autoDur = AUTOPLAY_MS[n] || 2000;
        loopWaitT = 0;
        if (tabLoops(n)) { autoDone[n] = false; }
        if (!AUTOPLAY_REPLAY && autoDone[n]) { autoTp = 1; autoPlaying = false; }
        else { autoTp = 0; autoPlaying = true; }
        sceneUpdate(sceneLastP);
        snapEased();
      }

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

      var totalVH = 1, pA = 0, pB = 0, pBh = 0, pC = 0, pHold = 1, tabSpan = 1;
      var snapPoints = [], tabStops = [], tabCentres = [];
      function tabVHs() {
        if (CH_VH && CH_VH.length === numTabs) { return CH_VH.slice(); }
        var a = []; for (var i = 0; i < numTabs; i++) { a.push(i < numTabs - 1 ? TAB_STEP_VH : END_HOLD_VH); }
        return a;
      }
      function computeTiming() {
        var contentVH = (isDesktop && window.innerHeight) ? (sCenter / window.innerHeight) : 0;
        var vhs = tabVHs();
        var tabsVH = 0; if (isDesktop) { for (var i = 0; i < vhs.length; i++) { tabsVH += vhs[i]; } }
        tabSpan = tabsVH / TAB_STEP_VH || 1;
        totalVH = IN_VH + GROW_VH + FULL_HOLD_VH + SHRINK_VH + contentVH + tabsVH;
        pA    = IN_VH / totalVH;
        pB    = (IN_VH + GROW_VH) / totalVH;
        pBh   = (IN_VH + GROW_VH + FULL_HOLD_VH) / totalVH;
        pC    = (IN_VH + GROW_VH + FULL_HOLD_VH + SHRINK_VH) / totalVH;
        pHold = (IN_VH + GROW_VH + FULL_HOLD_VH + SHRINK_VH + contentVH) / totalVH;
        tabStops = [pHold];
        var acc = 0, sum = tabsVH || 1;
        for (var j = 0; j < vhs.length; j++) { acc += vhs[j]; tabStops.push(pHold + (acc / sum) * (1 - pHold)); }
        tabCentres = [];
        for (var tc = 0; tc < numTabs; tc++) { tabCentres.push((tabStops[tc] + tabStops[tc + 1]) / 2); }
        snapPoints = tabCentres.concat([1]);
      }
      computeTiming();

      function tabLocal(p) {
        for (var i = 0; i < numTabs; i++) {
          if (p < tabStops[i + 1] || i === numTabs - 1) {
            var a = tabStops[i], b = tabStops[i + 1];
            var tp = b > a ? (p - a) / (b - a) : 1;
            return { idx: i, tp: tp < 0 ? 0 : (tp > 1 ? 1 : tp) };
          }
        }
        return { idx: 0, tp: 0 };
      }

      var wordsShown = -1, pillShown = 0, polishColored = false;
      function resetPolishColor() {
        if (!polishColored) { return; }
        for (var i = 0; i < words.length; i++) {
          words[i].el.style.color = ''; words[i].el.style.textShadow = ''; words[i].el.style.transform = '';
        }
        polishColored = false;
      }

      var fanFCur = 0, fanFTgt = 0, fanLiftCur = 1, fanLiftTgt = 1, fanShow = false, fanShownState = null, fanN = 0;
      var fanAlpha = 1;

      function fanUpdate(tp, show) {
        var live = composerEl;
        var n = (live ? 1 : 0) + destExtra.length;
        fanN = n; fanShow = show;
        if (n < 2) { return; }
        if (fanLayer) { fanLayer.style.opacity = show ? '1' : '0'; }

        if (show && !fanWasShown) { fanPositioned = false; }
        fanWasShown = show;

        if (show && !fanPositioned) { fanPositioned = positionFanCards(); }

        fanLiftTgt = smooth(FAN_LIFT_END > 0 ? Math.min(1, tp / FAN_LIFT_END) : 1);
        var swingTp = FAN_LIFT_END < 1 ? Math.max(0, (tp - FAN_LIFT_END) / (1 - FAN_LIFT_END)) : 0;
        if (FAN_EXIT > 0 && swingTp > FAN_EXIT_AT) {

          var ex = (swingTp - FAN_EXIT_AT) / (1 - FAN_EXIT_AT);
          fanFTgt = (n - 1) + FAN_EXIT * smooth(ex < 0 ? 0 : (ex > 1 ? 1 : ex));
        } else {
          var mainT = FAN_EXIT > 0 && FAN_EXIT_AT > 0 ? Math.min(1, swingTp / FAN_EXIT_AT) : swingTp;
          fanFTgt = fanStep(mainT, n);
        }

        fanAlpha = FAN_IN_T > 0 ? smooth(Math.min(1, tp / FAN_IN_T)) : 1;
      }

      function fanRender(f, liftT, show) {
        var live = composerEl;
        var n = fanN;
        if (n < 2) { if (live && !show) { live.style.transform = ''; live.style.transformOrigin = ''; } return; }
        function place(el, i, isLive) {
          var rel = i - f, ar = Math.abs(rel);
          if (!show) {
            if (isLive) {
              el.style.transform = ''; el.style.transformOrigin = '';
              el.style.opacity = ''; el.style.zIndex = '';
            } else { el.style.opacity = '0'; }
            return;
          }
          var op = (1 - Math.max(0, Math.min(1, (ar - 1) / FAN_FADE))) * fanAlpha;
          var sc = FAN_CARD_SCALE * (1 - (1 - FAN_SCALE) * Math.min(1, ar));

          var cy = ((el._fanCY || 0) + FAN_CENTER_NUDGE) * liftT - (1 - sc) * (el._fanBoxH || 0) / 2;
          el.style.transformOrigin = FAN_PIVOT;
          el.style.transform = 'translate(' + (FAN_TX * rel) + 'px,' + cy + 'px) rotate(' + (FAN_ANGLE * rel) +
            'deg) scale(' + sc + ')';
          el.style.opacity = String(op < 0 ? 0 : op);
          el.style.zIndex  = String(100 - Math.round(ar * 10));
          if (!isLive) { el.style.pointerEvents = 'none'; }
        }
        var ci = 0;
        if (live) { place(live, ci++, true); }
        for (var e = 0; e < destExtra.length; e++) { place(destExtra[e], ci++, false); }

        for (var g = 0; g < destLogos.length; g++) {
          var lk = (destLogos[g].getAttribute('data-dest') || '').trim().toLowerCase();
          var li = (lk === 'slack') ? 0 : -1;
          if (li < 0) {
            for (var x = 0; x < destExtra.length; x++) {
              if ((destExtra[x].getAttribute('data-dest') || '').trim().toLowerCase() === lk) { li = x + 1; break; }
            }
          }
          if (!show || li < 0) { destLogos[g].style.opacity = '0'; continue; }

          var lrel = (li === 0) ? ((li - f) + (1 - liftT)) : (li - f);
          var lar  = Math.abs(lrel);
          destLogos[g].style.opacity   = String(Math.max(0, 1 - lar / LOGO_FADE) * fanAlpha);
          destLogos[g].style.transform = 'rotate(' + (LOGO_ROT * lrel) + 'deg) scale(' +
            (1 - (1 - LOGO_SCALE) * Math.min(1, lar)) + ')';
        }
      }

      function fanTick() {
        if (fanN < 2) { return; }
        if (!fanShow) {
          if (fanShownState !== false) { fanRender(fanFCur, fanLiftCur, false); fanShownState = false; }
          fanFCur = fanFTgt; fanLiftCur = fanLiftTgt;
          return;
        }
        var k = FAN_LERP >= 1 ? 1 : 1 - Math.pow(1 - FAN_LERP, gsap.ticker.deltaRatio());
        fanFCur    += (fanFTgt    - fanFCur)    * k;
        fanLiftCur += (fanLiftTgt - fanLiftCur) * k;
        if (Math.abs(fanFTgt    - fanFCur)    < 0.0004) { fanFCur    = fanFTgt; }
        if (Math.abs(fanLiftTgt - fanLiftCur) < 0.0004) { fanLiftCur = fanLiftTgt; }
        fanRender(fanFCur, fanLiftCur, true);
        fanShownState = true;
      }

      function gradMeasure(list, container) {
        if (!container || !list.length) { return 0; }
        var cr = container.getBoundingClientRect();
        for (var i = 0; i < list.length; i++) {
          list[i]._gx = list[i].getBoundingClientRect().left - cr.left;
        }
        return cr.width || 1;
      }
      function gradPaint(list) {
        for (var i = 0; i < list.length; i++) {
          var s = list[i].style;
          s.backgroundImage  = POLISH_GRAD_CSS;
          s.backgroundRepeat = 'no-repeat';
          s.setProperty('-webkit-background-clip', 'text');
          s.backgroundClip = 'text';
        }
      }
      function gradShift(list, w) {
        if (!w || !list.length) { return; }
        var span  = w * GRAD_SPAN;
        var t     = (gsap.ticker.time * 1000 / GRAD_SHIFT_MS) % 2;
        var slide = (t > 1 ? 2 - t : t) * (span - w);
        var sz    = span.toFixed(1) + 'px 100%';
        for (var i = 0; i < list.length; i++) {
          list[i].style.backgroundSize = sz;
          list[i].style.backgroundPosition = (-(list[i]._gx || 0) - slide).toFixed(1) + 'px 0';
        }
      }

      // the grown box sits INSIDE the container's border, so that border shows as a strip beside
      // the part that grew. bleed over it and carry the border while grown.
      function setMsgBleed(on) { setBoxBleed(msgGrowEl, on); }
      function setBoxBleed(box, on) {
        if (!box || !MSG_BLEED) { return; }
        var l = (MSG_BLEED_X >= 0) ? MSG_BLEED_X : msgPadL;
        var r = (MSG_BLEED_X >= 0) ? MSG_BLEED_X : msgPadR;
        box.style.marginLeft  = on ? (-l) + 'px' : '';
        box.style.marginRight = on ? (-r) + 'px' : '';
        if (MSG_BORDER && msgBorderL) {
          box.style.boxSizing   = on ? 'border-box' : '';
          box.style.borderLeft  = on ? msgBorderL : '';
          box.style.borderRight = on ? msgBorderR : '';
          box.style.borderTop   = on ? msgBorderT : '';
        }
      }
      function outPow(t) {
        if (!(BOX_OUT_POW > 1)) { return smooth(t); }
        var c = t < 0 ? 0 : (t > 1 ? 1 : t);
        return 1 - Math.pow(1 - c, BOX_OUT_POW);
      }
      function crestAt(front, ph) {
        var d = front - ph;
        if (d <= 0 || d >= WAVE_BAND) { return 0; }
        return Math.sin(Math.PI * (d / WAVE_BAND));
      }
      function crestCSS(w, extraY) {
        var y = (extraY || 0) - WAVE_AMP * w;
        var t = '';
        if (y) { t += 'translateY(' + y.toFixed(2) + 'px)'; }
        if (WAVE_SCALE && w) { t += ' scale(' + (1 + WAVE_SCALE * w).toFixed(4) + ')'; }
        if (WAVE_ROT && w)   { t += ' rotate(' + (WAVE_ROT * w).toFixed(2) + 'deg)'; }
        return t;
      }

      var RAW_OUT_ANGLE = (180 - 45 * GLOW_DIAG).toFixed(1) + 'deg';
      function rawOutMask(wipe) {
        if (!RAW_OUT_WAVE) {
          var soft = 16, stop = wipe * (100 + soft);
          return 'linear-gradient(to top, transparent ' + Math.max(0, stop - soft).toFixed(1) +
            '%, #000 ' + stop.toFixed(1) + '%)';
        }

        var s = wipe * (100 + RAW_OUT_SOFT * 2) - RAW_OUT_SOFT;
        return 'linear-gradient(' + RAW_OUT_ANGLE + ', transparent ' + s.toFixed(1) +
          '%, #000 ' + (s + RAW_OUT_SOFT).toFixed(1) + '%)';
      }

      function wiggleAt(tp) {
        if (!PASTE_MODE) { return 0; }
        var t = phaseT(tp, CARD_WIGGLE[0], CARD_WIGGLE[1]);
        if (t <= 0 || t >= 1) { return 0; }
        var decay = (1 - t) * (1 - t);
        return Math.sin(t * Math.PI * 2 * CARD_WIGGLE_CYCLES) * decay;
      }

      function renderPolish(tp) {
        var n = words.length, np = pwords.length;
        if (GLOW_EDGE && !diagMeasured) { measureWordDiag(); diagMeasured = true; }
        if (WORD_GRAD) {
          if (!gradReady) {
            if (!wordEls.length) { for (var wi = 0; wi < n; wi++) { wordEls.push(words[wi].el); } }
            gradW = gradMeasure(wordEls, transcriptEl);
            gradPaint(wordEls);
            gradReady = true;
          }
          gradShift(wordEls, gradW);
        }

        var Fg = phaseT(tp, POLISH_GRAD[0], POLISH_GRAD[1]) * 1.08;

        var Fglow = phaseT(tp, POLISH_GRAD[0], POLISH_GRAD[1]) * (1 + GLOW_BAND + 0.05);

        var F  = outPow(phaseT(tp, POLISH_DROP[0], POLISH_DROP[1])) *
                 (PASTE_MODE ? POLISH_FAST : 1) * (1 + POLISH_GAP + POLISH_BAND);
        for (var i = 0; i < n; i++) {
          var ph = (words[i].diag != null) ? words[i].diag : (n > 1 ? i / (n - 1) : 0);
          words[i].el.style.color = (Fg > ph) ? 'transparent' : '';
          if (GLOW_EDGE) {
            var df = Fglow - ph;
            var g = (df >= 0 && df < GLOW_BAND) ? (1 - df / GLOW_BAND) : 0;
            words[i].el.style.textShadow = g > 0.02
              ? ('0 0 ' + (GLOW_MAX * g).toFixed(1) + 'px rgba(' + GLOW_COLOR + ',' + (0.9 * g).toFixed(2) + ')')
              : '';
          }
          if (WAVE_MOTION) {
            var cw = crestAt(Fglow, ph);
            words[i].el.style.transform = cw > 0.002 ? crestCSS(cw, 0) : '';
          }
        }

        if (rawWrap) {
          var rawT = smooth(phaseT(tp, POLISH_RAWOUT[0], POLISH_RAWOUT[1]));

          var m = rawOutMask(PASTE_MODE ? Math.min(1, rawT * RAW_FADE_FAST) : rawT);
          rawWrap.style.webkitMaskImage = m;
          rawWrap.style.maskImage = m;
          if (PASTE_MODE) {

            rawWrap.style.transformOrigin = '50% 100%';
            rawWrap.style.transform = rawT > 0.0005
              ? ('translateY(' + (RAW_PUSH_Y * rawT).toFixed(2) + 'px)' +
                 (RAW_PUSH_SCALE === 1 ? '' :
                   ' scale(' + (1 - (1 - RAW_PUSH_SCALE) * rawT).toFixed(4) + ')'))
              : '';
          }
        }
        for (var j = 0; j < np; j++) {
          var pph = np > 1 ? j / (np - 1) : 0;
          var o = smooth((F - pph - POLISH_GAP) / POLISH_BAND);
          pwords[j].style.opacity = String(o);
          if (POLISH_WAVE) {
            pwords[j].style.transform = crestCSS(crestAt(F, pph) * 0.6, POLISH_AMP * (1 - o));
          }
        }
        var grow = outPow(phaseT(tp, POLISH_DROP[0], POLISH_DROP[1]));
        if (PASTE_MODE && BOX_GROW_FAST > 0) { grow = Math.pow(grow, 1 / BOX_GROW_FAST); }
        var gpx  = (msgExpandedH - msgCollapsedH) * grow;

        if (msgGrowEl && heightsOK) {
          msgGrowEl.style.height = (msgCollapsedH + gpx) + 'px';
          msgGrowEl.style.marginTop = (-gpx) + 'px';
          setMsgBleed(gpx > 0.5);
        }

        cardWiggle = PASTE_MODE ? wiggleAt(tp) : 0;
        if (placeholderEl){ placeholderEl.style.opacity = String(1 - smooth(Math.min(1, grow * PLACEHOLDER_OUT))); }
      }

      var polishCur = 0, polishTgt = 0, polishActive = false;
      var cardWiggle = 0;

      function polishTick() {

        if (!polishActive) { polishCur = polishTgt; cardWiggle = 0; return; }
        var k = POLISH_LERP >= 1 ? 1 : 1 - Math.pow(1 - POLISH_LERP, gsap.ticker.deltaRatio());
        polishCur += (polishTgt - polishCur) * k;
        if (Math.abs(polishTgt - polishCur) < 0.0004) { polishCur = polishTgt; }
        renderPolish(polishCur);
      }

      function renderPill(hp) {
        if (!pillAudioEl) { return; }
        var sc = PILL_REC_SCALE + (1 - PILL_REC_SCALE) * hp;
        var ty = pillRecY * (1 - hp);
        pillAudioEl.style.transform = 'translateY(' + ty + 'px) scale(' + sc + ')';
        var ei = PILL_ICONS_AT < 1 ? smooth((hp - PILL_ICONS_AT) / (1 - PILL_ICONS_AT)) : (hp >= 1 ? 1 : 0);
        var isz = (PILL_ICON_SIZE * ei) + 'px';
        for (var pe = 0; pe < pillExtras.length; pe++) {
          var ex = pillExtras[pe];
          if (ei <= 0.001) { ex.style.display = 'none'; }
          else {
            ex.style.display = '';
            ex.style.opacity = String(ei);
            ex.style.width  = isz;
            ex.style.height = isz;
          }
        }
      }

      var pillCur = 0, pillTgt = 0;
      function pillTick() {
        if (!pillAudioEl) { return; }
        var k = PILL_LERP >= 1 ? 1 : 1 - Math.pow(1 - PILL_LERP, gsap.ticker.deltaRatio());
        pillCur += (pillTgt - pillCur) * k;
        if (Math.abs(pillTgt - pillCur) < 0.0004) { pillCur = pillTgt; }
        renderPill(pillCur);
      }

      function sceneUpdate(p) {
        sceneLastP = p;

        if (introEl && !refreshing) {
          var gt2 = (pB > pA) ? (p - pA) / (pB - pA) : (p >= pB ? 1 : 0);
          gt2 = gt2 < 0 ? 0 : (gt2 > 1 ? 1 : gt2);
          var cardFrac = (p < pB) ? (1 - SPLIT_START * (1 - snapEnds(gt2))) : 1;
          introEl.style.opacity = (cardFrac >= CARD_MIN_W && p < pBh) ? '1' : '0';
        }

        if (pillAudioEl) {
          pillTgt = phaseT(p, pBh, pHold);
        }

        if (MSG_HEIGHT_RETRY && !heightsOK && isDesktop && heightsTries < 6 && msgGrowEl && stage) {
          var nowH = Date.now();
          if (nowH - heightsRetryT > 400) {
            heightsRetryT = nowH;
            heightsTries++;
            var sr2 = stage.getBoundingClientRect();
            if (sr2.width > 2 && sr2.height > 2) {
              measurePositions();
              if (DEBUG) {
                console.log('[flow-stack] re-measured message box: collapsed=' + msgCollapsedH +
                  ' expanded=' + msgExpandedH + ' ok=' + heightsOK);
              }
            }
          }
        }

        // watchdog: tabFade parks the scene at opacity 0 and hands ownership to the click's fade
        // chain. anything that breaks that chain would leave the UI invisible with nothing to
        // paint it back, so take ownership back once it has outlived both fades.
        if (tabFade && tabFadeT && (Date.now() - tabFadeT) > (TAB_FADE_MS * 2 + 400)) {
          killTabFade(); tabFade = false; clearSceneTransition();
        }

        if (MSG_BOX_GUARD && isDesktop && msgGrowEl && p >= pHold && !tabFade) {
          var mbr = msgGrowEl.getBoundingClientRect();
          if (mbr.width > 2 && mbr.height < 2) {
            msgGrowEl.style.height = '';
            msgGrowEl.style.marginTop = '0px';
            heightsOK = false;
            if (DEBUG) { console.warn('[flow-stack] message box measured 0 tall — restored'); }
          }
        }

        if (!tabFade && !refreshing) {
          var lit = (p >= pC + MSG_TRIGGER * Math.max(0, pHold - pC)) ? '1' : '0';
          if (screenEl) {
            screenEl.style.opacity = lit;
          } else {
            if (transcriptEl) { transcriptEl.style.opacity = lit; }
            if (composerEl)   { composerEl.style.opacity = lit; }
          }
        }

        var idx = -1, tp = 0;
        if (p >= pHold) {
          var loc = tabLocal(p); idx = loc.idx;

          tp = (AUTOPLAY && isDesktop) ? ((idx === activeTab) ? autoTp : (autoDone[idx] ? 1 : 0)) : loc.tp;
        }

        setBgChapter(idx);

        if (pillAudioEl) { pillAudioEl.style.opacity = (idx >= 1) ? '0' : '1'; }

        var n = words.length, count;
        if (idx < 0)        { count = 0; }
        else if (idx === 0) { count = Math.round(Math.min(1, tp / TYPE_END) * n); }
        else                { count = n; }
        count = count < 0 ? 0 : (count > n ? n : count);
        if (count !== wordsShown) {
          for (var i = 0; i < n; i++) { words[i].el.style.opacity = i < count ? '1' : '0'; }
          wordsShown = count;
        }

        var np = pwords.length;
        if (idx === 1) {
          if (transcriptEl) {
            transcriptEl.classList.add('is-polishing');
            if (WORD_GRAD) { transcriptEl.classList.add('is-wordgrad'); }
            transcriptEl.style.transform = ''; transcriptEl.style.opacity = '';
          }

          polishTgt = tp; polishActive = true;
          wordsShown = -1; polishColored = true;
        } else if (idx >= 2) {
          polishActive = false;
          if (transcriptEl) { transcriptEl.classList.remove('is-polishing'); transcriptEl.style.transform = ''; transcriptEl.style.opacity = '0'; }
          if (rawWrap) { rawWrap.style.webkitMaskImage = ''; rawWrap.style.maskImage = ''; rawWrap.style.transform = ''; }
          resetPolishColor();
          for (var j2 = 0; j2 < np; j2++) { pwords[j2].style.opacity = '1'; pwords[j2].style.transform = ''; }

          var padLiftT = smooth(FAN_LIFT_END > 0 ? Math.min(1, tp / FAN_LIFT_END) : 1);
          if (msgGrowEl && heightsOK) {
            var slackH = fitSlackH();
            msgGrowEl.style.height = (slackH + SLACK_PAD * padLiftT) + 'px';
            msgGrowEl.style.marginTop = (-(msgExpandedH - msgCollapsedH)) + 'px';
            setMsgBleed(true);
          }
          if (placeholderEl){ placeholderEl.style.opacity = '0'; }
        } else {
          polishActive = false;
          if (transcriptEl) { transcriptEl.classList.remove('is-polishing'); transcriptEl.style.transform = ''; transcriptEl.style.opacity = ''; }
          if (rawWrap) { rawWrap.style.webkitMaskImage = ''; rawWrap.style.maskImage = ''; rawWrap.style.transform = ''; }
          resetPolishColor();
          for (var j3 = 0; j3 < np; j3++) { pwords[j3].style.opacity = '0'; pwords[j3].style.transform = ''; }
          if (msgGrowEl)    { msgGrowEl.style.height = msgCollapsedH ? (msgCollapsedH + 'px') : ''; msgGrowEl.style.marginTop = '0px'; setMsgBleed(false); }
          if (placeholderEl){ placeholderEl.style.opacity = ''; }
        }

        var activePill = null;

        if (idx === 0) {
          for (var j = count - 1; j >= 0; j--) {
            if (words[j].cat && pillMap[words[j].cat]) { activePill = words[j].cat; break; }
          }
        }
        else if (idx >= 1) { activePill = 'polishing'; }
        if (activePill !== pillShown) {

          for (var k in pillMap) { if (pillMap.hasOwnProperty(k)) { pillMap[k].classList.toggle('is-on', k === activePill); } }
          pillShown = activePill;
        }

        var ch3Start = tabStops[numTabs - 1];
        var voiceHyst = 0.15 * (1 - ch3Start);
        if (p >= ch3Start) { voiceLatched = true; }
        else if (p < ch3Start - voiceHyst) { voiceLatched = false; }

        var wantDots = (idx === 1 && tp >= PILL_DOTS_AT);
        setPillDone(voiceLatched || wantDots, voiceLatched);

        if (destWrap) { destWrap.style.opacity = (idx >= 2) ? '1' : '0'; }
        fanUpdate(idx >= 2 ? tp : 0, idx >= 2);
      }

      var pTarget = 0, pSmooth = 0, painted = -1;

      function applyScroll(p) {
        applyMorph(p);
        pTarget = p;

        if (isDesktop) {
          sceneUpdate(p);
          var S;
          if (p <= pC)         { S = 0; }
          else if (p >= pHold) { S = sCenter; }
          else                 { S = (pHold > pC) ? ((p - pC) / (pHold - pC)) * sCenter : sCenter; }
          for (var ci = 0; ci < contentEls.length; ci++) { gsap.set(contentEls[ci], { y: -S }); }

          var rideT = (pHold > pC) ? Math.max(0, Math.min(1, (p - pC) / (pHold - pC))) : 1;
          var dip   = CARD_DIP * Math.sin(Math.PI * rideT);

          gsap.set(card, {
            y: S - Math.min(cardRiseDist, Math.max(0, S - sCardStart)) + dip + CARD_WIGGLE_Y * cardWiggle,
            x: CARD_WIGGLE_X * cardWiggle,
            rotation: CARD_WIGGLE_ROT * cardWiggle
          });
        }

        if (canLeave && topCover) {
          var gr = greenPanel.getBoundingClientRect();
          topCover.style.display = (gr.top <= 1 && gr.bottom > 3) ? 'block' : 'none';
        }

        if (isDesktop) {

          if (clickLockP != null && (Math.abs(p - clickLockP) < 0.005 || Date.now() - clickLockT > (TAB_FADE_MS * 2 + 500))) {
            clickLockP = null;
          }
          if (clickLockP == null) {

            var tn = -1;
            if (p >= pHold - 0.02) { tn = (p <= pHold) ? 0 : tabLocal(p).idx; }
            setActiveTab(tn);
          }
          bgTargetP = (p > pHold && pHold < 1) ? (p - pHold) / (1 - pHold) : 0;
        }
      }

      function refresh() {
        // refresh() runs from onRefreshInit, BEFORE ScrollTrigger recalculates the trigger, so
        // st.progress here can be stale. hold the CSS-transitioned fades until the rAF below.
        refreshing = true;
        if (isDesktop) { section.style.height = 'calc(100vh + 2px)'; }
        contentEls.forEach(function (el) { gsap.set(el, { y: 0 }); });
        measureStage();
        alignHeads();
        measurePositions();
        computeTiming();
        diagMeasured = false;
        gradReady = false;
        slackFitCache = 0;

        if (tabFade || tabFadeCall) { killTabFade(); tabFade = false; clearSceneTransition(); }
        fanPositioned = false;
        applyScroll(st ? st.progress : 0);
        pSmooth = pTarget; painted = -1;
        fanFCur = fanFTgt; fanLiftCur = fanLiftTgt;
        polishCur = polishTgt;
        pillCur = pillTgt;
        updateMarquees(pSmooth); updateAudio(pSmooth);
        if (activeTab >= 0) { moveIndicator(activeTab); }
        refreshing = false;
        if (typeof window.requestAnimationFrame === 'function') {
          window.requestAnimationFrame(function () { if (st) { applyScroll(st.progress); } });
        }
      }

      var mobUid = 0;
      function uniquifyIds(root) {
        var ided = root.querySelectorAll('[id]');
        if (!ided.length) { return; }
        var suffix = '_m' + (++mobUid), map = {}, i;
        for (i = 0; i < ided.length; i++) { var o = ided[i].id; map[o] = o + suffix; ided[i].id = map[o]; }
        var all = root.querySelectorAll('*'), XL = 'http://www.w3.org/1999/xlink';
        for (i = 0; i < all.length; i++) {
          var el = all[i];
          var h = el.getAttribute('href');
          if (h && h.charAt(0) === '#' && map[h.slice(1)]) { el.setAttribute('href', '#' + map[h.slice(1)]); }
          var xh = el.getAttributeNS ? el.getAttributeNS(XL, 'href') : null;
          if (xh && xh.charAt(0) === '#' && map[xh.slice(1)]) { el.setAttributeNS(XL, 'href', '#' + map[xh.slice(1)]); }
          var attrs = ['clip-path', 'mask', 'fill', 'stroke', 'filter'], a;
          for (a = 0; a < attrs.length; a++) {
            var v = el.getAttribute(attrs[a]);
            if (v && v.indexOf('url(#') !== -1) {
              for (var k in map) { if (map.hasOwnProperty(k)) { v = v.split('url(#' + k + ')').join('url(#' + map[k] + ')'); } }
              el.setAttribute(attrs[a], v);
            }
          }
        }
      }
      function mobileChIndex(ch) { return ch === 'ch2' ? 1 : ch === 'ch3' ? 2 : 0; }
      function mobileHasPill(pills, cat) {
        for (var p = 0; p < pills.length; p++) { if (pills[p].getAttribute('data-pill') === cat) { return true; } }
        return false;
      }
      function mobileSetPill(pills, cat) {
        for (var p = 0; p < pills.length; p++) { pills[p].classList.toggle('is-on', pills[p].getAttribute('data-pill') === cat); }
      }
      function mobilePlay(host, ch) {
        if (ch === 'ch2') { mobileCh2Play(host); return; }
        if (ch === 'ch3') { mobileCh3Play(host); return; }
        var ws = host.querySelectorAll('.flow_w'), n = ws.length;
        if (!n) { return; }
        var pills = host.querySelectorAll('[data-pill="filler"],[data-pill="correction"],[data-pill="repetition"]');
        var obj = host._mobTween || (host._mobTween = { c: 0 });
        gsap.killTweensOf(obj); obj.c = 0;
        gsap.to(obj, { c: n, duration: (MOBILE_CH_MS[mobileChIndex(ch)] || 4000) / 1000, ease: 'none', overwrite: true,
          onUpdate: function () {
            var k = Math.round(obj.c), i;
            for (i = 0; i < n; i++) { ws[i].style.opacity = i < k ? '1' : '0'; }
            if (pills.length) {
              var cat = null;
              for (i = k - 1; i >= 0; i--) {
                var c = ws[i].getAttribute('data-cat');
                if (c && mobileHasPill(pills, c)) { cat = c; break; }
              }
              mobileSetPill(pills, cat);
            }
          } });
      }
      function mobileReset(host, ch) {
        if (ch === 'ch2') { mobileCh2Reset(host); return; }
        if (ch === 'ch3') { mobileCh3Reset(host); return; }
        if (host._mobTween) { gsap.killTweensOf(host._mobTween); }
        var ws = host.querySelectorAll('.flow_w');
        for (var i = 0; i < ws.length; i++) { ws[i].style.opacity = '0'; }
        var pills = host.querySelectorAll('[data-pill="filler"],[data-pill="correction"],[data-pill="repetition"]');
        mobileSetPill(pills, null);
      }

      function mobileWrapPolished(polished) {
        if (!polished || polished.querySelector('.flow_pw')) { return; }
        var kids = Array.prototype.slice.call(polished.childNodes);
        for (var i = 0; i < kids.length; i++) {
          var n = kids[i];
          if (n.nodeType === 3) {
            var frag = document.createDocumentFragment();
            n.textContent.split(/(\s+)/).forEach(function (chunk) {
              if (chunk === '') { return; }
              if (/^\s+$/.test(chunk)) { frag.appendChild(document.createTextNode(chunk)); return; }
              var w = document.createElement('span'); w.className = 'flow_pw'; w.textContent = chunk; w.style.opacity = '0';
              frag.appendChild(w);
            });
            polished.replaceChild(frag, n);
          }
        }
      }

      function mobileNormalisePolished(el) {
        if (!el) { return; }
        guardStyle(el);
        if (window.getComputedStyle(el).display === 'none') { el.style.display = 'block'; }
        el.style.position  = 'relative';
        el.style.overflow  = 'visible';
        el.style.opacity   = '1';
        el.style.height    = 'auto';
        el.style.transform = 'translateY(-' + POLISH_RISE + 'px)';
      }
      function mobileCh2Prep(host) {
        var ctx = host._ch2 = {};
        ctx.rawTr = host.querySelector('[data-type="raw"]');
        mobileWrapWords(host);
        if (ctx.rawTr) { ctx.rawTr.classList.add('is-polishing'); }
        ctx.rawWords = ctx.rawTr ? ctx.rawTr.querySelectorAll('.flow_w') : [];

        ctx.rawWrap = (ctx.rawTr && ctx.rawTr.parentNode && ctx.rawTr.parentNode.nodeType === 1)
          ? ctx.rawTr.parentNode : ctx.rawTr;
        if (ctx.rawWrap) { guardStyle(ctx.rawWrap); }
        ctx.polished = host.querySelector('[data-type="polished"]');
        mobileWrapPolished(ctx.polished);
        mobileNormalisePolished(ctx.polished);
        ctx.pwords = ctx.polished ? ctx.polished.querySelectorAll('.flow_pw') : [];
        ctx.msgGrow = host.querySelector('[' + FLOW + '="msg-grow"]');
        if (ctx.msgGrow) {
          guardStyle(ctx.msgGrow);
          ctx.msgGrow.style.overflow = 'hidden';
          var mc = ctx.msgGrow.parentNode;
          if (mc && mc.nodeType === 1) {
            var ccs = window.getComputedStyle(mc);
            if (ccs.backgroundColor && ccs.backgroundColor !== 'rgba(0, 0, 0, 0)') { ctx.msgGrow.style.backgroundColor = ccs.backgroundColor; }
            ctx.msgGrow.style.borderTopLeftRadius  = ccs.borderTopLeftRadius;
            ctx.msgGrow.style.borderTopRightRadius = ccs.borderTopRightRadius;
            guardStyle(mc); mc.style.overflow = 'visible';
          }
        }
        ctx.placeholder = host.querySelector('.flow_message-placeholder');

        ctx.polishPill = host.querySelector('[data-pill="polishing"]');
        if (ctx.polishPill) {
          guardStyle(ctx.polishPill);
          ctx.polishPill.style.setProperty('align-self', 'center', 'important');
          ctx.polishPill.style.setProperty('flex', '0 0 auto', 'important');
          ctx.polishPill.style.setProperty('width', 'fit-content', 'important');
          ctx.polishPill.style.setProperty('min-width', '0', 'important');
          ctx.polishPill.style.setProperty('max-width', '100%', 'important');
            if (MOBILE_PILL_Y) { ctx.polishPill.style.position = 'relative'; ctx.polishPill.style.top = MOBILE_PILL_Y + 'px'; }
          ensureDots(ctx.polishPill);
        } else {
          console.warn('[flow-stack] mobile ch2: no [data-pill="polishing"] inside this block');
        }
        ctx.pillAudio = host.querySelector('[' + FLOW + '="pill-audio"]');
        ctx.measured = false;
      }

      function mobileTextBottom(root) {
        var walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false), n, last = null;
        while ((n = walk.nextNode())) { if ((n.textContent || '').trim()) { last = n; } }
        if (!last) { return null; }
        var r = document.createRange(); r.selectNodeContents(last);
        var rect = r.getBoundingClientRect(); r.detach && r.detach();
        return rect.bottom || null;
      }

      function mobileFitBox(mg, apply) {
        if (!mg) { return null; }
        var sv = mg.style.cssText;
        mg.style.height = 'auto'; mg.style.maxHeight = 'none'; mg.style.overflow = 'visible';
        var bottom = mobileTextBottom(mg);
        var fit = bottom ? Math.round(bottom - mg.getBoundingClientRect().top +
          (parseFloat(window.getComputedStyle(mg).paddingBottom) || 0)) : null;
        mg.style.cssText = sv;
        if (fit && apply) {
          guardStyle(mg);
          mg.style.height = Math.max(0, fit - MOBILE_MSG_TRIM) + 'px';
          mg.style.overflow = 'hidden';
        }
        return fit;
      }
      function mobileBoxFit(ctx) { return mobileFitBox(ctx.msgGrow, false); }
      function mobileCh2Measure(ctx) {
        if (ctx.measured || !ctx.msgGrow) { ctx.measured = true; return; }
        var mg = ctx.msgGrow, sv = mg.style.cssText;
        mg.style.height = 'auto'; mg.style.maxHeight = 'none'; mg.style.overflow = 'visible';
        if (ctx.polished) { var pd = ctx.polished.style.display; ctx.polished.style.display = 'none'; ctx.collapsedH = mg.offsetHeight; ctx.polished.style.display = pd; }
        ctx.expandedH = mg.offsetHeight;
        if (ctx.collapsedH == null) { ctx.collapsedH = ctx.expandedH; }

        if (ctx.polished && ctx.expandedH - ctx.collapsedH < 8) { ctx.expandedH = ctx.collapsedH + ctx.polished.scrollHeight; }
        var fit = mobileBoxFit(ctx);
        if (fit) { ctx.expandedH = Math.min(ctx.expandedH, fit); }
        ctx.expandedH = Math.max(ctx.collapsedH, ctx.expandedH - MOBILE_MSG_TRIM);
        mg.style.cssText = sv; mg.style.overflow = 'hidden';
        ctx.measured = true;
        console.log('[flow-stack] mobile ch2: collapsed=' + ctx.collapsedH + ' expanded=' + ctx.expandedH +
          ' rawWords=' + ctx.rawWords.length + ' polishedWords=' + ctx.pwords.length);
      }
      function mobileCh2Render(ctx, tp) {
        var rw = ctx.rawWords, pw = ctx.pwords, nR = rw.length, nP = pw.length, i;
        if (WORD_GRAD && nR) {
          if (!ctx.gradReady) {
            ctx.gradEls = Array.prototype.slice.call(rw);
            ctx.gradW = gradMeasure(ctx.gradEls, ctx.rawTr);
            gradPaint(ctx.gradEls);
            if (ctx.rawTr) { ctx.rawTr.classList.add('is-wordgrad'); }
            ctx.gradReady = true;
          }
          gradShift(ctx.gradEls, ctx.gradW);
        }
        var Fg = phaseT(tp, POLISH_GRAD[0], POLISH_GRAD[1]) * 1.08;
        var Fglow = phaseT(tp, POLISH_GRAD[0], POLISH_GRAD[1]) * (1 + GLOW_BAND + 0.05);
        for (i = 0; i < nR; i++) {
          var ph = nR > 1 ? i / (nR - 1) : 0;
          rw[i].style.color = (Fg > ph) ? 'transparent' : '';
          if (GLOW_EDGE) {
            var df = Fglow - ph, g = (df >= 0 && df < GLOW_BAND) ? (1 - df / GLOW_BAND) : 0;
            rw[i].style.textShadow = g > 0.02
              ? ('0 0 ' + (GLOW_MAX * g).toFixed(1) + 'px rgba(' + GLOW_COLOR + ',' + (0.9 * g).toFixed(2) + ')')
              : '';
          }
          if (WAVE_MOTION) {
            var cw = crestAt(Fglow, ph);
            rw[i].style.transform = cw > 0.002 ? crestCSS(cw, 0) : '';
          }
        }
        var wipe = smooth(phaseT(tp, POLISH_RAWOUT[0], POLISH_RAWOUT[1]));
        if (ctx.rawWrap) {
          var m = rawOutMask(wipe);
          ctx.rawWrap.style.webkitMaskImage = m;
          ctx.rawWrap.style.maskImage = m;
        }
        var grow = outPow(phaseT(tp, POLISH_DROP[0], POLISH_DROP[1]));
        var gpx  = (ctx.expandedH - ctx.collapsedH) * grow;

        if (ctx.msgGrow && ctx.measured) {
          ctx.msgGrow.style.height = (ctx.collapsedH + gpx) + 'px';
          ctx.msgGrow.style.marginTop = (-gpx) + 'px';
          setBoxBleed(ctx.msgGrow, gpx > 0.5);
        }
        var F = outPow(phaseT(tp, POLISH_DROP[0], POLISH_DROP[1])) * (1 + POLISH_GAP + POLISH_BAND);
        for (i = 0; i < nP; i++) {
          var pph = nP > 1 ? i / (nP - 1) : 0;
          var o = smooth((F - pph - POLISH_GAP) / POLISH_BAND);
          pw[i].style.opacity = String(o);
          if (POLISH_WAVE) { pw[i].style.transform = crestCSS(crestAt(F, pph) * 0.6, POLISH_AMP * (1 - o)); }
        }
        if (ctx.placeholder) { ctx.placeholder.style.opacity = String(1 - smooth(Math.min(1, grow * PLACEHOLDER_OUT))); }
        var pillOn = tp >= MOBILE_PILL_AT;
        if (ctx.polishPill) {
          ctx.polishPill.classList.toggle('is-on', pillOn);
          var wantDots = pillOn && tp >= PILL_DOTS_AT;
          if (wantDots !== !!ctx.dotsOn) {
            ctx.dotsOn = wantDots;
            if (ctx.dotsCall) { ctx.dotsCall.kill(); ctx.dotsCall = null; }
            if (wantDots) {
              ctx.polishPill.classList.add('is-done');
              ctx.dotsCall = gsap.delayedCall(PILL_OUT_MS / 1000, function () {
                pillDotsIn(ctx.polishPill);
                if (MOBILE_DOTS_PAD_X >= 0) {
                  var dwrap = ctx.polishPill.querySelector('.flow_pill-polish_wrap') || ctx.polishPill;
                  dwrap.style.setProperty('padding', MOBILE_DOTS_PAD_Y + 'px ' + MOBILE_DOTS_PAD_X + 'px', 'important');
                }
              });
            } else {
              ctx.polishPill.classList.remove('is-in');
              ctx.polishPill.classList.remove('is-done');
              var dwrap0 = ctx.polishPill.querySelector('.flow_pill-polish_wrap') || ctx.polishPill;
              dwrap0.style.removeProperty('padding');
            }
          }
        }
        if (ctx.pillAudio) { ctx.pillAudio.style.opacity = pillOn ? '0' : '1'; }
      }
      function mobileCh2Reset(host) {
        var ctx = host._ch2; if (!ctx) { return; }
        if (host._mobTween) { gsap.killTweensOf(host._mobTween); }
        var i;
        for (i = 0; i < ctx.rawWords.length; i++) {
          ctx.rawWords[i].style.color = ''; ctx.rawWords[i].style.opacity = '1'; ctx.rawWords[i].style.textShadow = '';
          ctx.rawWords[i].style.transform = '';
        }
        if (ctx.rawTr) { ctx.rawTr.style.opacity = '1'; }
        if (ctx.rawWrap) { ctx.rawWrap.style.webkitMaskImage = ''; ctx.rawWrap.style.maskImage = ''; ctx.rawWrap.style.transform = ''; }
        for (i = 0; i < ctx.pwords.length; i++) { ctx.pwords[i].style.opacity = '0'; ctx.pwords[i].style.transform = ''; }
        if (ctx.measured && ctx.msgGrow) { ctx.msgGrow.style.height = ctx.collapsedH + 'px'; ctx.msgGrow.style.marginTop = '0px'; }
        if (ctx.placeholder) { ctx.placeholder.style.opacity = '1'; }
        if (ctx.dotsCall) { ctx.dotsCall.kill(); ctx.dotsCall = null; }
        ctx.dotsOn = false;
        if (ctx.polishPill) { ctx.polishPill.classList.remove('is-on', 'is-done', 'is-in', 'is-wave'); }
        if (ctx.pillAudio) { ctx.pillAudio.style.opacity = '1'; }
      }
      function mobileCh2Play(host) {
        var ctx = host._ch2; if (!ctx) { return; }
        mobileCh2Measure(ctx);
        mobileCh2Reset(host);
        var obj = host._mobTween || (host._mobTween = { c: 0 });
        gsap.killTweensOf(obj); obj.c = 0;
        gsap.to(obj, { c: 1, duration: (MOBILE_CH_MS[1] || 3000) / 1000, ease: 'none', overwrite: true,
          onUpdate: function () { mobileCh2Render(ctx, obj.c); } });
      }

      function mobileCh3Prep(host) {
        var ctx = host._ch3 = {}, slice = Array.prototype.slice;
        ctx.host = host;
        ctx.screen = host.querySelector('[' + FLOW + '="screen"]');
        ctx.live   = host.querySelector('[' + FLOW + '="composer"]');
        ctx.wrap   = host.querySelector('.flow_icons-destination');
        ctx.logos  = ctx.wrap ? slice.call(ctx.wrap.querySelectorAll('[data-dest]')) : [];
        ctx.layer  = host.querySelector('[' + FLOW + '="fan"]');
        ctx.cards  = slice.call(host.querySelectorAll('[data-dest]')).filter(function (el) {
          if (ctx.wrap && ctx.wrap.contains(el)) { return false; }
          return (el.getAttribute('data-dest') || '').trim().toLowerCase() !== 'slack';
        });
        ctx.cards.sort(function (a, b) {
          return (DEST_ORDER[a.getAttribute('data-dest')] || 9) - (DEST_ORDER[b.getAttribute('data-dest')] || 9);
        });

        if (ctx.screen && window.getComputedStyle(ctx.screen).position === 'static') {
          guardStyle(ctx.screen); ctx.screen.style.position = 'relative';
        }
        if (ctx.layer) { guardStyle(ctx.layer); ctx.layer.style.position = 'absolute'; ctx.layer.style.opacity = '0'; }
        ctx.cards.forEach(function (el) {
          guardStyle(el);
          el.style.position = 'absolute';
          el.style.transformOrigin = FAN_PIVOT;
          el.style.backfaceVisibility = 'hidden';
          el.style.willChange = 'transform,opacity';
          el.style.pointerEvents = 'none';
          el.style.opacity = '0';
        });
        ctx.logos.forEach(function (el) {
          guardStyle(el); el.style.transformOrigin = '50% 50%'; el.style.opacity = '0';
          var lk = (el.getAttribute('data-dest') || '').trim().toLowerCase();
          if (LOGO_SIZE[lk]) { el.style.width = LOGO_SIZE[lk] + 'px'; el.style.height = 'auto'; }
        });
        if (ctx.wrap) { guardStyle(ctx.wrap); }
        if (ctx.live) { guardStyle(ctx.live); }

        ctx.rawTr = host.querySelector('[data-type="raw"]');
        if (ctx.rawTr) { guardStyle(ctx.rawTr); }
        ctx.polished = host.querySelector('[data-type="polished"]');
        mobileWrapPolished(ctx.polished);
        mobileNormalisePolished(ctx.polished);
        ctx.pwords  = ctx.polished ? ctx.polished.querySelectorAll('.flow_pw') : [];
        ctx.msgGrow = host.querySelector('[' + FLOW + '="msg-grow"]');
        if (ctx.msgGrow) { guardStyle(ctx.msgGrow); }
        ctx.placeholders = slice.call(host.querySelectorAll('.flow_message-placeholder'));
        ctx.placeholders.forEach(function (el) { guardStyle(el); });
        ctx.n = (ctx.live ? 1 : 0) + ctx.cards.length;
        ctx.positioned = false;
      }

      function mobileCh3Position(ctx) {
        if (!ctx.live) { return; }
        var scr = ctx.screen || ctx.live.offsetParent;
        var sr  = scr ? scr.getBoundingClientRect() : { top: 0, left: 0, height: 0 };
        var cr  = ctx.live.getBoundingClientRect();
        var scH = sr.height || (scr ? scr.clientHeight : 0);
        ctx.live._fanCY = Math.round(scH / 2 - ((cr.top - sr.top) + cr.height / 2));
        for (var i = 0; i < ctx.cards.length; i++) {
          var el = ctx.cards[i];
          var prevT = el.style.transform;
          el.style.transform = 'none';
          el.style.width = cr.width + 'px';

          mobileFitBox(el.querySelector('[' + FLOW + '="msg-grow"]'), true);
          var er   = el.getBoundingClientRect();
          var curT = parseFloat(el.style.top)  || 0;
          var curL = parseFloat(el.style.left) || 0;
          el.style.top  = (curT + (cr.top  - er.top))  + 'px';
          el.style.left = (curL + (cr.left - er.left)) + 'px';
          var bx = (FAN_CENTER_BY && el.querySelector(FAN_CENTER_BY)) || el;
          var br = bx.getBoundingClientRect();
          el._fanCY = Math.round(scH / 2 - ((br.top - sr.top) + br.height / 2)) + FAN_CARD_NUDGE;
          el.style.transform = prevT;
          if (DEBUG) {
            console.log('[fan/mobile] ' + (el.getAttribute('data-dest') || '?') +
              ' box=' + Math.round(br.height) + 'h boxTopInScreen=' + Math.round(br.top - sr.top) +
              ' centreTarget=' + Math.round(scH / 2) + ' cy=' + el._fanCY + ' boxIsWrapper=' + (bx === el));
          }
        }

        if (ctx.wrap && LOGO_TOP && ctx.host) {
          var hr = ctx.host.getBoundingClientRect(), wr = ctx.wrap.getBoundingClientRect();
          if (hr.height && wr.height) {
            var m = parseFloat(window.getComputedStyle(ctx.wrap).marginTop) || 0;
            ctx.wrap.style.marginTop = (m + (LOGO_TOP - (wr.top - hr.top))) + 'px';
          }
        }
      }
      function mobileCh3Static(ctx) {
        if (ctx.rawTr) { ctx.rawTr.classList.remove('is-polishing'); ctx.rawTr.style.opacity = '0'; }
        for (var i = 0; i < ctx.pwords.length; i++) { ctx.pwords[i].style.opacity = '1'; ctx.pwords[i].style.transform = ''; }
        if (ctx.msgGrow) {
          var mFit = mobileFitBox(ctx.msgGrow, true);
          if (!mFit) { ctx.msgGrow.style.height = 'auto'; ctx.msgGrow.style.overflow = 'visible'; }
          else if (SLACK_PAD) { ctx.msgGrow.style.height = Math.max(0, mFit - MOBILE_MSG_TRIM + SLACK_PAD) + 'px'; }
          ctx.msgGrow.style.marginTop = '0px';
        }
        for (var q = 0; q < ctx.placeholders.length; q++) { ctx.placeholders[q].style.opacity = '0'; }
      }
      function mobileCh3Render(ctx, tp, show) {
        var n = ctx.n; if (n < 2) { return; }
        var liftT   = smooth(FAN_LIFT_END > 0 ? Math.min(1, tp / FAN_LIFT_END) : 1);
        var swingTp = FAN_LIFT_END < 1 ? Math.max(0, (tp - FAN_LIFT_END) / (1 - FAN_LIFT_END)) : 0;
        var f = fanStep(swingTp, n);
        if (ctx.layer) { ctx.layer.style.opacity = show ? '1' : '0'; }
        if (ctx.wrap)  { ctx.wrap.style.opacity  = show ? '1' : '0'; }
        function place(el, i, isLive) {
          var rel = i - f, ar = Math.abs(rel);
          if (!show) {
            if (isLive) {
              el.style.transform = ''; el.style.transformOrigin = '';
              el.style.opacity = ''; el.style.zIndex = '';
            } else { el.style.opacity = '0'; }
            return;
          }
          var op = 1 - Math.max(0, Math.min(1, (ar - 1) / FAN_FADE));
          var cy = ((el._fanCY || 0) + FAN_CENTER_NUDGE) * liftT;
          el.style.transformOrigin = FAN_PIVOT;
          el.style.transform = 'translate(' + (fanTx() * rel) + 'px,' + cy + 'px) rotate(' + (FAN_ANGLE * rel) +
            'deg) scale(' + (1 - (1 - FAN_SCALE) * Math.min(1, ar)) + ')';
          el.style.opacity = String(op < 0 ? 0 : op);
          el.style.zIndex  = String(100 - Math.round(ar * 10));
        }
        var ci = 0;
        if (ctx.live) { place(ctx.live, ci++, true); }
        for (var e = 0; e < ctx.cards.length; e++) { place(ctx.cards[e], ci++, false); }
        for (var g = 0; g < ctx.logos.length; g++) {
          var lk = (ctx.logos[g].getAttribute('data-dest') || '').trim().toLowerCase();
          var li = (lk === 'slack') ? 0 : -1;
          if (li < 0) {
            for (var x = 0; x < ctx.cards.length; x++) {
              if ((ctx.cards[x].getAttribute('data-dest') || '').trim().toLowerCase() === lk) { li = x + 1; break; }
            }
          }
          if (!show || li < 0) { ctx.logos[g].style.opacity = '0'; continue; }
          var lrel = (li === 0) ? ((li - f) + (1 - liftT)) : (li - f);
          var lar  = Math.abs(lrel);
          ctx.logos[g].style.opacity   = String(Math.max(0, 1 - lar / LOGO_FADE));
          ctx.logos[g].style.transform = 'rotate(' + (LOGO_ROT * lrel) + 'deg) scale(' +
            (1 - (1 - LOGO_SCALE) * Math.min(1, lar)) + ')';
        }
      }
      function mobileCh3Reset(host) {
        var ctx = host._ch3; if (!ctx) { return; }
        if (host._mobTween) { gsap.killTweensOf(host._mobTween); }
        mobileCh3Static(ctx);
        mobileCh3Render(ctx, 0, false);
      }
      function mobileCh3Play(host) {
        var ctx = host._ch3; if (!ctx) { return; }
        mobileCh3Static(ctx);
        if (!ctx.positioned) { mobileCh3Position(ctx); ctx.positioned = true; }
        var obj = host._mobTween || (host._mobTween = { c: 0 });
        gsap.killTweensOf(obj); obj.c = 0;
        mobileCh3Render(ctx, 0, true);
        gsap.to(obj, { c: 1, duration: (MOBILE_CH_MS[2] || 3000) / 1000, ease: 'none', overwrite: true,
          onUpdate: function () { mobileCh3Render(ctx, obj.c, true); } });
      }

      function mobileWrapWords(root) {
        var tr = root.querySelector('[data-type="raw"]');
        if (!tr || tr.querySelector('.flow_w')) { return; }
        (function walk(node, cat) {
          var kids = Array.prototype.slice.call(node.childNodes);
          for (var i = 0; i < kids.length; i++) {
            var n = kids[i];
            if (n.nodeType === 3) {
              var frag = document.createDocumentFragment();
              n.textContent.split(/(\s+)/).forEach(function (chunk) {
                if (chunk === '') { return; }
                if (/^\s+$/.test(chunk)) { frag.appendChild(document.createTextNode(chunk)); return; }
                var w = document.createElement('span');
                w.className = 'flow_w'; w.textContent = chunk; w.style.opacity = '0';
                if (cat) { w.setAttribute('data-cat', cat); }
                frag.appendChild(w);
              });
              node.replaceChild(frag, n);
            } else if (n.nodeType === 1) {
              var m = /(?:^|\s)flow_type-([a-z]+)/.exec(n.className || '');
              walk(n, m ? m[1] : cat);
            }
          }
        }(tr, null));
      }

      function buildMobileWpm() {
        if (!stage || !MOBILE_WPM) { return false; }
        var wpmCard = (card && stage.contains(card)) ? card : one(stage, 'card');
        if (!MOBILE_WPM_LAYOUT) {
          [kbMq, cardMq].forEach(function (mq) {
            var svg = mq && mq.querySelector('svg');
            if (svg) { guardStyle(svg); svg.style.overflow = 'visible'; }
          });
          fitMarqueeText();
          if (typeof window.requestAnimationFrame === 'function') { window.requestAnimationFrame(fitMarqueeText); }
          window.addEventListener('resize', fitMarqueeText);
          teardown.push(function () { window.removeEventListener('resize', fitMarqueeText); });
          return true;
        }
        guardStyle(stage);
        stage.style.setProperty('display', 'flex', 'important');
        stage.style.setProperty('flex-direction', 'column', 'important');
        stage.style.alignItems    = 'stretch';
        stage.style.gap           = MOBILE_WPM_GAP + 'px';
        stage.style.position      = 'static';
        stage.style.width = ''; stage.style.height = '';
        stage.style.overflow = MOBILE_WPM_AUTO_H ? '' : 'hidden';
        [kb, wpmCard].forEach(function (c) {
          if (!c) { return; }
          guardStyle(c);
          c.style.width = '100%'; c.style.maxWidth = 'none';
          if (MOBILE_WPM_AUTO_H) { c.style.flex = '0 0 auto'; }
          else { c.style.flex = '1 1 0'; c.style.height = 'auto'; c.style.minHeight = '0'; }
          c.style.transform = ''; c.style.visibility = ''; c.style.opacity = '1';
          c.style.position = 'relative'; c.style.left = ''; c.style.top = ''; c.style.margin = '0';
          c.style.overflow = 'hidden';
          c.style.display = 'flex'; c.style.flexDirection = 'column';
          c.style.alignItems = 'center'; c.style.justifyContent = 'center';
          c.style.gap = '8px'; c.style.boxSizing = 'border-box';
          c.style.padding = MOBILE_WPM_PAD + 'px';
          Array.prototype.forEach.call(c.querySelectorAll('img[data-bg]'), function (im) {
            guardStyle(im);
            im.style.position = 'absolute'; im.style.inset = '0'; im.style.zIndex = '0';
            im.style.width = '100%'; im.style.height = '100%'; im.style.objectFit = 'cover';
          });
        });
        for (var h = 0; h < headEls.length; h++) {
          if (!stage.contains(headEls[h])) { continue; }
          if (!MOBILE_HEAD_PIN) {
            headEls[h].style.position = ''; headEls[h].style.left = ''; headEls[h].style.right = '';
            headEls[h].style.top = ''; headEls[h].style.transform = ''; headEls[h].style.margin = '';
            continue;
          }
          headEls[h].style.position = 'absolute';
          headEls[h].style.left = '0'; headEls[h].style.right = '0';
          var headPx = pickBP(MOBILE_HEAD_TOP_BP) || MOBILE_HEAD_TOP_PX;
          headEls[h].style.top = headPx > 0 ? (headPx + 'px') : (MOBILE_WPM_HEAD_TOP + '%');
          headEls[h].style.transform = 'translateY(-50%)';
          headEls[h].style.margin = '0'; headEls[h].style.textAlign = 'center'; headEls[h].style.zIndex = '1';
        }
        [kbMq, cardMq].forEach(function (mq) {
          if (!mq) { return; }
          if (MOBILE_MQ_PLACE) {
            mq.style.position = 'absolute';
            mq.style.left = '0'; mq.style.right = '0'; mq.style.width = 'auto'; mq.style.marginRight = '0';
            mq.style.top = '0'; mq.style.transform = ''; mq.style.zIndex = '1';
          }
          var svg = mq.querySelector('svg');
          if (svg) {
            guardStyle(svg);
            svg.style.width = '100%'; svg.style.height = 'auto'; svg.style.maxWidth = 'none';
            svg.style.overflow = 'visible';
          }
        });

        Array.prototype.forEach.call(stage.querySelectorAll('[' + FLOW + '="screen"],[data-pill]'),
          function (el) { guardStyle(el); el.style.display = 'none'; });
        if (pillAudioEl && stage.contains(pillAudioEl)) {
          pillAudioEl.style.display = ''; pillAudioEl.style.position = 'relative';
          pillAudioEl.style.transform = ''; pillAudioEl.style.opacity = '1'; pillAudioEl.style.zIndex = '1';
        }
        if (introEl && stage.contains(introEl)) { introEl.style.opacity = '1'; }

        function fitMarqueeText() {
          var wantPx = mqTextPx() || MOBILE_WPM_TEXT_PX;
          if (!wantPx) { return; }
          for (var i = 0; i < marquees.length; i++) {
            var m = marquees[i];
            if (!m.svg || !stage.contains(m.svg)) { continue; }
            var w = m.svg.getBoundingClientRect().width;
            if (w <= 0) { continue; }
            setMqFont(m, (wantPx * m.vbw / w).toFixed(1));
            m.len = textLen(m.text, m.tp);

            var host = (kb && kb.contains(m.svg)) ? kb : wpmCard;
            var wrap = m.svg.parentNode;
            if (!host || !wrap || wrap.nodeType !== 1) { continue; }
            wrap.style.top = '0px';
            var hostR = host.getBoundingClientRect(), txtR = m.text.getBoundingClientRect();
            if (!txtR.height) { continue; }
            if (!MOBILE_MQ_PLACE) { continue; }
            var isFlow = !(kb && kb.contains(m.svg));
            var bpPx = pickBP(MOBILE_MQ_TOP_BP);
            var topPx = bpPx || (isFlow ? (MOBILE_MQ_TOP_PX_FLOW || MOBILE_MQ_TOP_PX) : MOBILE_MQ_TOP_PX);
            if (topPx > 0) {
              wrap.style.top = Math.round((hostR.top + topPx) - (txtR.top + txtR.height / 2)) + 'px';
            } else {
              var want = hostR.top + hostR.height * (MOBILE_WPM_MQ_TOP / 100);
              wrap.style.top = Math.round(want - (txtR.top + txtR.height / 2)) + 'px';
            }
          }
        }
        fitMarqueeText();
        if (typeof window.requestAnimationFrame === 'function') { window.requestAnimationFrame(fitMarqueeText); }
        var tick = function () {
          var dr = gsap.ticker.deltaRatio();
          mqClock    += dr / 60;
          audioClock += dr / 60;   // mobile has no scrub tick — drive the waveform here
          updateMarquees(0);
          if (AUDIO_SPEED > 0) { updateAudio(0); }
        };
        gsap.ticker.add(tick);
        teardown.push(function () { gsap.ticker.remove(tick); });
        return true;
      }
      function buildMobileChapters() {
        var mob = section.querySelector('[' + ATTR + '="mobile"]');
        if (!mob) { return; }
        var blocks = Array.prototype.slice.call(mob.querySelectorAll('[data-flow-play]'));
        blocks.forEach(function (block) {
          var ch = block.getAttribute('data-flow-play');
          var host = block.querySelector('.mobile_visual_contain') || block;
          if (!host.children.length) { return; }
          uniquifyIds(host);
          if (ch === 'ch2')      { mobileCh2Prep(host); }
          else if (ch === 'ch3') { mobileCh3Prep(host); }
          else { mobileWrapWords(host); }
          mobileReset(host, ch);
          if (typeof window.IntersectionObserver === 'function') {
            var io = new IntersectionObserver(function (entries) {
              for (var e = 0; e < entries.length; e++) {
                if (entries[e].isIntersecting) { mobilePlay(host, ch); } else { mobileReset(host, ch); }
              }
            }, { threshold: 0, rootMargin: '0px 0px ' + MOBILE_IO_MARGIN + ' 0px' });
            io.observe(block);
            teardown.push(function () { io.disconnect(); });
          } else { mobilePlay(host, ch); }
        });
      }

      var st = null, lastSnapP = null;
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

          snap: SNAP ? { snapTo: function (value) {
            if (value < pHold - 0.001) { lastSnapP = null; return value; }
            var pts = snapPoints, si, d;
            if (lastSnapP == null) {
              lastSnapP = pts[0]; var b0 = Math.abs(value - pts[0]);
              for (si = 1; si < pts.length; si++) { d = Math.abs(value - pts[si]); if (d < b0) { b0 = d; lastSnapP = pts[si]; } }
            }
            var eps = 0.004, target = lastSnapP;
            if (value > lastSnapP + eps) {
              for (si = 0; si < pts.length; si++) { if (pts[si] > lastSnapP + 0.0005) { target = pts[si]; break; } }
            } else if (value < lastSnapP - eps) {
              for (si = pts.length - 1; si >= 0; si--) { if (pts[si] < lastSnapP - 0.0005) { target = pts[si]; break; } }
            }
            lastSnapP = target;
            return target;
          }, duration: SNAP_DUR, ease: 'power1.inOut', inertia: false, directional: false } : false
        });

        var scrubTick = function () {
          var dr = gsap.ticker.deltaRatio();
          audioClock += dr / 60;
          mqClock    += dr / 60;
          if (SCRUB_LERP >= 1) { pSmooth = pTarget; }
          else {
            var k = 1 - Math.pow(1 - SCRUB_LERP, dr);
            pSmooth += (pTarget - pSmooth) * k;
            if (Math.abs(pTarget - pSmooth) < 0.0002) { pSmooth = pTarget; }
          }
          var moved = (pSmooth !== painted);
          if (moved) { painted = pSmooth; }

          if (MQ_AUTOPLAY || moved) { updateMarquees(pSmooth); }

          if (AUDIO_SPEED > 0 || moved) { updateAudio(pSmooth); }
        };
        gsap.ticker.add(scrubTick);
        teardown.push(function () { gsap.ticker.remove(scrubTick); });
        var autoTick = function () {
          if (!autoPlaying) { return; }
          autoTp += (gsap.ticker.deltaRatio() * (1000 / 60)) / autoDur;
          if (autoTp >= 1) {
            if (tabLoops(activeTab)) {

              autoTp = 1;
              if (!loopWaitT) { loopWaitT = gsap.ticker.time + LOOP_GAP_MS / 1000; }
              else if (gsap.ticker.time >= loopWaitT) {
                loopWaitT = 0; autoTp = 0;

                sceneUpdate(sceneLastP);
                snapEased();
              }
            } else {
              autoTp = 1; autoPlaying = false;
              if (activeTab >= 0) { autoDone[activeTab] = true; }
            }
          }
          sceneUpdate(sceneLastP);
        };
        gsap.ticker.add(autoTick);
        teardown.push(function () { gsap.ticker.remove(autoTick); });
        var voiceTick = function () {
          if (!voiceLive || !voiceDots.length) { return; }
          var TWO_PI = Math.PI * 2, t = audioClock * AUDIO_SPEED, N = voiceDots.length, i, xi, wave, s;
          for (i = 0; i < N; i++) {
            xi = N > 1 ? i / (N - 1) : 0.5;
            wave = 0.6 * Math.sin((xi * AUDIO_WAVE_SPAN - t) * TWO_PI) +
                   0.4 * Math.sin((xi * AUDIO_WAVE_SPAN * 0.5 - t * 0.6) * TWO_PI + 1.7);
            s = (0.5 + 0.5 * wave) * (0.7 + 0.3 * Math.sin(xi * Math.PI));
            voiceDots[i].style.height = (BAR_MIN + s * (BAR_MAX - BAR_MIN)).toFixed(1) + 'px';
          }
        };
        gsap.ticker.add(voiceTick);
        teardown.push(function () { gsap.ticker.remove(voiceTick); });
        gsap.ticker.add(fanTick);
        teardown.push(function () { gsap.ticker.remove(fanTick); });
        gsap.ticker.add(polishTick);
        teardown.push(function () { gsap.ticker.remove(polishTick); });
        gsap.ticker.add(pillTick);
        teardown.push(function () { gsap.ticker.remove(pillTick); });
      } else {

        if (!buildMobileWpm() && stage) { stage.style.display = 'none'; }
        buildMobileChapters();
      }

      if (DEBUG) {
        console.log('[flow-stack] build mode=' + (isDesktop ? 'desktop' : 'mobile') +
          ' rebuild=' + isRebuild + ' marquees=' + marquees.length +
          ' numTabs=' + numTabs + ' totalVH=' + totalVH.toFixed(2));
        console.log('[flow-stack] scene: transcript=' + !!transcriptEl + ' words=' + words.length +
          ' composer=' + !!composerEl + ' intro=' + !!introEl + ' pills=' + pillEls.length +
          ' pillKeys=' + JSON.stringify(Object.keys(pillMap)));
        console.log('[flow-stack] heights: msgGrow=' + !!msgGrowEl + ' collapsed=' + msgCollapsedH +
          ' expanded=' + msgExpandedH + ' delta=' + (msgExpandedH - msgCollapsedH) +
          ' polishedWords=' + pwords.length + ' transcriptH=' + transcriptH + ' cardHpx=' + cardHpx.toFixed(0));
      }

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

      var bgTicker = function () {
        if (BG_TRIGGER) { return; }
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

      var clickLockP = null, clickLockT = 0, tabFade = false, tabFadeCall = null, tabFadeT = 0;

      var sceneEls = (screenEl ? [screenEl] : [transcriptEl, composerEl]).filter(Boolean);
      function setSceneOpacity(a, ms) {
        for (var s = 0; s < sceneEls.length; s++) {
          sceneEls[s].style.transition = 'opacity ' + ms + 'ms ease';
          sceneEls[s].style.opacity = String(a);
        }
      }
      function clearSceneTransition() { for (var s = 0; s < sceneEls.length; s++) { sceneEls[s].style.transition = ''; } }
      function snapEased() {
        fanFCur = fanFTgt; fanLiftCur = fanLiftTgt; polishCur = polishTgt; pillCur = pillTgt;
      }
      function killTabFade() { if (tabFadeCall) { tabFadeCall.kill(); tabFadeCall = null; } }
      function interruptTab() {
        if (!tabFade && !tabFadeCall) { return; }
        killTabFade(); tabFade = false; clearSceneTransition();
        if (st) { applyScroll(st.progress); }
      }
      ['wheel', 'touchstart', 'keydown'].forEach(function (ev) {
        window.addEventListener(ev, interruptTab, { passive: true });
        teardown.push(function () { window.removeEventListener(ev, interruptTab, { passive: true }); });
      });
      tabItems.forEach(function (item, i) {
        guardStyle(item);
        item.style.cursor = 'pointer';
        var onClick = function () {
          if (!st) { return; }

          var centreP = (tabStops[i] + tabStops[i + 1]) / 2;
          var tabFrac = (1 - pHold) > 0 ? (centreP - pHold) / (1 - pHold) : 0;
          var N = bgSvgs.length || 1;
          bgCurrentP = Math.min(N - 1, Math.floor(tabFrac * N)) / N;
          var to = st.start + centreP * (st.end - st.start);
          clickLockP = centreP; clickLockT = Date.now();
          setActiveTab(i);
          killTabFade();
          tabFade = true; tabFadeT = Date.now();
          setSceneOpacity(0, TAB_FADE_MS);
          tabFadeCall = gsap.delayedCall(TAB_FADE_MS / 1000, function () {
            window.scrollTo(0, to);
            lastSnapP = centreP;
            applyScroll(centreP);
            if (AUTOPLAY) { startAutoplay(i); }
            snapEased();
            setSceneOpacity(1, TAB_FADE_MS);
            tabFadeCall = gsap.delayedCall(TAB_FADE_MS / 1000, function () {
              tabFade = false; tabFadeCall = null; clearSceneTransition();
            });
          });
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
      var lastVW = window.innerWidth, roTimer = null;
      var ro = new ResizeObserver(function () {

        // WIDTH-only. mobile browsers change innerHeight as the address bar shows/hides DURING
        // scroll; refreshing on that fires ScrollTrigger.refresh() mid-scroll and glitches every
        // pinned section on the page.
        if (window.innerWidth === lastVW) { return; }
        lastVW = window.innerWidth;
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
